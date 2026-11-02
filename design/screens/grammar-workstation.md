# Grammar workstation (CFG and CNF): as built

Status: **as-built spec**, written on 2026-11-02 from the code at `staging` (PR 105 and later) and from the owner's screenshots. It describes what exists. It is not a redesign. The owner approves it by merging the PR. Known problems are listed at the end; the phone layout is in `workstation-phone-layout.md`.

- **Where:** `/sandbox?mode=grammar`. The mode is kept in the address and in `localStorage` (`webtomata_sandbox_mode`). The component is `web/src/lib/grammar/GrammarWorkstation.svelte`, loaded on demand.
- **What a student does here:** write a context-free grammar, see it in mathematical notation, watch the six CNF phases one by one, and test a string with the CYK parser.
- **Saved on the device:** the custom grammars (`webtomata.grammar.custom`), the selected grammar (`webtomata.grammar.selected_id`) and the column widths (`webtomata.grammar.col1_width`, `col3_width`). All in `localStorage`, not in IndexedDB like "Mesin saya".

## Laptop layout (wider than 900 px)

Three columns in one grid, with a splitter between them. The height is the viewport minus 64 px.

| Column | Width | Content |
|---|---|---|
| 1. Library | 280 by default, 200 to 700, double-click on the splitter resets it | Header "Perpustakaan Tata Bahasa" and the button "+ Tata Bahasa Baru". Section "PRESET SOAL & REFERENSI": nine preset cards (five CNF examples, four standard grammars). Section "TATA BAHASA KUSTOM": the student's grammars, each with a delete button (×). |
| 2. Editor | the rest | Header "Editor Tata Bahasa (CFG)" and "Simbol Awal: S". The rule matrix, the notation card, the legend. |
| 3. Output | 420 by default, 280 to 700 | Two tab buttons: "Transformasi CNF (6 Fase)" and "Uji String (CYK)". |

The splitters are `role="separator"` with a keyboard handler (arrow keys) and `aria-valuenow`.

### Column 1: a preset or custom card
A card shows an id badge in the mono font (for example `CNF_ORDER`), a title, and a one-line description. The selected card has an accent border and the accent tint. A card is a `div` with `role="button"`, `tabindex="0"`, and Enter or Space to select. A custom card has a delete button that asks nothing and removes at once.

### Column 2: the rule matrix
- A table with three columns: "Variabel (LHS)", "Panah" (the arrow →), "Ruas Kanan (RHS)".
- Each row: an input for the left side, the arrow, and the alternatives of the right side as **separate small input cells** divided by `|`, followed by a "+" button that adds an alternative.
- The row that has focus shows a **toolbar of symbols** ("Sisipkan" and the quick symbols such as ε) under its cells. The symbol is inserted at the cursor.
- The footer has the button "+ Tambah Baris". A right-click on a row opens a small menu with "Hapus Baris Ini".
- A cell that is empty when focus leaves it is removed, and so is a row with no cells. A row never means ε by itself: the student inserts ε explicitly.
- A parse error shows in a red banner (`role="alert"`) above the notation card.
- The card "Notasi Matematika (CFG)" shows the grammar as MathML (`GrammarMathDisplay`).
- The card "Definisi & Format Penulisan Tata Bahasa" is collapsed by default (a button with `aria-expanded`). It holds a table of symbols, meanings and examples.

### Column 3, tab "Transformasi CNF (6 Fase)" (`GrammarCnfStepper`)
- A row of six round buttons, 1 to 6 (one per phase), the active one filled with the accent color. Next to it: "Sebelumnya", the counter "n / 6", and "Selanjutnya".
- The step card: a badge "Fase n", the title of the phase, one paragraph that says what the phase does, then two groups of rule chips: "Aturan Dihapus (n)" (crossed out) and "Aturan Ditambahkan (n)" (green).
- Below: "TATA BAHASA SETELAH FASE INI", the number of rules, and the grammar in mathematical notation.
- The phases are the six of Rich: start symbol, nullable rules, unit rules, useless symbols, terminals, long right-hand sides. Phase 6 follows the course method with no shared helper variables (task T-014).
- Before a grammar parses, the tab shows an empty-state sentence or the error.

### Column 3, tab "Uji String (CYK)" (`GrammarCykTester`)
- One text field, the button "Uji String", and chips with example strings of the selected preset (the empty string shows as ε). One string at a time.
- The verdict card: a check mark (accepted) or a cross (rejected), a title, and one sentence with the string and the start symbol.
- The CYK table: rows are lengths, columns are positions, each cell shows the set of variables or ∅, and the top cell is highlighted when it holds the start symbol. The table scrolls sideways inside its own box.

## Phone and tablet (900 px or narrower), as built
The grid becomes one column, the splitters disappear, and the three columns stack in the order library, editor, output. But each column keeps `height: 100%` and `overflow: hidden`, and the library and the editor keep their own scroll areas. On the owner's phone (2026-11-02) this gave **three small windows with their own scroll bars**: about one preset card, about one rule row, and only the title of the CNF phase are visible. See "Problems".

## Problems found (for the planner's list; none is fixed by this document)
1. **The phone layout is not usable** (above). Proposed fix: `workstation-phone-layout.md`, task T-016.
2. The two output tabs are plain buttons. They have no `role="tablist"`, `role="tab"` or `aria-selected`, unlike the panel tabs of the FSM editor. Fix with T-016 or the accessibility pass (G5).
3. Rule chips print `S → T_aST_b` with no spaces, which is hard to read (task T-013).
4. The titles and descriptions of the presets are plain Indonesian text in `presets.ts`, not in the message files (task T-013).
5. The two workstations switch to one column at different widths (900 px here, 1024 px in the language workstation).
6. The custom grammars are kept in `localStorage`, which can be cleared and has a small limit. "Mesin saya" uses IndexedDB. This may need an ADR later.
7. A grammar workstation has no multi-string test, no import or export, and no saving of CNF results as a new grammar. Tasks T-020 and T-021 and the owner's ideas are in `docs/agent/PLAN.md`.
