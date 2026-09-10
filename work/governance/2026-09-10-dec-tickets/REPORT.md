# PHASE-DEC-TICKETS 报告 — 权威快照修复 + UX 裁决 + 实施 ticket 分解

| 项 | 值 |
|---|---|
| 阶段 | `PHASE-DEC-TICKETS — Authority Snapshot Repair + UX Decisions + Implementation Ticket Decomposition` |
| 类型 | DOCUMENT / GOVERNANCE / TICKET-DECOMPOSITION（**无产品代码变更**） |
| 日期 | 2026-09-10 |
| 分支 | `governance/ux-spec-integration-2026-09-10` |
| 起始 HEAD | `c2a8b21e3fa9c8d9e2be759b746760472b64f294` |
| 结果 HEAD | 见 §9 |

---

## 1. REMOTE_TRUTH

| 项 | 期望 | 实测 | 判定 |
|---|---|---|---|
| 集成分支 `governance/ux-spec-integration-2026-09-10` | `c2a8b21e3fa9c8d9e2be759b746760472b64f294` | `c2a8b21e3fa9c8d9e2be759b746760472b64f294` | **一致**（未触发基线漂移停止） |
| live `origin/main` | `58a86f77b0358a96c04e7e07baa9900f33186813` | `58a86f77b0358a96c04e7e07baa9900f33186813` | **一致** |
| `merge-base`(集成, main) | — | `333c3628c5adabd1d69f96b9043eb7a109825eb0` | 符合预期（RESUME-01 基线） |
| main 相对治理基线 `d5fa144` 的新增 | — | `e4f947b`、`58a86f7`（均 **docs-only**：新增并格式化冻结 UX 文档） | **同范围、docs-only** |
| 生产代码基线 `247ef89` 是否仍为 main 祖先 | — | **YES** | **无生产代码漂移** |
| `247ef89..origin/main` 非 docs 差异 | — | 仅 `AGENTS.md` +6、`data/README.md` +80（均属 `333c362` 的恢复文档） | **无生产代码变更** |

**结论**：不触发生产代码基线漂移停止；可继续。

## 2. AUTHORITY_SNAPSHOT_REPAIR

### 2.1 缺陷

`c2a8b21` 的集成规格 §1/§2 把 `docs/specs/2026-09-04-UX_SPEC_V1.2.1.md` 作为**冻结上游权威输入**，但该文件当时**只存在于 `origin/main`**，集成分支不可读 → 集成分支**不是自包含权威快照**。

### 2.2 修复动作

```bash
git merge --no-ff origin/main -m "docs(governance): merge main docs-only lineage to restore frozen UX_SPEC_V1.2.1 authority input"
```

| 约束 | 满足情况 |
|---|---|
| 保留已发布历史 | ✅ `--no-ff` 正常合并，双 parent（`c2a8b21`, `58a86f7`） |
| 不 rebase / 不 force-push 既有远端分支 | ✅ 未 rebase、未 force-push |
| 仅用保留祖先的正常操作引入 docs-only main 世系 | ✅ 合并内容仅 `e4f947b` + `58a86f7` |
| 不复制、不改写冻结正文 | ✅ 合并后仅「1 file changed, 274 insertions(+)」，为原始 blob 引入 |
| 只解决真实 docs 冲突 | ✅ 无冲突（'ort' 策略自动合并） |

### 2.3 修复后校验

| 校验 | 结果 |
|---|---|
| 路径可读 | ✅ `docs/specs/2026-09-04-UX_SPEC_V1.2.1.md`（22,673 B / 274 行） |
| SHA-256 | ✅ `d6570918be68189c133ed1fc8756ddd3645aee968a01758f7a81db84548bbcc4`（与 main 一致） |
| blob 一致性 | ✅ HEAD `34c950272537c36a932aea01309b8b7c46cb2959` == main `34c950272537c36a932aea01309b8b7c46cb2959` |
| 冻结状态字串 | ✅ 第 2 行 `**STATUS: DESIGN FROZEN — AUTHORITY RECONCILED — READY FOR REPOSITORY INTEGRATION REVIEW**` |
| 集成规格源链接可解析 | ✅ §1「上游输入」与 §2「外部冻结 UX 文档」两处相对/绝对链接均指向分支内文件 |
| 生产代码是否受影响 | ✅ 无（合并 diff 仅 1 个 docs 文件） |

**判定：`AUTHORITY_SNAPSHOT_SELF_CONTAINED = PASS`**（未触发 `STOP: AUTHORITY_SNAPSHOT_NOT_SELF_CONTAINED`）

## 3. INPUT_UX_SPEC

| 项 | 值 |
|---|---|
| 路径（修复后于本分支可读） | `docs/specs/2026-09-04-UX_SPEC_V1.2.1.md` |
| 引入 commit | `58a86f7`（docs-only；前置 `e4f947b`） |
| 大小 | 274 行 / 22,673 B |
| SHA-256 | `d6570918be68189c133ed1fc8756ddd3645aee968a01758f7a81db84548bbcc4` |
| 状态字串 | 与要求完全一致 |
| 性质 | **输入**，不是仓库权威；不直接据其实现 |

## 4. AUTHORITY_SOURCES（本次 fresh 读取）

`AGENTS.md`（既有，未改）、`RULES.md`（已改）、`CONTEXT.md`、`README.md`、`docs/CURRENT_IMPLEMENTATION_BASELINE.md`、`work/governance/2026-09-04-resume-audit/REPORT.md`、`docs/specs/*`（含冻结 UX 与集成规格）、`work/tickets/*/*`、`extension/src/` 下相关源码与测试、`e2e-verify.cjs`。

**实现真相来源**：RESUME-01 的 fresh 证据；本次另对 10 项 delta 做了 fresh grep 复核（见批次 `VALIDATION-REPORT.md` §2）。**未使用 commit message 推断实现状态。**

## 5. DECISIONS（DEC-1~DEC-5，全部 CLOSED）

| ID | 最终值 | 落地位置 | 影响的 Delta |
|---|---|---|---|
| **DEC-1** | **`AMBER_SYSTEM`** — 克制暖琥珀族；light＝淡琥珀点线、learning＝淡琥珀实线（首现另行内中文释义）；**不得仅因 learning 用红色/刺眼警示色**；`#f59e0b`/`#d97706` 为非规范性参考，除非需要设计 token 否则不写成领域合同 | `RULES.md`「V0.1 呈现层与流程裁决」DEC-1；三条原「红色」规则重标（原文存史）；08-06 规格 7 处加 DEC-1 重标注；集成规格 U-13 改判 `ALREADY_IMPLEMENTED_BUT_UX_DIFFERS`、D-5/D-6 解除阻塞 | D-5 / D-6 |
| **DEC-2** | **`DEFER_SETTINGS_FROM_V0_1`** — 不实现/不渲染 Settings 页签；不建空壳、占位、禁用页签或推测控件 | `RULES.md` DEC-2 + 「明确不做与冻结项」；集成规格 U-37 改判 `OUT_OF_SCOPE`；`DEFERRED-BACKLOG.md` | D-8（移除 Settings） |
| **DEC-3** | **`CHINESE_FIRST`** — 简洁中文文案；**禁中英混排**；内部领域标识符不变 | `RULES.md` DEC-3；集成规格 U-14 / U-43；`T-VUX-2`/`T-VUX-3`/`T-VUX-4` 负向断言 | D-7 / D-10 |
| **DEC-4** | **`DEFER_THIS_PAGE_FROM_V0_1`** — 延后为未来候选；**只延后 popup 的「本页」产品面，不移除阅读面当前页瞬时处理** | `RULES.md` DEC-4 + 「明确不做与冻结项」；集成规格 U-34 改判 `OUT_OF_SCOPE`；`DEFERRED-BACKLOG.md` | D-8（移除本页） |
| **DEC-5** | **`IMPLEMENT_UX_DELTA_THEN_MANUAL_DOGFOOD`** — 已验证基线 → 实施 UX delta → fresh 自动化门禁 → 真人 dogfood → `R-MIG-8` → 最终验收；**不得要求先 dogfood 已知将被取代的 UI** | `RULES.md` DEC-5；集成规格 §9 与 §14.3；`FINAL-DOGFOOD-GATE.md` | 全部 D-* |

**判定：`DECISIONS_CLOSED = PASS`**（集成规格 §10 无未决项）

## 6. SPEC_RECONCILIATION（集成规格更新）

| 变更 | 内容 |
|---|---|
| §1 | 新增：决策状态 CLOSED、ticket 资格 `READY_FOR_TICKET_DECOMPOSITION`、延后候选指针 |
| §2 | 新增：权威快照修复记录（合并 SHA、blob 校验）、冻结文档修复后校验行 |
| §5 | U-13 改判 `ALREADY_IMPLEMENTED_BUT_UX_DIFFERS`（DEC-1）；U-14 去掉中英混排（DEC-3）；U-33 补充 D-8 新范围；U-34 改判 `OUT_OF_SCOPE`（DEC-4）；U-37 改判 `OUT_OF_SCOPE`（DEC-2）；U-43 中文优先（DEC-3） |
| §7 | D-1~D-10 表新增「决策状态」列并标注最终裁定；明确「本批不含新增产品能力」；dogfood 定位为实施后门 |
| §9 | dogfood 条目补 DEC-5 澄清 |
| §10 | 由「未决产品决策」改为「DEC-1~DEC-5 全部 CLOSED」表 |
| §12 | 由 `NOT_READY_FOR_TICKET_DECOMPOSITION` 改为 **`READY_FOR_TICKET_DECOMPOSITION`** + 五条依据 |
| §14（新增） | 延后候选（本页 / Settings）、`V0.1 FINAL DOGFOOD` 验收门、SPIKE 指针 |

**矩阵计数（43 条，决策闭合后重算）**：

| 分类 | 原 | 现 | 变化 |
|---|---|---|---|
| `ALREADY_IMPLEMENTED_AND_VERIFIED` | 23 | **23** | — |
| `ALREADY_IMPLEMENTED_BUT_UX_DIFFERS` | 6 | **7** | +U-13（DEC-1 定琥珀，仅色相差异，归 D-6） |
| `NEW_REQUIRED_CHANGE` | 8 | **7** | −U-34（DEC-4 延后） |
| `CONFLICT_REQUIRES_PRODUCT_DECISION` | 2 | **0** | U-13→DEC-1 闭合；U-37→DEC-2 闭合 |
| `SUPERSEDED_OLD_REQUIREMENT` | 1 | **1** | — |
| `OUT_OF_SCOPE` | 2 | **4** | +U-34（DEC-4）、+U-37（DEC-2） |
| `DOC_ONLY_REALIGNMENT` | 1 | **1** | — |
| `UNKNOWN` | 0 | **0** | — |
| **合计** | 43 | **43** | 分类迁移，总数不变 |

**delta 范围变化**：D-1~D-10 十项仍为 backlog，但 **D-8 的「本页」与「Settings」两部分已被 DEC-4 / DEC-2 移除**，因此本批**不含任何新增产品能力**（唯一新增交互为 D-9 生词本搜索筛选）。

## 7. PRODUCT_RULE_UPDATES

| 文件 | 变更 |
|---|---|
| `RULES.md` | 新增章节「V0.1 呈现层与流程裁决（DEC-1~DEC-5）」共 5 条；三条原「红色强提示 / 红色提示」规则重标为琥珀系（**原文保留存史**，仅标注不得再作为当前配色规范）；「明确不做与冻结项」追加 Settings 与本页两项 |
| `docs/specs/2026-08-06-…解耦规格.md` | 7 处「红色」条款加 **DEC-1 重标注**（词条 `strong hint`/`light hint`、`learning 红色并进入生词本`、`AC-3`、`AC-4`、`R-STATE-2`、`R-STATE-3`）；**原文一律保留**，仅标注配色已改、行为不变 |
| `CONTEXT.md` | 本阶段未改（轻提示定义在 PHASE-SPEC-INT 已更新，DEC-1 只改色相不改语义） |
| `docs/CURRENT_IMPLEMENTATION_BASELINE.md` | 更新「下一阶段」与 UNKNOWN 收敛表（见 §10） |

**未机械重写 `RULES.md`**：仅在与对账矩阵对应的位置做定点修改，其余规则未动。

## 8. TICKET_BATCH

见 `work/tickets/2026-09-10-v0.1-ux-delta/`。

| ID | Ticket | Delta | Blockers |
|---|---|---|---|
| `T-VUX-1` | Reading Presentation Integrity | D-1 / D-4 / D-5 / D-6 | — |
| `T-VUX-2` | Word Inspection Popover | D-2 / D-3 | `T-VUX-1` |
| `T-VUX-3` | Selection Recovery Pill | D-7 | — |
| `T-VUX-4` | Popup V0.1 Alignment | D-8 / D-9 / D-10 | — |

依赖 DAG：`T-VUX-1 → T-VUX-2`（唯一真实边）；`T-VUX-3`、`T-VUX-4` 无 blocker。执行顺序（串行、显式 base commit）：`T-VUX-1 → T-VUX-2 → T-VUX-3 → T-VUX-4`。

**非机械一一对应 D-1~D-10**：D-1/4/5/6 合为 Slice A（同属阅读面呈现与注入样式，行为归属单一）；D-2/3 合为 Slice B（浮层与其取消动作同属一个交互对象）；D-7 单独为 Slice C；D-8/9/10 合为 Slice D（同属 popup）。理由：每个切片的**行为归属单一、文件边界清晰、可独立验收**。

## 9. SPIKE / 延后 / 最终门

| 项 | 位置 | 状态 |
|---|---|---|
| `SPIKE-CHROME-DEVPROFILE` | `work/tickets/2026-09-10-v0.1-ux-delta/SPIKE-CHROME-DEVPROFILE.md` | `CANDIDATE`（未授权、未启动）；**非产品、不阻塞分解**；硬约束：不得改产品语义、不得替换 `e2e-verify.cjs`（E2E＝确定性回归门，DevTools MCP＝交互调查，二者互补）；建议完成于最终 dogfood 之前 |
| 延后：本页 / This Page | `DEFERRED-BACKLOG.md` | DEC-4 延后；本批禁止实现；不移除阅读面当前页瞬时处理 |
| 延后：Settings | `DEFERRED-BACKLOG.md` | DEC-2 明确不做；本批禁止实现 |
| `V0.1 FINAL DOGFOOD` | `FINAL-DOGFOOD-GATE.md` | **只表示、不执行**；位于实施 + fresh 自动化门禁之后；9 项检查；ECDICT 权利链为独立发布阻断项，不得与 dogfood readiness 混淆 |

## 10. BATCH_VALIDATION

见 `work/tickets/2026-09-10-v0.1-ux-delta/VALIDATION-REPORT.md`。13 项检查全 PASS，含：无重复实现（10 项 delta fresh grep 均未实现）、无依赖环、无行为同权、无已取代要求复活、无本页/Settings 实现、无红色重引入、无中英混排、测评契约未被重设计、元数据失败未变成 `WordState`、无新 schema、E2E 未被 MCP 替换、dogfood 未错误阻塞实施开始。

**判定：`TICKET_BATCH_VALIDATION = PASS`**

## 11. FINAL VERDICTS

| 判定项 | 结果 |
|---|---|
| `AUTHORITY_SNAPSHOT_SELF_CONTAINED` | **PASS** |
| `DECISIONS_CLOSED` | **PASS** |
| `NO_PRODUCT_CODE_CHANGED` | **PASS**（本次仅 docs / work 文档；`extension/`、`tests/`、`scripts/`、`data/` 零改动） |
| `NO_SUPERSEDED_WORK_REINTRODUCED` | **PASS**（二元 `Need Gloss` 模型、`detailZh`/`nuance`/`ipa`/`zh` 字段、红色强提示均仅以「禁止」出现） |
| `TICKET_BATCH_VALIDATION` | **PASS** |
| `READY_FOR_AGENT_IMPLEMENTATION` | **PASS**（待用户「开始开发」授权；ticket 不自带授权） |

## 12. FILES_CHANGED

新增：`work/tickets/2026-09-10-v0.1-ux-delta/{README.md,01-reading-presentation-integrity.md,02-word-inspection-popover.md,03-selection-recovery-pill.md,04-popup-v0-1-alignment.md,SPIKE-CHROME-DEVPROFILE.md,DEFERRED-BACKLOG.md,FINAL-DOGFOOD-GATE.md,VALIDATION-REPORT.md}`、`work/governance/2026-09-10-dec-tickets/REPORT.md`、本报告所依赖的 `docs/specs/2026-09-04-UX_SPEC_V1.2.1.md`（**由保留祖先的合并引入，非复制**）

修改：`RULES.md`、`docs/specs/2026-09-10-V0.1-UX-V1.2.1-集成规格.md`、`docs/specs/2026-08-06-V0.1-查询交互提示与测评词包解耦规格.md`、`docs/CURRENT_IMPLEMENTATION_BASELINE.md`、`work/tickets/README.md`

## 13. NEXT_RECOMMENDED_PHASE

**唯一推荐：`PHASE-IMPL-T-VUX-1` —— 实施 `T-VUX-1`（Reading Presentation Integrity，D-1/D-4/D-5/D-6）**。

- 它是批次中唯一无 blocker 的起始切片，也是 `T-VUX-2` 的前置；
- 范围限于阅读面呈现（注入样式 + tooltip 兜底 + 行内释义 + 琥珀下划线），不触碰领域契约与持久化；
- 完成后方可进入 `T-VUX-2`；`T-VUX-3`/`T-VUX-4` 按串行顺序随后；
- `SPIKE-CHROME-DEVPROFILE` 可并行评估（需单独授权、单独分支），但不得与实施 ticket 共用分支；
- 全部切片完成并通过 fresh 自动化门禁后，才进入 `V0.1 FINAL DOGFOOD`。

**本阶段未开始任何实施。**
