# 0026. Auto layout with dagre

Status: accepted (the owner chose it on 2026-10-26; it changes the decided stack in CLAUDE.md)

## Context

"Tata letak otomatis" (S9) places the states of a machine: on demand now, and later for imported files (S10b) and converted machines (S7). `CLAUDE.md` had decided `elkjs`. We measured both before building:

|                            | elkjs 0.12.0                                | @dagrejs/dagre                 |
| -------------------------- | ------------------------------------------- | ------------------------------ |
| License                    | EPL-2.0 OR GPL-3.0-or-later (fits AGPL-3.0) | MIT                            |
| What the browser downloads | about 470 KB gzip (1.6 MB), on first use    | about 16 KB gzip, on first use |

Only the places of the states are needed: the diagram draws the edges itself (`geometry.ts`). Our machines are small (a few states, hardly ever above 30). The audience uses cheap phones on mobile data.

## Decision

- **dagre 3.1.1** (exact version; published 2026-08-08, past the two-week wait; its one dependency, graphlib 4.0.5, is from 2026-08-03). Newer 3.1.x versions were too new when this was decided.
- **Left to right**, as the textbook draws automata. A virtual state before the start state puts the start state in the first column. Loops do not count, and a pair of states with several symbols is one edge.
- **In its own worker** (`layout.worker.ts`), started on the first use. The library is in `layout-dagre.ts`, which only the worker imports, so it is never in the first load. `tools/check-size.mjs` fails the build if a name that is only in the library is found in the first load, and the worker has its own budget of 40 KB gzip.
- **One step of the history.** The places come back as a batch of `moveState` (`placeAll`), centered on where the machine was, so that the view does not jump; then the view is fitted. A message with Urungkan says it was done.
- **Calm failures:** a machine of more than 400 states is not laid out; a call over 5 s, a failed worker, and a machine that changed meanwhile each say so in a sentence and change nothing.
- **The library is behind one function** (`computeLayout(graph) → places`). If the layouts disappoint, `elkjs` can replace dagre without a change anywhere else.

## Consequences

- 16 KB instead of 470 KB for the student who presses the button. The cost of dagre is a layout that may be a little less good than ELK's on a very tangled machine; a student can undo it, and nothing else depends on it.
- `CLAUDE.md` (the stack table and the size budgets) now says dagre. `elkjs` is not a dependency.
