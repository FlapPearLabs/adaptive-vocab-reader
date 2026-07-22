// ============================================================
// 页面扫描器 —— 从 DOM 中提取英文单词
// ============================================================

/**
 * 归一化后的单词在文本中的位置与原文
 */
export interface WordOccurrence {
  /** 归一化后的单词（小写，去标点） */
  word: string;
  /** 归一化前缀在原文中的起始位置 */
  startIndex: number;
  /** 归一化前缀在原文中的结束位置（不包含） */
  endIndex: number;
}

/** 应跳过的非正文元素标签名（大写） */
const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE',
  'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON',
  'NAV', 'HEADER', 'FOOTER', 'ASIDE',
  'SVG', 'MATH', 'CANVAS', 'IFRAME',
  'TEMPLATE', 'NOSCRIPT',
]);

/** 扩展自身的标记类名 */
const EXTENSION_CLASS = 'avr-word';
const SKIP_SELECTOR = [
  'script', 'style', 'noscript', 'code', 'pre', 'input', 'textarea', 'select', 'button',
  'nav', 'header', 'footer', 'aside', 'svg', 'math', 'canvas', 'iframe', 'template',
  `.${EXTENSION_CLASS}`, '.avr-action-menu',
  '[data-avr-skip]', '.comment', '.comments', '.comment-section', '[role="comment"]',
].join(',');

/** 单词匹配正则：英文单词（含内部连字符和撇号） */
const WORD_RE = /[a-zA-Z]+(?:[''-][a-zA-Z]+)*/g;

/**
 * 归一化单词：去标点、转小写、去尾部撇号+s
 */
export function normalizeWord(raw: string): string | null {
  let word = raw.toLowerCase().replace(/^["'([{\u201c\u2018]+|["')\]}\u201d\u2019.,;:!?]+$/g, '');
  // 去除尾部 's 或 s'
  word = word.replace(/(?:'s|s')$/, '');
  // 纯数字或空字符串 → 过滤
  if (!word || /^\d+$/.test(word)) return null;
  // 太短（单字母）——保留但可能是有效词
  return word;
}

/**
 * 从纯文本中提取所有英文单词及其位置
 */
export function extractWordsFromText(text: string): WordOccurrence[] {
  const results: WordOccurrence[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(WORD_RE.source, 'g');
  while ((match = re.exec(text)) !== null) {
    const raw = match[0];
    const normalized = normalizeWord(raw);
    if (normalized) {
      results.push({
        word: normalized,
        startIndex: match.index,
        endIndex: match.index + raw.length,
      });
    }
  }
  return results;
}

/**
 * 判断 DOM 元素是否为可扫描的正文节点
 */
export function isContentNode(element: Element): boolean {
  if (SKIP_TAGS.has(element.tagName)) return false;
  if (element.closest?.(SKIP_SELECTOR)) return false;
  // 跳过扩展自身的标注节点
  if (element.classList?.contains(EXTENSION_CLASS)) return false;
  // 跳过隐藏元素
  const style = (element as HTMLElement).style;
  if (style?.display === 'none' || style?.visibility === 'hidden') return false;
  return true;
}
