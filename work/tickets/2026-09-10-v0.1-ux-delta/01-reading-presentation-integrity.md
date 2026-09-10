# T-VUX-1 · Reading Presentation Integrity

| 项 | 值 |
|---|---|
| Ticket ID | `T-VUX-1` |
| 批次 | `2026-09-10-v0.1-ux-delta` |
| 覆盖 Delta | **D-1** / **D-4** / **D-5** / **D-6** |
| Blockers | **—（无硬语义 blocker）** |
| Base | **`AUTHORITATIVE_IMPLEMENTATION_BASE`** ＝ pre-implementation governance HEAD（详见批次 README；**不是** `origin/main`，**也不是**任何 sibling ticket 的 HEAD） |
| 并行 lane | `lane/T-VUX-1`，与 `T-VUX-2` / `T-VUX-3` / `T-VUX-4` **同时起飞**（语义 DAG 为空，四票互不依赖） |
| 上游 | 集成规格 §6 / §7；`DEC-1 = AMBER_SYSTEM`；`DEC-3 = CHINESE_FIRST` |
| 主要文件 | `extension/src/content/annotator.ts`（注入样式块 ~L55-130、`showTooltip` ~L268-286、行内释义 ~L360-385）、`extension/src/content/annotator.test.ts` |
| 部署 seam | `extension/manifest.json`（`content_scripts.js = ["content.js"]`、`all_frames:true`、`document_idle`）→ `build.mjs`（`content/index.ts` → `dist/content.js`）→ 真实 Chrome 加载 `dist/` |
| 状态 | 待用户明确「开始开发」授权 |

---

## 1. 目标

把阅读面的**呈现完整性**补齐：元数据解析失败有明确兜底、宿主排版不可污染注入词 span、learning 行内释义符合冻结 UX 格式、下划线改用 DEC-1 琥珀视觉族。**本票不引入任何新的产品能力、新的状态、新的持久化。**

## 2. 已验证行为（必须保留 —— 不得重写、不得回归）

以下均为 RESUME-01 fresh 验证的实现事实（集成规格 §6），本票**只在其上叠加呈现**，不得移除：

| # | 已验证事实 | 证据位置 |
|---|---|---|
| P-1 | 所有 query-eligible 词都包 `avr-word`；known 词仍是可查询透明 span | `e2e-verify.cjs:472-473` |
| P-2 | 稀疏灰线由 `hintDisplayDecision(effectiveFrequencyRank, status, threshold)` + bootstrap `S[⌊n/2⌋]` 选出（实测 light/100 词 ≈ 4.55） | `pageScanner.ts` + E2E |
| P-3 | 未收录词零样式、零持久化、显式查询回 `当前词典未收录` | E2E AC-10（`e2e-verify.cjs:617-628`） |
| P-4 | 行内释义首现契约：`showInlineTranslation = isLearning && occurrenceCount === 1`；重复出现仅下划线 | `pageScanner.ts:133`、`annotator.ts:426` |
| P-5 | 下划线用 `text-decoration` 实现，**零布局位移**（`layoutShiftScore 0`） | E2E 性能观测 |
| P-6 | 渲染/悬停不创建或改写 `WordState` | 不变式 + E2E |
| P-7 | query eligibility 与 hint eligibility 独立：缺有效频率排名仍可查询 | `RULES.md` |
| P-8 | `light` 与 `learning` 的**强度区分**（点线 vs 实线） | `annotator.ts` 样式块 |

## 3. 新增 Delta（本票要实现的）

### D-1 · `METADATA_RESOLUTION_FAILURE` 兜底（轻提示路径）

- 引入领域术语 `METADATA_RESOLUTION_FAILURE`：释义/元数据解析失败**不是**词汇学习状态。
- **所有 tooltip / 轻提示显示路径**在元数据缺失时**显示兜底文案 `释义暂不可用`**，而不是当前 `annotator.ts:271-281` 语义下的静默 return（`pointerover` 分支在 `!translation || !phonetic || !pos` 时直接 `return`，无提示）。
  > 实测 tooltip 有**两条**显示路径：`pointerover` → `showTooltip`（`annotator.ts:271-281`）与 `click` → `showUnresolvedTooltip`（`annotator.ts:253-256`，仅用于 `data-unresolved`）。本 AC 按**行为**断言（「元数据缺失时任何 tooltip 都显示该文案」），**不绑定具体事件名**，避免因实现选择不同入口而漏判。
- 中文优先（DEC-3）：文案固定为 `释义暂不可用`。
- **不得合成占位释义**（禁止返回空串、占位符或推测释义）。
- 本票**只定义术语、文案常量与轻提示行为**；**T-VUX-2 的浮层只消费本票定义的文案，不重新定义**。

### D-4 · 宿主排版隔离

- `.avr-word`（及 `light`/`strong` 变体）显式声明 `font-family / font-size / font-weight / color / line-height / letter-spacing: inherit !important`（`color:inherit` 已存在）。
- 目的：宿主 `span {}` 之类通用选择器不得污染注入词 span 的排版。
- 不得因此改变 `text-decoration` 相关的下划线呈现（P-5 零位移必须保持）。

### D-5 · learning 行内释义格式

- 由当前 `【translation】` 改为 `{posPrefix}{translation}`（例：`adj. 短暂的`）。
- 补 `user-select: none`、间距 `0.35em`、`line-height: 1`、字号 11–12px、斜体。
- 配色随 **DEC-1 暖琥珀族**（`RULES.md` DEC-1），**不得为 `#c0392b` 红色**。
- 词性前缀取自 `DictEntry.pos`；`pos` 缺失时**省略前缀**，只显示 `translation`（不得合成词性）。
- 保持 P-4 首现契约：`occurrenceCount === 1` 才显示。

### D-6 · 下划线配色（DEC-1 `AMBER_SYSTEM`）

- `light` ＝ 淡琥珀**点线**；`learning` ＝ 淡琥珀**实线**。
- **不得出现红色或刺眼警示色**（替换 `#e74c3c` / `#c0392b`）。
- `#f59e0b` / `#d97706` 为**非规范性**视觉参考；若实现需要设计 token，记在样式常量处，**不得写进领域契约或类型**。
- 保留 P-8 的点线/实线强度区分，只改色相。

## 4. 验收标准（Acceptance Criteria）

| AC | 断言 |
|---|---|
| AC-1 | **所有 tooltip / 轻提示显示路径**在元数据缺失时显示 `释义暂不可用`；**不得静默无提示**（按行为断言，不绑定事件名） |
| AC-2 | 元数据缺失词：**零 `WordState` 写入**，快照前后深度相等（不变式） |
| AC-3 | 元数据缺失不改变展示决策：known+失败仍纯文本、light+失败仍点线、learning+失败仍实线但省略行内释义 |
| AC-4 | 宿主注入 `span { font-family: X; font-size: Y; color: Z; line-height: W; letter-spacing: V }` 的测试页中，注入词 span 的 computed style 与宿主正文一致 |
| AC-5 | learning 首现行内释义格式为 `{posPrefix}{translation}`；`pos` 缺失时只显示释义（**夹具来源见 §6**） |
| AC-6 | 行内释义带 `user-select: none`，不可被选中 |
| AC-7 | learning 重复出现**仅下划线、无行内释义**（P-4 保持） |
| AC-8 | `light` 计算样式为琥珀点线、`learning` 为琥珀实线；**断言中不得出现红色** |
| AC-9 | 全页 `layoutShiftScore` 仍为 0（P-5 保持） |
| AC-10 | 未收录词仍零样式、零持久化、回 `当前词典未收录`（P-3 不回归） |

## 5. 负向断言（Negative Assertions）

1. 悬停/渲染/元数据失败**全程不写** `WordState`、`AssessmentEvidence`、任何 storage 键。
2. 不得出现任何按「元数据是否可用」改写 `WordState.status` 的分支。
3. 不得引入 `detailZh` / `nuance` / `ipa` / `zh` 字段或别名。
4. 不得新增持久化 schema、不做迁移。
5. 不得把 hex 值写进 `types.ts` 或领域层（只允许出现在样式常量）。
6. 不得新增中英混排 UI 文案。
7. 不得改变 `hint` 候选判定（`effectiveFrequencyRank > 阈值`）或 bootstrap 公式。
8. 不得移除/削弱阅读面的当前页瞬时处理（DEC-4 只延后 popup「本页」产品面）。

## 6. 测试要求

### 6.0 失败路径夹具来源（**必须遵守**）

E2E 词包是**真实的** ECDICT 派生资产，**不存在**「`translation` 缺失」的自然词条。因此 D-1（AC-1/AC-2/AC-3）的失败路径**只能**经以下之一构造：

| 路径 | 做法 |
|---|---|
| **A. E2E fixture 页面自造** | 在 E2E 生成的测试页（`e2e-verify.cjs:535` 的 `ux-reading.html`）中注入**人工构造**的、元数据缺失的词条场景 |
| **B. 纯 DOM 单元测试** | 以 jsdom + 手工 `DictEntry`（缺 `translation`）验证 tooltip 文案 |

**禁止**：依赖真实词包中伪造或改写的数据；**禁止**为使夹具成立而修改 `data/` 或数据构建脚本。

### 6.1 DOM 测试 seam（**实施首步须确认**）

D-5 / D-1 的单元测试需要能触达行内释义拼装与 tooltip 文案的 DOM seam。该 seam 当前**未核验**是否存在（行内释义拼装路径未导出）。实施首步必须：**先核验**仓库现有 DOM/jsdom 测试能力；**若不存在**，则建立可注入的 DOM 测试 seam（jsdom 或等效），**不得仅为可测性而改变生产行为**。若确认无法建立，须在报告中如实标注并改用**行为级**验证覆盖，不得静默降级为「不测」。

### 6.2 单元测试

- **单元测试**（`extension/src/content/annotator.test.ts` 或新增）：
  - D-1：元数据缺失 → tooltip 内容含 `释义暂不可用`，且 `actionHandler` 未被触发、storage 未写。
  - D-5：`pos` 存在/缺失两种 fixture 下的行内释义文本。
  - D-6：样式常量不含红色系值（断言色值非 `#e74c3c` / `#c0392b` 且属琥珀族区间）。
  - D-4：`calculateTooltipPosition` 既有 3 条断言不得回归。
- **回归**：既有 vitest 283 条全绿，Python data tests 12 条全绿。
- **E2E**（`e2e-verify.cjs` 扩展）：AC-1/2/4/5/7/8/9/10 至少各一条断言；既有未收录词断言（`e2e-verify.cjs:617-628`）不得放宽。

## 7. Chrome 运行时验证（必须真实浏览器）

```bash
npm run build
AVR_E2E_NO_SANDBOX=1 npm run test:e2e
```

**须经 `extension/manifest.json` + `build.mjs` 打包出的 `dist/` 真实产物在 Chrome 中验证**，不得只验 TS 单测。

另需在**真实 Chrome 加载已构建扩展**下人工确认（不截图留档、不记录页面文本）：

1. 打开含宿主 `span{}` 通用样式的英文测试页 → 注入词排版与正文一致；
2. 触发一个元数据缺失词 → tooltip 出现 `释义暂不可用`；
3. 标记一个词为 learning → 首现带琥珀实线 + `{posPrefix}{translation}` 行内释义，同页后续出现仅下划线；
4. 观察页面无布局跳动。

## 8. 允许修改范围

- `extension/src/content/annotator.ts`（注入样式块、tooltip 兜底、行内释义拼装）
- `extension/src/content/annotator.test.ts`
- `e2e-verify.cjs`（新增断言）
- 若样式常量需集中，允许在 `extension/src/content/` 内新增**仅含样式常量**的文件（不得引入领域逻辑）
- `extension/manifest.json` / `build.mjs`（**仅当**确实需要新增注入资源或打包入口时；属交付 seam，`AGENTS.md` §4.1-12）

**禁止触碰**：`types.ts`、`storage.ts`、`worker/`、`strategy/`、数据构建脚本、`docs/`、`RULES.md`。

### 8.1 实施前检查项（**开工首步，只报告、不顺手改**）

1. 从修正后的 **pre-implementation governance HEAD** 建立施工分支（不是 `origin/main`）；
2. 核验/建立 DOM 测试 seam（§6.1）；
3. `tempDir` 夹具隔离性**已核验通过**（`e2e-verify.cjs:251` `fs.mkdtempSync(path.join(os.tmpdir(), 'avr-e2e-'))` → 每进程唯一目录），**不是**共享资源，本项无需再查。真正的宿主机级约束是 **HTTPS fixture server 的固定端口 `18923`**（`e2e-verify.cjs:21` `const PORT = 18923`；`:153` `server.listen(PORT, '127.0.0.1', …)`，无 env 覆盖）：完整 `npm run test:e2e` 须先取得 **`E2E_PORT_18923_LOCK`**（批次 `README.md` §3）。遇 `EADDRINUSE` 时**只报告**、等待资源槽，**不修改** `e2e-verify.cjs`——端口安全改造属超出本票范围的基础设施改动，须单独授权；
4. 确认新 worktree 具备 local-only 词包恢复能力（`data/README.md` 的确定性恢复流程），缺资产须 fail-closed。

## 9. 安全与隐私边界

快照不得含 URL / 域名 / 页面标题 / 正文 / 句子 / 浏览历史（既有隐私断言不得回归）。tooltip 与行内释义只在页面内存活，不持久化、不传输。

## 10. 完成判据

`typecheck` exit 0 · `npm test` ≥283 passed · Python data tests 12 passed · `npm run build` 成功 · `AVR_E2E_NO_SANDBOX=1 npm run test:e2e` = `E2E ALL PASS` · §4 AC-1~AC-10 全绿 · §5 负向断言全绿 · **几何/注入类 AC 经 `dist/` 真实产物在 Chrome 中确认**。
