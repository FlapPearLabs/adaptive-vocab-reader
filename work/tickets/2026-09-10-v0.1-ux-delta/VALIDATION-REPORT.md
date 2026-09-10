# Ticket 批次校验报告 — `2026-09-10-v0.1-ux-delta`

| 项 | 值 |
|---|---|
| 校验时间 | 2026-09-10（`PHASE-DEC-TICKETS`） |
| 校验基线 | `f22dd62730844cd63009d73bb1ea1dbf09f50904`（集成分支，已含冻结 UX 输入）；生产代码基线 `247ef89` |
| 校验对象 | `T-VUX-1` / `T-VUX-2` / `T-VUX-3` / `T-VUX-4` |
| **总判定** | **`TICKET_BATCH_VALIDATION = PASS`** |

---

## 1. 校验清单（§7 十三项）

| # | 检查项 | 方法 | 结果 |
|---|---|---|---|
| V-1 | **与 main 已实现工作重复** | 对 D-1~D-10 逐项 grep 源码 | **PASS** —— 十项 delta 均**未实现**（证据见 §2） |
| V-2 | **依赖环** | 拓扑模拟：`T-VUX-1 → T-VUX-2`；`T-VUX-3`、`T-VUX-4` 无入边 | **PASS** —— 无环；唯一真实边为 `T-VUX-2 ← T-VUX-1` |
| V-3 | **两票拥有同一行为** | 逐票比对「允许修改范围」与 delta 归属 | **PASS** —— 见 §3 归属矩阵；文件边界仅在「共用注入样式块」处交叠，已用串行 base commit 消解 |
| V-4 | **意外恢复已取代要求** | 检索二元 `Need Gloss / I Know This`、`detailZh`/`nuance`/`ipa`/`zh`、红色强提示 | **PASS** —— 全部以「禁止/不得」出现；`need-gloss` 类模型零命中 |
| V-5 | **任何票实现 This Page** | grep `本页` / `This Page` | **PASS** —— 仅出现在 `T-VUX-4` 的**禁止项**与 `DEFERRED-BACKLOG.md` |
| V-6 | **任何票实现 Settings** | grep `Settings` / `设置` | **PASS** —— 仅出现在禁止项与「无 settings 持久化键」断言 |
| V-7 | **红色警示色被重新引入** | grep `#e74c3c` / `#c0392b` / `红色` | **PASS** —— 仅出现在 `T-VUX-1` 的**禁止与断言**（「不得为 `#c0392b`」「断言中不得出现红色」） |
| V-8 | **无理由的中英混排 UI 文案** | grep `Mark as Learning` | **PASS** —— 仅作为**被禁止示例**出现在 `T-VUX-2` / `T-VUX-3` |
| V-9 | **测评领域逻辑被重新设计** | 比对 `T-VUX-4` 负向断言与 `QuizQuestion` 契约 | **PASS** —— 明确禁止改 `QuizQuestion`/`QuizAnswer`/不确定下标/进度口径，禁止合并首测与每日校准 |
| V-10 | **元数据失败被建模为 WordState** | 比对 `T-VUX-1` / `T-VUX-2` 断言 | **PASS** —— 两票均有「零 `WordState` 写入」「不得按元数据可用性改写状态」的显式断言 |
| V-11 | **UX 工作发明新 schema / 持久化** | 检索四票的允许修改范围与负向断言 | **PASS** —— 四票均禁止新增持久化 schema、禁止迁移、禁止新增 storage 键 |
| V-12 | **确定性 E2E 被 MCP 工具替换** | grep `MCP`（ticket 正文内） | **PASS** —— 四票 ticket 正文**零 MCP 命中**；MCP 仅存在于独立 `SPIKE-CHROME-DEVPROFILE.md`，且该文明确「不得替换 E2E，二者互补」 |
| V-13 | **人工 dogfood 错误地阻塞实施开始** | 检查四票 blocker 与前置条件 | **PASS** —— 四票 blocker 均不含 dogfood；批次 README 硬约束第 10 条与 `FINAL-DOGFOOD-GATE.md` 明确 dogfood 为**实施后**验收门（DEC-5） |

## 2. V-1 证据：十项 delta 均未实现（fresh grep）

| Delta | 检索 | 结果 |
|---|---|---|
| D-1 `释义暂不可用` / `METADATA_RESOLUTION_FAILURE` | `extension/src` 全量 grep | **零命中** → 未实现 |
| D-2 Inspection Popover | `annotator.ts` 点击层为 `.avr-action-menu`，仅「会/不会」两按钮，无词头/音标/词性/释义 | 未实现 |
| D-3 Esc 关闭 | `Escape` / `keydown` grep（排除测试） | **零命中** → 未实现 |
| D-4 宿主排版隔离 | 注入样式仅 `color: inherit`，缺 `font-family/size/weight/line-height/letter-spacing: inherit !important` | 未实现 |
| D-5 行内释义格式 | 当前为 `【translation】` + `#c0392b` + `0.85em` + `vertical-align: super`，无词性前缀、无 `user-select:none` | 未实现 |
| D-6 琥珀下划线 | 当前 `#7f8c8d` 点线 / `#e74c3c` 2px 实线 | 未实现 |
| D-7 拖选胶囊居中上方 | 当前 `left = x`、`top = y + 6`（选区左下）、文案 `加入生词本` | 机制已实现，**呈现**未对齐 |
| D-8 popup `320px` 与导航 | 当前 `popup.css:26` = `380px`；两页签（测评 / 生词本） | 部分不同 → 需对齐 |
| D-9 生词本搜索 | `popup.ts` / `popupNotebook.ts` grep `search`/`搜索` | **零命中**（仅 `answers.filter`） → 未实现 |
| D-10 中文空状态 | `popupNotebook.ts` grep 空状态文案 | **零命中** → 未实现 |

## 3. V-3 证据：行为归属矩阵（无两票同权）

| 行为 | 归属票 | 其他票如何引用 |
|---|---|---|
| `METADATA_RESOLUTION_FAILURE` 术语 + `释义暂不可用` 文案 + tooltip 兜底 | **T-VUX-1** | T-VUX-2 **只消费**（AC-7），明确「不重新定义」 |
| 注入样式块：`.avr-word` 排版继承、琥珀下划线、行内释义样式 | **T-VUX-1** | T-VUX-3 仅改 `.avr-selection-action` 定位属性 |
| 浮层几何 seam（`calculateTooltipPosition`） | **T-VUX-1 不碰；T-VUX-2 复用/扩展** | T-VUX-3 允许复用但**非强制**，且不得新建第二套体系 |
| 点击层 UI（Inspection Popover）+ Esc | **T-VUX-2** | — |
| 选区机制（`normalizedSelectedWord`、事件绑定、竞态） | **保留不改**；T-VUX-3 仅改 `showSelectionAction` 定位与文案 | — |
| popup 导航 / 宽度 / 搜索 / 空状态 | **T-VUX-4** | — |
| 测评契约与估计展示 | **全部保留不改** | T-VUX-4 仅对齐标签与宽度 |

## 4. 每票「需保留」与「需新增」区分检查

| 票 | 已验证行为需保留（章节） | 新增 delta（章节） | 判定 |
|---|---|---|---|
| T-VUX-1 | §2 P-1~P-8（8 项） | §3 D-1 / D-4 / D-5 / D-6 | **PASS** |
| T-VUX-2 | §2 P-1~P-7（7 项） | §3 D-2 / D-3 | **PASS** |
| T-VUX-3 | §2 P-1~P-8（8 项） | §3 D-7（仅定位 + 文案） | **PASS** |
| T-VUX-4 | §2 P-1~P-9（9 项） | §3 D-8 / D-9 / D-10 | **PASS** |

## 5. 独立可验收性（拓扑模拟）

只完成声明 blockers 时，逐票能否完整施工并独立验收：

| 票 | 已完成的 blockers | 能否独立施工 | 能否独立验收 | 判定 |
|---|---|---|---|---|
| T-VUX-1 | 无 | 是 | 是（AC-1~AC-10 全部依赖 base state 与本票产出） | PASS |
| T-VUX-2 | T-VUX-1 | 是 | 是（`释义暂不可用` 由 T-VUX-1 提供，属已声明 blocker） | PASS |
| T-VUX-3 | 无 | 是 | 是（不依赖任何未来票） | PASS |
| T-VUX-4 | 无 | 是 | 是（不依赖任何未来票） | PASS |

## 6. 源覆盖双向闭环（集成规格 §7 → ticket）

| Delta | 处置 | 反向可追溯 |
|---|---|---|
| D-1 | T-VUX-1 | U-17 / U-18 / U-42 |
| D-2 | T-VUX-2 | U-9 / U-20 / U-24 |
| D-3 | T-VUX-2 | U-26 |
| D-4 | T-VUX-1 | U-7 |
| D-5 | T-VUX-1 | U-12 |
| D-6 | T-VUX-1 | U-13 / U-19 |
| D-7 | T-VUX-3 | U-14 / U-27 |
| D-8 | T-VUX-4 | U-33 / U-35 / U-36 / U-37 |
| D-9 | T-VUX-4 | U-35 |
| D-10 | T-VUX-4 | U-43 |

**10 / 10 覆盖，无 ticket-only requirement，无未处置 requirement。**

## 7. 结论

`TICKET_BATCH_VALIDATION = PASS`

- 无依赖环、无重复实现、无行为同权、无已取代要求复活；
- 延后项（本页 / Settings）未被任何票实现，且每票均有明确禁止；
- DEC-1（琥珀）、DEC-2（无 Settings）、DEC-3（中文优先）、DEC-4（无本页）、DEC-5（dogfood 后置）在四票中均有落地约束；
- 每张票都区分了「已验证行为需保留」与「新增 delta」。

**本批次仍不授权开始开发**：`T-VUX-1~4` 的实施须用户另行明确授权（见 `RULES.md` 与 `AGENTS.md`）。

---

# 复审追加 — `PHASE-PREIMPL-REVIEW`（2026-09-10 实施前）

> 上一轮 `PASS` **不足以**支撑开工：本阶段以**当前仓库权威**（含 `AGENTS.md` §4.1 批次校验规则）重新复审，发现并修复 5 处缺陷、补正 1 条真实依赖边、并复核拓扑。
> 完整证据见 [`work/governance/2026-09-10-preimpl-review/REPORT.md`](../../governance/2026-09-10-preimpl-review/REPORT.md)。

## R-1 修复的缺陷

| # | 缺陷 | 触发证据 | 修复 |
|---|---|---|---|
| P-1 | 起始票 base 写为 `origin/main` | `origin/main@58a86f7` 不含 DEC-1~5 / 集成规格 / 冻结 UX / 本批次 | 改为 base = **pre-implementation governance HEAD**（README / `T-VUX-1` §8 / `T-VUX-2` §8）；明确**拒绝**「本分支 HEAD」表述 |
| P-2 | 浏览器部署 seam 缺失 | `manifest.json` 声明 `content_scripts.js=["content.js"]`；`build.mjs` 打包 `content/index.ts → dist/content.js` | `T-VUX-1` / `T-VUX-2` / `T-VUX-3` / `T-VUX-4` 补列部署 seam；完成判据加「须经 `dist/` 真实产物在 Chrome 中确认」（`AGENTS.md` §4.1-12） |
| P-3 | `T-VUX-3` AC-4 断言了 UX **未标 Normative** 的文案与图标 | 冻结 UX §4.3 胶囊视觉描述未被标记 Normative | AC-4 收窄为「简洁中文且无中英混排」；文案与图标交由实现者判断 |
| P-4 | `T-VUX-1` AC-1 断言「悬停」覆盖不全 | tooltip 有两条显示路径（`pointerover`→`showTooltip`；`click`→`showUnresolvedTooltip`） | AC-1 改为按**行为**断言「所有 tooltip 显示路径」 |
| P-5 | `T-VUX-3` 单测要求无可行 seam | `showSelectionAction` 为模块级局部函数；jsdom 环境未核验 | 补 §6.1 DOM seam 要求 + 行为级 Chrome 兜底；不得静默降级为「不测」 |

## R-2 依赖与拓扑复算

| 项 | 结果 |
|---|---|
| 语义依赖边 | `T-VUX-2 ← T-VUX-1`；**`T-VUX-3 ← T-VUX-1`（本轮新补正，原仅写作「执行顺序」）**；`T-VUX-4` 无入边 |
| 顺序约束（非依赖） | `T-VUX-1`/`T-VUX-3` 共改 `annotator.ts` 注入 style 块；四票共改 `e2e-verify.cjs` |
| 环 | 无 |
| forward dependency | 无 |
| 执行顺序 | `T-VUX-1 → T-VUX-2 → T-VUX-3 → T-VUX-4`（串行不变） |

## R-3 新增记录

1. **失败路径夹具来源**：D-1 / `T-VUX-2` AC-7 的「元数据缺失」在真实词包中**不存在自然词条**，夹具只能由 E2E fixture 页面自造或纯 DOM 单测提供；**禁止**依赖伪造的真实词包数据。已写入 `T-VUX-1` §6.0 与 `T-VUX-2` §6.0。
2. **`T-VUX-4` 既有 selector 稳定性**：`e2e-verify.cjs:1269/1300/1340` 依赖 `.popup-tab:not(.notebook-tab)`；调整页签结构须同步。
3. **`e2e-verify.cjs` `tempDir` 隔离性**为 P2 待核验项（串行执行下不发生），已写入 `T-VUX-1` §8.1 实施前检查。

## R-4 复审判定

| 门 | 结果 |
|---|---|
| 依赖正确性（含新增语义边） | **PASS** |
| 独立可验收（4/4 拓扑模拟） | **PASS** |
| 所有权唯一 | **PASS** |
| source coverage 双向闭环 | **PASS**（10/10 D-*；0 ticket-only） |
| 浏览器部署 seam | **PASS**（本轮补齐） |
| 共享文件 / 集成风险 | **PASS**（已识别，串行消解，无伪依赖） |
| **`TICKET_BATCH_VALIDATION`** | **PASS** |

---

# 复审追加二 — `PHASE-DAG-REPAIR`（2026-09-10，依赖语义纠正）

> 外部实施前评审指出：上一轮仍**混淆了语义依赖 / 集成冲突 / 执行调度**，把「共用注入样式块」「共用 E2E 文件」「偏好的合并顺序」当成了依赖边。
> 本轮按 `AGENTS.md` §4.2 的严格定义重做，正式**删除两条被误判的边**，并把三个模型拆开建模。
> 完整报告见 [`work/governance/2026-09-10-dag-repair/REPORT.md`](../../governance/2026-09-10-dag-repair/REPORT.md)。

## S-1 依赖语义的定义（`HARD_SEMANTIC_BLOCKER`）

边 `A → B` 成立的**唯一**条件：没有 A 的**已验收输出**，B 无法正确实现或无法独立满足其**至少一条** AC。判定走**反事实测试**。

**`BLOCKED` 只沿该边传播**，不沿共享文件 / 合并冲突 / 共用测试 harness / 偏好合并顺序 / 共同里程碑 / 同一波次 / 评审者可用性传播。

## S-2 逐边审计

| 边 | 上一版判定 | 反事实结果 | 本轮判定 |
|---|---|---|---|
| `T-VUX-1 → T-VUX-2` | 语义依赖（理由：浮层需 T-VUX-1「定义」`释义暂不可用`） | **能独立通过** —— 该文案与元数据失败正交性来自**上位权威**（冻结 UX §2.1 行 87 / §7.1 行 233；集成规格 U-18/U-42/D-1；`RULES.md` DEC-3），T-VUX-1 并未「定义」它；T-VUX-2 不需要 T-VUX-1 的任何实现物（无 API/常量/类型/组件/服务/DOM 契约/接口需求） | **删除** |
| `T-VUX-1 → T-VUX-3` | 语义依赖（理由：共用注入样式块 + 几何断言可判定性） | **能独立通过** —— 胶囊局部定位可在 base 既有 `.avr-selection-action` 样式与函数上独立实现；负向断言 7 已改写为「禁止通用框架化」，不再隐含对 T-VUX-1 的等待 | **删除** |
| `T-VUX-2 → T-VUX-3` | — | 能（互不引用） | 无边 |
| `T-VUX-* → T-VUX-4` | — | 能（popup 只只读消费 base 的 `content/dictionary.ts`，四票均禁改） | 无边 |

**`SEMANTIC_DEPENDENCY_DAG = ∅`** → 四票同时 `IMPLEMENTATION_ELIGIBLE`，并发度 **4**。

## S-3 集成冲突图（**非依赖**）

| 共享面 | 具体位置 | 票 | 风险 |
|---|---|---|---|
| `annotator.ts` 注入样式模板字面量 | `annotator.ts:54-133`（T1: L56/62/68/74/82/89；T2: L102/111；T3: L119） | 1/2/3 | **HIGH** |
| `annotator.ts` 行为代码 | `installDelegatedHandlers` L228+、`pointerover` L271+、`showTooltip` L271-281、行内释义 L360-385 | 1/2 | **MEDIUM** |
| `annotator.ts` `calculateTooltipPosition` | L154（调用点 L184） | 2/3（**均无义务修改**） | **LOW** |
| `pageScanner.ts` | `showSelectionAction` L150-171 | 3（独占） | **NONE** |
| popup 三件套 | 全部 | 4（独占） | **NONE** |
| `e2e-verify.cjs`（2262 行） | 全文；集中式 `FAILURE_TABLE` L28-43 | 1/2/3/4 | **HIGH** |
| `manifest.json` / `build.mjs` | 条件性 | 1/2/3 | **LOW** |
| `content/dictionary.ts` | `popup.ts:29`、`popupNotebook.ts:1` 只读导入 | 4（消费） | **NONE** |

**HIGH 冲突风险 ≠ 语义依赖**；不产生任何 DAG 边。

## S-4 拓扑与调度复核

| 项 | 结果 |
|---|---|
| 依赖环 | 无（DAG 为空） |
| forward dependency | 无 |
| 隐藏 sibling 依赖 | 无（已逐票反事实验证） |
| forward acceptance 依赖 | 无 |
| 同权行为 | 无（各自 selector 区块 / 各自文件） |
| **`TICKET_BATCH_VALIDATION`** | **PASS** |

**调度器**：SERIAL（并发 1）不采用；CONSERVATIVE PARALLEL 与 MAXIMUM SAFE PARALLEL 在本例等价（DAG 为空，无硬后继需等待）→ 采用 **MAXIMUM SAFE PARALLEL，并发 4**。

**拓扑模拟仍有效**，但**不再被解释为强制串行调度器**。

## S-5 本轮修复的治理缺陷

| # | 缺陷 | 修复 |
|---|---|---|
| S-5-1 | 批次 README 声称「项目约定 ticket 串行执行」 | **该约定在仓库权威中不存在**（`AGENTS.md` 唯一「串行」指「一个串行**任务**用一条 `review/` 分支」，属分支卫生）→ 已删除该说法，改为四个独立模型 |
| S-5-2 | `T-VUX-2` / `T-VUX-3` 被错误声明 blocker | 删除两条边，票内注明反事实结果与权威来源 |
| S-5-3 | `T-VUX-3` 负向断言 7 可被读作「依赖 T-VUX-1 几何基线」 | 改写为「禁止通用框架化」，并显式否定「依赖 T-VUX-1 / 须等待几何基线」的解读 |
| S-5-4 | `T-VUX-2/3/4` base 写成「前驱票 HEAD」 | 统一改为同一 `AUTHORITATIVE_IMPLEMENTATION_BASE` |
| S-5-5 | `AGENTS.md` 无「语义依赖 vs 集成冲突 vs 调度」的区分规则 | 新增 §4.2（含 4.2.1~4.2.6） |
