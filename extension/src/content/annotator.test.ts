import { describe, it, expect, beforeEach } from 'vitest';
import { ANNOTATOR_STYLES, annotateTextNode, calculateTooltipPosition, initAnnotator, METADATA_RESOLUTION_FAILURE_TEXT, resetAnnotatorState, updateWordDisplay, type WordAnnotation } from './annotator';
import type { DisplayResult } from '../shared/types';

function makeResult(overrides: Partial<DisplayResult> = {}): DisplayResult {
  return {
    word: 'go',
    decision: 'strong',
    surfaceForm: 'went',
    translation: '去；走',
    showInlineTranslation: true,
    ...overrides,
  };
}

function makeAnnotation(
  startIndex: number,
  endIndex: number,
  resultOverrides: Partial<DisplayResult> = {},
): WordAnnotation {
  return {
    result: makeResult(resultOverrides),
    startIndex,
    endIndex,
  };
}

/** 在 happy-dom 中创建独立文本节点 */
function makeTextNode(text: string): Text {
  const p = document.createElement('p');
  p.textContent = text;
  document.body.appendChild(p);
  // p.firstChild 是文本节点
  return p.firstChild as Text;
}

describe('annotateTextNode', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetAnnotatorState();
    initAnnotator();
  });

  // ============================================================
  // surfaceForm 定位缺陷回归（核心修复）
  // ============================================================

  it('大写词形 "Went" 被正确标注，span 保留原文大小写', () => {
    // 文本："Went home."  词 "went" 在位置 0..4
    const textNode = makeTextNode('Went home.');
    const ann = makeAnnotation(0, 4, { word: 'went', surfaceForm: 'went' });

    const { spans } = annotateTextNode(textNode, [ann], () => {});

    expect(spans).toHaveLength(1);
    expect(spans[0]!.textContent).toBe('Went'); // 保留原文大小写，不是 "went"
    expect(spans[0]!.dataset.word).toBe('went'); // data-word 是状态键（surface form），而非取义主词条 go
  });

  it('句首大写 "Hello" 被正确标注', () => {
    const textNode = makeTextNode('Hello world.');
    const ann = makeAnnotation(0, 5, {
      word: 'hello',
      surfaceForm: 'hello',
      translation: '你好',
    });

    const { spans } = annotateTextNode(textNode, [ann], () => {});

    expect(spans).toHaveLength(1);
    expect(spans[0]!.textContent).toBe('Hello');
  });

  it('混合大小写 "HeLLo" 被正确标注', () => {
    const textNode = makeTextNode('HeLLo there.');
    const ann = makeAnnotation(0, 5, {
      word: 'hello',
      surfaceForm: 'hello',
    });

    const { spans } = annotateTextNode(textNode, [ann], () => {});

    expect(spans).toHaveLength(1);
    expect(spans[0]!.textContent).toBe('HeLLo');
  });

  // ============================================================
  // 多词切分
  // ============================================================

  it('多个词按位置正确切分，保留中间文本', () => {
    // "Went to school"  went@0..4  school@8..14
    const textNode = makeTextNode('Went to school');
    const anns = [
      makeAnnotation(0, 4, { word: 'go', surfaceForm: 'went' }),
      makeAnnotation(8, 14, { word: 'school', surfaceForm: 'school', translation: '学校' }),
    ];

    const { spans } = annotateTextNode(textNode, [anns[0]!, anns[1]!], () => {});

    expect(spans).toHaveLength(2);
    expect(spans[0]!.textContent).toBe('Went');
    expect(spans[0]!.dataset.word).toBe('go');
    expect(spans[1]!.textContent).toBe('school');
    expect(spans[1]!.dataset.word).toBe('school');

    // 父元素的文本应保持完整
    const parent = spans[0]!.parentElement!;
    expect(parent.textContent).toBe('Went to school');
  });

  it('词在文本中间位置被正确标注', () => {
    // "the challenge here"  challenge@4..13
    const textNode = makeTextNode('the challenge here');
    const ann = makeAnnotation(4, 13, {
      word: 'challenge',
      surfaceForm: 'challenge',
      translation: '挑战',
    });

    const { spans } = annotateTextNode(textNode, [ann], () => {});

    expect(spans).toHaveLength(1);
    expect(spans[0]!.textContent).toBe('challenge');
    const parent = spans[0]!.parentElement!;
    expect(parent.textContent).toBe('the challenge here');
  });

  // ============================================================
  // decision=none 仍创建透明查询 span
  // ============================================================

  it('decision=none 的 query-eligible 词创建无视觉样式的透明 span', () => {
    const textNode = makeTextNode('Went home.');
    const ann = makeAnnotation(0, 4, { decision: 'none', translation: null });

    const { spans } = annotateTextNode(textNode, [ann], () => {});

    expect(spans).toHaveLength(1);
    expect(spans[0]!.className).toBe('avr-word');
    expect(spans[0]!.textContent).toBe('Went');
  });

  it('透明 span 仍可经事件委托 hover 查询并 click 反馈', () => {
    const textNode = makeTextNode('Went home.');
    const actions: Array<[string, 'known' | 'learning']> = [];
    const ann = {
      ...makeAnnotation(0, 4, { word: 'go', decision: 'none', translation: '合成释义' }),
      phonetic: 'synthetic-phonetic',
      pos: 'v.',
    };
    const { spans } = annotateTextNode(textNode, [ann], (word, status) => actions.push([word, status]));

    spans[0]!.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    expect([...document.querySelectorAll('.avr-tooltip > div')].map((row) => row.textContent)).toEqual([
      'Went', 'synthetic-phonetic', 'v.', '合成释义',
    ]);

    spans[0]!.click();
    const learning = document.querySelector<HTMLButtonElement>('.avr-action-menu button[data-avr-status="learning"]');
    learning!.click();
    expect(actions).toEqual([['go', 'learning']]);
  });

  it('未收录透明 span hover/click 只显示固定提示且不触发状态动作', () => {
    const textNode = makeTextNode('Unlisted token.');
    const actions: Array<[string, 'known' | 'learning']> = [];
    const ann = { ...makeAnnotation(0, 8, { word: 'unlisted', decision: 'none', translation: null }), unresolved: true };
    const { spans } = annotateTextNode(textNode, [ann], (word, status) => actions.push([word, status]));

    spans[0]!.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    expect(document.querySelector('.avr-tooltip')?.textContent).toBe('当前词典未收录');
    // D-1 负向：未收录路径（当前词典未收录）与元数据失败路径（释义暂不可用）不得混淆。
    expect(document.querySelector('.avr-tooltip')?.textContent).not.toContain(METADATA_RESOLUTION_FAILURE_TEXT);
    spans[0]!.click();
    expect((document.querySelector('.avr-action-menu') as HTMLElement | null)?.style.display).not.toBe('flex');
    expect(actions).toEqual([]);
  });

  // ============================================================
  // 强提示与行内中文
  // ============================================================

  it('强提示首次出现带行内中文 data-translation', () => {
    const textNode = makeTextNode('challenge');
    const ann = makeAnnotation(0, 9, {
      word: 'challenge',
      surfaceForm: 'challenge',
      translation: '挑战',
      decision: 'strong',
      showInlineTranslation: true,
    });

    const { spans } = annotateTextNode(textNode, [ann], () => {});

    expect(spans[0]!.classList.contains('avr-strong-first')).toBe(true);
    // D-5 契约：annotation 未提供 pos（data-pos 为空）→ 行内释义省略前缀，仅释义本体。
    expect(spans[0]!.dataset.translation).toBe('挑战');
  });

  it('强提示重复出现不带行内中文（仅 avr-strong）', () => {
    const textNode = makeTextNode('challenge');
    const ann = makeAnnotation(0, 9, {
      decision: 'strong',
      showInlineTranslation: false,
      translation: '挑战',
    });

    const { spans } = annotateTextNode(textNode, [ann], () => {});

    expect(spans[0]!.classList.contains('avr-strong')).toBe(true);
    expect(spans[0]!.classList.contains('avr-strong-first')).toBe(false);
  });

  it('轻提示使用 avr-light 类', () => {
    const textNode = makeTextNode('hello');
    const ann = makeAnnotation(0, 5, {
      decision: 'light',
      translation: '你好',
    });

    const { spans } = annotateTextNode(textNode, [ann], () => {});

    expect(spans[0]!.classList.contains('avr-light')).toBe(true);
    expect(spans[0]!.classList.contains('avr-word')).toBe(true);
  });

  // ============================================================
  // 边界情况
  // ============================================================

  it('空 annotations 返回空数组且不修改文本节点', () => {
    const textNode = makeTextNode('Hello world.');
    const { spans } = annotateTextNode(textNode, [], () => {});
    expect(spans).toHaveLength(0);
    expect(textNode.textContent).toBe('Hello world.');
  });

  it('标注后原文本节点的父元素文本内容不变', () => {
    const textNode = makeTextNode('The Went and gone.');
    // The@0..3  Went@4..8  gone@13..17
    const anns = [
      makeAnnotation(4, 8, { word: 'go', surfaceForm: 'went', translation: '去' }),
      makeAnnotation(13, 17, { word: 'go', surfaceForm: 'gone', translation: '去' }),
    ];

    const parent = textNode.parentElement!;
    const original = parent.textContent;
    annotateTextNode(textNode, anns, () => {});

    expect(parent.textContent).toBe(original);
  });

  // ============================================================
  // 真实 DOM 节点统计（Fix #3：added/removed 供 netNodes 使用）
  // ============================================================

  it('annotateTextNode 返回真实 added/removed：单 span + 文本碎片 + 1 个被替换原文节点', () => {
    const textNode = makeTextNode('Went home.');
    const ann = makeAnnotation(0, 4, { word: 'went', surfaceForm: 'went' });
    const res = annotateTextNode(textNode, [ann], () => {});
    // "Went"(span) + " home."(text) = 2 个新增节点；原 "Went home." 文本节点被替换 = 1
    expect(res.added).toBe(2);
    expect(res.removed).toBe(1);
    expect(res.spans).toHaveLength(1);
  });

  it('updateWordDisplay 切到 none 时保留透明查询 span：不产生 DOM 增减', () => {
    const textNode = makeTextNode('challenge is here');
    const ann = makeAnnotation(0, 9, {
      word: 'challenge',
      surfaceForm: 'challenge',
      translation: '挑战',
      decision: 'strong',
      showInlineTranslation: true,
    });
    annotateTextNode(textNode, [ann], () => {});

    const res = updateWordDisplay('challenge', 'none', null, false);
    expect(res.removed).toBe(0);
    expect(res.added).toBe(0);
    const span = document.querySelector<HTMLSpanElement>('.avr-word[data-word="challenge"]');
    expect(span).not.toBeNull();
    expect(span!.className).toBe('avr-word');
  });
});

describe('tooltip 几何', () => {
  it('优先放在目标上方，顶部不足时翻转到底部，并限制在视口内', () => {
    expect(calculateTooltipPosition(
      { left: 100, top: 100, right: 140, bottom: 120 },
      { width: 80, height: 30 },
      300,
      200,
    )).toEqual({ left: 100, top: 62 });
    expect(calculateTooltipPosition(
      { left: 290, top: 5, right: 300, bottom: 25 },
      { width: 80, height: 30 },
      300,
      200,
    )).toEqual({ left: 212, top: 33 });
    expect(calculateTooltipPosition(
      { left: 100, top: 70, right: 140, bottom: 90 },
      { width: 80, height: 30 },
      300,
      200,
      64,
    )).toEqual({ left: 100, top: 98 });
  });
});

// ============================================================
// updateWordDisplay —— 增量更新（不全页重扫）
// ============================================================
// 规格 4：状态变更后只更新受影响的命中词
describe('updateWordDisplay', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetAnnotatorState();
    initAnnotator();
  });

  it('标记会（none）→ 该词保留透明查询 span', () => {
    // 先标注一个 "challenge" 强提示
    const textNode = makeTextNode('challenge is here');
    const ann = makeAnnotation(0, 9, {
      word: 'challenge',
      surfaceForm: 'challenge',
      translation: '挑战',
      decision: 'strong',
      showInlineTranslation: true,
    });
    annotateTextNode(textNode, [ann], () => {});

    // 确认 span 存在
    let spans = document.querySelectorAll<HTMLSpanElement>('.avr-word[data-word="challenge"]');
    expect(spans.length).toBe(1);

    // 标记会 → 增量更新为不提示
    updateWordDisplay('challenge', 'none', null, false);

    // span 保留以支持无视觉提示时的 hover/click 查询
    spans = document.querySelectorAll<HTMLSpanElement>('.avr-word[data-word="challenge"]');
    expect(spans.length).toBe(1);
    expect(spans[0]!.className).toBe('avr-word');
    // 文本内容保留
    expect(document.body.textContent).toContain('challenge');
  });

  it('标记不会（strong）→ 该词 span 升级为强提示', () => {
    // 先标注为轻提示
    const textNode = makeTextNode('hello world');
    const ann = makeAnnotation(0, 5, {
      word: 'hello',
      surfaceForm: 'hello',
      translation: '你好',
      decision: 'light',
      showInlineTranslation: false,
    });
    annotateTextNode(textNode, [ann], () => {});

    // 确认初始是轻提示
    let span = document.querySelector<HTMLSpanElement>('.avr-word[data-word="hello"]');
    expect(span?.classList.contains('avr-light')).toBe(true);

    // 标记不会 → 升级为强提示
    updateWordDisplay('hello', 'strong', '你好', true);

    span = document.querySelector<HTMLSpanElement>('.avr-word[data-word="hello"]');
    expect(span?.classList.contains('avr-light')).toBe(false);
    expect(span?.classList.contains('avr-strong-first')).toBe(true);
    // D-5 契约：该 span 标注时无 pos（data-pos 为空）→ 行内释义省略前缀，仅释义本体。
    expect(span?.dataset.translation).toBe('你好');
  });

  it('只更新指定词的 span，不影响其他词', () => {
    // 两个词都标注为轻提示
    const p = document.createElement('p');
    p.innerHTML = '';
    const textNode = document.createTextNode('hello world');
    p.appendChild(textNode);
    document.body.appendChild(p);

    const anns = [
      makeAnnotation(0, 5, { word: 'hello', surfaceForm: 'hello', translation: '你好', decision: 'light' }),
      makeAnnotation(6, 11, { word: 'world', surfaceForm: 'world', translation: '世界', decision: 'light' }),
    ];
    annotateTextNode(textNode, [anns[0]!, anns[1]!], () => {});

    // 只更新 hello
    updateWordDisplay('hello', 'strong', '你好', true);

    const helloSpan = document.querySelector<HTMLSpanElement>('.avr-word[data-word="hello"]');
    const worldSpan = document.querySelector<HTMLSpanElement>('.avr-word[data-word="world"]');
    expect(helloSpan?.classList.contains('avr-strong-first')).toBe(true);
    expect(worldSpan?.classList.contains('avr-light')).toBe(true); // world 不变
  });

  it('没有匹配 span 时不报错', () => {
    expect(() => updateWordDisplay('nonexistent', 'strong', 'x', true)).not.toThrow();
  });

  it('多次出现同一词时全部更新', () => {
    // "challenge and challenge" 两次出现
    const p = document.createElement('p');
    p.innerHTML = '';
    const textNode = document.createTextNode('challenge and challenge');
    p.appendChild(textNode);
    document.body.appendChild(p);

    // challenge@0..9  challenge@14..23
    const anns = [
      makeAnnotation(0, 9, { word: 'challenge', surfaceForm: 'challenge', translation: '挑战', decision: 'light' }),
      makeAnnotation(14, 23, { word: 'challenge', surfaceForm: 'challenge', translation: '挑战', decision: 'light' }),
    ];
    annotateTextNode(textNode, [anns[0]!, anns[1]!], () => {});

    // 确认有两个 span
    expect(document.querySelectorAll<HTMLSpanElement>('.avr-word[data-word="challenge"]').length).toBe(2);

    // 更新为强提示
    updateWordDisplay('challenge', 'strong', '挑战', true);

    const spans = document.querySelectorAll<HTMLSpanElement>('.avr-word[data-word="challenge"]');
    expect(spans.length).toBe(2);
    // 首个出现显示行内中文（strong-first），重复仅下划线（strong）
    expect(spans[0]!.classList.contains('avr-strong-first')).toBe(true);
    expect(spans[1]!.classList.contains('avr-strong')).toBe(true);
    expect(spans[1]!.classList.contains('avr-strong-first')).toBe(false);
  });

  // ============================================================
  // 回归：消费策略模块的 showInlineTranslation，不在标注层用 index===0 重算
  // 对应 code-review HARD#1 —— 最高 seam「只消费不重算」
  // ============================================================

  it('消费策略 showInlineTranslation：多出现且 false 时任何 span 都不显示行内中文（不依赖 index===0 重算）', () => {
    // "challenge and challenge" 两次出现
    const p = document.createElement('p');
    p.innerHTML = '';
    const textNode = document.createTextNode('challenge and challenge');
    p.appendChild(textNode);
    document.body.appendChild(p);

    // challenge@0..9  challenge@14..23 —— 初始均为轻提示
    const anns = [
      makeAnnotation(0, 9, { word: 'challenge', surfaceForm: 'challenge', translation: '挑战', decision: 'light' }),
      makeAnnotation(14, 23, { word: 'challenge', surfaceForm: 'challenge', translation: '挑战', decision: 'light' }),
    ];
    annotateTextNode(textNode, [anns[0]!, anns[1]!], () => {});
    expect(document.querySelectorAll<HTMLSpanElement>('.avr-word[data-word="challenge"]').length).toBe(2);

    // 策略判定不展示行内中文（showInlineTranslation=false）—— 即便首现也只下划线
    updateWordDisplay('challenge', 'strong', '挑战', false);

    const spans = document.querySelectorAll<HTMLSpanElement>('.avr-word[data-word="challenge"]');
    expect(spans.length).toBe(2);
    // 关键：不靠 index===0 重算「首现→行内中文」；策略说 false，就都不显示行内中文
    for (const span of spans) {
      expect(span.classList.contains('avr-strong-first')).toBe(false);
      expect(span.classList.contains('avr-strong')).toBe(true);
    }
  });
});

// ============================================================
// D-1 · METADATA_RESOLUTION_FAILURE 兜底（轻提示路径）
// 领域术语：元数据解析失败不是词汇状态，与 known/learning/unknown 正交。
// tooltip 在元数据缺失时显示固定兜底文案，不合成占位释义。
// ============================================================
describe('METADATA_RESOLUTION_FAILURE 兜底（D-1）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetAnnotatorState();
    initAnnotator();
  });

  it('兜底文案常量为「释义暂不可用」（DEC-3 中文优先）', () => {
    expect(METADATA_RESOLUTION_FAILURE_TEXT).toBe('释义暂不可用');
  });

  it('元数据全缺失 → tooltip 显示词头行 + 释义暂不可用，不触发状态动作', () => {
    const textNode = makeTextNode('Went home.');
    const actions: Array<[string, 'known' | 'learning']> = [];
    // 手工构造元数据缺失：phonetic / pos undefined，entry 缺 translation（null）
    const ann = makeAnnotation(0, 4, { decision: 'none', translation: null });
    const { spans } = annotateTextNode(textNode, [ann], (word, status) => actions.push([word, status]));

    spans[0]!.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    const tip = document.querySelector('.avr-tooltip');
    expect(tip).not.toBeNull();
    expect(tip!.classList.contains('avr-tooltip')).toBe(true);
    const lines = [...tip!.children].map((row) => row.textContent);
    // 词头行仍显示 surfaceForm；兜底行固定文案；不合成音标/词性/占位释义
    expect(lines).toEqual(['Went', '释义暂不可用']);
    expect(tip!.textContent).toContain('释义暂不可用');
    // 与未收录路径不得混淆
    expect(tip!.textContent).not.toContain('当前词典未收录');
    // 元数据失败不是词汇状态动作的入口
    expect(actions).toEqual([]);
    expect((document.querySelector('.avr-action-menu') as HTMLElement | null)?.style.display).not.toBe('flex');
  });

  it('部分元数据缺失 → 整体兜底（fail-closed），不显示残缺元数据', () => {
    const textNode = makeTextNode('Hello there.');
    const ann = {
      ...makeAnnotation(0, 5, { decision: 'light', translation: '你好' as string | null }),
      phonetic: 'partial-phonetic',
      // pos 缺失 → 属于元数据失败
    };
    const { spans } = annotateTextNode(textNode, [ann], () => {});

    spans[0]!.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    const tip = document.querySelector('.avr-tooltip');
    const lines = [...tip!.children].map((row) => row.textContent);
    expect(lines).toEqual(['Hello', '释义暂不可用']);
    // 不得只显示残缺的部分元数据（translation 有而 pos 缺时仍整体兜底）
    expect(tip!.textContent).not.toContain('你好');
    expect(tip!.textContent).not.toContain('partial-phonetic');
  });

  it('unresolved（未收录）路径优先于元数据兜底：仍显示 当前词典未收录', () => {
    const textNode = makeTextNode('Unlisted token.');
    const ann = { ...makeAnnotation(0, 8, { word: 'unlisted', decision: 'none', translation: null }), unresolved: true };
    const { spans } = annotateTextNode(textNode, [ann], () => {});

    spans[0]!.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    expect(document.querySelector('.avr-tooltip')?.textContent).toBe('当前词典未收录');
  });

  it('translation 缺失时无行内释义属性（fail-closed，不得合成占位释义）', () => {
    const textNode = makeTextNode('challenge');
    const ann = { ...makeAnnotation(0, 9, { decision: 'strong', showInlineTranslation: true, translation: null }), pos: 'n.' };
    const { spans } = annotateTextNode(textNode, [ann], () => {});

    expect(spans[0]!.classList.contains('avr-strong-first')).toBe(true);
    expect(spans[0]!.hasAttribute('data-translation')).toBe(false);
    expect(spans[0]!.hasAttribute('data-tooltip-translation')).toBe(false);
  });
});

// ============================================================
// D-5 · learning 行内释义格式：{posPrefix}{translation}
// ============================================================
describe('行内释义格式（D-5）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetAnnotatorState();
    initAnnotator();
  });

  it('annotateTextNode：pos 存在 → data-translation 为 "{pos} {translation}"（v. 去走 型）', () => {
    const textNode = makeTextNode('Went home.');
    const ann = { ...makeAnnotation(0, 4, { decision: 'strong', showInlineTranslation: true, translation: '去走' }), phonetic: "'went", pos: 'v.' };
    const { spans } = annotateTextNode(textNode, [ann], () => {});

    expect(spans[0]!.dataset.pos).toBe('v.');
    expect(spans[0]!.dataset.translation).toBe('v. 去走');
  });

  it('annotateTextNode：pos 缺失 → data-translation 仅释义，无前缀无前导空格', () => {
    const textNode = makeTextNode('Went home.');
    const ann = { ...makeAnnotation(0, 4, { decision: 'strong', showInlineTranslation: true, translation: '去走' }) };
    const { spans } = annotateTextNode(textNode, [ann], () => {});

    expect(spans[0]!.dataset.pos).toBe('');
    expect(spans[0]!.dataset.translation).toBe('去走');
  });

  it('updateWordDisplay：span 已有 data-pos → 拼接 pos 前缀', () => {
    const textNode = makeTextNode('challenge is here');
    const ann = { ...makeAnnotation(0, 9, { word: 'challenge', surfaceForm: 'challenge', decision: 'light', translation: '挑战' }), pos: 'n.' };
    annotateTextNode(textNode, [ann], () => {});

    updateWordDisplay('challenge', 'strong', '挑战', true);
    const span = document.querySelector<HTMLSpanElement>('.avr-word[data-word="challenge"]');
    expect(span?.dataset.pos).toBe('n.');
    expect(span?.dataset.translation).toBe('n. 挑战');
  });

  it('updateWordDisplay：span 无 data-pos → 仅释义（pos 缺失省略前缀，不得合成词性）', () => {
    const textNode = makeTextNode('challenge is here');
    const ann = makeAnnotation(0, 9, { word: 'challenge', surfaceForm: 'challenge', decision: 'light', translation: '挑战' });
    annotateTextNode(textNode, [ann], () => {});

    updateWordDisplay('challenge', 'strong', '挑战', true);
    const span = document.querySelector<HTMLSpanElement>('.avr-word[data-word="challenge"]');
    expect(span?.dataset.pos).toBe('');
    expect(span?.dataset.translation).toBe('挑战');
  });

  it('updateWordDisplay：translation 为 null → 移除 data-translation（行内释义省略）', () => {
    const textNode = makeTextNode('challenge is here');
    const ann = { ...makeAnnotation(0, 9, { word: 'challenge', surfaceForm: 'challenge', decision: 'strong', showInlineTranslation: true, translation: '挑战' }), pos: 'n.' };
    annotateTextNode(textNode, [ann], () => {});
    expect(document.querySelector<HTMLSpanElement>('.avr-word[data-word="challenge"]')?.dataset.translation).toBe('n. 挑战');

    updateWordDisplay('challenge', 'none', null, false);
    const span = document.querySelector<HTMLSpanElement>('.avr-word[data-word="challenge"]');
    expect(span?.hasAttribute('data-translation')).toBe(false);
  });
});

// ============================================================
// D-4 / D-6 · 样式常量：宿主排版隔离 + DEC-1 琥珀视觉族
// （以导出样式常量字符串断言，不改生产行为；真实 computed style 由 E2E AC-4/AC-8 覆盖）
// ============================================================

/** 从样式模板提取指定 selector 块的声明文本 */
function styleBlock(styles: string, selector: string): string {
  const start = styles.indexOf(selector);
  if (start < 0) throw new Error(`样式模板缺少 selector：${selector}`);
  const open = styles.indexOf('{', start);
  const close = styles.indexOf('}', open);
  if (open < 0 || close < 0) throw new Error(`样式块未闭合：${selector}`);
  return styles.slice(open + 1, close);
}

/** 解析 rgb/rgba 颜色的色相（0-360） */
function hueOf(color: string): number {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(color);
  if (!m) throw new Error(`非 rgb/rgba 颜色值：${color}`);
  const [r, g, b] = [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h: number;
  if (max === r) h = ((g - b) / d + 6) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

describe('样式常量（D-4 / D-6）', () => {
  it('不含旧红色系与旧灰色 hex（#e74c3c / #c0392b / #7f8c8d 全部移除）', () => {
    expect(ANNOTATOR_STYLES).not.toMatch(/#e74c3c|#c0392b|#7f8c8d/i);
  });

  it('light 为琥珀点线、strong/strong-first 为琥珀实线（DEC-1 强度区分保持）', () => {
    const light = styleBlock(ANNOTATOR_STYLES, '.avr-light {');
    expect(light).toContain('text-decoration-style: dotted');
    const lightHue = hueOf(/text-decoration-color:\s*([^;]+);/.exec(light)![1]!);
    expect(lightHue).toBeGreaterThanOrEqual(20);
    expect(lightHue).toBeLessThanOrEqual(50);

    for (const selector of ['.avr-strong {', '.avr-strong-first {']) {
      const block = styleBlock(ANNOTATOR_STYLES, selector);
      expect(block).toContain('text-decoration: underline');
      expect(block).not.toContain('dotted');
      const hue = hueOf(/text-decoration-color:\s*([^;]+);/.exec(block)![1]!);
      expect(hue).toBeGreaterThanOrEqual(20);
      expect(hue).toBeLessThanOrEqual(50);
    }
  });

  it('.avr-word 声明宿主排版隔离 inherit !important 族，且保留 text-decoration 下划线机制', () => {
    const block = styleBlock(ANNOTATOR_STYLES, '.avr-word {');
    for (const prop of ['font-family', 'font-size', 'font-weight', 'color', 'line-height', 'letter-spacing']) {
      expect(block).toContain(`${prop}: inherit !important`);
    }
    // P-5：下划线仍由 text-decoration 机制承载（零布局位移），不得改为其他机制
    expect(block).toContain('text-decoration: none');
    // 下划线承载属性未被破坏：变体块仍用 text-decoration-color/thickness 表达
    expect(ANNOTATOR_STYLES).toContain('text-decoration-thickness');
  });

  it('行内释义样式：琥珀棕斜体、11-12px、line-height:1、0.35em 间距、user-select:none', () => {
    const block = styleBlock(ANNOTATOR_STYLES, '.avr-strong-first::after');
    expect(block).toContain('content: attr(data-translation)');
    expect(block).toContain('font-style: italic');
    expect(block).toContain('line-height: 1');
    expect(block).toContain('margin-left: 0.35em');
    expect(block).toContain('user-select: none');
    const size = /font-size:\s*([\d.]+)px/.exec(block)!;
    expect(Number(size[1])).toBeGreaterThanOrEqual(11);
    expect(Number(size[1])).toBeLessThanOrEqual(12);
    const hue = hueOf(/(?<!text-decoration-)color:\s*([^;]+);/.exec(block)![1]!);
    expect(hue).toBeGreaterThanOrEqual(20);
    expect(hue).toBeLessThanOrEqual(50);
  });

  it('.avr-strong（重复出现）无 ::after 行内释义规则（P-4 首现契约）', () => {
    // .avr-strong 块自身不带 ::after content 规则；仅 .avr-strong-first::after 消费 data-translation
    expect(ANNOTATOR_STYLES.match(/\.avr-strong\s*\{[^}]*::after/)).toBeNull();
    expect(styleBlock(ANNOTATOR_STYLES, '.avr-strong-first::after')).toContain('content: attr(data-translation)');
  });
});
