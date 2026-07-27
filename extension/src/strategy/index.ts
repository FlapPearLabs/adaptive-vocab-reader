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
  StateChange,
  LookupContext,
  WordState,
  InitialTestPlan,
  ApplyAnswerResult,
  AuditPlan,
  FreezeInitialTestInput,
  SettleInitialTestInput,
  FreezeAuditPlanInput,
  SettleAuditAnswerInput,
  SettleAuditResult,
} from '../shared/types';
import { buildInitialTestPlan, applyAnswer } from './quiz';
import { freezeAuditPlan, settleAuditAnswer } from './audit';

// 重新导出常量，供调用方经本模块消费（不直连 quiz.ts）
export { INITIAL_TEST_LENGTH } from '../shared/types';

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

    markKnown(word: string): StateChange<'manual'> {
      return { word, newStatus: 'known', source: 'manual' };
    },

    markLearning(word: string): StateChange<'manual'> {
      return { word, newStatus: 'learning', source: 'manual' };
    },

    // ---- 首测：冻结计划 + 结算单题 ----
    freezeInitialTestPlan(input: FreezeInitialTestInput): InitialTestPlan {
      return buildInitialTestPlan(input.core, input.forms, input.bands, input.seed, input.dictVersion);
    },

    settleInitialTestAnswer(input: SettleInitialTestInput): ApplyAnswerResult {
      return applyAnswer(input.plan, input.questionIndex, input.answer, input.current);
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
