# 浏览器词汇学习插件：现行产品规则

更新时间：2026-08-14

**2026-08-12 V0.1 Dogfood Realignment（D1–D17 已确认）**：依据首次真实 dogfood（Hacker News 等）暴露的 6 个产品问题，经 Grill（Q1–Q8 + 澄清 Q9/Q10）逐题确认 D1–D17（决议记录 `work/2026-08-11-v0.1-dogfood-realignment-grill-decisions.md`，已通过网页版 GPT DOCUMENT 复审 PASS）。**本节取代以下旧合同**（旧表述在各自小节保留为历史，不再作为 active contract）：① 旧「核心交互路径＝悬停出 tooltip、点击词弹会/不会菜单」→ 由「Ctrl+hover＝LOOKUP_UI_GATE、正文 click 永远归网页、tooltip 交互会话」取代；② 旧 OPEN_DECISIONS B（未收录仅提示不进生词本）→ 由「未收录词可反馈会/不会、可进生词本（临时 surface token 键，D10）」取代；③ 旧 OPEN_DECISIONS C 候选输入（仅频率 frq/bnc + 显式状态过滤，不含 Evidence/band）→ 由「AssessmentEvidence 可参与 hint policy（频段近期画像 D16 + 已测单词特例），但不得创建 WordState」取代；④ 旧「不新增远程查词」（local-first 中该句）→ 由「用户主动、单词级、按需远程回退（provider 未确认前 fail-closed，D11）」有界取代；⑤ 旧无明确语义的「重新测评」（保留 Evidence）→ 由「半重置（清 Evidence/daily/轮次、保留 WordState，D12）」取代。未取代的既有规则继续有效（测评包保持固定 1,000、Evidence≠WordState、manual 不进估计、schema 3、冻结项等）。本轮只修订 RULES 并新建唯一待审 Spec（`docs/specs/2026-08-11-V0.1-Dogfood-交互个性化回退与测评重对齐规格.md`，状态 DRAFT/待审），未授权任何开发/ticket/schema/词典变更。

**2026-08-14 Grill 收口（D18–D26 + 四组收口合同）**：追加确认个性化 hint 三层架构（D18：Global bootstrap T₀ 兜底 / Optional hint calibration 可跳过约 1 分钟、20 题 hard cap / Real reading feedback 持续校准），**取代「assessment band profile 作为全量 hint 主边界」**（1000 词只覆盖 rank 1–1515，不得外推全量；AssessmentEvidence 对 hint 仅剩已测词特例 + 保守 safety signal）；calibration 两阶段采样（D19）、三选一答题（D20）、transition-region estimator（D22–D26：局部滑动窗口、默认 TRANSITION、双条件 dominance、比例形式），transition→boundary/最小可信证据与提前结束/reading feedback 持续校准/Persistence 四组收口合同固化；window size、p、q、题量分配等一律为 **DOGFOOD_TUNABLE_PARAMETER**（Spec 给 bootstrap defaults，非永久产品规则）；calibration 与正式测评完全隔离、不写 WordState/Evidence、不进 estimate；schema 3 默认不变（需要 bump 时 SCHEMA_CHANGE_REQUIRED STOP）；provider 仍 DEFERRED_WITH_IMPLEMENTATION_STOP。

本文件是当前唯一的产品规则来源。用户最新明确指示优先；研究笔记只提供事实或建议，不自动成为需求。2026-07-30/31 Grill 阶段用户逐题确认的决定（GR-01～GR-11、CR-01～CR-06，完整追踪见 `docs/specs/2026-07-30-V0.1-重新对齐规格.md`）固化为现行规则，并删除或修正与其冲突的旧表述。2026-08-04 依据用户真实 Chrome 试用反馈新增三条阅读体验规则（轻提示 tooltip 补音标词性、拖选选区加词入口、popup 生词本页签），2026-08-05 按 DOCUMENT 审查补全其语义。2026-08-06 依据只读架构调查（`outputs/2026-08-06-architecture-coupling-investigation.md`）与用户最新产品目标，把查询能力、用户交互、主动提示与测评词包解耦：普通英文词原则上可查询并反馈，灰线只用于「用户潜在可能不会」的少量候选，known 与无灰线词仍可查询和纠错。本轮只修订本文件并新建唯一待审 Spec，未授权任何开发、ticket、schema 或词典变更。本轮 DOCUMENT 审查修订把「已确认但尚未实现」的高层产品方向与 OPEN_DECISIONS A–F 的待确认参数/路线明确区分，并澄清「部分既有行为已实现或部分实现、完整解耦未实现」的当前状态；已确认方向不构成对 A–F 任何选项的批准。2026-08-06 晚间用户逐项决议 OPEN_DECISIONS A–F（A=dogfood 驱动覆盖验收；B=未收录仅提示不进生词本；E=ECDICT 全量本地（条件决议）；F=包外词同键、不区分来源、不升级 schema（条件决议，前提同 E）；D=开发前可丢弃原型对比透明包装与 caret 定位；C=dogfood 密度参考 + 不必要提示人工验收），决议已落点本文件与唯一 Spec §14。**2026-08-07 完成发现与对齐并回写**：E 验证通过（E_VALIDATED，限定个人本地 dogfood、不公开发布，公开再分发仍 UNKNOWN），F 随 E 生效；D 可丢弃原型完成（推荐「透明 span 包装 + 事件委托」为实施候选，caret 不作唯一交互基础，当时最终选择待批准）；C 输入/算法已对齐（仅频率 frq/bnc + 显式状态过滤，不含 Evidence/band；频率下界阈值，**首轮阈值 T₀＝有效频率 rank 升序列表中间索引阈值 S[⌊n/2⌋]（0-based；偶数 n 时取两个中间元素中的上侧元素），light 方向与边界 rank > T₀（严格大于，等于不提示）；随后 dogfood 校准分位点**）；**query eligibility 与 hint eligibility 独立**——缺有效频率排名的可查询词仍可查询、可反馈，不因缺频率失去查询资格（「缺 frequency 淘汰」仅属固定测评包/旧构建规则）。Spec 保持 DRAFT；**第二道门（DOCUMENT 复审 + 用户批准）通过前不得拆生产 ticket**。**2026-08-07 晚间第二道门通过并批准**：DOCUMENT 复审 `PASS`（审查基线 be4f289）+ 用户最终批准（2026-08-07）；唯一 Spec 正式收尾为 **APPROVED / 已批准**，D 从「候选/待批准」同步为「已批准生产实施路线＝透明 span 包装 + 事件委托」（prototype 仅设计证据，真实长文 DOM/CSS/性能仍须 R-PERF-1 正式验证），C bootstrap 公式不变（T₀ = S[⌊n/2⌋]，0-based，偶数取上侧元素，light iff rank > T₀）。**批准 ≠ 实现**：生产实现差距以 Spec §16 为准；下一阶段才允许 `/to-tickets` 拆生产垂直切片（本收尾任务未运行 `/to-tickets`）。

## 施工规格与验收优先级

- **[已确认]** 2026-07-30 起重新对齐 V0.1。`docs/specs/` 中 2026-07-22 的三份旧规格（范围重置 / 1000词垂直切片 / 掌握预测与主动校准）及现有 GitHub tickets 仅作历史施工证据，不再作为新增实现的授权。
- **[已确认]** GitHub Issue 是施工索引、依赖关系和局部验收清单，不能替代 `RULES.md` 与已批准 Spec。冲突时按“用户最新指示 → `RULES.md` → 已批准 Spec → Issue”处理。
- **[已确认]** 执行代理的自述、测试数量和局部“全绿”都不构成产品验收。验收必须映射到当前已批准的用户闭环、规则和真实交付路径。
- **[已确认]** V0.1 最高层验收 seam 为真浏览器 E2E（升级现有 `e2e-verify.cjs`，覆盖「阅读标注 + 首测与估计展示 + 每日校准轮 + schema 迁移 + 持久化」完整闭环）；真人 dogfood 门槛（见交付与下一步）为叠加的人工验收门，不替代 E2E。

## 产品目标

- **[已确认]** 做一个供单用户本地 dogfood 的 Chrome 英文网页词汇阅读插件，不是全文翻译器、词典编纂平台或模型产品。
- **[已确认]** 正常 HTTPS 英文网页正文是当前范围；暂不支持 PDF、字幕、OCR、电子书、跨域 iframe 和浏览器内置页。
- **[已确认]** 当前已有可构建、可用真实 Chrome 验证的 1,000 词本地垂直切片；但词汇量估计、每日校准轮、wordKey 身份迁移和真人 dogfood 闭环尚未完成，因此 V0.1 尚未产品验收。

## 词典

- **[已确认]** 当前 dogfood 只内置 ECDICT 固定输入快照产生的约 1,000 个高频单词级主词条（固定 1,000 词测评包）。测评包规模扩展到约 10,000 词必须等 1,000 词真人 dogfood 由用户明确接受后再评估；dogfood 未明确接受前不讨论测评包扩容。本轮新增目标（查询词典与测评包解耦）不改变该测评包冻结口径，也不预设查询词典必须是 5,000、10,000 或其他固定数量。
- **[已确认]** 运行时只保留单词、音标、词性和简短中文释义；`frq` 正序主排，缺失时用 `bnc` 正序补位，`tag` 不参与默认排序；`exchange` 仅从实际屈折代码生成词形到主词条的命中映射。**本规则描述当前固定 1,000 测评包/旧查询资产的 runtime 数据口径，不得继续约束新的 query/hint 解耦资产**——新查询词典的 runtime 数据合同见「查询、交互、主动提示与测评词包解耦」与 Spec §5/§8（含 effectiveFrequencyRank 最小只读频率元数据）。
- **[已确认]** 缺音标、中文释义、频率排名或明显异常的候选直接淘汰并递补。词性优先取 ECDICT `pos` 列；该列为空时，只可从 `translation` 每行开头的显式词性前缀机械提取，仍没有词性则淘汰。不得使用 LLM 或人工逐条清洗补全。**本规则描述固定测评包/旧高频构建（1,000 词包）的筛选口径，其中「缺频率排名淘汰」只属于测评包构建，不得默认套用到查询词典**：查询资格（query eligibility）只依赖身份与展示元数据（音标/词性/中文释义），与 frq/bnc 是否存在无关（见「查询、交互、主动提示与测评词包解耦」与 Spec §5/§8）。
- **[已确认]** 输入版本、输入哈希、筛选规则、最终条数和淘汰原因必须可重复记录。
- **[待确认]** ECDICT 释义的逐条公开再分发权利链；在此之前只用于个人 dogfood，不公开发布。
- **[已确认·尚未实现]** 查询词典与固定测评词包职责分离（见「查询、交互、主动提示与测评词包解耦」）：查询词典负责网页查词、词形解析、释义、会/不会反馈和生词本；固定测评词包负责首测、每日校准、frequency band、AssessmentEvidence 和词汇量估计。**OPEN_DECISIONS A/E 已决议；E 已验证通过（2026-08-07，限定个人本地 dogfood、不公开发布）**：查询词典来源方向为 ECDICT 全量本地词典（公开再分发权利链仍 UNKNOWN，若需公开则 fail-closed 返回用户重新决策，见 Spec §14 E、§18），具体条目数由数据可行性决定、不预设；未收录词给明确「未收录」响应；未达到实施状态前不得伪装为已批准或已实现。

## 词汇键（wordKey）与词形

- **[已确认]** 个人词汇状态与测试证据的唯一身份键是 `wordKey`（ECDICT core 主词条的小写形式）。纯屈折变化的页面词形与映射到的 core 主词条共享同一 `wordKey`，例如当前固定测评包的历史 main 事实中 `went / going / gone → go`。**本规则描述当前 main 实现与固定测评包（ECDICT assessment 范围）的身份事实。OPEN_DECISIONS E/F 已决议并生效（2026-08-07，限定范围）**：查询词典方向为 ECDICT 全量本地——E 已验证通过（限定个人本地 dogfood、不公开发布），包外词沿用与包内相同的字符串身份键、不区分来源、不升级 schema；公开再分发需 E/F 返回用户重新决策，不得自行替换词典或静默改变身份模型（见「查询、交互、主动提示与测评词包解耦」与 Spec DEFINITIONS/OPEN_DECISIONS E/F/§18）。
- **[已确认]** core 主词条优先：页面词形本身若是合法 core 主词条，就使用自身作为 `wordKey`；否则才回退 `exchange` 词形映射。因此 `could` 与 `can` 独立；扩展 query snapshot 中 `went → go`、`going → going`、`gone → gone`。前一条的固定测评包历史示例不得覆盖该通用 canonicalization 合同。不做派生词、词族、义项、MWE 或俚语的状态传播。
- **[已确认]** 页面 `data-word`、存储状态键与测试候选键三者统一为 `wordKey`。旧实现的 surface stateKey（`went` 与 `go` 状态各自独立）被本规则取代，必须经 schema 3 迁移并入 `wordKey`（见「存储与迁移」）。

## 词汇状态与测试证据（双真相源）

- **[已确认]** 每个 `wordKey` 维护两类彼此独立的记录：
  - `WordState`（个人词汇状态）：当前用于页面提示的 `会 / 不会 / 未知`，由最后一次显式动作（手动标记、首测作答、每日作答）写入，后写覆盖先写；`WordStateSource` 需支持 `daily`。旧规则“manual 永久压过首测/每日”已删除。
  - `AssessmentEvidence`（测试证据）：该 `wordKey` 最近一次首测或每日测试的结果（outcome：known/learning；source：initial/daily；assessedAt：作答时间）。每个 `wordKey` 只保留最新一条，不保存完整历史，不做事件溯源或通用证据框架。
- **[已确认]** 写入规则：手动标记只更新 `WordState`；首测与每日作答同时更新 `WordState` 与 `AssessmentEvidence`。
- **[已确认]** 词汇量估计、“是否已测过”、“最久未测”只读取 `AssessmentEvidence`，不读取 `WordState`，也不能通过过滤 `WordState.source` 实现。页面 manual 标记只影响当前提示，不进入估计分子或分母。
- **[已确认]** 普通曝光、查看释义和浏览次数不改变状态，也不产生测试证据。
- **[已确认]** 活跃生词表是“当前确认不会”的显示与状态核验清单，不是学习计划或按时间到期的复习队列。
- **[已确认]** 内容脚本只根据 `wordKey` 对应的 `WordState` 决定提示，不读取 `AssessmentEvidence`。新目标下展示决策拆为两个来源：显式状态提示（known 不提示 / learning 强提示）＋候选提示（仅对未显式反馈词是否显示灰线）。**OPEN_DECISIONS C 已决议验收方式并完成输入/算法/bootstrap 对齐（2026-08-07）**：验收＝dogfood 记录每百词灰线密度 + 复用「不必要提示」人工验收，数据积累后再定阈值；**候选输入＝仅查询词典频率（frq/bnc）+ 用户显式状态过滤（排除 known/learning），不含 Evidence/band；算法＝频率下界阈值；首轮 bootstrap 公式（用户确认）＝有效频率 rank 升序列表中间索引阈值 S[⌊n/2⌋]（0-based；偶数 n 时取两个中间元素中的上侧元素），任何代理同一输入得同一阈值**；light 候选判定方向与边界（用户确认）：`effectiveFrequencyRank > 阈值`（严格大于，等于不提示）；frq/bnc 均无效时 hint-ineligible 但仍 queryable；随后由 dogfood 密度数据校准分位点。缺有效频率排名的可查询词不参与候选判定，但仍保持可查询。实现须经后续 `/to-tickets` 阶段与用户“开始开发”授权。**（本条「候选输入＝仅频率 frq/bnc + 显式状态过滤、不含 Evidence/band」已被 2026-08-12 V0.1 Dogfood Realignment 取代：AssessmentEvidence 可参与 hint policy（频段近期画像 + 已测单词特例），见「V0.1 Dogfood Realignment」；query/hint eligibility 独立与「候选不落盘、不改写用户状态」保留）**
- **[已确认·尚未实现]** known 只代表用户当前明确认为自己会：不显示学习提示，但仍可查询，仍可重新反馈“不会”；known ≠ 永远不可交互。当前实现中 known 词被还原为纯文本且无交互载体，属于实现差距（见新 Spec CURRENT_IMPLEMENTATION_GAP）。
- **[已确认·尚未实现]** 查询资格不得依赖 light/strong 包装：是否能够查询和反馈，不得由是否显示灰线决定；无灰线词仍可悬停查询、点击反馈“不会”。
- **[已确认·尚未实现]** 用户显式状态（known / learning / 未显式反馈）与主动提示候选（是否显示灰线）是两个独立维度：未显式反馈 ≠ “不会”，系统预测“可能不会”也不等于用户已明确标记 learning；候选判断不得无条件改写用户明确状态（见「查询、交互、主动提示与测评词包解耦」）。

## 查询、交互、主动提示与测评词包解耦（2026-08-06 最新产品目标）

本小节是 2026-08-06 用户最新产品目标的规范落点，取代与本轮目标冲突的旧口径。**本节所列高层产品方向已由用户确认，但尚未实现**（当前 main 生产代码忠实实现了旧 RULES/Spec，见新 Spec CURRENT_IMPLEMENTATION_GAP）；本节不授权任何开发。**OPEN_DECISIONS A–F 已于 2026-08-06 由用户逐项决议，并于 2026-08-07 完成发现与对齐，唯一 Spec 已于 2026-08-07 经第二道 DOCUMENT 复审 `PASS` 与用户最终批准（APPROVED）**（覆盖验收=dogfood 驱动；未收录=仅提示不进生词本；词典来源=ECDICT 全量本地（**E 已验证，限定个人本地 dogfood、不公开发布**）；包外身份=同键不区分来源不升 schema（**F 已随 E 生效**）；交互路线=可丢弃原型已完成并**已批准生产实施路线＝透明 span 包装 + 事件委托，caret 不作唯一交互基础**；稀疏验收=dogfood 密度+不必要提示人工验收，**候选输入/算法已对齐：仅频率 frq/bnc+显式状态过滤（不含 Evidence/band）、频率下界阈值，数字由 dogfood 校准**），具体决议与状态见 Spec §14。**批准 ≠ 已实现；生产实现差距以 Spec §16 为准，实现须经后续 `/to-tickets` 阶段与用户“开始开发”授权**。

核心产品等式（已确认，必须保持，不得倒置）：

- 可查询 ≠ 必须显示灰线
- 无灰线 ≠ 不可操作
- 未测试 ≠ 潜在不会
- 潜在不会 ≠ 用户明确不会
- known ≠ 不可查询或不可纠错
- 查询词典范围 ≠ 固定测评词包范围

- **[已确认·尚未实现]** 普通英文网页中的普通英文词，原则上都应能够：查询词义；看到原词或词形、音标、词性和中文释义；反馈“会”或“不会”；标记“不会”后进入生词本；标记“会”后从生词本移除。**OPEN_DECISIONS A 已决议**：不设语料阈值，覆盖验收采用 dogfood 驱动——词典命中即交互、未命中给明确「未收录」响应（B），覆盖质量用 dogfood「覆盖缺失」人工数字驱动后续扩容决策；不预设条目数。
- **[已确认·尚未实现]** 是否能够查询和反馈，不得由是否显示灰线决定；不允许因为一个词没有灰线，就完全无法悬停查询或反馈“不会”。
- **[已确认·尚未实现]** 灰色虚线只用于系统判断为“用户潜在可能不会”的少量候选词。**OPEN_DECISIONS C 已决议验收方式并完成输入/算法/bootstrap 对齐（2026-08-07）**：不预设固定密度数字，dogfood 期间记录每百词灰线密度作为参考数据，并复用现有「不必要提示」人工数字验收误提示，数据积累后再定阈值；**候选输入＝仅查询词典频率（frq/bnc）+ 用户显式状态过滤（排除 known/learning），不含 Evidence/band；算法＝频率下界阈值；首轮 bootstrap 公式（用户确认）＝有效频率 rank 升序列表中间索引阈值 S[⌊n/2⌋]（0-based；偶数 n 时取两个中间元素中的上侧元素）**；light 候选判定方向与边界（用户确认）：`effectiveFrequencyRank > 阈值`（严格大于，等于不提示）；frq/bnc 均无效时 hint-ineligible 但仍 queryable；随后用 dogfood 密度数据校准分位点；候选不落盘、不改写用户状态。缺有效频率排名的可查询词不参与候选判定，但仍可查询、可反馈（query eligibility 与 hint eligibility 独立）。实现须经后续 `/to-tickets` 阶段与用户“开始开发”授权；不得恢复高置信自动隐藏、Pool B、概率画像等冻结项（见「明确不做与冻结项」）。
- **[已确认·尚未实现]** 系统判断用户应该会的词：默认不显示灰线，但仍然能够查询，仍然能够反馈“不会”；用户反馈不会后进入生词本并显示红色提示。
- **[已确认·尚未实现]** 用户明确反馈“不会”的词：显示红色强提示；同一 canonical wordKey 的相关页面实例同步；进入生词本。
- **[已确认·尚未实现]** 用户明确反馈“会”或在生词本点击“已掌握”后：红色提示消失；生词本条目消失；但该词仍保持可查询、可再次纠错；known 不等于永远不可交互。
- **[已确认·尚未实现]** 查询词典与固定测评词包职责分离：查询词典负责网页查词、词形解析、释义、会/不会反馈和生词本；固定测评词包负责首测、每日校准、frequency band、AssessmentEvidence 和词汇量估计。查询词典内、测评包外的词：原则上允许持有用户状态、允许进入生词本；不进入 AssessmentEvidence；不参与词汇量估计。**OPEN_DECISIONS E/F 已决议并生效（2026-08-07，限定范围）**：查询词典方向为 ECDICT 全量本地——**E 已验证通过**（MIT 正面授权个人本地使用与打包，限定个人本地 dogfood、不公开发布；公开再分发权利链仍 UNKNOWN，若需公开则 E/F 返回用户重新决策，fail-closed）；**F 已随 E 生效**：包外词沿用与包内相同的字符串身份键、不区分来源、不升级 schema，隔离仅由约束层保证。
- **[已确认·尚未实现]** 主动提示候选与用户状态分离：用户没有明确反馈 ≠ “不会”；系统预测“可能不会”也不等于用户已明确标记 learning；候选判断不得无条件改写用户明确状态；不得把系统预测静默写成用户明确状态。
- **[已确认·尚未实现] frequency runtime 数据合同（查询词典的 hint 输入）**：新查询词典运行时须为 Hint selection 提供最小只读频率元数据 `effectiveFrequencyRank`（语义稳定；名称可调整，不得改变语义）。组合/回退规则沿用已确认口径：**`frq` 有效排名优先，`frq` 缺失时用 `bnc` 有效排名**（均无效时该词 hint-ineligible）。比较方向：**`effectiveFrequencyRank > 当前阈值` 才可能成为 light 候选**（rank 越大＝越生僻）。`effectiveFrequencyRank` **不是 AssessmentEvidence、不是 frequency band**，不进入估计、不改变 WordState；本条目只定义数据合同，不指定 JSON sidecar、字段布局、数据库或新 schema（见 Spec §5/§8/§9）。
- **[已确认·尚未实现]** 核心交互路径：悬停可查询词 → 查看释义；点击可查询词 → 反馈会/不会。拖选加词保留为辅助入口，但不得成为无灰线词唯一的查询或纠错路径。**（本条的「点击词弹菜单」交互路径已被 2026-08-12 V0.1 Dogfood Realignment 取代：正文 click 永远归网页/浏览器，feedback 走 extension-owned tooltip 交互会话；「无灰线词仍可查询/反馈」语义保留）**
- **[已确认·尚未实现]** tooltip 尽量不遮挡目标词和正文：优先显示在目标词上方，上方空间不足时显示在下方；与目标词及正文保留安全间距；不超出左右视口；不侵入可识别的 sticky/header 安全区域；页面滚动后定位仍正确。
- **[已确认·尚未实现]** 真实鼠标操作必须成为验收路径，不能再只使用合成 `Range + mouseup` 代替真人拖选。
- **[已确认]** 保持 local-first：不上传用户网页正文；不上传浏览历史；不新增远程查词、云端画像或遥测；任何联网词典、服务端查询或数据上传都必须经过新的明确批准，不能在本轮文档中默认引入（见新 Spec PRIVACY_AND_DATA_BOUNDARY）。**（「不新增远程查词」一句已被 2026-08-12 V0.1 Dogfood Realignment 有界取代：允许用户主动、单词级、按需远程回退，provider 未确认前 fail-closed，见「V0.1 Dogfood Realignment」；「不上传正文/历史、不新增遥测」保留）**

## V0.1 Dogfood Realignment（2026-08-12 用户确认，D1–D17）

本节由 2026-08-11/12 Grill（Q1–Q8 + 澄清 Q9/Q10）逐题确认的 D1–D17 固化而来；决议记录见 `work/2026-08-11-v0.1-dogfood-realignment-grill-decisions.md`（已通过网页版 GPT DOCUMENT 复审 PASS）。**本节取代与本轮冲突的旧合同**（逐项见头部变更说明与各旧小节标注）；未取代的既有规则继续有效。本节为已确认产品规则，**尚未实现**；生产实现须经 Spec 批准 + `/to-tickets` + 用户「开始开发」授权。

### 交互（INTERACTION）

- **[已确认·尚未实现] PAGE_NATIVE_INTERACTION_FIRST（D4）**：插件默认不得抢占网页原生交互（click/pointer/selection/context menu/drag/form 等）。无 Ctrl 时：不出现查询 tooltip、不出现查询 action UI、不 preventDefault、不 stopPropagation 正文交互；链接正常打开、button 正常点击、input 正常 focus、form 正常 submit、文本选择与右键正常。
- **[已确认·尚未实现] Ctrl+hover = LOOKUP_UI_GATE（D1/D2/D6，取代旧「悬停出 tooltip、点击词弹菜单」核心交互路径）**：按住 Ctrl + hover 可查询词 → 显示查询 UI（词形/音标/词性/释义 + 会/不会）；**禁止 Ctrl+click 查词**；keyup(Ctrl) → 查询 UI 关闭。**正文 click 永远归网页/浏览器**：即使按住 Ctrl，正文 click（含 Cmd/Ctrl/Shift-click、右键）保持浏览器原生语义，插件绝不拦截。链接文字等 interactive 元素内文本同样允许 Ctrl+hover 查询（查询与 click 完全解耦）。
- **[已确认·尚未实现] Tooltip 交互会话（D7，D3 的有界例外）**：tooltip 是 extension-owned 交互 UI（释义 + 会/不会按钮）；鼠标移入 tooltip 后获得豁免——keyup(Ctrl) 不立即关闭，可松开 Ctrl 普通点击按钮完成反馈；移出 tooltip 后关闭。不得产生永久 sticky tooltip。feedback 只发生在 extension-owned UI，正文 click 永不用于 feedback。

### 个性化提示（HINT PERSONALIZATION）

- **[已确认·尚未实现] AssessmentEvidence 可影响 hint policy，但不得静默创建/改写 WordState（D8，取代旧 C 合同候选输入部分）**；「候选不落盘、不改写用户状态」保留；manual known/learning 状态过滤保留（排除于候选）。**AssessmentEvidence 对 hint 仅两个有限作用**：已测词特例（该词 latest Evidence=known → 不提示；learning → 可提示）；保守 safety signal（基础 assessment 明显不稳定时避免过度隐藏提示）。
- **[已确认·尚未实现] 三层个性化 hint 架构（D18，取代「assessment band profile 作为全量 hint 主边界」）**：
  1. **Global bootstrap**：个性化证据不足时用现有 T₀ 作默认灰线 fallback；
  2. **Optional hint calibration**：新增**可跳过、约 1 分钟**的「提示校准」，从更宽 query frequency rank 范围采样估计 personal hint boundary；与固定 1000 词词汇量测评**两个不同目的**；不进 vocabulary estimate、不伪装 AssessmentEvidence、不自动创建 WordState；**总题量 hard cap = 20**（最大题量非目标题量；「约 1 分钟」为 UX target 非固定 SLA）；用户随时可退出/跳过；证据不足 fail-safe 回退 T₀；
  3. **Real reading feedback**：阅读中 manual known/learning 用对应 query word 的 effectiveFrequencyRank 持续校准 personal hint boundary（越用越准）。
  - **禁止**：从固定 1000 assessment band 直接外推完整 query universe 的 mastery boundary（1000 词只覆盖 rank 1–1515，远小于全量范围）。
- **[已确认·尚未实现] 提示校准答题（D20）**：每题三选一「会 / 不会 / 不确定」；三选项语义固定（会＝基本能立即知道常见语境主要意思；不会＝不知道或没印象；不确定＝眼熟/大概知道但无把握）；UI 明确解释三选项标准；不需构造中文干扰项。
- **[已确认·尚未实现] transition-region estimator（D22–D26）**：估计 personal transition region / boundary band（不假设绝对单调）；uncertain = 最直接 boundary-location signal（不=learning、不丢弃、非普通第三类、非 hard veto）；known/learning = 区域趋势证据而非单词级硬约束（容忍 rank inversion：低频专业词会、高频普通词不会、一时遗忘/误操作）；局部滑动窗口观察法（按样本数量定义、非固定 rank bin）；窗口默认 TRANSITION、仅双条件同时满足才判 KNOWN_DOMINANT/LEARNING_DOMINANT（directional dominance ∧ uncertainty gate，比例形式）。
- **[已确认·尚未实现] transition region → personal hint boundary（收口合同 1）**：boundary 从 transition region 较简单一侧确定性派生；transition region 本身及更困难区域具备 gray-hint eligibility；explicit known 永远不提示、explicit learning 走红色强提示、已测词 Evidence 特例优先；queryability 不受 boundary 影响。
- **[已确认·尚未实现] 最小可信证据与提前结束（收口合同 2）**：calibration 须同时观察到 transition region 及其至少一侧稳定趋势证据才生成 personal boundary；不足/高度矛盾 → 回退 T₀；追加样本不再改变 transition region 且满足可信证据 → 可提前结束；总题量 ≤ 20；最小样本数/连续稳定轮数为可调参数（见下）。
- **[已确认·尚未实现] Real reading feedback 持续校准（收口合同 3）**：单个 manual answer 不得让 boundary 大幅跳变；用与 calibration 一致的 transition-region 思路重新派生 boundary；explicit WordState 永远优先、聚合不得反写 WordState；无 rank 的 manual state 对该词本身有效但不参与 rank-boundary；数据不足保持上一个可信 boundary、从未形成则回退 T₀。
- **[已确认·尚未实现] Persistence（收口合同 4）**：personal calibration 重启后继续有效；重新校准可替换旧 baseline；reading feedback 继续更新；不与 AssessmentEvidence 混存、不进 estimate、不伪装 WordState；优先在 schema 3 内实现，真正需要 bump → SCHEMA_CHANGE_REQUIRED STOP。
- **DOGFOOD_TUNABLE_PARAMETER（非永久产品规则）**：window size、dominance 比例 p、uncertainty gate 比例 q、Stage1/2 题量分配、最小可信样本数、连续稳定窗口数、transition region→boundary 的具体端点/代表点、rank 采样点——由 Spec 给出满足已确认 canonical examples 的最小确定性 bootstrap defaults，dogfood 后允许调整；**不冻结为不可变 SLA**。**不恢复**概率画像、PAV/Beta、SRS、遗忘曲线、调度器、测试历史系统、Bayesian/IRT。

### 未收录词（UNRESOLVED WORD）

- **[已确认·尚未实现] 词典可解析性 ≠ 用户反馈资格（D10，取代旧 B 决议）**：本地查询词典 miss 的词允许反馈会/不会、允许进生词本。
- **[已确认·尚未实现] 临时身份（D10）**：miss 词状态键 = 规范化 surface token（trim、去首尾标点、小写、去空白）；不升级 schema（字符串键，与 F 一致）；生词本中该类条目如实标注「未收录」（展示层 re-resolve）；不写 AssessmentEvidence（临时键无 band，天然不进估计）。
- **[已确认·尚未实现] 未来解析合并（D17）**：词典更新后 surface key 解析到 canonical lemma 时，惰性自动迁移该 key 的 WordState 到 canonical key 并删除 surface key；canonical 已有状态时复用 schema 3 仲裁（updatedAt 较新者胜 → 相同 manual 优先 → 仍相同 learning 优先，避免漏提示）；仍未解析的历史键保守保留；迁移只迁 WordState、不创建 Evidence、不升 schema、幂等、跨标签同步。

### 翻译回退（REMOTE FALLBACK）

- **[已确认·尚未实现] 取代旧「不新增远程查词」（D11；local-first 的「不上传正文/历史」保留）**：local miss 后允许**用户主动、单词级、按需**的远程回退——只发送当前 word/token；默认禁止上传网页正文、URL、标题、句子、浏览历史。
- **[已确认·尚未实现] Provider 未确认前 fail-closed（D11）**：不得预先加入生产网络实现或泛化 host_permissions；provider、域名权限、API/缓存许可、大陆网络可用性须经 research + 用户确认（implementation-before-STOP）。结果仅本地展示；离线/失败明确降级提示。

### 测评与重测（ASSESSMENT / RETEST）

- **[已确认·尚未实现] 重新完整测评 = 半重置（D12，取代无明确语义的 reset）**：清空 AssessmentEvidence、dailyTest、completedRoundIndex（估计从新证据重新积累，不足时 unavailable）；**保留全部 WordState**（生词本、manual learning/known 不丢）；重测作答仍按现行「后写覆盖」写入。
- **[已确认·尚未实现] popup「我的词汇水平」总览（D13）**：首测状态 / 点估计 / 保守范围 / 今日校准进度 / 最近校准 / 开始校准 / 重新完整测评（带确认），并解释「手动标记的会/不会只影响阅读提示和生词本，不伪装成正式测试成绩」。

### 查询面与提示质量（QUERYABILITY / HINT QUALITY）

- **[已确认·尚未实现] 保留广覆盖查询词典（D14）**：所有 queryable 词默认可 Ctrl+hover 查询（invisible capability）；**不重新绑定 queryability 与 hint eligibility**。
- **[已确认·尚未实现] hint 质量验收 = 结构化测量 + 人工 dogfood（D15）**：每百词灰线密度 + learning 强提示数 + 人工三数字（不必要提示/释义不可用/覆盖缺失）+ 页面类型差异；**不冻结未经验证的固定 SLA**。

## 阅读体验增强（2026-08-04 用户真实试用反馈新增；2026-08-05 按 DOCUMENT 审查补全语义）

- **[已确认·当前实现事实]** 轻提示 tooltip 内容升级（当前 main 实现）：unknown 词悬停显示四行——第一行为页面实际词形（surfaceForm，保留原文大小写），其余元数据（音标、词性、简短中文释义）统一取自该词形解析出的 `wordKey` 对应的 **core 词条（固定 1,000 assessment 范围）**。屈折词形（如页面 `abilities`）第一行显示 `abilities`，音标/词性/释义取 `ability` 的条目；`wordKey` 与 `entryKey` 恒等（core 优先规则下二者相同）。下划线样式维持轻提示（浅灰虚线）；learning 强提示的行内中文行为不变。**新目标**（见「查询、交互、主动提示与测评词包解耦」）：tooltip 元数据来源为 **query dictionary canonical entry**（查询词典内、测评包外的词同样可展示），不再要求必须是固定 assessment core 词条。
- **[已确认·当前实现事实]** 新增手动标记入口「选区加词」（当前 main 实现）：拖选文本后，选区文本经归一化（trim、去首尾标点、小写）后**作为一个整体**解析——**若命中 core 主词条或 forms 词形映射**，则唯一解析为该 `wordKey`，并在选区旁弹出「加入生词本」浮动按钮；点击写入该 `wordKey` 的 `WordState=learning`（source=manual，不写 `AssessmentEvidence`，不改估计）。选区含空白/多词、部分词形（整体未命中）、未收录词、纯空白或纯数字 → 无法唯一解析 → 静默不弹。同 `wordKey` 已 learning 或 known 时不重复弹出。选区文本仅瞬时本地用于解析，不持久化、不记录、不进快照。**新目标**：拖选辅助入口若选区能由 **query dictionary 唯一解析**，可写入该 query identity（含测评包外词）；lookup-unresolved 仍按 B 维持静默、不进生词本。**（「拖选未收录维持静默」保留为辅助入口既有规则；未收录词进生词本的主入口为 2026-08-12 D10 的主交互反馈路径（tooltip 会/不会），拖选辅助入口不扩大，见「V0.1 Dogfood Realignment」）**
- **[已确认·尚未实现]** 拖选加词保留为辅助入口，不得成为无灰线词唯一的查询或纠错路径；核心交互路径是「悬停可查询词 → 查看释义；点击可查询词 → 反馈会/不会」。**（本条「核心交互路径＝点击词弹菜单」已被 2026-08-12 V0.1 Dogfood Realignment 取代：正文 click 归网页、feedback 走 tooltip 交互会话；「拖选保留为辅助入口」保留）**
- **[已确认·尚未实现]** tooltip 定位验收：tooltip 应尽量不遮挡目标词和正文——优先显示在目标词上方，上方空间不足时显示在下方；与目标词及正文保留安全间距；不超出左右视口；不侵入可识别的 sticky/header 安全区域；页面滚动后定位仍正确。当前实现以目标词左上角为锚点、`top=y-8` 且只处理 bottom/right 溢出，会覆盖目标词和相邻正文并可能侵入 sticky header（调查 §9），属于实现差距。
- **[已确认·尚未实现]** 真实鼠标用户路径验收：真实 mouse down/move/up 拖选路径必须可验收；现有 E2E 只用合成 `Range + mouseup`，未覆盖真实拖拽后的 click 序列（调查 §10），属于测试 seam 差距。
- **[已确认·当前实现事实]** popup 新增「生词本」页签（当前 main 实现）：数据源只读 `WordState`，筛选 `status=learning` 且 key 可解析为**当前词包内合法 `wordKey`（固定 1,000 assessment 范围）**的词条，按 `updatedAt` 降序显示（wordKey + 音标 + 词性 + 释义）；「已掌握」= 对该 `wordKey` 写入 `WordState=known`（source=manual，不写 `AssessmentEvidence`、不改估计）并移出列表；该页签不读 `AssessmentEvidence`；不改首测/每日/估计入口。schema 3 迁移中无法映射到 core/forms 的旧 key 在存储中保守保留，但**不进入生词本列表**（无元数据可展示，也不删除该存储键）。**新目标**：popup 生词本显示**所有 `status=learning` 且能由当前 query dictionary 解析完整元数据的 identity**（包括固定 assessment vocabulary 外的词，按 `updatedAt` 降序）；历史无法映射的 key 继续保守保存、不展示、不静默删除；**固定 1,000 assessment vocabulary 只约束 AssessmentEvidence/测试/估计，不再决定 notebook 可见资格**。

## 首测

- **[已确认]** 首次固定完成 50 道“英文单词→四选一中文释义＋不确定”题，十个词频区间各五题；题目、选项与计划版本作答前冻结。
- **[已确认]** 答对为会；答错或不确定为不会；未测试词保持未知。首测作答同时写入 `WordState` 与 `AssessmentEvidence`（source=initial）。V0.1 首测不创建审计标记、冻结审计计划或防篡改协议。
- **[已确认·当前实现事实]** 会＝不提示；不会＝同页首次下划线加行内简短中文、后续仅下划线可悬停查看；未知＝轻提示。其中「未知＝轻提示」是无条件规则，**已被本轮「灰线只用于潜在不会候选」的新目标取代**（见下一条与「查询、交互、主动提示与测评词包解耦」）；保留本条仅用于说明当前 main 生产代码的实现事实，不作为新目标规范。
- **[已确认·尚未实现]** 未测试 ≠ 潜在不会：新目标下 unknown 仅表示“尚无显式反馈”，是否显示灰线由主动提示候选策略单独决定；未测词不得无条件成为灰线候选（见「查询、交互、主动提示与测评词包解耦」与「词汇状态与测试证据」）。

## 词汇量估计

- **[已确认]** 单点估计：每个频段统计实际测过（有 `AssessmentEvidence`）的不同 `wordKey`；同一 `wordKey` 多次测试只取最新一条证据；known 计掌握，learning（含答错和不确定）计未掌握；未测词不进入分母。公式为 `round(Σ_band ((knownCount / testedCount) × bandWordCount))`，并钳制到 0–词包大小。旧规则“估计从频段内所有 `wordKey` 的 `WordState` 聚合状态实时重算、`WordState` 为估计的单一真相源”已删除。
- **[已确认]** 保守范围：逐频段采用**双侧 90% Wilson 区间**（各频段 z = Φ⁻¹(0.95) ≈ 1.6448536269514722），按 `bandWordCount` 加权求和得到总体范围；UI 只称“保守范围”或“估计范围”，不声称总体 90% 覆盖率；结果四舍五入并钳制到 0–词包大小，且满足 `low ≤ 单点估计 ≤ high`。该范围仅用于显示，不用于自动隐藏、审计、Pool B、漏提示阈值或状态改写。旧表述“Wilson 区间完全推迟”修正为上述受限使用。
- **[已确认]** 估计必须同时展示「单点估计值」与「保守范围」，并明确标注「基于当前 1,000 词覆盖估计，不做外推」；不外推总体英语词汇量，不输出 CEFR 等外推量级。估算按十频段聚合、词包大小作为参数，未来扩容可复用（V0.1 不实现外推）。
- **[已确认]** 预测（自动/模型推断）不得改写单词级状态，也不用于自动隐藏未知词。
- **[已确认·尚未实现]** 测评包是估计的唯一分母来源：查询词典内、固定测评包外的 wordKey 即使持有 `WordState` 或进入生词本，也不写入 `AssessmentEvidence`、不改变「是否已测过」「最久未测」、不进入估计分子或分母（与「查询、交互、主动提示与测评词包解耦」一致）。

## 每日校准轮

- **[已确认]** 每轮固定五题；按 `completedRoundIndex` 奇偶轮换频段：偶数轮选频段 0/2/4/6/8，奇数轮选 1/3/5/7/9，每个选中频段一题；只有完成整轮才递增 `completedRoundIndex`；两个已完成轮次覆盖十段。旧规则“5 题按十频段比例分配（首测迷你版）”已删除。
- **[已确认]** 选词：优先没有测试证据（无 `AssessmentEvidence`）的 `wordKey`；同轮不重复；使用既有 install seed 与最小确定性排序能力；未测候选耗尽后，选择 `assessedAt` 最早的旧词。不引入 SRS、遗忘曲线、到期队列或复习计划。
- **[已确认]** 入口：不自动打开 popup，不增加通知、闹钟、后台提醒或调度器；**每日入口只有在 `initialTest.completed=true` 后才可出现**；首测未完成时绝不创建 `DailyTestState`；schema 2→3 迁移后，只有旧首测确实 `completed` 才允许进入每日轮；用户主动打开 popup 后才看到每日入口；跳过后不突出主入口， 但保留次级“今天仍可开始”。
- **[已确认]** 跳过与暂停：“今天跳过”只在尚未回答任何题时可用，首题前跳过则 `WordState` 与 `AssessmentEvidence` 零变化；回答第一题后隐藏跳过入口；同一本地日期内关闭 popup 表示暂停，恢复同一冻结计划。
- **[已确认]** 跨日：本地日期变化后，未完成轮次过期；已回答题产生的 `WordState`/`AssessmentEvidence` 保留，未答题不产生变化，不回滚；未完成轮次不递增 `completedRoundIndex`；新一天仍按当前 `completedRoundIndex` 选频段；每个本地日期最多创建一轮。不引入事务回滚机制。
- **[已确认]** 每日作答同时更新 `WordState` 与 `AssessmentEvidence`（source=daily），估计随证据变化重算；跳过阅读不受阻塞。

## 存储与迁移（schema 3）

- **[已确认]** schema 2→3 是一次必要的纯函数迁移，与 surface stateKey 并入 `wordKey`、旧首测证据重建、审计数据清空同批完成；不建设通用迁移框架，不提供原地 3→2 降级；dogfood 升级前保留旧快照副本。
- **[已确认]** 旧 `WordState` key 规范化：key 本身是 core 则保持；否则 forms 能映射到 core 则并入目标 `wordKey`；无法映射的旧 key 保守保留，不静默删除。
- **[已确认]** 多个旧 surface 状态并入同一 `wordKey` 的冲突仲裁：`updatedAt` 较新者胜出；时间完全相同时 manual 优先；仍相同时 learning 优先（避免漏提示）。该规则取代“manual 无条件优先”。
- **[已确认]** 从现有 `initialTest.plan.questions` 与 `initialTest.answers` 按相同下标配对重建 `AssessmentEvidence`：只处理结构合法且 answer 非 null 的题；选对→known，选错或不确定→learning；source=initial；assessedAt=0（旧作答时间未知，不用 `Date.now`，不用 `snapshot.lastUpdated` 冒充，不从 `WordState.source` 反推）；部分首测只恢复已答题；损坏、越界或无法配对的记录跳过；手动 `WordState` 不被覆盖；迁移必须确定、纯函数、幂等、一次持久化写入。
- **[已确认]** 快照不得包含 URL、域名、页面标题、正文、句子或浏览历史。

## 审计冻结

- **[已确认]** 从 popup 移除审计入口与审计计划恢复流程；首测不再创建 `AuditMarker`；schema 3 迁移清空旧 `auditMarkers` 并置 `auditPlan` 为 null（`auditLog` 暂保留，不转换为 `AssessmentEvidence`）。旧表述“审计已冻结但入口仍可达”修正为：V0.1 用户路径必须不可达。
- **[已确认]** worker 审计 handler、审计模块（`strategy/audit.ts`、`worker/auditValidation.ts`、`shared/auditPlanVersion.ts`）、相关类型与既有旧测试暂时保留：不删、不扩建、不加固；**不新增对冻结 audit 算法、哈希、防篡改协议、候选池或旧内部模块的测试**，但允许并为当前 V0.1 用户路径补最小回归测试（popup 无审计入口、popup 不恢复 auditPlan、首测不创建 AuditMarker、schema 3 清空 auditMarkers/auditPlan）；dogfood 后再决定是否删除。
- **[已确认]** 高置信自动隐藏、隐藏词审计、Pool B、PAV/Beta 后验、复杂三桶配额与受控回填不恢复；它们不是 V0.1 验收条件。

## 拒绝局部过度设计

- **[已确认]** 不仅拒绝整体范围膨胀，也拒绝局部过度设计：任何子系统的完整度、抽象层级、协议强度和测试数量，不得超过当前用户闭环所需。
- **[已确认]** `AssessmentEvidence` 的存在理由只是避免 manual 覆盖测试样本；每词只留最新一条，不保存历史。`DailyTestState` 只承载当前一天的一轮五题，不建调度器。Wilson 只用于显示。不恢复概率画像，不扩建 audit，不为冻结代码补测试。
- **[已确认]** 禁止设计：通用 repository/service/controller 层、事件总线、调度器、migration registry、测试历史系统、新审计 facade、新完整性哈希、mock-only seam。
- **[已确认]** 每个实现 ticket 必须交付一条可演示的窄垂直切片，对应用户可见行为或必要数据安全风险，并回答“用户现在多得到了什么”。
- **[已确认]** 现有超出简化 V0.1 的代码不立即大规模重写或删除；按当前 Spec 标记“保留但冻结 / 简化 / 删除”，再以最小变更处理。

## 明确不做与冻结项

- **[已确认]** 不实现 Kaikki、OEWN、COW、多源义项对齐、Reasonix/DeepSeek 清洗、Ollama、LM Studio、云模型、自动或手动上下文解释、模型缓存或全文翻译。
- **[已确认]** 已删除相关旧规格、实验、提示词、清洗计划和模型原型；仅保留 `outputs/kaikki-tooltip-cleaner/` Skill 作为独立技能资产，不作为当前产品流程。
- **[已确认]** 高置信自动隐藏、Pool B、PAV/Beta 后验、概率画像、复杂三桶配额与受控回填仍不恢复。本轮「灰线只用于潜在不会候选」的高层方向已确认但尚未实现；**OPEN_DECISIONS C 已决议验收方式并完成输入/算法对齐（dogfood 密度参考 + 不必要提示人工验收；候选输入＝仅频率 frq/bnc + 显式状态过滤，不含 Evidence/band；算法＝频率下界阈值，数字 dogfood 校准）**（见 Spec OPEN_DECISIONS C），实现须经后续 `/to-tickets` 阶段与用户“开始开发”授权；不得因本轮目标表述而默认恢复上述冻结项；系统预测不得改写用户明确状态（见「查询、交互、主动提示与测评词包解耦」）。

## 交付、安全与下一步

- **[已确认]** 先用固定 1,000 词测评包完成真实可用闭环：正文阅读与手动状态、50 题首测、单点估计＋保守范围展示、每日校准轮、schema 3 迁移、刷新/重启持久化和真人 dogfood。只有该闭环由用户明确接受后，才评估测评包扩容或重开复杂审计。本轮「查询、交互、主动提示与测评词包解耦」目标不解除该测评包冻结口径。
- **[已确认]** 2026-08-06 本轮仅修订 RULES 并新建唯一待审 Spec（`docs/specs/2026-08-06-V0.1-查询交互提示与测评词包解耦规格.md`，状态 DRAFT/待审）。**该 Spec 已于 2026-08-07 经第二道门收尾为 APPROVED / 已批准**（DOCUMENT 复审 `PASS`，审查基线 be4f289；用户最终批准 2026-08-07）；**OPEN_DECISIONS A–F 已由用户逐项决议，E/D/C 发现与对齐已完成并回写，D 已批准生产实施路线＝透明 span 包装 + 事件委托、C 输入/算法已对齐（bootstrap 公式不变：T₀ = S[⌊n/2⌋]，0-based，偶数取上侧元素，light iff rank > T₀）**；**批准 ≠ 实现**——完整解耦目标未实现，但**部分既有行为已实现或部分实现**（learning 红色强提示、屈折词形映射、估计只读 Evidence、拖选辅助入口等已存在；无灰线词可交互、候选稀疏、查询词典扩容等未实现，逐项见 Spec §15/§16）。不得据此拆 ticket、标记 ready-for-agent 或开始开发；拆票与开发须用户另行明确授权。当前 main 生产代码仍忠实实现旧口径（unknown 无条件 light、known 无交互载体、lookup-null 无入口）。
- **[已确认]** 本轮采用**显式双门禁**（Spec §18）：**第一道门已通过（2026-08-07）**＝DOCUMENT 审查通过且用户接受（只确认高层方向与 A–F 决议记录，不授权生产）；**发现与对齐已完成**＝E 许可证/数据可行性调查（E_VALIDATED 限定本地范围）、D 可丢弃交互原型（推荐透明 span 包装+事件委托）、C 候选输入与算法对齐（仅 effectiveFrequencyRank：frq 优先、bnc fallback，双缺失＝hint-ineligible + 状态过滤；频率下界阈值，**首轮 T₀＝有效频率 rank 升序列表中间索引阈值 S[⌊n/2⌋]（0-based；偶数 n 时取两个中间元素中的上侧元素），light 方向与边界 rank > T₀（严格大于，等于不提示）；随后 dogfood 校准分位点**），结果已回写 RULES 与唯一 Spec；**第二道门已通过（2026-08-07）**＝DOCUMENT 复审 `PASS`（审查基线 be4f289）+ **用户最终批准（2026-08-07）**，唯一 Spec 收尾为 **APPROVED / 已批准**，D 批准为生产实施路线＝透明 span 包装 + 事件委托、C 候选合同明确（bootstrap 公式不变）。**批准 ≠ 实现**；下一阶段才允许 `/to-tickets` 拆生产垂直切片并交给 Codex（本收尾任务未运行 `/to-tickets`，拆票与“开始开发”均须用户另行明确授权）。可丢弃原型不得演变为生产实现；核心算法与交互路线的最终选择不得延后到生产实施阶段才决定。E 验证范围仅限个人本地 dogfood、不公开发布；若需公开再分发，立即 STOP，E/F 返回用户重新决策（Spec §14 E、§16 fail-closed）。**数据合规**：原型/研究证据不得包含 ECDICT 派生音标/词性/中文释义 payload（仅结构化数据），违反即视为公开再分发风险（Spec §18 末段）。**残余公开对象（RESIDUAL_PUBLIC_OBJECT，2026-08-07）**：当前 refs 已净化（污染 commit 28f6d83 不在可达历史），但旧 SHA **截至 2026-08-07 本次复审实测仍可访问**；**用户决策 A＝接受为发布前阻断项并继续**——彻底公开分发审计（含 main 既有 extension/data 派生资产）为发布前阻断项，另行单独审计；不得再次 force-push、不得删除/重建仓库；平台级永久清除仅报告需 GitHub 侧处理且不承诺受理。
- **[已确认]** 真人 dogfood 完成门槛（固定值，非建议值）：连续 7 天，每天至少实际使用插件阅读一篇真实英文网页，累计至少 20 篇。旧表述“数字只是建议值、可随时调整”已删除。
- **[已确认]** dogfood 期间以人工方式分别记录三个独立数字：不必要提示（用户认识但插件仍提示）、释义不可用（释义明显错误、错配或无法帮助阅读）、覆盖缺失（用户实际卡住但插件没有提示）；每篇最多人工抽查 20 个相关词；同时记录状态/进度是否丢失、估计是否可读懂且有用。不保存 URL、标题、正文或句子；不建设日志、遥测、上报或 dashboard。旧表述“误提示率靠本地日志判定”已删除。
- **[已确认]** dogfood 结果由用户明确接受/拒绝；未明确接受不得讨论 10,000 词扩容。
- **[已确认]** 未获用户明确授权，不得实现生产功能、commit、push、创建 Issue/PR、部署、发布、下载词典或修改远端配置。用户已确认的常驻 Git 同步、网页版 GPT 审查、交接、行动提示词的任务路由矩阵、交付前最新规则复核与合并授权判据以 `AGENTS.md` 第 5 节为准；网页版 GPT 审查提示词必须声明文档/代码阶段、源代理、源任务状态和 Codex 任务状态，回复必须包含目标代理、当前任务/新任务/待确认路由及固定格式的可转发下一步提示词。本地 ticket 默认不创建 GitHub Issue。
- **[已确认]** 用户已于 2026-07-22 授权下载固定 ECDICT 快照并运行确定性构建脚本；已生成仅供本机 dogfood 的 1,000 词核心包。该授权不包含扩展实现、公开发布或扩容至约 10,000 词。
- **[已确认]** 旧掌握预测原型只保留为历史证据，其复杂校准、后验与回填方案不继续扩建。
- **[已确认]** 新一轮顺序为 Grill 明确未决项（已完成）→ `/to-spec` 产生本地规格并经用户批准 → `/to-tickets` 拆分垂直切片并经用户批准。默认只维护本地 ticket；只有用户明确说“发布 Issue”才发布或修改 GitHub Issues。
