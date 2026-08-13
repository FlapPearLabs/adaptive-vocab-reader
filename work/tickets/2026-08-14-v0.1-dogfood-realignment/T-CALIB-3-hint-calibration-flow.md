# T-CALIB-3 — 提示校准流程：两阶段采样 + transition-region estimator + 持久化

**权威来源**：
- [V0.1 Dogfood 交互个性化回退与测评重对齐规格（已批准）](../../../docs/specs/2026-08-11-V0.1-Dogfood-交互个性化回退与测评重对齐规格.md)：§9A（两阶段采样/rank 采样 default/合法 K→L crossing）/§9B（transition-region estimator）/§9B.1（bootstrap defaults 表 + canonical examples + boundary-equality tests）/§9B.2（TRANSITION run 选择）/§9D（calibration persistence）/§16（提示校准入口与 UX）/§22 负断言
- [RULES.md](../../../RULES.md)「V0.1 Dogfood Realignment」HINT PERSONALIZATION / 收口合同 4
- D18/D19/D20/D21/D22/D23/D24/D25/D26 + 四组收口合同（Grill 决议）

**Status**：DOCUMENT 阶段产物；待用户批准后 Codex 方可实施。

**What to build**（用户视角）：popup 里出现一个可跳过的「提示校准」（约 1 分钟）：先快速扫一批不同难度的词（两阶段），每题选「会 / 不会 / 不确定」（UI 解释三选项标准），系统据此找出「从哪个难度开始我可能需要提示」的边界区域；校准只影响灰线从哪里开始，**不影响词汇量估计**；证据不足时自动回退默认行为；浏览器重启后校准结果仍在，重做可替换旧结果。

**主责任 Requirement ID**：R-CAL-1、R-CAL-2、R-CAL-3、R-CAL-4、R-CAL-5、R-CAL-6、R-CAL-7、R-CAL-8（全部校准 requirement）。

**用户可见收益**：灰线开始「认识用户」——校准后简单词不再被乱提示；流程轻量（1 分钟、可跳过、随时退出）且与正式测评完全分离，不污染任何测试成绩。

**依赖/前置 ticket**：无（独立 popup 流程；入口先独立提供，总览页整合归 T-ASSESS-UX-5）。

**允许修改范围**：
- popup（提示校准入口/流程 UI/三选一答题交互/进度/提前结束提示）。
- calibration 逻辑 seam：两阶段采样（Stage1 = 8 题等距索引 `p_i=floor((n−1)·i/7)`，Universe = 有有效 rank 的查询词典词按 `(effectiveFrequencyRank ASC, wordKey ASC)`；Stage2 = ≤12 题在 provisional region 等距 `q_j=floor((|C|−1)·j/(k₂−1))`，候选不足按「最低/最高 rank 交替向外」扩展；不重复已答词；同一 snapshot 同一候选，无随机）。
- transition-region estimator（纯函数，确定性）：局部窗口 w=5；窗口分类默认 TRANSITION，双条件 dominance（|K−L|/w ≥ p=0.6 且 U/w < q=0.4 → KNOWN/LEARNING_DOMINANT）；uncertain 不进入差值（占位稀释、非普通第三类、非 hard veto）；合法 K→L crossing（只认 K→L 方向、取 rank 升序第一次）；TRANSITION run 选择（窗口数最多、并列取 rank 最低、无 run 回退 T₀）；Stage1 产出 provisional search region、final 只认 Stage2 后重跑的 selected run。
- 最小可信证据（≥12 有效答案 + transition region 至少一侧 ≥1 稳定趋势窗口）与提前结束（连续 3 轮窗口分类不再改变 region 且满足可信证据）；证据不足/全部 KNOWN 或全部 LEARNING/仅 reverse crossing → fail-safe 不生成 boundary（回退 T₀ 由 T-HINT-4 消费）。
- calibration 持久化（收口合同 4）：重启有效、重校准替换 baseline；**先调查当前 schema/storage，优先在 schema 3 内实现；若证明必须 bump → SCHEMA_CHANGE_REQUIRED STOP 返回用户，不得把数据塞进语义不匹配的旧字段**。
- `e2e-verify.cjs` + 相关单测（estimator canonical examples）。

**禁止范围**：
- **不写 AssessmentEvidence / WordState、不进 estimate、不伪装 WordState**（R-CAL-6 负断言）；calibration 数据不与 Evidence 混存语义。
- 不把 personal boundary 交给 hint 层消费（T-HINT-4 负责）；本票只产出并持久化 boundary/baseline。
- 不恢复 1000 assessment band → full-query boundary 外推（D18 禁止）。
- 不引入 Bayesian/IRT/PAV/Beta/SRS/概率画像；不发明新阈值（bootstrap 参数全部照抄 Spec §9B.1/§25：w=5、p=0.6、q=0.4、8/12、最小样本 12、提前结束 3 轮、M=3 等，标记 DOGFOOD_TUNABLE_PARAMETER）。
- 不改变每日校准/首测逻辑（继承）；不改 estimate。
- 不引入 provider/网络。

**数据/许可边界**：calibration 答案为本地数据；不上传；不与 Evidence 混存；重启有效；ECDICT 派生 payload 不入 tracked 公开 Git（继承）。

**真实 Chrome 用户路径验收**（Chrome for Testing + 隔离 profile）：
1. popup 入口可见、可跳过；启动后显示三选项语义说明。
2. 完成 Stage1（8 题）+ Stage2（≤12 题），总题量 ≤20；中途可退出，退出时已答样本仍可进入 **personal transition/boundary estimator**（不足则 fail-safe 不生成 boundary）；**任何情况下 calibration 数据均不得进入 vocabulary estimate**（隔离负断言）。
3. estimator canonical examples 单测全绿：`K K K L L`→TRANSITION、`K K K K L`→KNOWN_DOMINANT、`K K K U U`→TRANSITION、单 U 不 veto、单 rank inversion 不决定 boundary。
4. 证据充足 → 生成 personal boundary（boundary = transition region 简单侧窗口内样本最小 rank）并持久化；证据不足/全部同侧 → 不生成（回退 T₀ 语义生效）。
5. 重启浏览器 → 校准结果仍在；重做校准 → 新 baseline 替换旧值。
6. 负断言：calibration 全程 AssessmentEvidence/WordState 零写入；estimate 数值不变。

**完成定义**：R-CAL-1..8 全部验收通过；estimator 确定性可复现（同输入同输出）；持久化在 schema 3 内完成（若否 → SCHEMA_CHANGE_REQUIRED STOP 记录）；隔离负断言全绿。
