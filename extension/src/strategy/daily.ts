// ============================================================
// 每日校准轮（每日五题）—— 策略包的内部实现模块
// ============================================================
// 领域规则（RULES.md「每日校准轮」/ Spec §14 / §15）：
// - 每轮固定五题；completedRoundIndex 为偶数轮选频段 0/2/4/6/8、奇数轮 1/3/5/7/9，
//   每个选中频段一题；只有完成整轮才递增 completedRoundIndex（递增时机由 worker/storage 协调）。
// - 选词只读取 AssessmentEvidence（R-EVD-5）：优先无证据的 wordKey、同轮不重复、
//   install seed 确定性排序、未测候选耗尽后取 assessedAt 最早的旧词。
// - 题型复用首测的四选一＋不确定与冻结机制。
// - date seam：localDate 是最小可测试输入（纯函数参数），不建时间服务。
//
// 本模块是策略包的内部实现：弹窗、Service Worker、存储适配器一律经
// `strategy/index.ts` 的深 Module Interface 消费，不得直接 import 本文件。
// ============================================================

import type {
  DictCore,
  FormsMap,
  FrequencyBands,
  AssessmentEvidence,
  QuizAnswer,
  QuizQuestion,
  DailyTestState,
  FreezeDailyTestInput,
  SettleDailyTestAnswerInput,
  StateChange,
  ApplyAnswerResult,
} from '../shared/types';
import {
  eligibleCandidates,
  buildQuestion,
  createRng,
  shuffle,
  isAnswerCorrect,
  statusFromCorrectness,
} from './quiz';

/**
 * 每日轮的频段选择：偶数轮取 0/2/4/6/8，奇数轮取 1/3/5/7/9（R-DLY-1）。
 */
export function dailyBandsForRound(roundIndex: number): readonly number[] {
  return roundIndex % 2 === 0 ? [0, 2, 4, 6, 8] : [1, 3, 5, 7, 9];
}

/**
 * 冻结每日五题计划（R-DLY-1 / R-DLY-3 / R-EVD-5）。
 *
 * 选词契约：
 * - 只读取 input.evidence（AssessmentEvidence）判断「是否已测」「最久未测」；
 *   不读取 WordState，也不按 WordState.source 过滤（R-EVD-5）。
 * - 每个选中频段：优先没有 AssessmentEvidence 的 wordKey；全部耗尽后
 *   取 assessedAt 最早的旧词（并列时保持确定性排序顺序）。
 * - 同轮不重复：不同频段词池天然互斥（一个 wordKey 只属于一个频段）；
 *   计划产出后由调用方/测试再做防御断言。
 * - 确定性：install seed + 频段盐驱动排序，同 (seed, dict, round, evidence) 完全可复现。
 *
 * @param input 受控词典视图 + 安装种子 + 当前轮次 + 测试证据
 * @param localDate 创建计划时的本地日期（date seam 最小输入；不建时间服务）
 */
export function buildDailyTestState(input: FreezeDailyTestInput, localDate: string): DailyTestState {
  const bands = dailyBandsForRound(input.completedRoundIndex);
  const eligible = eligibleCandidates(input.core, input.forms);

  const questions: QuizQuestion[] = [];
  for (const band of bands) {
    const pool = eligible.filter((word) => (input.bands[word] ?? 9) === band);
    const untested = pool.filter((word) => !input.evidence[word]);
    // 优先无证据候选；耗尽后以 assessedAt 最早回退（R-DLY-3 / Spec §24）。
    const chosen = pickDailyWord(
      untested.length > 0 ? untested : pool,
      input.seed,
      band,
      untested.length === 0 ? input.evidence : undefined,
    );
    if (!chosen) {
      // 生产 1,000 词包每频段必有候选；防御性失败，绝不静默产出少于五题的轮次。
      throw new Error(`daily: band ${band} has no eligible candidate`);
    }
    questions.push(buildQuestion(chosen, input.core, input.bands, input.seed, band));
  }

  return {
    localDate,
    roundIndex: input.completedRoundIndex,
    questions,
    answers: Array.from({ length: questions.length }, () => null),
    completed: false,
    skipped: false,
  };
}

/**
 * 在频段候选池中确定性地选一个词。
 * - 有未测候选：按 install seed + 频段盐排序后取第一个；
 * - 全部已测（evidence 传入）：排序后再按 assessedAt 升序，取最旧者。
 */
function pickDailyWord(
  pool: readonly string[],
  seed: string,
  band: number,
  evidence: Record<string, AssessmentEvidence> | undefined,
): string | undefined {
  if (pool.length === 0) return undefined;
  const ordered = shuffle(pool, createRng(seed, `daily:band:${band}`));
  if (evidence === undefined) return ordered[0];
  // JS sort 稳定：assessedAt 相同时保持确定性排序顺序。
  const byAge = [...ordered].sort(
    (a, b) => (evidence[a]?.assessedAt ?? 0) - (evidence[b]?.assessedAt ?? 0),
  );
  return byAge[0];
}

/**
 * 结算一道冻结的每日题（R-DLY-4 的判定部分）。
 * 答对 → known；答错 / 不确定 → learning（与首测同语义）；
 * 双写（WordState + AssessmentEvidence，source=daily）由调用方经 settleAssessment 完成。
 * V0.1 用户路径不产出审计标记。
 */
export function settleDailyAnswerImpl(input: SettleDailyTestAnswerInput): ApplyAnswerResult {
  const { question, answer } = input;
  const correct = isAnswerCorrect(question, answer);
  const change: StateChange<'initial'> = {
    word: question.word,
    newStatus: statusFromCorrectness(correct),
    source: 'initial',
  };
  if (answer.kind === 'unsure' || !correct) {
    return {
      kind: answer.kind === 'unsure' ? 'unsure' : 'wrong',
      change,
      audit: null,
      clearMarkerWord: question.word,
    };
  }
  return { kind: 'correct', change, clearMarkerWord: null };
}
