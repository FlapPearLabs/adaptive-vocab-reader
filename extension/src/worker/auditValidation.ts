// ============================================================
// 审计作答 / 冻结审计计划 服务端权威校验（纯函数，可单测）
// ============================================================
// worker 在调用策略 Module 生成原子变更前，先依持久化冻结审计计划验证请求。
// 不信任客户端传入的 auditPlanVersion / index / 候选资格：
//   - 必须存在冻结审计计划；
//   - 客户端 auditPlanVersion 必须与持久化计划 version 一致；
//   - index 必须在候选范围内且尚未结算；
//   - 候选词必须有 auditMarker（V0.1 仅支持池 A 单次初测答对词；
//     池 B 高置信未知词无 marker，高置信机制未建，明确 deferred）；
//   - 计划与标记的状态版本（stateVersion）必须与当前快照一致，以隔离「相同种子重测」；
//   - 标记必须 pending、planVersion 与冻结计划一致、且池 A 当前仍为 known。
//
// 冻结审计计划（FREEZE_AUDIT_PLAN）由受信任 popup 生成，worker 验证其 sender 与
// 结构完整性（计划版本/种子/状态版本/候选-题目配对/候选-标记绑定/题目内容/版本可重算），
// 不凭空信任客户端传入的计划内容。
//
// 本文件**不得**直接 import `strategy/audit.ts`：审计计划完整性哈希经共享模块
// `shared/auditPlanVersion.ts` 计算，worker（校验重算）与 strategy/audit.ts（生成）
// 共用同一实现，从而保持策略 seam 闭合。
// ============================================================

import type { AuditPlan, AuditMarker, VocabSnapshot, WordState, QuizQuestion, AuditBucket } from '../shared/types';
import { auditPlanVersion as computeAuditPlanVersion } from '../shared/auditPlanVersion';

export type AuditValidation = { readonly ok: true } | { readonly ok: false; readonly error: string };

const ALLOWED_BUCKETS: readonly AuditBucket[] = ['initial-correct', 'high-confidence'];

/**
 * 校验单道冻结审计题的结构完整性（防客户端篡改题目内容）。
 * 返回错误字符串（中文）或 null 表示通过。
 */
function validateQuestionShape(q: QuizQuestion): string | null {
  if (!q || typeof q.word !== 'string') return 'question missing word';
  if (!Number.isInteger(q.band) || q.band < 0 || q.band > 9) return `question band out of range: ${q.band}`;
  if (q.unsureIndex !== 4) return `unsureIndex must be 4, got ${q.unsureIndex}`;
  const opts = q.options;
  if (!Array.isArray(opts) || opts.length !== 4) return `expected 4 options, got ${Array.isArray(opts) ? opts.length : 'n/a'}`;
  // 互异翻译
  const translations = opts.map((o) => o.translation);
  if (new Set(translations).size !== translations.length) return 'options are not distinct translations';
  // 唯一正确项
  const correctIdxs = opts.map((o, i) => (o.isCorrect ? i : -1)).filter((i) => i >= 0);
  if (correctIdxs.length !== 1) return `expected exactly one correct option, got ${correctIdxs.length}`;
  if (q.correctOptionIndex !== correctIdxs[0]) return 'correctOptionIndex does not point to the correct option';
  if (!Number.isInteger(q.correctOptionIndex) || q.correctOptionIndex < 0 || q.correctOptionIndex > 3) {
    return `correctOptionIndex out of range: ${q.correctOptionIndex}`;
  }
  return null;
}

export function validateAuditAnswerRequest(
  plan: AuditPlan | null,
  auditPlanVersion: string,
  index: number,
  markers: Record<string, AuditMarker>,
  words: Record<string, WordState>,
  snapshotStateVersion: number,
): AuditValidation {
  if (!plan) {
    return { ok: false, error: 'no frozen audit plan' };
  }
  // 重新计算持久化冻结计划的完整性哈希（覆盖候选 + 题目内容含翻译/isCorrect/顺序），
  // 防御「存储中的冻结计划被篡改（如替换选项翻译却保留旧 version）」：
  // 服务端以自身存储的计划重算，若与其自身 version 不一致则拒绝。
  const expectedVersion = computeAuditPlanVersion(plan.seed, plan.planVersion, plan.candidates, plan.questions);
  if (plan.version !== expectedVersion) {
    return { ok: false, error: 'audit plan version not reproducible (frozen plan content tampered)' };
  }
  if (plan.version !== auditPlanVersion) {
    return { ok: false, error: 'audit plan version mismatch' };
  }
  // 计划状态版本必须与当前快照一致（相同种子重测后旧计划不再接受 = 过期计划）
  if (plan.stateVersion !== snapshotStateVersion) {
    return { ok: false, error: 'audit plan state version mismatch (expired plan)' };
  }
  if (index < 0 || index >= plan.candidates.length) {
    return { ok: false, error: 'index out of range' };
  }
  if (plan.results[index] !== null) {
    return { ok: false, error: 'already settled (cannot re-settle)' };
  }
  const candidate = plan.candidates[index]!;
  const marker = markers[candidate.word];
  if (!marker) {
    // 池 B（高置信未知词）无 marker：机制未建，明确 deferred，但属于 V0.1 完整规格内
    return { ok: false, error: 'candidate has no audit marker (pool B high-confidence is deferred within V0.1 spec, not yet implemented)' };
  }
  // 标记必须 pending（已结算/清除后再提交的请求视为陈旧）
  if (!marker.pending) {
    return { ok: false, error: 'audit marker is not pending' };
  }
  // 标记的计划版本必须与冻结计划一致（重测产生的旧计划对应标记须被拒）
  if (marker.planVersion !== plan.planVersion) {
    return { ok: false, error: 'audit marker planVersion mismatch (likely re-tested old plan)' };
  }
  // 候选标记的状态版本必须与当前快照一致，否则为上一轮残留
  if (marker.stateVersion !== snapshotStateVersion) {
    return { ok: false, error: 'candidate marker state version mismatch' };
  }
  // 池 A：当前状态仍须为 known（手动覆盖/状态变更后不得据此作答）
  const wordState = words[candidate.word];
  if (!wordState || wordState.status !== 'known') {
    return { ok: false, error: 'candidate must be known for pool A audit' };
  }
  return { ok: true };
}

/**
 * 校验受信任 popup 提交的冻结审计计划结构与服务端状态一致。
 * 返回 ok 表示 worker 可原样持久化该计划（"worker 验证并持久化受信任 popup 生成的冻结计划"）。
 */
export function validateFrozenAuditPlan(plan: AuditPlan, snapshot: VocabSnapshot): AuditValidation {
  const initialTest = snapshot.initialTest;
  if (!initialTest || !initialTest.completed) {
    return { ok: false, error: 'initial test not completed; cannot freeze audit plan' };
  }
  if (plan.planVersion !== initialTest.plan.version) {
    return { ok: false, error: 'frozen plan planVersion does not match initial test plan version' };
  }
  if (plan.seed !== snapshot.installSeed) {
    return { ok: false, error: 'frozen plan seed does not match install seed' };
  }
  if (plan.stateVersion !== snapshot.stateVersion) {
    return { ok: false, error: 'frozen plan stateVersion does not match snapshot stateVersion' };
  }
  if (plan.candidates.length === 0 || plan.candidates.length !== plan.questions.length || plan.questions.length !== plan.results.length) {
    return { ok: false, error: 'candidates/questions/results length mismatch' };
  }
  if (!plan.results.every((r) => r === null)) {
    return { ok: false, error: 'frozen plan results must all be null before settlement' };
  }
  // 候选无重复
  const seen = new Set<string>();
  for (const c of plan.candidates) {
    if (seen.has(c.word)) return { ok: false, error: 'duplicate candidate word' };
    seen.add(c.word);
  }
  // 候选与题目一一对应；bucket 判别联合合法；题目内容完整；池 A 每候选标记合法
  for (let i = 0; i < plan.candidates.length; i++) {
    const candidate = plan.candidates[i]!;
    const question = plan.questions[i]!;

    // bucket 必须是允许的判别联合值
    if (!ALLOWED_BUCKETS.includes(candidate.bucket)) {
      return { ok: false, error: `invalid audit bucket: ${String(candidate.bucket)}` };
    }
    // 候选与题目配对（同一词）
    if (question.word !== candidate.word) {
      return { ok: false, error: 'candidate/question word mismatch' };
    }
    // band 合法性 + 候选/题目 band 一致
    if (!Number.isInteger(candidate.band) || candidate.band < 0 || candidate.band > 9) {
      return { ok: false, error: `candidate band out of range: ${candidate.band}` };
    }
    if (!Number.isInteger(question.band) || question.band < 0 || question.band > 9) {
      return { ok: false, error: `question band out of range: ${question.band}` };
    }
    if (candidate.band !== question.band) {
      return { ok: false, error: 'candidate band does not match question band' };
    }
    // 题目内容结构完整性
    const qErr = validateQuestionShape(question);
    if (qErr) return { ok: false, error: `question ${i} invalid: ${qErr}` };

    if (candidate.bucket === 'high-confidence') {
      // 池 B（高置信未知词）V0.1 机制未建，明确 deferred（但属 V0.1 完整规格内），拒绝
      return { ok: false, error: 'pool B (high-confidence) is deferred within V0.1 spec, not yet implemented' };
    }
    const marker = snapshot.auditMarkers[candidate.word];
    if (!marker) {
      return { ok: false, error: `candidate ${candidate.word} has no audit marker` };
    }
    if (!marker.pending) {
      return { ok: false, error: `candidate ${candidate.word} marker not pending` };
    }
    if (marker.planVersion !== plan.planVersion) {
      return { ok: false, error: `candidate ${candidate.word} marker planVersion mismatch` };
    }
    if (marker.stateVersion !== plan.stateVersion) {
      return { ok: false, error: `candidate ${candidate.word} marker stateVersion mismatch` };
    }
    const wordState = snapshot.words[candidate.word];
    if (!wordState || wordState.status !== 'known') {
      return { ok: false, error: `candidate ${candidate.word} must be known (initial-correct)` };
    }
  }
  // 版本可重算（覆盖候选 + 冻结题目内容）：客户端无法伪造不一致的 version
  const recomputed = computeAuditPlanVersion(plan.seed, plan.planVersion, plan.candidates, plan.questions);
  if (recomputed !== plan.version) {
    return { ok: false, error: 'audit plan version not reproducible (candidate/question tampered)' };
  }
  return { ok: true };
}
