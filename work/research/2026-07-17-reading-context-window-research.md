# 页面提示密度与滚动：历史研究保留笔记

日期：2026-07-17；2026-07-22 按当前范围复核并恢复

状态：**非规范参考，不构成产品规则、实现计划或验收门禁。** 当前需求以 [`RULES.md`](../../RULES.md) 为唯一来源；本笔记只保留对未来页面提示体验实验仍有价值的证据和待验证假设。

## 为什么恢复这份笔记

旧版本曾讨论“每约 250 个英文词是否应重新分配一次行内中文提示”。该问题仍然有价值：它关系到页面滚动时，提示会不会太密、打断阅读或导致重排。

但结论不是“250 词最佳”。现有证据不能给出一个跨设备、网站和用户都正确的固定词数。若以后 V0.1 的 1,000 词垂直切片已验证基础提示可用，页面密度应作为一个**可丢弃的展示策略实验**单独验证。

## 可保留的结论

1. **没有证据支持 250 词是最佳阅读或提示窗口。** 250 词不能被当作视觉注意范围、工作记忆容量或稳定的一屏网页大小。
2. **局部视觉负担比页面累计词数更接近实际问题。** 行内短中文影响的是当前行、相邻行和可见正文；缩放、字体、栏宽和网站布局会改变同一屏的词数。
3. **不存在通用的最佳行长或滚动高度。** 屏幕阅读实验的结果会随任务、阅读速度、显示条件和主观偏好改变。因此不能把某个 characters-per-line 或窗口高度直接写为插件常数。
4. **不要主动改变宿主页面排版。** 若未来展示强提示，保持在同一行的短文本；不注入 `<br>`、独立翻译块或固定翻译栏。若自然回流造成局部拥挤，优先把普通候选降级为轻提示。
5. **滚动、缩放和重排后应重新观察局部负担。** 不应从页首累计一个“还剩多少提示名额”的全局配额。
6. **页面密度不等于学习状态。** 浏览、停留、滚动、悬停或查看释义不能自动把单词变成“会”；当前规则中的会／不会／未知只由测试、复测或用户明确反馈改变。

## 对当前 V0.1 的影响

这份研究**不增加当前实现范围**。当前垂直切片仍只验证：正文扫描、本地 ECDICT 快查、三档提示、会／不会和刷新后保留。

只有在该切片可用后，才可以另行提出一个小型、可回退的页面体验 PoC。它应回答一个明确问题：局部可见正文的提示控制，是否比固定 250 词桶更少打断阅读，同时不增加漏标？在用户确认前，不实现该实验。

## 后续 PoC 的最小观察项（建议，非门禁）

若获单独授权，比较策略时只记录必要的聚合数据，不保存整页正文、URL 或浏览历史：

- 强提示候选数、实际显示数和降级为轻提示的数量；
- 是否注入 `<br>` 或独立翻译块（应始终为零）；
- 用户主动标记“不会”、关闭提示或查看轻提示的次数；
- 用户对“是否打断阅读”“是否漏掉关键难词”的可跳过反馈。

固定 250 词至多可以作为与“当前可见/近可见正文区域”对比的实验条件，不能预设为默认值。比较时不得同时改变释义长度、提示排序或页面类型，否则无法判断差异来自哪里。

## 证据摘要

| 证据 | 可支持的判断 | 不能支持的判断 |
| --- | --- | --- |
| Rayner（1975）眼动实验 | 即时可用的周边视觉信息是字符级，行内插入应观察当前局部版面。 | 人的视觉注意范围是数百词。 |
| Just 与 Carpenter（1980） | 低频词、从句和句末整合会提高加工负荷。 | 所有人都应按固定词数切断语境。 |
| Brysbaert（2019）阅读速度汇总 | 阅读速度存在显著个体差异。 | 可从平均词/分钟推导出最佳提示刷新长度。 |
| Dyson 与 Kipping（1998）；Dyson 与 Haselgrove（2001） | 屏幕行长、移动方式和任务条件会共同影响速度、理解和偏好。 | 有一个适用于所有页面的最佳行长。 |
| W3C WCAG 2.2 SC 1.4.8 | 文本呈现应尊重可访问性和用户可调性。 | WCAG 的字符数是本插件每屏词数或提示配额。 |

## 来源

1. Rayner, K. (1975). *The perceptual span and peripheral cues in reading*. Cognitive Psychology, 7(1), 65–81. [DOI](https://doi.org/10.1016/0010-0285(75)90005-5)。
2. Just, M. A., & Carpenter, P. A. (1980). *A theory of reading: From eye fixations to comprehension*. Psychological Review, 87(4), 329–354. [DOI](https://doi.org/10.1037/0033-295X.87.4.329)。
3. Brysbaert, M. (2019). *How many words do we read per minute? A review and meta-analysis of reading rate*. Journal of Memory and Language, 109, 104047. [DOI](https://doi.org/10.1016/j.jml.2019.104047)。
4. Dyson, M. C., & Kipping, G. J. (1998). *The Effects of Line Length and Method of Movement on Patterns of Reading from Screen*. Visible Language, 32(2), 150–181. [开放 PDF](https://journals.uc.edu/index.php/vl/article/download/5671/4535/7348)。
5. Dyson, M. C., & Haselgrove, M. (2001). *The influence of reading speed and line length on the effectiveness of reading from screen*. International Journal of Human-Computer Studies, 54(4), 585–612. [DOI](https://doi.org/10.1006/ijhc.2001.0458)。
6. W3C. *Understanding Success Criterion 1.4.8: Visual Presentation (WCAG 2.2)*. [规范解说](https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html)。

## 明确保留在历史中、但不恢复为现行资料的内容

旧研究中关于义项、MWE、个人未知概率、长期证据账本、模型释义可靠度和两周全量 dogfood 的设计，和现行“单词级本地词典＋明确反馈”的范围冲突，故未恢复为当前文档。它们仍可从 Git 历史审阅，不应重新进入实现前置条件。
