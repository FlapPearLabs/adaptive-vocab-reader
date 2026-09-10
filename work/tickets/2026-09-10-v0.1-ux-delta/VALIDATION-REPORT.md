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
