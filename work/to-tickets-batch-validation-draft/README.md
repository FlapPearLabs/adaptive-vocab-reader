# 草稿包 README：to-tickets batch validation

本目录是一次真实 `/to-tickets` 失败案例（approved Spec 拆票后 batch 级审查暴露四类一致性错误）的工程经验沉淀草稿。**本目录全部内容均为草稿，供网页版 GPT 审查；审查通过前不修改项目任何正式文件。**

## 任务定位（发送位置：新任务）

独立工程流程改进，不属于 adaptive-vocab-reader 当前 query-hint ticket 的产品开发。不重写当前产品 Spec/tickets，不改 RULES 产品语义。

## 核心经验（8 个 invariant）

1. Ticket correctness ≠ Batch correctness。
2. Declared dependency = actual acceptance dependency。
3. 每张 ticket 在 exactly its declared blockers 完成后必须可独立验证。
4. ticket 不得依赖 future ticket 的产出满足自己的 Acceptance。
5. ticket 可细化实现，但不得发明 source 没有的阈值/算法/policy/验收合同。
6. allowed modifications + produced artifacts + hard constraints 必须构成可执行合同。
7. 每个 normative source requirement 必须有明确处置：ticket / already-satisfied regression / validated prerequisite / source-authorized deferral。
8. draft 逐票之后必须验证整个 DAG，而不只是逐票审查。

## 四类真实失败模式

1. 允许修改范围与安全边界互相矛盾（ticket 不可执行）。
2. ticket 自行创造 Spec 未批准的验收标准/阈值（越权 source contract）。
3. Declared dependency 与真实 acceptance dependency 不一致（hidden/forward dependency）。
4. Requirement coverage 声称完整但实际 orphan（traceability 断裂）。

## 文件清单

| 文件 | 内容 |
| --- | --- |
| `01-proposed-agents-section.md` | adaptive-vocab-reader AGENTS.md 拟新增章节（插入位置 + 全文 + 设计说明） |
| `02-skill-skillmd-patch.diff` | upstream SKILL.md 最小补丁（Validate the batch 小节 + 重编号） |
| `03-docs-patch.diff` | upstream docs/engineering/to-tickets.md 同步补丁 |
| `04-changeset.md` | upstream changeset 草案 |
| `05-pr-body.md` | upstream PR title/body 草案 |
| `06-regression-cases.md` | 三个回归用例（hidden dependency / invented threshold / valid batch） |
| `07-research-notes.md` | upstream 研究记录与本地 skill 来源判定 |

## 非目标（审查重点）

- 不重新设计 /to-tickets：保留 tracer-bullet vertical slicing、blocking edges、每票独立 demoable、tracker-independent artifact、user quiz、publish、wide-refactor exception。
- 不加 scoring、dependency solver、DAG 库、coverage matrix 文件、强制 README、新 tracker abstraction、新 ticket 字段。
- 不修改当前 7 张 query-hint ticket、approved Spec、RULES.md。
- 不改 `~/.agents/skills/writing/to-tickets` 安装副本（B 类不可追踪来源）。

## 待审查问题

1. AGENTS.md 新增章节是否足够简短、无业务细节泄漏、与现有第 3/4/5 节无冲突？
2. SKILL.md 补丁是否最小、不破坏 tracer-bullet / blocking-edge / quiz / publish 语义？
3. docs 同步是否过度（不改变四节框架、不引入 install 命令文字）？
4. PR body / changeset 是否符合 upstream 惯例？
5. 本地 skill 的 B 类处理方案是否恰当？
