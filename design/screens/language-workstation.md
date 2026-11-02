# Language workstation (formal languages and enumeration): as built

Status: **as-built spec**, written on 2026-11-02 from the code at `staging` (PR 104 and later). It describes what exists. It is not a redesign. The owner approves it by merging the PR. The phone layout is in `workstation-phone-layout.md`.

- **Where:** `/sandbox?mode=language` (also kept in `localStorage`, `webtomata_sandbox_mode`). The component is `web/src/lib/language/LanguageWorkstation.svelte`, loaded on demand.
- **What a student does here:** write a formal language as a formula (set operations, closure, set-builder conditions), see it in mathematical notation, and list its strings in **proper order** (shortest first, then alphabetical), as the course asks for the enumeration homework.
- **Saved on the device:** custom languages (`webtomata.language.custom`), the selected language and the column widths, in `localStorage`.

## Laptop layout (wider than 1024 px)

Three columns with two splitters, like the grammar workstation: library (280 by default, 200 to 700), editor (the rest), output (420 by default, 280 to 700). The height fills the page.

| Column | Content |
|---|---|
| 1. Library | Header "Perpustakaan Bahasa" and "+ Bahasa Baru". "PRESET SOAL & REFERENSI" (the words are written "Preset Soal & Referensi" and shown in capitals): a list of preset languages (L1 to L10 and L15 at the start; the list is in `presets.ts`), each a button with an id (L1), a name, the formula in the mono font, and a one-line description in the language of the page. "BAHASA KUSTOM": the student's languages with a delete icon button. |
| 2. Editor | Header "Editor Formula & Himpunan" and the alphabet badge `Σ = {a, b, c}` (the alphabet is read from the formula). A toolbar "Sisipkan": operators (∪ ∩ − ⊕ * + ^R ^ ε), then `#a(w)`, `#b(w)`, `prefix()`, `suffix()`. A formula text area (4 rows). The card of notation (mathematical display). A red error banner when the formula is wrong. The legend table of notation. |
| 3. Output | Header "Hasil Enumerasi (Proper Order)" and the button "Salin Semua" (disabled when there is no result). A settings panel: "Panjang Min (\|w\| ≥ M)", "Jumlah String (N)", and "Format String Kosong" (the symbol that shows the empty string: ^ or ε). Then the results. |

The results: a line "Menampilkan n string pertama…", then a numbered list; each row has the number, the string in the mono font, and a badge with its length. The enumeration runs in the engine worker with a budget of 50,000 checks, so the page never freezes.

## Phone and tablet (1024 px or narrower), as built
One column, no splitters, height automatic. Each column keeps `overflow: hidden` and `height: 100%`, with its own scroll area. On the owner's phone (2026-11-02):
- The library shows about one and a half preset cards.
- The symbol toolbar takes most of the editor, and the formula box is cut off under it.
- In the output column the three settings come **before** the results, so the strings are off the screen.

## Problems found
1. The phone layout is not usable (above). Proposed fix: `workstation-phone-layout.md`, task T-016.
2. The splitter of the output column in this workstation uses the message `grammar.resize_output_aria` (the grammar's key). It works, but it belongs to the other screen.
3. The switch to one column happens at 1024 px here and at 900 px in the grammar workstation.
4. The delete button of a custom language is a trash icon with a label; the grammar workstation uses a × character. The two should look alike.
5. Presets are kept in `presets.ts` with both languages in the data (`descriptionId`, `descriptionEn`) but the grammar presets are Indonesian only (task T-013).
