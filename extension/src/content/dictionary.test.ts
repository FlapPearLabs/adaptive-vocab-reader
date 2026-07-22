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
};

const FIXTURE_FORMS: FormsMap = {
  goes: 'go',
  going: 'go',
  gone: 'go',
  went: 'go',
  challenged: 'challenge',
};

const FIXTURE_BANDS: FrequencyBands = {
  alpha: 5,
  beta: 7,
  go: 0,
  wend: 2,
  challenge: 3,
};

describe('Dictionary', () => {
  let dict: ReturnType<typeof createDictionary>;

  beforeAll(() => {
    dict = createDictionary(FIXTURE_CORE, FIXTURE_FORMS, FIXTURE_BANDS);
  });

  describe('lookup', () => {
    it('直接查主词条命中', () => {
      const entry = dict.lookup('go');
      expect(entry).not.toBeNull();
      expect(entry!.entry.phonetic).toBe('ɡəʊ');
      expect(entry!.entry.pos).toBe('v.');
      expect(entry!.entry.translation).toBe('去；走');
      expect(entry!.band).toBe(0);
    });

    it('通过词形映射命中', () => {
      const entry = dict.lookup('went');
      expect(entry).not.toBeNull();
      expect(entry!.word).toBe('go');
      expect(entry!.entry.translation).toBe('去；走');
    });

    it('通过词形映射命中 going', () => {
      const entry = dict.lookup('going');
      expect(entry).not.toBeNull();
      expect(entry!.word).toBe('go');
    });

    it('通过词形映射命中过去式 challenged', () => {
      const result = dict.lookup('challenged');
      expect(result?.word).toBe('challenge');
    });

    it('未命中返回 null', () => {
      expect(dict.lookup('xyzzy')).toBeNull();
    });

    it('大小写不敏感（输入转小写）', () => {
      const entry = dict.lookup('Go');
      expect(entry).not.toBeNull();
      expect(entry!.word).toBe('go');
    });

    it('词形表优先于直接匹配（went 映射到 go 而非 wend）', () => {
      const entry = dict.lookup('went');
      expect(entry).not.toBeNull();
      expect(entry!.word).toBe('go');
    });
  });

  describe('loadDictionaryFromJSON', () => {
    it('从纯对象创建', () => {
      const core: DictCore = {
        hello: { phonetic: '/həˈloʊ/', pos: 'interj.', translation: '你好' },
      };
      const forms: FormsMap = {};
      const bands: FrequencyBands = { hello: 0 };
      const d = createDictionary(core, forms, bands);
      const entry = d.lookup('hello');
      expect(entry).not.toBeNull();
      expect(entry!.entry.translation).toBe('你好');
    });
  });

  describe('has', () => {
    it('直接查主词条存在', () => {
      expect(dict.has('go')).toBe(true);
    });

    it('通过词形映射存在', () => {
      expect(dict.has('went')).toBe(true);
    });

    it('不存在', () => {
      expect(dict.has('xyzzy')).toBe(false);
    });
  });
});
