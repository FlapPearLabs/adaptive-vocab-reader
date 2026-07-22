// ============================================================
// DOM 标注器 —— 将策略决策应用到页面上
// ============================================================

import type { DisplayResult } from '../shared/types';

const EXTENSION_CLASS = 'avr-word';

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

/**
 * 对单个文本节点应用标注。
 * 返回创建的 span 元素列表。
 */
export function annotateTextNode(
  textNode: Text,
  results: DisplayResult[],
  onClick: (word: string, newStatus: 'known' | 'learning') => void,
): HTMLSpanElement[] {
  if (results.length === 0) return [];

  // 按词的位置排序
  const sorted = [...results].sort((a, b) => {
    // surfaceForm 在 textNode 中的位置（简单查找）
    const text = textNode.textContent || '';
    return text.indexOf(a.surfaceForm) - text.indexOf(b.surfaceForm);
  });

  const text = textNode.textContent || '';
  installDelegatedHandlers(onClick);
  const fragments: (string | { html: string; word: string; translation: string | null; cssClass: string; showInlineTranslation: boolean })[] = [];
  let lastEnd = 0;

  for (const result of sorted) {
    // 跳过不提示的词
    if (result.decision === 'none') continue;

    const form = result.surfaceForm;
    const idx = text.indexOf(form, lastEnd);
    if (idx === -1) continue; // 词形不在文本中（可能被其他匹配消费）

    // 添加前面的纯文本
    if (idx > lastEnd) {
      fragments.push(text.slice(lastEnd, idx));
    }

    const isStrong = result.decision === 'strong';
    const cssClass = isStrong
      ? (result.showInlineTranslation ? 'avr-strong-first' : 'avr-strong')
      : 'avr-light';

    fragments.push({
      html: form,
      word: result.word,
      translation: result.translation,
      cssClass,
      showInlineTranslation: result.showInlineTranslation,
    });

    lastEnd = idx + form.length;
  }

  // 添加剩余文本
  if (lastEnd < text.length) {
    fragments.push(text.slice(lastEnd));
  }

  // 如果没有任何标注，返回空
  const hasAnnotations = fragments.some((f) => typeof f !== 'string');
  if (!hasAnnotations) return [];

  // 创建新的 DOM 片段
  const spans: HTMLSpanElement[] = [];
  const container = document.createDocumentFragment();

  for (const frag of fragments) {
    if (typeof frag === 'string') {
      container.appendChild(document.createTextNode(frag));
    } else {
      const span = document.createElement('span');
      span.className = `${EXTENSION_CLASS} ${frag.cssClass}`;
      span.textContent = frag.html;
      if (frag.translation) {
        span.setAttribute('data-translation', `【${frag.translation}】`);
      }
      span.setAttribute('data-word', frag.word);

      container.appendChild(span);
      spans.push(span);
    }
  }

  // 替换原文本节点
  textNode.parentNode?.replaceChild(container, textNode);

  return spans;
}

/**
 * 初始化标注器（注入样式）
 */
export function initAnnotator(): void {
  injectStyles();
}
