// ============================================================
// 内容脚本入口
// ============================================================
// 负责页面扫描、词典查询、策略调用、DOM 标注和交互
// 不直接读写 chrome.storage.local —— 通过消息与 Service Worker 通信
// ============================================================

import type { DictCore, FormsMap, FrequencyBands, WordState, DisplayResult } from '../shared/types';
import { createVocabStrategy } from '../strategy/index';
import { createDictionary, Dictionary } from './dictionary';
import { extractWordsFromText, isContentNode } from './scanner';
import { initAnnotator, annotateTextNode } from './annotator';

// ============================================================
// 全局状态
// ============================================================

let dictionary: Dictionary | null = null;
let vocabState: Record<string, WordState> = {};
let processedNodes = new WeakSet<Node>();
let pageOccurrenceCounts = new Map<string, number>();

// ============================================================
// 初始化
// ============================================================

async function loadDictionary(): Promise<Dictionary> {
  const [coreJSON, formsJSON, bandsJSON] = await Promise.all([
    fetch(chrome.runtime.getURL('data/dict-core.json')).then((r) => r.text()),
    fetch(chrome.runtime.getURL('data/forms.json')).then((r) => r.text()),
    fetch(chrome.runtime.getURL('data/frequency-bands.json')).then((r) => r.text()),
  ]);

  // 手动转换 JSON 数组格式为 DictEntry
  const rawCore: Record<string, [string, string, string]> = JSON.parse(coreJSON);
  const core: DictCore = {};
  for (const [word, arr] of Object.entries(rawCore)) {
    core[word] = { phonetic: arr[0], pos: arr[1], translation: arr[2] };
  }
  const forms: FormsMap = JSON.parse(formsJSON);
  const bands: FrequencyBands = JSON.parse(bandsJSON);

  return createDictionary(core, forms, bands);
}

async function loadState(): Promise<Record<string, WordState>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
      resolve(response?.words || {});
    });
  });
}

function saveStateChange(word: string, newStatus: WordState['status']): void {
  chrome.runtime.sendMessage({
    type: 'STATE_CHANGE',
    word,
    newStatus,
  });
}

// ============================================================
// 页面扫描与标注
// ============================================================

function processTextNode(textNode: Text): void {
  if (processedNodes.has(textNode)) return;
  if (!dictionary) return;

  // 检查父元素是否为正文节点
  const parent = textNode.parentElement;
  if (parent && !isContentNode(parent)) return;

  const text = textNode.textContent || '';
  if (text.trim().length === 0) return;

  const occurrences = extractWordsFromText(text);
  if (occurrences.length === 0) {
    processedNodes.add(textNode);
    return;
  }

  const strategy = createVocabStrategy();

  // 查找词典并获取展示决策
  const displayResults: DisplayResult[] = [];
  for (const occ of occurrences) {
    const lookup = dictionary.lookup(occ.word);
    if (!lookup) continue;
    const occurrenceCount = (pageOccurrenceCounts.get(lookup.word) ?? 0) + 1;
    pageOccurrenceCounts.set(lookup.word, occurrenceCount);

    const state = vocabState[lookup.word];
    const result = strategy.getDisplayDecision(
      {
        word: lookup.word,
        surfaceForm: occ.word,
        entry: lookup.entry,
        band: lookup.band,
        occurrenceCount,
      },
      state,
    );

    if (result.decision !== 'none') {
      displayResults.push(result);
    }
  }

  // 应用标注
  if (displayResults.length > 0) {
    annotateTextNode(textNode, displayResults, handleUserAction);
  }

  processedNodes.add(textNode);
}

function handleUserAction(word: string, newStatus: WordState['status']): void {
  // 只处理 known/learning（忽略 unknown）
  if (newStatus === 'unknown') return;
  const strategy = createVocabStrategy();
  let change;

  if (newStatus === 'known') {
    change = strategy.markKnown(word);
  } else {
    change = strategy.markLearning(word);
  }

  // 立即更新本地状态
  vocabState[word] = { status: change.newStatus, source: 'manual', updatedAt: Date.now() };

  // 发送到 Service Worker 持久化
  saveStateChange(word, change.newStatus);

  // 重新扫描当前页面（更新显示）
  reapplyAnnotations();
}

function reapplyAnnotations(): void {
  // 清除已处理标记，重新扫描
  processedNodes = new WeakSet();
  pageOccurrenceCounts = new Map();

  // 查找并移除已有标注
  const existingSpans = document.querySelectorAll('.avr-word');
  existingSpans.forEach((span) => {
    const parent = span.parentNode;
    if (!parent) return;
    const text = span.textContent || '';
    parent.replaceChild(document.createTextNode(text), span);
    parent.normalize();
  });

  // 移除 tooltip
  const tooltip = document.querySelector('.avr-tooltip');
  if (tooltip) tooltip.remove();

  // 重新扫描
  scanDocument(document.body);
}

// ============================================================
// 文档扫描
// ============================================================

function scanDocument(root: Node): void {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node: Text): number {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (!isContentNode(parent)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  const textNodes: Text[] = [];
  let currentNode: Text | null;
  while ((currentNode = walker.nextNode() as Text | null)) {
    textNodes.push(currentNode);
  }

  // 分批处理避免阻塞主线程
  let i = 0;
  const BATCH_SIZE = 20;
  function processBatch(): void {
    const end = Math.min(i + BATCH_SIZE, textNodes.length);
    for (; i < end; i++) {
      processTextNode(textNodes[i]!);
    }
    if (i < textNodes.length) {
      requestAnimationFrame(processBatch);
    }
  }
  processBatch();
}

// ============================================================
// 启动
// ============================================================

async function main(): Promise<void> {
  initAnnotator();

  // 并行加载词典和状态
  const [dict, state] = await Promise.all([loadDictionary(), loadState()]);
  dictionary = dict;
  vocabState = state;

  // 扫描页面
  scanDocument(document.body);

  // 监听动态内容
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          processTextNode(node as Text);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          scanDocument(node);
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: false,
  });
}

// 监听来自 Service Worker 的状态更新
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'STATE_UPDATED') {
    vocabState = message.words;
    reapplyAnnotations();
  }
});

// 启动
main().catch(console.error);
