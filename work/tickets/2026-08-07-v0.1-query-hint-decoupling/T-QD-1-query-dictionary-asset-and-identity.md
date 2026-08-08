# T-QD-1 — 查询词典资产与身份解耦（数据与构建层）

**权威来源**：
- [查询、交互、主动提示与测评词包解耦规格（已批准）](../../../docs/specs/2026-08-06-V0.1-查询交互提示与测评词包解耦规格.md)：§5 DEFINITIONS（query dictionary / query canonical identity / effectiveFrequencyRank）、§8 职责表（Query layer / Assessment layer）、§13 MIGRATION、§14 E/F、§15.1 R-QUERY、§15.4 R-ASSESS、§15.9 R-COMPAT
- [RULES.md](../../../RULES.md)「词典」「词汇键（wordKey）与词形」「查询、交互、主动提示与测评词包解耦」「词汇量估计」
- 数据可行性证据：[work/research/2026-08-07-ecdict-license-data-feasibility.md](../../research/2026-08-07-ecdict-license-data-feasibility.md)（E_VALIDATED，限定本地范围）

**Status**: 待用户授权后进入开发（本批次 ticket 均为 DOCUMENT 阶段产物，未标记 ready-for-agent）

**What to build**：把「查询词典」与「固定 1,000 测评词包」在数据资产与运行时消费上解耦。产出可复现的查询词典构建管线（ECDICT 全量本地、query-eligible 口径、含最小只读频率元数据 `effectiveFrequencyRank`），内容脚本 `dictionary.lookup` 改读查询词典；测评/估计/首测/每日继续只消费固定 assessment 资产。**本票只做数据资产与身份/查询合同，不改变任何展示决策（灰线/红线逻辑不变，由后续 T-HINT-4 单独处理）。**

**主责任 Requirement ID**：R-QUERY-1（数据部分）、R-QUERY-3、R-QUERY-5、R-ASSESS-1（资产分离）、R-COMPAT-4、R-HINT-3（频率元数据合同部分）、**R-PRIVACY-3（E research 已完成的前置验证 + 本票实施期 fail-closed guard，不是新的许可证研究任务）**；对齐 OPEN_DECISIONS E/F、A（dogfood 驱动覆盖验收，不预设条目数）。

**用户可见收益**：普通英文网页上、固定 1,000 词包之外的普通英文词（如 `serendipity`、`ubiquitous`），页面处理进入查询能力范围；悬停/点击行为由 T-INT-2 提供，本票先保证「能解析出身份与元数据」。

**依赖/前置 ticket**：无（本批次地基；其余 ticket 均依赖本票的查询资产与身份合同）。

**允许修改范围**：
- `scripts/`（新增或修改确定性构建脚本，如扩展 `scripts/build_ecdict_core.py` 或新增 `scripts/build_query_dictionary.py`：放开 `--limit`、移除「缺 frequency 淘汰」、保留 query eligibility 判定）。**构建代码可提交**。
- `data/derived/`（新增查询词典构建产物与 `build-report.json` 类报告：数量、缺失、重复、冲突、丢弃原因）。**该目录是本地 ignored/reproducible payload 位置（`.gitignore` 已忽略 `data/derived/`），产物不进入 commit**。
- **tracked 与 ignored 边界（硬约定）**：新 ECDICT 派生查询 payload（音标/POS/中文释义/频率）**不得作为 tracked `extension/data/**` 文件 commit/push**（`.gitignore` 不忽略 `extension/data/`，凡落入该路径的文件都会进入公开 Git）；若 build 需要运行时查询资产，只允许在**本地构建阶段**从 ignored 本地资产生成/复制到 **ignored 构建输出**（如 `dist/`，`.gitignore` 已忽略）。具体文件布局由施工确定，但「tracked 公开 Git 不得新增 ECDICT payload」必须无歧义。
- `extension/data/`：**不作为新 ECDICT 查询 payload 的可提交目标**；该路径下既有 assessment 资产（`dict-core.json`/`forms.json`/`frequency-bands.json`）本票不触碰、不得删除、不得静默改动其内容语义。
- `extension/src/content/dictionary.ts`：`lookup()` 消费查询词典资产；`entry`/身份返回模型按 §5/§8 目标合同（身份键 + 音标/词性/释义 + 可选 `effectiveFrequencyRank`；**不输出频段**）。
- 与查询资产加载相关的构建配置（`build.mjs` 若需把新资产打进扩展包——目标位置必须为 ignored 构建输出）。
- 相关单测与 E2E 场景（`e2e-verify.cjs` 中新增/调整的查询资产 seam）。

**review/test evidence 规则**：screenshot/video/debug output 若显示真实 ECDICT 音标/POS/中文释义，**只能本地临时查看，不得 commit/push**；可持久化的 review evidence 必须使用结构化/脱敏结果（route、case、wordKey/测试标识、pass/fail、geometry、DOM/CLS/timing/error）。

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
- 查询词典构建产物（ECDICT 派生：音标/词性/中文释义/频率）**由本票新增 commit 不进入 tracked 公开 Git**（`data/derived/`、`dist/` 等 ignored 位置可存本地生成物）；本地数据必须可再生成（确定性构建脚本 + 记录来源版本/哈希/筛选规则）。
- **不得否认 main 既有 existing assets 与 RESIDUAL_PUBLIC_OBJECT**：本票边界是「本 ticket 新增 commit 不新增 ECDICT 派生 payload」；仓库整体历史中已存在的 ECDICT 派生资产（如 main 既有 `extension/data/dict-core.json`、旧 SHA 28f6d83）是独立发布前阻断项，由另行单独任务处理，本票不清理、不审计、不声称已清除。
- review/test evidence 不得落盘 ECDICT tooltip payload（仅结构化字段：route、case、wordKey/测试标识、pass/fail、geometry、DOM/CLS/timing/error）；含真实音标/POS/中文释义的截图/视频仅本地临时查看、不 commit。
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
- 本 ticket 新增 commit 不新增 ECDICT 派生 payload（forbidden path 检查通过；`extension/data/**` 无新增查询 payload 文件）。

**是否可以独立提交**：是——commit 自包含**构建代码/查询合同/测试**；本地生成 payload（`data/derived/`、`dist/` 等 ignored 位置）**不进入 commit**；展示行为不变，可独立验收、独立提交（仍须遵守 AGENTS 提交授权规则）。

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
- [ ] 数据可再生成；**本 ticket 新增 commit 不新增 ECDICT 派生 payload**（`extension/data/**` 无新增查询 payload）；review/test evidence 无 tooltip payload、含真实释义的截图/视频仅本地（E 边界）。
- [ ] **R-PRIVACY-3**：E research 已作为前置验证满足（E_VALIDATED 限定本地）；本票实施期 fail-closed/data-boundary guard 生效（无 ECDICT 派生 payload 进入 tracked 公开 Git；公开再分发保持 UNKNOWN）。
- [ ] 未触发任何 schema/migration；无远程组件；无冻结项恢复。
