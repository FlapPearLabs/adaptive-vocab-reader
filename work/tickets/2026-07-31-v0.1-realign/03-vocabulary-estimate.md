# 03 — 首测词汇量估计展示

**权威来源**：
- [V0.1 重新对齐规格](../../../docs/specs/2026-07-30-V0.1-重新对齐规格.md)
- [RULES.md](../../../RULES.md)
- [ADR-0004](../../../docs/adr/0004-词汇键与测试证据分离.md)

**What to build**：做完 50 题后第一次看到「你大概认识 XXX 个词，保守范围 XX–XX」，并清楚知道这是基于当前 1,000 词包、不做外推。

**Blocked by**：02 — wordKey、AssessmentEvidence 与 schema 3 原子落地

**Status:** ready-for-agent

**用户可见收益**：做完 50 题后第一次看到「你大概认识 XXX 个词，保守范围 XX–XX」，并清楚知道这是基于当前 1,000 词包、不做外推。

**目标**：把 `AssessmentEvidence` 变成用户看得懂的估计输出。

**主责任 Requirement ID**：R-EST-1～R-EST-7

**依赖和 blocker**：
- 依赖：T2。
- Blocker：T2 —— 估计只能由 `AssessmentEvidence` 派生；没有证据字段就会被迫回退到读 `WordState`，直接违反 GR-01 / CR-01。硬依赖。

**范围**：
- 十频段加权点值；
- 双侧 90% Wilson 的显示用保守范围（z = Φ⁻¹(0.95) ≈ 1.6448536269514722）；
- unavailable 行为（首测未完成 / 任一频段零有效证据 / 多频段零证据 → 返回 unavailable 并显示「完成或重新完成首测后可查看估计」，不显示 0 或 NaN，零样本频段不按 0 掌握）；
- 结果页点值、范围和「基于当前 1,000 词覆盖估计，不做外推」声明；
- manual 不影响 `AssessmentEvidence` 派生的估计。

**明确非目标**：
- 不外推总体词汇量、不输出 CEFR、不声称「90% 置信区间」或总体覆盖率；
- 范围不驱动自动隐藏/审计/Pool B/漏提示阈值/状态改写；
- 不恢复 Beta/PAV 概率画像；
- 不做估计历史或趋势图；
- 不建设通用统计层、概率画像、估计历史、CEFR 或总体词汇量外推；
- 不预先强制创建新实现文件（在 strategy 领域决策边界内提供可独立测试的估计纯函数 seam；具体放入现有模块还是独立文件，由实现阶段按最小清晰改动原则决定）。

**预计影响的模块责任**（仅作定位依据，不强制发明新文件/facade/service）：
- `extension/src/strategy/index.ts` + 估计领域决策逻辑（不预先强制创建新实现文件）：在 strategy 领域决策边界内提供可独立测试的估计纯函数 seam；具体放入现有模块还是独立文件，由实现阶段按最小清晰改动原则决定。
- `extension/src/shared/types.ts`：估计输出类型（可选）。
- `extension/src/popup.ts`、`popup.html`/`popup.css`：首测结果页展示点值 + 保守范围 + 不外推声明。
- `e2e-verify.cjs`：§21 场景 5、6 数值与文案断言。

**Requirement → behavior → test seam**：

| Requirement | Behavior | Test Seam |
|---|---|---|
| R-EST-1 | 50 题完成后显示点值与范围 | E2E 结果页断言（§21 场景 5） |
| R-EST-2 | manual 标记不改变估计输出 | strategy 单测 |
| R-EST-3 | unsure 证据计 learning | strategy 单测 |
| R-EST-4 | 十频段加权正确；unavailable 与钳制边界 | strategy 单测（含边界用例） |
| R-EST-5 | Wilson 数值正确（硬编码期望值 + 合理浮点 tolerance；测试不得复制生产算法或复用生产计算结果） | strategy 单测 |
| R-EST-6 | UI 无「90% 置信区间」/CEFR 字样，有不外推声明 | E2E 文案断言（§21 场景 6） |
| R-EST-7 | 词包大小为参数，换包不改算法 | strategy 单测 |

**数据、迁移或隐私风险**：无 schema 变更。主要风险是把显示用范围误读成统计保证，由 R-EST-6 的 UI 文案断言锁定。

**失败行为**：估计算法本身为纯函数、确定性；unavailable 时不渲染任何数值，避免 0/NaN 误导。

**反过度设计检查**：
- Wilson 只用于显示，不驱动任何自动行为；
- 不建概率画像、不存估计历史、不建通用统计层；
- 不引入 repository/service/controller、事件总线、mock-only seam。

**真实验证命令**：
```bash
npm run typecheck
npm test
npm run build
npm run test:e2e   # 含 §21 场景 5、6 数值与文案断言
```

**完成定义**：
- 七条行为验收有真实测试（strategy 纯函数单测 + 真实 Chrome E2E 文案/数值断言）；
- typecheck / 单测 / build 通过；
- E2E 局部场景真实 Chrome 通过；
- UI 文案经断言锁定，确认无「90% 置信区间」「CEFR」字样。

## Acceptance criteria

- [ ] 完成 50 题后结果页同时显示点值与保守范围。
- [ ] 之后在页面手动标记若干词，估计输出不变。
- [ ] unsure 证据计 learning（未掌握）。
- [ ] 十频段加权正确；首测未完成 / 任一频段零有效证据 / 多频段零证据 → 返回 unavailable 并显示「完成或重新完成首测后可查看估计」，不显示 0 或 NaN，零样本频段不按 0 掌握；结果钳制 0–1000。
- [ ] Wilson 数值正确：`knownCount=3, testedCount=5, z=1.6448536269514722` → `low≈0.27248317186619286`、`high≈0.857293527980787`；总体满足 `low ≤ point ≤ high`。
- [ ] UI 无「90% 置信区间」「CEFR」字样，含「基于当前 1,000 词覆盖估计，不做外推」声明。
- [ ] 词包大小是参数，换包不改算法。
