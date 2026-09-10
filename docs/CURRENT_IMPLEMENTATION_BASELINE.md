# CURRENT_IMPLEMENTATION_BASELINE

> 状态：**VERIFIED — 已于 2026-09-09 经 RESUME-01 fresh 复现审计验证**
>
> 目的：作为唯一的「当前实现真相」。本文件描述远端 `main` 已存在什么、哪些证据是 2026-09-09 fresh 验证通过的、哪些仍是历史证据或未完成门，以及恢复施工前允许/禁止做什么。
>
> 审计报告：[`work/governance/2026-09-04-resume-audit/REPORT.md`](../work/governance/2026-09-04-resume-audit/REPORT.md)

## 0. 2026-09-09 fresh 验证摘要（最新，优先于以下所有历史叙述）

| 门禁 | 结果 | 关键证据 |
|---|---|---|
| REMOTE_BASELINE | **PASS** | live `origin/main = 333c3628c5adabd1d69f96b9043eb7a109825eb0`，与票据预期一致 |
| DATA_RECOVERY | **PASS** | 从上游重新下载 ECDICT 固定快照，SHA-256 命中；query 121340 / freq 40090 / ineligible 81250；产物与旧 worktree 逐字节一致 |
| TYPECHECK | **PASS** | `tsc --noEmit` exit 0 |
| UNIT_TESTS | **PASS** | vitest 18 files / **283 tests** passed |
| DATA_TESTS | **PASS** | Python unittest **12 tests** OK |
| BUILD | **PASS** | `node build.mjs` 成功；缺失 query 资产时 exit 1（fail-closed 已验证） |
| REAL_CHROME_E2E | **PASS** | Chrome for Testing `153.0.8010.36`（全新安装），`E2E ALL PASS`，§21 场景 1~17 + 持久化补全全通过 |

**附记**：E2E 需 `AVR_E2E_NO_SANDBOX=1`（本执行环境为嵌套沙箱；详见报告 REAL_CHROME_E2E 节与 README）。未以任何方式弱化测试或断言换取全绿。

**仍然 UNVERIFIED / 未完成**（不因本文件标 VERIFIED 而消失）：人工 dogfood 门（Ticket 06）、R-MIG-8 真实 profile 备份、公开再分发权利链、远端分支清理、Issue #1–#5 收口。

## 1. 固定远端基线

- Repository: `FlapPearLabs/adaptive-vocab-reader`
- Default branch: `main`
- Governance audit base: `333c3628c5adabd1d69f96b9043eb7a109825eb0`（2026-09-09 复核时仍为 live `origin/main`）
- Last production-code parent: `247ef89f45df5c623c1de768d098230600de9498`
- `333c362` 仅补充 local query asset 恢复文档与相关代理规则；生产代码基线仍以其 parent `247ef89f` 为准。
- **2026-09-10 更新**：live `origin/main` 已前进至 **`58a86f77b0358a96c04e7e07baa9900f33186813`**（`e4f947b` 新增冻结 UX 规格 + `58a86f7` 修正其 Markdown 格式）。两个 commit 均为 **docs-only**，**生产代码基线仍为 `247ef89f`**，本文件 §2–§4 的实现与门禁结论不受影响。
- 治理分支：`governance/restart-baseline-2026-09-04` @ `d5fa1440993f5564c45d5297100f853b74230c5e`（RESUME-01 产物）；UX 集成分支：`governance/ux-spec-integration-2026-09-10`（本阶段产物，起点 `d5fa144`）。

任何恢复施工任务开始前必须先 `fetch` 并验证远端 `main` 是否仍等于本文件记录的基线；若已变化，先更新本文件，不得继续按旧 SHA 施工。

## 2. 已存在的实现能力

以下能力已经出现在 `main` 的提交历史与生产/验收代码中，**且在 2026-09-09 fresh checkout 中被真实门禁重新验证**：

- Chrome 未打包扩展实现骨架与构建流程；
- 本地 ECDICT assessment core（1,000 词）；
- 本地 full query dictionary 与 canonical/query forms（121,340 条）；
- `known / learning / unknown` 单词状态；
- strong / light / transparent 提示；
- 包外 query word 查询、反馈与 notebook 展示；
- 固定首次测评（50 题）与词汇量估计（点值 + 保守范围）；
- 每日校准轮与词频区间估计相关实现；
- 页面状态增量更新与多标签同步；
- 静态页面、SPA / 动态 DOM、无限滚动相关扫描路径；
- 透明 span + 事件委托（known/learning 均为可查询透明 span）；
- unresolved lookup 明确响应；
- 稀疏 hint selection（频率下界阈值，light/100 词实测 4.55）；
- 真实 selection 竞态修复（真实 mousedown/move/up 时间线）；
- tooltip geometry / viewport 边界处理（上方优先、下方翻转、不侵入 sticky header、滚动后正确）；
- CSS isolation；
- 长文真实 Chrome E2E 与性能观测（totalScanMs 87–100.6，maxBatchMs 1.9–2.1，layoutShiftScore 0）。

### 2.1 UX 相关实现事实（2026-09-10 源码/E2E 复核，供 UX 集成对账）

| 面 | 已存在且已验证 | **不存在**（对账确认为缺口，非缺失即缺陷） |
|---|---|---|
| 契约 | `QuizQuestion{word,band,options[4],correctOptionIndex,unsureIndex=4}`；`DictEntry{phonetic,pos,translation,effectiveFrequencyRank?}`；无 `ipa`/`zh`/`detailZh`/`nuance` 字段 | — |
| 阅读面 | 透明查询 span（known 亦保留交互载体）；悬停轻提示（surfaceForm/phonetic/pos/translation 四行，不改状态）；learning 首现行内释义、重复仅下划线；未收录词零样式零持久化 + `当前词典未收录`；拖选胶囊（多词/纯数字拒绝、`mousedown` 抢占、写入 learning） | Word Inspection Popover（点击仅出「会 / 不会」极简菜单）；Esc 关闭；`释义暂不可用` 兜底文案；`METADATA_RESOLUTION_FAILURE` 术语 |
| 弹窗 | 两页签（测评 / 生词本，宽 `380px`）；首测渲染四选项 + 独立「不确定」+ `测评中 X / 50`；每日 `进行中 X / Y`；估计＝点值 + 保守范围 + 「不做外推」 | 「本页」页签；生词本搜索筛选；Settings 页签；任何设置持久化 |
| 行内释义 | 首现契约由策略计算（`isLearning && occurrenceCount===1`），**不是用户设置** | `{posPrefix}{translation}` 格式（现为 `【translation】`）、`user-select:none`、0.35em 间距 |

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

2026-09-09 fresh evidence 逐票确认（见审计报告「本地 ticket 复核」表）：**T-QD-1 / T-INT-2 / T-UNR-3 / T-HINT-4 / T-SEL-5 / T-NB-6 / T-PERF-7 / T-PERF-7A 全部 `implemented + verified`**。

因此：**不得再把该 wave 视为「停在 T-NB-6 前」或「七张票尚未开发」，也不得凭 ticket 文件里的「待用户授权 / 未授权开发」字样重复施工。**

## 4. 测试证据

### 4.1 2026-09-09 fresh 结果（current truth）

| 门禁 | 命令 | 结果 |
|---|---|---|
| typecheck | `npm run typecheck` | exit 0 |
| unit / integration | `npm test` | 18 files / 283 tests passed |
| data build | `python3 -B -m unittest discover -s tests -p "test_*.py" -v` | 12 tests OK |
| build | `npm run build` | success；fail-closed 负向探针 exit 1 |
| real Chrome E2E | `AVR_E2E_NO_SANDBOX=1 npm run test:e2e` | `E2E ALL PASS`（Chrome for Testing 153.0.8010.36） |

### 4.2 历史测试证据（不是 fresh verification）

仓库历史记录包含以下门禁：TypeScript typecheck、Vitest unit/integration、deterministic Python data-build tests、production build、real Chrome E2E、multi-tab synchronization、SPA / 动态内容、query-only notebook isolation、tooltip / selection / CSS isolation、long-form performance measurements。

历史性能 rebaseline 曾记录 query entries `121340`、长文扫描约 `79.7–98.9 ms`、单批最大约 `1.9–2.3 ms`、CLS `0`。这些只是当时机器/fixture 的观测值，**不是 SLA、预算或当前性能结论**；2026-09-09 fresh 观测为 `87–100.6 ms` / `1.9–2.1 ms` / `layoutShiftScore 0`，量级一致。

## 5. UNKNOWN 事项的收敛情况

| 原 UNKNOWN 项 | 2026-09-09 状态 |
|---|---|
| fresh clone / fresh worktree 是否可按 tracked 文档完整恢复 local-only assets | **RESOLVED — 可**（上游重新下载 + SHA-256 命中 + 确定性重建 + 逐字节一致） |
| 当前 Node/Python/Chrome 环境下 typecheck / unit / build / E2E 是否全部仍通过 | **RESOLVED — 全通过**（见 §4.1） |
| ignored query assets 是否在当前开发机存在 | **RESOLVED — 不依赖旧资产，可 fresh 重建** |
| 旧 Issue #1–#5 与当前实现的逐条 acceptance closure 状态 | **PARTIALLY RESOLVED — 审计报告已给出逐条 closure recommendation**；仍 OPEN，**未越权关闭** |
| 历史 `review/*` / `impl/*` / `fix/*` 分支是否全部可安全归档/删除 | **PARTIALLY RESOLVED — 已有 ancestry / unique-commit inventory**；6 个分支含独有提交，**未越权删除** |
| README、旧 ticket index、旧 specs 中哪些状态叙述需要历史化 | **RESOLVED（2026-09-10，PHASE-SPEC-INT）** — `RULES.md` 21 处 `[已确认·尚未实现]` 已重标为 `[已确认·已实现@2026-09-09]`（保留原句存史）；2026-08-06 Spec §1/§15/§16、2026-07-22 垂直切片规格、`CONTEXT.md`、`work/tickets/README.md` 均已加历史化/重标提示（见 §7.1） |
| 外部 UX 文档 `UX_SPEC_V1.2.1` 是否已纳入仓库权威 | **RESOLVED（2026-09-10）** — 冻结原文位于 `docs/specs/2026-09-04-UX_SPEC_V1.2.1.md`（`origin/main@58a86f7`）；仓库权威版为 `docs/specs/2026-09-10-V0.1-UX-V1.2.1-集成规格.md`，43 条对账矩阵已闭合（23 已实现 / 6 已实现但 UX 不同 / 8 新 delta / 2 冲突待裁决 / 1 已取代 / 2 越界 / 1 文档对齐 / 0 UNKNOWN） |
| V0.1 是否已经达到真实 dogfood readiness | **STILL UNKNOWN — 人工 dogfood 门（Ticket 06）未执行，R-MIG-8 真实 profile 备份未执行** |
| existing tracked data assets 的公开再分发 / license compliance 是否满足发布要求 | **STILL UNKNOWN — 发布前阻断项，需单独审计** |

## 6. Local-only query asset 恢复合同（已 fresh 验证）

Query dictionary 不能因为某个旧 worktree 有缓存就视为存在。

固定输入身份：

- ECDICT source ref: `bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b`
- expected raw SHA-256: `1a6947e04785db63613a92e14903cdae7954f7e84860b10e68e5c7cbb3f9c3cf`（2026-09-09 上游重新下载实测命中，65,933,428 bytes）

恢复路径以 `data/README.md` 为唯一 tracked runbook。关键产物：

- `data/derived/ecdict-core-1000/`（`dict-core.json` / `forms.json` / `frequency-bands.json` / `build-report.json`）
- `data/derived/ecdict-query/query-dictionary.json`
- `data/derived/ecdict-query/query-forms.json`
- `data/derived/ecdict-query/query-build-report.json`
- `dist/`（build output）

2026-09-09 实测数值：query entries `121340`、frequency eligible `40090`、frequency ineligible `81250`、input rows `770611`、core selected `1000`，与 `data/README.md` 记录基线一致。

缺失 local-only asset 时必须 fail-closed（已用负向探针验证：`build` exit 1 并给出恢复指引）；禁止把受许可/隐私边界约束的派生 query payload 直接提交进 Git 来换取「开箱即用」。

## 7. 当前治理问题

### 7.1 RULES / 已批准 Spec 的「尚未实现」状态标注已过时 —— **RESOLVED（2026-09-10）**

> 原问题描述保留如下，仅供存史。**本项已于 PHASE-SPEC-INT 处置完毕**：`RULES.md` 21 处标注已重标为 `[已确认·已实现@2026-09-09]`（原句保留），2026-08-06 Spec §1/§15/§16、2026-07-22 垂直切片规格、`CONTEXT.md` 与 `work/tickets/README.md` 均已加历史化提示。审计报告：[`work/governance/2026-09-10-ux-spec-integration/REPORT.md`](../work/governance/2026-09-10-ux-spec-integration/REPORT.md) 的 `STALE_DOC_REMEDIATION`。

**原描述（2026-09-09 记录）：**

`RULES.md`「查询、交互、主动提示与测评词包解耦」一节的逐条 `[已确认·尚未实现]` 标注，以及 `docs/specs/2026-08-06-V0.1-查询交互提示与测评词包解耦规格.md` 的「当前 main 尚未实现完整目标」，**已与 main 代码现实脱节**。fresh E2E 反例：

- RULES 称「known 词被还原为纯文本且无交互载体」→ 实测 known/learning 为**透明查询 span 且可查询可纠错**；
- RULES 称「tooltip 以目标词左上角为锚点、`top=y-8`、只处理 bottom/right 溢出」→ 实测已实现上方优先 / 下方翻转 / 不侵入 sticky header / 不越视口 / 滚动后正确；
- Spec 称「无灰线词仍可交互」尚未实现 → 实测 `query_outside_assessment=true`、未收录词有明确响应。

**风险**：这会让后续 agent 依据「尚未实现」重复实现已存在的能力。**处置**：需单独授权做一次「按 fresh evidence 重标状态」的规则/规格修订；本基线文件不代为修改 RULES。

### 7.2 README 状态失真（已修复）

治理分支 `c509346` 已更新 README：不再声称「尚未开始扩展实现、没有可运行扩展」。2026-09-09 又补录了 Chrome for Testing 安装步骤与 E2E 的 `AVR_E2E_NO_SANDBOX=1` 运行前置条件。

### 7.3 GitHub Issue 不是当前唯一 tracker

#1–#5 仍为历史 V0.1 纵向切片 Issue。根据 `AGENTS.md`，GitHub Issue 只作施工索引，不能替代当前 Spec/Ticket；且关闭 Issue 需要单独授权。

逐条 closure recommendation 见审计报告 `ISSUE_RECONCILIATION`。核心结论：

- 不把 OPEN 等同于 NOT_STARTED；
- 五个 Issue 的自动化验收条款基本已被 fresh evidence 满足，但其中「审计标记 / 高置信自动隐藏 / PAV·Beta 画像」条款已被 RULES **永久冻结**，正确的收口动作是「改写 AC 或标记 superseded」，不是「按原文重新实现」；
- 不自动关闭任何 Issue。

### 7.4 旧 ticket index 的「未授权开发」是历史状态

`work/tickets/2026-08-07-v0.1-query-hint-decoupling/README.md` 的 DOCUMENT/未授权开发描述是当时阶段状态，不再代表当前代码现实。该目录（以及 `2026-07-31`、`2026-08-05` 两批的 Status 字段）保留为历史 execution packet，**不应再作为实时 status board**；当前判定以审计报告「本地 ticket 复核」表为准。

### 7.5 分支过多

远端 26 个分支中 19 个已被 main 完全包含（零独有提交），6 个含独有提交（`governance/restart-baseline-2026-09-04` + 5 个 `review/*`）。完整 inventory 与 keep / archive-candidate / delete-candidate 建议见审计报告 `BRANCH_INVENTORY`。恢复阶段不 force-delete、不假设分支无价值；删除需单独授权。

### 7.6 当前没有 GitHub Actions workflow

仓库目前未发现 `.github/workflows`。质量门禁主要依赖本地脚本与真实 Chrome E2E。是否建立 CI 属于新的治理/自动化决策，不能在本轮恢复中顺手扩 scope。

## 8. 恢复施工入口：RESUME-01 — 已完成

`RESUME-01 — Fresh Main Reproducibility + Authority Reconciliation` 已于 2026-09-09 执行完成：

1. `git fetch origin` ✅
2. 验证远端 `main` SHA = `333c362…` ✅
3. 从治理基线创建 fresh isolated worktree ✅
4. 按 `data/README.md` 恢复/验证 ECDICT raw source 与 SHA-256 ✅
5. 重新生成 assessment core 与 query assets ✅
6. `npm ci` ✅
7. `npm run typecheck` ✅
8. `npm test` ✅（283）
9. data-build test suite ✅（12）
10. `npm run build` ✅（含 fail-closed 负向验证）
11. `npm run test:e2e` ✅（`E2E ALL PASS`）
12. authority reconciliation ✅（README / RULES / CONTEXT / specs / local tickets / Issues / branches）
13. pass/fail、真实失败点、可复现命令与 blocking risk 已记录 ✅
14. 本文件更新为 VERIFIED baseline ✅

执行中遵守的禁止项：未新增产品功能、未重写 query/hint architecture、未因旧 Issue OPEN 重复实现、未弱化 acceptance、未关闭 Issue、未删除远端分支、未合并 main、未发布部署。

## 9. 下一阶段决策门

RESUME-01 已完成；`PHASE-SPEC-INT`（UX 规格集成 + 状态重标）**已于 2026-09-10 完成**（分支 `governance/ux-spec-integration-2026-09-10`）。当前**只推荐一个**下一阶段入口：

**`PHASE-DEC-1` — UX 集成未决项裁决 + 实施 ticket 分解**

范围：裁决 `DEC-1`（下划线配色：琥珀 vs 现行红色强提示）、`DEC-2`（Settings 页签）、`DEC-3`（UI 文案语言）、`DEC-4`（「本页」页签是否纳入 V0.1）、`DEC-5`（先人工 dogfood 还是先按新 UX 实现）→ 回写集成规格 §7/§10 → 按 D-1～D-10 拆垂直切片并做 batch validation。

**该阶段启动前，`IMPLEMENTATION_TICKET_READINESS = NOT_READY_FOR_TICKET_DECOMPOSITION`**，不得拆票。

以下方向在本阶段不并行开启：

- A. 真实 1,000-word dogfood / user-visible acceptance（受 §5 未完成的 dogfood 门与 R-MIG-8 约束，需用户裁定顺序）；
- B. 10k assessment/query expansion（RULES：dogfood 未明确接受前不得讨论）；
- C. UX refinement（并入 `UX_SPEC_V1.2.1` 集成，不另起方向）；
- D. release / license / privacy readiness（发布前阻断项，另行单独审计）；
- E. CI / remote review automation（新治理决策，不在本轮扩 scope）。

## 10. 当前结论

截至 2026-09-09 verified baseline：

- `main@333c362` 的可复现性已重新证明：raw 输入可从上游按固定 ref 重新下载并命中 SHA-256，派生资产确定性重建且与历史逐字节一致；
- 六项质量门禁在 fresh worktree 全部真实通过，无一项用历史 PASS 冒充；
- 主要风险已从「reproducibility unknown」转为 **authority drift + dogfood/release readiness 未完成**；其中 authority drift 已于 2026-09-10 的 `PHASE-SPEC-INT` 消解（状态重标 + UX 规格入库，docs-only）；
- 项目下一步是 **裁决 UX 集成的 5 项未决产品决策（DEC-1～DEC-5）**，而不是继续堆功能；裁决前不具备拆票资格。
