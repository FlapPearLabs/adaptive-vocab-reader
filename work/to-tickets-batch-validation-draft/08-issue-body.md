# 草稿 08（修订版）：mattpocock/skills Issue 正文（已发布 + 已修订）

## Title

```
to-tickets: validate ticket batches before publishing
```

## Body（2026-08-08 20:14 修订版，已应用到 Issue #818）

```markdown
## Problem

This comes from a real run of `/to-tickets` on an approved spec: every ticket looked fine individually, and the batch still failed review. Per-ticket correctness does not guarantee batch correctness — a ticket can look valid in isolation while the set fails as a dependency graph:

- **Hidden forward dependencies** — an acceptance criterion quietly needs a mechanism a parallel ticket will build, but no blocking edge declares it. The agent then re-implements the same logic (this is the failure described in #265).
- **Ticket-invented contracts** — a source spec says "measure latency", and a ticket silently upgrades that to "fail if it exceeds 200 ms", creating a threshold the source never approved.
- **Un-executable constraints** — a ticket is allowed to produce artifacts under a tracked directory while a hard rule forbids committing exactly those artifacts.
- **Broken coverage** — a normative source requirement ends up with no ticket, prerequisite, or deferral attached, while the batch README claims no orphans.

A minimal example of the first class:

```text
Ticket A:
  Blocked by: None
  Acceptance: User can see the item in the dashboard.

Ticket B:
  Implements dashboard rendering.
```

A declares no blocker, yet its acceptance needs B's output. Per-ticket review misses it; a walk over the graph in dependency order does not.

## Proposal

Add a small batch-validation step after drafting the vertical slices and before the user quiz:

1. **Dependency audit** — walk the blocking graph in topological order; each ticket must be implementable and independently verifiable using only the base state and its declared blockers' outputs. An acceptance criterion must not depend on a future or undeclared ticket — add the real edge or move the criterion.
2. **Source-contract audit** — check both directions: every normative source requirement has an explicit disposition, and every ticket requirement traces back to the source; reject invented thresholds/policies/algorithms.
3. **Constraint audit** — each ticket's allowed changes, produced artifacts, and hard constraints must be satisfiable at once.
4. **Fix, don't publish** — cycles, hidden dependencies, coverage gaps, and contradictory constraints are fixed before the breakdown is presented.

A check, not a framework: no new ticket fields, no coverage spreadsheet, no graph tooling. For a small batch this is a quick mental check; for a large graph it is a real topological simulation.

The docs already acknowledge the hidden-dependency shape — an acceptance criterion that can only be satisfied by work another ticket owns — and currently recommend checking by hand. This step makes that check structural.

## Non-goals

This does not change tracer-bullet vertical slicing, tracker publishing, blocking-edge representation, the ticket template, the wide-refactor flow, or the user approval flow.

## Patch available

A ready-to-review patch lives on this fork branch (SKILL.md + docs page + changeset):

https://github.com/FlapPearLabs/skills/compare/main...fix/to-tickets-batch-validation

The repo currently restricts PR creation to collaborators, so I'm filing this issue instead. Happy to open a PR if that's preferred, or to adjust the proposal based on maintainer feedback.

Relates to #265.
```
