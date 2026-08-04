# T5 真浏览器综合验收报告（2026-08-03 / 复审修订 2026-08-04）

- **分支**：`review/ticket-05-acceptance-gate`（基于 `main` tip `0f402fc`）
- **提交**：`fe2cde7`（初版）+ `c919c19`（3 项 BLOCKER 修复）+ `7667866`（复审 BLOCKER-3 余项：失败归责细化）— 见「七、复审记录」
- **Compare**：https://github.com/FlapPearLabs/adaptive-vocab-reader/compare/main...review/ticket-05-acceptance-gate
- **结论**：✅ **T5 隔离验收通过；完成 R-MIG-8 真实备份门后可进入人工 dogfood**

## 一、六条行为验收证据（真实 Chrome 151，AVR_E2E_NO_SANDBOX=1）

| # | 行为验收 | 结果 | 关键证据（e2e 输出） |
|---|---|---|---|
| ① | 真实构建产物加载完成闭环 | ✅ PASS | `E2E #1 PASS: annotations=89 … local_snapshot=minimal` |
| ② | 真实 schema 2 fixture 经真实 worker/storage 路径升级 v3（非纯函数冒充） | ✅ PASS | `E2E #1B PASS: schema2_fixture→v3=true, forms_merge=abilities→ability, conflict_arbitration=updatedAt_newer, unmapable_key_kept=true, evidence_rebuilt=true, corrupt_skipped=true, audit_cleared=true, persisted_idempotent=true` |
| ③ | 浏览器重启后五项持久化断言（WordState/AssessmentEvidence/DailyTestState/completedRoundIndex/schemaVersion=3） | ✅ PASS | `E2E #15 PASS: restart_persistence=true, schemaVersion=3, words=55, evidence=55, dailyTest_completed=true, completedRoundIndex=1` |
| ④ | 两标签页同 wordKey 不同词形 manual/daily 更新后同步 | ✅ PASS | `[stage6] manual 同步 PASS：pageA=academic(learning→strong)，pageB=academics 同步 strong`；`[stage6] daily 同步 PASS：out（core）与 outed（屈折）两页经 popup 真实作答后同步无标注` |
| ⑤ | §5 完整用户闭环回归（场景 1~17）无回归项 | ✅ PASS | 场景 1~17 全部 PASS（见复核矩阵） |
| ⑥ | dogfood 前放行结论 | ✅ 输出 | 见文末「结论」 |

## 二、质量门禁（四绿）

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | ✅ 通过 |
| `npm test` | ✅ 267 单测全绿（16 个文件） |
| `npm run build` | ✅ 构建完成 |
| `npm run test:e2e`（真实 Chrome；受限会话 `AVR_E2E_NO_SANDBOX=1`） | ✅ 全场景 PASS |

## 三、改动文件（仅验收设施，未触碰 `extension/src/**` 生产行为）

| 文件 | 改动 |
|---|---|
| `e2e-verify.cjs` | ① #1B 迁移场景改用真实 fixture 文件注入并扩展断言；② 新增阶段五（重启后五项持久化并查）；③ 新增阶段六（两标签页同 wordKey 不同词形 manual/daily 同步）；④ 结尾输出 §21 场景 1~17 复核矩阵 + 放行结论 |
| `tests/fixtures/schema2-snapshot.json`（新增） | 真实 schema 2 快照 fixture：surface 冲突对（ability/abilities）、无法映射旧 key（bogusword）、部分首测计划/作答（含损坏题）、残留 auditMarkers/auditPlan/auditLog |

`package.json` / `build.mjs` 无需改动（`test:e2e` 脚本与构建入口已满足要求）。

## 四、§21 场景复核矩阵（场景 → 来源 Ticket → 主责任 R-ID）

| 场景 | 复核内容 | 来源 Ticket | 主责任 R-ID |
|---|---|---|---|
| 1 | 加载真实扩展构建产物 | T5 | — |
| 2 | 静态正文与 SPA 阅读标注 | T5 | — |
| 3 | 屈折词形共享 wordKey（标记屈折形式，同 wordKey 其他词形提示一致） | T2 | R-KEY-1, R-KEY-3 |
| 4 | 完成 50 题首测 | T1+T2 | R-AUD-3, R-EVD-2 |
| 5 | 结果页点估计＋保守范围＋不外推声明 | T3 | R-EST-1, R-EST-6 |
| 6 | manual 改提示但估计不变 | T2+T3 | R-EVD-1, R-EST-2 |
| 7 | 首测未完成无每日入口、不创建 DailyTestState；完成后才出现 | T4 | R-DLY-5 |
| 8 | 完成每日五题 | T4 | R-DLY-1, R-DLY-2 |
| 9 | 每日答案更新状态与估计 | T4 | R-DLY-4 |
| 10 | 首题前跳过零变化 | T4 | R-DLY-6 |
| 11 | 同日关闭/重开 popup 暂停恢复 | T4 | R-DLY-7 |
| 12 | 模拟本地日期变化（date seam 最小注入） | T4 | R-DLY-8 |
| 13 | 跨日已答保留、未答过期 | T4 | R-DLY-8 |
| 14 | 真实 schema 2 fixture 经 worker/storage 升级 v3 | T2 | R-MIG-1~7 |
| 15 | 重启后五项持久化 | T2+T4 | R-MIG-7, R-EVD-2/4, R-DLY-2/7/8 |
| 16 | popup 无审计入口、不恢复残留计划 | T1 | R-AUD-1, R-AUD-2 |
| 17 | 阅读不被每日测试阻塞 | T4 | R-DLY-5 |
| 补全 | §21 持久化补全：两标签页同 wordKey 不同词形 manual/daily 更新后同步 | T2+T4 | R-KEY-1/3, R-DLY-4 |

> 主责任归属未被改变：T1=R-AUD、T2=R-KEY/R-EVD/R-MIG、T3=R-EST、T4=R-EVD/R-DLY。T5 仅复核，不持有任何 R-* 主责任。

## 五、边界与后续

- **R-MIG-8**：真实用户 profile 备份属 T6 前人工门，须用户明确授权与配合；T5 隔离 E2E 未触碰真实 profile（仅临时 profile 与 fixture），且不以该备份已执行为前置。
- **T6**：人工 dogfood 门槛（连续 7 天 / 每天至少一篇 / 累计至少 20 篇）与三项人工记录（不必要提示 / 释义不可用 / 覆盖缺失）由 Ticket 06 承接。
- **未越界**：未修改 `extension/src/**`、未为冻结 audit 补测试（R-AUD-5）、未建 CI/遥测/dashboard、未执行任何外部写入（仅推送 review 分支，属任务明确授权）。
- 综合回归未发现任何 T1~T4 主责任缺陷，无需「不可进入 dogfood」路径。

## 六、CODE 审查提示词（可直接粘贴给网页版 GPT）

```text
请作为严格的软件审查员，审查这个公开 GitHub Compare：https://github.com/FlapPearLabs/adaptive-vocab-reader/compare/main...review/ticket-05-acceptance-gate
REVIEW_STAGE: CODE
ORIGIN_AGENT: WorkBuddy
ORIGIN_TASK_STATUS: ACTIVE
CODEX_TASK_STATUS: COMPLETED
以仓库中的 RULES.md、AGENTS.md、已批准 Spec 和本地 ticket 为准；不要根据旧 ticket、注释或提交信息臆造新需求。
检查：范围是否越界、规则冲突、数据/隐私风险、错误处理、测试是否覆盖真实用户路径，以及变更是否可合并。
本变更仅涉及验收设施：e2e-verify.cjs 与 tests/fixtures/schema2-snapshot.json（T5 真浏览器综合验收门）。
T5 不持有任何 R-* 主责任（主责任归属 T1=R-AUD、T2=R-KEY/R-EVD/R-MIG、T3=R-EST、T4=R-EVD/R-DLY 不变）；
不得修改 extension/src/** 任何生产行为；不得为冻结 audit 补测试；不得代修 T1~T4 缺陷。
不要改代码，不要输出泛泛建议。即使你无法读取仓库中的规则文件，也必须按本提示词中的路由规则给出结论：
- CHANGES_REQUESTED：目标为 ORIGIN_AGENT（WorkBuddy），并使用 ORIGIN_TASK_STATUS（ACTIVE）路由。
- REVIEW_STAGE: CODE 的 PASS：目标为 Codex，并使用 CODEX_TASK_STATUS（COMPLETED）路由（COMPLETED → 新任务）。
- 状态为 UNKNOWN 时，DESTINATION 必须是「待确认」，不得猜测当前或新任务。
请严格按以下格式回复：
VERDICT: PASS 或 CHANGES_REQUESTED
BLOCKERS: 每项写 文件:行号、问题、违反的规则/规格、最小修复建议；没有则写 无
NON_BLOCKING: 可选建议；没有则写 无
TASK_ROUTING:
- TARGET: WorkBuddy / Codex / 无
- DESTINATION: 当前任务 / 新任务 / 待确认 / 无
- REASON: 一句话说明
NEXT_AGENT_PROMPT: 若 TARGET 非「无」，按如下固定格式给出可原样转发的提示词（字段和顺序固定，不得省略）：
发送位置：当前任务 / 新任务 / 待确认
理由：……
目标代理：WorkBuddy / Codex
当前阶段：文档审查 / 文档修订 / 开发 / 代码审查 / 合并
输入：唯一的 Spec、ticket 或 Compare 链接
允许修改范围：……
不可做：……
验收或预期返回：……
```

## 七、复审记录（2026-08-04，CODE 审查 CHANGES_REQUESTED → 3 项 BLOCKER 修复）

网页版 GPT 对 `fe2cde7` 返回 `CHANGES_REQUESTED`，三项 BLOCKER 均已修复并经全量 E2E 复验：

| BLOCKER | 问题 | 修复 |
|---|---|---|
| 1 | daily 跨标签测试允许退化为同词形并假报「不同词形同步通过」 | 删除同词形兜底；改用隔离受控 v3 快照 + 确定性 installSeed + 证据布置（每日计划必含偶数频段「有合法屈折形式」的词），两页分别加载 core 词形与屈折词形、经 popup 真实 `DAILY_TEST_ANSWER` 后同步；证据布置失效或无法构造时直接失败（禁止降级）。复验输出：`daily 同步 PASS：out（core）与 outed（屈折）两页经 popup 真实作答后同步无标注` |
| 2 | 复核矩阵把跨标签同步整体归为 T2/R-KEY，遗漏 daily 链路的 T4/R-DLY-4 责任 | 场景 3 恢复原始 T2/R-KEY 映射；另列「§21 持久化补全」行映射 T2+T4（R-KEY-1/3、R-DLY-4）；T5 仍不持有任何 R-* |
| 3 | 失败路径仅输出 `E2E FAIL` 与异常栈，无「不可进入人工 dogfood」结论与场景/R-ID/责任 Ticket 定位 | 集中失败出口输出「结论：不可进入人工 dogfood」+ 失败场景（FAILURE_TABLE）/主责任 R-ID/责任 Ticket/复现错误，保持非零退出码；不代修产品代码 |

另采纳 NON_BLOCKING 建议：成功结论改为「T5 隔离验收通过；完成 R-MIG-8 真实备份门后可进入人工 dogfood」，避免前置条件后置表述。
修复提交：`e2e-verify.cjs`（176+/89-），未触碰 `extension/src/**`；`npm run typecheck` / `npm test`（267）/ `npm run build` / `npm run test:e2e`（真实 Chrome）四绿。

## 八、二轮复审记录（2026-08-04，CODE 复审 CHANGES_REQUESTED → BLOCKER-3 余项修复 `7667866`）

二轮复审确认 BLOCKER 1（daily 不同词形真路径）、BLOCKER 2（复核矩阵 T2/T4 映射）与成功结论措辞均已落实；剩余 1 项 BLOCKER 为本轮修复：

| BLOCKER 余项 | 问题 | 修复 |
|---|---|---|
| 3 | `currentScenario` 初始为 null，Chrome/dist/词包/OpenSSL 等前置检查失败只输出「失败场景：未知」，缺 R-ID 与责任 Ticket；阶段一统一映射 T5/—，其中场景 3 的 wordKey 屈折词形断言与 R-EVD-1 断言失败会被错误归责 T5 | ① `currentScenario` 初始化为「构建与运行环境」前置场景（T5/—），前置检查失败输出完整归责字段（负向验证：`失败场景：环境 … / 主责任 R-ID：— / 责任 Ticket：T5 / 结论：不可进入人工 dogfood`）；② 阶段一内部按责任归属切换：`1a` 阅读标注基线（T5/—）、`1b` 手动标记与 WordState 持久化（T2 / R-EVD-1）、`1c` 屈折词形共享 wordKey（T2 / R-KEY-1, R-KEY-3, R-EVD-1）；③ 失败出口兜底分支始终打印主责任 R-ID 与责任 Ticket（`currentScenario \|\| FAILURE_TABLE['env']`），保持非零退出码 |

复验：`npm run typecheck` / `npm test`（267）/ `npm run build` / `npm run test:e2e`（真实 Chrome）四绿；manual=academic/academics、daily=out/outed；矩阵与 BLOCKER 1/2 实现保持不变。

## 结论

**T5 隔离验收通过**（六条行为验收全部通过、质量门禁四绿、§21 场景 1~17 + 持久化补全无回归项、复核矩阵主责任归属未改变）；**完成 R-MIG-8 真实备份门后可进入人工 dogfood**（门槛执行由 T6 承接）。
