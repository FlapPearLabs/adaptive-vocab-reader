import { describe, it, expect, beforeEach } from 'vitest';
import type { VocabSnapshot, WordState } from '../shared/types';
import { SCHEMA_VERSION } from '../shared/types';
import {
  createEmptySnapshot,
  mergeStateChange,
  getWords,
  generateInstallSeed,
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
      snapshot.words['hello'] = { status: 'unknown', source: 'initial', updatedAt: 1000 };
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
      snapshot.words['test'] = { status: 'known', source: 'manual', updatedAt: 1 };
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
});
