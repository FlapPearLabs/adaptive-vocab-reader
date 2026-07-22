#!/usr/bin/env node
/**
 * 真实 Chrome 验收：未打包 MV3 扩展必须在本地 HTTPS fixture 中标注词汇、
 * 响应“会／不会”并在刷新后保留。任何一步缺失均以非零状态失败。
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

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avr-e2e-'));
  const certPath = path.join(tempDir, 'cert.pem');
  const keyPath = path.join(tempDir, 'key.pem');
  const userDataDir = path.join(tempDir, 'chrome-profile');
  let server;
  let chrome;
  let browser;
  const pageLogs = [];
  const chromeLogs = [];

  try {
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

    const html = fs.readFileSync(FIXTURE, 'utf8');
    server = https.createServer(
      { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) },
      (request, response) => {
        if (request.url === '/' || request.url === '/test-page.html') {
          response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
          response.end(html);
          return;
        }
        response.writeHead(404).end();
      },
    );
    await onceListening(server);

    const devtools = await new Promise((resolve, reject) => {
      chrome = spawn(chromeForTesting, [
        `--user-data-dir=${userDataDir}`,
        `--load-extension=${DIST_DIR}`,
        `--disable-extensions-except=${DIST_DIR}`,
        '--no-first-run', '--no-default-browser-check',
        '--ignore-certificate-errors', '--remote-debugging-port=0', '--enable-logging=stderr', '--v=1',
      ], { stdio: ['ignore', 'ignore', 'pipe'] });
      const timeout = setTimeout(() => reject(new Error('Chrome 未在 15 秒内启动 DevTools')), 15_000);
      chrome.stderr.on('data', (data) => {
        chromeLogs.push(data.toString());
        const match = data.toString().match(/DevTools listening on (ws:\/\/\S+)/);
        if (match) {
          clearTimeout(timeout);
          resolve(match[1]);
        }
      });
      chrome.on('exit', (code) => reject(new Error(`Chrome 提前退出：${code}`)));
    });

    browser = await puppeteer.connect({ browserWSEndpoint: devtools });
    const page = await browser.newPage();
    page.on('console', (message) => pageLogs.push(`${message.type()}: ${message.text()}`));
    page.on('pageerror', (error) => pageLogs.push(`pageerror: ${error.message}`));
    await wait(1_000);
    const extensionTargets = browser.targets().map((target) => ({ type: target.type(), url: target.url() }))
      .filter((target) => target.url.startsWith('chrome-extension://'));
    if (extensionTargets.length === 0) {
      throw new Error('Chrome 未加载扩展 Service Worker；无法进行内容脚本验收');
    }
    await page.goto(`https://localhost:${PORT}/`, { waitUntil: 'networkidle0' });
    try {
      await page.waitForSelector('.avr-word', { timeout: 10_000 });
    } catch (error) {
      const diagnostic = await page.evaluate(() => ({
        styles: [...document.querySelectorAll('style')].map((style) => style.textContent?.includes('avr-')),
        bodyStart: document.body.innerHTML.slice(0, 120),
      }));
      throw new Error(`内容脚本未产生标注：${JSON.stringify({ diagnostic, pageLogs, extensionTargets, chromeLogs: chromeLogs.slice(-10) })}; ${error.message}`);
    }

    const initial = await page.evaluate(() => ({
      annotations: document.querySelectorAll('.avr-word').length,
      unknown: document.querySelectorAll('.avr-light').length,
      forbiddenInNav: document.querySelectorAll('nav .avr-word').length,
      forbiddenInCode: document.querySelectorAll('code .avr-word').length,
      forbiddenInComment: document.querySelectorAll('.comment-section .avr-word').length,
      challengesFormHit: [...document.querySelectorAll('.avr-word[data-word="challenge"]')]
        .some((element) => element.textContent?.toLowerCase() === 'challenges'),
      challengeTexts: [...document.querySelectorAll('.avr-word[data-word="challenge"]')]
        .map((element) => element.textContent),
    }));
    if (initial.annotations === 0 || initial.unknown === 0) {
      throw new Error(`未获得未知词轻提示：${JSON.stringify(initial)}`);
    }
    if (initial.forbiddenInNav || initial.forbiddenInCode || initial.forbiddenInComment) {
      throw new Error(`扫描了应跳过区域：${JSON.stringify(initial)}`);
    }
    if (!initial.challengesFormHit) {
      throw new Error(`词形映射未在真实页面命中：${JSON.stringify(initial)}`);
    }

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
    if (strong.first !== 1 || strong.repeats < 1 || strong.inline !== 1) {
      throw new Error(`不会词的首现/重复展示错误：${JSON.stringify(strong)}`);
    }

    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.avr-strong-first[data-word="challenge"]', { timeout: 10_000 });
    const persisted = await page.evaluate(() => ({
      first: document.querySelectorAll('.avr-strong-first[data-word="challenge"]').length,
      repeats: document.querySelectorAll('.avr-strong[data-word="challenge"]').length,
    }));
    if (persisted.first !== 1 || persisted.repeats < 1) {
      throw new Error(`刷新后不会词状态未保留：${JSON.stringify(persisted)}`);
    }

    const extensionWorker = browser.targets().find((target) =>
      target.type() === 'service_worker' && target.url().endsWith('/worker.js'),
    );
    const worker = extensionWorker ? await extensionWorker.worker() : null;
    if (!worker) throw new Error('未找到本扩展的 Service Worker，无法检查本地快照');
    const stored = await worker.evaluate(async () => chrome.storage.local.get('avr_vocab_snapshot'));
    const snapshot = stored.avr_vocab_snapshot;
    const serializedSnapshot = JSON.stringify(snapshot);
    if (!snapshot || !snapshot.dictVersion || snapshot.words?.challenge?.status !== 'learning' || /localhost|Journey Through Language|comment-section/.test(serializedSnapshot)) {
      throw new Error(`本地快照不符合最小隐私/状态要求：${serializedSnapshot}`);
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

    console.log(`E2E PASS: annotations=${initial.annotations}, unknown=${initial.unknown}, challenge_first=${persisted.first}, challenge_repeats=${persisted.repeats}, local_snapshot=minimal`);
  } finally {
    if (browser) await browser.close();
    if (chrome && chrome.exitCode === null) {
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
    if (server) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`E2E FAIL: ${error.stack || error.message}`);
  process.exitCode = 1;
});
