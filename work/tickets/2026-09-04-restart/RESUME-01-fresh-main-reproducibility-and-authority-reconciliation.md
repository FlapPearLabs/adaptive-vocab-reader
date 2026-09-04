# RESUME-01 — Fresh Main Reproducibility + Authority Reconciliation

## Status

`READY_FOR_EXECUTION`

## Authority

- `AGENTS.md`
- `RULES.md`
- `CONTEXT.md`
- `docs/CURRENT_IMPLEMENTATION_BASELINE.md`
- `data/README.md`
- 当前相关 `docs/specs/`

## Goal

长期停工后，从远端 `main` 的 fresh isolated checkout 重建可复现性，并把代码、规格、ticket、Issue、branch、README 的状态重新对齐成一套 current truth。

本票不是 feature implementation。

## Fixed starting baseline

执行开始时必须 fresh-fetch 并检查：

```text
expected origin/main:
333c3628c5adabd1d69f96b9043eb7a109825eb0
```

若不同：

```text
STOP: REMOTE_BASELINE_CHANGED
```

先更新 `docs/CURRENT_IMPLEMENTATION_BASELINE.md`，不得继续使用旧基线。

## Phase 1 — Fresh environment

1. 从 `origin/main` 创建新的 isolated worktree / clone；
2. 不复用旧 worktree 的 ignored assets；
3. 记录 Node / npm / Python / Chrome 版本；
4. `npm ci`。

## Phase 2 — Local-only data recovery

严格按 `data/README.md`：

1. 获取/定位固定 ECDICT raw input；
2. 校验 source ref；
3. 校验 SHA-256：
   `1a6947e04785db63613a92e14903cdae7954f7e84860b10e68e5c7cbb3f9c3cf`；
4. 重新生成 assessment core；
5. 重新生成 full query dictionary；
6. 验证 expected artifact names；
7. 验证 ignored boundary；
8. 缺失/哈希错误必须 fail-closed。

不得从旧 worktree 复制未知来源的派生 JSON 来伪造 reproducibility PASS。

## Phase 3 — Quality gates

依次运行并保留真实输出：

```bash
npm run typecheck
npm test
# repository-defined Python data build tests
npm run build
npm run test:e2e
```

任一失败：

- 先分类为 environment / data-recovery / implementation / flaky-test / authority drift；
- 保存最小复现；
- 不降低测试、不删 assertion、不顺手改产品行为；
- 本票允许修复“恢复流程本身”的确定性缺陷，但生产行为修复必须先返回 review boundary。

## Phase 4 — Authority reconciliation

逐项建立 current truth：

### README

验证状态描述与 fresh evidence 一致。

### RULES / CONTEXT / specs

- RULES 仍是产品规则来源；
- CONTEXT 只保留领域语言；
- 标出 superseded / historical specs；
- 不把旧阶段性文字当 current implementation status。

### Local tickets

对历史批次逐票标记：

- implemented + verified
- implemented + needs fresh verification
- superseded
- still open
- unknown

不得只凭 commit message 判 PASS；需要对应 acceptance evidence。

### GitHub Issues #1–#5

逐条对照 acceptance criteria，输出 closure recommendation，但**不得在本票中自动关闭 Issue**。

### Remote branches

建立 inventory：

- branch head
- merged/contained by main?
- unique commits?
- keep / archive-candidate / delete-candidate

本票不删除远端分支。

## Phase 5 — Deliverables

必须更新：

- `docs/CURRENT_IMPLEMENTATION_BASELINE.md`

并新增：

- `work/governance/2026-09-04-resume-audit/REPORT.md`

REPORT 至少包含：

```text
REMOTE_BASELINE
ENVIRONMENT
DATA_RECOVERY
TYPECHECK
UNIT_TESTS
DATA_TESTS
BUILD
REAL_CHROME_E2E
ISSUE_RECONCILIATION
BRANCH_INVENTORY
STALE_DOCS
BLOCKERS
NEXT_RECOMMENDED_PHASE
```

## Acceptance Criteria

- [ ] fresh checkout 不依赖旧 ignored cache 即可按 tracked runbook恢复所需 local assets，或明确给出可复现 blocker；
- [ ] 每个质量门禁有真实运行结果，不用历史 PASS 冒充 fresh PASS；
- [ ] README / baseline 不再声称已被证据否定的状态；
- [ ] Issue #1–#5 均有逐条 closure recommendation，但未越权关闭；
- [ ] 远端历史 branches 有 ancestry / unique-commit inventory，但未越权删除；
- [ ] query/hint 旧 wave 不会因旧 DOCUMENT 描述被重复实现；
- [ ] 最终只推荐一个下一阶段入口，不并行开启多个产品方向。

## Non-goals

- 新产品功能；
- 10k 扩容；
- UI redesign；
- CI 新建；
- 发布 / Chrome Web Store；
- license remediation；
- 自动关闭 Issues；
- 删除远端 branches；
- main merge。

## Stop conditions

```text
REMOTE_BASELINE_CHANGED
RAW_SOURCE_HASH_MISMATCH
LOCAL_ASSET_RECOVERY_UNDOCUMENTED
QUALITY_GATE_PRODUCT_FAILURE
AUTHORITY_CONFLICT_REQUIRES_PRODUCT_DECISION
```

遇到 stop condition 时，保留证据并返回，不自行扩大 scope。
