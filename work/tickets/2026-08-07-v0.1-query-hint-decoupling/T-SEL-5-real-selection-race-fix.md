# T-SEL-5 — 真实鼠标拖选路径与选区按钮竞态修复

**权威来源**：
- [查询、交互、主动提示与测评词包解耦规格（已批准）](../../../docs/specs/2026-08-06-V0.1-查询交互提示与测评词包解耦规格.md)：§3 GOAL 7、§5（lookup unresolved 的 AC-10 入口界定）、§7 USER FLOW J、§9 AC-9、§10 TEST SEAMS（真实 mouse drag）、§14 B（拖选不针对未收录）、§15.6 R-INPUT-2/3/4
- [RULES.md](../../../RULES.md)「阅读体验增强」（选区加词既有规则）、「查询、交互、主动提示与测评词包解耦」（拖选保留为辅助入口）

**Status**: 待用户授权后进入开发（DOCUMENT 阶段产物）

**What to build**：修复真实鼠标拖选的竞态，使真实 down/move/up 路径可验收：
- 真实 mouse down/move/up 产生选区 → 选区经归一化（trim、去首尾标点、小写）后**作为一个整体**由 **query dictionary** 解析（含测评包外词，T-QD-1 合同）→ 唯一解析则选区旁弹出「加入生词本」浮动按钮。
- **竞态修复**：当前 `mouseup → action inserted → click → action removed` 导致按钮被同一手势的后续 click 立即隐藏（调查事实 9）。修复后：同一拖选手势产生的后续 click 不得提前隐藏选区按钮；按钮生命周期正确（点击按钮写入后关闭、选区消失/点击外部关闭）。
- 点击按钮 → 写入该 query identity 的 `WordState=learning`（source=manual，**不写 AssessmentEvidence、不改估计**）→ 该词相关页面实例升级红色强提示。
- 拖选未收录词：维持「无法唯一解析 → 静默不弹」（AC-10 不针对辅助入口；B 决议）。
- 拖选保留为**辅助**入口：核心 hover/click 路径（T-INT-2）可用后，拖选不再是唯一纠错路径（R-INPUT-2）。

**主责任 Requirement ID**：R-INPUT-3、R-INPUT-4、R-INPUT-2（辅助入口部分）；对齐 AC-9、调查事实 9。

**用户可见收益**：真人用鼠标拖选一个词，弹出的「加入生词本」按钮不再被同一手势的后续 click 闪没；点一下就能把这个词（含测评包外词）加进生词本。

**依赖/前置 ticket**：T-QD-1（拖选解析使用 query dictionary，含包外词身份）；T-INT-2（核心交互路径可用后拖选降级为辅助；透明 span 不影响文本选区）。与 T-UNR-3、T-HINT-4、T-NB-6 文件边界不冲突，顺序不限。

**允许修改范围**：
- `extension/src/content/pageScanner.ts` / `index.ts`：选区监听（mouse down/move/up + selectionchange 生命周期）、浮条出现/消失时序（修复 click 竞态）、按钮点击写入路径。
- `extension/src/content/dictionary.ts`：仅按 T-QD-1 合同做整体解析（不改查询合同）。
- `extension/src/content/annotator.ts`：若需要复用强提示增量更新路径（不改变 T-INT-2 包装结构）。
- `e2e-verify.cjs`：AC-9 场景（真实 down/move/up 事件序列 + 时间线记录，断言按钮生命周期；不再只用合成 Range + mouseup）。
- 相关单测。

**禁止范围**：
- **不弹未收录提示**：拖选未收录词维持静默（AC-10 明确不针对辅助入口），不得给拖选未收录加「未收录」提示或加词按钮。
- 不提供无释义 surface form 进生词本（B：生词本只含可展示完整元数据的词条）。
- 不改变选区文本隐私边界：瞬时本地解析、不持久化、不记录、不进快照。
- 不升级 schema；不写 AssessmentEvidence；不改估计。
- 不改 T-INT-2 的透明包装/事件委托路线；不引入新消息协议（复用 STATE_CHANGE）。
- 不把拖选做成唯一纠错路径；不新增遥测/日志。

**数据/许可边界**：同 T-QD-1（查询词典本地资产；无新数据）；选区文本仅瞬时内存；review/test evidence 无 ECDICT payload。

**真实 Chrome 用户路径验收**（Chrome for Testing + 隔离 profile）：
1. **真实鼠标路径**：用真实 mouse down/move/up（非合成 Range）选择 fixture 中 query-eligible 词 → 选区旁弹出「加入生词本」浮动按钮（AC-9）。
2. **竞态断言（时间线记录）**：拖选动作结束后，同一手势后续 click 事件发生 → 按钮仍可见；点击按钮 → 写入 learning 并关闭（按钮生命周期正确）；选区消失/点击外部 → 按钮关闭且不写入。
3. 点击按钮后：该词（含测评包外词，如 `serendipity`）升级为红色强提示；popup 生词本出现该词条（含包外词，依赖 T-NB-6 或确认其已实现）。
4. 已 learning/known 词不重复弹出（RULES 既有规则回归）。
5. **负路径**：拖选未收录词 → 静默不弹、零写入（AC-10 不针对入口）；拖选多词/部分词形/纯空白/纯数字 → 静默不弹、零写入（RULES 既有规则）。
6. **负断言**：拖选加词仅写 `WordState=learning(manual)`；`AssessmentEvidence` snapshot 不变；估计不变；快照无选区文本/URL/正文。

**自动测试与负断言**：
- 单测：选区归一化（trim/去首尾标点/小写）；整体解析（含包外词）；按钮生命周期状态机（mouseup→insert→click 时序不提前隐藏）。
- 负断言：拖选未收录/多词/空白零写入；加词不写 Evidence、不改估计；快照无选区文本。
- E2E：真实 down/move/up 事件序列 + 时间线记录（复用调查脚本捕获方式）；断言按钮生命周期（AC-9）。

**完成定义**：
- AC-9 全部通过（真实拖选路径可验收、按钮不被同手势 click 隐藏、点击写入 learning）；
- 拖选未收录维持静默、零写入；
- 包外词可经拖选加词（T-QD-1 合同）且不污染 Evidence/估计；
- 负断言全绿；typecheck / 单测 / build / E2E 通过。

**是否可以独立提交**：是（T-QD-1 之后即可独立实施；为避免与 T-INT-2 重复改 annotator，推荐在 T-INT-2 后施工）。

**后续 Codex 所需证据**：
- 真实 down/move/up 事件时间线记录（含后续 click），按钮生命周期断言通过；
- 拖选未收录/多词/空白静默负路径记录；
- 包外词拖选加词 + Evidence/估计不变负断言记录；
- snapshot 隐私负断言（无选区文本/URL/正文）。

## Acceptance criteria

- [ ] 真实 mouse down/move/up 拖选 query-eligible 词 → 弹出「加入生词本」按钮（AC-9、R-INPUT-3）。
- [ ] 同一手势后续 click 不提前隐藏按钮；按钮生命周期正确（R-INPUT-4）。
- [ ] 点击按钮 → `WordState=learning(manual)`，不写 Evidence、不改估计（RULES 写入规则）。
- [ ] 包外词可经拖选加词（T-QD-1 合同）；未收录/多词/部分词形/空白/数字 → 静默不弹、零写入（AC-10 不针对入口）。
- [ ] 拖选不再是唯一纠错路径（核心 hover/click 可用，R-INPUT-2）。
- [ ] 选区文本零持久化；快照无选区内容/URL/正文。
- [ ] 无 schema 改动；复用既有消息协议；无遥测。
