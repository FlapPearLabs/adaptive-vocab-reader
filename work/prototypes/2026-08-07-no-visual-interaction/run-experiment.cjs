#!/usr/bin/env node
/* PROTOTYPE ONLY: real-Chrome measurements for routes D-1 and D-2. */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const puppeteer = require('puppeteer-core');

const ROOT = __dirname;
const REPO = path.resolve(ROOT, '../../..');
const DICT = JSON.parse(fs.readFileSync(path.join(REPO, 'data/derived/ecdict-core-1000/dict-core.json'), 'utf8'));
const FORMS = JSON.parse(fs.readFileSync(path.join(REPO, 'data/derived/ecdict-core-1000/forms.json'), 'utf8'));
const PORT = 19807;

function chromePath() {
  const candidates = [
    process.env.CHROME_FOR_TESTING,
    path.join(REPO, '.cache/puppeteer/chrome/mac_arm-151.0.7922.47/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function contentType(file) {
  return file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/plain; charset=utf-8';
}

function server() {
  return http.createServer((req, res) => {
    const pathname = new URL(req.url, `http://127.0.0.1:${PORT}`).pathname;
    if (pathname === '/dictionary.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      return res.end(`window.__prototypeDictionary=${JSON.stringify(DICT)};window.__prototypeForms=${JSON.stringify(FORMS)};`);
    }
    const name = pathname === '/' ? 'fixture.html' : pathname.slice(1);
    const file = path.join(ROOT, name);
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': contentType(file) });
    res.end(fs.readFileSync(file));
  });
}

function overlap(a, b) {
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

async function waitFor(check, label) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) { if (await check()) return; await new Promise((r) => setTimeout(r, 40)); }
  throw new Error(`timeout: ${label}`);
}

async function point(page, id, word) { return page.evaluate((args) => window.__prototype.pointFor(...args), [id, word]); }

async function hoverAndFeedback(page, id, word) {
  const target = await point(page, id, word);
  await page.mouse.move(target.x, target.y);
  try {
    await waitFor(() => page.evaluate(() => Boolean(document.querySelector('[data-prototype-ui="tooltip"]'))), `tooltip ${id}`);
  } catch (error) { throw new Error(error.message); }
  // SANITIZED: 只持久化结构/几何数据与首行词形，不把 ECDICT 音标/词性/中文释义文本写入公开 evidence。
  const tooltip = await page.evaluate(() => {
    const text = document.querySelector('[data-prototype-ui="tooltip"]')?.textContent || '';
    const lines = text.split('\n').filter(Boolean);
    return { geometry: window.__prototypeLastGeometry, lineCount: lines.length, firstLine: lines[0] ?? '' };
  });
  await page.mouse.click(target.x, target.y);
  await waitFor(() => page.evaluate(() => Boolean(document.querySelector('[data-prototype-ui="feedback"]'))), `feedback ${id}`);
  await page.evaluate(() => document.querySelector('[data-prototype-ui="feedback"]').click());
  const feedback = await page.evaluate(() => document.querySelector('[data-prototype-ui="feedback"]')?.textContent);
  return { tooltip, feedback };
}

async function attempt(label, action) {
  try { return await action(); } catch (error) { return { error: `${label}: ${error.message}` }; }
}

async function runRoute(browser, route) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${PORT}/fixture.html?route=${route}`, { waitUntil: 'networkidle0' });
  await waitFor(() => page.evaluate(() => window.__prototypeReady), `${route} ready`);
  await new Promise((r) => setTimeout(r, 120));
  const baseline = await page.evaluate(() => window.__prototypePreMetrics);
  const annotation = await page.evaluate(() => ({ nodes: document.getElementsByTagName('*').length, scrollHeight: document.documentElement.scrollHeight, shifts: performance.getEntriesByType('layout-shift').reduce((total, entry) => total + entry.value, 0), metrics: window.__prototype.metrics }));
  const cases = {};
  for (const [id, word] of [['normal-case', 'Ability'], ['punctuation-case', 'action'], ['zoom-case', 'ability'], ['transform-case', 'ability'], ['shadow-case', 'ability']]) {
    cases[id] = await attempt(id, () => hoverAndFeedback(page, id, word));
  }
  await page.evaluate(() => window.scrollTo(0, document.querySelector('#bulk').offsetTop));
  cases.bottomAfterScroll = await attempt('bottomAfterScroll', () => hoverAndFeedback(page, 'bulk', 'ability'));
  await page.evaluate(() => window.scrollTo(0, 0));
  cases.topNearSticky = await attempt('topNearSticky', () => hoverAndFeedback(page, 'top-case', 'Ability'));
  const frame = page.frames().find((f) => f.url().includes('/frame.html'));
  await waitFor(() => frame.evaluate(() => window.__prototypeReady), `${route} iframe ready`);
  const framePoint = await frame.evaluate(() => window.__prototype.pointFor('frame-text', 'ability'));
  const frameBox = await page.$eval('#same-origin-frame', (el) => el.getBoundingClientRect().toJSON());
  cases.sameOriginIframe = await attempt('sameOriginIframe', async () => {
    await page.mouse.move(frameBox.left + framePoint.x, frameBox.top + framePoint.y);
    await waitFor(() => frame.evaluate(() => Boolean(document.querySelector('[data-prototype-ui="tooltip"]'))), `${route} iframe tooltip`);
    // SANITIZED: iframe tooltip 同样只记录行数/首行，不持久化 ECDICT 文本。
    const tooltip = await frame.evaluate(() => {
      const text = document.querySelector('[data-prototype-ui="tooltip"]')?.textContent || '';
      const lines = text.split('\n').filter(Boolean);
      return { lineCount: lines.length, firstLine: lines[0] ?? '' };
    });
    await page.mouse.click(frameBox.left + framePoint.x, frameBox.top + framePoint.y);
    await waitFor(() => frame.evaluate(() => Boolean(document.querySelector('[data-prototype-ui="feedback"]'))), `${route} iframe feedback`);
    await frame.evaluate(() => document.querySelector('[data-prototype-ui="feedback"]').click());
    const feedback = await frame.evaluate(() => document.querySelector('[data-prototype-ui="feedback"]')?.textContent);
    return { tooltip, feedback };
  });
  await page.evaluate(() => { document.querySelector('#dynamic-added').textContent = 'Ability activity was inserted by SPA.'; });
  await new Promise((r) => setTimeout(r, 120));
  await page.$eval('#dynamic-added', (el) => el.scrollIntoView({ block: 'center' }));
  cases.spaInsertion = await attempt('spaInsertion', () => hoverAndFeedback(page, 'dynamic-added', 'Ability'));
  await page.evaluate(() => { document.querySelector('#character-data').firstChild.data = 'Activity changed through characterData.'; });
  await new Promise((r) => setTimeout(r, 120));
  await page.$eval('#character-data', (el) => el.scrollIntoView({ block: 'center' }));
  cases.characterData = await attempt('characterData', () => hoverAndFeedback(page, 'character-data', 'Activity'));
  const after = await page.evaluate(() => ({ nodes: document.getElementsByTagName('*').length, scrollHeight: document.documentElement.scrollHeight, shifts: performance.getEntriesByType('layout-shift').map((x) => x.value).reduce((a, b) => a + b, 0), metrics: window.__prototype.metrics, events: window.__prototype.events, geometry: window.__prototypeLastGeometry }));
  const geometryCases = Object.values(cases).filter((item) => item?.tooltip?.geometry).map((item) => item.tooltip.geometry);
  const expected = { 'normal-case': 'ability', 'punctuation-case': 'action', 'zoom-case': 'ability', 'transform-case': 'ability', 'shadow-case': 'ability', bottomAfterScroll: 'ability', topNearSticky: 'ability', sameOriginIframe: 'ability', spaInsertion: 'ability', characterData: 'activity' };
  const pass = Object.fromEntries(Object.entries(cases).map(([name, item]) => {
    const lineCount = item.tooltip?.lineCount ?? 0;
    const firstLine = item.tooltip?.firstLine ?? '';
    return [name, Boolean(lineCount === 4 && firstLine.toLowerCase() === expected[name] && item.feedback === `已反馈不会：${expected[name]}`)];
  }));
  const tooltipSafety = geometryCases.map((item) => ({ overlap: item.overlap, insideViewport: item.tooltip.left >= 0 && item.tooltip.top >= 0 && item.tooltip.right <= 1280 && item.tooltip.bottom <= 800, aboveSticky: item.tooltip.top >= item.headerBottom }));
  await page.close();
  return { route, baseline, annotation, after, cases, pass, tooltipSafety, derived: { domNodesAdded: annotation.nodes - baseline.nodes, scrollHeightDeltaPx: annotation.scrollHeight - baseline.scrollHeight, clsDelta: annotation.shifts - baseline.shifts, everyCasePassed: Object.values(pass).every(Boolean), maxTargetTooltipOverlap: Math.max(...tooltipSafety.map((x) => x.overlap)) } };
}

async function main() {
  const executablePath = chromePath();
  if (!executablePath) throw new Error('未找到本机 Chrome；设置 CHROME_FOR_TESTING 后重试。');
  const httpServer = server();
  await new Promise((resolve) => httpServer.listen(PORT, '127.0.0.1', resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'avr-prototype-'));
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath, headless: true, userDataDir: profile, args: ['--no-first-run', '--no-default-browser-check'] });
    const results = { generatedAt: new Date().toISOString(), chrome: await browser.version(), dictionary: { entries: Object.keys(DICT).length, forms: Object.keys(FORMS).length }, routes: [await runRoute(browser, 'wrap'), await runRoute(browser, 'caret')] };
    fs.writeFileSync(path.join(ROOT, 'measurements-2026-08-07.json'), `${JSON.stringify(results, null, 2)}\n`);
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser?.close();
    await new Promise((resolve) => httpServer.close(resolve));
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
