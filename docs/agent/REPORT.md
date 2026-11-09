# Task T-068 Report — Keep the PDA code out of the first load (split `createPdaHistory`)

Branch: `task/T-068-pda-history-lazy`, cut from `origin/staging` at `6123999` (T-075 merged). The
amended T-068 spec was not yet in `origin/staging` (that was still `6123999`); it was one commit ahead
on `origin/docs/T-068-amend` (`ccf351c`), so the branch was fast-forwarded to `ccf351c` before the
first commit, exactly the amended spec this report follows.

Commits:

- `49eaf6b` `docs(agent): start task T-068` — `PLAN.md` set to `in-progress`.
- `224ae8a` `feat(editor): split the PDA history out of the first load` — the split, the guard, the
  depth test and ADR 0056.
- `8700bdd` `docs(agent): record task T-068` — the report and the PLAN status.
- this commit — `test(editor): read <SCRIPT> blocks in the first-load guard` (the CodeQL fix, section 4).

**Status: AC1–AC5 hold.** The first JS falls by 4,230 bytes on `sandbox.html` and 4,227 on each
`soal/*.html`, so the exception of ADR 0055 is paid back; no page is larger.

---

## 1. What changed

| File | What |
| --- | --- |
| `web/src/lib/editor/pda-history.ts` (new) | `createPdaHistory` and `PdaHistory`, moved as they were, importing the generic engine from `history.ts`. |
| `web/src/lib/editor/history.ts` | Drops the four PDA imports, `PdaHistory` and `createPdaHistory`; exports `createGenericHistory` and `GenericApplyResult`. |
| `web/src/lib/editor/interaction/pda-editor.ts` | Imports `createPdaHistory` from `../pda-history.ts` (one line). |
| `web/src/lib/editor/index.ts` | One `export * from './pda-history.ts';` so the barrel's surface is unchanged. |
| `web/src/lib/editor/pda-commands.ts` | The one comment that named `history.ts` now names `pda-history.ts`. |
| `web/src/lib/editor/pda-history.property.test.ts` | One import line only. |
| `web/src/lib/first-load.test.ts` (new) | The F2 guard: a static walk over value imports and re-exports. |
| `web/src/lib/editor/pda-history.test.ts` (new) | The F1 default-depth test and the oracle of B3. |
| `docs/decisions/0056-pda-history-module.md` (new) | The decision; it closes the exception of ADR 0055. |

No other file changed. The feature commit's stat:

```
 docs/decisions/0056-pda-history-module.md       |  37 +++++++
 web/src/lib/editor/history.ts                   |  20 +---
 web/src/lib/editor/index.ts                     |   1 +
 web/src/lib/editor/interaction/pda-editor.ts    |   2 +-
 web/src/lib/editor/pda-commands.ts              |   2 +-
 web/src/lib/editor/pda-history.property.test.ts |   2 +-
 web/src/lib/editor/pda-history.test.ts          |  24 +++++
 web/src/lib/editor/pda-history.ts               |  22 ++++
 web/src/lib/first-load.test.ts                  | 136 ++++++++++++++++++++++++
 9 files changed, 225 insertions(+), 21 deletions(-)
```

---

## 2. Tests first (the red run)

Written against the intended API, before the split. The guard failed on the real chain, and the depth
test failed because its module did not exist yet:

```
 ❯ src/lib/first-load.test.ts (2 tests | 1 failed) 40ms
   ❯ the first load (2)
     ✓ starts from every entry and reaches the editor core 17ms
     × takes no value import to the PDA document, commands or history 21ms
 ❯ src/lib/editor/pda-history.test.ts (0 test)

Error: Cannot find module './pda-history.ts' imported from
/home/Aldebaran64/webtomata-ds/web/src/lib/editor/pda-history.test.ts

FAIL  src/lib/first-load.test.ts > the first load > takes no value import to the PDA document, commands or history
AssertionError: expected [ …(2) ] to deeply equal []

- []
+ [
+   "lib/editor/interaction/editor.ts
+   lib/editor/interaction/editor.ts -> ../history.ts
+   lib/editor/history.ts -> ./pda-commands.ts",
+   "lib/editor/interaction/editor.ts
+   lib/editor/interaction/editor.ts -> ../history.ts
+   lib/editor/history.ts -> ./pda-document.ts",
+ ]
```

After the split, the focused files:

```
 ✓ src/lib/first-load.test.ts (2 tests) 49ms
 ✓ src/lib/editor/history.test.ts (20 tests) 31ms
 ✓ src/lib/editor/pda-history.test.ts (1 test) 10ms
 ✓ src/lib/editor/pda-history.property.test.ts (5 tests) 740ms
 ✓ src/lib/editor/history.property.test.ts (7 tests) 798ms

 Test Files  5 passed (5)
      Tests  35 passed (35)
```

---

## 3. F1 — behaviour is the same, and the depth test

The PDA history code moved without a change; the only existing test line edited is
`pda-history.property.test.ts:12` (`from './history.ts'` → `from './pda-history.ts'`). The property
test still asserts that random sequences round-trip through undo and redo and that the documents pass
`checkPdaDocument`; that is all it asserts (it does not count the 15 command types — the spec's
amendment says so).

**The depth test** (`web/src/lib/editor/pda-history.test.ts`): one state, then 201 moves; 202 steps in
all. The default depth of 200 drops the add and the first move, so undo stops after 200 steps at
`x = 1`:

```
 ✓ src/lib/editor/pda-history.test.ts (1 test) 10ms
```

Break B3 sets the default one lower (`?? 199`), which gives 199 undos and fails; the test is the
oracle of B3.

---

## 4. F2 — the guard

`web/src/lib/first-load.test.ts` (136 lines) walks the source from the six entries the amended spec
lists: `routes/+layout.svelte`, `routes/+layout.ts`, `routes/sandbox/+page.svelte`,
`lib/editor/Editor.svelte`, `lib/storage/library.svelte.ts`, `lib/editor/interaction/editor.ts`.

- It follows static value `import … from` and `export … from` only. It skips statement-level
  `import type` / `export type`, an import whose specifiers are all inline `type`, and `import(…)`.
  It reads `.ts` files whole and both `<script>` and `<script module>` blocks of `.svelte` files.
- It resolves `#lib/` and `$lib/` to `src/lib/` and relative paths, trying `.ts` and `.svelte`.
- It fails on any relative or `#lib/` specifier that names no file (`expect(unresolved).toEqual([])`):
  a guard that silently skips them can pass with nothing.
- It cannot pass silently: the first test asserts every entry exists, and that the walk really
  reached `history.ts` and `interaction/editor.ts` (the canaries, broke in B4).
- It fails when the walk reaches `pda-document.ts`, `pda-commands.ts` or `pda-history.ts`.
- Its header comment names the accepted blind spot: the soal route's
  `storage/index.ts` → `pda-work.ts` chain, which Rollup tree-shakes out of the build; the guard is
  seeded from the layout and the sandbox only, and the soal route is not touched.

Before the split there were five type-only edges to the PDA modules (`storage/autosave.ts`,
`storage/library.ts`, `storage/store.ts`, and two in `editor/history.ts`); after it the three storage
edges remain and the guard skips them, which is what makes it pass on correct code. The walk visits
85 modules. It passes on the final code:

```
 ✓ src/lib/first-load.test.ts (3 tests) 22ms
```

**Review fix (PR 214, CodeQL `js/bad-tag-filter`):** the `SCRIPT` regex is now case-insensitive and allows a space
before the closing `>`; a new guard test reads an upper-case `<SCRIPT lang="ts">` block, which the old regex skipped.
**Second review fix (same alert):** the closing tag now takes anything up to `>` (`</script\b[^>]*>`), and the test's second fixture ends a block with `</script\t\n bar>`.

---

## 5. F3 — bytes, all nine pages

The metric is `tools/check-size.mjs`: the gzip sum of the `.js` files the HTML references (entry and
modulepreloads), in bytes, before and after.

| Page | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `index.html` | 83,812 | 83,801 | −11 |
| `panduan.html` | 82,960 | 82,949 | −11 |
| `panduan/berakhiran-x.html` | 89,340 | 89,329 | −11 |
| `sandbox.html` | 129,020 | 124,790 | **−4,230** |
| `soal.html` | 84,455 | 84,444 | −11 |
| `soal/berakhiran-10.html` | 128,376 | 124,149 | **−4,227** |
| `soal/jumlah-a-genap.html` | 128,376 | 124,149 | **−4,227** |
| `soal/mengandung-101.html` | 128,376 | 124,149 | **−4,227** |
| `tentang.html` | 82,258 | 82,247 | −11 |

The limits of F3: `sandbox.html` at or under **128,324** → 124,790 (3,534 under);
each `soal/*.html` at or under **127,607** → 124,149 (3,458 under); no page is larger than before.

What left the sandbox first load: the preloaded `oVwv-99E.js` (`pda-document.ts`, 2,503 bytes gz) is
no longer listed, and `pda-commands.ts` left the big chunk (`BJtwTs4m` 30,725 → `B3RvL52T` 29,012,
−1,713); the page chunk lost 3 and the app chunk 11. Sandbox: 23 → 22 chunks; each soal route: 22 → 21.

**The metric's known gap** (as the amendment asks): the soal node chunk statically imports
`84qfJG_O.js` (4,959 bytes gz) without the HTML listing it, so the tool does not count it; it is the
same before and after, so the comparison holds. The real first load of a soal route is about 4,959
bytes larger than the table's number, before and after.

---

## 6. F4 — the PDA mode still loads and works, and what moves into it

The PDA e2e files pass (section 7). The chunks that hold the moved code after the build:

| Chunk | gzip bytes | What |
| --- | ---: | --- |
| `oVwv-99E.js` | 2,503 | `pda-document.ts`; no longer in the first load, fetched with the PDA mode |
| `R52WEoXk.js` | 2,833 | `pda-commands.ts` + `pda-work.ts`; the mode already fetched pda-work's chunk (then `sYFMcK8a.js`), so only the command bytes are added to it |
| `C6fbBMZT.js` | 11,685 | the PDA editor chunk; holds the new `pda-history.ts` (`createPdaHistory`) and the `pdaKind` object, which the mode already fetched |

The first load no longer has `pda-document.ts` (2,503 bytes gz) and the `pda-commands.ts` code (the
big chunk shrank by 1,713 bytes gz). This is the cost that moves into the PDA mode's fetch; it was
not measured as a delay.

---

## 7. AC5 — the gate, on the final code

```
$ pnpm format:check
All matched files use Prettier code style!
$ pnpm check
svelte-check found 0 errors and 0 warnings
$ pnpm lint
$ eslint .
$ pnpm check:strings
ok   76 components have no hard-coded text
$ pnpm check:tokens
ok   78 files use no raw colors
```

```
$ pnpm --filter web test
 Test Files  122 passed (122)
      Tests  1413 passed | 3 skipped (1416)
   Duration  10.64s
```

```
$ pnpm build
Run npm run preview to preview your production build locally.

> Using @sveltejs/adapter-static
Wrote site to "build"
✔ done
```

```
$ pnpm size
ok   initial JS index.html: 81.8 KB gzip (limit 170 KB)
ok   initial JS panduan/berakhiran-x.html: 87.2 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 81.0 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 121.9 KB gzip (limit 170 KB)
ok   initial JS soal/berakhiran-10.html: 121.2 KB gzip (limit 170 KB)
ok   initial JS soal/jumlah-a-genap.html: 121.2 KB gzip (limit 170 KB)
ok   initial JS soal/mengandung-101.html: 121.2 KB gzip (limit 170 KB)
ok   initial JS soal.html: 82.5 KB gzip (limit 170 KB)
ok   initial JS tentang.html: 80.3 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-VlyrwV86.wasm: 237.0 KB gzip (limit 250 KB)
```

```
$ pnpm --filter web exec playwright test pda-editor pda-panel pda-library pda-files cross/pda-storage --project=desktop --project=phone
Running 74 tests using 6 workers
  13 skipped
  61 passed (1.2m)
```

The 13 skipped are the project-split phone-only/desktop-only tests, as before.

---

## 8. AC4 — the four breaks, on the final code

Each break was made on `224ae8a`, run, and restored with `git checkout --`; `git status --short` was
empty after each, and `git diff --stat` is empty now.

### B1 — a value import of `pda-document.ts` in `history.ts`

```diff
@@ -11,0 +12 @@ import type { MachineDocument } from './document.ts';
+import { pdaDocumentsEqual } from './pda-document.ts';
```

```
 FAIL  src/lib/first-load.test.ts > the first load > takes no value import to the PDA document, commands or history
AssertionError: expected [ Array(1) ] to deeply equal []

- []
+ [
+   "lib/editor/interaction/editor.ts
+   lib/editor/interaction/editor.ts -> ../history.ts
+   lib/editor/history.ts -> ./pda-document.ts",
+ ]
```

### B2 — `history.ts` re-exports `createPdaHistory`

```diff
@@ -143,0 +144,2 @@ export function createHistory(initial: MachineDocument, options: { limit?: number } = {}): History {
+
+export { createPdaHistory } from './pda-history.ts';
```

```
 FAIL  src/lib/first-load.test.ts > the first load > takes no value import to the PDA document, commands or history
AssertionError: expected [ Array(1) ] to deeply equal []

- []
+ [
+   "lib/editor/interaction/editor.ts
+   lib/editor/interaction/editor.ts -> ../history.ts
+   lib/editor/history.ts -> ./pda-history.ts",
+ ]
```

### B3 — a wrong default depth in the new file

```diff
@@ -20 +20 @@ export function createPdaHistory(
-		limit: options.limit
+		limit: options.limit ?? 199
```

```
 FAIL  src/lib/editor/pda-history.test.ts > the default depth of the PDA history > keeps the last 200 steps and drops the oldest
AssertionError: expected 199 to be 200 // Object.is equality

- Expected
+ Received

- 200
+ 199
```

### B4 — the guard's canary (an entry renamed in the test's list)

```diff
@@ -18 +18 @@ const ENTRIES = [
-	'routes/+layout.ts',
+	'routes/+layoutx.ts',
```

```
 FAIL  src/lib/first-load.test.ts > the first load > starts from every entry and reaches the editor core
AssertionError: expected [ Array(1) ] to deeply equal []

- []
+ [
+   "/home/Aldebaran64/webtomata-ds/web/src/routes/+layoutx.ts",
+ ]
```

The guard also fails on an unresolved `#lib/` or relative specifier by construction
(`expect(unresolved).toEqual([])`); B4 breaks the other canary. I did not find a test that cannot fail;
the two new tests each have a break that fails them (B3, B4), and both guard failures (B1, B2) are
above.

---

## 9. AC2 — no behaviour change, and the tests that were run

The one existing test line edited:

```diff
-import { createPdaHistory } from './history.ts';
+import { createPdaHistory } from './pda-history.ts';
```

Tests run: the full `pnpm --filter web test` (122 files, 1413 passed, 3 skipped) and the five PDA
e2e specs above (61 passed, 13 skipped). The focused history/PDA-history files (35 tests) are in
section 2. No other existing test changed. The FSM history files (`history.test.ts`,
`history.property.test.ts`) are untouched and pass.

---

## 10. Deepening pass

New exports and public members:

- `createPdaHistory` — moved, not new; its consumers are `interaction/pda-editor.ts` and the depth
  test. It must be public (the editor and the barrel reach it).
- `PdaHistory` — moved; no consumer names it today. It stays because the spec moves it as-is and the
  barrel keeps the same surface; it can be dropped later if the surface is allowed to shrink.
- `createGenericHistory` — new public; used by `pda-history.ts`. It cannot be private: the PDA twin
  is another module, and copying it was the alternative the spec rejected.
- `GenericApplyResult` — new type export; it is named in `createGenericHistory`'s signature. It could
  stay private (legal without declaration emit); it is exported so that the one newly public
  function's signature names public types, and it is a type (erased, no bytes).

No member was added to `GenericHistory` or to any editor interface. No logic is written twice: the
depth, coalescing and refusal rules exist only in `createGenericHistory`; `pda-history.ts` is the
wiring. The new guard is a test, not production code, and exports nothing. Casts added: **0** (the
two `as` casts are the pre-existing ones; one moved with the function). The interface is smaller than
the work behind it: two moved functions, one exported helper and one type, for a split that takes
the PDA code out of the first load of four routes.

Limits and boundaries: no limit was introduced. The one limit involved (the 200-step default) is
tested past it in `pda-history.test.ts`: 202 steps (the add and 201 moves), 200 of them kept. No random test was tuned,
so the "ten times the seeds" rule does not apply; the existing PDA property test still runs on its
200 sequences.

---

## 11. What I did not run

- The full e2e suite and the Firefox/WebKit cross specs (the owner's rule: CI runs them; this task
  changes no layout, touch or storage and only needs the PDA area on desktop and phone).
- `pnpm test:wasm`: the Rust and WASM code is untouched (`git diff` has no crate file); `pnpm build`
  did rebuild the wasm and its size is unchanged at 237.0 KB.
- A real phone; the phone runs were the Playwright Pixel 7 emulation, as in the other tasks.

No out-of-scope work was done; no `proposed` entry was needed.
