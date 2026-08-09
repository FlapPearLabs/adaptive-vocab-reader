# T-PERF-7 查询词典与透明包装重测

## 范围与方法

- 日期：2026-08-09；Chrome for Testing 隔离 profile。本次报告只记录本地 fixture 的聚合计数和耗时，不保存真实网站 URL、正文或词典 payload。
- 命令：`npm run typecheck && npm test && npm run build && npm run test:e2e`；单元测试 `283 passed`，真实 Chrome E2E 为 `E2E ALL PASS`。
- 样本：`tests/fixtures/long-read.html` 三次；`tests/fixtures/spa-page.html` 的初始、append、route replacement 和 `characterData` 更新。DOM/scrollHeight 的“前”来自同一 Chrome/viewport、无扩展加载的基线页。
- 词典产物：query entries `121340`；`dist` 总大小 `11373690` bytes，其中 query dictionary `10125167` bytes、query forms `453832` bytes、content bundle `218300` bytes。

## 加载与扫描实测

本机本轮 SPA 导航中，真实 extension 请求的 query dictionary 为 `66.9 ms`，query forms 为 `66.3 ms`；从开始导航到首个内容脚本标注出现为 `855.6 ms`。后者是端到端 content-script ready 时间，含页面导航和扩展初始化，不能解释成纯 JavaScript 初始化时间。

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

获授权的最小修复只在 `.avr-word` 声明 `border: 0`、透明 background 和无 decoration；字体、字号、行高、字距与颜色继续继承页面。没有使用 `!important`、广泛 reset、Shadow DOM 路线或产品状态变更。修复后同一真实压力页的 computed 结果为：

| 状态 | border | decoration |
| --- | --- | --- |
| transparent / known | `none 0px` | `none` |
| light | `none 0px` | `underline dotted` |
| strong | `none 0px` | `underline solid` |

同一 E2E 继续通过 hover、click/feedback、tooltip/action menu、selection、SPA、iframe、open Shadow DOM、跨标签同步、heightDelta 和 CLS 验收。`T-PERF-7A-css-isolation-repair.md` 记录其最小范围和验收。

## 对照与结论

原型（2026-08-07）透明包装为 3,891 token、+3,888 DOM、4.0 ms、CLS 0；本次生产长文为 4,159 注释词、最终 DOM +4,160、90.7–95.9 ms、CLS 0。样本、词典规模和生产路径不同，不能把差异解释为回归或通过线。

invented SLA = NO。本票未预设性能预算；CSS blocker 已由 T-PERF-7A 最小修复并经真实 Chrome 回归关闭。当前结构化证据没有显示新的用户可见布局或性能 blocker，但这不替代人工 dogfood，也不授权后续性能重构。
