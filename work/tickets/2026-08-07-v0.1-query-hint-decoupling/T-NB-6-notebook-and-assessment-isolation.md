# T-NB-6 — 包外词状态、生词本可见性与测评/估计隔离（含多标签同步）

**权威来源**：
- [查询、交互、主动提示与测评词包解耦规格（已批准）](../../../docs/specs/2026-08-06-V0.1-查询交互提示与测评词包解耦规格.md)：§3 GOAL 4/5、§5（explicit user state）、§6 INVARIANT 5、§7 USER FLOW G、§8 职责表（User state layer / Assessment layer）、§9 AC-5/AC-6、§10 TEST SEAMS（不修改 Evidence/估计负断言；状态跨 popup/页面/worker 同步）、§13 MIGRATION（包外 wordKey 合法性语义）、§14 F、§15.4 R-ASSESS-3、§15.9 R-COMPAT-3/4
- [RULES.md](../../../RULES.md)「词汇状态与测试证据」「阅读体验增强」（popup 生词本页签新目标）、「词汇量估计」「查询、交互、主动提示与测评词包解耦」

**Status**: 待用户授权后进入开发（DOCUMENT 阶段产物）

**What to build**：
1. **包外词可持有状态并进入生词本**：查询词典内、固定 1,000 测评包外的 wordKey 允许持有 `WordState`、允许进生词本；popup「生词本」页签显示**所有 `status=learning` 且能由当前 query dictionary 解析完整元数据的 identity**（含测评包外词），按 `updatedAt` 降序；历史无法映射的 key 保守保存、不展示、不静默删除；**固定 1,000 assessment vocabulary 只约束 AssessmentEvidence/测试/估计，不再决定 notebook 可见资格**。
2. **测评/估计隔离（负断言）**：包外词即使持有 WordState / 进生词本，也**不写入 AssessmentEvidence、不改变「是否已测过」「最久未测」、不进入估计分子或分母**（AC-5/AC-6、R-ASSESS-3、R-COMPAT-3）；估计仍只读测评包内 Evidence（R-ASSESS-4 语义不变）。
3. **F 合同**：包外词沿用与包内相同的字符串身份键、不区分来源、**不升级 schema**、不做迁移；隔离仅由约束层保证（R-COMPAT-4）。
4. **多标签/跨上下文状态同步验证**：状态跨 popup、页面、worker 同步——多标签页同一 wordKey（含包外词）的反馈/已掌握操作即时一致（§10 seam 验证）。
5. 「已掌握」：popup 生词本「已掌握」= 对该 wordKey 写 `WordState=known`（source=manual，不写 Evidence、不改估计）并移出列表。

**主责任 Requirement ID**：R-ASSESS-3、R-COMPAT-3、R-COMPAT-4；对齐 AC-5/AC-6、F、R-ASSESS-4 回归。

**用户可见收益**：在阅读时加进生词本的测评包外词（如 `serendipity`）能在 popup 生词本里看到完整音标/词性/释义并可「已掌握」；但它永远不会悄悄影响词汇量估计。

**依赖/前置 ticket**：T-QD-1（query dictionary 为包外词提供可展示元数据与身份解析）；T-INT-2（内容侧包外词反馈入口——若该入口未就绪，popup 侧仍可通过既有手动/选区路径验证）。与 T-UNR-3、T-HINT-4、T-SEL-5 顺序不限（文件边界不同）。

**允许修改范围**：
- `extension/src/popup.ts`：生词本页签数据源与可见资格（query dictionary 可解析的 learning identity，含包外词；历史无法映射 key 保守保留不展示）。
- `extension/src/worker/storage.ts` / `worker/index.ts`：仅涉及状态读取/同步的只读查询或消息路径（如需要）；**不改持久化结构**。
- `extension/src/strategy/estimate.ts`（如需）：确保估计/「是否已测过」「最久未测」的 word 宇宙严格限定于 assessment vocabulary（若当前实现已天然限定，则本票只补负断言测试，不改实现）。
- `e2e-verify.cjs`：AC-5/AC-6、多标签同步、popup 生词本包外词场景。
- 相关单测（estimate/popup/storage 边界）。

**禁止范围**：
- **不升级 schema、不做迁移、不新增 namespace/source 字段**（F：包外词同键、不区分来源；不得重新发明身份/source 字段）。
- 包外词不得写入 `AssessmentEvidence`；不得因查询词典扩容改变旧 Evidence/估计语义（R-COMPAT-3）。
- 不改变首测/每日/估计入口职责；不改变首测 50 题、每日五题、估计公式（单点 + Wilson）本身。
- 不恢复冻结项（概率画像、Pool B、hidden-word audit 等）。
- 不新增遥测/日志；不上传任何数据。
- 不处理 main 既有 `extension/data/dict-core.json` 等 existing-assets compliance audit（发布前阻断项，另行单独任务）。
- 不改变 `WordState`/`AssessmentEvidence`/`DailyTestState` 结构；不重建迁移框架。

**数据/许可边界**：同 T-QD-1（E 本地范围）；popup 只读本地状态与查询词典元数据；无新数据资产；review/test evidence 无 ECDICT payload。

**真实 Chrome 用户路径验收**（Chrome for Testing + 隔离 profile）：
1. 通过内容侧反馈或选区加词（T-SEL-5/T-INT-2 就绪后）把**包外词**（如 `serendipity`）置为 learning；打开 popup 生词本 → 该词显示完整元数据（音标/词性/释义）、按 updatedAt 排序（USER FLOW G、popup 新目标）。
2. **AC-5/AC-6 负断言**：包外词 feedback 前后，snapshot 中 `AssessmentEvidence` 完全不变；估计单点值与保守范围**前后数值不变**；「是否已测过」「最久未测」不受影响。
3. 包内词回归：包内 learning 词照常显示；「已掌握」→ 该词从生词本消失、`WordState=known`、Evidence/估计不变；该词仍可查询、可再标记不会。
4. **多标签同步**：两个标签页打开同一页面，标签 A 对某词（含包外词）反馈「不会」→ 标签 B 该词立即显示红色强提示；标签 A「已掌握」→ 标签 B 红色消失（§10 seam；storage 变更事件驱动，不轮询）。
5. 历史无法映射的旧 key（如无法解析进查询词典的遗留 key）不展示、不删除（保守保留）。
6. schemaVersion 与 snapshot 结构不变化（F 负断言）。

**自动测试与负断言**：
- 单测：estimate 的 word 宇宙限定 assessment vocabulary（包外 wordKey 不进入分母/分子）；popup 生词本可见资格判定（query 可解析 + learning）；「已掌握」写入路径（known/manual、无 Evidence）。
- 负断言：包外词反馈后 AssessmentEvidence 不变、估计不变；无 schemaVersion 变化；快照无新增字段。
- E2E：真实 Chrome 路径 1–6（含多标签同步）。

**完成定义**：
- AC-5/AC-6 负断言通过（包外词零 Evidence、估计数值不变）；
- popup 生词本显示含包外词的 learning identity 且元数据完整；「已掌握」正确移出；
- 多标签同步验证通过；
- 历史无法映射 key 保守保留；
- 无 schema/migration 改动；无冻结项恢复；
- typecheck / 单测 / build / E2E 通过。

**是否可以独立提交**：是（T-QD-1 之后；与内容侧交互票文件边界不冲突，可并行施工或顺序施工）。

**后续 Codex 所需证据**：
- AC-5/AC-6 前后快照 diff（AssessmentEvidence/估计数值不变）；
- popup 生词本含包外词的真实 Chrome 证据；
- 多标签同步时间线记录；
- schemaVersion 不变断言；
- 「已掌握」往返（移除 + 可再查询）记录。

## Acceptance criteria

- [ ] 包外词可持有 WordState、可进生词本，popup 展示完整元数据并按 updatedAt 降序（USER FLOW G、popup 新目标）。
- [ ] 包外词反馈前后 AssessmentEvidence 不变、估计数值不变、测过状态不变（AC-5/AC-6、R-ASSESS-3）。
- [ ] 估计仍只读测评包内 Evidence；包外词不进入分子/分母（R-ASSESS-4 回归）。
- [ ] 「已掌握」→ known/manual、移出列表、Evidence/估计不变；该词仍可查询可纠错（AC-4 联动）。
- [ ] 多标签页同一 wordKey（含包外词）状态即时同步（§10 seam）。
- [ ] 历史无法映射 key 保守保留、不展示、不删除（RULES popup 规则）。
- [ ] 包外词同键、不区分来源、无 schema/migration 改动（F、R-COMPAT-4）。
