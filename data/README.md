# 本地词典数据

本目录只保存可再生成的数据，不应提交原始 CSV 或派生 JSON。

当前本机已生成的 dogfood 输入与产物：

- 输入：ECDICT 提交 `bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b` 的 `ecdict.csv`；SHA-256 为 `1a6947e04785db63613a92e14903cdae7954f7e84860b10e68e5c7cbb3f9c3cf`。
- 产物：`derived/ecdict-core-1000/`，其中包含 1,000 条 `dict-core.json`、`forms.json`、`frequency-bands.json` 与 `build-report.json`。

重新生成：

```bash
python3 -B scripts/build_ecdict_core.py \
  --input data/raw/ecdict-bc015ed2.csv \
  --output-dir data/derived/ecdict-core-1000 \
  --limit 1000 \
  --source-ref bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b \
  --source-date 2026-07-22
```

脚本只作机械处理：保留小写单词、音标、词性和短中文；`pos` 列为空时，仅从 `translation` 每行开头的显式词性前缀（如 `n.`、`vt.`、`adj.`）提取词性并移除该前缀。没有可识别词性、音标、中文、频率排名或符合单词格式的记录都会被淘汰。它不调用模型，也不人工补齐。

ECDICT 根仓库为 MIT，但中文释义的逐条公开再分发权利链仍未确认。因此这些数据仅用于本机个人 dogfood，不得据此公开发布。
