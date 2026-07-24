# Issue #2 交接报告 —— 固定 50 题首测与词汇状态

- **分支**：`hermes/v0.1-impl`
- **基线提交**：`a9edfce`（#1 完成）
- **本任务提交**：见文末 SHA
- **上游仓库**：`FlapPearLabs/adaptive-vocab-reader`（原 `panglihaoshuai` 已迁移，远程已更新）
- **阻塞项 #1**：已完成并验收（见 `issue-1-hermes-handoff.md`）

## 1. 需求来源

- **GitHub Issue #2**：`V0.1：固定 50 题首次测评与词汇状态`（label: `ready-for-agent`）
- **本地规格**：
  - `docs/specs/2026-07-22-V0.1-掌握预测与主动校准规格.md` §4 初测
  - `docs/specs/2026-07-22-V0.1-1000词垂直切片实施规格.md` §2、§6（首测/校准/选项生成）
- **最高测试 seam**：策略模块（词汇展示与测试策略），所有出题与作答状态迁移均经此 seam。

## 2. 实现内容

### 2.1 类型层（`extension/src/shared/types.ts`）
按 Matt Pocock TypeScript 最佳实践重构：
- **泛型 `StateChange<S extends WordStateSource>`**：手动与首测变更在类型上可区分（`StateChange<'manual'>` vs `StateChange<'initial'>`）。
- **条件类型应用**：
  - `IsCommittal<A extends QuizAnswer>`：`'unsure'` → `false`，其余 → `true`
  - `StatusFromCorrectness<C extends boolean>`：`true` → `'known'`，`false` → `'learning'`（在 `applyAnswer` 中经 `statusFromCorrectness()` 返回条件类型）
  - `AuditForOutcome<K>`：预留给结果判别联合的审计字段类型推导
- **判别联合**：
  - `QuizAnswer = {kind:'option'; optionIndex} | {kind:'unsure'}`
  - `ApplyAnswerResult`：四分支（`correct` / `wrong` / `unsure` / `priority-preserved`），每分支 `change`/`audit` 字段类型精确约束
- 新增 `QuizOption` / `QuizQuestion` / `InitialTestPlan` / `InitialTestState` / `AuditMarker`
- `VocabSnapshot` 增加 `auditMarkers` 与 `initialTest`（均不含 URL/正文/句子）

### 2.2 策略模块出题与作答（`extension/src/strategy/quiz.ts`，新建）
- **确定性 RNG**：`xmur3` 哈希种子 + `mulberry32`，由 `安装种子 + 盐` 派生，可复现。
- **候选淘汰** `eligibleCandidates`：仅保留「能生成四个互异中文选项」的词（全局互异翻译数 ≥ 4）；无法满足条件的词不进入候选池（规格要求）。
- **冻结计划** `buildInitialTestPlan`：十频段各五题；每题 1 正确 + 3 其他主词条干扰项，四选项顺序由种子确定性排列；`不确定` 恒为第 5 项（下标 4）；计划版本 = `dictVersion:seed:题目哈希`，自身不含时间戳 → 同种子完全可复现。
- **作答迁移** `applyAnswer`：答对 → `known` + 待审计标记；答错/不确定 → `learning`（进入活跃生词表）；**页面手动状态优先**（当前为 `manual` 来源则保留，不产生变更）。

### 2.3 存储与协调器
- `storage.ts`：`mergeStateChange` 增加 `source` 参数；新增 `addAuditMarker` / `clearAuditMarker` / `setInitialTest` / `getActiveWords`；`createEmptySnapshot` 初始化 `auditMarkers` 与 `initialTest`。
- `worker/index.ts`（Service Worker 不读词典）：新增消息 `GET_PROFILE` / `INITIAL_TEST_START` / `GET_INITIAL_TEST` / `INITIAL_TEST_ANSWER` / `INITIAL_TEST_RESET`；作答经策略模块计算后 `{source:'initial'}` 持久化并广播到已开页面。

### 2.4 弹窗 UI（首测唯一入口）
- `extension/popup.html` / `popup.css` / `src/popup.ts`（新建），`manifest.json` 增加 `action.default_popup`。
- 弹窗加载静态词典 → 向 worker 取 `installSeed`/`dictVersion` → 经策略模块构建冻结计划 → 渲染 50 题 → 提交作答 → 显示结果（可重测）。
- `build.mjs` 增加 popup 构建入口，复制 `popup.html`/`popup.css`。

## 3. 验证证据（全部真实运行）

| 验证 | 命令 | 结果 |
|------|------|------|
| 类型检查 | `npx tsc --noEmit` | **pass**（0 错误，`strict` + `noUncheckedIndexedAccess`） |
| 单元测试 | `npx vitest run` | **84 tests pass**（新增 `quiz.test.ts` 13 项：配额、淘汰、冻结、状态迁移、手动优先、选项互异） |
| 构建 | `node build.mjs` | **dist/ 生成**（content.js + worker.js + popup.js + popup.html + popup.css + 1000 词数据） |
| 数据构建确定性 | `python -m unittest tests.test_build_ecdict_core` | **6 tests pass** |
| 浏览器 E2E | `node e2e-verify.cjs`（Chrome for Testing 151） | **#1 + #2 PASS**：50 题、25 known / 25 learning / 25 audit、计划冻结、页面更新（答对词无提示、答错词强提示）、重开恢复、快照无页面信息 |

## 4. 需求-测试矩阵（Issue #2 验收点）

| 验收点 | 覆盖方式 |
|--------|----------|
| 弹窗主动开始、只能完成整套 50 题，不在正文中弹 | popup 入口 + E2E 弹窗流程；正文标注与弹窗隔离 |
| 固定种子+快照：十频段各五题、四互异选项、排列可复现；不同种子不同计划 | `quiz.test.ts` 配额/冻结测试 + E2E `plan_frozen` |
| 正确→会+审计标记；错误/不确定→不会+活跃生词表；未测→未知 | `quiz.test.ts` 状态迁移 + E2E `known=25/learning=25/audit=25` |
| 初测后已开页面：答对词停提示、答错/不确定词强提示 | E2E `page_updated=true`（plan-words 页验证） |
| 重复提交/重启/刷新不产生重复或丢失 | E2E `reopen_recovered`（重开弹窗恢复已完成态） |
| 策略模块测试覆盖十频段配额、无效候选淘汰、计划冻结、正确/错误/不确定迁移、页面手动优先 | `quiz.test.ts` 全部覆盖 |
| 隐私：不含 URL/正文/句子 | `storage.test.ts` 隐私边界 + E2E 快照断言 |

## 5. 残余风险与未验证项

1. **多标签页同步**：作答广播到所有标签页的逻辑已实现（同 #1 机制），但 E2E 仅验证单一已开页面；多标签并发未单独验证。
2. **SPA 动态插入**：属 #4 范围，未在本任务验证。
3. **审计标记生命周期清理**：`clearAuditMarker` 已实现（状态版本变化/手动覆盖时清理的钩子预留），但审计候选选择/随机核验属 #3 范围，未实现。
4. **`statusVersion` 取值**：当前使用 `snapshot.schemaVersion`（=1）作为审计标记绑定的状态版本；#3 引入画像版本后需对齐。
5. **候选淘汰的构建报告计数**：`eligibleCandidates` 在运行时筛选候选池；规格要求「构建报告必须计数」被淘汰词——当前运行期筛选未回写构建报告（构建报告由 Python 构建脚本生成，与运行期首测候选池是两层）。如需严格计数，应在构建脚本侧增加「无法生成 4 选项的主词条」统计。

## 6. 提交与远程

- 提交于 `hermes/v0.1-impl`，**未合并、未关闭 Issue #2**。
- 远程已更新为 `FlapPearLabs/adaptive-vocab-reader`（原 `panglihaoshuai` 仓库迁移）。
- 未创建 PR（按授权仅推送分支）。
- 内部 agent 记忆（`.workbuddy/`）未纳入提交。
