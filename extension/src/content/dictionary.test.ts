import { describe, it, expect, beforeAll } from 'vitest';
import { createDictionary, loadDictionaryFromJSON } from './dictionary';
import type { DictCore, FormsMap } from '../shared/types';

// 最小独立词典 fixture；不依赖本机 ECDICT 产物。
const FIXTURE_CORE: DictCore = {
  alpha: { phonetic: 'ˈælfə', pos: 'n.', translation: '阿尔法；开始' },
  beta: { phonetic: 'ˈbiːtə', pos: 'n.', translation: '贝塔；测试版' },
  go: { phonetic: 'ɡəʊ', pos: 'v.', translation: '去；走' },
  going: { phonetic: 'synthetic-going', pos: 'v.', translation: '合成进行条目' },
  gone: { phonetic: 'synthetic-gone', pos: 'v.', translation: '合成完成条目' },
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

describe('Dictionary', () => {
  let dict: ReturnType<typeof createDictionary>;

  beforeAll(() => {
    dict = createDictionary(FIXTURE_CORE, FIXTURE_FORMS);
  });

  describe('lookup', () => {
    it('查询词典条目保留频率元数据，双缺失词仍可查询', () => {
      const queryOnly = loadDictionaryFromJSON(
        JSON.stringify({ queryentry: ['q', 'n.', '合成查询释义', null] }),
        JSON.stringify({}),
      );

      const entry = queryOnly.lookup('QueryEntry');
      expect(entry?.wordKey).toBe('queryentry');
      expect(entry?.entry.effectiveFrequencyRank).toBeNull();
    });

    it('直接查主词条命中（wordKey === entryKey === 自身）', () => {
      const entry = dict.lookup('go');
      expect(entry).not.toBeNull();
      expect(entry!.wordKey).toBe('go');
      expect(entry!.entryKey).toBe('go');
      expect(entry!.entry.phonetic).toBe('ɡəʊ');
      expect(entry!.entry.pos).toBe('v.');
      expect(entry!.entry.translation).toBe('去；走');
    });

    it('core 主词条优先：could 不被 forms[could]=can 遮蔽（wordKey/entryKey 均为 could 自身）', () => {
      const entry = dict.lookup('could');
      expect(entry).not.toBeNull();
      expect(entry!.wordKey).toBe('could');
      expect(entry!.entryKey).toBe('could');
      expect(entry!.entry.translation).toBe('能（过去式）');
    });

    it('can 作为独立 core 主词条命中（与 could 状态互不继承的键已分离）', () => {
      const entry = dict.lookup('can');
      expect(entry).not.toBeNull();
      expect(entry!.wordKey).toBe('can');
      expect(entry!.entryKey).toBe('can');
      expect(entry!.entry.translation).toBe('能');
    });

    it('非 core 词形映射命中后共享 core wordKey（went→go）', () => {
      const entry = dict.lookup('went');
      expect(entry).not.toBeNull();
      expect(entry!.wordKey).toBe('go');
      expect(entry!.entryKey).toBe('go');
      expect(entry!.entry.translation).toBe('去；走');
    });

    it('词形映射与主词条碰撞时，going 作为主词条优先命中自身', () => {
      const entry = dict.lookup('going');
      expect(entry).not.toBeNull();
      expect(entry!.wordKey).toBe('going');
      expect(entry!.entryKey).toBe('going');
    });

    it('词形映射与主词条碰撞时，gone 作为主词条优先命中自身', () => {
      const entry = dict.lookup('gone');
      expect(entry).not.toBeNull();
      expect(entry!.wordKey).toBe('gone');
      expect(entry!.entryKey).toBe('gone');
    });

    it('大小写不敏感（surface form 保留原大小写，wordKey 为 core 小写）', () => {
      const entry = dict.lookup('Went');
      expect(entry).not.toBeNull();
      expect(entry!.wordKey).toBe('go');
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
