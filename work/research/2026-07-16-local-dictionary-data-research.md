# 单用户本地优先英语阅读插件：词典数据研究

**范围。** 这是 V0.1 的早期只读选型研究：Chrome 扩展需要可随扩展分发或由用户本机下载的英→简中词汇数据，并且要能说明覆盖、准确性、来源、许可证和更新方式。结论不构成法律意见；发布前仍应做许可证复核。本文原先提出的完整包内字段和“先做 100 条”是历史建议；当前已确认采用“网页提示最小记录＋独立构建审计外壳”，第一阶段总计 500 条且前 100 条是其中合同门，执行口径以 `RULES.md` 为准。

## 结论先行

不要把“本地词典”做成一份不可解释的大 CSV。本研究当时推荐的是**可追溯的两层本地数据包**；当前实现不得把下列上游与审计字段直接塞入网页提示最小记录：

1. **内置核心包（默认、即时、离线）**：用一个固定版本的 Kaikki/Wiktextract 英语条目生成；仅保留英语 lemma、词性、词形、英文 gloss、以及该 sense 已有的简体中文翻译。每一条保留上游页面/转储日期/抽取器提交/许可证标记。它是默认短释义来源。
2. **可选长尾包（用户主动下载后本机索引）**：从同一已固定版本的 Kaikki 英语 JSONL 生成，并仍只导入可核验的英语 sense 和中文翻译。不要把 23.1GB 原始转储塞入 CRX；原始数据本身说明了规模不适合随扩展分发。[Kaikki 当前英语原始包](https://kaikki.org/dictionary/rawdata.html) 为 23.1GB（gzip 2.6GB），而其面向英语词典的网站处理后 JSONL 也有 3.0GB。[英语词典页](https://kaikki.org/dictionary/English/index.html)
3. **英文语义/词形辅库**：采用 [Open English WordNet 2025](https://github.com/globalwordnet/english-wordnet)（OEWN）而非停止维护的 Princeton WordNet 作为 lemma、词性、词义图和稳定 sense 参照；它不输出中文释义，不能单独充当英汉词典。
4. **中文 sense 对齐辅助，而非释义主库**：采用 [Chinese Open Wordnet（COW）](https://github.com/omwn/omw-data/tree/main/wns/cow) 的中文 lexical unit 与 Princeton synset 对齐，帮助发现词义冲突或补充候选中文词条；不把它直接渲染成中文释义。其自身明确是有缺口的词网，而不是覆盖完备的英汉词典。

这比“ECDICT 一把梭”或“浏览时逐词调用 LLM”更好：默认无网络、秒级可用、能解释数据来自何处；长尾不拖慢安装；本地 LLM 只作为显示“本地生成的上下文解释”的后备，不能伪装成词典事实。

## 候选数据对比

| 数据 | 可提供什么 | 许可证与可分发性 | V0.1 结论 |
| --- | --- | --- | --- |
| Kaikki / Wiktextract 英语 JSONL | 英文 gloss、词性、词形、发音及**存在时**的各语言翻译；一行一个 JSON 对象 | Wiktextract 工具本身不是数据许可证；上游 Wiktionary 条目为 CC BY-SA 4.0/GFDL，需做署名和同许可合规。[Wiktionary 版权页](https://en.wiktionary.org/wiki/Wiktionary:Copyrights) | **英→中文释义主来源**；以固定快照生成核心包，长尾包可选 |
| Princeton WordNet 3.0 | 英语 synset、英文 gloss、例句、词形与语义关系 | 允许免费复制、修改、分发，但所有副本/修改保留版权和免责声明，且不可借 Princeton 名义宣传。[官方许可](https://wordnet.princeton.edu/license-and-commercial-use) | 不提供中文；只可作英文骨架。项目已停止开发。[官方状态](https://wordnet.princeton.edu/) |
| Open English WordNet 2025 | 更现代的英语词网，LMF/JSON/RDF/WNDB 发布；核心版 135,969 words / 107,519 synsets | CC BY 4.0；其许可还要求保留所含 Princeton 归属。[项目许可](https://github.com/globalwordnet/english-wordnet/blob/main/LICENSE.md) | **优先作为英文骨架**；不能替代中文释义 |
| Open Multilingual Wordnet / COW | COW 把中文 lexical unit 对齐到 PWN synset；OMW 打包格式含来源和每个词网许可证字段 | OMW 代码是 MIT，但各数据包许可证不同；COW 自带 PWN 型许可证并要求保留版权/免责声明。[COW 许可证](https://github.com/omwn/omw-data/blob/main/wns/cow/LICENSE) | 只作 sense 对齐、候选验证和中文标签辅助；不作完整英→中释义库 |
| CC-CEDICT | 中文词条、拼音、英文 gloss；主要是**中→英** | 当前下载页标为 CC BY-SA 4.0；可商用但要署名，改进需同许可分享。[官方下载与许可](https://cc-cedict.org/editor/editor.php?handler=Download) | 不适合英→中主链路；仅以后若做“中文反查”时再评估。格式迁移仍在进行，v1/v2 并存。[官方格式说明](https://cc-cedict.org/wiki/syntax_v2) |
| ECDICT | 英文/中文释义、词性、BNC/现代词频、词形；UTF-8 CSV，可转 SQLite；基础 CSV 自称 76 万词条 | 仓库标 MIT，[许可证](https://github.com/skywind3000/ECDICT/blob/master/LICENSE)；但 README 同时承认内容混合自他人文本、考试词表、爬取“各种资料”、网友贡献、cdict、WordNet/BNC，未给逐条来源/权利清单。[来源说明](https://github.com/skywind3000/ECDICT) | **不得作为默认内置或唯一权威词典**；可允许用户自行导入并标为“第三方、未核验来源” |

### Kaikki/Wiktextract：最合适的主语料，但必须缩包与合规

Wiktextract 的英语抽取会给出 gloss、词性、屈折、翻译、读音、词形和关系等字段；输出是 JSONL，适合流式构建，不必把大文件一次载入内存。[项目 README](https://github.com/tatuylonen/wiktextract) Kaikki 当前英语机读词典列出 1,380,567 个不同 word form，并注明所用 enwiktionary dump 日期与抽取器提交；这满足“版本可追溯”，但不等于每个词义都有简中翻译。[Kaikki 英语词典](https://kaikki.org/dictionary/English/index.html)

所以构建规则应当是：

- 只取 `lang_code=en` 的英语词条；
- `word + pos + sense` 是存储单元，绝不把多义词压成一条无来源的“唯一中文翻译”；
- 仅把翻译字段中明确为中文、且可映射为简体的内容列为 `dictionary` 级短释义；没有中文翻译时展示英文 gloss，并标记 `zhGlossMissing`；
- 不纳入引文、图片、音频等可能有额外权利的字段；Wiktionary 明确提示条目可能含不同版权来源的外部材料。[版权说明](https://en.wiktionary.org/wiki/Wiktionary:Copyrights)
- 扩展的“关于/数据来源”页提供 Wiktionary 署名、CC BY-SA 4.0 与 GFDL 链接、构建版本、修改说明和数据包下载/源码链接；发布时按实际法务结论履行 ShareAlike 义务。

### WordNet / OMW / COW：应解决 sense，不应假装解决翻译

Princeton WordNet 是“英语词汇数据库”，并非双语词典。[官方介绍](https://wordnet.princeton.edu/) OEWN 的核心版覆盖常见名词、动词、形容词和副词，且提供 JSON；它是更合适的可锁定版本的英文 sense 骨架。[OEWN 发布与规模](https://github.com/globalwordnet/english-wordnet)

OMW 的代码仓库也明确区分“读取/验证/搜索 wordnet 的代码”和具体 wordnet 数据；其数据目录要求每个项目保留原始许可证、转换说明和引用。[OMW 数据结构](https://github.com/omwn/omw-data/tree/main/wns) COW 的 `cmn` 包有独立许可证与对齐表，但仓库还存在 `cow-not-full.txt`（80,010 行），因此不能对其作“完整中文覆盖”的承诺。[COW 缺口文件](https://github.com/omwn/omw-data/blob/main/wns/cow/cow-not-full.txt)

实际使用：OEWN 的 lemma/synset 是主键；Kaikki 给中文短释义；COW 只在二者无法消歧时帮助判断候选中文 lemma 是否落在同一语义网。这样不会把“中文近义词标签”误显示成当前句的翻译。

### 为什么不默认选 ECDICT 或 CC-CEDICT

ECDICT 的体验字段很诱人：其 README 列出了 `translation`、`pos`、`bnc`、`frq` 与 `exchange`，并说基础 CSV 有 76 万词条。[字段与规模](https://github.com/skywind3000/ECDICT) 但“仓库是 MIT”不能替代其中每条内容的权利证明：同一 README 描述了多种未逐条标明许可证的上游、爬虫和用户贡献。对于将来需要再分发的扩展，这是供应链不可审计风险。

CC-CEDICT 的编辑规范还直接说明它是人读描述字典、并非为机器处理设计，且其自身也承认旧条目未必遵循最新规则。[官方规范](https://cc-cedict.org/wiki/syntax_v2) 更根本的问题是它的方向是中文→英文，反转后不能可靠地把英文多义词映射到当前中文释义。

## 数据包与记录合同

构建产物不直接是源 JSONL，而是不可变的 `dictionary-core-<version>.sqlite`（或分片 JSON），另有同版本 `manifest.json`：

```json
{
  "schemaVersion": 1,
  "packageVersion": "2026.07.06+build.1",
  "sources": [
    {
      "id": "kaikki-en",
      "sourceDump": "enwiktionary-20260706",
      "extractorCommit": "<locked commit>",
      "license": "CC-BY-SA-4.0 and GFDL",
      "sourceUrl": "https://kaikki.org/dictionary/rawdata.html",
      "sha256": "<source artifact hash>"
    },
    {
      "id": "oewn-2025",
      "license": "CC-BY-4.0 plus included PWN notice",
      "sha256": "<source artifact hash>"
    }
  ],
  "artifactSha256": "<package hash>",
  "buildGitCommit": "<our reproducible builder commit>"
}
```

每个可展示 sense 至少存：`lemma`、`pos`、`sourceSenseId`、`englishGloss`、`zhGloss[]`、`glossSource`、`licenseRef`、`sourceUrl`、`sourcePackageVersion`、`confidence`、`updatedAt`。本地 LLM 输出必须存为另一种来源：`generated-local-model`、模型名、提示模板版本和生成时间；UI 文案显示“本地模型解释”，不混同为“词典释义”。

## “完整性”应该如何定义和验证

不能保证“所有英文词都有唯一且正确的简中释义”：开源词典数据本身会有缺失、多义、术语和专名边界。可保证的是可测量的覆盖、可验证的构建和可回滚的更新。

### 1. 覆盖门禁

- 构建期按目标网页语料建立固定的 `coverage-fixture`：常用新闻、技术文档、长文、博客、含连字符/缩写的页面文本；不得只用随机词表。
- 对每个 token 记录：`exact lemma hit`、`inflection hit`、`English-only sense`、`zh sense hit`、`missing`；按页面域名和词频段输出分母，避免只报“命中数”。
- 把验收写成阈值：例如核心 fixture 的 lemma 命中率、带中文 short gloss 的命中率、词形还原命中率各自有下限；阈值由真实试用首周基线确定，不能现在虚构一个百分比。
- 新版本不得使任一 fixture 的 `zh sense hit` 回退；回退只能以明确 allowlist 和人工说明放行。

### 2. 准确性门禁

- 维护一个小而人工审核的多义词金标集（如 `bank`、`charge`、`draft`、`subject`）及各自句子，不从词典自动生成答案。
- 测试 `surface → lemma → pos → sense → short gloss`，并且检查同一 lemma 不会因错误合并跨词性释义。
- COW/OEWN 只可作为一致性信号；出现冲突时显示英文 gloss/“需上下文解释”，不强行输出中文。
- 对用户点击“释义不对”的反馈建立本地 override 表；它优先于包数据，同时保留原记录与版本，方便以后回归。

### 3. 完整性、供应链与更新门禁

- 构建器下载**固定 URL/版本**，校验 SHA-256；保存原始工件的 hash、大小、行数和解析错误数。
- 流式解析 JSONL；校验 UTF-8、JSON、必填 `word/lang_code/pos`、sense ID 去重、引用完整性、中文文本规范化；任何解析错误都出现在 report，不能静默丢弃。
- 生成 `coverage-report.json`、`license-notice.md`、`manifest.json` 和可复现数据库哈希；CI 比较这些内容。
- 更新采用“下载→验 hash→迁移到新 IndexedDB store→跑 fixture→原子切换 activeVersion”的双库策略；失败保持旧包可用。保留一个旧版本以支持回滚。
- 词典更新与用户个人词汇状态分离：状态主键用稳定的 `lemma + pos + sourceSenseId`（另有 fallback key），迁移时提供映射表，绝不因换包清空 `known/learning`。

## 当时提出的 V0.1 可执行决策（后续口径已部分取代）

1. 规格写为：默认英→简中短释义来自“经 Kaikki/Wiktextract 固定快照构建的可追溯数据包”，不是“完整离线英汉词典”。
2. 随扩展只带核心包；长尾作为用户在设置中主动安装的本地包。两者都必须显示体积、版本、许可证、来源和校验状态。
3. 同时带 OEWN 的最小 lemma/sense 索引；COW 留作构建/验证依赖，V0.1 不把其中文词条直接作为页面翻译。
4. ECDICT 不进入默认发布物；若支持导入，要明确标为实验性第三方数据且不覆盖主数据的来源字段。
5. 当时建议先构建 100 个可审计词条；当前这 100 条已改为 500 条第一阶段中的合同门。通过 Codex Gate 后按 100 条里程碑继续到 500，并由 Hermes 反思、修正流程和沉淀候选 Skill；未经新门禁不得自动扩到 1000。
