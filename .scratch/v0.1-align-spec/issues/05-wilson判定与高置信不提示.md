# 05 — Wilson 漏提示率判定与高置信不提示

**What to build:** 用审计桶样本计算漏提示率 Wilson 单侧 90% 上界；当 unknown 词满足「未知 + 后验均值 ≥0.85 + 单侧下界 ≥0.70 + 至少 20 道审计 + 漏提示率上界 ≤30%」时从 light 转为 no-prompt；否则保持 light。

**Blocked by:** 04 — 隐藏词审计桶抽取

**Status:** ready-for-agent

- [ ] 漏提示率 Wilson 上界计算纯函数 + 单测
- [ ] 高置信不提示门槛判定（5 条件全满足 → no-prompt）
- [ ] E2E 验证达标词不再提示，且误提示/词典缺失指标仍可观测
