# D：无视觉交互路线原型（可丢弃）

> 仅回答透明包装与 pointer/caret 动态定位的取舍；不是扩展代码，也不构成生产验收。

运行：

```sh
node run-experiment.cjs
```

该命令以本机已安装的 Chrome 和 `data/derived/ecdict-core-1000/` 为输入，在临时本地 HTTP 服务上依次执行两条路线。结果会覆写本目录的 `measurements-2026-08-07.json`，并由人工根据该机器数据更新 `RESULTS-2026-08-07.md`。

测试 fixture 覆盖：普通正文、连字符/标点边界、CSS zoom 与 transform、开放 Shadow DOM、同源 iframe、固定头部、滚动、SPA 新插入及 characterData 更新。跨源 iframe 与封闭 Shadow DOM 仅记录为浏览器隔离边界，不通过规避同源策略来模拟支持。
