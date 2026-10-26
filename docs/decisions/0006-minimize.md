# 0006. DFSM minimization

Status: accepted

## Context

E5 minimizes a DFSM and records a step trace. The course slides (`FSM3`, "Algorithm ver 2") and Rich's book (minDFSM, Example 5.28) teach partition refinement. The slides and the book reach the same final classes but describe the scan differently, so one had to be chosen for the trace.

## Decision

- Follow the slides. Start with the classes {A, K−A} (accepting first). Scan the classes in order and examine each class with more than one state. At the first divisible class, keep the states that behave like its first state; the others move to a new class placed right after it, and a new scan starts. When a scan finds nothing to split, each class becomes one state. The trace of Example 5.28 matches the slides round by round.
- The book splits every class in one pass against the old classes. That gives the same final partition in fewer rounds but a less readable trace, so the book's variant is not used.
- Addition to the slides and the book: unreachable states are dropped first, one visible step each (`minimize.remove_unreachable`), because otherwise the result may not be minimal.
- Each split step names the witness: two states and the symbol on which they go to different classes (`minimize.split { p, q, symbol }`), and carries the new classes.
- Keys: `minimize.remove_unreachable`, `.initial_classes`, `.examine { size }`, `.no_split`, `.split { p, q, symbol }`, `.new_state`, `.start`, `.transition { from, symbol, to }`, `.accepting`. The shared `Change` type moved to `trace.rs` and `determinize` uses it too.
- `minimize(&Fsm, MinimizeBudget) -> Result<Minimization, Message>`; `Finished { dfsm, classes, trace }` or `Stopped { reason, partial_trace }`. Budget: `max_steps` (default and limit 100,000).
- Errors: `minimize.not_a_dfsm`, and `minimize.invalid_machine` when `validate` reports an error. A partial DFSM must be completed first (for example with `determinize`).

## Consequences

- A "complete with a dead state" step could be added later as a UI button that calls the same engine code.
- Worst case work is about n² · k for n states and k symbols; E13 will measure it.
