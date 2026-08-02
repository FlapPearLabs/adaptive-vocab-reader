# 01 — 切断 V0.1 审计用户路径

**权威来源**：
- [V0.1 重新对齐规格](../../../docs/specs/2026-07-30-V0.1-重新对齐规格.md)
- [RULES.md](../../../RULES.md)

**What to build**：打开 popup 不再看到「开始审计」这类 V0.1 根本不支持的入口，也不会被恢复进一个半成品审计流程；V0.1 用户路径只剩「阅读 + 首测」，不会误写入与新证据模型冲突的状态。

**Blocked by**：None — can start immediately（T1 → T2 为施工阻塞顺序，不是数据模型依赖）

**Status:** done

**用户可见收益**：打开 popup 不再看到「开始审计」这类 V0.1 根本不支持的入口，也不会被恢复进一个半成品审计流程；V0.1 用户路径只剩「阅读 + 首测」，不会误写入与新证据模型冲突的状态。

**目标**：把审计从 V0.1 用户可达路径彻底移除，同时按 Spec §17 保持审计代码冻结、不删不扩。

**主责任 Requirement ID**：R-AUD-1、R-AUD-2、R-AUD-3、R-AUD-4、R-AUD-5

**依赖和 blocker**：
- 依赖：无。
- Blocker：无 —— 可立即开始，是整条链的起点。
- 说明：T1 → T2 是**明确施工顺序**，不是数据模型硬依赖；T1 不触碰 schema 或 wordKey，可独立于 T2 完成并验收。

**范围**：
- popup 移除「开始审计」入口按钮、审计计划恢复流程与审计答题 UI；
- 首测作答不再产出 `AuditMarker`（对应类型分支收敛）；**当前 marker 生成位置涉及 `strategy/quiz`**，预计影响模块不得漏掉该责任位置；
- 为这四条用户路径补最小回归测试。

**明确非目标**：
- 不删除、不重写、不加固 `strategy/audit.ts`、`worker/auditValidation.ts`、`shared/auditPlanVersion.ts`、worker 审计 handler 与既有旧审计测试；
- 不新增对冻结 audit 算法、哈希、防篡改协议、候选池或旧内部模块的测试；
- 不做 schema 变更（`auditMarkers`/`auditPlan` 清空归 T2）。

**预计影响的模块责任**（仅作定位依据，不强制发明新文件/facade/service）：
- `extension/src/popup.ts`：移除审计入口与恢复流程调用。
- `extension/popup.html`：移除审计相关 DOM 与文案。
- `extension/src/strategy/index.ts`：收敛首测对 audit 的副作用（不再经 quiz 产出 marker）。
- `extension/src/strategy/quiz.ts`：**明确包含当前 marker 生成的责任位置**——首测结算路径不得再产出 `AuditMarker`。
- `extension/src/shared/types.ts`：收敛 `settleInitialTestAnswer` 返回类型中 audit 相关分支（仅收敛用户路径，不重写冻结类型本身）。
- `e2e-verify.cjs`：新增 §21 场景 16 的局部断言。

**Requirement → behavior → test seam**：

| Requirement | Behavior | Test Seam |
|---|---|---|
| R-AUD-1 | popup 无审计入口 | 真浏览器 E2E DOM 断言（§21 场景 16） |
| R-AUD-2 | popup 不恢复审计计划 | 真浏览器 E2E（启动不读 auditPlan） |
| R-AUD-3 | 首测作答不创建 marker | strategy/worker 单测（答对分支不产出 marker） |
| R-AUD-4 | V0.1 用户路径不调用 audit 模块（冻结 handler 可继续存在，但用户可达路径不调用） | 组合证据：popup/content 发送端源码审查 + 不发送审计消息最小回归 + strategy/worker 首测不建 marker + 真浏览器 E2E；`worker/importBoundary.test.ts` 只能证明 worker import 边界，不能单独证明用户路径不可达 |
| R-AUD-5 | 不新增冻结 audit 算法/哈希/防篡改/候选池测试；允许为 V0.1 用户路径补最小回归 | code review 基点检查（确认未新增冻结代码测试） |

> 关于 R-AUD-4 的证据强度：必须组合 popup/content 发送端源码审查、不发送审计消息的最小回归、strategy/worker 首测不建 marker 与真实浏览器 E2E；`worker/importBoundary.test.ts` 只能证明 worker 的 import 边界，不能单独证明完整用户路径不可达，因此不得单独作为验收证据。

**数据、迁移或隐私风险**：不改 schema、不动已持久化数据。残留旧 `auditMarkers`/`auditPlan` 在本票之后仍可能存在但用户不可达，由 T2 迁移正式清空。

**失败行为**：无数据写入风险；若移除入口后某处仍静态引用 audit 模块，由 R-AUD-4 的组合证据在验收时暴露，不进入 T2。

**反过度设计检查**：
- 不新建 audit facade；
- 不加固哈希或防篡改协议；
- 不为冻结代码补测试；
- 只为四条 V0.1 用户路径补最小回归（Spec §23.5 明确允许）。

**真实验证命令**：
```bash
npm run typecheck
npm test
npm run build
npm run test:e2e   # 含 §21 场景 16 局部断言
```

**完成定义**：
- 四条行为验收各有真实证据（源码审查结论 + strategy/worker 单测 + 真实 Chrome E2E 场景 16）；
- `npm run typecheck`、`npm test`、`npm run build` 通过；
- 新增 E2E 局部场景在真实 Chrome 通过；
- 未删除任何冻结审计模块；
- code review 确认未新增针对冻结 audit 算法/哈希/防篡改/候选池的测试。

## Acceptance criteria

- [x] popup 任何状态下都不存在审计入口元素（DOM 负向断言）。
- [x] popup 启动不读取、不恢复 `auditPlan`。
- [x] 首测答对后 `snapshot.auditMarkers` 保持为空。
- [x] popup、content 与其他 V0.1 发送端不发送审计消息；首测和每日用户动作不触发审计 handler；冻结的 worker 审计 handler 和内部模块可以继续存在，但任何 V0.1 用户可达路径都不能调用它们。

## 完成记录（归档）

- **完成日期**：2026-08-02
- **合并 commit**：`0303836`（review/ticket-01-remediation → main，快进合并）
- **审查结论**：网页版 GPT `VERDICT: PASS`（无 BLOCKER）；用户 2026-08-02 显式确认 01/02 完成并通过审查，授权纳入版本库
- **验证**：`npm run typecheck` / `npm test`（207 单测）/ `npm run build` / 真实 Chrome E2E（§21 场景 16）全绿
- **范围回顾**：R-AUD-1~5 全部落地——popup 无审计入口、首测不建 AuditMarker、用户路径不调用冻结审计模块；冻结代码未删未扩，未新增冻结测试
