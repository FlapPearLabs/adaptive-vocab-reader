import { describe, it, expect } from 'vitest';
import { createVocabStrategy } from './index';
import type { LookupContext, WordState } from '../shared/types';

function ctx(overrides: Partial<LookupContext> = {}): LookupContext {
  return {
    word: 'test',
    surfaceForm: 'test',
    entry: { phonetic: '/tɛst/', pos: 'n.', translation: '测试' },
    band: 5,
    occurrenceCount: 1,
    ...overrides,
  };
}

function state(status: WordState['status']): WordState {
  return { status, source: 'manual', updatedAt: Date.now() };
}

describe('VocabStrategy', () => {
  const strategy = createVocabStrategy();

  // ============================================================
  // 展示决策
  // ============================================================

  describe('getDisplayDecision', () => {
    it('known (会) 状态 → 不提示', () => {
      const result = strategy.getDisplayDecision(ctx(), state('known'));
      expect(result.decision).toBe('none');
    });

    it('learning (不会) 首次出现 → 强提示且显示行内中文', () => {
      const result = strategy.getDisplayDecision(ctx(), state('learning'));
      expect(result.decision).toBe('strong');
      expect(result.showInlineTranslation).toBe(true);
    });

    it('learning (不会) 同页重复出现 → 强提示但不重复显示行内中文', () => {
      const result = strategy.getDisplayDecision(ctx({ occurrenceCount: 2 }), state('learning'));
      expect(result.decision).toBe('strong');
      expect(result.showInlineTranslation).toBe(false);
    });

    it('unknown (未知) 默认 → 轻提示', () => {
      const result = strategy.getDisplayDecision(ctx(), undefined);
      expect(result.decision).toBe('light');
      expect(result.showInlineTranslation).toBe(false);
    });

    it('未知词使用词形作为 surface form', () => {
      const result = strategy.getDisplayDecision(
        ctx({ word: 'go', surfaceForm: 'went' }),
        undefined,
      );
      expect(result.surfaceForm).toBe('went');
    });

    it('未命中词典 → 不提示', () => {
      const result = strategy.getDisplayDecision(
        ctx({ entry: null, band: null }),
        state('unknown' as any),
      );
      // 未命中词典的词不应该有状态，但如果调用方传入状态，策略应返回不提示
      expect(result.decision).toBe('none');
    });

    it('强提示带中文释义', () => {
      const result = strategy.getDisplayDecision(ctx(), state('learning'));
      expect(result.translation).toBe('测试');
    });

    it('轻提示带中文释义', () => {
      const result = strategy.getDisplayDecision(ctx(), undefined);
      expect(result.translation).toBe('测试');
    });

    it('不提示不带释义', () => {
      const result = strategy.getDisplayDecision(ctx(), state('known'));
      expect(result.translation).toBeNull();
    });
  });

  // ============================================================
  // 状态变更
  // ============================================================

  describe('markKnown', () => {
    it('标记会返回已知状态变更', () => {
      const change = strategy.markKnown('test');
      expect(change).toEqual({
        word: 'test',
        newStatus: 'known',
        source: 'manual',
      });
    });
  });

  describe('markLearning', () => {
    it('标记不会返回学习状态变更', () => {
      const change = strategy.markLearning('test');
      expect(change).toEqual({
        word: 'test',
        newStatus: 'learning',
        source: 'manual',
      });
    });
  });

  // ============================================================
  // 确定性
  // ============================================================

  it('相同输入 → 相同输出（确定性）', () => {
    const c = ctx();
    const s = state('learning');
    const r1 = strategy.getDisplayDecision(c, s);
    const r2 = strategy.getDisplayDecision(c, s);
    expect(r1).toEqual(r2);
  });
});
