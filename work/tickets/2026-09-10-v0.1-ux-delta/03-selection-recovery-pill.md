# T-VUX-3 · Plain-Word Recovery UX（拖选恢复胶囊）

| 项 | 值 |
|---|---|
| Ticket ID | `T-VUX-3` |
| 批次 | `2026-09-10-v0.1-ux-delta` |
| 覆盖 Delta | **D-7** |
| Blockers | —（无验收依赖；执行顺序排在 T-VUX-1 之后仅因共用注入样式块） |
| 上游 | 集成规格 §6 / §7（U-14 / U-27）；`DEC-3 = CHINESE_FIRST` |
| 主要文件 | `extension/src/content/pageScanner.ts`（`showSelectionAction` ~L150-171、`mouseup` ~L173-189、`click` ~L191-199、`selectionchange` ~L201-203）、`extension/src/content/annotator.ts`（`.avr-selection-action` 样式块） |
| 状态 | 待用户明确「开始开发」授权 |

---

## 1. 目标

仅调整**拖选恢复胶囊的呈现**：居中于选区上方、中文文案。**不重写已验证的选区竞态处理与严格 token 校验机制。**

## 2. 已验证行为（必须保留 —— 本票**不重写机制**）

| # | 已验证事实 | 证据位置 |
|---|---|---|
| P-1 | 真实 `mousedown/mousemove/mouseup` 时间线与拖选后 click 序列已被 E2E 覆盖 | `pageScanner.ts` + `e2e-verify.cjs` AC-9 |
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
2. **文案**：中文优先（DEC-3）。当前 `加入生词本` 已为中文，可保留或改为更短的动作词；**禁止 `Mark as Learning · 不会` 中英混排**。图标可选（非必需）。
3. **不改**：P-1~P-8 全部机制**不得重写**；只允许改 `showSelectionAction` 内的**定位计算**与 `textContent`。

## 4. 验收标准

| AC | 断言 |
|---|---|
| AC-1 | 拖选一个可解析普通词 → 胶囊出现在选区**上方水平居中**（胶囊中心 x ≈ 选区中心 x） |
| AC-2 | 选区贴近视口顶部 → 胶囊下移到选区下方，不越视口顶部 |
| AC-3 | 选区贴近左右边缘 → 胶囊不越左右视口 |
| AC-4 | 胶囊文案为中文，无中英混排 |
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
7. 不得引入第二个与 `calculateTooltipPosition` 冲突的通用浮层几何体系（若复用则必须调用既有 seam）。

## 6. 测试要求

- **单元测试**：`showSelectionAction` 定位计算（居中上方 / 上方不足下移 / 左右夹取）在给定选区 rect 下的输出。
- **回归**：vitest 283 条全绿；Python 12 条全绿；E2E AC-9（真实拖选）不得放宽。
- **E2E**：AC-1~AC-3、AC-6~AC-8 各至少一条断言。

## 7. Chrome 运行时验证

```bash
npm run build && AVR_E2E_NO_SANDBOX=1 npm run test:e2e
```

真实 Chrome 手动确认：拖选正文中部一个普通词 → 胶囊在其上方居中；拖选页面顶部第一行 → 胶囊下移；拖选靠近右边缘 → 胶囊不越界；拖选两个词 → 不弹；点击胶囊 → 该词进入生词本并呈现琥珀实线。

## 8. 允许修改范围

- `extension/src/content/pageScanner.ts`（**仅** `showSelectionAction` 的定位计算与文案）
- `extension/src/content/annotator.ts`（`.avr-selection-action` 样式：定位相关属性）
- `extension/src/content/pageScanner.test.ts`（或相应测试文件）
- `e2e-verify.cjs`

**禁止触碰**：`normalizedSelectedWord()`、选区事件绑定、`types.ts`、`storage.ts`、`worker/`、`popup*`、`docs/`、`RULES.md`。

## 9. 安全与隐私边界

选区文本仅瞬时本地用于解析：不持久化、不记录、不进快照、不传输（P-8 与隐私断言不得回归）。

## 10. 完成判据

`typecheck` exit 0 · `npm test` ≥283 passed · Python 12 passed · build 成功 · `E2E ALL PASS` · AC-1~AC-10 全绿 · §5 负向断言全绿。
