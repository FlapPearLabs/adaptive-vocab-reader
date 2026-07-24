// ============================================================
// 持久化存储适配器（纯函数）
// ============================================================
// 所有状态变更只能通过这里的纯函数计算；
// chrome.storage.local 读写由 Service Worker 的协调器负责。
// 快照不得包含 URL、域名、页面标题、正文、句子或浏览历史。
// ============================================================

import type { VocabSnapshot, WordState, WordStateSource, AuditMarker, InitialTestState } from '../shared/types';
import { SCHEMA_VERSION } from '../shared/types';

/**
 * 创建空的初始快照
 */
export function createEmptySnapshot(installSeed: string, dictVersion: string): VocabSnapshot {
  return {
    schemaVersion: SCHEMA_VERSION,
    dictVersion,
    installSeed,
    words: {},
    auditMarkers: {},
    initialTest: null,
    lastUpdated: Date.now(),
  };
}

/**
 * 合并单词状态变更到快照（返回新对象，不可变）。
 * @param source 变更来源：'manual' 网页手动标记，'initial' 首测作答
 */
export function mergeStateChange(
  snapshot: VocabSnapshot,
  word: string,
  newStatus: WordState['status'],
  source: WordStateSource = 'manual',
): VocabSnapshot {
  const newWords = { ...snapshot.words };
  newWords[word] = {
    status: newStatus,
    source,
    updatedAt: Date.now(),
  };

  return {
    ...snapshot,
    words: newWords,
    lastUpdated: Date.now(),
  };
}

/**
 * 写入或更新一个待审计标记（返回新对象，不可变）
 */
export function addAuditMarker(snapshot: VocabSnapshot, marker: AuditMarker): VocabSnapshot {
  const newMarkers = { ...snapshot.auditMarkers };
  newMarkers[marker.word] = marker;
  return {
    ...snapshot,
    auditMarkers: newMarkers,
    lastUpdated: Date.now(),
  };
}

/**
 * 清除某个词的待审计标记（返回新对象，不可变）
 */
export function clearAuditMarker(snapshot: VocabSnapshot, word: string): VocabSnapshot {
  if (!snapshot.auditMarkers[word]) return snapshot;
  const newMarkers = { ...snapshot.auditMarkers };
  delete newMarkers[word];
  return {
    ...snapshot,
    auditMarkers: newMarkers,
    lastUpdated: Date.now(),
  };
}

/**
 * 写入首测状态（计划 + 作答进度）
 */
export function setInitialTest(snapshot: VocabSnapshot, test: InitialTestState | null): VocabSnapshot {
  return {
    ...snapshot,
    initialTest: test,
    lastUpdated: Date.now(),
  };
}

/**
 * 获取当前所有单词状态（浅拷贝）
 */
export function getWords(snapshot: VocabSnapshot): Record<string, WordState> {
  return { ...snapshot.words };
}

/**
 * 活跃生词表：所有状态为 learning 的规范化单词。
 * 这是「不会」词在当前页面的强提示来源，不单独存储以节约并避免与状态漂移。
 */
export function getActiveWords(snapshot: VocabSnapshot): string[] {
  return Object.keys(snapshot.words).filter((word) => snapshot.words[word]!.status === 'learning');
}

/**
 * 生成本机安装随机种子（32 位十六进制）
 * 使用 crypto.getRandomValues 在浏览器环境，或 Math.random 回退
 */
export function generateInstallSeed(): string {
  // 检查是否有 crypto API
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // 回退：非安全随机（仅用于测试环境）
  const parts: string[] = [];
  for (let i = 0; i < 16; i++) {
    parts.push(Math.floor(Math.random() * 256).toString(16).padStart(2, '0'));
  }
  return parts.join('');
}
