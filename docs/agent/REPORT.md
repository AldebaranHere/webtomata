# Task T-075 Report — PDA editor, part 12c: open and download `.jff` and JSON for a PDA

Branch: `task/T-075-pda-files`, cut from `staging` at `11ce7bb` (PR 210, amended T-075 spec).

Commits:
- `05f9352` `docs(agent): start task T-075` — `docs/agent/PLAN.md` set to `in-progress`.
- `72afe30` `feat(editor): open and download .jff and JSON for a PDA` — the reader, the lazy opener, the dialog, the tests, the fuzz target and ADR 0055.
- this commit — `docs(agent): record task T-075`.

**Status: AC1, AC2, AC3, AC5 and AC6 hold. AC4 does not hold:** the sandbox first JS grows by 696 bytes and the three question pages by 769 bytes (the 0.1 KB = 102 bytes rule). The cause, the numbers and the four variants tried are in section 5. The task's Size rule says to give the numbers and wait for the planner, so `PLAN.md` stays `in-progress` and the branch is pushed for review.

---

## 0. The two numbers the planner asked for after "Go"

**The byte sizes of the first-JS chunks** (clean build of `11ce7bb`, the same web code as the base; the sum of the gzip of every `.js` the route's HTML references, exactly what `pnpm size` sums):

```
sandbox.html   128324 bytes gz (23 chunks)
index.html      83973 bytes gz (20 chunks)
soal.html       84522 bytes gz (19 chunks)
```

(T-073/T-074 measured the same way: `sandbox.html` 125.313 KB / 128,321 bytes in the T-074 report.)

**A PDA file chosen in the FSM mode makes exactly one record.** Function-level run of the exact steps the spec names (`createMachine` for the open FSM record, then `createPdaMachine`, then the workstation's `openPdaById` for a request present at mount), using the real `storage/machines.ts`, `storage/pda-work.ts` and `editor/pda-samples.ts`:

```
before          : 1 record(s) [ 'fsm:1755428c' ]
after create    : 2 record(s) [ 'fsm:1755428c', 'pda:9e33f700' ]
request opened  : ok (returns before openLatestPda)
after mount     : 2 record(s)
openLatestPda   : opens the file record | 2 record(s)
```

Exactly one new PDA record; the mount adds none. The e2e F4 confirms it in the browser (section 2).

---

## 1. What changed

| File | What |
| --- | --- |
| `web/src/lib/share/pda-files.ts` (new) | `isPdaFile` (size first, then the content sniff: `/<type>\s*pda\s*<\/type>/` for `.jff`, `/"kind"\s*:\s*"(dpda\|ndpda)"/` for JSON), `openPdaFile` (JSON through `parsePdaDocumentText`; `.jff` through `engine.importPdaJff` + `fromEnginePda` + the document gate; title from the file name), `pdaJffFile`, `pdaJsonFile`, and the two engine interfaces. No DOM. |
| `web/src/lib/share/open-from-file.ts` (new) | The body of `openFromFile` moved out of the page, with both paths. FSM: unchanged behaviour, notes and notice; switches to the FSM mode after an FSM file in the PDA mode. PDA: read + check, `createPdaMachine`, `hide()`, clear `problem`, switch to PDA, `{id, seq}`, notice. Failures set `library.problem` and write nothing. |
| `web/src/lib/share/PdaFileDialog.svelte` (new) | The download dialog: native `<dialog>`, sheet on a phone, "Unduh .jff" and "Unduh JSON", calm `jff.symbol_not_single_character`, saved line. Strings from `pda-messages.ts`. |
| `web/src/lib/editor/PdaEditor.svelte` | The download button in the editor's own bar at every width (44 px, shown with at least one state) and the dialog, lazy-loaded with the live `snapshot.doc`. |
| `web/src/routes/sandbox/+page.svelte` | `openFromFile` removed; one hook `library.openFile = (file) => import(…).then((m) => m.openFromFile(file, context))`. |
| `web/src/lib/editor/document.ts` | `jffLayout`'s parameter widened to `{ readonly states: readonly StateEntry[] }` (type only; the spec said `files.ts`, but the function lives here). |
| `web/src/lib/i18n/pda-messages.ts`, `.test.ts` | Seven dialog strings (`pda_files.*`) and the ledger. |
| `web/src/lib/i18n/id.ts`, `en.ts` | `jff.unsupported_type` now names `fa` and `pda`; keeps `bertipe "{type}"` / `Mesinmu tidak berubah.` |
| `fuzz/fuzz_targets/parse_pda_jff.rs` (new), `fuzz/Cargo.toml` | The fuzz target and its `[[bin]]`. |
| `web/e2e/pda-files.spec.ts` (new) | F3, F4, F5, F8 (desktop and phone). |
| `web/src/lib/share/pda-files.test.ts`, `pda-files.wasm.test.ts`, `open-from-file.test.ts` (new) | 32 unit tests (below). |
| `web/e2e/open-file.spec.ts`, `web/e2e/cross/open-file.spec.ts` | The three tests the scope allows: the `pda` refusal leaves the loop, and the two refused-file fixtures use `grammar.jff`; the cross test is renamed. |
| `web/eslint.config.js` | `pda-files.wasm.test.ts` added to the existing wasm-import allowlist (the repo's pattern for every wasm test; no rule changed). |
| `docs/decisions/0055-pda-files.md` (new) | The decision. |

---

## 2. AC1 — F1 to F8

### Derivations

- **F1:** the `wcwᴿ` sample (DPDA, single-character symbols) is exported with `exportPdaJff(toEnginePda(doc), jffLayout(doc))`, opened with `openPdaFile` and the real engine, and exported again. States (id, name, place), transitions (same order), both alphabets, start and accepting are the same; only the title (the file name `wcwr`) and the kind (`ndpda`) differ; the two exports are byte-equal. The pre-flight measured the same at the function level.
- **F2:** a `dpda` titled `PDA uji` → `pdaJsonFile` → `openPdaFile`: `pdaDocumentsEqual` true, kind `dpda`, title kept.
- **F3:** a DPDA with the stack symbol `Z0` refuses the `.jff` with `jff.symbol_not_single_character { symbol: 'Z0' }`, files nothing, and the JSON still downloads (`PDA Z0.webtomata.json`); axe passes in that state.
- **F4:** FSM mode (1 record) + a PDA `.jff` → 2 records (exactly 1 PDA, kind `ndpda`), `?mode=pda`, list closed, notice `File dibuka sebagai mesin baru: pda.`; + a PDA JSON in the PDA mode → 3 records (2 PDA); + an FSM `.jff` in the PDA mode → 4 records (still 2 PDA), the mode switches to FSM, the FSM states show.
- **F5:** 1 MB + 1 byte (`import.too_big`, through the FSM reader because `isPdaFile` is false), an unknown name (`import.unknown_type`), `<type>pda</type>` with broken XML (`jff.xml_invalid`), a `.jff` whose read is `ab` (`jff.pda_read_not_single`), a PDA JSON whose state is not an object (`document.invalid_file`, `at: states[0]`), a PDA JSON over the state limit (`document.limit_exceeded`), and a store that refuses the write (`storage.failed`, unit test). Each leaves the record ids exactly as they were and keeps the list open; a later success closes the list and leaves no older failure.
- **F6:** `fileName` with `/`, `:`, a trailing dot, an empty title and 200 characters, for `.jff` and `.webtomata.json`; the e2e download name is `PDA Z0.webtomata.json`.
- **F7:** 200 seeded mutations of a valid PDA JSON and 200 of a valid PDA `.jff`: `isPdaFile` always returns a boolean, `openPdaFile` always returns a result, and every ok document passes `parsePdaDocumentText` again.
- **F8:** the button and the three dialog buttons are ≥ 44 px; on a phone the dialog is a sheet (its bottom is the viewport bottom); no sideways scroll; axe clean; a file chosen in "Mesin saya" opens as in F4.

### Unit and wasm tests

```
$ pnpm --filter web exec vitest run src/lib/share/pda-files.test.ts src/lib/share/pda-files.wasm.test.ts src/lib/share/open-from-file.test.ts
 ✓ src/lib/share/pda-files.test.ts (19 tests) 30ms
 ✓ src/lib/share/pda-files.wasm.test.ts (5 tests) 101ms
 ✓ src/lib/share/open-from-file.test.ts (8 tests) 36ms
 Test Files  3 passed (3)
      Tests  32 passed (32)
```

### Playwright (desktop and phone)

```
$ pnpm --filter web exec playwright test pda-files open-file cross/library
  4 skipped
  64 passed (2.1m)
```

`pda-files.spec.ts` 8 (4 tests × desktop, phone), `open-file` 16 in 2 files (desktop, phone, firefox, webkit-phone), `cross/library` the rest (4 skipped are the Firefox phone-only tests).

---

## 3. AC2 — the FSM does not change

Only the three named e2e tests changed (section 1). Everything else passes unedited:

```
$ pnpm --filter web exec playwright test open-file --list
Total: 16 tests in 2 files
```

and the full run above ran all 16 across the four projects, including `cross/library.spec.ts`. The share e2e (`share.spec.ts`) is not edited. The unit files `share/open-file.test.ts`, `open-file.wasm.test.ts`, `files.test.ts`, `files.wasm.test.ts` are not edited.

---

## 4. AC3 — Fuzz

```
$ cd fuzz && cargo +nightly fuzz run parse_pda_jff -- -max_total_time=60
Done 1837883 runs in 61 second(s)
```

No crash. The target asserts that an imported PDA survives `to_pda_jff` → `parse_pda_jff` with an equal `Pda`.

---

## 5. AC4 — Size (the open point)

Clean builds of the base (`11ce7bb`) and of the branch (`72afe30`), gzip bytes, the same sum `pnpm size` prints:

| Route | Before | After | Delta |
| --- | --- | --- | --- |
| `sandbox.html` | 128,324 | 129,020 | **+696** |
| `soal/berakhiran-10.html` | 127,607 | 128,376 | **+769** |
| `soal/jumlah-a-genap.html` | 127,607 | 128,376 | **+769** |
| `soal/mengandung-101.html` | 127,607 | 128,376 | **+769** |
| `index.html` | 83,973 | 83,812 | −161 |
| `soal.html` | 84,522 | 84,455 | −67 |
| `panduan.html` | 83,038 | 82,960 | −78 |
| `panduan/berakhiran-x.html` | 89,387 | 89,340 | −47 |
| `tentang.html` | 82,321 | 82,258 | −63 |

The wasm is unchanged (`engine_wasm_bg-VlyrwV86.wasm`, 237.0 KB). `pnpm size` passes (the tool's limit is 170 KB), but the task's 102-byte rule fails on four routes.

**Cause.** `pda-document.ts` was inlined, tree-shaken, into the first-JS chunk that `history.ts` → `pda-commands.ts` pulls into every route with an editor (T-068). The new lazy modules import the document functions, so Rollup extracts `pda-document.ts` into a shared chunk that the first-JS chunk statically needs: that chunk is modulepreloaded (`chunks/oVwv-99E.js`, 2,503 bytes) and the big chunk shrinks by 1,566 (`Bo8rEhU6` → `BJtwTs4m`), a net +937 from the gzip loss of the split, plus the page chunk `nodes/5` shrinking 82 (6,901 → 6,819). The `jff.unsupported_type` text costs 0 in that chunk (the Indonesian text got shorter, the English longer).

**Alternatives measured (all over 102 bytes):** routing the document functions through `pda-work.ts` +308; a dynamic import of `pda-work.ts` in the opener +693; a dynamic import of `pda-document.ts` +910; both dynamic +902.

**The clean fix is already proposed: T-068** ("`history.ts` holds both `createHistory` and `createPdaHistory`… split the PDA history into its own module"). With the PDA history out of the first load, `pda-document.ts` leaves the first-JS chunk, and this task costs only the page change (−82) plus the text change: about −39 bytes. The planner can either order T-068 before T-075 or accept the measured numbers above; the worker does not raise a budget alone.

---

## 6. AC5 — Breaks B1 to B6 (on the final code, each restored)

Each break was made on `72afe30`, the failing line pasted, the one diff line of the break pasted, then `git checkout --` restored the file.

### B1 — `isPdaFile` always false
```diff
+	return false;
 	const kind = importKind(file.name);
```
```
 FAIL  pda-files.test.ts > isPdaFile (F5, F7) > tells a PDA .jff by its type, with any space around it
AssertionError: expected false to be true // Object.is equality
```

### B2 — the export passes an empty layout
```diff
-	const answer = await engine.exportPdaJff(toEnginePda(doc), jffLayout(doc));
+	const answer = await engine.exportPdaJff(toEnginePda(doc), []);
```
```
 FAIL  pda-files.test.ts > pdaJffFile (F3) > asks the engine with the PDA and the names and places of its states
AssertionError: expected [] to deeply equal [ { id: +0, name: 'q0', …(2) }, …(1) ]
```

### B3 — the size check in `isPdaFile` is removed
```diff
 	const kind = importKind(file.name);
 	if (kind === null) return false;
-	if (!(file.size <= FILE_BYTE_LIMIT)) return false;
 	let text: string;
```
```
 FAIL  pda-files.test.ts > isPdaFile (F5, F7) > checks the size before it reads the text: one byte over the limit is not read
AssertionError: expected true to be false // Object.is equality
```

### B4 — no mode switch after an FSM file in the PDA mode
```diff
-	if (context.mode() === 'pda') await context.selectMode('fsm');
 	context.notice({ key: 'import.opened', params: { title: doc.title || context.untitled } });
```
```
 FAIL  open-from-file.test.ts > openFromFile: a finite automaton file (F4, F5) > in the PDA mode opens it and switches to the FSM mode, and makes no PDA record
AssertionError: expected "vi.fn()" to be called with arguments: [ 'fsm' ]
```

### B5 — a record is made before the file is read successfully
```diff
 async function openPda(file: ImportFile, context: OpenFromFileContext): Promise<void> {
+	if (context.library.store) await createPdaMachine(context.library.store, (await import('../editor/pda-document.ts')).createPdaDocument());
 	const result = await openPdaFile(file, engine);
```
```
 FAIL  open-from-file.test.ts > openFromFile: a PDA file (F4, F5) > writes nothing and keeps the list open when the file fails
AssertionError: expected [ { …(8) }, { …(9) } ] to have a length of 1 but got 2
```

### B6 — the list is not closed after a PDA file opens
```diff
 	// The record is written: the list closes and an older failure goes away, as opening an FSM does.
-	context.library.hide();
 	context.library.problem = null;
```
```
 FAIL  open-from-file.test.ts > openFromFile: a PDA file (F4, F5) > in the FSM mode makes exactly one new PDA record, closes the list, clears an older failure and opens it
AssertionError: expected +0 to be 1 // Object.is equality
```

`git status --short` after B6: empty. `git diff --stat` shows only the scope.

---

## 7. AC6 — the gate

```
$ pnpm format:check
Checking formatting...
All matched files use Prettier code style!

$ pnpm check
svelte-check found 0 errors and 0 warnings

$ pnpm lint
$ eslint .

$ pnpm check:strings
ok   76 components have no hard-coded text

$ pnpm check:tokens
ok   78 files use no raw colors

$ pnpm --filter web test
 Test Files  120 passed (120)
      Tests  1409 passed | 3 skipped (1412)

$ pnpm size
ok   initial JS index.html: 81.8 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 126.0 KB gzip (limit 170 KB)
ok   initial JS soal.html: 82.5 KB gzip (limit 170 KB)
… (all routes under 170 KB)
ok   wasm …/engine_wasm_bg-VlyrwV86.wasm: 237.0 KB gzip (limit 250 KB)

$ cargo fmt --check          (exit 0)
$ cargo clippy --all-targets -- -D warnings
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 42.92s
$ cargo test
… (35 `test result: ok`, 0 failed)
```

Playwright: `64 passed, 4 skipped` (section 2).

---

## 8. Deepening pass

**New exports and public members.**
- `pda-files.ts`: `isPdaFile`, `openPdaFile`, `pdaJffFile`, `pdaJsonFile` — used by `open-from-file.ts` and `PdaFileDialog.svelte`; the tests use the same four. `ImportPdaEngine`, `PdaJffEngine` are the parameter types of `openPdaFile`/`pdaJffFile`; the dialog and the page pass the real client. None can be private without moving code.
- `open-from-file.ts`: `openFromFile` (the page's one hook), `Notice` and `OpenFromFileContext` (the page builds one, the test builds one). `problemOf` and `asMessageKey` are private.
- `PdaFileDialog.svelte`: a component, with `doc` and `onclose`.
- `document.ts`: `jffLayout` is the same export with a wider type.
- **Duplicates:** `pdaJffFile` repeats the three lines of `jffFile` and `pdaJsonFile` repeats the one line of `jsonFile`; the spec keeps them because the engine method (`exportPdaJff` vs `exportJff`) and the serializer (`serializePdaDocument` vs `serializeDocument`) differ. `jffLayout` is shared (no `pdaJffLayout` copy), as the amended spec asked.
- **Logic written twice:** `isPdaFile` and `openPdaFile` both compute `importKind` and the size check; they are two public entry points with different answers (a boolean vs a message), and the alternative (returning the text from `isPdaFile`) would change the spec's signature. I kept the two checks; they are three lines each and the test checks both (B3 breaks `isPdaFile` only; `openPdaFile`'s own check is tested at its limit case).
- **Casts:** two, both after a `known()` check: `asMessageKey` in `open-from-file.ts` (named helper, comment) and `result.error.key as MessageKey` in `PdaFileDialog.svelte` (the same pattern as `ShareDialog.svelte`).
- `web/eslint.config.js` gained the new wasm test in the existing allowlist; no rule was weakened.

**The interface is smaller than the work behind it:** the page calls one function; the dialog calls two; everything else (the sniff, the two readers, the gate, the record, the mode switch, the request, the names) is behind them.

---

## 9. Notes and follow-ups

- **Size:** the open point, section 5. The remedy is T-068 (already `proposed`); the alternative is a planner-approved exception for the four routes.
- `PdaFileDialog` lives in `PdaEditor` (not `PdaWorkstation`): the workstation's `opened.doc` is the document it opened, so a dialog there would export a stale machine after edits; `PdaEditor` has the live `snapshot.doc`, exactly as `Editor.svelte` passes `snapshot.doc` to `ShareDialog`. The amended spec allows either ("lazy-loaded by `PdaEditor` or `PdaWorkstation`").
- `jffLayout` was widened in `editor/document.ts`, not `share/files.ts` as the spec said; the function is defined there.
- The `env` check was not needed; the fuzz target and nightly cargo were available in WSL.
- Not run: the full `pnpm test:e2e` suite (the owner's rule; the area specs above were run), a real phone, and the live site.
