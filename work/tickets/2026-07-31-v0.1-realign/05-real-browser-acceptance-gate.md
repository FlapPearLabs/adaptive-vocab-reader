# 05 — 真浏览器综合验收门

**权威来源**：
- [V0.1 重新对齐规格](../../../docs/specs/2026-07-30-V0.1-重新对齐规格.md)
- [RULES.md](../../../RULES.md)
- [ADR-0004](../../../docs/adr/0004-词汇键与测试证据分离.md)

**What to build**：拿到的是真实可加载的 Chrome 扩展，而不是「单测全绿」的承诺；旧数据升级、关掉浏览器再打开、两个标签页同时开着，状态都不会错。

**Blocked by**：01 — 切断 V0.1 审计用户路径；02 — wordKey、AssessmentEvidence 与 schema 3 原子落地；03 — 首测词汇量估计展示；04 — 每日五题校准轮

**Status:** ready-for-agent

**用户可见收益**：拿到的是真实可加载的 Chrome 扩展，而不是「单测全绿」的承诺；旧数据升级、关掉浏览器再打开、两个标签页同时开着，状态都不会错。

**目标**：在真实交付路径上一次性锁定完整闭环，并给出能否进入人工 dogfood 的结论。

**主责任 Requirement ID**：本票**不持有任何 R-\* 主责任**。它主责批准 Spec §21 的综合真实浏览器验收，复核 T1～T4 已有 Requirement，但**不得重新取得其主责任**（主责任归属保持不变：T1=R-AUD、T2=R-KEY/R-EVD/R-MIG、T3=R-EST、T4=R-EVD/R-DLY）。

**依赖和 blocker**：
- 依赖：T1、T2、T3、T4。
- Blocker：T1、T2、T3、T4 全部完成（硬依赖）。

**范围（严格限于允许的六项）**：
- 真实 Chrome 扩展交付路径（加载 build 产物）；
- 真实 schema 2 fixture 经真实 worker/storage 路径升级到 v3；
- 浏览器重启后持久化（同时验证 `WordState`、`AssessmentEvidence`、`DailyTestState`、`completedRoundIndex`、`schemaVersion=3`）；
- 两个真实标签页含同一 wordKey 不同词形时 manual / daily 更新后同步；
- Spec §5 完整用户闭环回归；
- dogfood 前放行结论。

**明确非目标**：
- 不承担 T1–T4 本应完成的单元测试、迁移单测或局部 E2E 场景；
- 不新增产品功能；
- 不为冻结 audit 补测试；
- 不建 CI 平台、报告 dashboard 或遥测；
- 不重新取得 T1–T4 的 R-\* 主责任。

**预计影响的模块责任**（仅作定位依据）：
- `e2e-verify.cjs`：§21 场景升级。
- `build.mjs` / dist 产物：真实构建产物加载。
- `tests/fixtures/`：新增真实 schema 2 快照 fixture（隔离、不触碰真实 profile）。
- `package.json`：`test:e2e` 脚本。

**§21 场景 → 来源 Ticket → R-ID 复核矩阵**：

| §21 场景 | 复核内容 | 来源 Ticket | 主责任 R-ID |
|---|---|---|---|
| 1 | 加载真实扩展构建产物 | T5（交付路径本身） | — |
| 2 | 静态正文与 SPA 阅读标注（既有阅读闭环基线回归） | T5（既有阅读闭环基线回归） | — |
| 3 | 屈折词形共享 wordKey（标记 went，going 同步变化） | T2 | R-KEY-1, R-KEY-3 |
| 4 | 完成 50 题首测 | T1 + T2 | R-AUD-3, R-EVD-2 |
| 5 | 结果页显示点估计＋保守范围＋不外推声明 | T3 | R-EST-1, R-EST-6 |
| 6 | manual 改提示但估计不变 | T2 + T3 | R-EVD-1, R-EST-2 |
| 7 | 首测未完成无每日入口、不创建 DailyTestState；完成后才出现 | T4 | R-DLY-5 |
| 8 | 完成每日五题 | T4 | R-DLY-1, R-DLY-2 |
| 9 | 每日答案更新状态与估计 | T4 | R-DLY-4 |
| 10 | 首题前跳过零变化 | T4 | R-DLY-6 |
| 11 | 同日关闭/重开 popup 暂停恢复 | T4 | R-DLY-7 |
| 12 | 模拟本地日期变化（date seam 最小注入） | T4 | R-DLY-8 |
| 13 | 跨日已答保留、未答过期 | T4 | R-DLY-8 |
| 14 | 注入真实 schema 2 fixture，经实际 worker/storage 路径升级到 v3 | T2 | R-MIG-1~7 |
| 15 | 刷新与浏览器重启后持久化（WordState/AssessmentEvidence/DailyTestState/completedRoundIndex/schemaVersion=3） | T2 + T4 | R-MIG-7、R-EVD-2/4、R-DLY-2/7/8 |
| 16 | popup 无审计入口 | T1 | R-AUD-1, R-AUD-2 |
| 17 | 阅读不被每日测试阻塞 | T4 | R-DLY-5 |

**Requirement → behavior → test seam**：

| Requirement | Behavior | Test Seam |
|---|---|---|
| （复核）具体复核关系见上方 §21 场景矩阵；T5 不重新取得任何 Requirement 主责任 | §21 全场景综合闭环 | 真浏览器 E2E（最高层验收 seam，纯函数调用不得替代） |

**数据、迁移或隐私风险**：
- E2E 使用独立临时 profile 与 fixture 快照，**不得触碰用户真实 dogfood 数据**；
- **T5 的隔离 E2E 不以真实用户备份已经执行为前置条件**；
- 执行前确认 R-MIG-8 备份步骤已在 T2 定义（不要求本票内已操作真实 profile）。

**失败行为**：任一场景失败 → 输出「不放行」结论并定位失败场景；不掩盖、不降级通过。

**反过度设计检查**：
- 只升级现有 `e2e-verify.cjs`，不引入测试框架迁移、CI 平台或报告系统；
- 不建 dashboard、遥测或日志平台；
- 不重新取得 T1–T4 的 R-\* 主责任。

**真实验证命令**：
```bash
npm run typecheck
npm test
npm run build
npm run test:e2e   # 真实 Chrome 扩展交付路径综合验收
```

**完成定义**：
- 六条行为验收在真实 Chrome 通过并留存证据；
- `npm run typecheck`、`npm test`、`npm run build`、`npm run test:e2e` 全绿；
- 给出「可进入人工 dogfood / 不可进入」的明确结论；
- 复核矩阵中每个场景都能回溯到来源 Ticket 与主责任 R-ID（主责任归属未被改变）。

## Acceptance criteria

- [ ] 从真实构建产物加载扩展并完成闭环。
- [ ] 注入真实 schema 2 快照后经扩展自身 worker/storage 路径升级为 v3（不得只调迁移纯函数冒充）。
- [ ] 浏览器重启后五项持久化断言全通过（WordState、AssessmentEvidence、DailyTestState、completedRoundIndex、schemaVersion=3）。
- [ ] 两标签页同 wordKey 不同词形同步。
- [ ] 闭环回归无回归项。
- [ ] 输出明确放行 / 不放行结论。
