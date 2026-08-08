# 草稿 04：changeset（供 upstream PR 使用）

依据 upstream 惯例（见 PR #781 等）：行为变更 PR 附带 `.changeset/<slug>.md`，合并后由 `changesets/action` 自动生成 version PR 并写入 CHANGELOG。

文件名建议：`.changeset/to-tickets-batch-validation.md`

```markdown
---
"mattpocock-skills": patch
---

Add a batch-validation step to `to-tickets` before the user quiz: walk the blocking graph in topological order so each ticket is implementable and independently verifiable from its declared blockers, catch hidden forward dependencies, check source-requirement coverage in both directions, and reject tickets that invent thresholds or internally contradictory constraints.
```

说明：

- `patch` 级别：不改变用户可见流程的形态（仍是 draft → validate → quiz → publish），只是新增一个检查步骤，且不改变 ticket 产物结构。
- 提交时把 `<slug>` 文件名替换为实际文件名，或直接使用 `to-tickets-batch-validation`。
- 若 maintainer 希望用别的级别/措辞，以维护者意见为准。
