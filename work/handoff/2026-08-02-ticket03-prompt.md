# Ticket 03 — 新任务提示词（交给 Codex 实现）

发送位置：新任务
理由：Ticket 03 是 V0.1 链条上的独立实现任务，Blocked by 02 已随 `6f5272b` 合并解除，与 01/02 无代码重叠，需以独立 `review/ticket-03-estimate` 分支推进，不与当前/历史任务冲突。

目标代理：Codex

当前阶段：开发（实现）

输入：
- 交接归纳文档（本提示词的配套背景，必读）：`work/handoff/2026-08-02-ticket03.md` —— 含现状（main=`de2893a`、01/02 已归档真实验证证据）、权威来源优先级、下一步 Ticket 03 范围/非目标/验收示例、未决项与风险、安全边界、建议技能与交接输入清单。先于 Ticket 与 Spec 通读，可避免重复 01/02 已决事项与越界。**注意：该 handoff 仅作导航摘要，不是需求来源；任何冲突按权威顺序（RULES.md → CONTEXT.md → 当前 Spec → ADR-0004 → Ticket 03）处理，不得用归纳文档覆盖领域术语或施工规格。**
- Ticket：`work/tickets/2026-07-31-v0.1-realign/03-vocabulary-estimate.md`
- 规格：`docs/specs/2026-07-30-V0.1-重新对齐规格.md` §17、§20（R-EST-1~7）、§21（场景 5、6）
- 规则/术语/ADR：`RULES.md` [已确认]、`CONTEXT.md`、`docs/adr/0004-词汇键与测试证据分离.md`
- 基线：main tip `de2893a`（已含 01/02；`AssessmentEvidence{outcome,source,assessedAt}` 每词最新一条，manual 不写证据；wordKey 已统一页面 `data-word`/存储键/首测候选键/证据键）

允许修改范围：
- `extension/src/strategy/index.ts` 及估计领域决策逻辑：新增可独立测试的估计纯函数 seam（放现有模块还是独立文件，由实现阶段最小清晰改动原则决定）
- `extension/src/shared/types.ts`：估计输出类型（可选）
- `extension/src/popup.ts` + `popup.html`/`popup.css`：首测结果页展示点值 + 双侧 90% Wilson 显示用保守范围 + 「基于当前 1,000 词覆盖估计，不做外推」声明
- `e2e-verify.cjs`：§21 场景 5、6 数值与文案断言
- 对应单测（strategy 纯函数单测，含 Wilson 硬编码期望值 + 浮点 tolerance；测试不得复制生产算法或复用生产计算结果）

不可做：
- 不外推总体词汇量，不输出 CEFR，UI 不得出现「90% 置信区间」字样
- 范围不驱动任何自动行为（不自动隐藏/审计/Pool B/漏提示阈值/状态改写）
- 不恢复 Beta/PAV 概率画像；不建设通用统计层/概率画像/估计历史/趋势图/CEFR
- 不预先强制创建新实现文件（除非最小清晰改动确实需要）
- 不修改/删除/加固冻结审计模块，不为其补测试（R-AUD-5）
- 不碰真实 Chrome profile（仅隔离 E2E）；不执行任何外部写入（Issue/PR/部署/改生产配置）

验收或预期返回：
- R-EST-1~7 七条行为各有真实测试（strategy 纯函数单测 + 真实 Chrome E2E 文案/数值断言）
- `npm run typecheck` / `npm test` / `npm run build` / `npm run test:e2e` 全绿
- UI 文案经断言锁定，确认无「90% 置信区间」「CEFR」字样
- 完成后先推 `review/ticket-03-estimate` 分支并给网页版 GPT 审查提示词（模板见 `outputs/2026-08-01-gpt-doc-review-prompt.md`）；`VERDICT: PASS` 且用户显式确认后才快进合并 main 并 push（推送前 `unset GH_TOKEN`，不强合并、不 force、不关闭 Issue）
