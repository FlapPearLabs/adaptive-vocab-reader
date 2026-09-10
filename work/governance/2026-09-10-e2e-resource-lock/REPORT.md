# E2E SHARED EXECUTION RESOURCE GOVERNANCE REPORT

**阶段**：`PHASE-E2E-RESOURCE-LOCK` — 实施前最终治理纠正（共享执行资源分类 + 独占资源槽）
**仓库**：`FlapPearLabs/adaptive-vocab-reader`
**日期**：2026-09-10
**性质**：**纯治理。未写生产代码、未派发 Zcode、未创建实现 worktree、未开始任何 T-VUX 票、未修改 `e2e-verify.cjs`、未新增或恢复任何语义依赖边。**

---

## 1. STARTING_HEAD

| 项 | SHA |
|---|---|
| 起始治理 HEAD（fresh `git fetch origin --prune` 实测） | `a9da9f9acf1f0125334892225f588844a5bd87d0` ✅ **与任务预期一致** |
| live `origin/main` | `58a86f77b0358a96c04e7e07baa9900f33186813`（**未变**） |
| 生产代码基线 | `247ef89f45df5c623c1de768d098230600de9498` |
| 起始工作树状态 | 干净（`git status --porcelain` 空） |

**生产代码自验证基线以来是否变更**：**否**。本阶段未触碰任何生产代码路径。**未触发 `STOP: PRODUCTION_BASELINE_DRIFT`。**

---

## 2. 外部评审裁定（本阶段的输入前提）

| 项 | 裁定 |
|---|---|
| 语义 DAG | **PASS** |
| `SEMANTIC_DEPENDENCY_DAG = ∅` | **保持正确** |
| 四个 `T-VUX` 票 | **仍独立可实施** |
| 恢复任何依赖边 | **禁止** |

本轮**接受**该裁定，未恢复任何边，未新增任何边。本轮只做一件事：把评审新发现的**宿主机级共享执行资源**按现行治理规则正确归类。

---

## 3. 核验证据（fresh，实测仓库，非引用评审转述）

| 事实 | 证据（文件:行号 + 原文） | 结论 |
|---|---|---|
| `tempDir` 每进程唯一 | `e2e-verify.cjs:251` `const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avr-e2e-'));` | **隔离安全**（fixture 与自签证书均写入该私有目录）→ **不是**共享资源 |
| HTTPS fixture server 绑定固定端口 | `e2e-verify.cjs:21` `const PORT = 18923;`；`e2e-verify.cjs:153` `return new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));` | **共享执行资源** |
| 端口为**编译期常量**，无 env 覆盖 | 全文检索 `PORT` / `listen(` / `[0-9]{4,5}` —— 仅 `:21` 一处定义、`:153` 一处 `listen`，另 19 处为 `localhost:${PORT}` 引用；**无** `process.env.PORT` 或等价回退 | 端口**不可**由配置错开 ⇒ 同主机并发必然冲突 |
| 失败模式 | Node `server.listen` 在端口被占用时抛 `EADDRINUSE` | 完整 `npm run test:e2e` **不能**同主机并发 |

**判定**：`E2E_SAME_HOST_CONCURRENCY = 1`。

---

## 4. 分类结果

| 项 | 值 |
|---|---|
| 分类 | **`SHARED_EXECUTION_RESOURCE`** |
| 独占资源槽 | **`E2E_PORT_18923_LOCK`** |
| 是 `SEMANTIC_DEPENDENCY_DAG` 的边吗 | **否** |
| 是 `INTEGRATION_CONFLICT_MAP` 的条目吗 | **否**（不产生跨分支文本冲突） |
| 约束对象 | **同一宿主机**上的**完整** `npm run test:e2e` |
| 是否约束 ticket 实施 | **否** —— 实施并发度不受资源槽约束 |

### 4.1 为什么它既不是依赖也不是集成冲突

- **不是依赖**：任何一票的实现正确性都不取决于另一票是否先跑过 E2E。反事实测试：假设某票永不实施，其余票在自己的 worktree 中仍能实现并通过全部 AC——它们只是**需要排队使用同一个端口**。资源占用是**运行期**现象，不改变**验收语义**。
- **不是集成冲突**：冲突图记录的是**跨分支文本合并**关系。端口占用不产生任何文件差异，合并时无冲突可言。若把它记入冲突图，会污染集成 lane 的职责边界。

---

## 5. 逐条落实（外部评审 8 点要求）

| # | 要求 | 落实位置 | 结果 |
|---|---|---|---|
| 1 | DAG 边只代表 `HARD_SEMANTIC_BLOCKER` | `AGENTS.md` §4.2.1 定义 + §4.2.4-1 反向排除 | **PASS** |
| 2 | 固定端口 / 独占 profile / 设备 / fixture 资源 = 调度约束，**不是** DAG 边 | `AGENTS.md` §4.2.4（新增整节 + 资源台账表） | **PASS** |
| 3 | 四条 Zcode lane **可并发开发** | 批次 `README.md` §4（`IMPLEMENTATION_CONCURRENCY = 4`） | **PASS** |
| 4 | typecheck / 单元 / 数据测试 / build 在隔离 worktree 中**可并发** | `AGENTS.md` §4.2.3 末条；批次 `README.md` §11 | **PASS** |
| 5 | 同主机完整 E2E 须取得 `E2E_PORT_18923_LOCK` | `AGENTS.md` §4.2.4-2 + 资源台账；批次 `README.md` §3.1-1 / §10-15 | **PASS** |
| 6 | 等待资源槽的 lane 仍有效，**不得**阻塞兄弟 lane | `AGENTS.md` §4.2.4-3 / §4.2.4-4；批次 `README.md` §3.1-3 | **PASS** |
| 7 | `BLOCKED` **不因**临时调度资源争用传播 | `AGENTS.md` §4.2.5（显式加入传播排除项 + 等待槽不构成 `BLOCKED` 事件）；批次 `README.md` §8 | **PASS** |
| 8 | 集成 lane 分支组合后跑**完整** E2E | `AGENTS.md` §4.2.6（新增必跑条款）；批次 `README.md` §6 / §11 | **PASS** |

---

## 6. 修改的文件（最小集）

| 文件 | 变更摘要 |
|---|---|
| `AGENTS.md` | **新增 §4.2.4 共享执行资源**（5 条强制口径 + 资源台账表）；§4.2.3 补「无共享运行期资源的门禁可并发」；原 §4.2.4/§4.2.5/§4.2.6 **顺延**为 §4.2.5/§4.2.6/§4.2.7 并分别补入资源争用排除项、集成 lane 必跑 E2E、批次 README 五个模型 + 双并发度；§4.2 标题由「三者」改为「四者」；开篇补入「把固定端口误当依赖」这一历史误判 |
| `work/tickets/2026-09-10-v0.1-ux-delta/README.md` | **新增 §3 SHARED EXECUTION RESOURCES**（资源台账 + 资源槽规则 + 各阶段对照）；§4 拆为 `IMPLEMENTATION_CONCURRENCY` / `E2E_SAME_HOST_CONCURRENCY` 两个维度；§8 补资源争用不传播；§10 新增硬约束 15（端口槽独占）/ 16（禁改 harness 端口）；§11 门禁标注第五条需持槽；后续小节顺延编号；状态表更新为最终状态 |
| `work/tickets/2026-09-10-v0.1-ux-delta/VALIDATION-REPORT.md` | 新增「复审追加三 — `PHASE-E2E-RESOURCE-LOCK`」；R-3 第 3 项由「P2 待核验」更正为**已核验**并把真实约束指向固定端口 |
| `work/tickets/2026-09-10-v0.1-ux-delta/01-reading-presentation-integrity.md` | §8.1 实施前检查第 3 项：记录 `tempDir` 已核验 + 固定端口资源槽；明确遇 `EADDRINUSE` 只报告、等待槽、不改 harness |
| `work/governance/2026-09-10-dag-repair/REPORT.md` | **交叉引用修补**：§4.2.4→**§4.2.5**（阻塞传播）并加编号说明；§4.2 小节清单更新为当前编号 4.2.1~4.2.7（含新增 §4.2.4）；更正「全文唯一一处『串行』」的失实佐证（详见 §6.2） |
| `work/governance/2026-09-10-e2e-resource-lock/REPORT.md` | 本报告（新增） |

### 6.1 明确**未**修改的内容

- `e2e-verify.cjs` —— **逐字节未动**（符合任务约束；`git diff --name-only | grep e2e-verify` 计数为 0）；
- 任何 ticket 的 `Blockers` 字段（仍全部为空）；
- `SEMANTIC_DEPENDENCY_DAG` —— 保持 **空图**，未新增、未恢复任何边；
- `INTEGRATION_CONFLICT_MAP` 的既有条目 —— 未新增端口条目（端口不属冲突图）；
- `RULES.md` / `CONTEXT.md` / `docs/adr/` / 任何已批准 Spec；
- 未创建 branch / tag / Issue / PR / 部署 / release。

### 6.2 附带更正（复核中发现的既存不准确表述）

| 位置 | 原表述 | 实测 | 处理 |
|---|---|---|---|
| 批次 `README.md` §4（「已推翻的旧说法」段） | 「`AGENTS.md` 全文**只有一处**『串行』，指的是『一个串行任务只使用一个 review 分支』」 | `AGENTS.md` 中「串行」共 **4** 处，其中 §4.2.3 / §4.2.7 两处为**禁止串行化**的反向语境，§4.2 开篇一处为「全局串行化」的历史误判描述，仅 §5 一处属分支卫生 | 改写为准确表述（核心结论不变：**无任何规则要求 ticket 串行开发**） |
| `work/governance/2026-09-10-dag-repair/REPORT.md`（同一误述的**源头**） | 同上 | 同上 | 同步更正，并加显式「更正说明」指向本报告 §6.2 |
| `work/governance/2026-09-10-dag-repair/REPORT.md` §「阻塞传播不变式」与小节清单 | 引用 `AGENTS.md` §4.2.4（阻塞传播）/ 清单为 4.2.1~4.2.6 | 本轮插入新 §4.2.4 后编号**顺延** | 该报告为**前序阶段历史记录**，未改写其历史结论，只**修补失效交叉引用**并加编号说明 |

该不准确表述为**前序阶段既存**，非本轮引入；本轮只是使其更明显，故一并更正，并在 `VALIDATION-REPORT.md` 的 S-5-1 / S-5-5 行加注指向本报告。

---

## 7. 最终状态

| 字段 | 值 |
|---|---|
| `SEMANTIC_DEPENDENCY_DAG` | **`∅`** |
| `IMPLEMENTATION_CONCURRENCY` | **4** |
| `E2E_SAME_HOST_CONCURRENCY` | **1** |
| `TICKET_BATCH_VALIDATION` | **PASS** |
| `READY_FOR_ZCODE_PARALLEL_IMPLEMENTATION` | **PASS** |
| `PRE_IMPLEMENTATION_VERDICT` | `READY_FOR_EXTERNAL_PRE_IMPLEMENTATION_REVIEW` |

---

## 8. RESULTING_HEAD

| 项 | 值 |
|---|---|
| 结果分支 | `governance/ux-spec-integration-2026-09-10` |
| **本阶段实质提交**（含本报告） | `4ce9bac5fb9dbce1cfd34091f63cc93ad053f9a8` |
| 结果分支 HEAD | **见交付回复中的 `git rev-parse` 实测值**（该 SHA 之后的提交仅为 append-only 簿记，不含内容变更） |
| 推送方式 | `git push origin governance/ux-spec-integration-2026-09-10`，**fast-forward，无 force-push** |

---

## 9. STOP 状态

**已 STOP 于实现之前。**

- 未开始任何 `T-VUX` 票；
- 未派发 Zcode / 任何实现代理；
- 未创建实现 worktree 或 `lane/*` 分支；
- 未合并 `main`、未关闭 Issue、未删除分支、未发布。

**下一步须由用户显式授权「开始开发」后，方可进入并行实施。**
