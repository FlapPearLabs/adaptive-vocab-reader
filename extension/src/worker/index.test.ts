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
  DailyTestState,
  AssessmentEvidence,
} from '../shared/types';
import { createEmptySnapshot, addAuditMarker, mergeStateChange } from './storage';
import { reduceWorkerMessage, loadSnapshot, validateDailyTestPlan, type WorkerSender } from './index';
import { freezeAuditPlan } from '../strategy/audit';
import { createVocabStrategy } from '../strategy/index';

const SEED = 'seed-xyz';
const PLAN_V = 'd:s:v1';
/** 每日测试固定注入的「当前本地日期」（date seam 最小输入；与 makeDailyPlan 默认 localDate 一致） */
const DAILY_TODAY = '2026-08-03';

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

// ============================================================
// 每日校准轮协调（Ticket 04 / R-DLY-2/4/5/6/7/8/9）
// ============================================================

describe('reduceWorkerMessage — DAILY_TEST_START（R-DLY-5/7/8/9）', () => {
  /** 经真实策略冻结路径生成每日计划（20 词、频段 0..9 循环，filler 落 band9 不影响偶数轮） */
  function makeDailyPlan(roundIndex: number, evidence: Record<string, AssessmentEvidence> = {}, localDate = DAILY_TODAY): DailyTestState {
    const words = Array.from({ length: 20 }, (_, i) => `w${i}`);
    const core = makeCore(words);
    const bands = bandsFor(words);
    return createVocabStrategy().freezeDailyTest(
      { core, forms: {}, bands, seed: SEED, dictVersion: 'd', completedRoundIndex: roundIndex, evidence },
      localDate,
    );
  }

  function snapshotWithCompletedInitialTest(): VocabSnapshot {
    const snap = createEmptySnapshot(SEED, 'd');
    snap.initialTest = { plan: { version: PLAN_V, seed: SEED, dictVersion: 'd', questions: [] }, answers: [], completed: true };
    return snap;
  }

  it('R-DLY-5：首测未完成 → 拒绝创建 DailyTestState（快照保持 dailyTest=null）', () => {
    const snap = createEmptySnapshot(SEED, 'd'); // initialTest 为 null（首测未开始）
    const plan = makeDailyPlan(0);
    const { snapshot: next, response, changed } = reduceWorkerMessage(
      snap,
      { type: 'DAILY_TEST_START', test: plan },
      { id: 'ext', url: 'popup.html' },
      undefined,
      DAILY_TODAY,
    );
    expect((response as { error?: string }).error).toContain('initial test required');
    expect(next.dailyTest).toBeNull();
    expect(changed).toBe(false);
  });

  it('R-DLY-5：首测完成后首次开始 → 创建轮（roundIndex=completedRoundIndex），同日重开返回同一轮（暂停恢复）', () => {
    const snap = snapshotWithCompletedInitialTest();
    const plan = makeDailyPlan(0);
    const first = reduceWorkerMessage(snap, { type: 'DAILY_TEST_START', test: plan }, { id: 'ext', url: 'popup.html' }, undefined, DAILY_TODAY);
    expect((first.response as { created?: boolean }).created).toBe(true);
    expect(first.snapshot.dailyTest).toMatchObject({ localDate: DAILY_TODAY, roundIndex: 0, completed: false, skipped: false });
    expect(first.snapshot.dailyTest!.answers).toEqual([null, null, null, null, null]);
    expect(first.changed).toBe(true);

    // 同日再次开始（关闭 popup 后重开）：恢复同一冻结计划，不重建
    const plan2 = makeDailyPlan(0); // 同种子同证据 → 相同计划
    const second = reduceWorkerMessage(first.snapshot, { type: 'DAILY_TEST_START', test: plan2 }, { id: 'ext', url: 'popup.html' }, undefined, DAILY_TODAY);
    expect(second.snapshot.dailyTest).toBe(first.snapshot.dailyTest); // 引用相等：原样复用
    expect(second.changed).toBe(false);
  });

  it('R-DLY-8：跨日（localDate 不同）→ 未完成轮过期并创建新轮，不递增 completedRoundIndex', () => {
    let snap = snapshotWithCompletedInitialTest();
    const day1 = makeDailyPlan(0, {}, DAILY_TODAY);
    snap = reduceWorkerMessage(snap, { type: 'DAILY_TEST_START', test: day1 }, { id: 'ext', url: 'popup.html' }, undefined, DAILY_TODAY).snapshot;
    // 答 2 题（部分完成）
    for (let i = 0; i < 2; i++) {
      const q = snap.dailyTest!.questions[i]!;
      snap = reduceWorkerMessage(
        snap,
        { type: 'DAILY_TEST_ANSWER', questionIndex: i, answer: { kind: 'option', optionIndex: q.correctOptionIndex } },
        { id: 'ext', url: 'popup.html' },
        undefined,
        DAILY_TODAY,
      ).snapshot;
    }
    const answeredWords = snap.dailyTest!.questions.slice(0, 2).map((q) => q.word);
    expect(snap.completedRoundIndex).toBe(0); // 未完成轮不递增（R-DLY-2）

    // 跨日：新一天（today=2026-08-04）开始 → 旧轮过期（已答证据已双写保留），创建新轮
    const day2 = makeDailyPlan(0, {}, '2026-08-04');
    const crossed = reduceWorkerMessage(snap, { type: 'DAILY_TEST_START', test: day2 }, { id: 'ext', url: 'popup.html' }, undefined, '2026-08-04');
    expect(crossed.snapshot.dailyTest!.localDate).toBe('2026-08-04');
    expect(crossed.snapshot.dailyTest!.answers).toEqual([null, null, null, null, null]);
    // 已答词的 WordState(daily) 与 Evidence(daily) 保留（R-DLY-8：已答保留、不回滚）
    for (const w of answeredWords) {
      expect(crossed.snapshot.words[w]?.source).toBe('daily');
      expect(crossed.snapshot.assessmentEvidence[w]?.source).toBe('daily');
    }
    // 未完成轮不递增 completedRoundIndex（R-DLY-2 / R-DLY-8）
    expect(crossed.snapshot.completedRoundIndex).toBe(0);
  });

  it('R-DLY-9：同一本地日期最多一轮——同日重复开始不创建新轮', () => {
    const snap = snapshotWithCompletedInitialTest();
    const plan = makeDailyPlan(0);
    const a = reduceWorkerMessage(snap, { type: 'DAILY_TEST_START', test: plan }, { id: 'ext', url: 'popup.html' }, undefined, DAILY_TODAY).snapshot;
    const b = reduceWorkerMessage(a, { type: 'DAILY_TEST_START', test: makeDailyPlan(0) }, { id: 'ext', url: 'popup.html' }, undefined, DAILY_TODAY).snapshot;
    expect(b.dailyTest).toBe(a.dailyTest); // 唯一轮次
  });

  it('R-DLY-6 反悔：已跳过轮再次开始 → skipped 变回 false 并复用同一冻结计划', () => {
    let snap = snapshotWithCompletedInitialTest();
    snap = reduceWorkerMessage(snap, { type: 'DAILY_TEST_START', test: makeDailyPlan(0) }, { id: 'ext', url: 'popup.html' }, undefined, DAILY_TODAY).snapshot;
    const skipped = reduceWorkerMessage(snap, { type: 'DAILY_TEST_SKIP' }, { id: 'ext', url: 'popup.html' }, undefined, DAILY_TODAY).snapshot;
    expect(skipped.dailyTest!.skipped).toBe(true);

    const resumed = reduceWorkerMessage(
      skipped,
      { type: 'DAILY_TEST_START', test: makeDailyPlan(0) },
      { id: 'ext', url: 'popup.html' },
      undefined,
      DAILY_TODAY,
    );
    expect(resumed.snapshot.dailyTest!.skipped).toBe(false);
    // 复用同一冻结计划：questions 不变
    expect(JSON.stringify(resumed.snapshot.dailyTest!.questions)).toBe(JSON.stringify(skipped.dailyTest!.questions));
    expect((resumed.response as { resumed?: boolean }).resumed).toBe(true);
    expect(resumed.changed).toBe(true);
  });

  it('非法计划（频段与当前轮次奇偶不符）→ 服务端校验拒绝，不持久化', () => {
    const snap = snapshotWithCompletedInitialTest();
    const plan = makeDailyPlan(0);
    // 篡改：把第 0 题频段改为奇数段（偶数轮不允许）
    const tampered: DailyTestState = { ...plan, questions: plan.questions.map((q, i) => (i === 0 ? { ...q, band: 1 } : q)) };
    const { snapshot: next, response, changed } = reduceWorkerMessage(
      snap,
      { type: 'DAILY_TEST_START', test: tampered },
      { id: 'ext', url: 'popup.html' },
      undefined,
      DAILY_TODAY,
    );
    expect((response as { error?: string }).error).toContain('band mismatch');
    expect(next.dailyTest).toBeNull();
    expect(changed).toBe(false);
  });

  it('R-DLY-8 跨日边界：DAILY_TEST_START 拒绝非当前本地日期（today）的计划，即使首测已完成', () => {
    const snap = snapshotWithCompletedInitialTest();
    // 客户端提交昨日计划（localDate=DAILY_TODAY），但服务端 today 已过到 2026-08-04
    const stale = makeDailyPlan(0, {}, DAILY_TODAY);
    const { snapshot: next, response, changed } = reduceWorkerMessage(
      snap,
      { type: 'DAILY_TEST_START', test: stale },
      { id: 'ext', url: 'popup.html' },
      undefined,
      '2026-08-04',
    );
    expect((response as { error?: string }).error).toContain('daily test expired');
    expect(next.dailyTest).toBeNull();
    expect(changed).toBe(false);
  });
});

describe('validateDailyTestPlan — 服务端权威校验', () => {
  function makeDailyPlan(roundIndex: number, localDate = '2026-08-03'): DailyTestState {
    const words = Array.from({ length: 20 }, (_, i) => `w${i}`);
    const core = makeCore(words);
    const bands = bandsFor(words);
    return createVocabStrategy().freezeDailyTest(
      { core, forms: {}, bands, seed: SEED, dictVersion: 'd', completedRoundIndex: roundIndex, evidence: {} },
      localDate,
    );
  }

  it('合法计划 → ok；roundIndex 与当前轮次一致时通过', () => {
    const plan = makeDailyPlan(1);
    expect(validateDailyTestPlan(plan, 1)).toEqual({ ok: true });
  });

  it('题数不足 / answers 非全 null / roundIndex 不匹配 / completed 或 skipped 已置位 → 拒绝', () => {
    const plan = makeDailyPlan(0);
    expect(validateDailyTestPlan({ ...plan, questions: plan.questions.slice(0, 4) }, 0)).toMatchObject({ ok: false });
    expect(validateDailyTestPlan({ ...plan, answers: [null, null, null, null, { kind: 'unsure' }] }, 0)).toMatchObject({ ok: false });
    expect(validateDailyTestPlan({ ...plan, roundIndex: 1 }, 0)).toMatchObject({ ok: false });
    expect(validateDailyTestPlan({ ...plan, completed: true }, 0)).toMatchObject({ ok: false });
    expect(validateDailyTestPlan({ ...plan, skipped: true }, 0)).toMatchObject({ ok: false });
  });

  it('重复词 / 频段重复 / 空输入 → 拒绝', () => {
    const plan = makeDailyPlan(0);
    const dupWord = {
      ...plan,
      questions: plan.questions.map((q, i) => (i === 0 ? { ...q, word: plan.questions[1]!.word } : q)),
    };
    expect(validateDailyTestPlan(dupWord, 0)).toMatchObject({ ok: false });
    const dupBand = { ...plan, questions: plan.questions.map((q, i) => (i === 0 ? { ...q, band: plan.questions[1]!.band } : q)) };
    expect(validateDailyTestPlan(dupBand, 0)).toMatchObject({ ok: false });
    expect(validateDailyTestPlan(null, 0)).toMatchObject({ ok: false });
    expect(validateDailyTestPlan(undefined, 0)).toMatchObject({ ok: false });
  });
});

describe('reduceWorkerMessage — DAILY_TEST_ANSWER（R-DLY-2/4）', () => {
  function makeDailyPlan(roundIndex: number, localDate = DAILY_TODAY): DailyTestState {
    const words = Array.from({ length: 20 }, (_, i) => `w${i}`);
    const core = makeCore(words);
    const bands = bandsFor(words);
    return createVocabStrategy().freezeDailyTest(
      { core, forms: {}, bands, seed: SEED, dictVersion: 'd', completedRoundIndex: roundIndex, evidence: {} },
      localDate,
    );
  }

  function startedSnapshot(): VocabSnapshot {
    const snap = createEmptySnapshot(SEED, 'd');
    snap.initialTest = { plan: { version: PLAN_V, seed: SEED, dictVersion: 'd', questions: [] }, answers: [], completed: true };
    return reduceWorkerMessage(snap, { type: 'DAILY_TEST_START', test: makeDailyPlan(0) }, { id: 'ext', url: 'popup.html' }, undefined, DAILY_TODAY).snapshot;
  }

  it('R-DLY-4：每日作答双写 WordState(daily) 与 AssessmentEvidence(daily)，并广播状态', () => {
    const snap = startedSnapshot();
    const q0 = snap.dailyTest!.questions[0]!;
    const { snapshot: next, response, broadcast, changed } = reduceWorkerMessage(
      snap,
      { type: 'DAILY_TEST_ANSWER', questionIndex: 0, answer: { kind: 'option', optionIndex: q0.correctOptionIndex } },
      { id: 'ext', url: 'popup.html' },
      undefined,
      DAILY_TODAY,
    );
    expect(next.words[q0.word]).toMatchObject({ status: 'known', source: 'daily' });
    expect(next.assessmentEvidence[q0.word]).toMatchObject({ outcome: 'known', source: 'daily' });
    expect(next.dailyTest!.answers[0]).toEqual({ kind: 'option', optionIndex: q0.correctOptionIndex });
    expect(next.dailyTest!.completed).toBe(false);
    expect(next.completedRoundIndex).toBe(0);
    expect(broadcast).toEqual({ word: q0.word, newStatus: 'known' });
    expect(changed).toBe(true);
    expect((response as { completedRoundIndex?: number }).completedRoundIndex).toBe(0);
    // BLOCKER 5：每日领域 seam 返回的来源与持久化一致（change.source === 'daily'）
    expect((response as { result?: { change?: { source?: string } } }).result?.change?.source).toBe('daily');
  });

  it('R-DLY-2：未完成整轮不递增 completedRoundIndex；completed 首次变 true 只递增一次', () => {
    let snap = startedSnapshot();
    const plan = snap.dailyTest!;
    for (let i = 0; i < plan.questions.length; i++) {
      const q = plan.questions[i]!;
      snap = reduceWorkerMessage(
        snap,
        { type: 'DAILY_TEST_ANSWER', questionIndex: i, answer: { kind: 'option', optionIndex: q.correctOptionIndex } },
        { id: 'ext', url: 'popup.html' },
        undefined,
        DAILY_TODAY,
      ).snapshot;
      // 前 4 题完成前不递增；最后一题首次完成 → 递增一次
      const expected = i === plan.questions.length - 1 ? 1 : 0;
      expect(snap.completedRoundIndex).toBe(expected);
    }
    expect(snap.dailyTest!.completed).toBe(true);
    // 已完成轮再次作答 → 拒绝，completedRoundIndex 不再变化（幂等递增只发生一次）
    const after = reduceWorkerMessage(
      snap,
      { type: 'DAILY_TEST_ANSWER', questionIndex: 0, answer: { kind: 'option', optionIndex: plan.questions[0]!.correctOptionIndex } },
      { id: 'ext', url: 'popup.html' },
      undefined,
      DAILY_TODAY,
    );
    expect((after.response as { error?: string }).error).toContain('cannot answer');
    expect(after.snapshot.completedRoundIndex).toBe(1);
  });

  it('同一题重复作答 → 拒绝；已跳过轮作答 → 拒绝', () => {
    const snap = startedSnapshot();
    const q0 = snap.dailyTest!.questions[0]!;
    const first = reduceWorkerMessage(
      snap,
      { type: 'DAILY_TEST_ANSWER', questionIndex: 0, answer: { kind: 'option', optionIndex: q0.correctOptionIndex } },
      { id: 'ext', url: 'popup.html' },
      undefined,
      DAILY_TODAY,
    ).snapshot;
    const dup = reduceWorkerMessage(
      first,
      { type: 'DAILY_TEST_ANSWER', questionIndex: 0, answer: { kind: 'option', optionIndex: q0.correctOptionIndex } },
      { id: 'ext', url: 'popup.html' },
      undefined,
      DAILY_TODAY,
    );
    expect((dup.response as { error?: string }).error).toContain('cannot answer');

    // 已跳过轮（未答任何题的轮先跳过）→ 任何作答被拒绝
    const skippedSnap = reduceWorkerMessage(snap, { type: 'DAILY_TEST_SKIP' }, { id: 'ext', url: 'popup.html' }, undefined, DAILY_TODAY).snapshot;
    expect(skippedSnap.dailyTest!.skipped).toBe(true);
    const onSkipped = reduceWorkerMessage(
      skippedSnap,
      { type: 'DAILY_TEST_ANSWER', questionIndex: 0, answer: { kind: 'option', optionIndex: q0.correctOptionIndex } },
      { id: 'ext', url: 'popup.html' },
      undefined,
      DAILY_TODAY,
    );
    expect((onSkipped.response as { error?: string }).error).toContain('cannot answer');
  });

  it('R-DLY-8 跨日边界：持久化轮次 localDate 已过期（today 前进）时，作答被拒绝且状态/证据/进度/轮次零变化', () => {
    let snap = startedSnapshot();
    // 答 2 题（部分完成），模拟午夜前打开的答题页
    for (let i = 0; i < 2; i++) {
      const q = snap.dailyTest!.questions[i]!;
      snap = reduceWorkerMessage(
        snap,
        { type: 'DAILY_TEST_ANSWER', questionIndex: i, answer: { kind: 'option', optionIndex: q.correctOptionIndex } },
        { id: 'ext', url: 'popup.html' },
        undefined,
        DAILY_TODAY,
      ).snapshot;
    }
    const before = JSON.stringify(snap); // 跨日前的完整状态（含已答 2 词）

    // 本地日期已前进到 2026-08-04：仍持有旧答题页的客户端继续提交 → 必须拒绝
    const { snapshot: next, response, changed, broadcast } = reduceWorkerMessage(
      snap,
      { type: 'DAILY_TEST_ANSWER', questionIndex: 2, answer: { kind: 'option', optionIndex: snap.dailyTest!.questions[2]!.correctOptionIndex } },
      { id: 'ext', url: 'popup.html' },
      undefined,
      '2026-08-04',
    );
    expect((response as { error?: string }).error).toContain('daily test expired');
    expect(changed).toBe(false);
    expect(broadcast).toBeUndefined();
    // 零变化：WordState / AssessmentEvidence / DailyTestState 已答进度 / completedRoundIndex 全部不变
    expect(JSON.stringify(next)).toBe(before);
    expect(next).toBe(snap);
    expect(next.completedRoundIndex).toBe(0);
  });
});

describe('reduceWorkerMessage — DAILY_TEST_SKIP（R-DLY-6）', () => {
  function makeDailyPlan(roundIndex: number, localDate = DAILY_TODAY): DailyTestState {
    const words = Array.from({ length: 20 }, (_, i) => `w${i}`);
    const core = makeCore(words);
    const bands = bandsFor(words);
    return createVocabStrategy().freezeDailyTest(
      { core, forms: {}, bands, seed: SEED, dictVersion: 'd', completedRoundIndex: roundIndex, evidence: {} },
      localDate,
    );
  }

  function startedSnapshot(): VocabSnapshot {
    const snap = createEmptySnapshot(SEED, 'd');
    snap.initialTest = { plan: { version: PLAN_V, seed: SEED, dictVersion: 'd', questions: [] }, answers: [], completed: true };
    return reduceWorkerMessage(snap, { type: 'DAILY_TEST_START', test: makeDailyPlan(0) }, { id: 'ext', url: 'popup.html' }, undefined, DAILY_TODAY).snapshot;
  }

  it('R-DLY-6：首题前跳过 → WordState 与 AssessmentEvidence 零变化，skipped=true', () => {
    const snap = startedSnapshot();
    const { snapshot: next, response, changed } = reduceWorkerMessage(
      snap,
      { type: 'DAILY_TEST_SKIP' },
      { id: 'ext', url: 'popup.html' },
      undefined,
      DAILY_TODAY,
    );
    expect((response as { success?: boolean }).success).toBe(true);
    expect(next.dailyTest!.skipped).toBe(true);
    // 零变化：无任何 words / evidence 写入，completedRoundIndex 不递增
    expect(next.words).toEqual(snap.words);
    expect(next.assessmentEvidence).toEqual(snap.assessmentEvidence);
    expect(next.completedRoundIndex).toBe(0);
    expect(changed).toBe(true);
  });

  it('R-DLY-6：回答第一题后跳过入口消失——跳过请求被拒绝', () => {
    const snap = startedSnapshot();
    const q0 = snap.dailyTest!.questions[0]!;
    const answered = reduceWorkerMessage(
      snap,
      { type: 'DAILY_TEST_ANSWER', questionIndex: 0, answer: { kind: 'option', optionIndex: q0.correctOptionIndex } },
      { id: 'ext', url: 'popup.html' },
      undefined,
      DAILY_TODAY,
    ).snapshot;
    const { response } = reduceWorkerMessage(answered, { type: 'DAILY_TEST_SKIP' }, { id: 'ext', url: 'popup.html' }, undefined, DAILY_TODAY);
    expect((response as { error?: string }).error).toContain('cannot skip after first answer');
  });

  it('无活跃轮 / 已完成轮 / 已跳过轮 → 拒绝', () => {
    const snap = startedSnapshot();
    const noRound = reduceWorkerMessage(createEmptySnapshot(SEED, 'd'), { type: 'DAILY_TEST_SKIP' }, { id: 'ext', url: 'popup.html' }, undefined, DAILY_TODAY);
    expect((noRound.response as { error?: string }).error).toContain('cannot skip');

    const skipped = reduceWorkerMessage(snap, { type: 'DAILY_TEST_SKIP' }, { id: 'ext', url: 'popup.html' }, undefined, DAILY_TODAY).snapshot;
    const again = reduceWorkerMessage(skipped, { type: 'DAILY_TEST_SKIP' }, { id: 'ext', url: 'popup.html' }, undefined, DAILY_TODAY);
    expect((again.response as { error?: string }).error).toContain('cannot skip');
  });

  it('R-DLY-8 跨日边界：持久化轮次 localDate 已过期（today 前进）时，跳过被拒绝且零变化', () => {
    const snap = startedSnapshot();
    const before = JSON.stringify(snap);
    const { snapshot: next, response, changed } = reduceWorkerMessage(
      snap,
      { type: 'DAILY_TEST_SKIP' },
      { id: 'ext', url: 'popup.html' },
      undefined,
      '2026-08-04',
    );
    expect((response as { error?: string }).error).toContain('daily test expired');
    expect(changed).toBe(false);
    expect(JSON.stringify(next)).toBe(before);
    expect(next.dailyTest!.skipped).toBe(false); // 未被跳过
  });
});

describe('reduceWorkerMessage — GET_DAILY_TEST（popup 入口/进度/跨日展示）', () => {
  it('返回当前轮与 completedRoundIndex，不改变快照', () => {
    const snap = createEmptySnapshot(SEED, 'd');
    snap.dailyTest = {
      localDate: '2026-08-03',
      roundIndex: 0,
      questions: [],
      answers: [],
      completed: true,
      skipped: false,
    };
    snap.completedRoundIndex = 1;
    const { snapshot: next, response, changed } = reduceWorkerMessage(snap, { type: 'GET_DAILY_TEST' }, { id: 'ext', url: 'popup.html' });
    expect((response as { test?: unknown }).test).toBe(snap.dailyTest);
    expect((response as { completedRoundIndex?: number }).completedRoundIndex).toBe(1);
    expect(changed).toBe(false);
    expect(next).toBe(snap);
  });
});

