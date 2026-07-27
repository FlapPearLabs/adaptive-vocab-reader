// ============================================================
// 页面扫描器 —— 正文扫描 + 增量标注 + 动态插入监听
// ============================================================
// 从 content/index.ts 抽出的纯逻辑工厂，便于在 happy-dom 中直接测试
// 真实标注路径（不复制逻辑）。content/index.ts 与测试共用同一份代码。
//
// 核心不变量（规格 §4 / §11）：
// - 已处理的文本节点通过 processedNodes 守卫，不会被重复标注（不全页重扫）
// - MutationObserver 只把「新增的节点子树」交给 scanDocument，做增量标注
// - 状态变更（applyWordDisplay）只更新匹配 data-word 的已有 span
import type { WordState } from '../shared/types';
import { createVocabStrategy } from '../strategy/index';
import type { Dictionary } from './dictionary';
import { extractWordsFromText, isContentNode } from './scanner';
import { annotateTextNode, updateWordDisplay, type WordAnnotation } from './annotator';

/** 非持久化性能观测（仅内存，绝不写入 storage；不含 URL/正文/句子/DOM 内容） */
export interface PerfReport {
  /** 累计扫描耗时（毫秒） */
  totalScanMs: number;
  /** 单批最大耗时（毫秒） */
  maxBatchMs: number;
  /** 累计增量标注节点数 */
  annotatedNodes: number;
  /** 累计批次数 */
  batches: number;
}

export interface PageScannerDeps {
  /** 已加载的词典 */
  dictionary: Dictionary;
  /** 返回当前内存中的词汇状态（初始加载时调用一次） */
  getState: () => Record<string, WordState>;
  /** 用户在页面上标记会/不会时回调（用于持久化与广播） */
  onUserAction: (word: string, newStatus: WordState['status']) => void;
  /** 可选：每次扫描结束后回调性能观测（非持久化，仅内存） */
  onPerfReport?: (report: PerfReport) => void;
}

export interface PageScanner {
  /** 扫描并标注某个根节点下的正文 */
  scanDocument(root: Node): void;
  /** 处理单个文本节点（已被 processedNodes 守卫） */
  processTextNode(textNode: Text): void;
  /** 增量更新某词的展示（只更新已有 span，不全页重扫） */
  applyWordDisplay(word: string): void;
  /** 监听动态正文插入（增量标注，不重复扫描已处理节点） */
  observeDynamic(root: Node): MutationObserver;
  /** 用加载到的状态替换内存状态（初次加载 / 全量广播） */
  setState(words: Record<string, WordState>): void;
  /** 应用来自其他标签页的单词状态变更并增量更新显示 */
  applyRemoteChange(word: string, newStatus: WordState['status']): void;
  /** 读取累计性能观测（非持久化，仅内存） */
  getPerfReport(): PerfReport;
}

export function createPageScanner(deps: PageScannerDeps): PageScanner {
  let vocabState: Record<string, WordState> = deps.getState();
  const processedNodes = new WeakSet<Node>();
  const pageOccurrenceCounts = new Map<string, number>();

  // 非持久化性能观测累加器（仅内存，不写入 storage）
  let perfTotalMs = 0;
  let perfMaxBatchMs = 0;
  let perfAnnotatedNodes = 0;
  let perfBatches = 0;

  function nowMs(): number {
    return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
  }

  function emitPerf(): void {
    if (!deps.onPerfReport) return;
    deps.onPerfReport({
      totalScanMs: Math.round(perfTotalMs * 1000) / 1000,
      maxBatchMs: Math.round(perfMaxBatchMs * 1000) / 1000,
      annotatedNodes: perfAnnotatedNodes,
      batches: perfBatches,
    });
  }

  function getPerfReport(): PerfReport {
    return {
      totalScanMs: Math.round(perfTotalMs * 1000) / 1000,
      maxBatchMs: Math.round(perfMaxBatchMs * 1000) / 1000,
      annotatedNodes: perfAnnotatedNodes,
      batches: perfBatches,
    };
  }

  function handleUserAction(word: string, newStatus: WordState['status']): void {
    if (newStatus === 'unknown') return;

    const strategy = createVocabStrategy();
    const change = newStatus === 'known' ? strategy.markKnown(word) : strategy.markLearning(word);

    // 立即更新本地状态
    vocabState[word] = { status: change.newStatus, source: 'manual', updatedAt: Date.now() };

    // 增量更新该词在当前页面的已有标注
    applyWordDisplay(word);

    // 发送到 Service Worker 持久化并广播
    deps.onUserAction(word, change.newStatus);
  }

  function processTextNode(textNode: Text): void {
    if (processedNodes.has(textNode)) return;
    if (!deps.dictionary) return;

    const parent = textNode.parentElement;
    if (parent && !isContentNode(parent)) {
      processedNodes.add(textNode);
      return;
    }

    const text = textNode.textContent || '';
    if (text.trim().length === 0) {
      processedNodes.add(textNode);
      return;
    }

    const occurrences = extractWordsFromText(text);
    if (occurrences.length === 0) {
      processedNodes.add(textNode);
      return;
    }

    const strategy = createVocabStrategy();
    const annotations: WordAnnotation[] = [];
    for (const occ of occurrences) {
      const lookup = deps.dictionary.lookup(occ.word);
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

    if (annotations.length > 0) {
      perfAnnotatedNodes += annotations.length;
      annotateTextNode(textNode, annotations, handleUserAction);
    }

    processedNodes.add(textNode);
  }

  function scanDocument(root: Node): void {
    const scanStart = nowMs();
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

    let i = 0;
    const BATCH_SIZE = 20;
    function processBatch(): void {
      const batchStart = nowMs();
      const end = Math.min(i + BATCH_SIZE, textNodes.length);
      for (; i < end; i++) {
        processTextNode(textNodes[i]!);
      }
      const batchMs = nowMs() - batchStart;
      perfBatches++;
      if (batchMs > perfMaxBatchMs) perfMaxBatchMs = batchMs;
      if (i < textNodes.length) {
        requestAnimationFrame(processBatch);
      } else {
        perfTotalMs += nowMs() - scanStart;
        emitPerf();
      }
    }
    processBatch();
  }

  function applyWordDisplay(word: string): void {
    const lookup = deps.dictionary.lookup(word);
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

  function observeDynamic(root: Node): MutationObserver {
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

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: false,
    });

    return observer;
  }

  function setState(words: Record<string, WordState>): void {
    vocabState = words;
  }

  function applyRemoteChange(word: string, newStatus: WordState['status']): void {
    vocabState[word] = { status: newStatus, source: 'manual', updatedAt: Date.now() };
    applyWordDisplay(word);
  }

  return { scanDocument, processTextNode, applyWordDisplay, observeDynamic, setState, applyRemoteChange, getPerfReport };
}
