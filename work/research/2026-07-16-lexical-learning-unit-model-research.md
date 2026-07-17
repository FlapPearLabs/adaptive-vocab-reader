# 英语网页阅读插件：学习单元映射与掌握推断研究

> 状态说明：这是 arXiv 复核前的第一阶段研究。后续 [个性化词汇模型证据审查](./2026-07-16-arxiv-personalized-lexical-model-review.md) 已将“表达图直接承担掌握推断”和任何固定风险阈值修订为“高召回候选＋上下文过滤＋个性化概率＋成本敏感展示”。本文关于词形、MWE 和反例的数据职责仍可复用；涉及硬传播、最长匹配即成立或固定公式的表述不得单独作为实现规范。

**研究问题。** 面向已有高考/CET-4 左右基础、阅读英文网页时主要被少量生词、短语和陌生义项打断的用户，插件应如何把词面形式、屈折、派生、多义词、搭配、短语动词和习语映射为学习单元；又应如何用一次短测评和长期反馈估计掌握状态。

**范围。** 本文只给 V0.1 可落地的模型和数据证据，不修改产品规格或代码。所有外部依据均来自官方数据/规范、项目仓库或原始论文。

## 结论先行

不能在“一个词面一个状态”和“整个词族一个状态”之间二选一。适合本产品的是一个**分层表达图（expression graph）**：

1. `surface occurrence`：网页里这一次出现的字符串和上下文；
2. `lexeme-sense`：`lemma + POS + 粗粒度义项`，例如 `run / VERB / 跑动` 与 `run / VERB / 经营` 是不同节点；
3. `inflection set`：同一 lexeme-sense 的屈折形式，例如动词 `run/runs/ran/running`；
4. `derived lexeme-sense`：派生词是独立节点，并以“可迁移程度”连接到基础义项，例如 `run → runner（跑步者）`；
5. `MWE-sense`：短语动词、习语、词汇化搭配是独立节点，例如 `run into`、`run out of`、`run the gauntlet`。

用户界面仍然只需要“会 / 不会 / 忽略”。复杂性全部留在后台：用户对当前上下文中的表达作反馈，系统再把证据传播到**有充分理由共享知识**的节点。

V0.1 的核心规则应是：

- **屈折硬继承，但必须先消除词性/用法歧义。** `running` 若确实是 `run` 的动词进行式，可共享状态；若是名词或词汇化形容词，则不能共享。
- **派生软继承，不自动写成“已知”。** `runner` 在“跑步者”义上可从 `run` 获得很强的已知先验，但 `runner` 也可表示地毯、滑橇、藤本枝条等；`rerun` 也不是 `run` 的普通屈折。软继承只改变提示强度，直接反馈永远优先。
- **短语/习语独立，最长且最具体的表达优先匹配。** 命中 `run into` 时，不能因 `run` 已知而先隐藏它。
- **多义词按粗粒度义项建模。** V0.1 不必追求字典级几十个 sense，但至少要区分会导致不同中文理解的核心义项。
- **初始测试只产生分层先验，不产生精确词表。** 在没有校准题库和群体数据时，用频率段/表达类型上的 Beta 后验即可；不要把初测题量误称为已实现 IRT 自适应测评。2026-07-17 的产品规则已选择首次一次完成固定 50 项；本研究中关于 56 题与渐进策略的内容仅保留为当时的候选分析，不覆盖 `RULES.md`。
- **长期状态用证据账本更新。** 显式“会/不会”和复测结果是强证据；打开释义是弱负证据；仅仅曝光不等于学会。

## 为什么 `lemma` 或传统“词族”都不够

第二语言研究里的 `lemma` 通常包含同一词性的屈折形式；“词族”还会把派生词纳入。2023 年一项开放研究明确用 `read/reads/reading` 说明 lemma，用 `reader/readability/readable/unreadable` 说明更大的 word family，并指出这两种计数单位长期被用于词表和测试。[原始研究：Understanding L2-derived words in context](https://www.cambridge.org/core/journals/studies-in-second-language-acquisition/article/understanding-l2derived-words-in-context-is-complete-receptive-morphological-knowledge-necessary/6F89B4C3925339B96901630B83065F4C)

Bauer 与 Nation 的经典分级也不是说“认识 base 就必然认识整个词族”，而是按屈折、生产力、频率、规则性和可预测性逐级扩大词族；其 Level 2 才只是把屈折形式合并，后续级别才逐步纳入派生。[原始论文：Word Families](https://www.lextutor.ca/morpho/fam_affix/bauer_nation_1993.pdf) 之后的阅读覆盖研究也发现，不需要知道一个词族中的大多数派生词；少量高频词缀与 base、屈折形式即可贡献大部分覆盖。[原始论文：How Much Knowledge of Derived Words Is Needed for Reading?](https://academic.oup.com/applij/article/41/6/971/5637291)

这正好说明产品需要“关系 + 迁移强度”，而不是把整族写成同一个布尔值。

### `run` 例子的正确拆法

| 网页表达 | 后台单位 | 用户已知 `run=跑` 后的默认处理 |
| --- | --- | --- |
| `runs / ran / running`（动词） | 同一 `run.v.motion` 的屈折 | 继承已知，不提示 |
| `running`（运营中的；流水的；名词“跑步”） | 另一个 lexeme-sense 或词汇化用法 | 不硬继承；按语境和频率软降权 |
| `runner`（跑步者） | 派生节点 `runner.n.person` | 高迁移先验；通常不强提示，但保留低成本纠错入口 |
| `runner`（长条地毯等） | `runner.n.object` | 独立判断，不能被“跑”义隐藏 |
| `rerun` | 派生节点 | 独立判断；认识 `run` 只提供有限迁移 |
| `run a company` | `run.v.manage` | 独立义项，不能由“跑”义直接继承 |
| `run into` | 短语动词节点 | 独立判断，优先于内部 `run` |
| `run the gauntlet` | 习语节点 | 独立判断并优先提示 |

## V0.1 的表达分类

不建议让产品枚举过细的语言学标签。内部只需六类，已足以决定状态传播和提示策略：

1. **INFLECTION**：同 lemma、同词性、同核心义项的语法变化；
2. **TRANSPARENT_DERIVATION**：意义通常可由 base + 常见词缀组合推断，但仍是独立词，例如典型施事者 `-er`；
3. **LEXICALIZED_DERIVATION**：形式相关但意义已词汇化、发生明显漂移或多义；
4. **POLYSEMOUS_SENSE**：同 lemma/POS 下会造成阅读理解差异的常见义项；
5. **MWE_COMPOSITIONAL**：固定度较高、整体仍较可组合的短语/搭配；
6. **MWE_IDIOMATIC**：短语动词、习语、轻动词结构等不可安全按单词求和的表达。

PARSEME 的正式标注框架把多词表达与仅有统计共现特殊性的 collocation 区分，并把 verbal MWE 细分为 light-verb construction、verbal idiom、idiomatic verb-particle construction 等类别；它也明确允许连续或不连续结构。[PARSEME 1.3 官方指南](https://parsemefr.lis-lab.fr/parseme-st-guidelines/1.3/fulldoc.php) [PARSEME 2.0 分类页](https://parsemefr.lis-lab.fr/parseme-st-guidelines/2.0/?page=tests-verbal) V0.1 可以借其分类思想，但不应声称已达到 PARSEME 级自动识别：其 1.3 语料是 26 种语言、以 Universal Dependencies v2 标注的人工语料，研究本身仍强调 unseen VMWE 是重点难点。[PARSEME 1.3 原始论文](https://aclanthology.org/2023.mwe-1.6/)

## 可用数据的职责边界

### UniMorph：适合屈折表和派生候选，不适合判断“认识能否迁移”

UniMorph 的正式 schema 把一个屈折形式表示为 `lemma + morphology feature bundle`，并明确这是词本位的范式表示，不提供词素在字符串中的切分。[官方 schema](https://unimorph.github.io/schema/) 这正适合 V0.1 建立屈折集合。

官方英语仓库同时发布 `eng`、`eng.derivations.tsv` 和 `eng.segmentations`；仓库说明来源为 Wikipedia、许可为 CC BY-SA 3.0。[UniMorph English 官方仓库](https://github.com/unimorph/eng) 但它的派生文件提供的是 base/derived/POS/affix 候选关系，不提供学习者是否能推导其意义的人工透明度分数。因此：

- 用 UniMorph 做屈折查表、异常形式补全和构建期校验；
- 派生关系只作为候选边，必须再经过字典 sense、词频和人工规则过滤；
- 不把 UniMorph 的 derivation 边直接翻译为“用户认识 base 就认识 derivative”。

### OEWN：适合义项骨架，不解决当前语境消歧

Open English WordNet 将词组织为 synset，并提供 hypernym、antonym、meronym 等语义关系；2025 核心版有 135,969 words、107,519 synsets。[OEWN 官方仓库](https://github.com/globalwordnet/english-wordnet) Global WordNet 的 LMF 规范把 lexical entry、sense 与 synset 分开，而且定义通常在 synset 层，必要时才用 `sourceSense` 指明单一 sense。[GWN-LMF 官方格式](https://globalwordnet.github.io/schemas/)

因此 OEWN 可用来生成稳定的 `lexeme-sense` 节点和粗粒度 sense cluster，但它不是词义消歧器，也没有证明网页中某次 `run` 应落到哪个 sense。

### MorphoLex：适合研究派生结构，不是完整生产字典

MorphoLex 原始论文发布了 68,624 个 English Lexicon Project 词的派生数据库，并提供六个 affix 变量和三个 root 变量；研究还用 4,724 个“一根一后缀”的复杂名词验证其变量。[原始论文记录](https://pubmed.ncbi.nlm.nih.gov/29124719/) 它很适合帮助建立 affix 生产力、family size 和结构候选，但覆盖和研究目的决定它不能单独承担网页长尾词、词义和短语识别。

### Kaikki/Wiktextract 与 OEWN 多词条：用于候选词典，不代表自动识别正确

[Wiktextract 官方项目](https://github.com/tatuylonen/wiktextract)可抽取词性、义项、词形、翻译和多词条目；Kaikki 发布的固定快照可与 OEWN 的多词 lemma 一起生成本地 MWE 候选表。运行时仍需做最长匹配、词形展开和简单句法模板验证。不能因为词典中存在一个短语，就认定任何相邻同形 token 都是该短语义。

## V0.1 检测算法

### 第一步：生成所有候选，不急着隐藏内部单词

对正文句子做本地 tokenization、POS 和 lemmatization，然后并行生成：

- 单 token 的所有 `lemma + POS` 候选；
- 从本地 MWE trie 命中的连续 2–5 token 候选；
- 对高价值 verb-particle 模板，允许有限的不连续匹配，例如 `pick ... up`；
- 从词形表和派生表得到 inflection/derivation 关系。

V0.1 不需要训练大型 MWE 神经模型。先用词典枚举 + 窄句法规则，能够保证本地、可解释和可回归；未命中的表达允许用户框选加入。

### 第二步：按“具体表达优先”解决重叠

候选优先级为：

```text
已确认的习语/MWE
  > 通过句法模板的短语动词
  > 词汇化派生或独立多义项
  > 透明派生
  > 单词基本义
```

“最长匹配”是必要条件，但不是唯一条件。`run into` 可覆盖内部 `run`，而普通 `run quickly` 不能因某个稀有多词条目误合并。被覆盖的内部单词候选仍保留在卡片详情和调试日志中，但不单独占正文提示位。

### 第三步：只做粗粒度 sense resolution

V0.1 可用这些廉价信号排序 sense：POS、相邻介词/particle、直接宾语类型、词典例句相似度、该 sense 的常见度。无法拉开差距时，不强行宣称已消歧：

- 若候选 sense 都已知，可不显示；
- 只要存在高影响且可能未知的 sense，就至少保留轻提示；
- 用户展开时再用本地模型生成“当前句义”，并明确标成模型解释。

这符合项目“漏标成本高”的偏好：**不确定表达不会因 base 已知而彻底消失。**

## 状态传播：硬身份、软迁移、零迁移

每个关系边保存 `relation_type`，运行时计算迁移证据，不直接复制状态：

| 边 | 正向迁移 | 反向迁移 | V0.1 规则 |
| --- | --- | --- | --- |
| 同 sense 屈折 | 强 | 强 | 形态与 POS 唯一时视为同一学习单元 |
| 透明派生 | 中到强 | 弱 | 只改变显示风险，不写入 `known` |
| 词汇化派生 | 弱或零 | 零 | 独立反馈 |
| 同 lemma 不同义项 | 弱 | 弱 | 只共享“形式熟悉”，不共享“理解当前义” |
| 短语/MWE 与组成词 | 零 | 零 | 完全独立 |

透明派生不宜靠一个全局 affix 白名单决定。至少同时要求：

1. base sense 与 derived sense 在字典中可对齐；
2. affix 属于构建期人工批准的高生产力规则；
3. derivative 的当前 sense 没有明显词汇化标记；
4. 形式频率/语境没有显示它主要以另一义项出现。

即便四项通过，V0.1 也只给“软继承”。这是避免 `runner`、`running` 这类多义派生被粗暴隐藏的关键。

## 初始短测评：分层 Beta 后验，而不是伪 IRT

### 题目应按两个轴分层

只按词频抽题无法测试这个产品真正困难的部分。建议 56 题覆盖：

- 单词基本义：跨若干 Zipf 频率段；
- 高频多义词的非基本义；
- 高频、语义透明的派生词；
- 短语动词/习语/MWE。

题型应以“当前表达在短句中的意思”为主；纯“见过/没见过”只能作附加信号。测试结果按 `frequency_band × expression_type` 聚合，而不是直接宣布前 N 千词全部已知。

### 频率是重要先验，但远非答案

SUBTLEX-US 的原始研究发现，字幕频率比许多书面语料更能预测词加工；contextual diversity 又优于原始出现次数，而且英语中 lemma 频率并不优于 word-form 频率。[Brysbaert & New 2009](https://biblio.ugent.be/publication/599801) Zipf 量表将每百万 0.01、0.1、1、10、100、1000 次分别映射到 1–6；作者把 3 以下称为低频、4 以上称为高频，但也提醒缺失词和小语料要谨慎处理。[SUBTLEX-UK / Zipf 原始论文](https://journals.sagepub.com/doi/10.1080/17470218.2013.850521)

更直接的 L2 证据是：403 名学习者的研究中，词频与 Rasch item difficulty 相关仅 `r=0.50`，即词频只解释约 25% 变异；1,000 词频段本身也受到质疑。[Hashimoto 2021 原始研究](https://scholarsarchive.byu.edu/facpub/6673/) 所以 V0.1 应同时存 `surface Zipf`、`lemma Zipf`、contextual diversity、表达类型和用户领域反馈，不能把一个 rank 当成掌握概率。

### 无校准题库时的可实现更新

对每个测试分层 (g) 保存：

```text
theta_g ~ Beta(alpha_g, beta_g)
correct/known  -> alpha_g += 1
wrong/unknown  -> beta_g  += 1
```

`E[theta_g]` 只是“该用户在这个分层中大致掌握的比例”，可作为未见表达的先验；区间宽度告诉系统哪里不确定。这个方法不需要假装知道题目 discrimination/difficulty，且能在单用户、少题条件下稳定运行。

限制必须写清：Beta-Binomial 把同一分层内题目近似视为可交换，无法给某个具体词输出经校准的客观概率。产品内部最好叫 `knowledge support` 或 `display risk`，不要在 V0.1 UI 宣称“该词有 83% 概率认识”。

## 为什么 V0.1 不该直接上 IRT/Rasch 或 BKT

### IRT/Rasch：以后可做题库校准，现在不可冒充

Rasch 可以成为后续短测评的正式标定方法，但前提是有响应样本、检查题目拟合、单维性和测量不变性。Vocabulary Size Test 的原始验证用了 140 题、19 名母语者与 178 名日语母语学习者，并报告 item fit、85.6% 单维解释和不同题组下的 measurement invariance。[Beglar 2010 原始研究](https://journals.sagepub.com/doi/abs/10.1177/0265532209340194) CAT 研究也把“预校准 item pool”视为基础构件。[原始 item calibration 研究](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0106747)

因此，一个刚创建、没有群体响应的 56 题题库只能使用专家分层先验；不能可靠估出 item difficulty、discrimination 或自适应信息量。以后收集到足够匿名响应后，可单独做 Rasch 校准，并检查：中国学习者样本上的 DIF、猜测影响、单词/MWE 是否其实是多维构念。

### BKT：与 V0.1 的观测机制不匹配

经典 BKT 源于程序设计导师中的程序规则学习，维护 `prior mastery / learn transition / slip / guess` 四类参数并追踪练习后的隐藏掌握状态。[Corbett & Anderson 1995 原始论文](https://link.springer.com/article/10.1007/BF01099821) 它适合有重复、相对一致练习机会的知识组件。

本插件首期观测却混合了“我会”“不会”“展开释义”“在上下文选择正确”“保温抽检”等不同强度事件，而且每个词/义项的序列极稀疏。此时无法为每个单元可靠估计 learn/slip/guess；经典模型还默认不遗忘，而本项目恰恰需要保温抽检。BKT 的参数学习研究也长期讨论局部最优、退化参数与可识别性问题。[BKT 参数研究](https://learninganalytics.upenn.edu/ryanbaker/paper_143.pdf)

V0.1 更适合“证据账本 + Beta 后验 + 时间衰减规则”。有了足够复测序列后，再比较带 forgetting 的 BKT 是否真的优于简单基线。

## 长期反馈算法

每个学习单元保留不可变事件，而不是只存最终枚举状态：

```text
explicit_known       强正证据，立即停止强提示
explicit_unknown     强负证据，立即强提示并进入复习
review_correct       正证据
review_wrong         强负证据，known -> learning
gloss_opened         弱负证据
ignored              展示规则覆盖，不等同于“认识”
passive_exposure     只计出现次数，不更新掌握
```

直接事件更新当前节点的 Beta 证据；关系传播只作用于**先验/显示风险**，不得伪造另一节点的 `explicit_known`。推荐顺序是：

1. 显式 override；
2. 当前节点的复测证据；
3. 关系迁移证据；
4. 测评分层后验；
5. 全局频率/表达类型先验。

这能保证用户点“不认识 `run into`”不会把 `run` 本身降级，点“认识 `run`”也不会抹掉 `run into`。

## 可直接实现的 V0.1 决策流程

```text
sentence
  -> token/POS/lemma
  -> 枚举单词、派生、MWE 候选
  -> 词典 + 窄句法规则确认表达
  -> 最具体表达优先解决重叠
  -> 取得当前节点直接证据
  -> 加入安全的关系迁移证据
  -> 加入测试分层先验与频率先验
  -> 得到 display_risk + uncertainty
  -> strong gloss / light hint / hidden
```

保守规则：只有“明确已知”或“无歧义屈折继承”可以完全隐藏。透明派生如果没有直接证据，最多从强释义降为轻提示；MWE、习语和明显不同义项永远不因组成词已知而隐藏。

## 验证门禁

V0.1 上线前应建立一个人工金标句集，刻意覆盖：

- 同一 surface 的不同 POS/义项：`running`；
- 表面透明但多义的派生：`runner`；
- 前后缀派生：`rerun`；
- 多义 base：`run a company`；
- 连续与可分短语动词：`run into`、`pick it up`；
- 习语与普通字面序列对照。

至少分别报告：

- expression candidate recall；
- MWE recall；
- sense/POS 粗分类准确率；
- **错误完全隐藏率**（用户不会却无任何提示）；
- 强提示误报率；
- 每千词人工纠错数；
- 派生迁移错误率。

由于产品优先避免漏标，最重要的安全门禁不是总体 accuracy，而是“未知 MWE/不同义项被 base 已知状态彻底隐藏”的比例。

## 现在不能承诺的事项

1. **不能承诺一次 56 题测试识别某个用户 80% 的具体熟词/生词。** 它只能给频率段与表达类型建立先验；“80%”必须先定义分母，再由真实目标语料和用户标注验证。
2. **不能承诺词频等于难度。** 现有 L2 实证只支持中等相关，且用户的学科、考试经历和兴趣会制造大量个体偏差。
3. **不能承诺完整自动识别所有 MWE、习语和当前义项。** PARSEME 仍把 unseen MWE 视为核心难点；V0.1 必须保留用户框选和纠错入口。
4. **不能承诺“透明派生”是词缀层面的固定真值。** 透明度取决于 base sense、derived sense 和上下文；`-er` 也会产生词汇化多义。
5. **不能在没有群体响应时宣称 IRT 校准或 CAT 精度。** 也不能在没有重复复测序列时宣称 BKT 已可靠追踪遗忘。

## 推荐的落地顺序

1. 先冻结分层表达数据模型和事件账本；
2. 用 UniMorph + OEWN/Kaikki 构建 100–500 条人工可审计的 `inflection / derivation / MWE / sense` PoC；
3. 建 `run` 一类高风险金标句集，验证“最具体表达优先”和状态传播；
4. 实现 56 题的分层 Beta 初始化，UI 只显示区间与校准期，不显示伪精确概率；
5. 真实试用后再拟合迁移权重和提示阈值；
6. 只有获得足够群体响应，才进入 Rasch/IRT 题库校准；只有获得足够复测序列，才比较 BKT。

这个设计把复杂性放在后台图结构和证据层，前台仍然只有用户能理解的“这处表达会不会让我卡住”。它既不会因认识 `run` 就铺开整个词族，也不会让 `runs/ran/running` 的普通动词用法反复打断已经有基础的读者。
