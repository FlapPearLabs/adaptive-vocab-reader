import { describe, it, expect } from 'vitest';
import type {
  DictCore,
  FormsMap,
  FrequencyBands,
  WordState,
  QuizAnswer,
  InitialTestPlan,
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

  it('暴露且仅暴露 9 个领域动作方法（展示×2 + 标记×2 + 冻结/结算×4 含生命周期 transition）', () => {
    // 行为断言：strategy 对象恰好具备这些方法（非内部函数浅转发清单）
    const methods = Object.keys(strategy).sort();
    expect(methods).toEqual(
      [
        'freezeAuditPlan',
        'freezeInitialTestPlan',
        'getDisplayDecision',
        'markKnown',
        'markLearning',
        'resetInitialTest',
        'settleAuditAnswer',
        'settleInitialTestAnswer',
        'startInitialTest',
      ].sort(),
    );
  });

  it('startInitialTest 交付完整生命周期 transition（actual state + initialTest），非固定布尔 intent', () => {
    const plan: InitialTestPlan = { version: 'pv', seed: 's', dictVersion: 'd', questions: [] };
    const transition = strategy.startInitialTest(plan, 0);
    // 状态版本由策略递增（非 worker 硬编码 +1 布尔）
    expect(transition.nextStateVersion).toBe(1);
    // 策略直接交付空标记映射（不再接收 markers 参数，清空全部标记收口于策略）
    expect(transition.auditMarkers).toEqual({});
    expect(transition.auditPlan).toBeNull();
    // initialTest 由传入 plan 真实构造（answers 全 null、completed:false）
    expect(transition.initialTest.plan).toBe(plan);
    expect(transition.initialTest.answers).toEqual([]);
    expect(transition.initialTest.completed).toBe(false);
  });

  it('startInitialTest 清空全部标记（含 stateVersion === nextStateVersion 的异常 marker），调用方无需传入 markers', () => {
    // startInitialTest 不再接收 markers 参数；标记清理由策略内部收口。
    // 本测试仅验证：无论快照中遗留何种 marker，transition 一律交付空映射。
    const plan: InitialTestPlan = { version: 'pv', seed: 's', dictVersion: 'd', questions: [] };
    const transition = strategy.startInitialTest(plan, 0);
    expect(transition.nextStateVersion).toBe(1);
    // 异常 marker（stateVersion === nextStateVersion）被排除：清空全部标记即满足，且不依赖任何布尔解释
    expect(transition.auditMarkers).toEqual({});
    expect(transition.auditPlan).toBeNull();
  });

  it('resetInitialTest 交付完整 transition（递增版本 + 清空标记 + auditPlan:null + initialTest:null）', () => {
    const transition = strategy.resetInitialTest(2);
    expect(transition.nextStateVersion).toBe(3);
    expect(transition.auditMarkers).toEqual({});
    expect(transition.auditPlan).toBeNull();
    expect(transition.initialTest).toBeNull();
  });

  // ---- 展示决策 ----
  it('getDisplayDecision：未知词轻提示、会词不提示、不会词强提示', () => {
    const entry = { phonetic: '', pos: 'n.', translation: '苹果' };
    const ctx = { word: 'apple', surfaceForm: 'apple', entry, band: 0, occurrenceCount: 1 };
    expect(strategy.getDisplayDecision(ctx, undefined).decision).toBe('light');
    expect(strategy.getDisplayDecision(ctx, { status: 'known', source: 'manual', updatedAt: 0, version: 0 }).decision).toBe('none');
    const learning = strategy.getDisplayDecision(ctx, { status: 'learning', source: 'manual', updatedAt: 0, version: 0 });
    expect(learning.decision).toBe('strong');
    expect(learning.showInlineTranslation).toBe(true); // 同页首次
  });

  it('markKnown / markLearning 产出 source=manual 的原子变更（含 clearMarker 意图）', () => {
    expect(strategy.markKnown('apple')).toEqual({
      change: { word: 'apple', newStatus: 'known', source: 'manual' },
      clearMarker: true,
    });
    expect(strategy.markLearning('apple')).toEqual({
      change: { word: 'apple', newStatus: 'learning', source: 'manual' },
      clearMarker: true,
    });
  });

  // ---- 首测：冻结 + 结算 ----
  it('freezeInitialTestPlan 冻结 50 题（十频段各五题）；settleInitialTestAnswer 结算答对→会（V0.1 不再产出审计标记）', () => {
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

    // 结算第 0 题：答对 → known（调用方无需 isAnswerCorrect，正确下标已在冻结题里）
    // R-AUD-3：V0.1 用户路径已切断审计——答对分支不得再交付任何审计标记字段。
    const q0 = plan.questions[0]!;
    const correct: QuizAnswer = { kind: 'option', optionIndex: q0.correctOptionIndex };
    const res = strategy.settleInitialTestAnswer({ plan, questionIndex: 0, answer: correct, current: undefined, stateVersion: 0 });
    expect(res.kind).toBe('correct');
    if (res.kind === 'correct') {
      expect(res.change.newStatus).toBe('known');
      expect(res.change.source).toBe('initial');
    }
    // 结算结果不携带 audit 字段（审计标记的产出位置已从首测结算路径移除）
    expect(Object.keys(res).sort()).toEqual(['change', 'clearMarkerWord', 'kind']);
    expect('audit' in res).toBe(false);
  });

  it('settleInitialTestAnswer：答错/不确定→不会且无审计标记；手动状态优先', () => {
    const words = Array.from({ length: 6 }, (_, i) => `w${i}`);
    const core = makeCore(words);
    const bands = makeBands(words);
    const plan = strategy.freezeInitialTestPlan({ core, forms: {}, bands, seed: SEED, dictVersion: DICT_V });
    const q0 = plan.questions[0]!;
    const wrongIdx = q0.correctOptionIndex === 0 ? 1 : 0;

    const wrong = strategy.settleInitialTestAnswer({ plan, questionIndex: 0, answer: { kind: 'option', optionIndex: wrongIdx }, current: undefined, stateVersion: 0 });
    expect(wrong.kind).toBe('wrong');
    expect(wrong.change!.newStatus).toBe('learning');

    const unsure = strategy.settleInitialTestAnswer({ plan, questionIndex: 0, answer: { kind: 'unsure' }, current: undefined, stateVersion: 0 });
    expect(unsure.kind).toBe('unsure');
    expect(unsure.change!.newStatus).toBe('learning');

    const manual: WordState = { status: 'known', source: 'manual', updatedAt: 0, version: 1 };
    const priority = strategy.settleInitialTestAnswer({ plan, questionIndex: 0, answer: { kind: 'option', optionIndex: q0.correctOptionIndex }, current: manual, stateVersion: 0 });
    expect(priority.kind).toBe('priority-preserved');
    expect(priority.change).toBeNull();
  });

  // ---- 审计：冻结 + 结算 ----
  it('freezeAuditPlan 冻结审计计划（候选+题目+结算位）；settleAuditAnswer 结算答对→verified、答错→failed', () => {
    const words = ['apple', 'banana'];
    let snap = createEmptySnapshot(SEED, DICT_V);
    for (const w of words) {
      snap = addAuditMarker(snap, { word: w, source: 'initial-correct', planVersion: 'pv', stateVersion: 1, createdAt: 0, pending: true });
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
      stateVersion: 1,
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
