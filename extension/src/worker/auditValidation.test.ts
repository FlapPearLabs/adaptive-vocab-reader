import { describe, it, expect } from 'vitest';
import type { AuditPlan, AuditMarker, DictCore, FrequencyBands, WordState } from '../shared/types';
import { createEmptySnapshot, mergeStateChange, addAuditMarker } from './storage';
import { validateAuditAnswerRequest } from './auditValidation';
import { freezeAuditPlan, settleAuditAnswer } from '../strategy/audit';

const SEED = 'seed-xyz';
const PLAN_V = 'd:s:v1';

function marker(word: string, planVersion: string, pending = true): AuditMarker {
  return { word, source: 'initial-correct', planVersion, createdAt: 1000, pending };
}

function makeCore(words: string[]): DictCore {
  const core: DictCore = {};
  for (const w of words) core[w] = { phonetic: '', pos: 'n.', translation: `t_${w}` };
  for (let i = 0; i < 4; i++) core[`__filler${i}__`] = { phonetic: '', pos: 'n.', translation: `filler_${i}` };
  return core;
}

function bandsFor(words: string[]): FrequencyBands {
  const bands: FrequencyBands = {};
  words.forEach((w, i) => (bands[w] = i % 10));
  return bands;
}

/** 构造一个含 2 个合法池 A 候选的冻结审计计划，并返回相关快照片段 */
function frozenPlanFixture(): { plan: AuditPlan; markers: Record<string, AuditMarker>; words: Record<string, WordState> } {
  const words = ['apple', 'banana'];
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
    count: 2,
  });
  return { plan, markers: snap.auditMarkers, words: snap.words };
}

describe('validateAuditAnswerRequest (服务端权威校验)', () => {
  it('合法 marker 结算 → 通过', () => {
    const { plan, markers } = frozenPlanFixture();
    const v = validateAuditAnswerRequest(plan, plan.version, 0, markers);
    expect(v.ok).toBe(true);
  });

  it('伪造 auditPlanVersion（与冻结计划 version 不一致）→ 拒绝', () => {
    const { plan, markers } = frozenPlanFixture();
    const v = validateAuditAnswerRequest(plan, 'forged-version', 0, markers);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('version mismatch');
  });

  it('未入选单词（index 越界）→ 拒绝', () => {
    const { plan, markers } = frozenPlanFixture();
    const v = validateAuditAnswerRequest(plan, plan.version, 99, markers);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('out of range');
  });

  it('重复结算（已结算的 index 再次提交）→ 拒绝', () => {
    const { plan, markers } = frozenPlanFixture();
    // 先结算第 0 题
    const settled = settleAuditAnswer({
      plan,
      index: 0,
      answer: { kind: 'option', optionIndex: plan.questions[0]!.correctOptionIndex },
      current: undefined,
    });
    // 再次提交同一 index → 应被拒
    const v = validateAuditAnswerRequest(settled.plan, settled.plan.version, 0, markers);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('already settled');
  });

  it('候选无 audit marker（池 B 高置信未知词，V0.1 未支持）→ 拒绝', () => {
    const { plan, markers } = frozenPlanFixture();
    // 构造一个池 B 候选的冻结计划：候选词无 marker
    let snap = createEmptySnapshot(SEED, 'd');
    snap = mergeStateChange(snap, 'hc1', 'unknown', 'initial');
    const poolBPlan = freezeAuditPlan({
      markers: {}, // 无 marker
      words: snap.words,
      core: makeCore(['hc1']),
      bands: bandsFor(['hc1']),
      seed: SEED,
      planVersion: PLAN_V,
      count: 1,
      highConfidenceWords: ['hc1'],
    });
    expect(poolBPlan.candidates).toHaveLength(1);
    const v = validateAuditAnswerRequest(poolBPlan, poolBPlan.version, 0, markers);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('no audit marker');
  });

  it('无冻结审计计划（plan 为 null）→ 拒绝', () => {
    const { markers } = frozenPlanFixture();
    const v = validateAuditAnswerRequest(null, 'any', 0, markers);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('no frozen audit plan');
  });
});
