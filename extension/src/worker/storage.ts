// ============================================================
// 持久化存储适配器（纯函数）
// ============================================================
// 所有状态变更只能通过这里的纯函数计算；
// chrome.storage.local 读写由 Service Worker 的协调器负责。
// 快照不得包含 URL、域名、页面标题、正文、句子或浏览历史。
// ============================================================

import type { VocabSnapshot, WordState, WordStateSource, AuditMarker, InitialTestState, AuditEvent, AuditPlan } from '../shared/types';
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
    auditLog: [],
    auditPlan: null,
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
 * 清除某个词的待审计标记（返回新对象，不可变）。
 * 用于页面手动覆盖（手动标记优先于首测正确标记）时清理该词陈旧标记。
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
 * 清除绑定到非当前计划版本的待审计标记（返回新对象，不可变）。
 * 用于首测计划被重做/替换（INITIAL_TEST_START 携带新 plan.version）时，
 * 使上一轮首测产生的审计标记失效，避免用陈旧计划版本核验。
 */
export function clearStaleAuditMarkers(snapshot: VocabSnapshot, currentPlanVersion: string): VocabSnapshot {
  const stale = Object.values(snapshot.auditMarkers).filter((marker) => marker.planVersion !== currentPlanVersion);
  if (stale.length === 0) return snapshot;
  const newMarkers = { ...snapshot.auditMarkers };
  for (const marker of stale) {
    delete newMarkers[marker.word];
  }
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
 * 写入或清除冻结审计计划（作答前冻结，worker 据此验证审计作答）。
 */
export function setAuditPlan(snapshot: VocabSnapshot, plan: AuditPlan | null): VocabSnapshot {
  return {
    ...snapshot,
    auditPlan: plan,
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
 * 追加一条审计事件（结算后仅保留最小状态证据与最近审计结果）。
 * 返回新对象（不可变）；旧快照缺 auditLog 时安全回退为空数组。
 */
export function recordAuditEvent(snapshot: VocabSnapshot, event: AuditEvent): VocabSnapshot {
  const log = snapshot.auditLog ?? [];
  return {
    ...snapshot,
    auditLog: [...log, event],
    lastUpdated: Date.now(),
  };
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
