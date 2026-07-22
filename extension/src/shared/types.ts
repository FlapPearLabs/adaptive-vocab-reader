// ============================================================
// 共享类型定义 —— 词汇展示与测试策略的 Interface
// ============================================================

/** 个人词汇状态：会 / 不会 / 未知 */
export type WordStatus = 'known' | 'learning' | 'unknown';

/** 页面展示决策 */
export type DisplayDecision = 'strong' | 'light' | 'none';

/** 词典条目 */
export interface DictEntry {
  /** 音标 */
  phonetic: string;
  /** 词性 */
  pos: string;
  /** 简短中文释义 */
  translation: string;
}

/** 规范化单词 → 词典条目的映射 */
export type DictCore = Record<string, DictEntry>;

/** 词形 → 主词条映射 */
export type FormsMap = Record<string, string>;

/** 主词条 → 词频段 (0-9) 映射 */
export type FrequencyBands = Record<string, number>;

/** 单个单词的状态记录 */
export interface WordState {
  status: WordStatus;
  /** 最后一次状态变更的来源 */
  source: 'manual' | 'initial';
  /** 变更时间戳（毫秒） */
  updatedAt: number;
}

/** 持久化快照 */
export interface VocabSnapshot {
  schemaVersion: number;
  /** 词典产物版本标识 */
  dictVersion: string;
  /** 安装随机种子（十六进制） */
  installSeed: string;
  /** 单词状态映射 */
  words: Record<string, WordState>;
  /** 最后更新时间戳 */
  lastUpdated: number;
}

/** 策略模块输入：单个命中词的上下文 */
export interface LookupContext {
  /** 规范化后的单词 */
  word: string;
  /** 命中该词的词形（可能与 word 不同，如 "went" → "go"） */
  surfaceForm: string;
  /** 词典条目（如果命中） */
  entry: DictEntry | null;
  /** 词频段 (0-9)（如果命中） */
  band: number | null;
  /** 该词在当前页面的出现次数 */
  occurrenceCount: number;
}

/** 策略模块的展示决策输出 */
export interface DisplayResult {
  /** 规范化单词 */
  word: string;
  /** 展示决策 */
  decision: DisplayDecision;
  /** 词形（用于 DOM 定位） */
  surfaceForm: string;
  /** 简短释义（仅 strong 和 light 有值） */
  translation: string | null;
  /** 是否在词后直接显示短中文；只用于同页首次的“不会”词。 */
  showInlineTranslation: boolean;
}

/** 原子状态变更 */
export interface StateChange {
  word: string;
  newStatus: WordStatus;
  source: 'manual';
}

/** 策略模块接口 */
export interface VocabStrategy {
  /**
   * 根据当前状态返回展示决策
   * @param ctx 命中词上下文
   * @param state 当前词汇状态（可能 undefined 即未知）
   */
  getDisplayDecision(ctx: LookupContext, state: WordState | undefined): DisplayResult;

  /**
   * 用户标记"会"
   * @param word 规范化单词
   */
  markKnown(word: string): StateChange;

  /**
   * 用户标记"不会"
   * @param word 规范化单词
   */
  markLearning(word: string): StateChange;
}

export const SCHEMA_VERSION = 1;
