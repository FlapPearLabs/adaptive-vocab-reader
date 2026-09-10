import { describe, expect, it } from 'vitest';
import { createDictionary } from './content/dictionary';
import {
  filterNotebookEntries,
  NOTEBOOK_EMPTY_TEXT,
  NOTEBOOK_NO_MATCH_TEXT,
  selectNotebookEntries,
} from './popupNotebook';
import type { NotebookEntry } from './popupNotebook';

describe('popup 生词本查询词典边界', () => {
  const dictionary = createDictionary({
    assessment: { phonetic: 'a', pos: 'n.', translation: '测评词' },
    outside: { phonetic: 'o', pos: 'n.', translation: '包外词' },
  }, {});

  it('显示包外 learning identity，按 updatedAt 排序', () => {
    expect(selectNotebookEntries({
      assessment: { status: 'learning', updatedAt: 1 },
      outside: { status: 'learning', updatedAt: 2 },
    }, dictionary)).toEqual([
      { word: 'outside', state: { status: 'learning', updatedAt: 2 }, phonetic: 'o', pos: 'n.', translation: '包外词' },
      { word: 'assessment', state: { status: 'learning', updatedAt: 1 }, phonetic: 'a', pos: 'n.', translation: '测评词' },
    ]);
  });

  it('known 与无法解析的历史 learning key 均不展示且不修改输入', () => {
    const words = {
      outside: { status: 'known' as const, updatedAt: 3 },
      historical: { status: 'learning' as const, updatedAt: 2 },
    };
    expect(selectNotebookEntries(words, dictionary)).toEqual([]);
    expect(words.historical).toEqual({ status: 'learning', updatedAt: 2 });
  });
});

// ============================================================
// T-VUX-4 / D-9 + D-10：搜索筛选是纯展示层——数据源语义、排序与输入均不得改变。
// 反例瞄准「看起来合理、过了显眼测试、仍违反合同」的实现。
// ============================================================
describe('popup 生词本搜索筛选（纯展示层合同）', () => {
  const entries: NotebookEntry[] = [
    { word: 'serendipity', state: { status: 'learning', updatedAt: 3 }, phonetic: 'ˌserənˈdipəti', pos: 'n.', translation: '意外发现珍宝的运气' },
    { word: 'go', state: { status: 'learning', updatedAt: 2 }, phonetic: 'ɡəʊ', pos: 'v.', translation: '去；离开' },
    { word: 'state', state: { status: 'learning', updatedAt: 1 }, phonetic: 'steɪt', pos: 'n.', translation: '状态；州' },
  ];

  it('CE-1：空 query 与纯空白 query 必须原序全量返回（不得误入过滤分支返回空列表）', () => {
    expect(filterNotebookEntries(entries, '')).toEqual(entries);
    expect(filterNotebookEntries(entries, '   ')).toEqual(entries);
  });

  it('wordKey 子串命中且保持 updatedAt 降序、剔除不匹配项', () => {
    expect(filterNotebookEntries(entries, 'state').map((e) => e.word)).toEqual(['state']);
    expect(filterNotebookEntries(entries, 'serendipity').map((e) => e.word)).toEqual(['serendipity']);
    expect(filterNotebookEntries(entries, 'zzz不存在').map((e) => e.word)).toEqual([]);
  });

  it('CE-3：query 命中可见释义文本（词性/音标/中文释义）也必须展示该行', () => {
    // 「去」不出现在任何 wordKey 中，只出现在 go 的中文释义里。
    expect(filterNotebookEntries(entries, '去').map((e) => e.word)).toEqual(['go']);
    expect(filterNotebookEntries(entries, 'steɪt').map((e) => e.word)).toEqual(['state']);
  });

  it('大小写不敏感匹配 wordKey', () => {
    expect(filterNotebookEntries(entries, 'STATE').map((e) => e.word)).toEqual(['state']);
    expect(filterNotebookEntries(entries, 'Go').map((e) => e.word)).toEqual(['go']);
  });

  it('CE-4：筛选是纯函数——不修改输入数组，输出保持输入顺序（不得重排）', () => {
    const snapshot = entries.map((e) => ({ ...e }));
    const filtered = filterNotebookEntries(entries, 'go');
    expect(entries).toEqual(snapshot);
    expect(filtered.map((e) => e.word)).toEqual(['go']);
  });

  it('CE-5：数据源函数零变化——同一输入两次调用结果恒等（筛选不接入数据源）', () => {
    const words = {
      go: { status: 'learning' as const, updatedAt: 1 },
      outside: { status: 'learning' as const, updatedAt: 2 },
      stale: { status: 'learning' as const, updatedAt: 9 },
    };
    const dict = createDictionary({
      go: { phonetic: 'ɡəʊ', pos: 'v.', translation: '去' },
      outside: { phonetic: 'o', pos: 'n.', translation: '包外词' },
      stale: { phonetic: 's', pos: 'n.', translation: '旧词' },
    }, {});
    const first = selectNotebookEntries(words, dict);
    const second = selectNotebookEntries(words, dict);
    expect(first).toEqual(second);
    expect(first.map((e) => e.word)).toEqual(['stale', 'outside', 'go']);
  });

  it('CE-2/CE-6：两个空状态文案均为非空中文（无英文字母）且互不相同', () => {
    expect(NOTEBOOK_EMPTY_TEXT.length).toBeGreaterThan(0);
    expect(NOTEBOOK_NO_MATCH_TEXT.length).toBeGreaterThan(0);
    expect(NOTEBOOK_EMPTY_TEXT).toMatch(/^[^A-Za-z]+$/);
    expect(NOTEBOOK_NO_MATCH_TEXT).toMatch(/^[^A-Za-z]+$/);
    expect(NOTEBOOK_EMPTY_TEXT).not.toBe(NOTEBOOK_NO_MATCH_TEXT);
  });
});
