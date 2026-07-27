# 01 — 统一词汇策略 seam（prefactor）

**What to build:** 把首测出题与作答的纯函数（`buildInitialTestPlan`/`applyAnswer`）纳入 `VocabStrategy` 接口，使弹窗与 Service Worker 都经策略模块这一唯一入口调用，不再直接 import `quiz.ts` 独立函数；修复 code-review 发现的「最高测试 seam 被绕过」与「增量路径重算展示决策」两个实质缺陷，让后续 #3/#4 的垂直切片能独立、可测地经 seam 驱动。

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `VocabStrategy` 接口含出题（首测/每日）与作答应用方法，覆盖原 `quiz.ts` 导出能力
- [ ] `popup.ts` 与 `worker/index.ts` 不再直接 import `quiz.ts` 独立函数，全部经 strategy 模块
- [ ] `updateWordDisplay` 不再重算 `showInlineTranslation`，直接消费 strategy 产出的展示字段（修 code-review HARD#1）
- [ ] tsc/vitest 全绿；新增 seam 单一入口测试，断言弹窗与 worker 路径都走同一 strategy
