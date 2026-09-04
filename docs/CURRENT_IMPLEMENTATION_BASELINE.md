# CURRENT_IMPLEMENTATION_BASELINE

> 状态：治理恢复基线（2026-09-04）
>
> 目的：在长期停工后重新建立唯一的“当前实现真相”。本文件描述远端 `main` 已存在什么、哪些证据是历史证据、哪些状态仍需 fresh verification，以及恢复施工前允许/禁止做什么。

## 1. 固定远端基线

- Repository: `FlapPearLabs/adaptive-vocab-reader`
- Default branch: `main`
- Governance audit base: `333c3628c5adabd1d69f96b9043eb7a109825eb0`
- Last production-code parent: `247ef89f45df5c623c1de768d098230600de9498`
- `333c362` 仅补充 local query asset 恢复文档与相关代理规则；生产代码基线仍以其 parent `247ef89f` 为准。

任何恢复施工任务开始前必须先 `fetch` 并验证远端 `main` 是否仍等于本文件记录的基线；若已变化，先更新本文件，不得继续按旧 SHA 施工。

## 2. 已存在的实现能力

以下能力已经出现在 `main` 的提交历史与生产/验收代码中，不应按“尚未实现”重新造一遍：

- Chrome 未打包扩展实现骨架与构建流程；
- 本地 ECDICT assessment core；
- 本地 full query dictionary 与 canonical/query forms；
- `known / learning / unknown` 单词状态；
- strong / light / transparent 提示；
- 包外 query word 查询、反馈与 notebook 展示；
- 固定首次测评；
- 每日校准与词频区间估计相关实现；
- 页面状态增量更新与多标签同步；
- 静态页面、SPA / 动态 DOM、无限滚动相关扫描路径；
- 透明 span + 事件委托；
- unresolved lookup 响应；
- 稀疏 hint selection；
- 真实 selection 竞态修复；
- tooltip geometry / viewport 边界处理；
- CSS isolation；
- 长文真实 Chrome E2E 与性能观测。

上述列表表示“代码/历史验收证据存在”，不等于 2026-09-04 fresh checkout 已重新全部验证通过。

## 3. 2026-08-07 query / hint wave 的实际状态

原 ticket DAG：

1. `T-QD-1` — query dictionary asset / identity
2. `T-INT-2` — transparent wrap / delegated interaction
3. `T-UNR-3` — unresolved lookup response
4. `T-HINT-4` — sparse hint selection
5. `T-SEL-5` — real selection race fix
6. `T-NB-6` — notebook / assessment isolation
7. `T-PERF-7` — long-form DOM/CSS/perf gate

远端提交历史表明该 wave 已推进到 final acceptance-gap remediation：

- `e4cf49d`：query-only learning words in notebook（覆盖 T-NB-6 核心路径）；
- `4c7d6cf`：query/hint performance rebaseline（覆盖 T-PERF-7 测量报告）；
- `a33b84d`：close query hint acceptance gaps；
- `247ef89`：wrapper color / content-script initialization measurement 修复。

因此：**不得再把该 wave 视为“停在 T-NB-6 前”或“七张票尚未开发”。**

## 4. 历史测试证据（不是 fresh verification）

仓库历史记录包含以下门禁：

- TypeScript typecheck；
- Vitest unit/integration；
- deterministic Python data-build tests；
- production build；
- real Chrome E2E；
- multi-tab synchronization；
- SPA / dynamic content；
- query-only notebook isolation；
- tooltip / selection / CSS isolation；
- long-form performance measurements。

历史性能 rebaseline 曾记录 query entries `121340`、长文扫描约 `79.7–98.9 ms`、单批最大约 `1.9–2.3 ms`、CLS `0`。这些只是当时机器/fixture 的观测值，**不是 SLA、预算或 2026-09-04 当前性能结论**。

## 5. 当前必须视为 UNKNOWN 的事项

在 fresh-main reproducibility audit 完成前，以下项目统一标记 `UNKNOWN`：

- fresh clone / fresh worktree 是否可按 tracked 文档完整恢复 local-only assets；
- 当前 Node/Python/Chrome 环境下 typecheck / unit / build / E2E 是否全部仍通过；
- ignored query assets 是否在当前开发机存在；
- 旧 Issue #1–#5 与当前实现的逐条 acceptance closure 状态；
- 历史 `review/*` / `impl/*` / `fix/*` 分支是否全部可安全归档/删除；
- README、旧 ticket index、旧 specs 中哪些状态叙述需要历史化；
- V0.1 是否已经达到真实 dogfood readiness；
- existing tracked data assets 的公开再分发 / license compliance 是否满足发布要求。

## 6. Local-only query asset 恢复合同

Query dictionary 不能因为某个旧 worktree 有缓存就视为存在。

固定输入身份：

- ECDICT source ref: `bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b`
- expected raw SHA-256: `1a6947e04785db63613a92e14903cdae7954f7e84860b10e68e5c7cbb3f9c3cf`

恢复路径以 `data/README.md` 为唯一 tracked runbook。关键产物：

- `data/derived/ecdict-core-1000/`
- `data/derived/ecdict-query/query-dictionary.json`
- `data/derived/ecdict-query/query-forms.json`
- `data/derived/ecdict-query/query-build-report.json`
- `dist/`（build output）

缺失 local-only asset 时必须 fail-closed；禁止把受许可/隐私边界约束的派生 query payload 直接提交进 Git 来换取“开箱即用”。

## 7. 当前治理问题

### 7.1 README 状态失真

旧 README 仍描述“尚未开始扩展实现、没有可运行扩展”，已与 `main` 明显不符。治理分支必须更新该叙述。

### 7.2 GitHub Issue 不是当前唯一 tracker

#1–#5 仍为历史 V0.1 纵向切片 Issue。根据 `AGENTS.md`，GitHub Issue 只作施工索引，不能替代当前 Spec/Ticket；且关闭 Issue 需要单独授权。

在逐条 fresh reconciliation 前：

- 不把 OPEN 等同于 NOT_STARTED；
- 不把已有代码等同于该 Issue 已完全满足；
- 不自动关闭任何 Issue。

### 7.3 旧 ticket index 的“未授权开发”是历史状态

`work/tickets/2026-08-07-v0.1-query-hint-decoupling/README.md` 的 DOCUMENT/未授权开发描述是当时阶段状态，不再代表当前代码现实。该目录保留为历史 execution packet，不应再作为实时 status board。

### 7.4 分支过多

远端仍存在大量 `review/*`、`impl/*`、`fix/*` 历史分支。恢复阶段先做 ancestry / unique-commit inventory，再请求单独授权删除；治理过程中不 force-delete、不假设分支无价值。

### 7.5 当前没有 GitHub Actions workflow

仓库目前未发现 `.github/workflows`。质量门禁主要依赖本地脚本与真实 Chrome E2E。是否建立 CI 属于新的治理/自动化决策，不能在本轮恢复中顺手扩 scope。

## 8. 恢复施工的唯一入口：RESUME-01

下一项工作不是新 feature，而是：

### RESUME-01 — Fresh Main Reproducibility + Authority Reconciliation

目标：证明 `main` 可以从 documented source 恢复并建立新的、可执行的 current truth。

必须执行：

1. `git fetch origin`
2. 验证远端 `main` SHA；
3. 从远端 `main` 创建 fresh isolated worktree；
4. 按 `data/README.md` 恢复/验证 ECDICT raw source 与 SHA-256；
5. 重新生成 assessment core 与 query assets；
6. `npm ci`
7. `npm run typecheck`
8. `npm test`
9. data-build test suite；
10. `npm run build`
11. `npm run test:e2e`
12. 对 README / RULES / CONTEXT / current specs / local tickets / Issues / branches 做 authority reconciliation；
13. 记录 pass/fail、真实失败点、可复现命令和 blocking risk；
14. 更新本文件为 VERIFIED baseline。

禁止：

- 不新增产品功能；
- 不重写现有 query/hint architecture；
- 不因单个旧 Issue OPEN 就重复实现；
- 不为让测试变绿而弱化 acceptance；
- 不未经单独授权关闭 Issue、删除远端分支、合并到 main、发布或部署。

## 9. 下一阶段决策门

只有 RESUME-01 完成后，才从以下方向中选择下一阶段：

- A. 真实 1,000-word dogfood / user-visible acceptance；
- B. 10k assessment/query expansion；
- C. UX refinement；
- D. release / license / privacy readiness；
- E. CI / remote review automation。

不得同时默认开启多个方向。先用 fresh evidence 决定最小正确下一步。

## 10. 当前结论

截至本治理基线：

- `main` 已有完整度较高的 V0.1 技术纵向切片；
- 旧“尚未开发”文档状态已失真；
- 最大风险从“功能缺失”转为“authority drift + reproducibility unknown + dogfood/release readiness unknown”；
- 项目恢复应从 RESUME-01 开始，而不是继续堆功能。
