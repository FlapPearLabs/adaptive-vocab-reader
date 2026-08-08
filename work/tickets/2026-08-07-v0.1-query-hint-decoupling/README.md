# Ticket 批次索引：V0.1 查询、交互、主动提示与测评词包解耦（生产垂直切片）

- **批次**：2026-08-07
- **权威来源**：[查询、交互、主动提示与测评词包解耦规格（已批准）](../../../docs/specs/2026-08-06-V0.1-查询交互提示与测评词包解耦规格.md)（APPROVED，2026-08-07，审查基线 be4f289 + 最终 HEAD 34ea152）+ [RULES.md](../../../RULES.md)。
- **状态**：DOCUMENT 阶段产物。本批次仅拆票与 ticket 文档，**未标记 ready-for-agent、未授权 Codex 开发**；用户批准本批次 DOCUMENT 审查并另行明确「开始开发」后，Codex 方可实施。

## 决策边界（本批次不可越界）

- **D 路线（已批准）**：透明 span 包装 + 事件委托；caret 不作为唯一交互基础；prototype 仅为设计证据，不得直接复制为生产实现（T-INT-2、T-UNR-3）。
- **C 合同（逐字继承）**：候选输入＝仅 `effectiveFrequencyRank`（frq 优先、bnc fallback；双缺失 hint-ineligible but queryable）+ 显式状态过滤（排除 known/learning），不含 Evidence/band；算法＝频率下界阈值；首轮 `T₀ = S[⌊n/2⌋]`（0-based，偶数 n 取上侧元素）；light iff `rank > T₀`；dogfood 校准分位点；候选不落盘、不改写用户状态（T-HINT-4）。
- **E/F（限定范围）**：仅个人本地 dogfood + load unpacked；公开再分发 UNKNOWN、fail-closed；包外词同键、不区分来源、不升级 schema；**新 ECDICT 派生查询 payload（音标/POS/中文释义/频率）不入 tracked 公开 Git**——本地生成位置用已 ignored 的 `data/derived/`、`dist/` 等，`extension/data/` 不作为新查询 payload 的可提交目标（T-QD-1、T-NB-6）。
- **不恢复冻结项**：Pool B、PAV/Beta、高置信自动隐藏、概率画像、hidden-word audit、复杂三桶/回填、local LLM、remote API、telemetry。
- **不在本批次**：existing-assets compliance audit（main 既有 `extension/data/dict-core.json` 等，发布前阻断项，另行单独任务）；RESIDUAL_PUBLIC_OBJECT（28f6d83 不得声称已清除）。

## Ticket 列表与依赖顺序（风险前置）

| 顺序 | Ticket | 主题 | 依赖 | Requirement IDs |
|---|---|---|---|---|
| 1 | [T-QD-1](T-QD-1-query-dictionary-asset-and-identity.md) | 查询词典资产与身份解耦（数据/构建层） | 无 | R-QUERY-1(数据)、R-QUERY-3、R-QUERY-5、R-ASSESS-1、R-COMPAT-4、R-HINT-3(合同)、R-PRIVACY-3(前置验证+guard) |
| 2 | [T-INT-2](T-INT-2-transparent-wrap-and-interaction.md) | 透明 span 包装 + 事件委托 + 无灰线词交互 + tooltip 几何 | T-QD-1 | R-QUERY-2、R-STATE-1、R-STATE-3、R-INPUT-1、R-INPUT-2、R-TOOLTIP-1~4 |
| 3 | [T-UNR-3](T-UNR-3-lookup-unresolved-response.md) | lookup-unresolved 明确响应 | T-QD-1、T-INT-2 | R-QUERY-4、R-QUERY-1(响应部分) |
| 4 | [T-HINT-4](T-HINT-4-sparse-hint-selection.md) | 主动提示候选策略（稀疏灰线） | T-QD-1、T-INT-2 | R-HINT-1~4、R-STATE-4、R-STATE-5 |
| 5 | [T-SEL-5](T-SEL-5-real-selection-race-fix.md) | 真实拖选路径与竞态修复 | T-QD-1、T-INT-2 | R-INPUT-2、R-INPUT-3、R-INPUT-4 |
| 6 | [T-NB-6](T-NB-6-notebook-and-assessment-isolation.md) | 包外词状态、生词本与测评/估计隔离 | T-QD-1、T-INT-2 | R-ASSESS-3、R-COMPAT-3、R-COMPAT-4 |
| 7 | [T-PERF-7](T-PERF-7-long-form-perf-gate.md) | 真实长文 DOM/CSS/性能重测门 | T-QD-1、T-INT-2、T-UNR-3、T-HINT-4 | R-PERF-1、R-PERF-2 |

**为何该顺序避免架构返工**：
1. T-QD-1 最先——数据规模/许可/加载是最大未知风险，且是所有后续票的查询合同输入；先确定资产与身份模型，避免后续票在错误的数据合同上重复实现。
2. T-INT-2 第二——交互架构（包装/委托/tooltip）是 DOM 与性能风险最大处，也是 T-UNR-3/T-HINT-4/T-SEL-5 的载体；先立交互地基，后续显示策略只改判定不改结构。
3. T-UNR-3/T-HINT-4/T-SEL-5/T-NB-6 在统一载体与合同上做行为扩展，互不重排架构；T-NB-6 依赖 T-QD-1 + T-INT-2（真实 Chrome 路径从内容侧生成包外 learning），T-SEL-5 与 T-NB-6 相互顺序不限（popup 生词本断言归属 T-NB-6）；文件边界不冲突时可按序或并行施工（若用户日后允许并行任务）。
4. T-PERF-7 作为测量/验证门禁与实现同批执行，防止「先合入再发现显著性能退化」的返工；本票不自行定义性能「可接受」门槛。

## 三向一致性说明

- 全部 ticket 的 Requirement ID 均可回溯到 approved Spec §15 与 §9 AC / §10 seams；无 orphan requirement，无无 Spec 来源的 ticket requirement；无从旧 ticket/旧注释/历史 prototype 恢复的需求。
- **§15 Requirement → ticket / 已实现回归 / 已完成 prerequisite 覆盖**：
  - 已实现（不拆票）：R-STATE-2、R-ASSESS-2、R-ASSESS-4（回归由 T-NB-6 负断言承接）、R-COMPAT-1/2。
  - 文档/验证层面：R-PERF-2（T-PERF-7 承接「不编造预算」）。
  - **R-PRIVACY-1/2/4** = 已有行为/范围回归（local-first、无遥测、不授权远程 API；随各票负断言与禁止范围保持）。
  - **R-PRIVACY-3** = **E research 已完成的前置验证**（E_VALIDATED，限定本地；公开再分发 UNKNOWN）+ **T-QD-1 实施期 fail-closed/data-boundary guard**（不新增第 8 张生产 ticket；T-QD-1 的 Requirement ID 与 Acceptance 已纳入 R-PRIVACY-3）。
- 每个 ticket 均含真实 Chrome 验收路径 + 负断言 + 数据/许可边界 + 完成定义，且各票「依赖/前置」与本表依赖列逐字一致。

## 本批次不授权

- 不创建 GitHub Issue/PR；不合并 main；不 force-push；不启动 Codex；不下载/提交 ECDICT 全量或派生资产；不改 production code/schema/data；不处理 28f6d83 或 existing-assets audit。
