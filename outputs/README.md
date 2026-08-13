# 浏览器词汇学习插件 V0.1 文档索引

当前项目只有以下现役文档：

1. [产品规则](../RULES.md)：唯一的已确认需求来源。
2. [范围重置与实施目标](../docs/specs/2026-07-22-V0.1-范围重置与实施目标.md)：V0.1 目标、非目标与垂直切片验收。
3. [ECDICT 高频核心包可行性核验](../work/research/2026-07-22-ecdict-高频核心包可行性核验.md)：数据字段、许可证边界、可重复筛选与 UNKNOWN。
4. [页面提示密度与滚动研究](../work/research/2026-07-17-reading-context-window-research.md)：历史研究中恢复的页面体验证据；仅供未来单独 PoC 参考，不增加当前范围。
5. [词汇测试与状态更新研究摘录](../work/research/2026-07-22-词汇测试与状态更新研究摘录.md)：保留频率只能作冷启动、明确反馈优先与不伪装 IRT/CAT 的证据。
6. [掌握预测与主动校准规格](../docs/specs/2026-07-22-V0.1-掌握预测与主动校准规格.md)：V0.1 的状态、预测、高置信不提示、审计与测试验收规格。
7. [1,000 词垂直切片实施规格](../docs/specs/2026-07-22-V0.1-1000词垂直切片实施规格.md)：V0.1 的完整施工合同，覆盖范围、词典、算法、持久化、浏览器验收与最高测试 seam；GitHub tickets 仅拆分其施工顺序。
8. [个人词汇掌握预测与主动测试算法研究](../work/research/2026-07-22-个人词汇掌握预测与主动测试算法研究.md)：算法候选、数据前提和研究边界。
9. [Beta/PAV 策略原型结果](../work/prototypes/beta_pav_policy_prototype/RESULTS-2026-07-22.md)：可丢弃原型的阈值、PAV 和状态机证据；旧日测配比已被校准轮定位取代。
10. [kaikki-tooltip-cleaner Skill](./kaikki-tooltip-cleaner/SKILL.md)：独立保留的 Skill 资产；不属于当前 V0.1 流程。
11. [查询、交互、主动提示与测评词包解耦规格（已批准）](../docs/specs/2026-08-06-V0.1-查询交互提示与测评词包解耦规格.md)：2026-08-06 唯一 Spec；已于 2026-08-07 经第二道 DOCUMENT 复审 `PASS` 与用户最终批准（APPROVED）。**批准 ≠ 实现**，完整解耦目标未实现（部分既有行为已实现或部分实现），生产实现差距以 Spec §16 为准；不授权开发，拆 ticket 与开始开发须用户另行明确授权。
12. [V0.1 Dogfood 交互个性化回退与测评重对齐规格（待审）](../docs/specs/2026-08-11-V0.1-Dogfood-交互个性化回退与测评重对齐规格.md)：2026-08-11 唯一 Spec（DRAFT/待审，v3，Grill 已收口）；由已通过 DOCUMENT 复审 PASS 的 Grill 决议 D1–D17 + 收口 D18–D26 与四组收口合同（`work/2026-08-11-v0.1-dogfood-realignment-grill-decisions.md`）转换而来。取代 2026-08-06 Spec 中与 D1–D26 冲突的合同（交互 Ctrl 门控/正文 click 归网页、三层个性化 hint 架构（T₀ 兜底 + optional calibration + reading feedback）、未收录可反馈、用户主动单词级网络回退、重测半重置等），未取代合同继续继承。bootstrap 参数（window size/p/q/题量分配等）为 DOGFOOD_TUNABLE_PARAMETER。**批准 ≠ 实现**；不授权开发，拆 ticket 与开始开发须用户另行明确授权。

施工必须同时读取 `RULES.md`、相关 `docs/specs/` 与 GitHub ticket；不得以 ticket 的简短描述覆盖完整规格。
