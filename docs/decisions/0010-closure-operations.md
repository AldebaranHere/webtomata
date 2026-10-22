# 0010. Closure operations: complement, union, intersection

Status: accepted

## Context
E9 combines machines. Rich (Theorems 8.3 and 8.4) and the course slides (`Regular1`) teach: complement by swapping the accepting states of a complete DFSM, union by the construction of Kleene's theorem, and intersection by De Morgan: `L1 ∩ L2 = ¬(¬L1 ∪ ¬L2)`. Rich notes that a direct product construction is also possible and leaves it as an exercise. The roadmap named the product construction, but the trace must follow the method the course teaches.

## Decision
- **Complement** takes a complete DFSM only, like `minimize`. A NDFSM gives `complement.not_a_dfsm` and a DFSM with a validation error (for example a missing transition) gives `complement.invalid_machine`; the student first runs `determinize`, and the UI can offer that as a button on the error. Swapping accepting states is wrong for other machines: a DFSM with a missing transition would still reject the strings that have no path, and a NDFSM accepts if any path accepts. The result keeps the state numbers, so the UI can keep names and positions. Trace: one step for each state (`complement.accepting` or `complement.not_accepting`).
- **Union** takes any two machines and gives a NDFSM. The first machine keeps its state numbers. The states of the second machine are renumbered, in order, after the highest state of the first, and the new start state comes last. Symbols are matched by name. Trace: `union.copy_first`, `union.copy_second`, `union.new_start`, and one `union.epsilon` for each ε-transition. Errors: `union.no_start_state { side }`, `union.alphabet_mismatch { symbol, side }`; a result over 2,000 states is `machine.limit_exceeded`.
- **Intersection** follows De Morgan in seven stages: make the first machine a complete DFSM, complement it, the same for the second, take the union of the two complements, make the union a complete DFSM, complement it. A machine that already is a complete DFSM skips its "make complete" stage; the others run `determinize` as visible steps. Each stage starts with a `Stage` step (`intersection.stage.*`). The `ConversionBudget` applies to each `determinize` call; on overflow the result is `Stopped { reason, partial_trace }`. Errors: `intersection.no_start_state`, `intersection.alphabet_mismatch`.
- New change types: `Copy`, `Epsilon`, `NotAccepting`, `Stage`. The name matching of alphabets moved to `Alphabet::match_by_name`, shared with `equivalent`.

## Consequences
- The product construction is not built. It would give smaller machines and a shorter trace and could be added as a separate task if students need it (Sipser teaches it).
- Convenience for NDFSMs and partial DFSMs lives in the UI (a button that runs `determinize` first) or in a later wrapper; the engine functions stay simple and independent.
- The intersection of two DFSMs goes through a determinization of their union, so it can be big for large machines; the budget stops it.
