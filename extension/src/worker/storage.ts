// ============================================================
// 持久化存储适配器（纯函数）
// ============================================================
// 所有状态变更只能通过这里的纯函数计算；
// chrome.storage.local 读写由 Service Worker 的协调器负责。
// 快照不得包含 URL、域名、页面标题、正文、句子或浏览历史。
// ============================================================

import type {
  VocabSnapshot,
  WordState,
  WordStateSource,
  AssessmentSettlement,
  AuditMarker,
  InitialTestState,
  AuditEvent,
  AuditPlan,
  FormsMap,
  DailyTestState,
} from '../shared/types';
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
    assessmentEvidence: {},
    auditMarkers: {},
    auditLog: [],
    auditPlan: null,
    initialTest: null,
    dailyTest: null,
    completedRoundIndex: 0,
    lastUpdated: Date.now(),
  };
}

/**
 * 快照迁移（schema 2 → 3，纯函数，可单测）。
 *
 * 固定四步：按 FormsMap 规范化旧 WordState key 并仲裁冲突；按旧首测同下标题目/答案
 * 重建 AssessmentEvidence；清空 auditMarkers/auditPlan；补齐 schema 3 的正式每日默认字段。
 * 无法映射的旧 key 保守保留，auditLog 原样保留且不转换。对已是 v3 的快照恒等返回。
 * 本函数不提供原地 3→2 降级；真实用户 profile 的 schema 2 备份属于 T5/T6 发布门，
 * 本 Ticket 仅以 fixture 验证迁移。
 */
export function migrateSnapshot(raw: unknown, forms?: FormsMap): VocabSnapshot {
  // schema 3 已是完整持久化格式；调用方不得重写、重建或变更它。
  if (raw && typeof raw === 'object' && (raw as { schemaVersion?: unknown }).schemaVersion === SCHEMA_VERSION) {
    return raw as VocabSnapshot;
  }

  const r = (isRecord(raw) ? raw : {}) as Partial<VocabSnapshot>;
  if ((r.schemaVersion === 1 || r.schemaVersion === 2) && (!forms || !isValidFormsMap(forms))) {
    throw new Error('Valid FormsMap is required for schema 1/2 migration');
  }
  const formsMap = forms ?? {};

  const stateVersion = typeof r.stateVersion === 'number' ? r.stateVersion : 0;

  const words: Record<string, WordState> = {};
  const rawWords = isRecord(r.words) ? r.words : {};
  for (const [w, ws] of Object.entries(rawWords)) {
    if (w.trim().length === 0) continue;
    const candidate = parseWordState(ws);
    if (!candidate) continue;
    const wordKey = formsMap[w.toLowerCase()] ?? w;
    if (typeof wordKey !== 'string' || wordKey.trim().length === 0) continue;
    const current = words[wordKey];
    if (!current || shouldReplaceWordState(current, candidate)) {
      words[wordKey] = candidate;
    }
  }

  const assessmentEvidence = rebuildInitialEvidence(r.initialTest, formsMap);

  return {
    schemaVersion: SCHEMA_VERSION,
    dictVersion: r.dictVersion ?? '',
    stateVersion,
    installSeed: r.installSeed ?? '',
    words,
    assessmentEvidence,
    // schema 3 的审计冻结：仅清空 marker 与活跃计划，旧 auditLog 原样保留但不转换。
    auditMarkers: {},
    auditLog: Array.isArray(r.auditLog) ? r.auditLog : [],
    auditPlan: null,
    initialTest: r.initialTest ?? null,
    dailyTest: null,
    completedRoundIndex: 0,
    lastUpdated: typeof r.lastUpdated === 'number' ? r.lastUpdated : 0,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isValidFormsMap(forms: FormsMap): boolean {
  return Object.entries(forms).every(([surface, wordKey]) =>
    typeof surface === 'string' && surface.trim().length > 0 && typeof wordKey === 'string' && wordKey.trim().length > 0,
  );
}

/** 损坏旧状态一律丢弃，不能用默认值伪造状态后再永久持久化为 v3。 */
function parseWordState(value: unknown): WordState | null {
  if (!isRecord(value)) return null;
  const { status, source, updatedAt, version } = value;
  const validStatus = status === 'known' || status === 'learning' || status === 'unknown';
  const validSource = source === 'manual' || source === 'initial' || source === 'daily' || source === 'audit' || source === 'active-verify';
  if (!validStatus || !validSource || !Number.isFinite(updatedAt) || !Number.isFinite(version)) return null;
  return { status, source, updatedAt: updatedAt as number, version: version as number };
}

/** 两个旧 surface 状态并入同一 wordKey 时的固定仲裁。 */
function shouldReplaceWordState(current: WordState, candidate: WordState): boolean {
  if (candidate.updatedAt !== current.updatedAt) return candidate.updatedAt > current.updatedAt;
  if ((candidate.source === 'manual') !== (current.source === 'manual')) return candidate.source === 'manual';
  if ((candidate.status === 'learning') !== (current.status === 'learning')) return candidate.status === 'learning';
  return false;
}

/** 从旧首测的同下标题目/答案重建每词最新一条初测证据。 */
function rebuildInitialEvidence(initialTest: unknown, forms: FormsMap): VocabSnapshot['assessmentEvidence'] {
  if (!isRecord(initialTest)) return {};
  const test = initialTest as { plan?: unknown; answers?: unknown };
  if (!isRecord(test.plan) || !Array.isArray(test.answers)) return {};
  const questions = (test.plan as { questions?: unknown }).questions;
  if (!Array.isArray(questions)) return {};

  const evidence: VocabSnapshot['assessmentEvidence'] = {};
  for (let index = 0; index < questions.length; index++) {
    const question = questions[index];
    const answer = test.answers[index];
    if (!isRecord(question) || !isRecord(answer)) continue;
    const q = question as { word?: unknown; options?: unknown; correctOptionIndex?: unknown };
    const a = answer as { kind?: unknown; optionIndex?: unknown };
    if (typeof q.word !== 'string' || q.word.trim().length === 0 || !Array.isArray(q.options) || !Number.isInteger(q.correctOptionIndex)) continue;
    const correctOptionIndex = q.correctOptionIndex as number;
    if (correctOptionIndex < 0 || correctOptionIndex >= q.options.length) continue;

    let outcome: 'known' | 'learning';
    if (a.kind === 'unsure') {
      outcome = 'learning';
    } else if (a.kind === 'option' && Number.isInteger(a.optionIndex)) {
      const optionIndex = a.optionIndex as number;
      if (optionIndex < 0 || optionIndex >= q.options.length) continue;
      outcome = optionIndex === correctOptionIndex ? 'known' : 'learning';
    } else {
      continue;
    }

    const wordKey = forms[q.word.toLowerCase()] ?? q.word;
    if (typeof wordKey !== 'string' || wordKey.trim().length === 0) continue;
    evidence[wordKey] = { outcome, source: 'initial', assessedAt: 0 };
  }
  return evidence;
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

/** 初测与每日共用：一次写入当前状态与该词的最新测试证据。 */
export function mergeAssessment(snapshot: VocabSnapshot, settlement: AssessmentSettlement): VocabSnapshot {
  const words = {
    ...snapshot.words,
    [settlement.change.word]: {
      status: settlement.change.newStatus,
      source: settlement.change.source,
      updatedAt: settlement.evidence.assessedAt,
      version: snapshot.stateVersion,
    },
  };
  const assessmentEvidence = {
    ...snapshot.assessmentEvidence,
    [settlement.change.word]: settlement.evidence,
  };
  return { ...snapshot, words, assessmentEvidence, lastUpdated: settlement.evidence.assessedAt };
}

/**
 * 写入每日测试状态并协调 completedRoundIndex 递增时机（R-DLY-2）。
 * - completed 首次变 true 时把 completedRoundIndex 递增一次；
 * - 未完成轮（completed=false）绝不递增；
 * - 已完成轮再次传入 completed=true（防御性）不二次递增（幂等）；
 * - 跨日替换旧轮（新轮 completed=false）不递增——旧轮若已完成，其递增早已发生。
 */
export function mergeDailyTest(snapshot: VocabSnapshot, test: DailyTestState): VocabSnapshot {
  const wasCompleted = snapshot.dailyTest?.completed === true;
  const nowCompleted = test.completed === true;
  const completedRoundIndex =
    nowCompleted && !wasCompleted ? snapshot.completedRoundIndex + 1 : snapshot.completedRoundIndex;
  return {
    ...snapshot,
    dailyTest: test,
    completedRoundIndex,
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
