# 04 — 每日五题校准轮

**权威来源**：
- [V0.1 重新对齐规格](../../../docs/specs/2026-07-30-V0.1-重新对齐规格.md)
- [RULES.md](../../../RULES.md)
- [ADR-0004](../../../docs/adr/0004-词汇键与测试证据分离.md)

**What to build**：首测后每天可主动完成五题；开始前可以跳过，同一本地日期关闭后可继续同一轮；跨日未完成计划过期，但已答结果保留。

**Blocked by**：03 — 首测词汇量估计展示

**Status:** ready-for-agent

**用户可见收益**：首测之后每天可以主动做五题、看着估计逐步收敛；可以在开始前跳过，同一本地日期关闭后可继续同一轮；跨日未完成计划过期，但已答结果不会丢失。

**目标**：交付可选、无打扰、可暂停的每日校准闭环。

**主责任 Requirement ID**：R-EVD-5、R-DLY-1～R-DLY-9

**依赖和 blocker**：
- 依赖：T3（传递依赖 T2）。
- Blocker：T3 —— R-DLY-4 要求验收「每日作答后估计随之变化」，估计不存在则无法判定；且两票同改 popup 结果区。硬依赖。

**统一跨日语义（本票强制口径）**：
- 同一本地日期关闭 popup：暂停；
- 同日再次打开：恢复同一冻结计划；
- 本地日期变化：未完成计划过期；
- 已答题产生的 WordState 和 AssessmentEvidence 保留；
- 未答题不产生变化；
- 不回滚；
- 未完成轮次不递增 completedRoundIndex；
- 新一天按当前 completedRoundIndex 创建新计划。

**范围**：
- `DailyTestState` 最小持久化（localDate、roundIndex、冻结 5 题、等长 answers、completed、skipped）；奇偶频段轮换；段内优先无证据 wordKey、同轮不重复、install seed 确定性排序、耗尽后取 `assessedAt` 最早；复用首测四选一＋不确定与冻结机制；作答双写；popup 每日入口（仅 `initialTest.completed=true` 才出现）；跳过 / 暂停 / 跨日过期；date seam 最小注入。
- **T4 不得再次提升 schemaVersion**：填充 T2 已正式初始化的 `dailyTest: null` 与 `completedRoundIndex: 0` 字段，不触发第二次 schema 版本跃迁。

**明确非目标**：
- 不建调度器、通知、闹钟、后台定时器、自动 popup；
- 不建 SRS、遗忘曲线、到期队列、复习计划；
- 不保存历史轮次；不建状态机框架；不引入事务回滚；
- **不得实现成「通用测试轮引擎」**；
- 不引入 repository/service/controller、事件总线、mock-only seam、迁移框架。

**预计影响的模块责任**（仅作定位依据，不强制发明新文件/facade/service）：
- `extension/src/strategy/index.ts` + 新增每日选题/结算纯函数（位于 strategy 领域边界内，是否独立文件由实现阶段最小清晰改动决定）。
- `extension/src/shared/types.ts`：`DailyTestState` 结构（字段已作为 schema 3 的正式默认字段由 T2 定义并初始化）。
- `extension/src/worker/index.ts`、`worker/storage.ts`：`DailyTestState` 持久化、`completedRoundIndex` 递增时机。
- `extension/src/popup.ts`、`popup.html`/`popup.css`：每日入口、跳过/暂停 UI、跨日过期展示。
- `e2e-verify.cjs`：§21 场景 7~13、17。

**Requirement → behavior → test seam**：

| Requirement | Behavior | Test Seam |
|---|---|---|
| R-EVD-5 | 「是否已测过」和「最久未测」只读取 AssessmentEvidence，不读取或过滤 `WordState.source` | strategy 每日选词单测 |
| R-DLY-1 | 偶数轮频段 0/2/4/6/8，奇数轮 1/3/5/7/9，每段一题 | strategy 单测 |
| R-DLY-2 | 未完成轮不递增 completedRoundIndex | strategy/worker 单测 |
| R-DLY-3 | 同轮无重复；优先无证据词；耗尽后 assessedAt 最早 | strategy 单测 |
| R-DLY-4 | 每日作答双写状态与证据，估计随之变化 | strategy 单测 + E2E |
| R-DLY-5 | 无通知/自动 popup/闹钟/调度器；主动打开才见入口；initialTest.completed!==true 不显示每日入口、不创建 DailyTestState；schema 2→3 后仅旧 initialTest.completed=true 才可进入 | 代码审查 + E2E（无自动弹出、负向断言首测未完成） |
| R-DLY-6 | 首题前跳过零变化；答后跳过入口消失 | strategy 单测 + E2E |
| R-DLY-7 | 同日关闭 popup 暂停，恢复同一冻结计划 | E2E |
| R-DLY-8 | 跨日已答保留、未答过期、不回滚 | strategy 单测（date seam）+ E2E |
| R-DLY-9 | 每本地日期最多创建一轮 | strategy/worker 单测 |

**数据、迁移或隐私风险**：本票填充 T2 已正式初始化的 `dailyTest` / `completedRoundIndex` 字段，**不得触发第二次 schema 版本跃迁**（避免出现第二次身份迁移）。失败行为：轮次进行中扩展重启 → 冻结计划已持久化，同日恢复；跨日按 Spec §15 过期。

**失败行为**：冻结计划已持久化，同日恢复；跨日未答题零变化、不回滚；任何非法状态由 worker/storage 单测与 E2E 负向断言捕获。

**反过度设计检查**：
- `DailyTestState` 只承载当天一轮五题；不建调度器/队列/提醒；
- date seam 只是纯函数输入，不建时间服务；
- 不建状态机框架、通用测试轮引擎、SRS、遗忘曲线、到期队列、事务回滚；
- 不引入 repository/service/controller、事件总线、mock-only seam。

**真实验证命令**：
```bash
npm run typecheck
npm test
npm run build
npm run test:e2e   # 含 §21 场景 7~13、17
```

**完成定义**：
- 十条行为验收（含 R-EVD-5）有真实测试；
- typecheck / 单测 / build 通过；
- E2E 局部场景真实 Chrome 通过；
- 代码中确认无任何后台定时器或自动弹窗；
- 确认未再次提升 schemaVersion（仍为 3）。

## Acceptance criteria

- [ ] 「是否已测过」和「最久未测」只读取 AssessmentEvidence，不读取或过滤 `WordState.source`。
- [ ] `completedRoundIndex` 偶数轮取频段 0/2/4/6/8、奇数轮 1/3/5/7/9，每段恰一题共五题。
- [ ] 未完成整轮不递增 `completedRoundIndex`；`completed` 首次变 true 时只递增一次。
- [ ] 同轮无重复词；优先无 `AssessmentEvidence` 的 wordKey；耗尽后取 `assessedAt` 最早。
- [ ] 每日作答同时写 `WordState(daily)` 与 `AssessmentEvidence(daily)`，估计随之变化。
- [ ] 无自动 popup / 通知 / 闹钟 / 调度器；只有主动打开 popup 才见入口；`initialTest.completed !== true` 时入口不出现且不创建 `DailyTestState`；schema 2→3 后仅旧 `initialTest.completed=true` 才可进入。
- [ ] 首题前跳过 → 状态与证据零变化；答第一题后跳过入口消失；跳过后主入口不突出但保留次级「今天仍可开始」，从次级入口反悔时 `skipped` 变回 false 并复用同一冻结计划。
- [ ] 同一本地日期关闭 popup = 暂停，重开恢复同一冻结计划。
- [ ] 跨日：未完成轮过期；已答题产生的状态与证据保留；未答题零变化；不回滚；不递增轮次；新一天按当前 `completedRoundIndex` 选段。
- [ ] 每个本地日期最多创建一轮。
