// ============================================================
// SPA 动态插入测试（规格 §11）—— 可直接在 happy-dom 中运行
// ============================================================
// 验证内容脚本的增量标注不变量：
//  1. 初次扫描标注正文、跳过 nav 等非正文区
//  2. SPA 追加 / 路由切换（innerHTML 重写）产生的新正文会被标注
//  3. 已标注的旧正文不会被重扫或重置（processedNodes 守卫）
//  4. 重复扫描整页不产生重复 span（不全页重扫）
// 直接复用生产用的 createPageScanner，不复制标注逻辑。
import { describe, it, expect, beforeEach } from 'vitest';
import { createDictionary } from './dictionary';
import type { DictCore, FormsMap } from '../shared/types';
import { createPageScanner } from './pageScanner';
import { initAnnotator, resetAnnotatorState } from './annotator';
import type { WordState } from '../shared/types';

// 最小独立词典 fixture（与 dictionary.test.ts 同源，但覆盖 SPA 用词）
const FIXTURE_CORE: DictCore = {
  alpha: { phonetic: 'ˈælfə', pos: 'n.', translation: '阿尔法' },
  beta: { phonetic: 'ˈbiːtə', pos: 'n.', translation: '贝塔' },
  go: { phonetic: 'ɡəʊ', pos: 'v.', translation: '去' },
  wend: { phonetic: 'wɛnd', pos: 'v.', translation: '绕行' },
  challenge: { phonetic: 'ˈtʃælɪndʒ', pos: 'n./v.', translation: '挑战' },
};
const FIXTURE_FORMS: FormsMap = { goes: 'go', going: 'go', gone: 'go', went: 'go', challenged: 'challenge' };

function makeScanner() {
  const dict = createDictionary(FIXTURE_CORE, FIXTURE_FORMS);
  const state: Record<string, WordState> = {};
  const actions: Array<[string, WordState['status']]> = [];
  const scanner = createPageScanner({
    dictionary: dict,
    getState: () => state,
    onUserAction: (w, s) => actions.push([w, s]),
  });
  return { dict, state, actions, scanner };
}

/** 等待一小段时间，让 MutationObserver 与批处理有时间触发 */
function tick(ms = 10): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('SPA 动态插入（规格 §11）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetAnnotatorState();
    initAnnotator();
    // 让 scanDocument 的批处理同步完成，保证测试确定性
    const raf = (cb: FrameRequestCallback): number => {
      cb(0);
      return 0;
    };
    (window as unknown as { requestAnimationFrame: typeof raf }).requestAnimationFrame = raf;
    (globalThis as unknown as { requestAnimationFrame: typeof raf }).requestAnimationFrame = raf;
  });

  it('初次扫描标注正文、跳过 nav', () => {
    document.body.innerHTML = `
      <nav>Go to settings now.</nav>
      <article><p id="intro">Alpha and beta are important. The challenge is real.</p></article>
    `;
    const { scanner } = makeScanner();
    scanner.scanDocument(document.body);

    const intro = document.getElementById('intro')!;
    const nav = document.querySelector('nav')!;
    expect(intro.querySelectorAll('.avr-word').length).toBe(3); // alpha, beta, challenge
    expect(nav.querySelectorAll('.avr-word').length).toBe(0); // 非正文区跳过
  });

  it('查询词典扩容不提前改变固定测评包的展示范围', () => {
    document.body.innerHTML = '<article><p id="intro">Alpha and queryonly are present.</p></article>';
    const dictionary = createDictionary(
      {
        alpha: FIXTURE_CORE.alpha!,
        queryonly: { phonetic: 'q', pos: 'n.', translation: '合成查询释义', effectiveFrequencyRank: null },
      },
      {},
    );
    const scanner = createPageScanner({
      dictionary,
      assessmentBands: { alpha: 0 },
      getState: () => ({}),
      onUserAction: () => {},
    });

    scanner.scanDocument(document.body);

    expect(document.querySelectorAll('.avr-word[data-word="alpha"]')).toHaveLength(1);
    expect(document.querySelectorAll('.avr-word[data-word="queryonly"]')).toHaveLength(0);
  });

  it('动态追加正文被增量标注，已标注内容不被重扫或重置（MutationObserver 路径）', async () => {
    document.body.innerHTML = `
      <nav>Go to settings now.</nav>
      <article>
        <p id="intro">Alpha and beta are important. The challenge is real.</p>
        <div id="feed"></div>
      </article>
    `;
    const { scanner } = makeScanner();
    scanner.scanDocument(document.body);
    scanner.observeDynamic(document.body);

    const intro = document.getElementById('intro')!;
    const introSpans = intro.querySelectorAll('.avr-word');
    expect(introSpans.length).toBe(3);
    const introFirst = introSpans[0]!; // 捕获引用，验证后续不被重置

    // 模拟 SPA 无限滚动追加
    const feed = document.getElementById('feed')!;
    const p = document.createElement('p');
    p.textContent = 'Alpha and challenge again.';
    feed.appendChild(p);
    await tick();

    expect(feed.querySelectorAll('.avr-word').length).toBe(2); // alpha, challenge
    // 已标注的旧正文引用仍存活、未被重扫重置
    expect(intro.contains(introFirst)).toBe(true);
    expect(intro.querySelectorAll('.avr-word').length).toBe(3);

    // 再次扫描整页不应产生重复 span（processedNodes 守卫）
    scanner.scanDocument(document.body);
    expect(intro.querySelectorAll('.avr-word').length).toBe(3);
    expect(feed.querySelectorAll('.avr-word').length).toBe(2);
  });

  it('路由切换（innerHTML 重写）标注新视图，旧正文不受影响', async () => {
    document.body.innerHTML = `
      <nav>Go to settings now.</nav>
      <article>
        <p id="intro">Alpha and beta are important. The challenge is real.</p>
        <div id="view"></div>
      </article>
    `;
    const { scanner } = makeScanner();
    scanner.scanDocument(document.body);
    scanner.observeDynamic(document.body);

    const intro = document.getElementById('intro')!;
    expect(intro.querySelectorAll('.avr-word').length).toBe(3);
    const view = document.getElementById('view')!;

    // 模拟 SPA 路由切换：innerHTML 重写
    view.innerHTML = '<p>Beta and go somewhere.</p>';
    await tick();

    expect(view.querySelectorAll('.avr-word').length).toBe(2); // beta, go
    // 旧正文未被触碰
    expect(intro.querySelectorAll('.avr-word').length).toBe(3);
    // nav 仍被跳过
    expect(document.querySelector('nav')!.querySelectorAll('.avr-word').length).toBe(0);
  });

  it('动态插入的文本节点也会被标注（直接 processTextNode 路径）', () => {
    document.body.innerHTML = `
      <article><p id="intro">Alpha and beta are important.</p></article>
    `;
    const { scanner } = makeScanner();
    scanner.scanDocument(document.body);

    // 模拟框架把一段文本直接作为文本节点插入正文
    const intro = document.getElementById('intro')!;
    const tn = document.createTextNode('The challenge remains.');
    intro.appendChild(tn);
    scanner.processTextNode(tn);

    // 新插入的 "challenge" 被标注，旧词未变化
    expect(intro.querySelectorAll('.avr-word').length).toBe(3); // alpha, beta, challenge
    expect(document.querySelector<HTMLElement>('.avr-word[data-word="challenge"]')).not.toBeNull();
  });
});
