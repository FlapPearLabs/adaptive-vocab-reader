# Code Review 报告：#1 本地阅读闭环 + #2 固定 50 题首测

- 生成日期：2026-07-25
- 审查流程：`/code-review`（两轴并行子代理，互不污染上下文）
- 比较基点（固定）：`4c891b9`（codex/v0.1-browser-dogfood 基线）→ `2dd3f6e`（hermes/v0.1-impl HEAD）
- 覆盖提交：`b208265` `a9edfce` `afd2f71` `44c5bd6` `2dd3f6e`
- diff 规模：35 files changed, 6443 insertions(+)

---

## Standards 轴（子代理 agent-33808cde）

### HARD — 违背已确认标准

**1. `annotator.ts` `updateWordDisplay` 重算展示决策**
RULES.md / ADR-0003 规定：「词汇展示与测试策略模块」是最高测试 seam，**所有展示决策只能由它计算，页面只能消费其结果，不得重算**。
`strategy/index.ts:40` 已算出 `showInlineTranslation`（`occurrenceCount===1`），但 `updateWordDisplay` 用 `index === 0`（已有 span 在 DOM 中的次序）自行重推「首现→行内中文」，显式丢弃策略字段 `_showInlineTranslation`。同一展示子决策在两处各算一遍、语义不同，策略产出的字段在增量路径成死值。属对 seam 规则的实质性违反。

### JUDGEMENT CALLS — 基线味道（Fowler，仅作判断参考）

**2. Duplicated Code — 词典 JSON 解析散落三处**
`[phonetic,pos,translation]` 元组 → `DictEntry` 的解析在 `dictionary.ts:72`（已有正确 helper `loadDictionaryFromJSON`）、`content/index.ts:39-43`、`popup.ts:56-60` 中重复内联。后两者应复用既有 helper。

**3. Speculative Generality / 死代码 — `getActiveWords`**
`worker/storage.ts:120` 导出，但全代码库无任何调用（仅 handoff 文档提及）。V0.1 的 #1/#2 未用到，应删除或接线上。

**4. 轻微不精确 — `content/index.ts:251`**
`vocabState[word] = { status, source: 'manual', … }` 对所有 `STATE_UPDATED` 广播一律标 `source:'manual'`，连首测作答经 worker 广播下来的 `known/learning` 也被错标为 manual。仅影响内存标签、未被任何决策读取，暂无功能后果，但状态来源失真。

### 已确认合规（未列入问题）
- ADR-0003：worker 不读词典、content 为唯一词典热路径、popup 为首测唯一入口——均符合。
- §6.5 隐私：快照不含 URL/页面/句子；`e2e-verify.cjs` 显式断言快照不含 `localhost/comment-section/sentence`。
- 审计标记绑定 `planVersion`（`quiz.ts:266` / `clearStaleAuditMarkers`）符合 #2 残余风险项。
- tsc 类型错误由 `noUncheckedIndexedAccess` 工具链兜底，未报告。

---

## Spec 轴（子代理 agent-43986762）

### (a) 规格要求但缺失 / 部分实现

**#1（Spec A：1000词垂直切片实施规格）**
- **高置信不提示 + 整套预测画像完全缺失**：`strategy/index.ts:42` 对 unknown 恒返回 `light`。Spec A §2：「*高置信不提示同时要求未知、后验均值 ≥ 0.85、单侧 90% 下界 ≥ 0.70、至少 20 道随机隐藏词审计、以及漏提示率 Wilson 单侧 90% 上界 ≤ 30%*」。无 Beta/PAV/Wilson 代码，也无 `P(会)` 输出。
- **每日校准轮 N=5..30 缺失**：无 `buildDailyPlan`，popup 无入口。Spec A §2：「*每日 N=5..30 的目标配额为 floor(N/5) / ceil(2N/5) / 剩余*」。
- **持久化快照缺测试轮次 / 十频段证据 / 审计统计**：`types.ts:154 VocabSnapshot` 仅含 `words/auditMarkers/initialTest`。Spec A §5 要求快照至少含「测试轮次、十频段证据、审计统计」。

**#2（Spec B：掌握预测与主动校准规格）**
- **每日校准轮整节（§7）未实现**。
- **审计标记生命周期「执行端」缺失**：markers 被 `addAuditMarker` 创建，但无任何「审计选择 / 审计答对 / 审计答错」消费路径，也无随机审计题 UI。Spec B §8：「*审计选择：隐藏词审计桶在两类候选之间交替抽取……*」「*审计答错或不确定：状态立即改为不会、加入活跃生词表*」。目前 markers 是死数据。
- **状态证据来源枚举仅 `manual/initial`**（`types.ts:12`），缺 Spec B §1 的「活跃生词状态核验 / 随机审计」来源。

### (b) 范围蔓延（spec 未要求）
- `build.mjs` + `e2e-verify.cjs` + `build-report.json` 属 Spec A 依赖顺序 ticket 1（基础工程与词典构建），不在 #1/#2 issue 内却一并提交。
- `applyAnswer` 的 `priority-preserved`（手动状态优先于首测结果）规格未要求。

### (c) 看似实现但有错
- 宣称「最高测试 seam」，但 `VocabStrategy` 接口（`types.ts:199`）只含 `getDisplayDecision/markKnown/markLearning`，**未含冻结题目计划与作答应用**；`popup.ts:17`、`worker/index.ts:29` 直接 `import quiz.ts` 独立函数绕过 seam。违反 Spec A 最高测试 seam：「*页面扫描、弹窗 UI、Service Worker 和存储适配器都只能消费这些输出，不能各自重算后验、阈值、抽样顺序或审计清理*」。
- `applyAnswer` 的 `priority-preserved`：当 `manual=不会` 且首测答对时，阻止状态变为 `known+审计`，与 Spec B §4「*初测答对→立即会+审计*」直接冲突。

### 核心结论
#1/#2 只交付了「显示决策 + 手动标记 + 冻结首测计划/作答」的最小闭环；规格要求的**预测画像、高置信不提示、每日校准轮、审计消费循环**四大块均处于缺失或死标记状态，且 seam 接口未按规格统一。

---

## 聚合总结（一行）

- **Standards 轴**：4 项发现（1 HARD + 3 judgement）。最严重 = HARD #1：`updateWordDisplay` 在策略模块之外重算 `showInlineTranslation`，违反最高 seam「只消费不重算」规则。
- **Spec 轴**：约 9 项发现（缺失/部分 7、范围蔓延 2、实现有错 2，交叉计数）。最严重 = (c) 最高测试 seam 未按规格统一：弹窗与 worker 直接 `import quiz.ts` 绕过 `VocabStrategy` 接口——与 Standards HARD #1 同源。

> 两轴不跨轴选冠军。但需注意：Standards HARD #1 与 Spec (c) 是同一架构缺陷的两个切面——**展示/作答决策在策略模块之外被重算与直连**，这会直接削弱 #3/#4 期望的「最高 seam 可独立测试」前提。

---

## 项目级补充（AGENTS.md §7）

- **比较基点**：`4c891b9` → `2dd3f6e`（已确认可解析、diff 非空：35 文件 / 6443 行）。
- **真实验证状态**（继承 #1/#2 实现期记录）：`tsc --noEmit` pass、`vitest` 89 pass、`python unittest` 8 pass、`build.mjs` 成功、E2E #1+#2 PASS（含 multitab_synced）。
- **未验证部分**：Spec 轴指出的 #1/#2 缺失块（预测画像 / 高置信静默 / 每日校准 / 审计消费）本就归 #3/#4/#5，非 #1/#2 承诺范围；但 (c) seam 绕过 与 HARD #1 重算 是 #1/#2 实现内真实引入的架构缺陷，建议在进 #3 前修复或纳入 #3 首件。
- **未执行操作**：未 commit / merge / close 任何 Issue，未 push，未远端写入。
