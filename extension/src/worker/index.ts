// ============================================================
// Service Worker —— 本地画像协调器
// ============================================================
// 负责：
// 1. 初始化/加载持久化快照
// 2. 接收来自内容脚本的状态变更请求（手动标记 / 首测作答 / 审计作答）
// 3. 合并变更、持久化并广播到所有标签页
// 不得加载完整词典、参与单词查询或 DOM 操作。
//
// 策略 seam：本文件只消费 `strategy/index.ts` 的深 Module Interface 输出
// （冻结计划、原子状态变更、首测开始/重置意图），不直接 import `strategy/quiz.ts`
// 或 `strategy/audit.ts`。审计作答依持久化冻结审计计划验证，不信任客户端传入的
// planVersion/bucket/候选资格；冻结审计计划由受信任 popup 生成，worker 校验其
// sender 与结构后原样持久化。
// ============================================================

import type {
  VocabSnapshot,
  WordState,
  WordStatus,
  InitialTestPlan,
  QuizAnswer,
  AuditPlan,
  VocabStrategy,
  FormsMap,
  DailyTestState,
} from '../shared/types';
import { SCHEMA_VERSION } from '../shared/types';
import {
  createEmptySnapshot,
  mergeStateChange,
  mergeAssessment,
  mergeDailyTest,
  getWords,
  generateInstallSeed,
  setInitialTest,
  setAuditPlan,
  clearAuditMarker,
  recordAuditEvent,
  migrateSnapshot,
} from './storage';
import { createVocabStrategy, INITIAL_TEST_LENGTH, DAILY_TEST_LENGTH, dailyBandsForRound } from '../strategy/index';
import { validateAuditAnswerRequest, validateFrozenAuditPlan } from './auditValidation';

const STORAGE_KEY = 'avr_vocab_snapshot';
// 固定 1,000 词 ECDICT 产物的 dict-core.json SHA-256 前缀；Service Worker 不读取词典。
const DICTIONARY_VERSION = 'ecdict-core-1000-64eb1a402f909f7a';

const strategy = createVocabStrategy();
let currentSnapshot: VocabSnapshot | null = null;

/** popup 在扩展中的精确 URL（FREEZE_AUDIT_PLAN 的 sender 校验基准） */
function popupUrl(): string {
  if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
    return chrome.runtime.getURL('popup.html');
  }
  return 'popup.html';
}

/** 扩展自身 ID（sender 校验） */
function selfId(): string | undefined {
  if (typeof chrome !== 'undefined' && chrome.runtime) return chrome.runtime.id;
  return undefined;
}

/** 本地日期（YYYY-MM-DD）；date seam 的最小生产来源（R-DLY-8），不建设时间服务。 */
export function currentLocalDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 纯函数：消费一条消息并返回（可能更新的）快照、响应与可选的广播指令。
 * 不依赖 chrome.storage / chrome.tabs，可在单测中直接驱动「真实协调路径」。
 * 调用方（监听器）负责 load / persist / broadcast 副作用。
 *
 * @param today 当前本地日期（YYYY-MM-DD）。最小可测试输入（date seam）：
 *   生产路径默认取 `currentLocalDate()`，测试注入固定日期；不建设时间服务。
 *   每日作答/跳过/开始均以持久化 `DailyTestState.localDate` 与此值比对，
 *   保证跨日后旧轮不可继续写入（R-DLY-8）。
 */
export interface WorkerSender {
  tab?: { id?: number };
  id?: string;
  url?: string;
}

export interface ReducedMessage {
  snapshot: VocabSnapshot;
  response: unknown;
  broadcast?: { word: string; newStatus: WordStatus };
  changed: boolean;
}

export function reduceWorkerMessage(
  snapshot: VocabSnapshot,
  message: WorkerMessage,
  sender: WorkerSender,
  strat: VocabStrategy = createVocabStrategy(),
  today: string = currentLocalDate(),
): ReducedMessage {
  switch (message.type) {
    case 'GET_STATE':
      return { snapshot, response: { words: getWords(snapshot) }, changed: false };

    case 'GET_PROFILE':
      return {
        snapshot,
        response: { installSeed: snapshot.installSeed, dictVersion: snapshot.dictVersion },
        changed: false,
      };

    case 'STATE_CHANGE': {
      const { word, newStatus } = message;
      // 清理策略由策略 Module 决定（手动覆盖优先 → 清除该词审计标记）
      const markResult = newStatus === 'known' ? strat.markKnown(word) : strat.markLearning(word);
      let next = mergeStateChange(snapshot, markResult.change.word, markResult.change.newStatus, 'manual');
      if (markResult.clearMarker) {
        next = clearAuditMarker(next, word);
      }
      return { snapshot: next, response: { success: true }, broadcast: { word, newStatus }, changed: true };
    }

    case 'INITIAL_TEST_START': {
      const plan = message.plan;
      if (!plan || plan.questions.length !== INITIAL_TEST_LENGTH) {
        return { snapshot, response: { error: 'invalid plan' }, changed: false };
      }
      // 完整生命周期 transition 由策略 Module 生成（含 nextStateVersion + auditMarkers +
      // auditPlan + initialTest），worker 仅机械合并结果字段，不自行决定状态版本、
      // marker 清理、auditPlan 清理或 InitialTestState 的构造。
      const transition = strat.startInitialTest(plan, snapshot.stateVersion);
      const snap: VocabSnapshot = {
        ...snapshot,
        stateVersion: transition.nextStateVersion,
        auditMarkers: transition.auditMarkers,
        auditPlan: transition.auditPlan,
        initialTest: transition.initialTest,
      };
      return { snapshot: snap, response: { success: true }, changed: true };
    }

    case 'GET_INITIAL_TEST':
      return { snapshot, response: { test: snapshot.initialTest }, changed: false };

    case 'GET_ASSESSMENT_EVIDENCE':
      // 估计只读取 AssessmentEvidence（RULES 双真相源）；popup 结果页展示点值/范围时经此只读消息获取。
      return { snapshot, response: { evidence: snapshot.assessmentEvidence }, changed: false };

    // ============================================================
    // 每日校准轮（Ticket 04）：只读/开始/跳过/作答
    // ============================================================

    case 'GET_DAILY_TEST':
      // 返回当前轮（可能为 null）与已完成轮次；popup 每日入口/进度/跨日过期展示依赖此消息。
      return { snapshot, response: { test: snapshot.dailyTest, completedRoundIndex: snapshot.completedRoundIndex }, changed: false };

    case 'DAILY_TEST_START': {
      const { test } = message;
      // 入口前置（R-DLY-5）：每日轮只在首测完成后可进入；首测未完成绝不创建 DailyTestState。
      if (!snapshot.initialTest || snapshot.initialTest.completed !== true) {
        return { snapshot, response: { error: 'initial test required' }, changed: false };
      }
      // R-DLY-8 跨日边界：计划必须归属当前本地日期（拒绝恢复/创建旧日期轮次）。
      if (test.localDate !== today) {
        return { snapshot, response: { error: 'daily test expired' }, changed: false };
      }
      const existing = snapshot.dailyTest;
      // 同一本地日期已有一轮：暂停恢复同一冻结计划；已跳过则反悔（skipped→false）并复用计划。
      if (existing && existing.localDate === test.localDate) {
        if (existing.completed) {
          return { snapshot, response: { test: existing }, changed: false };
        }
        if (existing.skipped) {
          const resumed: DailyTestState = { ...existing, skipped: false };
          return { snapshot: mergeDailyTest(snapshot, resumed), response: { test: resumed, resumed: true }, changed: true };
        }
        return { snapshot, response: { test: existing }, changed: false };
      }
      // 新计划（首次或跨日）：服务端权威校验结构，不信任客户端计划内容（防伪造频段/题数/轮次）。
      const validation = validateDailyTestPlan(test, snapshot.completedRoundIndex);
      if (!validation.ok) {
        return { snapshot, response: { error: validation.error }, changed: false };
      }
      return { snapshot: mergeDailyTest(snapshot, test), response: { test, created: true }, changed: true };
    }

    case 'DAILY_TEST_ANSWER': {
      const { questionIndex, answer } = message;
      const daily = snapshot.dailyTest;
      // 无活跃轮/已跳过/已完成/题号越界/该题已答 → 拒绝（防重复作答与轮次外作答）。
      if (!daily || daily.skipped || daily.completed) {
        return { snapshot, response: { error: 'cannot answer' }, changed: false };
      }
      // R-DLY-8 跨日边界：持久化轮次不属于当前本地日期 → 拒绝写入（过期，零变化），
      // 防止午夜后仍持有旧答题页的客户端继续提交并写入状态/证据/轮次。
      if (daily.localDate !== today) {
        return { snapshot, response: { error: 'daily test expired' }, changed: false };
      }
      const question = daily.questions[questionIndex];
      if (!question || daily.answers[questionIndex] !== null) {
        return { snapshot, response: { error: 'cannot answer' }, changed: false };
      }
      const current = snapshot.words[question.word];
      const result = strat.settleDailyAnswer({ question, answer });
      // 每日作答双写 WordState(daily) + AssessmentEvidence(daily)（R-DLY-4），估计随证据变化。
      // change.source 由每日领域 seam 固定为 'daily'，与持久化来源一致（ADR-0004）。
      const settlement = strat.settleAssessment({
        word: result.change.word,
        outcome: result.change.newStatus as 'known' | 'learning',
        source: result.change.source,
        assessedAt: Date.now(),
      });
      const answers = daily.answers.slice();
      answers[questionIndex] = answer;
      const completed = answers.every((a) => a !== null);
      let next = mergeAssessment(snapshot, settlement);
      // completed 首次变 true 时仅递增一次 completedRoundIndex（R-DLY-2），由 storage 纯函数收口。
      next = mergeDailyTest(next, { ...daily, answers, completed });
      return {
        snapshot: next,
        response: { result, test: next.dailyTest, completedRoundIndex: next.completedRoundIndex },
        broadcast: { word: result.change.word, newStatus: result.change.newStatus },
        changed: true,
      };
    }

    case 'DAILY_TEST_SKIP': {
      const daily = snapshot.dailyTest;
      if (!daily || daily.skipped || daily.completed) {
        return { snapshot, response: { error: 'cannot skip' }, changed: false };
      }
      // R-DLY-8 跨日边界：旧日期轮次不得再跳过（与作答一致：过期零变化）。
      if (daily.localDate !== today) {
        return { snapshot, response: { error: 'daily test expired' }, changed: false };
      }
      // 仅首题前可跳过；首题前跳过 → WordState 与 AssessmentEvidence 零变化（R-DLY-6）。
      if (daily.answers.some((a) => a !== null)) {
        return { snapshot, response: { error: 'cannot skip after first answer' }, changed: false };
      }
      const skipped: DailyTestState = { ...daily, skipped: true };
      return { snapshot: mergeDailyTest(snapshot, skipped), response: { success: true, test: skipped }, changed: true };
    }

    case 'INITIAL_TEST_ANSWER': {
      const { questionIndex, answer } = message;
      const test = snapshot.initialTest;

      if (!test || test.completed || test.answers[questionIndex] !== null) {
        return { snapshot, response: { error: 'cannot answer' }, changed: false };
      }

      const current = snapshot.words[test.plan.questions[questionIndex]!.word];
      const result = strat.settleInitialTestAnswer({
        plan: test.plan,
        questionIndex,
        answer,
        current,
      });

      // 记录作答（无论是否产生状态变更，作答本身必须持久化）
      const answers = test.answers.slice();
      answers[questionIndex] = answer;
      const completed = answers.every((a) => a !== null);

      // 初测/每日共享的结算语义：测试写入会覆盖先前 manual WordState，
      // 同时按 wordKey 覆盖该词唯一一条 AssessmentEvidence。
      const settlement = strat.settleAssessment({
        word: result.change.word,
        outcome: result.change.newStatus as 'known' | 'learning',
        source: 'initial',
        assessedAt: Date.now(),
      });
      let next = mergeAssessment(snapshot, settlement);
      // 清除该词上一轮残留的待审计标记（答错/不确定/手动优先时；
      // 答对分支在 V0.1 已不再产出标记，见 Ticket 01 / R-AUD-3）
      if (result.clearMarkerWord) {
        next = clearAuditMarker(next, result.clearMarkerWord);
      }

      next = setInitialTest(next, { plan: test.plan, answers, completed });
      return {
        snapshot: next,
        response: { result },
        broadcast: { word: result.change.word, newStatus: result.change.newStatus },
        changed: true,
      };
    }

    case 'INITIAL_TEST_RESET': {
      // 完整生命周期 transition 由策略 Module 生成（含 nextStateVersion + auditMarkers +
      // auditPlan:null + initialTest:null），worker 仅机械合并，不自行决定清理。
      const transition = strat.resetInitialTest(snapshot.stateVersion);
      const snap: VocabSnapshot = {
        ...snapshot,
        stateVersion: transition.nextStateVersion,
        auditMarkers: transition.auditMarkers,
        auditPlan: transition.auditPlan,
        initialTest: transition.initialTest,
      };
      return { snapshot: snap, response: { success: true }, changed: true };
    }

    case 'GET_AUDIT_MARKERS': {
      const planVersion = snapshot.initialTest?.plan?.version ?? '';
      const pendingAudit = Object.values(snapshot.auditMarkers).filter((m) => m.pending).length;
      return {
        snapshot,
        response: { markers: snapshot.auditMarkers, planVersion, pendingAudit, stateVersion: snapshot.stateVersion },
        changed: false,
      };
    }

    case 'FREEZE_AUDIT_PLAN': {
      // 仅接受来自本扩展 popup（非内容脚本）的冻结请求：
      // 内容脚本带 sender.tab，popup 不带；且 popup 的 url 必须精确等于扩展内 popup.html。
      const fromPopup =
        !!sender &&
        !sender.tab &&
        sender.id === selfId() &&
        !!sender.url &&
        sender.url === popupUrl();
      if (!fromPopup) {
        return { snapshot, response: { error: 'audit plan may only be frozen by the extension popup' }, changed: false };
      }
      // 服务端权威校验：校验结构完整性 + 与当前快照状态一致（不信任客户端计划内容）
      const validation = validateFrozenAuditPlan(message.plan, snapshot);
      if (!validation.ok) {
        return { snapshot, response: { error: validation.error }, changed: false };
      }
      // 校验通过：原样持久化受信任 popup 生成的冻结计划
      return { snapshot: setAuditPlan(snapshot, message.plan), response: { success: true }, changed: true };
    }

    case 'GET_AUDIT_PLAN':
      return { snapshot, response: { plan: snapshot.auditPlan }, changed: false };

    case 'AUDIT_ANSWER': {
      const { auditPlanVersion, index, answer } = message;
      const plan = snapshot.auditPlan;

      // 服务端权威校验：依持久化冻结审计计划验证请求（不信任客户端元数据）
      const validation = validateAuditAnswerRequest(
        plan,
        auditPlanVersion,
        index,
        snapshot.auditMarkers,
        snapshot.words,
        snapshot.stateVersion,
      );
      if (!validation.ok) {
        return { snapshot, response: { error: validation.error }, changed: false };
      }

      const candidate = plan!.candidates[index]!;
      const current = snapshot.words[candidate.word];
      const result = strat.settleAuditAnswer({ plan: plan!, index, answer, current });

      let next = setAuditPlan(snapshot, result.plan);
      next = mergeStateChange(next, result.change.word, result.change.newStatus, 'audit');
      next = clearAuditMarker(next, result.clearedWord);
      next = recordAuditEvent(next, result.event);
      return {
        snapshot: next,
        response: { result },
        broadcast: { word: result.change.word, newStatus: result.change.newStatus },
        changed: true,
      };
    }

    case 'CLEAR_AUDIT_PLAN':
      return { snapshot: setAuditPlan(snapshot, null), response: { success: true }, changed: true };

    default:
      return { snapshot, response: { error: 'unknown message type' }, changed: false };
  }
}

/**
 * 从 chrome.storage.local 加载快照。
 * 首次安装时创建空快照；旧快照缺字段时向前迁移。
 * 关键：迁移不是「按次读取转换」——一旦检测到旧格式，立即把升级后的 v3 快照
 * 写回 storage，使「重启」读到的是已升级的 v3，而非每次读取都重新转换。
 */
export async function loadSnapshot(): Promise<VocabSnapshot> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY];

  if (stored && typeof stored.schemaVersion === 'number' && stored.schemaVersion === SCHEMA_VERSION) {
    // 已是当前版本：原样返回（不重写，避免无谓写入）
    return stored as VocabSnapshot;
  }

  if (stored && typeof stored.schemaVersion === 'number') {
    // worker 只在迁移时读取最小 FormsMap；不加载完整词典，也不参与 runtime 查词。
    const forms = await loadFormsMap();
    if (forms === null) {
      // 不能在缺少 FormsMap 时把 schema 2 锁死为 v3：那会让待合并的 surface key 永久保留。
      throw new Error('FormsMap unavailable; schema 2 migration postponed without persistence');
    }
    // 旧格式：迁移并立即持久化升级结果（重启验证的持久迁移）
    const migrated = migrateSnapshot(stored, forms);
    await chrome.storage.local.set({ [STORAGE_KEY]: migrated });
    return migrated;
  }

  // 首次运行：创建初始快照
  const seed = generateInstallSeed();
  const snapshot = createEmptySnapshot(seed, DICTIONARY_VERSION);
  await chrome.storage.local.set({ [STORAGE_KEY]: snapshot });
  return snapshot;
}

async function loadFormsMap(): Promise<FormsMap | null> {
  // 仅供纯 worker 单测：真实扩展必有 chrome.runtime，生产路径绝不静默跳过 FormsMap。
  if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) return {};
  try {
    const response = await fetch(chrome.runtime.getURL('data/forms.json'));
    if (!response.ok) return null;
    const raw: unknown = await response.json();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const forms: FormsMap = {};
    for (const [surface, wordKey] of Object.entries(raw)) {
      if (surface.trim().length === 0 || typeof wordKey !== 'string' || wordKey.trim().length === 0) return null;
      forms[surface] = wordKey;
    }
    return Object.keys(forms).length > 0 ? forms : null;
  } catch {
    return null;
  }
}

/**
 * 持久化快照
 */
async function persistSnapshot(snapshot: VocabSnapshot): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: snapshot });
}

/**
 * 广播状态更新到所有标签页。
 * 携带变更的 word 和 newStatus，让内容脚本只增量更新该词而非全页重扫。
 */
async function broadcastState(snapshot: VocabSnapshot, changedWord: string, newStatus: WordState['status']): Promise<void> {
  const words = getWords(snapshot);
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'STATE_UPDATED', words, word: changedWord, newStatus }).catch(() => {
        // 标签页可能尚未注入内容脚本，忽略
      });
    }
  }
}

// ============================================================
// 消息协议（与内容脚本、弹窗共享的 WorkerMessage 判别联合）
// ============================================================

type WorkerMessage =
  | { type: 'GET_STATE' }
  | { type: 'GET_PROFILE' }
  | { type: 'STATE_CHANGE'; word: string; newStatus: WordStatus }
  | { type: 'INITIAL_TEST_START'; plan: InitialTestPlan }
  | { type: 'GET_INITIAL_TEST' }
  | { type: 'GET_ASSESSMENT_EVIDENCE' }
  | { type: 'INITIAL_TEST_ANSWER'; questionIndex: number; answer: QuizAnswer }
  | { type: 'INITIAL_TEST_RESET' }
  | { type: 'GET_DAILY_TEST' }
  | { type: 'DAILY_TEST_START'; test: DailyTestState }
  | { type: 'DAILY_TEST_ANSWER'; questionIndex: number; answer: QuizAnswer }
  | { type: 'DAILY_TEST_SKIP' }
  | { type: 'GET_AUDIT_MARKERS' }
  | { type: 'FREEZE_AUDIT_PLAN'; plan: AuditPlan }
  | { type: 'GET_AUDIT_PLAN' }
  | { type: 'AUDIT_ANSWER'; auditPlanVersion: string; index: number; answer: QuizAnswer }
  | { type: 'CLEAR_AUDIT_PLAN' };

/**
 * 服务端权威校验 popup 提交的每日计划结构（不信任客户端计划内容）：
 * - 恰好 5 题；每个选中频段（按 completedRoundIndex 奇偶）恰好一题；
 * - 同轮不重复（不同频段词池互斥，此处再防御断言）；
 * - answers 全为 null、completed=false、skipped=false、roundIndex 与当前轮次一致。
 */
export function validateDailyTestPlan(
  test: unknown,
  completedRoundIndex: number,
): { ok: true } | { ok: false; error: string } {
  if (!test || typeof test !== 'object' || Array.isArray(test)) {
    return { ok: false, error: 'invalid daily test' };
  }
  const t = test as DailyTestState;
  if (!Array.isArray(t.questions) || t.questions.length !== DAILY_TEST_LENGTH) {
    return { ok: false, error: 'daily test must have exactly 5 questions' };
  }
  if (!Array.isArray(t.answers) || t.answers.length !== t.questions.length || t.answers.some((a) => a !== null)) {
    return { ok: false, error: 'daily test answers must all be null' };
  }
  if (t.completed !== false || t.skipped !== false) {
    return { ok: false, error: 'daily test must start incomplete and unskipped' };
  }
  if (t.roundIndex !== completedRoundIndex) {
    return { ok: false, error: 'daily test round index mismatch' };
  }
  const expected = dailyBandsForRound(completedRoundIndex);
  const seenBands = new Set<number>();
  const seenWords = new Set<string>();
  for (const q of t.questions) {
    if (!q || typeof q !== 'object' || typeof q.word !== 'string' || q.word.length === 0 || !Number.isInteger(q.band)) {
      return { ok: false, error: 'daily test question malformed' };
    }
    if (!expected.includes(q.band) || seenBands.has(q.band)) {
      return { ok: false, error: 'daily test band mismatch' };
    }
    seenBands.add(q.band);
    if (seenWords.has(q.word)) {
      return { ok: false, error: 'daily test duplicate word' };
    }
    seenWords.add(q.word);
  }
  if (seenBands.size !== DAILY_TEST_LENGTH) {
    return { ok: false, error: 'daily test must cover each selected band once' };
  }
  return { ok: true };
}

// 仅在扩展运行时（chrome 可用）注册消息监听与启动副作用；
// 测试环境无 chrome 时跳过，使 reduceWorkerMessage 可在单测中直接驱动。
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message: WorkerMessage, sender, sendResponse) => {
    (async () => {
      if (!currentSnapshot) {
        currentSnapshot = await loadSnapshot();
      }

      const { snapshot, response, broadcast, changed } = reduceWorkerMessage(currentSnapshot, message, sender);
      currentSnapshot = snapshot;
      if (changed) {
        await persistSnapshot(currentSnapshot);
      }
      if (broadcast) {
        await broadcastState(currentSnapshot, broadcast.word, broadcast.newStatus);
      }
      sendResponse(response);
    })();

    // 返回 true 表示异步响应
    return true;
  });

  // 启动时加载快照
  Promise.all([
    // 默认不把存储暴露给内容脚本；页面侧只能通过本文件的消息协议读取最小状态。
    chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }),
    loadSnapshot(),
  ]).then(([, snapshot]) => {
    currentSnapshot = snapshot;
    console.log('[AVR] Service Worker initialized, seed:', snapshot.installSeed.slice(0, 8) + '...');
  }).catch((error) => {
    console.error('[AVR] Service Worker initialization failed', error);
  });
}
