# ADR 0045: PDA Three-Field Label Form and Pure Logic

- **Decider:** worker (approved by planner & owner)
- **Date:** 2026-11-07
- **Context:** Editing transitions on an edge in the PDA editor requires three distinct fields (**Baca**, **Pop**, **Push**) per transition rather than the FSM's single comma-delimited text field (`design/screens/pda-editor.md`, section 8). The editor shell (T-055) requires pure logic and presentation components that map user text to document commands for `commitEdge` (T-049) without slash syntax or an interactive `ask_split` question.
- **Decision:**
  1. Build pure TypeScript logic in `web/src/lib/editor/pda-label.ts`:
     - `Row`: `{ read: string; pop: string; push: string }`.
     - `rowsOf(doc, from, to)`: writes transitions in label format (empty read/pop/push as `ε`; stack symbols joined without spaces for single-character stack alphabets, or with spaces for alphabets containing multi-character symbols).
     - `parseRows(doc, rows)`: parses non-blank rows into `ParsedTransition[]` (`{ read, pop, push }`) dropping blank rows and deduplicating identical transitions in first-seen order. Refuses multi-character read strings on single-character alphabets with `pda_editor.read_one_symbol`.
     - `rowCommands(doc, from, to, rows)`: computes the batch commands for `commitEdge`: `addInputSymbol` and `addStackSymbol` (deduplicated, order of appearance) first, then `addTransition` (new transitions), then `removeTransition` (removed transitions).
     - `pdaMenuLabels`: exports `{ edit: 'pda_editor.menu_edit' }` for the context menu.
  2. Implement `PdaLabelForm.svelte`:
     - Dialog with accessible title `pda_editor.form_title { from, to }`, table-like row headers, and 44 px inputs with $\ge 16$ px font sizes.
     - Settle rule (400 ms) and leave rule (sends changed and valid rows, cancels otherwise).
     - Accessible names per field and row delete buttons; live region and `aria-describedby` for refusal messages; Ketik ε button and Ctrl+E.
  3. Implement `PdaLabelPopover.svelte`:
     - Placed at `LabelSlot` coordinates, clamped within canvas bounds with 4 px margin and responsive width clamping.
- **Alternatives considered:**
  - Slash syntax `a / γ1 / γ2` in a single text field (rejected in wireframe P-004: difficult to type and navigate on mobile).
  - Keeping the interactive `ask_split` dialog for read field (rejected: complicates 3-field form state; calm refusal message `pda_editor.read_one_symbol` clearly guides user to use two rows or declare the symbol in the Tabel tab).
- **Reversible?** Yes.
- **Affects:** `web/src/lib/editor/pda-label.ts`, `PdaLabelForm.svelte`, `PdaLabelPopover.svelte`, `web/src/lib/i18n/id.ts`, `web/src/lib/i18n/en.ts`, `web/src/lib/editor/diagram/pda-diagram.ts`.
