// ============================================================
// 词汇展示与测试策略 —— 唯一的深 Module Interface（最高测试 seam）
// ============================================================
// 规格：所有展示决策、冻结题目计划与状态变更只能由本模块计算；
// 页面扫描、弹窗 UI、Service Worker、存储适配器只能消费本模块的输出，
// 不得自行重算 P(会)、阈值、抽样顺序或审计清理，也不得直接 import
// `./quiz.ts` 或 `./audit.ts`（它们是本包的内部实现模块）。
//
// 本 facade 把首测/审计的「冻结计划 + 结算单题」收敛为四个领域动作，
// 而非把 buildQuestion/applyAnswer/selectAuditCandidates 等内部函数逐一浅转发。
// ============================================================

import type {
  VocabStrategy,
  DisplayResult,
  ManualMarkResult,
  LookupContext,
  WordState,
  InitialTestPlan,
  InitialTestState,
  ApplyAnswerResult,
  AuditPlan,
  FreezeInitialTestInput,
  SettleInitialTestInput,
  FreezeAuditPlanInput,
  SettleAuditAnswerInput,
  SettleAuditResult,
  InitialTestStartTransition,
  InitialTestResetTransition,
  AuditMarker,
  AssessmentSettlement,
  AssessmentSettlementInput,
  DailyTestState,
  FreezeDailyTestInput,
  SettleDailyTestAnswerInput,
} from '../shared/types';
import { buildInitialTestPlan, applyAnswer } from './quiz';
import { freezeAuditPlan, settleAuditAnswer } from './audit';
import { buildDailyTestState, settleDailyAnswerImpl, dailyBandsForRound } from './daily';

// 重新导出常量，供调用方经本模块消费（不直连 quiz.ts）
export { INITIAL_TEST_LENGTH } from '../shared/types';

// 每日校准轮（Ticket 04）：选题/结算纯函数 seam（R-DLY-1~9 / R-EVD-5）。
// 调用方（popup/worker）经本模块消费，不直连 daily.ts。
export { DAILY_TEST_LENGTH } from '../shared/types';
export { dailyBandsForRound } from './daily';
export type { DailyTestState, FreezeDailyTestInput, SettleDailyTestAnswerInput } from '../shared/types';

// 词汇量估计纯函数 seam（R-EST-1~7）：估计只读取 AssessmentEvidence，
// 词包大小为显式参数；调用方（popup）经本模块消费，不直连 estimate.ts。
export {
  WILSON_Z_95,
  wilsonBandInterval,
  collectBandEvidence,
  countBandWords,
  estimateVocabulary,
} from './estimate';
export type {
  BandEstimateStats,
  EstimateVocabularyInput,
  VocabularyEstimateResult,
} from './estimate';

/**
 * V0.1 词汇展示与测试策略模块。
 *
 * V0.1 最小闭环规则：
 * - known (会)    → 不提示
 * - learning (不会) → 强提示（行内中文 + 下划线）
 * - unknown (未知)  → 轻提示（下划线 + 悬停查看）
 */
export function createVocabStrategy(): VocabStrategy {
  return {
    // ---- 展示决策 ----
    getDisplayDecision(ctx: LookupContext, state: WordState | undefined): DisplayResult {
      const base: DisplayResult = {
        word: ctx.word,
        decision: 'none',
        surfaceForm: ctx.surfaceForm,
        translation: null,
        showInlineTranslation: false,
      };

      if (!ctx.entry) {
        return base;
      }

      const status: WordState['status'] = state?.status ?? 'unknown';

      switch (status) {
        case 'known':
          base.decision = 'none';
          break;
        case 'learning':
          base.decision = 'strong';
          base.translation = ctx.entry.translation;
          base.showInlineTranslation = ctx.occurrenceCount === 1;
          break;
        case 'unknown':
          base.decision = 'light';
          base.translation = ctx.entry.translation;
          break;
      }

      return base;
    },

    markKnown(word: string): ManualMarkResult {
      return { change: { word, newStatus: 'known', source: 'manual' }, clearMarker: true };
    },

    markLearning(word: string): ManualMarkResult {
      return { change: { word, newStatus: 'learning', source: 'manual' }, clearMarker: true };
    },

    // ---- 首测：冻结计划 + 结算单题 ----
    freezeInitialTestPlan(input: FreezeInitialTestInput): InitialTestPlan {
      return buildInitialTestPlan(input.core, input.forms, input.bands, input.seed, input.dictVersion);
    },

    settleInitialTestAnswer(input: SettleInitialTestInput): ApplyAnswerResult {
      return applyAnswer(input.plan, input.questionIndex, input.answer, input.current);
    },

    settleAssessment(input: AssessmentSettlementInput): AssessmentSettlement {
      // 一个显式测试动作同步产生当前 WordState 与独立的最新 AssessmentEvidence；不保存历史。
      return {
        change: { word: input.word, newStatus: input.outcome, source: input.source },
        evidence: { outcome: input.outcome, source: input.source, assessedAt: input.assessedAt },
      };
    },

    // ---- 每日校准轮：冻结计划 + 结算单题 ----
    freezeDailyTest(input: FreezeDailyTestInput, localDate: string): DailyTestState {
      return buildDailyTestState(input, localDate);
    },

    settleDailyAnswer(input: SettleDailyTestAnswerInput): ApplyAnswerResult {
      return settleDailyAnswerImpl(input);
    },

    // ---- 首测开始/重置：策略生成的完整生命周期 transition（worker 机械应用）----
    startInitialTest(plan: InitialTestPlan, stateVersion: number): InitialTestStartTransition {
      // 开始新一轮首测：递增状态版本以隔离本轮。
      const nextStateVersion = stateVersion + 1;
      // 按现行规格清空上一轮全部待审计标记：任何 stateVersion === nextStateVersion 的
      // 「异常 marker」（合法流程不可能产生）同样被排除——直接清空整个标记映射即可同时
      // 满足「清空旧标记」与「不保留异常 marker」。标记清理由策略收口，worker 不再解释布尔。
      const auditMarkers: Record<string, AuditMarker> = {};
      // 真实使用传入 plan 构造完整首测状态（answers 全 null、completed:false）。
      const initialTest: InitialTestState = {
        plan,
        answers: Array.from({ length: plan.questions.length }, () => null),
        completed: false,
      };
      return { nextStateVersion, auditMarkers, auditPlan: null, initialTest };
    },

    resetInitialTest(stateVersion: number): InitialTestResetTransition {
      // 重置：递增状态版本、清空所有待审计标记、清除冻结计划与首测状态。
      // 完整片段由策略直接给出，worker 仅机械合并，不得自行构造 InitialTestState 或解释布尔。
      return { nextStateVersion: stateVersion + 1, auditMarkers: {}, auditPlan: null, initialTest: null };
    },

    // ---- 审计：冻结计划 + 结算单题 ----
    freezeAuditPlan(input: FreezeAuditPlanInput): AuditPlan {
      return freezeAuditPlan(input);
    },

    settleAuditAnswer(input: SettleAuditAnswerInput): SettleAuditResult {
      return settleAuditAnswer(input);
    },
  };
}
