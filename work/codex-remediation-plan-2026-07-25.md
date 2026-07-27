# Codex 验收反馈修复计划（2026-07-25）

> 对象：`hermes/v0.1-impl` 工作树。已逐条核对 Codex 指出的阻塞，并在代码/数据中复现根因。本计划按 Codex 建议的顺序收口，目标是让 GitHub Issue #1–#4 通过验收；#5（dogfood）与 #3 全量（每日校准+高置信静默）明确 deferred。

## 已核对的根因（均已读码/读数确认，非转述）

1. **#2 规范化契约**：`dict-core.json` 有 **13 个核心词条同时被 forms 重定向到另一个词**（`could→can`、`beginning→begin`、`building→build`、`concerned→concern`、`following→follow`、`growing→grow`、`interested→interest`、`interesting→interest`、`later→late`、`learning→learn`、`meeting→meet`、`thought→think`、`understanding→understand`）。`dictionary.lookup` 先查 forms（`dictionary.ts:38-45`），故 `lookup("could").word === "can"`。但 `quiz.eligibleCandidates(core)`（`quiz.ts:90`）从 `Object.keys(core)` 抽取，包含这 13 个被遮蔽词；`buildInitialTestPlan` 不接收 forms，弹窗 `loadDict()`（`popup.ts:55`）也不加载 forms。结果：计划可能抽到 "could"，页面却标 `data-word="can"`，E2E stage 2 `countWord(data-word="could")` = 0 → 失败。**Codex 根因正确。**
2. **最高策略 seam 未闭合**：`VocabStrategy`（`strategy/index.ts`）仅暴露 `getDisplayDecision/markKnown/markLearning`。`popup.ts:20-22` 直连 `quiz.ts`（`buildInitialTestPlan/buildQuestion/isAnswerCorrect`）与 `audit.ts`（`selectAuditCandidates`）；`worker/index.ts:30-31` 直连 `quiz.ts`（`applyAnswer/INITIAL_TEST_LENGTH`）与 `audit.ts`（`applyAuditAnswer`）。弹窗还自拼 `VocabSnapshot`（`popup.ts:123-132`）并自行选题/判分。**Codex 正确。**
3. **审计消费信任客户端**：`worker/index.ts:216-231` 的 `AUDIT_ANSWER` 直接解构客户端 `planVersion/bucket`，仅检查 `auditMarkers[word]` 是否存在；池 B（高置信未知词）无 marker → 在 `:218` 被拒。**Codex 正确。**（注：V0.1 高置信机制未建，池 B 实际为空，故属前向兼容隐患 + 当前卫生问题。）
4. **#4 SPA 真浏览器 + 性能**：stage 3 代码完整，但 stage 2 失败导致 E2E 未走到 stage 3；性能零埋点（`pageScanner.ts` 无计时）。**Codex 正确。**
5. **ticket 04 文案冲突**：ticket 04 写「高置信不会/边界不确定」，规格 §7/§8 写「单次初测答对词 + 高置信不提示未知词」；代码 `audit.ts:70-76` 符合规格。**只需改 ticket 文案。**

## 修复步骤（按依赖序）

### 步骤 1 — 闭合 #2 规范化契约（最高优先，阻塞 E2E）

**契约定义**：canonical key = `dictionary.lookup(token).word`（解析后的主词条）。状态键、`data-word`、首测候选键三者必须同为 canonical lemma。

**实现（最小改动方案 A）**：
- `popup.ts` `loadDict()`：增加加载 `data/forms.json`，返回 `{ core, forms, bands }`。
- `quiz.ts`：`eligibleCandidates(core, forms)` —— 过滤 `!(forms[w] && forms[w] !== w)`（即 `lookup(w).word === w` 的自洽主词条），排除 13 个被遮蔽词。`buildInitialTestPlan(core, forms, bands, seed, dictVersion)` 透传 forms。
- `scripts/build_ecdict_core.py`：`quiz_eligibility` 计数改用同一自洽过滤规则，使构建报告与运行时一致。
- **不改 E2E selector**（Codex 警告）：契约修好后，计划词均为自洽主词条，`plan.questions[i].word` 与页面 `data-word` 自然一致，stage 2 现有断言通过。
- **回归测试**（`quiz.test.ts` 新增）：断言「对每个 eligible 词 `w`，`lookup(w).word === w`」；并构造一个 forms 遮蔽核心词的 fixture，断言它被排除。

**数据卫生 follow-up（不在 #2 范围，单独标记）**：13 个被遮蔽核心词条本身是数据缺陷（forms 重定向遮蔽了真实词条）。建议后续数据 ticket 决定：要么移除这些 forms 重定向（让词用自己的词条），要么从 core 移除死词条。本轮不改数据，仅记录。

### 步骤 2 — 闭合策略 seam（ticket 01）

**目标**：`popup`/`worker` 不再直连 `quiz.ts`/`audit.ts`，全部经策略模块入口。

**实现**：
- `shared/types.ts`：扩展 `VocabStrategy` 接口，新增 `buildInitialTestPlan / buildQuestion / isAnswerCorrect / applyAnswer / selectAuditCandidates / applyAuditAnswer`（签名沿用现有纯函数）；`INITIAL_TEST_LENGTH` 作为策略常量导出。
- `strategy/index.ts` `createVocabStrategy()`：将上述方法实现委托给 `quiz.ts`/`audit.ts` 的纯函数（这两个文件保留为实现模块，不再被外部直接 import）。
- `popup.ts`：删除 `import ... from './strategy/quiz'` 与 `'./strategy/audit'`；改用 `const strategy = createVocabStrategy()` 调 `strategy.buildInitialTestPlan(...)` / `strategy.selectAuditCandidates(...)` / `strategy.buildQuestion(...)` / `strategy.isAnswerCorrect(...)`。
- `worker/index.ts`：删除 `import { applyAnswer, INITIAL_TEST_LENGTH } from '../strategy/quiz'` 与 `applyAuditAnswer from '../strategy/audit'`；改用 `strategy.applyAnswer(...)` / `strategy.INITIAL_TEST_LENGTH`。**worker 仍不加载词典**（`applyAnswer` 所需 plan 已在快照中；`applyAuditAnswer` 所需 marker/快照已驻留）。
- **seam 测试**（新建 `strategy/seam.test.ts`）：断言 popup/worker 源码不再出现 `from '../strategy/quiz'`/`'../strategy/audit'` 直连（用字符串扫描源文件），且策略模块是唯一入口。

### 步骤 3 — 审计消费服务端校验（ticket 07/08）

**实现**（依赖步骤 2 完成，strategy 拥有 `applyAuditAnswer`）：
- `worker/index.ts` `AUDIT_ANSWER`：不再信任客户端 `planVersion/bucket`。
  - `planVersion` 从 `currentSnapshot.initialTest?.plan?.version` 取权威值；与 marker 存储的 `planVersion` 比对，不符则拒。
  - `bucket` 由 marker 的 `source` 推导（V0.1 仅 `'initial-correct'` → 桶 A）；客户端传入的 bucket 仅作记录、不作准入依据。
  - 池 B（无 marker 的高置信未知词）：V0.1 高置信机制未建（ticket 05 deferred），池 B 恒空。本轮显式 guard：无 marker 一律拒，并在代码注释 + ticket 08 标注「池 B 作答路径随 ticket 05 落地」。
- **测试**（`audit.test.ts` / worker 侧）：构造客户端伪造 planVersion/bucket 的消息，断言被拒；构造合法 marker，断言正常消费。

### 步骤 4 — #4 SPA 真浏览器验收 + 性能基线

- **E2E 联跑**：步骤 1 修好后 stage 2 不再阻塞，本地跑 `npm run test:e2e` 应能走到 stage 3。若本沙箱仍无法启动 Chrome（先前 "Requesting main frame too early"），则把完整三阶段交给带 Chrome for Testing 的环境（Codex/你侧）跑通并回贴日志。
- **性能埋点**（`pageScanner.ts`）：在 `scanDocument`/`processBatch` 加轻量计时累加器（总扫描耗时、单批最大耗时、标注节点数增量），经 `onPerfReport` 回调暴露；`content/index.ts` 接线后通过 `chrome.runtime` 上报或在页面暴露。
- **E2E stage 3 性能断言**：读取 perf 报告，断言总扫描耗时与单批耗时在预算内（具体阈值参照垂直切片规格 §4，先记录基线数值再定阈值）。

### 步骤 5 — ticket 文案修正 + deferred 边界文档

- `.scratch/v0.1-align-spec/issues/04-隐藏词审计桶抽取.md`：文案改为对齐规格 §7/§8（「单次初测答对词 + 高置信不提示未知词」）。
- `work/to-tickets-2026-07-25.md`：显式标注 tickets 03/04/05/06（#3 全量：画像后验/隐藏词桶/Wilson 高置信/每日校准）与 10（#5 dogfood）为 **deferred，本轮不实施**，并写明依赖与前置条件。

## 验证

- `npm run typecheck`、`npm test`（新增自洽候选回归 + seam 测试 + 审计校验测试）、`npm run build` 全绿。
- `npm run test:e2e` 三阶段（#1/#2/#4）通过；若本地 Chrome 不可用，明确标注并交由带浏览器环境复跑。
- 不 commit/push/建 Issue/PR（无授权）。

## 范围边界（明确不做）

- #3 全量（tickets 03/04/05/06：每日校准、画像后验、Wilson 高置信、隐藏词桶抽取）—— deferred。
- #5 dogfood 整体验收（ticket 10）—— deferred，依赖 #3 全量。
- 13 个被遮蔽核心词条的数据清洗 —— 单独 follow-up，不在本轮。
- 不改 `RULES.md`/`CONTEXT.md`/ADR/规格。
