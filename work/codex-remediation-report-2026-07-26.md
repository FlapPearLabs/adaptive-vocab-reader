# Codex 验收反馈修复报告（2026-07-26）

> 分支 `hermes/v0.1-impl` 工作树。按用户受限范围指令实施：闭合 #1/#2 当前验收阻塞；#3 仅审计 07/08 安全收口（仍部分实现）；#4 仅真实浏览器 SPA + 性能基线；#3 画像/Beta-PAV/Wilson/每日校准与 #5 dogfood 保持 deferred，未伪装为已完成。

## 一、实际修改文件

**已跟踪（M，13 个）：**
- `extension/src/shared/types.ts` — VocabStrategy 深接口（7 领域动作）+ AuditPlan/AuditPlanCandidate/SettleAuditResult/Freeze*/Settle* 输入输出类型 + VocabSnapshot 增 `auditPlan` + INITIAL_TEST_LENGTH 常量
- `extension/src/strategy/quiz.ts` — `eligibleCandidates(core, forms)` + `isShadowedCoreKey` + `buildInitialTestPlan(core, forms, ...)` 排除 forms 遮蔽词；标为内部实现模块
- `extension/src/strategy/index.ts` — `createVocabStrategy()` facade，4 个冻结/结算领域动作委托 quiz.ts/audit.ts（非浅转发）
- `extension/src/strategy/quiz.test.ts` — 传 forms + 自洽契约回归（2 新测试）
- `extension/src/popup.ts` — 改用 strategy facade；loadDict 加 forms.json；审计改冻结 AuditPlan 流程
- `extension/src/worker/index.ts` — 改用 strategy facade；新消息 FREEZE_AUDIT_PLAN/GET_AUDIT_PLAN/AUDIT_ANSWER(新形状)/CLEAR_AUDIT_PLAN；AUDIT_ANSWER 服务端权威校验
- `extension/src/worker/storage.ts` — createEmptySnapshot 增 auditPlan；setAuditPlan
- `extension/src/worker/storage.test.ts` — topKeys 加 auditPlan
- `extension/src/content/pageScanner.ts` — 非持久化性能观测 PerfReport + onPerfReport + getPerfReport
- `extension/src/content/index.ts` — 接线 onPerfReport → documentElement.dataset.avrPerf
- `extension/src/content/annotator.ts` / `annotator.test.ts` — 无功能变更（仅上下文）
- `scripts/build_ecdict_core.py` — quiz_eligibility 增自洽过滤 + shadowed_core_keys 字段
- `e2e-verify.cjs` — stage3 增 code/form/comment 跳过 + perf 基线；弹窗作答改 popup.evaluate 点击

**新建（??，8 个）：**
- `extension/src/strategy/audit.ts` — freezeAuditPlan + settleAuditAnswer（重写）
- `extension/src/strategy/audit.test.ts` — 9 测试（重写，测新函数）
- `extension/src/strategy/seam.test.ts` — 6 测试（seam 行为）
- `extension/src/worker/auditValidation.ts` — validateAuditAnswerRequest 纯函数
- `extension/src/worker/auditValidation.test.ts` — 6 测试（服务端校验）
- `extension/src/content/pageScanner.ts` / `spa.test.ts`（前轮新建，本轮加 perf）
- `work/codex-remediation-plan-2026-07-25.md` / `codex-remediation-report-2026-07-26.md`

**数据重建：** `dist/data/build-report.json` + `data/derived/ecdict-core-1000/build-report.json`（core/forms/bands 字节一致；quiz_eligibility ineligible_count 0→13，新增 shadowed_core_keys）。

**文档边界：** `.scratch/v0.1-align-spec/issues/04-隐藏词审计桶抽取.md`（文案校正）；`work/to-tickets-2026-07-25.md`（Deferred 边界表）。

## 二、每条需求 → 测试 → 代码映射

| 需求 | 测试 | 代码 |
|---|---|---|
| 1. canonical key=lookup(token).word；排除 forms 遮蔽词 | `quiz.test.ts`「excludes core keys shadowed by forms」+ 自洽断言 | `quiz.ts: isShadowedCoreKey` + `eligibleCandidates(core, forms)` |
| 1. 构建脚本同规则 | `tests/test_build_ecdict_core.py`（8 passed） | `build_ecdict_core.py: quiz_eligibility` + shadowed_core_keys |
| 1. 不改 E2E selector | E2E stage2 `data-word="${word}"` 不变，word0="when" 自洽标注通过 | （未改 selector） |
| 2. 深接口非浅转发（4 领域动作） | `seam.test.ts`「暴露且仅暴露 7 个领域动作」+ 冻结/结算行为 | `strategy/index.ts: createVocabStrategy` 委托 quiz/audit |
| 2. 外部不直连 quiz.ts/audit.ts | `seam.test.ts` 行为断言（非源码扫描） | popup/worker/content/storage 全部经 strategy facade |
| 3. 审计计划作答前冻结持久化 | `audit.test.ts` freezeAuditPlan（候选+题目+results） | `audit.ts: freezeAuditPlan` + snapshot.auditPlan |
| 3. AUDIT_ANSWER 不信任客户端 | `auditValidation.test.ts` 伪造 version/越界/重复/无 marker/无计划 | `auditValidation.ts: validateAuditAnswerRequest` |
| 3. 合法 marker 结算 | `auditValidation.test.ts`「合法 marker 结算→通过」+ `audit.test.ts` settle verified/failed | `audit.ts: settleAuditAnswer` + worker AUDIT_ANSWER |
| 4. 性能观测非持久化无网页内容 | E2E stage3 读 dataset.avrPerf（仅数字） | `pageScanner.ts: PerfReport` + `content/index.ts: dataset.avrPerf` |
| 4. 真实浏览器 stage1/2/3 全跑 | E2E ALL PASS | （e2e-verify.cjs） |
| 4. SPA code/form/comment/nav 跳过 | E2E stage3 skipHits 断言 | `scanner.ts: isContentNode`（既有）+ fixture |
| 4. 先记真实基线不捏阈值 | E2E 输出 perf_baseline={totalScanMs:1.5,maxBatchMs:0.7,annotatedNodes:37,batches:21} | （无阈值断言，仅记录） |
| 5. ticket 04 文案对齐规格 | （文档） | `.scratch/issues/04` 改为「单次初测答对词+高置信不提示未知词」 |
| 5. 03/04/05/06/10 deferred | （文档） | `work/to-tickets-2026-07-25.md` Deferred 边界表 |

## 三、验证结果（真实运行）

- **typecheck** `npx tsc --noEmit`：**PASS**（exit 0，无错误）
- **单测** `npx vitest run`：**117 passed / 10 文件**（seam 6 + audit 9 + auditValidation 6 + spa 4 + quiz 14 + storage 17 + annotator 17 + scanner 21 + dictionary 11 + index 12）
- **构建** `node build.mjs`：**成功**（dist/ 可加载 MV3 扩展）
- **Python 构建** `python3 -m unittest tests.test_build_ecdict_core`：**8 passed**
- **真实 Chrome E2E** `npm run test:e2e`：**三阶段 ALL PASS**（Chrome for Testing 151，headless=new）
  - `E2E #1 PASS: annotations=74, unknown=74, challenge_first=1, challenge_repeats=8, local_snapshot=minimal`
  - `E2E #2 PASS: questions=50, known=25, learning=25, audit=25, plan_frozen=true, page_updated=true, multitab_synced=true, reopen_recovered=true`（word0="when" 自洽主词条正确标注）
  - `E2E #3 PASS: intro=9, feed=8, view=9, nav_skipped=true, code/form/comment_skipped=true, perf_baseline={"totalScanMs":1.5,"maxBatchMs":0.7,"annotatedNodes":37,"batches":21}`
  - `E2E ALL PASS`

**关键日志**：stage2 多标签前置 `beforeA/beforeB for when = 1 1`（#2 规范化契约在真实浏览器验证：计划词=页面 data-word）；stage3 性能基线首次记录。

## 四、未验证项与残余风险

- **#3 全量未实现（deferred）**：画像后验(03)/隐藏词审计桶(04)/Wilson 高置信(05)/每日校准(06) 仍为 ticket 草案，本轮未触及代码。池 B（高置信未知词）审计路径 V0.1 恒空，worker 显式拒绝无 marker 候选。
- **#5 dogfood 未实现（deferred）**：ticket 10，依赖 05/06/08/09 闭合。
- **ticket 01/02 部分实现**：seam 已收口为深接口（01），但快照补全(02)仅加 auditLog/auditPlan，未加 rounds/bandEvidence/auditStats（属 #3 全量依赖）。
- **13 个 forms 遮蔽 core 词条（数据卫生）**：本轮仅从首测候选排除，未清洗数据（forms 重定向遮蔽真实词条）。建议后续数据 ticket 决定移除重定向或移除死词条。
- **性能阈值未设**：按规格「先记录真实基线，不预设性能数值」，仅记录 totalScanMs=1.5 等基线，未设断言阈值。
- **E2E 弹窗点击稳健性**：puppeteer-core+Chrome151 ElementHandle.click 在扩展弹窗页协议超时，已改 popup.evaluate 点击（非掩盖 #2 selector，是 click 机制）。其他环境若复现可沿用此法。

## 五、#1-#4 验收建议

| Issue | 建议 | 依据 |
|---|---|---|
| #1 本地阅读闭环 | **接受** | E2E stage1 真浏览器 PASS（标注/跳过/持久化/隐私） |
| #2 固定 50 题首测 | **接受** | 规范化契约闭合（排除 13 遮蔽词）+ stage2 真浏览器 PASS + 自洽回归测试 |
| #3 每日校准与高置信静默 | **部分接受** | 07/08 审计服务端权威校验完成（冻结 AuditPlan + validateAuditAnswerRequest + 6 测试）；03-06 deferred |
| #4 动态页面适配 | **接受** | stage3 真浏览器 PASS + 性能基线 + code/form/comment/nav 跳过证据 |

## 六、未执行的操作（明确声明）

未执行：commit、push、创建 Issue/PR、部署、修改远端配置、修改 `RULES.md`/`CONTEXT.md`/ADR/规格。所有改动仅在 `hermes/v0.1-impl` 工作树（含已推送的 `2dd3f6e`）。未 reset/restore/clean/stash/切分支。使用 Edit 工具编辑文件（非 apply_patch，因环境无 apply_patch；等价手工编辑）。
