// ============================================================
// 内容脚本入口
// ============================================================
// 负责页面扫描、词典查询、策略调用、DOM 标注和交互
// 不直接读写 chrome.storage.local —— 通过消息与 Service Worker 通信
//
// 核心规则（规格第 4 节）：
// - 状态变更后只更新受影响的命中词，不做全页重扫
// - 增量处理动态插入的正文，避免重复扫描已处理节点
// ============================================================

import type { DictCore, FormsMap, FrequencyBands, WordState, DisplayResult } from '../shared/types';
import { createVocabStrategy } from '../strategy/index';
import { createDictionary, Dictionary } from './dictionary';
import { extractWordsFromText, isContentNode } from './scanner';
import { initAnnotator, annotateTextNode, updateWordDisplay, type WordAnnotation } from './annotator';

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
    core[word] = { phonetic: arr[0]!, pos: arr[1]!, translation: arr[2]! };
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

  // 查找词典并构造标注（使用词在原文中的精确位置）
  const annotations: WordAnnotation[] = [];
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
      annotations.push({
        result,
        startIndex: occ.startIndex,
        endIndex: occ.endIndex,
      });
    }
  }

  // 应用标注（使用精确位置，保留原文大小写）
  if (annotations.length > 0) {
    annotateTextNode(textNode, annotations, handleUserAction);
  }

  processedNodes.add(textNode);
}

/**
 * 用户在页面上标记会/不会。
 * 只更新该词的显示——不做全页重扫。
 */
function handleUserAction(word: string, newStatus: WordState['status']): void {
  if (newStatus === 'unknown') return;

  const strategy = createVocabStrategy();
  const change = newStatus === 'known' ? strategy.markKnown(word) : strategy.markLearning(word);

  // 立即更新本地状态
  vocabState[word] = { status: change.newStatus, source: 'manual', updatedAt: Date.now() };

  // 增量更新该词在当前页面的已有标注
  applyWordDisplay(word);

  // 发送到 Service Worker 持久化并广播
  saveStateChange(word, change.newStatus);
}

/**
 * 根据当前状态计算某词的展示决策，并增量更新其已有 span。
 * 只更新 data-word 匹配的 span，不重扫页面。
 */
function applyWordDisplay(word: string): void {
  if (!dictionary) return;
  const lookup = dictionary.lookup(word);
  if (!lookup) return;

  const strategy = createVocabStrategy();
  const state = vocabState[word];
  const result = strategy.getDisplayDecision(
    {
      word: lookup.word,
      surfaceForm: word,
      entry: lookup.entry,
      band: lookup.band,
      occurrenceCount: 1, // 增量更新不依赖出现次数
    },
    state,
  );

  updateWordDisplay(lookup.word, result.decision, result.translation, result.showInlineTranslation);
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

  // 监听动态内容（增量处理，不重复扫描已处理节点）
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

// 监听来自 Service Worker 的状态更新（其他标签页的变更广播）
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'STATE_UPDATED') {
    const { word, newStatus } = message;
    if (word && newStatus) {
      // 更新本地状态并增量更新该词显示
      vocabState[word] = { status: newStatus, source: 'manual', updatedAt: Date.now() };
      applyWordDisplay(word);
    } else if (message.words) {
      // 兼容旧格式（全量状态）：只更新内存，不重扫
      vocabState = message.words;
    }
  }
});

// 启动
main().catch(console.error);
