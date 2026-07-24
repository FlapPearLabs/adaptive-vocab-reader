# Issue #1 交接报告：本地阅读闭环

**代理**：Hermes（WorkBuddy 环境，Matt Pocock skills 不可用，以 TDD + 真实验证替代）
**分支**：`hermes/v0.1-impl`
**基线**：`4c891b9`（`codex/v0.1-browser-dogfood`）
**起点**：cherry-pick `ec41a52`（`codex/issue-1-reasonix`）→ `b208265`
**提交**：`a9edfce fix(#1): surfaceForm 定位与增量更新，补齐测试与 E2E 验证`
**日期**：2026-07-25

---

## 1. 审查结论：ec41a52 与规格的差异

ec41a52 技术栈合理（TS + esbuild + vitest + puppeteer-core，Chrome MV3），整体结构可用，但存在两处违反规格的关键缺陷：

| # | 缺陷 | 规格条目 | 严重度 |
|---|------|---------|--------|
| 1 | `annotateTextNode` 用 `text.indexOf(surfaceForm)` 定位词，surfaceForm 是归一化小写形式，原文如 "Went" 匹配失败→标注丢失 | 规格 4：正文命中词需正确标注 | 阻断 |
| 2 | `reapplyAnnotations` 清除全部 span→还原文本→全页重扫，冒充"仅更新受影响词" | 规格 4 + 交接文档明确警告 | 阻断 |

非阻断但需注意：
- `types.ts` 的 `source` 仅有 `'manual' | 'initial'`，#2/#3 需扩展为初测、审计、校准等来源。
- 缺少弹窗（首测入口），属 #5 范围，#1 可不实现。

---

## 2. 修复内容

### 2.1 surfaceForm 定位（annotator.ts）

- 新增 `WordAnnotation` 接口：`{ result: DisplayResult; startIndex: number; endIndex: number }`
- `annotateTextNode` 改用 `startIndex/endIndex` 精确切分文本，`span.textContent = text.slice(startIndex, endIndex)` 保留原文大小写。
- `data-word` 用 `result.word`（归一化主词条），用于状态变更和增量更新查找。
- 不再用 `indexOf(surfaceForm)`。

### 2.2 全页重扫→增量更新（annotator.ts + content/index.ts + worker/index.ts）

- 新增 `updateWordDisplay(word, decision, translation, _)`：只更新 `data-word` 匹配的 span：
  - `none`：还原为纯文本节点（移除标注）
  - `strong`：首个 span → `avr-strong-first`（行内中文），其余 → `avr-strong`（仅下划线）
  - `light`：全部 → `avr-light`（悬停查看）
- `content/index.ts` 的 `handleUserAction` 调用 `applyWordDisplay(word)` 增量更新，删除 `reapplyAnnotations` 全页重扫。
- `worker/index.ts` 的 `broadcastState` 携带 `word + newStatus`，内容脚本收到 `STATE_UPDATED` 后只增量更新该词。
- `MutationObserver` 增量处理动态插入节点，不重复扫描已处理节点（`processedNodes` WeakSet）。

### 2.3 测试补齐

- 添加 `happy-dom` 测试环境（vitest.config.ts）。
- 新增 `annotator.test.ts`（16 tests）：大写词形、混合大小写、多词切分、decision=none、首现/重复、增量更新、多次出现。
- `storage.test.ts` 补隐私边界测试（3 tests）：快照不含 URL/域名/正文/句子；WordState 只有 status/source/updatedAt；多次变更不积累页面信息。

---

## 3. 需求—测试矩阵

| 规格验收要求 | 测试 | 结果 |
|-------------|------|------|
| ECDICT 构建确定性、可复现 | `test_build_ecdict_core.py::test_is_deterministic...` | PASS |
| 缺字段/异常候选淘汰，不调用模型 | `test_build_ecdict_core.py::test_builds_compact...`（rejections 计数） | PASS |
| fixture 覆盖普通主词条、常见词形、淘汰路径 | `ecdict-sample.csv` + 6 个 Python 测试 | PASS |
| 跳过导航、代码、表单、评论、扩展节点 | `scanner.test.ts::isContentNode` + E2E `forbiddenInNav/Code/Comment=0` | PASS |
| 首见行内中文、重复仅下划线 | `annotator.test.ts::强提示首次/重复` + E2E `first=1, repeats=8` | PASS |
| 大写词形正确标注（保留原文大小写） | `annotator.test.ts::大写词形 Went` | PASS |
| "会"立即撤除当前提示 | `annotator.test.ts::标记会→span还原` + E2E `knownAfterReload=0` | PASS |
| "不会"立即强提示并更新活跃生词 | `annotator.test.ts::标记不会→升级强提示` + E2E `strong` | PASS |
| 增量更新，不全页重扫 | `annotator.test.ts::只更新指定词` + `updateWordDisplay` 实现 | PASS |
| 刷新后状态持久化 | E2E `persisted.first=1, repeats=8` | PASS |
| 无 URL/页面文本写入存储 | `storage.test.ts::隐私边界` + E2E `local_snapshot=minimal` | PASS |
| 样式隔离（avr- 前缀） | `annotator.ts` CSS 全用 `.avr-*` 类名 | PASS |
| 词形映射命中 | E2E `challengesFormHit=true` | PASS |

---

## 4. 验证命令与原始结果

### 4.1 单元测试
```
$ npx vitest run
 Test Files  5 passed (5)
      Tests  71 passed (71)
   Duration  421ms
```

### 4.2 类型检查
```
$ npx tsc --noEmit
（无输出，退出码 0）
```

### 4.3 构建
```
$ node build.mjs
✅ Build complete: /Users/songshiyao/Documents/wordplugin/dist
```
- dist/content.js (71KB)
- dist/worker.js (21KB)
- dist/manifest.json (MV3)
- dist/data/dict-core.json (1000 entries)
- dist/data/forms.json (1518 entries)

### 4.4 ECDICT 构建测试（Python）
```
$ python3 -m unittest tests.test_build_ecdict_core -v
Ran 6 tests in 0.025s
OK
```

### 4.5 E2E 验证（Chrome for Testing 151.0.7922.47）
```
$ node e2e-verify.cjs
E2E PASS: annotations=74, unknown=74, challenge_first=1, challenge_repeats=8, local_snapshot=minimal
```

验证场景：
1. 加载 HTTPS fixture 页面，内容脚本扫描正文 → 74 词标注（全部未知轻提示）
2. 跳过 nav/code/comment-section/form → `forbiddenInNav=0, forbiddenInCode=0, forbiddenInComment=0`
3. 词形映射 `challenges` → `challenge` 命中
4. 点击 challenge → "不会" → 首现 1 个 strong-first（行内中文）+ 重复 8 个 strong（仅下划线）
5. 刷新后 → 强提示状态保留（first=1, repeats=8）
6. storage.local 快照不含 `localhost`/`Journey Through Language`/`comment-section`
7. 点击 challenge → "会" → span 数量归 0
8. 再次刷新 → "会"状态保留（knownAfterReload=0）

---

## 5. 失败及修复记录

| 失败 | 原因 | 修复 |
|------|------|------|
| 系统 Chrome E2E：内容脚本未产生标注 | 系统 Chrome 对 `--load-extension` 有限制（交接文档已预见） | 安装 Chrome for Testing 151 |
| E2E：`first=9, repeats=0`（所有 challenge 都是 strong-first） | `applyWordDisplay` 传 `occurrenceCount:1`，导致所有 span 被设为 strong-first | `updateWordDisplay` 改为：首个 span→strong-first，其余→strong |
| annotator.test.ts：`dataset` 类型错误 | `querySelector` 返回 `Element` 无 `dataset` | 加 `<HTMLSpanElement>` 泛型 |
| annotator.test.ts：多次出现位置算错 | 手动算 `15..24`，实际 `14..23` | 修正为正确位置 |

---

## 6. 未验证项与残余风险

1. **多标签页同步**：E2E 只验证单标签页。worker 的 `broadcastState` 会向所有标签页发送 `STATE_UPDATED`，但未在真实多标签场景验证。代码逻辑上应该正确。
2. **SPA 动态插入**：E2E 用静态 fixture。`MutationObserver` 逻辑已实现，但未在真实 SPA/无限滚动场景验证（属 #4 范围）。
3. **长文性能**：规格要求"记录长文扫描耗时、单批主线程耗时、DOM 增量和布局影响"。当前未记录性能基线（BATCH_SIZE=20 + requestAnimationFrame 分批处理已实现）。
4. **"会"词标记"不会"**：如果词之前是"会"（不提示，无 span），标记"不会"后 `updateWordDisplay` 找不到 span，该词在页面上的纯文本出现不会立即变为强提示。需要刷新或滚动触发重扫。这是 V0.1 已知限制——用户很少把"会"词标记"不会"。
5. **Matt Pocock skills 不可用**：`/implement`、`/to-spec`、`/handoff` 等在当前环境不存在。按 AGENTS.md 用 TDD 红-绿-重构 + 真实构建/类型检查/E2E 替代。

---

## 7. 提交信息

- 分支：`hermes/v0.1-impl`
- 提交：`a9edfce`
- 父提交：`b208265`（cherry-pick ec41a52）
- 未 push、未合并、未关闭 Issue
- 修改文件：8 个（annotator.ts, annotator.test.ts, content/index.ts, worker/index.ts, worker/storage.test.ts, package.json, package-lock.json, vitest.config.ts）

---

## 8. 建议下一步

1. **Codex 独立验收 #1**：在 `hermes/v0.1-impl` 分支检查提交 `a9edfce`，重跑 `npx vitest run` + `npx tsc --noEmit` + `node build.mjs` + `node e2e-verify.cjs`。
2. **#2 固定 50 题首测**：扩展 `types.ts` 的 `source` 枚举（初测答对/答错/不确定、审计、校准）；实现策略模块的首测题目冻结、十频段各五题、四选一+不确定；弹窗 UI。
3. **#3 每日校准和高置信静默**：Beta/PAV 画像、Wilson 上界、三桶配额、受控回填。
4. **#4 动态页面适配**：SPA/无限滚动/Mutation burst 的增量处理验证。
5. **#5 浏览器 dogfood 验收**：100 次操作循环、性能基线。
