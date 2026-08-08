# T-HINT-4 — 主动提示候选策略（稀疏灰线）+ effectiveFrequencyRank 阈值

**权威来源**：
- [查询、交互、主动提示与测评词包解耦规格（已批准）](../../../docs/specs/2026-08-06-V0.1-查询交互提示与测评词包解耦规格.md)：§3 GOAL 3、§5（hint candidate / hint eligibility / effectiveFrequencyRank）、§6 INVARIANT 2/6/7、§8 职责表（Hint selection layer / strategy seam）、§9 AC-7、§10 TEST SEAMS（bootstrap 可复现性）、§14 C、§15.3 R-HINT-1~4、§15.2 R-STATE-4/5
- [RULES.md](../../../RULES.md)「词汇状态与测试证据」「查询、交互、主动提示与测评词包解耦」「明确不做与冻结项」

**Status**: 待用户授权后进入开发（DOCUMENT 阶段产物）

**What to build**：实现 Hint selection 层，把「unknown 无条件 light」替换为「仅对潜在可能不会的少量候选显示 light」。
- **候选输入（C 已对齐，逐字继承，不得改变）**：仅 `effectiveFrequencyRank`（`frq` 有效排名优先、`frq` 缺失用 `bnc` 有效排名；两者均无效 = hint-ineligible）+ 用户显式状态过滤（**排除 known/learning**）；**不含 AssessmentEvidence、不含 frequency band**。
- **算法（C 已对齐，逐字继承）**：频率下界阈值。**首轮 bootstrap 公式（完全确定、无未定义参数）**：`T₀ = S[⌊n/2⌋]`，其中 S = 有效 effectiveFrequencyRank 升序列表，n = |S|，取 index = ⌊n/2⌋（0-based）处的值；**偶数 n 时取两个中间元素中的上侧元素**。任何代理同一输入得同一 T₀。
- **light 判定方向与边界（C 已对齐，逐字继承）**：`effectiveFrequencyRank > T₀`（**严格大于，等于不提示**）→ light 候选。
- **hint-ineligible but queryable**：无有效 frq/bnc 的可查询词不参与候选判定（不显示 light），但仍保持可查询、可反馈（query eligibility 与 hint eligibility 独立）。
- **候选不落盘、不改写用户状态**（R-HINT-4、R-STATE-5 负断言）；**不恢复冻结项**。
- **校准 seam**：T₀ 作为参数注入（不做硬编码死值扩散）；「首轮 T₀ → dogfood 密度数据 → 分位点调整」的链路可验收（AC-7；dogfood 密度记录由人工作业，本票只提供可配置与可测量 seam，不实现自动调整器）。
- **验收方式（C 已决议）**：dogfood 记录每百词灰线密度作为参考数据 + 复用「不必要提示」人工验收；**不预设固定密度数字**。

**主责任 Requirement ID**：R-HINT-1、R-HINT-2、R-HINT-3、R-HINT-4、R-STATE-4、R-STATE-5；对齐 OPEN_DECISIONS C、AC-7、§10 bootstrap 可复现性 seam。

**用户可见收益**：灰线不再「满篇都是」——只有系统判断「潜在可能不会」的少量候选词显示浅灰虚线；应该会的词、缺频率词都不再无故灰线。

**依赖/前置 ticket**：T-QD-1（查询词典提供 `effectiveFrequencyRank` 元数据与 hint eligibility 输入）；T-INT-2（透明包装已就绪，light 样式作用于包装 span；strategy seam 已定义）。本票只改**候选判定**，不动 T-INT-2 的交互载体。

**允许修改范围**：
- `extension/src/strategy/`（如 `strategy/index.ts` 或新增 hint selection 模块）：实现候选判定（输入/算法/阈值公式逐字继承 C）；把展示决策 seam 输出接上（light / transparent / strong / none 的判定中，light 仅由候选策略产生）。
- `extension/src/content/`：仅消费 strategy 输出（light 样式应用路径），不改变包装结构。
- `e2e-verify.cjs`：AC-7 场景（候选稀疏、T₀ 可复现性、hint-ineligible but queryable、状态过滤）。
- 相关单测（strategy hint selection）。

**禁止范围**：
- **不得改变 C 已对齐合同**：输入、算法、T₀ 公式、`> T₀` 边界、状态过滤、双缺失 hint-ineligible——逐字继承，任何代理不得猜数字、不得引入百分位/N/默认值待定。
- 不写死最终阈值数字：T₀ 由公式从当前查询词典计算得出；校准只通过参数 seam 调整，不硬编码。
- 不改 `AssessmentEvidence`/`WordState` 结构；不升级 schema；候选不落盘。
- **不恢复冻结项**：高置信自动隐藏、Pool B、PAV/Beta 后验、概率画像、复杂三桶/回填、hidden-word audit。
- 不引入 LLM/模型推理；不引入自动调整器/调度器（dogfood 校准是人工驱动 + 参数 seam）。
- 不因缺频率把词变 lookup-unresolved（T-UNR-3 合同不变）。
- 不改变 known/learning 的显式状态提示语义（known 不提示、learning 强提示不变）。

**数据/许可边界**：只读消费 T-QD-1 的频率元数据；候选判定不持久化、不产生新数据资产；review/test evidence 无 ECDICT payload。

**真实 Chrome 用户路径验收**（Chrome for Testing + 隔离 profile）：
1. 同一静态英文正文 fixture（含不同频率档位词）在空 profile 下：灰线只出现在 `effectiveFrequencyRank > T₀` 的候选词上；等于 T₀ 的词不提示；系统判断应该会（rank ≤ T₀）的词无灰线但仍可 hover/click（AC-7 与 R-HINT-2）。
2. **T₀ 可复现性（§10 seam）**：两次独立计算（或两个实现/代理）对同一查询词典输入得到同一 T₀；记录 T₀ 值、S 长度 n、取整规则（偶数取上侧）。
3. known/learning 词（profile 预置）即使 rank > T₀ 也不显示灰线（状态过滤）；无显式状态且 rank > T₀ 才候选。
4. 缺 frq/bnc 的 query-eligible 词（profile 中为 unknown）：不显示灰线（hint-ineligible），但 hover 可查询、click 可反馈（query eligibility 独立）。
5. **负断言**：候选生成前后 `WordState` snapshot 完全不变（R-STATE-5、R-HINT-4）；候选判定不写任何存储；快照无候选痕迹字段。
6. dogfood 校准 seam：调整参数（如改为某分位点）后，灰线集合随之变化且可在 E2E fixture 中观察到（仅验证 seam 可配置，不预设密度数字）。
7. 灰线密度记录 seam：E2E 输出每百词灰线密度参考值（供 dogfood 人工记录，不设阈值）。

**自动测试与负断言**：
- 单测：T₀ 公式确定性（奇数/偶数 n、0-based、上侧元素）；`> T₀` 边界（等于不提示）；frq 优先/bnc fallback/双缺失；状态过滤（known/learning 排除）；同输入同输出（可复现性）。
- 负断言：候选生成前后 WordState 不变；候选不落盘（snapshot 无候选字段）；缺频率词无 light 但可查询；候选不产生 Evidence/不影响估计。
- E2E：上述真实 Chrome 路径 1–7。

**完成定义**：
- C 合同逐字实现（输入/算法/T₀/边界/状态过滤/hint-ineligible but queryable）；
- AC-7 通过：灰线稀疏化（不再全部 unknown 词灰线）；T₀ 可复现性测试通过；
- 负断言全绿（状态零改写、零落盘、零 Evidence/估计影响）；
- 校准 seam 可配置且被测试覆盖；
- typecheck / 单测 / build / E2E 通过；无冻结项恢复。

**是否可以独立提交**：是（在 T-QD-1、T-INT-2 之后；与 T-UNR-3、T-SEL-5、T-NB-6 顺序不限，文件边界不冲突）。

**后续 Codex 所需证据**：
- T₀ 计算过程与结果（S、n、取整、T₀ 值）、可复现性运行记录；
- 候选稀疏化前后对比（同 fixture 灰线数量/密度）；
- 状态过滤与 hint-ineligible but queryable 的 E2E 证据；
- 负断言（WordState 不变、无落盘、无 Evidence/估计影响）运行记录；
- dogfood 校准 seam 演示记录。

## Acceptance criteria

- [ ] 灰线只用于 `effectiveFrequencyRank > T₀` 的候选；等于 T₀ 不提示；rank ≤ T₀ 无灰线但仍可查询反馈（AC-7、R-HINT-1/2）。
- [ ] T₀ = S[⌊n/2⌋]（0-based、偶数取上侧）逐字实现且可复现（§10 seam、R-HINT-3）。
- [ ] 输入仅 effectiveFrequencyRank（frq 优先、bnc fallback、双缺失 hint-ineligible）+ 状态过滤（排除 known/learning）；不含 Evidence/band（R-HINT-3）。
- [ ] 缺频率可查询词不显示灰线但仍可查询反馈（query/hint eligibility 独立）。
- [ ] 候选不落盘、不改写用户状态；snapshot 无候选痕迹（R-HINT-4、R-STATE-5）。
- [ ] 校准 seam 可配置；每百词灰线密度可测量输出（AC-7、C 决议）。
- [ ] 未恢复冻结项（高置信自动隐藏、Pool B、概率画像等）；未改变 known/learning 显式提示语义。
