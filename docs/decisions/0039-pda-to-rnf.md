# 0039. Pushdown automaton (PDA) to restricted normal form (RNF)

Status: accepted (2026-11-06).

## Context

The course (Slide13, pages 13 to 19; Elaine Rich Chapter 12) converts a PDA to a context-free grammar in two stages. The first stage rewrites the PDA into restricted normal form (RNF): (1) the start state `s'` only pushes the bottom marker `#`; (2) there is one accepting state `a`, and every transition into it reads nothing and pops `#`; (3) every transition except the one from `s'` pops exactly one symbol. Task T-037 turns an RNF machine into a grammar. Students need to see which transitions were added, split or expanded.

## Decision

- **Module and API.** `crates/engine-core/src/pda_rnf.rs`: `pda_to_rnf(&Pda) -> Result<RnfResult, Message>`, with `RnfResult { pda, new_states, steps }` and `RnfStep { removed, added, message }`. API `pda_to_rnf(pda_json)`, WASM `pdaToRnf`, worker method `pdaToRnf`. `StateName` is imported from `cfg_pda.rs`; it was not moved, because `pda_rnf` depending on `cfg_pda` does not point the dependency the wrong way.
- **Seven decisions of the spec.**
  1. _Input:_ the PDA is converted as it is, with or without `validate_pda` warnings. No start state gives `pda.rnf.no_start_state`; a stack alphabet that already holds `#` gives `pda.rnf.marker_clash { symbol }`.
  2. _Symbols:_ the input alphabet and all ids stay. `#` is appended last to the stack alphabet (not sorted), so old stack symbols keep their ids; expansions go over the new alphabet in id order, so `#` comes last. A full alphabet gives the `machine.limit_exceeded` message of `Alphabet::new`.
  3. _New states:_ with `m` the largest state id, `s' = m + 1`, `a = m + 2`, split states `m + 3`, `m + 4`, … in creation order. Arithmetic is checked: an overflow of `u32` gives `machine.limit_exceeded` (`what: "states"`). `new_states` names them `s'`, `a`, `v1`, `v2`, …, numbered over the whole machine. The ids of `m + 3` are computed before any split is known, so a machine whose largest id is within 2 of `u32::MAX` is refused even when it has no multi-pop transition.
  4. _Order:_ start; accept (accepting states in ascending id); split (transitions in the sorted order of `Pda::new`, those with at least two pops); expand (the same order, those that pop nothing). Single-pop transitions are copied without a step.
  5. _Result:_ `kind` is `ndpda`, `start` is `s'`, `accepting` is `[a]`; a plain `Pda`, so `validate_pda`, `simulate_pda` and the JFLAP export work on it.
  6. _Limits:_ no budget; the limits of `Pda::new` (`MAX_STATES`, `MAX_TRANSITIONS`, `MAX_PDA_STRING`) apply and come back as `machine.limit_exceeded`.
  7. _Trace:_ `pda.rnf.start`, `pda.rnf.accept { state }`, `pda.rnf.split { from, to, pops }`, `pda.rnf.expand { from, to }`; the engine writes no sentences.
- **Reading of the slide for a split.** A transition `((q1, c, γ1…γn), (q2, γP))` with `n ≥ 2` becomes `n` single-pop transitions through `n − 1` new states. The first `n − 1` read nothing and push nothing; the **last** one reads `c` and pushes `γP`, as on the slide. Language tests alone do not tell this apart from reading `c` in the first transition (both machines accept the same strings, since the intermediate states have no other exits); the structural test of fixture F3 pins it.
- **Expansion.** A transition that pops nothing becomes one transition for each `Γ0 ∈ Γ ∪ {#}`, popping `Γ0` and pushing `push ++ [Γ0]` (top first): the pushed symbols on top, `Γ0` underneath again.
- **JFLAP export.** `#` is one character, so the result of a PDA with single-character symbols can still be exported with `export_pda_jff` (ADR 0036); split states and the new states are plain ids with names from `new_states`.

## Consequences

- T-037 can build its grammar from a machine whose shape is known; the RNF shape check lives in the tests for now.
- The result is larger than the input (each non-pop transition grows by `|Γ'|`). The slide's algorithm is shown as it is: nothing is simplified.
