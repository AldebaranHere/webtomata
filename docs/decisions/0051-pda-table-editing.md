# 0051. The PDA Tabel tab is an editable form: one batch per row, a refused duplicate, and a draft row

Status: accepted

## Context

Task T-051 gave the PDA editor its panel with a **read-only** table of the transitions (Dari, Baca,
Pop, Push, Ke, in the engine's order). T-061 makes it the accessible alternative to the canvas: it
must do everything the diagram can, so it needs the alphabet chips, the state rows and editable
transitions (`design/screens/pda-editor.md`, section 6; `docs/agent/PLAN.md`, T-061).

Three things made the FSM table a poor model:

- The FSM table is an arrow-key grid (`data-row`, `data-col`, `moveInGrid`). The PDA row has free
  text (Pop, Push, names), where the arrows belong to the field, and two of its five columns are
  choosers of states or symbols.
- `rowCommands` of the label form merges a row that equals another one, so an edit could make a row
  disappear without a word. A duplicate has to be refused, not merged.
- Rows are in the engine's order (`comparePdaTransitions`), so an edit that changes `from` or `read`
  moves the row. The focus and the announcement must follow it.

The pre-flight of this task ran the fixtures with the real functions and found that the document
accepts the word `eps` as a symbol name, that `document.duplicate_symbol` has no text in any
dictionary, and that `pda-panel` E4 read the text of a cell that becomes a text field
(`docs/agent/DECISIONS.md`, 2026-11-09; amendment after the worker's pre-flight).

## Decision

1. **A list of controls in page order, not a grid.** `Tab`, `Enter` and `Esc` are the keys; the
   arrows work inside a chooser. The State block is a list with a small header line, not a second
   `<table>`: `pda-panel` E4 counts `tbody tr` for the transitions, and a second table in the panel
   would make that count wrong, while a table would need an empty header over the delete column
   (`axe` rule `empty-table-header`).
2. **`parseRows` of the label form is the only parser.** A row edit becomes one
   `{ type: 'batch' }`: the new input and stack symbols first, then `removeTransition` of the old
   row, then `addTransition` of the new one, so one Urungkan takes the row and the alphabet back
   together (`pda-table-edit.ts`).
3. **A row that would equal another row is refused**, with its number
   (`pda_editor.row_duplicate { n }`), and nothing is sent. The check covers every row of the
   document, not only the edge of the row.
4. **Rows are keyed by their fields** (a JSON tuple of `from`, `read`, `pop`, `push`, `to`), so a
   DOM element is never reused for another transition, and the draft row is keyed `'draft'`. After a
   command the row's new index comes from a dry run of the same command through
   `applyPdaCommand` — the same pure function that the history will run — then `tick()` and the
   focus on the same control of that row. The announcement and the focus therefore never guess the
   engine's order.
5. **A new row is a draft until Dari and Ke are chosen.** It is not in the document, it is not
   counted in `Transisi (n)`, and it is lost when the tab is closed (the panel destroys the tab's
   content). It stays while other things change in the document, because a student who renames a
   state in the middle of a new row must not lose it. If the state that its Dari or Ke names is
   removed, that chooser shows the empty placeholder: the value is a `$derived` that checks the
   document, not a mutation of the draft, so the draft keeps everything else it had. (An undo that
   brings the state back brings the chooser back with it; the plan does not say otherwise.)
6. **A draft with a new stack symbol is one batch**, with the `addStackSymbol` commands first, as a
   row edit is. Baca is a chooser of the input alphabet, so it never adds a symbol.
7. **The words of the State block are the FSM's**: `table.state`, `table.start`, `table.accepting`,
   with `table.start_toggle` and `table.accepting_toggle` for the names a screen reader reads. The
   design says "mulai"; one site uses one word for one thing, so the FSM's wording wins. The start
   control is a native radio group.
8. **The Alfabet field refuses a reserved name before any command**: `eps` and `ε` (the words
   `pda-label.ts` reads as ε, exported as `EPSILON_WORDS`), a name with whitespace and a name with
   a comma, with `pda_editor.symbol_reserved`. The document itself is not changed, so it still
   accepts `eps` (T-065).
9. **The text of `document.duplicate_symbol` lives in `pda-messages.ts` for now**, because the
   shared dictionary has none and the table can show it (T-065 fixes the same hole for the FSM).

## Consequences

- The Tabel tab can do what the canvas can, with the same commands, so undo, the diagram, the
  definition, the checks and the autosave follow with no new code.
- `web/src/lib/editor/pda-table-edit.ts` is the pure part (counts, placement, the batch, the
  duplicate check, the draft rule, the reserved names) and is tested by
  `pda-table-edit.test.ts` (U1 to U13, R1 to R3).
- One line of `pda-panel` E4 changed from `toContainText('A')` on the Push cell to a check of the
  value of that field: the value of a field is not text content (decision of 2026-11-09). The
  heading, the caption, `th.from`, `.wrap`, `aria-current` and the empty line are unchanged.
- `pda-messages.ts` holds 36 keys (25 of T-063 and 11 of T-061); the shared dictionary is untouched,
  so no route's first JS grows.
- The FSM's own `document.duplicate_symbol` still shows a raw key when its table adds a symbol that
  is there already; that is T-065, not this task.

## Alternatives considered

- Copying the FSM grid: the free text fields do not mix with arrow-key movement, and the PDA has
  five columns that are not symbols.
- Keeping "mulai": two words for one thing on one site.
- Merging a duplicate row (what `rowCommands` does): silent data loss.
- A button that sends the draft: the design says a row is sent when it is complete.
- A second `<table>` for the State block: it breaks `pda-panel` E4's row count and needs an empty
  header, which `axe` rejects.
- A hidden text mirror in the Push cell to keep E4 unchanged: the value would be read twice by a
  screen reader.

## Reversible?

yes

## Affects

`web/src/lib/editor/PdaTableView.svelte`, `PdaAlphabetBlock.svelte`, `PdaStatesBlock.svelte`,
`PdaTransitionsBlock.svelte`, `pda-table-props.ts`, `pda-table-edit.ts`, `pda-label.ts`
(one export), `PdaEditor.svelte`, `web/src/lib/i18n/pda-messages.ts`, `web/e2e/pda-panel.spec.ts`
(one assertion), `web/e2e/pda-table-edit.spec.ts`
