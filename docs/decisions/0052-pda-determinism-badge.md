# 0052. The determinism badge: a second query, a sentence built in the UI, and a selection that is not in the document

Status: accepted

## Context

Task T-051 gave the PDA panel the checks line, which says that two transitions compete
(`pda_check.competing_transitions` for a DPDA) but not where they are or why. Design section 5 of
`design/screens/pda-editor.md` asks for a badge under the kind switch, in both tabs, that reads
`pda_determinism` and opens the list of the competing pairs, each with its two transitions, a
sentence, and **Tunjukkan** (T-062).

Three things had no home yet:

- The engine's answer is `Competition[]` (`{ from, first, second }`, indices into the engine's
  transition order). `checker.ts` is shared with the FSM and typed for `Issue[]`, and changing it
  would need FSM tests.
- A badge must never describe a document that is no longer on screen, and the engine answers
  asynchronously through the worker.
- There is no public way to focus an edge node of the canvas: `EditorCanvas` exports only `zoom`,
  and the shared editor core sets `focus.edge` in one private place (`closeLabel`).

## Decision

1. **A second query, not a change of `checker.ts`.** `web/src/lib/editor/pda-determinism.ts` exports
   `createDeterminism({ query, delayMs = 200 })` with the same rules as the checker: a 200 ms
   debounce, a sequence number captured before the `await`, and a `dispose`. It also exports
   `competitionReason(doc, pair)` and `badgeModel(kind, transitions, pairs)`. `checker.ts` is not
   changed.
2. **The pairs are emptied when a document is scheduled.** A badge that says "Deterministik" while
   an edit is on its way is a badge for an older document, so `schedule` clears `pairs` and sets
   `checking`; the badge renders nothing until the answer for the newest document is back. A failed
   answer also shows no badge: the checks line already carries the notice and its retry, and the
   panel does not show a second one.
3. **The sentence is built in the UI** by `competitionReason`, from the definition: two transitions
   of one state compete when one of them reads ε or both read the same symbol, and one pop is a
   prefix of the other. `pop1` is the prefix, so the two are swapped when only the second one is.
   Two transitions that both read ε take the ε key: ε is not a symbol. A pair whose indices are not
   transitions of the document has no sentence (`null`), so a card is never built from a row that is
   not there.
4. **The badge's own live region, never `role="status"`.** "Tunjukkan" says
   `pda_editor.pair_selected { first, second }` through an `aria-live="polite"` paragraph that is in
   the head block all the time. The editor's `Announcer` is the only `role="status"` element in the
   page, and `pda-panel` and `pda-table-edit` select it by that role; a second one would break them.
5. **Tunjukkan selects, marks and moves the focus by tab.** The first edge is selected with
   `editor.selectEdge`, both rows go into the `marked` set of T-051 (so its clearing rule keeps
   working), and the focus goes to the Dari field of the first row when the Tabel tab is open, by a
   request prop of the table (`PdaRowFocus`, one optional field) that reuses the existing
   `focusRow`. With the Definisi tab open the focus stays on the button (amended 2026-11-09: nothing
   outside the shared core can focus an edge node, and the shared core does not change here). The
   second press clears the marks, the edge and the message with `editor.clearSelection`, which also
   says `editor.selection_cleared`.
6. **The head block is one snippet.** `PdaEditor.svelte` repeated the kind switch and the checks
   line in the two tab snippets; they are now one `head` snippet rendered by both, so the two tabs
   cannot drift apart.
7. **Dashed competing edges and a second selection stroke are left out**: they change
   `DiagramDrawing.svelte` and `EditorCanvas.svelte`, which the FSM shares, and need FSM tests. They
   are T-070.
8. **The head block of the panel is one row at 360 px**: the kind switch and the badge share the row
   and the badge's visible text is short (`Non-det. · 2`), while its `aria-label` is the full
   sentence. `Bukan DPDA · 2` needs a key of its own (`pda_editor.badge_not_dpda_short`), because
   the design names a short form for it as well.

## Consequences

- The PDA mode gets a second engine call per change. It is bounded (the answer is a list of index
  triples), and it is scheduled after the first draw like the checks, so T-051's E8 still passes.
- All of the new code and all twelve new strings are in the lazy PDA chunk: the route sizes do not
  move at all (`index.html` 81.5, `sandbox.html` 124.7, `soal.html` 83.7, `panduan.html` 82.3 KB
  gzip, before and after), and the PDA chunk grows from 22,069 to 28,291 bytes raw (7,745 to 9,798
  gzip).
- The table gained one optional prop, so the editor can ask it for the focus without exporting a
  method from a lazily loaded component (a `Component<PdaTableProps>` has no export type in
  Svelte 5).
- A pair of the `+ n lagi` marks and a pair of Tunjukkan cannot both be shown at once: Tunjukkan
  replaces the marks and sets `markedEdge` to the edge of its first transition, and `+ n lagi`
  forgets the shown pair.

## Reversible?

yes

## Affects

`web/src/lib/editor/pda-determinism.ts` and its two test files, `PdaDeterminismBadge.svelte`,
`PdaEditor.svelte`, `PdaTableView.svelte`, `PdaTransitionsBlock.svelte`, `pda-table-props.ts`,
`web/src/lib/i18n/pda-messages.ts`, `docs/glossary.md`, `web/eslint.config.js` (the new WASM test in
the list of files that may import the engine), `web/e2e/pda-determinism.spec.ts`
