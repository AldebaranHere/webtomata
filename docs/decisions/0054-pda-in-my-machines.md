# 0054. FSM and PDA machines in one "Mesin saya" list with shared store and openStore decoupling

Status: accepted

## Context

Prior to T-074, "Mesin saya" only listed FSM machines. PDA records stored in IndexedDB (`type: 'pda'`) were excluded from the list by `listEntries(store)`. The PDA editor had no "Mesin saya" button in its desktop title bar or mobile dock, and `PdaWorkstation` opened a second instance of `openStore('machines')`.

Additionally, the first-JS size budget for `sandbox` and `index` had strict ceilings. Because `openStore` was originally defined and exported from `storage/index.ts`, routes that only needed persistent machine storage (`soal`, `panduan`, `tentang`) inadvertently pulled in heavy library dialog and autosave dependencies.

## Decision

1. **One unified list with kind chips:**
   `listEntries(store)` returns both FSM and PDA records sorted by `openedAt` descending, breaking ties by `id`. The existing kind chip displays `DFSM`, `NDFSM`, `DPDA`, or `NDPDA`, identifying both the formalism and determinism without requiring a redundant "FSM"/"PDA" chip. PDA rows hide the "Bagikan" action button.
2. **Single store instance:**
   `PdaWorkstation` reuses `library.store` and `library.persistent` instead of opening a second IndexedDB handle.
3. **Mode switching upon opening machines:**
   Selecting an entry of the other kind triggers `selectMode` in `sandbox/+page.svelte` and loads that machine. `openEntry` in `library.svelte.ts` manages closing the dialog and switching modes.
4. **Deleting the open machine keeps the student in mode:**
   When deleting the open machine, the list opens the next readable machine of the *same* formalism (PDA opens next PDA; FSM opens next FSM). If no other machine of that kind exists, a new empty machine of that kind is created. The student is never switched into another workstation mode due to a deletion.
5. **PDA workstation hooks on library:**
   Because `PdaWorkstation` owns its autosave cycle and editor instance, it registers callbacks on the singleton `library`:
   - `flushPda`: flushes pending PDA autosaves before mode switches, deletes, or opens.
   - `openPda`: loads a PDA machine into the workstation by id.
   - `newPdaMachine`: initializes and saves a new blank PDA document.
   - `renameCurrent`: invokes `pdaEditor.setTitle(title)` for undoable renames of the open PDA.
6. **Decoupling `open-store.ts` and size budget allowance:**
   `openStore` and `OpenedStore` were extracted into `web/src/lib/storage/open-store.ts`, with re-exports maintained in `web/src/lib/storage/index.ts` so all external consumers remain unaffected.
   The owner accepted a one-time budget allowance for T-074 of up to +0.60 KB on `sandbox` and +0.55 KB on `index`. In return, decoupling `open-store.ts` reduced first-JS across `soal`, `panduan`, and `tentang` by ~1.2 KB each.

### First-JS Size Comparison

| Route | Staging Baseline | T-074 Final | Delta |
|---|---|---|---|
| `index.html` | 81.50 kB | 82.00 kB | +0.50 kB (within +0.55 kB allowance) |
| `sandbox.html` | 124.75 kB | 125.30 kB | +0.55 kB (within +0.60 kB allowance) |
| `soal.html` | 83.66 kB | 82.50 kB | -1.16 kB |
| `panduan.html` | 83.71 kB | 82.50 kB | -1.21 kB |
| `tentang.html` | 82.26 kB | 81.05 kB | -1.21 kB |

## Consequences

- "Mesin saya" offers seamless access to both FSM and PDA automata from both workstation modes.
- Deletions are safe and predictable, preserving the user's active mode.
- Non-sandbox routes benefit from lighter storage bundles.

