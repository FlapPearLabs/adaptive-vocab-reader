import type { DisplayDecision, WordState } from '../shared/types';

export interface HintCandidateInput {
  effectiveFrequencyRank: number | null | undefined;
  status: WordState['status'] | undefined;
  threshold: number | null;
}

function isValidFrequencyRank(rank: number | null | undefined): rank is number {
  return typeof rank === 'number' && Number.isFinite(rank) && rank > 0;
}

/**
 * 首轮 bootstrap：有效 rank 升序后取 0-based 中间索引；偶数时自然取上侧中位数。
 * null 表示没有任何可用于主动提示的频率输入。
 */
export function bootstrapHintThreshold(ranks: readonly (number | null | undefined)[]): number | null {
  const sorted = ranks.filter(isValidFrequencyRank).sort((a, b) => a - b);
  return sorted.length === 0 ? null : sorted[Math.floor(sorted.length / 2)]!;
}

/** 只根据频率和显式状态决定是否显示灰线；不读取或修改任何持久化状态。 */
export function isHintCandidate(input: HintCandidateInput): boolean {
  return (
    input.status !== 'known' &&
    input.status !== 'learning' &&
    input.threshold !== null &&
    isValidFrequencyRank(input.effectiveFrequencyRank) &&
    input.effectiveFrequencyRank > input.threshold
  );
}

/** 内容层消费的候选展示输出；透明交互载体由内容层保持。 */
export function hintDisplayDecision(input: HintCandidateInput): DisplayDecision {
  return isHintCandidate(input) ? 'light' : 'none';
}
