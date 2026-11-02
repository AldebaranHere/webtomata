# Phone layout of the grammar and language workstations

Status: **approved by the owner on 2026-11-02** (see "Decisions of the owner" at the end), for task T-016. The picture is `workstation-phone-layout.svg`. The as-built description is in `grammar-workstation.md` and `language-workstation.md`; the laptop layout does not change.

## The problem (owner's phone test, 2026-11-02)
On a phone, the library, the editor and the output are stacked as three small boxes, each with its own scroll bar. A student sees about one preset card, one rule row, or only the heading of a CNF phase. In the language workstation the symbol toolbar covers most of the editor, and the settings are above the results, so the strings are off the screen.

## The proposal

### 1. One area at a time, with a tab strip
- Below 900 px (a phone or a small tablet) the workstation shows **one area at a time**. A **tab strip** under the mode bar switches between the areas.
- **Grammar:** four tabs, `Pustaka` (library), `Editor`, `CNF`, `CYK`. The two output tabs of the laptop become two tabs of their own.
- **Language:** three tabs, `Pustaka`, `Editor`, `Hasil` (results).
- The tab strip is the **same tab pattern as the panel tabs of the FSM editor** (`role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, arrow keys), so no new pattern is introduced. The tabs are at the **top**, not at the bottom, to match the FSM editor and to keep clear of the browser bar and the gesture area. Each tab is at least 44 px high. The strip stays visible while the page scrolls (sticky).
- The page **scrolls as a whole**. There are no scroll boxes inside the areas. The only exception is the CYK table, which scrolls sideways in its own box.
- The laptop layout (three columns with splitters) does not change. The two workstations use the **same breakpoint**, 900 px (today the language workstation uses 1024 px).
- The first tab is `Editor` (a grammar or a language is always selected, as on the laptop).

### 2. Choosing and creating
- Tapping a preset or a custom item **selects it and moves to the Editor tab**, so the student sees what they chose. The Editor header shows the name of the selection.
- "+ Tata Bahasa Baru" and "+ Bahasa Baru" create an item and move to the Editor tab.

### 3. Grammar, tab by tab
- **Pustaka:** the button "+ Tata Bahasa Baru", the label "Preset Soal & Referensi", then the cards (id badge, title, description), then the custom grammars. A card is at least 44 px high.
- **Editor:** the rule matrix as on the laptop; the symbol toolbar of the active row wraps into rows, every symbol button at least 44 px; the notation card; the legend (collapsed). There is no shortcut button to the CNF tab for now (the owner's decision); the student uses the tab.
- **CNF:** the stepper header (the six round buttons and "Sebelumnya", "n / 6", "Selanjutnya") is **sticky** under the tab strip, so the student can step without scrolling back. Each round button has a 44 px tap area. The step card (the phase title, the description, the removed and added rules, the grammar after the phase) scrolls under it. On a 360 px screen the title of the phase and the first chips are visible without scrolling.
- **CYK:** the field and the button "Uji String" stack to the full width (the button 44 px high); the example chips wrap; the verdict card; the CYK table in a box that scrolls sideways.

### 4. Language, tab by tab
- **Pustaka:** the button "+ Bahasa Baru", then the cards (id, name, formula, description).
- **Editor:** in this order: the header with the alphabet badge, the **formula box first**, then the symbol toolbar (the operators on one row group, the conditions `#a(w)`, `prefix()` and so on on the next; all buttons at least 44 px, wrapping), then the notation card, the error banner, and the legend (collapsed). The toolbar no longer covers the box.
- **Hasil:** the header "Hasil Enumerasi (Proper Order)" with "Salin Semua" (44 px); the three settings in **one compact row** (a three-column grid, labels may wrap to two lines); then the **results at once**, below that row.

### 5. Common rules
- Tokens only; no new color. Touch targets 44 px. Every new text in `id` and `en` (the tab names).
- Keyboard: arrow keys move between tabs, Enter or Space activates. Focus ring as everywhere.
- The selected tab is not saved between visits.

## What does not change
The laptop layout, the splitters, the engine calls, the saved data, the switcher, the strings that already exist.

## Decisions of the owner (2026-11-02)
1. The layout is approved as drawn.
2. The tab names are right: `Pustaka`, `Editor`, `CNF`, `CYK`, `Hasil`.
3. The tab strip is at the **top**.
4. "Stay in editor for now": the student ends in the **Editor** tab after tapping a preset, and the shortcut button "Ubah ke CNF" is **not** built for now. (The planner's reading of the answer. The owner can change it later with a small task.)
