import { describe, it, expect } from 'vitest';
import { auditPlanVersion } from './auditPlanVersion';
import type { AuditPlanCandidate, QuizQuestion } from './types';

function makeQuestions(translations: string[][]): QuizQuestion[] {
  return translations.map((ts, i) => ({
    word: `w${i}`,
    band: i % 10,
    options: ts.map((t, j) => ({ translation: t, isCorrect: j === 0 })),
    correctOptionIndex: 0,
    unsureIndex: 4,
  }));
}

function makeCandidates(words: string[]): AuditPlanCandidate[] {
  return words.map((w, i) => ({ word: w, bucket: 'initial-correct' as const, band: i % 10 }));
}

/** 由 [翻译, isCorrect] 对构造单道生产合法四选一题目（4 互异翻译、恰好 1 isCorrect、correctOptionIndex 与正确标记一致） */
function makeQuestionFromOpts(opts: Array<[string, boolean]>): QuizQuestion {
  return {
    word: 'w',
    band: 0,
    options: opts.map(([t, c]) => ({ translation: t, isCorrect: c })),
    correctOptionIndex: opts.findIndex(([, c]) => c),
    unsureIndex: 4,
  };
}

describe('auditPlanVersion —— 哈希必须覆盖选项翻译/isCorrect/顺序（题目内容防篡改）', () => {
  const seed = 'seed';
  const planVersion = 'pv';
  const candidates = makeCandidates(['a', 'b']);

  it('相同输入 → 相同哈希（确定性）', () => {
    const q = makeQuestions([['对', '错1', '错2', '错3'], ['对', '错1', '错2', '错3']]);
    expect(auditPlanVersion(seed, planVersion, candidates, q)).toBe(
      auditPlanVersion(seed, planVersion, candidates, q),
    );
  });

  it('仅替换选项翻译（保持 isCorrect 顺序不变）→ 哈希必须改变', () => {
    const q1 = makeQuestions([['对A', '错1', '错2', '错3'], ['对B', '错1', '错2', '错3']]);
    const q2 = makeQuestions([['对Z', '错1', '错2', '错3'], ['对Y', '错1', '错2', '错3']]);
    const h1 = auditPlanVersion(seed, planVersion, candidates, q1);
    const h2 = auditPlanVersion(seed, planVersion, candidates, q2);
    expect(h1).not.toBe(h2);
  });

  it('打乱选项顺序（isCorrect 跟随移动）→ 哈希必须改变', () => {
    // 原始：opt0 正确；颠倒后 opt3 正确，且翻译顺序不同
    const q1 = makeQuestions([['对', '错1', '错2', '错3']]);
    const q2 = makeQuestions([['错3', '错2', '错1', '对']]);
    const h1 = auditPlanVersion(seed, planVersion, candidates, q1);
    const h2 = auditPlanVersion(seed, planVersion, candidates, q2);
    expect(h1).not.toBe(h2);
  });

  it('候选 word/bucket/band 变化（题目内容不变）→ 哈希必须改变', () => {
    const q1 = makeQuestions([['对', '错1', '错2', '错3']]);
    const q2 = makeQuestions([['对', '错1', '错2', '错3']]);
    const c1 = makeCandidates(['a', 'b']);
    const c2 = makeCandidates(['a', 'c']);
    expect(auditPlanVersion(seed, planVersion, c1, q1)).not.toBe(
      auditPlanVersion(seed, planVersion, c2, q2),
    );
  });

  it('分隔符碰撞回归（生产合法四选一）：旧 delimiter 拼接相同、结构化不同的两组输入 → 新哈希必须不同', () => {
    const candidates: AuditPlanCandidate[] = [];

    // 复刻旧实现（未转义 `:` `,` `|` 拼接），用于在测试中证明碰撞确实存在。
    const oldPayload = (qs: QuizQuestion[]): string =>
      qs
        .map(
          (q) =>
            `${q.word}:${q.band}:${q.correctOptionIndex}:${q.unsureIndex}:` +
            q.options.map((o) => `${o.isCorrect ? '1' : '0'}:${o.translation}`).join(','),
        )
        .join('|');

    // 两组均为生产合法四选一题目（4 互异翻译、恰好 1 isCorrect、correctOptionIndex 与正确标记一致）。
    // 同一道单题，仅 option 的翻译文本不同；旧 delimiter 因未转义 `,` `:` 而使两段拼接串完全相同。
    // 输入 A：opt0 翻译内嵌 "0:b"，opt1 为 "c"
    const inputA: QuizQuestion[] = [
      makeQuestionFromOpts([
        ['a,0:b', true],
        ['c', false],
        ['x', false],
        ['y', false],
      ]),
    ];
    // 输入 B：opt0 为 "a"（正确），opt1 翻译内嵌 "0:c"
    const inputB: QuizQuestion[] = [
      makeQuestionFromOpts([
        ['a', true],
        ['b,0:c', false],
        ['x', false],
        ['y', false],
      ]),
    ];

    // 旧 delimiter 拼接结果完全相同（碰撞成立）：
    //   A = "w:0:0:4:1:a,0:b,0:c,0:x,0:y"
    //   B = "w:0:0:4:1:a,0:b,0:c,0:x,0:y"
    expect(oldPayload(inputA)).toBe(oldPayload(inputB));

    // 新结构化序列化：两组结构化输入不同（翻译不同但旧拼接串相同）→ 完整性哈希必须不同
    const vA = auditPlanVersion(seed, planVersion, candidates, inputA);
    const vB = auditPlanVersion(seed, planVersion, candidates, inputB);
    expect(vA).not.toBe(vB);
  });

  it('仅移动 isCorrect 标记并同步 correctOptionIndex（翻译不变）→ 哈希必须改变', () => {
    // 四个翻译文本与顺序完全不变，只有「正确」标记的归属在选项间移动（opt0 → opt1）。
    const q1 = makeQuestionFromOpts([
      ['t0', true],
      ['t1', false],
      ['t2', false],
      ['t3', false],
    ]);
    const q2 = makeQuestionFromOpts([
      ['t0', false],
      ['t1', true],
      ['t2', false],
      ['t3', false],
    ]);
    // 翻译集合与顺序完全相同——未用「改变翻译顺序」替代「移动正确标记」
    expect(q1.options.map((o) => o.translation)).toEqual(q2.options.map((o) => o.translation));
    expect(q1.correctOptionIndex).toBe(0);
    expect(q2.correctOptionIndex).toBe(1);

    const h1 = auditPlanVersion(seed, planVersion, candidates, [q1]);
    const h2 = auditPlanVersion(seed, planVersion, candidates, [q2]);
    expect(h1).not.toBe(h2);
  });
});
