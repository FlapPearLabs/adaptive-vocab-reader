# V0.1 FINAL DOGFOOD（实施后验收门 · 本阶段只表示、不执行）

| 项 | 值 |
|---|---|
| 门 ID | `V0.1 FINAL DOGFOOD` |
| 位置 | 位于**全部已批准 UX 实施切片通过 fresh 自动化门禁之后**（`DEC-5 = IMPLEMENT_UX_DELTA_THEN_MANUAL_DOGFOOD`） |
| 当前状态 | **READY_TO_START**（已通过集成 snapshot `5cea02e286a852c8407fc2cafefbc389236bf016` 满足自动化前置条件） |
| 是否阻塞实施开始 | **否**（DEC-5 明确：不得要求先对已知将被取代的 UI 做人工 dogfood） |
| 是否阻塞 V0.1 最终验收 | **是** |

---

## 1. 前置条件（全部满足才进入本门）

1. `T-VUX-1` / `T-VUX-2` / `T-VUX-3` / `T-VUX-4` 全部完成；
2. 每票都 fresh 复跑并通过：`typecheck` exit 0 · `npm test` ≥283 · Python data tests 12 · `npm run build` · `AVR_E2E_NO_SANDBOX=1 npm run test:e2e` = `E2E ALL PASS`；
3. 延后项审计通过：无「本页」、无 Settings 实现痕迹。

## 2. 门内检查项

| # | 检查 | 判据 |
|---|---|---|
| 1 | **真人 dogfood** | 连续 7 天、每天至少阅读一篇真实英文网页、累计 ≥20 篇（固定门槛，非建议值） |
| 2 | **三项人工数字** | 不必要提示 / 释义不可用 / 覆盖缺失；每篇最多人工抽查 20 个相关词；同时记录状态与进度是否丢失、估计是否可读懂且有用 |
| 3 | **`R-MIG-8` 真实 profile 备份 / 校验** | 适用时执行；备份真实 profile 后验证升级与迁移路径 |
| 4 | **隐私与存储检查** | 快照不含 URL / 域名 / 页面标题 / 正文 / 句子 / 浏览历史；无日志、遥测、上报 |
| 5 | **阅读 UX 检查** | 琥珀视觉族（light 点线 / learning 实线）、行内释义首现契约与 `{posPrefix}{translation}`、Inspection Popover（词头/音标/词性/释义 + 会/不会）、Esc 与外部点击关闭、拖选胶囊居中文案 |
| 6 | **测评流程** | 首测（四选一 + 独立「不确定」+ 进度）、每日校准轮、完成态、估计展示（单点 + 保守范围 + 不做外推） |
| 7 | **生词本** | 搜索筛选、状态切换、中文空状态、「已掌握」不写 `AssessmentEvidence` |
| 8 | **元数据失败行为** | 显示 `释义暂不可用`；**零 `WordState` 写入**；不得伪装成 known/learning/unknown |
| 9 | **宿主页面干扰检查** | 排版继承、零布局位移、`layoutShiftScore` 0、滚动与选择行为正常 |

## 3. 结果处理

- 用户**明确接受** → V0.1 验收；之后才评估测评包扩容（约 10,000 词）或重启延后候选。
- 用户**未明确接受** → 不讨论扩容；缺陷回到对应实施 ticket 的后续修复票（append-only，不改已完成提交的语义）。

## 4. 边界（不得混淆）

- **ECDICT 中文释义公开再分发权利链**是**独立的发布阻断项**（`RULES.md` 待确认项），与本地 V0.1 dogfood readiness **不是同一件事**：dogfood 通过**不解除**发布阻断；权利链未决也**不阻塞**本地 dogfood。
- 本门不因任何 UX 或工具链工作而放宽门槛。
- `SPIKE-CHROME-DEVPROFILE` 可在实施/审查期间提供交互式验证，但**不得替代**本门的真人 dogfood 与三项人工数字。
