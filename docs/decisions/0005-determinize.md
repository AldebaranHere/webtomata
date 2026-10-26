# 0005. NDFSM → DFSM (determinize)

Status: accepted

## Context

E4 converts a NDFSM to an equivalent DFSM. The course (slides `FSM2`) teaches Rich's subset construction, so the step trace must follow the same method and the same order.

## Decision

- `determinize(&Fsm, ConversionBudget) -> Result<Conversion, Message>`. `Conversion` is `Finished { dfsm, subsets, trace }` or `Stopped { reason, partial_trace }`. `subsets[i]` lists the original states in DFSM state `i`, so the UI can label states such as `{q1, q2, q7}`.
- Method, as in the slides: eps(q) for every state; s' = eps(s); take each active state in the order it was found and, for each symbol in alphabet order, compute the union of eps(p); the active states are K'; A' holds the subsets with an accepting state. The result is complete, and the empty set is a state like any other (the slides show it too).
- Trace order: one `determinize.closure { state }` step per original state; `determinize.new_state { state }` and `determinize.start { state }` for the start subset; then for each active state and symbol an optional `determinize.new_state` followed by `determinize.transition { from, symbol, to }`; last, one `determinize.accepting { state }` per accepting subset. Each step also carries a `Change` value with the data (state ids, members, closure sets).
- DFSM state ids are assigned in discovery order (0, 1, 2, ...).
- Budget: `max_states` (default and limit: 2,000) and `max_steps` (default and limit: 100,000, which keeps the transition count inside the engine limit). On overflow the result is `Stopped` with reason `max_states` or `max_steps`. The classic "n-th symbol from the end" machine needs 2^n states, so this is a real case.
- Error: `determinize.no_start_state`. Any machine can be converted; a DFSM with a missing transition becomes complete.
- `StopReason` moved to its own module and gained `max_states`. The transition lookup and ε-closure moved to `closure.rs`, shared with the simulation.

## Consequences

- The equivalence property (DFSM and NDFSM accept the same strings) uses the E3 simulation on random machines.
- The `minimize.` prefix is kept for E5.
- The trace holds member lists, so a conversion near the limits uses a few tens of MB.
