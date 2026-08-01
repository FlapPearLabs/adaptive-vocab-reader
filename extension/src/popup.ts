// ============================================================
// 扩展弹窗 —— 首测（固定 50 题）与审计的唯一入口
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
} from './shared/types';
import { createVocabStrategy } from './strategy/index';
import type { VocabStrategy } from './shared/types';

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
async function loadDict(): Promise<{ core: DictCore; forms: FormsMap; bands: FrequencyBands }> {
  const [coreJSON, formsJSON, bandsJSON] = await Promise.all([
    fetch(chrome.runtime.getURL('data/dict-core.json')).then((r) => r.text()),
    fetch(chrome.runtime.getURL('data/forms.json')).then((r) => r.text()),
    fetch(chrome.runtime.getURL('data/frequency-bands.json')).then((r) => r.text()),
  ]);

  const rawCore: Record<string, [string, string, string]> = JSON.parse(coreJSON);
  const core: DictCore = {};
  for (const [word, arr] of Object.entries(rawCore)) {
    core[word] = { phonetic: arr[0]!, pos: arr[1]!, translation: arr[2]! };
  }
  const forms: FormsMap = JSON.parse(formsJSON);
  const bands: FrequencyBands = JSON.parse(bandsJSON);
  return { core, forms, bands };
}

// ============================================================
// 主流程
// ============================================================

async function main(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) return;

  const strategy: VocabStrategy = createVocabStrategy();
  const [{ core, forms, bands }, profile, initialTest] = await Promise.all([
    loadDict(),
    sendMessage<Profile>({ type: 'GET_PROFILE' }),
    sendMessage<{ test: InitialTestState | null }>({ type: 'GET_INITIAL_TEST' }).then((r) => r.test),
  ]);

  let test: InitialTestState | null = initialTest ?? null;

  function render(): void {
    app!.innerHTML = '';
    if (!test) {
      renderStart();
    } else if (test.completed) {
      renderSummary();
    } else {
      renderQuestions();
    }
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
      list.append(renderQuestion(q, i, test!.answers[i] !== null));
    });
    app!.append(list);
  }

  function renderQuestion(
    q: QuizQuestion,
    index: number,
    answered: boolean,
  ): HTMLElement {
    const card = el('div', 'question');
    if (answered) card.classList.add('answered');
    card.append(el('div', 'q-word', q.word));

    const opts = el('div', 'options');
    q.options.forEach((opt, oi) => {
      const b = el('button', 'option', opt.translation) as HTMLButtonElement;
      if (answered) b.disabled = true;
      b.onclick = () => void submit(index, { kind: 'option', optionIndex: oi });
      opts.append(b);
    });
    const unsure = el('button', 'option unsure', '不确定') as HTMLButtonElement;
    if (answered) unsure.disabled = true;
    unsure.onclick = () => void submit(index, { kind: 'unsure' });
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
