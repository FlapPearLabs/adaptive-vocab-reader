// ============================================================
// 首测（固定 50 题）出题与作答 —— 策略模块的测试 seam 之一
// ============================================================
// 所有随机性都由「安装种子 + 盐」确定性驱动：
//   同种子 + 同词典快照 → 完全相同的题目、选项顺序与计划版本；
//   作答前冻结计划，作答中不得因画像变化重算题目。
//
// 此为策略包的内部实现模块：弹窗、Service Worker、内容脚本、存储适配器
// 一律经 `strategy/index.ts` 的深 Module Interface 消费，不得直接 import 本文件。
// 调用方不得自行重算抽样顺序或选项排列。
// ============================================================

import type {
  DictCore,
  FormsMap,
  FrequencyBands,
  QuizAnswer,
  QuizOption,
  QuizQuestion,
  InitialTestPlan,
  WordState,
  AuditMarker,
  StateChange,
  ApplyAnswerResult,
  StatusFromCorrectness,
} from '../shared/types';

const BAND_COUNT = 10;
const QUESTIONS_PER_BAND = 5;
const TOTAL_QUESTIONS = BAND_COUNT * QUESTIONS_PER_BAND; // 50
const DISTRACTOR_COUNT = 3; // 正确 + 3 干扰项 = 4 个中文选项
const UNSURE_INDEX = 4; // 「不确定」恒为第 5 个选项（独立于四个中文选项）

// ============================================================
// 确定性伪随机数（xmur3 哈希种子 + mulberry32）
// ============================================================

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 由「安装种子 + 盐」派生一个确定性 PRNG（返回 [0,1)）。
 * 同一 (seed, salt) 永远得到同一序列。
 */
export function createRng(seed: string, salt: string): () => number {
  const seedFn = xmur3(`${seed}::${salt}`);
  return mulberry32(seedFn());
}

/** Fisher–Yates 洗牌（不修改入参），使用给定 PRNG */
function shuffle<T>(input: readonly T[], rng: () => number): T[] {
  const arr = input.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

// ============================================================
// 候选池：仅淘汰无法生成四个互异中文选项的词
// ============================================================
// 词形映射不传播状态（core 主词条优先）：lookup 始终以 surface form 作为状态键，
// 因此「could」与「can」是各自独立的主词条，都可进入首测候选，互不遮蔽。
// 故此处不再排除任何 core 主词条（旧 isShadowedCoreKey 方案通过排除 13 个合法
// core 主词条来掩盖状态模型错误，已删除）。

/**
 * 计算候选池：仅保留「能生成四个互异中文选项」的主词条。
 * 一个词合格当且仅当：词典中存在至少 3 个与它自身翻译不同的其他翻译
 * （全局互异翻译数 ≥ 4）。任何 core 主词条（含自身也是词形映射键的，如 could）
 * 都不应被排除——它们的状态键是自身 surface form，互不干扰。
 */
export function eligibleCandidates(core: DictCore, _forms: FormsMap): string[] {
  const distinctTranslations = new Set<string>();
  for (const entry of Object.values(core)) {
    distinctTranslations.add(entry.translation);
  }

  return Object.keys(core).filter((word) => {
    const own = core[word]!.translation;
    let others = 0;
    for (const t of distinctTranslations) {
      if (t !== own) others++;
    }
    return others >= DISTRACTOR_COUNT;
  });
}

// ============================================================
// 构建单题
// ============================================================

export function buildQuestion(
  word: string,
  core: DictCore,
  bands: FrequencyBands,
  seed: string,
  index: number,
): QuizQuestion {
  const entry = core[word]!;
  const band = bands[word] ?? BAND_COUNT - 1;
  const correct = entry.translation;

  // 干扰项候选：所有与该词翻译不同的互异翻译
  const otherTranslations = new Set<string>();
  for (const e of Object.values(core)) {
    if (e.translation !== correct) otherTranslations.add(e.translation);
  }
  const distractors = shuffle([...otherTranslations], createRng(seed, `distractors:${word}`))
    .slice(0, DISTRACTOR_COUNT)
    .map((translation): QuizOption => ({ translation, isCorrect: false }));

  const fourOptions: QuizOption[] = [
    { translation: correct, isCorrect: true },
    ...distractors,
  ];

  // 四个中文选项的顺序由种子确定性排列
  const ordered = shuffle(fourOptions, createRng(seed, `options:${word}`));
  const correctOptionIndex = ordered.findIndex((o) => o.isCorrect);

  return {
    word,
    band,
    options: ordered,
    correctOptionIndex,
    unsureIndex: UNSURE_INDEX,
  };
}

/** 确定性哈希（FNV-1a），用于计划版本 */
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * 由任意字符串派生一个确定性 32 位无符号整数。
 * 供审计候选等在「安装种子 + 稳定输入」下做可复现的稳定排序使用。
 */
export function hashString(str: string): number {
  const seedFn = xmur3(str);
  return seedFn();
}

// ============================================================
// 构建冻结的首测计划
// ============================================================

/**
 * 构建固定 50 题首测计划：十频段各五题。
 * 题目、正确选项、干扰项与四个选项的顺序在调用时冻结；
 * 返回的计划对象本身不含时间戳，因此同 (seed, dict) 完全可复现。
 */
export function buildInitialTestPlan(
  core: DictCore,
  forms: FormsMap,
  bands: FrequencyBands,
  seed: string,
  dictVersion: string,
): InitialTestPlan {
  const eligible = eligibleCandidates(core, forms);

  // 按频段分组
  const byBand: string[][] = Array.from({ length: BAND_COUNT }, () => []);
  for (const word of eligible) {
    const band = bands[word] ?? BAND_COUNT - 1;
    byBand[band]!.push(word);
  }

  const questions: QuizQuestion[] = [];
  for (let band = 0; band < BAND_COUNT; band++) {
    const pool = shuffle(byBand[band]!, createRng(seed, `band:${band}`));
    const chosen = pool.slice(0, QUESTIONS_PER_BAND);
    chosen.forEach((word, i) => {
      questions.push(buildQuestion(word, core, bands, seed, band * QUESTIONS_PER_BAND + i));
    });
  }

  // 计划版本：词典版本 + 种子 + 题目内容哈希（确定性）
  const questionsHash = fnv1a(JSON.stringify(questions.map((q) => [q.word, q.options, q.correctOptionIndex])));
  const version = `${dictVersion}:${seed}:${questionsHash}`;

  return {
    version,
    seed,
    dictVersion,
    questions,
  };
}

// ============================================================
// 作答状态迁移
// ============================================================

/** 由「是否答对」在类型层映射结果状态（条件类型应用） */
export function statusFromCorrectness<C extends boolean>(correct: C): StatusFromCorrectness<C> {
  return (correct ? 'known' : 'learning') as StatusFromCorrectness<C>;
}

/** 判断某作答是否答对 */
export function isAnswerCorrect(question: QuizQuestion, answer: QuizAnswer): boolean {
  return answer.kind === 'option' && answer.optionIndex === question.correctOptionIndex;
}

/**
 * 应用一道题的作答，返回判别联合结果。
 *
 * 规则（规格第 4 节 / Issue #2 产品合同）：
 * - 答对         → known + 单次答对待审计标记（盖当前快照状态版本）
 * - 答错 / 不确定 → learning（进入活跃生词表），并清除该词上一轮的待审计标记
 * - 页面手动状态优先：若当前状态来自手动标记，则保留手动状态，不产生任何变更
 *
 * 审计标记绑定到 `plan.version`（首测计划版本）与 `stateVersion`（快照状态版本），
 * 后者由调用方经 SettleInitialTestInput 传入，使重复相同 plan.version 重测时
 * worker 仍能据 stateVersion 清除上一轮的陈旧标记。
 *
 * @param plan 冻结的首测计划
 * @param questionIndex 题号
 * @param answer 用户作答
 * @param current 该词当前状态（可能 undefined = 未知）
 * @param stateVersion 当前快照状态版本（盖到新建审计标记）
 */
export function applyAnswer(
  plan: InitialTestPlan,
  questionIndex: number,
  answer: QuizAnswer,
  current: WordState | undefined,
  stateVersion: number,
): ApplyAnswerResult {
  const question = plan.questions[questionIndex]!;

  // 页面手动状态优先：手动标记高于首测结果
  if (current && current.source === 'manual') {
    return { kind: 'priority-preserved', change: null, audit: null, clearMarkerWord: question.word };
  }

  const correct = isAnswerCorrect(question, answer);
  const status = statusFromCorrectness(correct); // 'known' | 'learning'
  const change: StateChange<'initial'> = {
    word: question.word,
    newStatus: status,
    source: 'initial',
  };

  if (answer.kind === 'unsure' || !correct) {
    return {
      kind: answer.kind === 'unsure' ? 'unsure' : 'wrong',
      change,
      audit: null,
      clearMarkerWord: question.word,
    };
  }

  // 答对：创建单次答对待审计标记，绑定首测计划版本 + 快照状态版本
  const audit: AuditMarker = {
    word: question.word,
    source: 'initial-correct',
    planVersion: plan.version,
    stateVersion,
    createdAt: Date.now(),
    pending: true,
  };
  return { kind: 'correct', change, audit, clearMarkerWord: null };
}
