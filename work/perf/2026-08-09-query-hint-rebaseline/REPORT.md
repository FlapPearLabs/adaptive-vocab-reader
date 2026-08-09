# T-PERF-7 查询词典与透明包装重测

## 范围与复现

- 日期：2026-08-09；Chrome for Testing 隔离 profile。
- 命令：`npm run build && npm run test:e2e`。
- 样本：仓库可复现 `tests/fixtures/long-read.html`（三次）、`tests/fixtures/spa-page.html`（初始、动态插入和路由替换）。不保存真实网站 URL、正文或词典 payload。
- 词典产物：query entries `121340`；`dist` 总大小 `11373690` bytes，其中 query dictionary `10125167` bytes、query forms `453832` bytes、content bundle `218300` bytes。

## 机器测量

| 场景 | 扫描墙钟 ms | 单批最大 ms | 注释词数 | DOM 净增 | 高度变化 px | CLS | 批次 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 长文 1 | 79.7 | 1.9 | 4159 | 8246 | 0 | 0 | 8 |
| 长文 2 | 93.0 | 2.1 | 4159 | 8246 | 0 | 0 | 8 |
| 长文 3 | 98.9 | 2.3 | 4159 | 8246 | 0 | 0 | 8 |
| SPA（初始 + append + route） | 2.0 | 0.8 | 52 | 98 | 0 | 0 | 4 |

`layoutShiftSupported=true`。长文三次的 DOM、文本节点数（71）和注释数一致；数值为本机本次实测，非预算或 SLA。

## 行为与副作用

- 真实 Chrome E2E 断言 SPA 的动态追加与 `innerHTML` 路由替换均增量标注；非正文 nav/code/form/comment 仍为零命中。`characterData` 的真实 Chrome 性能计数仍未在此报告中单列。
- 透明 span 与扩展样式在现有 fixture CSS 下保持可交互；E2E 同时验证 tooltip、点击反馈、iframe、开放 Shadow DOM 与跨标签同步。
- 隔离 profile 中的状态、AssessmentEvidence、估计和 schema 由既有 E2E 负断言覆盖；本票没有新增写入、遥测、正文落盘或生产代码。

## 对照与结论

原型（2026-08-07）透明包装为 3,891 token、+3,888 DOM、4.0 ms、CLS 0；本次生产长文为 4,159 注释词、+8,246 DOM、79.7–98.9 ms、CLS 0。样本、词典规模和生产路径不同，不能把差异解释为回归或通过线。

本票没有预设性能预算，亦未发现可由这些结构化指标单独判定的“显著退化”或用户可见 CSS 破坏。因此不触发优化 STOP；任何优化仍需独立授权，不得由本报告推断为已授权。
