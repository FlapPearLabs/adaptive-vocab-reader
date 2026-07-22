import type { DictCore, FormsMap, FrequencyBands, DictEntry } from '../shared/types';

export interface LookupResult {
  /** 规范化主词条 */
  word: string;
  /** 词典条目 */
  entry: DictEntry;
  /** 词频段 (0-9) */
  band: number;
}

export interface Dictionary {
  /**
   * 查询一个词形，返回主词条、词典条目和频段。
   * 先查词形映射表，再查直接匹配。返回 null 表示未命中。
   */
  lookup(surfaceForm: string): LookupResult | null;

  /**
   * 检查词形是否在词典中（含词形映射）。
   */
  has(surfaceForm: string): boolean;
}

/**
 * 从 JSON 对象创建词典查询实例。
 * 这是纯函数，可在测试和内容脚本中复用。
 */
export function createDictionary(
  core: DictCore,
  forms: FormsMap,
  bands: FrequencyBands,
): Dictionary {
  return {
    lookup(surfaceForm: string): LookupResult | null {
      const form = surfaceForm.toLowerCase();

      // 先查词形映射
      const mappedWord = forms[form];
      if (mappedWord) {
        const entry = core[mappedWord];
        if (entry) {
          return { word: mappedWord, entry, band: bands[mappedWord] ?? 9 };
        }
      }

      // 直接匹配
      const entry = core[form];
      if (entry) {
        return { word: form, entry, band: bands[form] ?? 9 };
      }

      return null;
    },

    has(surfaceForm: string): boolean {
      return this.lookup(surfaceForm) !== null;
    },
  };
}

/**
 * 从 JSON 字符串创建词典。
 * JSON 中词条存储为 [phonetic, pos, translation] 数组格式。
 * 用于内容脚本从 chrome.runtime.getURL 拉取数据后初始化。
 */
export function loadDictionaryFromJSON(
  coreJSON: string,
  formsJSON: string,
  bandsJSON: string,
): Dictionary {
  const rawCore: Record<string, [string, string, string]> = JSON.parse(coreJSON);
  const forms: FormsMap = JSON.parse(formsJSON);
  const bands: FrequencyBands = JSON.parse(bandsJSON);

  // 将数组格式转换为 DictEntry 对象
  const core: DictCore = {};
  for (const [word, arr] of Object.entries(rawCore)) {
    core[word] = { phonetic: arr[0], pos: arr[1], translation: arr[2] };
  }

  return createDictionary(core, forms, bands);
}
