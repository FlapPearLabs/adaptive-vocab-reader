# T-INT-2 — 透明 span 包装 + 事件委托：无灰线词交互与 tooltip 几何

**权威来源**：
- [查询、交互、主动提示与测评词包解耦规格（已批准）](../../../docs/specs/2026-08-06-V0.1-查询交互提示与测评词包解耦规格.md)：§3 GOAL 2/4/6/7、§5（queryable / D）、§7 USER FLOW B/C/D/E、§8 职责表（Query layer / content / strategy seam）、§9 AC-1/AC-2/AC-4/AC-8、§10 TEST SEAMS、§12、§14 D（已批准生产实施路线＝透明 span 包装 + 事件委托）、§15.2 R-STATE-1/3、§15.5 R-TOOLTIP-1~4、§15.6 R-INPUT-1/2
- [RULES.md](../../../RULES.md)「查询、交互、主动提示与测评词包解耦」「阅读体验增强」「词汇状态与测试证据」
- D 原型证据：[work/prototypes/2026-08-07-no-visual-interaction/RESULTS-2026-08-07.md](../../prototypes/2026-08-07-no-visual-interaction/RESULTS-2026-08-07.md)（**仅设计证据，不得直接复制为生产代码**）

**Status**: 待用户授权后进入开发（DOCUMENT 阶段产物）

**What to build**：实现 D 已批准生产实施路线——**透明 span 包装 + 事件委托**。所有 query-eligible 词（含无灰线词、known 词）获得透明 span 包装；事件委托统一处理 hover（显示 tooltip）与 click（会/不会菜单）。caret 动态定位**不作为唯一交互基础**。同时交付 tooltip 几何修复（AC-8）。open Shadow DOM 与同源 iframe 按 D 结论明确处理；SPA/characterData 动态 DOM 由 observer 重扫保持一致。

**主责任 Requirement ID**：R-QUERY-2、R-STATE-1、R-STATE-3（再查询/再纠错部分）、R-INPUT-1、R-INPUT-2（核心路径）、R-TOOLTIP-1~4；对齐 D 决议、AC-1/AC-2/AC-4/AC-8。

**用户可见收益**：不显示灰线的词（系统认为应该会、known 词）也能把鼠标放上去看释义、点击反馈「不会/会」；tooltip 不再盖住正文，滚动后位置正确。

**依赖/前置 ticket**：T-QD-1（查询词典提供条目与元数据；身份映射决定包装范围）。本票不改变 light/strong 展示判定逻辑（保持现有 strategy 输出），只负责「所有可查询词都有交互载体 + tooltip 正确」。

**允许修改范围**：
- `extension/src/content/annotator.ts`：包装逻辑（透明 span + data-* 属性）、事件委托、tooltip 渲染与几何定位（AC-8）。
- `extension/src/content/pageScanner.ts` / `scanner.ts`：扫描/包装范围调整（query-eligible 全量而非仅 light/strong），事件委托挂载点。
- `extension/src/content/index.ts`：内容脚本装配（若需要）。
- `extension/src/content/dictionary.ts`：仅按 T-QD-1 已定合同消费，不在本票改变合同。
- `e2e-verify.cjs`：AC-1/AC-2/AC-4/AC-8 真实 Chrome 场景（含 tooltip 几何机器测量）。
- 相关单测（annotator/scanner）。

**禁止范围**：
- **不选择其他交互路线**：不引入 caret/pointer 动态定位作为唯一交互基础；不改已批准路线（透明 span + 事件委托）。
- 不改 hint 稀疏化判定（T-HINT-4 负责）；unknown 词暂时保持现有 light 行为，本票不承诺灰线变少。
- 不改 `strategy/**` 的领域决策输出语义（可加只读接口 seam 供 T-HINT-4 使用，但不得在本票改变 light 判定）。
- 不升级 schema、不改 `WordState`/`AssessmentEvidence` 结构、不做迁移。
- 不处理 lookup-unresolved 提示（T-UNR-3 负责）；未收录词本票不要求包装与响应。
- 不把 prototype 代码直接复制进生产（原型仅设计证据）；不把原型性能数字当作 SLA。
- 不引入事件总线/服务层/组件框架（反过度设计）；不新增消息协议（复用 GET_STATE/STATE_CHANGE）。
- 不新增遥测/日志；不上传任何正文。

**数据/许可边界**：本票不产生词典数据变更（消费 T-QD-1 资产）；review/test evidence 不得含 ECDICT tooltip payload（仅结构化数据）；隐私：hover/click 目标词仅瞬时本地用于解析。

**真实 Chrome 用户路径验收**（Chrome for Testing + 隔离 profile，复用调查复现包环境要求）：
1. 空隔离 profile（`WordState={}`）：静态英文正文 fixture 中，无灰线（系统判断应该会 / known）的词 hover 显示完整四行 tooltip（词形/音标/词性/释义），不遮挡目标词与相邻正文（AC-1、AC-8 机器测量：目标矩形与 tooltip 矩形不重叠）。
2. 同一无灰线词 click → 弹出会/不会菜单 → 点「不会」→ 该词升级红色强提示并进入生词本（AC-2、AC-3 依赖既有 strong 语义验证）。
3. known 词（profile 预置 known）：无学习提示、无灰线，但 hover 可查询、click 可反馈「不会」，反馈后进入生词本并显示红色（R-STATE-1、R-STATE-3 再纠错）。
4. 反馈「会」（或生词本「已掌握」）后：红色提示消失、生词本条目消失，但该词仍可 hover 查询、可再次标记「不会」（AC-4）。
5. tooltip 几何（AC-8 机器测量，复用调查 §9 观测方式）：普通位置 → 上方；顶部空间不足 → 下方翻转；左右不出视口；sticky/header 安全区域不侵入；页面滚动后定位仍正确。
6. open Shadow DOM 内文本词可 hover/click；同源 iframe 内独立注入后同样可达（D 结论：开放 root 显式扫描、同源 iframe 独立安装）。
7. 动态 DOM：SPA 动态插入正文、characterData 字符级更新后，新内容中可查询词自动获得同样交互与提示（observer 重扫；§10 seam）。
8. 负断言：普通曝光、仅 hover/查看释义不改变任何状态、不产生测试证据；hover/click 目标词不进入任何存储或快照。

**自动测试与负断言**：
- 单测：透明 span 生成（query-eligible 全量、known/none 也包装）；事件委托分发（hover/click 目标正确）；tooltip 几何计算（上下翻转、左右视口、sticky 安全区、滚动后）。
- 负断言：hover/click 前后 `WordState` snapshot 无变化（仅查看）；点击「不会」仅更新 `WordState=learning(manual)`，不写 `AssessmentEvidence`、不改估计；快照无 URL/正文/句子；known 词 hover 后状态仍为 known。
- E2E：上述真实 Chrome 路径 1–8。
- 性能 sanity（正式重测在 T-PERF-7）：本票实现后立即在标准 fixture 记录 DOM 增量/扫描时间/CLS，**只记录证据、不设任何预算与自动阈值**（原型参考 +3,888 等数字仅作对照参考，不参与任何自动 PASS/FAIL 判定）；若出现明显退化或用户可见问题，如实记录并在交付报告中报告，由用户/审查决定后续，**实施方不得自行定义「可接受」、不得自动 STOP 或自动放行**。

**完成定义**：
- AC-1/AC-2/AC-4/AC-8 全部通过真实 Chrome 机器测量（含无灰线词 hover/click、known 纠错往返、tooltip 几何五场景）；
- open Shadow DOM + 同源 iframe + SPA/characterData 场景通过；
- 负断言全绿：查看不改状态、点击仅写 WordState、无 Evidence 污染、无快照敏感内容；
- typecheck / 单测 / build / E2E 通过；
- 未改变已批准路线、未引入 caret 唯一依赖、未引入冻结项；
- 标准 fixture 性能证据已记录（T-PERF-7 正式重测完成前，本票不得合入 main）。

**是否可以独立提交**：是（在 T-QD-1 之后）。**合入 main 前置**：T-PERF-7 真实长文测量报告完成并经用户/审查决定（R-PERF-1「与实现同批」；本票不自行定义性能「可接受」门槛）。

**后续 Codex 所需证据**：
- 无灰线/known 词 hover/click 的真实 Chrome 视频或截图 + 机器测量；
- tooltip 几何五场景机器测量数据；
- open Shadow DOM / 同源 iframe / SPA / characterData 场景证据；
- 标准 fixture 性能记录（DOM 增量/扫描时间/CLS）；
- 负断言运行记录。

## Acceptance criteria

- [ ] 所有 query-eligible 词（含无灰线、known）可 hover 查询、click 反馈会/不会（AC-1/AC-2、R-QUERY-2、R-INPUT-1）。
- [ ] known 词可查询、可再反馈「不会」并进生词本显示红色；反馈「会」后消失但仍可查询（AC-4、R-STATE-1/3）。
- [ ] tooltip 不遮挡目标词与正文；上方优先、下方翻转、不超视口、不侵入 sticky/header、滚动后正确（AC-8、R-TOOLTIP-1~4）。
- [ ] open Shadow DOM 与同源 iframe 内可查询词可交互（D 结论）。
- [ ] SPA 动态插入与 characterData 更新后交互与提示保持一致（§10 seam）。
- [ ] 负断言：查看不改状态；点击仅写 WordState；无 Evidence 污染；快照无正文/句子/URL。
- [ ] 已批准路线（透明 span + 事件委托）未被改变；caret 不作为唯一交互基础；无冻结项。
- [ ] 标准 fixture 性能证据已记录；T-PERF-7 测量报告完成并经用户/审查决定前不合入 main。
