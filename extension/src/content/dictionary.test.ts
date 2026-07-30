import { describe, it, expect, beforeAll } from 'vitest';
import { createDictionary } from './dictionary';
import type { DictCore, FormsMap, FrequencyBands } from '../shared/types';

// 最小独立词典 fixture；不依赖本机 ECDICT 产物。
const FIXTURE_CORE: DictCore = {
  alpha: { phonetic: 'ˈælfə', pos: 'n.', translation: '阿尔法；开始' },
  beta: { phonetic: 'ˈbiːtə', pos: 'n.', translation: '贝塔；测试版' },
  go: { phonetic: 'ɡəʊ', pos: 'v.', translation: '去；走' },
  wend: { phonetic: 'wɛnd', pos: 'v.', translation: '绕行' },
  challenge: { phonetic: 'ˈtʃælɪndʒ', pos: 'n./v.', translation: '挑战' },
  // core 主词条优先：could 自身是合法主词条，不应被 forms[could]=can 遮蔽
  could: { phonetic: 'kʊd', pos: 'v.', translation: '能（过去式）' },
  can: { phonetic: 'kæn', pos: 'v.', translation: '能' },
};

const FIXTURE_FORMS: FormsMap = {
  goes: 'go',
  going: 'go',
  gone: 'go',
  went: 'go',
  challenged: 'challenge',
  // 词形映射键同时是 core 主词条：运行时该键已被丢弃，这里用于验证 core 优先
  could: 'can',
};

const FIXTURE_BANDS: FrequencyBands = {
  alpha: 5,
  beta: 7,
  go: 0,
  wend: 2,
  challenge: 3,
  could: 4,
  can: 1,
};

describe('Dictionary', () => {
  let dict: ReturnType<typeof createDictionary>;

  beforeAll(() => {
    dict = createDictionary(FIXTURE_CORE, FIXTURE_FORMS, FIXTURE_BANDS);
  });

  describe('lookup', () => {
    it('直接查主词条命中（stateKey === entryKey === 自身）', () => {
      const entry = dict.lookup('go');
      expect(entry).not.toBeNull();
      expect(entry!.stateKey).toBe('go');
      expect(entry!.entryKey).toBe('go');
      expect(entry!.entry.phonetic).toBe('ɡəʊ');
      expect(entry!.entry.pos).toBe('v.');
      expect(entry!.entry.translation).toBe('去；走');
      expect(entry!.band).toBe(0);
    });

    it('core 主词条优先：could 不被 forms[could]=can 遮蔽（stateKey/entryKey 均为 could 自身）', () => {
      const entry = dict.lookup('could');
      expect(entry).not.toBeNull();
      expect(entry!.stateKey).toBe('could');
      expect(entry!.entryKey).toBe('could');
      expect(entry!.entry.translation).toBe('能（过去式）');
    });

    it('can 作为独立 core 主词条命中（与 could 状态互不继承的键已分离）', () => {
      const entry = dict.lookup('can');
      expect(entry).not.toBeNull();
      expect(entry!.stateKey).toBe('can');
      expect(entry!.entryKey).toBe('can');
      expect(entry!.entry.translation).toBe('能');
    });

    it('非 core 词形映射命中，但状态键仍是 surface form（went→go：stateKey=went, entryKey=go）', () => {
      const entry = dict.lookup('went');
      expect(entry).not.toBeNull();
      expect(entry!.stateKey).toBe('went'); // 独立状态键
      expect(entry!.entryKey).toBe('go'); // 仅取 go 的释义
      expect(entry!.entry.translation).toBe('去；走');
    });

    it('通过词形映射命中 going（stateKey=going, entryKey=go）', () => {
      const entry = dict.lookup('going');
      expect(entry).not.toBeNull();
      expect(entry!.stateKey).toBe('going');
      expect(entry!.entryKey).toBe('go');
    });

    it('大小写不敏感（surface form 保留原大小写，stateKey 小写）', () => {
      const entry = dict.lookup('Went');
      expect(entry).not.toBeNull();
      expect(entry!.stateKey).toBe('went');
      expect(entry!.surfaceForm).toBe('Went');
      expect(entry!.entryKey).toBe('go');
    });

    it('未命中返回 null', () => {
      expect(dict.lookup('xyzzy')).toBeNull();
    });
  });

  describe('has', () => {
    it('直接查主词条存在', () => {
      expect(dict.has('go')).toBe(true);
    });

    it('通过词形映射存在', () => {
      expect(dict.has('went')).toBe(true);
    });

    it('core 主词条优先后 has(could)=true', () => {
      expect(dict.has('could')).toBe(true);
    });

    it('不存在', () => {
      expect(dict.has('xyzzy')).toBe(false);
    });
  });
});
