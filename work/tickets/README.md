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
3. 当前唯一的 backlog 来源是 [`docs/specs/2026-09-10-V0.1-UX-V1.2.1-集成规格.md`](../../docs/specs/2026-09-10-V0.1-UX-V1.2.1-集成规格.md) §7，且该 backlog 在 `PHASE-DEC-1` 裁决前不具备拆票资格；
4. 本目录文件保留原样存史，**不删除、不回改 Status**，以免抹掉当时的授权边界证据。
