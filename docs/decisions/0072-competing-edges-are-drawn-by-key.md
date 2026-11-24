# 0072. Competing edges are drawn by key, never by pair

- **Status:** Accepted (2026-11-25, task T-070)
- **Context:** `design/screens/pda-editor.md` section 2 promises that a DPDA's competing transitions are drawn dashed in `--color-warning`, and section 5 says that **Tunjukkan** selects both edges of a pair. T-062 built the badge, the pairs and the first edge's stroke, but left both drawing changes out because they change the shared `DiagramDrawing`/`EditorCanvas` of the FSM editor too. The pre-flight found that the obvious implementation of "the same `chosen` style on the second edge" — widening `chosen()` — would set `aria-pressed="true"` on the second edge (the defect guard B3 exists for), that the label needs the style as well as the group, and that the chosen rule would win the cascade over the dashed rule.

## Decision

1. **Two optional sets of edge keys, nothing else.** `DiagramDrawing` and `EditorCanvas` take `dashed?: ReadonlySet<string>` and `alsoChosen?: ReadonlySet<string>` (`"from>to"` keys, like the existing `taken`), both defaulting to an empty set. `DiagramInput`, `geometry.ts`, `pdaDiagram` and every FSM file stay as they are; the FSM passes neither and renders exactly what it rendered before.
2. **The dashed set is a pure function of the engine's answer and its freshness.** `dashedEdges(kind, status, doc, pairs)` is empty unless `kind === 'dpda'` **and** `status === 'ready'` (T-062's badge rule: a pair holds indices of one document). It takes the keys of both transitions of every pair and ignores an index that names no transition, so an answer that outlived its document can only lose a dash; it cannot throw.
3. **The look.** `.edge.dashed .line` is `--color-warning` with `stroke-dasharray: 6 4` (checked at 100 % and 156 % zoom; kept). `.edge.chosen`, `.edge.taken` and `.edge.also-chosen` share the accent stroke of 3 px, and `.label.also-chosen` joins the chosen label style. An explicit `.edge.dashed.chosen .line, .edge.dashed.also-chosen .line` rule after the chosen rule restores the dash, so a selected competing edge never looks like an ordinary solid edge. The arrowhead is unchanged. The line sits on `--color-ground`, where the existing contrast pair *Warning on ground* already measures 3.72 : 1 against a need of 3; `tools/contrast-pairs.mjs` needs no new pair.
4. **The second edge is visual only.** `alsoChosenEdge()` reads `alsoChosen` and is used for the `.edge`/`.label` classes and for `data-also-chosen` (`|| undefined`, so the default props add no attribute); `chosen()` remains the only source of `aria-pressed`. The set comes from `extraMarkedEdges(doc, marked, markedEdge)`: the keys of the marked rows, minus the selected edge's key. It is derived from the same `marked` that already clears itself, so no new state and no new clearing rule; the "+ n lagi" rows of one edge add nothing. `markedEdge` is `$state.raw`, so the derivation depends on it explicitly (it only ever changes with `marked`).
5. **Acceptance 1 is proven in the browser.** `web/vitest.config.ts` deliberately has no Svelte plugin (plain TypeScript, node), so the drawing cannot be rendered in a unit test without changing that shared config. A case in `e2e/pda-determinism.spec.ts` opens the FSM editor and compares every `.edge`/`.label` class list and every edge button's `aria-pressed` with the values captured on `origin/staging` (`edge`, `label`, `false`), and asserts that no `dashed`/`also-chosen`/`data-also-chosen` appears. The Svelte scope token (`svelte-…`) is excluded: it is a compiler detail, not part of the machine's drawing.
6. **Names kept.** The block's names stay: the prop is `alsoChosen` (the drawing) and the function is `extraMarkedEdges` (the table marks), although the two describe the same set from different sides.

## Consequences

- A DPDA shows which edges break determinism from the picture alone; an NDPDA is unchanged (the badge still reports the pairs). The selection is still one edge: no `aria-pressed`, no `selectedEdge`, no history entry and no focus for the second edge.
- No new string, no new dependency, no `crates/` change (the wasm is byte-identical), and no change to `DiagramInput`, `geometry.ts` or any FSM behaviour. `sandbox.html`'s first JS grows by 128 bytes gzip (126,573 → 126,701); every `soal/*` route by 135; the build's JS by 285 bytes gzip; budgets pass.
- The contrast tool needed no edit; the chosen+dashed rule is guarded by F3 (B6), and the kind/status rules by F1 (B1, B2), the marks by F2 (B4), and the FSM markup by the AC1 case (B5).

## Alternatives considered

- A field in `DiagramInput` for the pairs: rejected (the geometry would learn about competing transitions, and the drawing already takes key sets for runs).
- Widen `chosen()` for `alsoChosen`: rejected (it puts `aria-pressed` on the second edge — B3).
- Dash per label line rather than per edge: rejected (the design draws edges; the label lines are already crowded).
- Keep the old dashes while the engine is asked again: rejected (they would point at the transitions of the previous document).
- Add the Svelte plugin to `vitest.config.ts` for a render test: rejected as outside this task's files and a change to every unit test's setup.
