import { describe, it, expect, beforeEach } from 'vitest';
import type { VocabSnapshot, WordState } from '../shared/types';
import { SCHEMA_VERSION } from '../shared/types';
import {
  createEmptySnapshot,
  mergeStateChange,
  getWords,
  generateInstallSeed,
  addAuditMarker,
  clearAuditMarker,
  clearStaleAuditMarkers,
  clearAllPendingAuditMarkers,
  recordAuditEvent,
  migrateSnapshot,
} from './storage';

describe('storage', () => {
  describe('createEmptySnapshot', () => {
    it('创建带 schema 版本和种子的空快照', () => {
      const snapshot = createEmptySnapshot('abc123', 'dict-v1');
      expect(snapshot.schemaVersion).toBe(SCHEMA_VERSION);
      expect(snapshot.installSeed).toBe('abc123');
      expect(snapshot.words).toEqual({});
      expect(snapshot.dictVersion).toBe('dict-v1');
      expect(snapshot.lastUpdated).toBeGreaterThan(0);
    });
  });

  describe('mergeStateChange', () => {
    let snapshot: VocabSnapshot;

    beforeEach(() => {
      snapshot = createEmptySnapshot('test-seed', 'dict-v1');
    });

    it('新增单词状态', () => {
      const updated = mergeStateChange(snapshot, 'hello', 'known');
      expect(updated.words['hello']).toBeDefined();
      expect(updated.words['hello']!.status).toBe('known');
      expect(updated.words['hello']!.source).toBe('manual');
    });

    it('更新已有单词状态', () => {
      snapshot.words['hello'] = { status: 'unknown', source: 'initial', updatedAt: 1000, version: 0 };
      const updated = mergeStateChange(snapshot, 'hello', 'learning');
      expect(updated.words['hello']!.status).toBe('learning');
      expect(updated.words['hello']!.source).toBe('manual');
      expect(updated.words['hello']!.updatedAt).toBeGreaterThan(1000);
    });

    it('返回新对象（不可变）', () => {
      const updated = mergeStateChange(snapshot, 'hello', 'known');
      expect(updated).not.toBe(snapshot);
      expect(updated.words).not.toBe(snapshot.words);
    });

    it('更新 lastUpdated', () => {
      const before = snapshot.lastUpdated;
      const updated = mergeStateChange(snapshot, 'hello', 'known');
      expect(updated.lastUpdated).toBeGreaterThanOrEqual(before);
    });
  });

  describe('getWords', () => {
    it('返回 words 的浅拷贝', () => {
      const snapshot = createEmptySnapshot('seed', 'dict-v1');
      snapshot.words['test'] = { status: 'known', source: 'manual', updatedAt: 1, version: 0 };
      const words = getWords(snapshot);
      expect(words['test']).toEqual(snapshot.words['test']);
      // 应该是新对象
      expect(words).not.toBe(snapshot.words);
    });
  });

  describe('generateInstallSeed', () => {
    it('生成 32 字符十六进制字符串', () => {
      const seed = generateInstallSeed();
      expect(seed).toMatch(/^[0-9a-f]{32}$/);
    });

    it('每次生成不同的种子', () => {
      const s1 = generateInstallSeed();
      const s2 = generateInstallSeed();
      expect(s1).not.toBe(s2);
    });
  });

  // ============================================================
  // 隐私边界（规格 5：不得保存 URL、域名、正文、句子、浏览历史）
  // ============================================================
  describe('隐私边界', () => {
    it('快照序列化后不含 URL、域名、正文、句子等敏感字段', () => {
      const snapshot = createEmptySnapshot('seed-abc', 'dict-v1');
      const updated = mergeStateChange(snapshot, 'challenge', 'learning');
      const json = JSON.stringify(updated);

      // 不得出现这些键
      const forbiddenKeys = ['url', 'domain', 'host', 'title', 'sentence', 'context', 'page', 'pageText', 'history', 'tab'];
      for (const key of forbiddenKeys) {
        expect(json).not.toContain(`"${key}"`);
      }
    });

    it('WordState 不含上下文、句子或页面信息', () => {
      const snapshot = createEmptySnapshot('seed', 'dict-v1');
      const updated = mergeStateChange(snapshot, 'hello', 'known');
      const state = updated.words['hello']!;

      // WordState 只含本地状态字段（status/source/updatedAt/version），绝不含页面信息
      const keys = Object.keys(state);
      expect(keys.sort()).toEqual(['source', 'status', 'updatedAt', 'version']);
    });

    it('多次状态变更不积累任何页面信息', () => {
      let snapshot = createEmptySnapshot('seed', 'dict-v1');
      snapshot = mergeStateChange(snapshot, 'word1', 'known');
      snapshot = mergeStateChange(snapshot, 'word2', 'learning');
      snapshot = mergeStateChange(snapshot, 'word1', 'learning');

      const json = JSON.stringify(snapshot);
      // 只应有这些顶层键（auditMarkers / initialTest 为领域状态，不含任何页面信息）
      const parsed = JSON.parse(json);
      const topKeys = Object.keys(parsed).sort();
      expect(topKeys).toEqual([
        'auditLog',
        'auditMarkers',
        'auditPlan',
        'dictVersion',
        'initialTest',
        'installSeed',
        'lastUpdated',
        'schemaVersion',
        'stateVersion',
        'words',
      ]);
      // 关键隐私断言：任何页面信息键都不得出现
      const forbiddenKeys = ['url', 'domain', 'host', 'title', 'sentence', 'context', 'page', 'pageText', 'history', 'tab'];
      for (const key of forbiddenKeys) {
        expect(json).not.toContain(`"${key}"`);
      }
    });
  });

  // ============================================================
  // 审计标记生命周期（#3 钩子：手动覆盖 / 计划版本变更时清理）
  // ============================================================
  describe('审计标记生命周期', () => {
    function withMarkers(): VocabSnapshot {
      let snapshot = createEmptySnapshot('seed', 'dict-v1');
      snapshot = addAuditMarker(snapshot, {
        word: 'apple',
        source: 'initial-correct',
        planVersion: 'plan-v1',
        stateVersion: 1,
        createdAt: 1,
        pending: true,
      });
      snapshot = addAuditMarker(snapshot, {
        word: 'banana',
        source: 'initial-correct',
        planVersion: 'plan-v1',
        stateVersion: 1,
        createdAt: 2,
        pending: true,
      });
      return snapshot;
    }

    it('clearAuditMarker 仅清除指定词且不改其他标记', () => {
      const snapshot = withMarkers();
      const cleaned = clearAuditMarker(snapshot, 'apple');
      expect(cleaned.auditMarkers['apple']).toBeUndefined();
      expect(cleaned.auditMarkers['banana']).toBeDefined();
      expect(cleaned.auditMarkers['banana']!.planVersion).toBe('plan-v1');
      // 不可变：原快照不受影响
      expect(snapshot.auditMarkers['apple']).toBeDefined();
    });

    it('clearAuditMarker 对不存在的标记返回原快照引用', () => {
      const snapshot = withMarkers();
      const cleaned = clearAuditMarker(snapshot, 'missing');
      expect(cleaned).toBe(snapshot);
    });

    it('clearStaleAuditMarkers 只清除状态版本不等于当前的标记（重复同种子重测也能清）', () => {
      let snapshot = withMarkers(); // apple/banana 均为 stateVersion=1
      // banana 升级到新状态版本（相同 planVersion 重测的情形）
      snapshot = addAuditMarker(snapshot, {
        word: 'banana',
        source: 'initial-correct',
        planVersion: 'plan-v1',
        stateVersion: 2,
        createdAt: 3,
        pending: true,
      });
      const cleaned = clearStaleAuditMarkers(snapshot, 2);
      expect(cleaned.auditMarkers['apple']).toBeUndefined(); // 旧状态版本 → 清除
      expect(cleaned.auditMarkers['banana']).toBeDefined(); // 新状态版本 → 保留
      expect(cleaned.auditMarkers['banana']!.stateVersion).toBe(2);
    });

    it('clearStaleAuditMarkers 无陈旧标记时返回原快照引用', () => {
      const snapshot = withMarkers();
      const cleaned = clearStaleAuditMarkers(snapshot, 1);
      expect(cleaned).toBe(snapshot);
    });

    it('clearAllPendingAuditMarkers 全量清除所有待审计标记', () => {
      const snapshot = withMarkers();
      const cleaned = clearAllPendingAuditMarkers(snapshot);
      expect(cleaned).not.toBe(snapshot);
      expect(Object.keys(cleaned.auditMarkers)).toHaveLength(0);
      // 原快照不受影响
      expect(Object.keys(snapshot.auditMarkers)).toHaveLength(2);
    });

    it('clearAllPendingAuditMarkers 无标记时返回原快照引用', () => {
      const snapshot = createEmptySnapshot('seed', 'dict-v1');
      const cleaned = clearAllPendingAuditMarkers(snapshot);
      expect(cleaned).toBe(snapshot);
    });

    it('recordAuditEvent 追加事件且不可变（旧快照不含该事件）', () => {
      const snapshot = withMarkers();
      const event = { word: 'apple', outcome: 'verified' as const, bucket: 'initial-correct' as const, planVersion: 'plan-v1', at: 100 };
      const updated = recordAuditEvent(snapshot, event);
      expect(updated.auditLog).toHaveLength(1);
      expect(updated.auditLog[0]).toEqual(event);
      // 原快照不被修改
      expect(snapshot.auditLog).toHaveLength(0);
    });

    it('手动覆盖后应立即清除该词的审计标记（与 worker 行为一致）', () => {
      let snapshot = withMarkers();
      // 模拟 STATE_CHANGE 手动标记 known
      snapshot = mergeStateChange(snapshot, 'apple', 'known', 'manual');
      snapshot = clearAuditMarker(snapshot, 'apple');
      expect(snapshot.words['apple']!.source).toBe('manual');
      expect(snapshot.auditMarkers['apple']).toBeUndefined();
    });
  });

  // ============================================================
  // 快照迁移（Issue #2：v1 → v2，纯函数，可单测）
  // - 首次安装 / v1 升级 / 幂等重载 / 损坏字段 / 重测后保留 / 旧计划失效
  // ============================================================
  describe('migrateSnapshot (v1 → v2)', () => {
    it('首次安装（undefined）→ 产生合法 v2 空快照', () => {
      const snap = migrateSnapshot(undefined);
      expect(snap.schemaVersion).toBe(SCHEMA_VERSION);
      expect(snap.schemaVersion).toBe(2);
      expect(snap.words).toEqual({});
      expect(snap.auditMarkers).toEqual({});
      expect(snap.auditPlan).toBeNull();
      expect(snap.stateVersion).toBe(0);
    });

    it('v1 旧快照缺 words[*].version 与 marker.stateVersion → 补 0（确定性规则），用户数据保留', () => {
      const v1Raw = {
        schemaVersion: 1,
        dictVersion: 'd',
        stateVersion: 0,
        installSeed: 'seed-1',
        words: { apple: { status: 'known', source: 'manual', updatedAt: 1 } }, // 无 version 字段
        auditMarkers: { apple: { word: 'apple', source: 'initial-correct', planVersion: 'p', createdAt: 1, pending: true } }, // 无 stateVersion
        auditLog: [],
        auditPlan: { version: 'v', planVersion: 'p', stateVersion: 1, seed: 'seed-1', candidates: [], questions: [], results: [], createdAt: 1 },
        initialTest: null,
        lastUpdated: 1,
      };
      const snap = migrateSnapshot(v1Raw);
      expect(snap.schemaVersion).toBe(2);
      expect(snap.words['apple']!.version).toBe(0);
      expect(snap.auditMarkers['apple']!.stateVersion).toBe(0);
      // 用户有效数据原样保留
      expect(snap.words['apple']!.status).toBe('known');
      expect(snap.auditMarkers['apple']!.planVersion).toBe('p');
      // schemaVersion===1 属旧格式：即便冻结计划带 stateVersion，也**无条件失效**置 null
      // （旧 v1 哈希未覆盖选项翻译，属不完整基，V0.1 哈希方案下不得原样接受）
      expect(snap.auditPlan).toBeNull();
    });

    it('schemaVersion===1 且 auditPlan 已带 stateVersion → 仍无条件失效置 null（Fix #1）', () => {
      const v1Raw = {
        schemaVersion: 1,
        dictVersion: 'd',
        stateVersion: 0,
        installSeed: 'seed-1',
        words: {},
        auditMarkers: {},
        auditLog: [],
        auditPlan: {
          version: 'old-v1-hash',
          planVersion: 'p',
          stateVersion: 1, // 关键：旧格式却带 stateVersion（旧实现曾原样保留）
          seed: 'seed-1',
          candidates: [{ word: 'apple', band: 'core', translation: '苹果' }],
          questions: [],
          results: [],
          createdAt: 1,
        },
        initialTest: null,
        lastUpdated: 1,
      };
      const snap = migrateSnapshot(v1Raw);
      expect(snap.schemaVersion).toBe(2);
      expect(snap.auditPlan).toBeNull();
    });

    it('缺 stateVersion 的旧冻结审计计划（v1）→ 安全置 null（服务端校验会拒绝缺字段计划）', () => {
      const v1Raw = {
        schemaVersion: 1,
        dictVersion: 'd',
        stateVersion: 0,
        installSeed: 'seed-1',
        words: {},
        auditMarkers: {},
        auditLog: [],
        auditPlan: { version: 'v', planVersion: 'p', seed: 'seed-1', candidates: [], questions: [], results: [], createdAt: 1 }, // 无 stateVersion
        initialTest: null,
        lastUpdated: 1,
      };
      const snap = migrateSnapshot(v1Raw);
      expect(snap.auditPlan).toBeNull();
    });

    it('幂等：已是 v2 的快照再次迁移结果一致', () => {
      const v2Raw = {
        schemaVersion: 2,
        dictVersion: 'd',
        stateVersion: 3,
        installSeed: 'seed-1',
        words: { apple: { status: 'known', source: 'manual', updatedAt: 1, version: 3 } },
        auditMarkers: { apple: { word: 'apple', source: 'initial-correct', planVersion: 'p', stateVersion: 3, createdAt: 1, pending: true } },
        auditLog: [],
        auditPlan: { version: 'v', planVersion: 'p', stateVersion: 3, seed: 'seed-1', candidates: [], questions: [], results: [], createdAt: 1 },
        initialTest: null,
        lastUpdated: 1,
      };
      const a = migrateSnapshot(v2Raw);
      // 模拟序列化后再次读入（深拷贝）
      const b = migrateSnapshot(JSON.parse(JSON.stringify(v2Raw)));
      expect(b.schemaVersion).toBe(2);
      expect(b.stateVersion).toBe(3);
      expect(b.words['apple']).toEqual(a.words['apple']);
      expect(b.auditMarkers['apple']).toEqual(a.auditMarkers['apple']);
      expect(b.auditPlan).toEqual(a.auditPlan);
    });

    it('损坏/缺失字段（null / 字符串 / 数字）→ 安全回退默认，不抛异常', () => {
      const snap = migrateSnapshot(null);
      expect(snap.schemaVersion).toBe(2);
      expect(snap.words).toEqual({});
      const snap2 = migrateSnapshot('garbage');
      expect(snap2.schemaVersion).toBe(2);
      expect(snap2.auditMarkers).toEqual({});
      const snap3 = migrateSnapshot(42);
      expect(snap3.auditPlan).toBeNull();
    });

    it('升级后保留 installSeed 与单词状态（重测后用户数据不丢）', () => {
      const raw = {
        schemaVersion: 1,
        dictVersion: 'd',
        stateVersion: 0,
        installSeed: 'keep-seed',
        words: { banana: { status: 'learning', source: 'initial', updatedAt: 5 } },
        auditMarkers: {},
        auditLog: [],
        auditPlan: null,
        initialTest: { plan: { version: 'pv', seed: 'keep-seed', dictVersion: 'd', questions: [] }, answers: [], completed: true },
        lastUpdated: 5,
      };
      const snap = migrateSnapshot(raw);
      expect(snap.installSeed).toBe('keep-seed');
      expect(snap.words['banana']!.status).toBe('learning');
      expect(snap.initialTest?.completed).toBe(true);
    });
  });
});
