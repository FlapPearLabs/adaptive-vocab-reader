# V0.1 词典数据来源、许可与清洗可行性复核

**日期：** 2026-07-17
**范围：** 只复核项目当前拟用的 Kaikki/Wiktextract、Open English WordNet（OEWN）与 COW；只采用数据维护方或上游许可证的第一方资料。本文不修改产品规则，也不是法律意见。

## 结论先行

三个候选数据源都能取得，但没有任何一个能“不经清洗和验证，直接作为可靠的简中行内短释义”。适合本项目的职责划分仍是：

| 来源 | 可用性与最合适职责 | 能否直接提供可靠简中短释义 | V0.1 结论 |
| --- | --- | --- | --- |
| Kaikki / Wiktextract 英语条目 | 可从 Kaikki 的固定 `enwiktionary` 抽取快照取得 JSONL；含词形、词性、英文 gloss 与**存在时**的按义项翻译 | **不能直接承诺。** 简中翻译是候选，不保证覆盖、同义项绑定、脚本或质量 | 唯一合理的中文候选主来源；必须先完成小样本构建 PoC 和人工金标审查 |
| OEWN | 可取得固定版 LMF/JSON/RDF/WNDB；提供英语 synset、词元、英文定义与语义关系 | **不能。** 它是英语 lexical network，不是英汉词典 | 只作英文词形／义项骨架与对齐辅助 |
| COW（Chinese Open WordNet） | 可从 COW／OMW 数据仓库取得 `cmn` 词元到 PWN 3.0 synset 的链接 | **不能。** 公开 tab 数据是中文词元（lemma）映射，并非中文定义／短释义；也不直接覆盖 OEWN 的新义项 | 只作构建期义项对齐／一致性信号，不渲染为页面翻译 |

因此，当前 `RULES.md` 中“Kaikki 已有简中短释义”的正确工程解释应是“**优先使用其有明确义项绑定的中文翻译候选；经清洗、冲突过滤和质量门禁后才成为可展示短释义**”。它不是已证实的全覆盖、统一简体、可直接上线的词典事实。

## 1. Kaikki / Wiktextract

### 取得方式与字段

[Kaikki 原始数据页](https://kaikki.org/dictionary/rawdata.html)按周左右更新；本次查阅时给出基于 `2026-07-06` enwiktionary dump 的 JSONL（原始 23.1 GB、gzip 2.6 GB），并公开抽取器提交。网页也明确说明一行一个 JSON 对象。Kaikki 的“English dictionary”后处理 JSONL 为 3.0 GB，但页面标为 **deprecated**，并建议自行处理原始数据；PoC 和正式构建应固定使用[原始压缩工件](https://kaikki.org/dictionary/raw-wiktextract-data.jsonl.gz)的 URL、dump 日期与抽取器提交，而不能依赖会被移除的后处理下载。

[Wiktextract 的官方字段文档](https://github.com/tatuylonen/wiktextract#format-of-the-extracted-word-entries)说明英语抽取可提供：

- 词条级 `word`、`pos`、`lang`、`lang_code`、`forms` 与 `senses`；
- `senses[].glosses`（清洗后的英文 gloss）、`form_of`、`senseid`、`wikidata` 等；
- 翻译可位于词条级（未消歧）或 `senses[].translations`（已按义项消歧）；每个翻译含语言 `code`、`lang`、`word`、可选 `sense`、`tags`、`note` 等。[翻译字段定义](https://github.com/tatuylonen/wiktextract#translations)还明确指出 `sense` 是自由文本，未必与 gloss 精确相等。

这足以构建“英语表达／词性／词形／候选义项／候选中文词”的可追溯记录，也适合流式解析；官方文档说明将全部数据载入内存约需 120 GB，明确建议逐行处理。[JSONL 与流式处理说明](https://github.com/tatuylonen/wiktextract#overview)

### 简中短释义：候选，不能直接信任

**可用之处：** 英语版抽取会捕获“可用时”的各语言翻译，且翻译可位于某个 `sense` 内；这是三者中唯一直接带英→中文候选的来源。

**不能越过的边界：**

1. 官方资料承诺的是“存在时捕获”，不是每个英语 sense 都有中文翻译，也没有给出简体覆盖率或正确率；
2. 词条级 `translations` 没有义项绑定，不能自动作为多义词的行内中文；
3. 翻译语言代码、脚本、标签和自由文本 `sense` 需要逐条检查；不得把“Chinese”一概当作可直接显示的简体短释义；
4. 一条中文词通常是候选对应词，不自然等同于解释性短 gloss；同一义项的多个候选或跨义项冲突必须降级，而非任选第一个。

**许可证与署名：** Wiktextract 是采用 [MIT 的抽取工具](https://github.com/tatuylonen/wiktextract/blob/master/LICENSE)，不替代上游条目内容的许可。Wiktionary 官方版权页说明原始条目文字双重采用 [CC BY-SA 4.0 与 GFDL](https://en.wiktionary.org/wiki/Wiktionary:Copyrights)，并要求再利用者按适用许可处理署名、同许可／透明副本等义务。具体“筛选后的数据包是否构成改编、产品中哪些部分受何种义务约束”需要发布前法律复核；工程上不得把 `MIT`/工具许可证误写成词典数据许可证。

## 2. Open English WordNet（OEWN）

[OEWN 官方仓库](https://github.com/globalwordnet/english-wordnet)把自己定义为按 synset 组织的英语词汇网络，提供 hypernym、antonym、meronym 等关系；2025 core 版列出 135,969 词、107,519 synset、355,064 关系，并可下载固定的 LMF、JSON、RDF、WNDB 版本。它还提供 JSON API，但 V0.1 应使用锁定本地快照，不依赖运行时网络 API。

它的价值是：

- 为 `lemma + POS + sense/synset` 提供稳定的英文义项骨架；
- 提供英文 definition、词元和关系，用于 Kaikki 候选的结构校验、粗义项聚类和回归 fixture；
- 不将其关系图误当作当前网页义项消歧器或用户掌握状态传播图。

**不能直接提供简中短释义。** 官方公开定位、格式和 API 都是英语 lexical resource；没有将中文翻译作为 OEWN 的发布字段。因此任何中文显示必须另有可追溯来源，不能把英文 definition 机翻后标成 OEWN 词典事实。

**许可证：** [OEWN LICENSE](https://github.com/globalwordnet/english-wordnet/blob/main/LICENSE.md)要求对 OEWN 团队和 Princeton WordNet 同时署名；资源在 PWN WordNet License 基础上进一步以 CC BY 4.0 发布。生成的数据包和“关于／许可证”页必须保留这两类 notice，不能只记 `CC-BY-4.0`。

## 3. COW 是什么，以及它的实际边界

本项目文档中的 COW 可明确解释为 **Chinese Open WordNet（汉语开放词网）**，不是“Chinese Wordnet（Taiwan）”。[COW 项目页](https://bond-lab.github.io/cow/)与 [Global WordNet 的目录](https://globalwordnet.github.io/resources/wordnets-in-the-world)均使用这一名称／缩写。[OMW 官方 V1 目录](https://omwn.org/omw1.html)也将它与 Chinese Wordnet（Taiwan）分开列出：Chinese Open Wordnet 使用 `cmn`，并列出 42,312 个 synset、61,533 个词、79,809 个 sense；该页还说明其数据经规范化后链接至 **Princeton WordNet 3.0**。这些数量是历史发布的描述，不能当作当前生产覆盖承诺。

可复现的公开 COW 原始快照可从 [COW 仓库的 0.9 `wn-data-cmn.tab`](https://github.com/bond-lab/cow/blob/master/docs/data/0.9/wn-data-cmn.tab)取得；[OMW 的 `wns/cow` 目录](https://github.com/omwn/omw-data/tree/main/wns/cow)是其经 OMW 规范化后的分发副本。OMW 的[格式说明](https://omwn.org/omw1.html#formats)规定该类 tab 文件以 `PWN-offset-POS + cmn:lemma + 中文词元` 表示跨语义网的词元映射；`cmn:def` 和 `cmn:exe` 才分别是中文定义、例句字段。

本次对 OMW 分发副本当前 `main` 的 2.5 MB tab 文件做了只读流式字段检查：未发现 `cmn:def` 或 `cmn:exe` 行，只有中文 lemma 映射；COW 的公开 0.9 tab 也是同一 `synset + cmn:lemma` 数据模型。因此 COW 的中文词元没有“该英文当前义项的一句简中解释”所需的信息，不能直接当作 `cat（猫）` 这类 UI 释义。它能做的是：当 Kaikki 的英语 sense 与 PWN 3.0 offset 有可靠映射时，提供中文同义词候选或发现跨义项矛盾。

**与 OEWN 的对齐风险：** COW 链到 PWN 3.0 offset，OEWN 有自己的 release/synset 标识。OEWN 声明通过 CILI 提供与旧版本、其他词网的对应；但构建时必须锁定并测试实际映射，不能把 `offset-pos` 直接当作 OEWN 当前 sense ID。映射缺失或一对多时，COW 不参与自动行内中文决定。

**许可证：** [COW 自带 LICENSE](https://github.com/bond-lab/cow/blob/master/docs/LICENSE)允许免费使用、复制、修改和分发，但要求**所有**软件、数据库、文档及修改副本保留其版权声明与免责声明（Francis Bond、Shan Wang，2013/2014）。数据头中的短许可证名是 `wordnet`，不是 `CC-BY`；发布物必须携带其原文 notice，并在组合数据许可审计中单独列出。由于其义项链接基于 PWN 3.0，还要在最终组合包的许可审计中复核 [Princeton WordNet 许可证](https://wordnet.princeton.edu/license-and-commercial-use)。

## 4. 可执行的清洗与构建策略

以下是 PoC 应验证的流程，尚不是已经冻结的 schema 或质量阈值。

1. **锁定与可追溯下载。** 记录 Kaikki URL、enwiktionary dump 日期、Wiktextract commit、SHA-256、大小、下载日期；OEWN/COW 记录 release/tag 或 commit 与 SHA-256。构建产物写出 `manifest.json` 与完整 `license-notice.md`。
2. **流式、窄输入。** 仅消费 Kaikki 中 `lang_code=en`、有效 `word`／`pos`／`senses` 的记录；不导入音频、图片、引文、完整例句、词源或无关链接。保留原始行号与稳定来源键，以便重跑与审计。
3. **先建英语义项，不先凑中文。** 将 `word + POS + sense` 拆开；词形仅从 `forms/form_of` 建候选关系；MWE 作为独立表达。英文 gloss 是每个候选义项的回退内容，不把同 lemma 的 gloss 盲目合并。
4. **只接受可解释的中文候选。** 优先 `senses[].translations`；检查语言 code、非空 `word`、标签／用域、是否确实绑定当前 sense。词条级未消歧翻译只能进“候选池”，不得自动强提示。保留原文、脚本检测／规范化结果、清洗规则版本和丢弃原因；简繁转换若采用，必须保留转换前原文，且对专名、术语、歧义转换设拒绝路径。
5. **冲突即降级。** 多个中文候选无法排序、Kaikki 与 OEWN/COW 对齐矛盾、或没有中文候选时，显示英文 gloss／轻提示，或在用户已启用时按规则请求本地模型；不得拼接、猜测或强行选择一个中文词。
6. **OEWN 与 COW 仅作校验。** OEWN 提供英文 sense 骨架；COW 只在已验证的 PWN↔OEWN 对应上作同义词／一致性信号。它们均不能覆盖 Kaikki 的来源字段，更不能覆盖用户直接反馈。
7. **PoC 报告而非先装整包。** 以小而有代表性的样本产出：解析数、字段缺失、各类中文候选数、未消歧翻译数、简体化失败数、跨源冲突数、逐原因丢弃数、许可证清单、人工金标结果。再按新闻／博客／技术文档等固定语料统计 `lemma hit`、`sense hit`、`可靠中文短释义 hit` 和错误释义；阈值应由这次 PoC 与 dogfood 基线决定。

## 5. 进入 Spec 前仍不能省略的决策

- 选择并锁定哪一个 Kaikki 快照、OEWN 版本、COW commit；
- 简中候选的语言代码白名单、脚本规范化与最大短释义长度；
- `sourceSenseId` 缺失时的稳定 fallback key，以及 Kaikki⇄OEWN、PWN⇄OEWN 的映射接受条件；
- 核心包的目标覆盖、体积、更新频率及长尾包安装方式；
- 人工金标集、可自动展示的置信门槛与“轻提示／英文 gloss／本地模型”降级条件；
- 将 Kaikki 的 CC BY-SA/GFDL、OEWN 的 CC BY+PWN notice、COW 的 WordNet-style notice 组合到可分发数据包时的正式许可审计。

## 来源清单

- [Kaikki 原始数据与快照说明](https://kaikki.org/dictionary/rawdata.html)
- [Kaikki English dictionary 与 deprecated 后处理下载说明](https://kaikki.org/dictionary/English/index.html)
- [Wiktextract 官方 README：英语字段、JSONL 与翻译字段](https://github.com/tatuylonen/wiktextract)
- [Wiktionary 官方版权与再利用条件](https://en.wiktionary.org/wiki/Wiktionary:Copyrights)
- [OEWN 官方仓库与 2025 发布格式／规模](https://github.com/globalwordnet/english-wordnet)
- [OEWN 许可证与 PWN 署名要求](https://github.com/globalwordnet/english-wordnet/blob/main/LICENSE.md)
- [OMW 对 COW、PWN 3.0 映射及 tab 格式的官方说明](https://omwn.org/omw1.html)
- [OMW 中的 COW 数据目录](https://github.com/omwn/omw-data/tree/main/wns/cow)
- [COW 项目页及原始数据仓库](https://bond-lab.github.io/cow/)
- [COW 许可证](https://github.com/bond-lab/cow/blob/master/docs/LICENSE)
