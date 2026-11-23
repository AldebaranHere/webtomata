# ADR 0066: "Ke PDA" tab in the grammar mode (CFG to PDA)

- **Status:** Accepted (2026-11-23, task T-038c)
- **Context:** Students working with a context-free grammar in `GrammarWorkstation` need to convert it to an equivalent non-deterministic pushdown automaton using the two textbook methods from Slide13 (`CFGtoPDAtopdown` and `CFGtoPDAbottomup`), step through the generated transitions, and open the result in the PDA editor without modifying the original grammar. The Rust engine and WASM bridge already expose `cfgToPdaTopdown(grammar)` and `cfgToPdaBottomup(grammar)` (T-034, T-035). T-038b (PDA → CFG) runs in parallel and needs the opposite cross-mode handoff.

## Decision

1. **Cross-mode handoff seam (`sandbox/+page.svelte`, `GrammarWorkstation.svelte`, `PdaWorkstation.svelte`).** Both directions go through `sandbox/+page.svelte` (which owns `activeMode`). `GrammarToPdaTab` saves the converted `PdaDocument` via `createPdaMachine(library.store, doc)` and invokes `onopenpda(record.id)`, which calls the page's existing `openPdaRow(id)`. Symmetrically, `sandbox/+page.svelte` holds `grammarOpenRequest: { title, text, seq } | null`, passes `onopengrammar={openGrammar}` to `PdaWorkstation`, and passes `openRequest={grammarOpenRequest}` to `GrammarWorkstation`, whose pure receiver `receiveGrammarRequest` creates and selects a new custom grammar (T-023 pattern).
2. **Copy-not-generalize (`GrammarToPdaTab.svelte` and `grammar-to-pda.ts`).** The tab copies the stepper layout of `GrammarCnfStepper.svelte` into its own component and pure model without altering CNF or CYK code. It uses `transitionLabel` from `web/src/lib/editor/diagram/pda-diagram.ts` (slash form `read / pop / push`) so step rows match the PDA diagram exactly.
3. **Explicit engine trigger ("Buat PDA").** Because `GrammarWorkstation` keeps column-3 panes mounted with `hidden`, conversion never runs automatically on keystrokes or while hidden. The user clicks **Buat PDA** to run the chosen method once; switching method radios while a result exists re-runs once and restarts at step 1; any edit to the grammar immediately clears stale results and returns to the **Buat PDA** button.
4. **Layout (`cfgPdaLayout`) and title clamping.** Both methods emit two states (`p`, `q`) with no coordinates. `cfgPdaLayout` places states in ascending `id` order on one row at `(200 + i * 420, 220)` (420 units apart, ≥ 410 so PDA labels and self-loops stay readable). `buildConvertedPdaTitle` clamps the grammar base title by Unicode code points so `"<name> (PDA atas-bawah)"` / `"(PDA bawah-atas)"` fits within `LIMITS.titleChars` (100).
5. **Bottom-up ε-rule warning.** When `method === 'bottomup'` and the parsed grammar has an ε-production (`body.length === 0`), a muted note explains that the bottom-up PDA can loop on non-language strings and stop at the simulation budget.
6. **Lazy dictionary (ADR 0050) and 5-tab phone strip.** All new UI strings live in `web/src/lib/i18n/grammar-to-pda-messages.ts` (registered via `addMessages`, imported only by `GrammarWorkstation.svelte`), adding 0 bytes to first-load JS on every route. Adding `Ke PDA` makes 5 items in the grammar phone strip, so `WorkstationPhoneTabs.svelte` reduces button horizontal padding from `--space-3` to `--space-2` with `white-space: nowrap` so all 5 tabs fit on one row at 360 px with ≥ 44×44 px targets.

## Consequences

- First-load JS on every route is unchanged (0 B growth from the new dictionary and tab).
- `crates/` and the `.wasm` binary are untouched.
- `cfgPdaLayout` is intentionally separate from T-038b's `rnfLayout` so the two parallel tasks have no shared layout dependency; unifying engine-PDA layouts can be considered alongside T-071.
