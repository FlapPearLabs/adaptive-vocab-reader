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
    stateVersion: 0,
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
 * 快照迁移（v1 → v2，纯函数，可单测）。
 *
 * 旧快照可能缺 `words[*].version`、审计标记缺 `stateVersion`、审计冻结计划缺
 * `stateVersion` —— 这些字段是 V0.1 状态隔离维度的新增字段，不能继续伪装成 v1。
 *
 * 确定性规则（v1 → v2）：
 * - `schemaVersion` 置为 `SCHEMA_VERSION`（当前 2）。
 * - `stateVersion`：缺省补 0。
 * - `words[*].version`：缺省补 0（首测状态隔离维度；v1 无此字段，保守置 0）。
 * - `auditMarkers`：缺 `stateVersion` 的旧标记补 0（v2 起始 `stateVersion` 也为 0，
 *   故首轮内仍有效；一旦首测 (re)start 递增 `stateVersion`，`clearStaleAuditMarkers`
 *   会自动失效这些陈旧标记）。
 * - `auditPlan`：若缺 `stateVersion`（旧 v1 冻结计划），**安全失效**置 `null`，
 *   不得继续据此作答（服务端权威校验也会拒绝缺字段的计划）。
 * - 缺失容器（`words`/`auditMarkers`/`auditLog`/`auditPlan`/`initialTest`）按空/缺省补齐。
 *
 * 幂等：对已是 v2 的快照再次迁移结果一致（字段已齐全，规则变为恒等）。
 * 回滚边界：迁移只增字段、绝不删除用户有效数据（installSeed/词状态/initialTest 原样保留）。
 * 若升级后需回退到 v1 读取，唯一安全路径是凭发布前备份快照或清除 `chrome.storage` 重装；
 * 本函数**不提供原地降级**（降级会丢失 v2 新增字段，属需明确人工/脚本决策的破坏性操作，
 * 且本会话未实际执行任何回滚，故不得声称回滚已验证）。
 */
export function migrateSnapshot(raw: unknown): VocabSnapshot {
  const r = (raw ?? {}) as Partial<VocabSnapshot>;

  const stateVersion = typeof r.stateVersion === 'number' ? r.stateVersion : 0;

  const words: Record<string, WordState> = {};
  for (const [w, ws] of Object.entries(r.words ?? {})) {
    if (!ws) continue;
    words[w] = {
      status: ws.status ?? 'unknown',
      source: ws.source ?? 'initial',
      updatedAt: typeof ws.updatedAt === 'number' ? ws.updatedAt : 0,
      version: typeof ws.version === 'number' ? ws.version : 0,
    };
  }

  const auditMarkers: Record<string, AuditMarker> = {};
  for (const [w, m] of Object.entries(r.auditMarkers ?? {})) {
    if (!m) continue;
    auditMarkers[w] = {
      word: m.word ?? w,
      source: m.source ?? 'initial-correct',
      planVersion: m.planVersion ?? '',
      stateVersion: typeof m.stateVersion === 'number' ? m.stateVersion : 0,
      createdAt: typeof m.createdAt === 'number' ? m.createdAt : 0,
      pending: m.pending ?? false,
    };
  }

  // 旧格式（schemaVersion !== 当前）的冻结审计计划**无条件安全失效**置 null：
  // 旧 v1 计划中可能已写出带 stateVersion 的哈希计划，但旧哈希未覆盖选项翻译，
  // 属可被篡改的不完整基；V0.1 当前哈希方案下不得原样接受旧计划。仅当快照已是
  // 当前 schemaVersion 且计划自带合法 stateVersion 时才保留。
  const isOldFormat = r.schemaVersion !== SCHEMA_VERSION;
  const storedPlan = r.auditPlan as Partial<AuditPlan> | null;
  const auditPlan: AuditPlan | null =
    isOldFormat || !(storedPlan && typeof storedPlan.stateVersion === 'number')
      ? null
      : (storedPlan as AuditPlan);

  return {
    schemaVersion: SCHEMA_VERSION,
    dictVersion: r.dictVersion ?? '',
    stateVersion,
    installSeed: r.installSeed ?? '',
    words,
    auditMarkers,
    auditLog: r.auditLog ?? [],
    auditPlan,
    initialTest: r.initialTest ?? null,
    lastUpdated: typeof r.lastUpdated === 'number' ? r.lastUpdated : 0,
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
    // 状态版本：标记该词状态所属的首测轮次，用于隔离/校验
    version: snapshot.stateVersion,
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
 * 清除状态版本不等于当前快照状态版本的待审计标记（返回新对象，不可变）。
 * 用于首测计划被重做/替换（INITIAL_TEST_START 递增 stateVersion）时，使上一轮
 * 首测产生的审计标记失效。仅靠 planVersion 无法区分「相同种子重测」的陈旧标记，
 * 故以 stateVersion 为准。当前 stateVersion 由调用方在 bump 后传入。
 */
export function clearStaleAuditMarkers(snapshot: VocabSnapshot, currentStateVersion: number): VocabSnapshot {
  const stale = Object.values(snapshot.auditMarkers).filter((marker) => marker.stateVersion !== currentStateVersion);
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
 * 清除所有待审计标记（返回新对象，不可变）。
 * 用于 INITIAL_TEST_RESET：新一轮首测开始前彻底清空上一轮标记，
 * 不依赖任何版本号（直接全量清除）。
 */
export function clearAllPendingAuditMarkers(snapshot: VocabSnapshot): VocabSnapshot {
  if (Object.keys(snapshot.auditMarkers).length === 0) return snapshot;
  return {
    ...snapshot,
    auditMarkers: {},
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
