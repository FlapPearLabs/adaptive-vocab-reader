// ============================================================
// 共享类型定义 —— 词汇展示与测试策略的 Interface
// ============================================================

/** 个人词汇状态：会 / 不会 / 未知 */
export type WordStatus = 'known' | 'learning' | 'unknown';

/** 页面展示决策 */
export type DisplayDecision = 'strong' | 'light' | 'none';

/** 状态变更来源：手动标记 / 首测作答 / 每日作答 / 审计作答 / 活跃生词状态核验 */
export type WordStateSource = 'manual' | 'initial' | 'daily' | 'audit' | 'active-verify';

/** 测试证据的结果与来源；手动标记不产生证据。 */
export type AssessmentOutcome = 'known' | 'learning';
export type AssessmentSource = 'initial' | 'daily';

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

/** 每个 wordKey 最近一次测试的最小证据；不保存测试历史。 */
export interface AssessmentEvidence {
  outcome: AssessmentOutcome;
  source: AssessmentSource;
  assessedAt: number;
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

// ============================================================
// 每日校准轮（每日五题）
// ============================================================

/**
 * 每日五题校准轮的最小持久化状态；只承载当前本地日期的一轮。
 * 不建调度器/队列/提醒；不保存历史轮次；不做状态机框架或事务回滚。
 *
 * 状态约束（Spec §8 / RULES「每日校准轮」）：
 * - `localDate`：创建计划时的本地日期（YYYY-MM-DD）。最小可测试输入（date seam），
 *   生产路径取本地日期字符串，测试注入固定日期；不建设时间服务。
 * - `roundIndex`：创建时的 `completedRoundIndex`（奇偶轮换频段的依据）。
 * - `questions`：冻结的 5 道题（奇偶频段轮换、每段一题），作答前冻结。
 * - `answers`：与 `questions` 等长；未答位置为 `null`。
 * - `completed`：仅当五题全部作答时为 `true`。
 * - `skipped`：仅当 `answers` 全为 `null` 时可 `true`（首题前跳过）；
 *   用户从次级入口反悔开始时变回 `false` 并复用同一冻结计划；
 *   第一题作答后不得再变为 `skipped`。
 * - `completedRoundIndex` 只在 `completed` 首次变 `true` 时递增一次（worker/storage 协调）。
 */
export interface DailyTestState {
  readonly localDate: string;
  readonly roundIndex: number;
  readonly questions: readonly QuizQuestion[];
  readonly answers: readonly (QuizAnswer | null)[];
  readonly completed: boolean;
  readonly skipped: boolean;
}

/** 冻结每日五题计划的输入：受控词典视图 + 安装种子 + 当前轮次 + 测试证据（只读） */
export interface FreezeDailyTestInput {
  readonly core: DictCore;
  readonly forms: FormsMap;
  readonly bands: FrequencyBands;
  readonly seed: string;
  readonly dictVersion: string;
  /** 创建计划时的 completedRoundIndex（奇偶轮换频段） */
  readonly completedRoundIndex: number;
  /**
   * 选词与「最久未测」只读取 AssessmentEvidence（R-EVD-5）；
   * 不读取 WordState，也不能通过过滤 `WordState.source` 模拟。
   */
  readonly evidence: Record<string, AssessmentEvidence>;
}

/** 结算一道冻结每日题的输入：冻结题 + 作答（无审计产物） */
export interface SettleDailyTestAnswerInput {
  readonly question: QuizQuestion;
  readonly answer: QuizAnswer;
}

/**
 * 每日单题结算结果（R-DLY-4 / ADR-0004）：答对→会、答错/不确定→不会。
 * 来源固定为 `daily`——每日领域 seam 与持久化写入的来源必须一致，
 * 不得借用首测的 `StateChange<'initial'>` 再在 worker 侧重建。
 * 不携带审计字段（V0.1 用户路径已切断审计）；这是每日专属的最小返回类型，
 * 不抽象成通用测试轮引擎。
 */
export type DailyAnswerResult =
  | { readonly kind: 'correct'; readonly change: StateChange<'daily'> }
  | { readonly kind: 'wrong'; readonly change: StateChange<'daily'> }
  | { readonly kind: 'unsure'; readonly change: StateChange<'daily'> };

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
export type ApplyAnswerOutcomeKind = 'correct' | 'wrong' | 'unsure';

/**
 * applyAnswer 的判别联合返回类型。
 * 每个分支的 `change` 字段类型经过精确约束（source='initial'）：
 * - correct  → 携带已知状态变更（V0.1 不再产出审计标记，见 Ticket 01 / R-AUD-3）
 * - wrong/unsure → 携带未知状态变更 + 清除该词陈旧审计标记（防御性，标记本不应存在）
 * `clearMarkerWord` 指示 worker 应清除哪个词的待审计标记（上一轮残留）。
 */
export type ApplyAnswerResult =
  | { readonly kind: 'correct'; readonly change: StateChange<'initial'>; readonly clearMarkerWord: null }
  | { readonly kind: 'wrong'; readonly change: StateChange<'initial'>; readonly audit: null; readonly clearMarkerWord: string }
  | { readonly kind: 'unsure'; readonly change: StateChange<'initial'>; readonly audit: null; readonly clearMarkerWord: string };

/** 初测与每日测试共用的原子结算输入。 */
export interface AssessmentSettlementInput {
  readonly word: string;
  readonly outcome: AssessmentOutcome;
  readonly source: AssessmentSource;
  readonly assessedAt: number;
}

/** 测试结算同步交付的状态变更与独立证据。 */
export interface AssessmentSettlement {
  readonly change: StateChange<AssessmentSource>;
  readonly evidence: AssessmentEvidence;
}

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
  /** 按 wordKey 保存的最近测试证据；与页面状态独立。 */
  assessmentEvidence: Record<string, AssessmentEvidence>;
  /** 单次答对待审计标记（仅首测正确词与高置信不提示未知词） */
  auditMarkers: Record<string, AuditMarker>;
  /** 审计事件日志（答对/答错或不确定的最小状态证据，供漏提示率计算） */
  auditLog: AuditEvent[];
  /** 冻结的审计计划（作答前冻结，worker 据此验证审计作答）；null 表示无活跃审计 */
  auditPlan: AuditPlan | null;
  /** 首测冻结计划与作答进度；null 表示尚未开始 */
  initialTest: InitialTestState | null;
  /** 当前一天的每日五题校准轮；null 表示当前本地日期尚未开始（schema 3 正式字段）。 */
  dailyTest: DailyTestState | null;
  /** 已完成每日轮数；schema 3 首次安装为 0。 */
  completedRoundIndex: number;
  /** 最后更新时间戳 */
  lastUpdated: number;
}

/** 策略模块输入：单个命中词的上下文 */
export interface LookupContext {
  /** wordKey：core 主词条小写形式，是单词状态/页面 data-word 的统一键。 */
  word: string;
  /** 页面原始词形（保留大小写，用于 DOM 定位），例如 "Went"；状态身份由 `word`（wordKey）承载。 */
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
  /** wordKey：页面 data-word 与单词状态的统一键。 */
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
   * @param word wordKey
   */
  markKnown(word: string): ManualMarkResult;

  /**
   * 用户标记"不会"：返回状态变更 + 是否清除该词陈旧审计标记（手动覆盖优先）。
   * @param word wordKey
   */
  markLearning(word: string): ManualMarkResult;

  // ============================================================
  // 首测：冻结计划 + 结算单题（领域动作，非旧函数浅转发）
  // ============================================================

  /** 冻结首测计划：十频段各五题、选项顺序与计划版本在调用时冻结。 */
  freezeInitialTestPlan(input: FreezeInitialTestInput): InitialTestPlan;

  /** 结算一道冻结的首测题：返回原子状态变更 + 陈旧标记清理意图（V0.1 用户路径已切断审计，不再产出审计标记）。 */
  settleInitialTestAnswer(input: SettleInitialTestInput): ApplyAnswerResult;

  /** 初测与每日共用的测试结算领域动作；手动标记不调用此动作。 */
  settleAssessment(input: AssessmentSettlementInput): AssessmentSettlement;

  // ============================================================
  // 每日校准轮：冻结计划 + 结算单题（每日五题）
  // ============================================================

  /**
   * 冻结每日五题计划：按 `completedRoundIndex` 奇偶轮换频段（偶数 0/2/4/6/8，
   * 奇数 1/3/5/7/9，每段一题）；段内优先无 AssessmentEvidence 的 wordKey、
   * 同轮不重复、install seed 确定性排序、耗尽后取 assessedAt 最早的旧词（R-EVD-5）。
   * `localDate` 为最小可测试输入（date seam），不建时间服务。
   */
  freezeDailyTest(input: FreezeDailyTestInput, localDate: string): DailyTestState;

  /** 结算一道冻结的每日题：答对→会、答错/不确定→不会；change.source 固定为 daily（R-DLY-4/ADR-0004）。 */
  settleDailyAnswer(input: SettleDailyTestAnswerInput): DailyAnswerResult;

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

/** 每日校准轮固定题数（奇偶频段轮换，每段一题，共五题） */
export const DAILY_TEST_LENGTH = 5;

export const SCHEMA_VERSION = 3;
