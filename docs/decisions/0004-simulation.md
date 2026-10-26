# 0004. Simulation

Status: accepted

## Context

E3 runs a machine on an input string and returns a trace the UI can step through. The engine must never loop forever or return sentences.

## Decision

- Every machine is simulated as a set of active states with ε-closure. A DFSM is the case where the set has one state, and the result is the same as a single-state run. This also gives sensible results for a DFSM that has a missing transition (the set becomes empty and the run rejects at once) or an extra one.
- `simulate(&Fsm, &[SymbolId], Budget) -> Result<Simulation, Message>`. `Simulation` is `Finished { accepted, trace }` or `Stopped { reason, partial_trace }`.
- A trace step holds the symbols read so far, the symbol just read, the sorted active states and a message (`sim.start`, `sim.read { symbol, position }`, `sim.no_states { symbol, position }`).
- Budget: `max_steps` (symbols read) and `max_configurations` (the sum of the set sizes over the whole trace). Defaults: 100,000 and 1,000,000. A set simulation has no branches, so there is no `max_branches`; a future branch-tree view will need one.
- Errors, not results: `sim.no_start_state` and `sim.unknown_symbol { symbol }`.
- `Alphabet::tokenize(text)`: if every symbol has one character, one character at a time; otherwise symbols are separated by whitespace. Error: `input.unknown_symbol { symbol, position }`.

## Consequences

- The UI decides whether to block a run when `validate` reports errors; the engine only needs a start state.
- The E4 task adds the property that a NDFSM and its determinization agree.
- A branch-tree view (all paths of a NDFSM) needs a separate function and a branch budget.
