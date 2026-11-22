# 0058. The PDA label sheet fills a phone and keeps its buttons above the keyboard

Status: accepted

## Context

On a real Android phone (2026-11-18) the label sheet of the PDA editor (Baca, Pop, Push) was 320 px
wide, the width the laptop popover wants, set by `.form` in `PdaLabelForm.svelte`; on a 375 px screen
the right 55 px of the sheet was blank (40 px at 360 px). With the keyboard open, the row
"Ketik ε / Batal / Simpan" was behind it: the pre-flight measured the buttons at 204.5 to 248.5 css px
below the top of the sheet, past the 190 px the owner's keyboard leaves visible.

The page's viewport meta has no `interactive-widget`, so the keyboard does not resize the page: the
sheet keeps its place and the keyboard covers its lower part. Two ways out were rejected before the
task (docs/agent/DECISIONS.md, 2026-11-18): `interactive-widget=resizes-content` (an app-wide,
Chrome-only change for one sheet) and a visual-viewport script (more code than moving three buttons).

## Decision

1. **Width.** The form's own rule stays 320 px for the popover. The sheet gets one rule in
   `PdaEditor.svelte`, `.pda-sheet :global(.pda-label-form) { width: 100%; }` — a stylesheet rule, not
   an inline `style=` (the CSP's `style-src-attr` allows one hash only). `PdaLabelPopover.WIDTH = 320`
   stays: it centres the popover on the edge, and the popover's form is still 320 px.
2. **Order.** The DOM order becomes the fields, the refusal line (`aria-live`), then **Ketik ε, Batal,
   Simpan**, then "+ Transisi lain", then the hint, in the sheet and in the popover. The tab order
   follows the DOM, so a keyboard reaches the buttons before the add-row button.
3. **The rows list in the sheet** gets `max-height: 72px` (`.pda-sheet :global(.pda-label-form .rows)`)
   — one row of 44 px, the 8 px gap and 20 px of the next, so that a second row shows that the list
   scrolls. The popover keeps `max-height: 240px`. The add-row button's new row is still focused and
   scrolled into view by the browser.
4. **The keyboard's key.** All three inputs get `enterkeyhint="done"`. Enter keeps committing the edge
   from any field, as it did: a `next` key would send Enter and commit the transition, so it would lie
   about what the key does.
5. **The refusal is the exception.** Its line (74.5 px at full width) pushes the buttons about 34 px
   below the 190 px line with one row. Accepted: the student has just pressed Simpan, and the message
   is what to read; the keyboard can be closed. The test pins only that the refusal is above the buttons.

## Consequences

- Measured after the change at 375 × 667: one row puts the buttons at 105.5 to 149.5 css px below the
  top of the sheet, two or three rows at 133.5 to 177.5 — both inside the 190 px line.
- The width fix reflows the hint from two lines to one, so the sheet is 18.5 px shorter than before.
- The sheet shows about one and a half rows at a time; a third row scrolls inside the list.
- The empty `aria-live` wrapper (8 px) and the 4 px top margin of the action row stay: the numbers fit
  with them, and hiding the live region while it is empty could lose the announcement.
- **Limit, and why the tests measure geometry.** Playwright has no on-screen keyboard and cannot show
  the key of the keyboard. The fixtures measure the distance from the top of the sheet to the Save
  button; a test of "inside the viewport" would pass even without a fix. The owner re-checks the phone
  after the merge.
- **WebKit scroll clip (fixed in T-083).** With the 72 px cap, Safari's focus scroll left the newly
  added row's `Baca` field clipped by 11 px at its bottom (10 px past the 1 px assertion tolerance,
  deterministic on WebKit phone). Fixed in T-083 by calling `scrollIntoView({ block: 'nearest' })`
  on the new row's first input in `addRow`, bringing the clip to 0 px.
- Cross-browser coverage: `web/e2e/pda-label-sheet.spec.ts` runs on Chromium (`phone` and
  `desktop`), and T-083 added `web/e2e/cross/pda-label-sheet.spec.ts` covering width, the 190 px
  keyboard line, and new-row scroll on `firefox`, `webkit-phone`, `phone`, and `desktop`.
- First-JS: `sandbox.html` −1 byte, every other route ±0 (the form is in the lazy PDA chunks).
