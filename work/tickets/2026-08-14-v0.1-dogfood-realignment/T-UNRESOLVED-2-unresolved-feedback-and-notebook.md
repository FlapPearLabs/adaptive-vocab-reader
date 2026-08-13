# T-UNRESOLVED-2 — 未收录词闭环：临时键反馈 + 生词本标注 + 惰性迁移

**权威来源**：
- [V0.1 Dogfood 交互个性化回退与测评重对齐规格（已批准）](../../../docs/specs/2026-08-11-V0.1-Dogfood-交互个性化回退与测评重对齐规格.md)：§10 UNRESOLVED_TOKEN_IDENTITY_AND_MANUAL_STATE（D10）/§11 CANONICAL_RECONCILIATION（D17）/§15 NOTEBOOK_BEHAVIOR/§12 identity 边界（provider lemma 不得改写 identity）/§22 负断言
- [RULES.md](../../../RULES.md)「V0.1 Dogfood Realignment」UNRESOLVED WORD 组
- D10/D17（Grill 决议：miss 词可反馈可进生词本、规范化 surface token 临时键、惰性迁移 + schema 3 仲裁）

**Status**：DOCUMENT 阶段产物；待用户批准后 Codex 方可实施。

**What to build**（用户视角）：遇到词典没收录的词（生僻词、专有名词、新造词）时，按住 Ctrl 悬停能看到「未收录」提示，并且仍然可以点「会/不会」把它记录进生词本；生词本里这类词如实标注「未收录」；将来词典更新能解析出正确词形时，旧记录自动合并到正式词条，生词本不出现重复条目。

**主责任 Requirement ID**：R-UNR-1、R-UNR-2、R-UNR-3、R-UNR-4、R-UNR-5；R-EVD-2（负断言部分：未收录不写 Evidence）。

**用户可见收益**：未收录词不再是死路——理解→判断会/不会→生词管理的闭环对任何英文词成立（北星 B）；词典更新后状态不丢、不重复。

**依赖/前置 ticket**：T-NATIVE-1（miss 词的「会/不会」反馈走其 extension-owned tooltip 会话；本票消费该会话合同，不重建交互层）。

**允许修改范围**：
- `extension/src/content/dictionary.ts`（或查询 seam）：miss 判定结果透传给 tooltip；规范化 surface token 生成（trim、去首尾标点、小写、去空白）。
- 状态写入路径：miss 词写 `WordState`（known/learning，source=manual），键 = 规范化 surface token；**不写 AssessmentEvidence**。
- `extension/src/popupNotebook.ts`（或生词本展示 seam）：未收录条目标注「未收录」（展示层 re-resolve：当前词典仍无法解析 → 显示标注；已解析 → 正常展示）。
- 惰性迁移 seam（读路径幂等）：当持有 WordState 的 surface key 被查询词典解析到 canonical lemma（如 `womans`→`woman`）→ 迁移 WordState 到 canonical key、删除 surface key；canonical 已有状态时复用 schema 3 仲裁（updatedAt 较新者胜 → 相同则 manual 优先 → 仍相同则 learning 优先）；未解析键保守保留；迁移后经 STATE_UPDATED 广播同步；迁移只迁 WordState、不产生 Evidence、不升 schema。
- `e2e-verify.cjs` + 相关单测。

**禁止范围**：
- **不实现网络回退/provider**（R-NET 全部 deferred，STOP: PROVIDER_DECISION_REQUIRED）；miss 词当前只显示本地「未收录」降级文案。
- 不改变拖选未收录行为（维持静默，R-UNR-5）。
- 不把 provider 返回的 lemma 用于迁移/改写 identity（§12 identity 边界；只有本地 query dictionary resolution 可触发迁移）。
- 不升级 schema、不写 Evidence、不进入 estimate（R-EVD-2 负断言）。
- 不改变既有解析词的状态语义；不静默删除历史未解析键。

**数据/许可边界**：临时键为本地字符串键，不落任何远程；不保存上下文；无遥测；ECDICT 派生 payload 不得入 tracked 公开 Git（继承）。

**真实 Chrome 用户路径验收**（Chrome for Testing + 隔离 profile）：
1. 静态 fixture 中含词典 miss 的英文词（如虚构专有名词）：Ctrl+hover → tooltip 显示「未收录」+「会/不会」按钮。
2. 点「不会」→ WordState 变为 learning（键 = 规范化 surface token）；页面出现红色强提示；生词本出现该条目并标注「未收录」。
3. 点「会」→ known；生词本移除（known 移出继承路径）。
4. 预置 surface key learning（如 `womans`）→ 使词典解析出 canonical（`woman`）→ 惰性迁移：WordState 迁到 `woman`、surface 键删除、红色提示与生词本连续、无重复条目；重复触发幂等。
5. 仲裁用例：canonical 已有状态时按 updatedAt→manual→learning 仲裁；仍无法解析的 surface 键保守保留。
6. 拖选未收录 → 维持静默（零写入）。

**负断言**：未收录词不写 AssessmentEvidence（Evidence map 前后不变）；估计前后数值不变；schemaVersion 不变；provider 未接入（manifest 无远程权限）；迁移不产生 Evidence。

**完成定义**：R-UNR-1..5 全部验收通过；D10/D17 语义在真实 Chrome 可复现；生词本无重复、无脏条目语义；Evidence/估计/状态隔离负断言全绿。
