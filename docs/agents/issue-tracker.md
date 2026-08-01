# 本地 Ticket 与 GitHub Issue

本项目的 PRD 与开发任务默认使用仓库内 `work/tickets/` 管理。它们是 WorkBuddy 的 Grill → Spec → ticket 文档循环的交接物，必须以 `RULES.md` 与已批准 Spec 为准。

远端仓库为 `https://github.com/FlapPearLabs/adaptive-vocab-reader`。GitHub Issue 是可选的发布/协作索引：只有用户明确说“发布 Issue”后，才可通过 `gh` CLI 创建、修改或关闭。

## 本地 ticket 约定

- 路径：`work/tickets/<日期或版本>/<序号>-<主题>.md`。
- 生成顺序：Grill 明确决策 → 已批准 Spec → 本地 ticket；不得让 ticket 取代 Spec。
- 每个 ticket 必须写明范围、非目标、验收、测试 seam、依赖、风险，以及“用户现在多得到了什么”。
- 文档推送后，WorkBuddy 必须按 `AGENTS.md` 的模板提供网页版 GPT 审查提示词与 Compare 链接，并明确 `REVIEW_STAGE` 和源任务状态；通过后输出使用“格式化行动交接”字段的 Codex 交接包。

## 仅在明确授权时使用的 GitHub Issue 操作

- 创建：`gh issue create`
- 查看：`gh issue view <number> --comments`
- 列表：`gh issue list`
- 评论：`gh issue comment <number>`
- 添加或移除标签：`gh issue edit <number>`
- 关闭：`gh issue close <number>`

仓库从 `git remote -v` 自动识别。

## Pull Request 分诊

PR 不作为需求入口。外部 PR 默认不进入 triage 队列。

## Skill 语义

- “生成 ticket”：创建或更新 `work/tickets/` 的本地 Markdown。
- “发布 Issue”：创建 GitHub Issue；这是额外的用户授权，不可从“同意 ticket”推断。
- “读取相关 ticket”：默认读取本地 ticket；用户指明 Issue 编号时才读取 GitHub Issue 及评论。

## Wayfinder（仅在用户明确要求以 GitHub Issue 管理时）

- Map：一个带 `wayfinder:map` 标签的总 Issue。
- Child：作为子 Issue 或回退为 Map 任务列表中的开发 ticket。
- 类型：`wayfinder:research`、`wayfinder:prototype`、`wayfinder:grilling`、`wayfinder:task`。
- Blocking：优先使用 GitHub 原生 Issue dependencies。
- Frontier：按 Map 顺序选择无未关闭 blocker、无人认领的第一个任务。
- Claim：给当前开发者分配 Issue，这是 `/wayfinder` 的第一次写操作。
- Resolve：记录结果、关闭 ticket，并更新 Map 的 Decisions-so-far。
