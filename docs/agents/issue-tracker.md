# Issue tracker：GitHub

本项目的 PRD 与开发任务使用 GitHub Issues 管理，通过 `gh` CLI 操作。

仓库地址：`https://github.com/panglihaoshuai/adaptive-vocab-reader`。本地 `origin` 已配置；远端标签和 Issue 未实际创建前，不得假装已经发布。

## 基本操作

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

- “发布到 Issue tracker”：创建 GitHub Issue。
- “读取相关 ticket”：读取对应 GitHub Issue 及评论。
- 未获得远端写入授权时，只生成本地待发布草案。

## Wayfinder

- Map：一个带 `wayfinder:map` 标签的总 Issue。
- Child：作为子 Issue 或回退为 Map 任务列表中的开发 ticket。
- 类型：`wayfinder:research`、`wayfinder:prototype`、`wayfinder:grilling`、`wayfinder:task`。
- Blocking：优先使用 GitHub 原生 Issue dependencies。
- Frontier：按 Map 顺序选择无未关闭 blocker、无人认领的第一个任务。
- Claim：给当前开发者分配 Issue，这是 `/wayfinder` 的第一次写操作。
- Resolve：记录结果、关闭 ticket，并更新 Map 的 Decisions-so-far。
