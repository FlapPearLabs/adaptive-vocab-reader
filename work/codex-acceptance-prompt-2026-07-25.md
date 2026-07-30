# 交给 Codex 的完整验收提示词（V0.1：GitHub Issue #1–#5 + 全部 .scratch ticket 01–10）

> 整段复制到 Codex 会话即可。要求 Codex **完整 review 整个 `hermes/v0.1-impl` 工作树 + 自 `codex/v0.1-browser-dogfood`（基线 `4c891b9`）以来的全部提交**，对照三份规格与十张 ticket，逐项给出「已实现 / 部分实现 / 未实现」结论与证据。

---

## 一、背景与范围

- **仓库**：`FlapPearLabs/adaptive-vocab-reader`
- **分支**：`hermes/v0.1-impl`（含一个已推送的 HEAD `2dd3f6e`；本轮新增改动在**工作树，尚未 commit/push**）
- **基线**：`codex/v0.1-browser-dogfood` @ `4c891b9`
- **对齐规格（三份，均在 `docs/specs/`）**：
  1. `2026-07-22-V0.1-范围重置与实施目标.md`（范围与边界）
  2. `2026-07-22-V0.1-1000词垂直切片实施规格.md`（页面扫描/标注/交互、SPA 动态插入 §4、浏览器闭环验收）
  3. `2026-07-22-V0.1-掌握预测与主动校准规格.md`（Spec B：词汇状态、首测、审计标记生命周期 §8、每日校准、高置信静默）
- **拆解 ticket（10 张，本地 `.scratch/v0.1-align-spec/issues/`，依赖序 01–10）**：导航见 `work/to-tickets-2026-07-25.md`。这些是 to-tickets 草案，**仅本地、未发布 GitHub**（无远端写入授权）。
- **GitHub Issue 映射**：#1 本地阅读闭环 / #2 固定 50 题首测 / #3 每日校准和高置信静默 / #4 动态页面适配 / #5 浏览器 dogfood 验收。

> 注意：本轮实际动机是「修此前 #2 review 暴露的残余风险 + 收口 #3 审计选题/消费与 #4 SPA」，但既然已经做了大量内容（#1、#2 已 committed，#3 审计子项、#4 SPA 本轮完成），请你**不要只盯残余风险**，而是把 #1–#4 与全部 ticket 通读一遍，确认整体实现与规格的一致性。

## 二、GitHub Issue → ticket 实现状态（请你逐项核对并修正）

| GitHub Issue | 主题 | 对应 ticket | 当前判定（待你核实） | 证据 |
|---|---|---|---|---|
| #1 | 本地阅读闭环 | （垂直切片规格主路径） | **已实现并已 commit** | `b208265` `a9edfce` `afd2f71`；E2E stage 1 |
| #2 | 固定 50 题首测 | （Spec B 首测 + 审计标记） | **已实现并已 commit** | `44c5bd6` `2dd3f6e`（含第二轮残余修复：planVersion 绑定、清理钩子、构建报告计数、多标签同步）；E2E stage 2 |
| #3 | 每日校准 + 高置信静默 | 03/04/05/06/07/08 | **部分实现**：审计选题/消费（07/08）本轮完成；每日校准(06)、画像后验(03)、隐藏词审计桶(04)、高置信不提示(05) **尚未在代码中** | `strategy/audit.ts`（07/08）；`grep` 无 `profileWord`/`buildDailyPlan`/`missingRate`/`no-prompt`/`rounds`/`bandEvidence` |
| #4 | 动态页面适配（SPA） | 09 | **本轮实现（工作树）** | `content/pageScanner.ts` + `content/spa.test.ts` + `e2e-verify.cjs` stage 3 |
| #5 | 浏览器 dogfood 验收 | 10 | **未实现**（属验收/文档 ticket，需先闭合 #3 全量 + #4） | 无对应代码 |

> 关键边界：**#3 的「每日校准轮 + 高置信静默」整块（ticket 03/04/05/06）是有意 deferred 到后续迭代**，本轮只闭合了审计选题/消费（07/08）。请在结论里明确：这些 deferred 项属于「范围内但未排期」还是「存在规格与实现的缺口」，并给出补齐清单。**不要**把它们伪装成已确认完成。

## 三、本轮工作树改动文件清单（自 `2dd3f6e` 起的未提交改动 + 新建文件）

> 用 `git diff 2dd3f6e` 与 `git status --porcelain` 可完整查看。

**策略层（最高测试 seam，纯函数）：**
- `extension/src/strategy/audit.ts`（**新建**）：`selectAuditCandidates(snapshot, bands, seed, planVersion, count, {highConfidenceWords?, round?})` 与 `applyAuditAnswer(word, outcome, _current, planVersion, bucket)`。池 A=单次初测答对且仍 `known` 的待审计标记；池 B=高置信未知词（V0.1 高置信机制未建，通常空）；两类交替抽取、各频段覆盖不足优先、段内按 `hashString("种子::审计::planVersion::轮次::词")` 稳定排序；同 `(seed,planVersion,round)` 可复现。答对保持「会」+ `verified` 事件；答错/不确定转「不会」+ `failed` 事件并清标记。
- `extension/src/strategy/audit.test.ts`（**新建**，9 测试）
- `extension/src/strategy/quiz.ts`：导出 `hashString`（审计稳定排序复用）

**类型与存储：**
- `extension/src/shared/types.ts`：`WordStateSource` 增 `'audit'`；新增 `AuditBucket / AuditCandidate / AuditOutcome / AuditEvent`；`VocabSnapshot` 增 `auditLog`。**注意：ticket 02 要求的 `rounds/bandEvidence/auditStats` 尚未加**。
- `extension/src/worker/storage.ts`：`createEmptySnapshot` 加 `auditLog: []`；新增 `recordAuditEvent`（不可变追加）。
- `extension/src/worker/index.ts`：新增消息 `GET_AUDIT_MARKERS`、`AUDIT_ANSWER`；`loadSnapshot` 向前迁移 `auditMarkers`/`auditLog`。`AUDIT_ANSWER` 流程：校验待审计标记 → `applyAuditAnswer` → `mergeStateChange('audit')` → `clearAuditMarker` → `recordAuditEvent` → 持久化 → 广播。**注意：worker 仍直接 `import { applyAnswer, INITIAL_TEST_LENGTH } from '../strategy/quiz'`，ticket 01 的「统一经 VocabStrategy」未完全闭合。**

**UI 与内容脚本：**
- `extension/src/popup.ts`：初测完成后若 `pendingAudit > 0` 显示「开始审计（N 题）」；`startAudit()` 构造 `VocabSnapshot` 调 `selectAuditCandidates(...,20)` 并渲染/提交审计题（`renderAuditQuestions`/`auditSubmit`→`AUDIT_ANSWER`/`renderAuditSummary`）；`renderQuestion` 新增 `mode:'initial'|'audit'`。
- `extension/src/content/pageScanner.ts`（**新建**）：从 `content/index.ts` 抽出 `createPageScanner` 工厂（`scanDocument` / `processTextNode` / `applyWordDisplay` / `observeDynamic` / `setState` / `applyRemoteChange`）。`content/index.ts` 改为消费该工厂，逻辑等价（**并行修复 code-review HARD#1**：增量路径不再重算 `showInlineTranslation`）。
- `extension/src/content/annotator.ts` / `annotator.test.ts`：配合 `updateWordDisplay` 直接消费展示字段的小幅调整 + 测试。
- `extension/src/content/spa.test.ts`（**新建**，4 测试，happy-dom 可直接运行）
- `tests/fixtures/spa-page.html`（**新建**）：SPA fixture（nav 跳过 / #intro 初始 / #feed 无限滚动追加 / #view 路由切换 / 两个 JS 按钮）
- `e2e-verify.cjs`：新增 `/spa-page.html` 路由、stage 3（SPA 动态插入）、`gotoSafe` 重试、`--headless=new`

## 四、验证证据（沙箱内真实运行）

- `npx tsc --noEmit`：**PASS**（strict + noUncheckedIndexedAccess）
- `npx vitest run`：**104 passed**（8 文件；含 audit 9 + spa 4）
- `node build.mjs`：**成功**（产物 `dist/`）

**沙箱边界（无法在此环境验证，需你在带显示器的环境确认）：**
- E2E（`node e2e-verify.cjs`）stage 1/2/3 代码完整，但本沙箱无显示器、Chrome 主帧不初始化，无法运行。请在真实 Chrome for Testing 环境跑通三阶段：
  - stage 1：#1 阅读闭环（正文标注、跳过 code/comment/nav、刷新持久化）
  - stage 2：#2 首测弹窗 + 多标签状态同步
  - stage 3：#4 SPA 动态插入（见下）
- happy-dom 的 `spa.test.ts` 已覆盖四项不变量，可作快速回归；但其 `MutationObserver` 行为不如真实浏览器完整，**不能替代 stage 3 的真浏览器验证**。

## 五、请 Codex 完整验收（步骤）

1. **复跑并确认**上述命令（`tsc` / `vitest` / `build`）通过；在真实浏览器环境跑通 `e2e-verify.cjs` 三阶段。
2. **逐 GitHub Issue 核对**（对照三份规格）：
   - **#1 本地阅读闭环**：正文标注、非正文区跳过、刷新持久化、单批主线程耗时 —— 是否符合垂直切片规格主路径与「浏览器闭环验收」？
   - **#2 固定 50 题首测**：50 题确定性出题、作答经 seam 应用、状态变更与审计标记生成、`auditMarkers` 的 `planVersion` 绑定与陈旧清理、多标签同步 —— 是否符合 Spec B 首测章节？
   - **#3 审计子项（07/08，本轮）**：审计选题是否确实两类交替 + 频段覆盖优先 + 稳定可复现？作答消费是否答对保持「会」/ 答错·不确定转「不会」并清标记 + `auditLog` 记录？是否符合 Spec B §8？**明确标注 03/04/05/06 尚未实现。**
   - **#4 SPA（09，本轮）**：增量标注、不退化成全页重扫、nav 跳过、路由切换 innerHTML 重写被标注 —— 是否符合垂直切片 §4？stage 3 真浏览器需通过。
   - **#5**：确认无对应实现，且属于 ticket 10 的待办验收范围。
3. **逐 ticket 核对（01–10）**：对每个 ticket，判断「已实现 / 部分实现 / 未实现」；对未实现项，判定是**有意 deferred（范围内未排期）**还是**规格-实现缺口**；给出补齐该 ticket 所需的最小改动清单与依赖。
4. **规格条款级核对**：
   - Spec B §8 审计标记生命周期（候选选择、消费、清理、随机核验）
   - 垂直切片 §4 页面扫描/标注/交互适配器 + SPA 动态插入
   - 隐私边界：快照是否仍不含 URL/正文/句子（`grep` 确认 `chrome.storage` 写入内容）
   - 性能预算：长文扫描耗时、单批主线程耗时、DOM 增量、布局影响（如有埋点数据请核对）
5. **code review 比较基点**：`hermes/v0.1-impl` 工作树 + 全部提交相对 `codex/v0.1-browser-dogfood`（`4c891b9`）。重点复查：ticket 01 的 seam 统一是否真闭合（worker 仍直连 `quiz.ts`？）、ticket 02 的快照字段是否应补、`auditLog` 是否被 `auditLog` 消费方正确使用。
6. **结论格式**：对每个 GitHub Issue 给 `接受 / 部分接受 / 拒绝`；对每张 ticket 给 `已实现 / 部分 / 未实现`；列出残余风险、未验证部分、闭合 #3 全量与 #5 的下一步；明确指出任何把「建议/草案/未实现项」伪装成已确认事实的地方。

## 六、明确未做的操作（无需你处理，仅告知）

- 未 commit / push / 建 Issue / 建 PR / 部署。所有改动仅在工作树 + 已推送的 `2dd3f6e`。
- `RULES.md` / `CONTEXT.md` / ADR 本轮未改动。
- #3 全量（03/04/05/06）与 #5（10）属后续 to-tickets，本轮未触及代码。
- 不要伪造任何 verification 结果；E2E 若在你的环境跑不通，请如实报失败与日志。
