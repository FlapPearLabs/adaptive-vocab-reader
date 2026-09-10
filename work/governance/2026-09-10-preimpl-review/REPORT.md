# PRE-IMPLEMENTATION REVIEW PACKET

> **⚠️ 部分结论已被取代（2026-09-10 `PHASE-DAG-REPAIR`）**
>
> 本报告 §4.3 与 §7.2 曾把 `T-VUX-2 ← T-VUX-1` 与 **`T-VUX-3 ← T-VUX-1`** 判定为「语义依赖」。
> 后续外部实施前评审指出该判定**混淆了语义依赖与集成冲突**，经反事实测试后：
>
> - **`T-VUX-1 → T-VUX-2`：已删除**
> - **`T-VUX-1 → T-VUX-3`：已删除**（共用注入样式块属 `SOFT_INTEGRATION_CONFLICT`，非依赖）
>
> 现行权威结论：`SEMANTIC_DEPENDENCY_DAG = ∅`，四票并发（`AGENTS.md` §4.2）。
> 见 [`work/governance/2026-09-10-dag-repair/REPORT.md`](../2026-09-10-dag-repair/REPORT.md)。
> 本报告其余部分（远端真相、权威集合、前端对账、P-1~P-5 修复、夹具来源）**仍然有效**。

**阶段**：`PHASE-PREIMPL-REVIEW` — 实施前治理复审
**仓库**：`FlapPearLabs/adaptive-vocab-reader`
**日期**：2026-09-10
**性质**：**纯治理阶段。未写生产代码、未派发实现代理、未开始 `T-VUX-1`、未合并、未发布。**

---

## 1. REMOTE_TRUTH

以 fresh `git fetch --all --prune` 实测，非沿用报告值。

| 项 | SHA | 状态 |
|---|---|---|
| `governance/ux-spec-integration-2026-09-10`（上一阶段产物） | `c21b7d49e45bf9f71daf5114aaf82e106a1bce44` | ✅ 与上一阶段报告一致 |
| live `origin/main` | `58a86f77b0358a96c04e7e07baa9900f33186813` | ✅ 与任务签发值一致 |
| `merge-base(integration, main)` | `58a86f77b0358a96c04e7e07baa9900f33186813` | **main 已是集成分支祖先**（权威世系修复已生效） |
| 生产代码基线 | `247ef89f45df5c623c1de768d098230600de9498` | 仍为 main 祖先 |
| `333c362` / `e4f947b` / `58a86f7` | — | 三者均 **docs-only** |

**分支是否新增提交**：自上一阶段后，集成分支与 main 均**无新增提交**（`git log` 与 fetch 结果一致）。

**是否触及生产代码**：**否**。`247ef89..origin/main` 在 `extension/ tests/ scripts/ data/ dist/ e2e-verify.cjs package.json` 上无差异。

**生产代码基线是否意外漂移**：**否** → 未触发 `STOP: PRODUCTION_BASELINE_DRIFT`。

> **旁证但未采用**：本地 worktree `implement/dogfood-realignment`（`89a0c64`）含 10 个未推送的 docs-only 提交，merge-base 为 `333c362`，**非** `origin/main` 的祖先。该分支未在任何远端出现，不属于当前权威，本阶段**未采用、未合并、未触碰**。它仅用于解释「无更新设计权威」的检索结论（见 §3）。

---

## 2. AUTHORITY_SET

全部 fresh-read；路径均以本分支 HEAD `c21b7d4` 为基准。

| 文档 | 版本/身份 | 权威角色 |
|---|---|---|
| `AGENTS.md` | 255 行，含 §4.1 Ticket 批次校验 12 条 | 工程流程与批次治理规则 |
| `RULES.md` | 166 行，含「V0.1 呈现层与流程裁决」 | **产品规则唯一来源** |
| `CONTEXT.md` | 74 行 | 领域词汇 |
| `CONTEXT-MAP.md` | **不存在**（single-context 项目） | — |
| `docs/adr/0003-词典优先的单词级-v0.1.md` | — | 难逆架构决定 |
| `docs/adr/0004-词汇键与测试证据分离.md` | — | 同上 |
| `docs/CURRENT_IMPLEMENTATION_BASELINE.md` | RESUME-01 VERIFIED | 实现事实基线 |
| `docs/specs/2026-09-04-UX_SPEC_V1.2.1.md` | 274 行 / 22,673 B；SHA-256 `d6570918…bbcc4` | 冻结外部 UX **输入**（非仓库权威） |
| `docs/specs/2026-09-10-V0.1-UX-V1.2.1-集成规格.md` | 含 §7 delta / §10 决策 / §12 资格 / §14 延后 | **仓库权威 UX 规格** |
| `docs/specs/2026-08-06-…解耦规格.md` | 已加 DEC-1 重标注 | 历史规格（行为条款仍有效） |
| `docs/specs/2026-07-22-V0.1-1000词垂直切片实施规格.md` | 已加历史化提示 | 历史规格 |
| `work/tickets/README.md` | 已更新索引 | ticket 索引 |
| `work/tickets/2026-09-10-v0.1-ux-delta/` | 9 个文件 | 本批 ticket |
| `work/governance/2026-09-10-dec-tickets/REPORT.md` | — | 上一阶段报告 |

**源码 / E2E 事实核对**（用于解决事实冲突，非「凭 commit message 推断」）：

| 断言对象 | 实测 |
|---|---|
| `calculateTooltipPosition` | `annotator.ts:154`；调用点唯一为 `positionTooltip`（`annotator.ts:184`）——**几何 seam 唯一性成立** |
| 悬停路径 | `pointerover` → `showTooltip`（`annotator.ts:271-281`）；`pointerout` → `hideTooltip` |
| 行内释义现格式 | `【${translation}】`（`annotator.ts:373`）——集成规格 D-5 要求改为 `{posPrefix}{translation}`，**不一致成立** |
| 下划线现配色 | `light` 灰 / `strong` 红（`#e74c3c` 系）；无琥珀族 —— DEC-1 目标**未实现成立** |
| popup 宽度 | `extension/popup.css:26` = `380px` → **非 `320px`** |
| popup 页签 | `popup.ts:137-155` 仅 `测评` / `生词本` —— **已无 Settings、无本页** |
| `METADATA_RESOLUTION_FAILURE` / `释义暂不可用` | `extension/src` 内**零命中** → D-1 未实现成立 |
| `detailZh` / `nuance` / `ipa` / `zh` 字段 | 全库**零命中** → 未复活成立 |
| 浏览器部署 seam | `extension/manifest.json`（MV3，`content_scripts.js = ["content.js"]`，`all_frames: true`，`run_at: document_idle`）+ `build.mjs`（`content/index.ts → dist/content.js`） |

---

## 3. LATEST_FRONTEND_DESIGN

**结论：不存在比 `UX_SPEC_V1.2.1` 更新的前端设计权威。**

检索证据（穷尽式，非抽样）：

1. 本分支全部 `.md` 已枚举（见 §2 表）；`docs/specs/` 下**最新**为 `2026-09-10-V0.1-UX-V1.2.1-集成规格.md`，其上游是 `2026-09-04-UX_SPEC_V1.2.1.md`。
2. 任何远端分支均无更新的设计文档（`git ls-tree` 全分支比对）。
3. 全机检索（`Documents` / `Desktop` / `Downloads` / `mdfind` / 内容关键词 `DESIGN FROZEN`、`METADATA_RESOLUTION_FAILURE`、`UX_SPEC`）**零命中**新版本。
4. 唯一「本地另有设计世系」的候选是未推送的 `implement/dogfood-realignment`，其最新 docs 提交为 **2026-08-14**，**早于** `UX_SPEC_V1.2.1`（2026-09-04）且**从未推送**。

因此：**最新前端设计权威 = 冻结 `UX_SPEC_V1.2.1`**，其仓库权威投影为集成规格（2026-09-10）。本复审据此进行；**未虚构、未假设**任何「更新设计」。

> 若外部审查者手上存在更新的设计文档，请提供；它必须经仓库权威集成后才能改变本结论。

---

## 4. IMPLEMENTATION_BASE_REPAIR

### 4.1 先前错误规则（实测）

`work/tickets/2026-09-10-v0.1-ux-delta/README.md` 第 63 行原文：

> `T-VUX-1` base commit = 施工前 `git fetch` 确认的 `origin/main`（预期 `58a86f77b0358a96c04e7e07baa9900f33186813`）。

**为什么是错的**：`origin/main@58a86f7` **不含**以下任一必需构件：

| 必需构件 | `origin/main` 是否包含 |
|---|---|
| `DEC-1`~`DEC-5` 已闭合 | ❌ |
| 仓库权威集成 UX 规格 | ❌ |
| 冻结 UX 输入 `2026-09-04-UX_SPEC_V1.2.1.md` | ✅（唯一包含者） |
| 最新前端设计权威 | ❌ |
| 当前 DAG 治理规则（`AGENTS.md` §4.1） | ✅（旧版，`2bbbe3f` 起即有） |
| 完整 ticket 批次 | ❌ |
| 当前批次校验报告 | ❌ |

若按原规则执行，实施者将从一个**缺少规格与票据的**基线开工，必然回退到「按 commit message 或记忆实现」。

### 4.2 修正后的规则

```text
IMPLEMENTATION_BASE = 最终验收的 pre-implementation governance HEAD
                    = governance/ux-spec-integration-2026-09-10 的验收 HEAD
                      （本阶段推送后的 c-fixed HEAD，见 §14）
```

**明确不采用「本分支 HEAD」这一表述**：本分支在外部审查期间仍会被追加提交。若审查通过，该追加提交本身**就是** pre-implementation governance HEAD。因此 base 定义为**语义锚点**（「含全部批准决策与票据的权威快照 HEAD」）而非固定 SHA。

逐票映射：

| 票 | base（语义） | base（本阶段实测 SHA） |
|---|---|---|
| `T-VUX-1` | pre-implementation governance HEAD | `c-fixed`（§14 报告） |
| `T-VUX-2` | 已验收 `T-VUX-1` HEAD | 实施时确定 |
| `T-VUX-3` | 按最终 DAG 的已验收前驱 HEAD | 见 §7 |
| `T-VUX-4` | 按最终 DAG 的已验收前驱 HEAD | 见 §7 |

**`AUTHORITY_AND_IMPLEMENTATION_BASE_ALIGNED = PASS`**（修正后）。

### 4.3 为什么没有重排拓扑

任务要求「若新 DAG 治理显示出不同拓扑，不要机械保留旧顺序」；**方向成立，但结论是保留串行**。理由是**实际验收依赖**而非「看起来独立」：

| 隐含边 | 性质 | 证据 |
|---|---|---|
| `T-VUX-3 → T-VUX-1` | **语义边（非仅顺序）** | `T-VUX-3` AC-1/AC-2/AC-3 断言胶囊**几何**；胶囊样式位于 `annotator.ts` 注入 style 块，`T-VUX-1` 的 D-4/D-6 同块改写。且 `T-VUX-3` 负向断言 7 要求「不得引入第二个冲突的通用浮层几何体系」——该约束的可判定性依赖 `T-VUX-1` 已落地的几何基线 |
| `T-VUX-4` | **语义独立** | 仅触 `popup.ts` / `popupNotebook.ts` / `popup.html` / `popup.css`，与 content 面零交集 |

**不引入并行**：`T-VUX-1` 与 `T-VUX-3` 同改 `annotator.ts`，`e2e-verify.cjs` 为四票共享。并行只会制造合并冲突与 E2E 断言竞争，**不产生真实吞吐收益**。串行 `1→2→3→4` 保留。

---

## 5. FRONTEND_TO_TICKET_COVERAGE

以**最新前端设计权威**（冻结 V1.2.1 的规范性条款）逐项对账。规范性判定严格按文档自身标注（`(Normative)` vs `*Non-normative visual reference*`）。

| UX 条款 | 规范级别 | 仓库映射 | 处置 |
|---|---|---|---|
| §2 Known 完全继承宿主排版 | Normative | D-4 | `T-VUX-1` |
| §2 Unknown/Hinted 琥珀**点线** | Normative | D-6 | `T-VUX-1` |
| §2 Learning 首现：琥珀**实线** + 克制斜体行内中文 | Normative | D-5 / D-6 | `T-VUX-1` |
| §2 Learning 重复：**仅实线、无行内释义** | Normative | D-5（保持 P-4） | `T-VUX-1` |
| §2 Selected Plain Word：胶囊在选区**上方居中** | Normative | D-7 | `T-VUX-3` |
| §2 悬停不得开完整浮层 / 不得改状态 | Normative | P-4（已实现） | 既有回归断言 |
| §2.1 METADATA_RESOLUTION_FAILURE 正交 + `释义暂不可用` | Normative | D-1 | `T-VUX-1`（浮层消费于 `T-VUX-2`） |
| §2 `QUERY_DICTIONARY_NOT_CONTAINED` 零样式零持久化 + `当前词典未收录` | Normative | P-3（已实现） | 既有回归断言 |
| §3.1 宿主排版非干扰（6 条 `inherit !important`） | Normative | D-4 | `T-VUX-1` |
| §3.2 零布局位移 / 跨折行稳定 | Normative | P-5（已实现） | 既有回归断言 |
| §3.2 `#f59e0b` / `#d97706` @50–60% alpha | **非规范性** | D-6 | 仅作视觉参考，**不得写成领域契约** |
| §3.3 行内释义 `{posPrefix}{translation}` | Normative | D-5 | `T-VUX-1` |
| §3.3 `line-height:1` / `user-select:none` / `0.35em` / 11–12px / 斜体 | Normative | D-5 | `T-VUX-1` |
| §3.3 `#78350f` @60% opacity（释义色） | **非规范性（`e.g.`）** | D-5 | 参考值 |
| §3.4 Popover 排版（词头/音标/词性/释义） | **非规范性** | D-2 | `T-VUX-2`，实现者判断 |
| §4.1 悬停轻提示 vs 点击浮层分离 | Normative | D-2 | `T-VUX-2` |
| §4.2 几何：上方优先 / 下翻 / 12px 夹取 / 不遮挡 / 滚动 | Normative | D-2 | `T-VUX-2`（复用 `calculateTooltipPosition`） |
| §4.2 终态动作立即自动关闭 | Normative | P-2（已实现） | 既有回归断言 |
| §4.2 取消：**Esc** / 外部点击 / X | Normative | D-3（Esc 缺，其余已有） | `T-VUX-2` |
| §4.3 严格选区校验 / `mousedown preventDefault` | Normative | P-1~P-4（已实现） | 既有回归断言，**不得重写** |
| §4.3 胶囊视觉「Dark compact pill + bookmark 图标」 | 描述性（未标 Normative） | D-7 | **不提升为规范**（见 §8 P-3） |
| §5.1 渲染仓库 `QuizQuestion`（四要素） | Normative | P-2（已实现） | 既有回归断言 |
| §5.1 首测与每日校准**不合并** | Normative | P-4（已实现） | 既有回归断言 |
| §5.2 估计只显示仓库 seam 值 | Normative | P-5（已实现） | 既有回归断言 |
| §6 `320px` 固定宽度 | Normative | D-8 | `T-VUX-4` |
| §6 页签：This Page | Normative（但 **DEC-4 显式延后**） | — | **explicit deferral** |
| §6 页签：Notebook + 搜索筛选 | Normative | D-9 | `T-VUX-4` |
| §6 页签：Level Check = 首测/每日集成 | Normative | D-8 | `T-VUX-4` |
| §6 页签：Settings | **OPEN / NOT AUTHORIZED** | — | **explicit deferral**（DEC-2） |
| §6 所有设置项（`showInlineMeaning` 等 6 项） | NOT AUTHORIZED | — | **explicit deferral** |
| §7 空状态：Empty Notebook → 中文 | Normative（英文串被 DEC-3 覆盖） | D-10 | `T-VUX-4` |
| §7 空状态：Empty Page（英文串） | Normative（但 DEC-4 延后本页） | — | **explicit deferral** |
| §8.1 选择/导航/滚动不得被劫持 | Normative | 既有不变量 | 既有回归断言 |
| §8.2 DOM 安全（内容/顺序/空白/标点保留） | Normative | P-1（已实现） | 既有回归断言 |
| §8.3 CSS 隔离（Shadow DOM 或严格前缀） | Normative | 已用 `.avr-` 前缀 | 既有回归断言 |
| §9 全部 18 条 production checklist | 验证清单 | 映射到各票 AC + 既有断言 | 见下 |

**覆盖结果**：冻结 UX 的**每一条规范性条款**均落到 `T-VUX-1`/`T-VUX-2`/`T-VUX-3`/`T-VUX-4`、既有回归断言、或显式延后（This Page / Settings / NOT AUTHORIZED 设置项）。**双向闭环成立**（正向 0 缺口；反向 0 ticket-only requirement，见 §7.5）。

---

## 6. FINAL_TICKET_LIST

| ID | 标题 | 覆盖 Delta | Blockers | 主改文件 |
|---|---|---|---|---|
| `T-VUX-1` | Reading Presentation Integrity | D-1 / D-4 / D-5 / D-6 | — | `annotator.ts`、`annotator.test.ts` |
| `T-VUX-2` | Word Inspection Popover | D-2 / D-3 | `T-VUX-1` | `annotator.ts`、`annotator.test.ts` |
| `T-VUX-3` | Selection Recovery Pill | D-7 | `T-VUX-1`（**新声明**，见 §7.2） | `pageScanner.ts`、`annotator.ts`（样式）、`pageScanner.test.ts` |
| `T-VUX-4` | Popup V0.1 Alignment | D-8 / D-9 / D-10 | — | `popup.ts`、`popupNotebook.ts`、`popup.html`、`popup.css` |

非产品候选（不属本批执行序列）：`SPIKE-CHROME-DEVPROFILE`。

---

## 7. FINAL_DAG

### 7.1 图

```text
┌───────────────────────────────┐
│  PRE-IMPLEMENTATION           │
│  GOVERNANCE HEAD (c-fixed)    │
└───────────────┬───────────────┘
                │
    ┌───────────┴───────────┐
    ▼                       ▼
┌─────────┐           ┌─────────┐
│ T-VUX-1 │           │ T-VUX-4 │
│ D-1/4/5/6│          │ D-8/9/10│
└────┬────┘           └─────────┘
     │                  （独立，无出边）
     ├──────────────┐
     ▼              ▼
┌─────────┐   ┌─────────┐
│ T-VUX-2 │   │ T-VUX-3 │
│ D-2/D-3 │   │   D-7   │
└─────────┘   └─────────┘
```

### 7.2 语义依赖（真实验收依赖）

| 边 | 理由 |
|---|---|
| `T-VUX-2 ← T-VUX-1` | `T-VUX-2` AC-7 断言浮层显示 `释义暂不可用`，该常量与 `METADATA_RESOLUTION_FAILURE` 术语由 `T-VUX-1` 定义。**只消费、不重定义** |
| `T-VUX-3 ← T-VUX-1` | **本阶段新发现并已补正**（原批次仅以「顺序」描述）。`T-VUX-3` AC-1/2/3 断言胶囊几何，而胶囊样式与 `T-VUX-1` 的 D-4/D-6 同在 `annotator.ts` 注入 style 块；且负向断言 7「不得引入第二个冲突的通用浮层几何体系」的可判定性依赖 `T-VUX-1` 的几何基线已落地 |

### 7.3 顺序约束（非验收依赖）

`T-VUX-1`、`T-VUX-3`、`T-VUX-4` 共享 `e2e-verify.cjs` 与构建产物路径；`T-VUX-1`/`T-VUX-3` 共享 `annotator.ts` 样式块。串行执行以规避同文件冲突——**这是合并卫生，不是依赖**。

**执行顺序（唯一）**：`T-VUX-1 → T-VUX-2 → T-VUX-3 → T-VUX-4`。

### 7.4 共享面与合并锁

发现一个**真实工程风险**：`e2e-verify.cjs` 目前把测试夹具页面写入 `tempDir`（`e2e-verify.cjs:534-535`），而**该目录并非 git-ignored 的工作树内目录**（不同于 T-PERF-7A 的 `.avr-e2e-tmp.*` 模式；`.gitignore` 未含该模式）。若实施期并行运行两个 worktree 的 E2E，存在夹具互相覆盖的风险。

- **判定**：**P2（不阻断本阶段，不阻断串行实施）**。串行执行下不发生。
- **处置**：已写入 `T-VUX-1` §8 作为「实施前须确认项」——实施首步须确认 `tempDir` 的实际位置与隔离性；若确认为工作树内共享路径，实施者须**只报告、不顺手改**（属超出本批范围的基础设施修改，须单独授权）。

### 7.5 依赖正确性逐条核对（`AGENTS.md` §4.1）

| 规则 | 结果 |
|---|---|
| 1 依赖一致性（无隐藏 sibling / future 依赖） | ✅ 补正后成立 |
| 2 独立可验收 | ✅ 见 §9 拓扑模拟 |
| 3 禁止 forward dependency | ✅ 无 |
| 6 source coverage 双向闭环 | ✅ 10/10 D-* 全覆盖；反向全部可追溯至集成规格 §7 |
| 8 README/index 一致性 | ✅ README 已同步为 `T-VUX-3` 声明 blocker |

---

## 8. FINDINGS_FIXED

本阶段修复的缺陷。**每条均给出触发证据，无风格性改动。**

| # | 缺陷 | 证据 | 修复 |
|---|---|---|---|
| **P-1** | **起始票 base 错误**：`T-VUX-1 base = origin/main` | `origin/main@58a86f7` 不含 DEC-1~5 / 集成规格 / 冻结 UX / ticket 批次（`git ls-tree` 实测） | 三处改为 base = pre-implementation governance HEAD：批次 README §「执行顺序」、`T-VUX-1` §8、`T-VUX-2` §8；并说明**拒绝**「本分支 HEAD」表述的理由 |
| **P-2** | **浏览器部署 seam 缺失**：`T-VUX-1` / `T-VUX-3` 的允许修改范围未列拥有「注入」行为的交付路径 | `extension/manifest.json` 声明 `content_scripts.js=["content.js"]`；`build.mjs` 从 `content/index.ts` 打包为 `dist/content.js`。仅改 TS 而不知该路径，会误判「已验证」 | `T-VUX-1` §8、`T-VUX-3` §8 补入 `extension/manifest.json` 与 `build.mjs`；并在完成判据加入「须经真实构建产物在 Chrome 中验证，不得只验 TS 单测」；依 `AGENTS.md` §4.1-12 |
| **P-3** | **未支持的要求**：`T-VUX-3` AC-4 断言「胶囊文案为中文」并将图标列为可选 | 冻结 UX §4.3 的胶囊视觉描述（`Mark as Learning · 不会` + bookmark 图标）**未被标记 Normative**；DEC-3 仅要求「简洁中文、禁中英混排」 | AC-4 收窄为「文案为简洁中文且**无中英混排**」；删除对具体文案/图标的指定，改由实现者判断；§3 同步为「文案与图标由实现者判断」 |
| **P-4** | **验收覆盖不全**：`T-VUX-1` AC-1 写「悬停 → 显示 `释义暂不可用`」 | 实测 tooltip 有**两条**显示路径：`pointerover`→`showTooltip`（`annotator.ts:271`）与 `click`→`showUnresolvedTooltip`（`annotator.ts:253-256`）。逐事件断言会漏 | AC-1 改为「**所有 tooltip 显示路径**在元数据缺失时显示 `释义暂不可用`」，不绑定具体事件名 |
| **P-5** | **测试 seam 不足**：`T-VUX-3` 要求单测 `showSelectionAction` 的输出 | 该函数为 `pageScanner` 内**模块级局部函数**，当时不可导出、亦无 jsdom seam | `T-VUX-3` §6 补「须建立可注入的 DOM 测试 seam（jsdom 或等效），不得仅为可测性而改变生产行为」；§7 补「几何与文案由**行为级** Chrome 验证兜底」 |

**额外记录（非缺陷，事实澄清）**：`T-VUX-3` §2 P-1 引用「E2E AC-9」、`T-VUX-1` §2 P-3 引用「E2E AC-10」——`e2e-verify.cjs` 自身无此编号方案（其编号用于 R-* Requirement）。已按「引号保留」处理为**标示性**引用，并在 `T-VUX-3` §2 补注实测行号（`e2e-verify.cjs:697-730`），避免实施者按编号检索落空。

### 8.1 未修改项（经审查确认无需改）

| 项 | 结论 |
|---|---|
| 是否重排拓扑 / 引入并行 | **否**，理由见 §4.3 |
| 是否重新设计 ticket 结构 | **否**，四票职责边界经证据检验仍然正确 |
| 是否新增 ticket | **否**，D-1~D-10 已有唯一归属 |
| 是否改 `RULES.md` / 集成规格 / `DEC-*` | **否**，无证据要求 |

---

## 9. TOPOLOGICAL_SIMULATION

自 `PRE-IMPLEMENTATION GOVERNANCE HEAD (c-fixed)` 起，按 blockers-first 顺序逐票模拟。

### T-VUX-1（blockers：无）

| 问题 | 答 |
|---|---|
| 1 blockers 是否可用 | ✅ 无 blockers；base 含 FR-1~FR-9（§10） |
| 2 AC 现在是否可满足 | ✅ AC-1~AC-10 全部只依赖 base state + 本票产出 |
| 3 是否依赖 future ticket | ✅ 否 |
| 4 允许修改面是否足够 | ✅ `annotator.ts` + 测试 + `e2e-verify.cjs` + 可选样式常量文件；**本阶段已补 manifest/build seam** |
| 5 能否独立通过 | ✅ 是 |
| 6 产出 HEAD 能否作为后继 base | ✅ 是（`T-VUX-2`/`T-VUX-3` 以此为 base） |
| 7 前端设计在部分状态下是否自洽 | ✅ 是（琥珀族 + 兜底文案 + 排版继承自洽；尚未含浮层与 popup） |

**判定：PASS（附 MODULE_SEAM 实施前检查条件，见 §12）**

### T-VUX-2（blockers：`T-VUX-1`）

| 问题 | 答 |
|---|---|
| 1 blockers 可用 | ✅ `释义暂不可用` 常量与 `METADATA_RESOLUTION_FAILURE` 术语由 `T-VUX-1` 交付 |
| 2 AC 可满足 | ✅ AC-1~AC-10 |
| 3 future 依赖 | ✅ 否 |
| 4 修改面足够 | ✅ `annotator.ts`（含既有 seam 签名扩展）+ 测试 + E2E；seam 唯一性已实测（调用点唯一） |
| 5 独立通过 | ✅ 是 |
| 6 作为后继 base | ✅ 是 |
| 7 部分状态自洽 | ✅ 是（浮层复用同一几何 seam，与琥珀族一致） |

**判定：PASS**

### T-VUX-3（blockers：`T-VUX-1`，本阶段新声明）

| 问题 | 答 |
|---|---|
| 1 blockers 可用 | ✅ `T-VUX-1` 已落地注入样式块与几何基线 |
| 2 AC 可满足 | ✅ AC-1~AC-10（AC-4 已收窄为「中文且无中英混排」） |
| 3 future 依赖 | ✅ 否 |
| 4 修改面足够 | ✅ `pageScanner.ts`（仅定位与文案）+ `annotator.ts`（仅 `.avr-selection-action` 样式）+ 测试 + E2E + manifest/build seam |
| 5 独立通过 | ✅ 是；jsdom seam 已写入要求 |
| 6 作为后继 base | ✅ 是 |
| 7 部分状态自洽 | ✅ 是（胶囊与 tooltip 共享「上方优先」直觉） |

**判定：PASS**

### T-VUX-4（blockers：无）

| 问题 | 答 |
|---|---|
| 1 blockers 可用 | ✅ 无 |
| 2 AC 可满足 | ✅ AC-1~AC-11 全部依赖 base state + 本票产出 |
| 3 future 依赖 | ✅ 否 |
| 4 修改面足够 | ✅ popup 四文件 + 测试 + E2E；**且当前代码已无 Settings/本页**，`T-VUX-4` 主要是宽度/标签/搜索/空状态 |
| 5 独立通过 | ✅ 是 |
| 6 作为后继 base | ✅ 是（批次末票） |
| 7 部分状态自洽 | ✅ 是（popup 与阅读面互不影响） |

**判定：PASS**

### 模拟汇总

**`TICKET_BATCH_VALIDATION = PASS`**（四票全 PASS，无环、无隐藏依赖、无同权、无 future 依赖、无矛盾约束）。

---

## 10. 前置事实登记（FR-1 ~ FR-9）

供审查者快速核对「基线里到底有什么」。全部来自 §1/§2 实测。

| ID | 事实 | 观测值 |
|---|---|---|
| FR-1 | 起始治理 HEAD | `c21b7d4`（修复后为 `c-fixed`） |
| FR-2 | live `origin/main` | `58a86f7` |
| FR-3 | 生产代码基线 | `247ef89`；main 上无生产代码漂移 |
| FR-4 | 冻结 UX 源在分支内可读 | ✅ 274 行 / 22,673 B / SHA-256 `d6570918…bbcc4` |
| FR-5 | 集成规格存在且含 §7/§10/§12/§14 | ✅ |
| FR-6 | `DEC-1`~`DEC-5` 闭合状态 | ✅ 5/5 CLOSED |
| FR-7 | `AGENTS.md` §4.1 批次校验规则存在 | ✅ 12 条 |
| FR-8 | 四票 + README + 校验报告 + 延后 + dogfood 门 + SPIKE 齐全 | ✅ 9 文件 |
| FR-9 | 集成规格 §12 资格标记 | `READY_FOR_TICKET_DECOMPOSITION` |

---

## 11. TEST_AND_CHROME_SEAMS

### 11.1 全局门禁（每票 fresh 复跑，不改）

```bash
npm run typecheck
npm test
python3 -B -m unittest discover -s tests -p "test_*.py"
npm run build
AVR_E2E_NO_SANDBOX=1 npm run test:e2e
```

基线（RESUME-01 VERIFIED）：typecheck exit 0 · vitest **283** · Python data tests **12** · build 成功 · `E2E ALL PASS`。**任何一项低于基线即 FAIL。**

### 11.2 逐票验证面（比例化，不把无关 E2E 摊派给每票）

| 票 | 单元（vitest） | Python data | 真实 Chrome E2E | 运行时人工 |
|---|---|---|---|---|
| `T-VUX-1` | 元数据缺失兜底 / `pos` 有无两 fixture / 样式常量非红 / 几何 seam 不回归 | 不适用（本票不改数据构建），但仍跑以保门禁 | AC-1/2/4/5/7/8/9/10 各 ≥1 条 | ✅ 宿主 `span{}` 干扰页 + 缺失词悬停 + 首现/重复差异 + 零位移 |
| `T-VUX-2` | 浮层尺寸入参后的几何断言 / Esc 关闭无写入 / 缺失 fixture 文案 | 同上 | AC-1~AC-10 各 ≥1 条 | ✅ 上方/下翻/边缘夹取 + 滚动跟随 + Esc/外点 + 「不会」即时关闭 |
| `T-VUX-3` | jsdom 下定位计算（居中上方 / 下移 / 左右夹取） | 同上 | AC-1~AC-3、AC-6~AC-8 各 ≥1 条 | ✅ 拖选中部/顶部/右缘/两词/点击生效 |
| `T-VUX-4` | `selectNotebookEntries` 不回归 / 空状态分支 | 同上 | AC-1~AC-11 各 ≥1 条 | ✅ 宽度/两页签/首测/每日/估计/搜索/空状态/已掌握 |

### 11.3 元数据失败路径的夹具来源（**关键实施前事项**）

E2E 词包是**真实的 ECDICT 派生资产**，**不存在**「`translation` 缺失」的自然词条。因此 D-1 与 `T-VUX-2` AC-7 的失败路径**只能**经以下之一构造：

| 路径 | 说明 |
|---|---|
| **A. E2E fixture 页面自造** | 在 E2E 生成的测试页（`e2e-verify.cjs:535` 的 `ux-reading.html`）中注入**人工构造**的、`translation` 缺失的词条场景，由 `pointerover` 触发 |
| **B. 纯 JS DOM 单元测试** | 以 jsdom + 手工 `DictEntry`（缺 `translation`）验证 tooltip 文案，不依赖真实词包 |

**禁止**：断言依赖真实词包中伪造或改写的数据；**禁止**为使夹具成立而修改 `data/` 或构建脚本。

### 11.4 确定性 E2E 与交互式 Chrome 工具的关系（不变）

- **`e2e-verify.cjs` = 权威确定性回归门**。任何 ticket **不得**以 MCP/交互式流程替换它。
- **Chrome DevTools MCP / 交互式工具 = 补充**，用于实施期的运行时探查与验证（见 `SPIKE-CHROME-DEVPROFILE`）。
- `SPIKE-CHROME-DEVPROFILE` 若完成，**优先安排在最终人工 dogfood 之前**，使 agent 驱动的浏览器验证可用于实施/审查循环。

### 11.5 本阶段是否发现「最新设计要求新增真实 Chrome 断言」

**是，但已由现有票覆盖**，无需新增票：

| 设计条款 | 是否需要新的 E2E 断言 | 归属 |
|---|---|---|
| 行内释义格式 `{posPrefix}{translation}` | ✅ 需要 | `T-VUX-1` AC-5 |
| 琥珀族下划线（点线/实线） | ✅ 需要 | `T-VUX-1` AC-8 |
| 元数据缺失兜底文案 | ✅ 需要 | `T-VUX-1` AC-1 + `T-VUX-2` AC-7 |
| 浮层几何（上翻/下翻/夹取/滚动） | ✅ 需要 | `T-VUX-2` AC-3 |
| Esc 关闭 | ✅ 需要 | `T-VUX-2` AC-5 |
| 胶囊上方**居中** | ✅ 需要（原断言仅验「存在」） | `T-VUX-3` AC-1~AC-3 |
| `320px` 宽度 | ✅ 需要 | `T-VUX-4` AC-1 |
| 生词本搜索 / 中文空状态 | ✅ 需要 | `T-VUX-4` AC-8/AC-9 |

---

## 12. OPEN_BLOCKERS

| # | 级别 | 内容 | 影响面 | 处置 |
|---|---|---|---|---|
| **B-1** | **P2（条件性阻断 `T-VUX-1`）** | `T-VUX-1` §6 要求「D-5：`pos` 存在/缺失两种 fixture 下的行内释义文本」单元测试，但**行内释义拼装当前不可经模块 seam 触达**（`annotator.ts` 未导出该路径，批内**未核验**仓库是否已有 jsdom/DOM 测试环境） | 仅影响 `T-VUX-1` 单测方式，不影响其 AC 可满足性 | 已写成 `T-VUX-1` §8 的**显式实施前第 2 步**：实施首步须先核验可用 DOM 测试 seam；若无，则建立 jsdom 注入 seam（与 `T-VUX-3` §6 同法）。**该核验为实施内动作，不是外部审查阻塞** |
| **B-2** | **P2** | `e2e-verify.cjs` 的 `tempDir` 夹具隔离性未核验（见 §7.4），并行执行可能互相覆盖 | 串行实施下不发生 | 写入 `T-VUX-1` §8 实施前检查项；**只报告不顺手改** |
| **B-3** | P3 | 本地未推送分支 `implement/dogfood-realignment`（10 commits，merge-base `333c362`）仍在工作树中，且该工作树有 4 个未提交改动 | 不属本批权威 | 不触碰；如需清理须用户单独授权 |
| **B-4** | P3（发布级，**不阻断本地实施**） | ECDICT 中文释义公开再分发权利链仍 UNKNOWN | 仅阻断公开分发 | 与本地 V0.1 dogfood readiness **不得混淆**（`RULES.md`） |

**是否有阻断「开始实施」的阻塞**：**无**。B-1/B-2 是**实施首步须完成的核验**，其构造方式已在票内写明；B-3/B-4 不属本批范围。

**已解决的旧阻塞**：`AUTHORITY_SNAPSHOT_NOT_SELF_CONTAINED` 已于上一阶段修复（`f22dd62`），本阶段复核 `merge-base = 58a86f7` 证实 main 已是祖先。

---

## 13. DEFERRED_SCOPE

明确留在本波次之外：

| 项 | 性质 | 依据 |
|---|---|---|
| **This Page / 本页**（popup 页面级词表） | 产品能力，**V0.1 延后** | `DEC-4` |
| **Settings**（页签 / 设置持久化 / 空壳或占位） | **V0.1 明确不做** | `DEC-2` |
| `showInlineMeaning`、session assistance toggle、`activeDomainEnabled`、`pronounceOnHover`、`fontSize`、移动端 bottom-sheet | **NOT AUTHORIZED** | 冻结 UX §6 + `RULES.md` |
| 10k 测评/查询词包扩张 | 需 dogfood 明确接受后才可讨论 | `RULES.md` |
| ECDICT 公开再分发 / 许可 / 隐私发布就绪 | 独立发布阻断项 | `RULES.md` |
| CI / 远端审查自动化 | 新治理决策 | 本波次不扩 scope |
| `SPIKE-CHROME-DEVPROFILE` | 工具链候选（**非产品**） | 须单独授权、单独分支 |
| 不改语言契约 / 不重命名 code 标识符 | 硬约束 | `DEC-3` |

**最终验收门 `V0.1 FINAL DOGFOOD`** 本阶段**只表示、不执行**：位于全部切片通过 fresh 自动化门禁之后（`DEC-5`）。

---

## 14. PRE_IMPLEMENTATION_VERDICT

### 14.1 仓库级

```text
PRE_IMPLEMENTATION_VERDICT = READY_FOR_EXTERNAL_PRE_IMPLEMENTATION_REVIEW
```

依据：

| 门 | 结果 |
|---|---|
| 远端真相一致（无生产代码漂移） | **PASS** |
| 权威快照自包含（含冻结 UX / 集成规格 / DEC / DAG 规则 / 完整票据 / 校验报告） | **PASS** |
| 实施 base 修正（`origin/main` → pre-implementation governance HEAD） | **PASS** |
| 最新前端设计权威已识别并逐条对账 | **PASS**（= 冻结 V1.2.1；无更新文档） |
| 前端条款覆盖双向闭环 | **PASS**（0 缺口 / 0 ticket-only） |
| 依赖正确性（含新增 `T-VUX-3 ← T-VUX-1` 语义边） | **PASS** |
| 拓扑模拟四票 | **PASS**（4/4） |
| 批次校验 | **`TICKET_BATCH_VALIDATION = PASS`** |
| 生产代码变更 | **NONE** |
| 已取代工作复活 | **NONE** |
| 未决产品决策 | **0** |

### 14.2 若外部审查通过，可开始的第一张票

**`T-VUX-1`** —— DAG 中唯一的无 blocker 起始切片，且是 `T-VUX-2` 与 `T-VUX-3` 的前置。

**入场条件（实施首步，非外部审查阻塞）**：

1. 从修正后的 pre-implementation governance HEAD 建立施工分支；
2. 核验/建立 DOM 测试 seam（B-1）；
3. 核验 E2E `tempDir` 隔离性（B-2）；
4. 确认新 worktree 具备 local-only 词包恢复能力（`data/README.md` 的确定性恢复流程）。

### 14.3 本阶段**未**做的事（边界声明）

- ❌ 未写任何生产代码
- ❌ 未派发 Zcode 或任何实现代理
- ❌ 未开始 `T-VUX-1`
- ❌ 未创建实现 worktree
- ❌ 未合并 `main`
- ❌ 未关闭 Issue，未删除分支，未发布，未 force-push

**已 STOP，等待外部独立审查。**

---

## 15. FILES_CHANGED

| 文件 | 变更 |
|---|---|
| `work/governance/2026-09-10-preimpl-review/REPORT.md` | **新增**（本文件） |
| `work/tickets/2026-09-10-v0.1-ux-delta/README.md` | base 规则修正；`T-VUX-3` 声明 blocker；执行顺序措辞修正 |
| `work/tickets/2026-09-10-v0.1-ux-delta/01-reading-presentation-integrity.md` | 补 manifest/build seam；补 DOM seam 与 E2E 隔离实施前检查；AC-1 覆盖全部 tooltip 路径；AC-5 补 fixture 来源 |
| `work/tickets/2026-09-10-v0.1-ux-delta/02-word-inspection-popover.md` | 补 manifest/build seam；AC-7 补夹具来源 |
| `work/tickets/2026-09-10-v0.1-ux-delta/03-selection-recovery-pill.md` | 声明 blocker = `T-VUX-1`；AC-4 收窄（删除未支持的文案/图标规范）；补 jsdom seam；补实测行号 |
| `work/tickets/2026-09-10-v0.1-ux-delta/04-popup-v0-1-alignment.md` | AC-1 补构建产物验证口径 |
| `work/tickets/2026-09-10-v0.1-ux-delta/VALIDATION-REPORT.md` | 追加本阶段复审段（P-1~P-5、拓扑复算、夹具来源） |

**生产代码变更：无**（`extension/`、`tests/`、`scripts/`、`data/`、`dist/`、`e2e-verify.cjs`、`package.json` 全部未改）。
