# 0059. "Mesin baru" and delete across FSM and PDA modes

Status: accepted

## Context

Three faults remained after T-074 unified FSM and PDA machines in "Mesin saya":

1. **In PDA mode, "Mesin baru" created an FSM record.** `LibraryDialog` calls `library.newMachine()`, which unconditionally saved and opened a new FSM document as `library.current` and closed the dialog while the screen stayed in PDA mode.
2. **In PDA mode, deleting the FSM's current record left it as `library.current`.** The branch in `deleteMachine` that replaces `this.current` required `this.mode !== 'pda'`. Deleting the open FSM record from PDA mode removed it from IndexedDB after six seconds, but switching back to FSM mode displayed the deleted machine and the next edit wrote it back.
3. **In FSM mode, deleting a PDA row and switching to PDA mode within six seconds reopened the pending-delete PDA.** During the six-second undo window, `store.list()` and `store.get(id)` still return the record. When `PdaWorkstation` mounted on mode switch, `openLatestPda` (or a stale `pdaOpenRequest` on the page from an earlier open) read the store directly and opened the deleted PDA.

## Decision

1. **`newMachine(keepOpen = false)` follows the active mode when called from the dialog (`!keepOpen`):**
   When `this.mode === 'pda' && !keepOpen`, `library.newMachine` calls `await this.newPdaMachine()`, closes the dialog (`if (!problem) this.hide()`), and returns `problem`. Callers that pass `keepOpen = true` (specifically `deleteMachine`'s fallback when replacing the last deleted FSM) still create a new empty FSM document via `openDocument(createDocument(), true)`.
2. **Deleting the FSM's `library.current` replaces it regardless of active mode:**
   The `else if (this.current?.opened.record.id === id)` branch in `deleteMachine` drops `this.mode !== 'pda' &&`. When the FSM's current record is deleted from PDA mode, `library.current` is updated to the next readable FSM row (or a new empty FSM when none remains) with `keepOpen = true`, without switching modes or touching the open PDA.
3. **Pending deletes are skipped when `PdaWorkstation` loads or opens a PDA by ID:**
   - `library` exposes `isPending(id: string): boolean` delegating to `this.pending?.isPending(id) ?? false`.
   - `PdaWorkstation` passes `openLatestPda` a store view whose `list()` filters out records where `library.isPending(r.id)` is true, keeping `pda-work.ts` unchanged.
   - `openPdaById(id)` in `PdaWorkstation` returns `library.missing` when `library.isPending(id)` is true, and `selectMode` in `sandbox/+page.svelte` clears `pdaOpenRequest = null` when leaving PDA mode (`activeMode === 'pda' && mode !== 'pda'`).

## Consequences

- "Mesin baru" in PDA mode creates and opens a blank PDA with the first-run card and adds no FSM record.
- Deleting the FSM's current record from PDA mode leaves a valid FSM ready when switching back to FSM mode, even when the deleted FSM was the last FSM on the device.
- Deleting a PDA record in FSM mode and switching to PDA mode within the six-second undo window opens the next readable PDA (or a new empty PDA), while "Urungkan" still restores the deleted row.
- First-JS grows by +38 bytes on `sandbox.html` and +27 bytes on the other routes (within the 102-byte limit).
