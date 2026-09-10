# Ticket 批次：V0.1 UX Delta（2026-09-10）

## 批次状态

| 项 | 值 |
|---|---|
| 批次 ID | `2026-09-10-v0.1-ux-delta` |
| 状态 | **`READY_FOR_AGENT_IMPLEMENTATION`（待用户明确「开始开发」授权；ticket 本身不授权开发）** |
| 上游规格 | [`docs/specs/2026-09-10-V0.1-UX-V1.2.1-集成规格.md`](../../docs/specs/2026-09-10-V0.1-UX-V1.2.1-集成规格.md) |
| 上游裁决 | `DEC-1`~`DEC-5` 全部 CLOSED（落点 `RULES.md`「V0.1 呈现层与流程裁决」） |
| 文档基线 | `46d32b16fe797860d843f10a737da43b8738dcf0`（`governance/ux-spec-integration-2026-09-10`，已含冻结 UX 输入 + 已闭合决策 + 本批次 + `AGENTS.md` §4.2） |
| 生产代码基线 | `247ef89f45df5c623c1de768d098230600de9498`（`origin/main` 上最后一次生产代码变更；`333c362`/`e4f947b`/`58a86f7` 均为 docs-only） |
| 已验证实现基线 | RESUME-01（2026-09-09）：typecheck 0 / vitest 283 / Python data tests 12 / build OK / `E2E ALL PASS` |
| **语义依赖 DAG** | **空图**（四票互不依赖）→ 并发度 **4** |
| 批次校验报告 | [`VALIDATION-REPORT.md`](VALIDATION-REPORT.md) |

## Ticket 清单

| ID | Ticket | 文件 | 覆盖 Delta | Blockers |
|---|---|---|---|---|
| `T-VUX-1` | Reading Presentation Integrity | [`01-reading-presentation-integrity.md`](01-reading-presentation-integrity.md) | D-1 / D-4 / D-5 / D-6 | **—** |
| `T-VUX-2` | Word Inspection Popover | [`02-word-inspection-popover.md`](02-word-inspection-popover.md) | D-2 / D-3 | **—** |
| `T-VUX-3` | Selection Recovery Pill | [`03-selection-recovery-pill.md`](03-selection-recovery-pill.md) | D-7 | **—** |
| `T-VUX-4` | Popup V0.1 Alignment | [`04-popup-v0-1-alignment.md`](04-popup-v0-1-alignment.md) | D-8 / D-9 / D-10 | **—** |

非产品工具候选（独立，不属本批执行序列）：[`SPIKE-CHROME-DEVPROFILE.md`](SPIKE-CHROME-DEVPROFILE.md)

延后项（**不在本批**）：[`DEFERRED-BACKLOG.md`](DEFERRED-BACKLOG.md)
最终验收门（**本阶段不执行**）：[`FINAL-DOGFOOD-GATE.md`](FINAL-DOGFOOD-GATE.md)

## 1. SEMANTIC DAG（**硬验收依赖**，`AGENTS.md` §4.2.1）

```text
（空图 —— 四票之间不存在任何硬语义依赖）
```

**`SEMANTIC_DEPENDENCY_DAG = ∅`**。理由：四票各自消费**上位权威**（`RULES.md` / 集成规格 / 冻结 UX）与 **base 中已存在**的代码（`DictEntry`、`calculateTooltipPosition`、`.avr-selection-action` 样式、popup 三件套），**没有任何一票需要另一票产出的实现物**（API / 导出常量 / 类型 / 组件 / 运行时服务 / DOM 契约 / 编译期接口）。

### 1.1 反事实测试（counterfactual dependency test）

> 假设 A **永不实施**；B 仍持有权威 base、`RULES.md`、集成规格、冻结 UX 与自己的 ticket。B 能否实现并独立通过其**全部** AC？

| 候选边 | 反事实结果 | 判定 |
|---|---|---|
| `T-VUX-1 → T-VUX-2` | **能**。`释义暂不可用` 与元数据失败正交性来自**上位权威**（冻结 UX §2.1 行 87 / §7.1 行 233；集成规格 U-18 / U-42 / D-1；`RULES.md` DEC-3），**不是** `T-VUX-1` 的定义。`T-VUX-2` 不需要 `T-VUX-1` 的任何实现物 | **删除该边** |
| `T-VUX-1 → T-VUX-3` | **能**。`T-VUX-3` 不消费 `T-VUX-1` 产出；胶囊局部定位可在 base 既有样式与函数上独立实现 | **删除该边** |
| `T-VUX-2 → T-VUX-3` | 能（两票互不引用） | 无边 |
| `T-VUX-* → T-VUX-4` | **能**。popup 只依赖 base 的 `content/dictionary.ts`（只读，四票均禁改） | 无边 |

**2026-09-10 DAG 复审删除的两条边**（上一版曾把它们当语义依赖，属**误判**）：

- `T-VUX-1 → T-VUX-2`：原 rationale 是「浮层要渲染 T-VUX-1 定义的兜底文案」。实测该文案早已是**上位权威**契约 → A 并未「定义」它，两票只是**消费同一权威**。
- `T-VUX-1 → T-VUX-3`：原 rationale 是「共用注入样式块」+「几何断言可判定性」。前者是集成冲突，后者在本票负向断言 7 改写后不再依赖 T-VUX-1。

## 2. INTEGRATION CONFLICT MAP（**非依赖**，`AGENTS.md` §4.2.2）

| 共享面 | 具体位置 | 涉及票 | 冲突风险 |
|---|---|---|---|
| `extension/src/content/annotator.ts` — **同一注入样式模板字面量** | `annotator.ts:54-133`；`T-VUX-1` 落 `.avr-word`(L56)/`.avr-strong`(L62)/`.avr-strong-first`(L68,74)/`.avr-light`(L82)/`.avr-tooltip`(L89)；`T-VUX-2` 落 `.avr-action-menu`(L102,111)；`T-VUX-3` 落 `.avr-selection-action`(L119) | 1 / 2 / 3 | **HIGH**（同块相邻区域，文本冲突概率高） |
| `extension/src/content/annotator.ts` — 行为代码 | `installDelegatedHandlers()`(L228+)、`pointerover` 处理器(L271+)、`showTooltip`(L271-281)、行内释义拼装(L360-385) | 1 / 2 | **MEDIUM** |
| `extension/src/content/annotator.ts` — `calculateTooltipPosition` | L154；调用点 `positionTooltip`(L184) | 2（可选扩展签名）／3（可选复用） | **LOW**（两票**均无义务**修改） |
| `extension/src/content/pageScanner.ts` | `showSelectionAction`(L150-171)、`.avr-selection-action` 定位 | 3 | **NONE**（独占） |
| `extension/src/popup.ts` / `popupNotebook.ts` / `popup.html` / `popup.css` | 全部 | 4 | **NONE**（独占） |
| `e2e-verify.cjs` | 全文 2262 行；**集中式 `FAILURE_TABLE` 注册表 L28-43**；各阶段断言块 | 1 / 2 / 3 / 4 | **HIGH**（共享测试面；注册表为单个字面量） |
| `extension/manifest.json` / `build.mjs` | 仅当需要新增注入资源或打包入口时才动 | 1 / 2 / 3（条件性） | **LOW**（大概率无改动） |
| `extension/src/content/dictionary.ts` | `popup.ts:29` / `popupNotebook.ts:1` 只读导入 | 4（消费） | **NONE**（四票均禁改，不构成冲突） |

**关键规则**：以上**任何一项都不产生 DAG 边**。HIGH 冲突风险**不等于**语义依赖——仅表示集成 lane 需要认真对账。

## 3. PARALLEL EXECUTION PLAN（`AGENTS.md` §4.2.3）

`SEMANTIC_DEPENDENCY_DAG = ∅` ⇒ **四票同时 `IMPLEMENTATION_ELIGIBLE`**，全部从**同一不可变起点**起飞。

```text
AUTHORITATIVE_IMPLEMENTATION_BASE  (pre-implementation governance HEAD, 不可变)
       |
       +---- lane/T-VUX-1   → accepted/T-VUX-1
       +---- lane/T-VUX-2   → accepted/T-VUX-2
       +---- lane/T-VUX-3   → accepted/T-VUX-3
       +---- lane/T-VUX-4   → accepted/T-VUX-4
```

每个 lane：隔离 worktree · 一票一 lane · TDD · 票内测试 · 全部门禁回归 · 产出精确 HEAD · **独立 fresh 评审**。

**并发度 = 4（MAXIMUM SAFE PARALLEL）**。**没有任何一票需要等待兄弟票**。

**波次对比**：

| 方案 | 并发度 | 判定 |
|---|---|---|
| SERIAL `1→2→3→4` | 1 | 不采用——把拓扑序当强制串行，属全局串行化瓶颈 |
| CONSERVATIVE PARALLEL | 4 | 与下者等价（因 DAG 为空，无硬后继需要等待） |
| **MAXIMUM SAFE PARALLEL** | **4** | **采用**——集成冲突可由显式集成 lane 安全对账 |

**已推翻的旧说法**：本 README 上一版写着「项目约定 ticket 串行执行」。**该约定在仓库权威中不存在**——`AGENTS.md` 全文只有一处「串行」，指的是「一个**串行任务**只使用一个 `review/<主题>` 临时分支」（分支卫生），**不是** ticket 必须串行开发。本批次不再沿用该误述。

## 4. INTEGRATION ORDER（偏好，**非阻塞**）

四票并发完成后进入集成 lane（`integration/v0.1-ux-delta`）。**建议**合并顺序（仅为降低冲突解决难度，不构成依赖）：

```text
T-VUX-2  →  T-VUX-3  →  T-VUX-1  →  T-VUX-4
   (样式块中段)  (样式块尾段)  (样式块头段)  (文件不相交)
```

- 前三票按**样式块内位置由中到外**合并，减少 `annotator.ts` 同一字面量的反复改写；
- `T-VUX-4` 与前三票文件不相交，位置最自由，排在最后以简化 `e2e-verify.cjs` 的 `FAILURE_TABLE` 对账。
- 该顺序**可随意调整**：任一票先完成即可先集成，**不需要等待**其他 lane。

## 5. 集成 lane 职责（`AGENTS.md` §4.2.5）

| 归属 | 内容 |
|---|---|
| **集成 lane 负责** | 分支组合；文本冲突解决；`annotator.ts` 共享样式块对账；`e2e-verify.cjs` 与 `FAILURE_TABLE` 对账；重复 helper / 常量整合（如 `释义暂不可用` 是否需要单一常量）；**不改变产品范围**的兼容性修复；全量门禁复跑（typecheck / 单元 / Python 数据测试 / build / 真实 Chrome E2E）；集成后 fresh 评审 |
| **集成 lane 禁止** | 发明新的产品行为；重定义测评契约；实现 Settings / 本页；改写 `WordState` 语义 |
| **治理发现义务** | 若集成暴露**真实隐藏语义依赖**，须记录为 governance finding 供后续 DAG 修正。**仅凭出现合并冲突，不构成存在语义依赖的证据。** |

## 6. IMPLEMENTATION BASE RULE（并行 lane）

```text
AUTHORITATIVE_IMPLEMENTATION_BASE
  = 最终验收的 pre-implementation governance HEAD
  = governance/ux-spec-integration-2026-09-10 的验收 HEAD（不可变）
```

**同一并行波次内的 ticket 一律从这同一个 `AUTHORITATIVE_IMPLEMENTATION_BASE` 起飞，不从兄弟票 HEAD 起飞。** 只有**真正的语义后继**才从「已验收前驱 HEAD」起分支——本批次 `SEMANTIC_DEPENDENCY_DAG = ∅`，因此**四票 base 完全相同**。

该 base 必须自包含：最新上游 main + 冻结 UX 源 + 集成 UX 规格 + 最新前端设计权威 + 已闭合产品决策（`DEC-1`~`DEC-5`）+ 当前 DAG 治理规则（`AGENTS.md` §4.2）+ 完整 ticket 批次 + 当前校验报告。

**不使用「本分支 HEAD」这一表述**：本分支在外部审查期间仍会被追加提交；若审查通过，该追加提交本身即为 `AUTHORITATIVE_IMPLEMENTATION_BASE`。

> **旧规则已废止**：上一版写「`T-VUX-1` base = `origin/main`」。`origin/main`（`58a86f7`）**不含**上述任一构件，按此开工等于从缺规格缺票据的基线实施。上一版还写 `T-VUX-2/3/4 base = 上一票合并后 HEAD`——在 DAG 为空的前提下，该写法会把四票错误地串成链。

## 7. BLOCK 传播规则（`AGENTS.md` §4.2.4）

**`BLOCKED` 只沿 `HARD_SEMANTIC_BLOCKER` 边传播。** 不沿共享文件 / 合并冲突风险 / 共用测试 harness / 偏好合并顺序 / 共同里程碑 / 同一实施波次 / 评审者可用性传播。

本批次 DAG 为空 ⇒ **即使某一票因故 `BLOCKED`，其余三票仍为 `IMPLEMENTATION_ELIGIBLE`**，不得停工等待。

## 8. 浏览器部署 seam（每票通用，`AGENTS.md` §4.1-12）

阅读面行为的真实交付路径是 **`extension/manifest.json`**（MV3：`content_scripts.js = ["content.js"]`、`all_frames: true`、`run_at: document_idle`）→ **`build.mjs`**（`extension/src/content/index.ts` 打包为 `dist/content.js`）→ 真实 Chrome 加载 `dist/`。popup 行为的交付路径为 `extension/popup.html` + `popup.css` + `built popup.js`。

**仅通过 TypeScript 单测或源码阅读不得宣称「已验证」**：几何、注入、渲染类验收必须在**真实构建产物 + 真实 Chrome** 下确认。

## 9. 批次级硬约束（每票继承）

1. **不改生产语义契约**：`WordState` / `wordKey` / `DictEntry` / `QuizQuestion` / `QuizAnswer` / `AssessmentEvidence` / 隐私边界一律不变。
2. **不新增持久化 schema、不做存储迁移**（D-1~D-10 均不需要）。
3. **不实现「本页 / This Page」**（DEC-4）与 **Settings**（DEC-2）。
4. **不使用红色警示色**表示 learning（DEC-1）；`light`＝淡琥珀点线、`learning`＝淡琥珀实线。
5. **用户可见文案中文优先**（DEC-3），禁止 `Mark as Learning · 不会` 这类中英混排。
6. **不重命名代码/领域标识符**以翻译 UI 文案（`known`/`learning`/`unknown`/`QuizQuestion` 等保持不变）。
7. **不移除阅读面已需要的当前页瞬时处理**（扫描 / 解析 / 标注 / 选区 / 浮层）。
8. **不替换既有确定性 E2E**（`e2e-verify.cjs`）为 MCP 驱动流程；二者互补（见 SPIKE）。
9. **不把元数据解析失败建模为词汇学习状态**（`METADATA_RESOLUTION_FAILURE` 与 `WordState` 正交）。
10. **人工 dogfood 是实施后的验收门，不是前置门**（DEC-5）；任何 ticket 不得等待 dogfood 才开始。
11. **一票一 lane / 隔离 worktree**：每票在自己的 worktree 与 `lane/<ticket>` 分支上实施，起点为同一 `AUTHORITATIVE_IMPLEMENTATION_BASE`。
12. **不越界改兄弟票的区块**：同一注入样式模板内，各自只改**自己的 selector 区块**；不得顺手重排、格式化或重构他人区块（会放大集成冲突）。
13. **`BLOCKED` 不跨票传播**：不得因兄弟票阻塞或未完成而停止本票；也不得为「等兄弟票」而延迟本票的 fresh 评审与验收。
14. **lane 通过即有效**：一票通过自身 AC 与门禁即可被验收，**不需要**等待无关兄弟票完成。

## 10. 门禁

**每 lane（票级，独立复跑）与集成 lane 均须 fresh 复跑同一套门禁：**

```bash
npm run typecheck
npm test
python3 -B -m unittest discover -s tests -p "test_*.py"
npm run build
AVR_E2E_NO_SANDBOX=1 npm run test:e2e
```

基线：typecheck exit 0 · vitest 283 passed · Python 12 passed · build 成功 · `E2E ALL PASS`。**任何一项低于基线即 FAIL。**

- **lane 级**：只要求本票 AC 与其回归断言通过；lane 的 `e2e-verify.cjs` 断言可只包含本票新增项。
- **集成级**：在 `integration/v0.1-ux-delta` 上跑**全量**断言（四票新增 + 既有 283 单元 + 全部 E2E 阶段）。
