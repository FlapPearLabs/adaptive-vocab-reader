# T-UX-1 — tooltip 元数据升级 + 选区加词入口

**权威来源**：
- [V0.1 阅读体验增强规格](../../../docs/specs/2026-08-05-V0.1-阅读体验增强规格.md)
- [RULES.md](../../../RULES.md)「阅读体验增强」小节

**What to build**：unknown 词悬停显示 词形/音标/词性/释义 四行；拖选命中词典的单词 → 选区旁弹「加入生词本」→ 写入 `WordState=learning`（manual），该词同页立即升级为强提示。

**Blocked by**：无（T-UX-2 依赖本票的 `WordState=learning` 数据源，但两票文件边界不同，T-UX-2 可在 T-UX-1 后或并行施工）

**Status:** draft（待 DOCUMENT 复审 PASS 后转 ready-for-agent）

**用户可见收益**：悬停一个不认识/未测的词，立刻看到 词形、音标、词性、中文释义；拖选任意命中词即可一键加入生词本，不用先下划线再点。

**主责任 Requirement ID**：R-UX-T1～R-UX-T4、R-UX-S1～R-UX-S5

**范围**：
- `annotator.ts`：`WordAnnotation`/span 增加 `data-phonetic`、`data-pos`（元数据取自 wordKey 对应 core 词条）；`showTooltip` 渲染四行（surfaceForm / 音标 / 词性 / 释义）。
- `pageScanner.ts` 或 `content/index.ts`：新增选区监听（`mouseup`/`selectionchange` 后检查选区）——选区归一化（trim、去首尾标点、小写）后**整体**解析为 wordKey（core 优先 → forms 映射 → 未命中静默）；命中且该 wordKey 非 learning/known → 选区旁弹「加入生词本」浮动按钮（与既有 `.avr-action-menu` 并存，互斥出现）；点击 → 复用 `STATE_CHANGE`（learning/manual）→ 增量更新该词显示。
- 选区文本仅瞬时内存用于解析，不持久化、不记录、不进快照。
- `e2e-verify.cjs`：§7.1/§7.2 全部场景（R-UX-T1~T4、R-UX-S1~S5）。

**明确非目标**：
- 不改变 learning 强提示行内中文行为；
- 不做选区翻译、整段释义、多词解析、模糊匹配；
- 不新增消息协议（复用 `GET_STATE`/`STATE_CHANGE`）；
- 不保存选区文本、URL、正文、句子；不建日志/遥测；
- 不改 schemaVersion、不动 `extension/src/shared/types.ts` 持久化结构（若 span 的 data-* 仅运行时，无需改类型）。

**预计影响的模块责任**（仅定位，不强制新文件/facade/service）：
- `extension/src/content/annotator.ts`：tooltip 四行渲染、span data-* 属性。
- `extension/src/content/pageScanner.ts` / `index.ts`：选区监听与浮条。
- `extension/src/content/dictionary.ts`：仅复用现有 `lookup()`（整体解析），不改 canonical 规则。
- `e2e-verify.cjs`：新增 §7.1/§7.2 场景。

**Requirement → behavior → test seam**：见 Spec §7.1/§7.2 表格（R-UX-T1~T4、R-UX-S1~S5）。

**数据、迁移或隐私风险**：
- 隐私：选区文本必须只瞬时内存使用；E2E 断言 snapshot 无新增字段、无选区内容。
- 失败行为：选区无法唯一解析 → 静默不弹、零写入；浮条出现后选区消失/点击外部 → 关闭浮条不写入。

**反过度设计检查**：
- 复用既有 `STATE_CHANGE` 与 `annotateTextNode` 的 DOM 更新路径，不新建事件总线/服务层；
- tooltip 升级只扩展 data-* 与渲染函数，不建组件框架；
- 选区解析复用 `dictionary.lookup()` 整体命中，不新增模糊匹配或解析器。

**真实验证命令**：
```bash
npm run typecheck
npm test
npm run build
npm run test:e2e   # 含 R-UX-T1~T4、R-UX-S1~S5
```

**完成定义**：
- 九条行为验收（R-UX-T1~T4、R-UX-S1~S5）有真实测试；
- typecheck / 单测 / build 通过；
- E2E 场景真实 Chrome 通过；
- 代码审查确认：选区文本零持久化、无日志遥测、复用现有消息协议、未改 schemaVersion。

## Acceptance criteria

- [ ] unknown 词悬停 tooltip 显示 词形/音标/词性/释义 四行（R-UX-T1）。
- [ ] 屈折词形首行为 surfaceForm，元数据取 wordKey 条目（R-UX-T2）。
- [ ] learning 强提示行内中文行为不变（R-UX-T3）。
- [ ] tooltip 内容不写入 storage、不进快照（R-UX-T4）。
- [ ] 拖选命中词典词 → 选区旁弹「加入生词本」（R-UX-S1）。
- [ ] 点击浮条 → WordState=learning(manual)，同页该词升级强提示（R-UX-S2）。
- [ ] 未命中/多词/部分词形/纯空白/纯数字 → 静默不弹、零写入（R-UX-S3）。
- [ ] 已 learning/known 不重复弹（R-UX-S4）。
- [ ] 选区文本不持久化、不记录（R-UX-S5）。
