import { describe, it, expect } from 'vitest';
import type { AuditPlan, AuditMarker, DictCore, FrequencyBands, WordState, VocabSnapshot } from '../shared/types';
import { createEmptySnapshot, mergeStateChange, addAuditMarker } from './storage';
import { validateAuditAnswerRequest, validateFrozenAuditPlan } from './auditValidation';
import { freezeAuditPlan, settleAuditAnswer } from '../strategy/audit';

const SEED = 'seed-xyz';
const PLAN_V = 'd:s:v1';

function marker(word: string, planVersion: string, pending = true, stateVersion = 1): AuditMarker {
  return { word, source: 'initial-correct', planVersion, stateVersion, createdAt: 1000, pending };
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

function knownWords(words: string[]): Record<string, WordState> {
  const out: Record<string, WordState> = {};
  for (const w of words) out[w] = { status: 'known', source: 'initial', updatedAt: 1, version: 1 };
  return out;
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
    stateVersion: 1,
  });
  return { plan, markers: snap.auditMarkers, words: snap.words };
}

describe('validateAuditAnswerRequest (服务端权威校验)', () => {
  it('合法 marker 结算 → 通过', () => {
    const { plan, markers, words } = frozenPlanFixture();
    const v = validateAuditAnswerRequest(plan, plan.version, 0, markers, words, 1);
    expect(v.ok).toBe(true);
  });

  it('伪造 auditPlanVersion（与冻结计划 version 不一致）→ 拒绝', () => {
    const { plan, markers, words } = frozenPlanFixture();
    const v = validateAuditAnswerRequest(plan, 'forged-version', 0, markers, words, 1);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('version mismatch');
  });

  it('未入选单词（index 越界）→ 拒绝', () => {
    const { plan, markers, words } = frozenPlanFixture();
    const v = validateAuditAnswerRequest(plan, plan.version, 99, markers, words, 1);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('out of range');
  });

  it('重复结算（已结算的 index 再次提交）→ 拒绝', () => {
    const { plan, markers, words } = frozenPlanFixture();
    const settled = settleAuditAnswer({
      plan,
      index: 0,
      answer: { kind: 'option', optionIndex: plan.questions[0]!.correctOptionIndex },
      current: undefined,
    });
    const v = validateAuditAnswerRequest(settled.plan, settled.plan.version, 0, markers, words, 1);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('already settled');
  });

  it('候选无 audit marker（池 B 高置信未知词，V0.1 内 deferred 未实现）→ 拒绝', () => {
    const { markers, words } = frozenPlanFixture();
    let snap = createEmptySnapshot(SEED, 'd');
    snap = mergeStateChange(snap, 'hc1', 'unknown', 'initial');
    const poolBPlan = freezeAuditPlan({
      markers: {},
      words: snap.words,
      core: makeCore(['hc1']),
      bands: bandsFor(['hc1']),
      seed: SEED,
      planVersion: PLAN_V,
      count: 1,
      stateVersion: 1,
      highConfidenceWords: ['hc1'],
    });
    expect(poolBPlan.candidates).toHaveLength(1);
    const v = validateAuditAnswerRequest(poolBPlan, poolBPlan.version, 0, markers, words, 1);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('no audit marker');
  });

  it('无冻结审计计划（plan 为 null）→ 拒绝', () => {
    const { markers, words } = frozenPlanFixture();
    const v = validateAuditAnswerRequest(null, 'any', 0, markers, words, 1);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('no frozen audit plan');
  });

  it('相同种子重测后旧计划（stateVersion 不符 = 过期计划）→ 拒绝', () => {
    const { plan, markers, words } = frozenPlanFixture();
    const v = validateAuditAnswerRequest(plan, plan.version, 0, markers, words, 2);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('state version mismatch');
  });

  // ============================================================
  // 加强校验矩阵（Issue #5）
  // ============================================================

  it('标记存在但已 clearing/pending=false → 拒绝', () => {
    const { plan, words } = frozenPlanFixture();
    const cleared = { ...plan.candidates[0]! };
    const markers2: Record<string, AuditMarker> = {
      [cleared.word]: marker(cleared.word, PLAN_V, false, 1),
    };
    const v = validateAuditAnswerRequest(plan, plan.version, 0, markers2, words, 1);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('not pending');
  });

  it('标记 planVersion 与冻结计划不一致（重测旧计划）→ 拒绝', () => {
    const { plan, words } = frozenPlanFixture();
    const w = plan.candidates[0]!.word;
    const markers2: Record<string, AuditMarker> = { [w]: marker(w, 'different-plan-version', true, 1) };
    const v = validateAuditAnswerRequest(plan, plan.version, 0, markers2, words, 1);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('planVersion mismatch');
  });

  it('池 A 候选当前状态已非 known（手动覆盖）→ 拒绝', () => {
    const { plan, markers } = frozenPlanFixture();
    const w = plan.candidates[0]!.word;
    const words2: Record<string, WordState> = { [w]: { status: 'learning', source: 'manual', updatedAt: 2, version: 1 } };
    const v = validateAuditAnswerRequest(plan, plan.version, 0, markers, words2, 1);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('must be known');
  });

  it('作答路径：持久化计划被篡改翻译 → 服务端重算不一致，拒绝（完整哈希校验）', () => {
    const { plan, markers, words } = frozenPlanFixture();
    // 篡改持久化计划中的选项翻译（isCorrect 顺序不变），但保留原 version
    const tampered = {
      ...plan,
      questions: plan.questions.map((q) => ({
        ...q,
        options: q.options.map((o, j) => ({ ...o, translation: `Y${j}_${q.word}` })),
      })),
    };
    const v = validateAuditAnswerRequest(tampered, tampered.version, 0, markers, words, 1);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('not reproducible');
  });
});

describe('validateFrozenAuditPlan (冻结计划服务端权威校验)', () => {
  /** 构造已完成首测且状态版本与冻结计划一致的快照 */
  function completedSnapshot(): VocabSnapshot {
    const { plan, markers, words } = frozenPlanFixture();
    let snap = createEmptySnapshot(SEED, 'd');
    snap = { ...snap, stateVersion: plan.stateVersion, installSeed: SEED };
    snap = { ...snap, words, auditMarkers: markers };
    snap = { ...snap, initialTest: { plan: { version: PLAN_V, seed: SEED, dictVersion: 'd', questions: [] }, answers: [], completed: true } };
    return snap;
  }

  it('合法冻结计划（popup 生成）→ 通过', () => {
    const { plan } = frozenPlanFixture();
    const snap = completedSnapshot();
    const v = validateFrozenAuditPlan(plan, snap);
    expect(v.ok).toBe(true);
  });

  it('结构不符（planVersion 被篡改）→ 拒绝', () => {
    const { plan } = frozenPlanFixture();
    const snap = completedSnapshot();
    const tampered = { ...plan, planVersion: 'forged' };
    const v = validateFrozenAuditPlan(tampered, snap);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('planVersion does not match');
  });

  it('stateVersion 不符 → 拒绝', () => {
    const { plan } = frozenPlanFixture();
    const snap = { ...completedSnapshot(), stateVersion: plan.stateVersion + 1 };
    const v = validateFrozenAuditPlan(plan, snap);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('stateVersion');
  });

  it('池 B（high-confidence）候选 → 明确 deferred（V0.1 内，非范围外），拒绝', () => {
    let snap = createEmptySnapshot(SEED, 'd');
    snap = mergeStateChange(snap, 'hc1', 'unknown', 'initial');
    const poolBPlan = freezeAuditPlan({
      markers: {},
      words: snap.words,
      core: makeCore(['hc1']),
      bands: bandsFor(['hc1']),
      seed: SEED,
      planVersion: PLAN_V,
      count: 1,
      highConfidenceWords: ['hc1'],
      stateVersion: 1,
    });
    const completed = { ...snap, stateVersion: 1, installSeed: SEED, initialTest: { plan: { version: PLAN_V, seed: SEED, dictVersion: 'd', questions: [] }, answers: [], completed: true } };
    const v = validateFrozenAuditPlan(poolBPlan, completed);
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.error).toContain('pool B');
      expect(v.error).toContain('deferred');
      expect(v.error).not.toContain('out of scope');
    }
  });

  // ============================================================
  // 加强：题目内容 / bucket / band 校验（Issue #5）
  // ============================================================

  it('篡改题目内容（band 同时保持 candidate/question 一致）→ 版本不可重算拒绝', () => {
    const { plan } = frozenPlanFixture();
    const snap = completedSnapshot();
    const newBand = plan.candidates[0]!.band === 0 ? 1 : 0;
    const tampered = {
      ...plan,
      candidates: plan.candidates.map((c, i) => (i === 0 ? { ...c, band: newBand } : c)),
      questions: plan.questions.map((q, i) => (i === 0 ? { ...q, band: newBand } : q)),
    };
    const v = validateFrozenAuditPlan(tampered, snap);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('not reproducible');
  });

  it('非法 bucket 值 → 拒绝', () => {
    const { plan } = frozenPlanFixture();
    const snap = completedSnapshot();
    const tampered = {
      ...plan,
      candidates: plan.candidates.map((c, i) => (i === 0 ? { ...c, bucket: 'bogus' as AuditPlan['candidates'][number]['bucket'] } : c)),
    };
    const v = validateFrozenAuditPlan(tampered, snap);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('invalid audit bucket');
  });

  it('question.band 越界 → 拒绝', () => {
    const { plan } = frozenPlanFixture();
    const snap = completedSnapshot();
    // 仅篡改 question.band（保持 candidate.band 合法），使校验先到达 question.band 检查
    const tampered = {
      ...plan,
      questions: plan.questions.map((q, i) => (i === 0 ? { ...q, band: 99 } : q)),
      candidates: plan.candidates,
    };
    const v = validateFrozenAuditPlan(tampered, snap);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('question band out of range');
  });

  it('candidate.band 与 question.band 不一致 → 拒绝', () => {
    const { plan } = frozenPlanFixture();
    const snap = completedSnapshot();
    const tampered = {
      ...plan,
      candidates: plan.candidates.map((c, i) => (i === 0 ? { ...c, band: c.band === 0 ? 9 : 0 } : c)),
    };
    const v = validateFrozenAuditPlan(tampered, snap);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('candidate band does not match question band');
  });

  it('选项非互异 → 拒绝', () => {
    const { plan } = frozenPlanFixture();
    const snap = completedSnapshot();
    const tampered = {
      ...plan,
      questions: plan.questions.map((q, i) => {
        if (i !== 0) return q;
        const opts = q.options.map((o) => ({ ...o }));
        // 复制第一项的翻译到第二项，破坏互异性
        opts[1] = { ...opts[1]!, translation: opts[0]!.translation };
        return { ...q, options: opts };
      }),
    };
    const v = validateFrozenAuditPlan(tampered, snap);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('not distinct translations');
  });

  it('替换四个选项的翻译（保持 isCorrect 顺序不变）→ 版本不可重算，拒绝（题目内容防篡改）', () => {
    const { plan } = frozenPlanFixture();
    const snap = completedSnapshot();
    // 把每题四个选项的翻译替换成另一组互异文本，isCorrect 顺序与 correctOptionIndex 保持不变
    const tampered = {
      ...plan,
      questions: plan.questions.map((q) => ({
        ...q,
        options: q.options.map((o, j) => ({ ...o, translation: `X${j}_${q.word}` })),
      })),
    };
    const v = validateFrozenAuditPlan(tampered, snap);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('not reproducible');
  });
});
