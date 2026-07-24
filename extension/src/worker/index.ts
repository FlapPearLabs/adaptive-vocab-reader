// ============================================================
// Service Worker —— 本地画像协调器
// ============================================================
// 负责：
// 1. 初始化/加载持久化快照
// 2. 接收来自内容脚本的状态变更请求（手动标记 / 首测作答）
// 3. 合并变更、持久化并广播到所有标签页
// 不得加载完整词典、参与单词查询或 DOM 操作。
// ============================================================

import type {
  VocabSnapshot,
  WordState,
  WordStatus,
  InitialTestPlan,
  InitialTestState,
  QuizAnswer,
} from '../shared/types';
import {
  createEmptySnapshot,
  mergeStateChange,
  getWords,
  generateInstallSeed,
  addAuditMarker,
  setInitialTest,
} from './storage';
import { applyAnswer, INITIAL_TEST_LENGTH } from '../strategy/quiz';

const STORAGE_KEY = 'avr_vocab_snapshot';
// 固定 1,000 词 ECDICT 产物的 dict-core.json SHA-256 前缀；Service Worker 不读取词典。
const DICTIONARY_VERSION = 'ecdict-core-1000-64eb1a402f909f7a';

let currentSnapshot: VocabSnapshot | null = null;

/**
 * 从 chrome.storage.local 加载快照。
 * 首次安装时创建空快照。
 */
async function loadSnapshot(): Promise<VocabSnapshot> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY];

  if (stored && stored.schemaVersion) {
    return stored as VocabSnapshot;
  }

  // 首次运行：创建初始快照
  const seed = generateInstallSeed();
  const snapshot = createEmptySnapshot(seed, DICTIONARY_VERSION);
  await chrome.storage.local.set({ [STORAGE_KEY]: snapshot });
  return snapshot;
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
  | { type: 'INITIAL_TEST_ANSWER'; questionIndex: number; answer: QuizAnswer }
  | { type: 'INITIAL_TEST_RESET' };

// ============================================================
// 消息处理
// ============================================================

chrome.runtime.onMessage.addListener((message: WorkerMessage, _sender, sendResponse) => {
  (async () => {
    if (!currentSnapshot) {
      currentSnapshot = await loadSnapshot();
    }

    switch (message.type) {
      case 'GET_STATE': {
        sendResponse({ words: getWords(currentSnapshot) });
        break;
      }

      case 'GET_PROFILE': {
        sendResponse({
          installSeed: currentSnapshot.installSeed,
          dictVersion: currentSnapshot.dictVersion,
        });
        break;
      }

      case 'STATE_CHANGE': {
        const { word, newStatus } = message;
        currentSnapshot = mergeStateChange(currentSnapshot, word, newStatus, 'manual');
        await persistSnapshot(currentSnapshot);
        await broadcastState(currentSnapshot, word, newStatus);
        sendResponse({ success: true });
        break;
      }

      case 'INITIAL_TEST_START': {
        const plan = message.plan;
        if (!plan || plan.questions.length !== INITIAL_TEST_LENGTH) {
          sendResponse({ error: 'invalid plan' });
          break;
        }
        const test: InitialTestState = {
          plan,
          answers: Array.from({ length: plan.questions.length }, () => null),
          completed: false,
        };
        currentSnapshot = setInitialTest(currentSnapshot, test);
        await persistSnapshot(currentSnapshot);
        sendResponse({ success: true });
        break;
      }

      case 'GET_INITIAL_TEST': {
        sendResponse({ test: currentSnapshot.initialTest });
        break;
      }

      case 'INITIAL_TEST_ANSWER': {
        const { questionIndex, answer } = message;
        const test = currentSnapshot.initialTest;

        if (!test || test.completed || test.answers[questionIndex] !== null) {
          sendResponse({ error: 'cannot answer' });
          break;
        }

        const current = currentSnapshot.words[test.plan.questions[questionIndex]!.word];
        const result = applyAnswer(test.plan, questionIndex, answer, current, currentSnapshot.schemaVersion);

        if (result.kind === 'priority-preserved' || result.change === null) {
          // 页面手动状态优先：不做任何状态变更，仅记录作答
          const answers = test.answers.slice();
          answers[questionIndex] = answer;
          currentSnapshot = setInitialTest(currentSnapshot, {
            plan: test.plan,
            answers,
            completed: answers.every((a) => a !== null),
          });
          await persistSnapshot(currentSnapshot);
          sendResponse({ result });
          break;
        }

        // 应用状态变更
        currentSnapshot = mergeStateChange(currentSnapshot, result.change.word, result.change.newStatus, 'initial');
        if (result.audit) {
          currentSnapshot = addAuditMarker(currentSnapshot, result.audit);
        }

        // 记录作答并判断是否完成
        const answers = test.answers.slice();
        answers[questionIndex] = answer;
        const completed = answers.every((a) => a !== null);
        currentSnapshot = setInitialTest(currentSnapshot, { plan: test.plan, answers, completed });
        await persistSnapshot(currentSnapshot);
        await broadcastState(currentSnapshot, result.change.word, result.change.newStatus);
        sendResponse({ result });
        break;
      }

      case 'INITIAL_TEST_RESET': {
        currentSnapshot = setInitialTest(currentSnapshot, null);
        await persistSnapshot(currentSnapshot);
        sendResponse({ success: true });
        break;
      }

      default:
        sendResponse({ error: 'unknown message type' });
    }
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
