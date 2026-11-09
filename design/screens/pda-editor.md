# PDA editor: diagram, table, formal definition and the determinism badge (P-004, proposal)

**Status:** approved by the owner on 2026-11-06, with the planner's pick on all five questions at the end. It is built by T-033 (document), T-039 (diagram), T-049 (interaction core), T-053 (canvas), T-054 (label form), T-055 (frame), T-056 (saving), T-057 (shell and mode), T-051 (panel: tabs, kind switch, checks, read-only table and definition), T-061 (editing in the table), T-062 (badge and competing pairs) and T-052 (library, files, examples).
**Picture:** `pda-editor.svg` (one sheet, frames A to F; the numbers below are the numbers in the picture).
**Sources:** the PDA decisions of 2026-11-05 in `docs/agent/DECISIONS.md`; tasks T-030 (model, validation, `determinism`), T-031 (simulation) and T-032 (`.jff`); the FSM editor as built (`docs/ux/editor-interactions.md`, `design/screens/workstation-switcher.md`). The sample machine in the picture is `wwᴿ` (even palindromes): it is non-deterministic, so one picture shows the badge, the list of competing pairs and the table.

## What this is

The PDA editor is the FSM editor with a different document. The canvas, the four tools, the gestures, the undo history, the panel (22 rem on a laptop, under the canvas on a phone, with the draggable bar), the autosave to the device and the bar of the page do not change; the worker reuses them. This sheet only says what is different. If a rule is not named here, the FSM rule holds.

## 1. How a student gets here

- The mode switcher (`WorkstationSwitcher`) enables the item **Otomata Pushdown (PDA)**. The badge "Segera Hadir" goes away. The address is `/sandbox?mode=pda`, and the choice is kept as the other modes are. The page title, the mode bar and the chips use the same strip as the FSM editor.
- An empty PDA editor shows the same first-run card as the FSM editor ("Coba contoh", "Mulai dari kanvas kosong", "Buka file .jff atau JSON"). The examples are in question 4.
- **Mesin saya** lists FSMs and PDAs in one list. A row has a small type chip ("FSM", "PDA"); opening a PDA switches the page to the PDA mode (question 3).

## 2. The diagram (frame A)

- **Same drawing rules** as the FSM editor (state radius, accepting ring, start triangle, rim-to-rim arrows, loops, curves for opposite edges, halo behind labels). Edges are drawn per pair (from, to), as now.
- **The label is `c / pop / push`**, one line for each transition of the edge, in `--font-mono`, with ` / ` between the three parts (Rich's and the slides' notation; JFLAP's `c, γ1; γ2` is not used). `c` is the input symbol or `ε`. `pop` and `push` are strings of stack symbols, **leftmost is the top of the stack** (the slides' rule). An empty string is written `ε`. If every stack symbol has one character, a string is written without spaces (`AB`); if the stack alphabet has a longer name (`Z0`, `T_a`), the symbols are separated by a space (`Z0 A`).
- **Order of the lines** is the order of the transition table (the engine's sort: from, read with ε first, pop, push, to). So the diagram, the table and the definition agree.
- **At most three lines on the diagram.** An edge with three transitions or fewer shows one line for each; with more, it shows the first two and a third line `+ n lagi`, where n is the number that are hidden (four transitions: two lines and `+ 2 lagi`). `+ n lagi` is a button (44 px high on touch, the same hit rules as an edge label). It selects the edge and opens the Tabel tab with the rows of that edge marked. The table is the full view. This is the only change to the label geometry: the box grows away from the line (upward for an edge to the right, outward for a loop), by 18 px for each line after the first (20, 38 and 56 px high for one, two and three lines; the 12 px of the picture is the picture's scale), and the "no label covers a state or another label" test of the FSM geometry must still hold with up to three lines.
- **Competing transitions** are drawn dashed in `--color-warning` **only when the machine is a DPDA** (they are errors there). In an NDPDA the same pairs are normal: the edges stay solid, and the badge reports them (section 5).
- **Start marker** is the hollow triangle of T-018. There is no bottom-of-stack symbol anywhere: the stack starts empty (decision of 2026-11-05).

## 3. The panel and its tabs (frames A and B)

- **T-033 ships two tabs: Tabel, then Definisi.** T-038 (the panel for simulation and conversions, with its own wireframe P-005) adds **Simulasi as the first tab and Konversi as the last**, so the order becomes Simulasi, Tabel, Definisi, Konversi as in the FSM editor. T-033 must not leave a disabled tab behind, and T-038 must not move Tabel or Definisi.
- ARIA tabs, the remembered tab (`webtomata.panel.tab`, a value the PDA editor does not know falls back to Tabel), the scroll of each tab and the draggable bar on a phone are the FSM rules.
- **Under the tab strip, in both tabs, the same head block:** the kind switch (4), the badge (5) and the one-line "Pemeriksaan" (the checks of `validate_pda`, shown as the FSM checks are: a count or "lengkap", the list only when asked for; pressing a check selects and focuses the state or transition). The checks and their keys are those of T-030: `pda.no_start_state`, `pda.no_accepting_state`, `pda.unreachable_state`, `pda.duplicate_transition`, `pda.pop_never_pushed`, and for a DPDA `pda.competing_transitions` and `pda.accepting_state_free_move`.

## 4. The kind switch (frames A and B)

Two radio buttons, **DPDA | NDPDA**, at the top of the Tabel and Definisi tabs, as the DFSM | NDFSM switch is. The default is NDPDA. It is one undo step, it is announced, and a wrong choice never blocks editing: choosing DPDA for a machine with competing pairs only turns the badge into a warning and dashes the edges.

## 5. The determinism badge (frames A, B and B')

One button under the kind switch, full width of the panel, 44 px high on touch. It reads the result of `pda_determinism` (T-030):

| Machine | Badge | Tone |
| --- | --- | --- |
| No transitions yet | not shown | |
| No competing pair | **Deterministik** | `--color-success-tint` with `--color-success-ink` |
| NDPDA with `n` pairs | **Non-deterministik · n pasangan bersaing ▾** | `--color-neutral-tint` (information, not a fault) |
| DPDA with `n` pairs | **Bukan DPDA · n pasangan bersaing ▾** | `--color-warning-tint` with `--color-warning-ink` |

- **The list opens under the badge** (frame B'), not in a popover, so a phone needs no new pattern. The badge is a disclosure button (`aria-expanded`, `aria-controls`). It is closed when the page opens.
- **A pair** is a card with: the state (`q0:`), the two transitions in the label form joined by `↔`, one sentence that says why they compete, and a button **Tunjukkan**. The reason is built in the UI from the two transitions and the three cases of the definition: (a) both read the same symbol; (b) one of them reads `ε`; and in all cases (c) one pop is a prefix of the other (an empty pop is a prefix of every pop). Draft: "Keduanya membaca {c}, dan pop {p1} adalah awalan dari pop {p2}." / "{Salah satunya} tidak membaca input, dan pop {p1} adalah awalan dari pop {p2}." The engine returns only the two indices; the sentence is a message key with parameters (`pda_editor.compete_same_read`, `pda_editor.compete_epsilon_read`).
- **Tunjukkan** selects the two transitions: both edges get the selection stroke, both rows of the table get the accent bar, and the focus goes to the first row of the table when the Tabel tab is open (with the Definisi tab open it stays on the button, which keeps its pressed state; amended 2026-11-09). Pressing it again on the same pair clears the selection. The selection is not in the document or the history.
- A note under the list says, for an NDPDA: "Pada NDPDA ini boleh. Pada DPDA setiap pasangan menjadi kesalahan." and for a DPDA: "Pada DPDA ini tidak boleh. Ubah salah satu transisi, atau pilih NDPDA."

## 6. The Tabel tab (frames A and D)

Three blocks, from the top, under the head block. The table is the accessible alternative to the diagram, so it can do everything the canvas can.

1. **Alfabet.** Two rows of chips: **Alfabet input Σ** and **Alfabet stack Γ**, each with a `+` chip (a symbol is one name of up to 32 characters; `eps` and `ε` cannot be a name; a name in use is removed by its chip's menu, with the FSM's `removeSymbol` rule: the transitions that use it go too, as one undo step, with a toast and Urungkan). Symbols typed in a transition are added to the alphabet by themselves, as in the FSM editor.
2. **State.** One row per state: the name (press to rename), a radio **mulai** (one start state) and a checkbox **accepting**, and a delete button. A **+ State** button.
3. **Transisi (n).** The columns **Dari, Baca, Pop, Push, Ke** and a delete button; one row for each transition, in the engine's order. **Dari** and **Ke** are choosers of states, **Baca** is a chooser of the input symbols with `ε` first, **Pop** and **Push** are text fields (the typing rules of section 8). **+ Tambah transisi** adds an empty row that is sent when it is complete. A row that the engine refuses (`pda.duplicate_transition` is a warning, not a refusal) shows its message under the row. On a phone the table scrolls sideways inside the panel with the first column fixed (the FSM rule). A row marked by "Tunjukkan" or by `+ n lagi` has the accent bar at its left; a row in a pair of a DPDA has the warning tint and bar (frame A shows the first row as it looks in a DPDA).

## 7. The Definisi tab (frame B)

Read only, in `--font-mono`, in the form of the slides: `M = (K, Σ, Γ, Δ, s, A)`, then `K`, `Σ`, `Γ`, `s` and `A` as sets, then **Δ** as one line for each transition, `((q0, a, ε), (q0, A))`: `((from, read, pop), (to, push))`, `ε` for an empty read and for an empty string, **leftmost is the top**. The order is the engine's. A line under the block says: "Kiri = puncak stack. ε pada pop: tidak memeriksa stack." The tab has the same head block as the Tabel tab.

## 8. Editing the label of an edge (frames C and E)

This is the one new interaction. A transition has three parts, so the FSM's single field is replaced by a small form:

- **Opening** is as in the FSM editor (select the edge and press `Enter` or `F2`, double-click the label, long-press then "Ubah transisi", or it opens by itself after "Add a transition"). It opens a form with one row for each transition of the edge (a new edge has one empty row): three fields **Baca**, **Pop**, **Push**, and a **Hapus** button on the row. Below: **+ Transisi lain di antara q0 dan q1**, a hint, **Batal** and **Simpan**. On a laptop it is a popover on the edge (frame C); on a phone it is a sheet that replaces the panel while it is open (frame E), and the buttons **Ketik ε**, **Batal** and **Simpan** are in the form itself, on laptop and phone alike (decision of 2026-11-07).
- **Fields are at least 16 px and 44 px high on touch.** `Tab` goes from field to field and from row to row. `Enter` sends (Simpan), `Esc` cancels, leaving the form by pointer sends if every row is valid and changed (the FSM rule). The first field has the focus.
- **Baca:** one input symbol, or `ε` (the word `eps`, the character `ε`, `Ctrl+E`, the **Ketik ε** button, or an empty field). A read field holds one symbol: when the text is a longer new name and the input alphabet has only one-character symbols, the row is refused with a calm sentence (make two rows, or add the name to the input alphabet in the Tabel tab); there is no `ask_split` question (decision of 2026-11-07).
- **Pop and Push:** a string of stack symbols, leftmost on top. If every symbol of the stack alphabet has one character, each character of the text is a symbol (`AB` is `A` then `B`; spaces and commas are ignored). If the stack alphabet has a longer name, the symbols are separated by spaces or commas. An empty field and `ε` are the empty string. There is no slash syntax: the three fields are the three parts.
- **The hint** under the rows is always the same: "Kiri = puncak stack. Pop ε tidak memeriksa stack." It says in one line the two rules that students get wrong.
- **What is sent:** one `batch` for the edge, as the FSM does: `addSymbol` for each new input or stack symbol, `addTransition` for each new row, `removeTransition` for each row that is gone or changed, so one Simpan is one undo step. An empty form on an existing edge, with every row deleted, removes the edge (announced, with Urungkan).
- **Errors** (`document.invalid_symbol`, `document.limit_exceeded`, `pda.string_too_long` for more than 64 symbols) show under the field; the form stays open.

## 9. The phone (frames D and E)

The bar, the dock at the bottom, the panel with its drag bar, the 44 px targets, the title that gives way and the 40% default are the FSM rules. The head block is one row at 360 px: the two switch buttons and the badge shortened to **Non-det. · 2 ▾** (full text for a screen reader through `aria-label`). The label form of section 8 is a sheet; the pair list of section 5 opens inline. Nothing in the PDA editor needs a hover.

## Files and export

- **Open a file:** the FSM importer already tells a PDA by `jff.unsupported_type { type: "pda" }` (T-032); the PDA editor opens it with `parse_pda_jff`, and the FSM editor offers "Buka di mode PDA". A JSON file is told by its `kind` (`dpda`, `ndpda`).
- **Export `.jff`** works through `to_pda_jff`. A machine with a stack or input symbol of more than one character (`Z0`, `T_a`, `S0` from the conversions) cannot be exported: the dialog shows `jff.symbol_not_single_character { symbol }` calmly and offers JSON.
- **Share link:** not in T-033 (question 3).

## Message keys (drafts, `id` and `en` both needed; texts are `TODO(review)` until the feedback guide)

`pda_editor.mode_name`, `pda_editor.kind_dpda`, `pda_editor.kind_ndpda`, `pda_editor.badge_deterministic`, `pda_editor.badge_nondeterministic { count }`, `pda_editor.badge_not_dpda { count }`, `pda_editor.compete_same_read { read, pop1, pop2 }`, `pda_editor.compete_epsilon_read { pop1, pop2 }`, `pda_editor.compete_show`, `pda_editor.note_ndpda_ok`, `pda_editor.note_dpda_no`, `pda_editor.alphabet_input`, `pda_editor.alphabet_stack`, `pda_editor.col_from`, `.col_read`, `.col_pop`, `.col_push`, `.col_to`, `pda_editor.add_transition`, `pda_editor.edge_more { count }`, `pda_editor.label_hint`, `pda_editor.form_title { from, to }`, `pda_editor.form_add_row`, `pda_editor.definition_hint`. Announcements reuse `editor.edge_changed` with the label form (`ε / ε / ε`) and add `pda_editor.pair_selected { first, second }`. Terms for `docs/glossary.md` (`TODO(review)`): pasangan bersaing (competing pair), deterministik and non-deterministik for PDA, puncak stack (top of the stack; the glossary has "stack").

## What the five tasks include, and what they do not

**Includes:** the mode and its first-run examples, the diagram with the three-line label, the three-field label form, the Tabel and Definisi tabs, the kind switch, the badge with its list and "Tunjukkan", the checks line, save on the device, "Mesin saya" with the type chip, `.jff` and JSON open and export, undo and redo for every edit, the phone layout, and tests (geometry with three label lines; the table and the diagram agree; the badge for the three cases; keyboard; axe; one e2e that builds `wwᴿ`).
**Does not include:** simulation and the stack picture (T-038), the conversions and their traces (T-038), the share link, selecting several items on touch, auto layout of a PDA (the FSM's auto layout is used if it works on the PDA document without change; if not, it waits), the NDPDA to DPDA conversion (it does not exist in general).

## Questions, and the owner's answers (2026-11-06: the planner's pick on all five)

1. **The label form.** Three fields for each transition (this sheet), or one text field written as `a / ε / A`? Pick: three fields. They are easier to use on a phone (no `/` or `ε` hunting in a single string), they need no parser, and the hint can sit under the fields. The cost: two more taps for a student who types fast on a laptop; `Tab` and `Enter` keep that short.
2. **The badge for an NDPDA** is neutral information (this sheet), or a warning? Pick: neutral. A non-deterministic PDA is normal in the course; it is a fault only when the student chose DPDA.
3. **Saved machines and sharing.** One list in "Mesin saya" with a type chip, and no share link in T-033 (this sheet), or a separate list, or the share link now? Pick: one list, share link later (a small task after T-033, with the prefix `p1u=` next to `m1u=`).
4. **The three examples** for the first run: **aⁿbⁿ, n ≥ 1** (a DPDA), **wcwᴿ** (a DPDA, the slides' own example) and **wwᴿ** (even palindromes, an NDPDA; the picture). None is a homework language (HW06 uses `aⁱbʲcᵏdᵐ$`, `3#a(w) = 4#b(w)` and `aⁱbʲ$: i ≤ j ≤ 2i`). Pick: these three. Say which to change.
5. **At most three lines on an edge.** Then `+ n lagi` (this sheet), or the label grows without a limit (as the FSM's does)? Pick: three, because a PDA edge can hold many transitions and a tall label covers its neighbours; the table has them all.
