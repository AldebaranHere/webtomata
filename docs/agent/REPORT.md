# Worker Report — Task T-078: "Mesin baru" and delete behave in the PDA mode

- **Task:** T-078
- **Branch:** `task/T-078-library-in-pda-mode`
- **Commits:** `a1a5c25` (`docs(agent): mark T-078 as in-progress`), `33d0db4` (`fix(storage): follow active mode in Mesin baru and cross-mode deletes`)
- **Status:** `done`

---

## 1. Pre-flight (Items 1 to 5)

### (1) Fault 1 reproduced on the built site
At `/sandbox?mode=pda`, IndexedDB starts with 2 records (`{"total":2,"fsm":1,"pda":1}`). Clicking **Mesin baru** in **Mesin saya** called `library.newMachine()`, which called `this.openDocument(createDocument(), false)`, creating a second empty FSM record (`{"total":3,"fsm":2,"pda":1}`, chips `["DFSM","NDPDA","DFSM"]`) and closing the dialog while leaving the PDA mode screen unchanged.

### (2) Fault 2 reproduced on the built site (real delete + 6.5s wait)
1. Opened `/sandbox` in FSM mode (`Berakhiran 01`, 3 states, ID `610cb369-0e9d-4a4a-8304-9b8d7281dc84`).
2. Switched to PDA mode, opened **Mesin saya**, deleted `Berakhiran 01`, and waited 6.5 seconds.
3. Confirmed `610cb369-0e9d-4a4a-8304-9b8d7281dc84` was removed from IndexedDB (`In IndexedDB after 6.5s wait: false`).
4. Switched back to FSM mode: the editor still showed `{ title: 'Berakhiran 01', nodes: 3 }` because `deleteMachine` gated the FSM replacement branch on `this.mode !== 'pda'`.
5. Added a state (`n`) in FSM mode and waited for autosave: `library.current.autosave` wrote `610cb369-0e9d-4a4a-8304-9b8d7281dc84` back into IndexedDB (`Resurrected in IndexedDB after editing in FSM mode: true`).

### (3) Fault 3 run on the built site (real)
Fault 3 is real via two paths:
- **Path (i) (`openLatestPda`):** Created PDA `aⁿbⁿ (n ≥ 1)` (`aa276431-71c7-4a74-8d78-96d4205b110b`), switched to FSM mode (which unmounts `PdaWorkstation`), deleted `aⁿbⁿ (n ≥ 1)` in **Mesin saya**, and switched to PDA mode within 6 seconds. `PdaWorkstation` called `openLatestPda(store, () => Date.now())`, which read `store.list()` directly (where the record remains until the 6s timer fires) and reopened the deleted PDA (`Shown PDA title: aⁿbⁿ (n ≥ 1)`, `First-run card visible: false`).
- **Path (ii) (`pdaOpenRequest`):** When a PDA row was previously opened from FSM mode via `openPdaRow(id)`, `pdaOpenRequest` on `sandbox/+page.svelte` kept `{ id, seq }`. Leaving PDA mode unmounted `PdaWorkstation`; re-entering PDA mode within 6s of deleting that PDA in FSM mode mounted a new `PdaWorkstation` with `lastHandledSeq = 0`, which ran `openPdaById(req.id)` before `openLatestPda` and reopened the pending-delete PDA.

```text
=== FAULT 1 ===
URL: http://127.0.0.1:46859/sandbox?mode=pda
Records before Mesin baru: {"total":2,"fsm":1,"pda":1}
Records after Mesin baru: {"total":3,"fsm":2,"pda":1}
Button text after: Mesin saya (3)
Row chips in list after: ["DFSM","NDPDA","DFSM"]
=== FAULT 2 ===
Deleted FSM id: 610cb369-0e9d-4a4a-8304-9b8d7281dc84
In IndexedDB after 6.5s wait: false
Shown in FSM mode after switching: { title: 'Berakhiran 01', nodes: 3 }
Resurrected in IndexedDB after editing in FSM mode: true
=== FAULT 3 ===
Deleted PDA id: aa276431-71c7-4a74-8d78-96d4205b110b
Shown PDA title when switching to PDA mode within 6s: aⁿbⁿ (n ≥ 1)
First-run card visible: false
```

### (4) When `newPdaMachine` is registered
`library.newPdaMachine` defaults to `async () => null` in `library.svelte.ts:67` and is assigned by `PdaWorkstation.svelte`'s `$effect` (`library.newPdaMachine = newPdaMachine`) when `PdaWorkstation` mounts (`activeMode === 'pda'`). When the student has not opened PDA mode in this visit, `PdaWorkstation` is not mounted and `library.newPdaMachine` is the default no-op; in FSM mode `library.mode === 'fsm'`, so `newPdaMachine` is never called. In PDA mode, the **Mesin saya** button is rendered inside `PdaEditor.svelte` after `PdaWorkstation` has mounted and initialized `machineStore`, so `library.newPdaMachine` is always registered before the dialog can be opened in PDA mode.

---

## 2. Hand-Derived Fixtures (F1 to F5, with Two-Record Derivations)

- **F1 (PDA mode, "Mesin baru"):**
  - Start at `/sandbox?mode=pda` and load `aⁿbⁿ`: store has 1 FSM record (`type: undefined`, `kind: 'dfsm'`) and 1 PDA record (`type: 'pda'`, `kind: 'dpda'`, `title: 'aⁿbⁿ (n ≥ 1)'`, 2 states).
  - Open **Mesin saya** (`library.open === true`, `library.mode === 'pda'`) and click **Mesin baru** (`library.newMachine()` with default `keepOpen = false`).
  - `this.mode === 'pda' && !keepOpen` holds: `await this.newPdaMachine()` flushes the open PDA autosave, writes a new empty PDA record (`type: 'pda'`, `kind: 'ndpda'`, `title: ''`, `states: []`), sets `library.pdaCurrentId` to the new ID, increments `editorKey` (so `PdaEditor` remounts with `leftFirstRun = false` and `states.length === 0`, showing `.first-run`), and refreshes `library.entries`.
  - `if (!problem) this.hide()` sets `library.open = false`, closing the dialog.
  - Record counts by `type`: FSM count remains `1` (`fsmAfter === fsmBefore`); PDA count increases from `1` to `2`.
- **F2 (FSM mode, "Mesin baru"):**
  - In FSM mode (`library.mode === 'fsm'`), `this.mode === 'pda' && !keepOpen` is false, so `newMachine` calls `this.openDocument(createDocument(), keepOpen)` exactly as before.
- **F3 (PDA mode, delete the FSM's `library.current` — two-record and single-record derivations):**
  - **Case A (two FSM records + open PDA):**
    - Store has `fsmCurrent` (`title: 'Berakhiran 01'`, `openedAt: 200`, `library.current.opened.record.id === fsmCurrent.id`), `fsmBackup` (`title: 'FSM Cadangan'`, `openedAt: 199`), and `pdaOpen` (`title: 'wcwᴿ (w ∈ {a, b}*)'`, `openedAt: 300`, `library.pdaCurrentId === pdaOpen.id`).
    - In PDA mode (`library.mode === 'pda'`), delete `fsmCurrent`:
      - `this.mode === 'pda' && this.pdaCurrentId === fsmCurrent.id` is false.
      - `else if (this.current?.opened.record.id === fsmCurrent.id)` is true.
      - `nextFsm` finds `fsmBackup` (`e.id !== fsmCurrent.id && e.type !== 'pda' && e.readable`).
      - `await this.openMachine(fsmBackup.id, true)` flushes and disposes `fsmCurrent`'s autosave, sets `library.current` to `fsmBackup`, keeps `library.open === true` (`keepOpen = true`), and leaves `library.mode === 'pda'` and `library.pdaCurrentId === pdaOpen.id`.
      - `this.pending.begin(fsmCurrent.id)` hides `fsmCurrent` immediately and deletes it from IndexedDB after 6,000 ms.
      - Switching to FSM mode shows `FSM Cadangan` (never the deleted `Berakhiran 01` and never a blank new FSM, which proves `nextFsm` was selected rather than falling back to `newMachine`). Editing in FSM mode saves to `fsmBackup.id`; `fsmCurrent.id` remains absent from IndexedDB.
  - **Case B (last remaining FSM record + open PDA):**
    - Store now has only 1 FSM record (`fsmBackup`, which is `library.current`) and 1 PDA record (`pdaOpen`, open in PDA mode).
    - In PDA mode, delete `fsmBackup`:
      - `this.current?.opened.record.id === fsmBackup.id` is true, and `nextFsm` is `undefined`.
      - Fallback calls `await this.newMachine(true)`. Because `keepOpen` is `true`, `this.mode === 'pda' && !keepOpen` is false, so `newMachine(true)` calls `this.openDocument(createDocument(), true)`.
      - A new empty FSM record (`id: fsmNew`, `title: ''`, `states: []`) becomes `library.current`, the dialog stays open (`library.open === true`), and `pdaOpen` is untouched (`pdaListAfter` has length 1, same `id` and `doc`).
      - Switching to FSM mode displays the new empty FSM (`Tanpa judul`, `.first-run` visible).
- **F4 (FSM mode, delete a PDA row and switch to PDA mode within 6s — two-record and both-path derivations):**
  - Store has 1 FSM record (`library.current`) and 2 PDA records: `pdaCadangan` (`id: 'pda-cadangan'`, `title: 'PDA Cadangan'`, `openedAt: 1000`) and `pdaTerbaru` (`id: 'pda-terbaru'`, `title: 'PDA Terbaru'`, `openedAt: 2000`).
  - **Path (i) (`openLatestPda` on fresh PDA mount):**
    - In FSM mode, delete `pdaTerbaru`: `this.pending.begin('pda-terbaru')` starts the 6s timer (`library.isPending('pda-terbaru') === true`, `library.isPending('pda-cadangan') === false`).
    - Switch to PDA mode within 6s (`openRequest === null`): `PdaWorkstation` calls `openLatestPda` with `{ ...store, list: async () => (await store.list()).filter((r) => !library.isPending(r.id)) }`.
    - `list()` returns only `[fsmRecord, pdaCadangan]`; `openLatestPda` selects `pdaCadangan` (`title: 'PDA Cadangan'`), not the pending-delete `pdaTerbaru` and not a blank fallback PDA.
    - Pressing **Urungkan** on the page toast within 6s calls `library.undoDelete()`, clearing the pending timer for `'pda-terbaru'` so `PDA Terbaru` reappears in **Mesin saya**.
  - **Path (ii) (`pdaOpenRequest` after opening a PDA from FSM mode):**
    - In FSM mode, tap `PDA Terbaru` in **Mesin saya**: `openPdaRow('pda-terbaru')` switches to PDA mode and sets `pdaOpenRequest = { id: 'pda-terbaru', seq: 1 }`.
    - Switch back to FSM mode: `selectMode('fsm')` sees `activeMode === 'pda' && mode !== 'pda'` and resets `pdaOpenRequest = null` before unmounting `PdaWorkstation` (and `openPdaById` also guards `if (library.isPending(id)) return { key: 'library.missing', params: {} }`).
    - Delete `PDA Terbaru` in FSM mode and switch to PDA mode within 6s: `PdaWorkstation` mounts with `openRequest === null`, skips `'pda-terbaru'`, and opens `PDA Cadangan`. Pressing **Urungkan** restores `PDA Terbaru`.
- **F5 (Existing T-074 and library tests):**
  - All existing tests in `pda-library.test.ts`, `pda-library.spec.ts`, `library.test.ts`, `machines.test.ts`, `cross/library.spec.ts`, `cross/storage.spec.ts`, and `cross/pda-storage.spec.ts` pass unedited.

---

## 3. Code Changes (Quoted from `git diff`)

### `web/src/lib/storage/library.svelte.ts`
```diff
@@ -222,7 +222,12 @@ class Library {
 	}
 
 	/** A new empty machine, saved and opened. */
-	newMachine(keepOpen = false): Promise<Problem | null> {
+	async newMachine(keepOpen = false): Promise<Problem | null> {
+		if (this.mode === 'pda' && !keepOpen) {
+			const problem = await this.newPdaMachine();
+			if (!problem) this.hide();
+			return problem;
+		}
 		return this.openDocument(createDocument(), keepOpen);
 	}
 
@@ -296,7 +301,7 @@ class Library {
 				const problem = await this.newPdaMachine();
 				if (problem) return;
 			}
-		} else if (this.mode !== 'pda' && this.current?.opened.record.id === id) {
+		} else if (this.current?.opened.record.id === id) {
 			const nextFsm = this.entries.find((e) => e.id !== id && e.type !== 'pda' && e.readable);
 			if (nextFsm) {
 				const problem = await this.openMachine(nextFsm.id, true);
@@ -315,6 +320,10 @@ class Library {
 		await this.refresh();
 	}
 
+	isPending(id: string): boolean {
+		return this.pending?.isPending(id) ?? false;
+	}
+
 	undoDelete(): void {
```

### `web/src/lib/editor/PdaWorkstation.svelte`
```diff
@@ -114,6 +114,7 @@
 		if (opened?.record.id === id) {
 			return null;
 		}
+		if (library.isPending(id)) return { key: 'library.missing', params: {} };
 		const record = await machineStore.get(id);
 		if (!record || !isPdaRecord(record)) return { key: 'library.missing', params: {} };
 		const read = readStoredPda(record.doc);
@@ -206,7 +207,13 @@
 			if (req?.id && (await openPdaById(req.id)) === null) return;
 			let result: OpenedPda;
 			try {
-				result = await openLatestPda(store, () => Date.now());
+				result = await openLatestPda(
+					{
+						...store,
+						list: async () => (await store.list()).filter((r) => !library.isPending(r.id))
+					},
+					() => Date.now()
+				);
 			} catch {
```

### `web/src/routes/sandbox/+page.svelte`
```diff
@@ -102,6 +102,7 @@
 
 	async function selectMode(mode: WorkstationMode) {
 		if (activeMode === 'pda' && mode !== 'pda') {
+			pdaOpenRequest = null;
 			await library.flushPda();
 		}
 		activeMode = mode;
```

---

## 4. Deepening Pass

1. **New exports and public interface members:**
   - `Library.isPending(id: string): boolean` on the exported `library` singleton in `web/src/lib/storage/library.svelte.ts`.
   - **Can it be private?** No: `PdaWorkstation.svelte` reads `library.isPending(id)` in `openPdaById` and when filtering `store.list()` for `openLatestPda`, while `this.pending` stays private inside `Library`.
   - **Does something existing already do the same?** `PendingDeletes.isPending` in `library.ts` does the check on the internal timer map; `Library.isPending` delegates directly to `this.pending?.isPending(id) ?? false`.
   - **Is any logic written twice?** No.
2. **Interface size vs work behind it:**
   - One boolean query method (`isPending(id)`) exposes whether a record ID is in the 6-second undo window without exposing `this.pending` or mutating methods (`begin`, `undo`, `dispose`).
3. **Casts added:** `0`.

---

## 5. Deliberate Breaks on the Final Code (AC4)

### Break B1: `newMachine` ignores the mode (an FSM record is made in the PDA mode)
- **One-line diff:**
  ```diff
  --- a/web/src/lib/storage/library.svelte.ts
  +++ b/web/src/lib/storage/library.svelte.ts
  @@ -226,3 +226,3 @@ class Library {
   	async newMachine(keepOpen = false): Promise<Problem | null> {
  -		if (this.mode === 'pda' && !keepOpen) {
  +		if (false && this.mode === 'pda' && !keepOpen) {
   			const problem = await this.newPdaMachine();
  ```
- **Failing test output:**
  ```text
  1) [desktop] › e2e/pda-library.spec.ts:328:1 › T-078 F1: in PDA mode, Mesin baru opens a new empty PDA with first-run card, closes the list, and adds no FSM record 

    Error: expect(locator).toBeVisible() failed

    Locator: locator('.first-run')
    Expected: visible
    Timeout: 5000ms
    Error: element(s) not found

      344 | 	await expect(dialog(page)).toBeHidden();
      345 | 	await expect(page).toHaveURL(/mode=pda/);
    > 346 | 	await expect(page.locator('.first-run')).toBeVisible();
          | 	                                         ^
        at /home/Aldebaran64/webtomata/web/e2e/pda-library.spec.ts:346:43
  ```
- **Extra Break B1b (`newMachine` omits `!keepOpen`, so `deleteMachine`'s `newMachine(true)` fallback in PDA mode calls `newPdaMachine`):**
  ```diff
  --- a/web/src/lib/storage/library.svelte.ts
  +++ b/web/src/lib/storage/library.svelte.ts
  @@ -226,3 +226,3 @@ class Library {
   	async newMachine(keepOpen = false): Promise<Problem | null> {
  -		if (this.mode === 'pda' && !keepOpen) {
  +		if (this.mode === 'pda') {
   			const problem = await this.newPdaMachine();
  ```
  Caught by `T-078 F3` Case B (`at /home/Aldebaran64/webtomata/web/e2e/pda-library.spec.ts:432:29`, `expect(dialog(page)).toBeVisible() failed`).

### Break B2: The mode condition comes back in the FSM-current branch of `deleteMachine`
- **One-line diff:**
  ```diff
  --- a/web/src/lib/storage/library.svelte.ts
  +++ b/web/src/lib/storage/library.svelte.ts
  @@ -304,3 +304,3 @@ class Library {
   			}
  -		} else if (this.current?.opened.record.id === id) {
  +		} else if (this.mode !== 'pda' && this.current?.opened.record.id === id) {
   			const nextFsm = this.entries.find((e) => e.id !== id && e.type !== 'pda' && e.readable);
  ```
- **Failing test output:**
  ```text
  1) [desktop] › e2e/pda-library.spec.ts:363:1 › T-078 F3: in PDA mode, deleting the FSM current record replaces it with the other FSM or a new empty FSM without touching the open PDA, and after 6s + edit it never returns 

    Error: expect(locator).toHaveText(expected) failed

    Locator:  locator('p.title')
    Expected: "FSM Cadangan"
    Received: "Berakhiran 01"
    Timeout:  5000ms

      412 | 	await closeList(page, isMobile);
      413 | 	await switchMode(page, /^Mesin FSM/, isMobile);
    > 414 | 	await expect(page.locator('p.title')).toHaveText('FSM Cadangan');
          | 	                                      ^
        at /home/Aldebaran64/webtomata/web/e2e/pda-library.spec.ts:414:40
  ```

### Break B3: The workstation opens a pending-delete record again
- **One-line diff:**
  ```diff
  --- a/web/src/lib/editor/PdaWorkstation.svelte
  +++ b/web/src/lib/editor/PdaWorkstation.svelte
  @@ -212,3 +212,3 @@
   					{
   						...store,
  -						list: async () => (await store.list()).filter((r) => !library.isPending(r.id))
  +						list: async () => await store.list()
   					},
  ```
- **Failing test output:**
  ```text
  1) [desktop] › e2e/pda-library.spec.ts:453:1 › T-078 F4 (path i): in FSM mode, deleting the latest PDA and switching to PDA mode within 6s opens the other PDA, and Urungkan restores the deleted row 

    Error: expect(locator).toHaveText(expected) failed

    Locator:  locator('p.title')
    Expected: "PDA Cadangan"
    Received: "PDA Terbaru"
    Timeout:  5000ms

      486 | 	// Switch to PDA mode right away (within 6s): opens PDA Cadangan, not the pending-delete PDA Terbaru
      487 | 	await switchMode(page, /^Otomata Pushdown/, isMobile);
    > 488 | 	await expect(page.locator('p.title')).toHaveText('PDA Cadangan');
          | 	                                      ^
        at /home/Aldebaran64/webtomata/web/e2e/pda-library.spec.ts:488:40
  ```

---

## 6. Size Before and After (AC3)

| Target | Before (bytes gz) | After (bytes gz) | Delta (bytes) | `pnpm size` (KB) | Limit |
|---|---:|---:|---:|---:|---:|
| `index.html` | 83,801 | 83,828 | +27 | 81.9 KB | 170 KB |
| `panduan/berakhiran-x.html` | 89,329 | 89,356 | +27 | 87.3 KB | 170 KB |
| `panduan.html` | 82,949 | 82,976 | +27 | 81.0 KB | 170 KB |
| `sandbox.html` | 124,790 | 124,828 | +38 | 121.9 KB | 170 KB |
| `soal/berakhiran-10.html` | 124,149 | 124,176 | +27 | 121.3 KB | 170 KB |
| `soal/jumlah-a-genap.html` | 124,149 | 124,176 | +27 | 121.3 KB | 170 KB |
| `soal/mengandung-101.html` | 124,149 | 124,176 | +27 | 121.3 KB | 170 KB |
| `soal.html` | 84,444 | 84,471 | +27 | 82.5 KB | 170 KB |
| `tentang.html` | 82,247 | 82,274 | +27 | 80.3 KB | 170 KB |
| `layout.worker` | 15,943 | 15,943 | 0 | 15.6 KB | 40 KB |
| `engine_wasm_bg.wasm` | 242,689 | 242,689 | 0 | 237.0 KB | 250 KB |

All routes grew by at most **+38 bytes** (limit: +102 bytes). The lazy PDA workstation chunk grew from 11.76 KB to 11.80 KB gzip (+39 bytes).

---

## 7. Verification Output (AC2, AC5)

### Format, Svelte Check, Lint, Strings, Tokens, Size
```text
$ pnpm format:check
$ pnpm --filter web format:check && cargo fmt --check
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!

$ pnpm check
$ pnpm --filter web check
$ svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings
Loading svelte-check in workspace: /home/Aldebaran64/webtomata/web
Getting Svelte diagnostics...
svelte-check found 0 errors and 0 warnings

$ pnpm lint
$ pnpm --filter web lint
$ eslint .

$ pnpm check:strings
$ node tools/check-strings.mjs
ok   76 components have no hard-coded text

$ pnpm check:tokens
$ node tools/check-tokens-usage.mjs
ok   78 files use no raw colors

$ pnpm size
$ node tools/check-size.mjs
ok   initial JS index.html: 81.9 KB gzip (limit 170 KB)
ok   initial JS panduan/berakhiran-x.html: 87.3 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 81.0 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 121.9 KB gzip (limit 170 KB)
ok   initial JS soal/berakhiran-10.html: 121.3 KB gzip (limit 170 KB)
ok   initial JS soal/jumlah-a-genap.html: 121.3 KB gzip (limit 170 KB)
ok   initial JS soal/mengandung-101.html: 121.3 KB gzip (limit 170 KB)
ok   initial JS soal.html: 82.5 KB gzip (limit 170 KB)
ok   initial JS tentang.html: 80.3 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-VlyrwV86.wasm: 237.0 KB gzip (limit 250 KB)
```

### Unit Tests (`pnpm test:web`)
Existing tests run unedited included `src/lib/storage/library.test.ts` (16 tests), `src/lib/storage/machines.test.ts` (8 tests), `src/lib/storage/pda-work.test.ts` (26 tests), `src/lib/storage/pda-example.test.ts` (6 tests), `src/lib/first-load.test.ts` (3 tests), and all 9 existing tests in `src/lib/storage/pda-library.test.ts` (11 total with the 2 new T-078 tests):
```text
$ pnpm test:web
 RUN  v5.0.3 /home/Aldebaran64/webtomata/web
 ✓ src/lib/first-load.test.ts (3 tests) 30ms
 ✓ src/lib/storage/pda-library.test.ts (11 tests) 102ms
 ✓ src/lib/storage/library.test.ts (16 tests) 16ms
 ✓ src/lib/storage/machines.test.ts (8 tests) 20ms
 ...
 Test Files  122 passed (122)
      Tests  1416 passed | 2 skipped (1418)
   Duration  11.12s
```

### Playwright E2E (`pda-library`, `cross/library`, `cross/storage`, `cross/pda-storage` on `desktop`, `phone`, `webkit-phone`)
```text
$ pnpm --filter web exec playwright test pda-library cross/library cross/storage cross/pda-storage --project=desktop --project=phone --project=webkit-phone

Running 100 tests using 6 workers
  ...
  ✓  34 [desktop] › e2e/pda-library.spec.ts:328:1 › T-078 F1: in PDA mode, Mesin baru opens a new empty PDA with first-run card, closes the list, and adds no FSM record (2.9s)
  ✓  35 [desktop] › e2e/pda-library.spec.ts:363:1 › T-078 F3: in PDA mode, deleting the FSM current record replaces it with the other FSM or a new empty FSM without touching the open PDA, and after 6s + edit it never returns (16.2s)
  ✓  36 [desktop] › e2e/pda-library.spec.ts:453:1 › T-078 F4 (path i): in FSM mode, deleting the latest PDA and switching to PDA mode within 6s opens the other PDA, and Urungkan restores the deleted row (3.9s)
  ✓  37 [desktop] › e2e/pda-library.spec.ts:499:1 › T-078 F4 (path ii): opening a PDA row from FSM mode, switching back to FSM, deleting that row, and switching to PDA within 6s does not reopen the deleted PDA; Urungkan restores it (4.8s)
  ✓  71 [phone] › e2e/pda-library.spec.ts:328:1 › T-078 F1: in PDA mode, Mesin baru opens a new empty PDA with first-run card, closes the list, and adds no FSM record (2.8s)
  ✓  72 [phone] › e2e/pda-library.spec.ts:363:1 › T-078 F3: in PDA mode, deleting the FSM current record replaces it with the other FSM or a new empty FSM without touching the open PDA, and after 6s + edit it never returns (16.3s)
  ✓  73 [phone] › e2e/pda-library.spec.ts:453:1 › T-078 F4 (path i): in FSM mode, deleting the latest PDA and switching to PDA mode within 6s opens the other PDA, and Urungkan restores the deleted row (3.8s)
  ✓  74 [phone] › e2e/pda-library.spec.ts:499:1 › T-078 F4 (path ii): opening a PDA row from FSM mode, switching back to FSM, deleting that row, and switching to PDA within 6s does not reopen the deleted PDA; Urungkan restores it (4.6s)
  ...
  2 skipped
  98 passed (1.7m)
```

### 10x Repeat Stress Run (`--repeat-each=10` on the 4 new T-078 e2e tests)
```text
$ pnpm --filter web exec playwright test pda-library -g T-078 --project=desktop --repeat-each=10

Running 40 tests using 6 workers
  ...
  40 passed (1.0m)
```

### What Was Not Run
- **Firefox (`--project=firefox`):** Not run locally because Firefox does not start on the owner's laptop (`AGENTS.md`); runs in CI.
- **Physical phone / live site:** Emulated via Playwright `phone` (Pixel 7) and `webkit-phone` (iPhone 13) projects locally; physical device and live preview belong to the owner.

### Final `git diff --stat` (against base `11577ba`)
```text
 docs/agent/PLAN.md                         |   2 +-
 docs/agent/REPORT.md                       | 676 ++++++++++++++---------------
 docs/decisions/0059-library-in-pda-mode.md |  29 ++
 web/e2e/pda-library.spec.ts                | 236 +++++++++-
 web/src/lib/editor/PdaWorkstation.svelte   |   9 +-
 web/src/lib/storage/library.svelte.ts      |  13 +-
 web/src/lib/storage/pda-library.test.ts    |  73 +++-
 web/src/routes/sandbox/+page.svelte        |   1 +
 8 files changed, 693 insertions(+), 346 deletions(-)
```

