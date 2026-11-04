# Grammar rule rows on a phone (P-003, proposal)

**Status:** approved by the owner on 2026-11-04: **option B** (the alternatives flow in one line), the phone layout applies at width ≤ 900 px **and** on every `pointer: coarse` screen, and "×" deletes without asking. It is task T-024. The text below keeps both options for the record; the picture shows both.
**Picture:** `grammar-rule-rows-phone.svg`.

## Problem

The rule matrix of the grammar Editor (`GrammarWorkstation.svelte`) has targets that are too small for a finger. The review of T-016 measured them; the rest are read from the CSS.

| Control | Size now | Needed |
| --- | --- | --- |
| Left-hand box | 64 × 26 px | 44 px tall |
| Alternative box | 45 × 22 px | 44 px tall |
| "+" (add alternative) | 24 × 24 px | 44 × 44 px |
| Symbol buttons (ε and the others) | about 20 px tall | 44 × 44 px |
| "+ Tambah Baris" | about 28 px tall | 44 px tall |

Second problem: deleting a row is only possible through the right-click menu (`oncontextmenu`). As far as the code shows, a phone has no other way. Android may open that menu on a long press; iOS Safari does not. Treat "delete a row on a phone" as missing until a real iPhone shows otherwise.

## Proposal

Phone only. The laptop layout does not change.

- Each rule is a **card** instead of a table row. The three column headers are hidden on a phone, because the card itself shows "variable → right-hand side".
- Card header: the left-hand box (72 × 44 px), the arrow, and a **delete button "×" (44 × 44 px)** at the right end. Its accessible name is the existing key `grammar.matrix_delete_row`. It deletes at once, like the right-click item does today, and undo stays as it is.
- Alternatives: two options, the owner picks one.
  - **A, stacked (recommended):** each alternative is a full-width box, 44 px tall, one under the other. The last line is a dashed button "+ Alternatif" (44 px tall). It is the easiest to hit and the easiest to build, but a long rule gets tall.
  - **B, flowing:** the alternatives stay in one flowing line with "|" between them, each at least 64 × 44 px, then a 44 × 44 "+" button. It reads like the textbook (`S → A B | a | ε`) but wraps unevenly on a narrow phone.
- The symbol bar keeps showing only for the active card. Its buttons become 44 × 44 px and wrap to a second line when needed.
- "+ Tambah Baris" becomes a full-width button, 44 px tall.

## Decisions of the owner (2026-11-04)

1. Option B: the alternatives flow in one line, as in the course notation.
2. Both: width ≤ 900 px (the same boundary as the phone tabs of T-016) and `pointer: coarse` (a tablet in landscape gets big targets too).
3. "×" deletes without asking, like the laptop menu.

## What the task will need to prove

- On a phone viewport, every control above measures at least 44 px in the target direction (Playwright, bounding boxes).
- A row can be deleted on a touch viewport with a tap, without a right-click.
- Keyboard and screen reader still reach every field, and the table semantics are not lost (this is the risky part of turning rows into cards; the task spec will say how).
- Laptop screenshots and tests do not change.
