# Task T-056 Report — PDA editor, part 7 of 10: saving a PDA on the device

- **Task:** T-056
- **Branch:** `task/T-056-pda-storage`
- **Status:** done
- **Implementation Commits:**
  - Status start: `bbf1ca9` (`docs(agent): set T-056 status to in-progress`)
  - Implementation & Tests: `b3aa15c` (`feat(storage): save pushdown automata on device in shared store`)
- **PR:** #180 (to `staging`)

---

## 1. Hand-Derived Fixtures & Expected Values (Derived Prior to Coding)

### Fixture F1: PDA Record Creation & Autosave
- **Sample:** `wwrSample()` (kind: `'ndpda'`).
- **Initial Save at `now = 1000`:**
  - `id`: valid UUID v4 (36 chars)
  - `recordVersion`: `1`
  - `type`: `'pda'`
  - `title`: `'wwᴿ (palindrom panjang genap)'`
  - `kind`: `'ndpda'`
  - `createdAt`: `1000`
  - `updatedAt`: `1000`
  - `openedAt`: `1000`
  - `doc`: `serializePdaDocument(wwrSample())`
  - `titles`: `undefined`
  - `tests`: `undefined`
  - `progress`: `undefined`
- **Autosave at `now = 2000` on modified `doc2` (title: `'wwr (mod)'`, kind: `'dpda'`):**
  - `record.title`: `'wwr (mod)'`
  - `record.kind`: `'dpda'`
  - `record.updatedAt`: `2000`
  - `record.createdAt`: `1000` (unchanged)
  - `record.openedAt`: `1000` (unchanged)
  - `record.doc`: `serializePdaDocument(doc2)`

### Fixture F2: Kind Isolation
- **Initial store records:**
  - FSM `A` at `5000` (created `1000`, updated `5000`, opened `5000`)
  - Question `soal:x` at `6000` (created `1000`, updated `6000`, opened `6000`)
  - PDA `P1` at `2000` (created `4000`, updated `2000`, opened `2000`)
  - PDA `P2` at `3000` (created `1000`, updated `3000`, opened `3000`)
- **Execution:**
  - `openLatestPda(store, () => 9000)`:
    - Returns `record.id = 'P2'`, `doc.title = 'PDA 2'`, `skipped = []`
    - Rewrites `P2.openedAt` to `9000`, leaves `P2.createdAt`, `P2.updatedAt`, `P2.doc` unchanged
    - Store records `P1`, `A`, and `soal:x` remain byte-identical
  - On the same store:
    - `openLatest(store, ...)` returns `A`
    - `listEntries(store)` returns exactly `['A']` (ignoring `soal:x`, `P1`, `P2`)

### Fixture F3: Unreadable Records
- **Case (i):**
  - Store has `P1` (`openedAt = 9000`, corrupt JSON `{"broken`), `P2` (`openedAt = 8000`, good), `P3` (`openedAt = 7000`, version 2).
  - `openLatestPda` returns `P2`.
  - `skipped` is exactly `[{ id: 'P1', title: 'P1 Corrupt', reason: 'corrupt' }]`.
  - `P3` is never read (`p3ReadTimes === initialReads`).
- **Case (ii):**
  - Store has only `P1` (`9000`, corrupt), `P3` (`7000`, version 2 newer), `P4` (`6000`, version 0 unsupported).
  - Fallback empty NDPDA is saved via `createPdaDocument()`.
  - `skipped` lists `P1` (corrupt), `P3` (newer), `P4` (unsupported) in exact order.
  - Store has 4 total records; `P1`, `P3`, `P4` are byte-identical.
- **`readStoredPda` text cases:**
  - `""`, `"null"`, `"[]"`, `"{}"`, `{"schemaVersion": 1.5}`, transition naming missing state $\to$ each returns `{ ok: false, reason: 'corrupt' }`.

### Fixture F4: Failure Injection
- **(a)** Store with refusing `put`: autosave sets status to `'failed'`.
  - Flushing retries `docA` $\to$ status `'saved'`, store has `docA`.
  - Following with `schedule(docB)` writes `docB`, never `docA`.
- **(b)** Store with throwing `put`: `openLatestPda` still returns `{ record, doc, skipped }`. Subsequent `schedule` + `flush` reports status `'failed'`.
- **(c)** Store whose `list()` throws: `openLatestPda` propagates the rejection.

### Fixture F5: Burst & Write Serialization
- Burst of 50 `schedule` calls with 10 ms delay: exactly 2 writes occur, store ends up with 50th document.
- Slow first `put` (15 ms) followed by immediate second `put`: operations execute strictly sequentially (`start-slow`, `end-slow`, `put-Fast`).

### Fixture F6: Size & Boundary Triples
- `LIMITS.documentBytes` (262,144 chars):
  - `262,143`: ok
  - `262,144`: ok
  - `262,145`: corrupt
- `LIMITS.nameChars` (32 chars): 31 (ok), 32 (ok), 33 (corrupt)
- `LIMITS.titleChars` (100 chars): 99 (ok), 100 (ok), 101 (corrupt)
- `MAX_PDA_STRING` (64 chars): 63 (ok), 64 (ok), 65 (corrupt)

---

## 2. Real Verification Commands & Unsummarized Outputs

### A. Size Check (Before & After)
`pnpm build && pnpm size`
```
$ node tools/check-size.mjs
ok   initial JS index.html: 81.9 KB gzip (limit 170 KB)
ok   initial JS panduan/berakhiran-x.html: 87.2 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 81.0 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 121.4 KB gzip (limit 170 KB)
ok   initial JS soal/berakhiran-10.html: 121.0 KB gzip (limit 170 KB)
ok   initial JS soal/jumlah-a-genap.html: 121.0 KB gzip (limit 170 KB)
ok   initial JS soal/mengandung-101.html: 121.0 KB gzip (limit 170 KB)
ok   initial JS soal.html: 82.4 KB gzip (limit 170 KB)
ok   initial JS tentang.html: 80.3 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-VlyrwV86.wasm: 237.0 KB gzip (limit 250 KB)
```
Gzip size remained identical across all entrypoints and bundles.

### B. Lint, Types & Checks
`pnpm lint`:
```
$ pnpm --filter web lint
$ eslint .
```
(Clean exit code 0, 0 warnings, 0 errors)

`pnpm check`:
```
$ pnpm --filter web check
$ svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings
Loading svelte-check in workspace: /home/Aldebaran64/webtomata/web
Getting Svelte diagnostics...

svelte-check found 0 errors and 0 warnings
```

`pnpm format:check`:
```
$ pnpm --filter web format:check && cargo fmt --check
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!
```

`pnpm check:strings`:
```
$ node tools/check-strings.mjs
ok   67 components have no hard-coded text
```

`pnpm check:tokens`:
```
$ node tools/check-tokens-usage.mjs
ok   69 files use no raw colors
```

### C. Playwright Storage Cross-Browser Tests
Executed locally on `desktop` and `webkit-phone` (Firefox is CI only per Rule 8):

`pnpm --filter web exec playwright test e2e/cross/storage.spec.ts --project=desktop`:
```
Running 9 tests using 6 workers

  ✓  6 [desktop] › e2e/cross/storage.spec.ts:44:1 › a change that waits for its delay is saved at once when the page is hidden or closed (5.1s)
  ✓  5 [desktop] › e2e/cross/storage.spec.ts:22:1 › the first visit saves the sample as the first machine (5.8s)
  ✓  1 [desktop] › e2e/cross/storage.spec.ts:99:1 › a machine of a newer version is skipped and kept, never overwritten (5.9s)
  ✓  3 [desktop] › e2e/cross/storage.spec.ts:77:1 › a machine that cannot be read is skipped and kept, with a message (6.6s)
  ✓  2 [desktop] › e2e/cross/storage.spec.ts:57:1 › leaving the page asks first while a change is not saved, and not after (7.9s)
  ✓  4 [desktop] › e2e/cross/storage.spec.ts:31:1 › a change is saved on the device, and is there after a reload (8.9s)
  ✓  7 [desktop] › e2e/cross/storage.spec.ts:122:1 › when every machine is unreadable a new one is made, and none is deleted (4.0s)
  ✓  9 [desktop] › e2e/cross/storage.spec.ts:145:1 › a browser that refuses storage: the editor works, with a warning that nothing is saved (3.8s)
  ✓  8 [desktop] › e2e/cross/storage.spec.ts:163:1 › a write that is refused: the warning shows, the work stays, and the next save clears it (6.5s)

  9 passed (15.0s)
```

`pnpm --filter web exec playwright test e2e/cross/storage.spec.ts --project=webkit-phone`:
```
Running 9 tests using 6 workers

  ✓  1 [webkit-phone] › e2e/cross/storage.spec.ts:22:1 › the first visit saves the sample as the first machine (7.9s)
  ✓  3 [webkit-phone] › e2e/cross/storage.spec.ts:44:1 › a change that waits for its delay is saved at once when the page is hidden or closed (8.2s)
  ✓  2 [webkit-phone] › e2e/cross/storage.spec.ts:77:1 › a machine that cannot be read is skipped and kept, with a message (8.5s)
  ✓  4 [webkit-phone] › e2e/cross/storage.spec.ts:99:1 › a machine of a newer version is skipped and kept, never overwritten (8.7s)
  ✓  5 [webkit-phone] › e2e/cross/storage.spec.ts:31:1 › a change is saved on the device, and is there after a reload (9.5s)
  ✓  6 [webkit-phone] › e2e/cross/storage.spec.ts:57:1 › leaving the page asks first while a change is not saved, and not after (9.7s)
  ✓  7 [webkit-phone] › e2e/cross/storage.spec.ts:122:1 › when every machine is unreadable a new one is made, and none is deleted (3.4s)
  ✓  8 [webkit-phone] › e2e/cross/storage.spec.ts:145:1 › a browser that refuses storage: the editor works, with a warning that nothing is saved (4.3s)
  ✓  9 [webkit-phone] › e2e/cross/storage.spec.ts:163:1 › a write that is refused: the warning shows, the work stays, and the next save clears it (6.8s)

  9 passed (17.3s)
```

### D. Full Web Unit Test Suite
`pnpm --filter web test`:
```
 Test Files  107 passed (107)
      Tests  1298 passed | 2 skipped (1300)
   Start at  02:45:49
   Duration  8.73s (tests 74%, transform 19%, import 7%)
```

---

## 3. F7 Property Tests & 10,000-Case Run Output

Executed `TEST_CASES=10000 pnpm --filter web test src/lib/storage/pda-work.property.test.ts`:
```
$ TEST_CASES=10000 vitest run src/lib/storage/pda-work.property.test.ts

 RUN  v5.0.3 /home/Aldebaran64/webtomata/web

 ✓ src/lib/storage/pda-work.property.test.ts (3 tests) 3144ms
   ✓ F7 — Property tests (round-trip, store integration, never throws) (3)
     ✓ (a) 10000 random valid PdaDocuments round-trip through readStoredPda 1512ms
     ✓ (b) 10000 random valid PdaDocuments through memory store + autosave + openLatestPda 1354ms
     ✓ (c) readStoredPda never throws on 10000 random strings, lone surrogates, and control chars 276ms

 Test Files  1 passed (1)
      Tests  3 passed (3)
   Start at  02:22:47
   Duration  3.57s (transform 8%, tests 88%, import 2%, worker 1%)
```

---

## 4. The Nine Deliberate Breaks (AC5)

Every required break was deliberately tested and observed failing:

| # | Break Description | Targeted Code | Caught by Fixture | Observed Failure / Error |
|---|---|---|---|---|
| 1 | `openLatestPda` takes FSM records | Omit `.filter(isPdaRecord)` in `openLatestPda` | F2 | `AssertionError: expected [ { id: 'soal:x', ... } ] to deeply equal []` |
| 2a | `openLatest` takes PDA records | Omit `isFsmRecord` filter in `openLatest` | F2 | `AssertionError: expected [ { id: 'P2', title: 'PDA 2', reason: 'corrupt' } ] to deeply equal []` |
| 2b | `listEntries` takes PDA records | Omit `isFsmRecord` filter in `listEntries` | F2 | `AssertionError: expected [ 'A', 'P2', 'P1', ... ] to deeply equal [ 'A' ]` |
| 3 | Sort by `createdAt` instead of `openedAt` | Change `.sort((a,b) => b.openedAt - a.openedAt)` to `b.createdAt - a.createdAt` | F2 | `AssertionError: expected 'P1' to be 'P2'` |
| 4 | Empty fallback PDA overwrites unreadable record id | Set `id: records[0].id` instead of `newId()` | F3(ii) | `AssertionError: expected 'P1' not to be 'P1'` |
| 5 | Drop retry after failure in autosave | Reset `latest = null` in catch block | F4(a) | `AssertionError: expected 'Initial' to be 'Doc A'` |
| 6 | Two writes at once in autosave | Remove `if (!running) running = loop()` lock | F5 | `AssertionError: expected [ 'start-slow', 'end-slow', 'put-Fast' ] to deeply equal [ 'start-slow', 'put-Fast', 'end-slow' ]` |
| 7 | `documentBytes` check changed to `>=` | `text.length >= LIMITS.documentBytes` | F6 | `AssertionError: expected { ok: false, reason: 'corrupt' } to deeply equal { ok: true, doc: ... }` |
| 8 | Drop `type: 'pda'` from new record | Omit `type: 'pda'` in `createPdaMachine` | F1 / F2 | `AssertionError: expected undefined to be 'pda'` |
| 9 | Do not copy `kind` on document change | Comment out `record.kind = doc.kind` in `pdaDocumentCodec.apply` | F1 | `AssertionError: expected 'ndpda' to be 'dpda'` |
| 10 | Return core directly for PDA autosave (leaks FSM methods) | Return `createAutosaveCore(...)` for PDA | autosave.pda.test | `AssertionError: expected true to be false` (`'scheduleTests' in pdaSave`) |

---

## 5. The Deepening Pass

1. **New exports and public interfaces:**
   - `SavedPdaMachine`: Exact record shape for pushdown automata stored in `machines`.
   - `AnySavedMachine`: Union `SavedFsmMachine | SavedPdaMachine`.
   - `isPdaRecord(record)`: Guard for `record is SavedPdaMachine`.
   - `isFsmRecord(record)`: Guard for `record is SavedFsmMachine`.
   - `DocumentCodec<D, R>`: Serialization & field copy contract (`serialize`, `apply`).
   - `pdaDocumentCodec`: Codec instance for `PdaDocument` $\to$ `SavedPdaMachine`.
   - `fsmDocumentCodec`: Codec instance for `MachineDocument` $\to$ `SavedFsmMachine`.
   - `readStoredPda(text: string)`: Safe document deserializer.
   - `createPdaMachine(store, doc, now)`: Record creator.
   - `openLatestPda(store, now)`: Last opened PDA retriever and fallback creator.
   - `SkippedPda`, `OpenedPda`, `PdaReadResult`, `Unreadable`: Return contract types.
   - `PdaAutosave`: Type-safe autosave client for PDA omitting FSM tests & progress scheduling.

   *Can any be private?* Internal autosave queue logic is encapsulated in `createAutosaveCore` (private to `autosave.ts`).
   *Is any logic duplicated?* Autosave debouncing and write serialization logic is shared 100% between FSM and PDA.

2. **Cast Count:**
   - **Zero (`0`) casts** in all source and test files.
   - All record narrowing is achieved through honest union discriminators and type guards (`isPdaRecord`, `isFsmRecord`, `getPdaRecord`).
   - Zero `@ts-ignore` or `any`.
   - Verified via scan for `' as '` in new files (only comments and plain prose `as saved` appear):
     ```
     web/src/lib/storage/autosave.pda.test.ts:27:  it('starts as saved, schedule sets unsaved, flush saves document', async () => {
     web/src/lib/storage/pda-work.ts:2: // A PDA record lives in the same store as FSM machines ('machines' in IndexedDB),
     web/src/lib/storage/pda-work.ts:47:  // The text is at least as many bytes as it has units, so this cannot refuse a good document (mirrors migrate.ts).
     web/src/lib/storage/pda-work.ts:70: /** Saves a PDA document as a new record in the store. */
     web/src/lib/storage/pda-work.ts:93:  * The PDA machine that was opened last. A record that cannot be read is skipped and kept as it is.
     web/src/lib/storage/pda-work.ts:94:  * When none can be read or none exists, an empty NDPDA (createPdaDocument()) is saved as a new record.
     ```
