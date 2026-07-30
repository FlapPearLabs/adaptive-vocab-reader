// ============================================================
// 审计（Spec B §8：单次答对审计标记的生命周期 + §6 作答前冻结）
// ============================================================
// 策略包的内部实现模块：弹窗、Service Worker、内容脚本、存储适配器
// 一律经 `strategy/index.ts` 的深 Module Interface 消费，不得直接 import 本文件。
//
// 隐藏词审计在两类候选之间交替抽取：
//   - 池 A：仍为会、来源单次初测答对、待审计标记的词
//   - 池 B：当前高置信不提示的未知词（V0.1 高置信机制未建，通常为空）
// 某类为空时由另一类补位；各频段按覆盖不足优先，段内按稳定哈希均匀抽取。
// 同一（种子 + 计划版本 + 轮次 + 候选快照）可复现选择。
//
// 作答前冻结：freezeAuditPlan 一次性产出冻结 AuditPlan（候选 + 题目 + 结算位），
// 持久化后 worker 据此验证审计作答，不信任客户端传入的 planVersion/bucket/候选资格。
// ============================================================

import type {
  AuditMarker,
  WordState,
  WordStatus,
  DictCore,
  FrequencyBands,
  StateChange,
  AuditBucket,
  AuditCandidate,
  AuditPlanCandidate,
  AuditPlan,
  AuditEvent,
  AuditOutcome,
  QuizQuestion,
  QuizAnswer,
  FreezeAuditPlanInput,
  SettleAuditAnswerInput,
  SettleAuditResult,
} from '../shared/types';
import { buildQuestion, isAnswerCorrect, hashString } from './quiz';
import { auditPlanVersion } from '../shared/auditPlanVersion';

const BAND_COUNT = 10;

export interface SelectAuditOptions {
  /** 当前高置信不提示的未知词（池 B 候选）；V0.1 高置信机制未建时传空 */
  highConfidenceWords?: readonly string[];
  /** 审计轮次，用于在不同轮之间改变段内抽取顺序（默认 0） */
  round?: number;
}

function bandOf(bands: FrequencyBands, word: string): number {
  return bands[word] ?? BAND_COUNT - 1;
}

/**
 * 从审计候选池确定性地选择最多 `count` 个审计候选（内部 helper）。
 *
 * 规则（Spec B §8）：
 * - 池 A：markers 中 planVersion 匹配、pending 且当前状态仍为 known 的词；
 * - 池 B：highConfidenceWords 中当前状态为 unknown 的词；
 * - 两类之间交替抽取（偶数位优先池 A，奇数位优先池 B），某类为空由另一类补位；
 * - 每段按覆盖不足（已选区最少）优先，段内按 `种子::计划版本::轮次::词` 的稳定哈希排序。
 */
function selectAuditCandidates(
  markers: Record<string, AuditMarker>,
  words: Record<string, WordState>,
  bands: FrequencyBands,
  seed: string,
  planVersion: string,
  count: number,
  opts: SelectAuditOptions = {},
): AuditCandidate[] {
  const round = opts.round ?? 0;
  const highConf = new Set(opts.highConfidenceWords ?? []);

  const poolA: AuditCandidate[] = Object.values(markers)
    .filter((m) => m.planVersion === planVersion && m.pending && words[m.word]?.status === 'known')
    .map((m) => ({ word: m.word, bucket: 'initial-correct' as AuditBucket, band: bandOf(bands, m.word) }));

  const poolB: AuditCandidate[] = Object.keys(words)
    .filter((w) => highConf.has(w) && words[w]!.status === 'unknown')
    .map((w) => ({ word: w, bucket: 'high-confidence' as AuditBucket, band: bandOf(bands, w) }));

  const selected: AuditCandidate[] = [];
  const used = new Set<string>();
  const bandCoverage = new Array<number>(BAND_COUNT).fill(0);

  const takeFrom = (pool: AuditCandidate[]): AuditCandidate | null => {
    let bestBand = -1;
    let bestCov = Infinity;
    for (let b = 0; b < BAND_COUNT; b++) {
      const has = pool.some((c) => !used.has(c.word) && c.band === b);
      if (!has) continue;
      if (bandCoverage[b]! < bestCov) {
        bestCov = bandCoverage[b]!;
        bestBand = b;
      }
    }
    if (bestBand < 0) return null;

    const inBand = pool
      .filter((c) => !used.has(c.word) && c.band === bestBand)
      .sort(
        (a, b) =>
          hashString(`${seed}::audit::${planVersion}::${round}::${a.word}`) -
          hashString(`${seed}::audit::${planVersion}::${round}::${b.word}`),
      );
    return inBand[0] ?? null;
  };

  for (let i = 0; i < count; i++) {
    const preferA = i % 2 === 0;
    const choice = preferA ? takeFrom(poolA) ?? takeFrom(poolB) : takeFrom(poolB) ?? takeFrom(poolA);
    if (!choice) break;
    used.add(choice.word);
    bandCoverage[choice.band] = (bandCoverage[choice.band] ?? 0) + 1;
    selected.push(choice);
  }

  return selected;
}

/** 计算冻结审计计划版本（确定性）：planVersion + seed + 候选内容 + 题目内容哈希（见 shared/auditPlanVersion） */

/**
 * 冻结审计计划（Spec B §8 + §6 作答前冻结）。
 * 从候选池确定性地选最多 count 题，为每题冻结审计题（含正确选项下标）与结算位。
 * 返回的 AuditPlan 由调用方持久化；作答时 worker 据此冻结计划验证请求。
 */
export function freezeAuditPlan(input: FreezeAuditPlanInput): AuditPlan {
  const candidates = selectAuditCandidates(
    input.markers,
    input.words,
    input.bands,
    input.seed,
    input.planVersion,
    input.count,
    { highConfidenceWords: input.highConfidenceWords, round: input.round },
  );

  const planCandidates: AuditPlanCandidate[] = candidates.map((c) => ({
    word: c.word,
    bucket: c.bucket,
    band: c.band,
  }));
  const questions: QuizQuestion[] = planCandidates.map((c, i) =>
    buildQuestion(c.word, input.core, input.bands, input.seed, i),
  );
  const version = auditPlanVersion(input.seed, input.planVersion, planCandidates, questions);

  return {
    version,
    planVersion: input.planVersion,
    stateVersion: input.stateVersion,
    seed: input.seed,
    candidates: planCandidates,
    questions,
    results: planCandidates.map(() => null),
    createdAt: Date.now(),
  };
}

/**
 * 结算一道冻结的审计题（Spec B §8）。
 * 调用方（worker）须先依持久化冻结计划验证：index 在范围、未结算、计划版本匹配。
 * 本函数假定输入已通过验证，只负责生成原子状态变更与审计事件，并翻转结算位。
 *
 * - 答对：状态改为会（source='audit'），清除该词待审计标记，记录 verified 事件；
 * - 答错 / 不确定：状态改为不会（source='audit'），清除待审计标记，记录 failed 事件。
 */
export function settleAuditAnswer(input: SettleAuditAnswerInput): SettleAuditResult {
  const { plan, index, answer, current: _current } = input;
  const candidate = plan.candidates[index]!;
  const question = plan.questions[index]!;

  const correct = isAnswerCorrect(question, answer);
  const outcome: AuditOutcome = correct ? 'verified' : 'failed';
  const newStatus: WordStatus = correct ? 'known' : 'learning';

  const change: StateChange<'audit'> = { word: candidate.word, newStatus, source: 'audit' };
  const event: AuditEvent = {
    word: candidate.word,
    outcome,
    bucket: candidate.bucket,
    planVersion: plan.planVersion,
    at: Date.now(),
  };

  const results = plan.results.slice();
  results[index] = outcome;
  const newPlan: AuditPlan = { ...plan, results };

  return { kind: outcome, plan: newPlan, change, clearedWord: candidate.word, event };
}
