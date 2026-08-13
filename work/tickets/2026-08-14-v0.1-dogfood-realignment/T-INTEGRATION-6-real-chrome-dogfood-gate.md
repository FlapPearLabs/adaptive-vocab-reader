# T-INTEGRATION-6 — 最终真实 Chrome dogfood 门：全矩阵 + 回归 + 结构化测量

**权威来源**：
- [V0.1 Dogfood 交互个性化回退与测评重对齐规格（已批准）](../../../docs/specs/2026-08-11-V0.1-Dogfood-交互个性化回退与测评重对齐规格.md)：§21 REAL_CHROME_ACCEPTANCE（P0 最高 gate，全项）/§22 NEGATIVE_ASSERTIONS/§18 HINT_DENSITY_AND_VISUAL_POLICY（D15）/§20 COMPATIBILITY
- [RULES.md](../../../RULES.md)「V0.1 Dogfood Realignment」+ dogfood 记录规则（人工三数字：不必要提示/释义不可用/覆盖缺失；每篇 ≤20 词抽查）
- D5（REGRESSION_INVARIANTS）/D15（结构化测量 + 人工 dogfood，不设固定 SLA）Grill 决议

**Status**：DOCUMENT 阶段产物；待用户批准后 Codex 方可实施。**本票是批次收口门——不通过则批次不交付（P0_NATIVE_INTERACTION_UNRESOLVED 不成立才能合并）。**

**What to build**（用户视角）：把 T-NATIVE-1 / T-UNRESOLVED-2 / T-CALIB-3 / T-HINT-4 / T-ASSESS-UX-5 的全部产物合并起来，跑完整真实 Chrome 验收：P0 原生交互矩阵全项、未收录闭环、惰性迁移、半重置重测、三层提示（含 reading feedback epoch）、回归不变量（learning→红→生词本、known 移出、跨标签同步、Evidence 隔离）、全部负断言，并输出结构化测量参考值（每百词灰线密度、learning 强提示数——**只输出参考值，不冻结 SLA**）。这是批次交付前的最后一道闸。

**主责任 Requirement ID**：R-QUAL-1、R-REG-1、R-COMPAT-2；R-PRIVACY-1（全局负断言）；R-COMPAT-1（schema 3 全局断言）；§21 全矩阵执行。

**用户可见收益**：一次完整的「能不能长期挂着用」验证——交互不冲突、闭环不断裂、个性化认识用户、状态不脏、隐私不越界。

**依赖/前置 ticket**：T-NATIVE-1、T-UNRESOLVED-2、T-CALIB-3、T-HINT-4、T-ASSESS-UX-5（全部完成）。

**允许修改范围**：
- `e2e-verify.cjs`（验收脚本）：§21 全矩阵真实 Chrome 场景（真实 Puppeteer 键盘/鼠标；anchor/button/form/text/scroll/plugin/link-query/tooltip-session + 未收录/迁移/重测/hint/reading-feedback 场景）。
- 结构化测量 seam：输出每百词灰线密度与 learning 强提示数参考值（perf seam 扩展；不设阈值、不冻结 SLA）。
- 回归/负断言脚本（可复用各票已有场景合批执行）。
- 单测（若发现 seam 缺口）。

**禁止范围**：
- **不修改产品逻辑**（各票已实现；本票只验收与测量；矩阵/断言失败 → 回溯对应票修复，不在本票改产品行为）。
- 不冻结任何密度/误提示数字为 SLA（R-QUAL-1/D15：结构化测量 + 人工 dogfood，数字 dogfood 校准）。
- 不引入 provider/网络；不升 schema；不加遥测。
- 不改变评估/校准/hint 算法（各票职责）。

**数据/许可边界**：测量输出为本地参考值；不保存 URL/标题/正文/句子；无遥测；ECDICT 派生 payload 不入 tracked 公开 Git（继承）。

**真实 Chrome 验收**（Chrome for Testing + 隔离 profile，全矩阵）：
1. **P0 原生交互矩阵**（§21）：ANCHOR（普通/Cmd/Ctrl/Shift/right click）、BUTTON、FORM（input/textarea/checkbox/radio/select/submit）、TEXT（拖选/复制/右键）、SCROLL、PLUGIN（Ctrl keydown→tooltip、keyup→消失、无 Ctrl 无 UI）、LINK QUERY 共存、TOOLTIP 会话（移入豁免/松开点击/移出关闭、无 sticky）。
2. **未收录（D10）**：miss 词 tooltip「未收录」+ 会/不会可写状态；不写 Evidence。
3. **迁移（D17）**：预置 surface learning → 词典更新解析 → 惰性迁移到 canonical、surface 删除、红提示/生词本连续。
4. **重测（D12）**：半重置后 Evidence 清空、WordState 保留、估计 unavailable→重新 available。
5. **hint（D18/D22–D26）**：calibration 三选一流程可完成/可跳过/20 题 cap；estimator canonical examples；boundary 派生后 transition region 及更困难区域灰线、explicit known 不提示；WordState 零改写。
6. **reading feedback（收口合同 3）**：manual 持续校准 boundary；单次反馈不造成大幅跳变；无 rank 的 manual state 不影响 rank-boundary。
7. **回归不变量（R-REG-1）**：learning→红→生词本、known/mastered→生词本移除、跨标签状态同步、Evidence 隔离、同源 iframe 边界、开放 Shadow DOM、SPA/characterData 增量、CSS 隔离、tooltip 几何、选区路径——全部零回归。
8. **负断言（§22）**：正文无 preventDefault/stopPropagation；Evidence 不创建/改写 WordState（snapshot 对比）；manual 不进估计；calibration 隔离；无上下文/URL/标题/历史上传；无测试 attempt 历史；无 schema bump（schemaVersion 不变）；provider 未确认前 manifest 无泛化远程权限；queryability 与 hint eligibility 不重新耦合；未收录不写 Evidence、拖选未收录零写入；calibration/reading 聚合不反写 WordState。
9. **结构化测量**：对 HN / 长文 / 文档 / 论坛四类页面输出每百词灰线密度 + learning 强提示数参考值（不设 SLA）；记录人工三数字规则可用。

**完成定义**：§21 全矩阵真实 Chrome 通过（P0_NATIVE_INTERACTION_UNRESOLVED 不成立）；回归不变量零回归；全部负断言通过；测量参考值输出且无固定 SLA；schema 3 保持。此后批次方可进入用户验收（真人 dogfood 记录规则另按 RULES dogfood 门槛执行）。

**批次收口说明**：本票通过 = 批次垂直切片全部完成；随后 Codex 最终验证报告 + 用户验收；验收接受后才讨论合并 main（按 AGENTS 开发审查循环，合并前 Codex 必须更新分支、复跑匹配的真实验证并报告结果）。
