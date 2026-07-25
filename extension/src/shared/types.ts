// ============================================================
// 共享类型定义 —— 词汇展示与测试策略的 Interface
// ============================================================

/** 个人词汇状态：会 / 不会 / 未知 */
export type WordStatus = 'known' | 'learning' | 'unknown';

/** 页面展示决策 */
export type DisplayDecision = 'strong' | 'light' | 'none';

/** 状态变更来源：手动标记 或 首测作答 */
export type WordStateSource = 'manual' | 'initial';

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
  source: WordStateSource;
  /** 变更时间戳（毫秒） */
  updatedAt: number;
}

// ============================================================
// 首测（固定 50 题第一次测评）
// ============================================================

/**
 * 一道题的作答：在四个中文选项中选一个，或选择「不确定」。
 * 判别联合 —— 调用方必须穷尽所有分支（见 applyAnswer）。
 */
export type QuizAnswer =
  | { readonly kind: 'option'; readonly optionIndex: number }
  | { readonly kind: 'unsure' };

/** 单个中文选项 */
export interface QuizOption {
  readonly translation: string;
  readonly isCorrect: boolean;
}

/** 一道首测题 */
export interface QuizQuestion {
  /** 规范化主词条（英文提示词） */
  readonly word: string;
  /** 词频段 (0-9) */
  readonly band: number;
  /** 四个互异中文选项（1 正确 + 3 干扰项），顺序已冻结 */
  readonly options: readonly QuizOption[];
  /** 正确选项在 `options` 中的下标 (0..3) */
  readonly correctOptionIndex: number;
  /** 「不确定」选项的固定下标（恒为 4，独立于四个中文选项） */
  readonly unsureIndex: number;
}

/** 冻结的首测计划：同种子 + 同快照可完全复现 */
export interface InitialTestPlan {
  /** 计划版本 = dictVersion + seed + 题目哈希，确定性 */
  readonly version: string;
  /** 安装随机种子（十六进制） */
  readonly seed: string;
  /** 词典产物版本标识 */
  readonly dictVersion: string;
  /** 50 道题（十频段各五题） */
  readonly questions: readonly QuizQuestion[];
}

/** 首测持久化状态 */
export interface InitialTestState {
  readonly plan: InitialTestPlan;
  /** 每题作答；null 表示未答；长度 = questions.length */
  readonly answers: readonly (QuizAnswer | null)[];
  readonly completed: boolean;
}

/** 单次答对的待审计标记（非用户可见的第四种状态） */
export interface AuditMarker {
  readonly word: string;
  readonly source: 'initial-correct';
  /**
   * 生成该标记的首测计划版本（InitialTestPlan.version）。
   * 与计划版本绑定而非 schemaVersion：计划重做/版本变化时清除陈旧标记；
   * #3 引入画像版本后将作为并行维度，不在此字段复用 schemaVersion。
   */
  readonly planVersion: string;
  readonly createdAt: number;
  readonly pending: boolean;
}

// ============================================================
// 状态变更（泛型 source —— Matt Pocock 风格：用类型参数约束来源）
// ============================================================

/**
 * 原子状态变更。`S` 约束变更来源，使手动与首测变更在类型上可区分。
 */
export interface StateChange<S extends WordStateSource = WordStateSource> {
  readonly word: string;
  readonly newStatus: WordStatus;
  readonly source: S;
}

// ============================================================
// 条件类型应用（Matt Pocock 风格）
// ============================================================

/** 作答是否提交确定状态：「不确定」不提交，其余提交 */
export type IsCommittal<A extends QuizAnswer> = A extends { kind: 'unsure' } ? false : true;

/** 由「是否答对」在类型层映射出结果状态 */
export type StatusFromCorrectness<C extends boolean> = C extends true ? 'known' : 'learning';

/** 不同作答结果对应的审计标记类型 */
export type AuditForOutcome<K extends ApplyAnswerOutcomeKind> = K extends 'correct' ? AuditMarker : null;

/** 作答结果种类 */
export type ApplyAnswerOutcomeKind = 'correct' | 'wrong' | 'unsure' | 'priority-preserved';

/**
 * applyAnswer 的判别联合返回类型。
 * 每个分支的 `change`/`audit` 字段类型都经过精确约束：
 * - correct  → 携带 source='initial' 的状态变更 + 审计标记
 * - wrong/unsure → 携带 source='initial' 的状态变更 + 无审计
 * - priority-preserved → 页面手动状态优先，不产生任何变更
 */
export type ApplyAnswerResult =
  | { readonly kind: 'correct'; readonly change: StateChange<'initial'>; readonly audit: AuditMarker }
  | { readonly kind: 'wrong'; readonly change: StateChange<'initial'>; readonly audit: null }
  | { readonly kind: 'unsure'; readonly change: StateChange<'initial'>; readonly audit: null }
  | { readonly kind: 'priority-preserved'; readonly change: null; readonly audit: null };

// ============================================================
// 持久化快照
// ============================================================

export interface VocabSnapshot {
  schemaVersion: number;
  /** 词典产物版本标识 */
  dictVersion: string;
  /** 安装随机种子（十六进制） */
  installSeed: string;
  /** 单词状态映射 */
  words: Record<string, WordState>;
  /** 单次答对待审计标记（仅首测正确词与高置信不提示未知词） */
  auditMarkers: Record<string, AuditMarker>;
  /** 首测冻结计划与作答进度；null 表示尚未开始 */
  initialTest: InitialTestState | null;
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
  markKnown(word: string): StateChange<'manual'>;

  /**
   * 用户标记"不会"
   * @param word 规范化单词
   */
  markLearning(word: string): StateChange<'manual'>;
}

export const SCHEMA_VERSION = 1;
