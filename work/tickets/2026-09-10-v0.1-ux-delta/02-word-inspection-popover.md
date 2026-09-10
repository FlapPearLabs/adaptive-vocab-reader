# T-VUX-2 · Word Inspection Popover

| 项 | 值 |
|---|---|
| Ticket ID | `T-VUX-2` |
| 批次 | `2026-09-10-v0.1-ux-delta` |
| 覆盖 Delta | **D-2** / **D-3** |
| Blockers | **—（无硬语义 blocker；`T-VUX-1 → T-VUX-2` 边已于 2026-09-10 DAG 复审删除，理由见下）** |
| Base | **`AUTHORITATIVE_IMPLEMENTATION_BASE`** ＝ pre-implementation governance HEAD（**与 `T-VUX-1/3/4` 同一不可变起点**；不再是「T-VUX-1 的 HEAD」） |
| 并行 lane | `lane/T-VUX-2`，与其余三票同时起飞 |
| 上游 | 集成规格 §6 / §7；**冻结 UX §2.1 / §7.1（`释义暂不可用` 与元数据失败正交性的权威来源）**；`DEC-3 = CHINESE_FIRST` |
| 主要文件 | `extension/src/content/annotator.ts`（操作菜单 ~L200-260、几何 seam `calculateTooltipPosition` L154 / `positionTooltip` L184） |
| 部署 seam | `extension/manifest.json`（`content_scripts.js = ["content.js"]`）→ `build.mjs`（`content/index.ts` → `dist/content.js`）→ 真实 Chrome 加载 `dist/` |
| 状态 | 待用户明确「开始开发」授权 |

---

## 1. 目标

把阅读面**点击层**从极简双按钮菜单升级为 **Word Inspection Popover**：展示词头 / 音标 / 词性 / 释义，并提供「会 / 不会」两个显式动作；补齐 **Esc 关闭**。几何**必须复用**已验证的 `calculateTooltipPosition` seam。

## 2. 已验证行为（必须保留）

| # | 已验证事实 | 证据位置 |
|---|---|---|
| P-1 | `calculateTooltipPosition` 已实现并被测试覆盖：上方优先 / 下方翻转 / 左右视口 12px 安全边距 / 不侵入 sticky / 滚动后正确 | `annotator.ts:154`、`annotator.test.ts:287-301`、E2E |
| P-2 | 点击后触发 `actionHandler` 立即提交并 `hideAnnotationActionMenu()` 自动关闭 | `annotator.ts:239-244` |
| P-3 | 外部点击关闭已实现 | `annotator.ts:248-250` |
| P-4 | 悬停只出轻提示、不弹完整浮层、不改状态 | `annotator.ts:268` |
| P-5 | 取消/关闭**不改状态** | 不变式 |
| P-6 | 未收录词点击不弹菜单、零持久化 | E2E AC-10 |
| P-7 | 所有 query-eligible 词都包 `avr-word`（点击目标来源） | `e2e-verify.cjs:472` |

## 3. 新增 Delta

### D-2 · Word Inspection Popover

点击可查询词弹出浮层，内容来自 `DictEntry` **既有字段**（`phonetic` / `pos` / `translation`），展示：

1. 词头（页面实际词形 `surfaceForm`，保留原文大小写）；
2. `phonetic`；
3. `pos`；
4. `translation`；
5. 两个显式动作：**会** / **不会**（中文优先，DEC-3；不得 `Mark as Learning · 不会` 中英混排）。

**几何硬约束（不可协商）**：

- **复用 `calculateTooltipPosition`**（`annotator.ts:154`）或其在实施时的权威等价 seam。
- **禁止另写一套浮层定位/翻转/夹取算法**；禁止复制该函数体。
- 若现有 seam 参数不足以支撑浮层（例如需要浮层自身尺寸），**扩展既有 seam 的签名并在 `annotator.test.ts` 补断言**，而不是新建第二个几何函数。
- 行为要求：上方优先、不足下翻、左右视口 12px 夹取、不遮挡目标词、滚动同步。

**元数据失败**：`translation` 缺失时显示 `释义暂不可用`，**不得合成占位释义**。

> **权威来源（本票直接消费上位权威，不依赖任何 sibling ticket）**：`释义暂不可用` 与「元数据解析失败与词汇学习状态正交」由**上位权威**确定——冻结 `UX_SPEC_V1.2.1` §2.1（行 87）与 §7.1（行 233）、集成规格 U-18 / U-42 / D-1、`RULES.md` `DEC-3`。因此本票**无需等待** `T-VUX-1`：即便 `T-VUX-1` 永不实施，本票仍能实现并独立通过 AC-7。两者各自消费同一权威契约。

**归属提醒**：本票负责**浮层**路径的兜底文案渲染；`T-VUX-1` 负责**轻提示 / tooltip** 路径。二者是**同一权威契约在两个展示面上的分别实现**，不是上下游依赖。

### D-3 · Esc 关闭

- 浮层打开时按 `Esc` 关闭。
- 外部点击关闭（P-3）与 X/关闭（若有）**均不改状态**。

## 4. 验收标准

| AC | 断言 |
|---|---|
| AC-1 | 点击可查询词 → 浮层出现，含词头 + 音标 + 词性 + 释义 |
| AC-2 | 浮层含「会」「不会」两个动作按钮；点击后立即提交并自动关闭（P-2 保持） |
| AC-3 | 浮层几何：上方优先；上方不足时下翻；左右不越视口（≥12px 边距）；不遮挡目标词；页面滚动后位置仍正确 |
| AC-4 | **定位逻辑复用 `calculateTooltipPosition`**：代码检索中浮层定位调用点唯一指向该 seam（或经本票扩展的同一 seam），无第二套几何实现 |
| AC-5 | `Esc` 关闭浮层；关闭后 `WordState` 未变化 |
| AC-6 | 外部点击关闭；关闭后 `WordState` 未变化 |
| AC-7 | 元数据缺失时浮层显示 `释义暂不可用`，**零 `WordState` 写入**（夹具来源见 §6.0） |
| AC-8 | 悬停仍只出轻提示、不弹浮层、不改状态（P-4 保持） |
| AC-9 | 未收录词点击仍不弹浮层、零持久化（P-6 不回归） |
| AC-10 | 浮层打开/关闭不产生布局位移（`layoutShiftScore` 仍 0） |

## 5. 负向断言

1. 浮层渲染/打开/关闭**全程不写** `WordState` / `AssessmentEvidence` / storage。
2. 取消（Esc / 外部点击）**不得**写入任何状态。
3. **不得新增第二个浮层几何函数**；不得硬编码 `left=rect.left, top=rect.bottom+4` 这类无翻转/无夹取的定位。
4. 不得引入 `detailZh` / `nuance` / `ipa` / `zh` 字段或别名；浮层字段只能是既有 `DictEntry` 字段。
5. 不得新增持久化 schema 或设置项。
6. 不得把 `METADATA_RESOLUTION_FAILURE` 建模为词汇学习状态。
7. 不得新增中英混排 UI 文案。
8. 不得让点击浮层动作改变 `hint` 候选判定或 bootstrap 公式。

## 6. 测试要求

### 6.0 元数据失败路径夹具来源（**必须遵守**）

E2E 词包是**真实的** ECDICT 派生资产，**不存在**「`translation` 缺失」的自然词条。AC-7 的失败路径**只能**经以下之一构造：

- **A. E2E fixture 页面自造**：在 E2E 生成的测试页中注入人工构造的、元数据缺失的词条场景；
- **B. 纯 DOM 单元测试**：以手工 `DictEntry`（缺 `translation`）验证浮层文案。

**禁止**依赖真实词包中伪造或改写的数据；**禁止**为使夹具成立而修改 `data/` 或数据构建脚本。

### 6.1 测试项

- **单元测试**：
  - 复用既有 `calculateTooltipPosition` 断言（上方/下翻/夹取）并补充浮层尺寸入参后的断言；
  - Esc 关闭：`keydown` → 浮层隐藏且无状态写入；
  - 元数据缺失 fixture → 浮层文案含 `释义暂不可用`。
- **回归**：vitest 283 条全绿；Python data tests 12 条全绿。
- **E2E**：AC-1~AC-10 各至少一条断言；既有未收录词断言与 T-VUX-1 新增断言不得放宽。

## 7. Chrome 运行时验证

```bash
npm run build && AVR_E2E_NO_SANDBOX=1 npm run test:e2e
```

**须经 `dist/` 真实产物在 Chrome 中验证**（几何类验收不得只验 TS 单测）。

真实 Chrome 加载构建产物后人工确认：

1. 点击词 → 浮层在上方；靠近视口顶部时下翻；靠近左右边缘时不越界；
2. 滚动页面 → 浮层跟随目标词；
3. `Esc` / 外部点击 → 关闭且无状态变化（刷新后该词状态不变）；
4. 点「不会」→ 立即关闭、该词进入生词本、呈现 T-VUX-1 的琥珀实线；
5. 元数据缺失词 → 浮层显示 `释义暂不可用`。

## 8. 允许修改范围

- `extension/src/content/annotator.ts`（浮层 DOM/样式/事件、`calculateTooltipPosition` 可能的**签名扩展**）
- `extension/src/content/annotator.test.ts`
- `e2e-verify.cjs`
- `extension/manifest.json` / `build.mjs`（**仅当**确实需要新增注入资源或打包入口时；属交付 seam，`AGENTS.md` §4.1-12）

**禁止触碰**：`types.ts`（字段契约不变）、`storage.ts`、`worker/`、`strategy/`、`pageScanner.ts`（选区逻辑属 T-VUX-3）、`popup*`、`docs/`、`RULES.md`。

### 8.1 集成冲突提示（**非依赖**）

本票与 `T-VUX-1` / `T-VUX-3` 都修改 `annotator.ts` 的**同一个注入样式模板字面量**（`annotator.ts:54-133`）；本票主要落在 `.avr-action-menu`（L102-118）区间。四票均会修改 `e2e-verify.cjs`（含其集中式 `FAILURE_TABLE` 注册表，`e2e-verify.cjs:28-43`）。

这些属 `SOFT_INTEGRATION_CONFLICT`，由集成 lane 对账，**不构成 blocker，也不需要等待兄弟票**。本票**只实现浮层自身**，不得顺手改动兄弟票拥有的 selector 区块。

## 9. 安全与隐私边界

浮层内容只在页面内存活；不持久化、不传输、不记录；不得把页面句子或上下文写入任何存储（隐私断言不得回归）。

## 10. 完成判据

`typecheck` exit 0 · `npm test` ≥283 passed · Python 12 passed · build 成功 · `E2E ALL PASS` · AC-1~AC-10 全绿 · §5 负向断言全绿 · **几何 seam 唯一性经检索确认** · **几何类 AC 经 `dist/` 真实产物在 Chrome 中确认**。
