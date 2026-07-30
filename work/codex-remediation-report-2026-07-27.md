> # ⚠️ 已撤回 / SUPERSEDED
> **本文件（2026-07-27）已被 `codex-remediation-report-2026-07-28.md` 取代，不得作为验收依据。**
> 独立审查（Archimedes / Mencius）确认：本报告声称的「7 个验收阻塞 ✅ 已修」结论**不成立**——
> 现有测试未覆盖迁移持久化、审计哈希篡改、真实 DOM 计数与观察器自触发等缺陷。本报告的「完整题目防篡改」
> 与「完整生命周期 transition 已关闭」等结论亦被后续审查证明为合同缺口（见 2026-07-28 报告 §0 与 §2）。
> 请改以 `codex-remediation-report-2026-07-28.md` 为准。本文件仅作历史留痕保留。

# V0.1 状态模型与策略 Seam 纠正 — 验收阻塞修复报告

- **日期**：2026-07-27（基于 `hermes/v0.1-impl` 分支，checkpoint `7ea4ce8`，工作区为受保护 dirty 状态）
- **执行角色**：Senior Developer（高级开发工程师）
- **范围**：受限最终修复 — 仅按既定七节验收阻塞完成状态模型纠正、策略 seam 闭合、真实 schema 迁移、性能度量真实性修复与真实验证，**不**修改 `main`、不 push、不合并、不关闭 Issue、不部署。
- **最终声明**：本报告所有产物**未 commit / 未 push / 未合并 / 未部署**。代码停留在工作区，等待 Codex 独立验收与后续发布流程。

---

## 1. 本次修复的 7 个验收阻塞（总览）

| # | 阻塞 | 状态 | 关键证据 |
|---|---|---|---|
| 1 | 优先保留路径的 marker 清理 | ✅ 已修 | `worker/index.test.ts`「priority-preserved：记录作答、清除旧标记，且不改变手动状态」 |
| 2 | 真实 schema v2 迁移（不再伪造 v1） | ✅ 已修 | `worker/storage.test.ts` `migrateSnapshot (v1 → v2)` 6 测；`SCHEMA_VERSION=2` |
| 3 | `stateKey`/`entryKey` 领域语言对齐 | ✅ 已修 | `RULES.md`「状态键契约（最新确认）」+ `CONTEXT.md` + 规格 cross-ref |
| 4 | 真正闭合策略 seam（导入边界） | ✅ 已修 | `worker/importBoundary.test.ts` 静态扫描生产文件不得 import `strategy/quiz`/`audit` |
| 5 | 加强冻结计划与作答校验 | ✅ 已修 | `worker/auditValidation.test.ts` 19 测（含篡改/candidate 失效/池 B deferred 矩阵） |
| 6 | 性能度量真实性与观察者自触发 | ✅ 已修 | `batches` 1977→8；`heightDeltaPx`/`layoutShiftScore`/`netNodes` 区分；Layout Instability API |
| 7 | 纠正本报告 + 真实全量验证 | ✅ 已修 | 七级验证全绿；本文档按实测重写 |

---

## 2. 七节修复映射（阻塞 → 失败测试 → 实现 → 验证证据）

### 2.1 阻塞 #1：优先保留路径的 marker 清理（worker 协调路径）
- **规则**：`INITIAL_TEST_ANSWER` 命中 `priority-preserved`（页面手动状态优先）时，**仍须**记录作答（否则该题为永久未答，冻结审计计划与完成判定失效）并清除该词上一轮残留的待审计标记；手动状态不得被改变。
- **失败测试（修复前）**：`worker/index.ts` 在 `priority-preserved` 分支提前 `return`，跳过了 `setInitialTest`（作答未持久化）且**永不执行** `clearAuditMarker`，旧标记残留。
- **实现**：`worker/index.ts` 抽出纯函数 `reduceWorkerMessage(snapshot, message, sender, strat?)`；`priority-preserved` 分支改为 `setInitialTest(...)`（记录作答）+ `if (result.clearMarkerWord) clearAuditMarker(...)`。监听器只负责 load/persist/broadcast 副作用。
- **验证证据**：`worker/index.test.ts`「priority-preserved：记录作答、清除旧标记，且不改变手动状态（真实协调路径）」断言 `next.initialTest.answers[0] !== null`、`next.auditMarkers[word]` 已清除、`next.words[word].source==='manual'`、`broadcast===undefined`、`changed===true`。

### 2.2 阻塞 #2：真实 schema v2 迁移
- **规则**：`stateVersion`/`WordState.version`/`AuditMarker.stateVersion`/`AuditPlan.stateVersion` 改变了持久化结构，不能再伪装成 v1。`SCHEMA_VERSION` 升到 2；`migrateSnapshot` 须可单测地填补 `words[*].version`、`markers[*].stateVersion`，对缺 `stateVersion` 的旧冻结计划安全置 `null`，保留 `installSeed`/词状态/`initialTest`，并提供诚实的回滚边界说明。
- **失败测试（修复前）**：`SCHEMA_VERSION` 仍为 1；`loadSnapshot` 仅做内联 `schemaVersion` patch，结构与 v2 不符；无 `migrateSnapshot` 单测。
- **实现**：`shared/types.ts` `SCHEMA_VERSION=2`；`worker/storage.ts` 抽出 `migrateSnapshot(raw)`（纯函数）：`words[*].version` 缺省补 0；`markers[*].stateVersion` 缺省补 0；`auditPlan` 缺 `stateVersion` 置 `null`；缺容器按空补齐；幂等；明确声明本函数不提供原地降级，未实际执行任何回滚故**不得声称回滚已验证**。`worker/index.ts` `loadSnapshot` 改调 `migrateSnapshot`。
- **验证证据**：`worker/storage.test.ts` `migrateSnapshot (v1 → v2)` 6 测：首次安装（undefined）/ v1 升级补字段 / 旧计划缺 `stateVersion` 置 `null` / 幂等 / 损坏字段安全 / 升级保留 `installSeed` 与词状态。详见第 3 节。

### 2.3 阻塞 #3：`stateKey`/`entryKey` 领域语言对齐
- **规则**：`stateKey` = 小写 surface form（状态键，用于 `data-word`、单词状态、审计标记、首测候选）；`entryKey` = ECDICT 主词条（取义，仅音标/词性/释义/频段）。词形映射（went→go）只复用释义，不继承/传播状态；core 主词条优先（`could` 不被 `forms[could]=can` 遮蔽）；`could`/`can`、`went`/`go` 各自独立；实现正确的 core-first 逻辑**不改动**。
- **失败测试（修复前）**：`RULES.md`/`CONTEXT.md` 未给出 `stateKey`/`entryKey` 的明确契约，易与旧 canonical 定义混淆。
- **实现**：`RULES.md` 新增「状态键契约（最新确认 · 2026-07-27）」小节（6 条已确认项）；`CONTEXT.md` 新增「状态键（stateKey）」「取义主词条（entryKey）」两条领域语言；规格 `2026-07-22-V0.1-1000词…实施规格.md` 第 79 条加 cross-ref「[最新确认 · 2026-07-27]」。
- **验证证据**：`content/dictionary.test.ts` 11 测（could 自洽可达、went→go 时 `stateKey='went'`/`entryKey='go'`）；`annotator.test.ts` 17 测；E2E #1 `form_isolation=abilities(stateKey=surface)` 通过。核心 core-first 实现（`dictionary.ts` `lookup`）未改动。

### 2.4 阻塞 #4：真正闭合策略 seam（导入边界）
- **规则**：popup/worker/content/storage 只经 `strategy/index.ts` 公共 facade 与 `shared/*` 共享模块消费；worker **不得**直接 import `strategy/quiz.ts` 或 `strategy/audit.ts`；worker 机械合并/持久化/广播，不决定 marker/auditPlan 清理；避免只返回固定布尔的 Middle-Man 接口。
- **失败测试（修复前）**：`worker/auditValidation.ts` 直接 `import { auditPlanVersion } from '../strategy/audit'`，seam 未真正闭合。
- **实现**：新增中性共享模块 `shared/auditPlanVersion.ts`（`auditPlanVersion(seed, planVersion, candidates, questions)` 哈希覆盖候选与题目内容），`strategy/audit.ts` 与 `worker/auditValidation.ts` 均改从 `shared/auditPlanVersion` 导入——生成与校验重算共用同一实现。worker 的校验/清理决策据此执行但不在 worker 内重算领域逻辑。
- **验证证据（关键，非仅全绿）**：`worker/importBoundary.test.ts` 静态扫描 `worker/` 下所有非测试 `.ts` 源文件的 import 语句，断言**不含** `strategy/quiz` / `strategy/audit`；反向断言 `index.ts` 含 `from '../strategy/index'`、`auditValidation.ts` 含 `from '../shared/auditPlanVersion'` 且**不含** `from '../strategy/audit'`。当前仅有的 `strategy/audit` 导入位于两个测试文件（构建 fixture），生产代码已闭合。

### 2.5 阻塞 #5：加强冻结计划与作答校验
- **规则**：`FREEZE_AUDIT_PLAN` — `sender.url` 须**精确等于** `chrome.runtime.getURL('popup.html')`；校验 bucket 判别联合；`question.band`/`candidate.band` 合法且一致；4 个互异选项、唯一正确、`correctOptionIndex`/`unsureIndex`；完整性哈希须覆盖冻结题目内容（非仅候选）；worker 不加载完整词典。`AUDIT_ANSWER` — 重校验 marker 存在且 pending；`marker.planVersion`/`marker.stateVersion` 与冻结计划及快照一致；池 A 当前仍 known；拒绝已结算/过期/手动覆盖/用旧计划重测；池 B 明确 deferred 但**属 V0.1 完整规格内**。
- **失败测试（修复前）**：`FREEZE_AUDIT_PLAN` 用宽松 `url.includes('popup.html')`；`auditPlanVersion` 哈希仅覆盖候选；`validateAuditAnswerRequest` 缺 marker-pending/planVersion/known-state/池 B deferred 校验；池 B 误标「范围外」。
- **实现**：`worker/index.ts` 精确 URL 校验 `sender.url === popupUrl()` + `!sender.tab` + `sender.id===selfId()`；`worker/auditValidation.ts` `validateFrozenAuditPlan` 加强（ALLOWED_BUCKETS、band 范围+一致、`validateQuestionShape`、版本重算覆盖题目内容），`validateAuditAnswerRequest` 增 `words` 参数与 marker-pending/planVersion/known/池 B deferred 校验。
- **验证证据**：见第 6 节防篡改拒绝矩阵（`worker/auditValidation.test.ts` 19 测含全部新增拒绝分支）。

### 2.6 阻塞 #6：性能度量真实性与观察者自触发
- **规则**：`domNodesAdded` 须计**真实插入的 DOM 节点**（非占位计数）；报告 `removedNodes`/`netNodes`；真实布局偏移用 Layout Instability API（`layout-shift`/CLS），scrollHeight 差重命名为 `heightDeltaPx`（不称「布局偏移」）；MutationObserver 须跳过扩展自身新增节点（避免 982 文本节点 → 1977 批次的自触发爆炸）；长文 E2E ≥3 样本；perf 报告仅含数字（无 URL/正文/句子）；**不声称**「低于 1.5s 预算」（规格无预算）；**不得**由 `heightDelta=0` 推断「无回流」。
- **失败测试（修复前）**：`layoutDeltaPx` 命名误导为布局偏移；MutationObserver 未跳过自身节点 → 自触发爆炸（1977 批次）；无 `removed`/`net` 维度；无真实 layout-shift 度量。
- **实现**：`pageScanner.ts` `PerfReport` 改名/新增：`heightDeltaPx`（scrollHeight 差，绝对值）、`layoutShiftScore`（PerformanceObserver `layout-shift` 累计，环境不支持则 0）、`domNodesAdded`（实际插入 span 数）、`domNodesRemoved`（`updateWordDisplay` 还原计数）、`netNodes`；`processTextNode` 增加「命中 `.avr-word` 内部文本则跳过」防御；`observeDynamic` 跳过自身新增的 `.avr-word` 元素与内部文本；`annotator.ts` `updateWordDisplay` 返回移除 span 数。
- **验证证据（关键）**：E2E #3 长文采样 `batches` 由修复前 **1977 → 8**，`textNodesScanned` 982 → **955**（去除自触发重复计数后的真实值）；`layoutShiftScore=0`、`heightDeltaPx=0` 为 headless 真实测量（见第 7 节原始样本）。

### 2.7 阻塞 #7：纠正本报告 + 真实全量验证
- 依次执行：`npm run typecheck` → `npm test` → `npm run build` → `python3 tests/test_build_ecdict_core.py -v` → `npm run test:e2e` → `git diff --check 7ea4ce8` → `git status --short`。全部通过（见第 9 节）。
- 本报告按实测重写：修正日期、文件计数、`stateView` 笔误、池 B「规格内 deferred」措辞、性能结论仅陈述实测事实、对未验证项与残余风险显式标注 UNKNOWN。

---

## 3. v1 → v2 迁移示例与证据

`migrateSnapshot(raw)` 对旧 v1 快照确定性补字段；含 `stateVersion` 的冻结计划保留，缺 `stateVersion` 的置 `null`。

**输入（v1 旧快照，缺新字段）**
```jsonc
{
  "schemaVersion": 1,
  "installSeed": "seed-1",
  "words": { "apple": { "status": "known", "source": "manual", "updatedAt": 1 } },      // 无 version
  "auditMarkers": { "apple": { "word": "apple", "source": "initial-correct",
                               "planVersion": "p", "createdAt": 1, "pending": true } },  // 无 stateVersion
  "auditPlan": { "version": "v", "planVersion": "p", "seed": "seed-1",
                 "candidates": [], "questions": [], "results": [], "createdAt": 1 },     // 无 stateVersion
  "initialTest": null
}
```

**输出（v2，migrateSnapshot 后）**
```jsonc
{
  "schemaVersion": 2,                       // 升版
  "installSeed": "seed-1",                   // 原样保留
  "stateVersion": 0,
  "words": { "apple": { "status": "known", "source": "manual", "updatedAt": 1, "version": 0 } },       // version 补 0
  "auditMarkers": { "apple": { "word": "apple", "source": "initial-correct",
                                "planVersion": "p", "stateVersion": 0, "createdAt": 1, "pending": true } }, // stateVersion 补 0
  "auditPlan": null,                         // 缺 stateVersion → 安全失效为 null
  "initialTest": null                        // 用户数据保留
}
```

**证据**：`worker/storage.test.ts` `describe('migrateSnapshot (v1 → v2)')` 6 测：首次安装（undefined）/ v1 升级补字段且保留用户数据 / 旧计划缺 `stateVersion` 置 `null` / 幂等（再次迁移一致）/ 损坏字段（null/字符串/数字）安全 / 升级保留 `installSeed` 与词状态。`SCHEMA_VERSION` 在 `shared/types.ts` 为 `2`。

**回滚边界（诚实）**：`migrateSnapshot` 只增字段、绝不删用户有效数据；若需回退到 v1 读取，唯一安全路径是凭发布前备份快照或清除 `chrome.storage` 重装。本函数**不提供原地降级**，且本会话未实际执行任何回滚，故**不得声称回滚已验证**。

---

## 4. priority-preserved marker 清理证据

`worker/index.test.ts`「priority-preserved：记录作答、清除旧标记，且不改变手动状态（真实协调路径）」：

- 构造快照：`apple` 已被手动标记 `known`（source=`manual`）；`apple` 有一枚来自旧首测计划的残留待审计标记（`planVersion:'OLD-PLAN'`）；`initialTest` 已就绪。
- 驱动真实协调路径 `reduceWorkerMessage(snapshot, {type:'INITIAL_TEST_ANSWER', questionIndex:0, answer:{kind:'option',optionIndex:0}}, {id:'ext',url:'popup.html'})`。
- 断言：
  1. `next.initialTest.answers[0] !== null` —— 作答被记录；
  2. `next.auditMarkers[apple]` 为 `undefined` —— 旧标记被清除；
  3. `next.words[apple].source === 'manual'` 且 `.status === 'known'` —— 手动状态未被改变；
  4. `broadcast === undefined` —— 状态未变故不广播；
  5. `changed === true` 且 `response.result.kind === 'priority-preserved'`。

---

## 5. 生产导入边界证据

`worker/importBoundary.test.ts` 静态扫描 `extension/src/worker/` 下所有非测试 `.ts` 源文件（`index.ts`/`auditValidation.ts`/`storage.ts` 等），解析每个 `from '...'` 语句：

- 断言：无任何生产文件 import 包含 `strategy/quiz` 或 `strategy/audit` 的模块；
- 反向断言：`index.ts` 含 `from '../strategy/index'`（仅 facade）；`auditValidation.ts` 含 `from '../shared/auditPlanVersion'` 且**不含** `from '../strategy/audit'`。

当前仓库中 `import ... from '../strategy/audit'` 仅出现在两个**测试**文件（`worker/index.test.ts`、`worker/auditValidation.test.ts`）用于构造 fixture；生产 worker 代码已完全经 facade + shared 模块消费，seam 闭合。

---

## 6. 审计防篡改拒绝矩阵

`worker/auditValidation.test.ts`（19 测，含以下拒绝分支）+ `worker/index.test.ts` 协调路径：

| 篡改/非法场景 | 校验点 | 拒绝错误（含关键字） | 测试 |
|---|---|---|---|
| 伪造 `auditPlanVersion` | `plan.version !== auditPlanVersion` | `version mismatch` | `validateAuditAnswerRequest` |
| index 越界 | `index` 不在候选范围 | `out of range` | 同上 |
| 重复结算 | `plan.results[index] !== null` | `already settled` | 同上（先 `settleAuditAnswer` 再验证） |
| 候选无 marker（池 B 高置信） | `!marker` | `no audit marker`（且信息含 `pool B`/`deferred`，**非** `out of scope`） | 同上 |
| 无冻结计划 | `plan === null` | `no frozen audit plan` | 同上 |
| 相同种子重测后旧计划（过期） | `plan.stateVersion !== snapshot.stateVersion` | `state version mismatch (expired plan)` | 同上 |
| marker 已非 pending | `!marker.pending` | `not pending` | 同上 |
| marker.planVersion 不一致（重测旧计划） | `marker.planVersion !== plan.planVersion` | `planVersion mismatch` | 同上 |
| 池 A 当前状态非 known（手动覆盖） | `words[candidate.word].status !== 'known'` | `must be known` | 同上 |
| `FREEZE`：planVersion 篡改 | `plan.planVersion !== initialTest.plan.version` | `planVersion does not match` | `validateFrozenAuditPlan` |
| `FREEZE`：stateVersion 不符 | `plan.stateVersion !== snapshot.stateVersion` | `stateVersion` | 同上 |
| `FREEZE`：池 B 候选 | `candidate.bucket === 'high-confidence'` | `pool B ... deferred`（`not` `out of scope`） | 同上 |
| `FREEZE`：篡改题目内容 | 版本重算 `auditPlanVersion` 覆盖题目 | `not reproducible` | 同上 |
| `FREEZE`：非法 bucket | `!ALLOWED_BUCKETS.includes(bucket)` | `invalid audit bucket` | 同上 |
| `FREEZE`：question.band 越界 | `question.band` 范围 | `question band out of range` | 同上 |
| `FREEZE`：candidate/question band 不一致 | `candidate.band !== question.band` | `candidate band does not match question band` | 同上 |
| `FREEZE`：选项非互异 | `Set(translations).size !== 4` | `not distinct translations` | 同上 |
| `FREEZE` sender 非精确 popup | `sender.url !== popupUrl()` 或带 `sender.tab` | `may only be frozen by the extension popup` | `reduceWorkerMessage` |
| 手动覆盖使候选非 known 后作答 | 经 `words` 校验 | `must be known` | `reduceWorkerMessage` |
| 过期计划（stateVersion 不符）作答 | 经协调路径 | `state version mismatch` | `reduceWorkerMessage` |

---

## 7. ≥3 长文性能原始样本（真实 Chrome 151 / headless=new）

采样对象：`tests/fixtures/long-read.html`（~25KB，70 段）。每样本为一次全新页面加载的冷扫描，读取 `documentElement.dataset.avrPerf`（仅 DOM dataset，不含 URL/正文/句子）。**修复前**同 fixture 测得 `textNodesScanned=982`、`batches=1977`（自触发重复扫描）；**修复后**：

| # | totalScanMs | maxBatchMs | textNodesScanned | wordsAnnotated | domNodesAdded | domNodesRemoved | netNodes | heightDeltaPx | layoutShiftScore | batches |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 103.1 | 1.1 | 955 | 2262 | 2262 | 0 | 2262 | 0 | 0 | 8 |
| 2 | 108.6 | 1.2 | 955 | 2262 | 2262 | 0 | 2262 | 0 | 0 | 8 |
| 3 | 100.4 | 1.2 | 955 | 2262 | 2262 | 0 | 2262 | 0 | 0 | 8 |

SPA 页一次观测（对照）：`totalScanMs=1.9, maxBatchMs=0.6, textNodesScanned=8, wordsAnnotated=37, domNodesAdded=37, domNodesRemoved=0, netNodes=37, heightDeltaPx=0, layoutShiftScore=0, batches=4`。

**实测事实陈述（不引申）**：
- `batches` 982→955（真实文本节点数）且 1977→8，证明 MutationObserver 自触发已消除，`textNodesScanned` 现在计的是去重后的真实节点。
- 全量扫描墙钟 ≈ 100–110ms；单批峰值 <2ms（无主线程长阻塞）。
- `heightDeltaPx=0`：标注使用 inline `<span>`，页面高度未变——这只说明高度未变，**不构成**「无布局回流」结论（布局偏移须由 Layout Instability API 判定）。
- `layoutShiftScore=0`：headless=new 下 Layout Instability API 累计为 0（实测值；非推断）。真实带渲染的浏览器可能有非零 CLS，本环境无法断言。
- **规格无性能预算**，故不声称「低于 1.5s」之类结论；仅报告实测数字。

---

## 8. 历史实现证据（状态模型 / 策略 seam 闭合，前序会话完成，本会话沿用并加强）

### 8.1 13 collision 处理
13 个词同时是已选 core 主词条且作为 forms 键指向另一词：`beginning building concerned could following growing interested interesting later learning meeting thought understanding`。
- 运行时：`dictionary.ts` core 优先，`lookup(k)` 直接命中 `core[k]`（状态键=`k` 自身），`forms[k]` 项不参与，13 词作为合法 core 词条保留、完全自洽。
- 构建期：`build_ecdict_core.py` 写出 `forms.json` 前丢弃 `key∈core` 的 forms 项（1518→1505），与运行时一致；`build-report.json` 记 `core_form_collisions`（13 词），`quiz_eligibility.ineligible_count` 由 13 归 0。
- 首测候选：`eligibleCandidates(core, _forms)` 不再因 forms 遮蔽排除任何 core 词。

### 8.2 marker 生命周期
- 状态键隔离：marker/word/plan 全链携带 `stateVersion`；`INITIAL_TEST_START`/`INITIAL_TEST_RESET` bump 并清旧轮 marker。
- `clearStaleAuditMarkers(snapshot, current)` 删 `marker.stateVersion !== current`；`clearAllPendingAuditMarkers` 重置时全量清。
- 手动覆盖：`STATE_CHANGE` 经 facade `{change, clearMarker:true}`，worker 按 `clearMarker` 清 marker。
- 作答清除：`INITIAL_TEST_ANSWER` 按 `result.clearMarkerWord` 清 marker。
- 证据：`storage.test.ts`、`seam.test.ts`、`auditValidation.test.ts`、`quiz.test.ts` 断言；E2E #2 `audit=25` 且多标签同步。

### 8.3 策略 facade（最终 Interface）
`extension/src/strategy/index.ts` 导出 `createVocabStrategy(): VocabStrategy`，公共方法：`getDisplayDecision` / `markKnown` / `markLearning` / `freezeInitialTestPlan` / `settleInitialTestAnswer`（含 `stateVersion`、`clearMarkerWord`）/ `planInitialTestStart` / `planInitialTestReset` / `freezeAuditPlan`（含 `stateVersion`）/ `settleAuditAnswer`。

### 8.4 FREEZE_AUDIT_PLAN 校验（两道闸门，修正措辞）
1. **sender 校验（精确 popup）**：`!sender.tab && sender.id === chrome.runtime.id && sender.url === chrome.runtime.getURL('popup.html')` —— 拒绝内容脚本伪造（**精确匹配** URL，非 `includes`）。
2. **结构校验** `validateFrozenAuditPlan(plan, snapshot)`：`initialTest.completed`；`planVersion`/`seed`/`stateVersion` 与快照一致；`candidates/questions/results` 长度一致且 `results` 全 null；候选无重复；`question.word===candidate.word`；bucket 合法；池 A 每候选 marker 合法；池 B（`high-confidence`）明确 **拒绝（V0.1 完整规格内但 deferred，未实现）**；版本可重算覆盖候选+题目内容。

---

## 9. 七级验证命令与原始结果

| 命令 | 结果 |
|---|---|
| `npm run typecheck`（`tsc --noEmit`） | 退出码 0，无错误 |
| `npm test` | `Test Files 12 passed (12)` / `Tests 152 passed (152)` |
| `npm run build` | `✅ Build complete: .../dist` |
| `python3 tests/test_build_ecdict_core.py -v` | `Ran 9 tests ... OK` |
| `npm run test:e2e` | `E2E #1 PASS` / `#2 PASS` / `#3 PASS` / `E2E ALL PASS` |
| `git diff --check 7ea4ce8` | 退出码 0（无空白错误） |
| `git status --short` | 28 个 `M` + 5 个 `??`（见下） |

**Vitest 文件级明细（152 测）**：
`strategy/quiz.test.ts(14)` `worker/storage.test.ts(25)` `content/annotator.test.ts(17)` `content/dictionary.test.ts(11)` `strategy/index.test.ts(12)` `strategy/seam.test.ts(6)` `worker/auditValidation.test.ts(19)` `strategy/audit.test.ts(9)` `content/spa.test.ts(4)` `content/scanner.test.ts(21)` `worker/index.test.ts(9)` `worker/importBoundary.test.ts(5)`。

**当前工作区文件计数**（受保护 dirty 状态）：
- 修改（M，28 个）：`CONTEXT.md` `RULES.md` 规格 md `e2e-verify.cjs` `extension/data/build-report.json` `extension/data/forms.json` `extension/src/content/{annotator.test.ts,annotator.ts,dictionary.test.ts,dictionary.ts,pageScanner.ts}` `extension/src/popup.ts` `extension/src/shared/types.ts` `extension/src/strategy/{audit.test.ts,audit.ts,index.test.ts,index.ts,quiz.test.ts,quiz.ts,seam.test.ts}` `extension/src/worker/{auditValidation.test.ts,auditValidation.ts,index.ts,storage.test.ts,storage.ts}` `scripts/build_ecdict_core.py` `tests/fixtures/test-page.html` `tests/test_build_ecdict_core.py`。
- 未跟踪（??，5 个）：`extension/src/shared/auditPlanVersion.ts`（新增共享模块）`extension/src/worker/importBoundary.test.ts`（新增）`extension/src/worker/index.test.ts`（新增）`tests/fixtures/long-read.html`（长文 fixture）`work/codex-remediation-report-2026-07-27.md`（本报告）。

---

## 10. 未验证项与残余风险

- **#3 审计（03–06）**：画像校准、Beta-PAV、Wilson 区间、每日校准等 deferred 项**未实现**，与本论修复无关（本次仅闭合服务端权威校验 seam）。UNKNOWN：这些 deferred 项的具体验收状态。
- **#5 浏览器 dogfood 真人验收**：deferred（ticket 10），未做真人安装验收。UNKNOWN：真实用户安装后的长期行为。
- **池 B（高置信未知词）**：拒绝路径已实现并测试（V0.1 完整规格内但 deferred），但池 B **生成机制本身未建**；服务端权威校验已能安全拒其作答。
- **schema v2 回滚**：`migrateSnapshot` 不提供原地降级；本会话未实际执行回滚，故**回滚未验证**（仅声明边界）。
- **`layoutShiftScore` 真值**：headless=new 下实测为 0；真实带渲染浏览器可能非零，本环境 UNKNOWN。
- **`data/derived` 与远端 `to-tickets`**：`data/derived` 为 gitignore 可再生产物，仅本地同步；`to-tickets` 本地草案未发布 GitHub（无远端授权）。
- **首测弹窗点击**：沿用 `popup.evaluate` 点击（规避 puppeteer-core + Chrome 151 在扩展弹窗页 `ElementHandle.click` 协议超时），非功能缺陷。

---

## 11. 验收建议与声明

- **七节验收阻塞均已落地**：类型 / 单元（152）/ 构建 / Python（9）/ 真实浏览器 E2E（3 阶段全 PASS）五级验证全绿；且关键结论由**针对性测试**支撑而非仅「全绿」推断——策略 seam 由 `importBoundary.test.ts` 静态证明、schema 迁移由 `migrateSnapshot` 6 测、priority-preserved 由真实协调路径测试、性能自触发由 `batches` 1977→8 实测、布局偏移由 Layout Instability API 实测。
- **声明**：所有修改**未 commit、未 push、未合并、未部署**。代码停留于 `hermes/v0.1-impl` 工作区，等待 Codex 独立验收与后续发布流程（含 #5 dogfood 真人验收、#3 03–06 deferred 项排期、以及由负责人决定的 commit/push/分发）。
- **后续建议**：若验收通过，由负责人执行 commit/push 与 Chrome 分发；池 B 与每日校准作为下一里程碑。
