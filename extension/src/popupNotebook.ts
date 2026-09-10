import type { Dictionary } from './content/dictionary';

export interface NotebookWordState {
  status: 'known' | 'learning';
  updatedAt: number;
}

export interface NotebookEntry {
  word: string;
  state: NotebookWordState;
  phonetic: string;
  pos: string;
  translation: string;
}

/** 只展示当前查询词典可解析、且明确处于 learning 的状态；无法解析的历史 key 保留在 storage。 */
export function selectNotebookEntries(
  words: Record<string, NotebookWordState>,
  dictionary: Dictionary,
): NotebookEntry[] {
  return Object.entries(words)
    .flatMap(([word, state]) => {
      if (state.status !== 'learning') return [];
      const lookup = dictionary.lookup(word);
      if (!lookup) return [];
      return [{
        word: lookup.wordKey,
        state,
        phonetic: lookup.entry.phonetic,
        pos: lookup.entry.pos,
        translation: lookup.entry.translation,
      }];
    })
    .sort((a, b) => b.state.updatedAt - a.state.updatedAt);
}

/** D-10：生词本空状态（无 learning 词）的中文文案（DEC-3）。 */
export const NOTEBOOK_EMPTY_TEXT = '暂无生词。';

/** D-10：搜索无匹配时的中文空状态文案（DEC-3；不得使用英文串）。 */
export const NOTEBOOK_NO_MATCH_TEXT = '未找到匹配的生词。';

/**
 * D-9：纯展示层筛选——按 wordKey 与可见释义文本（音标/词性/中文释义）即时过滤。
 * 不改数据源、不改排序、不写任何状态；query 为空或纯空白时原序全量返回。
 */
export function filterNotebookEntries(entries: NotebookEntry[], query: string): NotebookEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries.slice();
  return entries.filter((entry) =>
    entry.word.toLowerCase().includes(q) ||
    entry.phonetic.toLowerCase().includes(q) ||
    entry.pos.toLowerCase().includes(q) ||
    entry.translation.toLowerCase().includes(q),
  );
}
