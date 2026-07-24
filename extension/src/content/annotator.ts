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
  /** 该词原始文本在文本节点中的起始位置 */
  startIndex: number;
  /** 该词原始文本在文本节点中的结束位置（不包含） */
  endIndex: number;
}

/** CSS 样式注入（仅注入一次） */
let styleInjected = false;

function injectStyles(): void {
  if (styleInjected) return;
  styleInjected = true;

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
  `;
  document.head.appendChild(style);
}

/** 全局共享的提示浮层 */
let tooltipEl: HTMLDivElement | null = null;
let actionMenuEl: HTMLDivElement | null = null;
let handlersInstalled = false;
let actionHandler: ((word: string, newStatus: 'known' | 'learning') => void) | null = null;

function getTooltip(): HTMLDivElement {
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'avr-tooltip';
    tooltipEl.style.display = 'none';
    document.body.appendChild(tooltipEl);
  }
  return tooltipEl;
}

function showTooltip(text: string, x: number, y: number): void {
  const tip = getTooltip();
  tip.textContent = text;
  tip.style.display = 'block';
  tip.style.left = `${x}px`;
  tip.style.top = `${y - 8}px`;
  // 保持在视口内
  const rect = tip.getBoundingClientRect();
  if (rect.bottom > window.innerHeight) {
    tip.style.top = `${y - rect.height - 4}px`;
  }
  if (rect.right > window.innerWidth) {
    tip.style.left = `${window.innerWidth - rect.width - 8}px`;
  }
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

function hideActionMenu(): void {
  if (actionMenuEl) actionMenuEl.style.display = 'none';
}

function installDelegatedHandlers(onAction: (word: string, newStatus: 'known' | 'learning') => void): void {
  actionHandler = onAction;
  if (handlersInstalled) return;
  handlersInstalled = true;

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>('.avr-action-menu button[data-avr-status]');
    if (button) {
      const word = actionMenuEl?.dataset.word;
      const status = button.dataset.avrStatus as 'known' | 'learning' | undefined;
      if (word && status) actionHandler?.(word, status);
      hideActionMenu();
      return;
    }

    const wordEl = target.closest<HTMLElement>(`.${EXTENSION_CLASS}`);
    if (!wordEl) {
      hideActionMenu();
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
  });

  document.addEventListener('pointerover', (event) => {
    const wordEl = (event.target as HTMLElement).closest<HTMLElement>(`.${EXTENSION_CLASS}`);
    if (!wordEl) return;
    const translation = wordEl.dataset.translation;
    if (!translation) return;
    const rect = wordEl.getBoundingClientRect();
    showTooltip(translation, rect.left, rect.top);
  });

  document.addEventListener('pointerout', (event) => {
    const from = (event.target as HTMLElement).closest<HTMLElement>(`.${EXTENSION_CLASS}`);
    const related = event.relatedTarget as HTMLElement | null;
    const to = related?.closest?.(`.${EXTENSION_CLASS}`) as HTMLElement | null | undefined;
    if (from && from !== to) hideTooltip();
  });
}

/** 根据 decision 决定 CSS 类名 */
function classForDecision(decision: DisplayDecision, showInlineTranslation: boolean): string {
  if (decision === 'strong') {
    return showInlineTranslation ? 'avr-strong-first' : 'avr-strong';
  }
  return 'avr-light';
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
): HTMLSpanElement[] {
  if (annotations.length === 0) return [];

  const text = textNode.textContent || '';

  // 只保留需要标注（decision !== 'none'）且位置合法的项，按 startIndex 排序
  const sorted = annotations
    .filter((a) => a.result.decision !== 'none' && a.startIndex >= 0 && a.endIndex <= text.length && a.startIndex < a.endIndex)
    .sort((a, b) => a.startIndex - b.startIndex);

  if (sorted.length === 0) return [];

  type Fragment = string | { result: DisplayResult; rawText: string };
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
    });
    lastEnd = ann.endIndex;
  }

  // 添加剩余文本
  if (lastEnd < text.length) {
    fragments.push(text.slice(lastEnd));
  }

  const hasAnnotations = fragments.some((f) => typeof f !== 'string');
  if (!hasAnnotations) return [];

  installDelegatedHandlers(onClick);

  const spans: HTMLSpanElement[] = [];
  const container = document.createDocumentFragment();

  for (const frag of fragments) {
    if (typeof frag === 'string') {
      container.appendChild(document.createTextNode(frag));
    } else {
      const span = document.createElement('span');
      span.className = `${EXTENSION_CLASS} ${classForDecision(frag.result.decision, frag.result.showInlineTranslation)}`;
      span.textContent = frag.rawText; // 保留原文大小写
      if (frag.result.translation) {
        span.setAttribute('data-translation', `【${frag.result.translation}】`);
      }
      span.setAttribute('data-word', frag.result.word);
      container.appendChild(span);
      spans.push(span);
    }
  }

  textNode.parentNode?.replaceChild(container, textNode);
  return spans;
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
  _showInlineTranslation: boolean,
): void {
  const spans = document.querySelectorAll<HTMLSpanElement>(`.${EXTENSION_CLASS}[data-word="${word}"]`);

  if (decision === 'none') {
    // 还原为纯文本节点
    spans.forEach((span) => {
      const text = span.textContent || '';
      const textNode = document.createTextNode(text);
      span.parentNode?.replaceChild(textNode, span);
    });
    return;
  }

  spans.forEach((span, index) => {
    // 清除旧的提示类，保留 avr-word
    span.classList.remove('avr-strong', 'avr-strong-first', 'avr-light');
    if (decision === 'strong') {
      // 同页首次出现显示行内中文，重复仅下划线
      span.classList.add(index === 0 ? 'avr-strong-first' : 'avr-strong');
    } else {
      span.classList.add('avr-light');
    }
    if (translation) {
      span.setAttribute('data-translation', `【${translation}】`);
    } else {
      span.removeAttribute('data-translation');
    }
  });
}

/**
 * 初始化标注器（注入样式）
 */
export function initAnnotator(): void {
  injectStyles();
}

/** 重置全局状态（仅供测试使用） */
export function resetAnnotatorState(): void {
  styleInjected = false;
  tooltipEl = null;
  actionMenuEl = null;
  handlersInstalled = false;
  actionHandler = null;
}
