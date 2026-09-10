// ============================================================
// DOM 标注器 —— 将策略决策应用到页面上
// ============================================================
// 核心规则：
// - annotateTextNode 用词在文本节点中的精确位置切分，保留原文大小写
// - updateWordDisplay 增量更新已有 span，不做全页重扫
// ============================================================

import type { DisplayResult, DisplayDecision } from '../shared/types';

const EXTENSION_CLASS = 'avr-word';

/** 元数据（音标/词性/释义）解析失败时，检查浮层对应行的固定兜底文案（DEC-3 中文优先；不合成占位释义） */
export const METADATA_FALLBACK_TEXT = '释义暂不可用';

/** 检查浮层的视口安全边距（左右 12px 夹取；UX §4.2.2） */
const POPOVER_VIEWPORT_MARGIN = 12;

/** 单个词的标注信息：策略决策 + 在文本节点中的精确位置 */
export interface WordAnnotation {
  /** 策略模块的展示决策 */
  result: DisplayResult;
  /** wordKey 对应 core 词条的音标（仅运行时 DOM 展示） */
  phonetic?: string;
  /** wordKey 对应 core 词条的词性（仅运行时 DOM 展示） */
  pos?: string;
  /** 查询词典未收录：仅提供固定响应，不允许状态动作。 */
  unresolved?: boolean;
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

/** updateWordDisplay 的真实 DOM 节点统计（透明 span 只更新样式，不产生节点变化） */
export interface UpdateResult {
  /** 新增节点数 */
  added: number;
  /** 移除节点数 */
  removed: number;
}

/** CSS 样式注入（仅注入一次） */
let styleRoots = new WeakSet<Document | ShadowRoot>();

function injectStyles(root: Document | ShadowRoot = document): void {
  if (styleRoots.has(root)) return;
  styleRoots.add(root);

  const style = document.createElement('style');
  style.textContent = `
    .avr-word {
      border: 0;
      background: transparent;
      text-decoration: none;
      color: inherit;
    }
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
      flex-direction: column;
      gap: 6px;
      padding: 10px 12px;
      border-radius: 6px;
      background: #fff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      max-width: 260px;
      font-size: 12px;
      line-height: 1.4;
      color: #1e293b;
    }
    .avr-inspect-word {
      font-weight: 600;
      font-size: 14px;
      color: #1c1917;
    }
    .avr-inspect-phonetic {
      font-family: ui-monospace, monospace;
      font-size: 11px;
      color: #78716c;
    }
    .avr-inspect-pos {
      font-style: italic;
      font-size: 11px;
      color: #a8a29e;
    }
    .avr-inspect-translation {
      color: #292524;
    }
    .avr-inspect-actions {
      display: flex;
      gap: 4px;
    }
    .avr-action-menu button {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      background: #fff;
      color: #1e293b;
      cursor: pointer;
      padding: 2px 6px;
      white-space: nowrap;
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
  margin = 8,
): { left: number; top: number } {
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
    menu.style.display = 'none';
    document.body.appendChild(menu);
    actionMenuEl = menu;
  }
  return actionMenuEl;
}

export function hideAnnotationActionMenu(): void {
  if (actionMenuEl) actionMenuEl.style.display = 'none';
}

/** 元数据缺失或为空时使用固定兜底文案；有值时按原值展示。 */
function metadataOrFallback(value: string | undefined): string {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : METADATA_FALLBACK_TEXT;
}

function popoverRow(className: string, text: string): HTMLDivElement {
  const row = document.createElement('div');
  row.className = className;
  row.textContent = text;
  return row;
}

/**
 * 打开 Word Inspection Popover（D-2）：词头（页面实际词形，保留原文大小写）+
 * phonetic/pos/translation（来自词 span 的 dataset；缺失时对应行显示「释义暂不可用」）+
 * 「会/不会」显式动作。容器类 avr-action-menu 与 button[data-avr-status] 为既有 E2E DOM 合同。
 * 几何：先渲染（display 后测量自身尺寸）再经唯一几何 seam calculateTooltipPosition 定位
 * （上方优先 / 不足下翻 / 左右 12px 夹取 / 不遮挡目标词）。仅内存渲染，零状态写入。
 */
function showInspectionPopover(wordEl: HTMLElement, target: DOMRect): void {
  const word = wordEl.dataset.word;
  if (!word) return;
  const menu = getActionMenu();

  const knownButton = document.createElement('button');
  knownButton.type = 'button';
  knownButton.dataset.avrStatus = 'known';
  knownButton.textContent = '会';
  const learningButton = document.createElement('button');
  learningButton.type = 'button';
  learningButton.dataset.avrStatus = 'learning';
  learningButton.textContent = '不会';
  const actions = document.createElement('div');
  actions.className = 'avr-inspect-actions';
  actions.append(knownButton, learningButton);

  menu.replaceChildren(
    popoverRow('avr-inspect-word', wordEl.textContent || ''),
    popoverRow('avr-inspect-phonetic', metadataOrFallback(wordEl.dataset.phonetic)),
    popoverRow('avr-inspect-pos', metadataOrFallback(wordEl.dataset.pos)),
    // 释义取 data-tooltip-translation（纯释义值）；data-translation 是带【】的行内展示值，不用于浮层。
    popoverRow('avr-inspect-translation', metadataOrFallback(wordEl.dataset.tooltipTranslation)),
    actions,
  );
  menu.dataset.word = word;

  // 先渲染再测量浮层自身尺寸，经既有 seam 计算位置；浮层 12px 视口边距经 margin 参数实现（缺省仍 8）。
  menu.style.display = 'flex';
  const rect = menu.getBoundingClientRect();
  const position = calculateTooltipPosition(target, rect, window.innerWidth, window.innerHeight, topSafeInset(), POPOVER_VIEWPORT_MARGIN);
  menu.style.left = `${position.left}px`;
  menu.style.top = `${position.top}px`;
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
      // 浮层 bounding box 内的非按钮区域点击不构成外部点击：不关闭、不写状态（UX §4.2.4）。
      if (actionMenuEl && event.target instanceof Node && actionMenuEl.contains(event.target)) return;
      hideAnnotationActionMenu();
      return;
    }

    event.preventDefault();
    if (wordEl.dataset.unresolved === 'true') {
      showUnresolvedTooltip(wordEl.getBoundingClientRect());
      return;
    }
    showInspectionPopover(wordEl, wordEl.getBoundingClientRect());
  }, listenerOptions);

  // D-3：Esc 关闭浮层——纯取消路径，零状态写入。
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    hideAnnotationActionMenu();
  }, listenerOptions);

  // 滚动同步（UX §4.2.2 允许 Dismiss 或 adjust；此处采用 Dismiss）：视口滚动即关闭浮层，
  // 不重算位置、零状态写入；用户重新点击目标词即以滚动后的几何重新打开。
  document.addEventListener('scroll', () => {
    hideAnnotationActionMenu();
  }, { capture: true, ...listenerOptions });

  document.addEventListener('pointerover', (event) => {
    const wordEl = wordElementFromEvent(event);
    if (!wordEl) return;
    const rect = wordEl.getBoundingClientRect();
    if (wordEl.dataset.unresolved === 'true') {
      showUnresolvedTooltip(rect);
      return;
    }
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

function showUnresolvedTooltip(target: DOMRect): void {
  const tip = getTooltip();
  tip.textContent = '当前词典未收录';
  positionTooltip(tip, target);
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

  type Fragment = string | { result: DisplayResult; rawText: string; phonetic?: string; pos?: string; unresolved?: boolean };
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
      unresolved: ann.unresolved,
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
      if (frag.unresolved) span.dataset.unresolved = 'true';
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
 * - decision='none'：保留透明 span，仅移除视觉样式
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
  const registered = spansByWord.get(word);
  const spans = [...(registered ?? document.querySelectorAll<HTMLSpanElement>(`.${EXTENSION_CLASS}[data-word="${word}"]`))]
    .filter((span) => span.isConnected);
  if (registered) {
    registered.clear();
    spans.forEach((span) => registered.add(span));
    if (registered.size === 0) spansByWord.delete(word);
  }

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
