# Handoff — 2026-11-01

> Written by the previous worker before handing control back to the planner.
> Keep this under one page. Put evidence in `HANDOFF-SNAPSHOT/`; do not paraphrase what the snapshot already says.

## Session window
- Branch at freeze: `handoff/2026-11-01`
- Freeze tag: `handoff-2026-11-01`
- HEAD: `67f0add8e719b854e5c203412fae17d5aa73b5d0`
- Baseline: `3e265630ed1f4bdefb21f8298cd1f68cab701e5c`

## What was built
- **CFG/CNF workstation UX polish**: discrete alternative RHS chips (`RuleAlternativeCell.svelte`), contextual active-row symbol toolbar, automatic pruning of empty cells and rows on blur, and explicit ε insertion.
- **CNF binarization variable pair deduplication**: implemented pair cache `(String, String) -> String` in `crates/engine-core/src/grammar/cnf.rs` to reuse generated non-terminals across rules during Step 6 ("Remove Long RHS Rules").
- **Mobile canvas pointer event layering fix**: pass-through pointer events (`pointer-events: none`) on resting panel drag handles, canvas `z-index: 2` over mobile panel `z-index: 1`, and viewport boundary clamping for `LabelField.svelte`.
- **Self-healing browser library CI install**: added `repair_dpkg` (`pkill -9`, `fuser` wait, `dpkg --configure -a`) before retries, configured `-o DPkg::Lock::Timeout=120`, and increased attempt timeout to 300s in `tools/install-browser-deps.sh`.
- **Workstation switcher popover**: replaced overcrowded top navigation links with a categorized dropdown menu (`WorkstationSwitcher.svelte`).

## What works end to end
- **Self-healing apt/dpkg retry**: logic added to `tools/install-browser-deps.sh`; covered by `tools/install-browser-deps.test.mjs` (7 tests; skipped on Windows, run on Linux CI; see `HANDOFF-SNAPSHOT/05-verify.md` under `## Node tests (tools/)`).
- **CNF variable deduplication**: verified by `cargo test -p engine-core` in `HANDOFF-SNAPSHOT/05-verify.md` under `## Rust engine tests` (all 20 test suites report 0 failed; identical pairs reuse existing variable symbols).
- **CFG grammar workstation & editor interactions**: proven by unit tests in `HANDOFF-SNAPSHOT/05-verify.md` under `## Unit tests` (87 test files, 1,117 tests passed).
- **Guard rails & design tokens**: proven by `HANDOFF-SNAPSHOT/05-verify.md` under `## Workflow guard rails`, `## Contrast guard rails`, `## Token usage`, and `## Strings` (all passed).
- **Mobile canvas label click over panel handle**: layout and event fix in `LabelField.svelte`, `SidePanel.svelte`, and `Editor.svelte` verified during task execution; component integrity covered by `## Svelte check` and `## Unit tests`.

## What is broken or half-done
- Root `pnpm --filter web typecheck` fails because `typecheck` is only defined in `web/package.json`, whereas `pnpm check` (which runs `svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings`) passes cleanly with 0 errors and 0 warnings (see `HANDOFF-SNAPSHOT/05-verify.md` under `## Svelte check`).
- End-to-end Playwright tests for the CFG/CNF workstation workflows (`e2e/grammar-*.spec.ts`) are not yet authored.

## Known risks
- WebKit system library installation pulls 181 apt packages on Ubuntu runners; while `install-browser-deps.sh` self-heals, cold runs still require 90–120 seconds.
- Deeply nested or cyclical CFG rules may generate large step sequences in full CNF transformation visualizers.

## Open questions for the planner
- Should the next milestone prioritize CYK parse table generation and step visualizer trees in the CFG workstation, or authoring E2E test coverage for existing grammar features?
- Should `package.json` define a top-level `typecheck` script aliasing `pnpm --filter web check` to maintain uniform command ergonomics across agents?

## Where the evidence is
- `HANDOFF-SNAPSHOT/01-git.md` — branches, commits, diffstat
- `HANDOFF-SNAPSHOT/05-verify.md` — real output of format, svelte check, lint, unit tests, node tools tests, guard rails, rust engine tests, build
- `HANDOFF-SNAPSHOT/06-diff.md` — full diff since baseline
- `DECISIONS.md` — every decision made during the session

## Anything the planner should NOT re-litigate
- The `repair_dpkg` self-healing retry logic in `install-browser-deps.sh`: it addresses a verified root-cause interruption and was proven under real Linux simulation.
- Explicit ε insertion over empty-cell inference in the CFG editor: empty cells automatically defaulting to ε led to accidental silent epsilon production insertions.
- Mobile canvas overlay stacking (`z-index: 2` over panel `z-index: 1`): prevents touch/pointer event masking on small mobile viewports.
