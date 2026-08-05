# T-UX-2 — popup 生词本页签

**权威来源**：
- [V0.1 阅读体验增强规格](../../../docs/specs/2026-08-05-V0.1-阅读体验增强规格.md)
- [RULES.md](../../../RULES.md)「阅读体验增强」小节

**What to build**：popup 新增「生词本」页签：列出所有 `WordState=learning` 且为合法 `wordKey` 的词（wordKey + 音标 + 词性 + 释义，按 `updatedAt` 降序），一键「已掌握」→ 标记 known 并移出。

**Blocked by**：T-UX-1（依赖 `WordState=learning` 的既有数据源与 `STATE_CHANGE` 写入路径；但两票文件边界不同，可并行或先后施工）

**Status:** draft（待 DOCUMENT 复审 PASS 后转 ready-for-agent）

**用户可见收益**：打开 popup 即可看到「当前确认不会」的完整清单与释义，随时一键改回「已掌握」，页面提示同步撤除。

**主责任 Requirement ID**：R-UX-N1～R-UX-N5

**范围**：
- `popup.ts`：新增「生词本」页签（与首测/每日/估计并列的入口），页签视图只读 `WordState`：
  - 筛选 `status=learning` 且 key 命中当前词包 core/forms（合法 wordKey）→ 取 wordKey + 音标 + 词性 + 释义；
  - 按 `updatedAt` 降序；
  - 无法映射旧 key：不显示（无元数据）、不删除存储键；
  - 一键「已掌握」→ 复用 `STATE_CHANGE`（known/manual）→ 刷新列表。
- 页签不影响首测/每日/估计入口与视图。
- 空态：无 learning 词时显示空态文案。
- `e2e-verify.cjs`：§7.3 全部场景（R-UX-N1~N5）。

**明确非目标**：
- 不分页、不搜索、不排序选项、不批量操作；
- 不读 `AssessmentEvidence`、不改估计；
- 不建独立页面/路由/状态管理；
- 不改 schemaVersion、不动持久化结构；
- 不保存任何 URL/正文/句子；不建日志/遥测。

**预计影响的模块责任**（仅定位，不强制新文件/facade/service）：
- `extension/src/popup.ts`：页签入口 + 列表渲染 + 「已掌握」动作。
- `extension/src/worker/index.ts`：仅复用既有 `GET_STATE`/`STATE_CHANGE`（若需按 status 过滤，popup 本地过滤即可，不新增消息）。
- `extension/src/content/dictionary.ts`：popup 已加载词典产物，复用其 `lookup`/core 判断合法性（不新增模块）。
- `popup.html`/`popup.css`：页签样式（可选最小调整）。
- `e2e-verify.cjs`：新增 §7.3 场景。

**Requirement → behavior → test seam**：见 Spec §7.3 表格（R-UX-N1~N5）。

**数据、迁移或隐私风险**：
- 数据源仅 WordState；「已掌握」manual 写入不产生证据、不改估计（R-UX-N3 E2E 断言估计不变）。
- 失败行为：popup 打开时无词典数据 → 页签显示空态/加载失败，不写任何状态；「已掌握」被 worker 拒绝 → 刷新真实状态。

**反过度设计检查**：
- 生词本是一个只读视图 + 复用 `STATE_CHANGE`，不建页面路由、状态管理或新消息协议；
- 合法性判断复用词典 core/forms 查询，不新增 canonical 层；
- 不引入 repository/service/controller、事件总线、mock-only seam。

**真实验证命令**：
```bash
npm run typecheck
npm test
npm run build
npm run test:e2e   # 含 R-UX-N1~N5
```

**完成定义**：
- 五条行为验收（R-UX-N1~N5）有真实测试；
- typecheck / 单测 / build 通过；
- E2E 场景真实 Chrome 通过；
- 代码审查确认：不读证据、不改估计、复用既有消息、未改 schemaVersion、无法映射 key 列表排除且存储保留。

## Acceptance criteria

- [ ] 生词本页签列出 learning 词（wordKey+音标+词性+释义），按 updatedAt 降序（R-UX-N1）。
- [ ] 一键「已掌握」→ WordState=known(manual) 并移出列表（R-UX-N2）。
- [ ] 页签只读 WordState、不读 AssessmentEvidence、不改估计（R-UX-N3）。
- [ ] 无法映射旧 key 不进列表、存储键保留（R-UX-N4）。
- [ ] 页签不干扰首测/每日/估计入口（R-UX-N5）。
