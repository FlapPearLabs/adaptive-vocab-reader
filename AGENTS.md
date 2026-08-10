# 浏览器词汇学习插件：项目代理工作流

本文件约束所有在本项目中工作的 Codex、Claude Code、子代理与自动化工具。所有面向用户的沟通、项目文档和交付报告必须使用简体中文。

## 1. 开始任何任务前

1. 定位项目根目录，不得仅凭当前工作目录猜测。
2. 完整阅读本文件与根目录 `RULES.md`。
3. 若存在 `CLAUDE.md`、`CONTEXT.md`、`CONTEXT-MAP.md`、相关 `docs/specs/` 或相关 `docs/adr/`，完整阅读与当前任务相关的内容。GitHub Issue 只作施工索引，不能替代施工规格。
4. 若存在 `.codegraph/`，需要理解或定位代码时先使用 CodeGraph；不存在时不要擅自创建索引。
5. 检查现有文件和工作区状态，保护用户已有改动；未经授权不得 reset、restore、clean、stash、切分支或覆盖文件。
6. 先确定任务属于讨论、研究、规格、实现、诊断、审查、CI/CD 还是发布，再显式选择所需 Skill。

`RULES.md` 是已确认产品规则与待确认决策的登记册。任何 Spec、ticket 或实现不得把其中的“待确认”内容伪装成已经确定的需求。

## 2. `/setup-matt-pocock-skills` 当前状态

本项目于 2026-07-16 显式完成了 `/setup-matt-pocock-skills` 的本地配置。

已确认配置：

- 用户已明确选择在根目录创建 `AGENTS.md`；当时不存在 `CLAUDE.md`，因此本次创建 `AGENTS.md` 符合该 Skill 的文件选择规则。
- 开发任务默认使用仓库内 `work/tickets/` 的本地 ticket；GitHub Issue 只在用户明确说“发布 Issue”后才创建，操作约定见 `docs/agents/issue-tracker.md`。
- `triage` 使用默认标签 `needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`，映射见 `docs/agents/triage-labels.md`。
- 当前没有 monorepo 信号；领域文档采用 single-context：根目录 `CONTEXT.md` 与根目录 `docs/adr/`，消费规则见 `docs/agents/domain.md`。
- 当前目录已初始化为本地 Git 仓库，并配置公开远端 `https://github.com/FlapPearLabs/adaptive-vocab-reader.git` 为 `origin`。本地 ticket 不依赖远端标签或 Issue。

除非用户明确要求发布 Issue：

- 不得创建 GitHub Issue、标签或项目；
- `/to-spec` 只可生成或审阅本地规格；
- `/to-tickets` 只产出或更新 `work/tickets/` 本地 ticket；
- `/wayfinder` 不得隐式回退到 `.scratch/`。

## Agent skills

### Issue tracker

本项目默认使用本地 ticket 管理 PRD 与开发任务；GitHub Issue 只在用户明确授权发布时使用。具体操作见 `docs/agents/issue-tracker.md`。

### Triage labels

本项目使用默认五状态 triage 标签。具体映射见 `docs/agents/triage-labels.md`。

### Domain docs

本项目采用 single-context：根目录 `CONTEXT.md` 与 `docs/adr/`。使用规则见 `docs/agents/domain.md`。

## 3. Skill 路由

Skill 必须按任务需要显式调用，绝不能为了“已安装”而机械运行全部 Skills。`/setup-matt-pocock-skills`、`/grill-with-docs`、`/to-spec`、`/to-tickets`、`/implement`、`/handoff` 和 `/wayfinder` 都需要显式调用；不得声称它们已自动执行。

| 阶段或任务 | 应使用的 Skill | 项目要求 |
| --- | --- | --- |
| 首次配置工程 Skills | `/setup-matt-pocock-skills` | 先探索、展示草案并取得 tracker/标签确认；不得自动创建远端资源。 |
| 需求或关键设计不清楚 | `/grill-with-docs` | 一次只解决一个依赖性问题；同步使用 `domain-modeling` 澄清术语，必要时形成 ADR 候选。 |
| 需要外部证据 | `research` | 优先论文、官方文档和原始数据源；区分研究结论、产品假设和用户已确认规则。 |
| 领域边界、词汇状态或证据语义 | `domain-modeling` | 更新领域语言；只有难逆、反直觉且存在真实取舍的决定才写 ADR。 |
| 模块接口或架构取舍 | `codebase-design` | 先定义深模块、责任边界、失败模式和测试 seam。 |
| 需要验证交互或算法可行性 | `prototype` | 原型必须可丢弃，先回答设计问题，不直接演变成未经审查的生产实现。 |
| 需求已经明确并需形成规格 | `/to-spec` | Spec 必须引用 `RULES.md`，写明验收、非目标、风险、测试 seam 与未决项；默认只产出本地草案。 |
| 多会话或多人并行工作 | `/to-tickets` | 先完成 Spec；默认生成 `work/tickets/` 本地 ticket。只有用户明确说“发布 Issue”才创建远端 Issue。 |
| 功能实现 | `/implement` | 仅在 Spec 和验收明确后执行；该 Skill 的任何自动 commit 行为均被本文件覆盖，未经用户单独授权不得 commit。 |
| 可确定行为 seam 的实现或修复 | `tdd` | 优先红—绿—重构；测试必须命中真实领域行为，不得只测试 mock。 |
| 困难缺陷或性能问题 | `diagnosing-bugs` | 先复现、收集证据、定位原因；用户只要求诊断时不得顺手修复。 |
| 完成实现后的审查 | `code-review` | 必须声明固定比较基点；没有 Git 时使用明确的文件清单或快照作为基点。 |
| 生产行为需要可诊断性 | `observability-and-instrumentation` | 对关键事件、性能、Provider 失败和数据迁移按需增加日志或指标；禁止记录完整网页或敏感内容。 |
| CI/CD 变更 | `ci-cd-and-automation` | 让 CI 复现本地质量门禁；未经授权不得修改远端 CI、密钥或部署配置。 |
| 上线准备 | `shipping-and-launch` | 仅在用户明确准备发布时使用；检查隐私、权限、数据许可、回滚、监控与商店材料。 |
| 跨会话交接 | `/handoff` | 仅显式调用；交接必须包含现状、证据、未决项、验证结果和安全边界。 |
| 定位下一项工作 | `/wayfinder` | 仅在 tracker 已配置后使用；禁止未确认时自动选择本地 Markdown tracker。 |

当某个明确点名的 Skill 不存在或无法读取时，必须如实报告，使用最接近的可用流程继续；不得伪造调用记录。

## 4. 讨论、规格与决策纪律

1. 用户提出功能或改进点时，先讨论目标、用户场景、取舍和验收，不直接编码。
2. 已确认决定应写入 `RULES.md`；尚未确认的建议必须标记为“待确认”。
3. `CONTEXT.md` 只记录领域词汇及其定义，不承载实现细节。
4. ADR 只用于难以撤销、缺少背景会令人困惑、且确实在多个方案间作出取舍的决定。
5. 当前产品规则以根目录 `RULES.md` 为唯一来源；当前施工规格位于 `docs/specs/`，其索引与研究材料见 `outputs/README.md`。已删除的旧规格、模型和 Kaikki 路线不得复建或作为实现依据。
6. 单会话、小范围任务可以不拆 tickets，但必须先明确验收标准、修改范围和测试 seam。
7. 多会话、多人或可独立并行的任务，先 `/to-spec`，再生成本地 ticket；只有用户明确说“发布 Issue”才进行远端 tracker 写入。

### 4.1 Ticket 批次校验（/to-tickets batch validation）

`/to-tickets` 逐票 draft 完成后、publish 前，必须执行一次 batch-level validation。单张 ticket 正确不等于整个 batch 正确：ticket 必须作为依赖图整体可执行。

1. **依赖一致性**：每张 ticket 的 Acceptance Criteria 只能依赖 base state、本票自身产出和已声明 blockers 的产出；不得依赖 future ticket、未声明 sibling 或“如果另一张票已做完”。Declared dependency 必须等于实际 acceptance dependency。
2. **独立可验收**：每张 ticket 在其 declared blockers 全部完成后，必须可以独立施工并独立验收。
3. **禁止 forward dependency**：不得使用未来 ticket 才有的行为作为当前 ticket 的 acceptance；需要时要么补 blocker 边，要么把该 acceptance 移到拥有该行为的 ticket。
4. **source contract 不得越权**：ticket 可以细化实现，但不得新增 Spec/RULES 未批准的新阈值、算法、policy 或产品行为。Source 只要求 measure 时，ticket 不得升级为自行判定 acceptable/unacceptable；遇到无批准阈值的显著问题：measure → 保留证据 → STOP → 返回用户/审查。
5. **约束可执行性**：每张 ticket 的 allowed changes、produced artifacts 与 security/privacy/license/data boundary 必须同时可满足，不得出现“必须生成 X”与“X 禁止出现在允许位置”并存。
6. **source coverage 双向闭环**：每个规范 Requirement 必须有明确处置（ticket / existing regression / validated prerequisite / explicit deferral）；反向，每个 ticket requirement 必须可追溯到 source，不得出现 ticket-only requirement。
7. **拓扑模拟**：发布前按 blockers-first 顺序模拟执行 DAG（base → 每票 → outputs → …），逐票问“只完成声明 blockers 时能否完整施工并独立验收”，任一票答否则 batch 未完成。
8. **README/index 一致性**：batch README/index 的 blocker graph 必须与各 ticket 正文的 dependencies 一致。
9. **失败先修 ticket**：validation 发现 cycle、隐藏依赖、coverage 缺口或矛盾约束时，先修 ticket，不进入 implementation。
10. **复杂度适配**：简单 batch 可快速 mental/syntactic 检查；复杂 batch 必须系统走 topological simulation。不得为 validation 给所有 ticket 增加新字段或强制 coverage spreadsheet。
11. **数据依赖示例验证**：当验收中的具体词形、canonicalization 或其他 identity 示例依赖已批准且可用的数据源时，必须先验证其前提；具体 fixture 或示例不得覆盖或抵触上位通用合同。
12. **浏览器部署 seam**：ticket 验收涉及 frame 注入、扩展入口或其他声明式浏览器部署行为时，必须从真实交付路径反推并列出拥有该行为的配置文件；不得把它误当成纯内容脚本内部逻辑。

## 5. 实现与文件安全

- 核心架构、词典数据模型、个性化算法、权限与隐私、持久化迁移由主代理负责最终判断与验收。
- 重复、低风险、机械化的资料整理、fixture、样例和文档草稿可以交给子代理；子代理不得自行扩大范围或执行外部写入。
- 使用 `apply_patch` 完成手工文件编辑；格式化、代码生成器和经过审查的批量机械变换除外。
- 不得修改全局 Skill 文件来绕过项目配置。
- 中间研究、草稿和临时产物放在 `work/`；用户可直接使用的交付物放在 `outputs/`。根目录规则、上下文和 ADR 按其约定位置保存。
- **Ignored/local build artifact 可恢复性（2026-08-11 用户确认）**：当生产构建、真实 E2E 或 dogfood 依赖 `.gitignore` 中的 local-only 数据/生成物时：
  1. tracked 文档必须记录确定性恢复路径；
  2. 至少包含：source identity/hash、exact regeneration command、expected artifact names、build consumer、commit prohibition；
  3. 不得因为当前开发 worktree 恰好已有缓存资产，就假设新的 worktree 或 main 合并后也存在；
  4. 交付 build/dogfood readiness 前，应检查缺失资产时是否能依据 tracked 文档 fail-closed 并恢复；
  5. ignored asset 不得为追求“开箱即用”而被直接提交；若数据许可/隐私边界禁止提交则必须继续 local-only。
- 未经用户明确授权，不得 commit、push、创建 Issue/PR、发布包、部署、修改生产配置、创建远端标签或发送外部消息。
- 用户授权创建某个文件或本地成果，不等于授权任何 Git 或远端操作。
- **Git 同步常驻授权（2026-08-01 用户显式确认）**：当用户对某次改动给出肯定确认（如“可以 / 做吧 / 同意 / OK / yes”等），即视为授权将该改动 commit 并 push 到 GitHub；这是本条默认规则的显式覆盖。若当时无远端仓库，应先新建仓库（归属 `FlapPearLabs/adaptive-vocab-reader` 或用户指定）再推送。沉默或“先别动”不算同意。推送流程沿用第 3 节约定：先 `unset GH_TOKEN`，不修改 main、不强合并、不关闭 Issue（另行授权除外）。
- **轻量网页版 GPT 审查与交接流程（2026-08-01 用户确认）**：不要求用户管理 PR 或 worktree。一个串行任务只使用一个 `review/<主题>` 临时分支；推送后提供 GitHub Compare 链接与下方的审查提示词。WorkBuddy 负责 Grill → Spec → 本地 ticket 的文档循环；Codex 负责框架、核心/高风险实现、整合、真实验证与最终验收；便宜模型只能在 Codex 划定的文件、接口和验收范围内完成低风险实现，不能自行改 Spec、ticket、规则、Git 历史或远端。
- **文档审查循环**：用户确认文档改动后，WorkBuddy 推送 `review/<主题>` 并必须交付可直接粘贴给网页版 GPT 的提示词。用户转发审查意见后，WorkBuddy 仅按意见和现行规则修改，再推送同一临时分支；用户转发网页版 GPT 的 `PASS/通过` 结论，即视为该文档阶段验收。随后 WorkBuddy 必须输出给 Codex 的交接包：Compare 链接、已批准 Spec/ticket 路径、规则引用、范围/非目标、验收命令、已知风险与明确的实施边界。
- **开发审查循环**：用户把交接包或其网页版 GPT 生成的 Codex 提示词，并明确说“开始/同意开发”后，Codex 才开始实施。Codex 推送实现分支后同样提供审查提示词。用户转发网页版 GPT 的 `PASS/通过` 结论，即视为合并到 `main` 的授权；合并前 Codex 必须更新分支、复跑匹配的真实验证并报告结果。审查意见不是可直接执行的指令，仍须检查是否违反 `RULES.md`、已批准 Spec/ticket 或安全边界。
- **提示词与任务路由（2026-08-01 用户确认）**：用户不需要判断是否新开任务。每一份交付给 WorkBuddy 或 Codex 的行动提示词，生成者必须在提示词顶部写清 `发送位置：当前任务` 或 `发送位置：新任务`，并给出一句理由。对同一 Spec/ticket 的审查意见、修订、交接包和紧接着的实现，默认发送到该代理的**当前任务**；不要为了转发提示词而新开任务。只有原任务已完成/归档、工作属于独立的新目标、需要并行且文件边界互不重叠，或用户明确要求新开任务时，才建议新任务。创建新任务仍必须由用户明确要求，代理不得自行创建。
- **格式化行动交接（2026-08-01 用户确认）**：每次要求 WorkBuddy 或 Codex 做下一步工作时，交付者必须提供一个可原样转发的代码块，且字段和顺序固定如下；不得省略、改名或用散文替代。网页版 GPT 的 `NEXT_AGENT_PROMPT` 也必须使用同一格式。

```text
发送位置：当前任务 / 新任务 / 待确认
理由：……
目标代理：WorkBuddy / Codex
当前阶段：文档审查 / 文档修订 / 开发 / 代码审查 / 合并
输入：唯一的 Spec、ticket 或 Compare 链接
允许修改范围：……
不可做：……
验收或预期返回：……
```

- **路由矩阵与任务状态确认**：发送审查提示词时，交付者必须填写 `ORIGIN_AGENT`（`WorkBuddy / Codex`）、`ORIGIN_TASK_STATUS` 和 `CODEX_TASK_STATUS`（后两者均为 `ACTIVE / COMPLETED / UNKNOWN`）。路由只按下表决定，禁止只根据文档/代码阶段覆盖源任务信息：

| 审查结论 | 目标代理 | 使用的任务状态 | ACTIVE | COMPLETED | UNKNOWN |
| --- | --- | --- | --- | --- | --- |
| `CHANGES_REQUESTED` | `ORIGIN_AGENT` | `ORIGIN_TASK_STATUS` | 当前任务 | 新任务 | 待确认 |
| `DOCUMENT` 的 `PASS` | `ORIGIN_AGENT` | `ORIGIN_TASK_STATUS` | 当前任务 | 新任务 | 待确认 |
| `CODE` 的 `PASS` | Codex | `CODEX_TASK_STATUS` | 当前任务 | 新任务 | 待确认 |

`待确认` 时，`NEXT_AGENT_PROMPT` 只能使用固定格式请求 `ROUTING_CONFIRMATION`，明确禁止修改文件、提交或推送；收到该提示词的代理只返回“当前任务可否继续”或“需新任务及理由”。用户只需原样转发，不必猜测任务位置。
- **交付前新鲜度检查（2026-08-01 用户确认）**：代理在输出最终交付报告、Compare 链接、网页版 GPT 审查提示词、交接包，或执行 commit/push 前，必须先 `git fetch origin main`，并以只读方式查看 `origin/main:AGENTS.md` 与 `origin/main:RULES.md`。不得因此 checkout、merge、rebase 或覆盖当前任务改动；只需采用其中较新的工作流/授权规则。若无法获取，必须在交付中明确说明“未能确认最新规则”，不得假装已检查。
- **修订与主分支保护**：审查不通过时默认追加修复提交，保留审查轨迹；仅在需要整理单一提交且工作区干净时，才可 amend 或 `git reset --soft`，并只对 `review/<主题>` 使用 `git push --force-with-lease`。**严禁 force-push `main`**；`main` 始终保持线性、可审计。
- **撤回已 push 提交的原则**：临时分支上的撤回允许改写历史（force-with-lease）；`main` 上的撤回只允许 `git revert`（新增撤回提交，不改写历史）。

### 必须交付的网页版 GPT 提示词

每次推送供网页版审查的分支，交付代理必须把 Compare 链接替换进以下模板，并随交付报告一并给用户：

```text
请作为严格的软件审查员，审查这个公开 GitHub Compare：<COMPARE_URL>。
REVIEW_STAGE: DOCUMENT / CODE（交付者必须替换为实际阶段）
ORIGIN_AGENT: WorkBuddy / Codex（交付者必须替换为实际提交者）
ORIGIN_TASK_STATUS: ACTIVE / COMPLETED / UNKNOWN（交付者必须替换为实际状态）
CODEX_TASK_STATUS: ACTIVE / COMPLETED / UNKNOWN（交付者必须替换为实际状态；仅 CODE 的 PASS 使用）
以仓库中的 RULES.md、AGENTS.md、已批准 Spec 和本地 ticket 为准；不要根据旧 ticket、注释或提交信息臆造新需求。
检查：范围是否越界、规则冲突、数据/隐私风险、错误处理、测试是否覆盖真实用户路径，以及变更是否可合并。
不要改代码，不要输出泛泛建议。即使你无法读取仓库中的规则文件，也必须按本提示词中的路由规则给出结论：
- `CHANGES_REQUESTED`：目标为 ORIGIN_AGENT，并使用 ORIGIN_TASK_STATUS 路由。
- `REVIEW_STAGE: DOCUMENT` 的 `PASS`：目标为 ORIGIN_AGENT，并使用 ORIGIN_TASK_STATUS 路由；只有目标为 WorkBuddy 时，才由它整理 Codex 交接包。
- `REVIEW_STAGE: CODE` 的 `PASS`：目标为 Codex，并使用 CODEX_TASK_STATUS 路由；由 Codex 进行最终验证和合并。
- 状态为 UNKNOWN 时，DESTINATION 必须是“待确认”，不得猜测当前或新任务。
请严格按以下格式回复：
VERDICT: PASS 或 CHANGES_REQUESTED
BLOCKERS: 每项写 文件:行号、问题、违反的规则/规格、最小修复建议；没有则写 无
NON_BLOCKING: 可选建议；没有则写 无
TASK_ROUTING:
- TARGET: WorkBuddy / Codex / 无
- DESTINATION: 当前任务 / 新任务 / 待确认 / 无
- REASON: 一句话说明
NEXT_AGENT_PROMPT: 若 TARGET 非“无”，必须使用“格式化行动交接”的固定字段给出可直接原样转发的代码块；否则写“无”。
CODEX_HANDOFF: 仅文档变更且 PASS 时，给出一段不引入新需求、可直接交给 Codex 的实施/验收摘要；其他情况写“无”。
```

## 6. 本项目的最低质量门禁

技术栈尚未最终确定，因此安装、构建、格式化、lint、类型检查、单元测试和端到端测试的精确命令均为“确定技术栈后补充”。禁止虚构命令或假装通过了不存在的门禁。

每个实现任务仍必须选择与风险匹配的真实验证：

### 6.1 文档与规则

- 完整回读修改后的文件；
- 检查“已确认/待确认”标记是否与用户原话一致；
- 检查相互引用、路径和标题；
- 检查没有把建议、研究结论或旧 Spec 写成用户已确认事实；
- 报告实际新增或修改的文件清单。

### 6.2 词典与数据管线

- 每个上游数据集必须记录来源、版本、许可证、获取日期和转换步骤；
- 转换必须可重复、确定性输出，并生成数量、缺失、重复、冲突和丢弃原因报告；
- ECDICT 核心包只验证单词、音标、词性、短中文与词形命中；缺字段或异常候选必须淘汰，不得调用模型补齐；
- fixture 覆盖普通主词条、常见词形命中和缺字段淘汰，不做义项、MWE 或词族传播；
- 数据更新必须有 schema/version 迁移、前后 diff 和回滚方案。

### 6.3 词汇状态与复测

- 用户直接反馈、初测和每日校准轮的状态核验必须能被分别审计；
- 必须验证普通曝光不会直接变为掌握；
- 必须验证“我会了”立即撤除当前提示，“不会”立即产生当前语境提示；
- 必须验证未知词不会被词频区间画像伪造为会或不会；
- 不能只以“提示变少”验收；至少同时衡量误提示、词典缺失和直接反馈保持。具体阈值由 `RULES.md`/Spec 确认后补充。

### 6.4 网页注入与交互

- 使用静态正文、SPA 动态插入和无限滚动 fixture；
- 验证不扫描代码块、导航、表单、评论区和扩展自身节点；
- 验证同页首次行内中文、重复仅下划线、新章节可再次提示；
- 验证选择单词、刷新后持久化及网站 CSS 隔离；
- 涉及注入 DOM 或样式时，分别验证扩展不破坏宿主页面，以及宿主页面选择器不破坏扩展拥有的视觉状态；
- 记录长文扫描耗时、单批主线程耗时、DOM 增量和布局影响。

### 6.5 存储、迁移和缓存

- 只有在 `RULES.md` 确认数据字段、容量、淘汰和压缩策略后才能冻结 schema；
- 验证升级、回滚、异常中断、数据损坏、容量到达上限和清空流程；
- 静态词典与用户状态必须分层；用户直接状态不得被普通曝光或缓存覆盖；
- 不得保存 URL、完整网页、句子或普通浏览历史，除非用户以后明确重新确认隐私边界。

### 6.6 技术栈确定后必须补充

确定技术栈后，在本节或专门开发文档中补充并真实执行：

- 依赖安装命令；
- 格式化与 lint 命令；
- 类型检查命令；
- 单元与集成测试命令；
- 浏览器端到端测试命令；
- 构建与可加载扩展产物验证命令。

## 7. Code review 与完成定义

实现完成不等于任务完成。进入最终验收前必须：

1. 说明 code review 的比较基点；
2. 检查实现是否遵循 `RULES.md`、Spec 和相关 ADR；
3. 运行与变更匹配的真实验证并保存关键证据；
4. 修复由本次改动引入的问题，再重新验证；
5. 明确未验证部分、残余风险和下一安全步骤；
6. 未获授权时停在本地文件与报告边界，不自动 commit 或发布。

## 8. 每轮交付报告

每轮任务结束必须汇报：

- 实际显式使用的 Skill；
- 使用的子代理/agent 及其任务；
- 新增或修改的文件和产出；
- 实际运行的验证、发现的问题和修复记录；
- 主代理最终验收结论与残余风险；
- 是否更新 `RULES.md`、`CONTEXT.md`、ADR、Spec、质量门禁或工作流文档；
- 明确列出未进行的 commit、push、Issue/PR、远端配置和部署操作。
