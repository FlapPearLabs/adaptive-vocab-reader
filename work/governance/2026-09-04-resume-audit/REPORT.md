# RESUME-01 审计报告 — Fresh Main Reproducibility + Authority Reconciliation

- **执行日期**：2026-09-09（GMT+8）
- **执行票据**：[`work/tickets/2026-09-04-restart/RESUME-01-fresh-main-reproducibility-and-authority-reconciliation.md`](../../tickets/2026-09-04-restart/RESUME-01-fresh-main-reproducibility-and-authority-reconciliation.md)
- **执行分支**：`governance/restart-baseline-2026-09-04`
- **执行起点 HEAD**：`77f8c305e692da2218b98a28a7b2c6423625fe93`
- **结论**：`RESUME-01` 完成；质量门禁六项（typecheck / unit / data / build / E2E / fail-closed）fresh 全绿；无 `STOP condition` 触发；**存在 3 个非阻断性治理 blocker + 1 个授权边界外的 stale-doc 冲突**。

---

## REMOTE_BASELINE

| 项 | 值 |
|---|---|
| Repository | `FlapPearLabs/adaptive-vocab-reader` |
| live `origin/main`（执行时 fresh fetch 实测） | `333c3628c5adabd1d69f96b9043eb7a109825eb0` |
| 票据预期 `origin/main` | `333c3628c5adabd1d69f96b9043eb7a109825eb0` |
| 判定 | **MATCH → 未触发 `STOP: REMOTE_BASELINE_CHANGED`** |
| 治理分支 merge-base with main | `333c3628c5adabd1d69f96b9043eb7a109825eb0`（4 个 docs-only commit，无生产代码改动） |
| 上次生产代码父提交 | `247ef89f45df5c623c1de768d098230600de9498`（`333c362` 仅加 local query asset 恢复文档） |

```bash
git fetch --all --prune
git rev-parse origin/main   # 333c3628c5adabd1d69f96b9043eb7a109825eb0
```

---

## ENVIRONMENT

| 项 | 值 |
|---|---|
| OS | macOS 26.2 (Build 25C56)，arm64 |
| Node | `v22.22.2` |
| npm | `10.9.7` |
| Python | `3.13.12`（`python3 -B`，不写 `.pyc`） |
| 系统 Chrome（未使用） | `Google Chrome 152.0.7977.83` |
| Chrome for Testing（本次 E2E 使用） | `153.0.8010.36`，**本 worktree 内全新下载安装**（`npm run setup:e2e`），未复用任何旧 worktree 缓存 |
| fresh worktree 路径 | `/Users/songshiyao/Documents/wordplugin/.cache/restart-2026-09-04`（`.cache/` 在 `.gitignore:10`，不污染 git status） |
| `npm ci` | 82 packages，8s |

**为什么 worktree 放在 `.cache/`**：本执行环境（WorkBuddy sandbox）的 Node fs broker 只允许向 session workspace 内写文件；放在 `~/Documents/` 顶层的 worktree 会以 `CODEBUDDY_BROKER_DENY / Brokered host mkdir` 失败。改用工作区内被 git 忽略的 `.cache/` 后 `npm ci` 正常。这是**执行环境限制，不是仓库缺陷**；同时满足 RESUME-01「fresh isolated checkout、不复用旧 ignored assets」的要求。

**Node shim 说明**：本环境下 `npm` / `node` 需要 `NODE_OPTIONS=` 前缀绕过沙箱 fs shim 才能写 `node_modules/`、`dist/`。该前缀只影响进程启动参数，不改变任何被测行为、断言或产物。所有门禁命令均以此前缀运行并保留原始输出。

---

## DATA_RECOVERY

严格按 `data/README.md` 的 tracked runbook 执行，**未从任何旧 worktree 复制派生资产来构造 PASS**。

### 1. 固定 raw 输入（重新下载，非复用）

| 项 | 值 |
|---|---|
| source ref | `bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b` |
| 下载 URL | `https://raw.githubusercontent.com/skywind3000/ECDICT/bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b/ecdict.csv` |
| 落盘路径 | `data/raw/ecdict-bc015ed2.csv` |
| 字节数 | `65,933,428` |
| 实测 SHA-256 | `1a6947e04785db63613a92e14903cdae7954f7e84860b10e68e5c7cbb3f9c3cf` |
| 期望 SHA-256 | 同上 |
| 判定 | **MATCH → 未触发 `RAW_SOURCE_HASH_MISMATCH`** |

```bash
curl -fsSL -o data/raw/ecdict-bc015ed2.csv \
  https://raw.githubusercontent.com/skywind3000/ECDICT/bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b/ecdict.csv
shasum -a 256 data/raw/ecdict-bc015ed2.csv
```

### 2. 确定性重建

```bash
python3 -B scripts/build_ecdict_core.py --input data/raw/ecdict-bc015ed2.csv \
  --output-dir data/derived/ecdict-core-1000 --limit 1000 --mode core \
  --source-ref bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b --source-date 2026-07-22
# {"selected_count": 1000, "output_dir": "data/derived/ecdict-core-1000"}

python3 -B scripts/build_ecdict_core.py --mode query --input data/raw/ecdict-bc015ed2.csv \
  --output-dir data/derived/ecdict-query \
  --source-ref bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b --source-date 2026-07-22
# {"selected_count": 121340, "output_dir": "data/derived/ecdict-query"}
```

### 3. 产物与基线对比

| 产物 | 存在 | SHA-256（前 16 位） | 与旧 worktree 逐字节比对 |
|---|---|---|---|
| `data/derived/ecdict-core-1000/dict-core.json` | ✅ | `64eb1a402f909f7a` | MATCH |
| `data/derived/ecdict-core-1000/forms.json` | ✅ | `d92f313c328be798` | MATCH |
| `data/derived/ecdict-core-1000/frequency-bands.json` | ✅ | `dcde8958701bc67a` | MATCH |
| `data/derived/ecdict-core-1000/build-report.json` | ✅ | `41c453e299801d78` | MATCH |
| `data/derived/ecdict-query/query-dictionary.json` | ✅ | `294b8d051a70fa21` | MATCH |
| `data/derived/ecdict-query/query-forms.json` | ✅ | `3d84c8cb74a84077` | MATCH |
| `data/derived/ecdict-query/query-build-report.json` | ✅ | `5bbfabefb3fefc6c` | MATCH |

> 与旧 worktree 的比对是**只读**比对（`shasum` 双向计算），用于证明「同一输入 + 同一脚本 → 同一产物」的确定性；本次门禁使用的资产全部由本 worktree 内重新生成，不是复制品。

### 4. 数值基线（与 `data/README.md` 记录一致）

| 指标 | 期望基线 | fresh 实测 |
|---|---|---|
| query entries | 121340 | **121340** ✅ |
| frequency eligible | 40090 | **40090** ✅ |
| frequency ineligible | 81250 | **81250** ✅ |
| input rows | — | 770611 |
| core selected | 1000 | **1000** ✅ |

### 5. ignored 边界

- `git status --porcelain` 在生成全部资产后**为空**（`data/raw/`、`data/derived/`、`dist/`、`node_modules/` 全部在忽略边界内）。
- `git check-ignore -v` 命中 `.gitignore:30:data/raw/`、`.gitignore:31:data/derived/`。
- 无 derived query payload 被提交进 Git。

### 6. fail-closed 验证（负向探针）

临时移走 `data/derived/ecdict-query/query-dictionary.json` 后：

```text
BUILD_EXIT_WITHOUT_QUERY_ASSET=1
❌ Build failed: Error: 缺少本地查询词典资产 …/data/derived/ecdict-query/query-dictionary.json；
先按 data/README.md 从固定 ECDICT 快照生成。
```

恢复后 `BUILD_EXIT_RESTORED=0`。**fail-closed 合约成立**。

### DATA_RECOVERY 判定：**PASS**

---

## TYPECHECK

```bash
NODE_OPTIONS= npm run typecheck   # tsc --noEmit
TYPECHECK_EXIT=0                  # 无任何输出
```

**判定：PASS**（fresh worktree，`npm ci` 后首次运行，无历史缓存）

---

## UNIT_TESTS

```bash
NODE_OPTIONS= npm test            # vitest run
```

| 指标 | 值 |
|---|---|
| Test Files | **18 passed (18)** |
| Tests | **283 passed (283)** |
| Duration | 1.33s |

覆盖文件：`estimate` 13、`storage` 40、`quiz` 14、`annotator` 22、`auditValidation` 21、`daily` 9、`seam` 9、`worker/index` 40、`spa` 8、`auditPlanVersion` 6、`scanner` 21、`dictionary` 13、`strategy/index` 13、`importBoundary` 5、`hint` 5、`audit-send-lock` 33、`popupNotebook` 2、`strategy/audit` 9。

**判定：PASS**

---

## DATA_TESTS

```bash
python3 -B -m unittest discover -s tests -p "test_*.py" -v
```

| 指标 | 值 |
|---|---|
| Tests run | **12** |
| Result | **OK**（2.262s） |
| 单独入口 `python3 -B tests/test_build_ecdict_core.py` | exit 0 |

用例：`test_builds_compact_core_forms_bands_and_report`、`test_builds_query_dictionary_without_rejecting_missing_frequency`、`test_derives_pos_from_explicit_translation_prefix_when_pos_column_is_blank`、`test_drops_form_keys_that_are_also_core_headwords`、`test_forms_map_keys_never_shadow_a_core_headword`、`test_forms_map_targets_are_always_selected_core_headwords`、`test_ignores_exchange_relation_codes_that_are_not_word_forms`、`test_ignores_invalid_utf8_in_unused_source_columns`、`test_is_deterministic_and_rejects_insufficient_eligible_records`、`test_rejects_a_row_with_invalid_utf8_without_losing_valid_rows`、`test_reports_all_words_ineligible_when_too_few_distinct_translations`、`test_reports_quiz_eligibility_with_sufficient_distinct_translations`。

**判定：PASS**

---

## BUILD

```bash
NODE_OPTIONS= npm run build       # node build.mjs
# ✅ Build complete: …/dist
```

`dist/` 产物：`manifest.json`、`content.js`(222,822 B)、`worker.js`(266,234 B)、`popup.js`(172,974 B)、`popup.html`、`popup.css`、`data/`（含 `dict-core.json`、`forms.json`、`frequency-bands.json`、`build-report.json`、`query-dictionary.json` 10,125,167 B、`query-forms.json` 453,832 B）。

- 正常构建 exit 0；
- 缺 query 资产构建 exit 1（见 DATA_RECOVERY §6）。

**判定：PASS**

---

## REAL_CHROME_E2E

```bash
NODE_OPTIONS= npm run setup:e2e                       # chrome@stable → 153.0.8010.36（本 worktree 全新安装）
AVR_E2E_NO_SANDBOX=1 NODE_OPTIONS= npm run test:e2e   # node e2e-verify.cjs
E2E_EXIT=0
```

### 两种运行模式（同一份代码、同一份 dist）

| 模式 | 结果 | 首条失败 |
|---|---|---|
| 默认（保留 Chrome 原生 sandbox） | **FAIL**（exit ≠ 0） | `goto 多次重试仍失败：Requesting main frame too early!`（`gotoSafe` 6 次重试 × 400ms 后仍失败），失败定位 `场景 1/2`，责任 Ticket T5 |
| `AVR_E2E_NO_SANDBOX=1` | **PASS**（exit 0，`E2E ALL PASS（T5 综合验收）`） | — |

**根因分类**：`environment`，非 `implementation` / `product failure`。本执行环境已是沙箱，Chrome 再套一层原生 sandbox 时首帧附加事件不达 puppeteer。历史上 T5 报告（`outputs/2026-08-03-ticket05-acceptance-report.md`）同样记录「真实 Chrome 151，`AVR_E2E_NO_SANDBOX=1` 受限会话」，方向一致。**未修改任何测试、断言或产品代码**，仅使用脚本已支持的运行开关。

### PASS 关键证据（`AVR_E2E_NO_SANDBOX=1`，Chrome for Testing 153.0.8010.36）

```text
E2E #1 PASS: annotations=123, unknown=3, challenge_first=1, challenge_repeats=5,
             form_merge=abilities→ability(wordKey), local_snapshot=minimal
E2E HINT PASS: T0=22662, n=40090, index=20045(0-based upper-middle),
               light_per_100=4.55, calibration_light=false
E2E SELECTION PASS: timeline=mousedown>…>mouseup>click,
                    query_outside_assessment=true, evidence_unchanged=true
E2E UX1 PASS: R-UX-T1~T4=true, R-UX-S1~S5=true, abilities→ability=true,
              selection_text_persisted=false
E2E #1B PASS: schema2_fixture→v3=true, forms_merge=abilities→ability,
              conflict_arbitration=updatedAt_newer, unmapable_key_kept=true,
              evidence_rebuilt=true, corrupt_skipped=true, audit_cleared=true,
              persisted_idempotent=true
E2E #2 PASS: questions=50, known=25, learning=25, audit_markers=0, plan_frozen=true,
             page_updated=true, multitab_synced=true, reopen_recovered=true,
             audit_entry_absent=true, residual_plan_ignored=true, worker_reloaded=true
E2E UX2 PASS: R-UX-N1~N5=true, manual_learning_known_evidence_unchanged=true,
              estimate_unchanged=true, state_updated_broadcast=true,
              unmappable_key_kept_hidden=true
E2E #3 PASS: intro=13, feed=13, view=12, nav_skipped=true, code/form/comment_skipped=true,
             query_asset_load_ms={query-forms:24.69, query-dictionary:45.05},
             content_script_initialization_ms=134.7, initial_scan_ms=1.1,
             css_isolation={parentColor:rgb(0,0,0), transparent/known/light/strong 均继承同色},
             perf_samples: totalScanMs=89.9/87/100.6, maxBatchMs=2.1/1.9/2.1,
                           wordsAnnotated=4159, netNodes=8246, layoutShiftScore=0
             spa_perf: totalScanMs=6.1, maxBatchMs=0.7, lightHintsPer100Words=4.92
E2E #4 PASS: daily_round=5q, bands_even=0/2/4/6/8, incomplete_round_cross_day=true,
             answered_kept=true, unanswered_zero_change=true, round_index_kept=0,
             expired_write_rejected=true, skip_zero_change=true, pause_resume=true,
             reading_in_progress_unblocked=true
E2E #5 PASS: point=500, range=324–676, no_extrapolation_declared=true, forbidden_text_absent=true
E2E #6 PASS: manual_word=politics, hint_changed=true, evidence_unchanged=true, estimate_unchanged=true
E2E #15 PASS: restart_persistence=true, schemaVersion=3, words=55, evidence=55,
              dailyTest_completed=true, completedRoundIndex=1
[stage4] 场景 7/8/9/10/11/12/13/17 全部 PASS
[stage6] manual 同步 PASS（action/actioned）；daily 同步 PASS（me/mes）
E2E ALL PASS（T5 综合验收）
```

§21 场景 1~17 + 持久化补全的复核矩阵全部打印并全部通过。

### 与历史性能观测的对照（非 SLA）

| 指标 | 历史 rebaseline（2026-08-09） | 本次 fresh（2026-09-09） |
|---|---|---|
| 长文 totalScanMs | 约 79.7–98.9 ms | 87.0 / 89.9 / 100.6 ms |
| 单批最大 | 约 1.9–2.3 ms | 1.9 / 2.1 ms |
| CLS / layoutShiftScore | 0 | 0 |

量级一致，无显著退化。两者都只是观测值，不是 SLA。

### REAL_CHROME_E2E 判定

- **PASS**（`AVR_E2E_NO_SANDBOX=1`，exit 0，全场景通过）
- 附记：默认 sandbox 模式在本执行环境 FAIL（environment 类），未修改代码掩盖。

---

## ISSUE_RECONCILIATION

原则：`OPEN ≠ NOT_STARTED`；`有代码 ≠ Issue 已完全满足`；**本票未关闭任何 Issue**。以下逐条对照 acceptance criteria 与 2026-09-09 fresh evidence。

| Issue | 标题 | 状态 | fresh evidence 对照 | 判定 | closure recommendation |
|---|---|---|---|---|---|
| **#1** | V0.1：最小本地词汇阅读闭环 | open | 加载未打包扩展 ✅；静态正文标注 123 处 ✅；词形命中 `abilities→ability` ✅；会/不会即时更新 + 刷新保留 ✅；`local_snapshot=minimal`（无 URL/标题/正文）✅ | **implemented + verified（部分 AC 已被现行规则取代）** | **暂不关闭**。其「`未知` 命中词获得轻提示」已被 RULES 2026-08-06/07 决议（灰线只用于潜在不会候选，非无条件 light）取代，AC 文本与现行规则冲突。**建议**：在单独授权步骤中改写 AC 或标记 superseded 后关闭。 |
| **#2** | V0.1：固定 50 题首次测评与词汇状态 | open | `questions=50, known=25, learning=25, plan_frozen=true` ✅；`audit_markers=0` ✅；结果广播到已开页面 ✅；重启恢复 ✅ | **implemented + verified（审计标记部分被冻结取代）** | **暂不关闭**。AC 中「单次答对审计标记」与 R-AUD 冻结规则（首测不创建 `AuditMarker`）直接冲突。**建议**：拆为「50 题首测」可关闭 + 「审计标记」条款标记 frozen/superseded。 |
| **#3** | V0.1：每日校准与保守高置信不提示 | open | 每日校准部分：`daily_round=5q`、频段奇偶轮换、跳过/暂停/跨日/不阻塞阅读全 PASS ✅。高置信不提示 / PAV / Beta / 隐藏词审计部分：**现行规则明确冻结、不恢复** | **partially implemented + partially frozen** | **不关闭**。该 Issue 把「每日校准（已实现）」与「保守高置信不提示（已冻结，属明确不做项）」绑在一张票里。**建议**：拆分为「每日校准（可关闭）」+「高置信隐藏（标记 superseded/frozen，关闭并注明不恢复）」，需用户授权。 |
| **#4** | V0.1：真实网页正文与动态内容适配 | open | SPA/动态插入/无限滚动 ✅；nav、code、form、comment 跳过 ✅；`nav_skipped=true, code/form/comment_skipped=true` ✅；长文扫描/批处理/DOM/布局基线已记录 ✅；隐私边界 `local_snapshot=minimal` ✅ | **implemented + verified（含一条被取代条款）** | **暂不关闭**。AC 中「满足高置信条件的未知词不提示」同 #3 属冻结项。**建议**：改写该条款后关闭。 |
| **#5** | V0.1：1,000 词真实浏览器 dogfood 验收 | open | 未打包扩展加载全场景 ✅（本次 `E2E ALL PASS`）；ECDICT 构建报告输入/产物哈希与 1,000 条数已验证 ✅；存储无禁止内容 ✅；扫描/批处理/DOM/布局基线已记录 ✅ | **automated AC：satisfied by fresh evidence** | **最接近可关闭项**。剩余 AC 是「把风险与 redistributio UNKNOWN 写进 dogfood 报告」这一文档交付物。**建议**：在单独授权步骤中补一份简短验收报告后关闭；本票不代劳。 |

**跨 Issue 共性结论**：#1–#5 没有一个代表「功能未实现」。它们全部是 2026-07-22 的旧纵向切片，其中「审计标记 / 高置信自动隐藏 / PAV·Beta 画像」部分已被 RULES 与后续 Grill/Spec 决议**永久冻结**。因此正确的收口动作是「改写 AC 或标记 superseded」，而不是「按原文重新实现」。

**未越权**：本票未调用任何 Issue 关闭、标签修改或评论写入。

---

## BRANCH_INVENTORY

`origin/main = 333c3628c5adabd1d69f96b9043eb7a109825eb0`。`CONTAINED_BY_MAIN` = 该分支 HEAD 已是 main 的祖先（零独有提交）。

| Branch | HEAD | ancestry | unique commits | 最后提交 | 建议 |
|---|---|---|---|---|---|
| `main` | `333c362` | — | — | 2026-08-11 | keep |
| `governance/restart-baseline-2026-09-04` | `77f8c30` | NOT_CONTAINED | 4（docs only） | 2026-09-04 | **keep（当前活跃治理分支）** |
| `review/dogfood-realignment-tickets` | `89a0c64` | NOT_CONTAINED | 10 | 2026-08-14 | **archive-candidate（有独有提交，勿删）** |
| `review/dogfood-product-realignment-spec` | `266af1b` | NOT_CONTAINED | 8 | 2026-08-14 | **archive-candidate** |
| `review/to-tickets-batch-validation` | `8169dfc` | NOT_CONTAINED | 5 | 2026-08-08 | **archive-candidate**（注意：其独有提交标题含 `issue 818 body`，与本项目无关，需人工确认来源后再处置） |
| `review/dogfood-realignment-grill` | `fd90d4e` | NOT_CONTAINED | 2 | 2026-08-11 | **archive-candidate** |
| `review/ticket-03-handoff-prompt` | `634eb2b` | NOT_CONTAINED | 2 | 2026-08-02 | delete-candidate（内容已并入 main 同主题提交） |
| `review/ticket-04-handoff-prompt` | `73e195c` | NOT_CONTAINED | 2 | 2026-08-03 | delete-candidate |
| `review/ticket-05-handoff-prompt` | `d75b164` | NOT_CONTAINED | 2 | 2026-08-03 | delete-candidate |
| `fix/e2e-readiness-main-frame` | `4e1691e` | CONTAINED_BY_MAIN | 0 | 2026-08-09 | delete-candidate |
| `hermes/v0.1-impl` | `2dd3f6e` | CONTAINED_BY_MAIN | 0 | 2026-07-25 | delete-candidate |
| `impl/query-hint-decoupling` | `247ef89` | CONTAINED_BY_MAIN | 0 | 2026-08-10 | delete-candidate（= 当前生产代码父提交） |
| `review/query-asset-recovery-runbook` | `333c362` | CONTAINED_BY_MAIN | 0 | 2026-08-11 | delete-candidate（与 main 同 SHA） |
| `review/architecture-coupling-investigation` | `b658be0` | CONTAINED_BY_MAIN | 0 | 2026-08-06 | delete-candidate |
| `review/rules-ux-enhancements` | `f90602a` | CONTAINED_BY_MAIN | 0 | 2026-08-05 | delete-candidate |
| `review/ticket-01-02-archive` | `de2893a` | CONTAINED_BY_MAIN | 0 | 2026-08-02 | delete-candidate |
| `review/ticket-01-remediation` | `0303836` | CONTAINED_BY_MAIN | 0 | 2026-08-01 | delete-candidate |
| `review/ticket-02-wordkey-evidence` | `6f5272b` | CONTAINED_BY_MAIN | 0 | 2026-08-02 | delete-candidate |
| `review/ticket-03-estimate` | `b15ddf3` | CONTAINED_BY_MAIN | 0 | 2026-08-03 | delete-candidate |
| `review/ticket-04-daily-round` | `0f402fc` | CONTAINED_BY_MAIN | 0 | 2026-08-03 | delete-candidate |
| `review/ticket-05-acceptance-gate` | `82ad118` | CONTAINED_BY_MAIN | 0 | 2026-08-04 | delete-candidate（报告已入 `outputs/`） |
| `review/ux-enhancements-implementation` | `73352ef` | CONTAINED_BY_MAIN | 0 | 2026-08-05 | delete-candidate |
| `review/ux-t1-t2-impl` | `011e069` | CONTAINED_BY_MAIN | 0 | 2026-08-06 | delete-candidate |
| `review/workflow-formatted-handoff` | `ce13903` | CONTAINED_BY_MAIN | 0 | 2026-08-02 | delete-candidate |
| `review/workflow-freshness-check` | `4f09ae9` | CONTAINED_BY_MAIN | 0 | 2026-08-01 | delete-candidate |
| `review/workflow-web-gpt-handoff` | `bcca224` | CONTAINED_BY_MAIN | 0 | 2026-08-01 | delete-candidate |

统计：远端 26 个分支（含 `main`）中 **19 个已完全被 main 包含**（零独有提交），**6 个含独有提交**（`governance/restart-baseline-2026-09-04` + 5 个 `review/*`）。

**未越权**：本票未删除任何远端分支。

**本地未提交状态提示**（不在 `origin/main`，仅本机 main worktree）：`/Users/songshiyao/Documents/wordplugin` 当前在 `implement/dogfood-realignment`（`89a0c64`，与 `review/dogfood-realignment-tickets` 同 SHA），含未提交改动 `e2e-verify.cjs`、`extension/src/content/annotator.ts`、`extension/src/content/annotator.test.ts`、`extension/src/content/spa.test.ts` 与未跟踪目录 `work/tickets/2026-08-14-v0.1-dogfood-realignment/handoffs/`。本票未读取其内容、未改动、未提交。

---

## 本地 ticket 复核（fresh evidence，不凭 commit message）

| 批次 / Ticket | 文件内 Status | fresh 判定 | 证据 |
|---|---|---|---|
| 2026-07-31 / 01 审计路径切断 | `done` | **implemented + verified** | E2E #2 `audit_markers=0`、`audit_entry_absent=true`、`residual_plan_ignored=true`；`#1B` `audit_cleared=true` |
| 2026-07-31 / 02 wordKey + Evidence + schema3 | `done` | **implemented + verified** | E2E #1 `form_merge=abilities→ability(wordKey)`；#1B schema2→v3 全项；#15 `schemaVersion=3` |
| 2026-07-31 / 03 估计展示 | `ready-for-agent`（**stale**） | **implemented + verified** | E2E #5 `point=500, range=324–676, no_extrapolation_declared=true, forbidden_text_absent=true`；#6 `estimate_unchanged=true` |
| 2026-07-31 / 04 每日校准轮 | `ready-for-agent`（**stale**） | **implemented + verified** | E2E #4 全项 + stage4 场景 7~13/17 全 PASS |
| 2026-07-31 / 05 真浏览器综合验收门 | `ready-for-agent`（**stale**） | **implemented + verified（本次重新跑通）** | `E2E ALL PASS`，§21 1~17 + 补全矩阵全通过 |
| 2026-07-31 / 06 人工 dogfood 门 | `ready-for-agent` | **still open（人工门，无自动化）** | 无任何 dogfood 记录；R-MIG-8 真实 profile 备份未执行 |
| 2026-08-05 / T-UX-1 tooltip 与选区加词 | `ready-for-agent`（**stale**） | **implemented + verified** | E2E UX1 `R-UX-T1~T4=true, R-UX-S1~S5=true` |
| 2026-08-05 / T-UX-2 popup 生词本页签 | `ready-for-agent`（**stale**） | **implemented + verified** | E2E UX2 `R-UX-N1~N5=true, unmappable_key_kept_hidden=true` |
| 2026-08-07 / T-QD-1 查询词典资产与身份 | 待授权（**stale**） | **implemented + verified** | query 资产 fresh 重建 121340 条；`E2E SELECTION` `query_outside_assessment=true`；`query_asset_load_ms` 有实测 |
| 2026-08-07 / T-INT-2 透明包装 + 事件委托 | 待授权（**stale**） | **implemented + verified** | E2E #3 `css_isolation` 四态继承父色；known/learning 还原为透明查询 span（#1 断言） |
| 2026-08-07 / T-UNR-3 lookup-unresolved 响应 | 待授权（**stale**） | **implemented + verified** | UX1 段：`未收录词 hover → "当前词典未收录"`、click 不弹菜单、零持久化写入、无 light/strong 样式 |
| 2026-08-07 / T-HINT-4 稀疏提示选择 | 待授权（**stale**） | **implemented + verified** | `E2E HINT PASS: T0=22662, n=40090, index=20045(upper-middle), light_per_100=4.55`；缺频率词 `hint-ineligible` 仍可查询 |
| 2026-08-07 / T-SEL-5 真实拖选竞态 | 待授权（**stale**） | **implemented + verified** | `E2E SELECTION PASS: mousedown>…>mouseup>click` 真实时间线 + `evidence_unchanged=true` |
| 2026-08-07 / T-NB-6 生词本与测评隔离 | 待授权（**stale**） | **implemented + verified** | E2E UX2：包外词 `serendipity` 进生词本且带音标/词性/释义，manual 不写 Evidence、估计不变 |
| 2026-08-07 / T-PERF-7 长文性能门 | 待授权（**stale**） | **implemented + verified（观测值已重新采集）** | perf_samples `totalScanMs=87/89.9/100.6`，`maxBatchMs=1.9/2.1`，`layoutShiftScore=0`，`wordsAnnotated=4159` |
| 2026-08-07 / T-PERF-7A CSS isolation 修复 | — | **implemented + verified** | E2E #3 `css_isolation` 四态 `color: rgb(0,0,0)` 与父色一致 |

**结论**：除 `06 人工 dogfood 门` 外，所有历史 ticket 都能在 fresh evidence 下判为 `implemented + verified`。**不得再把 query/hint wave 当作「未开发」重复实现**——这正是 RESUME-01 验收项「query/hint 旧 wave 不会因旧 DOCUMENT 描述被重复实现」的证据落点。

**未越权**：未修改任何历史 ticket 文件。

---

## STALE_DOCS

| 位置 | 过时内容 | fresh 事实 | 处置建议 |
|---|---|---|---|
| `docs/specs/2026-07-22-V0.1-1000词垂直切片实施规格.md:189` | 「扩展生产代码仍未开始」 | main 已有完整可构建、可 E2E 的扩展实现 | 保留为历史证据；已在 RULES 标注 superseded，无需改动内容，但**不得作为 current status** |
| `RULES.md`「查询、交互、主动提示与测评词包解耦」整节（逐条 `[已确认·尚未实现]`） | 多处仍写「尚未实现」，如「known 词被还原为纯文本且无交互载体」「tooltip 以左上角为锚点、`top=y-8`、只处理 bottom/right 溢出」「查询资格依赖包装」 | fresh E2E 显示：known/learning 已是**透明查询 span 且可查询**；tooltip 已实现上方优先 / 下方翻转 / 不侵入 sticky header / 不越视口 / 滚动后仍正确（R-TOOLTIP-3 全项）；未收录词有明确响应 | **最高优先级 stale doc**。RULES 是产品规则唯一来源，其「尚未实现」标签会直接导致未来 agent 重复实现。需单独授权做一次「按 fresh evidence 重标状态」的规则修订 |
| `docs/specs/2026-08-06-V0.1-查询交互提示与测评词包解耦规格.md:10/51/103/402` | 「已确认但尚未实现的高层产品方向」「当前 main 尚未实现完整目标」 | 同上，主要能力已被 main 实现并有 E2E 证据 | 同上：需把「未实现」清单按 fresh evidence 收缩为「剩余差距清单」 |
| `work/tickets/2026-07-31-v0.1-realign/03、04、05` | Status `ready-for-agent` | 已 implemented + verified | 见上表；本票不改文件 |
| `work/tickets/2026-08-05-v0.1-ux-enhancements/T-UX-1、T-UX-2` | Status `ready-for-agent` | 已 implemented + verified | 同上 |
| `work/tickets/2026-08-07-v0.1-query-hint-decoupling/*` | Status「待用户授权后进入开发 / 未标记 ready-for-agent」 | 已 implemented + verified | 同上；基线文档 §7.3 已声明该目录是历史 execution packet、不作实时 status board |
| `docs/adr/0003-词典优先的单词级-v0.1.md` | 正文写「约一万高频单词核心包」 | 现行口径为固定 1,000 词测评包 | 文件头已标 `superseded by ADR-0004`，可接受；建议补一句「词包规模口径亦以 RULES 为准」 |
| `outputs/2026-08-03-ticket05-acceptance-report.md` | 报告 T5 通过（Chrome 151） | 已被本次 fresh 复跑取代 | 保留为历史证据，标注「2026-09-09 已 fresh 复验」 |
| `work/perf/2026-08-09-query-hint-rebaseline/REPORT.md` | 性能观测值 | 本次 fresh 同量级 | 同上 |
| `CONTEXT.md` | 「轻提示 = 未知词的下划线与悬停查看」 | 现行规则下灰线只用于频率候选 | 需随 RULES 修订同步 |

---

## BLOCKERS

| # | 类别 | 内容 | 阻断级别 | 处置 |
|---|---|---|---|---|
| B1 | environment / reproducibility | E2E 在本执行环境必须 `AVR_E2E_NO_SANDBOX=1` 才能通过；默认模式以 `Requesting main frame too early!` 失败 | **P2 → 已在本票内缓解** | 已在 `README.md`「质量门禁」段补录 Chrome for Testing 安装步骤与 `AVR_E2E_NO_SANDBOX=1` 前置条件（docs-only，不改任何测试或断言）。残余风险：其他沙箱形态（容器/CI）仍需各自确认 |
| B2 | governance / stale authority | `RULES.md` 与 2026-08-06 已批准 Spec 的「尚未实现」状态标注已与 main 代码现实脱节（见 STALE_DOCS 第 2 行） | **P1（会诱发重复实现）** | 需单独授权做规则/规格状态重标；**不在 RESUME-01 范围内** |
| B3 | product gate（未完成，非缺陷） | `06 人工 dogfood 门`（连续 7 天 / ≥20 篇 / 三项人工数字）与 `R-MIG-8` 真实 profile 备份均未执行；V0.1 尚未取得用户人工验收 | **P1（阻塞任何「已验收」表述与扩容讨论）** | 由后续 phase 承接；RULES 明确：未明确接受不得讨论 10k 扩容 |
| B4 | license / release | ECDICT 中文释义逐条公开再分发权利链仍 `UNKNOWN`；`RESIDUAL_PUBLIC_OBJECT`（旧 SHA 仍可能可访问）为发布前阻断项 | **P1（仅阻塞发布，不阻塞本地 dogfood）** | 另行单独审计；本票未触碰 |
| B5 | authority drift（本地） | 本机 main worktree 停在 `implement/dogfood-realignment` 且有未提交改动与未跟踪 `handoffs/` 目录 | **P3（提示性）** | 由用户决定提交/丢弃；本票未读写其内容 |

**未触发的 stop condition**：`REMOTE_BASELINE_CHANGED` ❌、`RAW_SOURCE_HASH_MISMATCH` ❌、`LOCAL_ASSET_RECOVERY_UNDOCUMENTED` ❌、`QUALITY_GATE_PRODUCT_FAILURE` ❌、`AUTHORITY_CONFLICT_REQUIRES_PRODUCT_DECISION` ❌（B2 属「状态标注过时」而非「产品方向冲突」，方向本身已被 2026-08-07 决议覆盖，不需重新做产品决策）。

---

## NEXT_RECOMMENDED_PHASE

> 只推荐一个入口，不并行开启多个产品方向。

**推荐：`PHASE-SPEC-INT — 将 `UX_SPEC_V1.2.1` 纳入仓库权威的治理 / 规格集成步骤（文档阶段，不写实现代码、不拆实现 ticket）**

理由与边界：

1. RESUME-01 已完成「先建立 verified baseline」的唯一目标；所有门禁 fresh 全绿，baseline 不再是 UNKNOWN。
2. `UX_SPEC_V1.2.1` 是在当前仓库权威之外设计完成的新 UX 文档，属于**待集成的权威项**；在它进入 `docs/specs/` 并与 `RULES.md` / `CONTEXT.md` / `docs/CURRENT_IMPLEMENTATION_BASELINE.md` 对齐之前，任何基于它的实现 ticket 都没有合法来源。
3. 该阶段与 B2（RULES/spec 状态标注过时）天然同批：一次「规格集成 + 状态重标」的文档治理，可同时消解两者，且**不触碰生产代码**。
4. 该阶段产出后，才进入新一批 ticket 分解与审查。

**该阶段必须遵守的既有硬门**（不因本推荐而放松）：

- B3（人工 dogfood 门 + R-MIG-8 真实 profile 备份）仍是 RULES 定义的产品验收门。若 `UX_SPEC_V1.2.1` 集成后要拆**生产实现** ticket，必须先由用户裁定：先完成人工 dogfood，还是先按新 UX 规格实现。**本票不代为裁定。**
- B4（公开再分发权利链 UNKNOWN）在发布前必须单独审计。
- 不在本阶段关闭 Issue、不删除远端分支、不合并 main、不发布部署。

---

## 附：本次审计的完整命令序列（可复现）

```bash
# Phase 0
git fetch --all --prune && git rev-parse origin/main

# Phase 1
git worktree add .cache/restart-2026-09-04 governance/restart-baseline-2026-09-04
cd .cache/restart-2026-09-04 && NODE_OPTIONS= npm ci

# Phase 2
curl -fsSL -o data/raw/ecdict-bc015ed2.csv \
  https://raw.githubusercontent.com/skywind3000/ECDICT/bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b/ecdict.csv
shasum -a 256 data/raw/ecdict-bc015ed2.csv
python3 -B scripts/build_ecdict_core.py --input data/raw/ecdict-bc015ed2.csv \
  --output-dir data/derived/ecdict-core-1000 --limit 1000 --mode core \
  --source-ref bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b --source-date 2026-07-22
python3 -B scripts/build_ecdict_core.py --mode query --input data/raw/ecdict-bc015ed2.csv \
  --output-dir data/derived/ecdict-query \
  --source-ref bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b --source-date 2026-07-22
git status --porcelain          # 必须为空
git check-ignore -v data/raw/ecdict-bc015ed2.csv data/derived/ecdict-query/query-dictionary.json

# Phase 3
NODE_OPTIONS= npm run typecheck
NODE_OPTIONS= npm test
python3 -B -m unittest discover -s tests -p "test_*.py" -v
NODE_OPTIONS= npm run build
NODE_OPTIONS= npm run setup:e2e
AVR_E2E_NO_SANDBOX=1 NODE_OPTIONS= npm run test:e2e
```
