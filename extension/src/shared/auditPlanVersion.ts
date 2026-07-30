// ============================================================
// 冻结审计计划完整性哈希（中性共享模块）
// ============================================================
// 放在 shared 层而非 strategy/audit.ts：worker 的审计校验（auditValidation.ts）
// 必须能独立重算该哈希，而不得直接 import strategy/audit.ts（保持策略 seam 闭合）。
// 同时 strategy/audit.ts 的 freezeAuditPlan 也经此模块计算，保证「生成」与「校验重算」
// 使用同一实现，不会因两处实现漂移而误拒/误受。
//
// 哈希负载覆盖：seed、planVersion、候选（word/bucket/band）、
// 题目（word/band/correctOptionIndex/unsureIndex）、每个 option 的 translation +
// isCorrect + 顺序。任何一项被替换都会使重算哈希与持久化 version 不一致，从而被服务端拒绝。
//
// 序列化方式：对仅含受控字段的嵌套数组执行**稳定 JSON.stringify**（数组元素顺序固定、
// 基本类型），不使用任何未转义的定界符（`:` `,` `|`）。早期实现用未转义定界符拼接，
// 当 translation 文本自身携带这些字符时会破坏字段边界、产生拼接歧义/碰撞（见
// auditPlanVersion.test.ts 的「分隔符碰撞回归」）。结构化数组序列化从根本上消除该歧义。
//
// 注意：FNV-1a 仅提供**确定性一致性校验**，不构成密码学防篡改（非抗碰撞哈希）。
// 其用途是「持久化计划被改 → 重算不一致 → 拒绝」，而非抵御故意伪造攻击。

import type { AuditPlanCandidate, QuizQuestion } from './types';

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * 确定性计算冻结审计计划版本（完整性哈希）。
 * @returns `${planVersion}:${seed}:${hash}` 形式，供持久化与作答校验一致比对。
 */
export function auditPlanVersion(
  seed: string,
  planVersion: string,
  candidates: readonly AuditPlanCandidate[],
  questions: readonly QuizQuestion[],
): string {
  // 受控字段组成的嵌套数组：顺序固定、元素均为基本类型，JSON.stringify 输出确定且
  // 无定界符歧义。options 内部保证 4 个互异翻译且恰好一个 isCorrect（由 freezeAuditPlan
  // 与 validateQuestionShape 双重约束），序列化顺序固定为 [isCorrect?1:0, translation]。
  const payload = JSON.stringify({
    seed,
    planVersion,
    candidates: candidates.map((c) => [c.word, c.bucket, c.band]),
    questions: questions.map((q) => [
      q.word,
      q.band,
      q.correctOptionIndex,
      q.unsureIndex,
      q.options.map((o) => [o.isCorrect ? 1 : 0, o.translation]),
    ]),
  });
  const h = fnv1a(payload);
  return `${planVersion}:${seed}:${h.toString(16).padStart(8, '0')}`;
}
