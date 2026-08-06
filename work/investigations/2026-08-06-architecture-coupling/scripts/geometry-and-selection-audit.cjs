const {execFileSync, spawn} = require('node:child_process');
const fs = require('node:fs');
const https = require('node:https');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../../..');
const DIST = path.join(ROOT, 'dist');
const GITHUB_URL = 'https://github.com/FlapPearLabs/adaptive-vocab-reader';
const puppeteer = require(path.join(ROOT, 'node_modules/puppeteer-core'));

function findChromeForTesting() {
  const override = process.env.CHROME_FOR_TESTING;
  if (override) {
    if (fs.existsSync(override)) return override;
    throw new Error(`CHROME_FOR_TESTING does not exist: ${override}`);
  }

  const chromeRoot = path.join(ROOT, '.cache', 'puppeteer', 'chrome');
  if (!fs.existsSync(chromeRoot)) throw new Error('Chrome for Testing not found; run npm run setup:e2e');
  const relativeCandidates = process.platform === 'darwin'
    ? (process.arch === 'arm64'
      ? [
          'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
          'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        ]
      : [
          'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        ])
    : process.platform === 'linux' && process.arch === 'x64'
      ? ['chrome-linux64/chrome', 'chrome-linux/chrome']
      : process.platform === 'win32' && process.arch === 'x64'
        ? ['chrome-win64/chrome.exe', 'chrome-win32/chrome.exe']
        : process.platform === 'win32' && process.arch === 'ia32'
          ? ['chrome-win32/chrome.exe']
          : [];

  for (const name of fs.readdirSync(chromeRoot).sort().reverse()) {
    for (const relative of relativeCandidates) {
      const executable = path.join(chromeRoot, name, relative);
      if (fs.existsSync(executable)) return executable;
    }
  }
  throw new Error(`Chrome for Testing executable not found for ${process.platform}/${process.arch}; set CHROME_FOR_TESTING`);
}

const CHROME = findChromeForTesting();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'avr-geometry-'));
const cert = path.join(tmp, 'cert.pem');
const key = path.join(tmp, 'key.pem');
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=localhost'], {stdio: 'ignore'});

const samples = ['evaluating', 'improving', 'building', 'collecting', 'requires', 'published', 'environments', 'reinforcement', 'inference', 'framework', 'storing', 'drafted', 'reaches', 'customer'];
const sampleHtml = samples.map((word) => `<span id="sample-${word}">${word}</span>`).join(' ');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;font:16px/1.5 Arial} .sticky{position:sticky;top:0;height:64px;background:#ffd;z-index:999999;padding:4px} .stage{position:relative;height:1900px;padding:20px}
#normal{display:inline-block;margin-top:80px} #nearsticky{position:absolute;left:500px;top:0} #right{position:absolute;right:0;top:380px} #left{position:absolute;left:0;top:520px} #bottom{position:fixed;bottom:0;left:300px} #scroll{position:absolute;top:1500px;left:200px}
.line{width:620px;margin-top:20px}.neighbors{display:inline}
</style></head><body><div class="sticky">Sticky header</div><main class="stage"><span id="nearsticky">ability</span><p id="samples">${sampleHtml}</p><p class="line"><span class="neighbors">Text immediately before </span><span id="normal">ability</span><span class="neighbors"> and immediately after the target word on this line.</span></p><span id="right">challenge</span><span id="left">ability</span><span id="bottom">challenge</span><span id="scroll">ability</span></main></body></html>`;

const server = https.createServer({key: fs.readFileSync(key), cert: fs.readFileSync(cert)}, (_, response) => {
  response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
  response.end(html);
});
const listen = () => new Promise((resolve) => server.listen(18924, '127.0.0.1', resolve));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function launch() {
  const profile = path.join(tmp, 'profile');
  const cp = spawn(CHROME, [
    `--user-data-dir=${profile}`,
    `--load-extension=${DIST}`,
    `--disable-extensions-except=${DIST}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--ignore-certificate-errors',
    '--remote-debugging-port=0',
    '--headless=new',
  ], {stdio: ['ignore', 'ignore', 'pipe']});
  const ws = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('devtools timeout')), 15000);
    cp.stderr.on('data', (data) => {
      const match = String(data).match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    });
    cp.on('exit', (code) => reject(new Error(`chrome exit ${code}`)));
  });
  return {cp, browser: await puppeteer.connect({browserWSEndpoint: ws, protocolTimeout: 240000})};
}

async function measureSelector(page, selector) {
  await page.hover(selector);
  await page.waitForFunction(() => document.querySelector('.avr-tooltip')?.style.display === 'block');
  return page.evaluate((targetSelector) => {
    const word = document.querySelector(targetSelector);
    const tooltip = document.querySelector('.avr-tooltip');
    if (!word || !tooltip) throw new Error(`Cannot measure ${targetSelector}`);
    const wordRect = word.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const ix = Math.max(0, Math.min(wordRect.right, tooltipRect.right) - Math.max(wordRect.left, tooltipRect.left));
    const iy = Math.max(0, Math.min(wordRect.bottom, tooltipRect.bottom) - Math.max(wordRect.top, tooltipRect.top));
    const sticky = document.querySelector('.sticky')?.getBoundingClientRect();
    return {
      word: rect(wordRect),
      tooltip: rect(tooltipRect),
      overlapTargetPx2: +(ix * iy).toFixed(2),
      viewport: {width: innerWidth, height: innerHeight},
      scrollY,
      sticky: sticky ? {top: sticky.top, bottom: sticky.bottom} : null,
      overlapsSticky: sticky ? tooltipRect.bottom > sticky.top && tooltipRect.top < sticky.bottom : null,
    };

    function rect(value) {
      return {left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height};
    }
  }, selector);
}

async function measureGitHub(page) {
  await page.setViewport({width: 1280, height: 800});
  await page.goto(GITHUB_URL, {waitUntil: 'domcontentloaded', timeout: 60000});
  await wait(7000);
  const target = await page.evaluate(() => {
    const candidates = [...document.querySelectorAll('main .avr-word')];
    const element = candidates.find((candidate) => {
      const rect = candidate.getBoundingClientRect();
      const style = getComputedStyle(candidate);
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight && style.visibility !== 'hidden' && style.display !== 'none';
    });
    if (!element) return null;
    element.setAttribute('data-avr-investigation-target', 'github-first-visible-main-word');
    return {surfaceForm: element.textContent || '', wordKey: element.getAttribute('data-word')};
  });
  if (!target) throw new Error('No visible main .avr-word found on the GitHub page');
  const geometry = await measureSelector(page, '[data-avr-investigation-target="github-first-visible-main-word"]');
  return {
    url: page.url(),
    title: await page.title(),
    targetSurfaceForm: target.surfaceForm,
    targetWordKey: target.wordKey,
    targetSelection: 'first visible main .avr-word in DOM order',
    ...geometry,
  };
}

async function installSelectionTrace(page) {
  await page.evaluate(() => {
    const trace = [];
    let sequence = 0;
    const snapshot = (kind, event = null) => {
      const action = document.querySelector('.avr-selection-action');
      trace.push({
        sequence: ++sequence,
        timeMs: +performance.now().toFixed(3),
        kind,
        eventPhase: event?.eventPhase ?? null,
        target: event?.target instanceof Element
          ? `${event.target.tagName.toLowerCase()}${event.target.id ? `#${event.target.id}` : ''}${event.target.className ? `.${String(event.target.className).trim().replace(/\s+/g, '.')}` : ''}`
          : null,
        selected: window.getSelection()?.toString() || '',
        actionWord: action?.getAttribute('data-word') || null,
        actionPresent: Boolean(action),
      });
    };
    for (const type of ['mousedown', 'mouseup', 'click']) {
      document.addEventListener(type, (event) => snapshot(`${type}:capture`, event), true);
      document.addEventListener(type, (event) => snapshot(`${type}:bubble`, event), false);
    }
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element && (node.matches('.avr-selection-action') || node.querySelector('.avr-selection-action'))) snapshot('selectionAction:inserted');
        }
        for (const node of record.removedNodes) {
          if (node instanceof Element && (node.matches('.avr-selection-action') || node.querySelector('.avr-selection-action'))) snapshot('selectionAction:removed');
        }
      }
    }).observe(document.body, {childList: true, subtree: true});
    window.__avrInvestigationSelectionTrace = trace;
  });
}

async function stopChrome(cp) {
  if (cp.exitCode !== null) return;
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 5000);
    cp.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
    cp.kill('SIGTERM');
  });
}

(async () => {
  await listen();
  const {cp, browser} = await launch();
  const out = {capturedAt: new Date().toISOString(), chrome: await browser.version(), platform: {os: process.platform, arch: process.arch}, fixture: {url: 'https://localhost:18924/', page: {}}, github: null};
  try {
    const page = await browser.newPage();
    await page.setViewport({width: 1280, height: 800});
    await page.goto(out.fixture.url, {waitUntil: 'networkidle0'});
    await wait(2500);
    out.fixture.page.sampleFacts = await page.evaluate((words) => words.map((surfaceForm) => {
      const host = document.getElementById(`sample-${surfaceForm}`);
      const span = host?.matches('.avr-word') ? host : host?.querySelector('.avr-word');
      return {surfaceForm, wrapped: Boolean(span), className: span?.className || null, wordKey: span?.getAttribute('data-word') || null, hoverable: Boolean(span), clickMenuReachable: Boolean(span)};
    }), samples);
    out.fixture.page.initialState = await (async () => {
      const serviceWorker = browser.targets().find((target) => target.type() === 'service_worker' && target.url().endsWith('/worker.js'));
      const worker = serviceWorker && await serviceWorker.worker();
      return worker ? worker.evaluate(async () => {
        const storage = await chrome.storage.local.get('avr_vocab_snapshot');
        return storage.avr_vocab_snapshot?.words || {};
      }) : null;
    })();
    out.fixture.page.geometry = {};
    out.fixture.page.geometry.nearSticky = await measureSelector(page, '#nearsticky .avr-word, #nearsticky.avr-word');
    out.fixture.page.geometry.normal = await measureSelector(page, '#normal .avr-word, #normal.avr-word');
    out.fixture.page.geometry.right = await measureSelector(page, '#right .avr-word, #right.avr-word');
    out.fixture.page.geometry.left = await measureSelector(page, '#left .avr-word, #left.avr-word');
    out.fixture.page.geometry.bottom = await measureSelector(page, '#bottom .avr-word, #bottom.avr-word');
    await page.evaluate(() => document.getElementById('scroll').scrollIntoView({block: 'center'}));
    await wait(300);
    out.fixture.page.geometry.scrolled = await measureSelector(page, '#scroll .avr-word, #scroll.avr-word');

    await page.evaluate(() => scrollTo(0, 0));
    await wait(200);
    await installSelectionTrace(page);
    const dragHandle = await page.$('#sample-improving.avr-word, #sample-improving .avr-word');
    const dragBox = dragHandle ? await dragHandle.boundingBox() : null;
    if (dragBox) {
      await page.mouse.move(Math.max(0, dragBox.x - 3), dragBox.y + dragBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(dragBox.x + dragBox.width + 3, dragBox.y + dragBox.height / 2, {steps: 24});
      await page.mouse.up();
      await wait(500);
    }
    out.fixture.page.realMouseSelection = await page.evaluate(() => ({
      selected: window.getSelection()?.toString() || '',
      action: document.querySelector('.avr-selection-action')?.getAttribute('data-word') || null,
      visible: Boolean(document.querySelector('.avr-selection-action')),
      eventTimeline: window.__avrInvestigationSelectionTrace || [],
    }));
    await page.evaluate(() => {
      window.getSelection()?.removeAllRanges();
      document.querySelector('.avr-selection-action')?.remove();
    });

    await page.click('#sample-building.avr-word, #sample-building .avr-word');
    await page.click('.avr-action-menu button[data-avr-status="known"]');
    await wait(500);
    out.fixture.page.knownAfterAction = await page.evaluate(() => ({wrapped: Boolean(document.querySelector('#sample-building.avr-word, #sample-building .avr-word'))}));
    out.fixture.page.finalState = await (async () => {
      const serviceWorker = browser.targets().find((target) => target.type() === 'service_worker' && target.url().endsWith('/worker.js'));
      const worker = serviceWorker && await serviceWorker.worker();
      return worker ? worker.evaluate(async () => {
        const storage = await chrome.storage.local.get('avr_vocab_snapshot');
        return storage.avr_vocab_snapshot?.words || {};
      }) : null;
    })();
    await page.close();

    const githubPage = await browser.newPage();
    out.github = await measureGitHub(githubPage);
    await githubPage.close();
    console.log(JSON.stringify(out, null, 2));
  } finally {
    browser.disconnect();
    await stopChrome(cp);
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmp, {recursive: true, force: true});
  }
})().catch((error) => {
  console.error(error);
  server.close();
  fs.rmSync(tmp, {recursive: true, force: true});
  process.exitCode = 1;
});
