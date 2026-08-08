# T-PERF-7 — 真实长文 DOM/CSS/性能重测门（R-PERF-1）

**权威来源**：
- [查询、交互、主动提示与测评词包解耦规格（已批准）](../../../docs/specs/2026-08-06-V0.1-查询交互提示与测评词包解耦规格.md)：§10 TEST SEAMS、§12 PERFORMANCE_AND_COMPATIBILITY、§14 D（prototype 数据不是生产 SLA）、§15.8 R-PERF-1/2、§16（R-PERF-1「与实现同批」）
- [RULES.md](../../../RULES.md)「查询、交互、主动提示与测评词包解耦」「网页注入与交互」（AGENTS §6.4 记录长文扫描耗时、单批主线程耗时、DOM 增量和布局影响）
- 复现包观测路径：[work/investigations/2026-08-06-architecture-coupling/](../../investigations/2026-08-06-architecture-coupling/)（DOM 数、扫描时间、heightDeltaPx、layoutShiftScore 观测方式）；原型参考：[work/prototypes/2026-08-07-no-visual-interaction/RESULTS-2026-08-07.md](../../prototypes/2026-08-07-no-visual-interaction/RESULTS-2026-08-07.md)

**Status**: 待用户授权后进入开发（DOCUMENT 阶段产物；验证性门禁，与实现同批执行）

**What to build**：对扩容后的查询词典 + 全量透明包装实施**真实网页长文 DOM/CSS/性能重测**，产出可复现的机器测量证据，供用户与审查判断「扩大查询范围/增加无视觉交互后的实际表现」。**本票是测量/验证 ticket，不设定任何性能预算或通过/失败门槛**（R-PERF-2：不编造未测量预算）：测量、记录、与原型参考/既有基线并列报告；若出现显著退化，如实报告并 STOP 返回用户/审查，不得由实施方自行定义「可接受」。

**主责任 Requirement ID**：R-PERF-1、R-PERF-2；对齐 §12、§14 D（prototype 数据非 SLA）。

**用户可见收益**：在真实长文网页上，插件注入查询词典与全量透明包装后的 DOM/扫描/CLS/滚动相关指标被可复现测量并如实报告，作为用户与审查判断的依据；本票不预设「可接受」门槛、不预授权性能优化。

**依赖/前置 ticket**：T-QD-1（查询词典资产规模决定加载/内存）、T-INT-2（透明 span 包装决定 DOM/CLS）、T-UNR-3（未收录包装若实施，计入 DOM 测量）、T-HINT-4（灰线样式不新增 DOM 结构）。**执行位置**：作为 T-INT-2/T-UNR-3 合入 main 前的门禁（R-PERF-1「与实现同批」）。

**允许修改范围**：
- `work/investigations/` 或 `scripts/` 或 `e2e-verify.cjs` 相关的**性能观测脚本/夹具**（复用复现包观测路径；不修改生产代码作为本票主体）。
- **生产代码不在本票修改范围**：本票不预授权任何生产性能修复；若测量暴露需要优化的热点，**STOP** 并如实报告，另形成最小修复 ticket/用户授权后再改代码（不得以「优化」为名改变已批准路线、查询合同或产品语义）。
- 记录文件（`work/` 下，仅结构化数据）。

**禁止范围**：
- **不预设/不写死性能预算**：不把原型数字（4 ms / +3,888 / CLS 0）提升为 SLA；不编造任何未实测指标（R-PERF-2）。
- 不改变已批准路线（透明 span + 事件委托）；不因性能回退 caret 路线；不改查询词典合同。
- 不修改 `RULES.md`、Spec、schema、`WordState`/`AssessmentEvidence` 结构。
- 不引入懒加载/虚拟滚动/调度器/事件总线等过度设计；不新增遥测。
- 不上传真实网页内容：夹具与样本只保留结构/性能指标，不保留正文、URL、句子。
- 不在公开仓库落盘 ECDICT 派生 payload（仅结构化测量数据）。
- 不把真实网站样本本身 commit（用可复现的公开快照 fixture 或本地非提交样本）。

**数据/许可边界**：测量结果仅结构化（route、case、DOM 数、扫描时间、CLS、heightDeltaPx、scrollHeight、MutationObserver 批次、SPA 场景）；无 ECDICT payload；无正文持久化。

**真实 Chrome 用户路径验收**（Chrome for Testing + 隔离 profile）：
1. **长文基线**：真实长文英文网页样本（复用调查复现包的可复现快照 fixture；若用真实网站，仅本地测量、不持久化正文）注入前/后对比：DOM 节点数、初始扫描时间、单批主线程耗时、heightDeltaPx、layoutShiftScore、scrollHeight 变化。
2. **扩容词典加载**：查询词典（T-QD-1 产物）加载时间、扩展包体、内容脚本初始化耗时。
3. **SPA 场景**：动态插入 + characterData 更新批次的 MutationObserver 处理量（对照调查 §6 Wikipedia 快照差）。
4. **对照原型参考**：透明包装路线测量与原型参考（4.0 ms / +3,888 / CLS 0）对照——原型数字仅参考，不构成通过/失败线；记录差异与原因。
5. **站点 CSS 隔离**：真实网站可能对 span 施加选择器规则；抽样样本验证包装词样式未被站点 CSS 破坏（D 硬边界第 4 项）。
6. **报告与路由**：测量记录完整后，与 baseline/prototype 并列成表报告（**prototype 数字仅对照参考，不参与任何自动通过/失败判定**）；若出现显著退化或用户可见问题（如扫描明显卡顿、布局明显抖动、DOM 增量远超预期），如实记录测量值与用户可见现象，**STOP 并返回用户/审查**决定是否需要优化或调整方案——实施方不得自行定义「可接受」、不得自动合入。
7. 负断言：测量不改变任何用户状态/Evidence/估计；无正文持久化；无遥测。

**自动测试与负断言**：
- 观测脚本可复现（同一 fixture 两次运行结果可对照）；
- 负断言：测量过程前后 `WordState`/`AssessmentEvidence` snapshot 不变；无正文/句子/URL 落盘；Git 无 ECDICT payload；
- 记录结构化 JSON/Markdown 到 `work/`（如 `work/perf/2026-08-XX-query-hint-rebaseline/`）。

**完成定义**：
- 真实长文 DOM/CSS/性能重测完成，全部指标有可复现机器测量记录；
- 与原型参考/既有基线并列对照表输出（原型数字仅参考、不进入自动 PASS/FAIL）；
- 显著退化或用户可见问题已如实记录并 STOP 返回用户/审查（未获用户/审查决定前不自动合入）；
- 站点 CSS 隔离抽样验证通过；
- 负断言全绿；无生产语义/路线/schema 改动；
- typecheck / 单测 / build / E2E 通过（回归）。

**是否可以独立提交**：是（观测脚本与测量证据可独立提交；**不预授权任何生产代码修复**，发现需要优化时 STOP 并另形成最小修复授权/ticket）。**作为门禁**：T-INT-2、T-UNR-3 的合入须基于本票测量报告与用户/审查决定（R-PERF-1「与实现同批」），本票不自行定义「通过」。

**后续 Codex 所需证据**：
- 长文样本注入前后对照表（DOM/扫描/CLS/scrollHeight/MutationObserver）；
- 扩容词典加载与包体实测；
- SPA/characterData 场景处理量；
- 站点 CSS 隔离抽样结果；
- 与原型参考/baseline 的并列对照与差异解释；显著退化时 STOP 记录（证据 + 用户可见现象 + 返回用户/审查的结论）。

## Acceptance criteria

- [ ] 真实长文 DOM/CSS/性能重测完成且可复现（R-PERF-1）。
- [ ] 指标覆盖：DOM 节点数、扫描时间、单批主线程耗时、CLS、heightDeltaPx、scrollHeight、MutationObserver 处理量、SPA 场景、词典加载（§12）。
- [ ] 与原型参考/既有基线并列对照并如实报告（原型数字仅参考、不进入自动 PASS/FAIL）；显著退化已 STOP 并返回用户/审查，未获决定前不自动合入（R-PERF-1 门禁）。
- [ ] 站点 CSS 隔离抽样验证通过（D 硬边界）。
- [ ] 无编造性能预算；原型数字未被提升为 SLA（R-PERF-2、§14 D）。
- [ ] 测量零副作用：状态/Evidence/估计不变；无正文持久化；无 ECDICT payload 入 Git。
- [ ] 未改变已批准路线/查询合同/schema；无冻结项。
