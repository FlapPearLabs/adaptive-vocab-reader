# DAG REPAIR & PARALLELISM VALIDATION REPORT

**阶段**：`PHASE-DAG-REPAIR` — 依赖语义纠正 + 最终 DAG / 并行度校验
**仓库**：`FlapPearLabs/adaptive-vocab-reader`
**日期**：2026-09-10
**性质**：**纯治理。未写生产代码、未派发 Zcode、未创建实现 worktree、未开始任何 T-VUX 票。**

---

## STARTING_HEAD

| 项 | SHA |
|---|---|
| 起始治理 HEAD（fresh `git fetch --all --prune` 实测） | `46d32b16fe797860d843f10a737da43b8738dcf0` ✅ 与任务预期一致 |
| live `origin/main` | `58a86f77b0358a96c04e7e07baa9900f33186813` |
| `merge-base(governance, main)` | `58a86f77b0358a96c04e7e07baa9900f33186813`（main 已是治理分支祖先） |
| 生产代码基线 | `247ef89f45df5c623c1de768d098230600de9498` |

**生产代码自验证基线以来是否变更**：**否**。`247ef89..origin/main` 的差异仅 `AGENTS.md`(+6) 与 `data/README.md`(+80/-4)——均为文档，`extension/ scripts/ tests/ data/derived/ dist/ e2e-verify.cjs package.json` 零差异。**未触发 `STOP: PRODUCTION_BASELINE_DRIFT`。**

---

## RESULTING_HEAD

| 项 | SHA |
|---|---|
| 本阶段治理提交（`docs(governance): repair dependency semantics …`） | `58c54e11789fb727bca3a57b257b6e791fc29c2c` |
| 结果分支 HEAD（`governance/ux-spec-integration-2026-09-10`，普通 push，**非 force**） | `58c54e11789fb727bca3a57b257b6e791fc29c2c` |
| 变更范围 | 9 个文件，+688 / −56，**全部 docs/work**（`AGENTS.md` + 8 个治理/票据文档） |
| 生产代码变更 | **无** |

---

## SEMANTIC_DEPENDENCY_DEFINITION

### 定义（`AGENTS.md` §4.2.1）

`HARD_SEMANTIC_BLOCKER`：边 `A → B` 成立的**唯一**条件——**没有 A 产出的已验收输出，B 就无法正确实现，或无法独立满足其至少一条 Acceptance Criteria**。

### 反事实测试（counterfactual dependency test）

> 假设 A **永远不实施**。
> B 仍持有权威 base、`RULES.md`、现行 Spec、UX 设计与自己的 ticket。
> B 能否实现并独立通过其**全部** Acceptance Criteria？

- **是** → 该边**不是**硬语义依赖，**必须删除**。
- **否** → 保留，且必须在 ticket 内写明 A 产出的**哪一个具体实现物**（API / 导出常量 / 类型 / 组件 / 运行时服务 / 必需 DOM 契约 / 编译期接口）为 B 所必需。

### 关键澄清：上位权威 ≠ 兄弟票的「定义」

若 B 所需信息已存在于 **`RULES.md` / 现行 Spec / 冻结或集成后的 UX 文档**，则 A **并未「定义」**它——A 与 B 只是**各自消费同一权威契约**，二者之间**无边**。

### 阻塞传播不变式（`AGENTS.md` §4.2.4）

**`BLOCKED` 只沿 `HARD_SEMANTIC_BLOCKER` 边传播。**

**不**沿以下传播：共享文件；合并冲突风险；共用测试 harness；偏好的合并顺序；共同里程碑；同一实施波次；评审者可用性。

```text
T-A BLOCKED
T-B READY
T-C READY
```

若 B / C 不语义依赖 A → **B 与 C 仍为 `IMPLEMENTATION_ELIGIBLE`**。

---

## EDGE_AUDIT

### 边 A：`T-VUX-1 → T-VUX-2`

| 项 | 内容 |
|---|---|
| **上一版 rationale** | 「`T-VUX-2` 的浮层需渲染 `T-VUX-1` **定义**的 `释义暂不可用` 兜底文案与 `METADATA_RESOLUTION_FAILURE` 术语；**只消费、不重新定义**」 |
| **该 rationale 的证伪证据** | `释义暂不可用` 与元数据失败正交性**已存在于上位权威**：<br>· 冻结 `UX_SPEC_V1.2.1` **§2.1 行 87**：「Inspection Popover / Tooltip: May display the restrained fallback string `释义暂不可用`」<br>· 冻结 `UX_SPEC_V1.2.1` **§7.1 行 233**：「render `释义暂不可用` inside inspection surfaces without mutating underlying display decisions」<br>· 集成规格 **U-18 / U-42 / D-1**<br>· `RULES.md` **DEC-3**（把 `释义暂不可用` 列入 V0.1 中文术语表）<br>⇒ **T-VUX-1 并未「定义」它**；两票消费的是同一权威契约 |
| **具体实现物核查** | `T-VUX-2` 需要：`DictEntry` 既有字段（`phonetic`/`pos`/`translation`，来自 base `types.ts`）、`calculateTooltipPosition`（base `annotator.ts:154` 已存在）、Esc 事件处理（本票新增）。<br>**T-VUX-1 产出物中没有任何一项是 T-VUX-2 编译 / 实现 / 满足 AC 所必需的**——无 API、无导出常量、无类型、无组件、无运行时服务、无必需 DOM 契约、无编译期接口。<br>（唯一候选是「共用同一常量」，但两票改的是**同一文件**，任一方都可定义；且这只影响代码整洁，不影响 AC 可满足性。） |
| **反事实追问** | 假设 `T-VUX-1` **永不实施** → `T-VUX-2` 仍持有权威 base、`RULES.md`、集成规格、冻结 UX 与自己的 ticket → 能否实现并通过 AC-1~AC-10？ |
| **反事实结果** | ✅ **能**。AC-7（浮层显示 `释义暂不可用`）由上位权威直接支撑，无需等待任何 sibling。 |
| **判定** | **删除该边。** |

### 边 B：`T-VUX-1 → T-VUX-3`

| 项 | 内容 |
|---|---|
| **上一版 rationale** | 「① 胶囊样式的宿主注入样式块与 `T-VUX-1` 的 D-4/D-6 位于 `annotator.ts` **同一注入 style 块**；② 负向断言 7『不得引入第二个冲突的通用浮层几何体系』的可判定性依赖 `T-VUX-1` 已落地的几何基线」 |
| **① 的证伪** | 「同一注入样式模板」是**文本层面的共享面**。实测 `annotator.ts:54-133` 是单个模板字面量，但两票落在**不同 selector 区块**：`T-VUX-1` → `.avr-word`(L56) / `.avr-strong`(L62) / `.avr-strong-first`(L68,74) / `.avr-light`(L82) / `.avr-tooltip`(L89)；`T-VUX-3` → `.avr-selection-action`(L119)。**共享 CSS 块属于集成冲突，不构成「B 无法实现或无法通过 AC」。** |
| **② 的证伪** | 该 rationale 源自 `T-VUX-3` 负向断言 7 的**旧措辞**（「若复用则必须调用既有 seam」），它把「可选复用」写成了隐含前提。**已改写**：约束对象收窄为「禁止通用框架化」，并显式否定「依赖 T-VUX-1 / 须等待几何基线」的解读。改写后该 rationale 不再成立。 |
| **具体实现物核查** | `T-VUX-3` 需要：`showSelectionAction`（**自己的** `pageScanner.ts:150-171`）、`.avr-selection-action` 样式（**base 已存在**，L119-130）、`normalizedSelectedWord`（**自己的** L145-148）、`handleUserAction`（base 既有）。<br>**T-VUX-1 产出物中没有任何一项是 T-VUX-3 所必需的。** 胶囊定位是 ticket-local 的：`T-VUX-3` 可用自身几何（居中 / 下移 / 夹取）实现，且其 ticket 明确「复用 `calculateTooltipPosition` 允许但非强制」，而该函数**在 base 中已存在**（L154），**不需要 T-VUX-1 先落地**。 |
| **反事实追问** | 假设 `T-VUX-1` **永不实施** → `T-VUX-3` 能否实现并通过 AC-1~AC-10？ |
| **反事实结果** | ✅ **能**。AC-1/2/3（胶囊居中 / 下移 / 夹取）可用票内局部定位实现；AC-4~AC-10 与 `T-VUX-1` 无关。 |
| **判定** | **删除该边。** 新增分类：`SOFT_INTEGRATION_CONFLICT`（同 CSS 块 / 同文件），交由集成 lane 对账。 |

### 边 C / D：其余组合

| 候选边 | 反事实结果 | 判定 |
|---|---|---|
| `T-VUX-2 → T-VUX-3` | ✅ 能（两票互不引用） | 无边 |
| `T-VUX-1 → T-VUX-4` | ✅ 能 | 无边 |
| `T-VUX-2 → T-VUX-4` | ✅ 能 | 无边 |
| `T-VUX-3 → T-VUX-4` | ✅ 能。popup 三件套与 `content/` 面文件不相交；`popup.ts:29` / `popupNotebook.ts:1` 只读导入 `content/dictionary.ts`，而该模块**四票均禁改**，故是 **base 供给的只读面**，不是兄弟票产出 | 无边 |

### 边审计汇总

| 边 | 上一版 | 本轮 |
|---|---|---|
| `T-VUX-1 → T-VUX-2` | 语义依赖 | **删除** |
| `T-VUX-1 → T-VUX-3` | 语义依赖（上一轮新加） | **删除** |
| 其余 | 无 | 无 |

**净变动：删除 2 条边。**

---

## FINAL_SEMANTIC_DAG

```text
SEMANTIC_DEPENDENCY_DAG = ∅   （空图）
```

```text
        ┌──────────────────────────────────────────────┐
        │  AUTHORITATIVE_IMPLEMENTATION_BASE           │
        │  (immutable, pre-implementation governance)  │
        └───────────────────┬──────────────────────────┘
                            │
        ┌───────────┬───────┴───────┬───────────┐
        ▼           ▼               ▼           ▼
   T-VUX-1     T-VUX-2         T-VUX-3     T-VUX-4
   D-1/4/5/6   D-2/D-3         D-7         D-8/9/10
```

**四票互不依赖，无入边无出边。** 每票的 AC 只依赖：① 权威 base state；② 本票自身产出；③ 上位权威（`RULES.md` / 集成规格 / 冻结 UX）。**不存在隐藏 sibling 依赖、future 依赖或未文档化集成依赖。**

---

## INTEGRATION_CONFLICT_MATRIX

### 两两分类

| 对 | `SEMANTIC_DEPENDENCY` | `INTEGRATION_CONFLICT_RISK` | 责任文件 / 符号 |
|---|---|---|---|
| **1 ↔ 2** | **无** | **MEDIUM–HIGH** | `annotator.ts` 同一注入样式模板 `L54-133`（T1: `.avr-word`/`.avr-strong`/`.avr-strong-first`/`.avr-light`/`.avr-tooltip`；T2: `.avr-action-menu`）；`annotator.ts` 行为区（`installDelegatedHandlers` L228+、`pointerover` L271+、`showTooltip` L271-281、行内释义拼装 L360-385）；`e2e-verify.cjs` |
| **1 ↔ 3** | **无** | **MEDIUM** | `annotator.ts` 同一注入样式模板（T1 头部区块 L56-101 vs T3 尾段 L119-130，**不相邻但同字面量**）；`e2e-verify.cjs` |
| **1 ↔ 4** | **无** | **NONE** | 文件不相交；仅 `e2e-verify.cjs` 共享（不计入本对） |
| **2 ↔ 3** | **无** | **LOW–MEDIUM** | `annotator.ts` 注入样式模板（T2 `.avr-action-menu` L102-111 vs T3 `.avr-selection-action` L119-130，**相邻区域**）；`calculateTooltipPosition`（L154）**两票均无义务修改**；`e2e-verify.cjs` |
| **2 ↔ 4** | **无** | **NONE** | 文件不相交 |
| **3 ↔ 4** | **无** | **NONE** | 文件不相交 |

### 共享面清单

| 共享面 | 精确位置 | 涉及票 | 风险 | 性质 |
|---|---|---|---|---|
| 注入样式模板字面量 | `annotator.ts:54-133` | 1 / 2 / 3 | **HIGH** | `SOFT_INTEGRATION_CONFLICT` |
| `annotator.ts` 行为代码 | `installDelegatedHandlers`(L228+)、`pointerover`(L271+)、`showTooltip`(L271-281)、行内释义(L360-385) | 1 / 2 | **MEDIUM** | 同上 |
| `calculateTooltipPosition` | `annotator.ts:154`（调用点 `positionTooltip` L184） | 2 / 3 | **LOW** | 语义上**无人需要改**；仅当实现主动选择扩展签名时才可能触碰 |
| `pageScanner.ts` | `showSelectionAction`(L150-171) | 3 | **NONE** | 独占 |
| popup 三件套 | `popup.ts` / `popupNotebook.ts` / `popup.html` / `popup.css` | 4 | **NONE** | 独占 |
| **E2E harness** | `e2e-verify.cjs`（2262 行）；**集中式 `FAILURE_TABLE` L28-43**；各阶段断言块 | 1 / 2 / 3 / 4 | **HIGH** | `SHARED_TEST_SURFACE` |
| 构建/清单 | `extension/manifest.json` / `build.mjs` | 1 / 2 / 3（**条件性**） | **LOW** | 大概率无改动 |
| 只读 base 模块 | `extension/src/content/dictionary.ts`（`popup.ts:29`、`popupNotebook.ts:1`） | 4 消费 | **NONE** | 四票均禁改 → 不构成冲突 |

**强制规则**：以上**任一关系都不产生 DAG 边**。HIGH 冲突风险**不等于**语义依赖。

---

## PARALLEL_EXECUTION_PLAN

### 波次比较

| 方案 | 并发度 | 说明 | 采用 |
|---|---|---|---|
| **SERIAL** `1→2→3→4` | 1 | 把拓扑序当强制串行调度器。**属全局串行化瓶颈** | ❌ |
| **CONSERVATIVE PARALLEL** | 4 | 无硬 blocker 的同时起飞；硬后继待前驱验收后起飞。本例无硬后继 ⇒ 与下者等价 | ⚪ 等价 |
| **MAXIMUM SAFE PARALLEL** | **4** | 全部语义独立票从**同一权威 base** 起飞，即便存在集成冲突，只要集成能安全对账 | ✅ **采用** |

**选定并发度 = 4（最大安全并发）。** 依据：DAG 为空 ⇒ 四票均为 `IMPLEMENTATION_ELIGIBLE`；集成冲突已由显式集成 lane（§INTEGRATION_LANE）承接，属**可安全对账**。

### Lane 模型

```text
AUTHORITATIVE_IMPLEMENTATION_BASE  (pre-implementation governance HEAD, 不可变)
       |
       +---- lane/T-VUX-1   →  accepted/T-VUX-1
       +---- lane/T-VUX-2   →  accepted/T-VUX-2
       +---- lane/T-VUX-3   →  accepted/T-VUX-3
       +---- lane/T-VUX-4   →  accepted/T-VUX-4
```

每 lane 必须：同一不可变 base 起分支 · 隔离 git worktree · 一票一 lane · 遵循 TDD · 跑票内测试 · 跑要求的回归门禁 · 产出精确 HEAD · 接受独立 fresh 评审。

**通过的 lane 不得为了「等一个无关的阻塞兄弟票」而被判定无效。**

---

## BLOCK_PROPAGATION_RULE

> **`BLOCKED` 状态只沿 `HARD_SEMANTIC_BLOCKER` 边传播。**

**不**沿以下任何一项传播：

- 共享文件
- 合并冲突风险
- 共用测试 harness
- 偏好的合并顺序
- 共同里程碑
- 同一实施波次
- 评审者可用性

```text
T-A BLOCKED
T-B READY
T-C READY
```

若 B / C 并不语义依赖 A → **B 与 C 保持 `IMPLEMENTATION_ELIGIBLE`**。

本批次实例：DAG 为空 ⇒ **任一票阻塞都不影响其余三票开工**。

---

## IMPLEMENTATION_BASE_RULE

```text
AUTHORITATIVE_IMPLEMENTATION_BASE
  = 最终验收的 pre-implementation governance HEAD
  = governance/ux-spec-integration-2026-09-10 的验收 HEAD（不可变）
```

| 票 | base |
|---|---|
| `T-VUX-1` | `AUTHORITATIVE_IMPLEMENTATION_BASE`（同一值） |
| `T-VUX-2` | `AUTHORITATIVE_IMPLEMENTATION_BASE`（同一值） |
| `T-VUX-3` | `AUTHORITATIVE_IMPLEMENTATION_BASE`（同一值） |
| `T-VUX-4` | `AUTHORITATIVE_IMPLEMENTATION_BASE`（同一值） |

**同一并行波次内的 ticket 一律从这同一个不可变 base 起飞，不从兄弟票 HEAD 起飞。** 只有**真正的语义后继**才从「已验收前驱 HEAD」起分支——本批次无此类后继。

该 base 必须自包含：最新上游 main + 冻结 UX 源 + 集成 UX 规格 + 最新前端设计权威 + 已闭合产品决策（`DEC-1`~`DEC-5`）+ 当前 DAG 治理规则（`AGENTS.md` §4.2）+ 完整 ticket 批次 + 当前校验报告。

**不使用「本分支 HEAD」表述**：本分支在外部审查期间仍会被追加提交；若审查通过，该追加提交本身即为 `AUTHORITATIVE_IMPLEMENTATION_BASE`。

**已废止的旧规则**：`T-VUX-1 base = origin/main`（`origin/main` 不含上述任何构件）；`T-VUX-2/3/4 base = 上一票合并后 HEAD`（在 DAG 为空时会错误地串成链）。

---

## INTEGRATION_LANE

```text
accepted/T-VUX-1   accepted/T-VUX-2   accepted/T-VUX-3   accepted/T-VUX-4
        |                  |                  |                  |
        +------------------+------------------+------------------+
                                   |
                                   v
                    integration/v0.1-ux-delta
```

### 集成 lane 负责

- 分支组合
- 文本冲突解决
- 共享 `annotator.ts` 对账（尤其 `L54-133` 注入样式模板）
- 共享 CSS 区块对账
- 共享 `e2e-verify.cjs` 对账（尤其 `FAILURE_TABLE` L28-43）
- 重复 helper / 常量整合（例如 `释义暂不可用` 是否需要收敛为单一常量——**这是集成事项，不是依赖**）
- **不改变产品范围**的兼容性修复
- 全量门禁：`npm run typecheck` · `npm test`（全 283+） · `python3 -B -m unittest discover -s tests -p "test_*.py"` · `npm run build` · `AVR_E2E_NO_SANDBOX=1 npm run test:e2e`（全阶段）
- 集成后的 fresh 独立评审

### 集成 lane 禁止

- 发明新的产品行为
- 重定义测评契约（`QuizQuestion` / `QuizAnswer` / 进度口径）
- 实现 Settings（DEC-2）或「本页」（DEC-4）
- 改写 `WordState` 语义或引入新持久化 schema

### 治理发现义务

若集成暴露**真实的隐藏语义依赖**，必须记录为 **governance finding** 供后续 DAG 修正。

**仅凭出现合并冲突，不构成存在语义依赖的证据。**

### 建议集成顺序（偏好，非阻塞）

```text
T-VUX-2  →  T-VUX-3  →  T-VUX-1  →  T-VUX-4
```

理由：前三票按注入样式模板内位置**由中到外**合并，减少同一字面量反复改写；`T-VUX-4` 文件不相交，排最后以简化 `FAILURE_TABLE` 对账。**该顺序可任意调整，任一票先完成即可先集成。**

---

## AGENTS_GOVERNANCE_CHANGES

在 `AGENTS.md` 新增 **§4.2「语义依赖 DAG、集成冲突与执行调度（三者必须分开建模）」**，紧接 §4.1 之后（原 §5 顺延，编号未变）：

| 小节 | 内容 |
|---|---|
| §4.2.1 | **语义依赖 DAG**（`SEMANTIC_DEPENDENCY_DAG`）：只含硬验收依赖；给出 `HARD_SEMANTIC_BLOCKER` 定义与**反事实测试**；要求保留边时写明 A 的具体实现物；禁止为共享短字符串造边；确立「上位权威 ≠ 兄弟票定义」 |
| §4.2.2 | **集成冲突图**（`INTEGRATION_CONFLICT_MAP`）：同文件 / 同符号 / 同 CSS 块 / manifest-build 重叠 / 共用 E2E harness；`NONE/LOW/MEDIUM/HIGH` 分级；**一律不自动产生 DAG 边** |
| §4.2.3 | **执行调度器**（`EXECUTION_SCHEDULER`）：硬 blocker 满足即 `IMPLEMENTATION_ELIGIBLE`；可并发于隔离 worktree；**应最大化安全并行度**；**不得**把拓扑序当强制串行；共同起点为 `AUTHORITATIVE_IMPLEMENTATION_BASE`；目标是 throughput + failure isolation + correctness，不是零冲突 |
| §4.2.4 | **阻塞传播不变式**（`BLOCK_PROPAGATION_RULE`）：`BLOCKED` 只沿 `HARD_SEMANTIC_BLOCKER` 传播；列出不传播的 7 类关系；给出 `T-A BLOCKED / T-B READY / T-C READY` 示例 |
| §4.2.5 | **集成 lane**：职责、禁止项、治理发现义务；明确「合并冲突 ≠ 语义依赖」 |
| §4.2.6 | **批次文档要求**：README 必须分别列出 `SEMANTIC DAG` / `INTEGRATION CONFLICT MAP` / `PARALLEL EXECUTION PLAN` / `INTEGRATION ORDER`；拓扑模拟**不得**被解释为强制串行调度器 |

**已核验**：`AGENTS.md` 原有内容中**不存在**「ticket 必须串行开发」的授权规则。全文唯一一处「串行」位于 §5，原文为「一个**串行任务**只使用一个 `review/<主题>` 临时分支」——这是**分支卫生**约定，与 ticket 调度无关。批次 README 上一版的「项目约定 ticket 串行执行」是对该句的**误读外推**，已删除。

---

## TICKETS_CHANGED

| 文件 | 变更 |
|---|---|
| `work/tickets/2026-09-10-v0.1-ux-delta/README.md` | 删除「串行约定」框架；重构为 **5 个独立章节**：§1 SEMANTIC DAG（含反事实表、两条边删除理由）、§2 INTEGRATION CONFLICT MAP（含精确行号）、§3 PARALLEL EXECUTION PLAN（含三方案比较）、§4 INTEGRATION ORDER、§5 集成 lane 职责；新增 §6 IMPLEMENTATION BASE RULE、§7 BLOCK 传播规则；批次状态表更新文档基线与 DAG 空图；硬约束由 10 条扩为 14 条（新增 lane 隔离 / 不越界改他人区块 / BLOCKED 不跨票 / lane 通过即有效）；门禁区分 lane 级与集成级 |
| `01-reading-presentation-integrity.md` | `Blockers` = **—（无硬语义 blocker）**；`Base` = `AUTHORITATIVE_IMPLEMENTATION_BASE`（注明不是 sibling HEAD）；新增「并行 lane」行 |
| `02-word-inspection-popover.md` | **删除 `T-VUX-1` blocker**，并在票头写明删除理由与反事实结果；`Base` 改为同一权威 base；D-2 元数据失败段补「权威来源」引注（冻结 UX §2.1 行 87 / §7.1 行 233、U-18/U-42/D-1、DEC-3）与「两票分别实现同一契约」的归属说明；新增 §8.1 集成冲突提示 |
| `03-selection-recovery-pill.md` | **删除 `T-VUX-1` blocker**，并在票头写明删除理由与反事实结果；`Base` 改为同一权威 base；**负向断言 7 改写**为「禁止通用框架化」并显式否定「依赖 T-VUX-1 / 须等待几何基线」；新增 §8.1 集成冲突提示（含 `annotator.ts` selector 区块行号） |
| `04-popup-v0-1-alignment.md` | `Base` 由「已验收 `T-VUX-3` HEAD」改为同一权威 base；`Blockers` 保留 **—**；新增 §8.1 集成冲突提示（含只读 base 模块 `content/dictionary.ts` 与 E2E selector 依赖） |
| `VALIDATION-REPORT.md` | 追加「复审追加二 — `PHASE-DAG-REPAIR`」段（S-1 定义 / S-2 逐边审计 / S-3 冲突图 / S-4 调度复核 / S-5 修复清单） |
| `work/governance/2026-09-10-preimpl-review/REPORT.md` | 顶部新增**取代声明**（该报告 §4.3/§7.2 的 `T-VUX-3 ← T-VUX-1` 语义判定已被取代），保留原文存史 |
| `AGENTS.md` | 新增 §4.2（6 个小节） |

---

## BATCH_VALIDATION

| `AGENTS.md` §4.1 规则 | 结果 | 说明 |
|---|---|---|
| 1 依赖一致性（无隐藏 sibling / future 依赖） | **PASS** | DAG 为空；逐票反事实验证通过 |
| 2 独立可验收 | **PASS** | 4/4 票在无任何兄弟票产出时均可实现并独立通过 AC |
| 3 禁止 forward dependency | **PASS** | 无 future 依赖 |
| 4 source contract 不越权 | **PASS** | 10/10 D-* 可追溯至集成规格 §7；无新阈值/算法/policy |
| 5 约束可执行性 | **PASS** | 允许修改面与禁止面不冲突（各票 selector 区块互斥、文件边界清晰） |
| 6 source coverage 双向闭环 | **PASS** | 正向 0 缺口；反向 0 ticket-only requirement |
| 7 拓扑模拟 | **PASS** | 4/4（无 blocker ⇒ 每票仅依赖 base + 自身产出） |
| 8 README/index 一致性 | **PASS** | README blocker 列全为 **—**，与四票正文一致 |
| 9 失败先修 ticket | **PASS** | 本轮发现的依赖误判已修 ticket 后才复算 |
| 10 复杂度适配 | **PASS** | 系统走了反事实审计 + 冲突矩阵，未新增冗余字段 |
| 11 数据依赖示例验证 | **PASS** | 失败路径夹具来源已在前轮改为 E2E fixture 自造 / DOM 单测（真实词包无自然缺失词条） |
| 12 浏览器部署 seam | **PASS** | 四票均列出 `manifest.json` + `build.mjs` 交付路径 |

**`TICKET_BATCH_VALIDATION = PASS`**

**拓扑模拟的重定位**：模拟仍用于**校验依赖**（无环、无 forward、无隐藏边），但**不再被解释为强制串行调度器**。模拟结论是「四票可同时起飞」，而非「必须按 1→2→3→4」。

---

## OPEN_BLOCKERS

| # | 级别 | 内容 | 影响 | 处置 |
|---|---|---|---|---|
| **B-1** | P2（**条件性**，仅影响 `T-VUX-1` 单测方式） | `T-VUX-1` §6 需要 DOM/jsdom seam 来测行内释义拼装；该 seam 当前**未核验**是否存在 | 不影响 AC 可满足性 | 已写成 `T-VUX-1` §8.1 **实施首步**：先核验，不存在则建立可注入 seam（不得仅为可测性改变生产行为）；确实无法建立则如实标注并改用行为级 Chrome 验证，**不得静默降级为「不测」** |
| **B-2** | P2（同上） | `T-VUX-3` `showSelectionAction` 为模块级局部函数，单测需同样处理 | 同 B-1 | 已写入 `T-VUX-3` §6.1 |
| **B-3** | P2 | `e2e-verify.cjs` 的 `tempDir` 夹具隔离性未核验（并行 lane 下**更值得注意**） | 若确认为工作树内共享路径，并行 lane 的 E2E 可能互相覆盖 | 已列为 `T-VUX-1` §8.1 实施前检查项。**注意：本项因引入并行而从「串行下不发生」升级为需确认**——这是并行化的**已知代价**，由各 lane 使用独立 worktree 天然缓解，但仍须核验。**只报告，不顺手改** |
| **B-4** | P3 | 本地未推送分支 `implement/dogfood-realignment`（10 commits，merge-base `333c362`）仍在工作树中 | 不属本批权威 | 不触碰；清理须单独授权 |
| **B-5** | P3（发布级） | ECDICT 中文释义公开再分发权利链仍 UNKNOWN | 仅阻断公开分发 | 与本地 V0.1 dogfood readiness **不得混淆** |

**是否阻断开工**：**无**。B-1/B-2 是票内实施首步的核验动作；B-3 是并行化引入的已知确认项，处理方式已写明。

---

## PRE_IMPLEMENTATION_VERDICT

```text
PRE_IMPLEMENTATION_VERDICT = READY_FOR_EXTERNAL_PRE_IMPLEMENTATION_REVIEW
```

| 门 | 结果 |
|---|---|
| 远端真相一致 / 无生产代码漂移 | **PASS** |
| `HARD_SEMANTIC_BLOCKER` 定义已确立（含反事实测试） | **PASS** |
| 边审计（两条误判边均已删除） | **PASS** |
| `SEMANTIC_DEPENDENCY_DAG` 为唯一依赖权威 | **PASS**（空图） |
| 集成冲突与语义依赖已分离建模 | **PASS** |
| 阻塞传播不变式已成文 | **PASS** |
| 并行 lane 模型 + 共同不可变 base 已成文 | **PASS** |
| 集成 lane 职责已成文 | **PASS** |
| `AGENTS.md` 治理规则已加固（§4.2） | **PASS** |
| 四票 metadata 已与真实 DAG 对齐 | **PASS** |
| README 已按四模型重构 | **PASS** |
| `TICKET_BATCH_VALIDATION` | **PASS** |
| 生产代码变更 | **NONE** |
| 未派发 Zcode / 未创建实现 worktree / 未开始任何 T-VUX 票 | **已遵守** |

### 边界声明

- ❌ 未写生产代码
- ❌ 未派发 Zcode
- ❌ 未创建实现 worktree
- ❌ 未开始 `T-VUX-1/2/3/4`
- ❌ 未合并 `main`、未关闭 Issue、未删除分支、未发布、未 force-push

**已 STOP，等待外部独立评审。**
