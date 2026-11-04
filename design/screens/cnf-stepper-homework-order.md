# CNF stepper: homework order and the "versi panjang / versi ringkas" toggle (P-002, proposal)

**Status:** proposed. The owner has not approved it. It becomes tasks T-060 and T-015 when approved and when the open questions below are answered.
**Picture:** `cnf-stepper-homework-order.svg`.
**Sources:** the course homework text for CNF (read by the owner on 2026-11-04: "report the grammar resulted after each conversion stage of removing: (1) unreachable rules, (2) non-productive rules, (3) epsilon-rules, (4) unit-rules, (5) mixed production rules, and (6) long-rhs rules"), and the engine as built (`crates/engine-core/src/grammar/cnf.rs`).

## Problem

A student who does the homework with WebTomata sees six phases that are not the six stages the homework asks for. As built, the order is: 1 start symbol, 2 ε-rules, 3 unit rules, 4 useless symbols (both kinds in one phase), 5 terminals in mixed rules, 6 long rules. The homework asks for unreachable and non-productive rules first, as two stages, and has no start-symbol stage. The intermediate grammars therefore differ from the ones the student must report (the final grammar is the same up to the names of helper variables).

Second problem: the phase titles and descriptions are Indonesian sentences written in the Rust engine (`phase_name`, `description`), so a student with the interface in English reads Indonesian. That breaks principle 6 of `CLAUDE.md`. The task rewrites those twelve texts anyway, so it moves them to message keys.

## Proposal

**Six phases, in the homework order.** The stepper keeps its shape (six round buttons, "Sebelumnya", the counter, "Selanjutnya", two groups of rule chips). Only the content changes:

| Fase | Title (id) | Title (en) | What it does |
| --- | --- | --- | --- |
| 1 | Hapus Aturan Tak Terjangkau | Remove Unreachable Rules | Removes variables that cannot be reached from the start symbol, and their rules. |
| 2 | Hapus Aturan Tak Produktif | Remove Non-Productive Rules | Removes variables that derive no terminal string, and every rule that uses them. |
| 3 | Hapus Aturan ε | Remove ε Rules | The nullable-variable method. |
| 4 | Hapus Aturan Unit | Remove Unit Rules | The unit-pair method. |
| 5 | Ganti Terminal pada Aturan Campuran | Replace Terminals in Mixed Rules | New variables `T_a → a` in rules of length 2 or more. |
| 6 | Pecah Aturan Panjang | Split Long Rules | Rules with 3 or more symbols become binary rules. |

The Indonesian words "tak terjangkau" and "tak produktif" are new terms: they go in `docs/glossary.md` with `TODO(review)`.

**The start symbol.** There is no stage for it. A new start symbol `S₀` is added in Fase 3, only when the empty string is in the language and `S` appears on the right side of a rule (that is the only case where `S₀ → ε` is needed to keep the grammar legal). In Fase 3 a note box says so. If it is not needed, the note is not shown and no `S₀` appears.

**The toggle.** A segmented control "Versi panjang | Versi ringkas" (en: "Long version | Short version") sits between the two output tabs and the six round buttons. "Versi panjang" is the default.
- *Versi panjang* (named by length, not by the course, so that a student outside the course understands it; the owner chose the name on 2026-11-05): the full method, one new `T_a → a` for every terminal that needs one, and every long rule gets its own chain of helper variables.
- *Versi ringkas:* reuse what exists: a terminal that already has a rule `A → a` uses `A` instead of a new `T_a`, and identical helper variables are shared between rules.
- Changing the toggle recomputes the six phases and keeps the phase the student is on. The choice is kept on the device (not in the share link).
- On a phone the control is as wide as the column and 44 px tall; each half is a button. It is a `role="radiogroup"` with two `role="radio"` buttons.

## Open questions for the owner

1. **Order of the first two stages.** The homework lists "unreachable" before "non-productive". The usual textbook order is the reverse (removing non-productive variables can make others unreachable). Planner's pick: follow the homework order, and let Fase 2 also remove the variables that its own removal made unreachable (it says so in the trace). Does the course's answer key do this, or does it leave them?
2. **The new start symbol.** Planner's pick: only in Fase 3 and only when needed (above). Does the course add `S₀` always, never, or only in this case? Which stage shows it?
3. **Toggle place.** Planner's pick: in the stepper header, as drawn. The alternative is a setting in the panel header.

## What the tasks will need to prove

- Every phase result is checked against a hand derivation from the course method (the planner redoes it in review).
- The engine returns message keys for phase names and descriptions; `en` and `id` both exist; no Indonesian sentence is left in the CNF code.
- The toggle changes the grammar as described and keeps the phase number.
- The T-010 flow spec is updated with a new hand derivation for the new order.
