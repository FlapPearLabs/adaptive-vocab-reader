// ============================================================
// 词汇量估计 —— 纯函数 seam（R-EST-1~7）
// ============================================================
// 估计只读取 AssessmentEvidence（RULES「词汇状态与测试证据（双真相源）」）；
// 不读取 WordState，manual 标记只影响提示，不进入估计分子或分母。
// 词包大小（wordPackSize）与每频段权重（bandWordCount）都是显式参数，
// 换包不改算法（R-EST-7）。
//
// 单点估计：round(Σ_band ((knownCount / testedCount) × bandWordCount))，
//   钳制到 0–wordPackSize。
// 保守范围：各频段双侧 90% Wilson（z = Φ⁻¹(0.95) ≈ 1.6448536269514722）
//   按 bandWordCount 加权求和，最终上下界四舍五入并钳制到 0–wordPackSize，
//   且保证 low ≤ point ≤ high。该范围仅用于显示（CR-03），不驱动任何自动行为。
//
// unavailable：首测未完成 / 任一频段没有有效测试证据 / 多个频段没有有效测试证据。
//   零样本频段不得按 0 掌握率参与计算。
// ============================================================

import type { AssessmentEvidence, FrequencyBands } from '../shared/types';

/** 双侧 90% Wilson 的 z 值：Φ⁻¹(0.95) */
export const WILSON_Z_95 = 1.6448536269514722;

/** 单个频段的估计统计输入 */
export interface BandEstimateStats {
  readonly knownCount: number;
  readonly testedCount: number;
  readonly bandWordCount: number;
}

/** 估计输入：首测完成状态 + 各频段统计 + 词包大小（算法参数） */
export interface EstimateVocabularyInput {
  readonly initialTestCompleted: boolean;
  /** 每个频段的统计（十频段）；含 bandWordCount 权重 */
  readonly bands: readonly BandEstimateStats[];
  /** 词包大小：钳制上界与估计范围上限（参数，换包不改算法） */
  readonly wordPackSize: number;
}

/** 估计结果：available 含单点估计与保守范围；unavailable 不含任何数值 */
export type VocabularyEstimateResult =
  | { readonly status: 'available'; readonly point: number; readonly low: number; readonly high: number }
  | { readonly status: 'unavailable' };

/** 单频段双侧 90% Wilson 比例区间（0..1 的比例，非词数） */
export function wilsonBandInterval(
  knownCount: number,
  testedCount: number,
  z: number = WILSON_Z_95,
): { low: number; high: number } {
  if (testedCount <= 0) {
    // 零样本：不产生 NaN；调用方保证 unavailable 时不参与计算
    return { low: 0, high: 0 };
  }
  const z2 = z * z;
  const n = testedCount;
  const center = (knownCount + z2 / 2) / (n + z2);
  const margin = (z * Math.sqrt((knownCount * (n - knownCount)) / n + z2 / 4)) / (n + z2);
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

/**
 * 从 AssessmentEvidence 聚合每个频段的 known/tested 计数。
 * 只读取 evidence；不读取 WordState（manual 不影响估计，R-EST-2）。
 * 证据词不在词包频段映射中时跳过（防御）。
 */
export function collectBandEvidence(
  evidence: Record<string, AssessmentEvidence>,
  bands: FrequencyBands,
): Record<number, { knownCount: number; testedCount: number }> {
  const stats: Record<number, { knownCount: number; testedCount: number }> = {};
  for (const [word, ev] of Object.entries(evidence)) {
    const band = bands[word];
    if (band === undefined) continue;
    const current = stats[band] ?? { knownCount: 0, testedCount: 0 };
    current.testedCount += 1;
    if (ev.outcome === 'known') current.knownCount += 1;
    stats[band] = current;
  }
  return stats;
}

/** 按词包频段映射统计每频段词数（bandWordCount 权重） */
export function countBandWords(bands: FrequencyBands): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const band of Object.values(bands)) {
    counts[band] = (counts[band] ?? 0) + 1;
  }
  return counts;
}

/** 把 0..wordPackSize 的估计值四舍五入并钳制 */
function clampRound(value: number, wordPackSize: number): number {
  return Math.max(0, Math.min(wordPackSize, Math.round(value)));
}

/**
 * 词汇量估计（R-EST-1~7）。
 *
 * 计算合同：
 * - 单点：round(Σ_band ((knownCount / testedCount) × bandWordCount))，钳制 0–wordPackSize；
 * - 保守范围：各频段双侧 90% Wilson 加权求和，最终上下界四舍五入并钳制 0–wordPackSize；
 * - 保证 low ≤ point ≤ high；
 * - unavailable：首测未完成 / 任一频段零有效证据 / 多频段零有效证据。
 */
export function estimateVocabulary(input: EstimateVocabularyInput): VocabularyEstimateResult {
  if (!input.initialTestCompleted) return { status: 'unavailable' };

  // 只考虑词包中实际存在的频段（bandWordCount > 0）
  const validBands = input.bands.filter((b) => b.bandWordCount > 0);
  if (validBands.length === 0) return { status: 'unavailable' };

  // 任一频段没有有效测试证据 → unavailable（含多个频段零证据；零样本不按 0 掌握参与）
  if (validBands.some((b) => b.testedCount === 0)) return { status: 'unavailable' };

  let point = 0;
  let lowTotal = 0;
  let highTotal = 0;
  for (const band of validBands) {
    const ratio = band.knownCount / band.testedCount;
    point += ratio * band.bandWordCount;
    const { low, high } = wilsonBandInterval(band.knownCount, band.testedCount);
    lowTotal += low * band.bandWordCount;
    highTotal += high * band.bandWordCount;
  }

  const pointValue = clampRound(point, input.wordPackSize);
  let lowValue = clampRound(lowTotal, input.wordPackSize);
  let highValue = clampRound(highTotal, input.wordPackSize);

  // 保证 low ≤ point ≤ high（四舍五入后可能轻微违反，钳制修正）
  if (lowValue > pointValue) lowValue = pointValue;
  if (highValue < pointValue) highValue = pointValue;

  return { status: 'available', point: pointValue, low: lowValue, high: highValue };
}
