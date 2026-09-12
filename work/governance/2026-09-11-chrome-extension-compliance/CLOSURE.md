# CHROME_SPECIALIST_GATE_CLOSURE

## BASE_REVIEW_HEAD
`38e20c6248f172d667239f94e1365a62ac732463`

## CLOSURE_HEAD
`38e20c6248f172d667239f94e1365a62ac732463` (pre-commit base)

---

## 1. Skill and Authority Evidence

```text
CHROME_EXTENSION_SPECIALIST_SKILL = UNAVAILABLE
CHROME_DEVTOOLS_SKILL = chrome-devtools-mcp:chrome-devtools
OFFICIAL_CHROME_DOCS = USED
```

- **Specialist Skill Check:** Verified that no specialized `chrome-extension` skill exists in local or plugin skill directories.
- **Chrome DevTools Skill:** Successfully loaded and inspected `chrome-devtools-mcp:chrome-devtools` (`C:\Users\ssy\.zcode\cli\plugins\cache\claude-plugins-official\chrome-devtools-mcp\1.8.0\skills\chrome-devtools\SKILL.md`).
- **Official Documentation:** Consulted Google Chrome Extensions official documentation for Manifest V3, Web Accessible Resources security model, Match Patterns, and Chrome Web Store Program Policies.

---

## 2. DevTools MCP Extension Tool Inventory and Environment Gate

```text
CHROME_DEVTOOLS_MCP_VERSION = 1.9.0
CATEGORY_EXTENSIONS_ENABLED = true
FILESYSTEM_ROOT = D:\Dev\wordplugin\avr-compliance
INSTALL_EXTENSION_TOOL = mcp__chrome-devtools__install_extension
LIST_EXTENSIONS_TOOL = mcp__chrome-devtools__list_extensions
RELOAD_EXTENSION_TOOL = mcp__chrome-devtools__reload_extension
TRIGGER_EXTENSION_ACTION_TOOL = mcp__chrome-devtools__trigger_extension_action
UNINSTALL_EXTENSION_TOOL = mcp__chrome-devtools__uninstall_extension
DEVTOOLS_MCP_EXTENSION_TOOLS = AVAILABLE
```

### Environment Verification Receipt
- Chrome DevTools MCP single server configuration `chrome-devtools-mcp@1.9.0` with `--categoryExtensions --filesystemRoot D:\Dev\wordplugin\avr-compliance` successfully initialized and injected all 5 lifecycle tools into the active session.
- No duplicate plugin registration; no `--allowUnrestrictedPaths` broad bypass used.
- Tool availability confirmed: `DEVTOOLS_MCP_EXTENSION_TOOLS = AVAILABLE`.

---

## 3. Chrome Session and Extension Lifecycle Receipt

```text
ISOLATED_CHROME_SESSION = LIVE_MCP_SESSION
DIST_PATH = D:\Dev\wordplugin\avr-compliance\dist

EXTENSION_INSTALL = SUCCESS
EXTENSION_ID = ldcpjkgahdhbjlkghaikdbmalmbfgdba
EXTENSION_NAME = 词汇阅读助手
EXTENSION_VERSION = 0.1.0
EXTENSION_ENABLED = true

EXTENSION_ACTION = SUCCESS (Popup opened at chrome-extension://ldcpjkgahdhbjlkghaikdbmalmbfgdba/popup.html)
EXTENSION_RELOAD = SUCCESS (Service worker sw-1 detached, sw-2 created)
EXTENSION_UNINSTALL = SUCCESS (mcp__chrome-devtools__uninstall_extension confirmed via list_extensions: 0 installed)
DEVTOOLS_MCP_EXTENSION_TOOLS_USED = YES (install_extension, list_extensions, trigger_extension_action, reload_extension, uninstall_extension)
```

---

## 4. Main-Frame vs. Iframe Runtime Analysis

```text
TOP_FRAME_RUNTIME = PASS
SAME_ORIGIN_IFRAME_RUNTIME = PASS
CROSS_ORIGIN_IFRAME_RUNTIME = PASS
ALL_FRAMES_VERDICT = SHOULD_BE_MAIN_FRAME_ONLY
```

### Empirical Runtime Evidence:
1. **TOP_FRAME (`https://localhost:18930/`):**
   - `CONTENT_SCRIPT_LOADED = YES`
   - `ANNOTATION_PRESENT = YES` (23 words annotated with `.avr-word`)
   - `DUPLICATE_PROCESSING = NO` (each word annotated once)
   - `EXTENSION_ERRORS = NO` (0 errors)
   - `LAYOUT_INTERFERENCE = NO` (span wrappers preserve inline layout)
   - `PRODUCT_VALUE = HIGH` (annotates the user's primary reading article)

2. **SAME_ORIGIN_IFRAME (`https://localhost:18930/same-origin-frame.html`):**
   - `CONTENT_SCRIPT_LOADED = YES`
   - `ANNOTATION_PRESENT = YES` (14 words annotated)
   - `DUPLICATE_PROCESSING = NO`
   - `EXTENSION_ERRORS = NO` (0 errors)
   - `LAYOUT_INTERFERENCE = NO`
   - `PRODUCT_VALUE = MODERATE` (helpful when an article is embedded in an iframe, but redundant for embedded UI widgets)

3. **CROSS_ORIGIN_IFRAME (`https://localhost:18931/cross-origin-frame.html`):**
   - `CONTENT_SCRIPT_LOADED = YES`
   - `ANNOTATION_PRESENT = YES` (13 words annotated)
   - `DUPLICATE_PROCESSING = NO`
   - `EXTENSION_ERRORS = NO` (0 errors)
   - `LAYOUT_INTERFERENCE = NO`
   - `PRODUCT_VALUE = LOW` (annotating cross-origin third-party ads, tracking frames, and payment widgets consumes CPU and memory without delivering user reading value)

### Verdict: `ALL_FRAMES_VERDICT = SHOULD_BE_MAIN_FRAME_ONLY`
- **Recommendation:** Restrict `content_scripts` to `all_frames: false` in `manifest.json`. Injecting into every third-party iframe creates redundant query dictionary loads (`query-dictionary.json` was fetched 3 separate times across the frames) and expands the attack surface without user benefit.

---

## 5. Web Accessible Resources Closure Matrix

Current manifest declaration:
```json
"web_accessible_resources": [
  {
    "resources": [
      "data/dict-core.json",
      "data/forms.json",
      "data/frequency-bands.json",
      "data/query-dictionary.json",
      "data/query-forms.json"
    ],
    "matches": [
      "https://*/*",
      "https://localhost/*"
    ]
  }
]
```

| Resource | Consumer Context | Content Script Can Load Without WAR | Popup Can Load Without WAR | Service Worker Can Load Without WAR | Host Page Can Load | WAR Required For Current Runtime | Narrower Safe Configuration |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `data/dict-core.json` | Popup only | N/A (never loaded by content script) | YES (HTTP 200 via extension origin) | YES (HTTP 200 via extension origin) | YES (due to WAR matches) | NO | REMOVE_FROM_WAR |
| `data/forms.json` | Popup & Worker | N/A (never loaded by content script) | YES (HTTP 200 via extension origin) | YES (HTTP 200 via extension origin) | YES (due to WAR matches) | NO | REMOVE_FROM_WAR |
| `data/frequency-bands.json` | Popup & Worker | N/A (never loaded by content script) | YES (HTTP 200 via extension origin) | YES (HTTP 200 via extension origin) | YES (due to WAR matches) | NO | REMOVE_FROM_WAR |
| `data/query-dictionary.json` | Content Script | NO (fetch via chrome.runtime.getURL requires WAR in MV3) | YES | YES | YES (due to WAR matches) | YES (with current fetch pattern) | `use_dynamic_url` or worker message passing |
| `data/query-forms.json` | Content Script | NO (fetch via chrome.runtime.getURL requires WAR in MV3) | YES | YES | YES (due to WAR matches) | YES (with current fetch pattern) | `use_dynamic_url` or worker message passing |

```text
WEB_ACCESSIBLE_RESOURCES_VERDICT = NARROWING_REQUIRED
```

### Analysis & Recommendations:
- `dict-core.json`, `forms.json`, and `frequency-bands.json` are NEVER consumed by content scripts or web pages. They are only consumed by `popup.ts` and `worker.ts`, which run in the privileged extension origin and do NOT need `web_accessible_resources`.
- Exposing them allows any web page matching `https://*/*` to fetch the entire ECDICT database and fingerprint the extension.
- Finding classified as **P3**. In accordance with the governance rule "no manifest change from static inference alone", this is documented for the next planned manifest refinement ticket.

---

## 6. Runtime Console and Network Egress Audit

```text
CONTENT_SCRIPT_CONSOLE = CLEAN (0 extension errors, 0 unhandled rejections)
POPUP_CONSOLE = CLEAN (0 extension errors, 0 unhandled rejections)
SERVICE_WORKER_CONSOLE = CLEAN (0 extension errors, 0 unhandled rejections)
PAGE_CONSOLE = CLEAN (0 extension errors, 0 host errors caused by extension)
CSP_VIOLATIONS = 0
FAILED_EXTENSION_RESOURCE_LOADS = 0
REMOTE_EXECUTABLE_CODE_REQUESTS = 0
UNEXPECTED_NETWORK_EGRESS = 0
READS_PAGE_CONTENT_LOCALLY = YES
TRANSMITS_PAGE_CONTENT = NO
```

- **Zero Egress:** Live DevTools network tracing confirmed zero outbound HTTP/HTTPS requests to external hosts.
- **Local-Only Processing:** Text scanning and dictionary lookups operate purely inside browser memory.

---

## 7. Service Worker Lifecycle and State Persistence

```text
SERVICE_WORKER_RESTART = PASS
STATE_REHYDRATION = PASS
```

- **Empirical Evidence:**
  1. Service worker was active (`sw-1`).
  2. Representative state in `chrome.storage.local` verified (23 vocabulary records, `schemaVersion: 3`, `stateVersion: 1`, `dictVersion: 1`).
  3. `reload_extension` executed via MCP.
  4. Service worker recreated (`sw-2` registered and active).
  5. State rehydration verified: `chrome.storage.local.get(null)` in `sw-2` confirmed identical state intact.
  6. Functional re-verification: Top frame page reload triggered content script and annotated 23 words without error.

---

## 8. Fresh Regression Test Gate Evidence

Conducted fresh on `avr-compliance` (working tree cleanly verified):

1. **`npm run typecheck`**
   - **Command:** `tsc --noEmit`
   - **Exit Code:** 0
   - **Result:** PASS (0 type errors)

2. **`npm test`**
   - **Command:** `vitest run`
   - **Exit Code:** 0
   - **Result:** PASS
   - **Test Files:** 19 passed (19 total)
   - **Tests:** 327 passed (327 total)
   - **Duration:** 4.67s

3. **`python -B -m unittest discover -s tests -p "test_*.py"`**
   - **Command:** `python -B -m unittest discover -s tests -p "test_*.py"`
   - **Exit Code:** 0
   - **Result:** PASS (12 tests passed in 0.333s, OK)

4. **`npm run build`**
   - **Command:** `node build.mjs`
   - **Exit Code:** 0
   - **Result:** PASS
   - **Output:** `D:\Dev\wordplugin\avr-compliance\dist`

5. **`AVR_E2E_NO_SANDBOX=1 npm run test:e2e`**
   - **Command:** `AVR_E2E_NO_SANDBOX=1 CHROME_FOR_TESTING="D:\Dev\wordplugin\adaptive-vocab-reader\.cache\puppeteer\chrome\win64-153.0.8010.36\chrome-win64\chrome.exe" npm run test:e2e`
   - **Port Lock:** `18923` verified clean
   - **Exit Code:** 0
   - **Result:** E2E ALL PASS (T5 综合验收)
   - **Coverage:** All 17 acceptance scenarios (§21-1 to §21-17) + §21 persistence completion verified (18 / 18 matrix items PASS).

---

## 9. Findings Classification

```text
P0 = 0
P1 = 0
P2 = 0
P3 = 2
```

- **P3-1 (Web Accessible Resources Scope):** `web_accessible_resources` exposes `dict-core.json`, `forms.json`, and `frequency-bands.json` unnecessarily to web pages. Content script only requires query files. Narrowing recommended.
- **P3-2 (Content Script Frame Scope):** `all_frames: true` runs content scripts in cross-origin embedded frames (e.g., ads, payment iframes) where reading value is minimal and duplicate dictionary fetching occurs. `all_frames: false` recommended.

No P0/P1/P2 regressions detected. No unauthorized source edits made.

---

## 10. Final Gate Verdicts

```text
CHROME_SPECIALIST_GATE_CLOSURE

BASE_REVIEW_HEAD = 38e20c6248f172d667239f94e1365a62ac732463

USER_DATA_RUNTIME_PRIVACY = PASS
CHROME_RUNTIME_COMPLIANCE = PASS
CHROME_WEB_STORE_POLICY_COMPLIANCE = NEEDS_PUBLICATION_ARTIFACTS
PUBLICATION_READINESS = NOT_READY
READY_FOR_HUMAN_DOGFOOD = YES
```

### Verdict Definitions & Rationale:
1. **`USER_DATA_RUNTIME_PRIVACY = PASS`**: Fully verified that all user data and scanned page content remain local. Zero network egress.
2. **`CHROME_RUNTIME_COMPLIANCE = PASS`**: Fully proven with live Chrome DevTools MCP extension lifecycle tools (`install_extension`, `list_extensions`, `trigger_extension_action`, `reload_extension`, `uninstall_extension`), runtime DevTools console inspection, network request inspection, and service worker restart/rehydration verification.
3. **`CHROME_WEB_STORE_POLICY_COMPLIANCE = NEEDS_PUBLICATION_ARTIFACTS`**: Extension technical structure complies with MV3, but store-facing assets (single purpose justification, privacy policy document, data disclosure declaration) remain to be authored.
4. **`PUBLICATION_READINESS = NOT_READY`**: Blocked by independent unresolved licensing issue: `ECDICT Chinese-definition public redistribution rights = UNRESOLVED`.
5. **`READY_FOR_HUMAN_DOGFOOD = YES`**: All technical gates, full regression suites, and Chrome Specialist Runtime verification are completely satisfied. The project is ready for the mandatory R-MIG-8 user profile backup gate prior to starting Ticket 06 7-day human dogfood.
