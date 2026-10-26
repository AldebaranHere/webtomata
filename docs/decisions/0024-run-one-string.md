# 0024. Running one string: one engine call, local steps

Status: accepted

## Context

S6-2 shows a run of one string step by step on the diagram. The engine's `simulate` returns the whole computation (the active states after each symbol). The page needs play, pause, back and forward.

## Decision

- **One call per run.** The page calls `simulate` once and steps through the answer on its own. No call per step (CLAUDE.md, coarse API). The timer (700 ms) lives in a plain model (`web/src/lib/editor/run.ts`, no browser code) that the editor owns.
- **The taken edges are worked out in the page,** from the document and the states of two steps. The engine is not changed. The model keeps a copy of the document it ran on, and any change of the document clears the run, so the two cannot disagree.
- **A run is not in the history.** It is not a command, it is not saved, and it is not shared. Editing the machine or the string clears it.
- **The verdict shows only at the last step.**

## Consequences

- If a later task needs the taken edges in the engine (for example for a trace of a conversion that names transitions), they can move into `engine-core` with the same tests (the property test in `run.wasm.test.ts` states the rule).
- The run model ends in `dispose()`; the editor calls it when it unmounts.
