// ============================================================
// 扩展弹窗 —— 首测（固定 50 题）的唯一入口
// ============================================================
// 弹窗是受信任的扩展上下文，可读取静态词典产物；它向策略模块请求冻结计划，
// 经消息协议交由 Service Worker 持久化与广播。弹窗不参与任何单词查询之外的
// 策略计算——冻结计划与原子状态变更由策略模块产出。弹窗不直连 strategy/quiz.ts
// 或 strategy/audit.ts，只消费 `strategy/index.ts` 的深 Module Interface。
// ============================================================

import type {
  DictCore,
  FormsMap,
  FrequencyBands,
  InitialTestPlan,
  InitialTestState,
  QuizAnswer,
  QuizQuestion,
  AssessmentEvidence,
  DailyTestState,
} from './shared/types';
import {
  createVocabStrategy,
  estimateVocabulary,
  collectBandEvidence,
  countBandWords,
} from './strategy/index';
import type { VocabStrategy } from './shared/types';
import type { VocabularyEstimateResult } from './strategy/index';
import { loadDictionaryFromJSON, type Dictionary } from './content/dictionary';
import { selectNotebookEntries } from './popupNotebook';

interface Profile {
  installSeed: string;
  dictVersion: string;
}

// ============================================================
// 基础设施
// ============================================================

/** 类型安全的消息发送（Promise 化 chrome.runtime.sendMessage） */
function sendMessage<T>(msg: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (resp: T) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(resp);
      }
    });
  });
}

/** 轻量 DOM 构造助手 */
function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** 加载静态词典产物（与内容脚本相同来源） */
async function loadDict(): Promise<{ core: DictCore; forms: FormsMap; bands: FrequencyBands; queryDictionary: Dictionary }> {
  const [coreJSON, formsJSON, bandsJSON, queryJSON, queryFormsJSON] = await Promise.all([
    fetch(chrome.runtime.getURL('data/dict-core.json')).then((r) => r.text()),
    fetch(chrome.runtime.getURL('data/forms.json')).then((r) => r.text()),
    fetch(chrome.runtime.getURL('data/frequency-bands.json')).then((r) => r.text()),
    fetch(chrome.runtime.getURL('data/query-dictionary.json')).then((r) => r.text()),
    fetch(chrome.runtime.getURL('data/query-forms.json')).then((r) => r.text()),
  ]);

  const rawCore: Record<string, [string, string, string]> = JSON.parse(coreJSON);
  const core: DictCore = {};
  for (const [word, arr] of Object.entries(rawCore)) {
    core[word] = { phonetic: arr[0]!, pos: arr[1]!, translation: arr[2]! };
  }
  const forms: FormsMap = JSON.parse(formsJSON);
  const bands: FrequencyBands = JSON.parse(bandsJSON);
  return { core, forms, bands, queryDictionary: loadDictionaryFromJSON(queryJSON, queryFormsJSON) };
}

// ============================================================
// 主流程
// ============================================================

async function main(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) return;

  const strategy: VocabStrategy = createVocabStrategy();
  const [{ core, forms, bands, queryDictionary }, profile, initialTest, dailyState, initialWords] = await Promise.all([
    loadDict(),
    sendMessage<Profile>({ type: 'GET_PROFILE' }),
    sendMessage<{ test: InitialTestState | null }>({ type: 'GET_INITIAL_TEST' }).then((r) => r.test),
    sendMessage<{ test: DailyTestState | null; completedRoundIndex: number }>({ type: 'GET_DAILY_TEST' }),
    sendMessage<{ words: Record<string, { status: 'known' | 'learning'; updatedAt: number }> }>({ type: 'GET_STATE' }).then((r) => r.words),
  ]);

  let test: InitialTestState | null = initialTest ?? null;
  let daily: DailyTestState | null = dailyState.test;
  let dailyCompletedRoundIndex = dailyState.completedRoundIndex;
  let words = initialWords;
  let activeTab: 'main' | 'notebook' = 'main';
  /** 当前是否处于每日答题视图（进行中且未跳过）；其余视图由首测状态决定。 */
  let dailyView = false;

  /** 本地日期（YYYY-MM-DD）；date seam 的最小生产来源，不建设时间服务。 */
  function todayLocalDate(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function render(): void {
    app!.innerHTML = '';
    renderTabs();
    if (activeTab === 'notebook') {
      renderNotebook();
      return;
    }
    if (dailyView && daily && !daily.completed && !daily.skipped) {
      renderDailyQuestions();
      return;
    }
    dailyView = false;
    if (!test) {
      renderStart();
    } else if (test.completed) {
      renderSummary();
    } else {
      renderQuestions();
    }
  }

  function renderTabs(): void {
    const tabs = el('div', 'popup-tabs');
    const mainTab = el('button', activeTab === 'main' ? 'popup-tab active' : 'popup-tab', '测评') as HTMLButtonElement;
    mainTab.type = 'button';
    mainTab.onclick = () => {
      activeTab = 'main';
      render();
    };
    const notebookTab = el('button', activeTab === 'notebook' ? 'popup-tab notebook-tab active' : 'popup-tab notebook-tab', '生词本') as HTMLButtonElement;
    notebookTab.type = 'button';
    notebookTab.onclick = async () => {
      words = (await sendMessage<{ words: typeof words }>({ type: 'GET_STATE' })).words;
      activeTab = 'notebook';
      render();
    };
    tabs.append(mainTab, notebookTab);
    app!.append(tabs);
  }

  /** 生词本只消费 WordState；查询词典无法解析的历史 key 保留在 storage 但不展示。 */
  function renderNotebook(): void {
    const screen = el('div', 'screen notebook');
    screen.append(el('h1', 'title', '生词本'));
    const learningWords = selectNotebookEntries(words, queryDictionary);
    if (learningWords.length === 0) {
      screen.append(el('p', 'notebook-empty', '暂无生词。'));
      app!.append(screen);
      return;
    }

    const list = el('div', 'notebook-list');
    for (const entry of learningWords) {
      const row = el('div', 'notebook-row');
      row.dataset.word = entry.word;
      row.append(
        el('div', 'notebook-word', entry.word),
        el('div', 'notebook-phonetic', entry.phonetic),
        el('div', 'notebook-pos', entry.pos),
        el('div', 'notebook-translation', entry.translation),
      );
      const known = el('button', 'notebook-known', '已掌握') as HTMLButtonElement;
      known.type = 'button';
      known.onclick = () => void markNotebookWordKnown(entry.word);
      row.append(known);
      list.append(row);
    }
    screen.append(list);
    app!.append(screen);
  }

  async function markNotebookWordKnown(word: string): Promise<void> {
    await sendMessage({ type: 'STATE_CHANGE', word, newStatus: 'known' });
    // worker 是状态真相源：成功与拒绝均重新读取，避免 popup 自行臆断。
    words = (await sendMessage<{ words: typeof words }>({ type: 'GET_STATE' })).words;
    render();
  }

  // ============================================================
  // 首测：冻结计划 + 结算单题（经策略 Module）
  // ============================================================

  function renderStart(): void {
    const screen = el('div', 'screen');
    screen.append(
      el('h1', 'title', '首次词汇测评'),
      el(
        'p',
        'desc',
        '50 道题，覆盖十个词频段。请为英文单词选择正确中文释义；猜不出就选「不确定」。结果会立即影响已打开页面的提示。',
      ),
    );
    const btn = el('button', 'primary', '开始测评') as HTMLButtonElement;
    btn.onclick = async () => {
      btn.disabled = true;
      const plan: InitialTestPlan = strategy.freezeInitialTestPlan({
        core,
        forms,
        bands,
        seed: profile.installSeed,
        dictVersion: profile.dictVersion,
      });
      await sendMessage({ type: 'INITIAL_TEST_START', plan });
      test = {
        plan,
        answers: Array.from({ length: plan.questions.length }, () => null),
        completed: false,
      };
      render();
    };
    screen.append(btn);
    app!.append(screen);
  }

  function renderQuestions(): void {
    if (!test) return;
    const header = el('div', 'test-header');
    const answered = test.answers.filter((a) => a !== null).length;
    header.append(el('h1', 'title', `测评中 ${answered} / ${test.plan.questions.length}`));
    app!.append(header);

    const list = el('div', 'questions');
    test.plan.questions.forEach((q, i) => {
      list.append(renderQuestion(q, i, test!.answers[i] !== null, submit));
    });
    app!.append(list);
  }

  function renderQuestion(
    q: QuizQuestion,
    index: number,
    answered: boolean,
    onSubmit: (index: number, answer: QuizAnswer) => void,
  ): HTMLElement {
    const card = el('div', 'question');
    if (answered) card.classList.add('answered');
    card.append(el('div', 'q-word', q.word));

    const opts = el('div', 'options');
    q.options.forEach((opt, oi) => {
      const b = el('button', 'option', opt.translation) as HTMLButtonElement;
      if (answered) b.disabled = true;
      b.onclick = () => onSubmit(index, { kind: 'option', optionIndex: oi });
      opts.append(b);
    });
    const unsure = el('button', 'option unsure', '不确定') as HTMLButtonElement;
    if (answered) unsure.disabled = true;
    unsure.onclick = () => onSubmit(index, { kind: 'unsure' });
    opts.append(unsure);

    card.append(opts);
    return card;
  }

  async function submit(index: number, answer: QuizAnswer): Promise<void> {
    if (!test) return;
    await sendMessage({ type: 'INITIAL_TEST_ANSWER', questionIndex: index, answer });
    const answers = test.answers.slice();
    answers[index] = answer;
    test = { ...test, answers, completed: answers.every((a) => a !== null) };
    render();
  }

  function renderSummary(): void {
    if (!test) return;

    let correct = 0;
    let wrong = 0;
    let unsure = 0;
    test.plan.questions.forEach((q, i) => {
      const a = test!.answers[i] ?? null;
      if (!a) return;
      if (a.kind === 'unsure') unsure++;
      else if (a.optionIndex === q.correctOptionIndex) correct++;
      else wrong++;
    });

    const screen = el('div', 'screen summary');
    screen.append(el('h1', 'title', '首测完成'));

    const stats = el('div', 'stat-row');
    stats.append(
      statBlock('correct', String(correct), '答对'),
      statBlock('wrong', String(wrong), '答错'),
      statBlock('unsure', String(unsure), '不确定'),
    );
    screen.append(stats);

    // 词汇量估计：只读取 AssessmentEvidence（RULES 双真相源）。
    // 展示为异步：结果页打开时向 worker 请求最新证据，再计算点值/保守范围。
    void renderEstimate(screen, strategy, core, bands);

    // 每日校准入口：仅首测完成后出现（R-DLY-5）。
    renderDailySection(screen);

    screen.append(
      el('p', 'desc', '答对的词已停止提示；答错或「不确定」的词会进入生词表并在阅读中强提示。打开任意英文网页即可看到效果。'),
    );

    const reset = el('button', 'primary', '重新测评') as HTMLButtonElement;
    reset.onclick = async () => {
      await sendMessage({ type: 'INITIAL_TEST_RESET' });
      test = null;
      render();
    };
    screen.append(reset);

    app!.append(screen);
  }

  /**
   * 结果页估计区块：R-EST-1（点值 + 保守范围 + 不外推声明）与 unavailable 行为。
   * 只读取 AssessmentEvidence；manual 标记不进入估计（R-EST-2）。
   */
  async function renderEstimate(
    screen: HTMLElement,
    _strat: VocabStrategy,
    dict: DictCore,
    bandMap: FrequencyBands,
  ): Promise<void> {
    const block = el('div', 'estimate');

    let estimate: VocabularyEstimateResult;
    try {
      const { evidence } = await sendMessage<{ evidence: Record<string, AssessmentEvidence> }>({
        type: 'GET_ASSESSMENT_EVIDENCE',
      });
      const bandStats = collectBandEvidence(evidence, bandMap);
      const bandWordCounts = countBandWords(bandMap);
      estimate = estimateVocabulary({
        initialTestCompleted: true,
        bands: Object.entries(bandWordCounts).map(([band, bandWordCount]) => ({
          knownCount: bandStats[Number(band)]?.knownCount ?? 0,
          testedCount: bandStats[Number(band)]?.testedCount ?? 0,
          bandWordCount,
        })),
        wordPackSize: Object.keys(dict).length,
      });
    } catch {
      // 证据获取失败：保守降级为 unavailable，不显示 0/NaN/部分估计。
      estimate = { status: 'unavailable' };
    }

    if (estimate.status === 'available') {
      const pointEl = el('div', 'estimate-point', `你大概认识 ${estimate.point} 个词`);
      const rangeEl = el('div', 'estimate-range', `保守范围 ${estimate.low}–${estimate.high}`);
      const noteEl = el('p', 'estimate-note', `基于当前 ${Object.keys(dict).length.toLocaleString('en-US')} 词覆盖估计，不做外推`);
      block.append(pointEl, rangeEl, noteEl);
    } else {
      block.append(el('p', 'estimate-unavailable', '完成或重新完成首测后可查看估计'));
    }

    screen.append(block);
  }

  /**
   * 每日校准区块（R-DLY-5~9）。仅首测完成后渲染；无计划/跨日过期 → 开始入口；
   * 同日进行中 → 暂停恢复同一冻结计划；首题前已跳过 → 次级「今天仍可开始」（反悔复用计划）；
   * 已完成 → 只读提示。跨日过期时旧轮已答证据保留、未答零变化、不回滚、不递增轮次。
   */
  function renderDailySection(screen: HTMLElement): void {
    if (!test?.completed) return; // R-DLY-5：首测未完成绝不显示每日入口
    const today = todayLocalDate();
    const block = el('div', 'daily');
    block.append(el('h2', 'daily-title', '每日校准'));

    if (!daily || daily.localDate !== today) {
      // 仅「未完成」的旧日期轮次显示跨日过期提示（R-DLY-8）；已完成轮直接提供今日入口。
      if (daily && daily.localDate !== today && !daily.completed) {
        block.append(el('p', 'daily-expired', '昨日未完成的计划已过期，已答结果已保留。'));
      }
      const start = el('button', 'primary daily-start', '开始今日五题') as HTMLButtonElement;
      start.onclick = () => void startDaily();
      block.append(start);
    } else if (daily.completed) {
      block.append(el('p', 'daily-complete', '今日五题已完成。'));
    } else if (daily.skipped) {
      // 跳过后不突出主入口，保留次级入口（R-DLY-6）
      const secondary = el('button', 'daily-secondary', '今天仍可开始') as HTMLButtonElement;
      secondary.onclick = () => void resumeDaily();
      block.append(secondary);
    } else {
      const answered = daily.answers.filter((a) => a !== null).length;
      block.append(
        el('p', 'daily-progress', `进行中 ${answered} / ${daily.questions.length}；同日关闭可继续同一计划。`),
      );
      const resume = el('button', 'primary daily-resume', '继续') as HTMLButtonElement;
      resume.onclick = () => {
        dailyView = true;
        render();
      };
      block.append(resume);
    }
    screen.append(block);
  }

  /** 重新拉取每日状态（worker 拒绝过期写入后刷新本地视图，回到结果页显示过期）。 */
  async function refreshDaily(): Promise<void> {
    const state = await sendMessage<{ test: DailyTestState | null; completedRoundIndex: number }>({
      type: 'GET_DAILY_TEST',
    });
    daily = state.test;
    dailyCompletedRoundIndex = state.completedRoundIndex;
  }

  /** 冻结并开始今日计划（首测完成后、无活跃轮或跨日过期时调用）。 */
  async function startDaily(): Promise<void> {
    const today = todayLocalDate();
    const { evidence } = await sendMessage<{ evidence: Record<string, AssessmentEvidence> }>({
      type: 'GET_ASSESSMENT_EVIDENCE',
    });
    const plan: DailyTestState = strategy.freezeDailyTest(
      {
        core,
        forms,
        bands,
        seed: profile.installSeed,
        dictVersion: profile.dictVersion,
        completedRoundIndex: dailyCompletedRoundIndex,
        evidence,
      },
      today,
    );
    const resp = await sendMessage<{ test: DailyTestState; error?: string }>({ type: 'DAILY_TEST_START', test: plan });
    if (resp.error) {
      // 服务端拒绝（如跨日/首测未完成）：刷新真实状态并回到结果页展示。
      await refreshDaily();
      dailyView = false;
      render();
      return;
    }
    daily = resp.test;
    dailyView = true;
    render();
  }

  /** 反悔跳过：同日 DAILY_TEST_START → worker 置 skipped=false 并复用同一冻结计划（R-DLY-6）。 */
  async function resumeDaily(): Promise<void> {
    if (!daily) return;
    const resp = await sendMessage<{ test: DailyTestState; error?: string }>({ type: 'DAILY_TEST_START', test: daily });
    if (resp.error) {
      await refreshDaily();
      dailyView = false;
      render();
      return;
    }
    daily = resp.test;
    dailyView = true;
    render();
  }

  /** 每日答题视图：5 题 + 首题前的「今天跳过」入口（答第一题后入口消失，R-DLY-6）。 */
  function renderDailyQuestions(): void {
    if (!daily) return;
    const answered = daily.answers.filter((a) => a !== null).length;
    const header = el('div', 'test-header');
    header.append(el('h1', 'title', `今日校准 ${answered} / ${daily.questions.length}`));
    if (answered === 0) {
      const skip = el('button', 'daily-skip', '今天跳过') as HTMLButtonElement;
      skip.onclick = () => void skipDaily();
      header.append(skip);
    }
    app!.append(header);

    const list = el('div', 'questions');
    daily.questions.forEach((q, i) => {
      list.append(renderQuestion(q, i, daily!.answers[i] !== null, dailySubmit));
    });
    app!.append(list);
  }

  /** 每日作答：双写由 worker 完成；完成后回到结果页并刷新估计（R-DLY-4）。 */
  async function dailySubmit(index: number, answer: QuizAnswer): Promise<void> {
    if (!daily) return;
    const resp = await sendMessage<{ test: DailyTestState; completedRoundIndex: number; error?: string }>({
      type: 'DAILY_TEST_ANSWER',
      questionIndex: index,
      answer,
    });
    if (resp.error) {
      // 跨日边界：worker 拒绝过期写入 → 刷新真实状态并回到结果页显示过期（R-DLY-8）。
      await refreshDaily();
      dailyView = false;
      render();
      return;
    }
    daily = resp.test;
    dailyCompletedRoundIndex = resp.completedRoundIndex;
    render();
  }

  /** 首题前跳过：WordState 与 AssessmentEvidence 零变化（R-DLY-6）。 */
  async function skipDaily(): Promise<void> {
    const resp = await sendMessage<{ test: DailyTestState; error?: string }>({ type: 'DAILY_TEST_SKIP' });
    if (resp.error) {
      await refreshDaily();
      dailyView = false;
      render();
      return;
    }
    daily = resp.test;
    dailyView = false;
    render();
  }

  function statBlock(kind: string, num: string, label: string): HTMLElement {
    const block = el('div', `stat ${kind}`);
    block.append(el('div', 'num', num));
    block.append(el('div', 'label', label));
    return block;
  }

  render();
}

main().catch((err) => {
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = '';
    app.append(el('div', 'loading', `加载失败：${err instanceof Error ? err.message : String(err)}`));
  }
  console.error('[AVR] popup init failed', err);
});
