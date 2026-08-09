import type { DictCore, FormsMap, DictEntry } from '../shared/types';

export interface LookupResult {
  /** wordKey（查询 canonical lemma 小写）：用于单词状态/页面 data-word */
  wordKey: string;
  /** 取义主词条（词形映射目标或自身）：用于取音标/词性/释义 */
  entryKey: string;
  /** 原始 surface form（保留大小写，用于 DOM 定位） */
  surfaceForm: string;
  /** 词典条目（entryKey 对应） */
  entry: DictEntry;
}

export interface Dictionary {
  /**
   * 查询一个词形，返回 wordKey、取义主词条、原始词形与词典条目。
   * 规则（core 主词条优先，词形映射到同一个 wordKey）：
   * 1. 先查 core：若 surface form 本身是 core 主词条（如 could），直接命中所取义，
   *    wordKey = entryKey = 自身（不被词形映射遮蔽）。
   * 2. 再查词形映射：若命中（如 went→go），wordKey = entryKey = 映射目标。
   * 返回 null 表示未命中。
   */
  lookup(surfaceForm: string): LookupResult | null;

  /**
   * 检查词形是否在词典中（含词形映射）。
   */
  has(surfaceForm: string): boolean;

  /** 查询词典中可用于主动提示 bootstrap 的只读有效频率列表。 */
  effectiveFrequencyRanks(): Array<number | null>;
}

/**
 * 从 JSON 对象创建词典查询实例。
 * 这是纯函数，可在测试和内容脚本中复用。
 */
export function createDictionary(
  core: DictCore,
  forms: FormsMap,
): Dictionary {
  return {
    lookup(surfaceForm: string): LookupResult | null {
      const form = surfaceForm.toLowerCase();

      // 1. core 主词条优先：自身即合法主词条（如 could）直接命中。
      const coreEntry = core[form];
      if (coreEntry) {
        return {
          wordKey: form,
          entryKey: form,
          surfaceForm,
          entry: coreEntry,
        };
      }

      // 2. 词形映射：取义目标同时就是 wordKey（如 went→go）。
      const mappedWord = forms[form];
      if (mappedWord) {
        const entry = core[mappedWord];
        if (entry) {
          return {
            wordKey: mappedWord,
            entryKey: mappedWord,
            surfaceForm,
            entry,
          };
        }
      }

      return null;
    },

    has(surfaceForm: string): boolean {
      return this.lookup(surfaceForm) !== null;
    },

    effectiveFrequencyRanks(): Array<number | null> {
      return Object.values(core).map((entry) => entry.effectiveFrequencyRank ?? null);
    },
  };
}

/**
 * 从 JSON 字符串创建词典。
 * 查询词典词条存储为 [phonetic, pos, translation, effectiveFrequencyRank]；
 * 固定测评词典的旧三元组也可读取，缺少的频率元数据归一为 null。
 * 用于内容脚本从 chrome.runtime.getURL 拉取数据后初始化。
 */
export function loadDictionaryFromJSON(
  coreJSON: string,
  formsJSON: string,
): Dictionary {
  const rawCore: Record<string, [string, string, string, (number | null)?]> = JSON.parse(coreJSON);
  const forms: FormsMap = JSON.parse(formsJSON);

  // 将数组格式转换为 DictEntry 对象
  const core: DictCore = {};
  for (const [word, arr] of Object.entries(rawCore)) {
    core[word] = { phonetic: arr[0], pos: arr[1], translation: arr[2], effectiveFrequencyRank: arr[3] ?? null };
  }

  return createDictionary(core, forms);
}
