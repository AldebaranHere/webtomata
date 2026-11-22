# PDA: simulation, the stack, and the conversions (P-005, proposal)

**Status:** proposal, 2026-11-23. The owner approves it (the questions at the end) before T-038 is split and written.
**Picture:** `pda-simulation-conversion.svg` (four phone frames, A to D; the letters below are the letters in the picture).
**Sources:** `design/screens/pda-editor.md` (the panel and its tabs), the FSM's Simulasi panel and conversion panel as built (`RunPanel.svelte`, `ConversionPanel.svelte`), the CNF stepper (`design/screens/cnf-stepper-homework-order.md`), and the engine as built: `simulate_pda` (T-031, ADR 0035), `cfg_to_pda_topdown` and `cfg_to_pda_bottomup` (T-034, T-035), `pda_to_rnf` (T-036), `pda_to_cfg` (T-037).

## What this is

The PDA editor gets the two tabs that `pda-editor.md` reserved: **Simulasi as the first tab and Konversi as the last**. The engine can already do all of it; this sheet says how a student sees it. It copies the FSM's words and layout wherever the FSM has them, so that a student who knows one editor knows the other (rule 1 of `editor-bar-phone.md`: same place, same meaning).

## 1. The Simulasi tab (frames A and B)

The same blocks as the FSM's Simulasi tab, in the same order, with two additions (the stack and the peak):

- **At the top of the pane (amended 2026-11-23):** the kind switch, the determinism badge and the checks, as in the Tabel tab (the frames omit them). The step line counts from 1: "Langkah 1 dari N".
- **String masukan** (text field, hint "Kosongkan untuk string kosong (ε)."), the buttons **Jalankan**, **Kembali ke awal**, **Langkah sebelumnya**, **Langkah berikutnya** (the FSM's names and keys), the line **Langkah n dari N**, and **Simbol yang dibaca**: the input as cells, the symbols already read shaded.
- **The stack (new).** A vertical column of cells under the input, **top at the top**, labelled "Stack (puncak di atas)", with the bottom drawn as a heavy line and an arrow "← puncak" at the first cell. An empty stack shows only the line and the word "kosong". The cells show the symbols of Γ in `--font-mono` (a symbol of several characters is one cell). The current **state name** is written next to the label. Up to 8 cells are drawn; a taller stack shows the top 7 cells, a cell "… n lagi", and the bottom line (the full stack is in the text row of the list below).
- **The computation list** (the FSM's "Komputasi"): one row for each step, `n  c / pop / push   state   stack: …` (the transition in the label form of the diagram, the stack top first, `ε` for an empty string). The current row is highlighted; a tap on a row jumps to it; rows before the window say "… n baris sebelumnya" as the FSM does.
- **On the canvas** the current state gets the accent ring (as in the FSM) and the transition that was used gets the selection stroke. The canvas does not draw the stack.
- **The verdict** is the FSM's box: **Diterima** (green) or **Ditolak** (the calm red of `feedback-copy.md`), with one sentence for the reason, built in the UI from the engine's message key: `input_left` ("Masih ada n simbol masukan yang belum dibaca"), `stack_not_empty` ("Input habis, tetapi stack belum kosong (n simbol)"), `not_accepting` (the state is not accepting). A DPDA and an NDPDA are treated the same.
- **What is shown is one computation.** A line under the verdict says so: for an accepted run it is the computation that accepted; for a rejected run it is "komputasi yang paling jauh" (the engine ranks them; T-031). The student is not shown the whole BFS tree.
- **The peak (new).** Under the verdict: **Konfigurasi bersamaan terbanyak: n**, with one grey line: "Banyaknya komputasi yang hidup di satu tingkat BFS. DPDA selalu 1." and **Dijelajahi: m konfigurasi**. This is the number that the course's homework asks for (T-031 Goal), so it is always shown, never hidden behind a button.
- **Stopped runs.** When a budget is hit (`maxSteps`, `maxConfigurations`, `maxStack`) the verdict box is neutral: "Dihentikan: batas langkah tercapai" (one sentence for each reason) with the partial computation and the peak so far. No hang, no blank panel.
- **Uji banyak string** (frame B): the FSM's list, with one more column. A field "Tambah string…", then rows `string | Hasil | Puncak`, the verdict as the FSM shows it (✓ Diterima, ✗ Ditolak) and the peak of that string. A tap on a row runs it in the panel above. The build task reads how the FSM's list calls the engine and does the same with `simulate_pda` (one call for each user action; no call for each step).
- **Accessibility:** the stack is an ordered list (`<ol>`) in top-first order with `aria-label="Stack, puncak di atas"`; the cells are list items; the state and the stack are said in the live region at each step ("Langkah 2 dari 5: state q0, stack A A, puncak A"). Every control is a 44 px target and keyboard reachable.

## 2. The Konversi tab: PDA to a grammar (frame C)

The tab holds the conversions whose **input is the open PDA**. In this version that is one: **PDA → tata bahasa (CFG)**, in the two stages of the slides (Slide13).

- **Two stage chips** (pills, as the CNF stepper's phases are): **1 Bentuk normal terbatas** (RNF, T-036) and **2 Tata bahasa** (T-037). Stage 2 uses the result of stage 1.
- **A stepper** in the panel, with the CNF stepper's controls: **Langkah n dari N**, **Sebelumnya**, **Berikutnya**, one sentence for the step (a message key with parameters; the engine writes no sentences), and the changes of the step:
  - **Stage 1:** **Dihapus** (the transition that is split, struck through, in the label form) and **Ditambah** (the transitions that replace it, highlighted). The step that adds the new start state `s'` and the new single accepting state says so.
  - **Stage 2:** **Ditambah**: the grammar rules that the step adds, in the grammar's own notation (`<q,A,r> → …`), highlighted; below, the rules so far.
- **The canvas shows the result, read only**, while a conversion is open (as the FSM's `ConversionCanvas` does): stage 1 draws the RNF machine with the new states and transitions of the current step highlighted (green) and the caption "Hasil (hanya baca): bentuk normal terbatas"; stage 2 keeps the RNF machine (a grammar is not drawn on the canvas). A button **Tutup konversi** returns to the editor; nothing of the student's machine is changed by looking.
- **The ends.** At the last step of stage 1: **Buka PDA ini sebagai mesin baru** (a new saved PDA, named after the source, "(RNF)") and the button to stage 2. At the last step of stage 2: **Buka sebagai tata bahasa**: the grammar opens in the grammar mode as a new custom grammar (as the CNF result does, T-023), and the mode switches.
- **A machine that is not valid or has no start state** shows the engine's refusal as a calm sentence in the tab (the validation's message), and no stepper.
- **Not here:** NDPDA → DPDA (it does not exist as an algorithm for PDAs), and any conversion whose input is not a PDA.

## 3. Grammar mode: a third tab "Ke PDA" (frame D)

CFG → PDA has a **grammar** as its input, so it lives with the grammar: the grammar workstation's column 3 gets a third tab, **Ke PDA**, next to "Transformasi CNF (6 Fase)" and "Uji String (CYK)".

- **Metode:** two radio buttons, **Atas-bawah** (`CFGtoPDAtopdown`, T-034) and **Bawah-atas** (`CFGtoPDAbottomup`, T-035), the names of the slides.
- The same **stepper** as in section 2: **Langkah n dari N**, the sentence of the step (the rule that becomes a transition), **Ditambah** (the transition, highlighted) and **Sudah ditambahkan** (the ones before).
- **The end:** **Buka sebagai PDA baru**. It opens in the PDA mode as a new saved PDA, named after the grammar ("… (PDA atas-bawah)"); the grammar stays as it was. The states `p` and `q` (and the states of the bottom-up machine) keep the names that the slides use.
- **A grammar that the engine refuses** (the message of `cfg_to_pda_*`) shows as a calm sentence; no stepper.

## 4. Phone and laptop

Frames A to D are the phone: the panel under the canvas, with the draggable bar, as the FSM's panel. On a laptop the same blocks are in the 22 rem side panel, in the same order. The stack column keeps its width (a cell is 70 px wide at most); nothing needs a hover. The tour (T-081) says "(pada mode FSM)" in steps 4 and 5; when the Simulasi tab ships, the build task removes that note and checks the tour test.

## 5. Message keys (drafts; `id` and `en` both needed; new PDA keys go in `pda-messages.ts`, ADR 0050)

`pda_sim.stack`, `pda_sim.stack_top`, `pda_sim.stack_empty`, `pda_sim.stack_more { count }`, `pda_sim.state { name }`, `pda_sim.peak { count }`, `pda_sim.peak_help`, `pda_sim.explored { count }`, `pda_sim.shown_accepted`, `pda_sim.shown_furthest`, `pda_sim.reject.input_left { count }`, `pda_sim.reject.stack_not_empty { depth }`, `pda_sim.reject.not_accepting`, `pda_sim.stopped.max_steps`, `pda_sim.stopped.max_configurations`, `pda_sim.stopped.max_stack`, `pda_sim.step_announce { position, total, state, stack, top }`, `pda_convert.title`, `pda_convert.stage_rnf`, `pda_convert.stage_cfg`, `pda_convert.removed`, `pda_convert.added`, `pda_convert.open_pda`, `pda_convert.open_grammar`, `pda_convert.close`, `pda_convert.result_caption`, `grammar.to_pda_tab`, `grammar.to_pda_topdown`, `grammar.to_pda_bottomup`, `grammar.to_pda_open`, and the engine's own step message keys (already in the dictionary from T-034 to T-037). New terms: "puncak" (top of the stack), "konfigurasi bersamaan terbanyak"; both `TODO(review)` in `docs/glossary.md` until the owner reviews them.

## 6. How it is built (three tasks, one after the other where they share files)

The engine has everything, but the wasm API may not expose the conversions yet (T-034 to T-037 are "engine only"); each task checks and adds the entry points it needs.

1. **T-038a, the Simulasi tab:** sections 1 and the removal of the tour's "(pada mode FSM)" note. Files: `PdaEditor.svelte`, the PDA side panel, a new run panel and stack component, `pda-messages.ts`.
2. **T-038b, the Konversi tab (PDA → CFG):** section 2, including the read-only result canvas, the "Buka … baru" actions and the cross-mode open.
3. **T-038c, "Ke PDA" in the grammar mode:** section 3.

T-038a first; T-038b and T-038c touch different workstations and can run at the same time.

## Questions, with the planner's pick

1. **Where does CFG → PDA live?** In the grammar mode, as a third tab (this sheet), or as an item of the PDA editor's Konversi tab with a picker for a saved grammar? Pick: the grammar mode. A student looking at a grammar wants the PDA of *that* grammar, and a picker adds a list to choose from; each conversion lives with its input.
2. **Where is the stack drawn?** As a column in the panel, top up (this sheet), or on the canvas beside the current state? Pick: the panel. The canvas is already busy with the diagram, and the panel is where the FSM shows its run.
3. **"Uji banyak string" in the first version** (this sheet; it makes the tour's step 5 true for the PDA), or only the single run first? Pick: include it, with the peak column; the FSM list is the model.
4. **The peak always visible** (this sheet), or behind a "Detail" button? Pick: always visible. It is the number the homework grades, and a DPDA's "1" is itself a teaching point.
5. **Three build tasks** (T-038a, b, c), or one? Pick: three. One screen at a time is reviewable on a phone, and b and c can run in parallel.
