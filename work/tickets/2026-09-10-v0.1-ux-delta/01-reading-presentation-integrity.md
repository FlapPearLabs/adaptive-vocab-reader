# T-VUX-1 · Reading Presentation Integrity

| 项 | 值 |
|---|---|
| Ticket ID | `T-VUX-1` |
| 批次 | `2026-09-10-v0.1-ux-delta` |
| 覆盖 Delta | **D-1** / **D-4** / **D-5** / **D-6** |
| Blockers | —（批次第一票） |
| 上游 | 集成规格 §6 / §7；`DEC-1 = AMBER_SYSTEM`；`DEC-3 = CHINESE_FIRST` |
| 主要文件 | `extension/src/content/annotator.ts`（注入样式块 ~L55-130、`showTooltip` ~L268-286、行内释义 ~L360-385）、`extension/src/content/annotator.test.ts` |
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
- 轻提示（tooltip）在元数据缺失时**显示兜底文案 `释义暂不可用`**，而不是当前 `annotator.ts:279` 的直接静默 return。
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
| AC-1 | 元数据缺失词悬停 → 显示 `释义暂不可用`；**不得静默无提示** |
| AC-2 | 元数据缺失词：**零 `WordState` 写入**，快照前后深度相等（不变式） |
| AC-3 | 元数据缺失不改变展示决策：known+失败仍纯文本、light+失败仍点线、learning+失败仍实线但省略行内释义 |
| AC-4 | 宿主注入 `span { font-family: X; font-size: Y; color: Z; line-height: W; letter-spacing: V }` 的测试页中，注入词 span 的 computed style 与宿主正文一致 |
| AC-5 | learning 首现行内释义格式为 `{posPrefix}{translation}`；`pos` 缺失时只显示释义 |
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

- **单元测试**（`extension/src/content/annotator.test.ts` 或新增）：
  - D-1：元数据缺失 → tooltip 内容含 `释义暂不可用`，且 `actionHandler` 未被触发、storage 未写。
  - D-5：`pos` 存在/缺失两种 fixture 下的行内释义文本。
  - D-6：样式常量不含红色系值（断言色值非 `#e74c3c` / `#c0392b` 且属琥珀族区间）。
  - D-4：`calculateTooltipPosition` 既有 3 条断言不得回归。
- **回归**：既有 vitest 283 条全绿，Python data tests 12 条全绿。
- **E2E**（`e2e-verify.cjs` 扩展）：AC-1/2/4/5/7/8/9/10 至少各一条断言；既有 AC-10（未收录）不得放宽。

## 7. Chrome 运行时验证（必须真实浏览器）

```bash
npm run build
AVR_E2E_NO_SANDBOX=1 npm run test:e2e
```

另需在**真实 Chrome 加载已构建扩展**下人工确认（不截图留档、不记录页面文本）：

1. 打开含宿主 `span{}` 通用样式的英文测试页 → 注入词排版与正文一致；
2. 触发一个元数据缺失词 → 悬停出现 `释义暂不可用`；
3. 标记一个词为 learning → 首现带琥珀实线 + `{posPrefix}{translation}` 行内释义，同页后续出现仅下划线；
4. 观察页面无布局跳动。

## 8. 允许修改范围

- `extension/src/content/annotator.ts`（注入样式块、tooltip 兜底、行内释义拼装）
- `extension/src/content/annotator.test.ts`
- `e2e-verify.cjs`（新增断言）
- 若样式常量需集中，允许在 `extension/src/content/` 内新增**仅含样式常量**的文件（不得引入领域逻辑）

**禁止触碰**：`types.ts`、`storage.ts`、`worker/`、`strategy/`、数据构建脚本、`docs/`、`RULES.md`。

## 9. 安全与隐私边界

快照不得含 URL / 域名 / 页面标题 / 正文 / 句子 / 浏览历史（既有隐私断言不得回归）。tooltip 与行内释义只在页面内存活，不持久化、不传输。

## 10. 完成判据

`typecheck` exit 0 · `npm test` ≥283 passed · Python data tests 12 passed · `npm run build` 成功 · `AVR_E2E_NO_SANDBOX=1 npm run test:e2e` = `E2E ALL PASS` · §4 AC-1~AC-10 全绿 · §5 负向断言全绿。
