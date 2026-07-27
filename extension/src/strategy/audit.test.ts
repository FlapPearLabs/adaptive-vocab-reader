import { describe, it, expect } from 'vitest';
import type { DictCore, FrequencyBands, AuditMarker, WordState, QuizAnswer } from '../shared/types';
import { createEmptySnapshot, mergeStateChange, addAuditMarker } from '../worker/storage';
import { freezeAuditPlan, settleAuditAnswer } from './audit';

const SEED = 'seed-abc';
const PLAN_V = 'd:s:v1';

function marker(word: string, planVersion: string, pending = true): AuditMarker {
  return { word, source: 'initial-correct', planVersion, createdAt: 1000, pending };
}

function bandsFor(words: string[]): FrequencyBands {
  const bands: FrequencyBands = {};
  words.forEach((w, i) => (bands[w] = i % 10));
  return bands;
}

/**
 * 构造足够大的 core：每个候选词有独立词条，并加入足够多的互异翻译 filler，
 * 使 buildQuestion 能凑齐「1 正确 + 3 干扰项」的四个互异中文选项。
 */
function makeCore(words: string[]): DictCore {
  const core: DictCore = {};
  for (const w of words) {
    core[w] = { phonetic: '', pos: 'n.', translation: `t_${w}` };
  }
  // filler：提供互异翻译，保证全局 ≥4 个互异翻译
  for (let i = 0; i < 4; i++) {
    core[`__filler${i}__`] = { phonetic: '', pos: 'n.', translation: `filler_${i}` };
  }
  return core;
}

describe('freezeAuditPlan (Spec B §8 + §6 作答前冻结)', () => {
  it('只选择仍为会、pending、且计划版本匹配的标记；排除手动标记不会的词', () => {
    let snap = createEmptySnapshot(SEED, 'd');
    snap = addAuditMarker(snap, marker('apple', PLAN_V));
    snap = addAuditMarker(snap, marker('banana', PLAN_V));
    snap = addAuditMarker(snap, marker('cherry', PLAN_V));
    snap = mergeStateChange(snap, 'apple', 'known', 'initial');
    snap = mergeStateChange(snap, 'banana', 'known', 'initial');
    snap = mergeStateChange(snap, 'cherry', 'learning', 'manual');

    const words = ['apple', 'banana', 'cherry'];
    const plan = freezeAuditPlan({
      markers: snap.auditMarkers,
      words: snap.words,
      core: makeCore(words),
      bands: bandsFor(words),
      seed: SEED,
      planVersion: PLAN_V,
      count: 10,
    });

    expect(plan.candidates.map((c) => c.word).sort()).toEqual(['apple', 'banana']);
    expect(plan.results).toEqual([null, null]);
    expect(plan.questions.length).toBe(2);
  });

  it('排除绑定到旧计划版本的陈旧标记', () => {
    let snap = createEmptySnapshot(SEED, 'd');
    snap = addAuditMarker(snap, marker('apple', 'old-version'));
    snap = mergeStateChange(snap, 'apple', 'known', 'initial');

    const plan = freezeAuditPlan({
      markers: snap.auditMarkers,
      words: snap.words,
      core: makeCore(['apple']),
      bands: bandsFor(['apple']),
      seed: SEED,
      planVersion: PLAN_V,
      count: 10,
    });
    expect(plan.candidates).toHaveLength(0);
  });

  it('同一（种子 + 计划版本 + 轮次 + 候选快照）可复现相同冻结计划', () => {
    const words = ['a0', 'a1', 'a2', 'a3', 'a4', 'a5'];
    let snap = createEmptySnapshot(SEED, 'd');
    for (const w of words) {
      snap = addAuditMarker(snap, marker(w, PLAN_V));
      snap = mergeStateChange(snap, w, 'known', 'initial');
    }

    const input = {
      markers: snap.auditMarkers,
      words: snap.words,
      core: makeCore(words),
      bands: bandsFor(words),
      seed: SEED,
      planVersion: PLAN_V,
      count: 4,
    };
    const first = freezeAuditPlan(input);
    const second = freezeAuditPlan(input);
    expect(second.version).toBe(first.version);
    expect(second.candidates.map((c) => c.word)).toEqual(first.candidates.map((c) => c.word));
  });

  it('池 B（高置信未知词）为空时全部从池 A 抽取（补位）', () => {
    const words = ['a0', 'a1', 'a2'];
    let snap = createEmptySnapshot(SEED, 'd');
    for (const w of words) {
      snap = addAuditMarker(snap, marker(w, PLAN_V));
      snap = mergeStateChange(snap, w, 'known', 'initial');
    }

    const plan = freezeAuditPlan({
      markers: snap.auditMarkers,
      words: snap.words,
      core: makeCore(words),
      bands: bandsFor(words),
      seed: SEED,
      planVersion: PLAN_V,
      count: 3,
    });
    expect(plan.candidates).toHaveLength(3);
    expect(plan.candidates.every((c) => c.bucket === 'initial-correct')).toBe(true);
  });

  it('池 A 为空时由池 B（高置信未知词）补位', () => {
    let snap = createEmptySnapshot(SEED, 'd');
    snap = mergeStateChange(snap, 'hc1', 'unknown', 'initial');
    snap = mergeStateChange(snap, 'hc2', 'unknown', 'initial');
    const words = ['hc1', 'hc2'];

    const plan = freezeAuditPlan({
      markers: snap.auditMarkers,
      words: snap.words,
      core: makeCore(words),
      bands: bandsFor(words),
      seed: SEED,
      planVersion: PLAN_V,
      count: 5,
      highConfidenceWords: ['hc1', 'hc2'],
    });
    expect(plan.candidates).toHaveLength(2);
    expect(plan.candidates.every((c) => c.bucket === 'high-confidence')).toBe(true);
  });

  it('各频段按覆盖不足优先（抽满后向覆盖更少的频段扩散）', () => {
    let snap = createEmptySnapshot(SEED, 'd');
    for (const w of ['b0a', 'b0b', 'b0c']) {
      snap = addAuditMarker(snap, marker(w, PLAN_V));
      snap = mergeStateChange(snap, w, 'known', 'initial');
    }
    snap = addAuditMarker(snap, marker('b1a', PLAN_V));
    snap = mergeStateChange(snap, 'b1a', 'known', 'initial');
    const explicit: FrequencyBands = { b0a: 0, b0b: 0, b0c: 0, b1a: 1 };

    const plan = freezeAuditPlan({
      markers: snap.auditMarkers,
      words: snap.words,
      core: makeCore(['b0a', 'b0b', 'b0c', 'b1a']),
      bands: explicit,
      seed: SEED,
      planVersion: PLAN_V,
      count: 2,
    });
    expect(plan.candidates).toHaveLength(2);
    expect(plan.candidates.map((c) => c.word)).toContain('b1a');
    expect(new Set(plan.candidates.map((c) => c.band)).size).toBe(2);
  });
});

describe('settleAuditAnswer (Spec B §8)', () => {
  function planWith(candidateWords: string[]): ReturnType<typeof freezeAuditPlan> {
    let snap = createEmptySnapshot(SEED, 'd');
    for (const w of candidateWords) {
      snap = addAuditMarker(snap, marker(w, PLAN_V));
      snap = mergeStateChange(snap, w, 'known', 'initial');
    }
    return freezeAuditPlan({
      markers: snap.auditMarkers,
      words: snap.words,
      core: makeCore(candidateWords),
      bands: bandsFor(candidateWords),
      seed: SEED,
      planVersion: PLAN_V,
      count: candidateWords.length,
    });
  }

  it('答对 → 状态为会、清除标记、记录 verified 事件、翻转结算位', () => {
    const plan = planWith(['apple']);
    const question = plan.questions[0]!;
    const correct: QuizAnswer = { kind: 'option', optionIndex: question.correctOptionIndex };
    const res = settleAuditAnswer({ plan, index: 0, answer: correct, current: undefined });

    expect(res.kind).toBe('verified');
    expect(res.change.newStatus).toBe('known');
    expect(res.change.source).toBe('audit');
    expect(res.clearedWord).toBe('apple');
    expect(res.event.outcome).toBe('verified');
    expect(res.event.bucket).toBe('initial-correct');
    expect(res.event.planVersion).toBe(PLAN_V);
    expect(res.plan.results[0]).toBe('verified');
  });

  it('答错 → 状态为不会、加入活跃生词表、记录 failed 事件', () => {
    const plan = planWith(['apple']);
    const question = plan.questions[0]!;
    const wrongIdx = question.correctOptionIndex === 0 ? 1 : 0;
    const res = settleAuditAnswer({ plan, index: 0, answer: { kind: 'option', optionIndex: wrongIdx }, current: undefined });

    expect(res.kind).toBe('failed');
    expect(res.change.newStatus).toBe('learning');
    expect(res.change.source).toBe('audit');
    expect(res.event.outcome).toBe('failed');
    expect(res.plan.results[0]).toBe('failed');
  });

  it('不确定 → 与答错同处理（不会 + failed 事件）', () => {
    const plan = planWith(['apple']);
    const res = settleAuditAnswer({ plan, index: 0, answer: { kind: 'unsure' }, current: undefined });

    expect(res.change.newStatus).toBe('learning');
    expect(res.event.outcome).toBe('failed');
    expect(res.plan.results[0]).toBe('failed');
  });
});
