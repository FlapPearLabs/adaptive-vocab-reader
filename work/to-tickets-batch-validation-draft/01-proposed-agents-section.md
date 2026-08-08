# 草稿 01：adaptive-vocab-reader AGENTS.md 拟新增章节

## 插入位置

`AGENTS.md` 第 4 节「讨论、规格与决策纪律」末尾（第 7 条之后）与「## 5. 实现与文件安全」之间，新增一个小节。不改动其他任何章节。

## 拟新增全文（审查通过后原样写入 AGENTS.md）

```markdown
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
```

## 设计说明（供审查）

- 只落在 AGENTS.md（工作流/工程纪律），不进入 RULES.md（产品规则）。理由：本规则描述的是“代理如何拆票”，不是产品行为合同；RULES.md 是产品规则唯一来源，不应混入工程工作流。
- 不包含 ECDICT、query-hint、popup 等具体业务细节——它们只是经验来源，不属于通用硬规则。
- 10 条均可在不增加 ticket 模板字段的前提下执行；第 10 条明确禁止把 validation 变成重仪式。
- 与第 3 节 Skill 路由表中 `/to-tickets` 行（“先完成 Spec；默认生成 work/tickets/ 本地 ticket”）互补，不冲突。
