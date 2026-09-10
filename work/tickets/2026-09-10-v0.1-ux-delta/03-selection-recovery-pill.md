# T-VUX-3 · Plain-Word Recovery UX（拖选恢复胶囊）

| 项 | 值 |
|---|---|
| Ticket ID | `T-VUX-3` |
| 批次 | `2026-09-10-v0.1-ux-delta` |
| 覆盖 Delta | **D-7** |
| Blockers | **—（无硬语义 blocker；`T-VUX-1 → T-VUX-3` 边已于 2026-09-10 DAG 复审删除，理由见下）** |
| Base | **`AUTHORITATIVE_IMPLEMENTATION_BASE`** ＝ pre-implementation governance HEAD（**与 `T-VUX-1/2/4` 同一不可变起点**） |
| 并行 lane | `lane/T-VUX-3`，与其余三票同时起飞 |
| 上游 | 集成规格 §6 / §7（U-14 / U-27）；`DEC-3 = CHINESE_FIRST` |
| 主要文件 | `extension/src/content/pageScanner.ts`（`showSelectionAction` ~L150-171、`mouseup` ~L173-189、`click` ~L191-199、`selectionchange` ~L201-203）、`extension/src/content/annotator.ts`（`.avr-selection-action` 样式块） |
| 部署 seam | `extension/manifest.json`（`content_scripts.js = ["content.js"]`）→ `build.mjs`（`content/index.ts` → `dist/content.js`）→ 真实 Chrome 加载 `dist/` |
| 状态 | IMPLEMENTATION_STATUS = ACCEPTED_AND_INTEGRATED<br>ACCEPTED_TIP = db461e422084ea144fc31cec4d80e8740b5dc182<br>INTEGRATED_IN = 5cea02e286a852c8407fc2cafefbc389236bf016 |

> **2026-09-10 DAG 复审：`T-VUX-1 → T-VUX-3` 边已删除。**
> 原 rationale 是「共用 `annotator.ts` 注入样式块」+「几何体系负向断言的可判定性」——**二者都不是语义依赖**：
> 1. 本票不消费 `T-VUX-1` 产出的任何实现物（无 API / 常量 / 类型 / 组件 / 服务 / DOM 契约 / 编译期接口需求）；
> 2. 本票的胶囊定位**是 ticket-local 的**，既有样式与函数都在 base 中已存在，可独立实现；
> 3. 共用样式模板属 `SOFT_INTEGRATION_CONFLICT`，由集成 lane 对账。
>
> **反事实测试**：假设 `T-VUX-1` 永不实施，本票仍持有权威 base 与 `RULES.md` / 集成规格 / 冻结 UX，能否实现并通过 AC-1~AC-10？→ **能**。故无边。

---

## 1. 目标

仅调整**拖选恢复胶囊的呈现**：居中于选区上方、中文文案。**不重写已验证的选区竞态处理与严格 token 校验机制。**

## 2. 已验证行为（必须保留 —— 本票**不重写机制**）

| # | 已验证事实 | 证据位置 |
|---|---|---|
| P-1 | 真实 `mousedown/mousemove/mouseup` 时间线与拖选后 click 序列已被 E2E 覆盖 | `pageScanner.ts` + `e2e-verify.cjs:697-730`（原文所称「AC-9」为标示性引用，`e2e-verify.cjs` 无该编号方案） |
| P-2 | `mousedown` 抢占（`event.preventDefault()`）防止选区被胶囊抢走 | `pageScanner.ts:161` |
| P-3 | 点击后 `hideSelectionAction()` + `removeAllRanges()` + `handleUserAction(word,'learning')` | `pageScanner.ts:165-167` |
| P-4 | 严格 token 校验：`normalizedSelectedWord()` trim 首尾标点、含空白/多词/纯数字一律返回 null，不做拼接 | `pageScanner.ts:177` |
| P-5 | 未命中 / 已 learning / 已 known → 静默不弹 | `pageScanner.ts:180-183` |
| P-6 | `selectionchange` 清空选区即隐藏 | `pageScanner.ts:201-203` |
| P-7 | 外部 click 隐藏 + `pendingSelectionGestureTarget` 手势去重 | `pageScanner.ts:191-199` |
| P-8 | 选区文本仅瞬时本地解析，不持久化、不进快照 | 隐私边界 |

## 3. 新增 Delta（D-7）

1. **位置**：胶囊**水平居中于选区上方**（当前为选区左下：`left = x`、`top = y + 6`）。
   - 上方空间不足时**下移到选区下方**（沿用与 tooltip 一致的「上方优先」直觉即可，不必复用几何 seam——胶囊尺寸已知且规则简单；**若实现选择复用 `calculateTooltipPosition`，允许但非强制**）。
   - 左右不越视口。
2. **文案**：**简洁中文**（DEC-3）。当前 `加入生词本` 已合规，**可保留可改**——具体文案与是否带图标**由实现者判断**（冻结 UX §4.3 对胶囊的视觉描述属**描述性**，未被标记 Normative；本票**不将其提升为规范**）。**唯一硬约束：不得中英混排**（禁止 `Mark as Learning · 不会` 之类）。
3. **不改**：P-1~P-8 全部机制**不得重写**；只允许改 `showSelectionAction` 内的**定位计算**与 `textContent`。

## 4. 验收标准

| AC | 断言 |
|---|---|
| AC-1 | 拖选一个可解析普通词 → 胶囊出现在选区**上方水平居中**（胶囊中心 x ≈ 选区中心 x） |
| AC-2 | 选区贴近视口顶部 → 胶囊下移到选区下方，不越视口顶部 |
| AC-3 | 选区贴近左右边缘 → 胶囊不越左右视口 |
| AC-4 | 胶囊文案为**简洁中文**且**无中英混排**（不指定具体文案；图标是否存在不作断言） |
| AC-5 | 点击胶囊 → 写入 `WordState=learning`（source=manual），不写 `AssessmentEvidence`、不改估计（P-3 保持） |
| AC-6 | 多词 / 含空白 / 连字符 / 标点 / 纯数字选区 → 静默不弹（P-4 保持） |
| AC-7 | 未收录词 / 已 learning / 已 known → 静默不弹（P-5 保持） |
| AC-8 | 真实鼠标拖选 + 点击序列仍通过（E2E AC-9 不回归） |
| AC-9 | 选区文本零持久化（隐私断言不回归） |
| AC-10 | 胶囊出现不产生布局位移（`layoutShiftScore` 仍 0） |

## 5. 负向断言

1. 不得重写选区竞态处理（`mousedown` 抢占、`pendingSelectionGestureTarget`、`selectionchange` 隐藏）。
2. 不得放宽严格 token 校验（不得为「更好看」而接受多词、拼接或含空白选区）。
3. 不得把选区文本持久化或写入快照。
4. 不得中英混排。
5. 不得新增持久化 schema 或设置项。
6. 不得改变写入语义（`source=manual`，不写 `AssessmentEvidence`）。
7. **不得新建通用浮层几何框架**：本票只允许在 `showSelectionAction` 内实现**胶囊局部**的定位计算（居中于选区上方 / 上方不足下移 / 左右夹取）。禁止把该逻辑抽象为供 tooltip / 浮层 / 胶囊**共用**的通用几何工具，禁止复制 `calculateTooltipPosition` 的函数体去另立**第二套通用几何体系**。
   - **允许但非必需**：实现时就地调用既有 `calculateTooltipPosition`（若这样做更简单）。
   - **明确否定**：本条**不得**被解释为「胶囊定位依赖 `T-VUX-1` 完成」或「须等待几何基线就绪」。既有 `calculateTooltipPosition` 与 `.avr-selection-action` 样式**在 base 中已存在**，本票可独立实现。约束的对象是**通用框架化**，不是**局部定位**。

## 6. 测试要求

### 6.1 DOM 测试 seam（**实施首步须确认**）

`showSelectionAction` 当前是 `pageScanner` 内的**模块级局部函数**，不可直接导出调用，且**未核验**仓库是否已有 jsdom/DOM 测试环境。因此：

- 实施首步**先核验**现有 DOM 测试能力；
- **若不存在**，则建立可注入的 DOM 测试 seam（jsdom 或等效），使定位计算可被单测；
- 建立 seam 时**不得仅为可测性而改变生产行为**（不得把定位逻辑挪到不自然的位置）；
- 若确认无法建立 seam，须在报告中**如实标注**，并以 §7 的**行为级 Chrome 验证**兜底，**不得静默降级为「不测」**。

### 6.2 测试项

- **单元测试**：`showSelectionAction` 定位计算（居中上方 / 上方不足下移 / 左右夹取）在给定选区 rect 下的输出。
- **回归**：vitest 283 条全绿；Python 12 条全绿；真实拖选断言（`e2e-verify.cjs:697-730`）不得放宽。
- **E2E**：AC-1~AC-3、AC-6~AC-8 各至少一条断言。

## 7. Chrome 运行时验证

```bash
npm run build && AVR_E2E_NO_SANDBOX=1 npm run test:e2e
```

**须经 `dist/` 真实产物在 Chrome 中验证**（几何与文案类验收不得只验 TS 单测）。

真实 Chrome 手动确认：拖选正文中部一个普通词 → 胶囊在其上方居中；拖选页面顶部第一行 → 胶囊下移；拖选靠近右边缘 → 胶囊不越界；拖选两个词 → 不弹；点击胶囊 → 该词进入生词本并呈现琥珀实线。

## 8. 允许修改范围

- `extension/src/content/pageScanner.ts`（**仅** `showSelectionAction` 的定位计算与文案）
- `extension/src/content/annotator.ts`（`.avr-selection-action` 样式：定位相关属性）
- `extension/src/content/pageScanner.test.ts`（或相应测试文件；含 §6.1 的 seam）
- `e2e-verify.cjs`
- `extension/manifest.json` / `build.mjs`（**仅当**确实需要新增注入资源或打包入口时；属交付 seam，`AGENTS.md` §4.1-12）

**禁止触碰**：`normalizedSelectedWord()`、选区事件绑定、`types.ts`、`storage.ts`、`worker/`、`popup*`、`docs/`、`RULES.md`。

### 8.1 集成冲突提示（**非依赖**）

- `annotator.ts`：本票只落在 `.avr-selection-action`（`annotator.ts:119-130`），与 `T-VUX-1`（`.avr-word` L56 起）及 `T-VUX-2`（`.avr-action-menu` L102-118）位于**同一注入样式模板字面量**（`annotator.ts:54-133`）的**不同 selector 区块**。属 `SOFT_INTEGRATION_CONFLICT`（同块相邻区域），**非依赖**。
- `e2e-verify.cjs`：四票共享，含集中式 `FAILURE_TABLE` 注册表（`e2e-verify.cjs:28-43`）。

处理方式：各自只改**自己的 selector 区块**；合并冲突由集成 lane 对账。**不得**为规避冲突而等待兄弟票。

## 9. 安全与隐私边界

选区文本仅瞬时本地用于解析：不持久化、不记录、不进快照、不传输（P-8 与隐私断言不得回归）。

## 10. 完成判据

`typecheck` exit 0 · `npm test` ≥283 passed · Python 12 passed · build 成功 · `E2E ALL PASS` · AC-1~AC-10 全绿 · §5 负向断言全绿 · **几何/文案类 AC 经 `dist/` 真实产物在 Chrome 中确认**。
