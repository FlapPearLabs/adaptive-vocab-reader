# T-UNR-3 — lookup-unresolved 明确响应（当前词典未收录）

**权威来源**：
- [查询、交互、主动提示与测评词包解耦规格（已批准）](../../../docs/specs/2026-08-06-V0.1-查询交互提示与测评词包解耦规格.md)：§5（lookup unresolved）、§7 USER FLOW H、§9 AC-10、§14 B、§15.1 R-QUERY-4、§15.6 R-INPUT-2（拖选不针对）
- [RULES.md](../../../RULES.md)「查询、交互、主动提示与测评词包解耦」「阅读体验增强」（拖选未收录维持静默）

**Status**: 待用户授权后进入开发（DOCUMENT 阶段产物）

**What to build**：用户对**查询词典未收录**的普通英文 token 进行查询尝试（悬停/点击）时，插件不得毫无反应——至少给出明确的「当前词典未收录」响应；**仅提示，不进生词本、不提供加入生词本动作**（B 决议）。lookup-unresolved 本身不产生灰线（light）或红线（strong）。拖选加词**不针对**：拖选未收录词维持「无法唯一解析 → 静默不弹」既有规则（AC-10 明确不针对辅助入口）。

**主责任 Requirement ID**：R-QUERY-4、R-QUERY-1（未收录响应部分，A 决议叠加 B）；对齐 OPEN_DECISIONS A/B、AC-10。

**用户可见收益**：把鼠标放到词典没收录的普通英文词上或点击它，至少看到「当前词典未收录」的明确提示，而不是插件毫无反应。

**依赖/前置 ticket**：T-QD-1（查询词典判定未收录的边界）；T-INT-2（透明 span + 事件委托交互载体——本票在其上扩展未收录 token 的响应路径，属已批准路线内部低层施工细节，**不改变路线**）。

**允许修改范围**：
- `extension/src/content/annotator.ts` / `pageScanner.ts` / `scanner.ts`：在已批准「透明 span 包装 + 事件委托」路线内部，对**普通英文 token 且查询词典未收录**者，提供可命中的交互载体（如带 unresolved 标记的透明包装或等价事件委托目标——**低层实现细节由实施确定，不得引入 caret 唯一依赖**），hover/click 显示「当前词典未收录」提示；提示不带释义、不带加词按钮。
- `extension/src/content/dictionary.ts`：仅在 T-QD-1 合同内补充「未收录」判定输出（如 lookup 返回 null 的结构化标记），不改变查询合同语义。
- `e2e-verify.cjs`：AC-10 场景（悬停未收录、点击未收录、拖选未收录负路径）。
- 相关单测。

**禁止范围**：
- **不提供加入生词本动作**：未收录词不得进生词本、不得创建 WordState（B：生词本始终只含可展示完整元数据的词条）。
- 不显示灰线或红线：未收录词不属于 light/strong 状态（AC-10）。
- **不针对拖选入口**：拖选未收录 → 静默不弹（维持 RULES「阅读体验增强」既有规则）；不得给拖选未收录弹「未收录」提示或加词按钮。
- 不恢复冻结项；不因缺频率把词变成 lookup-unresolved（缺频率 ≠ 未收录，T-QD-1 合同）。
- 不升级 schema；不写 Evidence；不改估计。
- 不引入 caret/pointer 作为唯一交互基础；不改已批准路线。
- 不新增消息协议；不新增遥测/日志。

**数据/许可边界**：无新词典数据；「未收录」判定不产生任何持久化；review/test evidence 不得含 ECDICT payload。

**真实 Chrome 用户路径验收**（Chrome for Testing + 隔离 profile）：
1. 静态英文正文 fixture 含查询词典未收录的普通英文 token（如生造词或超出 query-eligible 口径的词）：hover → 出现「当前词典未收录」提示（AC-10 悬停入口）。
2. 同一 token click → 同样得到明确未收录响应，不弹出会/不会菜单（AC-10 点击入口；B 仅提示）。
3. 未收录 token 不显示灰线、不显示红线（AC-10 负断言）。
4. **负路径**：拖选未收录 token → 无浮动按钮、无「未收录」提示、无任何写入（AC-10 不针对辅助入口；RULES 阅读体验增强拖选规则）。
5. 缺 frq/bnc 但 query-eligible 的词（T-QD-1 合同内）不得被误判为未收录：仍可 hover 出完整释义（AC-10 与「缺频率 ≠ 未收录」负断言）。
6. 反馈流程：对未收录词无任何会/不会写入；`WordState` 与 `AssessmentEvidence` snapshot 零变化。

**自动测试与负断言**：
- 单测：未收录判定（token 化后 lookup null）；unresolved 标记不进入 light/strong 判定路径；缺频率词不被判未收录。
- 负断言：未收录词 hover/click 后 snapshot 无 WordState 新增、无 AssessmentEvidence、无生词本条目；拖选未收录零写入；快照无正文/句子。
- E2E：上述真实 Chrome 路径 1–6。

**完成定义**：
- AC-10 全部通过（悬停/点击有明确响应；拖选维持静默；不显示灰线红线）；
- 未收录词零持久化、零生词本写入；
- 缺频率 query-eligible 词无回归（不被判未收录）；
- typecheck / 单测 / build / E2E 通过；
- 已批准路线（透明 span + 事件委托）未改变；无冻结项。

**是否可以独立提交**：是（在 T-QD-1、T-INT-2 之后；与 T-HINT-4、T-SEL-5 无文件耦合则顺序不限）。

**后续 Codex 所需证据**：
- 未收录 token 悬停/点击的真实 Chrome 证据（截图/视频）；
- 拖选未收录零写入负断言运行记录；
- 缺频率词未误判回归记录；
- snapshot 负断言（无 WordState/Evidence/生词本变化）。

## Acceptance criteria

- [ ] 悬停未收录普通英文 token → 明确「当前词典未收录」提示（AC-10、R-QUERY-4）。
- [ ] 点击未收录 token → 明确响应，不弹会/不会菜单、不提供加词（B、AC-10）。
- [ ] 未收录词不显示灰线、不显示红线（AC-10）。
- [ ] 拖选未收录 → 静默不弹、零写入（AC-10 不针对入口；RULES 拖选规则）。
- [ ] 缺频率 query-eligible 词不被误判未收录，仍可完整查询（T-QD-1 合同）。
- [ ] 未收录词零持久化：WordState/AssessmentEvidence/生词本均无变化。
- [ ] 已批准路线未改变；无冻结项；无 schema 改动。
