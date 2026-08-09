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
