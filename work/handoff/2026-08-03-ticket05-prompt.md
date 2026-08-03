# Ticket 05 — 新任务提示词（交给 Codex 实现）

发送位置：新任务
理由：01/02/03/04 已完成归档并合并 main（`0f402fc`）；Ticket 05 是独立验收门（真浏览器综合验收），不持有任何 R-\* 主责任（仅复核 T1~T4 已有 Requirement，主责任归属保持不变），需以独立 `review/ticket-05-acceptance-gate` 分支推进，并在既有 E2E 场景 1~17 基础上做综合回归与放行结论。

目标代理：Codex

当前阶段：开发（真实验证）

输入：
- 交接归纳文档（本提示词的配套背景，必读）：`work/handoff/2026-08-03-ticket05.md` —— 含现状（main=`0f402fc`、01~04 已归档真实验证证据与既有 E2E 覆盖对照）、权威来源优先级、下一步 Ticket 05 六项范围/非目标/验收示例、R-MIG-8 备份门时机、安全边界、建议技能与交接输入清单。先于 Ticket 与 Spec 通读，可避免重复 01~04 已决事项与越界。**注意：该 handoff 仅作导航摘要，不是需求来源；任何冲突按权威顺序（RULES.md → CONTEXT.md → 当前 Spec → ADR-0004 → Ticket 05）处理，不得用归纳文档覆盖领域术语或施工规格。**
- Ticket：`work/tickets/2026-07-31-v0.1-realign/05-real-browser-acceptance-gate.md`
- 规格：`docs/specs/2026-07-30-V0.1-重新对齐规格.md` §5（完整用户闭环）、§21（真浏览器 E2E 场景 1~17；场景 14 必须走真实 worker/storage 路径而非只调迁移纯函数；持久化验收补全：重启后同时验证 `WordState`/`AssessmentEvidence`/`DailyTestState`/`completedRoundIndex`/`schemaVersion=3`，两个真实标签页同一 wordKey 不同词形 manual 或 daily 更新后同步）、§23、§24
- 规则/术语/ADR：`RULES.md` [已确认]（重点「交付、安全与下一步」最高层验收 seam 为真浏览器 E2E；「存储与迁移（schema 3）」R-MIG-8 时机）、`CONTEXT.md`、`docs/adr/0004-词汇键与测试证据分离.md`
- 基线：main tip `0f402fc`（T1~T4 已合并；`e2e-verify.cjs` 已有场景 1~17 主体：场景 14 主体在 #1B 真实迁移、场景 15 主体在 #2 重启恢复 + #4 跨日重启、场景 7~13/17 在 #4；单测 267）

允许修改范围：
- `e2e-verify.cjs`：§21 场景综合验收升级（重点新增/锁定：双标签页同一 wordKey 不同词形 manual/daily 更新后同步；浏览器重启后五项持久化断言并查；全场景 1~17 综合回归与放行结论输出）
- `tests/fixtures/`：新增真实 schema 2 快照 fixture（隔离，不触碰真实 profile）
- `build.mjs` / dist 产物：真实构建产物加载验证（如有必要的最小调整，不得改动词典数据或构建逻辑语义）
- `package.json`：`test:e2e` 脚本（如确需最小调整）
- 与上述行为直接对应的 E2E 断言与必要的最小回归修复（若综合回归暴露 T1~T4 主责任缺陷，仅做归属该主责任的最小修复并在报告中说明）

不可做：
- 不承担 T1~T4 本应完成的单元测试、迁移单测或局部 E2E 场景的重新实现（仅做综合验收与复核）
- 不新增任何产品功能；不改变 `SCHEMA_VERSION`（保持 3）
- 不为冻结 audit 补测试（R-AUD-5）；不修改/删除/加固冻结审计模块
- 不建 CI 平台、报告 dashboard、遥测或日志平台；不引入测试框架迁移
- 不重新取得 T1~T4 的 R-\* 主责任；不实施 Ticket 06（人工 dogfood 门）
- 不碰真实 Chrome profile；**不执行 R-MIG-8 真实用户备份**（属 T6 前人工门，须用户明确授权与配合）
- 不执行任何外部写入（Issue/PR/部署/改生产配置）除非用户显式授权

验收或预期返回：
- 六条行为验收在真实 Chrome 通过并留存证据（§21 场景 1~17 综合回归、schema 2 fixture 真实路径迁移、重启后五项持久化断言、双标签页同 wordKey 不同词形同步、闭环无回归、放行/不放行结论）
- `npm run typecheck` / `npm test` / `npm run build` / `npm run test:e2e`（AVR_E2E_NO_SANDBOX=1 受限会话）全绿
- 输出「可进入人工 dogfood / 不可进入」明确结论；复核矩阵中每个场景可回溯到来源 Ticket 与主责任 R-ID（主责任归属未被改变）
- 完成后先推 `review/ticket-05-acceptance-gate` 分支并给网页版 GPT 审查提示词（模板见 `outputs/2026-08-01-gpt-doc-review-prompt.md`，REVIEW_STAGE: CODE）；`VERDICT: PASS` 且用户显式确认后才快进合并 main 并 push（推送前 `unset GH_TOKEN`，不强合并、不 force、不关闭 Issue）
