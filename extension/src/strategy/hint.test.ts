import { describe, expect, it } from 'vitest';
import { bootstrapHintThreshold, isHintCandidate } from './hint';

describe('主动提示候选策略', () => {
  it('T₀ 取有效频率升序数组的 0-based 中间索引，偶数取上侧', () => {
    expect(bootstrapHintThreshold([30, 10, 20])).toBe(20);
    expect(bootstrapHintThreshold([40, 10, 30, 20])).toBe(30);
  });

  it('忽略无效频率，且没有有效频率时不产生阈值', () => {
    expect(bootstrapHintThreshold([null, 0, -1, Number.NaN, 7, 3])).toBe(7);
    expect(bootstrapHintThreshold([null, 0, -1, Number.NaN])).toBeNull();
  });

  it('仅严格大于阈值的未显式反馈词为 light 候选', () => {
    expect(isHintCandidate({ effectiveFrequencyRank: 11, status: undefined, threshold: 10 })).toBe(true);
    expect(isHintCandidate({ effectiveFrequencyRank: 10, status: undefined, threshold: 10 })).toBe(false);
    expect(isHintCandidate({ effectiveFrequencyRank: 9, status: 'unknown', threshold: 10 })).toBe(false);
  });

  it('known、learning 与缺频率词都不参与候选判定', () => {
    expect(isHintCandidate({ effectiveFrequencyRank: 11, status: 'known', threshold: 10 })).toBe(false);
    expect(isHintCandidate({ effectiveFrequencyRank: 11, status: 'learning', threshold: 10 })).toBe(false);
    expect(isHintCandidate({ effectiveFrequencyRank: null, status: undefined, threshold: 10 })).toBe(false);
  });

  it('校准阈值是可注入参数，同一输入得到相同候选结果', () => {
    const input = { effectiveFrequencyRank: 11, status: undefined, threshold: 12 };
    expect(isHintCandidate(input)).toBe(false);
    expect(isHintCandidate({ ...input, threshold: 10 })).toBe(true);
    expect(isHintCandidate(input)).toBe(false);
  });
});
