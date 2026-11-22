# 0063. An untouched empty FSM is not listed in "Mesin saya" in the PDA mode

Status: accepted

## Context

`library.start` runs for every mode, so a student who comes only to use the PDA still gets an FSM
record: the library's current one, with no state and no transition. T-078 left that record as a
separate decision. Measured on a fresh profile at `/sandbox?mode=pda` (T-084 pre-flight): the store
holds two records — the empty FSM and the PDA — and the list shows both rows, the FSM row opens the
FSM mode and the count includes it. The pre-flight also measured that the button's count is stale:
it says (1) while the store already has two records, until the list has been opened once, because
`Library.start()` refreshes before `PdaWorkstation` creates its record and nothing refreshes after.

## Decision

1. **A filter, not a new record flag.** `Library.refresh()` passes the rows to
   `visibleEntries(entries, mode, currentFsmId)` (`web/src/lib/storage/library.ts`). In the PDA mode
   it leaves out an entry that is (a) an FSM, (b) the library's current FSM record and (c) empty.
   (b) is `this.current?.opened.record.id`, not `currentId`: `currentId` is the PDA's id in the PDA
   mode and would match nothing. The FSM mode hides nothing; an empty FSM that is not the current
   one stays listed; an empty PDA stays listed.
2. **Emptiness comes from the parse that `listEntries` already does.** `Entry.empty` is
   `states.length === 0 && transitions.length === 0` for a readable FSM record, and false for a PDA
   record and for one that cannot be read. No second store read, no regex.
3. **The count stays fresh.** `PdaWorkstation` calls `library.refresh()` once after its first load
   created or opened its record. That also fixes the stale count of before this task.
4. **Nothing stored changes.** The FSM record is still created as today; there is no migration.

The rule lives in `library.ts` rather than only inside `refresh()` because `vitest.config.ts` runs
plain TypeScript with no Svelte plugin, so a test cannot import the runes module; `library.ts` is
already where the rules without a framework live. `refresh()` applies the rule, and `count` derives
from the filtered rows, so the list and the count cannot disagree.

## Consequences

- A fresh PDA visit lists one row (the PDA) and counts 1; the store still holds the empty FSM.
  Switching to the FSM mode shows the empty machine; adding one state lists it in the PDA mode too.
- The list's rows and the button's count are the same fact (`entries`), which is why break B3 of the
  task needed a temporary unfiltered field to reproduce at all.
- Two existing e2e cases changed, because they asserted the row that is now hidden: T-074 F3 (it
  taps the empty FSM row on a fresh PDA visit to switch modes; it now opens a used FSM first) and
  T-078 F3 case B (after deleting the last FSM in the PDA mode the new empty FSM is the hidden one;
  it now asserts the record in the store, that the list does not show it, and that the FSM mode shows
  an empty machine).
- First-JS grows by 61 bytes on every route, and the wasm is unchanged.
- The `PdaWorkstation` now reaches into the library for one refresh, which is the first place the
  workstation writes to the list's state.
