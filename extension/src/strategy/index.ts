import type { VocabStrategy, DisplayResult, StateChange, LookupContext, WordState } from '../shared/types';

/**
 * V0.1 词汇展示与测试策略模块
 *
 * 此为最高测试 seam：所有展示决策、状态变更只能由此模块计算；
 * 页面、存储适配器只能消费其结果，不得重算。
 *
 * V0.1 最小闭环规则：
 * - known (会)    → 不提示
 * - learning (不会) → 强提示（行内中文 + 下划线）
 * - unknown (未知)  → 轻提示（下划线 + 悬停查看）
 */
export function createVocabStrategy(): VocabStrategy {
  return {
    getDisplayDecision(ctx: LookupContext, state: WordState | undefined): DisplayResult {
      const base: DisplayResult = {
        word: ctx.word,
        decision: 'none',
        surfaceForm: ctx.surfaceForm,
        translation: null,
        showInlineTranslation: false,
      };

      // 未命中词典 → 不提示
      if (!ctx.entry) {
        return base;
      }

      // 根据状态决定展示等级
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
  };
}
