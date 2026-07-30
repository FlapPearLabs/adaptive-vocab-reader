---
name: kaikki-tooltip-cleaner
description: 将已准备的 Kaikki 英语词条包保守清洗为网页提示三字段记录，并为每个预登记任务给出 accept、needs_review 或 reject。凡任务涉及 Kaikki prepared packet、display_allowed_zh、网页短释义批处理、Hermes 前 100 复现或 Reasonix 后续批量清洗，都应使用本 Skill；不要用于自由翻译、完整词典编写或背词内容生成。
---

# Kaikki 网页提示轻量清洗

## 目的

把预先准备的 Kaikki 来源包转换成可由普通脚本验证的网页提示候选。质量来自“优先选择已有合格简中候选；来源不足时只做显式标记的受控模型兜底”，不是无边界自由翻译。

本 Skill 是 500 条实验中清洗模型的唯一规则来源。若 Reasonix 不能直接加载 `SKILL.md`，把本文件原文作为其 Harness／系统指令；不要暗中改写、补充或放宽规则。

## 输入要求

每个任务必须包含：

- `task_id`：预登记任务 ID；
- `expression`：英文单词或 MWE；
- `truncated`：布尔值；
- `preparation_warnings`：准备阶段警告数组；
- `source_records`：Kaikki 来源记录数组。

每个 `source_record` 至少包含：

- `source_record_index`；
- `pos`；
- `translations`。

每个 translation 至少包含：

- `translation_index`；
- `display_allowed_zh`：允许展示的简中字符串数组；
- `sense`、`tags` 可用于保守排序；来源支持路径不得据此生成新中文，只有受控模型兜底路径可生成并明确标记。

缺少必需字段、来源为空或输入范围不明时，不猜测，不补抓其它来源。

## 唯一展示记录

接受后的用户展示记录必须且只能是：

```json
{"expression":"run","pos":"v","short_zh":"跑；运行"}
```

规则：

- `expression` 必须逐字等于任务输入；
- 每个任务可接受 1～3 条不同词性的记录；
- 同一 `(expression,pos)` 最多一条；
- 同一词性的多个粗义项只能合并到一条 `short_zh`；
- `short_zh` 由 1～3 个中文粗义项用中文分号 `；` 连接，总长不超过 24 个字符；来源支持记录使用来源片段，受控模型兜底记录使用生成片段；
- 片段数量遵循最小充分原则：默认只选 1 个最简洁、最通用、最适合简体中文学习者的片段；只有为了覆盖另一个明显不同且常用的粗义项时才增加第 2／3 个片段；
- 同一 sense 下的近义、长短形式或重复表达不得为“填满 3 个”而堆叠，例如不得把 `包含／含有／蕴含`、`增加／增长／增大` 全部并列；
- 来源支持记录的每个片段必须逐字存在于对应 translation 的 `display_allowed_zh`；
- 不得改写合格来源候选；只有符合“受控模型兜底”全部条件时才可生成中文。

词性映射固定为：

- `noun → n`；
- `verb → v`；
- `adj/adv/pron/det/prep/conj/num/interj/aux/phrase` 保持原值；
- 只有无法归入上述值时才使用 `other`；
- 禁止在展示记录中直接输出 `noun` 或 `verb`。

## 决策与实验外壳

每个任务必须给出一个 `accept`、`needs_review` 或 `reject`。审核状态、原因、证据和成本属于实验外壳，不进入展示记录。

模型批次输出使用以下结构：

```json
{
  "batch_id": "101-110",
  "results": [
    {
      "task_id": "poc-101",
      "expression": "...",
      "decision": "accept",
      "records": [
        {
          "record": {"expression": "...", "pos": "v", "short_zh": "..."},
          "evidence": [
            {"source_record_index": 0, "translation_index": 12, "selected_zh": "..."}
          ]
        }
      ],
      "reason_codes": ["SOURCE_SUPPORTED"],
      "notes": []
    }
  ]
}
```

- `accept` 必须有 1～3 条记录；
- `needs_review`／`reject` 的 `records` 必须为空；
- 每个结果的 `reason_codes` 必须是至少含 1 个非空字符串的数组，不能留空；来源成立使用 `SOURCE_SUPPORTED`；使用受控模型兜底必须包含 `MODEL_GENERATED_NO_SUITABLE_SOURCE_ZH`；只有输入没有中文候选且无法可靠兜底时才使用 `NO_DISPLAY_ZH`；输入有中文候选但不适合提示、且无法可靠兜底时使用 `UNFRIENDLY_ZH`；截断使用 `TRUNCATED_SOURCE`，来源冲突使用 `SOURCE_CONFLICT`；
- `results` 必须按输入顺序完整覆盖当前批次，不得缺失、重复或增加任务。

## 来源守恒

每条接受记录必须提供 1～3 个证据指针：

```json
{"source_record_index":0,"translation_index":30,"selected_zh":"放弃"}
```

普通脚本必须独立证明：

1. 两个索引在当前 prepared packet 中存在；
2. `selected_zh` 逐字存在于该 translation 的 `display_allowed_zh` 数组；
3. `short_zh` 按 `；` 切分后的多重集合与证据中的全部 `selected_zh` 完全相同；
4. 记录的 `pos` 与证据所在 source record 的固定映射结果相同。

证据数组顺序不必等于展示片段顺序。`source_word` 是冗余回显，不是权威证据，也不应成为必需输出字段。

对来源支持记录，英文 `sense` 只能帮助在已有中文候选之间判断常用性和语义，不得冒充中文证据。受控模型兜底的中文来自模型判断，必须按下节显式标记为未验证生成项。

## 受控模型兜底

仅当某个输入词性没有适合网页提示的现代简中核心义时，才可生成 1～3 个简短、互不重复、词典式中文粗义项。优先使用合格 Kaikki 候选；不得为了“更顺口”而重写已有合格中文。同一展示记录不得混合来源片段与生成片段。

生成记录必须使用以下精确外壳：

```json
{
  "record": {"expression":"depend","pos":"v","short_zh":"依赖；取决于"},
  "evidence": [],
  "provenance": {
    "type": "model_generated",
    "reason": "NO_SUITABLE_SOURCE_ZH",
    "verified": false
  }
}
```

对应任务必须包含 `MODEL_GENERATED_NO_SUITABLE_SOURCE_ZH` 原因码。生成项不是 Kaikki 或其它权威词典事实；模型、调用、token、成本由 Harness 记录，生成记录由普通脚本另存为 `generated.jsonl`。若不能可靠给出短释义，仍返回 `needs_review` 或 `reject`。

## 处理流程

1. 核对本批 task id、数量和顺序，拒绝越界输入。
2. 对每个任务检查 `truncated`、警告、来源记录和可展示中文候选。
3. 按 source record／词性分组候选，使用英文 `sense` 只做候选间保守排序。每个有常用 sense 且存在合适候选的词性都要独立形成记录；不得因为另一个词性已产生记录而静默漏掉它。
4. 候选排序依次考虑：与 `sense` 的语义和词性是否自然匹配、是否覆盖宽泛常用义、中文是否现代通行且可独立展示；只有这些条件相同时才比较长短。不能只因候选更短或排在前面就选择它。
5. 每个词性默认只选 1 个片段；只有另一个候选代表明显不同且常用的粗义项时才增加片段，最多 3 个。同一非空 `sense` 最多选择 1 个中文片段，`收到；接到`、`留下；剩下`、`鼓励；激励` 这类同 sense 近义堆叠一律禁止。
6. 罕见义、古旧义和窄义不得与更常用义并列凑覆盖；例如 `deliver` 有现代递送义时，不应加入古旧的“拯救”义。如果所有中文候选都只覆盖窄义、古旧义，或缺失该表达的日常核心义，可按受控模型兜底生成并明确标记；不能可靠兜底时返回 `needs_review`，不得把窄义冒充默认提示。
7. 中文片段必须能在对应 `pos` 后自然独立显示。若同 sense 有更自然候选，应选更自然候选；像名词 `offer` 选择动词式“提供”、动词 `form` 选择不能自然独立展示的“构”都不合格。单字本身不自动失败，但不能是脱离搭配无法成立的截短语素。
8. 如果候选只覆盖罕见义、中文不适合学习者提示或缺失核心义，先判断是否符合受控模型兜底；义项冲突或无法在 3 个片段内形成可靠默认提示时返回 `needs_review`。
9. 来源明确失效时返回 `reject`；完全没有可展示简中候选且不能可靠受控兜底时返回 `reject`；`truncated=true` 时返回 `needs_review` 或 `reject`。
10. 输出批次 JSON，交给普通脚本做独立校验。模型输出始终是待审候选，不自批通过。

## 强制拒绝或待审

以下情况不得产生展示记录：

- `truncated=true`；
- 来源为空或 HTTP 404；translations 为空或没有 `display_allowed_zh` 且无法可靠完成受控兜底；
- 需要依赖模型知识得到中文，但没有按受控兜底协议明确标记；
- 中文候选、词性或义项冲突无法保守解决；
- 可用候选只覆盖不适合作为默认网页提示的窄义，且无法可靠完成受控兜底；
- 唯一中文候选语体过旧、过生僻或本身不利于学习者理解，且无法可靠完成受控兜底；
- 唯一候选虽是中文但不符合当前简体中文学习者的通行写法（例如只有 `想像` 而没有 `想象`）；不得把来源候选静默转换，可按受控模型兜底生成并标记，否则待审；
- 来源支持记录的来源指针无法由普通脚本验证；
- 同一 `(expression,pos)` 无法合并为一个不超过 3 个片段的可靠提示。

已知失效或异常来源不补词、不替换、不重新抓取，只如实给结论。

## 禁止内容

不生成例句、发音、词频、考试等级、CEFR、词源、搭配、领域、难度、学习建议或用户状态。不建设签名链、多层 receipt、隐藏金标隔离、Skill 加密批准链或多层状态机。

## 确定性验证

普通脚本按顺序执行，任一步失败即停止当前批次：

1. 当前批次所有任务恰好各出现一次；
2. 每个任务决策合法，accept 与 records 数量一致；
3. 每条展示记录字段集合精确等于 `expression/pos/short_zh`；
4. 来源支持记录必须有 1～3 个证据，且多个证据不得引用相同的非空规范化 `sense`；受控生成记录必须 `evidence=[]`、provenance 精确匹配、词性存在于输入、含 1～3 个互不重复片段并带匹配原因码；
5. expression 与输入逐字相等；
6. pos 在允许集合内且与来源记录映射一致；
7. 每个 `(expression,pos)` 唯一；
8. short_zh 长度与片段数合法；
9. 每个来源指针存在；
10. 每个 selected_zh 逐字存在于指针对应的 `display_allowed_zh`；
11. short_zh 分片与 selected_zh 多重集合完全相同；
12. truncated／缺来源任务没有接受记录；
13. 当轮 usage、token 和成本口径可读取；订阅内调用可记为 `SUBSCRIPTION_INCLUDED`，按量调用必须有可核对成本。

## 停止条件

出现任一情况立即停止新增模型调用并交回 Codex：

- 未按受控模型兜底协议标记的自造、改写或无来源中文；
- 展示字段越界或证据无法机械验证；
- 相同结构性错误连续出现；
- usage、成本口径为 UNKNOWN、异常或账本不守恒；
- 模型使用未授权 Skill、外部工具、网络来源或扩大任务范围；
- 累计任务可能超过 500；
- 累计成本达到 80 元；达到 60 元先记录预警，达到 95 元停止所有新增模型调用。

真实失败模式见 [references/failure-patterns.md](references/failure-patterns.md)，已验收示例见 [examples/accepted.json](examples/accepted.json)。
