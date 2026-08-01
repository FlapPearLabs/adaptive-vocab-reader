import { describe, it, expect } from 'vitest';
import type { DictCore, FormsMap, FrequencyBands, InitialTestPlan, QuizQuestion, WordState } from '../shared/types';
import { INITIAL_TEST_LENGTH } from '../shared/types';
import { createDictionary } from '../content/dictionary';
import {
  buildInitialTestPlan,
  applyAnswer,
  eligibleCandidates,
  isAnswerCorrect,
} from './quiz';

// ============================================================
// 测试夹具
// ============================================================

/** 构造 wordsPerBand × 10 个词，每个翻译互异，足以进入候选池 */
function makeFixture(wordsPerBand: number): { core: DictCore; bands: FrequencyBands } {
  const core: DictCore = {};
  const bands: FrequencyBands = {};
  let n = 0;
  for (let band = 0; band < 10; band++) {
    for (let k = 0; k < wordsPerBand; k++) {
      const word = `w${band}_${k}`;
      core[word] = { phonetic: '', pos: 'n.', translation: `t${n}` };
      bands[word] = band;
      n++;
    }
  }
  return { core, bands };
}

/** 构造一道已知正确下标的题，用于作答迁移测试 */
function makePlan(questions: QuizQuestion[]): InitialTestPlan {
  return { version: 'v', seed: 's', dictVersion: 'd', questions };
}

const SAMPLE_PLAN: InitialTestPlan = makePlan([
  {
    word: 'apple',
    band: 0,
    options: [
      { translation: '苹果', isCorrect: true },
      { translation: '香蕉', isCorrect: false },
      { translation: '猫', isCorrect: false },
      { translation: '狗', isCorrect: false },
    ],
    correctOptionIndex: 0,
    unsureIndex: 4,
  },
  {
    word: 'banana',
    band: 1,
    options: [
      { translation: '苹果', isCorrect: false },
      { translation: '香蕉', isCorrect: true },
      { translation: '猫', isCorrect: false },
      { translation: '狗', isCorrect: false },
    ],
    correctOptionIndex: 1,
    unsureIndex: 4,
  },
]);

// ============================================================
// 候选池淘汰
// ============================================================

describe('eligibleCandidates', () => {
  it('only admits words that can yield 4 distinct Chinese options', () => {
    // 全局仅 3 个互异翻译 → 任何词都凑不齐「自身 + 3 个不同干扰项」
    const core: DictCore = {
      a: { phonetic: '', pos: 'n.', translation: 't1' },
      b: { phonetic: '', pos: 'n.', translation: 't2' },
      c: { phonetic: '', pos: 'n.', translation: 't3' },
      d: { phonetic: '', pos: 'n.', translation: 't1' },
    };
    expect(eligibleCandidates(core, {})).toEqual([]);
  });

  it('admits all words when >=4 distinct translations exist', () => {
    const { core } = makeFixture(2);
    const eligible = eligibleCandidates(core, {});
    expect(eligible.length).toBe(Object.keys(core).length);
  });

  it('admits all core headwords including those whose surface form is also a forms key (core-first, no shadow exclusion)', () => {
    // core 含 could 与 can 两个主词条；forms 把 could 重定向到 can。
    // 旧方案以「lookup(could) 被遮蔽」为由排除 could，掩盖状态模型错误。
    // 新方案：lookup 以 core 优先，状态键 = 自身 surface form，could 与 can 独立，
    // 两者都应进入首测候选。
    const core: DictCore = {
      can: { phonetic: '', pos: 'v.', translation: '能' },
      could: { phonetic: '', pos: 'v.', translation: '可以（过去式）' },
      book: { phonetic: '', pos: 'n.', translation: '书' },
      cat: { phonetic: '', pos: 'n.', translation: '猫' },
      dog: { phonetic: '', pos: 'n.', translation: '狗' },
    };
    // 每个翻译互异，保证都能凑齐四选项
    const forms: FormsMap = { could: 'can', books: 'book' };
    const dict = createDictionary(core, forms, {});

    const eligible = eligibleCandidates(core, forms);
    // could 与 can 都入选（不再因 forms 重定向被排除）
    expect(eligible).toContain('could');
    expect(eligible).toContain('can');
    // core 优先：could 与 can 保持各自独立的 wordKey
    expect(dict.lookup('could')!.wordKey).toBe('could');
    expect(dict.lookup('can')!.wordKey).toBe('can');
    // 各自取义正确
    expect(dict.lookup('could')!.entryKey).toBe('could');
    expect(dict.lookup('can')!.entryKey).toBe('can');
  });
});

// ============================================================
// 计划构建：配额与冻结
// ============================================================

describe('buildInitialTestPlan', () => {
  it('produces exactly 10 bands × 5 questions = 50', () => {
    const { core, bands } = makeFixture(6);
    const plan = buildInitialTestPlan(core, {}, bands, 'seed-1', 'dict-v1');
    expect(plan.questions.length).toBe(INITIAL_TEST_LENGTH);
    expect(INITIAL_TEST_LENGTH).toBe(50);

    const perBand = new Map<number, number>();
    for (const q of plan.questions) {
      perBand.set(q.band, (perBand.get(q.band) ?? 0) + 1);
    }
    expect(perBand.size).toBe(10);
    for (let b = 0; b < 10; b++) {
      expect(perBand.get(b)).toBe(5);
    }
  });

  it('yields zero questions when no eligible candidates exist', () => {
    const core: DictCore = {
      a: { phonetic: '', pos: 'n.', translation: 't1' },
      b: { phonetic: '', pos: 'n.', translation: 't2' },
      c: { phonetic: '', pos: 'n.', translation: 't3' },
    };
    const bands: FrequencyBands = { a: 0, b: 1, c: 2 };
    const plan = buildInitialTestPlan(core, {}, bands, 'seed-1', 'dict-v1');
    expect(plan.questions.length).toBe(0);
  });

  it('each question has 4 distinct options with exactly one correct', () => {
    const { core, bands } = makeFixture(6);
    const plan = buildInitialTestPlan(core, {}, bands, 'seed-1', 'dict-v1');
    for (const q of plan.questions) {
      expect(q.options.length).toBe(4);
      expect(q.unsureIndex).toBe(4);
      const translations = q.options.map((o) => o.translation);
      expect(new Set(translations).size).toBe(4); // 互异
      const correctCount = q.options.filter((o) => o.isCorrect).length;
      expect(correctCount).toBe(1);
      expect(q.options[q.correctOptionIndex]!.isCorrect).toBe(true);
    }
  });

  it('freezes identical plan for identical seed + snapshot', () => {
    const { core, bands } = makeFixture(6);
    const p1 = buildInitialTestPlan(core, {}, bands, 'seed-1', 'dict-v1');
    const p2 = buildInitialTestPlan(core, {}, bands, 'seed-1', 'dict-v1');
    expect(JSON.stringify(p1)).toBe(JSON.stringify(p2));
    expect(p1.version).toBe(p2.version);
  });

  it('produces a different plan for a different install seed', () => {
    const { core, bands } = makeFixture(6);
    const p1 = buildInitialTestPlan(core, {}, bands, 'seed-1', 'dict-v1');
    const p2 = buildInitialTestPlan(core, {}, bands, 'seed-2', 'dict-v1');
    expect(p1.version).not.toBe(p2.version);
    expect(JSON.stringify(p1)).not.toBe(JSON.stringify(p2));
  });

  it('does not depend on wall-clock time (deterministic version)', () => {
    const { core, bands } = makeFixture(6);
    const p1 = buildInitialTestPlan(core, {}, bands, 'seed-1', 'dict-v1');
    const p2 = buildInitialTestPlan(core, {}, bands, 'seed-1', 'dict-v1');
    expect(p1.version).toBe(p2.version);
  });
});

// ============================================================
// 作答状态迁移（最高测试 seam）
// ============================================================

describe('applyAnswer', () => {
  const manualKnown: WordState = { status: 'known', source: 'manual', updatedAt: 0, version: 1 };

  it('correct answer → known (V0.1 不再产出审计标记)', () => {
    const result = applyAnswer(SAMPLE_PLAN, 0, { kind: 'option', optionIndex: 0 }, undefined);
    expect(result.kind).toBe('correct');
    if (result.kind !== 'correct') return;
    expect(result.change.newStatus).toBe('known');
    expect(result.change.source).toBe('initial');
    expect(result.change.word).toBe('apple');
    expect(result.clearMarkerWord).toBeNull();
    // R-AUD-3：V0.1 用户路径已切断审计——答对分支不得再产出任何审计标记
    expect(Object.keys(result).sort()).toEqual(['change', 'clearMarkerWord', 'kind']);
    expect('audit' in result).toBe(false);
  });

  it('wrong answer → learning, no audit, clears stale marker for word', () => {
    const result = applyAnswer(SAMPLE_PLAN, 0, { kind: 'option', optionIndex: 1 }, undefined);
    expect(result.kind).toBe('wrong');
    if (result.kind !== 'wrong') return;
    expect(result.change.newStatus).toBe('learning');
    expect(result.change.source).toBe('initial');
    expect(result.audit).toBeNull();
    expect(result.clearMarkerWord).toBe('apple');
  });

  it('unsure answer → learning, no audit, clears stale marker for word', () => {
    const result = applyAnswer(SAMPLE_PLAN, 0, { kind: 'unsure' }, undefined);
    expect(result.kind).toBe('unsure');
    if (result.kind !== 'unsure') return;
    expect(result.change.newStatus).toBe('learning');
    expect(result.audit).toBeNull();
    expect(result.clearMarkerWord).toBe('apple');
  });

  it('initial test answer overwrites prior manual WordState', () => {
    const result = applyAnswer(SAMPLE_PLAN, 0, { kind: 'option', optionIndex: 0 }, manualKnown);
    expect(result.kind).toBe('correct');
    if (result.kind !== 'correct') return;
    expect(result.change).toEqual({ word: 'apple', newStatus: 'known', source: 'initial' });
  });

  it('isAnswerCorrect reflects the frozen correct option', () => {
    expect(isAnswerCorrect(SAMPLE_PLAN.questions[0]!, { kind: 'option', optionIndex: 0 })).toBe(true);
    expect(isAnswerCorrect(SAMPLE_PLAN.questions[0]!, { kind: 'option', optionIndex: 2 })).toBe(false);
    expect(isAnswerCorrect(SAMPLE_PLAN.questions[1]!, { kind: 'option', optionIndex: 1 })).toBe(true);
  });
});
