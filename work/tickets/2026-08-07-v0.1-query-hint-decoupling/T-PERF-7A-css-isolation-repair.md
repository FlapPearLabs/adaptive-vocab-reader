# T-PERF-7A — CSS Isolation Repair

**Authority**: `RULES.md`, approved query/hint Spec, T-INT-2, T-PERF-7.

**Trigger**: T-PERF-7 real Chrome fixture proved that host `article span { border-bottom: 3px solid }` added a visible border to injected transparent word wrappers.

**Goal**: minimally protect extension-owned wrapper neutrality and hint UI without changing the transparent-span/event-delegation route or inherited page typography.

**Allowed production scope**: `extension/src/content/annotator.ts` owned injected CSS only.

**Forbidden**: broad resets, Shadow DOM route, identity/hint/state/schema changes, new UI, performance redesign, dependencies, remote CSS tooling.

**Root cause**: `OTHER` — host border applied to `.avr-word`; light hints used `text-decoration` but the wrapper had no owned `border` reset. This is not a specificity or source-order override. The host declaration is not `!important`.

**Minimal repair**: scoped `.avr-word` declares `border:0`, transparent background, and neutral text decoration. State-specific `.avr-light`/`.avr-strong` keep their existing approved decorations; font, size, line-height, letter spacing, and color continue to inherit.

**Acceptance**:

1. Host generic span pressure cannot add a wrapper border/background/decoration.
2. Light and strong presentations remain correct; known stays neutral and queryable.
3. Tooltip, action menu, selection, hover, click, layout, height, and CLS retain existing behavior.
4. Normal-page regression and full real Chrome E2E pass.
