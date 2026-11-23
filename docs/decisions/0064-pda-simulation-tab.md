# 0064. The Simulasi tab of the PDA editor

Status: accepted

## Context

The PDA editor (T-051, T-057) had two tabs, Tabel and Definisi. P-005's sheet
(`design/screens/pda-simulation-conversion.md`, section 1, approved by the owner on 2026-11-23)
gives it the FSM's Simulasi tab plus the two things the FSM has no need for: the stack as a column
and the peak number of configurations. The engine already had `simulate_pda` (T-031), which returns
one computation (the state, the stack and the transition of every step), `peakConfigurations` and
`explored`.

The fixtures were measured against the real engine on 2026-11-23, before the work: `aabb` is
accepted with peak 1; `aab` is rejected with `pda.sim.stack_not_empty {depth: 1}`; `abb` is rejected
with `pda.sim.input_left {left: 1}`; `abba` is accepted with peak 3; `abab` is rejected with
`pda.sim.stack_not_empty {depth: 4}`; the ε-push loop is stopped at `max_stack` after 501 steps;
an unknown symbol comes back as `input.unknown_symbol {symbol: "c", position: 0}`, and a machine
with no start state as `pda.sim.no_start_state`.

## Decision

1. **Copy the FSM's panel, do not generalize it.** `PdaRunPanel.svelte`, `PdaStack.svelte`,
   `PdaTestList.svelte`, `pda-run.ts` and `pda-tester.ts` sit next to `RunPanel.svelte`,
   `TestList.svelte`, `run.ts` and `tester.ts`. Only `EngineNotice` and `SidePanel` are reused as
   they are. `PlayerControls` is the Konversi stepper (five buttons, `convert.*` keys), and
   `Announcer` takes the FSM editor's `Announcement`, so neither fits; the run's four buttons are
   copied, and T-071 (which unifies the schedulers) also owns the duplication.
2. **One computation, from the engine's trace.** The panel plays `trace` (or `partialTrace`); no
   tree is rebuilt. The step's `transition` needs no mapping: every valid `PdaDocument` keeps its
   transitions in the engine's order (`addTransition` inserts there with `comparePdaTransitions`,
   `parsePdaDocument` refuses an unsorted list, `fromEnginePda` sorts), so the index is the identity
   into `doc.transitions`. `toEnginePda` changes nothing about that order.
3. **The tabs and the head.** The panel's tabs are Simulasi, Tabel, Definisi, and Simulasi is the
   first (and the default of a first visit; a saved tab still wins). The kind switch, the
   determinism badge and the checks stay one copy in the page: the always-mounted Simulasi pane
   renders the head only while it is the open tab, so the other tab's pane has the only copy when it
   is open. The Simulasi pane is never unmounted, which is what keeps the field and the list alive
   across a tab switch.
4. **The run's timing.** A stopped run's neutral box, its peak and its explored count show as soon
   as the engine answers, while its partial computation is still stepped; an accepted or rejected
   run's verdict waits for the last step, as the FSM's does. The peak is always visible under the
   verdict (the course's homework asks for it), with the grey help line and `Dijelajahi`.
5. **The counter and the stack's text.** "Langkah n dari N" counts from 1 (n = the step index + 1,
   N = the trace length), and the computation rows are numbered from 1 the same way. The stack's
   text uses the document's own separator: `AA` for a one-character stack alphabet, `Z0 A` for a
   stack alphabet with a longer symbol (the same rule as the diagram's labels and the table).
6. **Rows are buttons.** A computation row jumps to its step; a test row runs its string in the
   panel above. The string field is owned by the editor (`PdaEditor`), so the row's run and the
   field show the same string.
7. **The list is not saved.** The PDA document (`schemaVersion: 1`) has no field for it and a schema
   change is out of scope. It lives for the session and survives a **tab** switch only: a mode
   switch unmounts the workstation, and a reload starts empty. A later task may add the field with a
   migration.
8. **`simulate_pda_many` is a Rust call** (one parse of the PDA and the budget, a loop over
   `simulate_pda`), because one WASM call per user action is the engine's rule and the FSM's
   `simulateMany` only avoids it by re-reading the machine for each string. A `refused` outcome has
   no `peak`: it never ran. `simulatePdaMany` gets its `WEB_BUDGETS` and `BUDGET_ARGUMENT` entries;
   the single `simulatePda` keeps the engine's defaults (10 000 steps, 20 000 configurations, 500
   stack).
9. **Reasons come from the engine.** A rejection shows the last step's `pda.sim.*` sentence
   (`input_left`, `stack_not_empty`, `not_accepting_state`), unchanged; a stop uses new keys
   (`pda_sim.stopped_max_steps`, `_max_configurations`, `_max_stack`, and `_other` for a reason that
   cannot come from a PDA today). A string that cannot be run maps `input.unknown_symbol` (the
   shared wording, position + 1) or `pda.sim.no_start_state`. The draft `pda_sim.reject.*` keys are
   not created. The new UI keys are in `pda-messages.ts`, so they travel with the PDA chunk.
10. **The used edge's stroke is the `from>to` group**, the FSM's API; a used transition between two
    states that have several transitions strokes them all. AC2 is tested on F-DPDA, where every edge
    has one transition. T-085 is proposed for the exact per-transition stroke.
11. **The tour's note is removed.** Steps 4 and 5 are true for the PDA now. The step 5 sentence
    "Semuanya tersimpan di perangkat ini" is **not** true for the PDA's list (decision 7); the
    planner has it as a proposed follow-up, and this task does not reword the shared step.

## Consequences

- The engine's `.wasm` grows from 242 582 B to 243 700 B gzip (+1 118 B; the budget is 250 KB, so
  12 300 B remain). The sandbox route's first JS goes from 125 073 B to 125 053 B gzip (−20 B: the
  removed tour note; the panel itself is in the lazy PDA chunk).
- The PDA mode gains the Simulasi tab and its keys only in the PDA chunk; the FSM's first JS and
  its tests are untouched.
- Six test cases that read the head on the default tab stay unedited (pda-panel E2 and E3 twice,
  pda-messages M2/M3, pda-first-run F2). Three are edited: pda-panel E1 is rewritten for three tabs
  and Simulasi as the default, and pda-messages M2/M3 click Tabel (or Table) first. The tour note's
  assertion in editor-bar-phone F4 is edited too.
- A student who had Tabel saved as the panel's tab still opens Tabel; Simulasi is the default only
  when nothing was saved.
- The FSM's panel and its tests are unchanged, because the copies carry their own types.

## Alternatives considered

- One generic run panel for the FSM and the PDA: rejected (it would touch every FSM test and the
  shared first JS for no student-visible gain; T-071 is the place for it).
- Saving the list in the PDA document now: rejected (a schema change and a migration belong to their
  own task).
- A per-string `simulatePda` call in the worker instead of a Rust `simulate_pda_many`: kept as the
  fallback if the size budget had failed; it did not (13 418 B of room before the work).
- The stopped verdict only at the last step, as the FSM has it: rejected (a 501-step partial trace
  at 700 ms a step would hide "Dihentikan" for about six minutes, and no e2e uses a fake clock).
- The head in the Simulasi pane and in the other tabs' panes at the same time: rejected (it doubles
  the badge, the live region and the checks in the page and made twenty-seven existing cases fail on
  strict locators).
- An exact per-transition stroke now: rejected for this task (T-085), because it needs a new prop in
  the shared drawing and the FSM does not ask for it.

## Reversible?

Yes: revert the pull request. Nothing stored changes (the list is not saved), and the engine
addition is additive.
