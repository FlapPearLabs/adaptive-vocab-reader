# Ticket 批次索引：V0.1 Dogfood Product Realignment（生产垂直切片）

- **批次**：2026-08-14
- **权威来源**：
  - [V0.1 Dogfood 交互个性化回退与测评重对齐规格（已批准）](../../../docs/specs/2026-08-11-V0.1-Dogfood-交互个性化回退与测评重对齐规格.md)（2026-08-14 最终 DOCUMENT review **PASS**，审查基线 266af1b）
  - [RULES.md](../../../RULES.md)（2026-08-14 修订：D1–D26 + 四组收口合同固化）
  - [Grill 决议 D1–D26 + 四组收口合同](../../../work/2026-08-11-v0.1-dogfood-realignment-grill-decisions.md)
  - [AGENTS.md](../../../AGENTS.md)（§4.1 batch validation、§5 实现与文件安全）
- **状态**：DOCUMENT 阶段产物。本批次仅拆票与 ticket 文档，**未标记 ready-for-agent、未授权 Codex 开发**；用户批准本批次 DOCUMENT 审查并另行明确「开始开发」后，Codex 方可实施。

## 决策边界（本批次不可越界）

- **交互**：Ctrl+hover = LOOKUP_UI_GATE（非 click override）；禁 Ctrl+click 查词；正文 click/链接/表单/选区/右键全归网页；tooltip = extension-owned 交互会话（keyup 豁免有界、无永久 sticky）；passive hint decoration（灰线/红线）不受 Ctrl 控制（D1/D3/D4/D6/D7、R-INT）。
- **个性化提示（三层）**：GLOBAL FALLBACK `rank > T₀`（严格，继承未改）/ PERSONAL POLICY `rank ≥ personalBoundary` / optional hint calibration（两阶段、三选一、20 cap、transition-region estimator）/ real reading feedback（M=3 publication epoch）。**禁止从固定 1000 assessment band 外推 full-query mastery boundary**（D18）。AssessmentEvidence 仅两个有限作用：已测词特例 + 保守 safety signal（view <5 inactive、≥5 learning≥3、policy-level guard）。Evidence 不写 WordState（D8/D18）。
- **未收录**：词典可解析性 ≠ 用户反馈资格；miss 词可反馈会/不会、可进生词本（规范化 surface token 临时键、生词本「未收录」标注）；surface→canonical 惰性迁移（复用 schema 3 仲裁：updatedAt→manual→learning；未解析键保守保留；只迁 WordState 不产 Evidence；不升 schema）（D10/D17、R-UNR）。
- **校准隔离**：hint calibration 与 formal assessment 完全隔离——不写 WordState/Evidence、不进 estimate、不伪装 WordState（R-CAL-6）。
- **重测**：半重置——清 AssessmentEvidence/dailyTest/轮次，保留全部 WordState/生词本（D12、R-ASSESS）。
- **不恢复冻结项**：Pool B、PAV/Beta、概率画像、高置信自动隐藏、hidden-word audit、复杂三桶/回填、SRS/遗忘曲线/调度器、测试 attempt 历史、Kaikki/OEWN/COW、本地/云端 LLM、上下文翻译、全文翻译、遥测。
- **DOGFOOD_TUNABLE_PARAMETER**：Spec 已明确给出 bootstrap defaults（w=5、p=0.6、q=0.4、Stage1/2=8/12、K=5、M=3、safety view<5 inactive、最小样本 12、提前结束 3 轮、boundary=transition 简单侧窗口内最小 rank、rank 采样等距索引 + (rank, wordKey) tie-break、K→L crossing/run 选择）。ticket 只消费这些默认值，**不得发明新参数/阈值/算法/SLA**；全部标记 DOGFOOD_TUNABLE，dogfood 可调。

## Ticket 列表与依赖 DAG（垂直切片，可独立施工、可独立验收）

| 顺序 | Ticket | 主题（端到端行为） | Blocked by | Requirement IDs |
|---|---|---|---|---|
| 1 | [T-NATIVE-1](T-NATIVE-1-modifier-gated-interaction-layer.md) | **P0 Ctrl 门控交互层**：无 Ctrl 零查询 UI + 原生操作优先 + Ctrl+hover tooltip + tooltip 交互会话 + 链接文字可查且 click 原生 + P0 真实 Chrome 矩阵 | 无 | R-INT-1..8 |
| 2 | [T-CALIB-3](T-CALIB-3-hint-calibration-flow.md) | **提示校准流程**：可跳过、两阶段采样、三选一、20 cap、transition-region estimator（canonical examples）、提前结束、fail-safe、持久化 | 无 | R-CAL-1..8 |
| 3 | [T-UNRESOLVED-2](T-UNRESOLVED-2-unresolved-feedback-and-notebook.md) | **未收录词闭环**：miss 词 tooltip「未收录」+ 会/不会写状态 + 生词本标注 + surface→canonical 惰性迁移 | T-NATIVE-1 | R-UNR-1..5、R-EVD-2(负断言) |
| 4 | [T-ASSESS-UX-5](T-ASSESS-UX-5-assessment-overview-and-retest.md) | **测评 UX**：「我的词汇水平」总览页 + 半重置重测 + 校准入口整合 + 可展开说明 | T-CALIB-3 | R-ASSESS-1..2、R-UX-1..2、R-COMPAT-2(部分) |
| 5 | [T-HINT-4](T-HINT-4-personalized-hint-integration.md) | **三层个性化提示**：T₀ 兜底 + personal boundary + 已测词特例 + safety signal + reading feedback（M=3 epoch） | T-CALIB-3、T-UNRESOLVED-2、T-NATIVE-1 | R-HINT-1..8、R-COMPAT-1(派生视图) |
| 6 | [T-INTEGRATION-6](T-INTEGRATION-6-real-chrome-dogfood-gate.md) | **最终真实 Chrome dogfood 门**：§21 全矩阵 + 回归不变量 + 负断言 + 结构化测量参考值（无 SLA） | T-NATIVE-1、T-CALIB-3、T-UNRESOLVED-2、T-ASSESS-UX-5、T-HINT-4 | R-QUAL-1、R-REG-1、R-COMPAT-2、R-PRIVACY-1 |

**依赖图**：

```
T-NATIVE-1 (P0)         T-CALIB-3
   │                        │
   ├──── T-UNRESOLVED-2     │
   │        │               │
   │        └───────┬───────┤
   │            T-HINT-4    │
   │                        │
   │        T-ASSESS-UX-5 ──┤（T-CALIB-3 产物）
   │                        │
   └── T-INTEGRATION-6 ←────┘（全部）
```

**拓扑执行顺序**（blockers-first）：T-NATIVE-1 / T-CALIB-3（可并行）→ T-UNRESOLVED-2 / T-ASSESS-UX-5 → T-HINT-4 → T-INTEGRATION-6。

**为何该切分避免架构返工**：
1. T-NATIVE-1 最先——P0 交互冲突是 dogfood 最痛问题，也是所有页面交互的载体；先立「原生优先 + Ctrl 门控」地基，后续票只做行为扩展不重排交互架构。
2. T-CALIB-3 与 T-NATIVE-1 无相互依赖（popup 流程 vs content 交互）——可并行；它是 T-HINT-4 与 T-ASSESS-UX-5 的 boundary/入口来源。
3. T-UNRESOLVED-2 依赖 T-NATIVE-1 的 tooltip 会话（miss 词反馈载体），是 T-HINT-4 状态过滤（临时键）的输入。
4. T-HINT-4 消费 T-CALIB-3（boundary）+ T-UNRESOLVED-2（临时键状态）+ T-NATIVE-1（annotator 基础）——三层提示是「聚合层」，必须等数据源齐备。
5. T-ASSESS-UX-5 只消费 T-CALIB-3（总览页整合校准入口）——重测/总览不依赖 hint 层。
6. T-INTEGRATION-6 收口——全矩阵 + 回归 + 测量，批次交付门。

## Requirement → ticket 处置（双向闭环）

| Requirement | 处置 |
|---|---|
| R-INT-1..8 | T-NATIVE-1 |
| R-HINT-1..8 | T-HINT-4 |
| R-CAL-1..8 | T-CALIB-3 |
| R-EVD-1 | existing regression（估计只读 Evidence 已实现；负断言承接于 T-ASSESS-UX-5 / T-INTEGRATION-6） |
| R-EVD-2 | T-UNRESOLVED-2（未收录不写 Evidence）+ T-CALIB-3（校准隔离负断言） |
| R-UNR-1..5 | T-UNRESOLVED-2 |
| R-NET-1..5 | **explicit deferral**：provider/权限/缓存许可 research + 用户确认后另拆 ticket（STOP: PROVIDER_DECISION_REQUIRED / NETWORK_PERMISSION_DECISION_REQUIRED / CACHE_LICENSE_DECISION_REQUIRED）；本批不建生产网络实现、不加泛化 host_permissions；本地降级文案由 T-UNRESOLVED-2 承接 |
| R-ASSESS-1..2 | T-ASSESS-UX-5 |
| R-UX-1..2 | T-ASSESS-UX-5 |
| R-QUERY-1 | existing（广覆盖查询词典已实现）+ T-NATIVE-1（invisible capability 验收） |
| R-QUERY-2 | existing（解耦合同已实现）+ T-HINT-4 / T-INTEGRATION-6（回归断言） |
| R-QUAL-1 | T-INTEGRATION-6（结构化测量输出，不冻结 SLA） |
| R-COMPAT-1 | T-HINT-4（K 窗口派生视图）+ T-UNRESOLVED-2（惰性迁移）；schema 3 保持为批次全局负断言（T-INTEGRATION-6） |
| R-COMPAT-2 | T-ASSESS-UX-5（半重置保留 WordState）+ T-UNRESOLVED-2（旧键保守保留）+ T-INTEGRATION-6（回归） |
| R-PRIVACY-1 | existing regression（无遥测/不上传；批次全局负断言 T-INTEGRATION-6） |
| R-PRIVACY-2 | explicit deferral（随 R-NET：provider 确认后实现「只传单词」） |
| R-REG-1 | T-INTEGRATION-6（回归矩阵） |

反向：所有 ticket requirement 均可追溯至 Spec R-* / D1–D26 / 收口合同 / 继承 RULES；**无 ticket-only product requirement**；ticket 未发明任何新阈值/算法/SLA（bootstrap 参数逐字消费 Spec §9B.1/§9C/§25）。

## STOP gates（本批次保留，违反即停）

- **PROVIDER_DECISION_REQUIRED**：任何票不得实现远程网络回退（R-NET deferred）。
- **SCHEMA_CHANGE_REQUIRED**：T-CALIB-3（calibration 持久化）/ T-HINT-4（epoch checkpoint）若实现证明必须 schema bump → STOP 返回用户。
- **P0_NATIVE_INTERACTION_UNRESOLVED**：T-NATIVE-1 / T-INTEGRATION-6 的 §21 P0 矩阵未全通过前不交付。
- **MAIN_BASELINE_MOVED**：交付前 origin/main 规则出现真实冲突 → STOP 报告。
- **RULES_SPEC_CONFLICT**：实现与 RULES/本 Spec 冲突且未获用户确认 → STOP。
- **PRIVACY_BOUNDARY_CONFLICT / NETWORK_PERMISSION_DECISION_REQUIRED / CACHE_LICENSE_DECISION_REQUIRED**：任何要求上传上下文/URL/历史的方案或未授权远程权限 → STOP。
- **PRODUCT_DECISION_REQUIRED**：remote provider lemma 改写 WordState identity → STOP（§12 identity 边界，D17 只由本地 resolution 触发）。

## 批次验证记录（AGENTS §4.1）

1. **Dependency consistency**：逐票核验——每票 AC 只依赖 base + 本票产物 + 已声明 blockers 产物（T-NATIVE-1 无依赖；T-CALIB-3 无依赖；T-UNRESOLVED-2 → T-NATIVE-1；T-ASSESS-UX-5 → T-CALIB-3；T-HINT-4 → T-CALIB-3 + T-UNRESOLVED-2 + T-NATIVE-1；T-INTEGRATION-6 → 全部）。PASS。
2. **Independent acceptance**：各票在 declared blockers 完成后可独立施工、独立验收（真实 Chrome 路径自足）。PASS。
3. **No forward dependency**：无未来票行为被当前票 AC 引用（T-NATIVE-1 的 P0 矩阵不含未收录/迁移/重测语义——归 T-UNRESOLVED-2/T-ASSESS-UX-5/T-INTEGRATION-6；T-CALIB-3 不消费 boundary（T-HINT-4 消费）；T-ASSESS-UX-5 的「校准进度」来自 T-CALIB-3 产物而非未来票）。PASS。
4. **Source contract authority**：ticket 未升级 Spec——bootstrap 参数全部逐字消费 Spec（w=5/p=0.6/q=0.4/8-12/K=5/M=3/view<5 inactive/等距采样/run 与 crossing 选择/boundary 端点）；R-QUAL-1 只测量不设 SLA；R-NET 保持 deferred 不偷偷实现。PASS。
5. **Constraint executability**：每票 allowed changes + 禁止范围 + 数据/许可边界可同时满足（无「必须生成 X」与「X 禁止出现在允许位置」并存）。PASS。
6. **Source coverage 双向闭环**：见上表——每个 R-* 有明确处置（ticket / existing regression / validated prerequisite / explicit deferral）；反向每票 requirement 可追溯。PASS。
7. **Topological simulation**：按 blockers-first 模拟执行——T-NATIVE-1/T-CALIB-3（base 上独立施工）→ T-UNRESOLVED-2（消费 T-NATIVE-1 tooltip 会话）、T-ASSESS-UX-5（消费 T-CALIB-3 入口/状态）→ T-HINT-4（消费三者产物）→ T-INTEGRATION-6（全产物）。逐票可完整施工并独立验收。PASS。
8. **README/index consistency**：本 README 依赖列与各票「依赖/前置」逐字一致。PASS。
9. **Data-dependent example validation**：canonical examples（`K K K L L`→TRANSITION、`K K K K L`→KNOWN_DOMINANT、`K K K U U`→TRANSITION、单 U 不 veto、单 rank inversion 不决定 boundary）与 boundary-equality tests（`rank==T₀` 不提示 / `rank==personalBoundary` 提示 / guard 回退时 `rank==T₀` 不提示）直接引用 Spec 已批准示例；`woman` 未用作因果断言（Spec §2.1 已限定 user-observed symptom）。PASS。
10. **Browser deployment seam validation**：T-NATIVE-1 明确拥有 manifest content-scripts（同源 iframe 注入）与 annotator 装配等真实交付路径配置文件；tooltip 会话/事件委托的宿主为内容脚本 + manifest 声明，非纯逻辑 seam。PASS。

## 本批次不授权

- 不创建 GitHub Issue/PR；不 merge main；不 force-push；不启动 Codex；不选 provider；不加 host_permissions；不升 schema；不扩 assessment pack（1000 冻结）；不下载/提交 ECDICT 派生 payload；不改 production code/tests/manifest（本批次为纯文档）；不处理 RESIDUAL_PUBLIC_OBJECT / existing-assets audit（发布前阻断项，另行单独任务）。
- 批次 DOCUMENT 审查 PASS + 用户「开始开发」明确授权后，Codex 方可按拓扑顺序施工（工作 frontier：T-NATIVE-1 / T-CALIB-3）。
