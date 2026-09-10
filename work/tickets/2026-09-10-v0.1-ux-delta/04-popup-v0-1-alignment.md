# T-VUX-4 · Popup V0.1 Alignment

| 项 | 值 |
|---|---|
| Ticket ID | `T-VUX-4` |
| 批次 | `2026-09-10-v0.1-ux-delta` |
| 覆盖 Delta | **D-8** / **D-9** / **D-10** |
| Blockers | **—（无硬语义 blocker；保持）** |
| Base | **`AUTHORITATIVE_IMPLEMENTATION_BASE`** ＝ pre-implementation governance HEAD（**与 `T-VUX-1/2/3` 同一不可变起点**；**不**从兄弟票 HEAD 起分支） |
| 并行 lane | `lane/T-VUX-4`，与其余三票同时起飞 |
| 上游 | 集成规格 §5.7 / §7；`DEC-2 = DEFER_SETTINGS_FROM_V0_1`；`DEC-3 = CHINESE_FIRST`；`DEC-4 = DEFER_THIS_PAGE_FROM_V0_1` |
| 主要文件 | `extension/src/popup.ts`（`renderTabs` ~L118-155、生词本 ~L156-200、首测 ~L201-320、估计 ~L360-362）、`extension/src/popupNotebook.ts`、`extension/popup.css:26`、`extension/popup.html` |
| 部署 seam | `extension/manifest.json`（`action.default_popup = "popup.html"`）→ `build.mjs`（`popup.ts` → `dist/popup.js`；`popup.html` / `popup.css` 直接拷贝） |
| 状态 | 待用户明确「开始开发」授权 |

---

## 1. 目标

把 popup 对齐 V0.1：**移除 Settings 与「本页」页签**（DEC-2 / DEC-4），保留并整理「生词本 / 水平测评」导航与既有 Level Check 集成，宽度 `320px`，补生词本搜索筛选与中文空状态。

## 2. 已验证行为（必须保留）

| # | 已验证事实 | 证据位置 |
|---|---|---|
| P-1 | Popup 两个页签：测评（`main`）/ 生词本（`notebook`） | `popup.ts:137-155`。**当前已无 Settings、已无本页**，故 D-8 主要是宽度 + 标签命名，而非移除页签 |
| P-2 | 首测 UI 绑定仓库 `QuizQuestion`：目标词 + 四个中文候选项 + **独立**「不确定」按钮 + `测评中 X / 50` 进度 | `popup.ts:234`、`popup.ts:255-264` |
| P-3 | 首测完成态：明确完成确认 + 答对/答错/不确定统计 | `popup.ts:294` |
| P-4 | 每日轮：`进行中 X / Y`（首测与每日校准为**两个独立领域流程**） | `popup.ts:400`、`RULES.md` |
| P-5 | 估计只显示仓库估计 seam 返回值：单点 + 保守范围 + 「不做外推」说明；**无 CEFR、无原型数字** | `popup.ts:360-362` |
| P-6 | 生词本只读 `WordState`，过滤 `status==='learning'` 且查询词典可解析；按 `updatedAt` 降序 | `popupNotebook.ts` |
| P-7 | 「已掌握」＝写 `WordState=known`（source=manual），不写 `AssessmentEvidence`、不改估计 | `popupNotebook.ts` |
| P-8 | 生词本不读 `AssessmentEvidence`；不改首测/每日/估计入口 | `popupNotebook.ts` |
| P-9 | 无任何设置持久化；无 Settings 页签 | `storage.ts` |

## 3. 新增 Delta

### D-8 · Popup V0.1 导航与宽度（范围已由 DEC-2 / DEC-4 收敛）

1. **宽度**：`380px` → **`320px`**（`popup.css:26`）。
2. **导航**：保留**两个**页签 —— `生词本`、`水平测评`（中文优先，DEC-3；现标签「测评」改为「水平测评」）。
3. **明确不建**：
   - **不建**「本页 / This Page」页签（DEC-4 延后）；
   - **不建** Settings 页签、空壳页签、禁用占位页签、推测性设置控件（DEC-2）。
4. **不重定义**测评领域契约：`QuizQuestion` / `QuizAnswer` / `InitialTestState` / `DailyTestState` / `AssessmentEvidence` 一律不变（P-2~P-5 保持）。

### D-9 · 生词本搜索筛选

- 在生词本页签加入**搜索框**，按 `wordKey`（及可见释义文本）做即时筛选。
- 纯展示层筛选：**不改数据源、不改排序、不写状态**。
- 只做最小交互（输入即筛选），不建设高级过滤/排序/分组。

### D-10 · 中文空状态

- 生词本为空、搜索无匹配等场景给出**简洁中文**空状态文案。
- **不使用**外部 UX 原文的英文串（`No matching words.`）。
- 「本页无生词」**不属本批**（DEC-4 延后「本页」页签）。

## 4. 验收标准

| AC | 断言 |
|---|---|
| AC-1 | popup 宽度计算值为 `320px`（**须经 `dist/popup.css` 真实产物确认**，不得只断言源码字符串） |
| AC-2 | 页签**恰好两个**：`生词本`、`水平测评`；**无** Settings、**无** 本页/This Page |
| AC-3 | 代码中无 settings 持久化键、无空壳/占位 Settings 页签痕迹 |
| AC-4 | 首测 UI 仍渲染 `QuizQuestion` 四要素（目标词 / 候选项 / 独立不确定 / `current/total`）（P-2 不回归） |
| AC-5 | 首测完成态仍显示完成确认与统计（P-3 不回归） |
| AC-6 | 每日轮仍显示 `进行中 X / Y`，与首测为两条独立路径（P-4 不回归） |
| AC-7 | 估计仍只显示仓库 seam 返回值（单点 + 保守范围 + 不做外推），无 CEFR、无原型数字（P-5 不回归） |
| AC-8 | 生词本搜索框输入 → 列表即时筛选；数据源与排序不变（P-6 不回归） |
| AC-9 | 搜索无匹配 / 生词本为空 → 显示**中文**空状态文案；无英文串 |
| AC-10 | 「已掌握」仍写 `known`/`manual`、不写 `AssessmentEvidence`、不改估计（P-7 不回归） |
| AC-11 | 生词本仍不读 `AssessmentEvidence`（P-8 不回归） |

## 5. 负向断言

1. **不得实现「本页 / This Page」**页签或任何页面级词表能力（DEC-4）。
2. **不得实现 Settings** 页签、设置持久化、空壳/占位/禁用页签（DEC-2）。
3. 不得重定义测评契约：`QuizQuestion` / `QuizAnswer` / 不确定下标（4）/ 进度口径不得改变。
4. 不得合并首测与每日校准两条流程。
5. 不得让生词本读取 `AssessmentEvidence`。
6. 不得新增中英混排 UI 文案；不得使用外部 UX 的英文空状态串。
7. 不得新增持久化 schema、不做迁移、不引入设置项。
8. 不得引入 CEFR / 百分位 / 年级等外推展示。
9. 不得为适配 `320px` 而删减测评题目信息或估计说明。

## 6. 测试要求

- **单元测试**：`selectNotebookEntries` 的过滤语义不回归（新增搜索筛选**只影响展示**，数据源函数语义不变则复用既有断言）；空状态渲染分支。
- **回归**：vitest 283 条全绿；Python 12 条全绿。
- **E2E**：AC-1~AC-11 各至少一条断言；首测/每日/估计既有断言不得放宽。
- **既有 E2E 依赖的 selector 稳定性**：`e2e-verify.cjs:1269/1300/1340` 使用 `.popup-tab:not(.notebook-tab)` 定位测评页签。本票若调整页签 DOM 结构或类名，**必须同步该 selector**，否则既有断言会静默失效。

## 7. Chrome 运行时验证

```bash
npm run build && AVR_E2E_NO_SANDBOX=1 npm run test:e2e
```

**须经 `dist/` 真实产物在 Chrome 中验证。**

真实 Chrome 加载构建产物后人工确认：

1. popup 打开宽度紧凑、两个页签（生词本 / 水平测评），无 Settings、无本页；
2. 走一遍首测（含「不确定」）→ 完成确认与统计正常；
3. 走一遍每日校准轮 → 进度 `进行中 X / Y`；
4. 估计区显示单点 + 保守范围 + 不做外推；
5. 生词本输入关键词 → 即时筛选；清空 → 全量；搜无结果 → 中文空状态；
6. 点「已掌握」→ 条目移出、刷新后仍为 known。

## 8. 允许修改范围

- `extension/src/popup.ts`、`extension/src/popupNotebook.ts`
- `extension/popup.html`、`extension/popup.css`
- 对应 popup 测试文件
- `e2e-verify.cjs`（新增断言；若页签 selector 变化须同步更新）

**禁止触碰**：`types.ts`（测评契约不变）、`strategy/`、`worker/`、`storage.ts`（不新增 settings 键）、`content/`、`docs/`、`RULES.md`。

### 8.1 集成冲突提示（**非依赖**）

- 与 `T-VUX-1/2/3` **文件不相交**（本票只动 popup 三件套 + 其测试）；`e2e-verify.cjs` 为四票共享面。
- **只读的 base 依赖**：`popup.ts:29` 与 `popupNotebook.ts:1` 从 `extension/src/content/dictionary.ts` 导入字典加载器与 `Dictionary` 类型。该模块**不由任何 T-VUX 票修改**（对三票均为 forbidden），因此**不产生冲突**，仅登记为共享 base 面。
- E2E 既有 selector 依赖：`e2e-verify.cjs:1269/1300/1340` 使用 `.popup-tab:not(.notebook-tab)`；本票若调整页签结构须同步，否则既有断言会静默失效。

## 9. 安全与隐私边界

popup 不展示、不记录 URL / 域名 / 页面标题 / 正文 / 句子；搜索关键词只在 popup 会话内存活，不持久化（隐私断言不得回归）。

## 10. 完成判据

`typecheck` exit 0 · `npm test` ≥283 passed · Python 12 passed · build 成功 · `E2E ALL PASS` · AC-1~AC-11 全绿 · §5 负向断言全绿 · **代码检索确认无 Settings / This Page 实现痕迹**。
