# PHASE-SPEC-INT — UX_SPEC_V1.2.1 仓库权威集成审计报告

日期：2026-09-10
阶段性质：**DOCUMENT / GOVERNANCE ONLY**（不实现产品代码、不拆实施 ticket、不合并 main、不关闭 Issue、不删除远端分支、不发布部署）
执行分支：`governance/ux-spec-integration-2026-09-10`
产出规格：[`docs/specs/2026-09-10-V0.1-UX-V1.2.1-集成规格.md`](../../../docs/specs/2026-09-10-V0.1-UX-V1.2.1-集成规格.md)

---

## REMOTE_TRUTH

| 项 | 值 | 判定 |
|---|---|---|
| 要求的治理起点 HEAD | `d5fa1440993f5564c45d5297100f853b74230c5e`（`governance/restart-baseline-2026-09-04`） | ✅ 与 live 一致，**未触发 `STOP: GOVERNANCE_BASELINE_CHANGED`** |
| 观测到的 live `origin/main` | `58a86f77b0358a96c04e7e07baa9900f33186813` | 较 RESUME-01 记录的 `333c3628c5adabd1d69f96b9043eb7a109825eb0` **前进 2 个 commit** |
| main 新增 commit | `e4f947b` docs: add frozen UX specification v1.2.1；`58a86f7` docs: fix UX spec markdown formatting | 均为 **docs-only**，无生产代码变更 |
| `d5fa144` 是否为 `origin/main` 祖先 | **否** | 治理分支与 main 已分叉（治理分支含 RESUME-01 的 docs） |
| 本阶段执行方式 | 从 `d5fa144` 建隔离 worktree `.cache/ux-spec-int-2026-09-10`；冻结 UX 文档自 `origin/main` 按对象读取 | 未 checkout / merge main 到当前工作分支 |

**为什么 main 变动不构成 STOP**：阶段约定只要求「治理起点 HEAD 必须为 `d5fa144`」，该条件满足；live main 只要求「记录」。且 main 的前进只是引入了本阶段所需的输入文档。

**未触发的 stop condition**：`GOVERNANCE_BASELINE_CHANGED` ❌、`UX_SPEC_INPUT_MISSING` ❌（已在用户提供远端路径后解除）、`UX_SPEC_INPUT_AMBIGUOUS` ❌（全机仅一份，内容 SHA-256 唯一）。

> 诚实记录：本阶段**最初**因本机与仓库均无该文档而触发过一次 `UX_SPEC_INPUT_MISSING`（检索证据：文件名 `*UX_SPEC*` / `*ux-spec*` / `*1.2.1*` 全机零命中；内容检索 `DESIGN FROZEN` / `AUTHORITY RECONCILED` 零命中；`conversation_search`（2026-09-03～09-10）无相关会话）。用户提供远端路径后，文档可达性经 `git show origin/main:docs/specs/...` 验证通过。

---

## INPUT_UX_SPEC

| 项 | 值 |
|---|---|
| 路径（远端 main） | `docs/specs/2026-09-04-UX_SPEC_V1.2.1.md` |
| 引入 commit | `e4f947b` → `58a86f7`（格式化修正） |
| 状态字串 | `DESIGN FROZEN — AUTHORITY RECONCILED — READY FOR REPOSITORY INTEGRATION REVIEW` ✅ 与阶段预期一致 |
| 规模 / SHA-256 | 274 行 / 22,673 B；`d6570918be68189c133ed1fc8756ddd3645aee968a01758f7a81db84548bbcc4` |
| 自称权威层级 | 「本文件只定义呈现、排版与交互行为；仓库 `RULES.md`、已批准规格、`CONTEXT.md` 与权威领域/存储契约在身份、持久化、词典 schema、测评逻辑问题上绝对优先」 |
| 在本阶段的地位 | **INPUT，不是仓库权威**；不得直接据其实现；不得为迎合它反向改写仓库契约 |

---

## AUTHORITY_SOURCES

新鲜读取并用于本次对账的权威来源：

| 来源 | 用途 | 关键结论 |
|---|---|---|
| `AGENTS.md` | 阶段/Skill 路由、文档纪律、中文输出要求 | 本地 ticket 优先；Issue 只作索引 |
| `RULES.md` | 产品规则唯一来源 | 发现大量 `[已确认·尚未实现]` 标注与代码现实脱节（见 STALE_DOC_REMEDIATION） |
| `CONTEXT.md` | 领域语言 | 「轻提示＝未知词下划线」定义已过时 |
| `README.md` | 质量门禁与恢复路径 | 无需本阶段改动（RESUME-01 已补 E2E 前置条件） |
| `docs/CURRENT_IMPLEMENTATION_BASELINE.md` | 已验证实现真相 | VERIFIED；§7.1 记录的 P1 stale-doc 由本阶段处置 |
| `work/governance/2026-09-04-resume-audit/REPORT.md` | RESUME-01 证据 | STALE_DOCS / BLOCKERS / NEXT_RECOMMENDED_PHASE 直接沿用 |
| `docs/specs/2026-08-06-V0.1-查询交互提示与测评词包解耦规格.md` | 已批准产品合同 | §3/§6/§15/§16 的「尚未实现」叙述已过时 |
| `docs/specs/2026-08-05-V0.1-阅读体验增强规格.md` | 阅读体验增强合同 | 目标已实现；无「尚未实现」字样残留 |
| `docs/specs/2026-07-22-V0.1-1000词垂直切片实施规格.md` | 历史证据 | 已被 RULES 标为 superseded |
| `docs/adr/0003`、`0004` | 架构决定 | 0003 已标 superseded，无需改动 |
| `work/tickets/**` | 历史 execution packet | 状态字段已过时（见 STALE_DOC_REMEDIATION） |
| 源码与 E2E（实现真相） | 冲突仲裁 | `types.ts`、`annotator.ts`、`pageScanner.ts`、`popup.ts`、`popupNotebook.ts`、`e2e-verify.cjs` |

**仲裁原则**：实现状态一律以 RESUME-01 fresh 证据 + 本阶段源码/E2E 复核为准；**不使用 commit message 或 ticket 状态文本推断实现状态**。

---

## RECONCILIATION_MATRIX

完整 43 条矩阵见集成规格 §5。此处给出分类汇总与关键判据。

| 分类 | 条数 | 代表条目 |
|---|---|---|
| `ALREADY_IMPLEMENTED_AND_VERIFIED` | **23** | U-2/3/4/5/6（`wordKey`/`DictEntry`/持久化契约/生词本语义/隐私）、U-8（悬停轻提示不改态）、U-10/11（首现释义 / 重复省略）、U-15（选区校验）、U-16/41（未收录零样式零持久化）、U-17（元数据失败正交）、U-19（下划线零位移）、U-21/22（CSS/DOM 隔离）、U-23/25（悬停不弹浮层 / 提交后自动关闭）、U-28/30/31/32（`QuizQuestion` 渲染 / 流程分离 / 完成态 / 估计无外推）、U-36/38（Level Check / `firstOccurrenceOnly` 本就是固定契约） |
| `ALREADY_IMPLEMENTED_BUT_UX_DIFFERS` | **6** | U-7（宿主排版显式继承）、U-12（行内释义格式）、U-14/27（拖选胶囊文案与位置）、U-33（`380px` vs `320px`）、U-35（生词本搜索筛选） |
| `NEW_REQUIRED_CHANGE` | **8** | U-9（Inspection Popover）、U-18/42（`释义暂不可用`）、U-20（浮层排版）、U-24（浮层几何）、U-26（Esc 关闭）、U-34（本页页签）、U-43（空状态） |
| `CONFLICT_REQUIRES_PRODUCT_DECISION` | **2** | U-13（琥珀 vs 现行红色强提示）、U-37（Settings 页签） |
| `SUPERSEDED_OLD_REQUIREMENT` | **1** | U-29（二元 `Need Gloss / I Know This` — 仓库契约从未包含） |
| `OUT_OF_SCOPE` | **2** | U-39（未授权设置项）、U-40（移动端 bottom-sheet） |
| `DOC_ONLY_REALIGNMENT` | **1** | U-1（交互 / 领域二分表述） |
| `UNKNOWN` | **0** | — |
| **合计** | **43** | 23 + 6 + 8 + 2 + 1 + 2 + 1 + 0 = 43 ✅ |

**零 UNKNOWN 的说明**：43 条全部可用仓库证据或外部文档自身的权威声明判定；无一条依赖猜测。

---

## CURRENT_IMPLEMENTATION_FACTS

（详见集成规格 §6；以下为仲裁过的关键事实，均带证据定位）

1. known 词 = 可查询透明 span（`e2e-verify.cjs:472-473`）——**推翻** `RULES.md`「known 被还原为纯文本且无交互载体」。
2. 未收录词：hover 显示 `当前词典未收录`，click 不弹菜单，快照深比较零写入（`e2e-verify.cjs:617-628`）。
3. 包外词：可写 learning、进生词本、展示完整元数据、**不污染 Evidence**（`e2e-verify.cjs:1234-1241`，`serendipity`）。
4. 稀疏灰线 + 频率下界阈值已生效（light/100 ≈ 4.55）。
5. Tooltip 几何四项（上方优先 / 下方翻转 / 不侵入 sticky / 不越视口 / 滚动后正确）已 fresh 验证。
6. 行内释义首现契约由策略计算，**不存在** `firstOccurrenceOnly` 设置项。
7. 首测 UI 已渲染 `QuizQuestion`：四选项 + 独立「不确定」+ `测评中 X / 50`；估计为点值 + 保守范围 + 「不做外推」。
8. **不存在**：`METADATA_RESOLUTION_FAILURE` 概念、`释义暂不可用` 文案、Inspection Popover、Esc 关闭、本页页签、生词本搜索、Settings 页签、任何设置持久化。
9. **不存在**（正面确认，非缺失）：`detailZh` / `nuance` / `ipa` / `zh` 字段——全库零命中。

---

## NEW_REQUIRED_DELTAS

D-1～D-10，见集成规格 §7。要点：

- **唯一真正的新增产品能力**：D-8 的「本页」页签（当前页面命中词表）。
- 其余 9 项均为既有能力的形式/呈现补齐或既存不变式的可见表达。
- D-2 强制复用已验证的 `calculateTooltipPosition` 定位 seam，**禁止另写一套浮层几何**（防止重复实现与 E2E 回归）。

---

## SUPERSEDED_REQUIREMENTS

| 项 | 原表述 | 处置 |
|---|---|---|
| 二元 `Need Gloss / I Know This` 测评模型 | 外部 UX 早期草案的测评交互 | **SUPERSEDED**：仓库 `QuizQuestion` 自始为四选一 + 独立「不确定」；后续实现只需确认**不引入**该二元模型 |
| `firstOccurrenceOnly` 用户设置 | 外部 UX §6 | **SUPERSEDED**：本就从未存在，行内释义首现是固定契约 |
| 高置信自动隐藏 / Pool B / PAV·Beta 后验 / 概率画像 / 复杂三桶配额 | `RULES.md`「明确不做与冻结项」 | 继续冻结，不因 UX 集成恢复 |
| `docs/specs/2026-07-22-*` 三份旧规格 | 已由 `RULES.md` 标 superseded | 维持历史证据地位，本阶段只补一行状态提示 |

---

## STALE_DOC_REMEDIATION

分类说明：**current authority**（仍是现行规则）/ **historical record**（有意保留的史实）/ **obsolete status narration**（会把已实现工作误读为 backlog 的过时状态叙述 —— 本阶段的处置对象）。

| # | 位置 | 过时内容 | 分类 | 本阶段处置 |
|---|---|---|---|---|
| S-1 | `RULES.md`「产品目标」L18 | 「词汇量估计、每日校准轮、wordKey 身份迁移和真人 dogfood 闭环尚未完成」 | obsolete status narration（部分） | 加注：估计 / 每日轮 / 身份迁移已完成，仅 dogfood 门未完成 |
| S-2 | `RULES.md`「查询、交互、主动提示与测评词包解耦」节首 L51 | 「本节所列高层产品方向已由用户确认，**但尚未实现**」 | obsolete status narration | 改为「已于 2026-09-09 fresh 验证为实现」，保留原句存史 |
| S-3 | `RULES.md` 该节逐条 `[已确认·尚未实现]`（L27/45/46/47/62/63/64/65/66/67/68/69/70/71/72/73/80/81/82/90/98） | 21 处「尚未实现」 | obsolete status narration | 逐条改为 `[已确认·已实现@2026-09-09]`，并保留原表述文字 |
| S-4 | `RULES.md` L140 | 「批准 ≠ 实现——完整解耦目标未实现」 | obsolete status narration（部分） | 加注：GOAL 1–7 已实现，剩余为 UX 呈现层 delta |
| S-5 | `docs/specs/2026-08-06-…规格.md` L10 / L51 / L103 / L402 / L403 | 「用户已确认但**尚未实现**的高层产品方向」 | obsolete status narration | 在 §1 加状态重标横幅，并指向本集成规格与基线文档 |
| S-6 | 同文件 §15 各表「当前已实现 = 否 / 部分」、§16 表「是否需要后续 ticket = 是」 | R-QUERY-1/2/3/4、R-STATE-1/4/5、R-HINT-1/2/3/4、R-ASSESS-1/3、R-TOOLTIP-1~4、R-INPUT-3/4、R-PERF-1、R-COMPAT-3 | obsolete status narration | 在 §15 / §16 各加一行重标提示（不重画整表，保留历史判定） |
| S-7 | `docs/specs/2026-07-22-V0.1-1000词垂直切片实施规格.md` Problem Statement | 「当前没有可安装的扩展、词典构建产物或用户状态存储」 | historical record（已被 RULES 标 superseded） | 补一行「历史状态叙述，不代表 current status」提示 |
| S-8 | `CONTEXT.md`「轻提示」 | 「未知词的下划线与悬停查看」 | obsolete status narration | 改为「灰线只用于频率候选」并补「强提示 / 元数据解析失败 / 未收录」三个词条 |
| S-9 | `work/tickets/**` 各批次 Status（`ready-for-agent` /「待用户授权后进入开发」） | 状态字段 | historical record | 新增 `work/tickets/README.md` 统一声明：所有批次为历史 execution packet，不作实时 status board |
| S-10 | `docs/CURRENT_IMPLEMENTATION_BASELINE.md` §7.1 | 「需单独授权做一次按 fresh evidence 重标状态的规则/规格修订」 | current authority（待办） | 本阶段执行后置为 RESOLVED |
| S-11 | `RULES.md`「阅读体验增强」L81 | 「tooltip 以目标词左上角为锚点、`top=y-8`、只处理 bottom/right 溢出……属于实现差距」 | obsolete status narration | 含于 S-3 处理 |
| S-12 | `RULES.md`「阅读体验增强」L82 | 「现有 E2E 只用合成 `Range + mouseup`」 | obsolete status narration | 含于 S-3 处理 |

**不做的事**：不删除任何历史文件；不重写 `RULES.md` 结构；不为了「看起来一致」而抹掉决议过程记录。

---

## ASSESSMENT_CONTRACT_RECONCILIATION

| 冻结纠正要求 | 仓库现状 | 判定 |
|---|---|---|
| Initial Assessment 绑定仓库 `QuizQuestion`：目标词 + 仓库候选项 + 显式 `Unsure / 不确定` + `current / total` | `types.ts:79` `QuizQuestion{word,band,options[4],correctOptionIndex,unsureIndex=4}`；`popup.ts:234` `测评中 X / 50`；`:255-264` 四选项 + 独立「不确定」；每日轮 `:400` `进行中 X / Y` | ✅ **完全满足，且已被 fresh E2E 覆盖** |
| 不恢复二元 `Need Gloss / I Know This` | 仓库契约从未包含该模型 | ✅ 无需回退动作；已列为 SUPERSEDED |
| 首测与每日校准保持两个独立流程，不合并为单一 UX/领域契约 | `InitialTestState` 与 `DailyTestState` 独立契约、独立 message 路径、独立冻结计划 | ✅ 满足 |
| UX 不得重定义测评语义或出题算法 | 本集成规格未触碰 `strategy/quiz.ts` / `strategy/daily.ts` 语义 | ✅ 满足 |

---

## METADATA_FAILURE_RECONCILIATION

| 冻结纠正要求 | 仓库现状 | 判定 |
|---|---|---|
| `METADATA_RESOLUTION_FAILURE` 不是独立词汇状态 | 仓库无该状态；词汇状态只有 `known / learning / unknown` | ✅ 满足（术语需补入 `CONTEXT.md`） |
| 不得改写 `WordState` | 无任何按元数据可用性写状态的分支 | ✅ 满足 |
| 不得伪装成 known / learning / unknown | 同上 | ✅ 满足 |
| 不得仅因元数据失败改写词汇状态样式 | `pageScanner.ts:118-135`：decision 只由 `WordState` + 频率阈值决定；元数据仅透传 | ✅ **结构性成立** |
| learning + 元数据失败 → 保留实线下划线、省略行内释义 | `annotator.ts:372`：仅当 `translation` 存在时挂 `data-translation` | ✅ 满足 |
| 浮层/轻提示显示 `释义暂不可用`，禁止合成占位释义 | **缺失**：元数据缺失时 hover 直接 return，静默无提示；全库无该文案 | ⚠️ **D-1（NEW_REQUIRED_CHANGE）** |

结论：正交性不变式**已经成立**，缺的只是「失败可见表达」。因此 D-1 是**补文案 + 补断言**，不是改状态机 —— 这一区分已写入集成规格，防止后续被误做成架构改造。

---

## UNRESOLVED_PRODUCT_DECISIONS

| ID | 决策点 | 影响 delta | 为何不能由本阶段代裁 |
|---|---|---|---|
| DEC-1 | light/learning 下划线配色：琥珀（UX）vs 红色强提示（现行 `RULES.md`） | D-5 / D-6 | 属产品视觉规则变更，且 `RULES.md` 多处明确「红色强提示」 |
| DEC-2 | 是否需要 Settings 页签（所列设置项全部 `NOT AUTHORIZED`） | D-8 | 引入空壳页签属新产品范围 |
| DEC-3 | UI 文案语言（英文原样 vs 中文等价） | D-7 / D-10 | 影响全部用户可见文案 |
| DEC-4 | 「本页」页签是否纳入 V0.1 | D-8 | **新增产品能力**，非纯 UX 集成 |
| DEC-5 | 先完成人工 dogfood 门（B3）还是先按新 UX 实现 | 全部 D-* | RESUME-01 已标记需用户裁定；本阶段不代裁 |

---

## CHROME_TOOLCHAIN_RECOMMENDATION

阶段约定：只评估归属、只给建议、**不安装**、不做无关工具链变更、**不得让工具设计改变产品 UX 合同**。

| 候选 | 归属判断 | 建议 | 立即执行？ |
|---|---|---|---|
| Google Chrome `chrome-extensions` skill | 工程知识资产，不是产品权威 | 若采用，挂到 `AGENTS.md` Skill 路由表的「可选参考」行，注明「非权威，不得据其改变产品合同」 | ❌ 否 |
| `modern-web-guidance` | 同上 | 同上 | ❌ 否 |
| Chrome DevTools MCP（扩展专用工具） | **本地个体开发者工具链**，含凭据/端口等个人环境信息 | 不写入仓库权威；若记录，只放 README「可选本地工具」段做 docs-only 说明，**禁止**写入 `RULES.md` / Spec / `mcp.json` 到本仓库 | ❌ 否 |
| 隔离 Chrome 开发/测试 profile | **测试 seam 决策**，且与 `R-MIG-8`（真实 profile 备份）直接相关 | 列为未来 SPIKE 候选；归属「工程/测试权威」（README 质量门禁 + 未来 ticket 批次），**不属产品 UX 合同** | ❌ 否 |
| 运行时 Extension install / reload / inspect 校验 | 当前 E2E 已用 puppeteer 加载 unpacked extension 做真实验证 | 与上一项合并为同一 SPIKE；不得因此放宽或改写法 | ❌ 否 |

**未来 ticket 候选（本阶段只命名，不创建）**：`SPIKE-CHROME-DEVPROFILE — 隔离 Chrome 开发/测试 profile 与运行时扩展校验可行性`
前置条件：在人工 dogfood 门（B3）启动前完成，因为 `R-MIG-8` 需要真实 profile 备份作为安全网。
硬约束：不得改变任何 E2E 断言阈值；不得污染用户日常 profile；不得引入远程依赖。

---

## FILES_CHANGED

| 文件 | 变更类型 | 内容 |
|---|---|---|
| `docs/specs/2026-09-10-V0.1-UX-V1.2.1-集成规格.md` | 新增 | 仓库权威版 UX 集成规格（13 节，43 条对账矩阵） |
| `work/governance/2026-09-10-ux-spec-integration/REPORT.md` | 新增 | 本报告 |
| `RULES.md` | 修改 | 顶部状态重标横幅；S-1 / S-2 / S-3（21 处）/ S-4 / S-11 / S-12 加注 |
| `CONTEXT.md` | 修改 | 「轻提示」定义重标；新增「元数据解析失败」「未收录」「强提示」词条 |
| `docs/CURRENT_IMPLEMENTATION_BASELINE.md` | 修改 | §1 记录 main 已前进至 `58a86f7`；§2.1 新增 UX 相关实现事实；§5/§7.1/§9/§10 更新 |
| `docs/specs/2026-08-06-V0.1-查询交互提示与测评词包解耦规格.md` | 修改 | §1 状态重标横幅；§15 / §16 各加一行重标提示 |
| `docs/specs/2026-07-22-V0.1-1000词垂直切片实施规格.md` | 修改 | 一行历史状态提示 |
| `work/tickets/README.md` | 新增 | 声明所有 ticket 批次为历史 execution packet |

**未改动**：任何 `extension/**` 生产代码、`build.mjs`、测试断言、`e2e-verify.cjs`、`data/**`、`README.md`（本轮无需改动）。

---

## IMPLEMENTATION_TICKET_READINESS

> **`NOT_READY_FOR_TICKET_DECOMPOSITION`**

阻塞项（精确列表）：

1. **DEC-1**（配色）未决 → D-5 / D-6 票面无法确定。
2. **DEC-2**（Settings 页签）未决 → D-8 范围无法确定。
3. **DEC-3**（文案语言）未决 → D-7 / D-10 验收字符串无法确定。
4. **DEC-4**（「本页」页签）未决 → 决定 D-8 是否包含唯一的新增产品能力。
5. **DEC-5**（dogfood 门 vs 先实现）未决 → 决定这一批 ticket 是否可以启动。

非阻塞但必须携带的约束：人工 dogfood 门（B3）、`R-MIG-8` 真实 profile 备份、ECDICT 公开再分发权利链（B4）仍是独立硬门，不因本规格放宽。

本阶段**未创建**任何实施 ticket，也未生成 ticket DAG。

---

## NEXT_RECOMMENDED_PHASE

> 只推荐一个入口，不并行开启多个方向。

**`PHASE-DEC-1 — UX 集成未决项裁决 + 实施 ticket 分解`**

范围：

1. 用户对 DEC-1～DEC-5 逐项给出裁决（这是唯一的阻塞来源）；
2. 裁决回写 `docs/specs/2026-09-10-V0.1-UX-V1.2.1-集成规格.md` §10 与 §7；
3. 按 D-1～D-10 拆分垂直切片本地 ticket，并做 `/to-tickets` batch validation；
4. 若 DEC-5 裁定「先 dogfood」，则本阶段退化为 `PHASE-DOGFOOD`，ticket 分解推迟。

不在此阶段并行开启：真实 dogfood 执行、10k 扩容、发布/许可审计、CI 自动化。

---

## 附：本阶段可复现命令

```bash
# Phase 0 远端真相
git fetch --all --prune
git rev-parse origin/governance/restart-baseline-2026-09-04   # 期望 d5fa144…
git rev-parse origin/main                                      # 观测 58a86f7…

# Phase 2 输入文档
git show origin/main:docs/specs/2026-09-04-UX_SPEC_V1.2.1.md | shasum -a 256
# 期望 d6570918be68189c133ed1fc8756ddd3645aee968a01758f7a81db84548bbcc4

# Phase 3 实现事实抽查（只读）
grep -n "interface QuizQuestion" -A 12 extension/src/shared/types.ts
grep -n "释义暂不可用" -r extension/ ; echo "(应为空)"
grep -rn "detailZh\|nuance" extension/src ; echo "(应为空)"
```
