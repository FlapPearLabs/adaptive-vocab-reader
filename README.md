# 浏览器词汇学习插件

一个面向已有一定英语基础读者的、本地优先英文网页词汇阅读插件。核心目标是减少阅读中不必要的打断：使用本地词典、个人词汇状态、首次测评与可选校准，让读者在网页中获得适量词汇提示，而不是把产品做成背单词工具或全文翻译器。

## 当前状态

项目已经不是“尚未开始实现”的原型仓库。

截至治理恢复基线 `main@333c3628c5adabd1d69f96b9043eb7a109825eb0`，仓库已包含可构建的 Chrome 扩展实现、固定 assessment core、本地 full query dictionary、词汇状态、首次测评、每日校准、稀疏提示、生词本、动态页面适配、真实 selection / tooltip、跨标签同步以及真实 Chrome E2E / 长文性能观测等能力。

但项目在 2026-08-10 后长期停工，**当前 fresh-main 可复现性尚未重新验证**。因此现阶段不是继续添加功能，而是先完成治理恢复：恢复 local-only 词典资产、从 fresh worktree 跑完整质量门禁、校正文档 / ticket / Issue / branch 状态，并重新建立唯一 Current Baseline。

当前唯一恢复入口：

- [`docs/CURRENT_IMPLEMENTATION_BASELINE.md`](./docs/CURRENT_IMPLEMENTATION_BASELINE.md)
- `RESUME-01 — Fresh Main Reproducibility + Authority Reconciliation`

在 RESUME-01 完成前，不把历史测试结果当作当前 PASS，也不因为旧 Issue 仍 OPEN 就重复实现已有功能。

## 本地数据边界

Query dictionary 与部分构建产物是 **local-only / ignored artifacts**，不会提交到公开 Git。

Fresh clone / fresh worktree 必须按 [`data/README.md`](./data/README.md) 的确定性恢复说明准备 ECDICT 输入并重新生成：

- assessment core；
- query dictionary；
- query forms；
- build output。

缺失这些资产时 build 应 fail-closed；不要把 ignored query payload 提交进 Git 来绕过恢复流程。

## 质量门禁

仓库目前提供：

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run test:e2e
```

此外还有 ECDICT 数据构建相关 Python 测试。具体恢复顺序与当前验证状态以 `docs/CURRENT_IMPLEMENTATION_BASELINE.md` 为准。

## 权威文档

- [当前实现基线](./docs/CURRENT_IMPLEMENTATION_BASELINE.md)
- [产品规则与决策](./RULES.md)
- [领域语言](./CONTEXT.md)
- [当前规格](./docs/specs/)
- [本地词典数据与恢复说明](./data/README.md)
- [本地执行 tickets](./work/tickets/)
- [代理与施工规则](./AGENTS.md)

## Tracker 规则

本项目默认以 `docs/specs/` + `work/tickets/` 管理施工真相。GitHub Issue 只作远端施工索引，不能替代规格或当前实现基线。

历史 Issue OPEN 不表示功能未实现；历史 ticket 中的“DOCUMENT / 未授权开发”等描述也可能只是当时阶段状态。恢复阶段必须先做 authority reconciliation，再决定关闭、归档或新开哪些工作项。

## 当前开发原则

```text
先恢复可复现性
→ 再建立唯一 Current Baseline
→ 再做真实 dogfood / 产品决策
→ 最后才进入下一批 feature tickets
```

未经单独授权，不关闭 Issue、不删除远端历史分支、不直接合并治理分支到 `main`、不发布或部署。
