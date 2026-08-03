#!/usr/bin/env node
/**
 * 真实 Chrome 验收：未打包 MV3 扩展必须在本地 HTTPS fixture 中标注词汇、
 * 响应“会／不会”并在刷新后保留；并需通过弹窗完成固定 50 题首测，
 * 其冻结计划、作答状态迁移与已开页面更新均须符合规格。任何一步缺失均以非零状态失败。
 */
const { execFileSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const https = require('node:https');
const os = require('node:os');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const puppeteer = require('puppeteer-core');

const ROOT = __dirname;
const DIST_DIR = path.join(ROOT, 'dist');
const FIXTURE = path.join(ROOT, 'tests/fixtures/test-page.html');
const PORT = 18923;

function findChromeForTesting() {
  if (process.env.CHROME_FOR_TESTING) return process.env.CHROME_FOR_TESTING;
  const chromeRoot = path.join(ROOT, '.cache', 'puppeteer', 'chrome');
  if (!fs.existsSync(chromeRoot)) return null;
  const builds = fs.readdirSync(chromeRoot)
    .map((name) => path.join(chromeRoot, name))
    .filter((candidate) => fs.statSync(candidate).isDirectory())
    .sort()
    .reverse();
  for (const build of builds) {
    const executable = path.join(
      build,
      'chrome-mac-arm64',
      'Google Chrome for Testing.app',
      'Contents',
      'MacOS',
      'Google Chrome for Testing',
    );
    if (fs.existsSync(executable)) return executable;
  }
  return null;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 本地日期字符串（YYYY-MM-DD）；date seam 的最小生产来源，与 popup 实现一致 */
function localDateString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 对 page.goto 加重试：Chrome for Testing 151 经 puppeteer-core connect 后，
 * 首帧偶尔未就绪会抛「Requesting main frame too early」，短暂等待后重试即可。
 */
async function gotoSafe(page, url, opts = {}) {
  let lastErr;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      await page.goto(url, opts);
      return;
    } catch (err) {
      lastErr = err;
      if (err && err.message && err.message.includes('Requesting main frame too early')) {
        await wait(400);
        continue;
      }
      throw err;
    }
  }
  throw new Error(`goto 多次重试仍失败：${lastErr && lastErr.message}`);
}

function onceListening(server) {
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
}

/** 启动一个独立 Chrome 实例（独立 user-data-dir = 独立本地存储），返回 browser 与 chrome 进程 */
async function launchChrome(userDataDir, chromeForTesting) {
  // 默认保留 Chrome 原生 sandbox（本机常规路径）。
  // 仅当显式设置环境变量 AVR_E2E_NO_SANDBOX=1 时，才关闭 sandbox 并绕过 /dev/shm 限制
  // （受限 CI / 沙箱环境需要）。两种模式均只改变测试运行环境，不影响任何被测行为或断言。
  const disableSandbox = process.env.AVR_E2E_NO_SANDBOX === '1';
  const sandboxArgs = disableSandbox ? ['--no-sandbox', '--disable-dev-shm-usage'] : [];
  const chrome = spawn(chromeForTesting, [
    `--user-data-dir=${userDataDir}`,
    `--load-extension=${DIST_DIR}`,
    `--disable-extensions-except=${DIST_DIR}`,
    '--no-first-run', '--no-default-browser-check',
    '--ignore-certificate-errors', '--remote-debugging-port=0', '--enable-logging=stderr', '--v=1',
    '--headless=new',
    ...sandboxArgs,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  const devtools = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Chrome 未在 15 秒内启动 DevTools')), 15_000);
    chrome.stderr.on('data', (data) => {
      const match = data.toString().match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    });
    chrome.on('exit', (code) => reject(new Error(`Chrome 提前退出：${code}`)));
  });

  const browser = await puppeteer.connect({ browserWSEndpoint: devtools, protocolTimeout: 240_000 });
  return { chrome, browser };
}

async function killChrome(chrome) {
  if (!chrome || chrome.exitCode !== null) return;
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      chrome.kill('SIGKILL');
      resolve(undefined);
    }, 5_000);
    chrome.once('exit', () => {
      clearTimeout(timeout);
      resolve(undefined);
    });
    chrome.kill('SIGTERM');
  });
}

function extensionIdFromTargets(browser) {
  const targets = browser.targets()
    .map((t) => t.url())
    .filter((url) => url.startsWith('chrome-extension://'));
  const hit = targets.find((url) => url.includes('/worker.js')) || targets[0];
  const m = hit?.match(/chrome-extension:\/\/([^/]+)\//);
  return m ? m[1] : null;
}

async function getWorker(browser) {
  const sw = browser.targets().find(
    (t) => t.type() === 'service_worker' && t.url().endsWith('/worker.js'),
  );
  return sw ? sw.worker() : null;
}

/** 轮询等待扩展 Service Worker 出现（重启后的新实例） */
async function waitForWorker(browser, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const worker = await getWorker(browser);
    if (worker) return worker;
    await wait(200);
  }
  return null;
}

/**
 * 同 profile 重启整个 Chrome 进程（R-AUD-2）。
 * worker 将 currentSnapshot 缓存在内存，且不监听 chrome.storage 的外部变化；
 * 注入的残留快照只有在「新 Service Worker 启动时经 loadSnapshot 重新读取」才会被
 * 运行时消费。chrome.storage.local 随 profile 持久化到磁盘，因此杀掉进程后用同一
 * user-data-dir 重新启动，新 worker 的启动路径就会从 storage 加载注入快照——
 * 这是对「终止并重新启动 Service Worker」的最强真实验证（整进程重启 + 真实启动路径）。
 */
async function restartChromeOnSameProfile(userDataDir, chromeForTesting, browser, chrome) {
  await browser.close();
  await killChrome(chrome);
  await wait(500);
  const relaunched = await launchChrome(userDataDir, chromeForTesting);
  await wait(1_000);
  return relaunched;
}

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avr-e2e-'));
  const certPath = path.join(tempDir, 'cert.pem');
  const keyPath = path.join(tempDir, 'key.pem');

  const chromeForTesting = findChromeForTesting();
  if (!chromeForTesting) {
    throw new Error('未找到 Chrome for Testing；请先执行 npm run setup:e2e，或设置 CHROME_FOR_TESTING');
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(DIST_DIR, 'manifest.json'), 'utf8'));
  if (manifest.manifest_version !== 3 || !fs.existsSync(path.join(DIST_DIR, 'content.js'))) {
    throw new Error('dist/ 不是可加载的 MV3 扩展；请先执行 npm run build');
  }
  const dictCore = JSON.parse(fs.readFileSync(path.join(DIST_DIR, 'data', 'dict-core.json'), 'utf8'));
  const forms = JSON.parse(fs.readFileSync(path.join(DIST_DIR, 'data', 'forms.json'), 'utf8'));
  const report = JSON.parse(fs.readFileSync(path.join(DIST_DIR, 'data', 'build-report.json'), 'utf8'));
  if (Object.keys(dictCore).length !== 1_000 || Object.keys(forms).length === 0 || report.selected_count !== 1_000) {
    throw new Error('dist/ 未包含已验证的 1,000 词 ECDICT 核心包');
  }

  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-keyout', keyPath, '-out', certPath,
    '-days', '1', '-nodes', '-subj', '/CN=localhost',
  ], { stdio: 'ignore' });

  const server = https.createServer(
    { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) },
    (request, response) => {
      if (request.url === '/' || request.url === '/test-page.html') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end(fs.readFileSync(FIXTURE, 'utf8'));
        return;
      }
      if (request.url === '/spa-page.html') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end(fs.readFileSync(path.join(ROOT, 'tests/fixtures/spa-page.html'), 'utf8'));
        return;
      }
      if (request.url === '/long-read.html') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end(fs.readFileSync(path.join(ROOT, 'tests/fixtures/long-read.html'), 'utf8'));
        return;
      }
      if (request.url === '/plan-words.html') {
        const f = path.join(tempDir, 'plan-words.html');
        if (fs.existsSync(f)) {
          response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
          response.end(fs.readFileSync(f, 'utf8'));
          return;
        }
      }
      response.writeHead(404).end();
    },
  );
  await onceListening(server);

  const pageLogs = [];
  const chromeLogs = [];

  try {
  // ============================================================
  // 阶段一：本地阅读闭环（#1）
  // ============================================================
  let browser1;
  let chrome1;
  try {
    ({ chrome: chrome1, browser: browser1 } = await launchChrome(path.join(tempDir, 'profile-1'), chromeForTesting));
    // 复用 connect 后已存在的初始页面（其主帧已就绪），规避 Chrome 151 + puppeteer-core 的 newPage 竞态
    const page = (await browser1.pages())[0] || (await browser1.newPage());
    page.on('console', (message) => pageLogs.push(`${message.type()}: ${message.text()}`));
    page.on('pageerror', (error) => pageLogs.push(`pageerror: ${error.message}`));
    await wait(1_000);

    await gotoSafe(page, `https://localhost:${PORT}/`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.avr-word', { timeout: 10_000 });

    const initial = await page.evaluate(() => ({
      annotations: document.querySelectorAll('.avr-word').length,
      unknown: document.querySelectorAll('.avr-light').length,
      forbiddenInNav: document.querySelectorAll('nav .avr-word').length,
      forbiddenInCode: document.querySelectorAll('code .avr-word').length,
      forbiddenInComment: document.querySelectorAll('.comment-section .avr-word').length,
      challengesFormHit: [...document.querySelectorAll('.avr-word[data-word="challenge"]')]
        .some((element) => element.textContent?.toLowerCase() === 'challenges'),
    }));
    if (initial.annotations === 0 || initial.unknown === 0) throw new Error(`未获得未知词轻提示：${JSON.stringify(initial)}`);
    if (initial.forbiddenInNav || initial.forbiddenInCode || initial.forbiddenInComment) throw new Error(`扫描了应跳过区域：${JSON.stringify(initial)}`);
    if (!initial.challengesFormHit) throw new Error(`词形映射/wordKey 合并未在真实页面命中：${JSON.stringify(initial)}`);

    const challenge = await page.$('.avr-word[data-word="challenge"]');
    if (!challenge) throw new Error('fixture 中 challenge / challenged 未被本地词典与词形映射命中');
    await challenge.click();
    await page.waitForSelector('.avr-action-menu button[data-avr-status="learning"]', { visible: true });
    await page.click('.avr-action-menu button[data-avr-status="learning"]');
    await page.waitForSelector('.avr-strong-first[data-word="challenge"]', { timeout: 5_000 });
    const strong = await page.evaluate(() => ({
      first: document.querySelectorAll('.avr-strong-first[data-word="challenge"]').length,
      repeats: document.querySelectorAll('.avr-strong[data-word="challenge"]').length,
      inline: document.querySelectorAll('.avr-strong-first[data-word="challenge"][data-translation]').length,
    }));
    if (strong.first !== 1 || strong.repeats < 1 || strong.inline !== 1) throw new Error(`不会词的首现/重复展示错误：${JSON.stringify(strong)}`);

    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.avr-strong-first[data-word="challenge"]', { timeout: 10_000 });
    const persisted = await page.evaluate(() => ({
      first: document.querySelectorAll('.avr-strong-first[data-word="challenge"]').length,
      repeats: document.querySelectorAll('.avr-strong[data-word="challenge"]').length,
    }));
    if (persisted.first !== 1 || persisted.repeats < 1) throw new Error(`刷新后不会词状态未保留：${JSON.stringify(persisted)}`);

    const worker1 = await getWorker(browser1);
    if (!worker1) throw new Error('未找到本扩展的 Service Worker，无法检查本地快照');
    const snapshot1 = (await worker1.evaluate(async () => chrome.storage.local.get('avr_vocab_snapshot'))).avr_vocab_snapshot;
    const serialized1 = JSON.stringify(snapshot1);
    if (!snapshot1 || !snapshot1.dictVersion || snapshot1.words?.challenge?.status !== 'learning' || /localhost|Journey Through Language|comment-section/.test(serialized1)) {
      throw new Error(`本地快照不符合最小隐私/状态要求：${serialized1}`);
    }
    const evidenceBeforeManual = snapshot1.assessmentEvidence;
    if (!isDeepStrictEqual(evidenceBeforeManual, {})) throw new Error('手动标记前的新 profile 不应已有测试证据');

    const persistedChallenge = await page.$('.avr-word[data-word="challenge"]');
    if (!persistedChallenge) throw new Error('刷新后无法对 challenge 执行“会”覆盖验收');
    await persistedChallenge.click();
    await page.click('.avr-action-menu button[data-avr-status="known"]');
    await page.waitForFunction(() => document.querySelectorAll('.avr-word[data-word="challenge"]').length === 0);
    await page.reload({ waitUntil: 'networkidle0' });
    await wait(500);
    const knownAfterReload = await page.evaluate(() => document.querySelectorAll('.avr-word[data-word="challenge"]').length);
    if (knownAfterReload !== 0) throw new Error('“会”状态未立即覆盖并跨刷新保留');
    const afterChallengeManual = (await worker1.evaluate(async () => chrome.storage.local.get('avr_vocab_snapshot'))).avr_vocab_snapshot;
    if (!isDeepStrictEqual(afterChallengeManual.assessmentEvidence, evidenceBeforeManual)) {
      throw new Error('R-EVD-1 失败：手动标记 challenge 改写了 AssessmentEvidence');
    }

    // §21 场景 3（局部）：form-only "abilities" 与 core "ability" 共享 wordKey。
    // 此固定 1,000 词包没有 go/went；用产物中实际存在的单复数对验证同一行为。
    const abilitySpans = await page.$$('.avr-word[data-word="ability"]');
    let abilities;
    for (const span of abilitySpans) {
      if ((await span.evaluate((element) => element.textContent?.toLowerCase())) === 'abilities') {
        abilities = span;
        break;
      }
    }
    const formsShareWordKey = await page.evaluate(() => {
      const texts = [...document.querySelectorAll('.avr-word[data-word="ability"]')]
        .map((element) => element.textContent?.toLowerCase());
      return texts.includes('ability') && texts.includes('abilities');
    });
    if (!abilities || !formsShareWordKey) throw new Error('fixture 未获得 abilities/ability 的共享 wordKey 标注');
    await abilities.click();
    await page.waitForSelector('.avr-action-menu button[data-avr-status="known"]', { visible: true });
    await page.click('.avr-action-menu button[data-avr-status="known"]');
    await page.waitForFunction(() => document.querySelectorAll('.avr-word[data-word="ability"]').length === 0, { timeout: 5_000 });
    const snapIso = (await worker1.evaluate(async () => chrome.storage.local.get('avr_vocab_snapshot'))).avr_vocab_snapshot;
    if (snapIso.words?.ability?.status !== 'known' || snapIso.words?.abilities) {
      throw new Error(`词形未以 core wordKey 合并存储：${JSON.stringify(Object.keys(snapIso.words || {}))}`);
    }
    if (!isDeepStrictEqual(snapIso.assessmentEvidence, evidenceBeforeManual)) {
      throw new Error('R-EVD-1 失败：手动标记 abilities 改写了 AssessmentEvidence');
    }
    await page.reload({ waitUntil: 'networkidle0' });
    await wait(400);
    const abilAfter = await page.evaluate(() => document.querySelectorAll('.avr-word[data-word="ability"]').length);
    if (abilAfter !== 0) throw new Error('共享 wordKey 的 known 状态未跨刷新保留');

    console.log(`E2E #1 PASS: annotations=${initial.annotations}, unknown=${initial.unknown}, challenge_first=${persisted.first}, challenge_repeats=${persisted.repeats}, form_merge=abilities→ability(wordKey), local_snapshot=minimal`);
  } finally {
    if (browser1) await browser1.close();
    await killChrome(chrome1);
  }

  // ============================================================
  // 阶段一 B：schema 2 → 3 的真实 worker/storage 启动路径（R-MIG-7）
  // ============================================================
  let browserMigration;
  let chromeMigration;
  try {
    const migrationProfile = path.join(tempDir, 'profile-migration');
    ({ chrome: chromeMigration, browser: browserMigration } = await launchChrome(migrationProfile, chromeForTesting));
    let workerMigration = await waitForWorker(browserMigration);
    if (!workerMigration) throw new Error('迁移 E2E 未找到初始 Service Worker');
    const live = await workerMigration.evaluate(async () => (await chrome.storage.local.get('avr_vocab_snapshot')).avr_vocab_snapshot);
    const schema2Fixture = {
      schemaVersion: 2,
      dictVersion: live.dictVersion,
      stateVersion: 0,
      installSeed: 'migration-seed',
      words: {
        ability: { status: 'learning', source: 'manual', updatedAt: 4, version: 0 },
        abilities: { status: 'known', source: 'initial', updatedAt: 5, version: 0 },
      },
      auditMarkers: { legacy: { word: 'legacy' } },
      auditLog: [{ word: 'legacy' }],
      auditPlan: { version: 'legacy-plan' },
      initialTest: {
        plan: { version: 'old', seed: 'migration-seed', dictVersion: live.dictVersion, questions: [
          { word: 'ability', options: [{}, {}], correctOptionIndex: 0 },
        ] },
        answers: [{ kind: 'option', optionIndex: 0 }],
        completed: false,
      },
      lastUpdated: 5,
    };
    await workerMigration.evaluate((snapshot) => chrome.storage.local.set({ avr_vocab_snapshot: snapshot }), schema2Fixture);

    ({ chrome: chromeMigration, browser: browserMigration } = await restartChromeOnSameProfile(migrationProfile, chromeForTesting, browserMigration, chromeMigration));
    workerMigration = await waitForWorker(browserMigration);
    if (!workerMigration) throw new Error('迁移 E2E 第一次重启后未找到 Service Worker');
    const migratedOnce = await workerMigration.evaluate(async () => (await chrome.storage.local.get('avr_vocab_snapshot')).avr_vocab_snapshot);
    if (
      migratedOnce.schemaVersion !== 3 ||
      migratedOnce.words?.ability?.status !== 'known' ||
      migratedOnce.words?.abilities ||
      !isDeepStrictEqual(migratedOnce.assessmentEvidence, { ability: { outcome: 'known', source: 'initial', assessedAt: 0 } }) ||
      Object.keys(migratedOnce.auditMarkers || {}).length !== 0 ||
      migratedOnce.auditPlan !== null ||
      migratedOnce.dailyTest !== null ||
      migratedOnce.completedRoundIndex !== 0
    ) throw new Error(`R-MIG-7 第一次真实迁移结果错误：${JSON.stringify(migratedOnce)}`);

    ({ chrome: chromeMigration, browser: browserMigration } = await restartChromeOnSameProfile(migrationProfile, chromeForTesting, browserMigration, chromeMigration));
    workerMigration = await waitForWorker(browserMigration);
    if (!workerMigration) throw new Error('迁移 E2E 第二次重启后未找到 Service Worker');
    const migratedTwice = await workerMigration.evaluate(async () => (await chrome.storage.local.get('avr_vocab_snapshot')).avr_vocab_snapshot);
    if (!isDeepStrictEqual(migratedTwice, migratedOnce)) throw new Error('R-MIG-7 失败：schema 3 重启后不再恒等');
    console.log('E2E #1B PASS: schema2_to_v3=true, forms_merge=abilities→ability, evidence_rebuilt=true, persisted_idempotent=true');
  } finally {
    if (browserMigration) await browserMigration.close();
    await killChrome(chromeMigration);
  }

  // ============================================================
  // 阶段二：固定 50 题首测（#2）—— 独立浏览器与存储，避免阶段一污染
  // ============================================================
  let browser2;
  let chrome2;
  try {
    ({ chrome: chrome2, browser: browser2 } = await launchChrome(path.join(tempDir, 'profile-2'), chromeForTesting));
    await wait(1_000);

    const extensionId0 = extensionIdFromTargets(browser2);
    if (!extensionId0) throw new Error('无法解析扩展 ID，无法打开弹窗');
    let extensionId = extensionId0;

    let worker2 = await getWorker(browser2);
    if (!worker2) throw new Error('未找到本扩展的 Service Worker，无法检查首测快照');

    // 场景 16 / R-AUD-2：注入未完成（残留）的冻结审计计划，验证打开首测弹窗后
    // 不恢复、不进入审计 UI，仅显示正常首测开始界面（V0.1 用户路径已切断审计）。
    // 残留快照基于 storage 中当前真实快照克隆（继承 schemaVersion/dictVersion/
    // stateVersion），仅改写 installSeed/auditPlan/auditMarkers/initialTest，确保
    // 重启后的 loadSnapshot 原样接受（schemaVersion 匹配）而非触发迁移。
    const liveSnapshot = await worker2.evaluate(async () => (await chrome.storage.local.get('avr_vocab_snapshot')).avr_vocab_snapshot);
    const residualPlan = {
      version: 'residual-plan-version',
      planVersion: 'residual-plan-version',
      stateVersion: liveSnapshot.stateVersion,
      seed: 'residual-seed',
      candidates: [{ word: 'apple', bucket: 'initial-correct', band: 0 }],
      questions: [{ word: 'apple', correctOptionIndex: 0, options: [{ translation: '苹果' }, { translation: '香蕉' }] }],
      results: [null],
      createdAt: 1,
    };
    const residualMarkers = {
      apple: { word: 'apple', source: 'initial-correct', planVersion: 'residual-plan-version', stateVersion: liveSnapshot.stateVersion, createdAt: 1, pending: true },
    };
    const residualSnapshot = {
      schemaVersion: liveSnapshot.schemaVersion,
      dictVersion: liveSnapshot.dictVersion,
      stateVersion: liveSnapshot.stateVersion,
      installSeed: 'residual-seed',
      words: {},
      auditMarkers: residualMarkers,
      auditLog: [],
      auditPlan: residualPlan,
      initialTest: null,
      lastUpdated: Date.now(),
    };
    await worker2.evaluate((snap) => chrome.storage.local.set({ avr_vocab_snapshot: snap }), residualSnapshot);
    console.log('[stage2] 已注入残留未完成 auditPlan（R-AUD-2 验证）');

    // R-AUD-2 关键修复：worker 将 currentSnapshot 缓存在内存，且不监听 storage 外部变化，
    // 注入后仅重开弹窗不会让 worker 重新读取 storage。改用「同 profile 重启整个 Chrome」：
    // storage.local 随 profile 持久化，新进程启动时扩展 Service Worker 经 loadSnapshot
    // 从 storage 重新加载注入的残留快照（命中真实启动路径）。
    ({ chrome: chrome2, browser: browser2 } = await restartChromeOnSameProfile(path.join(tempDir, 'profile-2'), chromeForTesting, browser2, chrome2));
    extensionId = extensionIdFromTargets(browser2);
    if (!extensionId) throw new Error('无法解析扩展 ID，无法打开弹窗（重启后）');
    console.log('[stage2] 已按注入快照重启 Chrome（同 profile），新 Service Worker 启动时从 storage 加载');

    const popup = await browser2.newPage();
    popup.on('console', (m) => pageLogs.push(`popup: ${m.type()}: ${m.text()}`));
    popup.on('pageerror', (e) => pageLogs.push(`popup pageerror: ${e.message}`));
    console.log('[stage2] opening popup...');
    await gotoSafe(popup, `chrome-extension://${extensionId}/popup.html`, { waitUntil: 'networkidle0' });
    console.log('[stage2] popup goto done');
    await popup.waitForSelector('button.primary', { timeout: 10_000 });
    console.log('[stage2] button.primary found');

    // R-AUD-2 证据 1（非审计消息）：GET_PROFILE 必须返回注入的 installSeed，
    // 证明新 worker 真实加载了注入快照（而非仍持有重启前的内存缓存）。
    const profile = await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'GET_PROFILE' }));
    if (!profile || profile.installSeed !== 'residual-seed') {
      throw new Error(`R-AUD-2 失败：新 worker 未加载注入快照（installSeed=${profile && profile.installSeed}，期望 residual-seed）`);
    }
    worker2 = await waitForWorker(browser2);
    if (!worker2) throw new Error('R-AUD-2 失败：重启后未找到本扩展 Service Worker');
    console.log('[stage2] R-AUD-2 证据 1 通过：GET_PROFILE 返回 residual-seed（worker 已按注入快照重启）');

    // 场景 16 / R-AUD-2：弹窗打开后必须显示正常首测开始界面，绝不恢复残留审计计划
    const popupTextBeforeStart = await popup.evaluate(() => document.body.innerText || '');
    if (/开始审计/.test(popupTextBeforeStart)) throw new Error(`R-AUD-2 失败：残留审计计划被恢复为审计入口：${popupTextBeforeStart}`);
    if (/审计中/.test(popupTextBeforeStart)) throw new Error(`R-AUD-2 失败：残留审计计划导致弹窗进入审计 UI：${popupTextBeforeStart}`);
    if (!/开始测评/.test(popupTextBeforeStart)) throw new Error(`R-AUD-2 失败：弹窗未显示正常首测开始界面（应含「开始测评」）：${popupTextBeforeStart}`);

    // R-AUD-2 证据 2：首测开始前，storage 中的残留 auditPlan/auditMarkers 必须原样保留
    // （证明 popup 启动流程既未读取恢复、也未清除冻结审计计划）。
    const storedBeforeStart = await popup.evaluate(async () => (await chrome.storage.local.get('avr_vocab_snapshot')).avr_vocab_snapshot);
    if (!storedBeforeStart || !storedBeforeStart.auditPlan) throw new Error('R-AUD-2 失败：popup 启动流程清除了残留 auditPlan');
    // 注：chrome.storage.local 序列化会按 key 排序，必须用深等比较而非 JSON 字符串比较
    if (!isDeepStrictEqual(storedBeforeStart.auditPlan, residualPlan)) throw new Error('R-AUD-2 失败：残留 auditPlan 被改写');
    if (!isDeepStrictEqual(storedBeforeStart.auditMarkers, residualMarkers)) throw new Error('R-AUD-2 失败：残留 auditMarkers 被改写');
    console.log('[stage2] R-AUD-2 通过：worker 重启加载注入快照，弹窗仅显示「开始测评」，残留 auditPlan/auditMarkers 原样保留');

    // 开始测评
    await popup.click('button.primary');
    console.log('[stage2] clicked primary, waiting .question...');
    await popup.waitForSelector('.question', { timeout: 10_000 });
    console.log('[stage2] .question found');
    const qCount = await popup.$$eval('.question', (els) => els.length);
    console.log('[stage2] qCount =', qCount);
    if (qCount !== 50) throw new Error(`弹窗未渲染 50 题，实际 ${qCount}`);

    // 读取冻结计划
    const readPlan = async () => {
      const s = await worker2.evaluate(async () => (await chrome.storage.local.get('avr_vocab_snapshot')).avr_vocab_snapshot);
      return s.initialTest.plan;
    };
    console.log('[stage2] reading plan...');
    const plan = await readPlan();
    console.log('[stage2] plan read, questions =', plan.questions.length);
    if (plan.questions.length !== 50) throw new Error(`冻结计划题目数不为 50，实际 ${plan.questions.length}`);
    // 计划冻结：两次读取一致
    const planAgain = await readPlan();
    console.log('[stage2] plan re-read (freeze check) ok');
    if (JSON.stringify(plan) !== JSON.stringify(planAgain)) throw new Error('首测计划未冻结（两次读取不一致）');
    // 十频段各五题
    const perBand = new Map();
    for (const q of plan.questions) perBand.set(q.band, (perBand.get(q.band) ?? 0) + 1);
    if (perBand.size !== 10) throw new Error(`首测频段数不为 10，实际 ${perBand.size}`);
    for (let b = 0; b < 10; b++) if (perBand.get(b) !== 5) throw new Error(`频段 ${b} 题数不为 5，实际 ${perBand.get(b)}`);

    // 多标签页同步验证：两个已开内容页都应经广播增量更新（降低 #1 残余风险）
    const planWordsHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><p>${plan.questions.map((q) => q.word).join(' ')}</p></body></html>`;
    fs.writeFileSync(path.join(tempDir, 'plan-words.html'), planWordsHtml);

    const pageA = await browser2.newPage();
    pageA.on('pageerror', (e) => pageLogs.push(`pageA error: ${e.message}`));
    console.log('[stage2] loading pageA (plan-words)...');
    await gotoSafe(pageA, `https://localhost:${PORT}/plan-words.html`, { waitUntil: 'networkidle0' });
    await pageA.waitForSelector('.avr-word', { timeout: 10_000 });
    console.log('[stage2] pageA annotated');
    const pageB = await browser2.newPage();
    pageB.on('pageerror', (e) => pageLogs.push(`pageB error: ${e.message}`));
    console.log('[stage2] loading pageB...');
    await gotoSafe(pageB, `https://localhost:${PORT}/plan-words.html`, { waitUntil: 'networkidle0' });
    await pageB.waitForSelector('.avr-word', { timeout: 10_000 });
    console.log('[stage2] pageB annotated');

    const word0 = plan.questions[0].word;
    const countWord = (page) => page.evaluate((w) => document.querySelectorAll(`.avr-word[data-word="${w}"]`).length, word0);
    const beforeA = await countWord(pageA);
    const beforeB = await countWord(pageB);
    console.log('[stage2] beforeA/beforeB for', word0, '=', beforeA, beforeB);
    if (beforeA === 0 || beforeB === 0) throw new Error(`多标签前置失败：页面未标注 ${word0}（A=${beforeA}, B=${beforeB}）`);

    // 在弹窗作答第 0 题（答对 → known → 无标注），验证两页均收到 STATE_UPDATED
    // 用 page.evaluate 点击而非 ElementHandle.click，规避 puppeteer-core + Chrome 151
    // 在扩展弹窗页上 ElementHandle.click 的协议超时不稳定性。
    console.log('[stage2] clicking option0...');
    await popup.evaluate((correctIdx) => {
      const card = document.querySelectorAll('.question')[0];
      const opts = card.querySelectorAll('.option:not(.unsure)');
      (opts[correctIdx] || opts[0]).click();
    }, plan.questions[0].correctOptionIndex);
    console.log('[stage2] option0 clicked, waiting for sync...');
    await wait(200);
    await pageA.waitForFunction(
      (w) => document.querySelectorAll(`.avr-word[data-word="${w}"]`).length === 0,
      { timeout: 10_000 }, word0,
    );
    console.log('[stage2] pageA synced (word0 removed)');
    await pageB.waitForFunction(
      (w) => document.querySelectorAll(`.avr-word[data-word="${w}"]`).length === 0,
      { timeout: 8_000 }, word0,
    );
    console.log('[stage2] pageB synced');
    const afterA = await countWord(pageA);
    const afterB = await countWord(pageB);
    if (afterA !== 0 || afterB !== 0) throw new Error(`多标签页未同步更新：${word0}（A=${afterA}, B=${afterB}）`);
    await pageA.close();
    await pageB.close();

    // 逐题作答剩余 49 题：第 1–24 题答对，第 25–49 题答错（第 0 题已在上一步答对）
    // 用 page.evaluate 点击（同上，规避 ElementHandle.click 协议超时）
    console.log('[stage2] answering remaining 49...');
    for (let i = 1; i < plan.questions.length; i++) {
      const q = plan.questions[i];
      const correctIdx = q.correctOptionIndex;
      const targetIdx = i < 25 ? correctIdx : (correctIdx === 0 ? 1 : 0);
      await popup.evaluate((idx, qIdx) => {
        const card = document.querySelectorAll('.question')[qIdx];
        const opts = card.querySelectorAll('.option:not(.unsure)');
        (opts[idx] || opts[0]).click();
      }, targetIdx, i);
      await wait(40);
    }
    console.log('[stage2] all 49 answered, waiting .summary...');
    await popup.waitForSelector('.summary', { timeout: 10_000 });

    // 校验 worker 快照
    const afterTest = await worker2.evaluate(async () => (await chrome.storage.local.get('avr_vocab_snapshot')).avr_vocab_snapshot);
    const initialWords = Object.values(afterTest.words).filter((w) => w.source === 'initial');
    if (initialWords.length !== 50) throw new Error(`首测状态词数不为 50，实际 ${initialWords.length}`);
    const knownCount = initialWords.filter((w) => w.status === 'known').length;
    const learningCount = initialWords.filter((w) => w.status === 'learning').length;
    if (knownCount !== 25 || learningCount !== 25) throw new Error(`首测状态分布错误：known=${knownCount}, learning=${learningCount}`);
    // 场景 16 / R-AUD-3：V0.1 已切断审计用户路径——首测答对不再产出审计标记
    const auditCount = Object.keys(afterTest.auditMarkers).length;
    if (auditCount !== 0) throw new Error(`审计标记数应为 0（V0.1 已切断审计路径），实际 ${auditCount}`);
    const serialized2 = JSON.stringify(afterTest);
    if (/localhost|comment-section|sentence/.test(serialized2)) throw new Error('首测快照包含页面信息');

    // 页面更新验证：复用上面已写入的 plan-words.html（仅含计划词的阅读页）
    const page2 = await browser2.newPage();
    page2.on('pageerror', (e) => pageLogs.push(`page2 error: ${e.message}`));
    await gotoSafe(page2, `https://localhost:${PORT}/plan-words.html`, { waitUntil: 'networkidle0' });
    await page2.waitForSelector('.avr-word', { timeout: 10_000 });
    const pageUpdate = await page2.evaluate(() => {
      const res = {};
      for (const el of document.querySelectorAll('.avr-word')) {
        res[el.dataset.word] = el.className.includes('avr-strong') ? 'strong' : (el.className.includes('avr-light') ? 'light' : 'none');
      }
      return res;
    });
    const detail = [];
    for (let i = 0; i < plan.questions.length; i++) {
      const word = plan.questions[i].word;
      const cls = pageUpdate[word];
      if (i < 25) {
        if (cls !== undefined) detail.push(`${word} 应为 known 无标注，实际 ${cls}`);
      } else if (cls !== 'strong') {
        detail.push(`${word} 应为 learning→strong，实际 ${cls}`);
      }
    }
    if (detail.length) throw new Error(`首测后页面更新错误：${detail.join('; ')}`);

    // 重开弹窗：应显示已完成摘要（重启恢复）
    const popup2 = await browser2.newPage();
    await gotoSafe(popup2, `chrome-extension://${extensionId}/popup.html`, { waitUntil: 'networkidle0' });
    await popup2.waitForSelector('.summary', { timeout: 10_000 });
    const summaryText = await popup2.$eval('.summary', (el) => el.textContent || '');
    if (!/首测完成/.test(summaryText)) throw new Error(`重开弹窗未恢复已完成状态：${summaryText}`);
    // 场景 16 / R-AUD-1：V0.1 已切断审计用户路径——首测完成摘要不得再暴露「开始审计」入口
    if (/开始审计/.test(summaryText)) throw new Error(`场景 16 失败：重开弹窗仍暴露审计入口：${summaryText}`);

    // ============================================================
    // §21 场景 5：结果页显示点估计 + 保守范围 + 不外推声明（R-EST-1/6）
    // ============================================================
    // 本阶段作答模式：q0-24 答对（band0-4 全对 5/5）、q25-49 答错（band5-9 全错 0/5）。
    // 每频段 100 词 → point = 5×100 + 0 = 500；保守范围 324–676。
    // 期望值由独立 Wilson 计算预先得出并硬编码（见 work/handoff 与 Ticket 03 验收：
    // known=3, tested=5 样例的公式独立推导），不得由生产估计函数生成期望值。
    await popup2.waitForSelector('.estimate-point', { timeout: 10_000 });
    const estimateText = await popup2.$eval('.estimate', (el) => el.textContent || '');
    const pointMatch = estimateText.match(/你大概认识 (\d+) 个词/);
    const rangeMatch = estimateText.match(/保守范围 (\d+)–(\d+)/);
    if (!pointMatch || !rangeMatch) throw new Error(`场景 5 失败：结果页缺少点值或保守范围：${estimateText}`);
    const estimatePoint = Number(pointMatch[1]);
    const estimateLow = Number(rangeMatch[1]);
    const estimateHigh = Number(rangeMatch[2]);
    if (estimatePoint !== 500) throw new Error(`场景 5 失败：点估计应为 500，实际 ${estimatePoint}`);
    // 独立硬编码期望值：锁住用户实际看到的 Wilson 加权结果，而非任何包住点值的任意范围
    if (estimateLow !== 324) throw new Error(`场景 5 失败：保守范围下界应为 324，实际 ${estimateLow}`);
    if (estimateHigh !== 676) throw new Error(`场景 5 失败：保守范围上界应为 676，实际 ${estimateHigh}`);
    if (!(estimateLow <= estimatePoint && estimatePoint <= estimateHigh)) {
      throw new Error(`场景 5 失败：low≤point≤high 不成立（${estimateLow} ≤ ${estimatePoint} ≤ ${estimateHigh}）`);
    }
    if (!estimateText.includes('基于当前 1,000 词覆盖估计，不做外推')) {
      throw new Error(`场景 5 失败：缺少「基于当前 1,000 词覆盖估计，不做外推」声明：${estimateText}`);
    }
    if (/90% 置信区间/.test(estimateText) || /CEFR/.test(estimateText)) {
      throw new Error(`场景 5 失败：UI 出现禁词「90% 置信区间」或「CEFR」：${estimateText}`);
    }
    console.log(`E2E #5 PASS: point=${estimatePoint}, range=${estimateLow}–${estimateHigh}, no_extrapolation_declared=true, forbidden_text_absent=true`);

    // ============================================================
    // §21 场景 6：manual 改提示但估计不变（R-EST-2 / R-EVD-1）
    // ============================================================
    // 记录当前估计与证据 → 在真实网页对学习词执行 manual known → 页面提示变化 →
    // 重开结果页，单点估计与保守范围必须与修改前完全一致；manual 不得改写 AssessmentEvidence。
    const estimateBeforeManual = await popup2.$eval('.estimate', (el) => el.textContent || '');
    const evidenceBeforeManual = (await worker2.evaluate(async () => (await chrome.storage.local.get('avr_vocab_snapshot')).avr_vocab_snapshot)).assessmentEvidence;
    // 选 band5 的第一个词（q25 答错 → learning → strong 提示）
    const manualWord = plan.questions[25].word;
    // 用 page.evaluate 点击（与阶段二一致，规避 Chrome 151 + puppeteer-core 的 ElementHandle 协议超时）
    await page2.waitForSelector(`.avr-word[data-word="${manualWord}"]`, { timeout: 10_000 });
    await page2.evaluate((w) => {
      const el = document.querySelector(`.avr-word[data-word="${w}"]`);
      el?.click();
    }, manualWord);
    await page2.waitForSelector('.avr-action-menu button[data-avr-status="known"]', { visible: true });
    await page2.evaluate(() => {
      const btn = document.querySelector('.avr-action-menu button[data-avr-status="known"]');
      if (btn) btn.click();
    });
    // 页面提示必须按 manual 动作发生变化：learning → known → 不再提示
    await page2.waitForFunction(
      (w) => document.querySelectorAll(`.avr-word[data-word="${w}"]`).length === 0,
      { timeout: 5_000 }, manualWord,
    );
    // 证明 manual 没有改写 AssessmentEvidence（R-EVD-1）
    const afterManualSnapshot = (await worker2.evaluate(async () => (await chrome.storage.local.get('avr_vocab_snapshot')).avr_vocab_snapshot));
    if (!isDeepStrictEqual(afterManualSnapshot.assessmentEvidence, evidenceBeforeManual)) {
      throw new Error('场景 6 失败：manual 改写了 AssessmentEvidence');
    }
    // 重开结果页：单点估计与保守范围必须与修改前完全一致
    const popup3 = await browser2.newPage();
    await gotoSafe(popup3, `chrome-extension://${extensionId}/popup.html`, { waitUntil: 'networkidle0' });
    await popup3.waitForSelector('.estimate-point', { timeout: 10_000 });
    const estimateAfterManual = await popup3.$eval('.estimate', (el) => el.textContent || '');
    if (estimateAfterManual !== estimateBeforeManual) {
      throw new Error(`场景 6 失败：manual 后估计改变：\n前=${estimateBeforeManual}\n后=${estimateAfterManual}`);
    }
    console.log(`E2E #6 PASS: manual_word=${manualWord}, hint_changed=true, evidence_unchanged=true, estimate_unchanged=true`);
    await popup3.close();

    console.log(`E2E #2 PASS: questions=${qCount}, known=${knownCount}, learning=${learningCount}, audit_markers=${auditCount}, plan_frozen=true, page_updated=true, multitab_synced=true, reopen_recovered=true, audit_entry_absent=true, residual_plan_ignored=true, worker_reloaded=true`);
  } finally {
    if (browser2) await browser2.close();
    await killChrome(chrome2);
  }

  // ============================================================
  // 阶段三：SPA 动态插入与路由切换（#4 残余风险验证）
  // ============================================================
  let browser3;
  let chrome3;
  try {
    ({ chrome: chrome3, browser: browser3 } = await launchChrome(path.join(tempDir, 'profile-3'), chromeForTesting));
    await wait(1_000);
    const spa = await browser3.newPage();
    spa.on('pageerror', (e) => pageLogs.push(`spa error: ${e.message}`));
    await gotoSafe(spa, `https://localhost:${PORT}/spa-page.html`, { waitUntil: 'networkidle0' });

    // 静态正文初始标注
    await spa.waitForSelector('#intro .avr-word', { timeout: 10_000 });
    const introBefore = await spa.$eval('#intro', (el) => el.querySelectorAll('.avr-word').length);
    if (introBefore === 0) throw new Error('SPA 页面静态正文未标注');

    // 动态插入（无限滚动式追加）
    await spa.click('#loadMore');
    await spa.waitForSelector('#feed .avr-word', { timeout: 10_000 });
    const feedCount = await spa.$eval('#feed', (el) => el.querySelectorAll('.avr-word').length);
    if (feedCount === 0) throw new Error('动态插入的正文未被增量标注');

    // 路由切换（innerHTML 重写）
    await spa.click('#swapRoute');
    await spa.waitForFunction(
      () => document.querySelectorAll('#view .avr-word').length > 0,
      { timeout: 10_000 },
    );
    const viewCount = await spa.$eval('#view', (el) => el.querySelectorAll('.avr-word').length);
    if (viewCount === 0) throw new Error('路由切换后的新正文未被重新标注');

    // 增量性：初次正文标注未被清空（未退化成全页重扫/丢失）
    const introAfter = await spa.$eval('#intro', (el) => el.querySelectorAll('.avr-word').length);
    if (introAfter !== introBefore) throw new Error(`初次正文标注发生变化（疑似全页重扫）：${introBefore} -> ${introAfter}`);

    // 非正文区（nav）不得被标注
    const navHit = await spa.$eval('nav', (el) => el.querySelectorAll('.avr-word').length);
    if (navHit !== 0) throw new Error('SPA 动态插入污染了非正文区（nav）');

    // 非正文区：代码 / 表单 / 评论 也不得被标注（规格 §4 跳过规则，真实浏览器证据）
    const skipHits = await spa.evaluate(() => ({
      code: document.querySelectorAll('#codeblock .avr-word').length,
      form: document.querySelectorAll('#theform .avr-word').length,
      comment: document.querySelectorAll('#comments .avr-word').length,
    }));
    if (skipHits.code !== 0 || skipHits.form !== 0 || skipHits.comment !== 0) {
      throw new Error(`SPA 扫描了应跳过的非正文区：${JSON.stringify(skipHits)}`);
    }

    // 性能观测（非持久化，仅 DOM dataset；不含 URL/正文/句子）—— 新 schema 字段
    const readPerf = async (pg) => {
      const raw = await pg.evaluate(() => document.documentElement.dataset.avrPerf);
      return raw ? JSON.parse(raw) : null;
    };
    const assertPerfShape = (p, where) => {
      if (!p
        || typeof p.totalScanMs !== 'number'
        || typeof p.maxBatchMs !== 'number'
        || typeof p.textNodesScanned !== 'number'
        || typeof p.wordsAnnotated !== 'number'
        || typeof p.domNodesAdded !== 'number'
        || typeof p.domNodesRemoved !== 'number'
        || typeof p.netNodes !== 'number'
        || typeof p.heightDeltaPx !== 'number'
        || typeof p.layoutShiftScore !== 'number'
        || typeof p.layoutShiftSupported !== 'boolean'
        || typeof p.batches !== 'number') {
        throw new Error(`性能观测字段缺失（${where}）：${JSON.stringify(p)}`);
      }
    };

    // 长文 fixture 多样本性能采样（≥3 次真实 Chrome 样本）：记录扫描墙钟、单批峰值、文本节点数、
    // 词注释数、实际 DOM 增量与布局偏移；不涉及 URL/正文/句子。
    const samples = [];
    for (let s = 0; s < 3; s++) {
      const longPage = await browser3.newPage();
      longPage.on('pageerror', (e) => pageLogs.push(`longread err: ${e.message}`));
      await gotoSafe(longPage, `https://localhost:${PORT}/long-read.html`, { waitUntil: 'networkidle0' });
      await longPage.waitForSelector('.avr-word', { timeout: 15_000 });
      await wait(150);
      const p = await readPerf(longPage);
      assertPerfShape(p, `long-read#${s}`);
      samples.push(p);
      await longPage.close();
    }

    // SPA 页一次性能观测（新 schema；与长文一致调用 assertPerfShape 做 schema 断言，非仅记录）
    const spaPerf = await readPerf(spa);
    if (spaPerf) assertPerfShape(spaPerf, 'spa');

    const perfSummary = samples.map((p, i) => ({
      sample: i + 1,
      totalScanMs: p.totalScanMs,
      maxBatchMs: p.maxBatchMs,
      textNodesScanned: p.textNodesScanned,
      wordsAnnotated: p.wordsAnnotated,
      domNodesAdded: p.domNodesAdded,
      domNodesRemoved: p.domNodesRemoved,
      netNodes: p.netNodes,
      heightDeltaPx: p.heightDeltaPx,
      layoutShiftScore: p.layoutShiftScore,
      layoutShiftSupported: p.layoutShiftSupported,
      batches: p.batches,
    }));
    console.log(`E2E #3 PASS: intro=${introBefore}, feed=${feedCount}, view=${viewCount}, nav_skipped=${navHit === 0}, code/form/comment_skipped=${skipHits.code === 0 && skipHits.form === 0 && skipHits.comment === 0}, perf_samples=${JSON.stringify(perfSummary)}, spa_perf=${spaPerf ? JSON.stringify(spaPerf) : 'n/a'}`);
  } finally {
    if (browser3) await browser3.close();
    await killChrome(chrome3);
  }

  // ============================================================
  // 阶段四：每日校准轮（§21 场景 7~13、17）
  // ============================================================
  let browser4;
  let chrome4;
  try {
    ({ chrome: chrome4, browser: browser4 } = await launchChrome(path.join(tempDir, 'profile-4'), chromeForTesting));
    await wait(1_000);
    let extId = extensionIdFromTargets(browser4);
    if (!extId) throw new Error('阶段四：无法解析扩展 ID');
    let worker4 = await getWorker(browser4);
    if (!worker4) throw new Error('阶段四：未找到本扩展 Service Worker');

    const openPopup4 = async () => {
      const p = await browser4.newPage();
      p.on('pageerror', (e) => pageLogs.push(`stage4 popup error: ${e.message}`));
      await gotoSafe(p, `chrome-extension://${extId}/popup.html`, { waitUntil: 'networkidle0' });
      return p;
    };
    const readSnap4 = () => worker4.evaluate(async () => (await chrome.storage.local.get('avr_vocab_snapshot')).avr_vocab_snapshot);
    /** 用 page.evaluate 点击选项（规避 Chrome 151 + puppeteer-core 的 ElementHandle 协议超时） */
    const clickOption4 = (p, qIdx, optionIdx) => p.evaluate((qi, oi) => {
      const card = document.querySelectorAll('.question')[qi];
      const opts = card.querySelectorAll('.option:not(.unsure)');
      (opts[oi] || opts[0]).click();
    }, qIdx, optionIdx);

    // ---- §21 场景 7 负向：首测未完成 → popup 无每日入口、storage 不创建 DailyTestState ----
    let popup4 = await openPopup4();
    await popup4.waitForSelector('button.primary', { timeout: 10_000 });
    const beforeStart4 = await popup4.evaluate(() => ({
      text: document.body.innerText || '',
      dailyCount: document.querySelectorAll('.daily').length,
    }));
    if (beforeStart4.dailyCount !== 0 || /每日校准/.test(beforeStart4.text)) {
      throw new Error(`场景 7 失败：首测未完成时出现每日入口：${beforeStart4.text}`);
    }
    const snapBeforeInitial = await readSnap4();
    if (snapBeforeInitial.dailyTest !== null) {
      throw new Error('场景 7 失败：首测未完成时 storage 中创建了 DailyTestState');
    }
    console.log('[stage4] 场景 7 负向 PASS：首测未完成 → popup 无每日入口、storage.dailyTest=null');

    // ---- 完成 50 题首测（q0-24 答对、q25-49 答错，与阶段二同模式）----
    await popup4.click('button.primary');
    await popup4.waitForSelector('.question', { timeout: 10_000 });
    const initialPlan4 = (await readSnap4()).initialTest.plan;
    if (initialPlan4.questions.length !== 50) throw new Error(`阶段四首测计划异常：${initialPlan4.questions.length}`);
    for (let i = 0; i < initialPlan4.questions.length; i++) {
      const q = initialPlan4.questions[i];
      const target = i < 25 ? q.correctOptionIndex : (q.correctOptionIndex === 0 ? 1 : 0);
      await clickOption4(popup4, i, target);
      await wait(20);
    }
    await popup4.waitForSelector('.summary', { timeout: 10_000 });
    await popup4.waitForSelector('.estimate-point', { timeout: 10_000 });
    const estimateBeforeDaily = await popup4.$eval('.estimate', (el) => el.textContent || '');
    // ---- §21 场景 7 正向：首测完成后每日入口出现 ----
    await popup4.waitForSelector('.daily-start', { timeout: 10_000 });
    console.log('[stage4] 场景 7 正向 PASS：首测完成后每日入口出现');

    // ---- §21 场景 8：完成每日五题（偶数轮 roundIndex=0 → 频段 0/2/4/6/8）----
    await popup4.click('.daily-start');
    await popup4.waitForSelector('.question', { timeout: 10_000 });
    const dailyQCount = await popup4.$$eval('.question', (els) => els.length);
    if (dailyQCount !== 5) throw new Error(`场景 8 失败：每日应为 5 题，实际 ${dailyQCount}`);
    const dailyPlan4 = (await readSnap4()).dailyTest;
    if (!dailyPlan4) throw new Error('场景 8 失败：storage 未创建 DailyTestState');
    const bands4 = dailyPlan4.questions.map((q) => q.band).sort((a, b) => a - b);
    if (JSON.stringify(bands4) !== JSON.stringify([0, 2, 4, 6, 8])) {
      throw new Error(`场景 8 失败：偶数轮频段应为 0/2/4/6/8，实际 ${bands4}`);
    }
    const dailyWords4 = dailyPlan4.questions.map((q) => q.word);
    if (new Set(dailyWords4).size !== 5) throw new Error('场景 8 失败：同轮出现重复词');

    // ---- §21 场景 11：答 2 题 → 关闭 popup → 重开 → 暂停恢复同一冻结计划 ----
    for (let i = 0; i < 2; i++) {
      const q = dailyPlan4.questions[i];
      await clickOption4(popup4, i, q.correctOptionIndex);
      await wait(50);
    }
    const dailyAfter2 = await readSnap4();
    if (dailyAfter2.dailyTest.answers.filter((a) => a !== null).length !== 2) {
      throw new Error('场景 11 前置：未答满 2 题');
    }
    await popup4.close();
    popup4 = await openPopup4();
    await popup4.waitForSelector('.daily-progress', { timeout: 10_000 });
    const progressText = await popup4.$eval('.daily-progress', (el) => el.textContent || '');
    if (!/进行中 2 \/ 5/.test(progressText)) throw new Error(`场景 11 失败：重开 popup 未恢复进度：${progressText}`);
    const dailyAfterReopen = await readSnap4();
    if (JSON.stringify(dailyAfterReopen.dailyTest.questions) !== JSON.stringify(dailyAfter2.dailyTest.questions)) {
      throw new Error('场景 11 失败：重开后未恢复同一冻结计划');
    }
    if (JSON.stringify(dailyAfterReopen.dailyTest.answers) !== JSON.stringify(dailyAfter2.dailyTest.answers)) {
      throw new Error('场景 11 失败：重开后作答进度丢失');
    }
    console.log('[stage4] 场景 11 PASS：同日关闭/重开 popup 暂停恢复同一冻结计划（2/5）');

    // ---- 继续答完剩余 3 题 → 每日五题完成 ----
    await popup4.click('.daily-resume');
    await popup4.waitForSelector('.question', { timeout: 10_000 });
    for (let i = 2; i < 5; i++) {
      const q = dailyPlan4.questions[i];
      await clickOption4(popup4, i, q.correctOptionIndex);
      await wait(50);
    }
    await popup4.waitForSelector('.daily-complete', { timeout: 10_000 });
    const snapAfterDaily = await readSnap4();
    if (!snapAfterDaily.dailyTest.completed) throw new Error('场景 8 失败：每日五题未标记完成');
    if (snapAfterDaily.completedRoundIndex !== 1) {
      throw new Error(`场景 8 失败：completedRoundIndex 应为 1，实际 ${snapAfterDaily.completedRoundIndex}`);
    }
    console.log('[stage4] 场景 8 PASS：完成每日五题，completedRoundIndex=1');

    // ---- §21 场景 9：每日答案更新状态与估计（双写 WordState(daily) + Evidence(daily)）----
    for (const w of dailyWords4) {
      if (snapAfterDaily.words[w]?.source !== 'daily') throw new Error(`场景 9 失败：${w} 的 WordState.source 应为 daily`);
      if (snapAfterDaily.assessmentEvidence[w]?.source !== 'daily') throw new Error(`场景 9 失败：${w} 的 Evidence.source 应为 daily`);
    }
    popup4 = await openPopup4();
    await popup4.waitForSelector('.estimate-point', { timeout: 10_000 });
    const estimateAfterDaily = await popup4.$eval('.estimate', (el) => el.textContent || '');
    if (estimateAfterDaily === estimateBeforeDaily) {
      throw new Error(`场景 9 失败：每日后估计未变化：\n前=${estimateBeforeDaily}\n后=${estimateAfterDaily}`);
    }
    await popup4.waitForSelector('.daily-complete', { timeout: 10_000 });
    console.log('[stage4] 场景 9 PASS：每日双写后状态与估计均变化');

    // ---- §21 场景 17：每日轮进行中阅读不被阻塞 ----
    const readPage4 = await browser4.newPage();
    readPage4.on('pageerror', (e) => pageLogs.push(`stage4 read error: ${e.message}`));
    await gotoSafe(readPage4, `https://localhost:${PORT}/long-read.html`, { waitUntil: 'networkidle0' });
    await readPage4.waitForSelector('.avr-word', { timeout: 15_000 });
    const readAnnotations = await readPage4.$$eval('.avr-word', (els) => els.length);
    if (readAnnotations === 0) throw new Error('场景 17 失败：每日轮进行中阅读未被标注（阅读被阻塞）');
    await readPage4.close();
    console.log(`[stage4] 场景 17 PASS：每日轮进行中阅读正常标注（annotations=${readAnnotations}）`);

    // ---- §21 场景 12/13：跨日（date seam 最小注入：改写 storage localDate + 同 profile 重启）----
    // 生产无时间服务；本地日期变化通过持久化 dailyTest.localDate 模拟（重启走真实 loadSnapshot 路径）。
    const yesterday4 = localDateString(new Date(Date.now() - 24 * 3600 * 1000));
    await worker4.evaluate((snap, y) => {
      snap.dailyTest.localDate = y; // 仅改日期字段，模拟"昨天创建的计划"
      return chrome.storage.local.set({ avr_vocab_snapshot: snap });
    }, snapAfterDaily, yesterday4);
    ({ chrome: chrome4, browser: browser4 } = await restartChromeOnSameProfile(path.join(tempDir, 'profile-4'), chromeForTesting, browser4, chrome4));
    extId = extensionIdFromTargets(browser4);
    if (!extId) throw new Error('阶段四：跨日重启后无法解析扩展 ID');
    worker4 = await waitForWorker(browser4);
    if (!worker4) throw new Error('阶段四：跨日重启后未找到 Service Worker');

    popup4 = await openPopup4();
    await popup4.waitForSelector('.daily-expired', { timeout: 10_000 });
    const expiredText = await popup4.$eval('.daily-expired', (el) => el.textContent || '');
    if (!/已过期/.test(expiredText)) throw new Error(`场景 12 失败：未显示跨日过期：${expiredText}`);
    // 跨日：已答证据保留、不回滚；未完成轮不递增轮次（此处旧轮已完成，递增早已发生，仍为 1）
    const snapExpired = await readSnap4();
    for (const w of dailyWords4) {
      if (snapExpired.assessmentEvidence[w]?.source !== 'daily') throw new Error(`场景 13 失败：跨日后 ${w} 已答证据丢失`);
    }
    if (snapExpired.completedRoundIndex !== 1) {
      throw new Error(`场景 13 失败：跨日后 completedRoundIndex 不应变化，实际 ${snapExpired.completedRoundIndex}`);
    }
    console.log('[stage4] 场景 12/13 PASS：跨日过期展示 + 已答证据保留 + 不递增轮次');

    // ---- 跨日后新一天：按当前 completedRoundIndex=1 取奇数频段 1/3/5/7/9 ----
    await popup4.click('.daily-start');
    await popup4.waitForSelector('.question', { timeout: 10_000 });
    const newDaySnap = await readSnap4();
    const newBands = newDaySnap.dailyTest.questions.map((q) => q.band).sort((a, b) => a - b);
    if (JSON.stringify(newBands) !== JSON.stringify([1, 3, 5, 7, 9])) {
      throw new Error(`场景 13 失败：新一天应按 completedRoundIndex=1 取奇数频段 1/3/5/7/9，实际 ${newBands}`);
    }
    if (newDaySnap.dailyTest.localDate !== localDateString()) {
      throw new Error(`场景 13 失败：新计划 localDate 应为今天 ${localDateString()}，实际 ${newDaySnap.dailyTest.localDate}`);
    }
    if (newDaySnap.dailyTest.answers.some((a) => a !== null)) throw new Error('场景 13 失败：新计划不应继承旧轮作答');
    console.log('[stage4] 场景 13 PASS：新一天按当前 completedRoundIndex 选奇数频段创建新轮');

    // ---- §21 场景 10：首题前跳过零变化；答后跳过入口消失 ----
    await popup4.waitForSelector('.daily-skip', { timeout: 10_000 });
    const snapBeforeSkip = await readSnap4();
    const wordsBeforeSkip = JSON.stringify(snapBeforeSkip.words);
    const evidenceBeforeSkip = JSON.stringify(snapBeforeSkip.assessmentEvidence);
    await popup4.click('.daily-skip');
    await wait(300);
    const snapAfterSkip = await readSnap4();
    if (!snapAfterSkip.dailyTest.skipped) throw new Error('场景 10 失败：跳过未生效');
    if (JSON.stringify(snapAfterSkip.words) !== wordsBeforeSkip) throw new Error('场景 10 失败：跳过改写了 WordState');
    if (JSON.stringify(snapAfterSkip.assessmentEvidence) !== evidenceBeforeSkip) throw new Error('场景 10 失败：跳过改写了 AssessmentEvidence');
    if (snapAfterSkip.completedRoundIndex !== 1) throw new Error('场景 10 失败：跳过递增了 completedRoundIndex');
    console.log('[stage4] 场景 10 PASS（前半）：首题前跳过 → 状态与证据零变化');

    // 跳过后重开 popup：主入口不突出，保留次级"今天仍可开始"
    popup4 = await openPopup4();
    await popup4.waitForSelector('.daily-secondary', { timeout: 10_000 });
    const afterSkipText = await popup4.evaluate(() => document.body.innerText || '');
    if (/开始今日五题/.test(afterSkipText)) throw new Error(`场景 10 失败：跳过后仍突出主入口：${afterSkipText}`);
    // 反悔：从次级入口开始 → skipped 变回 false 并复用同一冻结计划
    const skipPlanJson = JSON.stringify(snapAfterSkip.dailyTest.questions);
    await popup4.click('.daily-secondary');
    await popup4.waitForSelector('.question', { timeout: 10_000 });
    const resumedSnap = await readSnap4();
    if (resumedSnap.dailyTest.skipped !== false) throw new Error('场景 10 失败：反悔后 skipped 未变回 false');
    if (JSON.stringify(resumedSnap.dailyTest.questions) !== skipPlanJson) throw new Error('场景 10 失败：反悔未复用同一冻结计划');
    // 答第一题后跳过入口消失
    const q0new = resumedSnap.dailyTest.questions[0];
    await clickOption4(popup4, 0, q0new.correctOptionIndex);
    await wait(200);
    const skipVisibleAfterAnswer = await popup4.evaluate(() => document.querySelectorAll('.daily-skip').length);
    if (skipVisibleAfterAnswer !== 0) throw new Error('场景 10 失败：答第一题后跳过入口仍可见');
    console.log('[stage4] 场景 10 PASS：跳过后次级入口、反悔复用冻结计划、答第一题后跳过入口消失');

    console.log(`E2E #4 PASS: daily_round=5q, bands_even=0/2/4/6/8, bands_odd=1/3/5/7/9, round_index=1, skip_zero_change=true, pause_resume=true, cross_day_expired=true, evidence_kept=true, reading_unblocked=true`);
  } finally {
    if (browser4) await browser4.close();
    await killChrome(chrome4);
  }

  console.log('E2E ALL PASS');
  } finally {
    if (server) server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`E2E FAIL: ${error.stack || error.message}`);
  process.exitCode = 1;
});
