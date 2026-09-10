# Ticket 批次：V0.1 UX Delta（2026-09-10）

## 批次状态

| 项 | 值 |
|---|---|
| 批次 ID | `2026-09-10-v0.1-ux-delta` |
| 状态 | **`READY_FOR_AGENT_IMPLEMENTATION`（待用户明确「开始开发」授权；ticket 本身不授权开发）** |
| 上游规格 | [`docs/specs/2026-09-10-V0.1-UX-V1.2.1-集成规格.md`](../../docs/specs/2026-09-10-V0.1-UX-V1.2.1-集成规格.md) |
| 上游裁决 | `DEC-1`~`DEC-5` 全部 CLOSED（落点 `RULES.md`「V0.1 呈现层与流程裁决」） |
| 文档基线 | `f22dd62730844cd63009d73bb1ea1dbf09f50904`（`governance/ux-spec-integration-2026-09-10`，已含冻结 UX 输入） |
| 生产代码基线 | `247ef89f45df5c623c1de768d098230600de9498`（`origin/main` 上最后一次生产代码变更；`333c362`/`e4f947b`/`58a86f7` 均为 docs-only） |
| 已验证实现基线 | RESUME-01（2026-09-09）：typecheck 0 / vitest 283 / Python data tests 12 / build OK / `E2E ALL PASS` |
| 批次校验报告 | [`VALIDATION-REPORT.md`](VALIDATION-REPORT.md) |

## Ticket 清单

| ID | Ticket | 文件 | 覆盖 Delta | Blockers |
|---|---|---|---|---|
| `T-VUX-1` | Reading Presentation Integrity | [`01-reading-presentation-integrity.md`](01-reading-presentation-integrity.md) | D-1 / D-4 / D-5 / D-6 | — |
| `T-VUX-2` | Word Inspection Popover | [`02-word-inspection-popover.md`](02-word-inspection-popover.md) | D-2 / D-3 | `T-VUX-1` |
| `T-VUX-3` | Selection Recovery Pill | [`03-selection-recovery-pill.md`](03-selection-recovery-pill.md) | D-7 | — |
| `T-VUX-4` | Popup V0.1 Alignment | [`04-popup-v0-1-alignment.md`](04-popup-v0-1-alignment.md) | D-8 / D-9 / D-10 | — |

非产品工具候选（独立，不属本批执行序列）：[`SPIKE-CHROME-DEVPROFILE.md`](SPIKE-CHROME-DEVPROFILE.md)

延后项（**不在本批**）：[`DEFERRED-BACKLOG.md`](DEFERRED-BACKLOG.md)
最终验收门（**本阶段不执行**）：[`FINAL-DOGFOOD-GATE.md`](FINAL-DOGFOOD-GATE.md)

## 依赖 DAG

```text
                 ┌──────────────┐
                 │   T-VUX-1    │  Reading Presentation Integrity
                 │ D-1/4/5/6    │  (content 注入样式 + tooltip 兜底 + 领域术语)
                 └──────┬───────┘
                        │ blocker（T-VUX-2 的浮层必须渲染 T-VUX-1 定义的
                        │          「释义暂不可用」兜底文案）
                        ▼
                 ┌──────────────┐
                 │   T-VUX-2    │  Word Inspection Popover
                 │   D-2 / D-3  │  (复用 calculateTooltipPosition)
                 └──────────────┘

        ┌──────────────┐                    ┌──────────────┐
        │   T-VUX-3    │                    │   T-VUX-4    │
        │     D-7      │                    │ D-8/9/10     │
        │ (pageScanner)│                    │   (popup)    │
        └──────────────┘                    └──────────────┘
             无 blocker                          无 blocker
```

**依赖只有一条真实边**：`T-VUX-2 ← T-VUX-1`。理由：T-VUX-2 的浮层验收包含「元数据缺失时显示 `释义暂不可用`」，该文案与 `METADATA_RESOLUTION_FAILURE` 术语由 T-VUX-1 定义。**T-VUX-2 只消费、不重新定义。**

## 执行顺序（串行，显式 base commit）

项目约定 ticket 串行执行、每票显式 base commit（规避 `e2e-verify.cjs` 冲突）。因此执行顺序为：

```text
T-VUX-1  →  T-VUX-2  →  T-VUX-3  →  T-VUX-4
```

- **T-VUX-1** base commit = 施工前 `git fetch` 确认的 `origin/main`（预期 `58a86f77b0358a96c04e7e07baa9900f33186813`）。
- **T-VUX-2/3/4** base commit = 上一票合并后的 HEAD（逐票前进）。
- T-VUX-3 / T-VUX-4 虽然**无 blocker**，仍排在 T-VUX-1/2 之后：T-VUX-3 与 T-VUX-1 共用 `content` 注入样式块，串行顺序用于避免同文件冲突，**不是验收依赖**。

## 批次级硬约束（每票继承）

1. **不改生产语义契约**：`WordState` / `wordKey` / `DictEntry` / `QuizQuestion` / `QuizAnswer` / `AssessmentEvidence` / 隐私边界一律不变。
2. **不新增持久化 schema、不做存储迁移**（D-1~D-10 均不需要）。
3. **不实现「本页 / This Page」**（DEC-4）与 **Settings**（DEC-2）。
4. **不使用红色警示色**表示 learning（DEC-1）；`light`＝淡琥珀点线、`learning`＝淡琥珀实线。
5. **用户可见文案中文优先**（DEC-3），禁止 `Mark as Learning · 不会` 这类中英混排。
6. **不重命名代码/领域标识符**以翻译 UI 文案（`known`/`learning`/`unknown`/`QuizQuestion` 等保持不变）。
7. **不移除阅读面已需要的当前页瞬时处理**（扫描 / 解析 / 标注 / 选区 / 浮层）。
8. **不替换既有确定性 E2E**（`e2e-verify.cjs`）为 MCP 驱动流程；二者互补（见 SPIKE）。
9. **不把元数据解析失败建模为词汇学习状态**（`METADATA_RESOLUTION_FAILURE` 与 `WordState` 正交）。
10. **人工 dogfood 是实施后的验收门，不是前置门**（DEC-5）；任何 ticket 不得等待 dogfood 才开始。

## 门禁（每票必须 fresh 复跑）

```bash
npm run typecheck
npm test
python3 -B -m unittest discover -s tests -p "test_*.py"
npm run build
AVR_E2E_NO_SANDBOX=1 npm run test:e2e
```

基线：typecheck exit 0 · vitest 283 passed · Python 12 passed · build 成功 · `E2E ALL PASS`。**任何一项低于基线即 FAIL。**
