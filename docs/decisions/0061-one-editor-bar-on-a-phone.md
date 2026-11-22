# 0061. One editor bar on a phone for the FSM and the PDA mode

Status: accepted

## Context

On a 360 px phone viewport, the editor bar of the FSM mode and the bar of the PDA mode drifted apart
(P-006, `design/screens/editor-bar-phone.md`): the PDA bar had no help (`?`) button and kept a
download button (`.files`) in the bar, the FSM bar put `?` before "Mesin saya", both kept "Pas"
inside the bar (leaving only 78 px for the title at 360 px), and the mode selector (`WorkstationSwitcher`)
changed width with its label and could retain an accent border after a touch tap.

## Decision

1. **One phone bar (`max-width: 39.99rem`), identical in FSM and PDA.** The bar holds the title
   (≥ 120 px at 360 px), the save status mark, and exactly four 44 × 44 px buttons in DOM and tab
   order: **1 Mesin, 2 Bantuan (`?`), 3 Urungkan, 4 Ulangi**. Both `Editor.svelte` and
   `PdaEditor.svelte` place `.machines` before `.help` in DOM order (no CSS `order:` reordering).
2. **"?" in the PDA mode.** `sandbox/+page.svelte` passes `onhelp={openTour}` through
   `PdaWorkstation.svelte` into `PdaEditor.svelte`. The PDA laptop bar gains `?` before `.files`
   (matching the FSM bar's `?` before `.share`). Steps 4 and 5 of the tour (`tour.s4_body`,
   `tour.s5_body`) append `(pada mode FSM)` / `(in FSM mode)` since PDA simulation ships in T-038.
3. **Floating "Pas" on the phone canvas.** `EditorFrame.svelte`'s single `.fit` button (already
   `display: none` on desktop, where `ZoomControl.svelte` owns "Pas") moves from `.bar` into
   `.stage` (`position: relative`) and floats at `right: var(--space-3); bottom: var(--space-3)`
   under `max-width: 39.99rem` with the text `"Pas"`. Under the same breakpoint, `EditorFrame`'s
   editor toast shifts to `bottom: calc(var(--target-min) + var(--space-5))` so it never intersects
   the floating button (the library dialog's toast is untouched).
4. **PDA download moves to "Mesin saya" on a phone.** `.files` is hidden under `max-width: 39.99rem`
   (as `.share` is in FSM mode). Every readable PDA row in `LibraryDialog.svelte` gets an `"Unduh"`
   (`library.download`) action (unreadable rows show neither `"Bagikan"` nor `"Unduh"`). The handler
   lives in lazy-loaded `LibraryDialog.svelte`, flushes `library.flushPda()` when downloading the
   currently open PDA, reads the saved document via `readPdaDocument(store, id)` in `pda-work.ts`,
   and opens lazy `PdaFileDialog.svelte`. `PdaFileDialog.svelte` imports `#lib/i18n/pda-messages.ts`
   so opening it from FSM mode never shows raw message keys.
5. **Mode selector (`WorkstationSwitcher.svelte`).** Under `max-width: 39.99rem`, the switcher fills
   100% of `.mode-bar`'s content width at 44 px height with ellipsis on the active mode name. Its
   `:hover` accent border is guarded by `@media (hover: hover)`, its transition is narrowed to
   `border-color` and `background-color` (never `all`), and `triggerBtn?.focus()` is kept so focus
   returns properly for screen-reader and keyboard users.

## Consequences

- Phone users see one consistent 4-button editor bar across FSM and PDA modes, with ~130 px for the
  title at 360 px and a floating "Pas" button that stays clear of the dock, panel handle, and toast.
- Keeping PDA row download plumbing inside lazy `LibraryDialog.svelte` kept `sandbox.html` first-load
  JS growth to +48 bytes gzip (all routes ≤ +48 bytes, within the 102-byte task budget) and left
  `first-load.test.ts` green.
- Honest limit: Playwright's mobile emulator does not reproduce sticky `:hover` on real Android
  Chrome, so the test verifies the computed border/outline after tap and that `.switcher-trigger:hover`
  is guarded by `@media (hover: hover)`; the owner confirms on a real phone before merge.
- Reversible: `git revert` restores the previous bar layout and buttons; no stored document format
  changed.
