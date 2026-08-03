import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import type {
  VocabSnapshot,
  InitialTestPlan,
  AuditPlan,
  AuditMarker,
  InitialTestState,
  InitialTestStartTransition,
  InitialTestResetTransition,
  VocabStrategy,
  DictCore,
  FrequencyBands,
  WordState,
} from '../shared/types';
import { createEmptySnapshot, addAuditMarker, mergeStateChange } from './storage';
import { reduceWorkerMessage, loadSnapshot, type WorkerSender } from './index';
import { freezeAuditPlan } from '../strategy/audit';
import { createVocabStrategy } from '../strategy/index';

const SEED = 'seed-xyz';
const PLAN_V = 'd:s:v1';

function makeCore(words: string[]): DictCore {
  const core: DictCore = {};
  for (const w of words) core[w] = { phonetic: '', pos: 'n.', translation: `t_${w}` };
  for (let i = 0; i < 4; i++) core[`__f${i}__`] = { phonetic: '', pos: 'n.', translation: `f_${i}` };
  return core;
}
function bandsFor(words: string[]): FrequencyBands {
  const bands: FrequencyBands = {};
  words.forEach((w, i) => (bands[w] = i % 10));
  return bands;
}

describe('reduceWorkerMessage — INITIAL_TEST_ANSWER 协调路径', () => {
  /** 一个单词的最小首测计划（apple，正确选项 index 0） */
  function planFor(word: string): InitialTestPlan {
    return {
      version: PLAN_V,
      seed: SEED,
      dictVersion: 'd',
      questions: [
        {
          word,
          band: 0,
          options: [
            { translation: 'a', isCorrect: true },
            { translation: 'b', isCorrect: false },
            { translation: 'c', isCorrect: false },
            { translation: 'd', isCorrect: false },
          ],
          correctOptionIndex: 0,
          unsureIndex: 4,
        },
      ],
    };
  }

  it('首测会覆盖手动 WordState，并以同一 wordKey 写入初测证据（真实协调路径）', () => {
    const word = 'apple';
    const snapshot: VocabSnapshot = createEmptySnapshot(SEED, 'd');
    // 该词先被用户手动标记为 learning；首测答对后必须由最新显式测试动作覆盖。
    snapshot.words[word] = { status: 'learning', source: 'manual', updatedAt: 1, version: 0 };
    snapshot.initialTest = { plan: planFor(word), answers: [null], completed: false };

    const { snapshot: next, response, broadcast, changed } = reduceWorkerMessage(
      snapshot,
      { type: 'INITIAL_TEST_ANSWER', questionIndex: 0, answer: { kind: 'option', optionIndex: 0 } },
      { id: 'ext', url: 'popup.html' },
    );

    // 1) 作答已被记录
    expect(next.initialTest?.answers[0]).not.toBeNull();
    // 2) 最新 initial 覆盖旧 manual，且同时写入唯一测试证据
    expect(next.words[word]?.source).toBe('initial');
    expect(next.words[word]?.status).toBe('known');
    expect(next.assessmentEvidence[word]).toMatchObject({ outcome: 'known', source: 'initial' });
    // 3) 广播最新状态
    expect(broadcast).toEqual({ word, newStatus: 'known' });
    expect(changed).toBe(true);
    // 4) 结果类型确为 correct
    expect((response as { result?: { kind?: string } }).result?.kind).toBe('correct');
  });

  it('首测答对（无手动状态）→ 状态置为 known、不创建审计标记、广播状态变更', () => {
    const word = 'apple';
    const snapshot: VocabSnapshot = createEmptySnapshot(SEED, 'd');
    snapshot.initialTest = { plan: planFor(word), answers: [null], completed: false };

    const { snapshot: next, broadcast, changed } = reduceWorkerMessage(
      snapshot,
      { type: 'INITIAL_TEST_ANSWER', questionIndex: 0, answer: { kind: 'option', optionIndex: 0 } },
      { id: 'ext', url: 'popup.html' },
    );

    // R-AUD-3：V0.1 用户路径已切断审计——首测结算不得创建任何审计标记
    expect(next.auditMarkers[word]).toBeUndefined();
    expect(Object.keys(next.auditMarkers)).toHaveLength(0);
    expect(next.words[word]?.status).toBe('known');
    expect(next.assessmentEvidence[word]).toMatchObject({ outcome: 'known', source: 'initial' });
    expect(broadcast).toEqual({ word, newStatus: 'known' });
    expect(changed).toBe(true);
  });

  it('已完成的计划再次作答 → 拒绝', () => {
    const word = 'apple';
    const snapshot: VocabSnapshot = createEmptySnapshot(SEED, 'd');
    snapshot.initialTest = { plan: planFor(word), answers: [{ kind: 'option', optionIndex: 0 }], completed: true };
    const { snapshot: next, response } = reduceWorkerMessage(
      snapshot,
      { type: 'INITIAL_TEST_ANSWER', questionIndex: 0, answer: { kind: 'option', optionIndex: 0 } },
      { id: 'ext', url: 'popup.html' },
    );
    expect((response as { error?: string }).error).toContain('cannot answer');
    expect(next).toBe(snapshot);
  });
});

describe('reduceWorkerMessage — GET_ASSESSMENT_EVIDENCE（估计只读证据）', () => {
  it('返回 AssessmentEvidence 且不改变快照（changed=false）', () => {
    const word = 'apple';
    const snapshot: VocabSnapshot = createEmptySnapshot(SEED, 'd');
    snapshot.assessmentEvidence[word] = { outcome: 'known', source: 'initial', assessedAt: 1 };
    snapshot.words[word] = { status: 'learning', source: 'manual', updatedAt: 2, version: 0 };

    const { snapshot: next, response, changed } = reduceWorkerMessage(
      snapshot,
      { type: 'GET_ASSESSMENT_EVIDENCE' },
      { id: 'ext', url: 'popup.html' },
    );

    // 估计只读取 AssessmentEvidence（RULES 双真相源）；manual WordState 不影响证据返回。
    expect((response as { evidence?: Record<string, unknown> }).evidence).toEqual({
      apple: { outcome: 'known', source: 'initial', assessedAt: 1 },
    });
    expect(changed).toBe(false);
    expect(next).toBe(snapshot);
  });
});

describe('reduceWorkerMessage — STATE_CHANGE 清除标记（手动覆盖优先）', () => {
  it('手动标记会 → 清除该词审计标记', () => {
    const word = 'apple';
    const snapshot: VocabSnapshot = createEmptySnapshot(SEED, 'd');
    snapshot.auditMarkers[word] = {
      word,
      source: 'initial-correct',
      planVersion: PLAN_V,
      stateVersion: 0,
      createdAt: 1,
      pending: true,
    };
    snapshot.assessmentEvidence[word] = { outcome: 'learning', source: 'initial', assessedAt: 7 };
    const { snapshot: next } = reduceWorkerMessage(
      snapshot,
      { type: 'STATE_CHANGE', word, newStatus: 'known' },
      { id: 'ext', url: 'popup.html' },
    );
    expect(next.auditMarkers[word]).toBeUndefined();
    expect(next.words[word]?.status).toBe('known');
    expect(next.assessmentEvidence[word]).toEqual({ outcome: 'learning', source: 'initial', assessedAt: 7 });
  });
});

describe('reduceWorkerMessage — FREEZE_AUDIT_PLAN sender 校验（精确 URL）', () => {
  const sender: WorkerSender = { id: 'ext', url: 'popup.html' };

  beforeAll(() => {
    (globalThis as { chrome?: unknown }).chrome = {
      runtime: { id: 'ext', getURL: (p: string) => `chrome-extension://ext/${p}` },
    };
  });
  afterAll(() => {
    delete (globalThis as { chrome?: unknown }).chrome;
  });

  function validFrozenPlan(): { plan: AuditPlan; snapshot: VocabSnapshot } {
    const words = ['apple', 'banana'];
    let snap = createEmptySnapshot(SEED, 'd');
    for (const w of words) {
      snap = addAuditMarker(snap, { word: w, source: 'initial-correct', planVersion: PLAN_V, stateVersion: 1, createdAt: 1, pending: true });
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
    snap = { ...snap, stateVersion: 1, installSeed: SEED };
    snap = { ...snap, initialTest: { plan: { version: PLAN_V, seed: SEED, dictVersion: 'd', questions: [] }, answers: [], completed: true } };
    return { plan, snapshot: snap };
  }

  it('精确 popup URL + 受信任 sender → 通过（payload 由服务端校验后持久化）', () => {
    const { plan, snapshot } = validFrozenPlan();
    const { snapshot: next, response } = reduceWorkerMessage(
      snapshot,
      { type: 'FREEZE_AUDIT_PLAN', plan },
      { id: 'ext', url: 'chrome-extension://ext/popup.html' },
    );
    expect((response as { success?: boolean }).success).toBe(true);
    expect(next.auditPlan?.version).toBe(plan.version);
  });

  it('sender.url 非精确（子串/其他来源）→ 拒绝', () => {
    const { plan, snapshot } = validFrozenPlan();
    const { response } = reduceWorkerMessage(
      snapshot,
      { type: 'FREEZE_AUDIT_PLAN', plan },
      { id: 'ext', url: 'chrome-extension://ext/popup.html?x=1' },
    );
    expect((response as { error?: string }).error).toContain('may only be frozen by the extension popup');
  });

  it('内容脚本（带 sender.tab）→ 拒绝', () => {
    const { plan, snapshot } = validFrozenPlan();
    const { response } = reduceWorkerMessage(
      snapshot,
      { type: 'FREEZE_AUDIT_PLAN', plan },
      { id: 'ext', url: 'chrome-extension://ext/popup.html', tab: { id: 5 } },
    );
    expect((response as { error?: string }).error).toContain('may only be frozen by the extension popup');
  });
});

describe('reduceWorkerMessage — AUDIT_ANSWER 加强校验', () => {
  function setup(): { snapshot: VocabSnapshot; plan: AuditPlan } {
    const words = ['apple', 'banana'];
    let snap = createEmptySnapshot(SEED, 'd');
    for (const w of words) {
      snap = addAuditMarker(snap, { word: w, source: 'initial-correct', planVersion: PLAN_V, stateVersion: 1, createdAt: 1, pending: true });
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
    snap = { ...snap, stateVersion: 1, installSeed: SEED };
    snap = { ...snap, auditPlan: plan };
    return { snapshot: snap, plan };
  }

  it('手动覆盖使候选状态非 known → 拒绝（pool A 当前必须 known）', () => {
    const { snapshot, plan } = setup();
    // 手动把 apple 改为不会
    const snap2: VocabSnapshot = { ...snapshot, words: { ...snapshot.words, apple: { status: 'learning', source: 'manual', updatedAt: 2, version: 1 } } };
    const { response } = reduceWorkerMessage(
      snap2,
      { type: 'AUDIT_ANSWER', auditPlanVersion: plan.version, index: 0, answer: { kind: 'option', optionIndex: plan.questions[0]!.correctOptionIndex } },
      { id: 'ext', url: 'popup.html' },
    );
    expect((response as { error?: string }).error).toContain('must be known');
  });

  it('过期计划（stateVersion 不符）→ 拒绝', () => {
    const { snapshot, plan } = setup();
    const snap2: VocabSnapshot = { ...snapshot, stateVersion: 2 };
    const { response } = reduceWorkerMessage(
      snap2,
      { type: 'AUDIT_ANSWER', auditPlanVersion: plan.version, index: 0, answer: { kind: 'option', optionIndex: plan.questions[0]!.correctOptionIndex } },
      { id: 'ext', url: 'popup.html' },
    );
    expect((response as { error?: string }).error).toContain('state version mismatch');
  });
});

describe('loadSnapshot — 持久化迁移 + 重启验证（Fix #1 真实 storage 集成测试）', () => {
  const STORAGE_KEY = 'avr_vocab_snapshot';
  let store: Record<string, unknown> = {};

  beforeEach(() => {
    store = {};
    (globalThis as { chrome?: unknown }).chrome = {
      storage: {
        local: {
          get: (key: string) => Promise.resolve({ [key]: store[key] }),
          set: (obj: Record<string, unknown>) => {
            for (const [k, v] of Object.entries(obj)) store[k] = v;
            return Promise.resolve();
          },
        },
      },
    };
  });
  afterEach(() => {
    delete (globalThis as { chrome?: unknown }).chrome;
    vi.unstubAllGlobals();
  });

  function v1RawWithPlan() {
    return {
      schemaVersion: 1,
      dictVersion: 'd',
      stateVersion: 0,
      installSeed: 'seed-1',
      words: { apple: { status: 'known', source: 'manual', updatedAt: 1, version: 0 } },
      auditMarkers: {},
      auditLog: [],
      auditPlan: {
        version: 'old-v1-hash',
        planVersion: 'p',
        stateVersion: 1, // 旧格式却带 stateVersion：旧实现曾原样保留，Fix #1 必须失效
        seed: 'seed-1',
        candidates: [{ word: 'apple', band: 'core', translation: '苹果' }],
        questions: [],
        results: [],
        createdAt: 1,
      },
      initialTest: null,
      lastUpdated: 1,
    };
  }

  it('旧 v1 快照（auditPlan 带 stateVersion）→ 迁移为 v3 并立即写回 storage', async () => {
    store[STORAGE_KEY] = v1RawWithPlan();

    const snap = await loadSnapshot();

    // 内存中返回升级后的 v3
    expect(snap.schemaVersion).toBe(3);
    expect(snap.auditPlan).toBeNull();
    // 升级结果已持久化写回 storage（持久迁移，非按次转换）
    const persisted = store[STORAGE_KEY] as VocabSnapshot;
    expect(persisted.schemaVersion).toBe(3);
    expect(persisted.auditPlan).toBeNull();
    // 用户有效数据保留
    expect(persisted.words['apple']?.status).toBe('known');
  });

  it('重启后再次读取 → 命中已升级 v3 直接短路，不再重新迁移（幂等持久）', async () => {
    store[STORAGE_KEY] = v1RawWithPlan();

    const first = await loadSnapshot();
    // 模拟 worker 重启：storage 中已是持久化的 v3
    const second = await loadSnapshot();

    expect(second.schemaVersion).toBe(3);
    // 第二次应直接短路返回持久化 v3，auditPlan 仍为 null（未被中间态污染）
    expect(second.auditPlan).toBeNull();
    // 两次均基于同一持久化 installSeed，内容一致
    expect(second.installSeed).toBe(first.installSeed);
    // storage 中仅一份 v3（未被反复重写产生多版本）
    expect((store[STORAGE_KEY] as VocabSnapshot).schemaVersion).toBe(3);
  });

  it('首次运行（storage 空）→ 创建并持久化空 v3 快照', async () => {
    const snap = await loadSnapshot();
    expect(snap.schemaVersion).toBe(3);
    expect(snap.words).toEqual({});
    const persisted = store[STORAGE_KEY] as VocabSnapshot;
    expect(persisted.schemaVersion).toBe(3);
    expect(typeof persisted.installSeed).toBe('string');
  });

  it('schema 2 fixture 经真实 worker/storage 路径读取最小 FormsMap 后合并为 wordKey，并只写回一次 v3', async () => {
    (globalThis as { chrome?: { runtime?: unknown } }).chrome!.runtime = { getURL: (path: string) => `chrome-extension://test/${path}` };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ went: 'go' }) });
    vi.stubGlobal('fetch', fetchMock);
    store[STORAGE_KEY] = {
      schemaVersion: 2, dictVersion: 'd', stateVersion: 0, installSeed: 's', auditMarkers: {}, auditLog: [], auditPlan: null, initialTest: null, lastUpdated: 1,
      words: { went: { status: 'known', source: 'initial', updatedAt: 1, version: 0 } },
    };

    const snap = await loadSnapshot();
    expect(fetchMock).toHaveBeenCalledWith('chrome-extension://test/data/forms.json');
    expect(snap.schemaVersion).toBe(3);
    expect(snap.words).toEqual({ go: { status: 'known', source: 'initial', updatedAt: 1, version: 0 } });
    expect((store[STORAGE_KEY] as VocabSnapshot).schemaVersion).toBe(3);
  });

  it('生产路径 FormsMap 不可读取时保留 schema 2 原快照，绝不错误写成 v3', async () => {
    (globalThis as { chrome?: { runtime?: unknown } }).chrome!.runtime = { getURL: () => 'chrome-extension://test/data/forms.json' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const fixture = {
      schemaVersion: 2, dictVersion: 'd', stateVersion: 0, installSeed: 's', auditMarkers: {}, auditLog: [], auditPlan: null, initialTest: null, lastUpdated: 1,
      words: { went: { status: 'known', source: 'initial', updatedAt: 1, version: 0 } },
    };
    store[STORAGE_KEY] = fixture;

    await expect(loadSnapshot()).rejects.toThrow('FormsMap unavailable');
    expect(store[STORAGE_KEY]).toBe(fixture);
    expect((store[STORAGE_KEY] as { schemaVersion: number }).schemaVersion).toBe(2);
  });

  it('生产路径 FormsMap 含空白 target 时保留 schema 2 原快照，绝不持久化空 wordKey', async () => {
    (globalThis as { chrome?: { runtime?: unknown } }).chrome!.runtime = { getURL: () => 'chrome-extension://test/data/forms.json' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ went: ' ' }) }));
    const fixture = {
      schemaVersion: 2, dictVersion: 'd', stateVersion: 0, installSeed: 's', auditMarkers: {}, auditLog: [], auditPlan: null, lastUpdated: 1,
      words: { went: { status: 'known', source: 'initial', updatedAt: 1, version: 0 } },
      initialTest: { plan: { questions: [{ word: 'went', options: [{}, {}], correctOptionIndex: 0 }] }, answers: [{ kind: 'option', optionIndex: 0 }], completed: false },
    };
    store[STORAGE_KEY] = fixture;

    await expect(loadSnapshot()).rejects.toThrow('FormsMap unavailable');
    expect(store[STORAGE_KEY]).toBe(fixture);
    expect((store[STORAGE_KEY] as { schemaVersion: number }).schemaVersion).toBe(2);
  });
});

describe('reduceWorkerMessage — INITIAL_TEST_START/RESET 机械应用生命周期 transition（P1-2）', () => {
  function fullPlan(): InitialTestPlan {
    const words = Array.from({ length: 60 }, (_, i) => `w${i}`);
    const strat = createVocabStrategy();
    return strat.freezeInitialTestPlan({ core: makeCore(words), forms: {}, bands: bandsFor(words), seed: SEED, dictVersion: 'd' });
  }

  it('INITIAL_TEST_START：worker 仅机械应用 transition——initialTest 由 plan 构造、auditPlan/标记清空', () => {
    const plan = fullPlan();
    const snapshot: VocabSnapshot = createEmptySnapshot(SEED, 'd');
    // 上一轮残留的待审计标记与冻结计划
    snapshot.auditMarkers['old'] = { word: 'old', source: 'initial-correct', planVersion: 'pv', stateVersion: 0, createdAt: 1, pending: true };
    snapshot.auditPlan = { version: 'ap', planVersion: 'pv', stateVersion: 0, seed: SEED, candidates: [], questions: [], results: [], createdAt: 1 };

    const { snapshot: next } = reduceWorkerMessage(
      snapshot,
      { type: 'INITIAL_TEST_START', plan },
      { id: 'ext', url: 'popup.html' },
    );
    expect(next.stateVersion).toBe(1);
    // initialTest 由 plan 真实构造（worker 不自造 InitialTestState）
    expect(next.initialTest).not.toBeNull();
    expect(next.initialTest!.plan).toBe(plan);
    expect(next.initialTest!.answers).toEqual(Array.from({ length: plan.questions.length }, () => null));
    expect(next.initialTest!.completed).toBe(false);
    // auditPlan 与标记由策略交付的 transition 机械清空（worker 不解释布尔）
    expect(next.auditPlan).toBeNull();
    expect(next.auditMarkers).toEqual({});
  });

  it('INITIAL_TEST_START：不保留 stateVersion === nextStateVersion 的异常 marker', () => {
    const plan = fullPlan();
    const snapshot: VocabSnapshot = createEmptySnapshot(SEED, 'd');
    snapshot.auditMarkers['ghost'] = { word: 'ghost', source: 'initial-correct', planVersion: 'pv', stateVersion: 1, createdAt: 1, pending: true };
    const { snapshot: next } = reduceWorkerMessage(
      snapshot,
      { type: 'INITIAL_TEST_START', plan },
      { id: 'ext', url: 'popup.html' },
    );
    expect(next.stateVersion).toBe(1);
    expect(next.auditMarkers).toEqual({}); // 异常 marker 被排除
  });

  it('INITIAL_TEST_RESET：worker 仅机械应用 transition——initialTest:null、auditPlan:null、标记清空', () => {
    const snapshot: VocabSnapshot = createEmptySnapshot(SEED, 'd');
    snapshot.auditMarkers['old'] = { word: 'old', source: 'initial-correct', planVersion: 'pv', stateVersion: 0, createdAt: 1, pending: true };
    snapshot.auditPlan = { version: 'ap', planVersion: 'pv', stateVersion: 0, seed: SEED, candidates: [], questions: [], results: [], createdAt: 1 };
    snapshot.initialTest = { plan: fullPlan(), answers: [], completed: false };

    const { snapshot: next } = reduceWorkerMessage(
      snapshot,
      { type: 'INITIAL_TEST_RESET' },
      { id: 'ext', url: 'popup.html' },
    );
    expect(next.stateVersion).toBe(1);
    expect(next.initialTest).toBeNull();
    expect(next.auditPlan).toBeNull();
    expect(next.auditMarkers).toEqual({});
  });
});

describe('reduceWorkerMessage — 机械应用 seam 锁死（fake strategy 注入，不依赖真实策略推断）', () => {
  // 构造一个 fake strategy：start/reset 返回明显、可辨识的哨兵值；
  // 其余 7 个方法委托给真实策略（本组测试不触发它们），以证明 worker 对
  // INITIAL_TEST_START / INITIAL_TEST_RESET 的 transition 字段是「原样应用」而非自行计算。
  function makeFake(): {
    fake: VocabStrategy;
    sentinelStart: InitialTestStartTransition;
    sentinelReset: InitialTestResetTransition;
  } {
    const real = createVocabStrategy();
    const sentinelStart: InitialTestStartTransition = {
      nextStateVersion: 4242,
      auditMarkers: {
        SENTINEL: { word: 'SENTINEL', source: 'initial-correct', planVersion: 'SENT-PV', stateVersion: 4242, createdAt: 1, pending: true },
      },
      auditPlan: { version: 'SENT-AP', planVersion: 'SENT-PV', stateVersion: 4242, seed: SEED, candidates: [], questions: [], results: [], createdAt: 1 },
      initialTest: { plan: { version: 'SENT-PLAN', seed: SEED, dictVersion: 'd', questions: [] }, answers: [], completed: false },
    };
    const sentinelReset: InitialTestResetTransition = {
      nextStateVersion: 4242,
      auditMarkers: { SENTINEL: { word: 'SENTINEL', source: 'initial-correct', planVersion: 'SENT-PV', stateVersion: 4242, createdAt: 1, pending: true } },
      auditPlan: { version: 'SENT-AP', planVersion: 'SENT-PV', stateVersion: 4242, seed: SEED, candidates: [], questions: [], results: [], createdAt: 1 },
      initialTest: null,
    };
    const fake: VocabStrategy = {
      ...real,
      startInitialTest: (_plan: InitialTestPlan, _stateVersion: number) => sentinelStart,
      resetInitialTest: (_stateVersion: number) => sentinelReset,
    };
    return { fake, sentinelStart, sentinelReset };
  }

  function baseSnapshot(): VocabSnapshot {
    const snap = createEmptySnapshot(SEED, 'd');
    // 故意塞入旧/异常 marker 与冻结计划，证明 worker 不解释、原样覆盖
    snap.auditMarkers['stale'] = { word: 'stale', source: 'initial-correct', planVersion: 'OLD', stateVersion: 0, createdAt: 1, pending: true };
    snap.auditPlan = { version: 'ap', planVersion: 'OLD', stateVersion: 0, seed: SEED, candidates: [], questions: [], results: [], createdAt: 1 };
    snap.initialTest = { plan: { version: 'OLD', seed: SEED, dictVersion: 'd', questions: [] }, answers: [], completed: false };
    return snap;
  }

  // 仅用于通过 INITIAL_TEST_START 的 50 题守卫；transition 字段仍由 fake strategy 的哨兵决定。
  function fullPlan(): InitialTestPlan {
    const words = Array.from({ length: 60 }, (_, i) => `w${i}`);
    return createVocabStrategy().freezeInitialTestPlan({ core: makeCore(words), forms: {}, bands: bandsFor(words), seed: SEED, dictVersion: 'd' });
  }

  it('INITIAL_TEST_START：worker 原样应用 fake transition 的每个字段（引用相等，未重算）', () => {
    const { fake, sentinelStart } = makeFake();
    const { snapshot: next } = reduceWorkerMessage(
      baseSnapshot(),
      { type: 'INITIAL_TEST_START', plan: fullPlan() },
      { id: 'ext', url: 'popup.html' },
      fake,
    );
    // 全部字段直接来自 fake strategy 的哨兵值——证明 worker 机械合并而非自行构造
    expect(next.stateVersion).toBe(4242);
    expect(next.auditMarkers).toBe(sentinelStart.auditMarkers);
    expect(next.auditPlan).toBe(sentinelStart.auditPlan);
    expect(next.initialTest).toBe(sentinelStart.initialTest);
  });

  it('INITIAL_TEST_RESET：worker 原样应用 fake transition 的每个字段（引用相等，未重算）', () => {
    const { fake, sentinelReset } = makeFake();
    const { snapshot: next } = reduceWorkerMessage(
      baseSnapshot(),
      { type: 'INITIAL_TEST_RESET' },
      { id: 'ext', url: 'popup.html' },
      fake,
    );
    expect(next.stateVersion).toBe(4242);
    expect(next.auditMarkers).toBe(sentinelReset.auditMarkers);
    expect(next.auditPlan).toBe(sentinelReset.auditPlan);
    expect(next.initialTest).toBeNull();
  });
});
