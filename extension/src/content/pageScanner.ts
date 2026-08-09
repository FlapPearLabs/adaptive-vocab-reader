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
import type { DisplayResult, FrequencyBands, WordState } from '../shared/types';
import { createVocabStrategy } from '../strategy/index';
import type { Dictionary } from './dictionary';
import { extractWordsFromText, isContentNode } from './scanner';
import { annotateTextNode, hideAnnotationActionMenu, updateWordDisplay, type WordAnnotation } from './annotator';

/** 非持久化性能观测（仅内存，绝不写入 storage；不含 URL/正文/句子/DOM 内容） */
export interface PerfReport {
  /** 累计扫描墙钟（毫秒，含批处理调度） */
  totalScanMs: number;
  /** 单批主线程最长时间（毫秒） */
  maxBatchMs: number;
  /** 扫描过的文本节点数（已处理节点守卫去重后） */
  textNodesScanned: number;
  /** 累计标注的单词数 */
  wordsAnnotated: number;
  /** 实际新增到 DOM 的标注 span 数（annotateTextNode 真实返回的插入节点数） */
  domNodesAdded: number;
  /** 实际从 DOM 移除的标注 span 数（updateWordDisplay 还原为纯文本时） */
  domNodesRemoved: number;
  /** 净增节点数 = domNodesAdded - domNodesRemoved */
  netNodes: number;
  /**
   * 标注前后 documentElement.scrollHeight 变化累计（绝对值，像素）。
   * 仅反映页面高度变化，不表示布局偏移（layout shift），故命名为 heightDeltaPx。
   */
  heightDeltaPx: number;
  /**
   * 真实布局偏移（Layout Instability API 累计 CLS 片段）。
   * 通过 PerformanceObserver 监听 `layout-shift` 条目累加；环境不支持时为 0。
   * 与 heightDeltaPx 区分：scrollHeight 变化可能由高度增长引起，不一定是位移。
   */
  layoutShiftScore: number;
  /**
   * 是否真正支持 layout-shift 观测。false 表示当前环境不支持 Layout Instability API，
   * `layoutShiftScore` 的 0 是「未观测」而非「真实为零」——二者必须区分，不得混淆。
   */
  layoutShiftSupported: boolean;
  /** 累计批次数 */
  batches: number;
}

export interface PageScannerDeps {
  /** 已加载的词典 */
  dictionary: Dictionary;
  /** T-QD-1 期间保留旧展示语义的固定测评词典；T-INT-2 再改为全量查询包装。 */
  assessmentDictionary?: Dictionary;
  /** 返回当前内存中的词汇状态（初始加载时调用一次） */
  getState: () => Record<string, WordState>;
  /** 用户在页面上标记会/不会时回调（用于持久化与广播） */
  onUserAction: (word: string, newStatus: WordState['status']) => void;
  /** 固定测评词包的频段；只为既有 strategy seam 提供兼容上下文，不属于查询词典。 */
  assessmentBands?: FrequencyBands;
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
  let perfTextNodesScanned = 0;
  let perfWordsAnnotated = 0;
  let perfDomNodesAdded = 0;
  let perfDomNodesRemoved = 0;
  let perfHeightDeltaPx = 0;
  let perfLayoutShiftScore = 0;
  let perfLayoutShiftSupported = false;
  let perfBatches = 0;

  // 标注器生成的节点（span 与文本碎片）统一登记，observer 与 processTextNode 据此彻底跳过，
  // 杜绝 MutationObserver 因自身注入节点而触发的重复扫描（自触发）。
  const generatedNodes: WeakSet<Node> = new WeakSet<Node>();
  let selectionActionEl: HTMLButtonElement | null = null;

  function canUseAssessmentDisplay(surfaceForm: string): boolean {
    if (!deps.assessmentBands) return true;
    const assessmentLookup = deps.assessmentDictionary?.lookup(surfaceForm) ?? deps.dictionary.lookup(surfaceForm);
    return Boolean(assessmentLookup && Object.hasOwn(deps.assessmentBands, assessmentLookup.wordKey));
  }

  function getDisplayResult(surfaceForm: string, occurrenceCount: number): DisplayResult | null {
    const lookup = deps.dictionary.lookup(surfaceForm);
    if (!lookup) return null;

    const state = vocabState[lookup.wordKey];
    if (!canUseAssessmentDisplay(surfaceForm)) {
      const isLearning = state?.status === 'learning';
      return {
        word: lookup.wordKey,
        decision: isLearning ? 'strong' : 'none',
        surfaceForm,
        // 查询词典中未进入固定测评词包的词保持透明，但仍需完整 tooltip 元数据。
        translation: lookup.entry.translation,
        showInlineTranslation: isLearning && occurrenceCount === 1,
      };
    }

    return createVocabStrategy().getDisplayDecision(
      {
        word: lookup.wordKey,
        surfaceForm,
        entry: lookup.entry,
        band: deps.assessmentBands?.[lookup.wordKey] ?? null,
        occurrenceCount,
      },
      state,
    );
  }

  function hideSelectionAction(): void {
    selectionActionEl?.remove();
    selectionActionEl = null;
  }

  function normalizedSelectedWord(): string | null {
    const selected = window.getSelection()?.toString() ?? '';
    const normalized = selected.trim().replace(/^\p{P}+|\p{P}+$/gu, '').toLowerCase();
    if (!normalized || /\s/u.test(normalized) || /^\d+$/u.test(normalized)) return null;
    return normalized;
  }

  function showSelectionAction(word: string, x: number, y: number): void {
    hideSelectionAction();
    hideAnnotationActionMenu();

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'avr-selection-action';
    button.textContent = '加入生词本';
    button.dataset.word = word;
    button.style.left = `${x}px`;
    button.style.top = `${y + 6}px`;
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', (event) => {
      event.preventDefault();
      const selectedWord = button.dataset.word;
      hideSelectionAction();
      window.getSelection()?.removeAllRanges();
      if (selectedWord) handleUserAction(selectedWord, 'learning');
    });
    document.body.appendChild(button);
    selectionActionEl = button;
  }

  document.addEventListener('mouseup', (event) => {
    const target = event.target as HTMLElement;
    if (target.closest('.avr-selection-action')) return;

    const selectedWord = normalizedSelectedWord();
    const lookup = selectedWord ? deps.dictionary.lookup(selectedWord) : null;
    const status = lookup ? vocabState[lookup.wordKey]?.status : undefined;
    if (!lookup || status === 'learning' || status === 'known') {
      hideSelectionAction();
      return;
    }

    const range = window.getSelection()?.rangeCount ? window.getSelection()!.getRangeAt(0) : null;
    const rect = range?.getBoundingClientRect();
    showSelectionAction(lookup.wordKey, rect?.left ?? event.clientX, rect?.bottom ?? event.clientY);
  });

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (!target.closest('.avr-selection-action')) hideSelectionAction();
  });

  // 真实布局偏移（Layout Instability API）：累计 layout-shift 条目值（排除近期用户输入）。
  // 与 scrollHeight 差（heightDeltaPx）区分——后者只反映高度变化，不一定是位移。
  // 不使用 buffered:true：只观测本会话启动后的位移，不混入扫描前的页面位移。
  if (typeof PerformanceObserver !== 'undefined') {
    try {
      const layoutObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const e = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
          if (typeof e.value === 'number' && !e.hadRecentInput) {
            perfLayoutShiftScore += e.value;
          }
        }
      });
      layoutObserver.observe({ type: 'layout-shift' });
      perfLayoutShiftSupported = true;
    } catch {
      // 环境不支持 layout-shift 时静默降级（perfLayoutShiftScore 保持 0，且 layoutShiftSupported=false）
      perfLayoutShiftSupported = false;
    }
  } else {
    perfLayoutShiftSupported = false;
  }

  function nowMs(): number {
    return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
  }

  function emitPerf(): void {
    if (!deps.onPerfReport) return;
    deps.onPerfReport({
      totalScanMs: Math.round(perfTotalMs * 1000) / 1000,
      maxBatchMs: Math.round(perfMaxBatchMs * 1000) / 1000,
      textNodesScanned: perfTextNodesScanned,
      wordsAnnotated: perfWordsAnnotated,
      domNodesAdded: perfDomNodesAdded,
      domNodesRemoved: perfDomNodesRemoved,
      netNodes: perfDomNodesAdded - perfDomNodesRemoved,
      heightDeltaPx: Math.round(perfHeightDeltaPx * 100) / 100,
      layoutShiftScore: Math.round(perfLayoutShiftScore * 10000) / 10000,
      layoutShiftSupported: perfLayoutShiftSupported,
      batches: perfBatches,
    });
  }

  function getPerfReport(): PerfReport {
    return {
      totalScanMs: Math.round(perfTotalMs * 1000) / 1000,
      maxBatchMs: Math.round(perfMaxBatchMs * 1000) / 1000,
      textNodesScanned: perfTextNodesScanned,
      wordsAnnotated: perfWordsAnnotated,
      domNodesAdded: perfDomNodesAdded,
      domNodesRemoved: perfDomNodesRemoved,
      netNodes: perfDomNodesAdded - perfDomNodesRemoved,
      heightDeltaPx: Math.round(perfHeightDeltaPx * 100) / 100,
      layoutShiftScore: Math.round(perfLayoutShiftScore * 10000) / 10000,
      layoutShiftSupported: perfLayoutShiftSupported,
      batches: perfBatches,
    };
  }

  function handleUserAction(word: string, newStatus: WordState['status']): void {
    if (newStatus === 'unknown') return;

    const strategy = createVocabStrategy();
    const markResult = newStatus === 'known' ? strategy.markKnown(word) : strategy.markLearning(word);
    const status = markResult.change.newStatus;

    // 立即更新本地状态（内容脚本不跟踪状态版本，沿用既有或 0）
    vocabState[word] = { status, source: 'manual', updatedAt: Date.now(), version: vocabState[word]?.version ?? 0 };

    // 增量更新该词在当前页面的已有标注
    applyWordDisplay(word);

    // 发送到 Service Worker 持久化并广播
    deps.onUserAction(word, status);
  }

  function processTextNode(textNode: Text): void {
    if (processedNodes.has(textNode)) return;
    // 防御：标注器自身生成的节点（span 与文本碎片）不得再被扫描——彻底杜绝自触发
    if (generatedNodes.has(textNode)) {
      processedNodes.add(textNode);
      return;
    }
    if (!deps.dictionary) return;

    const parent = textNode.parentElement;
    if (parent && !isContentNode(parent)) {
      processedNodes.add(textNode);
      return;
    }

    // 防御：扩展自身注入的标注 span 内的文本节点不得再被扫描（避免自触发重标注/嵌套 span）
    if (parent && parent.closest('.avr-word')) {
      processedNodes.add(textNode);
      return;
    }

    const text = textNode.textContent || '';
    if (text.trim().length === 0) {
      processedNodes.add(textNode);
      return;
    }

    // 真实扫描计数：每个真正扫描的正文文本节点都计入（含无命中词的节点），
    // 不夸大也不漏计；自触发已被 generatedNodes 拦截，故此数反映真实扫描量。
    perfTextNodesScanned++;
    const occurrences = extractWordsFromText(text);
    if (occurrences.length === 0) {
      processedNodes.add(textNode);
      return;
    }

    const annotations: WordAnnotation[] = [];
    for (const occ of occurrences) {
      const lookup = deps.dictionary.lookup(occ.word);
      if (!lookup) {
        annotations.push({
          result: { word: occ.word, decision: 'none', surfaceForm: occ.word, translation: null, showInlineTranslation: false },
          startIndex: occ.startIndex,
          endIndex: occ.endIndex,
          unresolved: true,
        });
        continue;
      }
      const wordKey = lookup.wordKey;
      const occurrenceCount = (pageOccurrenceCounts.get(wordKey) ?? 0) + 1;
      pageOccurrenceCounts.set(wordKey, occurrenceCount);
      const result = getDisplayResult(occ.word, occurrenceCount);
      if (!result) continue;
      annotations.push({
        result,
        phonetic: lookup.entry.phonetic,
        pos: lookup.entry.pos,
        startIndex: occ.startIndex,
        endIndex: occ.endIndex,
      });
    }

    if (annotations.length > 0) {
      perfWordsAnnotated += annotations.length;
      const res = annotateTextNode(textNode, annotations, handleUserAction, generatedNodes);
      perfDomNodesAdded += res.added;
      perfDomNodesRemoved += res.removed;
    }

    processedNodes.add(textNode);
  }

  function scanDocument(root: Node): void {
    const scanStart = nowMs();
    const scanStartHeight =
      typeof document !== 'undefined' && document.documentElement
        ? document.documentElement.scrollHeight
        : 0;
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
        // 高度影响：标注前后 documentElement.scrollHeight 变化累计（绝对值）。
        // 注意：这只反映页面高度变化，不表示布局偏移（layout shift）；
        // 真实布局偏移由 Layout Instability API 另行累加（layoutShiftScore）。
        const endHeight =
          typeof document !== 'undefined' && document.documentElement
            ? document.documentElement.scrollHeight
            : 0;
        perfHeightDeltaPx += Math.abs(endHeight - scanStartHeight);
        emitPerf();
      }
    }
    processBatch();
  }

  function applyWordDisplay(word: string): void {
    const lookup = deps.dictionary.lookup(word);
    const result = getDisplayResult(word, 1);
    if (!lookup || !result) return;

    const res = updateWordDisplay(lookup.wordKey, result.decision, result.translation, result.showInlineTranslation, generatedNodes);
    if (res.added > 0) perfDomNodesAdded += res.added;
    if (res.removed > 0) perfDomNodesRemoved += res.removed;
  }

  function observeDynamic(root: Node): MutationObserver {
    const observer = new MutationObserver((mutations) => {
      // 直接处理文本节点的耗时计入性能报告（scanDocument 内部已自计，故仅在文本路径累加）
      let textWorkMs = 0;
      let textBatches = 0;
      for (const mutation of mutations) {
        if (mutation.type === 'characterData' && mutation.target.nodeType === Node.TEXT_NODE) {
          const textNode = mutation.target as Text;
          if (!generatedNodes.has(textNode) && !textNode.parentElement?.closest('.avr-word')) {
            // 既有文本节点的内容更新需要重新进入扫描；WeakSet 守卫只抑制未变化节点。
            processedNodes.delete(textNode);
            const s = nowMs();
            processTextNode(textNode);
            textWorkMs += nowMs() - s;
            textBatches++;
          }
        }
        for (const node of mutation.addedNodes) {
          // 彻底跳过扩展自身注入的标注节点（span 与文本碎片），杜绝 MutationObserver 自触发
          if (generatedNodes.has(node)) continue;
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            // 自身新增的标注 span：直接跳过（不对其 scanDocument，避免递归重扫）
            if (el.classList && el.classList.contains('avr-word')) continue;
            // 动态插入的元素子树：交给 scanDocument 做增量标注（其内部自行计时）
            scanDocument(node);
          } else if (node.nodeType === Node.TEXT_NODE) {
            // 自身标注 span 内的文本节点：跳过（其父为 .avr-word）
            const parent = (node as Text).parentElement;
            if (parent && parent.closest('.avr-word')) continue;
            const s = nowMs();
            processTextNode(node as Text);
            textWorkMs += nowMs() - s;
            textBatches++;
          }
        }
      }
      if (textWorkMs > 0) {
        perfTotalMs += textWorkMs;
        if (textWorkMs > perfMaxBatchMs) perfMaxBatchMs = textWorkMs;
        perfBatches += textBatches;
        emitPerf();
      }
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return observer;
  }

  function setState(words: Record<string, WordState>): void {
    vocabState = words;
  }

  function applyRemoteChange(word: string, newStatus: WordState['status']): void {
    // 内容脚本不跟踪状态版本，沿用既有或 0
    vocabState[word] = { status: newStatus, source: 'manual', updatedAt: Date.now(), version: vocabState[word]?.version ?? 0 };
    applyWordDisplay(word);
  }

  return { scanDocument, processTextNode, applyWordDisplay, observeDynamic, setState, applyRemoteChange, getPerfReport };
}
