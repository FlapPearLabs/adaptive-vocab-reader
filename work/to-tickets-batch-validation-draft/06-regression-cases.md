# 草稿 06：回归用例（验证 batch validation 步骤语义）

upstream 无自动化测试框架（package.json 无 test script，scripts/ 仅 link/list/sync-plugin-version），按任务第十二节要求用静态 fixture + manual agent reasoning 验证。以下三个用例用于审查和后续落地时的验证。

## CASE 1 — hidden forward dependency（应被 validation 拦截）

输入（ticket 对）：

```
Ticket A:
  Blocked by: None
  Acceptance:
  - User can see the item in the dashboard.

Ticket B:
  Blocked by: None
  Acceptance:
  - Implements dashboard rendering.
```

问题：A 的 acceptance（“在 dashboard 看到 item”）依赖 B 才实现的 dashboard 渲染，但 A 声明无 blocker。

期待行为（`### 4. Validate the batch` 的 Dependency audit）：

- 按拓扑序走图：A 无 blockers，但在“只完成 base + 声明 blockers”的前提下无法满足“看到 dashboard 上的 item”——A 的 acceptance 需要 B 的产出。
- 要求：把 A 改为 `Blocked by: B`；或把该 acceptance 移到 B。
- 不得直接发布 A。修复后：A blocked by B，图变为 X → B → A，可正常进入 quiz/publish。

## CASE 2 — invented threshold（应被 validation 拦截）

输入：

```
Source spec: "Measure latency after the change."
Ticket: "Fail if latency exceeds 200 ms."
```

问题：Source 只要求 measure and report；200 ms 是 ticket 自行发明的新验收阈值，Spec 从未批准。

期待行为（Source-contract audit）：

- 识别 ticket 把 source 的 measure 升级为自行判定 acceptable/unacceptable，属于 ticket-invented product contract。
- 要求删除该阈值，改写为“测量并记录延迟，显著异常时保留证据并 STOP 返回用户/审查”；或返回 source owner 明确批准阈值后再写回。
- 不得带未批准阈值发布。

## CASE 3 — valid batch（应零额外仪式通过）

输入（两个正常 tracer-bullet ticket，领域无关的通用例子）：

```
Ticket A:
  Blocked by: None
  What to build: 实现 project creation API（POST /projects）。
  Acceptance:
  - 调用创建接口返回新项目 id。
  - 校验失败返回明确错误。

Ticket B:
  Blocked by: A
  What to build: 添加调用 project creation API 的 UI 流程。
  Acceptance:
  - 用户在表单提交后看到新项目创建成功。
  - 只使用 A 的 API 与本票自身状态。
```

期待行为：

- Dependency audit：B 的 acceptance 只依赖 A 的产出 + 自身 → 通过。
- Source-contract audit：两个 ticket 的 requirements 均可追溯到源 spec（project creation API / UI 流程）→ 通过。
- Constraint audit：无矛盾 → 通过。
- 无 cycle、无 hidden dependency、无 orphan → 正常进入 quiz/publish，不增加任何额外字段或文件。

> 备注：本用例刻意使用领域无关例子（project creation API），保证若被引用进 upstream PR discussion / fixture / maintainer 回复时，不携带本项目（query dictionary / ECDICT / tooltip 等）的领域细节。
