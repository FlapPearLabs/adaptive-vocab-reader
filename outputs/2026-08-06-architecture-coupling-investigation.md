# 查询覆盖、交互包装、主动提示与测评词包耦合调查

## 1. 调查边界

- 日期：2026-08-06
- 比较基点：`011e069f0135d48822be7cf2935b8cbf84c2f574`
- 调查类型：只读架构、规则漂移、数据覆盖与真实 Chrome 事实调查
- 未实施：生产代码、`RULES.md`、Spec、ticket、词典、schema、远端配置
- 浏览器：Chrome for Testing `151.0.7922.47`，隔离 profile

用户本轮最新目标优先于既有规则：普通英文词原则上应可查询并反馈；灰线只用于少量“潜在可能不会”候选；无灰线和 known 词仍可查询并纠错；查询词典是否等于测评词包尚未决定。

## 2. EXECUTIVE_CONCLUSION

这是以下四类问题同时存在，而非单独的数据缺词：

1. **查询覆盖不足**：运行时只有 1,000 个 core wordKey 和 1,505 个 forms alias。指定 14 个样本中 7 个命中、7 个完全不命中；未命中的词对应 lemma 也不在 core。
2. **交互与视觉提示结构性耦合**：只有 `lookup != null && decision != none` 才生成 `.avr-word`；tooltip 和会/不会菜单只作用于 `.avr-word`。known 与 lookup-null 词均无交互载体。
3. **主动提示稀疏化尚未实现**：无显式状态一律视为 unknown，unknown 一律 light；页面展示不使用词频 band、估计、AssessmentEvidence、概率或能力阈值。
4. **最新用户目标与现行 RULES/Spec 漂移**：现行规则明确 `unknown=轻提示、known=不提示`，并让固定 1,000 词包同时承担页面查询、测评和估计。当前代码忠实实现了这套旧口径，但它与本轮最新目标冲突。

其他确认事实：

- 真实 Chrome 中把 `building` 标记为 known 后，其 `.avr-word` 包装立即被移除。
- tooltip 默认覆盖目标词和相邻正文；顶部附近还会侵入 sticky header。主因是定位算法，不是普通页面 z-index 把 tooltip 压住。
- 真人拖选问题已复现：真实 mouse drag 得到 Selection 后，`mouseup` 创建按钮，紧随其后的 document `click` 又立即隐藏按钮。现有 E2E 只合成 `Range + mouseup`，没有覆盖这条真实事件序列。

## 3. CURRENT_PIPELINE

```text
页面 TextNode
  │
  ├─ isContentNode：跳过 code/pre/nav/header/footer/form/comment/扩展节点
  │
  └─ extractWordsFromText：ASCII 英文词正则 + lowercase/所有格归一化
      │
      ▼
  dictionary.lookup(surfaceForm)
      ├─ core 自身命中 → wordKey = core key
      ├─ forms 命中 → wordKey = forms[surface] 指向的 core key
      └─ null → 直接跳过，无查询或反馈入口
              │
              ▼
         vocabState[wordKey]
              ├─ 无记录 → unknown
              ├─ known
              └─ learning
              │
              ▼
      getDisplayDecision
              ├─ unknown → light
              ├─ learning → strong
              └─ known → none
              │
              ▼
         annotations[]：只加入 decision != none
              │
              ▼
       annotateTextNode：再次过滤 none
              ├─ light → .avr-word.avr-light
              └─ strong → .avr-word.avr-strong(-first)
                      │
             ┌────────┴────────┐
             ▼                 ▼
       pointerover tooltip   click 会/不会菜单
                               │
                               ▼
                        handleUserAction
                               │
                   本地状态 + applyWordDisplay
                               │
                               ▼
                         STATE_CHANGE
                               │
                 worker 持久化 + 标签页广播
                               │
                               ▼
             popup GET_STATE → learning + core 命中
                               │
                               ▼
                             生词本
```

### 3.1 六个直接问题

1. 一个词成为 `.avr-word` 必须同时满足：DOM 可扫描、tokenizer 提取成功、core/forms lookup 成功、展示决策为 light/strong、位置合法且不重叠。
2. `decision=none` 没有当前 hover/click 交互；初扫不包装，状态变 known 后已有包装也被还原为纯文本。
3. `lookup=null` 没有查询或反馈入口；选区加词也依赖同一个 lookup。
4. 当前查询范围是固定 1,000 core wordKey 加 1,505 个有效 forms alias，不是 2,505 个独立释义词条。
5. 当前灰线候选范围等于该 lookup 范围内所有无显式状态或显式 unknown 的词。
6. 当前没有潜在不会概率、频率阈值、能力阈值或候选选择逻辑。

### 3.2 已确认的增量更新缺口

若一个 known 词已被还原为纯文本，之后通过首测/每日变成 learning，`applyWordDisplay` 只查询已有 `.avr-word[data-word]`，不能重新包装纯文本。该页面可能要刷新或遇到新的 DOM 插入后才能出现强提示。

## 4. DESIGN_CONFLICT_TABLE

| 主题 | 用户最新目标 | 当前 RULES/Spec | 当前代码 | 是否一致 | 漂移层 |
|---|---|---|---|---|---|
| 普通英文词可查询 | 原则上普通词都能查 | 固定 1,000 core；扩容冻结 | 只查 core/forms | 否 | 产品规则、数据、代码 |
| 无灰线词反馈不会 | 仍可查询并反馈 | 没有通用要求；known 不提示，选区抑制 known | none 不包装；known 选区不弹 | 否 | 规则、交互架构 |
| unknown 含义 | 不应等于潜在不会 | 明确 `unknown=轻提示` | 无记录直接 light | 否 | 规则、策略 |
| known 可交互 | 无视觉提示但仍可查、可纠错 | known 不提示；阅读增强 Spec 抑制 known 选区 | 包装移除，无 hover/click | 否 | 规则、代码 |
| 查询词典与测评包 | 是否同范围尚未决定 | 固定 1,000 词同时承担阅读、测试、估计 | content、popup、quiz 共用同一 core/forms | 否，现实现已代替用户决定 | 规则、架构 |
| 主动提示应稀疏 | 少量潜在不会词 | unknown 全量轻提示；高置信隐藏冻结 | 所有未测命中词 light | 否 | 规则、策略 |
| tooltip 避免遮挡 | 尽量不遮正文 | Spec 只规定四行内容，无定位验收 | 以词左上角为锚点，默认覆盖词和下方正文 | 否 | Spec 缺口、代码 |
| 未收录词行为 | 普通词原则上仍应可查 | 未收录词选区静默 | scanner/选区均静默 | 否 | 规则、数据、代码 |
| learning 红提示 | 不会后红色提示并进生词本 | 明确支持 | strong + notebook | 是 | — |
| known 后撤除 | 红提示和生词本消失 | 明确支持 | none + notebook 过滤 | 是 | — |
| 真人拖选 | 应稳定出现入口 | Spec 写 mouseup，E2E 要求出现 | 真实 click 紧接着隐藏按钮 | 否 | 实现、测试 seam |

2026-07-30 重新对齐 Spec 明确冻结高置信自动隐藏、Pool B 和概率画像。这解释了代码为什么没有“潜在不会”判断，但该产品决定目前已与本轮最新用户目标冲突。

## 5. WORD_FACT_TABLE

以下结果来自隔离新 profile，初始 `WordState={}`；无记录按生产逻辑解释为 unknown。

| surfaceForm | scanner | core | forms | wordKey | WordState | decision | DOM | hover | 会/不会 | 根因 |
|---|---:|---:|---|---|---|---|---:|---:|---:|---|
| evaluating | 是 | 否 | 否 | — | 不进入状态查询 | — | 否 | 否 | 否 | A |
| improving | 是 | 否 | improve | improve | 无记录→unknown | light | 是 | 是 | 是 | F |
| building | 是 | 是 | — | building | 无记录→unknown | light | 是 | 是 | 是 | F |
| collecting | 是 | 否 | collect | collect | 无记录→unknown | light | 是 | 是 | 是 | F |
| requires | 是 | 否 | require | require | 无记录→unknown | light | 是 | 是 | 是 | F |
| published | 是 | 否 | publish | publish | 无记录→unknown | light | 是 | 是 | 是 | F |
| environments | 是 | 否 | environment | environment | 无记录→unknown | light | 是 | 是 | 是 | F |
| reinforcement | 是 | 否 | 否 | — | 不进入状态查询 | — | 否 | 否 | 否 | A |
| inference | 是 | 否 | 否 | — | 不进入状态查询 | — | 否 | 否 | 否 | A |
| framework | 是 | 否 | 否 | — | 不进入状态查询 | — | 否 | 否 | 否 | A |
| storing | 是 | 否 | 否 | — | 不进入状态查询 | — | 否 | 否 | 否 | A |
| drafted | 是 | 否 | 否 | — | 不进入状态查询 | — | 否 | 否 | 否 | A |
| reaches | 是 | 否 | 否 | — | 不进入状态查询 | — | 否 | 否 | 否 | A |
| customer | 是 | 是 | — | customer | 无记录→unknown | light | 是 | 是 | 是 | F |

根因说明：

- A：lemma 不在当前查询词典。上述七个未命中词对应的 `evaluate/reinforcement/reinforce/inference/infer/framework/store/draft/reach` 也均不在 core。
- B：本组样本没有已证实的“lemma 在 core、但 forms 缺失”案例。
- F：未测试词无条件 light。
- 初始样本没有 C、D、E、G；另行实测 `building` 标记 known 后属于 D→E，包装消失。

## 6. COVERAGE_AND_HINT_DENSITY

统计使用真实网页、生产 tokenizer/lookup/状态规则和空隔离 profile。type 为归一化 surface type。“固定 50 题后”采用十频段各 5 个 wordKey 的固定分析 seed，并假定全部答对，从而得到最有利于减少灰线的情况。

| 页面样本 | token / type | lookup 成功 | lookup 失败 | 空状态 light token / type | strong | none | 实际 `.avr-word` | 50 题后命中词仍 light |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| GitHub 仓库页 | 323 / 157 | 69（21.36%） | 254（78.64%） | 69（21.36%）/42（26.75%） | 0 | 254 | 69（21.36%） | 66/69（95.65%） |
| MDN JavaScript Guide | 1,548 / 531 | 792（51.16%） | 756（48.84%） | 792（51.16%）/221（41.62%） | 0 | 756 | 792（51.16%） | 750/792（94.70%） |
| Wikipedia AI | 27,740 / 5,856 | 12,144（43.78%） | 15,596（56.22%） | 12,144（43.78%）/1,080（18.44%） | 0 | 15,596 | 快照时 8,439（30.42%） | 11,733/12,144（96.62%） |

Wikipedia 的规则计算值与快照 DOM 数不同：页面持续动态更新，当前 observer 不监听 `characterData`，且部分动态文本在快照时尚未重新包装。这不改变“lookup 成功且无状态必定 light”的策略事实，但说明真实 SPA 的交互覆盖还受 DOM 生命周期影响。

首测固定改变 50 个不同 wordKey；无论答对还是答错，剩余 950/1000（95%）仍是 unknown。答错只把部分词从 light 变为 strong，不会减少总提示。因此“词包内绝大多数词满篇灰线”是当前规则的天然结果，不是偶发误判。

## 7. INTERACTION_COUPLING

- tooltip 和菜单均通过 document delegation 查找 `.avr-word`。
- `.avr-word` 只为 light/strong 创建。
- known 的 none 没有视觉样式，也没有交互载体。
- lookup-null 更早被 scanner 丢弃。
- 选区入口仍要求 lookup 成功，并抑制 known/learning。
- worker 的 `STATE_CHANGE` 技术上接受字符串 key，但页面没有面向用户的入口为 lookup-null 或 known 词发出该消息。

所以扩大词典只能改善 lookup-null；不能解决 known/无视觉提示词的交互，也不能解决灰线密度。反过来，如果先实现提示稀疏化、但仍只包装提示词，会让更多可查询词失去 hover/click。

### 7.1 查询、交互、提示解耦方案

| 方案 | 分析 |
|---|---|
| A：只包装提示词 | DOM 少，但 tooltip/menu 必然只属于提示词，不能满足无提示仍可 hover。 |
| B：包装所有可查询词，无提示词使用无视觉样式 | 命中准确、交互直接。当前空状态本来已包装所有命中词，因此现有 1,000 core 范围内不高于当前最坏 DOM 数；查询词典扩大后可能包装页面多数 token，必须重测 DOM、CLS、网站 CSS 和 MutationObserver。 |
| C：按 pointer 坐标动态查词 | 不需全量 span；可用 `caretRangeFromPoint`/`caretPositionFromPoint`。难点是缩放/transform、连字、Shadow DOM、iframe、标点边界和文本节点定位，准确性与测试成本最高。 |
| D：选区/快捷键 | DOM 压力低，可作回退，但不满足“放上去即可显示”；现有真实拖选仍有事件顺序 bug。 |
| E：查询词典与测评包分离 | 查询词典负责释义和页面反馈；测评包负责题目、频段、证据和估计。仍需结合 B/C 才能让无提示词 hover。 |

## 8. PREDICTION_STATUS

- 概率模型或“潜在不会”启发式：没有。
- 词频 band 参与页面显示：没有；band 虽传入 `LookupContext`，展示策略不读取。
- 首测外推到未测词：没有，只改答过的 50 个 wordKey。
- 估计影响灰线候选：没有，只在 popup 展示。
- 每日校准调整未测词：没有，只更新当轮实际作答的 5 个词。
- `unknown→light`：无条件默认。
- `AssessmentEvidence`：服务测试、每日选题和估计，不进入内容脚本显示路径。
- 冻结审计模块和 `highConfidenceWords` 类型：历史不可达代码，不能算当前功能。

准确结论：**主动提示稀疏化尚未实现。**

## 9. TOOLTIP_POSITIONING

生产算法先令 `left=x`、`top=y-8`，再只处理 bottom/right 溢出；不避免覆盖目标词、相邻正文、顶部安全区或 sticky header。

真实 Chrome 几何：

| 场景 | 目标/tooltip 结果 |
|---|---|
| 普通位置 | 覆盖目标 `695.41 px²` |
| 左边界 | 覆盖目标 `695.41 px²` |
| 右边界 | 覆盖目标 `1164.50 px²`；fixed shrink-to-fit 使浮层变窄变高 |
| 底边界 | 翻到目标上方，目标重叠为 0 |
| 页面滚动后 | 仍覆盖目标 `695.41 px²` |
| sticky 附近 | 目标 top=75，tooltip top=67；既覆盖目标，也侵入 bottom=72 的 sticky header |
| GitHub 实页 | 目标 top=254/bottom=292；tooltip top=246/bottom=330.75；重叠 `2081.09 px²` |

结论：主因是定位算法及其与 fixed shrink-to-fit 的交互，不是普通页面层叠上下文。tooltip 使用 `z-index:2147483647`，通常不会被页面压住，反而确保它覆盖正文。

## 10. REAL_MOUSE_SELECTION

现有 E2E 的 `selectElementText` 直接构造 DOM `Range`，然后仅派发合成 `mouseup`。真实拖拽还会在 mouseup 后产生 click。

隔离 Chrome 真实 `mouse.down → move → up` 结果：

```json
{"selected":" improving ","action":null,"visible":false}
```

事件链：

1. `mouseup` 读取 Selection，lookup 到 `improve`，创建 `.avr-selection-action`；
2. 同一手势随后产生的 document `click` target 仍是正文词；
3. click handler 发现 target 不是 `.avr-selection-action`，立即调用 `hideSelectionAction()`；
4. 用户看不到按钮，而合成 mouseup E2E 会通过。

## 11. OPTION_MATRIX

| 方案 | 解决 | 不能解决 | 产品规则 | Schema / AssessmentEvidence / 估计 | 性能与隐私 | 下一阶段 |
|---|---|---|---|---|---|---|
| 1. 只扩查询词典 | 普通词 lookup-null | known 无交互、灰线密度、tooltip、拖选 | 必须改变固定查询范围 | 若继续共用测评包会改变估计语义 | 包体、加载、lookup、DOM 增长；仍可本地 | 不能单独实施 |
| 2. 只补 forms | lemma 已在 core 的屈折漏映射 | lemma 不在 core、交互耦合、密度 | 通常不改变边界 | 通常无需 schema | 增量小 | 低风险，但本组七个缺失词均不由它解决 |
| 3. 查询词典/测评包拆分 | 广查询、固定测评和估计 | 不自动提供 hover 或稀疏提示 | 是 | Evidence/估计可保持测评包；包外 WordState 合法性待确认 | 查询包增大；隐私可保持本地 | 下一轮对齐核心 |
| 4. 交互包装/视觉提示拆分 | known 和预计会词仍可查、可反馈 | lookup-null、候选算法、词典范围 | 是 | 通常不需要持久化迁移 | B 增 DOM；C 增复杂度 | 下一轮对齐核心 |
| 5. 增加潜在不会候选算法 | 稀疏灰线、降低误提示 | 查询覆盖、tooltip、无提示交互 | 是 | 不应改写 WordState；输入是否含 Evidence/band 待确认 | 本地计算；不得记录网页历史 | 输入和验收未确认，不能施工 |
| 6. 最小组合 | 3+4+5，再补定位与真实鼠标 seam，可处理四类观察 | 仍不决定查询词典来源、许可和规模 | 是 | 包外 WordState/生词本、Evidence 边界及迁移需确认 | 风险集中在 DOM、词典体积、候选误判 | 适合作为下一轮讨论范围 |

查询/测评分离时必须明确：

- 查询词典负责 surface→wordKey、释义和页面反馈；
- 测评包负责固定题目、frequency band、AssessmentEvidence 和估计；
- WordState 是否接受测评包外但查询词典内的 wordKey；
- 生词本是否展示这类包外词；
- AssessmentEvidence 和估计是否继续严格限于测评包；
- 当前 Record 字符串键结构未必必然升 schema，但若新增词典命名空间、来源版本或包外合法性语义，就需要迁移/兼容决定。

## 12. RECOMMENDATION

本调查不生成 Spec、不拆 ticket、不开始开发。下一次用户对齐必须决定：

1. “普通英文词原则上可查询”的正式覆盖定义，不预设 5,000/10,000 等数字；
2. 查询词典与固定测评包是否明确分离；
3. 测评包外词是否允许持有 WordState、进入生词本，但不进入 Evidence/估计；
4. 无提示词默认交互必须是 hover，还是 hover 加选区/快捷键回退；B/C 哪类路线可接受；
5. “潜在不会”的输入、目标密度和误提示人工验收；
6. known 是否始终可查询并允许再次标记不会；
7. tooltip 的几何合同：上下优先级、正文安全间距、视口和 sticky/header 行为；
8. 真人拖选是否成为必过 seam，并以真实 mouse drag 验收。

## 13. REPRODUCTION_AND_EVIDENCE

### 13.1 运行命令

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e

node work/investigations/2026-08-06-architecture-coupling/scripts/word-facts.mjs
node work/investigations/2026-08-06-architecture-coupling/scripts/live-page-audit.cjs
node work/investigations/2026-08-06-architecture-coupling/scripts/geometry-and-selection-audit.cjs
```

### 13.2 验证结果

- TypeScript：通过。
- 单元/集成：16 个文件、267 项通过。
- Build：通过。
- 现有综合 E2E：全部通过。
- 真实 mouse drag：Selection 产生，但 action 被后续 click 隐藏。
- 所有 profile 为隔离临时 profile；未读取或修改真人 Chrome profile。
- 原始机器可读摘要见 [`work/investigations/2026-08-06-architecture-coupling/evidence/`](../work/investigations/2026-08-06-architecture-coupling/evidence/)。

### 13.3 代码证据索引

| 事实 | 代码位置 |
|---|---|
| tokenizer 与 skip 范围 | `extension/src/content/scanner.ts` |
| core/forms lookup | `extension/src/content/dictionary.ts` |
| lookup-null 跳过、状态→annotation、选区事件 | `extension/src/content/pageScanner.ts` |
| none 过滤、`.avr-word`、tooltip/menu、定位 | `extension/src/content/annotator.ts` |
| unknown/light、known/none、learning/strong | `extension/src/strategy/index.ts` |
| STATE_CHANGE 持久化/广播 | `extension/src/worker/index.ts` |
| 生词本过滤和已掌握 | `extension/src/popup.ts` |
| 合成选区 E2E seam | `e2e-verify.cjs` |

## 14. 交付边界

- 本分支只新增调查报告、复现脚本和证据摘要。
- 未修改代码、RULES、CONTEXT、ADR、Spec、ticket、词典、schema 或质量门禁。
- 未把测试全绿解释为产品目标正确。
- 未建议单点补 `evaluating`，也未预设扩容规模。
