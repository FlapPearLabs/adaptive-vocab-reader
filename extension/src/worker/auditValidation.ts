// ============================================================
// 审计作答服务端权威校验（纯函数，可单测）
// ============================================================
// worker 在调用策略 Module 生成原子变更前，先依持久化冻结审计计划验证请求。
// 不信任客户端传入的 auditPlanVersion / index / 候选资格：
//   - 必须存在冻结审计计划；
//   - 客户端 auditPlanVersion 必须与持久化计划 version 一致；
//   - index 必须在候选范围内且尚未结算；
//   - 候选词必须有 auditMarker（V0.1 仅支持池 A 单次初测答对词；
//     池 B 高置信未知词无 marker，高置信机制未建，拒绝）。
// ============================================================

import type { AuditPlan, AuditMarker } from '../shared/types';

export type AuditValidation = { readonly ok: true } | { readonly ok: false; readonly error: string };

export function validateAuditAnswerRequest(
  plan: AuditPlan | null,
  auditPlanVersion: string,
  index: number,
  markers: Record<string, AuditMarker>,
): AuditValidation {
  if (!plan) {
    return { ok: false, error: 'no frozen audit plan' };
  }
  if (plan.version !== auditPlanVersion) {
    return { ok: false, error: 'audit plan version mismatch' };
  }
  if (index < 0 || index >= plan.candidates.length) {
    return { ok: false, error: 'index out of range' };
  }
  if (plan.results[index] !== null) {
    return { ok: false, error: 'already settled' };
  }
  const candidate = plan.candidates[index]!;
  if (!markers[candidate.word]) {
    return { ok: false, error: 'candidate has no audit marker (pool B not supported in V0.1)' };
  }
  return { ok: true };
}
