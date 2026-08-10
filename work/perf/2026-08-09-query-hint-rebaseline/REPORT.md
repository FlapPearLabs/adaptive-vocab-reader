# T-PERF-7 查询词典与透明包装重测

## 范围与方法

- 日期：2026-08-09；Chrome for Testing 隔离 profile。本次报告只记录本地 fixture 的聚合计数和耗时，不保存真实网站 URL、正文或词典 payload。
- 命令：`npm run typecheck && npm test && npm run build && npm run test:e2e`；单元测试 `283 passed`，真实 Chrome E2E 为 `E2E ALL PASS`。
- 样本：`tests/fixtures/long-read.html` 三次；`tests/fixtures/spa-page.html` 的初始、append、route replacement 和 `characterData` 更新。DOM/scrollHeight 的“前”来自同一 Chrome/viewport、无扩展加载的基线页。
- 词典产物：query entries `121340`；`dist` 总大小 `11373690` bytes，其中 query dictionary `10125167` bytes、query forms `453832` bytes、content bundle `218300` bytes。

## 加载与扫描实测

本机修复后 SPA 真实 Chrome 运行的四项分离测量如下；均为当前页面内存中的聚合数字，不持久化、不含 URL 或正文：

| 指标 | 实测 | 边界 |
| --- | ---: | --- |
| query dictionary asset load | `4.6 ms` | 扩展资源请求开始至完成 |
| query forms asset load | `0.9 ms` | 扩展资源请求开始至完成 |
| content-script initialization | `147.1 ms` | 内容脚本入口至词典/状态加载完成、scanner 装配及 state 设置完成；**初始扫描前** |
| navigation → first annotation | `891.5 ms` | 导航开始至首个 `.avr-word`；保留为端到端观察值，不等同初始化 |
| initial scan | `1.1 ms` | scanner 首次初始正文扫描的 `totalScanMs` |

此前报告只有 navigation → first annotation（旧样本 `855.6 ms`），并已注明它混入导航和扩展启动。最终 CODE review 据此指出不能替代 ticket 所需的独立 initialization metric；本轮新增的 `avrContentScriptInitMs` 只在当前 document dataset 中存在，恰好在 `scanDocument` 前写入。它不是遥测、SLA 或性能优化输入。

| 场景 | 扫描墙钟 ms | 单批最大 ms | 文本节点 | 注释词数 | DOM 前→后（Δ） | scrollHeight 前→后（Δ） | 高度变化 px | CLS | 批次 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 长文 1 | 90.7 | 2.7 | 71 | 4159 | 79→4239（+4160） | 8948→8948（0） | 0 | 0 | 8 |
| 长文 2 | 93.8 | 2.5 | 71 | 4159 | 79→4239（+4160） | 8948→8948（0） | 0 | 0 | 8 |
| 长文 3 | 95.9 | 2.1 | 71 | 4159 | 79→4239（+4160） | 8948→8948（0） | 0 | 0 | 8 |
| SPA（初始 + append + route + characterData + CSS 交互） | 6.9 | 0.8 | 15 | 61 | 27→82（+55） | 600→611（+11） | 0 | 0 | 16 |

`layoutShiftSupported=true`。扫描器自身计数的长文 DOM 写入为 added `8317`、removed `71`、net `8246`；它与整页元素数前后差不同，前者包含注释过程的节点替换操作，后者是最终 DOM 快照。

## 动态变更与零副作用

- SPA 初始正文、动态 append 和 `innerHTML` 路由替换均增量标注；nav/code/form/comment 保持零命中。
- `characterData` 将原始文本 `12345` 改为 query-eligible `serendipity` 后，真实 Chrome 记录 `batches=1`、`textNodesScanned=1`、`wordsAnnotated=1`、`totalScanMs=0`，并出现对应透明可查询 span。观测代码按已处理 batch 数决定是否发报告，因此即使时钟分辨率给出 `0 ms` 也会记录为 `0`，不会被 truthy 判断吞掉。
- 测量路径没有写入用户状态、AssessmentEvidence 或估计；既有真实 Chrome 场景同时覆盖拖选 query 的零写入、manual 反馈不污染 Evidence/estimate、以及跨标签状态同步。

## CSS isolation blocker、根因与修复

首次真实 Chrome 压力复现使用宿主页规则：

```css
article span { color: rgb(190, 0, 190); border-bottom: 3px solid rgb(190, 0, 190); }
```

修复前透明 `.avr-word` 的 computed `border-bottom` 为 `3px solid`，是用户可见的 CSS isolation failure，故按 T-PERF-7 STOP 合同暂停并派生 T-PERF-7A。根因分类为 `OTHER`：宿主 selector 直接匹配透明 wrapper，而扩展 CSS owner `extension/src/content/annotator.ts` 没有拥有 `border` 属性；这不是 cascade order、specificity 或 `!important` 问题（宿主页声明也没有 `!important`）。

获授权的第一处最小修复只在 `.avr-word` 声明 `border: 0`、透明 background 和无 decoration；没有使用 `!important`、广泛 reset、Shadow DOM 路线或产品状态变更。

最终 CODE review 随后发现相同 fixture 的 `article span` 还直接设置了紫色 `color`。虽然 wrapper 没有声明颜色，但它新插入的 `span` 会命中该宿主 selector，导致透明词的 computed color 不再等于父正文。这是第二个已复现的 CSS isolation failure，根因仍是宿主 selector 直接匹配 wrapper，而不是 cascade order 或 specificity。第二处最小修复仅补 `.avr-word { color: inherit; }`：字体、字号、行高、字距和颜色均从正文父元素继承，未扩展为通用 reset。

修复后同一真实压力页的 computed 结果为（parent 正文 `rgb(0, 0, 0)`，宿主 generic `article span` 的紫色为 `rgb(190, 0, 190)`）：

| 状态 | color | border | decoration |
| --- | --- | --- |
| transparent | `rgb(0, 0, 0)`（等于 parent） | `none 0px` | `none` |
| known | `rgb(0, 0, 0)`（等于 parent） | `none 0px` | `none` |
| light | `rgb(0, 0, 0)`（等于 parent） | `none 0px` | `underline dotted` |
| strong | `rgb(0, 0, 0)`（等于 parent） | `none 0px` | `underline solid` |

真实 E2E 现在会对四个状态读取 computed color，断言均等于正文 parent 且 parent 不是 fixture 的紫色；同次 CSS 压力页 `heightDeltaPx=0`、`CLS=0`。它继续通过 hover、click/feedback、tooltip/action menu、selection、SPA、iframe、open Shadow DOM 与跨标签同步。`T-PERF-7A-css-isolation-repair.md` 记录其最小范围和验收。

## 对照与结论

原型（2026-08-07）透明包装为 3,891 token、+3,888 DOM、4.0 ms、CLS 0；本次生产长文为 4,159 注释词、最终 DOM +4,160、90.7–95.9 ms、CLS 0。样本、词典规模和生产路径不同，不能把差异解释为回归或通过线。

invented SLA = NO。本票未预设性能预算；CSS blocker 已由 T-PERF-7A 最小修复并经真实 Chrome 回归关闭。当前结构化证据没有显示新的用户可见布局或性能 blocker，但这不替代人工 dogfood，也不授权后续性能重构。
