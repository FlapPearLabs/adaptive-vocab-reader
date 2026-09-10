# 延后候选（V0.1 之外）—— 本批 ticket 不得实现

本文件记录由 `DEC-2` 与 `DEC-4` 明确延后的两项。**它们不是 backlog，不得被任何本批 ticket 实现。**

---

## 1. 本页 / This Page（`DEC-4 = DEFER_THIS_PAGE_FROM_V0_1`）

| 项 | 内容 |
|---|---|
| 能力 | popup 中展示「当前页面命中的词汇」列表（页面级词表产品面） |
| 状态 | **延后为 V0.1 之后候选** |
| 延后理由 | 它是 D-1~D-10 中**唯一真正的新增产品能力**；完成冻结 UX 的阅读 / 查询 / 生词本 / 测评交互对齐并不依赖它 |
| 来源 | 集成规格 U-34（已由 `NEW_REQUIRED_CHANGE` 改判 `OUT_OF_SCOPE`）；`RULES.md`「V0.1 呈现层与流程裁决」DEC-4 |
| **不延后的部分** | 阅读面已需要的**当前页瞬时处理**（扫描、`wordKey` 解析、标注、选区、tooltip / 浮层）**保持不变**。任何 ticket 不得以「本页已延后」为由移除或削弱它 |
| 本批落地约束 | `T-VUX-4` 明确禁止实现本页页签；批次校验逐票检索「本页 / This Page」命中 |
| 重启条件 | V0.1 最终验收（`FINAL-DOGFOOD-GATE.md`）通过后，由产品**重新授权**；届时需要新 Spec 与独立 ticket 批次，不得搭本批顺风车 |

## 2. Settings（`DEC-2 = DEFER_SETTINGS_FROM_V0_1`）

| 项 | 内容 |
|---|---|
| 能力 | popup 的 Settings 页签与设置持久化 |
| 状态 | **V0.1 明确不做** |
| 禁止范围 | Settings 页签、**任何**设置持久化 schema、空壳页签、禁用占位页签、推测性设置控件 |
| 延后理由 | 外部 UX 自身把该页签下**所有**设置项标为 `OPEN / NOT AUTHORIZED`（集成规格 U-39），页签无内容可呈现 |
| 当前事实 | 仓库无任何设置持久化；`storage.ts` 无 settings 键；无 Settings 页签 |
| 来源 | 集成规格 U-37（已由 `CONFLICT` 改判 `OUT_OF_SCOPE`）；`RULES.md` DEC-2 与「明确不做与冻结项」 |
| 本批落地约束 | `T-VUX-4` 明确禁止；批次校验逐票检索 settings 命中 |
| 重启条件 | **单独的产品授权** + 新 Spec / ticket |

---

## 3. 如何防止误实现

本批四张 ticket 的「负向断言」均包含对应禁止项，且批次 `VALIDATION-REPORT.md` 会做以下检索确认：

- 任一 ticket 正文出现「本页 / This Page」作为**待实现范围** → FAIL；
- 任一 ticket 出现 Settings 作为**待实现范围** → FAIL；
- 任一 ticket 以「本页延后」为由移除阅读面当前页处理 → FAIL。
