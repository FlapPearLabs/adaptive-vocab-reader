# 02 — wordKey、AssessmentEvidence 与 schema 3 原子落地

**权威来源**：
- [V0.1 重新对齐规格](../../../docs/specs/2026-07-30-V0.1-重新对齐规格.md)
- [RULES.md](../../../RULES.md)
- [ADR-0004](../../../docs/adr/0004-词汇键与测试证据分离.md)

**What to build**：在页面上把 `went` 标为「会」，`go / going / gone` 立刻一起不再提示——同一个词只需判断一次；升级后旧词汇状态和旧首测结果不丢；此后手动标记再也不会把自己已经测过的样本从统计里抹掉。

**Blocked by**：01 — 切断 V0.1 审计用户路径（T1 → T2 为施工阻塞顺序，不是数据模型硬依赖）

**Status:** done

**用户可见收益**：在页面上把 `went` 标为「会」，`go / going / gone` 立刻一起不再提示——同一个词只需判断一次；升级后旧词汇状态和旧首测结果不丢；此后手动标记再也不会把自己已经测过的样本从统计里抹掉。

**目标**：状态与证据的身份键从 surface stateKey 换成 `wordKey`，引入 `AssessmentEvidence`，并用一次纯函数迁移把旧快照安全带到 schema 3。本 Ticket 保持为一个、不拆分。

**主责任 Requirement ID**：R-KEY-1～R-KEY-4、R-EVD-1～R-EVD-4、R-MIG-1～R-MIG-8

**依赖和 blocker**：
- 依赖：T1（软序施工顺序）。
- Blocker：无硬技术 blocker。但建议 T1 先行——否则 R-MIG-6「清空 auditMarkers/auditPlan」会被「首测重新创建 marker」抵消，验收无法稳定判定。T1→T2 是施工顺序，非数据模型硬依赖。

**为什么保持单 Ticket、不拆分**：wordKey 身份、AssessmentEvidence 和 schema 2→3 迁移必须原子落地；拆分会产生旧键、新证据、旧 schema 混用的不可验收中间状态。

**R-EVD-2 最小边界**：T2 提供 initial/daily 共用的证据结算领域动作，保证两类测试结果都按相同规则双写 `WordState` 与 `AssessmentEvidence`；T2 只接通首测用户路径，T4 负责接入每日计划、每日 UI 和每日用户流程。这不是提前实现每日计划，也不得建设通用测试引擎或新 facade。

**内部实施检查点（同一 Ticket 内顺序推进）**：
1. 类型与 schema 3 最小结构；
2. runtime wordKey 行为；
3. WordState 与 AssessmentEvidence 写入规则；
4. v2→v3 纯迁移；
5. FormsMap 构建不变量；
6. fixture、迁移测试和局部 E2E。

**范围**：
- core 优先的 canonicalization（surfaceForm → wordKey）；页面 `data-word` / 存储键 / 首测候选键 / 证据键四者统一；
- `WordStateSource` 增加 `daily`；新增 `AssessmentEvidence`（outcome / source / assessedAt，每词一条）；
- manual 只写 `WordState`、initial 双写；
- `SCHEMA_VERSION=3`；`migrateSnapshot` 扩展为 v2→v3 四步（key 规范化 → 冲突仲裁 → 旧证据重建 → 审计数据清空）；
- worker 迁移时读取最小 `FormsMap` 传入纯函数；
- FormsMap 两条构建不变量测试；
- **schema 3 在 T2 正式初始化 `dailyTest: null` 与 `completedRoundIndex: 0` 两个缺省字段——这是当前批准 V0.1 schema 的正式默认值，不是未来预留**。

**明确非目标**：
- 不引入 CoreSet / 通用 canonical resolver；
- 不建 migration registry 或通用迁移框架；
- 不实现原地 3→2 降级；
- 不保存测试历史或事件溯源；
- 不实现估计（T3）与每日轮行为（T4）；
- 不做派生词/词族/义项/MWE 传播；
- **T2 不实现每日行为**：每日选题、跳过、恢复、跨日与结算全部属于 T4，T4 不得再次提升 schemaVersion。

**预计影响的模块责任**（仅作定位依据，不强制发明新文件/facade/service/controller/事件总线/通用状态机/迁移框架）：
- `extension/src/content/dictionary.ts`：core 优先 canonicalization。
- `extension/src/content/index.ts`、`annotator.ts`、`pageScanner.ts`：`data-word` 输出 wordKey。
- `extension/src/shared/types.ts`：schema 3 结构、`AssessmentEvidence`、`WordStateSource.daily`、`dailyTest: null`、`completedRoundIndex: 0` 默认值。
- `extension/src/strategy/index.ts` + `strategy/quiz.ts`：manual 只写 WordState；initial 双写 WordState + AssessmentEvidence；同词覆盖。
- `extension/src/worker/storage.ts`、`worker/index.ts`：`migrateSnapshot` v2→v3 扩展，迁移时读取最小 FormsMap 传入纯函数。
- `scripts/build_ecdict_core.py` 与 `tests/test_build_ecdict_core.py`：FormsMap 不变量。
- `e2e-verify.cjs`：§21 场景 3 局部断言。

**Requirement → behavior → test seam**：

| Requirement | Behavior | Test Seam |
|---|---|---|
| R-KEY-1 | went/go 等 surface 状态并入 core wordKey；could/can 不合并 | migration 单测 + dictionary 单测 |
| R-KEY-2 | could 独立于 can（core 优先） | dictionary 单测 |
| R-KEY-3 | 手动标记屈折形式后，同 wordKey 其他词形提示一致 | E2E（§21 场景 3） |
| R-KEY-4 | 页面 data-word 使用 wordKey | E2E DOM 断言 |
| R-EVD-1 | manual 改提示但估计不变（manual 不写证据） | strategy 单测 + E2E |
| R-EVD-2 | initial/daily 共用的证据结算领域动作，保证两类测试都按相同规则双写 WordState 与 AssessmentEvidence；T2 只接通首测用户路径 | strategy/worker 单测 |
| R-EVD-3 | WordState 最后写入生效（manual 不永久优先） | strategy 单测 |
| R-EVD-4 | 同词多次测试只保留最新证据 | strategy 单测 |
| R-MIG-1 | surface 状态并入 core wordKey；could/can 不合并 | migration 单测 |
| R-MIG-2 | 无法映射的旧 key 保留 | migration 单测 |
| R-MIG-3 | 冲突：updatedAt 新者 → 同时 manual → 再同时 learning | migration 单测（三层用例） |
| R-MIG-4 | 已完成/部分首测分别正确重建证据；assessedAt=0；不用 Date.now | migration 单测 |
| R-MIG-5 | manual 覆盖过 initial 的 WordState 不被证据重建覆盖 | migration 单测 |
| R-MIG-6 | 损坏答案跳过；auditMarkers/auditPlan 清空 | migration 单测 |
| R-MIG-7 | 幂等；重启后仍为 schema 3 | migration 单测 + E2E |
| R-MIG-8 | 升级前保留旧快照副本；原地 3→2 降级不实现 | 见下方 R-MIG-8 时机说明（人工发布门） |

**数据、迁移或隐私风险**：
- 本票是唯一有损方向的身份变更——多个 surface 状态折叠为一条 wordKey 状态不可逆，因此升级前必须先完成 R-MIG-8 备份并验证副本可解析。
- 失败行为：损坏输入跳过该记录、不伪造数据、其余照常迁移、不整体失败丢数据；无法映射的旧 key 保守保留不静默删除。

**R-MIG-8 时机正确表达**（引用修正后的 Spec §20.5）：
- **T2 负责**：定义真实用户升级前的备份步骤；验证备份格式可解析；用 schema 2 fixture 验证迁移；明确原地 3→2 降级不实现。
- **T2 完成定义不得要求立即操作用户真实 Chrome profile。**
- 真实用户 profile 的备份执行时机是：T5 全绿之后、T6 开始之前、第一次让真实用户 profile 加载 schema 3 构建之前；届时必须取得用户明确配合和授权（详见 T6 的真实用户升级门）。

### R-MIG-8 真实用户备份步骤（发布门定义，T2 不执行）

仅在 T5 隔离真浏览器 E2E 已全绿、用户明确授权并且真实 profile 首次加载 schema 3 构建**之前**执行；开发、单测和隔离 E2E 一律不得触碰真实 profile。

1. 用户在自己的 Chrome profile 中打开扩展 Service Worker 的 DevTools，运行 `const backup = await chrome.storage.local.get('avr_vocab_snapshot')`；确认 `backup.avr_vocab_snapshot.schemaVersion === 2`。
2. 用户运行 `copy(JSON.stringify(backup))`，将剪贴板内容保存为自己选择的本地只读备份文件；该文件只在其本机保留，不提交仓库、不发送远端。
3. 用户把该文件的完整内容粘贴回同一 DevTools，赋给 `const backupJson = '…'` 后运行 `const parsed = JSON.parse(backupJson)`；确认 `parsed.avr_vocab_snapshot.schemaVersion === 2`，且 `JSON.stringify(parsed) === JSON.stringify(backup)`，以验证备份可解析并保留原 schema 2 内容。
4. 记录备份文件位置与校验结果后，才允许用户让该真实 profile 启动 schema 3 构建；不实现、也不尝试原地 3→2 降级。若任一步失败，停止升级，保留原 profile 与备份。

T2 的自动化证据是 schema 2 fixture 经实际 worker/storage 路径迁移到 v3；它不替代上述真实 profile 人工发布门。

**反过度设计检查**：
- 每词只留最新一条证据，不存历史、不做事件溯源；
- 迁移并入现有 `migrateSnapshot`，不建框架/registry/降级；
- 不新增 CoreSet 或 resolver 层；
- 不引入 repository/service/controller、事件总线、mock-only seam；
- 不建设通用 canonical resolver、migration registry、通用迁移框架、CoreSet 抽象层、测试历史、事件溯源、新 facade。

**真实验证命令**：
```bash
npm run typecheck
npm test
python3 tests/test_build_ecdict_core.py -v   # 正确命令；Codex 已在本仓库真实运行 9/9 通过
npm run build
npm run test:e2e   # 含 §21 场景 3 局部断言
```
> 禁止使用 `python3 -m unittest tests.test_build_ecdict_core`（当前仓库真实失败：ModuleNotFoundError: No module named 'tests.test_build_ecdict_core'）。

**完成定义**：
- 九条行为验收各有真实测试或人工门证据；
- `npm run typecheck`、`npm test`、`python3 tests/test_build_ecdict_core.py -v`、`npm run build` 通过；
- E2E 局部场景真实 Chrome 通过；
- R-MIG-8 已**定义**备份步骤与 schema 2 fixture 验证（不要求本票内操作真实 profile）；
- 未新建任何被禁抽象层。

## Acceptance criteria

- [x] `went/going/gone` → wordKey=`go` 共享状态与提示；`could` 独立于 `can`。
- [x] 页面 `data-word` 输出 wordKey；标记任一屈折形式后同 wordKey 其他词形提示一致变化。
- [x] manual 不创建、不修改、不删除 `AssessmentEvidence`。
- [x] 首测作答同时写 `WordState(initial)` 与 `AssessmentEvidence(initial, assessedAt=作答时刻)`；同词再测整条覆盖。
- [x] 迁移：surface 状态并入 core wordKey；无法映射的旧 key 保守保留。
- [x] 迁移：冲突按 `updatedAt` → `manual` → `learning` 三层仲裁。
- [x] 迁移：按下标配对 `initialTest.plan.questions` + `answers` 重建证据，`assessedAt=0`，不用 `Date.now`/`lastUpdated`/`WordState.source` 反推；部分首测只恢复已答题；损坏或越界跳过；manual `WordState` 不被覆盖。
- [x] 迁移：`auditMarkers` 清空、`auditPlan=null`、`auditLog` 保留不转换。
- [x] 迁移确定、纯函数、幂等，一次持久化写入；对已是 v3 的快照恒等。

## 完成记录（归档）

- **完成日期**：2026-08-02
- **合并 commit**：`6f5272b`（main 当前 tip）
- **审查结论**：Codex 实施并合并 main；用户 2026-08-02 显式确认 01/02 完成并通过审查，授权纳入版本库
- **验证**：`npm run typecheck` / `npm test` / `python3 tests/test_build_ecdict_core.py -v`（9/9）/ `npm run build` / 真实 Chrome E2E（§21 场景 3）全绿
- **范围回顾**：wordKey 身份、AssessmentEvidence 双写、schema 2→3 纯迁移（v2→v3 四步）、R-MIG-8 备份步骤已定义未执行（留待 T5 全绿后 T6 真实 profile 发布门）；未建任何被禁抽象层
