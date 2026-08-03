# Ticket 04 — 新任务提示词（交给 Codex 实现）

发送位置：新任务
理由：01/02/03 已完成归档；Ticket 04 是独立需求目标（每日校准轮），虽需在 T2/T3 建立的共享模块（strategy/index.ts、shared/types.ts、worker/storage.ts、popup.ts、e2e-verify.cjs）上集成，但不重新取得其 Requirement 主责任，需以独立 `review/ticket-04-daily-round` 分支推进，并与 T2/T3 回归、接口兼容性一并验收。

目标代理：Codex

当前阶段：开发（实现）

输入：
- 交接归纳文档（本提示词的配套背景，必读）：`work/handoff/2026-08-03-ticket04.md` —— 含现状（main=`b15ddf3`、01/02/03 已归档真实验证证据）、权威来源优先级、下一步 Ticket 04 范围/非目标/验收示例、未决项与风险、安全边界、建议技能与交接输入清单。先于 Ticket 与 Spec 通读，可避免重复 01/02/03 已决事项与越界。**注意：该 handoff 仅作导航摘要，不是需求来源；任何冲突按权威顺序（RULES.md → CONTEXT.md → 当前 Spec → ADR-0004 → Ticket 04）处理，不得用归纳文档覆盖领域术语或施工规格。**
- Ticket：`work/tickets/2026-07-31-v0.1-realign/04-daily-calibration-round.md`
- 规格：`docs/specs/2026-07-30-V0.1-重新对齐规格.md` §20.2（R-EVD-5）、§20.4（R-DLY-1~9）、§21（场景 7~13、17）、§23、§24
- 规则/术语/ADR：`RULES.md` [已确认]（重点「每日校准轮」「存储与迁移（schema 3）」）、`CONTEXT.md`（「每日校准轮」_Avoid_: 生词复测、复习计划、背词任务）、`docs/adr/0004-词汇键与测试证据分离.md`
- 基线：main tip `b15ddf3`（已含 01/02/03；`AssessmentEvidence{outcome,source,assessedAt}` 每词最新一条，manual 不写证据；wordKey 已统一；`strategy/estimate.ts` 只读证据即可见每日新证据；schema 3 的 `dailyTest: null`、`completedRoundIndex: 0` 已由 T2 初始化）

允许修改范围：
- `extension/src/strategy/index.ts` + 每日选题/结算纯函数（位于 strategy 领域边界内，放现有模块还是独立文件由最小清晰改动原则决定；可复用 `quiz.ts` 的 `createRng`/`hashString`/`buildQuestion` 确定性设施）
- `extension/src/shared/types.ts`：`DailyTestState` 结构定义（字段作为 schema 3 正式默认字段的填充，见下方「不可做」对 schemaVersion 的限制）
- `extension/src/worker/index.ts`、`worker/storage.ts`：`DailyTestState` 持久化、`completedRoundIndex` 递增时机（完成整轮才递增、首次变 true 只递增一次）
- `extension/src/popup.ts` + `popup.html`/`popup.css`：每日入口（仅 `initialTest.completed=true` 才出现）、跳过/暂停 UI、跨日过期展示
- `e2e-verify.cjs`：§21 场景 7~13、17
- 与上述行为直接对应的 strategy/worker/storage 单元测试（含 date seam 最小注入）

不可做：
- **不得再次提升 schemaVersion**（必须保持 3）：只填充 T2 已初始化的 `dailyTest`/`completedRoundIndex`，不触发第二次 schema 版本跃迁
- 不建调度器/通知/闹钟/后台定时器/自动 popup；无自动弹出行为
- 不建 SRS/遗忘曲线/到期队列/复习计划；不保存历史轮次；不建状态机框架；不引入事务回滚
- 不得实现成「通用测试轮引擎」
- 不引入 repository/service/controller、事件总线、mock-only seam、迁移框架
- 不修改/删除/加固冻结审计模块，不为其补测试（R-AUD-5）
- 不实施 Ticket 05/06 内容；不碰真实 Chrome profile（仅隔离 E2E）；不执行任何外部写入（Issue/PR/部署/改生产配置）

验收或预期返回：
- R-EVD-5、R-DLY-1~9 十条行为各有真实测试（strategy 纯函数单测 + worker/storage 单测 + 真实 Chrome E2E 场景 7~13、17）
- 代码中确认无任何后台定时器或自动弹窗；确认 schemaVersion 仍为 3
- `npm run typecheck` / `npm test` / `npm run build` / `npm run test:e2e` 全绿
- 完成后先推 `review/ticket-04-daily-round` 分支并给网页版 GPT 审查提示词（模板见 `outputs/2026-08-01-gpt-doc-review-prompt.md`，REVIEW_STAGE: CODE）；`VERDICT: PASS` 且用户显式确认后才快进合并 main 并 push（推送前 `unset GH_TOKEN`，不强合并、不 force、不关闭 Issue）
