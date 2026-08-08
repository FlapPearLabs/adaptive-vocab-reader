# 草稿 07：研究记录（upstream 与本地 Skill 来源）

日期：2026-08-08。全部为只读调研结果。

## 1. upstream 仓库

- 仓库：`https://github.com/mattpocock/skills`
- **upstream HEAD（main）**：`84fdeffd12f2ee307994d1eb6feb48173b6e0502`（clone 时点，pushed_at 2026-08-07T15:50:46Z）
- to-tickets 源码：`skills/engineering/to-tickets/SKILL.md`（5707 B）
- docs：`docs/engineering/to-tickets.md`（已存在，结构完整：What it does / When to reach for it / Prerequisites / Tracer bullets not layers / Blocking edges / Wide-refactor exception / Common questions / It's working if / Where it fits）
- 贡献规则文件：`CLAUDE.md`（`AGENTS.md` 是指向它的符号链接）
- 无独立 `CONTRIBUTING.md`；贡献规则即 CLAUDE.md + `.agents/writing-docs.md`

## 2. 贡献规则要点（CLAUDE.md / writing-docs.md）

- skill 按 bucket 组织：engineering / productivity 为 promoted bucket，必须出现在顶层 README.md 与 `.claude-plugin/plugin.json` 的 skills 数组。
- **promoted skill 行为改变时必须 re-sync docs 页面**（`docs/<bucket>/<skill-name>.md`），按 `.agents/writing-docs.md` 的四节模板。
- 新增/重命名/删除/改变 user-reachable skill 的“如何关联”时才更新 `ask-matt`；本 patch 不改 to-tickets 与其他 skill 的关联方式 → **不需要动 ask-matt**。
- 不动 manifest 则不需要 `claude plugin validate . --strict`；本 patch 不改 plugin.json。
- 安装方式：`scripts/link-skills.sh` 把 repo 内 skills 符号链接到 `~/.claude/skills`、`~/.agents/skills`。

## 3. 测试与验证命令

- `package.json` 无 test script；scripts/ 仅 `link-skills.sh`、`list-skills.sh`、`sync-plugin-version.mjs`。
- → upstream **没有自动化测试框架**，本 patch 按任务第十二节用静态 fixture / manual agent reasoning 验证（见草稿 06）。

## 4. changeset 惯例

- 使用 `@changesets/cli`（`.changeset/config.json`：changelog = changesets/changelog-github，baseBranch = main）。
- release.yml：push 到 main 时 `changesets/action` 自动创建 version PR → `npm run version`（= changeset version && sync-plugin-version.mjs）→ CHANGELOG 更新。
- 最近合并 PR 观察：行为变更 PR 带 `.changeset/<slug>.md`（如 #781 的 `.changeset/harness-neutral-subagent-language.md`）；docs-only PR（如 #788）不带。
- → 本 patch 为行为变更，**需要 changeset**（见草稿 04）。

## 5. 是否已有等价实现 / issue

- upstream main 的 SKILL.md **没有** batch validation 步骤（Process 为 1 Gather context → 2 Explore → 3 Draft → 4 Quiz → 5 Publish，无 validation）。→ 停止条件 1 不触发。
- 搜索 open issues / PRs（batch validation、to-tickets dependency、acceptance criteria dependency、validate tickets 等关键词）无等价提案。
- 相关 open issue：
  - **#265**（open）：`to-issues misses implicit interface blockers between parallel slices` —— 描述的正是“Slice C 的 acceptance 需要 Slice B 才实现的机制，但 B 未列为 blocker”的 hidden dependency 问题，与本任务问题 3 同构。本 patch 是对该问题的泛化（batch-level validation），PR body 中已关联。
  - **#721**（open）：`to-spec: distinguish outcome success measures from ticket acceptance criteria` —— 与本任务问题 2（ticket 发明阈值/验收合同）相关但属于 to-spec 范畴，不是 to-tickets 的等价实现。
- docs/engineering/to-tickets.md 已有 Common question：「The acceptance criteria graded nothing — some passed before any work was done」，其中承认“a criterion that can only be satisfied by work another ticket owns”是已知缺陷，目前仅建议手工检查——本 patch 把它固化为流程步骤。

## 6. 本地 /to-tickets Skill 来源判定

- 实际来源：`~/.workbuddy/skills/to-tickets` 是指向 `~/.agents/skills/writing/to-tickets` 的**符号链接**。
- `~/.agents/skills/writing/to-tickets/` 是**真实目录（非 git 仓库）**，由 skill 安装/curator 机制管理（`.agents/` 下有 `.bundled_manifest`、`.curator_state`）。
- 内容对比：本地 SKILL.md 与 upstream HEAD 的 SKILL.md 仅差最后一行（本地多出 "Work the frontier one ticket at a time with `/implement`, clearing context between tickets."），其余完全一致 → 本地副本来自 upstream 同源安装。
- 项目 `.workbuddy/` 被 `.gitignore` 忽略 → 项目内不存在 repo-owned 可维护 skill 副本。
- **判定：B 类（generated / install cache / global dependency，不可追踪）**。按任务第六节 B 类处理：不直接篡改安装副本；adaptive-vocab-reader 立即依赖 AGENTS.md guard；通用 patch 在 upstream fork 实现；落地后报告从 fork/upstream 更新本地 skill 的路径（upstream PR 合并后运行原安装命令，或直接替换 `~/.agents/skills/writing/to-tickets/SKILL.md` 为已审查内容）。

## 7. 其他

- 当前 GitHub 认证：keyring 有效（账户显示 FlapPearLabs），GH_TOKEN 环境变量无效 → 所有 gh/git 远端操作前必须 `unset GH_TOKEN`（AGENTS.md 已要求）。
- 本机 git 代理：`http://127.0.0.1:7897`（clone upstream 需走该代理，否则 HTTP2 framing 错误）。
- 无已有 fork（`mattpocock/skills` 下未见 FlapPearLabs/panglihaoshuai 的 fork）→ 落地时需新建 fork。
