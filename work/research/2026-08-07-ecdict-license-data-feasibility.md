# ECDICT 许可证与数据可行性调查（OPEN_DECISIONS E）

日期：2026-08-07
状态：发现与对齐阶段第一项（E）的研究证据；不替代 `RULES.md` 中的产品决定，不构成对最终 Spec 的批准。
调查方式：只读证据调查（官方仓库、LICENSE、README、本地既有数据与构建报告）；**未下载、未集成任何词典数据**。

## 结论摘要

- **E 判定：E_VALIDATED（限定范围）**——"ECDICT 全量本地词典，随 Chrome 扩展**本地打包、个人 dogfood 使用、不公开发布**"方向成立：代码与仓库内容为 MIT（作者正面授权 use/copy/distribute），数据可行性经本地实测充分；**公开再分发不在验证范围内，权利链维持 UNKNOWN**，继续由 RULES「仅个人 dogfood，不公开发布」约束覆盖。
- **F 因此生效（同样限定范围内）**：包外词沿用与包内相同的字符串身份键、不区分来源、不升级 schema。

---

## 1. LICENSE_EVIDENCE

### 1.1 ECDICT 仓库 LICENSE（官方权威来源）
- 来源：`https://raw.githubusercontent.com/skywind3000/ECDICT/master/LICENSE`
- 内容：MIT License，Copyright (c) 2025 Linwei（即 skywind3000）。
- 授权：`use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software`；再分发条件为保留版权与许可声明（"shall be included in all copies or substantial portions"）。
- 覆盖：按仓库发布行为，LICENSE 覆盖仓库交付内容（代码与 `ecdict.csv` 数据文件）。**MIT 的授权主体是 ECDICT 作者对其合并后作品（含数据文件）的授权；不覆盖上游第三方权利（见 1.2）。**

### 1.2 数据来源与第三方权利链（README 自述，`README.md`）
ECDICT 数据组合自以下来源，**MIT 无法覆盖第三方权利**：

| 来源 | README 自述 | 对公开再分发的影响 |
|---|---|---|
| EDictAZ.txt（约 2 万词释义） | 早期来源，他人提供 | 来源与权利不明 → UNKNOWN |
| 四六级～GRE 词汇表 | 公开词表 | 逐条权利链不明 → UNKNOWN |
| 爬虫音标 + 作者补充 | 组成 3 万基础词库 | 音标来源分散 → UNKNOWN |
| 网友贡献（约 10 万） | 多年积累 | 逐条权利链不明 → UNKNOWN |
| cdict-1.0-1.rpm | Linux 开源字典数据（mdict 主词库也源自 cdict） | 开源，但历史久远，许可证版本未在此次核验中逐字确认 → UNKNOWN（本地使用无碍） |
| BNC 前 16 万词校对 / lemma.en.txt（BNC 1 亿词扫描） | 按 BNC 语料库校对与生成 | BNC 有独立使用许可；**派生数据公开再分发权利链 UNKNOWN** |
| NodeBox / WordNet（exchange 词形、英文定义补全） | 工具与定义来源 | WordNet 有可再分发许可（WordNet License），但声明保留要求 → 部分确认 |
| 屌丝字典（diaosi）英汉部分 | 2017-04-07 收录的开源词典 | 开源，权利链未逐字核验 → UNKNOWN |

### 1.3 社区解释（非官方授权，仅作参考）
- wiloon.com《Open Source Offline Dictionaries》将 ECDICT 列为"MIT 协议"词库，作为开源离线词典选型。
- 多篇技术文章称 ECDICT"MIT 许可、允许商业和非商业用途"。
- 这些是第三方解读，**不作为授权依据**，仅反映社区共识：ECDICT 以 MIT 发布，集成使用普遍。

### 1.4 本项目既有记录（本地证据）
- `data/README.md`：ECDICT 根仓库为 MIT，但中文释义逐条公开再分发权利链仍未确认；仅用于本机 dogfood，不得公开发布。
- `work/research/2026-07-22-ecdict-高频核心包可行性核验.md`：同口径（MIT + 中文释义权利链 UNKNOWN）。
- `data/derived/ecdict-core-1000/build-report.json` 的 `license` 字段记录同一结论。

### 1.5 不确定项
- cdict、diaosi 的具体许可证版本文本未逐字核验。
- 中文释义（EDictAZ / 词表 / 网友贡献）的逐条来源权利链无法确认。
- BNC 派生数据（词频排序、lemma.en.txt）的公开再分发许可未获 BNC 方确认。
- **以上均只影响"对外公开再分发"；对"个人本地使用 + 本地打包"无实质冲突。**

---

## 2. DATA_FEASIBILITY

### 2.1 数据来源（本地已固定）
- ECDICT 官方仓库提交 `bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b` 的 `ecdict.csv`；SHA-256 `1a6947e04785db63613a92e14903cdae7954f7e84860b10e68e5c7cbb3f9c3cf`（见 `data/README.md`）。
- README 说明：默认 `ecdict.csv` 为基础版本（约 76 万词条）；更大版本为 `stardict.7z`。

### 2.2 条目/字段概况（本地实测）
- 原始 CSV 行数：**770,611**；文件大小：**65,933,428 字节（约 65.9 MB）**。
- 字段（README）：word / phonetic / definition / translation / pos / collins / oxford / tag / bnc / frq / exchange / detail / audio。
- 本项目运行时只消费 word / phonetic / pos / translation（见 RULES「词典」）；构建期用 bnc / frq / tag 排序、exchange 生成词形映射。

### 2.3 lemma/forms 可用性
- 合格候选（满足 ASCII 小写单词 + 音标 + 词性 + 中文释义 + 频率排名）：构建报告 `eligible_count = 38,036`。
- 淘汰原因（构建报告 rejections，1,000 词包同一规则）：not_simple_lowercase_word 438,909、missing_phonetic 155,209、missing_frequency_rank 76,083、missing_pos 55,153、translation_too_long 7,221。
- forms：`exchange` 字段可机械生成词形→主词条映射（现有 1,000 词包 `forms.json` 已验证）；README 另提供 lemma.en.txt（BNC 派生），但**其公开再分发许可未确认**，故不作为本项目依赖。

### 2.4 本地资产规模（实测 + 可复现估算）
- 1,000 词裁剪产物：`dict-core.json` 81,486 B + `forms.json` 29,061 B + `frequency-bands.json` 11,115 B ≈ **121 KB**（约 121 B/词条）。
- 全量合格候选（38,036 条）按同规则估算：约 **4.6 MB**（38,036 × 121 B；未压缩，未计 forms 全量扩展）。**该估算可由现有 `scripts/build_ecdict_core.py` 以 `--limit` 放开复现，属可复现估计。**
- 原始 65.9 MB CSV 为构建期输入，**运行时不需要携带**；运行时仅携带裁剪后 JSON（约数 MB 量级）。
- **不预设最终条目数**：38,036 是"字段合格候选"上限，是否全取或取子集由后续产品/数据决策（仍受 A 的 dogfood 驱动口径约束），本次调查不预设。

---

## 3. E_DECISION_GATE

### 3.1 判定
**E_VALIDATED（限定范围）**——满足 E 条件决议的生效前提，但范围必须明确：

- **验证成立的范围**：ECDICT 全量本地词典，随 Chrome 扩展**本地打包（load unpacked）供个人 dogfood 使用，不对外公开分发**。
  - 依据：MIT 授权文本明确含 `use / copy / distribute`，作者以 MIT 公开发布仓库（含数据文件）；社区广泛按此集成；本地个人使用无第三方权利冲突。
- **明确不在验证范围内的部分**：**对外公开再分发**（Chrome Web Store 发布、分享 crx、随公开仓库分发）——中文释义与 BNC 派生数据的逐条权利链 UNKNOWN，**未获通过，维持 UNKNOWN**。
- 该边界与 E 决议原文自洽：E 决议本身即限定"许可证未验证前仅用于个人 dogfood，不公开发布"；"验证通过"在本项目中应理解为**本地使用方向**的许可与数据可行性验证通过。

### 3.2 F 是否因此生效
- **是（限定范围内）**：在 E 验证成立的范围（本地全量、不公开）内，F 决议生效——包外词沿用与包内相同的字符串身份键、不区分来源、不升级 schema（约束层隔离）。
- 若未来需要公开再分发，E/F 须返回用户重新决策（fail-closed），不得由代理自行扩展范围。

### 3.3 fail-closed 说明
- 本次调查**未**把"尚未找到证据"当作"公开再分发许可通过"：公开再分发明确标为 UNKNOWN 并继续由 RULES 禁止条款覆盖。
- 未出现"许可证明确不允许本地使用"的证据，故本地方向不触发 STOP。

---

## 4. SCOPE_CONFIRMATION

- 未修改任何生产代码（`extension/src/**`、`extension/data/**`、`dist/**`、`e2e-verify.cjs` 未动）。
- 未下载、未集成 ECDICT 到生产资产（仅使用本地既有快照与构建报告做实测）。
- 未执行 D 可丢弃原型。
- 未进入 C 候选输入/算法对齐。
- 未拆 ticket、未标记 ready-for-agent、未整理 Codex 生产交接包。
- Spec 仍为 DRAFT；本文件仅作为发现阶段研究证据，未回写 RULES/Spec（按流程在 E/D/C 全部完成后统一回写）。

---

## 5. NEXT_STEP

- **E_VALIDATED（限定本地范围）**：按 Spec §18 顺序，下一步是 **D——可丢弃交互原型**（对比"全量无视觉包装"与"pointer/caret 动态定位"）。
- D 原型**必须由用户另行明确授权**（按 AGENTS `prototype` 路由），且只能在独立、可丢弃实验范围执行，不得演变为或合入生产实现。
- 在用户授权 D 之前，本阶段不执行任何原型或代码操作。
