# 2026-08-06 架构耦合调查复现包

本目录保存查询覆盖、交互包装、灰线密度、tooltip 定位与真实拖选的只读调查证据。

## 文件

- `scripts/word-facts.mjs`：核对指定 14 个 surface form 的 core/forms/wordKey 事实。
- `scripts/live-page-audit.cjs`：在三类真实英文页面上统计生产 tokenizer、lookup 和状态规则。
- `scripts/geometry-and-selection-audit.cjs`：隔离 HTTPS fixture 上测量 tooltip 几何，并驱动真实鼠标拖选和 known 状态变化。
- `evidence/word-facts.json`：指定词事实摘要。
- `evidence/coverage-and-density.json`：三类页面覆盖与提示密度摘要。
- `evidence/geometry-and-selection.json`：tooltip、sticky、滚动、真实选区和 known 包装撤除摘要。

完整分析见 [`outputs/2026-08-06-architecture-coupling-investigation.md`](../../../outputs/2026-08-06-architecture-coupling-investigation.md)。

## 安全边界

- 脚本只读取生产构建和词典数据。
- 浏览器使用 `/tmp` 隔离 profile。
- 不读取或修改真人 Chrome profile。
- 不写入 extension storage 以外的用户数据；测试 profile 在临时目录。
- 不保存 URL 之外的用户浏览历史或真人网页内容。

## 运行

先在仓库根目录执行：

```bash
npm run build
node work/investigations/2026-08-06-architecture-coupling/scripts/word-facts.mjs
node work/investigations/2026-08-06-architecture-coupling/scripts/live-page-audit.cjs
node work/investigations/2026-08-06-architecture-coupling/scripts/geometry-and-selection-audit.cjs
```

网络页面内容会随时间变化，因此 live-page 数字是 2026-08-06 的快照；核心结论应结合生产策略代码和隔离 fixture 复核。
