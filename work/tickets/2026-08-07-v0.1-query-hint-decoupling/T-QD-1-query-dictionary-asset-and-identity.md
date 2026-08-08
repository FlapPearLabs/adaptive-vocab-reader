# T-QD-1 — 查询词典资产与身份解耦（数据与构建层）

**权威来源**：
- [查询、交互、主动提示与测评词包解耦规格（已批准）](../../../docs/specs/2026-08-06-V0.1-查询交互提示与测评词包解耦规格.md)：§5 DEFINITIONS（query dictionary / query canonical identity / effectiveFrequencyRank）、§8 职责表（Query layer / Assessment layer）、§13 MIGRATION、§14 E/F、§15.1 R-QUERY、§15.4 R-ASSESS、§15.9 R-COMPAT
- [RULES.md](../../../RULES.md)「词典」「词汇键（wordKey）与词形」「查询、交互、主动提示与测评词包解耦」「词汇量估计」
- 数据可行性证据：[work/research/2026-08-07-ecdict-license-data-feasibility.md](../../research/2026-08-07-ecdict-license-data-feasibility.md)（E_VALIDATED，限定本地范围）

**Status**: 待用户授权后进入开发（本批次 ticket 均为 DOCUMENT 阶段产物，未标记 ready-for-agent）

**What to build**：把「查询词典」与「固定 1,000 测评词包」在数据资产与运行时消费上解耦。产出可复现的查询词典构建管线（ECDICT 全量本地、query-eligible 口径、含最小只读频率元数据 `effectiveFrequencyRank`），内容脚本 `dictionary.lookup` 改读查询词典；测评/估计/首测/每日继续只消费固定 assessment 资产。**本票只做数据资产与身份/查询合同，不改变任何展示决策（灰线/红线逻辑不变，由后续 T-HINT-4 单独处理）。**

**主责任 Requirement ID**：R-QUERY-1（数据部分）、R-QUERY-3、R-QUERY-5、R-ASSESS-1（资产分离）、R-COMPAT-4、R-HINT-3（频率元数据合同部分）；对齐 OPEN_DECISIONS E/F、A（dogfood 驱动覆盖验收，不预设条目数）。

**用户可见收益**：普通英文网页上、固定 1,000 词包之外的普通英文词（如 `serendipity`、`ubiquitous`），页面处理进入查询能力范围；悬停/点击行为由 T-INT-2 提供，本票先保证「能解析出身份与元数据」。

**依赖/前置 ticket**：无（本批次地基；其余 ticket 均依赖本票的查询资产与身份合同）。

**允许修改范围**：
- `scripts/`（新增或修改确定性构建脚本，如扩展 `scripts/build_ecdict_core.py` 或新增 `scripts/build_query_dictionary.py`：放开 `--limit`、移除「缺 frequency 淘汰」、保留 query eligibility 判定）。
- `data/derived/`（新增查询词典构建产物与 `build-report.json` 类报告：数量、缺失、重复、冲突、丢弃原因）。
- `extension/data/`（新增查询词典运行时资产；`dict-core.json`/`forms.json`/`frequency-bands.json` 作为 assessment 资产保持不动，或按实施口径调整承载方式——不得删除、不得静默改动其内容语义）。
- `extension/src/content/dictionary.ts`：`lookup()` 消费查询词典资产；`entry`/身份返回模型按 §5/§8 目标合同（身份键 + 音标/词性/释义 + 可选 `effectiveFrequencyRank`；**不输出频段**）。
- 与查询资产加载相关的构建配置（`build.mjs` 若需把新资产打进扩展包）。
- 相关单测与 E2E 场景（`e2e-verify.cjs` 中新增/调整的查询资产 seam）。

**禁止范围**：
- 不改展示决策：灰线/红线判定、`strategy` 的 light/strong/none 输出语义本轮不动（T-HINT-4 负责）。
- 不改 `extension/src/strategy/**`、`extension/src/popup.ts`、`extension/src/worker/storage.ts` 的持久化结构。
- 不升级 `schemaVersion`、不做任何迁移（F：包外词同键、不区分来源、不升 schema）。
- 不修改 `AssessmentEvidence`、`WordState`、`DailyTestState` 结构。
- 不下载新的 ECDICT 数据：只用既有本地快照（`data/` 与既有构建报告）；**不把 ECDICT 原始 CSV 或派生查询资产 commit/push 到公开仓库**（E 边界，见数据边界）。
- 不引入远程 API、不新增遥测/日志/dashboard。
- 不恢复冻结项（Pool B、概率画像、高置信自动隐藏等）。
- 不处理 `RESIDUAL_PUBLIC_OBJECT`（28f6d83 等旧对象）与 main 既有 `extension/data/dict-core.json` 的 existing-assets compliance audit——那是发布前阻断项，另行单独任务。

**数据/许可边界（硬边界）**：
- E 生效范围：**仅个人本地 dogfood + load unpacked**。MIT 授权个人本地使用与打包；公开再分发（Web Store、分享 crx、随公开仓库分发）**UNKNOWN、fail-closed**。
- 查询词典构建产物（ECDICT 派生：音标/词性/中文释义/频率）**不得写入公开 Git 历史**；本地数据必须可再生成（确定性构建脚本 + 记录来源版本/哈希/筛选规则）。
- review/test evidence 不得落盘 ECDICT tooltip payload（仅结构化字段：route、case、wordKey/测试标识、pass/fail、geometry、DOM/CLS/timing/error）。
- 若施工需要公开提交这些数据，**立即 STOP，E/F 返回用户**。
- `extension/data/dict-core.json`（main 既有）本票不触碰、不清理、不审计。

**真实 Chrome 用户路径验收**（Chrome for Testing + 隔离 profile）：
1. 构造含测评包外但 query-eligible 的词（如 `serendipity`）的静态英文正文 fixture；加载插件后，该词被解析为查询身份键且有音标/词性/中文释义元数据（可通过 E2E 断言工具检查或 debug 面板）。
2. 同一 fixture 中 1,000 词包内词（如 `ability`、屈折 `abilities`）仍正常解析、身份键不变（core 优先、forms 映射）。
3. 屈折词形 `abilities` → 查询身份 `ability`；`went/going/gone` → `go`（E2E 断言身份映射）。
4. **负断言**：查询词典扩容后，空 profile 下首测题目数量仍为 50、每日轮仍五题、估计展示仍标注「基于当前 1,000 词覆盖估计，不做外推」；`AssessmentEvidence` snapshot 结构与 schemaVersion 不变。
5. 无有效 frq/bnc 的 query-eligible 词（如仅音标词性释义齐全但双缺失的词）可解析出条目（不被判为 lookup-unresolved、不被淘汰）——但本票不验证其候选行为（T-HINT-4）。

**自动测试与负断言**：
- 单测：query eligibility 判定函数（身份+展示元数据，不要求频率）；`effectiveFrequencyRank` 组合（frq 优先、frq 缺失用 bnc、双缺失 = 无频率输入）；forms 映射（core 优先自身）。
- 负断言：查询资产构建后 `dict-core.json`（assessment）内容与 schemaVersion 零变化；`strategy`/`estimate` 测试全绿且输入范围未变；快照无新增字段。
- E2E：上述真实 Chrome 路径 1–5。

**完成定义**：
- 查询词典资产可确定性复现（同一输入同一产物，报告含数量/缺失/重复/丢弃原因）；
- query eligibility 与有效频率口径与研究 §2.3 一致（121,340 / 40,090 / 81,250 为参考，最终以实施口径实测为准并在报告记录）；
- `dictionary.lookup` 全量查询词典路径通过单测与 E2E；
- assessment 资产/测评/估计行为零回归；
- 无 schema/migration 改动；
- 公开 Git 历史无 ECDICT 派生数据（forbidden path 检查通过）。

**是否可以独立提交**：是——本票自包含数据资产 + 查询合同，不依赖交互展示层；展示行为不变，可独立验收、独立提交（仍须遵守 AGENTS 提交授权规则）。

**后续 Codex 所需证据**：
- 构建报告（来源版本/哈希、query-eligible 计数、频率覆盖计数、裁剪规模实测）；
- `dictionary.lookup` 对 14 个调查样本词的命中变化（对照调查事实 1：7/14 未命中 → 应全部命中或记录仍缺失词）；
- 扩容后扩展包体大小实测与加载时间记录（为 T-PERF-7 提供输入）；
- E2E 运行记录（含负断言）。

## Acceptance criteria

- [ ] 查询词典与固定测评词包在数据资产层面分离；assessment 资产内容与 schemaVersion 零变化（R-ASSESS-1、R-COMPAT-4）。
- [ ] query eligibility 只依赖身份+展示元数据，缺频率词不淘汰、不判未收录（R-QUERY-1 数据部分、R-HINT-3 合同部分）。
- [ ] `effectiveFrequencyRank`：frq 优先、bnc fallback、双缺失 = 无频率输入；不输出 frequency band（R-HINT-3）。
- [ ] 查询身份 = ECDICT lemma 字符串键；forms 映射 core 优先；包外词同键不区分来源（R-QUERY-3、F）。
- [ ] 测评/首测/每日/估计仍只消费 assessment 资产（R-ASSESS-1、R-ASSESS-4 回归）。
- [ ] 数据可再生成；无 ECDICT 派生数据进入公开 Git；review/test evidence 无 tooltip payload（E 边界）。
- [ ] 未触发任何 schema/migration；无远程组件；无冻结项恢复。
