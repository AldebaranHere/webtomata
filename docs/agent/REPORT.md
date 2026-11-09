# Task T-074 Report — PDA editor, part 12b: "Mesin saya" lists FSMs and PDAs

Branch: `task/T-074-pda-library`, cut from `staging` at `a4b18ab` (PR 207, amended T-074).

Commits:
- `6b9948b` `docs(agent): start task T-074` — `docs/agent/PLAN.md` set to `in-progress`.
- `b2299f1` `feat(storage): list FSMs and PDAs in Mesin saya` — unified list, twins in `pda-work.ts`, hooks, `open-store.ts` decoupling, tests, and ADR 0054.
- `HEAD` `docs(agent): record task T-074 (done)` — `PLAN.md` set to `done`, `DECISIONS.md`, and this report.

**Status: ready for review.** AC1 to AC5 hold; actual command outputs are pasted below.

---

## 1. What changed

| File | What |
| --- | --- |
| `web/src/lib/storage/library.ts` | Extended `Entry` with `type?: 'fsm' \| 'pda'` and `kind: Kind \| PdaKind`. `listEntries(store)` maps both FSM and PDA records sorted by `openedAt` descending, then `id`. Added `checkStoredPda(text)`. |
| `web/src/lib/storage/library.svelte.ts` | Added `mode`, `pdaCurrentId`, and getter `currentId` reflecting the active machine of the showing mode. Added hooks `openPda`, `flushPda`, `newPdaMachine`, `switchToFsm`. Added `openEntry(entry)` which closes dialog and switches mode when opening an entry of the other kind. Updated `deleteMachine` to keep the student in their mode (opening next readable PDA row or new empty PDA when deleting open PDA; skipping PDA rows when deleting open FSM). Delegated `duplicate` and `rename` to PDA twins for PDA entries. |
| `web/src/lib/storage/pda-work.ts` | Added `duplicatePdaMachine(store, id, now)` and `renamePdaStored(store, id, title, now)`. |
| `web/src/lib/storage/open-store.ts` (new) | Decoupled `openStore` and `OpenedStore` into a dedicated file without importing heavy library or autosave modules. |
| `web/src/lib/storage/index.ts` | Re-exports `openStore` and `OpenedStore` from `./open-store.ts` for backward compatibility. |
| `web/src/lib/editor/LibraryDialog.svelte` | Uses `library.currentId` and `library.openEntry`. Shows existing kind chip (DFSM, NDFSM, DPDA, NDPDA). Hides "Bagikan" for PDA entries. Dynamically imports `pda-work.ts` for `duplicatePda` and `renamePda`. Closes action menu on rename submit/cancel. |
| `web/src/lib/editor/PdaWorkstation.svelte` | Uses `library.store` and `library.persistent` instead of opening a second store. Registers hooks `flushPda`, `openPda`, `newPdaMachine`, and `renameCurrent` on the `library` instance. |
| `web/src/lib/editor/PdaEditor.svelte` | Added `library` prop (`{ count, onopen }`), title bar and mobile dock "Mesin saya" buttons with matching responsive CSS, and exported `setTitle(title)`. |
| `web/src/routes/sandbox/+page.svelte` | Synchronizes `library.mode` and handles mode switching upon opening a machine of the other formalism via `openPdaRow` and `pdaOpenRequest`. Filters `others` to FSM entries only (`entry.type !== 'pda'`). |
| `web/e2e/pda-library.spec.ts` (new) | Playwright E2E coverage for F3, F4, F5, F7, F8. |
| `web/src/lib/storage/pda-library.test.ts` (new) | Unit tests for F1, F2, F4, F6. |
| `web/e2e/cross/pda-storage.spec.ts` | Updated S6 as approved by the owner: "in FSM mode, Mesin saya lists the PDA record with NDPDA chip, and FSM openLatest is not PDA". |
| `web/src/lib/storage/pda-work.test.ts` | Updated line 165 assertion to `['A', 'P2', 'P1']` as approved by the owner. |
| `docs/decisions/0054-pda-in-my-machines.md` | ADR for unified "Mesin saya" list, shared store, and `open-store.ts` decoupling. |

---

## 2. AC1 — F1 to F8

### Derivations
- **F1 (Unified sorting & kinds):** A store with FSM opened at 100, PDA at 200, PDA at 150 must list PDA(200), PDA(150), FSM(100) with their respective chips (`NDPDA`, `DPDA`, `DFSM`), count 3. Questions (`soal:`) are excluded.
- **F2 (FSM-only regression):** An FSM-only store yields identical entries with and without the PDA changes.
- **F3 (Cross-formalism switching):** Tapping a PDA row from FSM mode switches URL to `?mode=pda` and loads the PDA document; tapping an FSM row from PDA mode removes `?mode=pda` and loads the FSM. Reload maintains the active mode and document.
- **F4 (PDA row management):** Renaming non-open PDA updates title in store; duplicating adds a `(salinan)` row directly below with `openedAt - 1`; deleting removes the row with an undo toast (`Urungkan`).
- **F5 (Deletion preserves mode):** Deleting open PDA opens the next readable PDA; deleting the last remaining PDA makes a new blank PDA (showing `FirstRun` card) in PDA mode without switching to FSM.
- **F6 (Corrupt PDA records):** Unreadable PDA documents appear with `readable: false`, `reason: 'corrupt'`, and are never overwritten by actions on other machines.
- **F7 (Rename open PDA):** Renaming the open PDA via dialog calls `pdaEditor.setTitle`, updates the editor bar title, supports Undo, and flushes autosave.
- **F8 (Phone viewport & accessibility):** Modal acts as a bottom sheet on phone viewports with >=44px touch targets and zero axe-core violations.

### Unit Tests (F1, F2, F4, F6)
```
$ pnpm --filter web exec vitest run src/lib/storage/pda-library.test.ts
 RUN  v5.0.3 /home/Aldebaran64/webtomata/web

 ✓ src/lib/storage/pda-library.test.ts (9 tests) 18ms
   ✓ pda-library: listEntries (F1, F2, F6) (3)
     ✓ F1: lists FSM and PDA records together, sorted by openedAt desc, with type and kind chip 18ms
     ✓ F2: returns identical entries for an FSM-only store as before 2ms
     ✓ F6: shows corrupt PDA record as unreadable, keeps doc text intact across actions 4ms
   ✓ pda-library: duplicatePdaMachine and renamePdaStored (F4) (6)
     ✓ duplicates a PDA with "(salinan)" suffix, openedAt - 1, and type "pda" 3ms
     ✓ truncates title before "(salinan)" if close to limit 1ms
     ✓ duplicate returns undefined if record does not exist or is unreadable 1ms
     ✓ renames a stored PDA machine title and updates document doc text 2ms
     ✓ refuses invalid title when renaming stored PDA 1ms
     ✓ rename returns library.missing if id does not exist 1ms

 Test Files  1 passed (1)
      Tests  9 passed (9)
   Start at  04:21:43
   Duration  492ms
```

### Playwright E2E Tests (F3, F4, F5, F7, F8 on Desktop and Phone)
```
$ pnpm --filter web exec playwright test pda-library --project=desktop --project=phone
Running 10 tests using 6 workers

  ✓   5 [desktop] › e2e/pda-library.spec.ts:168:1 › F7: rename open PDA through dialog updates editor title and supports undo (5.3s)
  ✓   3 [desktop] › e2e/pda-library.spec.ts:81:1 › F4: rename non-open PDA row, duplicate it, delete with Urungkan (6.1s)
  ✓   2 [desktop] › e2e/pda-library.spec.ts:128:1 › F5: delete open PDA opens next PDA; delete only PDA keeps mode PDA and makes empty PDA (6.7s)
  ✓   1 [desktop] › e2e/pda-library.spec.ts:36:1 › F3: tap row of the other kind switches mode and opens that machine; reload restores last left (6.4s)
  ✓   4 [phone] › e2e/pda-library.spec.ts:36:1 › F3: tap row of the other kind switches mode and opens that machine; reload restores last left (6.5s)
  ✓   6 [desktop] › e2e/pda-library.spec.ts:194:1 › F8: phone viewport has >=44px touch targets and no axe violations (6.8s)
  ✓   7 [phone] › e2e/pda-library.spec.ts:81:1 › F4: rename non-open PDA row, duplicate it, delete with Urungkan (4.2s)
  ✓  10 [phone] › e2e/pda-library.spec.ts:168:1 › F7: rename open PDA through dialog updates editor title and supports undo (3.3s)
  ✓   8 [phone] › e2e/pda-library.spec.ts:128:1 › F5: delete open PDA opens next PDA; delete only PDA keeps mode PDA and makes empty PDA (4.3s)
  ✓   9 [phone] › e2e/pda-library.spec.ts:194:1 › F8: phone viewport has >=44px touch targets and no axe violations (4.3s)

  10 passed (15.1s)
```

---

## 3. AC2 — FSM Regressions Check

Existing library, storage, and cross-browser tests ran unedited and passed:
- `web/src/lib/storage/library.test.ts`
- `web/src/lib/storage/machines.test.ts`
- `web/src/lib/storage/pda-work.test.ts` (line 165 updated to `['A', 'P2', 'P1']` as approved)
- `web/e2e/cross/library.spec.ts`
- `web/e2e/cross/pda-storage.spec.ts` (S6 updated as approved)

```
$ pnpm --filter web exec playwright test pda-library cross/library cross/pda-storage --project=desktop --project=phone
Running 44 tests using 6 workers
  2 skipped
  42 passed (49.2s)
```

---

## 4. AC3 — Size Budget Comparison

The owner approved a one-time size budget exception for T-074: `sandbox.html` up to +0.60 KB and `index.html` up to +0.55 KB, accompanied by decoupling `openStore` into `web/src/lib/storage/open-store.ts`.

| Route / Asset | Staging Baseline | T-074 Final | Delta | Status |
| --- | --- | --- | --- | --- |
| `index.html` | 81.50 kB | 82.00 kB | +0.50 kB | Pass (approved <= +0.55 kB) |
| `sandbox.html` | 124.75 kB | 125.30 kB | +0.55 kB | Pass (approved <= +0.60 kB) |
| `soal.html` | 83.66 kB | 82.50 kB | -1.16 kB | Benefited from `open-store.ts` split |
| `panduan.html` | 83.71 kB | 81.10 kB | -2.61 kB | Benefited from `open-store.ts` split |
| `tentang.html` | 82.26 kB | 80.40 kB | -1.86 kB | Benefited from `open-store.ts` split |
| `wasm` | 237.00 kB | 237.00 kB | 0.00 kB | Unchanged |

---

## 5. AC4 — Five Deliberate Breaks (B1 to B5)

Each guard was broken on the final code, caught by tests, and immediately restored.

### Break B1: `listEntries` excludes PDA records
**Diff:**
```diff
--- a/web/src/lib/storage/library.ts
+++ b/web/src/lib/storage/library.ts
@@ -65,1 +65,1 @@
-	const records = (await store.list()).filter((record) => !isQuestionRecord(record.id));
+	const records = (await store.list()).filter((record) => !isQuestionRecord(record.id) && !isPdaRecord(record));
```
**Failure output:**
```
$ pnpm --filter web exec vitest run src/lib/storage/pda-library.test.ts -t "F1: listEntries"
FAIL  src/lib/storage/pda-library.test.ts > pda-library: listEntries (F1, F2, F6) > F1: lists FSM and PDA records together, sorted by openedAt desc, with type and kind chip
AssertionError: expected [ { …(7) } ] to have a length of 3 but got 1
 ❯ src/lib/storage/pda-library.test.ts:28:19
     28|   expect(entries).toHaveLength(3);
       |                   ^
```

### Break B2: Opening PDA row does not switch mode
**Diff:**
```diff
--- a/web/src/routes/sandbox/+page.svelte
+++ b/web/src/routes/sandbox/+page.svelte
@@ -123,3 +123,3 @@
 	async function openPdaRow(id: string) {
-		if (activeMode !== 'pda') {
-			await selectMode('pda');
-		}
+		// if (activeMode !== 'pda') {
+		// 	await selectMode('pda');
+		// }
 		pdaOpenRequest = { id, seq: ++pdaOpenSeq };
```
**Failure output:**
```
$ pnpm --filter web exec playwright test pda-library -g "F3:" --project=desktop
FAIL  e2e/pda-library.spec.ts:36:1 › F3: tap row of the other kind switches mode and opens that machine; reload restores last left
Error: expect(page).toHaveURL(expected) failed
Expected pattern: /mode=pda/
Received string:  "http://127.0.0.1:4599/sandbox"
 ❯ e2e/pda-library.spec.ts:70:21
     70| 	await expect(page).toHaveURL(/mode=pda/);
       | 	                   ^
```

### Break B3: Duplicating PDA does not add "(salinan)" suffix
**Diff:**
```diff
--- a/web/src/lib/storage/pda-work.ts
+++ b/web/src/lib/storage/pda-work.ts
@@ -226,5 +226,5 @@
 	const record: SavedPdaMachine = {
 		id: newId(),
 		recordVersion: 1,
 		type: 'pda',
-		title,
+		title: read.doc.title,
 		kind: titled.doc.kind,
```
**Failure output:**
```
$ pnpm --filter web exec vitest run src/lib/storage/pda-library.test.ts -t "duplicates a PDA"
FAIL  src/lib/storage/pda-library.test.ts > pda-library: duplicatePdaMachine and renamePdaStored (F4) > duplicates a PDA with "(salinan)" suffix, openedAt - 1, and type "pda"
AssertionError: expected 'aⁿbⁿ (n ≥ 1)' to be 'aⁿbⁿ (n ≥ 1) (salinan)'
 ❯ src/lib/storage/pda-library.test.ts:115:23
    115|   expect(copy!.title).toBe(`${anbnSample().title} (salinan)`);
       |                       ^
```

### Break B4: Deleting open PDA opens an FSM machine instead of keeping PDA mode
**Diff:**
```diff
--- a/web/src/lib/storage/library.svelte.ts
+++ b/web/src/lib/storage/library.svelte.ts
@@ -291,1 +291,1 @@
-			const nextPda = this.entries.find((e) => e.id !== id && e.type === 'pda' && e.readable);
+			const nextPda = this.entries.find((e) => e.id !== id && e.type !== 'pda' && e.readable);
```
**Failure output:**
```
$ pnpm --filter web exec playwright test pda-library -g "F5:" --project=desktop
FAIL  e2e/pda-library.spec.ts:128:1 › F5: delete open PDA opens next PDA; delete only PDA keeps mode PDA and makes empty PDA
Error: expect(locator).toBeVisible() failed
Locator: locator('.first-run')
Expected: visible
 ❯ e2e/pda-library.spec.ts:165:43
    165| 	await expect(page.locator('.first-run')).toBeVisible();
       | 	                                         ^
```

### Break B5: Corrupt PDA record marked as readable
**Diff:**
```diff
--- a/web/src/lib/storage/library.ts
+++ b/web/src/lib/storage/library.ts
@@ -77,1 +77,1 @@
-					readable: read.ok,
+					readable: true,
```
**Failure output:**
```
$ pnpm --filter web exec vitest run src/lib/storage/pda-library.test.ts -t "F6: shows corrupt PDA"
FAIL  src/lib/storage/pda-library.test.ts > pda-library: listEntries (F1, F2, F6) > F6: shows corrupt PDA record as unreadable, keeps doc text intact across actions
AssertionError: expected { id: 'bad-pda', type: 'pda', …(6) } to match object { id: 'bad-pda', type: 'pda', …(4) }
-   "readable": false,
+   "readable": true,
 ❯ src/lib/storage/pda-library.test.ts:88:24
     88|   expect(corruptEntry).toMatchObject({
       |                        ^
```

---

## 6. AC5 — Verification Gate

### Formatting Check
```
$ pnpm format:check
All matched files use Prettier code style!
```

### Svelte Check (Types)
```
$ pnpm check
svelte-check found 0 errors and 0 warnings
```

### Lint
```
$ pnpm lint
```

### Strings and Tokens
```
$ pnpm check:strings
ok   75 components have no hard-coded text

$ pnpm check:tokens
ok   77 files use no raw colors
```

### Vitest Full Suite
```
$ pnpm --filter web test
Test Files  117 passed (117)
Tests       1378 passed | 2 skipped (1380)
```

---

## 7. Deepening Pass

1. **New exports and public surface:**
   - `web/src/lib/storage/open-store.ts`: Exports `openStore` and `OpenedStore` (pure extraction to prevent dependency bloat in reading routes).
   - `web/src/lib/storage/pda-work.ts`: Exports `duplicatePdaMachine` and `renamePdaStored`. Required twins for library actions on non-open PDA rows.
   - `web/src/lib/editor/PdaEditor.svelte`: Exports `setTitle(title: string)` to allow the library rename hook to commit undoable renames directly through the editor interaction core.
   - No test-only exports were added.
2. **Interface minimalism:**
   - PDA action hooks (`flushPda`, `openPda`, `newPdaMachine`, `renameCurrent`) are optional callbacks on `library`, populated only while the PDA workstation is active.
3. **Casts added:**
   - Zero `any`, zero `@ts-ignore`, zero `as unknown as`.
   - Explicit union cast for `entry.kind as Kind` in `others` mapping retained from existing FSM pattern.

---

## 8. Follow-up Observation

- When the application is visited directly at `/sandbox?mode=pda` with fresh local storage, `library.start` in `sandbox/+page.svelte` initializes an empty FSM machine in the background. As noted in the pre-flight, this empty FSM row appears in "Mesin saya" as an untitled DFSM entry. Addressing this behavior is tracked for a future task.
