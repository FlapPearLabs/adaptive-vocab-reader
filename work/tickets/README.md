# 本地 ticket 索引与状态声明

## 状态声明（2026-09-10，PHASE-SPEC-INT）

**本目录下所有 ticket 批次均为历史 execution packet，不是实时 status board。**

原因：RESUME-01（2026-09-09 fresh worktree + 真实 Chrome E2E 全绿）已验证，以下批次的 ticket **均已实现并验证**，但文件体内的 `Status` 字段仍停留在撰写当时的状态（`ready-for-agent` /「待用户授权后进入开发」/「未授权开发」）：

| 批次 | Ticket | 文件内 Status | 实际状态（fresh 验证） |
|---|---|---|---|
| `2026-07-31-v0.1-realign` | 01 / 02 / 03 / 04 / 05 | `ready-for-agent` | implemented + verified |
| `2026-07-31-v0.1-realign` | 06 人工 dogfood 门 | `ready-for-agent` | **未执行**（RULES 产品验收门，仍 OPEN） |
| `2026-08-05-v0.1-ux-enhancements` | T-UX-1 / T-UX-2 | `ready-for-agent` | implemented + verified |
| `2026-08-07-v0.1-query-hint-decoupling` | T-QD-1 / T-INT-2 / T-UNR-3 / T-HINT-4 / T-SEL-5 / T-NB-6 / T-PERF-7 / T-PERF-7A | 「待用户授权后进入开发」 | implemented + verified |
| `2026-09-04-restart` | RESUME-01 | 已完成 | 已完成，分支 `governance/restart-baseline-2026-09-04` |

**因此：**

1. 不得凭 `Status: ready-for-agent` 或未授权字样重复施工已实现能力；
2. 不得凭本目录判断当前还缺什么——当前实现真相以 [`docs/CURRENT_IMPLEMENTATION_BASELINE.md`](../../docs/CURRENT_IMPLEMENTATION_BASELINE.md) 为准；
3. ~~该 backlog 在 `PHASE-DEC-1` 裁决前不具备拆票资格~~ —— **`DEC-1`~`DEC-5` 已于 2026-09-10 全部 CLOSED**（`PHASE-DEC-TICKETS`），集成规格 §7 的 backlog **已具备拆票资格**；
4. 本目录文件保留原样存史，**不删除、不回改 Status**，以免抹掉当时的授权边界证据。

## 当前活跃批次（2026-09-10，PHASE-DEC-TICKETS）

| 批次 | Ticket | 状态 |
|---|---|---|
| [`2026-09-10-v0.1-ux-delta`](2026-09-10-v0.1-ux-delta/README.md) | `T-VUX-1` Reading Presentation Integrity（D-1/4/5/6） | `READY_FOR_AGENT_IMPLEMENTATION` — **待用户「开始开发」授权** |
| | `T-VUX-2` Word Inspection Popover（D-2/3） | blocker：`T-VUX-1` |
| | `T-VUX-3` Selection Recovery Pill（D-7） | 无 blocker |
| | `T-VUX-4` Popup V0.1 Alignment（D-8/9/10） | 无 blocker |
| | `SPIKE-CHROME-DEVPROFILE`（工具链候选，非产品） | `CANDIDATE` — 未授权 |
| | 延后：本页 / This Page（DEC-4）、Settings（DEC-2） | **不在本批** |
| | `V0.1 FINAL DOGFOOD`（实施后验收门） | 未启动 |

**判断当前还缺什么，只能看上述活跃批次与 [`docs/CURRENT_IMPLEMENTATION_BASELINE.md`](../../docs/CURRENT_IMPLEMENTATION_BASELINE.md)；不得凭历史批次的 `Status` 字段推断。**
