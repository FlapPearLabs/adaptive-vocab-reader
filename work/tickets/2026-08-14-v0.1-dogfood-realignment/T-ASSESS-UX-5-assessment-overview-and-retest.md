# T-ASSESS-UX-5 — 测评 UX：词汇水平总览 + 半重置重测

**权威来源**：
- [V0.1 Dogfood 交互个性化回退与测评重对齐规格（已批准）](../../../docs/specs/2026-08-11-V0.1-Dogfood-交互个性化回退与测评重对齐规格.md)：§16 ASSESSMENT_CALIBRATION_RETEST_UX（D12/D13/D18–D21）/§22 负断言/§20 COMPATIBILITY
- [RULES.md](../../../RULES.md)「V0.1 Dogfood Realignment」ASSESSMENT / RETEST 与 ASSESSMENT UX 组
- D12（重测 = 半重置）/D13（总览页 + 可展开说明）Grill 决议

**Status**：DOCUMENT 阶段产物；待用户批准后 Codex 方可实施。

**What to build**（用户视角）：popup 升级为「我的词汇水平」总览页——一次看清：首测状态（已完成/未开始）、当前词汇估计（单点 + 保守范围）、今日**每日校准**进度（0/5）、最近每日校准日期，并提供「开始今日**每日校准**」「提示校准」「重新完整测评」入口。**「提示校准」是与正式测评分离的独立 optional 流程（可跳过，不写 AssessmentEvidence/WordState、不进 vocabulary estimate），不因首测未完成而被隐藏**。点「重新完整测评」会出现确认对话框并明确说明「重测清掉测试成绩、保留生词本」。「了解这些数字」可展开解释估计/每日校准/提示校准/重测分别是什么；页面固定一行说明「手动标记的会/不会只影响阅读提示和生词本，不会伪装成正式测试成绩」。

**主责任 Requirement ID**：R-ASSESS-1、R-ASSESS-2、R-UX-1、R-UX-2；R-COMPAT-2（WordState/生词本保留部分）。

**用户可见收益**：产品设计者本人（以及普通用户）都能从 UI 理解自己的词汇状态——测试、每日校准、提示校准、估计、生词本的关系一目了然；重测语义明确、无数据恐惧。

**依赖/前置 ticket**：T-CALIB-3（总览页含「提示校准」入口与校准状态；半重置后 calibration baseline 独立保留）。

**允许修改范围**：
- popup 结构：主视图改为「我的词汇水平」总览（首测状态 / 点估计 / 保守范围 / 今日**每日校准** 0/5 / 最近每日校准 / [开始今日每日校准] / [提示校准] / [重新完整测评] / 一行解释 / 「了解这些数字」可展开区块，默认收起）。**「提示校准」入口按 Spec §16 的独立 optional 语义呈现，不绑定首测完成状态**。
- worker reset 逻辑（重测 = 半重置，R-ASSESS-1）：清空 AssessmentEvidence、dailyTest、completedRoundIndex（估计从新证据重新积累）；**保留全部 WordState**（生词本、manual learning/known 不丢）；重测作答按现行「后写覆盖」写入同词状态；重测后 Evidence 不足 → estimate=unavailable（R-ASSESS-2）→ 随新证据覆盖十频段重新 available。
- 重测入口交互：确认对话框 + 解释文案「重测清掉测试成绩（测试记录与估计重新积累），保留生词本与手动标记」。
- 提示校准入口整合（消费 T-CALIB-3 的入口/状态产物，不重建校准流程；**仅做入口呈现与状态展示，不得为提示校准新增「必须先完成首测」等 gating**）。
- `e2e-verify.cjs` + 相关单测。

**禁止范围**：
- 不改变 calibration 算法/estimator（T-CALIB-3 负责）；不改变 hint 判定（T-HINT-4 负责）。
- 不改变首测 50 题/每日校准题量语义（继承）；只做入口整合与状态展示。
- 不升级 schema（半重置只清数据，不结构变更）；不迁移。
- 不引入 provider/网络；不加遥测。
- 重测不得静默清空生词本/WordState（负断言）；不得把重测做成全量硬重置（B 方案已被用户否决）。

**数据/许可边界**：半重置只操作 AssessmentEvidence/dailyTest/轮次字段；WordState/生词本原样保留；calibration baseline（T-CALIB-3 产物）不受重测影响（重测清 Evidence 不影响 calibration baseline，收口合同 4）。

**真实 Chrome 用户路径验收**（Chrome for Testing + 隔离 profile）：
1. 新 profile（未首测）：总览显示「首测未开始」与首测入口；**「每日校准」入口隐藏（继承规则：首测完成前不出现）**；**「提示校准」保持独立 optional 流程、可访问，不因首测未完成被本票新增隐藏规则**（Spec §16；不自行增加首测前置条件）。
2. 完成首测：总览显示点估计 + 保守范围 + 今日每日校准 0/5 + 最近每日校准；[开始今日每日校准] [提示校准] [重新完整测评] 可见。
3. 每日校准完成 3 题 → 今日进度 3/5。
4. 点「重新完整测评」→ 确认对话框含解释文案；确认后：Evidence/dailyTest/轮次清空、WordState/生词本保留、estimate 变 unavailable（证据不足）；重新完成测评 → estimate 重新 available。
5. 生词本数据在重测前后完全一致（负断言）。
6. 「了解这些数字」展开后解释估计/每日校准/提示校准/重测语义；一行「手动标记≠正式成绩」文案存在。
7. manual 标记（会/不会）不影响 estimate 数值（估计前后不变，负断言）。

**完成定义**：R-ASSESS-1/2、R-UX-1/2 全部验收通过；半重置语义在真实 Chrome 可复现；WordState/生词本零丢失负断言全绿；calibration baseline 重测后仍有效。
