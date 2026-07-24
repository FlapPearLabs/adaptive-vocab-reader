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

function onceListening(server) {
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
}

/** 启动一个独立 Chrome 实例（独立 user-data-dir = 独立本地存储），返回 browser 与 chrome 进程 */
async function launchChrome(userDataDir, chromeForTesting) {
  const chrome = spawn(chromeForTesting, [
    `--user-data-dir=${userDataDir}`,
    `--load-extension=${DIST_DIR}`,
    `--disable-extensions-except=${DIST_DIR}`,
    '--no-first-run', '--no-default-browser-check',
    '--ignore-certificate-errors', '--remote-debugging-port=0', '--enable-logging=stderr', '--v=1',
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

  const browser = await puppeteer.connect({ browserWSEndpoint: devtools });
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
    const page = await browser1.newPage();
    page.on('console', (message) => pageLogs.push(`${message.type()}: ${message.text()}`));
    page.on('pageerror', (error) => pageLogs.push(`pageerror: ${error.message}`));
    await wait(1_000);

    await page.goto(`https://localhost:${PORT}/`, { waitUntil: 'networkidle0' });
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
    if (!initial.challengesFormHit) throw new Error(`词形映射未在真实页面命中：${JSON.stringify(initial)}`);

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

    const persistedChallenge = await page.$('.avr-word[data-word="challenge"]');
    if (!persistedChallenge) throw new Error('刷新后无法对 challenge 执行“会”覆盖验收');
    await persistedChallenge.click();
    await page.click('.avr-action-menu button[data-avr-status="known"]');
    await page.waitForFunction(() => document.querySelectorAll('.avr-word[data-word="challenge"]').length === 0);
    await page.reload({ waitUntil: 'networkidle0' });
    await wait(500);
    const knownAfterReload = await page.evaluate(() => document.querySelectorAll('.avr-word[data-word="challenge"]').length);
    if (knownAfterReload !== 0) throw new Error('“会”状态未立即覆盖并跨刷新保留');

    console.log(`E2E #1 PASS: annotations=${initial.annotations}, unknown=${initial.unknown}, challenge_first=${persisted.first}, challenge_repeats=${persisted.repeats}, local_snapshot=minimal`);
  } finally {
    if (browser1) await browser1.close();
    await killChrome(chrome1);
  }

  // ============================================================
  // 阶段二：固定 50 题首测（#2）—— 独立浏览器与存储，避免阶段一污染
  // ============================================================
  let browser2;
  let chrome2;
  try {
    ({ chrome: chrome2, browser: browser2 } = await launchChrome(path.join(tempDir, 'profile-2'), chromeForTesting));
    await wait(1_000);

    const extensionId = extensionIdFromTargets(browser2);
    if (!extensionId) throw new Error('无法解析扩展 ID，无法打开弹窗');

    const worker2 = await getWorker(browser2);
    if (!worker2) throw new Error('未找到本扩展的 Service Worker，无法检查首测快照');

    const popup = await browser2.newPage();
    popup.on('console', (m) => pageLogs.push(`popup: ${m.type()}: ${m.text()}`));
    popup.on('pageerror', (e) => pageLogs.push(`popup pageerror: ${e.message}`));
    await popup.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'networkidle0' });
    await popup.waitForSelector('button.primary', { timeout: 10_000 });

    // 开始测评
    await popup.click('button.primary');
    await popup.waitForSelector('.question', { timeout: 10_000 });
    const qCount = await popup.$$eval('.question', (els) => els.length);
    if (qCount !== 50) throw new Error(`弹窗未渲染 50 题，实际 ${qCount}`);

    // 读取冻结计划
    const readPlan = async () => {
      const s = await worker2.evaluate(async () => (await chrome.storage.local.get('avr_vocab_snapshot')).avr_vocab_snapshot);
      return s.initialTest.plan;
    };
    const plan = await readPlan();
    if (plan.questions.length !== 50) throw new Error(`冻结计划题目数不为 50，实际 ${plan.questions.length}`);
    // 计划冻结：两次读取一致
    const planAgain = await readPlan();
    if (JSON.stringify(plan) !== JSON.stringify(planAgain)) throw new Error('首测计划未冻结（两次读取不一致）');
    // 十频段各五题
    const perBand = new Map();
    for (const q of plan.questions) perBand.set(q.band, (perBand.get(q.band) ?? 0) + 1);
    if (perBand.size !== 10) throw new Error(`首测频段数不为 10，实际 ${perBand.size}`);
    for (let b = 0; b < 10; b++) if (perBand.get(b) !== 5) throw new Error(`频段 ${b} 题数不为 5，实际 ${perBand.get(b)}`);

    // 逐题作答：前 25 题答对，后 25 题答错
    for (let i = 0; i < plan.questions.length; i++) {
      const q = plan.questions[i];
      const correctIdx = q.correctOptionIndex;
      const targetIdx = i < 25 ? correctIdx : (correctIdx === 0 ? 1 : 0);
      const card = (await popup.$$('.question'))[i];
      const optionButtons = await card.$$('.option:not(.unsure)');
      await optionButtons[targetIdx].click();
      await wait(40);
    }
    await popup.waitForSelector('.summary', { timeout: 10_000 });

    // 校验 worker 快照
    const afterTest = await worker2.evaluate(async () => (await chrome.storage.local.get('avr_vocab_snapshot')).avr_vocab_snapshot);
    const initialWords = Object.values(afterTest.words).filter((w) => w.source === 'initial');
    if (initialWords.length !== 50) throw new Error(`首测状态词数不为 50，实际 ${initialWords.length}`);
    const knownCount = initialWords.filter((w) => w.status === 'known').length;
    const learningCount = initialWords.filter((w) => w.status === 'learning').length;
    if (knownCount !== 25 || learningCount !== 25) throw new Error(`首测状态分布错误：known=${knownCount}, learning=${learningCount}`);
    const auditCount = Object.keys(afterTest.auditMarkers).length;
    if (auditCount !== 25) throw new Error(`审计标记数应为 25（答对词），实际 ${auditCount}`);
    const serialized2 = JSON.stringify(afterTest);
    if (/localhost|comment-section|sentence/.test(serialized2)) throw new Error('首测快照包含页面信息');

    // 页面更新验证：构造仅含计划词的阅读页
    const planWordsHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><p>${plan.questions.map((q) => q.word).join(' ')}</p></body></html>`;
    fs.writeFileSync(path.join(tempDir, 'plan-words.html'), planWordsHtml);

    const page2 = await browser2.newPage();
    page2.on('pageerror', (e) => pageLogs.push(`page2 error: ${e.message}`));
    await page2.goto(`https://localhost:${PORT}/plan-words.html`, { waitUntil: 'networkidle0' });
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
    await popup2.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'networkidle0' });
    await popup2.waitForSelector('.summary', { timeout: 10_000 });
    const summaryText = await popup2.$eval('.summary', (el) => el.textContent || '');
    if (!/首测完成/.test(summaryText)) throw new Error(`重开弹窗未恢复已完成状态：${summaryText}`);

    console.log(`E2E #2 PASS: questions=${qCount}, known=${knownCount}, learning=${learningCount}, audit=${auditCount}, plan_frozen=true, page_updated=true, reopen_recovered=true`);
  } finally {
    if (browser2) await browser2.close();
    await killChrome(chrome2);
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
