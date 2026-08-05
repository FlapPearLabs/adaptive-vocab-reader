// ============================================================
// 内容脚本入口
// ============================================================
// 负责页面扫描、词典查询、策略调用、DOM 标注和交互
// 不直接读写 chrome.storage.local —— 通过消息与 Service Worker 通信
//
// 核心规则（规格第 4 节）：
// - 状态变更后只更新受影响的命中词，不做全页重扫
// - 增量处理动态插入的正文，避免重复扫描已处理节点
// ============================================================

import type { WordState } from '../shared/types';
import { createDictionary, Dictionary } from './dictionary';
import { initAnnotator } from './annotator';
import { createPageScanner, type PageScanner } from './pageScanner';

// ============================================================
// 全局状态
// ============================================================

let dictionary: Dictionary | null = null;
let scanner: PageScanner | null = null;

// ============================================================
// 初始化
// ============================================================

async function loadDictionary(): Promise<Dictionary> {
  const [coreJSON, formsJSON, bandsJSON] = await Promise.all([
    fetch(chrome.runtime.getURL('data/dict-core.json')).then((r) => r.text()),
    fetch(chrome.runtime.getURL('data/forms.json')).then((r) => r.text()),
    fetch(chrome.runtime.getURL('data/frequency-bands.json')).then((r) => r.text()),
  ]);

  // 手动转换 JSON 数组格式为 DictEntry
  const rawCore: Record<string, [string, string, string]> = JSON.parse(coreJSON);
  const core: Record<string, { phonetic: string; pos: string; translation: string }> = {};
  for (const [word, arr] of Object.entries(rawCore)) {
    core[word] = { phonetic: arr[0]!, pos: arr[1]!, translation: arr[2]! };
  }
  const forms: Record<string, string> = JSON.parse(formsJSON);
  const bands: Record<string, number> = JSON.parse(bandsJSON);

  return createDictionary(core, forms, bands);
}

async function loadState(): Promise<Record<string, WordState>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
      resolve(response?.words || {});
    });
  });
}

function saveStateChange(word: string, newStatus: WordState['status']): void {
  chrome.runtime.sendMessage({
    type: 'STATE_CHANGE',
    word,
    newStatus,
  });
}

// ============================================================
// 启动
// ============================================================

async function main(): Promise<void> {
  initAnnotator();
  // 并行加载词典和状态
  const [dict, state] = await Promise.all([loadDictionary(), loadState()]);
  dictionary = dict;

  scanner = createPageScanner({
    dictionary: dict,
    getState: () => state,
    onUserAction: saveStateChange,
    // 非持久化性能观测：写入 documentElement dataset（仅内存 DOM 属性，绝不进 storage；
    // 仅含耗时/计数数字，不含 URL/正文/句子）。供真实浏览器 E2E 读取真实基线。
    onPerfReport: (report) => {
      try {
        document.documentElement.dataset.avrPerf = JSON.stringify(report);
      } catch {
        // 忽略 DOM 写入异常（不阻塞扫描）
      }
    },
  });
  scanner.setState(state);

  // 扫描页面
  scanner.scanDocument(document.body);

  // 监听动态内容（增量处理，不重复扫描已处理节点）
  scanner.observeDynamic(document.body);
}

// 监听来自 Service Worker 的状态更新（其他标签页的变更广播）
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'STATE_UPDATED') {
    const { word, newStatus } = message;
    if (scanner && word && newStatus) {
      // 更新本地状态并增量更新该词显示
      scanner.applyRemoteChange(word, newStatus);
    } else if (scanner && message.words) {
      // 兼容旧格式（全量状态）：只更新内存，不重扫
      scanner.setState(message.words);
    }
  }
});

// 启动
main().catch(console.error);
