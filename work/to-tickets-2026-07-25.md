# To-Tickets 对齐 Spec 草案（本地 .scratch/）

- 日期：2026-07-25
- 流程：`/to-tickets`（经 `/ask-matt` 路由）
- 来源 spec：`docs/specs/2026-07-22-V0.1-1000词垂直切片实施规格.md`、`2026-07-22-V0.1-掌握预测与主动校准规格.md`、`2026-07-22-V0.1-范围重置与实施目标.md`
- 落盘位置：`.scratch/v0.1-align-spec/issues/`（每票一个文件，按依赖序 `01`–`10`）
- 发布状态：**仅本地草案，未发布 GitHub**（无远端写入授权，符合 AGENTS.md 约束）
- 背景：code-review #1/#2 发现「最高测试 seam 被绕过」+「增量路径重算展示决策」两个实质缺陷，故把 **T0 统一词汇策略 seam** 作为 prefactor 前置，保证后续 #3/#4 垂直切片可独立、可测地经 seam 驱动。

## 依赖顺序表

| # | Title | Blocked by | 文件 |
|---|---|---|---|
| 01 | 统一词汇策略 seam（prefactor） | None | `issues/01-统一词汇策略seam.md` |
| 02 | 持久化快照补全 | 01 | `issues/02-持久化快照补全.md` |
| 03 | 预测画像后验（Beta/PAV + Wilson） | 01 | `issues/03-预测画像后验.md` |
| 04 | 隐藏词审计桶抽取 | 03, 02 | `issues/04-隐藏词审计桶抽取.md` |
| 05 | Wilson 判定与高置信不提示 | 04 | `issues/05-wilson判定与高置信不提示.md` |
| 06 | 每日校准轮 | 01, 02 | `issues/06-每日校准轮.md` |
| 07 | 审计选择 | 06, 02 | `issues/07-审计选择.md` |
| 08 | 审计作答消费 | 07 | `issues/08-审计作答消费.md` |
| 09 | SPA 动态插入适配（#4） | 05, 06, 08 | `issues/09-spa动态插入适配.md` |
| 10 | 浏览器 dogfood 验收（#5） | 05, 06, 08, 09 | `issues/10-浏览器dogfood验收.md` |

每个文件内含 `What to build` / `Blocked by` / `Status: ready-for-agent` / 验收清单，遵循 to-tickets 本地文件模板。

## Deferred 边界（2026-07-25 修订）

以下 ticket 属 #3 全量（每日校准 + 高置信静默）与 #5（dogfood）范围，**本轮不实施**，保持 deferred，不改变其规格状态：

| Ticket | 主题 | deferred 原因 |
|---|---|---|
| 03 | 预测画像后验（Beta/PAV + Wilson） | 属 #3 全量；V0.1 垂直切片范围外 |
| 04 | 隐藏词审计桶抽取 | 属 #3 全量；V0.1 高置信机制未建，池 B 恒空（文案已校正对齐 Spec B §8） |
| 05 | Wilson 漏提示率判定与高置信不提示 | 属 #3 全量；依赖 04 |
| 06 | 每日校准轮 | 属 #3 全量；依赖 01/02 |
| 10 | 浏览器 dogfood 验收（#5） | 属 #5；依赖 05/06/08/09 全部闭合 |

本轮（2026-07-25）仅闭合：01（seam 统一，部分）、02（快照补全，部分——仅 `auditLog`/`auditPlan`）、07（审计选择）、08（审计作答消费，服务端权威校验）、09（SPA 动态插入）。03/04/05/06/10 仍为 deferred，待后续迭代排期。

## 前沿（frontier，可立即开工）

- **01 统一词汇策略 seam** —— 无 blocker，且是其余所有票的依赖根。

## 与 code-review 的对应

- T0 直接修复 code-review 的 **Standards HARD#1**（`updateWordDisplay` 重算展示决策）与 **Spec (c)**（popup/worker 绕过 `VocabStrategy` 直连 `quiz.ts`）。
- T1–T8 覆盖 Spec 轴指出的 #1/#2 缺失块（预测画像 / 高置信不提示 / 每日校准 / 审计消费 / 快照字段），这些本就归 #3/#4/#5，非 #1/#2 承诺范围。
