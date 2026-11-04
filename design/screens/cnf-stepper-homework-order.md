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

**The start symbol.** There is no stage for it. As the course slides do ("returning ε", slide CFG2): after the ε-rules are removed, **if the start symbol `S` is nullable**, a new start symbol `S₀` is added with the rules `S₀ → S | ε`. That is Fase 3, and a note box says so. If `S` is not nullable, the note is not shown and no `S₀` appears. (The engine today adds `S₀` as a phase of its own whenever `S` is on a right-hand side; that goes away.)

**The toggle.** A segmented control "Versi panjang | Versi ringkas" (en: "Long version | Short version") sits between the two output tabs and the six round buttons. "Versi panjang" is the default.
- *Versi panjang* (named by length, not by the course, so that a student outside the course understands it; the owner chose the name on 2026-11-05): the full method, one new `T_a → a` for every terminal that needs one, and every long rule gets its own chain of helper variables.
- *Versi ringkas:* reuse what exists: a terminal that already has a rule `A → a` uses `A` instead of a new `T_a`, and identical helper variables are shared between rules.
- Changing the toggle recomputes the six phases and keeps the phase the student is on. The choice is kept on the device (not in the share link).
- On a phone the control is as wide as the column and 44 px tall; each half is a button. It is a `role="radiogroup"` with two `role="radio"` buttons.

## Questions, and how they were settled (2026-11-05, from the course files)

The owner asked the planner to find the answers in the course files. No answer key for the homework is in `REFERENCES/`, so these come from the slides and the homework text (the planner read the PDFs with a PDF reader).

1. **Order of the first two stages.** The homework text lists "unreachable" before "non-productive". The slides (CFG1) present the algorithm for non-productive rules first, then unreachable, which is also the textbook order. The planner checked the four grammars of the 2026 homework (HW05) by hand: in none of them does the order change any intermediate grammar (removing the non-productive variables makes nothing new unreachable). Decision: follow the homework order (it is what the student must report), and let Fase 2 also remove the variables that its own removal made unreachable, saying so in the trace, so a grammar where the order matters still ends up clean. The owner can veto it.
2. **The new start symbol.** The slides (CFG2, "returning ε") say: if the start symbol is nullable, add a new start symbol `S₀` with `S₀ → S | ε`, after the ε-rules are removed. Decision: exactly that, in Fase 3, whether or not `S` appears on a right-hand side. This replaces the planner's earlier pick (only when `S` is also on a right-hand side).
3. **Toggle place.** Planner's pick: in the stepper header, as drawn. The alternative is a setting in the panel header. The owner approves by merging.

Also seen in the slides, not changed here: the course names the helper variables `Tₐ` for terminals and `M₁, M₂, …` for long rules, and notes that "Tₐ can take A instead" when a rule `A → a` exists, which is the "versi ringkas" idea. The engine names the long-rule helpers `X`, `X_1`; this is left as it is.

## What the tasks will need to prove

- Every phase result is checked against a hand derivation from the course method (the planner redoes it in review).
- The engine returns message keys for phase names and descriptions; `en` and `id` both exist; no Indonesian sentence is left in the CNF code.
- The toggle changes the grammar as described and keeps the phase number.
- The T-010 flow spec is updated with a new hand derivation for the new order.
