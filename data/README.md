# 本地词典数据

本目录只保存可再生成的数据，不应提交原始 CSV 或派生 JSON。原始 CSV、派生 JSON 与 `dist/` 构建输出均在本仓库 `.gitignore` 的 ignored 边界内（`data/raw/`、`data/derived/`、`dist/`），只存在于本机文件系统，不进入公开 Git。

## A. Fixed assessment core（固定测评词包）

本部分对应固定 1,000 词测评包（assessment core）：负责首测 / 每日校准 / frequency band / AssessmentEvidence / 词汇量估计。

当前本机已生成的 dogfood 输入与产物：

- 输入：ECDICT 提交 `bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b` 的 `ecdict.csv`；SHA-256 为 `1a6947e04785db63613a92e14903cdae7954f7e84860b10e68e5c7cbb3f9c3cf`。
- 产物：`derived/ecdict-core-1000/`，其中包含 1,000 条 `dict-core.json`、`forms.json`、`frequency-bands.json` 与 `build-report.json`。

重新生成（core 模式）：

```bash
python3 -B scripts/build_ecdict_core.py \
  --input data/raw/ecdict-bc015ed2.csv \
  --output-dir data/derived/ecdict-core-1000 \
  --limit 1000 \
  --mode core \
  --source-ref bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b \
  --source-date 2026-07-22
```

脚本只作机械处理：保留小写单词、音标、词性和短中文；`pos` 列为空时，仅从 `translation` 每行开头的显式词性前缀（如 `n.`、`vt.`、`adj.`）提取词性并移除该前缀。没有可识别词性、音标、中文、频率排名或符合单词格式的记录都会被淘汰（测评包口径）。它不调用模型，也不人工补齐。

## B. Local query dictionary（本地查询词典）

本部分对应查询词典（query dictionary）：负责网页查词、canonical forms、音标/词性/释义元数据，以及 hint 的 `effectiveFrequencyRank` 输入。

它与 `data/derived/ecdict-core-1000/` **不是同一个资产**：

- assessment core：首测 / 每日 / frequency bands / estimate 的固定 1,000 词包；
- query dictionary：网页查询 / canonical forms / metadata / hint frequency input 的本地全量词典。

用途：`data/derived/ecdict-query/` 仅用于本机个人 dogfood 的本地查询词典。`npm run build` 会读取其中的 `query-dictionary.json` 与 `query-forms.json` 并复制到 ignored 构建输出 `dist/data/`。

### 固定输入身份

- source ref：`bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b`
- 预期 raw SHA-256：`1a6947e04785db63613a92e14903cdae7954f7e84860b10e68e5c7cbb3f9c3cf`
- source date：`2026-07-22`

（不要在本机路径中查找该输入；以 `data/raw/ecdict-bc015ed2.csv` 相对路径为准。）

### 精确确定性命令（query 模式）

```bash
python3 -B scripts/build_ecdict_core.py \
  --mode query \
  --input data/raw/ecdict-bc015ed2.csv \
  --output-dir data/derived/ecdict-query \
  --source-ref bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b \
  --source-date 2026-07-22
```

### 预期结构产物

`data/derived/ecdict-query/` 下应有：

- `query-dictionary.json`
- `query-forms.json`
- `query-build-report.json`

当前已验收 baseline（同一输入 + 当前脚本的 reproducibility baseline，不是产品 SLA，也不是未来数据源必须永远固定的产品阈值）：

- query entries = 121340
- frequency eligible = 40090
- frequency ineligible = 81250

### Build 关系与 fail-closed

`npm run build` 从 `data/derived/ecdict-query/` 读取 `query-dictionary.json` 与 `query-forms.json`，并复制到 ignored 的 `dist/data/`。如果这些 query assets 缺失，build 应 fail-closed（`build.mjs` 会在复制前检查存在性并报错）。

禁止从 `ecdict-core-1000`（assessment core）冒充 query assets。

### Worktree 警告

ignored 文件是 worktree-local filesystem state。Git merge / fast-forward / branch push **不会**把另一个 worktree 中的 ignored `data/raw/**`、`data/derived/**`、`dist/**` 自动搬到当前 worktree。

因此新 worktree / 新机器 / main 合并后若缺 query assets：

1. 优先：按上述固定 raw snapshot + 确定性命令重新生成。
2. 若同机另一个已验证 worktree 有完全相同 source/version 的 query assets，可以先比较 SHA 后进行本地 opaque copy；但该复制不是 Git 历史的一部分。

### 许可 / 隐私边界

- ECDICT 仓库 LICENSE 为 MIT；中文释义的逐条公开再分发权利链**仍 UNKNOWN**。
- raw / derived query payload 仅个人本地 dogfood / load-unpacked。
- 不 commit / push query payload。
- 不把 `dist/` 当公开发布包。
- Web Store / CRX / public redistribution 需要另行合规决策。

不得写成“MIT 已经解决全部中文释义公开再分发问题”。
