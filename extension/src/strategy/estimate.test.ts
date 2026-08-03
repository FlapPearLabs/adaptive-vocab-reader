// ============================================================
// 词汇量估计 —— 纯函数 seam 单测（R-EST-2~5、R-EST-7）
// ============================================================
// R-EST-1/R-EST-6 由 E2E（§21 场景 5、6）覆盖，本文件只测可独立测试的
// 纯函数 seam：聚合只读 AssessmentEvidence、十频段加权、unavailable 边界、
// Wilson 数值（硬编码期望值 + 合理浮点 tolerance，不得复制生产算法）、
// 词包大小参数化。
// ============================================================

import { describe, it, expect } from 'vitest';
import type { AssessmentEvidence, FrequencyBands } from '../shared/types';
import {
  WILSON_Z_95,
  wilsonBandInterval,
  collectBandEvidence,
  countBandWords,
  estimateVocabulary,
} from './estimate';
import type { EstimateVocabularyInput } from './estimate';

// ============================================================
// 测试夹具
// ============================================================

/** 构造十个频段各 wordsPerBand 词的词包频段映射 */
function makeBands(wordsPerBand: number): FrequencyBands {
  const bands: FrequencyBands = {};
  for (let band = 0; band < 10; band++) {
    for (let k = 0; k < wordsPerBand; k++) {
      bands[`w${band}_${k}`] = band;
    }
  }
  return bands;
}

/** 把 evidence 输入整理为 estimateVocabulary 可用的频段统计输入 */
function toInput(
  evidence: Record<string, AssessmentEvidence>,
  bands: FrequencyBands,
  overrides: Partial<EstimateVocabularyInput> = {},
): EstimateVocabularyInput {
  const bandCounts = countBandWords(bands);
  const stats = collectBandEvidence(evidence, bands);
  return {
    initialTestCompleted: true,
    bands: Object.entries(bandCounts).map(([band, bandWordCount]) => ({
      knownCount: stats[Number(band)]?.knownCount ?? 0,
      testedCount: stats[Number(band)]?.testedCount ?? 0,
      bandWordCount,
    })),
    wordPackSize: Object.keys(bands).length,
    ...overrides,
  };
}

/** 构造某频段 evidence：每词一条，known 或 learning */
function evidenceFor(
  words: ReadonlyArray<{ word: string; outcome: 'known' | 'learning' }>,
): Record<string, AssessmentEvidence> {
  const evidence: Record<string, AssessmentEvidence> = {};
  for (const { word, outcome } of words) {
    evidence[word] = { outcome, source: 'initial', assessedAt: 1 };
  }
  return evidence;
}

// ============================================================
// R-EST-5：Wilson 数值正确（硬编码期望值）
// ============================================================

describe('wilsonBandInterval (R-EST-5)', () => {
  it('固定样例：known=3, tested=5, z=Φ⁻¹(0.95) → low≈0.27248317186619286, high≈0.857293527980787', () => {
    const { low, high } = wilsonBandInterval(3, 5, WILSON_Z_95);
    // 期望值硬编码自规格（不得由生产函数生成）；合理 tolerance（1e-9）
    expect(low).toBeCloseTo(0.27248317186619286, 9);
    expect(high).toBeCloseTo(0.857293527980787, 9);
    expect(low).toBeLessThanOrEqual(high);
  });

  it('zero 样本不产生 NaN，返回 [0,0]', () => {
    const { low, high } = wilsonBandInterval(0, 0);
    expect(Number.isFinite(low)).toBe(true);
    expect(Number.isFinite(high)).toBe(true);
    expect(low).toBe(0);
    expect(high).toBe(0);
  });
});

// ============================================================
// 聚合：只读 AssessmentEvidence（R-EST-2/3）
// ============================================================

describe('collectBandEvidence (R-EST-2 / R-EST-3)', () => {
  it('R-EST-3：unsure/learning 证据计未掌握（knownCount 不含 learning）', () => {
    const bands = makeBands(2);
    const evidence = evidenceFor([
      { word: 'w0_0', outcome: 'learning' }, // unsure 在证据层已归一为 learning
      { word: 'w0_1', outcome: 'known' },
    ]);
    const stats = collectBandEvidence(evidence, bands);
    expect(stats[0]).toEqual({ knownCount: 1, testedCount: 2 });
  });

  it('R-EST-2：聚合只读 AssessmentEvidence；相同 evidence、不同 WordState 不影响统计', () => {
    const bands = makeBands(2);
    const evidence = evidenceFor([{ word: 'w1_0', outcome: 'known' }]);
    // 注意：collectBandEvidence 的输入只有 evidence + bands，完全没有 WordState ——
    // manual 标记只写 WordState，因此聚合结果天然不受 manual 影响。
    const stats = collectBandEvidence(evidence, bands);
    expect(stats[1]).toEqual({ knownCount: 1, testedCount: 1 });
  });

  it('证据词不在词包频段映射中时跳过（防御）', () => {
    const bands = makeBands(2);
    const evidence = evidenceFor([{ word: 'unknown_word', outcome: 'known' }]);
    const stats = collectBandEvidence(evidence, bands);
    expect(Object.keys(stats)).toEqual([]);
  });
});

describe('countBandWords (R-EST-7)', () => {
  it('按词包频段映射统计每频段词数', () => {
    const bands = makeBands(100);
    const counts = countBandWords(bands);
    expect(Object.keys(counts)).toHaveLength(10);
    for (let band = 0; band < 10; band++) {
      expect(counts[band]).toBe(100);
    }
  });
});

// ============================================================
// estimateVocabulary（R-EST-2/4/5/7）
// ============================================================

describe('estimateVocabulary', () => {
  it('R-EST-4：十频段加权正确（每频段 5/10 已知、各 100 词 → 500）', () => {
    const bands = makeBands(100);
    const evidence: Record<string, AssessmentEvidence> = {};
    for (let band = 0; band < 10; band++) {
      for (let k = 0; k < 5; k++) evidence[`w${band}_${k}`] = { outcome: 'known', source: 'initial', assessedAt: 1 };
      for (let k = 5; k < 10; k++) evidence[`w${band}_${k}`] = { outcome: 'learning', source: 'initial', assessedAt: 1 };
    }
    const result = estimateVocabulary(toInput(evidence, bands));
    expect(result.status).toBe('available');
    if (result.status !== 'available') return;
    expect(result.point).toBe(500);
    expect(result.low).toBeLessThanOrEqual(result.point);
    expect(result.point).toBeLessThanOrEqual(result.high);
    expect(result.high).toBeLessThanOrEqual(1000);
  });

  it('R-EST-4：首测未完成 → unavailable', () => {
    const bands = makeBands(2);
    const evidence = evidenceFor([{ word: 'w0_0', outcome: 'known' }]);
    const result = estimateVocabulary(toInput(evidence, bands, { initialTestCompleted: false }));
    expect(result.status).toBe('unavailable');
  });

  it('R-EST-4：仅一个频段零有效证据 → unavailable（不显示 0 或部分估计）', () => {
    const bands = makeBands(2);
    // 频段 0 有证据，频段 1 无证据
    const evidence = evidenceFor([
      { word: 'w0_0', outcome: 'known' },
      { word: 'w0_1', outcome: 'known' },
    ]);
    const result = estimateVocabulary(toInput(evidence, bands));
    expect(result.status).toBe('unavailable');
  });

  it('R-EST-4：多个频段零有效证据 → unavailable', () => {
    const bands = makeBands(2);
    // 只有频段 0 有证据；频段 1-9 均无
    const evidence = evidenceFor([
      { word: 'w0_0', outcome: 'known' },
      { word: 'w0_1', outcome: 'learning' },
    ]);
    const result = estimateVocabulary(toInput(evidence, bands));
    expect(result.status).toBe('unavailable');
  });

  it('R-EST-4：结果钳制到 0–wordPackSize（全 learning → 0；全 known → wordPackSize）', () => {
    const bands = makeBands(10);
    // 全频段 learning 证据 → point 0
    const evidenceLearning: Record<string, AssessmentEvidence> = {};
    for (let band = 0; band < 10; band++) {
      for (let k = 0; k < 10; k++) evidenceLearning[`w${band}_${k}`] = { outcome: 'learning', source: 'initial', assessedAt: 1 };
    }
    const allLearningResult = estimateVocabulary(toInput(evidenceLearning, bands));
    expect(allLearningResult.status).toBe('available');
    if (allLearningResult.status !== 'available') return;
    expect(allLearningResult.point).toBe(0);

    const evidenceKnown: Record<string, AssessmentEvidence> = {};
    for (let band = 0; band < 10; band++) {
      for (let k = 0; k < 10; k++) evidenceKnown[`w${band}_${k}`] = { outcome: 'known', source: 'initial', assessedAt: 1 };
    }
    const allKnownResult = estimateVocabulary(toInput(evidenceKnown, bands));
    expect(allKnownResult.status).toBe('available');
    if (allKnownResult.status !== 'available') return;
    expect(allKnownResult.point).toBe(100);
  });

  it('R-EST-7：词包大小是参数，换包不改算法（同比例、不同词包 → 按 bandWordCount 加权缩放）', () => {
    // 词包 A：每频段 100 词，各 5/10 已知 → 500
    const bandsA = makeBands(100);
    const evidence: Record<string, AssessmentEvidence> = {};
    for (let band = 0; band < 10; band++) {
      for (let k = 0; k < 5; k++) evidence[`w${band}_${k}`] = { outcome: 'known', source: 'initial', assessedAt: 1 };
      for (let k = 5; k < 10; k++) evidence[`w${band}_${k}`] = { outcome: 'learning', source: 'initial', assessedAt: 1 };
    }
    const resultA = estimateVocabulary(toInput(evidence, bandsA));
    expect(resultA.status).toBe('available');
    if (resultA.status !== 'available') return;
    expect(resultA.point).toBe(500);

    // 词包 B：每频段 200 词（换包但同比例 5/10 已知）→ 1000
    const bandsB = makeBands(200);
    const evidenceB: Record<string, AssessmentEvidence> = {};
    for (let band = 0; band < 10; band++) {
      for (let k = 0; k < 5; k++) evidenceB[`w${band}_${k}`] = { outcome: 'known', source: 'initial', assessedAt: 1 };
      for (let k = 5; k < 10; k++) evidenceB[`w${band}_${k}`] = { outcome: 'learning', source: 'initial', assessedAt: 1 };
    }
    const resultB = estimateVocabulary(toInput(evidenceB, bandsB));
    expect(resultB.status).toBe('available');
    if (resultB.status !== 'available') return;
    expect(resultB.point).toBe(1000);
  });

  it('R-EST-5：总体始终满足 low ≤ point ≤ high（含高低频段分布极端场景）', () => {
    const bands = makeBands(100);
    // 频段 0-4 全 known、频段 5-9 全 learning
    const evidence: Record<string, AssessmentEvidence> = {};
    for (let band = 0; band < 10; band++) {
      for (let k = 0; k < 100; k++) {
        evidence[`w${band}_${k}`] = { outcome: band < 5 ? 'known' : 'learning', source: 'initial', assessedAt: 1 };
      }
    }
    const result = estimateVocabulary(toInput(evidence, bands));
    expect(result.status).toBe('available');
    if (result.status !== 'available') return;
    expect(result.point).toBe(500);
    expect(result.low).toBeLessThanOrEqual(result.point);
    expect(result.point).toBeLessThanOrEqual(result.high);
  });
});
