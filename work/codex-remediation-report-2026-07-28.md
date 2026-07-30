# V0.1 状态模型与策略 Seam 纠正 — 最终聚焦修复报告（2026-07-28，最终修订）

- **日期**：2026-07-28 第二轮修订（基于 `hermes/v0.1-impl` 分支，固定审查基点 `7ea4ce8e5dea4280719a27aa0e0bbdd677a66084`，工作区为受保护 dirty 状态）
- **执行角色**：Senior Developer（高级开发工程师）
- **范围**：按独立审查（Standards 由 Archimedes 审、Spec 由 Mencius 审）**仅**处理 4 个指定项（P1-1 哈希序列化歧义、P1-2 生命周期 transition 真正闭合、P2-1 E2E sandbox 环境化、P2-2 性能 schema 断言）。**不**修改 `main`、不 push、不合并、不关闭 Issue、不部署。
- **最终声明**：所有产物**未 commit / 未 push / 未合并 / 未部署**。代码停留于工作区，等待 Codex 独立验收与后续发布流程。

> 关联文件：`codex-remediation-report-2026-07-27.md` 已被本文件**取代**（其开头已加「已撤回 / SUPERSEDED」标记），不得作为验收依据。

> **2026-07-30 末轮收口（最终验收前）**：独立复验（Codex）确认生产实现通过核心验收、无新 P1；本轮按「继续审阅附件」收口 6 个 P2 收尾项 + 1 个产品规则确认，未扩大范围：
> 1. `auditPlanVersion` 分隔符碰撞回归改为**生产合法四选一**题目（旧测试用 1-option 非法题型，不再作为生产可达证据）；
> 2. 新增**独立 isCorrect/correctOptionIndex 移动**测试（翻译不变、仅移动正确标记，哈希必须变）；
> 3. worker 机械应用 seam **锁死**：注入 fake strategy 返回哨兵 transition，断言 worker 原样（引用相等）应用每个字段；
> 4. 删除 `startInitialTest` 未使用的 `markers` 参数（接口/实现/worker 调用/测试），旧/异常 marker 的 snapshot 经 transition 仍得空 `auditMarkers`；
> 5. 修正 `shared/types.ts` 注释：`LookupContext.word` / `DisplayResult.word` = `stateKey`（小写 surface form），`surfaceForm` = 页面原始词形（如 "Went"）；
> 6. E2E 阶段三 `spaPerf` 也调用 `assertPerfShape`（与长文一致，三阶段性能 schema 断言成真）。
> 单测 171 → **174**；`typecheck` / `build` / `python 9` / 两种 E2E 模式均全绿（见 §4 更新）。**用户已明确确认 `stateKey`/`entryKey` 契约按当前 `RULES.md` 执行**，`RULES.md` / `CONTEXT.md` / 正式 Spec 的「已确认」表述保留。

---

## 0. 重要前提：撤回上一轮对哈希与「生命周期 transition 已关闭」的过强结论

本文件的前一修订（及被取代的 07-27 报告）曾声称：

- 「`auditPlanVersion` 哈希已覆盖选项翻译/isCorrect/顺序 ✅」；
- 「固定布尔 intent → 策略生成的完整生命周期 transition ✅ 已闭合（Middle-Man 味道消除）」。

独立复验（Mencius / Archimedes）指出上述两项是**测试未覆盖的合同缺口**，结论不成立：

1. **哈希序列化歧义（P1-1）**：旧实现用**未转义**的 `:` `,` `|` 拼接候选与题目字段。当 translation 文本自身携带这些字符时，不同字段分组可生成**完全相同的拼接串**（分隔符碰撞），使「替换翻译」类篡改可能逃过重算校验。旧测试只验证「替换不同翻译 → 哈希变」，未构造碰撞输入，故未暴露该缺口。
2. **生命周期 transition 未真正闭合（P1-2）**：旧 `InitialTestStartTransition/ResetTransition` 仍返回 `clearAuditPlan: boolean`，而 **worker 继续自行构造 `InitialTestState` 并解释该布尔**做 `setAuditPlan(snap, null)`。这违背「所有状态变更由策略计算、worker 只机械应用」的 seam 约束——布尔意图本质是 Middle-Man 的残留。

**本轮（2026-07-28 修订）已真正闭合上述两项**（见 §2.1、§2.2），并补充能暴露缺口的对抗性测试。下列 4 项仍**明确不声称**：

1. ❌ **不声称「七项全部关闭」**——本轮只处理 4 个指定项；其余项以被取代的 07-27「已确认关闭」清单为参考，本轮未重做其端到端复验。
2. ❌ **不声称「密码学题目防篡改」**——P1-1 仅消除序列化歧义；哈希仍为 **FNV-1a（非加密）**，仅提供「持久化计划字节被改 → 重算不一致 → 拒绝」的**确定性一致性校验**，不提供抗碰撞密码学完整性（见 §3.2）。
3. ❌ **不声称「真实 DOM 净增量」可作页面级可信指标**——`added/removed` 由标注器真实返回（单元可测），但它是标注行为节点增量，非整页 DOM 净增量；`heightDeltaPx` 在 headless 下为 0（布局未定稿），视觉/布局含义仍 UNKNOWN（见 §3.3）。
4. ❌ **不声称「观察器自触发已完全消除」**——扫描计数膨胀（955 → 71）已消除，但 MutationObserver 仍用于 SPA 动态插入；「任意边界下零自触发」为经验性证据，非形式化证明（见 §3.4）。

> 生命周期 transition **已在本轮真正闭合**（P1-2）：旧「已关闭」结论现被实际修复佐证，但本报告保留上述撤回说明以如实记录该结论曾因测试缺口而过早成立。

---

## 1. 本轮处理的 4 个项（requirement → code → test 映射）

| # | 项 | 实现位置 | 关键测试 |
|---|---|---|---|
| P1-1 | 哈希序列化歧义 → 结构化 JSON 序列化 | `shared/auditPlanVersion.ts` | `shared/auditPlanVersion.test.ts`（确定性 + **分隔符碰撞回归**）；`worker/auditValidation.test.ts` 重算校验保留 |
| P1-2 | 生命周期 transition 真正闭合（策略交付完整片段，worker 机械合并） | `shared/types.ts`、`strategy/index.ts`、`worker/index.ts` | `strategy/seam.test.ts`（transition 字段 + **异常 marker 回归**）；`worker/index.test.ts`（**新增** INITIAL_TEST_START/RESET 机械应用 + 异常 marker） |
| P2-1 | E2E Chrome sandbox 由环境变量控制 | `e2e-verify.cjs` `launchChrome` | 两种启动模式均真实跑通（见 §4） |
| P2-2 | 性能 schema 断言 `layoutShiftSupported: boolean` | `e2e-verify.cjs` `assertPerfShape` | E2E 三阶段（长文 + **SPA**）均调用 `assertPerfShape` 含该断言 |

---

## 2. 修复实现与验证证据

### 2.1 P1-1：哈希负载结构化序列化（消除分隔符歧义）

**实现**（`shared/auditPlanVersion.ts`）：废弃未转义 `:` `,` `|` 拼接，改为对**仅含受控字段的嵌套数组**执行稳定 `JSON.stringify`：
```ts
const payload = JSON.stringify({
  seed,
  planVersion,
  candidates: candidates.map((c) => [c.word, c.bucket, c.band]),
  questions: questions.map((q) => [
    q.word, q.band, q.correctOptionIndex, q.unsureIndex,
    q.options.map((o) => [o.isCorrect ? 1 : 0, o.translation]),
  ]),
});
const h = fnv1a(payload);
return `${planVersion}:${seed}:${h.toString(16).padStart(8, '0')}`;
```
- 数组元素顺序固定、均为基本类型，`JSON.stringify` 输出确定且无字段边界歧义。
- 负载继续覆盖：seed、planVersion、候选 `word/bucket/band`、题目 `word/band/correctOptionIndex/unsureIndex`、每选项 `isCorrect + translation` + 顺序。
- `worker/auditValidation.ts` 服务端以自身存储计划重算并比对的逻辑**保留**（`computeAuditPlanVersion` 别名）。

**分隔符碰撞回归测试（生产合法四选一题目）**：两个输入均为生产可达的 `QuizQuestion`——每题恰好 4 个互异翻译、恰好 1 个 `isCorrect=true`、`correctOptionIndex` 与正确标记一致；二者仅 option 翻译文本不同，但旧 delimiter 因未转义 `,` `:` 而拼接串完全相同，新结构化序列化据此区分。
```ts
// 复刻旧实现（未转义 : , | 拼接）
const oldPayload = (qs) => qs.map(
  (q) => `${q.word}:${q.band}:${q.correctOptionIndex}:${q.unsureIndex}:` +
         q.options.map((o) => `${o.isCorrect ? '1' : '0'}:${o.translation}`).join(','),
).join('|');

// 同题两变体（均合法四选一）：opt0/opt1 翻译文本互嵌分隔符
const inputA = [ mk([['a,0:b', true], ['c', false], ['x', false], ['y', false]] ) ];
const inputB = [ mk([['a', true],     ['b,0:c', false], ['x', false], ['y', false]] ) ];

expect(oldPayload(inputA)).toBe(oldPayload(inputB));  // 旧拼接完全相同（碰撞成立）
const vA = auditPlanVersion(seed, pv, [], inputA);
const vB = auditPlanVersion(seed, pv, [], inputB);
expect(vA).not.toBe(vB);  // 新结构化序列化：结构化不同 → 哈希必须不同
```
- 旧 delimiter 拼接：`inputA` 与 `inputB` 均得到 `w:0:0:4:1:a,0:b,0:c,0:x,0:y`（opt0 内嵌 `0:b` 与 opt1 内嵌 `0:c` 在旧串中等价），碰撞成立。
- 新 JSON 序列化：两组结构化输入不同（翻译不同但旧拼接串相同）→ `vA !== vB`，歧义消除。
- **注意**：旧测试曾用 1-option 非法题型构造碰撞，虽能证明序列化歧义，但**不属于生产可达输入**，不再作为「生产可达证据」。本轮回归改用上述**生产合法四选一**题目。

**独立 isCorrect / correctOptionIndex 移动测试**：四题翻译文本与顺序完全不变，仅将「正确」标记从 opt0 移至 opt1（并同步 `correctOptionIndex`），断言 `auditPlanVersion` 必须变化——直接证明哈希覆盖 `isCorrect` 归属，而非仅覆盖翻译顺序。

### 2.2 P1-2：生命周期 transition 真正闭合（旧/新结构对比）

**旧结构（缺陷：布尔意图 + worker 自造状态）**：
```ts
export interface InitialTestStartTransition {
  readonly nextStateVersion: number;
  readonly markers: Record<string, AuditMarker>;
  readonly clearAuditPlan: boolean;   // ← worker 自行解释布尔
}
// worker/index.ts（旧）：
const transition = strat.startInitialTest(plan, snapshot.auditMarkers, snapshot.stateVersion);
let snap = { ...snapshot, stateVersion: transition.nextStateVersion, auditMarkers: transition.markers };
if (transition.clearAuditPlan) snap = setAuditPlan(snap, null);   // worker 自行清空
const test: InitialTestState = { plan, answers: Array.from({length:plan.questions.length}, () => null), completed:false };
snap = setInitialTest(snap, test);                                 // worker 自行构造 InitialTestState
```

**新结构（闭合：策略交付完整片段，worker 机械合并）**：
```ts
export interface InitialTestStartTransition {
  readonly nextStateVersion: number;
  readonly auditMarkers: Record<string, AuditMarker>;
  readonly auditPlan: AuditPlan | null;       // 策略直接给出
  readonly initialTest: InitialTestState;     // 策略用传入 plan 构造
}
export interface InitialTestResetTransition {
  readonly nextStateVersion: number;
  readonly auditMarkers: Record<string, AuditMarker>;
  readonly auditPlan: AuditPlan | null;       // 恒 null
  readonly initialTest: InitialTestState | null;  // 恒 null
}
// strategy/index.ts：startInitialTest 真实使用 plan 构造 initialTest、清空全部标记（含异常 marker）
// worker/index.ts（新）：仅机械合并，不做任何状态决策
const transition = strat.startInitialTest(plan, snapshot.stateVersion);
const snap: VocabSnapshot = {
  ...snapshot,
  stateVersion: transition.nextStateVersion,
  auditMarkers: transition.auditMarkers,
  auditPlan: transition.auditPlan,
  initialTest: transition.initialTest,
};
```
- `startInitialTest` **实际使用传入 `plan`** 生成 `initialTest = { plan, answers: 全 null, completed:false }`。
- 开始新一轮 / reset 时按现行规格**清空全部旧 audit markers**；`stateVersion === nextStateVersion` 的**异常 marker**（合法流程不可能产生）一并排除——标记清理由策略收口，worker 无任何裁量权。
- `reset` 直接交付 `initialTest:null, auditPlan:null, auditMarkers:{}`。
- worker 不再调用 `setAuditPlan`/`setInitialTest` 于这两条路径（仅 INITIAL_TEST_ANSWER / FREEZE_AUDIT_PLAN / CLEAR_AUDIT_PLAN 仍使用）。

**异常 marker 回归测试**（seam + worker 双层）：构造 `stateVersion === nextStateVersion` 的 marker，断言 transition / 合并后快照中该 marker 被排除（清空全部标记即满足，且不依赖任何布尔解释）。

### 2.3 P2-1：E2E Chrome sandbox 环境化

`e2e-verify.cjs` `launchChrome` 不再默认无条件 `--no-sandbox`：
```js
const disableSandbox = process.env.AVR_E2E_NO_SANDBOX === '1';
const sandboxArgs = disableSandbox ? ['--no-sandbox', '--disable-dev-shm-usage'] : [];
// 默认保留 Chrome 原生 sandbox；仅 AVR_E2E_NO_SANDBOX=1 时关闭（受限 CI 需要）
```
仅影响测试运行环境，不改变任何被测行为或断言。

### 2.4 P2-2：性能 schema 断言

`assertPerfShape` 新增 `typeof p.layoutShiftSupported !== 'boolean'` 校验（原仅校验 `layoutShiftScore` 为 number）。`layoutShiftSupported` 区分「不支持 layout-shift」与「真实零值」，不得从 `layoutShiftScore=0` 或 `heightDeltaPx=0` 推断「真实有界面浏览器无布局影响」。性能样本日志亦输出该字段。**长文与 SPA 两个阶段均调用 `assertPerfShape`**——阶段三 `spaPerf` 在读取后若非 null 即断言 schema，使「三阶段性能 schema 断言」有真实证据（早期版本仅长文强断言、SPA 只记录）。

---

## 3. 残留风险与 UNKNOWN（不掩盖）

### 3.1 迁移持久化边界
- 仅验证「v1 → v2」单向；无降级测试（且 `migrateSnapshot` 明确不提供原地降级）。
- 真实 Chrome `chrome.storage.local` 异步写回在 worker 崩溃窗口内可能未落盘；测试用同步 stub 覆盖逻辑，生产环境迁移中途崩溃的原子性未验证。

### 3.2 哈希完整性边界（对应「不声称密码学防篡改」）
- 哈希为 **FNV-1a（非加密）**：P1-1 消除了序列化歧义，但**抗碰撞性仍不保证**；仅用于「持久化计划字节被改 → 重算不一致 → 拒绝」的篡改检测。
- 负载未覆盖：任何未来加入 `AuditPlan` 但不在上述负载中的字段不受保护。
- 信任模型：popup 受信任生成计划并正确计算哈希；worker 只重建并比对。保证「与持久化 version 自洽的计划才被接受」，而非「题库内容本身正确」。

### 3.3 DOM 净增量指标（对应「不声称真实 DOM 净增量」）
- `added/removed/netNodes` 为标注器真实返回的标注行为节点增量（单元可测），替代旧静态估计。
- `heightDeltaPx` 在 headless 下恒为 0（布局未定稿），指标不反映整页其他 DOM 变化；「净 DOM 增量」作为视觉/布局影响仍为 UNKNOWN。

### 3.4 观察器自触发（对应「不声称已完全消除」）
- 自触发计数膨胀已消除（955 → 71，真实 Chrome 实测）。
- MutationObserver 仍服务 SPA 动态插入；`generatedNodes` WeakSet 守卫跳过自身生成节点。但「任意重叠/嵌套 mutation 下零自触发」为经验性，非形式化证明。SPA 阶段仅单页观测，未做压力下多轮突变回环验证。

### 3.5 上一轮「已确认关闭」清单状态
被取代的 07-27 列出的「已确认关闭」项（priority-preserved、SCHEMA_VERSION=2、core-first、worker 不直连 strategy 内部模块、popup URL 精确匹配、marker pending、池 B deferred）：本轮**未逐一重测端到端**，仅确认代码与文档未被破坏。`importBoundary.test.ts` 仍通过（worker 不直连 `strategy/quiz`/`strategy/audit`）。

---

## 4. 八级验证结果（2026-07-28 修订轮重跑）

| # | 验证命令 | 结果 | 备注 |
|---|---|---|---|
| 1 | `npm run typecheck`（`tsc --noEmit`） | ✅ 0 错误 | |
| 2 | `npm test`（`vitest run`） | ✅ **174** 测通过 | 07-28 轮 171 → 末轮 +3（isCorrect/correctOptionIndex 移动 1 + worker 机械 seam 锁死 2） |
| 3 | `npm run build` | ✅ 成功 | `dist/` MV3 产物 |
| 4 | `python3 tests/test_build_ecdict_core.py -v` | ✅ **9** 测通过 | |
| 5a | `npm run test:e2e`（**默认 sandbox**） | ✅ 三阶段 ALL PASS | 见 §4.1 |
| 5b | `AVR_E2E_NO_SANDBOX=1 npm run test:e2e` | ✅ 三阶段 ALL PASS | 见 §4.1 |
| 6 | `git diff --check 7ea4ce8` | ✅ 无尾随空白/冲突标记 | |
| 7 | `git status --short` | ✅ dirty（符合预期，未提交） | 见 §5 |

### 4.1 E2E 两种启动方式真实结果（真实 Chrome 151，headless=new）

**默认 sandbox（`npm run test:e2e`，不加环境变量）**：
```
E2E #1 PASS / E2E #2 PASS / E2E #3 PASS
长文 3 次采样：textNodesScanned=71, wordsAnnotated=2262, domNodesAdded=4560,
  domNodesRemoved=71, netNodes=4489, layoutShiftScore=0, layoutShiftSupported=true, batches=8
SPA：textNodesScanned=5, wordsAnnotated=37, domNodesAdded=76, domNodesRemoved=5,
  netNodes=71, layoutShiftSupported=true
阶段三跳过：nav_skipped=true, code/form/comment_skipped=true
```

**`AVR_E2E_NO_SANDBOX=1 npm run test:e2e`**：
```
E2E #1 PASS / E2E #2 PASS / E2E #3 PASS（同上断言；layoutShiftSupported=true 均通过）
```
- 两种模式断言完全一致；`AVR_E2E_NO_SANDBOX=1` 仅关闭 sandbox + 绕过 `/dev/shm` 限制（受限 CI 需要），不改变任何被测行为。
- 关于 sandbox：本环境重测时**默认 sandbox 模式即可启动并完成导航**（前一修订所称「本环境必须 `--no-sandbox`」为当时环境瞬态/误判；现已改为环境变量可选，由操作者按需开启）。
- 长文 `textNodesScanned=71`（非 955）：审查要求提及「原始 145 个 Text Node」为上限估计（含空白与跳过区节点）；本 fixture 实际被扫描的**非空、非跳过**文本节点为 71，修复前因自触发膨胀至 955。71 为真实 Chrome 实测。

---

## 5. 变更文件清单（工作区 dirty，未提交）

**本轮修改（28 个，节选关键）**：
- `extension/src/shared/auditPlanVersion.ts`（P1-1 结构化序列化）
- `extension/src/shared/types.ts`（P1-2 transition 类型）
- `extension/src/strategy/index.ts`（P1-2 真正闭合 + 补 `InitialTestState` 导入）
- `extension/src/worker/index.ts`（P1-2 机械合并 + 去 `clearAuditPlan` 解释）
- `extension/src/worker/auditValidation.ts`（保持重算校验）
- `e2e-verify.cjs`（P2-1 sandbox 环境化 + P2-2 `layoutShiftSupported` 断言）
- 报告：`work/codex-remediation-report-2026-07-27.md`（加 SUPERSEDED 标记）、本文件

**本轮新增/修正测试（末轮 07-30）**：
- `extension/src/shared/auditPlanVersion.test.ts`（分隔符碰撞回归改为**生产合法四选一** + **新增** isCorrect/correctOptionIndex 移动测试）
- `extension/src/worker/index.test.ts`（**新增** 机械应用 seam 锁死：fake strategy 注入，断言 worker 原样应用 transition 字段）
- `extension/src/strategy/seam.test.ts`（transition 字段 + 异常 marker；`startInitialTest` 调用已去 `markers` 参数）
- （保留）`worker/importBoundary.test.ts`、`worker/storage.test.ts`、`worker/auditValidation.test.ts`、`content/annotator.test.ts`

**未跟踪文件（须保留，不得删除/覆盖）**：
- 源码/测试 5 个：`extension/src/shared/auditPlanVersion.ts`、`.test.ts`、`extension/src/worker/index.test.ts`、`extension/src/worker/importBoundary.test.ts`、`tests/fixtures/long-read.html`
- 报告 2 个：`work/codex-remediation-report-2026-07-27.md`、`work/codex-remediation-report-2026-07-28.md`

> 全程未执行 `git reset/restore/clean/stash`、未切换分支、未 rebase/merge、未 commit/push/PR/部署。

---

## 6. 结论

本轮按审查清单**真正闭合**了 P1-1（哈希序列化歧义）与 P1-2（生命周期 transition 真正闭合，worker 不再自造 `InitialTestState` 或解释布尔），并以 P2-1、P2-2 收口 E2E 环境化与性能 schema 断言；末轮（07-30）进一步收口 6 个 P2 尾项 + 确认 `stateKey`/`entryKey` 契约（见顶部收口说明），八级验证全绿（typecheck 0 错 / **174** 单测 / build 成功 / python 9 / 两种 E2E 模式均 ALL PASS / `git diff --check` 干净 / 工作区 dirty）。

**明确撤回**上一轮（07-27 及本文件前一修订）关于「哈希已完整覆盖翻译/isCorrect/顺序」「生命周期 transition 已闭合（Middle-Man 已消除）」的过强结论——该两项是测试未覆盖的合同缺口，现经对抗性测试（分隔符碰撞 + 异常 marker）佐证已真正修复。残留风险与 UNKNOWN（见 §3）须由后续独立验收（Codex）评估，方可进入合并/发布流程。

**最终声明**：所有产物**未 commit / 未 push / 未合并 / 未部署**。代码仍停留于受保护 dirty 工作区，等待 Codex 独立验收；验收通过后由你明确授权再做本地 commit。
