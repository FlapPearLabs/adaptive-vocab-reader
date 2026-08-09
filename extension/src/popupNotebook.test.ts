import { describe, expect, it } from 'vitest';
import { createDictionary } from './content/dictionary';
import { selectNotebookEntries } from './popupNotebook';

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
