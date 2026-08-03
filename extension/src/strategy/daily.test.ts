import { describe, it, expect } from 'vitest';
import type {
  DictCore,
  FormsMap,
  FrequencyBands,
  AssessmentEvidence,
  DailyTestState,
} from '../shared/types';
import { createVocabStrategy } from './index';
import { dailyBandsForRound } from './index';

// ============================================================
// 每日校准轮策略单测（R-DLY-1/3/4/6/8、R-EVD-5、date seam）
// ============================================================
// 只经 strategy/index.ts 的深 Module Interface 消费 daily 领域动作，
// 不直连 strategy/daily.ts。选词断言只依赖 AssessmentEvidence（R-EVD-5）。
// ============================================================

const SEED = 'daily-seed';
const DICT_V = 'dict-daily-v1';

function makeCore(words: string[]): DictCore {
  const core: DictCore = {};
  for (const w of words) core[w] = { phonetic: '', pos: 'n.', translation: `t_${w}` };
  // 4 个互异翻译 filler，保证 eligibleCandidates 的非空条件；固定放频段 6，避免干扰目标频段
  for (let i = 0; i < 4; i++) core[`__filler${i}__`] = { phonetic: '', pos: 'n.', translation: `filler_${i}` };
  return core;
}

/** words 按下标循环分到 0..9 频段；filler 固定频段 6。 */
function makeBands(words: string[]): FrequencyBands {
  const bands: FrequencyBands = {};
  words.forEach((w, i) => (bands[w] = i % 10));
  for (let i = 0; i < 4; i++) bands[`__filler${i}__`] = 6;
  return bands;
}

/**
 * 直接构造 bands：让每个给定词落在指定频段。
 * 为受控断言（优先无证据/最久未测）使用，避免依赖 words 数组下标的隐式映射。
 */
function bandsFor(spec: Record<number, string[]>): FrequencyBands {
  const bands: FrequencyBands = {};
  for (const [band, ws] of Object.entries(spec)) {
    const b = Number(band);
    for (const w of ws) bands[w] = b;
  }
  // filler 固定频段 6，避免污染其他频段候选
  for (let i = 0; i < 4; i++) bands[`__filler${i}__`] = 6;
  return bands;
}

function ev(word: string, outcome: 'known' | 'learning', assessedAt: number): Record<string, AssessmentEvidence> {
  return { [word]: { outcome, source: 'initial', assessedAt } };
}

const strategy = createVocabStrategy();

describe('dailyBandsForRound（R-DLY-1）', () => {
  it('偶数轮取频段 0/2/4/6/8，奇数轮取 1/3/5/7/9', () => {
    expect(dailyBandsForRound(0)).toEqual([0, 2, 4, 6, 8]);
    expect(dailyBandsForRound(2)).toEqual([0, 2, 4, 6, 8]);
    expect(dailyBandsForRound(1)).toEqual([1, 3, 5, 7, 9]);
    expect(dailyBandsForRound(3)).toEqual([1, 3, 5, 7, 9]);
  });
});

describe('freezeDailyTest（R-DLY-1/3、R-EVD-5、date seam）', () => {
  it('偶数轮每题来自 0/2/4/6/8 各一段，共五题；同轮无重复', () => {
    // 每个选中频段 2 个候选（无证据）
    const spec: Record<number, string[]> = {};
    for (let b = 0; b < 10; b++) spec[b] = [`w${b}a`, `w${b}b`];
    const core = makeCore(Object.values(spec).flat());
    const bands = bandsFor(spec);

    const state = strategy.freezeDailyTest(
      { core, forms: {}, bands, seed: SEED, dictVersion: DICT_V, completedRoundIndex: 0, evidence: {} },
      '2026-08-03',
    );

    expect(state.roundIndex).toBe(0);
    expect(state.questions).toHaveLength(5);
    expect(state.answers).toEqual([null, null, null, null, null]);
    expect(state.completed).toBe(false);
    expect(state.skipped).toBe(false);
    const qBands = state.questions.map((q) => q.band).sort((a, b) => a - b);
    expect(qBands).toEqual([0, 2, 4, 6, 8]);
    const qWords = state.questions.map((q) => q.word);
    expect(new Set(qWords).size).toBe(5); // 同轮不重复
  });

  it('奇数轮每题来自 1/3/5/7/9 各一段，共五题', () => {
    const spec: Record<number, string[]> = {};
    for (let b = 0; b < 10; b++) spec[b] = [`w${b}a`, `w${b}b`];
    const core = makeCore(Object.values(spec).flat());
    const bands = bandsFor(spec);

    const state = strategy.freezeDailyTest(
      { core, forms: {}, bands, seed: SEED, dictVersion: DICT_V, completedRoundIndex: 1, evidence: {} },
      '2026-08-03',
    );

    expect(state.questions).toHaveLength(5);
    const qBands = state.questions.map((q) => q.band).sort((a, b) => a - b);
    expect(qBands).toEqual([1, 3, 5, 7, 9]);
    expect(new Set(state.questions.map((q) => q.word)).size).toBe(5);
  });

  it('R-DLY-3：段内优先无 AssessmentEvidence 的 wordKey（即使该词有 WordState）', () => {
    // band2 两个候选：w2a 有证据（无 WordState）；w2b 无证据（有 manual WordState）。
    // R-EVD-5：选词只读证据——w2b 因无证据而优先，w2a 即使有 WordState 也不受影响。
    const allSpec: Record<number, string[]> = { 0: ['w0a'], 2: ['w2a', 'w2b'], 4: ['w4a'], 6: ['w6a'], 8: ['w8a'] };
    const allCore = makeCore(Object.values(allSpec).flat());
    const allBands = bandsFor(allSpec);

    const state = strategy.freezeDailyTest(
      {
        core: allCore,
        forms: {},
        bands: allBands,
        seed: SEED,
        dictVersion: DICT_V,
        completedRoundIndex: 0,
        // 只给 w2a 证据（与 WordState 无关的独立证据记录）
        evidence: ev('w2a', 'known', 100),
      },
      '2026-08-03',
    );

    const q2 = state.questions.find((q) => q.band === 2);
    expect(q2?.word).toBe('w2b'); // 无证据优先，无论 w2a 的 WordState 如何
  });

  it('R-DLY-3 / R-EVD-5：耗尽后取 assessedAt 最早的旧词（并列时保持确定性顺序）', () => {
    // band4 两个候选都有证据：w4a assessedAt=10、w4b assessedAt=20 → 应选 w4a（最早）
    const allSpec: Record<number, string[]> = { 0: ['w0a'], 2: ['w2a'], 4: ['w4a', 'w4b'], 6: ['w6a'], 8: ['w8a'] };
    const allCore = makeCore(Object.values(allSpec).flat());
    const allBands = bandsFor(allSpec);

    const state = strategy.freezeDailyTest(
      {
        core: allCore,
        forms: {},
        bands: allBands,
        seed: SEED,
        dictVersion: DICT_V,
        completedRoundIndex: 0,
        evidence: { ...ev('w4a', 'learning', 10), ...ev('w4b', 'known', 20) },
      },
      '2026-08-03',
    );

    const q4 = state.questions.find((q) => q.band === 4);
    expect(q4?.word).toBe('w4a');
  });

  it('date seam：localDate 是最小可测试输入；同一 (seed, evidence) 下不同日期仅记录字段不同，题目冻结一致', () => {
    const spec: Record<number, string[]> = {};
    for (let b = 0; b < 10; b++) spec[b] = [`w${b}a`, `w${b}b`];
    const core = makeCore(Object.values(spec).flat());
    const bands = bandsFor(spec);
    const input = { core, forms: {}, bands, seed: SEED, dictVersion: DICT_V, completedRoundIndex: 0, evidence: {} };

    const day1 = strategy.freezeDailyTest(input, '2026-08-03');
    const day2 = strategy.freezeDailyTest(input, '2026-08-04');

    expect(day1.localDate).toBe('2026-08-03');
    expect(day2.localDate).toBe('2026-08-04');
    expect(day1.questions).toEqual(day2.questions); // 题目不随日期变化（日期只标识轮次归属）
    expect(JSON.stringify(day1.questions)).toBe(JSON.stringify(strategy.freezeDailyTest(input, '2026-08-03').questions));
  });

  it('确定性：同输入两次冻结产出完全相同计划（含选项顺序）', () => {
    const spec: Record<number, string[]> = {};
    for (let b = 0; b < 10; b++) spec[b] = [`w${b}a`, `w${b}b`, `w${b}c`];
    const core = makeCore(Object.values(spec).flat());
    const bands = bandsFor(spec);
    const input = { core, forms: {}, bands, seed: SEED, dictVersion: DICT_V, completedRoundIndex: 0, evidence: {} };

    const a = strategy.freezeDailyTest(input, '2026-08-03');
    const b = strategy.freezeDailyTest(input, '2026-08-03');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('选中频段无合格候选 → 抛错（绝不静默产出少于五题的轮次）', () => {
    // 只有 band0 有候选；偶数轮需要 0/2/4/6/8，band2 起无候选 → 抛错
    const core = makeCore(['only0']);
    const bands: FrequencyBands = { only0: 0, __filler0__: 6, __filler1__: 6, __filler2__: 6, __filler3__: 6 };
    expect(() =>
      strategy.freezeDailyTest(
        { core, forms: {}, bands, seed: SEED, dictVersion: DICT_V, completedRoundIndex: 0, evidence: {} },
        '2026-08-03',
      ),
    ).toThrow(/no eligible candidate/);
  });
});

describe('settleDailyAnswer（R-DLY-4 判定 + 复用四选一/不确定）', () => {
  function makeQuestion(word: string, correctOptionIndex: number) {
    return {
      word,
      band: 0,
      options: [
        { translation: 'a', isCorrect: correctOptionIndex === 0 },
        { translation: 'b', isCorrect: correctOptionIndex === 1 },
        { translation: 'c', isCorrect: correctOptionIndex === 2 },
        { translation: 'd', isCorrect: correctOptionIndex === 3 },
      ],
      correctOptionIndex,
      unsureIndex: 4,
    };
  }

  it('答对 → known；答错 / 不确定 → learning；change.source 固定为 daily（R-DLY-4/ADR-0004）', () => {
    const q = makeQuestion('apple', 1);
    const correct = strategy.settleDailyAnswer({ question: q, answer: { kind: 'option', optionIndex: 1 } });
    expect(correct.kind).toBe('correct');
    expect(correct.change.newStatus).toBe('known');
    expect(correct.change.word).toBe('apple');
    expect(correct.change.source).toBe('daily'); // 领域 seam 与持久化来源一致

    const wrong = strategy.settleDailyAnswer({ question: q, answer: { kind: 'option', optionIndex: 0 } });
    expect(wrong.kind).toBe('wrong');
    expect(wrong.change.newStatus).toBe('learning');
    expect(wrong.change.source).toBe('daily');

    const unsure = strategy.settleDailyAnswer({ question: q, answer: { kind: 'unsure' } });
    expect(unsure.kind).toBe('unsure');
    expect(unsure.change.newStatus).toBe('learning');
    expect(unsure.change.source).toBe('daily');
  });
});
