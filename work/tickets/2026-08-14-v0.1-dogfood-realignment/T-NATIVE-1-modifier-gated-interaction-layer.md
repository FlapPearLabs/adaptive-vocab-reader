# T-NATIVE-1 — Ctrl 门控交互层（P0：PAGE_NATIVE_INTERACTION_FIRST）

**权威来源**：
- [V0.1 Dogfood 交互个性化回退与测评重对齐规格（已批准）](../../../docs/specs/2026-08-11-V0.1-Dogfood-交互个性化回退与测评重对齐规格.md)：§1/§4/§5（状态机 §5.2）/§6（tooltip 会话）/§17（invisible capability）/§21 REAL_CHROME_ACCEPTANCE（P0 最高 gate）/§22 负断言
- [RULES.md](../../../RULES.md)「V0.1 Dogfood Realignment（D1–D17）」INTERACTION 组
- D1/D2/D3/D4/D6/D7（Grill 决议：Ctrl+hover 门控、禁 Ctrl+click、keyup 消失 + tooltip 会话豁免、原生优先、链接文字可查、feedback 只在 extension-owned tooltip）

**Status**：DOCUMENT 阶段产物；待用户批准本批次 DOCUMENT 审查并另行明确「开始开发」后 Codex 方可实施。**本票是 P0 拥有者——P0 矩阵未全通过前不合并/不交付（STOP_CONDITION: P0_NATIVE_INTERACTION_UNRESOLVED）。**

**What to build**（用户视角）：插件不再抢占网页。不按 Ctrl 时，鼠标划过页面与没装插件完全一样——不出现查询 tooltip、不出现会/不会菜单、不拦截任何点击；链接照常打开、按钮照常点、输入框照常聚焦、表单照常提交、拖选/复制/右键/滚动全部原生。按住 Ctrl 并把鼠标悬停在单词上（包括链接里的单词）时，出现释义 tooltip；指针移入 tooltip 后可松开 Ctrl，用普通点击按「会/不会」；指针移出 tooltip 或松开 Ctrl 后界面消失。灰色/红色提示线（passive hint decoration）照常显示，不受 Ctrl 影响。

**主责任 Requirement ID**：R-INT-1、R-INT-2、R-INT-3、R-INT-4、R-INT-5、R-INT-6、R-INT-7、R-INT-8（全部交互 requirement）。

**用户可见收益**：Hacker News 等链接密集页面恢复正常（链接可点开）；「长期挂浏览器不被察觉」达成——查词变成按住 Ctrl 才出现的隐形能力。

**依赖/前置 ticket**：无（可立即施工）。利用既有 base（当前 main 的透明 span 包装、tooltip 渲染、WordState 写入 seam、STATE_UPDATED 跨标签广播）重建交互门控；本票不改变 hint 判定与 miss 词未收录语义。

**允许修改范围**：
- `extension/src/content/annotator.ts` / `pageScanner.ts` / `index.ts`：交互事件委托改造——Ctrl 门控（keydown/up）、hover 激活查询 UI、click 委托不再拦截正文事件（移除正文 preventDefault/stopPropagation）、tooltip 渲染与几何、tooltip 交互会话（pointerenter/leave、relatedTarget ownership 转移、keyup 豁免）。
- `extension/src/content/dictionary.ts`：仅消费既有查询合同；miss 判定结果透传给 tooltip 展示（「未收录」文案的语义填充属 T-UNRESOLVED-2，本票只保证 tooltip 框架能展示任意词条状态）。
- `extension/manifest.json`：仅限实现已批准的同源 iframe content-script 注入配置调整；不得借此扩大 host/permission。
- `e2e-verify.cjs` + 相关单测：§21 P0 矩阵（真实 Puppeteer 键盘/鼠标，非 dispatchEvent）。

**禁止范围**：
- **不实现 Ctrl+click 查词**（R-INT-3 负断言）；任何 click 路径不得成为查询/反馈入口。
- 不改变 hint 判定/候选逻辑（T-HINT-4 负责）；不改变 learning 红提示/灰线的展示策略（passive decoration 本票保持既有行为）。
- 不处理 lookup miss 的「未收录」反馈语义与临时键（T-UNRESOLVED-2 负责）。
- 不升级 schema、不改 WordState/AssessmentEvidence 结构、不做迁移。
- 不引入 provider/网络实现、不加 host_permissions、不加遥测。
- 不把状态机实现为「卡死状态」或依赖计时器维持会话；不得留下需要「碰巧 tooltip 先收到 pointerenter」的竞态。

**数据/许可边界**：hover/查询目标词仅瞬时本地用于解析，不落盘、不上传；不保存 URL/标题/正文/句子；无遥测。

**真实 Chrome 用户路径验收**（Chrome for Testing + 隔离 profile；必须真实键盘/鼠标路径）：
1. **ANCHOR**：普通 click / Cmd-click / Ctrl-click / Shift-click / right-click 全部保持浏览器原生行为（含链接导航；浏览器自身定义的特殊组合不得覆盖）。
2. **BUTTON**：真实 mouse click 正常触发网页行为。
3. **FORM**：input/textarea focus+typing、checkbox、radio、select、submit 全部原生。
4. **TEXT**：drag selection、copy、context menu 正常。
5. **SCROLL**：wheel/scroll 正常。
6. **PLUGIN**：Ctrl keydown → hover queryable word → tooltip 出现；Ctrl keyup → tooltip 消失；无 Ctrl hover → 无查询 UI。
7. **LINK QUERY（D6）**：链接文字 Ctrl+hover 查询可用 + 链接原生 click 保持完好（同一元素两者共存）。
8. **TOOLTIP 会话（D7）**：pointer 移入 tooltip → keyup 豁免 → 松开 Ctrl 普通点击「会/不会」→ 写 WordState(manual) → 移出 tooltip 关闭；无永久 sticky tooltip。
9. 状态机五态（IDLE/CTRL_ARMED/WORD_TOOLTIP/TOOLTIP_INTERACTION_SESSION/CLOSED 瞬态）事件转移：CLOSED 按 Ctrl 归一（仍按住 → CTRL_ARMED，已松开 → IDLE）；word→tooltip 用 relatedTarget ownership 转移，无 hide 竞态；Escape/scroll/navigation/DOM removal 关闭。
10. passive hint decoration：无 Ctrl 时灰线/红线按既有策略显示（不受 Ctrl gate 控制）。

**负断言**：正文文本交互无 preventDefault/stopPropagation（可注入探针监听捕获阶段断言）；正文 click 不写状态；feedback 只发生在 extension-owned tooltip；候选生成前后 WordState snapshot 不变（本票不涉及 hint 候选，但 tooltip 展示不写状态）。

**完成定义**：§21 P0 矩阵（anchor/button/form/text/scroll/plugin/link-query/tooltip-session）全部真实 Chrome 通过；R-INT-1..8 验收全绿；无回归（learning 红提示、known 移出、跨标签同步保持）。
