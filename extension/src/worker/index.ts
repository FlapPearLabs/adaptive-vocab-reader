// ============================================================
// Service Worker —— 本地画像协调器
// ============================================================
// 负责：
// 1. 初始化/加载持久化快照
// 2. 接收来自内容脚本的状态变更请求
// 3. 合并变更、持久化并广播到所有标签页
// 不得加载完整词典、参与单词查询或 DOM 操作。
// ============================================================

import type { VocabSnapshot } from '../shared/types';
import { createEmptySnapshot, mergeStateChange, getWords, generateInstallSeed } from './storage';

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
 * 广播状态更新到所有标签页
 */
async function broadcastState(snapshot: VocabSnapshot): Promise<void> {
  const words = getWords(snapshot);
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'STATE_UPDATED', words }).catch(() => {
        // 标签页可能尚未注入内容脚本，忽略
      });
    }
  }
}

// ============================================================
// 消息处理
// ============================================================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (!currentSnapshot) {
      currentSnapshot = await loadSnapshot();
    }

    switch (message.type) {
      case 'GET_STATE': {
        const words = getWords(currentSnapshot);
        sendResponse({ words });
        break;
      }

      case 'STATE_CHANGE': {
        const { word, newStatus } = message;
        currentSnapshot = mergeStateChange(currentSnapshot, word, newStatus);
        await persistSnapshot(currentSnapshot);
        await broadcastState(currentSnapshot);

        // 返回确认
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
