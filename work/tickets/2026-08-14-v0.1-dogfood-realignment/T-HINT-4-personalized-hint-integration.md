# T-HINT-4 — 三层个性化提示整合：T₀ 兜底 + personal boundary + reading feedback

**权威来源**：
- [V0.1 Dogfood 交互个性化回退与测评重对齐规格（已批准）](../../../docs/specs/2026-08-11-V0.1-Dogfood-交互个性化回退与测评重对齐规格.md)：§7 PERSONALIZED_HINT_POLICY/§8 ASSESSMENT_EVIDENCE_BOUNDARY/§9 RECENT_K_EVIDENCE（D16）/§9C REAL_READING_FEEDBACK_CALIBRATION（收口合同 3，A–F）/§9B.1 safety signal + boundary-equality tests/§19（schema 3 派生视图）/§22 负断言
- [RULES.md](../../../RULES.md)「V0.1 Dogfood Realignment」HINT PERSONALIZATION / ASSESSMENT 边界 / 收口合同 3
- D8/D9/D16/D18/D26 + 四组收口合同（Grill 决议）

**Status**：DOCUMENT 阶段产物；待用户批准后 Codex 方可实施。

**What to build**（用户视角）：灰线提示变成三层系统——没有个人数据时用全局默认（保持现状）；做过提示校准后，从校准得到的难度边界开始画灰线（transition region 本身及更困难区域）；阅读中手动标记的「会/不会」会慢慢微调这条边界（每累计 3 个新反馈才更新一次，单次反馈不跳动）；测评成绩只影响「你测过的那个词」和保守兜底，**绝不悄悄改写你手动标记的状态**。

**主责任 Requirement ID**：R-HINT-1、R-HINT-2、R-HINT-3、R-HINT-4、R-HINT-5、R-HINT-6、R-HINT-7、R-HINT-8；R-COMPAT-1（派生视图部分）。

**用户可见收益**：系统「开始认识你」——校准/阅读反馈后简单词不再误提示；你的手动标记永远是最高权威；测评与提示互不污染。

**依赖/前置 ticket**：T-CALIB-3（calibration baseline + personal boundary 产物）、T-UNRESOLVED-2（未收录临时键参与状态过滤）、T-NATIVE-1（annotator 交互层基础，候选渲染消费新判定）。

**允许修改范围**：
- `extension/src/strategy/hint.ts`（或等价 seam）：三层判定整合——GLOBAL FALLBACK（`rank > T₀`，严格，继承未改）/ PERSONAL POLICY（`rank ≥ personalBoundary`，boundary 来自 T-CALIB-3 持久化产物）/ 已测词特例（该词 latest Evidence=known → 不提示；learning → 可提示，优先于 boundary）/ manual 状态过滤（explicit known 永不提示、learning 走红色强提示，优先一切）。
- safety signal（policy-level guard）：派生视图 = 全 assessment 最近 5 个不同 wordKey 最新 Evidence（(assessedAt DESC, wordKey ASC)）；**view size < 5 → guard inactive；≥ 5 时 learning ≥ 3 → guard 触发**；effect：guard 触发且 personalBoundary > T₀ → 回退完整 GLOBAL T₀ POLICY；否则保持 PERSONAL；不恢复 band 外推、不写状态、不进 estimate。
- K 窗口（R-HINT-4/5）：assessment 侧读取 seam，派生视图（每词最新 Evidence 按 assessedAt 降序取最近 K=5 个不同 key），不保存历史、不升 schema。
- reading feedback（收口合同 3 / §9C）：合并视图 = calibration baseline + 当前 latest manual WordState 中有效 rank 的 known/learning 样本；同词 manual 优先；publication epoch 节流——epoch 起点 = 最近一次成功发布；pending = epoch 内新产生/更新且有 rank 的不同 manual keys（同词最多 1）；count ≥ M=3 才允许重跑 estimator 尝试发布；成功发布 → 推进 checkpoint 开新 epoch；可信证据不足 → 不推进、不静默丢弃；**browser restart → epoch/pending 从已有持久化数据确定性重建（不允许重启改变计数时序）**；单条反馈不改变 boundary（机械验收 A–F）。
- annotator 候选渲染消费（灰线集合 = 新判定输出）；不改变 learning 红提示渲染（继承）。
- `e2e-verify.cjs` + 相关单测（boundary-equality canonical tests、safety cardinality、epoch 机械验收 A–F）。

**禁止范围**：
- **不写/不改写 WordState**（聚合模型绝不反写；R-HINT-1/8 负断言）；候选不落盘。
- 不改变 estimate（只读 Evidence，manual 不进）；不改变首测/每日校准/重测逻辑（T-ASSESS-UX-5 负责重测语义）。
- 不恢复 1000 assessment band → full-query boundary 外推（D18 禁止）；不恢复概率画像/PAV/Beta/SRS/高置信自动隐藏。
- 不发明新阈值：bootstrap 参数全部照抄 Spec（K=5、M=3、safety view<5 inactive / ≥5 learning≥3、p/q/w 等消费 T-CALIB-3 产物，不重复定义）；标记 DOGFOOD_TUNABLE_PARAMETER。
- 不引入 provider/网络；不升 schema；不加遥测。

**数据/许可边界**：personalization 合并视图为运行时派生，不新增持久化字段承载聚合视图；calibration baseline 持久化（T-CALIB-3）与 WordState 为数据源；不得把 personalization 数据塞进 AssessmentEvidence 或 WordState 语义字段；若实现证明 epoch checkpoint 需 schema bump → SCHEMA_CHANGE_REQUIRED STOP 返回用户。

**真实 Chrome 用户路径验收**（Chrome for Testing + 隔离 profile）：
1. 无 calibration 数据 → 灰线 = GLOBAL T₀（`rank > T₀`，与继承行为一致，回归）。
2. 完成校准 → personal boundary 生效：transition region 本身及更困难区域灰线、更简单区域不灰；`rank == T₀`（无 personal）不提示、`rank == personalBoundary` 提示（boundary-equality canonical tests）。
3. safety signal：构造 assessment 最近 5 条 learning ≥3 且 personalBoundary > T₀ → 灰线回退 GLOBAL T₀ 语义；view <5 → guard inactive。
4. 已测词特例：测过 known 的词不提示、测过 learning 的词提示（优先于 boundary）。
5. reading feedback：手动标记 1 个词 → boundary 不变；第 2 个 → 不变；第 3 个 → 允许重跑 estimator（仍须可信证据 gate）；可信不足 → 不发布、pending 不丢；成功后新 epoch 从 1/M 重新计数；累计 2/M 时重启 → 重建后与不重启行为相同。
6. explicit known 词永不灰线；explicit learning 走红色强提示；无 rank 的 manual state 不影响 rank-boundary 但对该词本身有效。
7. 负断言：WordState snapshot 候选生成前后不变；calibration/reading 聚合不反写 WordState；无测试 attempt 历史；schemaVersion 不变。

**完成定义**：R-HINT-1..8 全部验收通过；三层架构在真实 Chrome 端到端可用；epoch 机械验收 A–F 全绿；隔离负断言全绿；schema 3 保持（否则 STOP 记录）。
