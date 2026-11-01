# Decision log

Append-only. Newest at the top. One entry per decision. If a decision is reversed, add a new entry that supersedes the old one; do not edit the old one.

Format:

## YYYY-MM-DD — <short title>
- Decider: planner | worker
- Context: one sentence
- Decision: one sentence
- Alternatives considered: one line
- Reversible? yes | no
- Affects: files, modules, or plans

---

## 2026-11-01 — Self-healing dpkg repair and bounded retry in browser dependency installation
- Decider: worker
- Context: Installing 181 WebKit system libraries on Ubuntu CI timed out at 75s mid-unpack, causing subsequent retries to fail with unconfigured dpkg errors.
- Decision: Introduce `repair_dpkg` (`pkill -9`, `fuser` lock wait, `dpkg --configure -a`) on every retry, set `DPkg::Lock::Timeout=120`, and increase attempt timeout to 300s.
- Alternatives considered: Rely on external GitHub Action cache or force-clean dpkg cache without configure.
- Reversible? yes
- Affects: `tools/install-browser-deps.sh`, `tools/install-browser-deps.test.mjs`, `.github/workflows/ci.yml`

## 2026-11-01 — Pass-through pointer events on inactive panel drag handle and mobile canvas z-index stacking
- Decider: worker
- Context: Mobile E2E test timed out because the panel drag bar overlay intercepted pointer clicks over the canvas confirmation button.
- Decision: Set `pointer-events: none` on `.bar` and `.name` during resting state (reactivating on `:active` and `.dragging`), set canvas `z-index: 2` over mobile panel `z-index: 1`, and clamp label bounding box within viewport.
- Alternatives considered: Use `{ force: true }` in Playwright click or move the drag bar into normal block layout flow.
- Reversible? yes
- Affects: `web/src/lib/editor/SidePanel.svelte`, `web/src/lib/editor/Editor.svelte`, `web/src/lib/editor/LabelField.svelte`

## 2026-11-01 — Reuse intermediate non-terminal variables for identical RHS pairs in CNF binarization
- Decider: worker
- Context: Step 6 of CNF conversion ("Remove Long RHS Rules") created duplicate non-terminals (e.g. `X1 -> AB`, `X2 -> AB`) for the same variable pair across different rules.
- Decision: Maintain a lookup map `(String, String) -> String` to reuse existing generated non-terminals for identical right-hand side pairs.
- Alternatives considered: Generate distinct non-terminals per production or post-process duplicate variables via equivalence reduction.
- Reversible? yes
- Affects: `crates/engine-core/src/grammar/cnf.rs`

## 2026-11-01 — Contextual per-row symbol toolbar and blur-based empty cell pruning in CFG editor
- Decider: worker
- Context: Users struggled with inserting special characters into individual rule cells and empty input cells caused unintentional empty string assignments.
- Decision: Replace the static global "Sisipkan" bar with a contextual toolbar anchored to the active editing row, require explicit ε insertion, and auto-prune empty cells and rows on blur.
- Alternatives considered: Retain static top bar or treat empty input cells as ε by default.
- Reversible? yes
- Affects: `web/src/lib/grammar/GrammarWorkstation.svelte`, `web/src/lib/grammar/RuleAlternativeCell.svelte`

## 2026-11-01 — Categorized dropdown popover for workstation switcher in site header
- Decider: worker
- Context: Adding CFG/CNF and language enumeration workstations crowded the top navigation bar with horizontal links.
- Decision: Consolidate workstation selection into a categorized popover dropdown menu (`WorkstationSwitcher.svelte`) with 44px touch targets.
- Alternatives considered: Horizontal scrolling tab bar or multi-line header navigation.
- Reversible? yes
- Affects: `web/src/lib/components/SiteHeader.svelte`, `web/src/lib/components/WorkstationSwitcher.svelte`
