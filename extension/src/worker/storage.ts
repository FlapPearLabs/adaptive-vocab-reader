// ============================================================
// 持久化存储适配器（纯函数）
// ============================================================
// 所有状态变更只能通过这里的纯函数计算；
// chrome.storage.local 读写由 Service Worker 的协调器负责。
// ============================================================

import type { VocabSnapshot, WordState } from '../shared/types';
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
    lastUpdated: Date.now(),
  };
}

/**
 * 合并单词状态变更到快照（返回新对象，不可变）
 */
export function mergeStateChange(
  snapshot: VocabSnapshot,
  word: string,
  newStatus: WordState['status'],
): VocabSnapshot {
  const newWords = { ...snapshot.words };
  newWords[word] = {
    status: newStatus,
    source: 'manual',
    updatedAt: Date.now(),
  };

  return {
    ...snapshot,
    words: newWords,
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
