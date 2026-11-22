# The editor bar on a phone: one bar for the FSM and the PDA mode (P-006, proposal)

**Status:** approved by the owner on 2026-11-22, with the planner's pick on all three questions at the end. It is built by T-081. The owner asked for it after a real-phone check: the bar of the FSM mode and the bar of the PDA mode differ, and the "?" button must stay usable.
**Picture:** `editor-bar-phone.svg` (the bars as built, and the proposal; 1 px in the picture is 1 CSS px).
**Sources:** the code at `staging` (`EditorFrame.svelte`, `Editor.svelte`, `PdaEditor.svelte`) and two phone screenshots of 2026-11-22.

## What is wrong now (measured in the code)

Both modes use one frame, `EditorFrame`. It has two slots, `actionsBeforeFit` and `actions`, and each mode fills them with its own buttons. That is why the bars drift apart.

| Button | FSM mode | PDA mode |
| --- | --- | --- |
| **Mesin** (the layers icon, opens "Mesin saya") | in the bar on a phone | in the bar on a phone: the same button and the same label |
| **?** (help, opens the tour) | in the bar | **missing** (`onhelp` is not passed) |
| **Share** | hidden on a phone; "Bagikan" is in the row of the machine in "Mesin saya" | a download icon **in the bar**, opens the PDA file dialog |
| **Auto layout** | hidden on a phone; it is in the menu of the empty canvas | does not exist |
| **Pas** (fit) | in the bar | in the bar |

A student who learns the FSM bar finds a different bar in PDA mode: "?" is gone, and a new icon has taken its place. The mode selector above the bar also changes its width with its label, and it shows a thick blue frame after a choice (it looks like a `:focus` ring; the build task checks).

## The rules (the principle, in three lines)

1. **Same place, same meaning.** A button that exists in both modes has the same slot in both. A button that one mode does not have is left out of the bar; the bar never shifts to close the gap, and never shows a dead button.
2. **High-discovery actions stay visible; low-frequency actions move to one place.** "?" is how a new student learns the tools, so it stays in the bar. File actions (share, download, open) all live in "Mesin saya", as T-075 already decided for "Buka file…".
3. **The bar holds actions on the document; the canvas holds actions on the view.** "Pas" changes the view (as zoom does), so it leaves the bar and floats on the canvas, as the controls of a map do.

## The proposal

**The bar, left to right:** the title (it gives way and ends with …, as now), the save status ✓, then **four slots of 44 × 44 px in this fixed order: 1 Mesin, 2 Bantuan (?), 3 Urungkan, 4 Ulangi.** The title gets about 140 px at 360 px wide; today it gets about 90 px.

- **Both modes show exactly this.** No other button is ever added to the bar on a phone without a new decision.
- **"Pas"** is a 44 × 44 px button with the fit icon (an outline of four corners) in the **bottom right corner of the canvas**, inside the canvas box, above the dock. Its accessible name is the same as today (`editor.fit`). It is part of the canvas, so it is the same in both modes. It must not cover the panel's drag bar or the dock.
- **"?"** opens the same tour in both modes. The tour's four tools (Pilih, Tambah state, Tambah transisi, Hapus) are the same in both editors, so the build task passes `onhelp` to the PDA editor, and only adds text if a step does not fit (the task says so in its pre-flight).
- **Share and download** move out of the PDA bar. On a phone, the row of the current machine in "Mesin saya" gets "Unduh" (the PDA file dialog), as the FSM row has "Bagikan". Export takes two taps in both modes.
- **The mode selector** is full width, 44 px high, with the same label pattern in both modes ("Mode Kerja: …"). The blue frame shows only for keyboard focus (`:focus-visible`), not after a tap.

**Laptop:** not redrawn. The same order rule holds (a button that both modes have is in the same slot); the PDA editor also gets "?". The PDA download stays where T-033 put it.

## What the build touches

`EditorFrame.svelte` (the bar slots and the floating "Pas"), `Editor.svelte` and `PdaEditor.svelte` (what each passes), `PdaWorkstation.svelte` and `LibraryDialog.svelte` (the "Unduh" action in the row), the mode switcher's styles, message keys for "Unduh" in the row (id and en), and the tests: a Playwright test that opens both modes at 360 px and checks that the bar has the same four buttons in the same order, 44 px targets, no horizontal scroll, and that "Pas" does not overlap the dock; an axe pass on both. It is one task for one worker; the size budget applies (the sandbox route is near its limit: the task reports bytes).

## Questions, and the owner's answers (2026-11-22: the planner's pick on all three)

1. **Move "Pas" onto the canvas** (this sheet), or keep it in the bar and accept a title of about 90 px? Pick: move it. The title is the part that truncates today, and fit is an action on the view. Risk: on a small canvas (the panel open at 40%) a 44 px button covers some of the drawing; the student can pan, and the build task checks it with the largest example.
2. **Is "?" in the bar for both modes** (this sheet), or one help item inside a menu? Pick: in the bar. A hidden help button is not found by the students who need it.
3. **Export in two taps for both modes** (this sheet), or a share/download button back in the bar? Pick: two taps. The FSM already works this way, and a fifth slot costs the title 44 px. If students export often (homework `.jff`), this is the first thing to revisit after the next phone test.
