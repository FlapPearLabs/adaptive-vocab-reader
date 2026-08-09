// ============================================================
// DOM 标注器 —— 将策略决策应用到页面上
// ============================================================
// 核心规则：
// - annotateTextNode 用词在文本节点中的精确位置切分，保留原文大小写
// - updateWordDisplay 增量更新已有 span，不做全页重扫
// ============================================================

import type { DisplayResult, DisplayDecision } from '../shared/types';

const EXTENSION_CLASS = 'avr-word';

/** 单个词的标注信息：策略决策 + 在文本节点中的精确位置 */
export interface WordAnnotation {
  /** 策略模块的展示决策 */
  result: DisplayResult;
  /** wordKey 对应 core 词条的音标（仅运行时 DOM 展示） */
  phonetic?: string;
  /** wordKey 对应 core 词条的词性（仅运行时 DOM 展示） */
  pos?: string;
  /** 该词原始文本在文本节点中的起始位置 */
  startIndex: number;
  /** 该词原始文本在文本节点中的结束位置（不包含） */
  endIndex: number;
}

/** annotateTextNode 的真实 DOM 节点统计（用于性能观测 netNodes） */
export interface AnnotateResult {
  /** 创建的标注 span（data-word） */
  spans: HTMLSpanElement[];
  /** 实际新增到 DOM 的节点数（新增文本碎片 + span） */
  added: number;
  /** 被替换掉的原始文本节点数（通常为 1） */
  removed: number;
}

/** updateWordDisplay 的真实 DOM 节点统计 */
export interface UpdateResult {
  /** 新增节点数（还原为纯文本时 = 被还原的 span 数） */
  added: number;
  /** 移除节点数（被替换的 span / 被替换的原文节点） */
  removed: number;
}

/** CSS 样式注入（仅注入一次） */
let styleRoots = new WeakSet<Document | ShadowRoot>();

function injectStyles(root: Document | ShadowRoot = document): void {
  if (styleRoots.has(root)) return;
  styleRoots.add(root);

  const style = document.createElement('style');
  style.textContent = `
    .avr-strong {
      text-decoration: underline;
      text-decoration-color: #e74c3c;
      text-decoration-thickness: 2px;
      cursor: pointer;
    }
    .avr-strong-first {
      text-decoration: underline;
      text-decoration-color: #e74c3c;
      text-decoration-thickness: 2px;
      cursor: pointer;
    }
    .avr-strong-first::after {
      content: attr(data-translation);
      display: inline;
      color: #c0392b;
      font-size: 0.85em;
      margin-left: 2px;
      vertical-align: super;
    }
    .avr-light {
      text-decoration: underline;
      text-decoration-style: dotted;
      text-decoration-color: #7f8c8d;
      text-decoration-thickness: 1px;
      cursor: pointer;
    }
    .avr-tooltip {
      position: fixed;
      z-index: 2147483647;
      background: #2c3e50;
      color: #ecf0f1;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 13px;
      line-height: 1.4;
      max-width: 280px;
      pointer-events: none;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .avr-action-menu {
      position: fixed;
      z-index: 2147483647;
      gap: 4px;
      padding: 4px;
      border-radius: 6px;
      background: #fff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    }
    .avr-action-menu button {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      background: #fff;
      color: #1e293b;
      cursor: pointer;
      padding: 2px 6px;
    }
    .avr-selection-action {
      position: fixed;
      z-index: 2147483647;
      border: 1px solid #2563eb;
      border-radius: 6px;
      background: #2563eb;
      color: #fff;
      cursor: pointer;
      padding: 5px 8px;
      font-size: 13px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    }
  `;
  const styleParent = (root as Document).head ?? root;
  styleParent.appendChild(style);
}

/** 全局共享的提示浮层 */
let tooltipEl: HTMLDivElement | null = null;
let actionMenuEl: HTMLDivElement | null = null;
let handlersInstalled = false;
let actionHandler: ((word: string, newStatus: 'known' | 'learning') => void) | null = null;
let handlersAbortController: AbortController | null = null;
const spansByWord = new Map<string, Set<HTMLSpanElement>>();

function getTooltip(): HTMLDivElement {
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'avr-tooltip';
    tooltipEl.style.display = 'none';
    document.body.appendChild(tooltipEl);
  }
  return tooltipEl;
}

export function calculateTooltipPosition(
  target: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom'>,
  tip: Pick<DOMRect, 'width' | 'height'>,
  viewportWidth: number,
  viewportHeight: number,
  safeTop = 8,
): { left: number; top: number } {
  const margin = 8;
  const left = Math.max(margin, Math.min(target.left, viewportWidth - tip.width - margin));
  const above = target.top - tip.height - margin;
  const top = above >= safeTop
    ? above
    : Math.min(viewportHeight - tip.height - margin, target.bottom + margin);
  return { left, top: Math.max(safeTop, top) };
}

function topSafeInset(): number {
  let safeTop = 8;
  for (const el of document.querySelectorAll<HTMLElement>('header, [data-avr-safe-top]')) {
    const style = getComputedStyle(el);
    if (style.position !== 'sticky' && style.position !== 'fixed') continue;
    const rect = el.getBoundingClientRect();
    if (rect.top <= safeTop && rect.bottom > safeTop) safeTop = rect.bottom + 8;
  }
  return safeTop;
}

function positionTooltip(tip: HTMLDivElement, target: DOMRect): void {
  tip.style.display = 'block';
  const rect = tip.getBoundingClientRect();
  const position = calculateTooltipPosition(target, rect, window.innerWidth, window.innerHeight, topSafeInset());
  tip.style.left = `${position.left}px`;
  tip.style.top = `${position.top}px`;
}

function showTooltip(surfaceForm: string, phonetic: string, pos: string, translation: string, target: DOMRect): void {
  const tip = getTooltip();
  tip.replaceChildren(
    ...[surfaceForm, phonetic, pos, translation].map((line) => {
      const row = document.createElement('div');
      row.textContent = line;
      return row;
    }),
  );
  positionTooltip(tip, target);
}

function hideTooltip(): void {
  const tip = getTooltip();
  tip.style.display = 'none';
}

function getActionMenu(): HTMLDivElement {
  if (!actionMenuEl) {
    const menu = document.createElement('div');
    menu.className = 'avr-action-menu';
    menu.innerHTML = '<button type="button" data-avr-status="known">会</button><button type="button" data-avr-status="learning">不会</button>';
    menu.style.display = 'none';
    document.body.appendChild(menu);
    actionMenuEl = menu;
  }
  return actionMenuEl;
}

export function hideAnnotationActionMenu(): void {
  if (actionMenuEl) actionMenuEl.style.display = 'none';
}

function wordElementFromEvent(event: Event): HTMLElement | null {
  for (const node of event.composedPath()) {
    if (node instanceof HTMLElement && node.classList.contains(EXTENSION_CLASS)) return node;
  }
  return null;
}

function installDelegatedHandlers(onAction: (word: string, newStatus: 'known' | 'learning') => void): void {
  actionHandler = onAction;
  if (handlersInstalled) return;
  handlersInstalled = true;
  handlersAbortController = new AbortController();
  const listenerOptions = { signal: handlersAbortController.signal };

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>('.avr-action-menu button[data-avr-status]');
    if (button) {
      const word = actionMenuEl?.dataset.word;
      const status = button.dataset.avrStatus as 'known' | 'learning' | undefined;
      if (word && status) actionHandler?.(word, status);
      hideAnnotationActionMenu();
      return;
    }

    const wordEl = wordElementFromEvent(event);
    if (!wordEl) {
      hideAnnotationActionMenu();
      return;
    }

    event.preventDefault();
    const word = wordEl.dataset.word;
    if (!word) return;
    const menu = getActionMenu();
    menu.dataset.word = word;
    const rect = wordEl.getBoundingClientRect();
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.display = 'flex';
  }, listenerOptions);

  document.addEventListener('pointerover', (event) => {
    const wordEl = wordElementFromEvent(event);
    if (!wordEl) return;
    const rect = wordEl.getBoundingClientRect();
    const translation = wordEl.dataset.tooltipTranslation;
    const phonetic = wordEl.dataset.phonetic;
    const pos = wordEl.dataset.pos;
    if (!translation || !phonetic || !pos) return;
    showTooltip(wordEl.textContent || '', phonetic, pos, translation, rect);
  }, listenerOptions);

  document.addEventListener('pointerout', (event) => {
    const from = wordElementFromEvent(event);
    const related = event.relatedTarget as HTMLElement | null;
    const to = related?.closest?.(`.${EXTENSION_CLASS}`) as HTMLElement | null | undefined;
    if (from && from !== to) hideTooltip();
  }, listenerOptions);
}

/** 根据 decision 决定 CSS 类名 */
function classForDecision(decision: DisplayDecision, showInlineTranslation: boolean): string {
  if (decision === 'strong') {
    return showInlineTranslation ? 'avr-strong-first' : 'avr-strong';
  }
  return decision === 'light' ? 'avr-light' : '';
}

/**
 * 对单个文本节点应用标注。
 * 使用每个词在文本中的精确位置（startIndex/endIndex）切分，
 * 保留原文大小写；不再用 indexOf(surfaceForm) 查找。
 */
export function annotateTextNode(
  textNode: Text,
  annotations: WordAnnotation[],
  onClick: (word: string, newStatus: 'known' | 'learning') => void,
  generatedNodes?: WeakSet<Node>,
): AnnotateResult {
  if (annotations.length === 0) return { spans: [], added: 0, removed: 0 };

  const text = textNode.textContent || '';

  // 所有 query-eligible 词都保留透明交互 span；decision 仅决定视觉样式。
  const sorted = annotations
    .filter((a) => a.startIndex >= 0 && a.endIndex <= text.length && a.startIndex < a.endIndex)
    .sort((a, b) => a.startIndex - b.startIndex);

  if (sorted.length === 0) return { spans: [], added: 0, removed: 0 };

  type Fragment = string | { result: DisplayResult; rawText: string; phonetic?: string; pos?: string };
  const fragments: Fragment[] = [];
  let lastEnd = 0;

  for (const ann of sorted) {
    // 跳过与前一个重叠的词
    if (ann.startIndex < lastEnd) continue;

    // 添加前面的纯文本
    if (ann.startIndex > lastEnd) {
      fragments.push(text.slice(lastEnd, ann.startIndex));
    }

    fragments.push({
      result: ann.result,
      rawText: text.slice(ann.startIndex, ann.endIndex),
      phonetic: ann.phonetic,
      pos: ann.pos,
    });
    lastEnd = ann.endIndex;
  }

  // 添加剩余文本
  if (lastEnd < text.length) {
    fragments.push(text.slice(lastEnd));
  }

  const hasAnnotations = fragments.some((f) => typeof f !== 'string');
  if (!hasAnnotations) return { spans: [], added: 0, removed: 0 };

  installDelegatedHandlers(onClick);

  const spans: HTMLSpanElement[] = [];
  const container = document.createDocumentFragment();

  for (const frag of fragments) {
    if (typeof frag === 'string') {
      const tn = document.createTextNode(frag);
      if (generatedNodes) generatedNodes.add(tn);
      container.appendChild(tn);
    } else {
      const span = document.createElement('span');
      span.className = [EXTENSION_CLASS, classForDecision(frag.result.decision, frag.result.showInlineTranslation)].filter(Boolean).join(' ');
      span.textContent = frag.rawText; // 保留原文大小写
      if (frag.result.translation) {
        span.setAttribute('data-translation', `【${frag.result.translation}】`);
        span.setAttribute('data-tooltip-translation', frag.result.translation);
      }
      span.setAttribute('data-phonetic', frag.phonetic ?? '');
      span.setAttribute('data-pos', frag.pos ?? '');
      span.setAttribute('data-word', frag.result.word);
      const wordSpans = spansByWord.get(frag.result.word) ?? new Set<HTMLSpanElement>();
      wordSpans.add(span);
      spansByWord.set(frag.result.word, wordSpans);
      container.appendChild(span);
      spans.push(span);
      if (generatedNodes) generatedNodes.add(span);
    }
  }

  // 替换原文本节点：实际新增节点数 = fragments.length（文本碎片 + span），被移除 = 原文本节点 1 个
  textNode.parentNode?.replaceChild(container, textNode);
  return { spans, added: fragments.length, removed: 1 };
}

/**
 * 增量更新某个词在当前页面已有 span 的显示。
 * 不做全页重扫——只更新 data-word 匹配的 span。
 *
 * - decision='none'：把 span 还原为纯文本节点（移除标注）
 * - decision='strong'：第一个 span 用 strong-first（行内中文），其余用 strong（仅下划线）
 * - decision='light'：所有 span 用 avr-light（悬停查看）
 *
 * 规格：不会词同页首次显示下划线+行内中文，重复仅保留下划线。
 */
export function updateWordDisplay(
  word: string,
  decision: DisplayDecision,
  translation: string | null,
  showInlineTranslation: boolean,
  generatedNodes?: WeakSet<Node>,
): UpdateResult {
  const spans = [...(spansByWord.get(word) ?? document.querySelectorAll<HTMLSpanElement>(`.${EXTENSION_CLASS}[data-word="${word}"]`))]
    .filter((span) => span.isConnected);

  spans.forEach((span, index) => {
    // 清除旧的提示类，保留 avr-word
    span.classList.remove('avr-strong', 'avr-strong-first', 'avr-light');
    if (decision === 'strong') {
      // 消费策略模块已算好的展示决策（showInlineTranslation），不在标注层用 index===0 重算。
      // index===0 仅用于定位「同页首现的 span 位置」，行内中文的开关由策略的布尔决定。
      const showInline = index === 0 && showInlineTranslation;
      span.classList.add(showInline ? 'avr-strong-first' : 'avr-strong');
    } else if (decision === 'light') {
      span.classList.add('avr-light');
    }
    if (translation) {
      span.setAttribute('data-translation', `【${translation}】`);
    } else {
      span.removeAttribute('data-translation');
    }
  });
  return { added: 0, removed: 0 };
}

/**
 * 初始化标注器（注入样式）
 */
export function initAnnotator(root: Document | ShadowRoot = document): void {
  injectStyles(root);
}

/** 重置全局状态（仅供测试使用） */
export function resetAnnotatorState(): void {
  styleRoots = new WeakSet<Document | ShadowRoot>();
  tooltipEl = null;
  actionMenuEl = null;
  handlersAbortController?.abort();
  handlersAbortController = null;
  spansByWord.clear();
  handlersInstalled = false;
  actionHandler = null;
}
