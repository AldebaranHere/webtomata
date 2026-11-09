# Task T-073 Report — PDA editor, part 12a: the first-run card and the three examples

Branch: `task/T-073-pda-first-run`, cut from `staging` at `53e38de` (PR 204, the amended T-073).

Commits:
- `7bbeb9d` `docs(agent): start task T-073` — `docs/agent/PLAN.md` set to `in-progress`.
- `437f63e` `feat(editor): show the three PDA examples in the first-run card` — the card, `placePdaExample`, the PDA messages, the tests, ADR 0053 and the glossary.
- Last commit: `docs(agent): record task T-073 (done)` — `PLAN.md` set to `done` and this report.

**Status: ready for review.** AC1 to AC6 hold; the exact numbers are pasted below.

---

## 1. What changed

| File | What |
| --- | --- |
| `web/src/lib/editor/FirstRun.svelte` | The card takes `examples: readonly FirstRunRow[]` (`{ id, title, description, chip }`, already text); `tourSeen` and `ontour` are optional and the tour button renders only when `ontour` is passed. `FirstRunRow` is exported from `<script module>`. |
| `web/src/lib/editor/Editor.svelte` | One `$derived` `firstRunRows` maps its unchanged `firstRun.examples: Example[]` to rows with `getLocale()` and `t()`; `<FirstRun examples={firstRunRows} …>`. `routes/sandbox/+page.svelte` is untouched. |
| `web/src/lib/editor/PdaEditor.svelte` | A `firstRun` prop (`examples`, `failed`, `onexample`); `leftFirstRun` and `showFirstRun` as in `Editor.svelte`; an `overlay` snippet with the same `.first-run` wrapper; the panel renders only when `showFirstRun` is false. |
| `web/src/lib/editor/PdaWorkstation.svelte` | The three rows from `PDA_SAMPLES` (in order) with `pda_first.*` + `kind.dpda`/`kind.ndpda`; `openExample`; the `failed` flag; `editorKey` for `{#key}`; the store kept for the card. |
| `web/src/lib/storage/pda-work.ts` | `placePdaExample(store, openId, doc, now)` — the twin of `placeExample`; a private `readWritten` reads the record back. |
| `web/src/lib/i18n/pda-messages.ts` | Six keys: `pda_first.anbn_title`, `.anbn_description`, `.wcwr_title`, `.wcwr_description`, `.wwr_title`, `.wwr_description` (id + en, `TODO(review)` where the vocabulary is not settled). The chips reuse the existing `kind.dpda` and `kind.ndpda`. |
| `web/src/lib/i18n/pda-messages.test.ts` | The `PDA_KEYS` ledger lists the six new keys. |
| `docs/glossary.md` | `palindrom` and `penanda tengah`, `TODO(review)`. |
| `docs/decisions/0053-pda-first-run.md` | The ADR of the shared card, the row shape and `placePdaExample`. |
| `web/e2e/fixtures.ts` | `dismissFirstRun(page)` and `openPda(page)`: the one shared way for the six PDA e2e files to leave the card. |
| `web/e2e/pda-first-run.spec.ts` (new) | F1 to F6. |
| `web/src/lib/storage/pda-example.test.ts` (new) | F7. |
| `web/e2e/pda-editor.spec.ts`, `pda-panel.spec.ts`, `pda-determinism.spec.ts`, `pda-messages.spec.ts`, `pda-table-edit.spec.ts`, `cross/pda-storage.spec.ts` | Open through `openPda`/`openPdaSandbox`; the E1 assertion in `pda-editor.spec.ts` now says the card is present; `pda-panel` E1 leaves the card after each reload of the still-empty record. |

No FSM first-run test changed: `web/e2e/cross/first-run.spec.ts`, `cross/storage.spec.ts`, `cross/table.spec.ts`, `cross/layout.spec.ts` and `storage/example.test.ts` are untouched.

---

## 2. AC1 — F1 to F7

The new spec (F1 has four tests: the card, Enter, Space, and a state added with the keyboard; F2, F3, F4, F6 follow) and the unit file:

```
$ cd ~/webtomata-ds/web && pnpm exec playwright test pda-first-run first-run
  104 passed (1.5m)

  # of the 104, 88 are cross/first-run.spec.ts (22 in each of the four engines):
$ grep "cross/first-run.spec.ts" ~/tmp/t073-final-e2e.log | wc -l
88
$ grep "pda-first-run.spec.ts" ~/tmp/t073-final-e2e.log | wc -l
16
```

Per project, the new spec on its own:

```
$ pnpm exec playwright test pda-first-run --project=desktop
  7 passed (12.5s)
$ pnpm exec playwright test pda-first-run --project=phone
  7 passed (8.1s)
```

(The 7 are the original F1 show/Enter/Space, F2, F3, F4, F6; the keyboard test of F1 was added when the B1 break showed that the two `states.length` guards needed a test of their own. It ran in the final 104 and is repeated below.)

```
$ pnpm --filter web exec vitest run src/lib/storage/pda-example.test.ts
 ✓ src/lib/storage/pda-example.test.ts (6 tests)
```

What each fixture checks:

- **F1** — three rows in the order `aⁿbⁿ (n ≥ 1)`, `wcwᴿ`, `wwᴿ`, with chips `DPDA`, `DPDA`, `NDPDA`; the blank button; the privacy line; exactly four buttons (no tour); no panel; every row and the blank button ≥ 44 px; tab order row → row → row → blank; axe clean; Enter and Space open the focused row; a state added with the keyboard leaves the card.
- **F2** — tap `wwᴿ`: two states, three edges, three label texts, five transitions in the stored document, `NDPDA` selected, the card gone, the save line `saved`, and a reload opens the same document.
- **F3** — tap `aⁿbⁿ`, delete the accepting state, the save line `saved`, reload: one state. Copy guard in the page: switch to FSM (flush), delete the PDA records, switch back to a fresh empty record, tap `aⁿbⁿ` again: two states (a mutated module-level sample would give one). The unit test of `placePdaExample` also shows the returned document is not the input.
- **F4** — tap "Mulai dari kanvas kosong": the card goes, the canvas is empty and the stored document is unchanged; a state with a tap leaves the card away; undo back to empty does not bring the card back.
- **F5** — the FSM card: `cross/first-run.spec.ts` passes unedited in desktop, phone, Firefox and WebKit (88 tests; see AC4).
- **F6** — with `IDBObjectStore.prototype.put` refusing (the S4 pattern): `first.failed` is shown calmly, the card stays, the single PDA record is unchanged and empty, and after writes are allowed the editor adds a state and saves.
- **F7** — `placePdaExample`: an empty untouched record is rewritten in place (same id and `createdAt`, one record, a copy returned); a record with a state, a title, or a symbol in either alphabet is left alone and gets a new record; no open id or a missing id makes a new record; a refused write rejects and leaves the record as it was.

Repeat runs of the new tests:

```
$ pnpm exec playwright test pda-first-run --project=desktop --project=phone --repeat-each=5
  70 passed (1.1m)

$ pnpm exec playwright test pda-first-run --project=desktop --project=phone -g "F3|F6" --repeat-each=10
  40 passed (50.4s)

$ pnpm exec playwright test pda-first-run --project=desktop --project=phone -g "keyboard makes the card" --repeat-each=10
  20 passed (18.5s)
```

---

## 3. AC2 — accessibility and phone

The axe scan of F1 runs on the card in both the desktop and the phone project (`expectNoAxeViolations`, WCAG 2.0/2.1/2.2 A+AA and best practices, no violation). The card is the FSM's labelled section (`<section aria-labelledby="first-title">`), the rows and the blank button are `min-height: var(--target-min)` (44 px) and measured in F1, and the tab order is row → row → row → blank. Enter and Space both open a row (two tests); a new state with the keyboard also leaves the card.

---

## 4. AC3 — size

`pnpm size` on the clean branch before the change (the same build the exact table below uses):

```
ok   initial JS index.html: 81.5 KB gzip (limit 170 KB)
ok   initial JS panduan/berakhiran-x.html: 88.5 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 82.3 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 124.7 KB gzip (limit 170 KB)
ok   initial JS soal/berakhiran-10.html: 124.1 KB gzip (limit 170 KB)
ok   initial JS soal/jumlah-a-genap.html: 124.1 KB gzip (limit 170 KB)
ok   initial JS soal/mengandung-101.html: 124.1 KB gzip (limit 170 KB)
ok   initial JS soal.html: 83.7 KB gzip (limit 170 KB)
ok   initial JS tentang.html: 81.6 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-VlyrwV86.wasm: 237.0 KB gzip (limit 250 KB)
```

`pnpm size` after (root `pnpm build`, wasm rebuilt):

```
ok   initial JS index.html: 81.5 KB gzip (limit 170 KB)
ok   initial JS panduan/berakhiran-x.html: 88.5 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 82.3 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 124.8 KB gzip (limit 170 KB)
ok   initial JS soal/berakhiran-10.html: 124.2 KB gzip (limit 170 KB)
ok   initial JS soal/jumlah-a-genap.html: 124.2 KB gzip (limit 170 KB)
ok   initial JS soal/mengandung-101.html: 124.2 KB gzip (limit 170 KB)
ok   initial JS soal.html: 83.7 KB gzip (limit 170 KB)
ok   initial JS tentang.html: 81.6 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-VlyrwV86.wasm: 237.0 KB gzip (limit 250 KB)
```

The display rounds to 0.1 KB, so the exact bytes were measured with the same gzip and the same HTML refs (before: the branch stashed and built; after: the final build):

| Route | before (bytes) | after (bytes) | delta |
| --- | ---: | ---: | ---: |
| `index.html` | 83,413 | 83,414 | +1 |
| `panduan/berakhiran-x.html` | 90,628 | 90,629 | +1 |
| `panduan.html` | 84,246 | 84,247 | +1 |
| `sandbox.html` | 127,688 | 127,750 | **+62** |
| `soal/berakhiran-10.html` | 127,078 | 127,142 | **+64** |
| `soal/jumlah-a-genap.html` | 127,078 | 127,142 | **+64** |
| `soal/mengandung-101.html` | 127,078 | 127,142 | **+64** |
| `soal.html` | 85,740 | 85,741 | +1 |
| `tentang.html` | 83,544 | 83,545 | +1 |

The largest growth is **+64 bytes = 0.0625 KB** (`soal/*`), under the 0.1 KB limit. The +1 byte on the routes that do not ship the card is the lazy import map of the PDA chunk in the shared app shell; it is not card code. The `wasm` is byte-identical (`engine_wasm_bg-VlyrwV86.wasm`, 237.0 KB).

PDA lazy chunks (the chunk with `PdaWorkstation`, and the chunk with the PDA messages and the samples):

| Chunk | before (gzip) | after (gzip) | delta |
| --- | ---: | ---: | ---: |
| `nodes/5…js` (PdaWorkstation) | 6,794 | 6,790 | −4 |
| `chunks/…js` (PDA messages/samples/editor) | 9,764 | 11,016 | +1,252 |
| **total** | **16,558** | **17,806** | **+1,248 (+1.22 KB)** |

---

## 5. AC4 — the FSM does not change

`cross/first-run.spec.ts` and the other FSM first-run tests were not edited:

```
$ git diff 53e38de..HEAD -- web/e2e/cross/first-run.spec.ts web/e2e/cross/storage.spec.ts web/e2e/cross/table.spec.ts web/e2e/cross/layout.spec.ts web/src/lib/storage/example.test.ts
(no output)
```

In the final run, 88 of the 104 Playwright tests are that spec (22 in each of desktop, phone, Firefox and WebKit), all passed. The FSM card keeps the same texts, the same three examples in the same order, the three chips and the tour button.

---

## 6. AC5 — the four breaks, on the final code

Each was made after the last change to the code under test, the build was remade where Playwright needed it, the failing line is pasted, and the file was restored. `git status --short` after the restores shows only the files of the scope.

**B1 — the card shows after a state was added.** The condition `snapshot.doc.states.length === 0` exists twice in `PdaEditor.svelte`: in the `$effect` that sets `leftFirstRun` and in `showFirstRun`. Removing only the `showFirstRun` condition did **not** fail F2 (`1 passed`), because the effect hides the card too. The break therefore removes both guards:

```
-	$effect(() => {
-		if (snapshot.doc.states.length > 0) leftFirstRun = true;
-	});
-	const showFirstRun = $derived(
-		firstRun !== undefined && !leftFirstRun && snapshot.doc.states.length === 0
-	);
+	const showFirstRun = $derived(firstRun !== undefined && !leftFirstRun);
```

Failing line (`F1: … a state added with the keyboard makes the card go away by itself`):

```
    > 133 | 		await expect(card(page)).toHaveCount(0);
  1 failed
```

This is the finding for the planner: the two guards are redundant for the *after a state* case; only the pair keeps the card away, so a one-line break of the derived condition cannot fail a test. The new keyboard test is the guard that catches it.

**B2 — `placePdaExample` returns the sample itself.** Both returns were changed to `doc` (the replace branch is the one the copy test exercises):

```
-			return { record, doc: readWritten(record), replaced: true };
+			return { record, doc, replaced: true };
```

Failing line:

```
 ❯ src/lib/storage/pda-example.test.ts:51:26
    51|   expect(placed.doc).not.toBe(input);
AssertionError: expected { schemaVersion: 1, …(9) } not to be { schemaVersion: 1, …(9) } // Object.is equality
  1 failed
```

**B3 — the chip of `wwᴿ` says DPDA.**

```
-			chip: 'kind.ndpda'
+			chip: 'kind.dpda'
```

Failing line:

```
    > 78 | 		expect(texts[2]).toContain('NDPDA');
  1 failed
```

**B4 — the card shows a tour button in the PDA mode.**

```
+					ontour={() => undefined}
```

Failing line:

```
    > 85 | 		await expect(card(page).getByRole('button')).toHaveCount(4);
  1 failed
```

---

## 7. AC6 — the gate

```
$ pnpm check
svelte-check found 0 errors and 0 warnings

$ pnpm lint
$ eslint .
(no output)

$ pnpm format:check
All matched files use Prettier code style!

$ pnpm check:strings
ok   75 components have no hard-coded text

$ pnpm check:tokens
ok   77 files use no raw colors

$ pnpm --filter web test
 Test Files  116 passed (116)
      Tests  1368 passed | 3 skipped (1371)
   Duration  9.75s

$ pnpm build
✔ done
$ pnpm size
(all lines ok; see AC3)
```

Playwright:

```
$ pnpm exec playwright test pda-first-run first-run
  104 passed (1.5m)

$ pnpm exec playwright test pda-editor pda-panel pda-determinism pda-messages pda-table-edit --project=desktop --project=phone
  15 skipped
  77 passed (1.6m)

$ pnpm exec playwright test cross/pda-storage
  24 passed (39.5s)
```

The new tests were repeated 5× (and F3/F6 and the keyboard test 10×), see AC1.

---

## 8. Deepening pass

**New exports and public members.** (1) `FirstRunRow` (from `<script module>` in `FirstRun.svelte`) — used by `PdaEditor` and `PdaWorkstation`; it stays one declaration because the two callers must agree on the row shape. (2) `placePdaExample` — the only caller is `PdaWorkstation`; the private `readWritten` is shared by its two returns. It cannot reuse `placeExample` (that one is typed for `MachineDocument`/`SavedFsmMachine`; a union would change the FSM path, which this task must not touch). The twin pattern is already the file's pattern (`createPdaMachine`/`createMachine`, `openLatestPda`/`openLatest`). (3) `dismissFirstRun` and `openPda` are test helpers in the e2e fixture file; `openPda` is used by six specs and `dismissFirstRun` by `openPda` and `pda-panel` E1, so they are one place and not six copies. (4) New members of public interfaces: `PdaEditor`'s `firstRun` prop; `FirstRun`'s `FirstRunRow[]` and optional `tourSeen`/`ontour`. `Editor`'s public prop is unchanged.

**The interface is smaller than the work:** one prop (`firstRun`), one row type, one store function and one helper.

**Duplicates and casts.** The `.first-run` wrapper (5 lines) is duplicated in `Editor.svelte` and `PdaEditor.svelte`: it offsets the card under the editor bar, and a single rule would need `EditorFrame` or a global style, both outside this task's scope; the FSM's file must stay as it was. Production code adds **0** `as` casts, **0** `@ts-ignore`, **0** `as unknown as`; it has three non-null assertions (`PDA_SAMPLES[0]!`, `[1]!`, `[2]!` — the frozen three-entry array; F1/F2 would fail if its order or length changed) and one `as const` on the `EXAMPLES` metadata (to keep the message keys literal). The test files use the existing patterns (`as unknown as { __refuse: boolean }` from `pda-storage` S4, and `as { id; type }[]` after `getAll`).

---

## 9. What I did not run, and notes

- Not run: the full Playwright suite (per `AGENTS.md`; CI runs the four shards), and the new non-cross spec under Firefox/WebKit. The card itself is the shared FSM card, and `cross/first-run.spec.ts` ran in Firefox and WebKit; the PDA phone layout was exercised in the `phone` project (Chrome, Pixel 7).
- The card's own texts are the FSM's (`first.title`, `first.subtitle`, `first.blank`, `first.privacy`, `first.failed`), so they add nothing to the shared dictionary. The samples' texts are in the lazy `pda-messages.ts`; the six keys are in both languages.
- The panel is hidden while the card shows (amended spec); "Buka file .jff atau JSON" is deferred to T-075.
- `pda-panel` E1 needed one `dismissFirstRun` after each reload: an empty record shows the card again on reload, so the panel is not there until the card is left. The `pda-editor` E1 line that said "no first-run card" now says the card is present.
- `pda-messages.test.ts` is the key ledger and lists the six new keys; that is the only existing unit test edited.
- The glossary has `palindrom` and `penanda tengah` marked `TODO(review)`; report it to the owner.
- The B1 finding above: the `states.length` condition is implemented twice in `PdaEditor` (and in `Editor`); a one-line break of the derived condition cannot fail, because the `$effect` also sets `leftFirstRun`. The new keyboard test and the two-part break document it. The planner may want to simplify or keep the defence; I kept both, as the FSM has both.

**Rollback:** `git revert 437f63e` (and the docs commit); nothing in the document formats, the engine or the FSM storage changes.
