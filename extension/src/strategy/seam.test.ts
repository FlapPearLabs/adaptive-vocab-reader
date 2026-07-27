import { describe, it, expect } from 'vitest';
import type {
  DictCore,
  FormsMap,
  FrequencyBands,
  WordState,
  QuizAnswer,
} from '../shared/types';
import { createVocabStrategy } from './index';
import type { VocabStrategy } from '../shared/types';
import { createEmptySnapshot, mergeStateChange, addAuditMarker } from '../worker/storage';

// ============================================================
// 策略 seam 行为测试
// ============================================================
// 不扫描源码 import 字符串；只断言 VocabStrategy 这条 seam 的外部行为：
// 调用方（popup/worker/content/storage）只经 createVocabStrategy() 拿到的对象
// 即可完成展示决策、冻结首测/审计计划与结算单题，无需也无需直连 quiz.ts/audit.ts。
// ============================================================

const SEED = 'seam-seed';
const DICT_V = 'dict-seam-v1';

function makeCore(words: string[]): DictCore {
  const core: DictCore = {};
  for (const w of words) core[w] = { phonetic: '', pos: 'n.', translation: `t_${w}` };
  // 4 个互异翻译 filler，保证首测候选池非空
  for (let i = 0; i < 4; i++) core[`__filler${i}__`] = { phonetic: '', pos: 'n.', translation: `filler_${i}` };
  return core;
}

function makeBands(words: string[]): FrequencyBands {
  const bands: FrequencyBands = {};
  words.forEach((w, i) => (bands[w] = i % 10));
  return bands;
}

describe('VocabStrategy seam（深 Module Interface 行为）', () => {
  const strategy: VocabStrategy = createVocabStrategy();

  it('暴露且仅暴露 7 个领域动作方法（展示×2 + 标记×... + 冻结/结算×4）', () => {
    // 行为断言：strategy 对象恰好具备这些方法（非内部函数浅转发清单）
    const methods = Object.keys(strategy).sort();
    expect(methods).toEqual(
      [
        'freezeAuditPlan',
        'freezeInitialTestPlan',
        'getDisplayDecision',
        'markKnown',
        'markLearning',
        'settleAuditAnswer',
        'settleInitialTestAnswer',
      ].sort(),
    );
  });

  // ---- 展示决策 ----
  it('getDisplayDecision：未知词轻提示、会词不提示、不会词强提示', () => {
    const entry = { phonetic: '', pos: 'n.', translation: '苹果' };
    const ctx = { word: 'apple', surfaceForm: 'apple', entry, band: 0, occurrenceCount: 1 };
    expect(strategy.getDisplayDecision(ctx, undefined).decision).toBe('light');
    expect(strategy.getDisplayDecision(ctx, { status: 'known', source: 'manual', updatedAt: 0 }).decision).toBe('none');
    const learning = strategy.getDisplayDecision(ctx, { status: 'learning', source: 'manual', updatedAt: 0 });
    expect(learning.decision).toBe('strong');
    expect(learning.showInlineTranslation).toBe(true); // 同页首次
  });

  it('markKnown / markLearning 产出 source=manual 的原子变更', () => {
    expect(strategy.markKnown('apple')).toEqual({ word: 'apple', newStatus: 'known', source: 'manual' });
    expect(strategy.markLearning('apple')).toEqual({ word: 'apple', newStatus: 'learning', source: 'manual' });
  });

  // ---- 首测：冻结 + 结算 ----
  it('freezeInitialTestPlan 冻结 50 题（十频段各五题）；settleInitialTestAnswer 结算答对→会+审计标记', () => {
    const words = Array.from({ length: 60 }, (_, i) => `w${i}`);
    const core = makeCore(words);
    const bands = makeBands(words);
    const forms: FormsMap = {};
    const plan = strategy.freezeInitialTestPlan({ core, forms, bands, seed: SEED, dictVersion: DICT_V });

    expect(plan.questions).toHaveLength(50);
    const perBand = new Map<number, number>();
    for (const q of plan.questions) perBand.set(q.band, (perBand.get(q.band) ?? 0) + 1);
    expect(perBand.size).toBe(10);
    for (let b = 0; b < 10; b++) expect(perBand.get(b)).toBe(5);

    // 结算第 0 题：答对 → known + 审计标记（调用方无需 isAnswerCorrect，正确下标已在冻结题里）
    const q0 = plan.questions[0]!;
    const correct: QuizAnswer = { kind: 'option', optionIndex: q0.correctOptionIndex };
    const res = strategy.settleInitialTestAnswer({ plan, questionIndex: 0, answer: correct, current: undefined });
    expect(res.kind).toBe('correct');
    if (res.kind === 'correct') {
      expect(res.change.newStatus).toBe('known');
      expect(res.audit).not.toBeNull();
      expect(res.audit!.planVersion).toBe(plan.version);
    }
  });

  it('settleInitialTestAnswer：答错/不确定→不会且无审计标记；手动状态优先', () => {
    const words = Array.from({ length: 6 }, (_, i) => `w${i}`);
    const core = makeCore(words);
    const bands = makeBands(words);
    const plan = strategy.freezeInitialTestPlan({ core, forms: {}, bands, seed: SEED, dictVersion: DICT_V });
    const q0 = plan.questions[0]!;
    const wrongIdx = q0.correctOptionIndex === 0 ? 1 : 0;

    const wrong = strategy.settleInitialTestAnswer({ plan, questionIndex: 0, answer: { kind: 'option', optionIndex: wrongIdx }, current: undefined });
    expect(wrong.kind).toBe('wrong');
    expect(wrong.change!.newStatus).toBe('learning');

    const unsure = strategy.settleInitialTestAnswer({ plan, questionIndex: 0, answer: { kind: 'unsure' }, current: undefined });
    expect(unsure.kind).toBe('unsure');
    expect(unsure.change!.newStatus).toBe('learning');

    const manual: WordState = { status: 'known', source: 'manual', updatedAt: 0 };
    const priority = strategy.settleInitialTestAnswer({ plan, questionIndex: 0, answer: { kind: 'option', optionIndex: q0.correctOptionIndex }, current: manual });
    expect(priority.kind).toBe('priority-preserved');
    expect(priority.change).toBeNull();
  });

  // ---- 审计：冻结 + 结算 ----
  it('freezeAuditPlan 冻结审计计划（候选+题目+结算位）；settleAuditAnswer 结算答对→verified、答错→failed', () => {
    const words = ['apple', 'banana'];
    let snap = createEmptySnapshot(SEED, DICT_V);
    for (const w of words) {
      snap = addAuditMarker(snap, { word: w, source: 'initial-correct', planVersion: 'pv', createdAt: 0, pending: true });
      snap = mergeStateChange(snap, w, 'known', 'initial');
    }
    const core = makeCore(words);
    const bands = makeBands(words);

    const plan = strategy.freezeAuditPlan({
      markers: snap.auditMarkers,
      words: snap.words,
      core,
      bands,
      seed: SEED,
      planVersion: 'pv',
      count: 5,
    });
    expect(plan.candidates).toHaveLength(2);
    expect(plan.questions).toHaveLength(2);
    expect(plan.results).toEqual([null, null]);
    expect(plan.version).toContain('pv');

    // 结算第 0 题答对
    const q0 = plan.questions[0]!;
    const verified = strategy.settleAuditAnswer({
      plan,
      index: 0,
      answer: { kind: 'option', optionIndex: q0.correctOptionIndex },
      current: snap.words[plan.candidates[0]!.word],
    });
    expect(verified.kind).toBe('verified');
    expect(verified.change.newStatus).toBe('known');
    expect(verified.plan.results[0]).toBe('verified');
    expect(verified.plan.results[1]).toBe(null); // 未结算的保持 null

    // 结算第 1 题答错
    const q1 = verified.plan.questions[1]!;
    const wrongIdx = q1.correctOptionIndex === 0 ? 1 : 0;
    const failed = strategy.settleAuditAnswer({
      plan: verified.plan,
      index: 1,
      answer: { kind: 'option', optionIndex: wrongIdx },
      current: snap.words[plan.candidates[1]!.word],
    });
    expect(failed.kind).toBe('failed');
    expect(failed.change.newStatus).toBe('learning');
    expect(failed.plan.results[1]).toBe('failed');
  });
});
