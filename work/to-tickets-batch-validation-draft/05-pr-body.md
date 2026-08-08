# 草稿 05：upstream Pull Request 草案

仓库：`mattpocock/skills`
基准分支：`main`（HEAD = `84fdeffd`）
建议 head 分支：`fix/to-tickets-batch-validation`

## PR title

```
fix(to-tickets): validate batch dependencies before publishing
```

## PR body（建议，保持简短）

```markdown
## Problem

`to-tickets` correctly asks for vertical slices and explicit blocking edges, but per-ticket correctness does not guarantee batch correctness. A ticket can look valid in isolation while:

- its acceptance criteria depend on an undeclared future ticket (related: #265);
- it introduces a threshold not present in the source spec ("measure" silently becoming "fail if > 200 ms");
- its allowed artifacts conflict with its own safety constraints.

## Change

Add a small batch-validation step after drafting and before the user quiz:

- simulate the blocking graph in dependency order;
- ensure each ticket is independently verifiable from its declared blockers;
- detect hidden forward dependencies;
- verify source requirement coverage in both directions;
- reject ticket-invented product contracts;
- reject internally contradictory execution constraints.

## Non-goals

This does not change:

- tracer-bullet vertical slicing;
- tracker publishing;
- blocking-edge representation;
- ticket template;
- user approval flow.

## Why

The change preserves the current model while catching failures that only appear when the tickets are read as a dependency graph rather than individually. For a small batch it is a quick check; for a large graph it is a real topological simulation. It adds no fields to the ticket template and no coverage ceremony.
```

## 备注

- body 中引用了 open issue #265（implicit interface blockers），说明本 patch 把该问题的修复泛化为 pre-publish batch validation；不声称修复该 issue，只是关联。
- 若 upstream 有 CONTRIBUTING/PR 模板要求，以实际仓库为准。
