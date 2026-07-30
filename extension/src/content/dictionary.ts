import type { DictCore, FormsMap, FrequencyBands, DictEntry } from '../shared/types';

export interface LookupResult {
  /** 状态键（= 规范化 surface form，小写）：用于单词状态/审计标记/页面 data-word */
  stateKey: string;
  /** 取义主词条（词形映射目标或自身）：用于取音标/词性/释义/频段 */
  entryKey: string;
  /** 原始 surface form（保留大小写，用于 DOM 定位） */
  surfaceForm: string;
  /** 词典条目（entryKey 对应） */
  entry: DictEntry;
  /** 词频段 (0-9) */
  band: number;
}

export interface Dictionary {
  /**
   * 查询一个词形，返回状态键、取义主词条、原始词形、词典条目与频段。
   * 规则（core 主词条优先，词形映射只帮助取义不传播状态）：
   * 1. 先查 core：若 surface form 本身是 core 主词条（如 could），直接命中所取义，
   *    stateKey = surface form，entryKey = 自身，状态独立（不被词形映射遮蔽）。
   * 2. 再查词形映射：若命中（如 went→go），stateKey = surface form（went 独立状态），
   *    entryKey = 映射目标（go，仅取义），状态不继承 go。
   * 返回 null 表示未命中。
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

      // 1. core 主词条优先：自身即合法主词条（如 could）直接命中，状态独立。
      const coreEntry = core[form];
      if (coreEntry) {
        return {
          stateKey: form,
          entryKey: form,
          surfaceForm,
          entry: coreEntry,
          band: bands[form] ?? 9,
        };
      }

      // 2. 词形映射：取义目标 + 频段，但状态键仍是 surface form（如 went→go）。
      const mappedWord = forms[form];
      if (mappedWord) {
        const entry = core[mappedWord];
        if (entry) {
          return {
            stateKey: form,
            entryKey: mappedWord,
            surfaceForm,
            entry,
            band: bands[mappedWord] ?? 9,
          };
        }
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
