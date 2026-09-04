# 2026-09-04 Restart Batch

## Status

`ACTIVE — GOVERNANCE RECOVERY`

本批次用于长期停工后的仓库恢复。当前只允许一张执行票：

- [`RESUME-01 — Fresh Main Reproducibility + Authority Reconciliation`](./RESUME-01-fresh-main-reproducibility-and-authority-reconciliation.md)

## Why only one ticket

当前主要风险不是缺 feature，而是：

- fresh-main reproducibility 未重新验证；
- README / ticket / Issue / branch 状态与代码历史存在 authority drift；
- local-only query assets 需要按 tracked runbook 恢复；
- 历史 query/hint wave 已实际推进到 final acceptance-gap remediation，但旧 DOCUMENT 状态仍可能误导 agent 重复施工。

因此在 RESUME-01 完成前，不生成新的 feature DAG。

## Execution rule

```text
origin/main truth
→ fresh isolated checkout
→ local data recovery
→ typecheck / tests / build / real Chrome E2E
→ authority reconciliation
→ VERIFIED CURRENT_IMPLEMENTATION_BASELINE
→ choose exactly one next product phase
```

## Governance boundaries

未经单独授权：

- 不关闭 GitHub Issues；
- 不删除远端历史 branches；
- 不合并治理分支到 main；
- 不新增 CI；
- 不发布或部署；
- 不扩大产品范围。
