// ============================================================
// 共享类型定义 —— 词汇展示与测试策略的 Interface
// ============================================================

/** 个人词汇状态：会 / 不会 / 未知 */
export type WordStatus = 'known' | 'learning' | 'unknown';

/** 页面展示决策 */
export type DisplayDecision = 'strong' | 'light' | 'none';

/** 状态变更来源：手动标记 / 首测作答 / 审计作答 / 活跃生词状态核验 */
export type WordStateSource = 'manual' | 'initial' | 'audit' | 'active-verify';

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
  /**
   * 状态版本：每次首测 (re)start / reset 递增。用于隔离不同轮的单词状态，
   * 并在重复相同 plan.version 时仍能清除上一轮的审计标记（仅靠 planVersion 无法区分）。
   */
  version: number;
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
  /**
   * 标记被创建时的快照状态版本（VocabSnapshot.stateVersion）。
   * 重复相同 plan.version 重新首测时，仅凭 planVersion 无法区分新旧标记；
   * worker 据 stateVersion 校验并清除上一轮的陈旧标记。
   */
  readonly stateVersion: number;
  readonly createdAt: number;
  readonly pending: boolean;
}

// ============================================================
// 审计（Spec B §8：单次答对审计标记的生命周期）
// ============================================================

/** 审计候选池：单次初测答对词 / 高置信不提示未知词 */
export type AuditBucket = 'initial-correct' | 'high-confidence';

/** 一个审计候选（含来源桶与词频段，供确定性选择使用） */
export interface AuditCandidate {
  readonly word: string;
  readonly bucket: AuditBucket;
  readonly band: number;
}

/** 冻结审计计划中的单个候选（与冻结审计题一一对应） */
export interface AuditPlanCandidate {
  readonly word: string;
  readonly bucket: AuditBucket;
  readonly band: number;
}

/** 审计结果：答对（已验证）/ 答错或不确定（失败） */
export type AuditOutcome = 'verified' | 'failed';

/**
 * 冻结的审计计划（Spec B §8 + §6「作答前冻结」）。
 * 由策略模块一次性产出并持久化到快照；作答时 worker 依此冻结计划验证请求，
 * 不信任客户端传入的 planVersion/bucket/候选资格。
 */
export interface AuditPlan {
  /** 审计计划版本 = hash(seed + planVersion + candidates)，确定性 */
  readonly version: string;
  /** 被审计的首测计划版本（InitialTestPlan.version） */
  readonly planVersion: string;
  /** 创建此冻结计划时的快照状态版本（VocabSnapshot.stateVersion） */
  readonly stateVersion: number;
  /** 安装随机种子 */
  readonly seed: string;
  /** 冻结的审计候选（与 questions/settled 一一对应） */
  readonly candidates: readonly AuditPlanCandidate[];
  /** 冻结的审计题（与 candidates 一一对应；含正确选项下标） */
  readonly questions: readonly QuizQuestion[];
  /** 每个候选的结算结果；null=未结算，'verified'/'failed'=已结算。结算后不可重复结算。 */
  readonly results: readonly (AuditOutcome | null)[];
  readonly createdAt: number;
}

/** 一条审计事件记录（结算后仅保留最小状态证据与最近审计结果） */
export interface AuditEvent {
  readonly word: string;
  readonly outcome: AuditOutcome;
  readonly bucket: AuditBucket;
  readonly planVersion: string;
  readonly at: number;
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
// 策略 seam 原子结果：worker 只合并，不自行决定清理策略
// ============================================================

/** 手动标记结果：状态变更 + 是否清除该词陈旧审计标记（手动覆盖优先） */
export interface ManualMarkResult {
  readonly change: StateChange<'manual'>;
  readonly clearMarker: boolean;
}

/**
 * 首测开始生命周期 transition（策略生成，worker 机械应用，不自行决定清理）。
 * 不再是「固定布尔意图（Middle Man）」——策略直接据输入计算并交付**完整、可机械应用**的
 * 新快照片段，worker 仅做 `...snapshot, ...transition` 式合并，不得自行决定状态版本、
 * 标记清理、auditPlan 清理或 InitialTestState 的构造：
 * - nextStateVersion：递增后的快照状态版本（隔离本轮状态）
 * - auditMarkers：已清空上一轮待审计标记后的完整标记映射（策略收口为「全清」，
 *   含 stateVersion === nextStateVersion 的异常 marker 一律排除）
 * - auditPlan：下一轮起始时冻结审计计划应为 null（策略直接给出，worker 不再解释布尔）
 * - initialTest：由传入 plan 构造的完整首测状态（answers 全 null、completed:false）
 */
export interface InitialTestStartTransition {
  readonly nextStateVersion: number;
  readonly auditMarkers: Record<string, AuditMarker>;
  readonly auditPlan: AuditPlan | null;
  readonly initialTest: InitialTestState;
}

/** 首测重置生命周期 transition（策略生成，worker 机械应用） */
export interface InitialTestResetTransition {
  readonly nextStateVersion: number;
  readonly auditMarkers: Record<string, AuditMarker>;
  readonly auditPlan: AuditPlan | null;
  readonly initialTest: InitialTestState | null;
}

// ============================================================
// 条件类型应用（Matt Pocock 风格）
// ============================================================

/** 作答是否提交确定状态：「不确定」不提交，其余提交 */
export type IsCommittal<A extends QuizAnswer> = A extends { kind: 'unsure' } ? false : true;

/** 由「是否答对」在类型层映射出结果状态 */
export type StatusFromCorrectness<C extends boolean> = C extends true ? 'known' : 'learning';

/** 作答结果种类 */
export type ApplyAnswerOutcomeKind = 'correct' | 'wrong' | 'unsure' | 'priority-preserved';

/**
 * applyAnswer 的判别联合返回类型。
 * 每个分支的 `change` 字段类型经过精确约束（source='initial'）：
 * - correct  → 携带已知状态变更（V0.1 不再产出审计标记，见 Ticket 01 / R-AUD-3）
 * - wrong/unsure → 携带未知状态变更 + 清除该词陈旧审计标记（防御性，标记本不应存在）
 * - priority-preserved → 页面手动状态优先，不产生任何变更
 *
 * `clearMarkerWord` 指示 worker 应清除哪个词的待审计标记（上一轮残留）：
 * 本轮答错/不确定或手动状态优先时，该词不应再持有任何审计标记。
 */
export type ApplyAnswerResult =
  | { readonly kind: 'correct'; readonly change: StateChange<'initial'>; readonly clearMarkerWord: null }
  | { readonly kind: 'wrong'; readonly change: StateChange<'initial'>; readonly audit: null; readonly clearMarkerWord: string }
  | { readonly kind: 'unsure'; readonly change: StateChange<'initial'>; readonly audit: null; readonly clearMarkerWord: string }
  | { readonly kind: 'priority-preserved'; readonly change: null; readonly audit: null; readonly clearMarkerWord: string };

// ============================================================
// 持久化快照
// ============================================================

export interface VocabSnapshot {
  schemaVersion: number;
  /** 词典产物版本标识 */
  dictVersion: string;
  /**
   * 状态版本：每次首测 (re)start / reset 递增。单词状态与审计标记/计划据此隔离，
   * 重复相同 plan.version 重测时仍清除上一轮陈旧标记。
   */
  stateVersion: number;
  /** 安装随机种子（十六进制） */
  installSeed: string;
  /** 单词状态映射 */
  words: Record<string, WordState>;
  /** 单次答对待审计标记（仅首测正确词与高置信不提示未知词） */
  auditMarkers: Record<string, AuditMarker>;
  /** 审计事件日志（答对/答错或不确定的最小状态证据，供漏提示率计算） */
  auditLog: AuditEvent[];
  /** 冻结的审计计划（作答前冻结，worker 据此验证审计作答）；null 表示无活跃审计 */
  auditPlan: AuditPlan | null;
  /** 首测冻结计划与作答进度；null 表示尚未开始 */
  initialTest: InitialTestState | null;
  /** 最后更新时间戳 */
  lastUpdated: number;
}

/** 策略模块输入：单个命中词的上下文 */
export interface LookupContext {
  /** 状态键（stateKey）：小写 surface form，是单词状态/审计标记/页面 data-word 的统一键（非 entryKey/规范化单词） */
  word: string;
  /** 页面原始词形（保留大小写，用于 DOM 定位），例如 "Went"；其小写即 `word`（stateKey）。entryKey/规范化单词只负责词典取义，不承载状态 */
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
  /** 状态键（stateKey）：小写 surface form，是页面 data-word 与单词状态的统一键（非 entryKey/规范化单词） */
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
   * 用户标记"会"：返回状态变更 + 是否清除该词陈旧审计标记（手动覆盖优先）。
   * @param word 状态键（stateKey）
   */
  markKnown(word: string): ManualMarkResult;

  /**
   * 用户标记"不会"：返回状态变更 + 是否清除该词陈旧审计标记（手动覆盖优先）。
   * @param word 状态键（stateKey）
   */
  markLearning(word: string): ManualMarkResult;

  // ============================================================
  // 首测：冻结计划 + 结算单题（领域动作，非旧函数浅转发）
  // ============================================================

  /** 冻结首测计划：十频段各五题、选项顺序与计划版本在调用时冻结。 */
  freezeInitialTestPlan(input: FreezeInitialTestInput): InitialTestPlan;

  /** 结算一道冻结的首测题：返回原子状态变更 + 陈旧标记清理意图（V0.1 用户路径已切断审计，不再产出审计标记）。 */
  settleInitialTestAnswer(input: SettleInitialTestInput): ApplyAnswerResult;

  /**
   * 首测开始生命周期 transition：策略据首测计划、当前标记与状态版本计算并交付
   * 完整、可机械应用的 transition（nextStateVersion + auditMarkers + auditPlan + initialTest），
   * worker 仅做字段合并，不自行决定状态版本、marker 清理、auditPlan 清空或 InitialTestState 构造。
   * initialTest 由传入 plan 直接构造（answers 全 null、completed:false）。
   */
  startInitialTest(plan: InitialTestPlan, stateVersion: number): InitialTestStartTransition;

  /** 首测重置生命周期 transition：策略据此清除所有待审计标记与冻结计划并递增状态版本。 */
  resetInitialTest(stateVersion: number): InitialTestResetTransition;

  // ============================================================
  // 审计：冻结计划 + 结算单题（Spec B §8 + §6 作答前冻结）
  // ============================================================

  /** 冻结审计计划：从候选池确定性地选最多 count 题，含冻结审计题与结算位。 */
  freezeAuditPlan(input: FreezeAuditPlanInput): AuditPlan;

  /** 结算一道冻结的审计题：返回新计划（结算位翻转）+ 原子状态变更 + 审计事件。 */
  settleAuditAnswer(input: SettleAuditAnswerInput): SettleAuditResult;
}

/** 冻结首测计划输入：受控词典视图 + 安装种子 */
export interface FreezeInitialTestInput {
  readonly core: DictCore;
  readonly forms: FormsMap;
  readonly bands: FrequencyBands;
  readonly seed: string;
  readonly dictVersion: string;
}

/** 结算冻结首测题输入：冻结计划 + 题号 + 作答 + 该词当前状态（V0.1 用户路径已切断审计，不再需要 stateVersion） */
export interface SettleInitialTestInput {
  readonly plan: InitialTestPlan;
  readonly questionIndex: number;
  readonly answer: QuizAnswer;
  readonly current: WordState | undefined;
}

/** 冻结审计计划输入：候选所需快照片段 + 受控词典视图 + 种子 */
export interface FreezeAuditPlanInput {
  readonly markers: Record<string, AuditMarker>;
  readonly words: Record<string, WordState>;
  readonly core: DictCore;
  readonly bands: FrequencyBands;
  readonly seed: string;
  readonly planVersion: string;
  readonly count: number;
  /** 当前高置信不提示的未知词（池 B 候选）；V0.1 高置信机制未建时传空 */
  readonly highConfidenceWords?: readonly string[];
  /** 审计轮次，用于改变段内抽取顺序（默认 0） */
  readonly round?: number;
  /** 当前快照状态版本（VocabSnapshot.stateVersion），盖到冻结审计计划 */
  readonly stateVersion: number;
}

/** 结算冻结审计题输入：冻结计划 + 候选下标 + 作答 + 该词当前状态 */
export interface SettleAuditAnswerInput {
  readonly plan: AuditPlan;
  readonly index: number;
  readonly answer: QuizAnswer;
  readonly current: WordState | undefined;
}

/** 结算审计题结果：新冻结计划（结算位翻转）+ 原子状态变更 + 审计事件 */
export interface SettleAuditResult {
  readonly kind: AuditOutcome;
  readonly plan: AuditPlan;
  readonly change: StateChange<'audit'>;
  readonly clearedWord: string;
  readonly event: AuditEvent;
}

/** 固定首测题数（十频段 × 五题） */
export const INITIAL_TEST_LENGTH = 50;

export const SCHEMA_VERSION = 2;
