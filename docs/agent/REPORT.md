# T-077 — The PDA label sheet fills a phone and keeps its buttons above the keyboard

Branch `task/T-077-label-sheet`, cut from `origin/staging` at `1426f16` (PR 226, the amended spec).
Status: `done`. Commits: `1779845` (the change) and the last commit of this branch (this report and the
status). **Not pushed:** the owner reviews first.

## 1. What changed

| File | Change |
| --- | --- |
| `web/src/lib/editor/PdaEditor.svelte` | the two rules of the sheet, in its `.pda-sheet` block: `.pda-sheet :global(.pda-label-form) { width: 100% }` and `.pda-sheet :global(.pda-label-form .rows) { max-height: 72px }`, with the numbers and the reason in a comment |
| `web/src/lib/editor/PdaLabelForm.svelte` | the template: the refusal wrapper and the action row moved before the add-row button and the hint; `enterkeyhint="done"` on the three inputs |
| `web/e2e/pda-label-sheet.spec.ts` (new) | the seven tests of F1–F6 and the axe check |
| `web/e2e/pda-editor.spec.ts` | the one tab-order test of E3 (lines 189–214): the buttons now come before the add-row button |
| `docs/decisions/0058-pda-label-sheet-phone.md` (new) | the decision and its limits |
| `docs/agent/PLAN.md` | status |

No other source file changed. The popover's 320 px, `PdaLabelPopover.WIDTH = 320`, the sheet's 60 %
cap, the viewport meta, the FSM label box and every other input are untouched. Nothing in the
documents or the formats changes.

## 2. Tests first (AC1): the new spec on `staging`'s code

The spec was written before the change and run against the unchanged components. Seven of the eight
tests failed; the axe test passed (the sheet was already clean). Line numbers are from that run, before
`prettier --write` shifted them by a few lines.

```
$ pnpm exec playwright test pda-label-sheet --project=phone --project=desktop
  ...
  7 failed
    [desktop] › F3/F5: the popover keeps its order and is still 320 px wide
    [phone]   › F1: the form fills the width of the sheet at 375px
    [phone]   › F1: the form fills the width of the sheet at 360px
    [phone]   › F2: the buttons stay within the keyboard line, at one, two and three rows
    [phone]   › F3: the action row follows the refusal and the fields, and the tab order says so
    [phone]   › F4: the three inputs ask for the done key, and Enter commits from each of them
    [phone]   › F6: the rows list scrolls inside itself and a new row is scrolled into view
  8 skipped
  1 passed
```

The failing line of each (the fixture derivation is in section 3):

```
# F1, 375 px and 360 px
    Error: expect(received).toBeLessThanOrEqual(expected)
    Expected: <= 1
    Received:    55            (375 px)
    Received:    40            (360 px)
    > 93 | 			expect(Math.abs(formBox.width - sheetBox.width)).toBeLessThanOrEqual(1);

# F2
    Expected: <= 190
    Received:    248.5
    > 123 | 		expect(await distance()).toBeLessThanOrEqual(KEYBOARD_LINE);

# F3 and F5, the DOM order
    - Expected  - 2
    + Received  + 2
      Object {
        "actionsAfterLastField": true,
    -   "actionsBeforeAddRow": true,
    -   "actionsBeforeHint": true,
    +   "actionsBeforeAddRow": false,
    +   "actionsBeforeHint": false,
    > 137 | 			actionsBeforeAddRow: true,

# F4
    - Expected  - 3
    + Received  + 3
      Array [
    -   "done",
    -   "done",
    -   "done",
    +   null,
    +   null,
    +   null,
    > 177 | 		).toEqual(['done', 'done', 'done']);

# F6
    Expected: <= 72
    Received:    96
    > 223 | 			expect(box.client).toBeLessThanOrEqual(72);
```

The existing tab-order test was the one test the spec named as changeable. On the new order it failed
at `pda-editor.spec.ts:208` (`expect(addRowBtn).toBeFocused()`: "Received: inactive"), and was updated:

```
$ git diff web/e2e/pda-editor.spec.ts
-		// row 0: Baca -> Pop -> Push -> Hapus -> Tambah transisi -> Ketik ε -> Batal -> Simpan
+		// Tab order verification (T-077: the buttons come before the add-row button):
+		// row 0: Baca -> Pop -> Push -> Hapus -> Ketik ε -> Batal -> Simpan -> Tambah transisi
...
-		await page.keyboard.press('Tab');
-		await expect(addRowBtn).toBeFocused();
 		await page.keyboard.press('Tab');
 		await expect(epsBtn).toBeFocused();
 		await page.keyboard.press('Tab');
 		await expect(cancelBtn).toBeFocused();
 		await page.keyboard.press('Tab');
 		await expect(saveBtn).toBeFocused();
+		await page.keyboard.press('Tab');
+		await expect(addRowBtn).toBeFocused();
```

## 3. The fixtures (AC1), with the derivation

The phone fixtures set the viewport to 375 × 667 and to 360 × 740 (`setViewportSize`; the `phone`
project is a Pixel 7 at 412 × 915) and skip on the desktop project. The popover fixture runs on the
desktop project. All distances are css px from `getBoundingClientRect`.

### F1 — the width

**Derivation.** The sheet is the `<aside class="pda-sheet">` the frame puts in its panel slot. It has
no horizontal padding and only a top border, so its content width is its border-box width, and on a
phone that is the viewport's width (the editor fills the viewport). The form's own rule is
`.form { width: 320px; max-width: 100% }`, so `width` wins over `max-width` and the form is 320 px
inside a 375 px sheet: 55 px blank on the right, 40 px at 360 px.

**Measured after.** 375: form 375, sheet 375, left gap 0, right gap 0. 360: form 360, sheet 360, 0 and
0. The two tests are `F1 … at 375px` and `F1 … at 360px`.

### F2 — above the keyboard

**Derivation.** The keyboard's top edge was 190 px below the top of the sheet on the owner's phone
(2026-11-18). The page is not resized while the keyboard is open, so the sheet keeps its place and
`save.bottom − sheet.top` is the distance that decides whether the buttons are visible. A visibility
test cannot fail here: without a keyboard the buttons are on screen already (they sat at 536–580 px in
a 667 px viewport). One, two and three rows are the same edge with 0, 1 and 2 taps on "+ Transisi lain".

**Measured after** (375 × 667, sheet top to the bottom of Simpan):

| rows | before | after |
| --- | --- | --- |
| 1 | 248.5 | **149.5** |
| 2 | 300.5 | **177.5** |
| 3 | 352.5 | **177.5** (the list scrolls; `max-height: 72px`) |

### F3 — the order

**Derivation.** In the template the action row follows the last row's fields and the refusal wrapper,
and precedes the add-row button and the hint. The tab order is the DOM order, so from the Push field
the next Tab reaches that row's Hapus button (which sits after the three fields in each row), then
Ketik ε, Batal, Simpan and the add-row button. The refusal `<p class="problem">` is inside the
`aria-live` wrapper that precedes `.actions`, so it stays above the buttons.

**Measured.** The three `compareDocumentPosition` answers are `true`; the tab sequence is Hapus →
Ketik ε → Batal → Simpan → add-row on the phone, and the same DOM order on the desktop; the refusal is
above the buttons.

The refusal is the accepted exception: its 74.5 px line pushes the buttons about 34 px past the 190 px
line with one row (measured 180.0–224.0). The spec accepts that, and the test pins only the order.

### F4 — the keyboard's key

**Derivation.** `enterkeyhint` decides the icon/label of the phone keyboard's send key; `done` is the
key the three inputs carry. Enter commits because `onkeydown` handles Enter with `commit()`, for all
three inputs. The transitions used are three different edges so that each case has its own label:
`a` in Baca on q0→q1 gives `a / ε / ε`; `A` in Pop on q1→q0 gives `ε / A / ε`; `B` in Push on q1→q1
gives `ε / ε / B`. No test pressed Enter inside a field before this one.

**Measured.** `["done", "done", "done"]`; the three labels appear, and the form closes each time.

### F5 — the laptop

**Derivation.** The popover keeps the form's own 320 px, and the popover centres itself on the edge with
`WIDTH = 320`. The width assertion alone **passes on `staging`** (it was 320 px before the change and
is 320 px after it); it guards the change, not the fault. The same test's DOM-order assertion failed on
`staging`, so the test as a whole did fail there.

**Measured.** 1440 × 900: the form in `.pda-label-popover` is 320.0 px; no `aside.pda-sheet` exists;
the DOM order holds.

### F6 — several rows

**Derivation.** 72 px = one row of 44 px + the 8 px gap + 20 px of the next row. With two rows the
content is 96 px, so the list scrolls inside itself; with three, 148 px. Focus after `addRow()` goes to
the new row's Baca field, and the browser scrolls it into view inside the list.

**Measured.** Two rows: `clientHeight` 72, `scrollHeight` 96; three rows: 72 and 148. The new field is
focused and inside the list's box. No sideways scroll (`scrollWidth − clientWidth` = 0).

## 4. The four breaks (AC4), each on the final code

Each break was applied, the build remade, the test run, and the file restored; `git diff --stat` at the
end shows only the three changed files.

### B1 — the sheet's width rule neutralised (`width: 100%` → `width: 320px`)

```
$ git diff web/src/lib/editor/PdaEditor.svelte
-		width: 100%;
+		width: 320px;
```
```
  ✘  1 [phone] › … › F1: the form fills the width of the sheet at 375px
    Error: expect(received).toBeLessThanOrEqual(expected)
    Expected: <= 1
    Received:    55
    > 93 | 			expect(Math.abs(formBox.width - sheetBox.width)).toBeLessThanOrEqual(1);
        at /home/Aldebaran64/webtomata-ds/web/e2e/pda-label-sheet.spec.ts:93:53
```

### B2 — the action row moved after the hint

The `<div class="actions">…</div>` block was moved below `<p class="hint">`, which is the break B2
names (a block moves; the diff is the two ends of the move):

```
$ git diff -U0 web/src/lib/editor/PdaLabelForm.svelte   (excerpt)
-	<button type="button" class="add-row-btn" onmousedown={keep} onclick={addRow}>
-
-	<p class="hint">{t('pda_editor.label_hint')}</p>
-
+	<button type="button" class="add-row-btn" onmousedown={keep} onclick={addRow}>
```
```
  ✘  2 [phone] › … › F3: the action row follows the refusal and the fields, and the tab order says so
    - Expected  - 2
    + Received  + 2
        "actionsAfterLastField": true,
    -   "actionsBeforeAddRow": true,
    +   "actionsBeforeAddRow": false,
    > 136 | 		expect(await domOrder(page)).toEqual({
```

### B3 — one `enterkeyhint` removed (the first input's)

```
$ git diff web/src/lib/editor/PdaLabelForm.svelte | grep enterkeyhint
+						enterkeyhint="done"
+						enterkeyhint="done"        ← two, not three
```
```
  ✘  1 [phone] › … › F4: the three inputs ask for the done key, and Enter commits from each of them
    - Expected  - 1
    + Received  + 1
      Array [
    -   "done",
    +   null,
        "done",
        "done",
      ]
    > 177 | 		).toEqual(['done', 'done', 'done']);
```

### B4 — the sheet's rows cap removed (`max-height: 72px` → `240px`)

```
$ git diff web/src/lib/editor/PdaEditor.svelte
-		max-height: 72px;
+		max-height: 240px;
```
```
  ✘  1 [phone] › … › F6: the rows list scrolls inside itself and a new row is scrolled into view
    Error: expect(received).toBeLessThanOrEqual(expected)
    Expected: <= 72
    Received:    96
    > 223 | 			expect(box.client).toBeLessThanOrEqual(72);
```

Every fixture was also seen failing on `staging` (section 2), so no test rests only on a break.

## 5. Verification (AC5)

```
$ pnpm format:check
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!

$ pnpm lint
$ eslint .                       (no output; exit 0)

$ pnpm check
$ svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings
svelte-check found 0 errors and 0 warnings

$ pnpm test:web
 Test Files  122 passed (122)
      Tests  1426 passed | 3 skipped (1429)
   Duration  12.08s

$ pnpm test:tools
ℹ pass 147
ℹ fail 0

$ pnpm check:strings
ok   76 components have no hard-coded text

$ pnpm check:tokens
ok   78 files use no raw colors
```

```
$ pnpm build && pnpm size
$ pnpm build:wasm && pnpm --filter web build
...
✔ done
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
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-Ii0Gidl3.wasm: 236.9 KB gzip (limit 250 KB)
```

`check-size` prints tenths of a KB; AC3 is in bytes, so the same gzip sum was taken in bytes before and
after (the source of the two components stashed, built, measured, restored, built, measured):

| route | before | after | Δ bytes |
| --- | ---: | ---: | ---: |
| `index.html` | 83,827 | 83,827 | 0 |
| `panduan.html` | 82,976 | 82,976 | 0 |
| `panduan/berakhiran-x.html` | 89,356 | 89,356 | 0 |
| `sandbox.html` | 124,823 | 124,822 | **−1** |
| `soal.html` | 84,471 | 84,471 | 0 |
| `soal/berakhiran-10.html` | 124,175 | 124,175 | 0 |
| `soal/jumlah-a-genap.html` | 124,175 | 124,175 | 0 |
| `soal/mengandung-101.html` | 124,175 | 124,175 | 0 |
| `tentang.html` | 82,274 | 82,274 | 0 |

```
$ pnpm exec playwright test pda-label-sheet pda-editor pda-panel pda-table-edit \
    pda-determinism pda-messages --project=phone --project=desktop
  23 skipped
  85 passed (1.7m)
```

The Verification block of the task names four specs; the other two (`pda-determinism`, `pda-messages`)
also open the label form, so they were run as well. The new spec's axe test (`axe: no violation with
the sheet open`) is among the 85.

## 6. The existing tests (AC2)

**Edited: one.** `web/e2e/pda-editor.spec.ts`, the tab-order case of E3 (the scope names it). Nothing
else was edited; the diff is 4 lines changed in that file (section 2).

**Ran unedited and passing:** `pda-editor.spec.ts` E8 (the sheet is at most 60 % of the editor and the
edited edge stays above it — it passed with the sheet 18.5 px shorter), E7 (axe with the form open),
E1–E6; `pda-panel.spec.ts` (the sheet replaces the panel, the `+ n lagi` cases, axe with the sheet);
`pda-table-edit.spec.ts`; `pda-determinism.spec.ts`; `pda-messages.spec.ts`; `pda-label.test.ts` and
`pda-label.property.test.ts` (they test `pda-label.ts`, which did not change — and the
`ComponentProps` check of the two components still passes).

Nothing else locates the buttons or the add-row button by position, so nothing else broke.

## 7. Limits, deviations, and what I did not change

1. **The empty `aria-live` wrapper (8 px) and the 4 px top margin of `.actions` were kept.** The
   decision allows tightening them "if the accessibility tree does not change". Not tightened: with
   them the measured numbers are 149.5 and 177.5, inside 190, and hiding an empty live region (or
   replacing it with `display: contents`) risks the announcement, which is what the wrapper is for.
   The accessibility tree is unchanged.
2. **WebKit: one real difference.** With the 72 px cap, Safari's focus scroll leaves the newly added
   row's Baca field clipped by 10 px at the bottom (`447.5` vs the list's `437.5`), twice, deterministic.
   The spec says the new row must scroll into view "as today", so no code was added: this is the
   browser's own focus scroll, and one line in `addRow` (`scrollIntoView({ block: 'nearest' })`) would
   fix it if the planner wants the property on WebKit. Recorded in ADR 0058.
3. **The new spec runs in Chromium only.** The `firefox` and `webkit-phone` projects have
   `testMatch: 'cross/**/*.spec.ts'`, so `--project=firefox` answers "No tests found". A scratch copy in
   `e2e/cross/` (removed after the run) gave: Firefox — the popover test passes, the phone tests skip;
   WebKit phone — F1, F2, F3, F4 and axe pass, F6 fails by the 10 px of point 2.
4. **The two 320s stay.** `PdaLabelForm`'s `.form` width and `PdaLabelPopover.WIDTH = 320` must agree
   (the popover centres on the edge). It is a note, not a change: the spec says so.
5. **Playwright has no keyboard.** The fixtures measure geometry; the owner re-checks the real keyboard
   on the phone after the merge. The ADR says so.
6. **Not run:** the full e2e suite, `pnpm smoke`, `pnpm lighthouse`, the cross projects as configured,
   and a real phone. `pnpm build` (Rust + wasm + web) and `pnpm size` did run.

## 8. Deepening pass

- **New exports: none.** No module, type or interface changed; the two rules are CSS, the attributes are
  template, and the tests are a new e2e file.
- **New members of a public interface: none.** `PdaLabelForm`'s props are unchanged (the width comes
  from the parent's CSS, not from a prop, which the spec asked for).
- **Logic written twice: no.** The DOM-order check is one helper (`domOrder`) used by the phone and the
  desktop test. `activate`, `addTwoStates` and `startEdge` are the three shared steps.
- **One fact in two places, on purpose:** 72 px lives in `PdaEditor.svelte` and is asserted (`≤ 72`) in
  the test; 190 px lives in the test with its derivation in a comment and in the ADR. A test that did
  not name the number could not catch a change of it.
- **Casts added: 0.** No `as` cast to another type; `] as const` on the two phone sizes is a const
  assertion, not a bypass. The new spec has 18 non-null assertions (`!`) in the e2e style of the folder
  (`(await x.boundingBox())!`), none in source.
- **The interface is smaller than the work behind it:** the change is two CSS rules and a template move.

# T-080 — Pin the Rust toolchain to 1.100.0

Branch `task/T-080-pin-rust`, cut from `origin/staging` at `416f42d` (PR 222, the amended spec). Status:
`done`. Commits: `e728b7d` (the change) and the last commit of this branch (this report and the status).
**Not pushed:** the owner reviews first. F2 is the only fixture that cannot exist yet; section 2 says so.

## 1. What changed

| File | Change |
| --- | --- |
| `rust-toolchain.toml` | `channel = "1.100.0"`; `targets = ["wasm32-unknown-unknown"]` and `components = ["rustfmt", "clippy"]` unchanged |
| `tools/check-rust-toolchain.test.mjs` (new) | 9 tests. Reads the value as TOML would (strip `#` comments, allow white space around `=` and either quote style), requires exactly one `channel` (none fails, not passes), then `^\d+\.\d+\.\d+$`. Its message names the file and points to the bump procedure. Runs under `pnpm test:tools` |
| `CONTRIBUTING.md` | requirement line says "the exact version in `rust-toolchain.toml`"; the five-step bump procedure ("Bumping the Rust version"), including `rustup show` once; no version number in prose |
| `tools/README.md` | one paragraph for the guard, like the other guards |
| `docs/decisions/0060-pinned-rust-toolchain.md` | the pin, the guard, the CI mechanism, the consequences |
| `docs/agent/PLAN.md` | status |
| `.github/workflows/ci.yml` | **unchanged**: the install step already honours the file (section 2, F2) |

No Rust source, `Cargo.toml` or `Cargo.lock` changed.

## 2. The fixtures (AC1)

### F1 — the file

```
$ cat rust-toolchain.toml
[toolchain]
channel = "1.100.0"
targets = ["wasm32-unknown-unknown"]
components = ["rustfmt", "clippy"]

$ git diff -U0 origin/staging HEAD -- rust-toolchain.toml
diff --git a/rust-toolchain.toml b/rust-toolchain.toml
index 86a51eb..02b6208 100644
--- a/rust-toolchain.toml
+++ b/rust-toolchain.toml
@@ -2 +2 @@
-channel = "stable"
+channel = "1.100.0"
```

### F2 — CI uses it

**This line can only exist after the PR is pushed, so it is not pasted here.** The amended spec says so
and keeps the local evidence separate. The `rust` job never prints `rustc 1.100.0`; the line to expect is

```
1.100.0-x86_64-unknown-linux-gnu (overridden by '…/rust-toolchain.toml')
```

and, on a runner without 1.100.0, `info: syncing channel updates …` and `info: the active toolchain … has
been installed`. The same pin is proved locally:

```
$ rustup show active-toolchain
1.100.0-x86_64-unknown-linux-gnu (overridden by '/home/Aldebaran64/webtomata-ds/rust-toolchain.toml')
```

No workflow change was needed: the pre-flight proved that `rustup show active-toolchain` installs a missing
pinned toolchain with the file's targets and components, and adds a missing target/component to an
installed one; the `|| rustup toolchain install` fallback (no argument) installs the active toolchain and
reads the same file. The same step appears seven times (five jobs of `ci.yml`, `deploy.yml`, `audit.yml`).
ADR 0060 records this, and the fuzz job's `cargo install` note.

### F3 — the guard

```
$ node --test tools/check-rust-toolchain.test.mjs
✔ the toolchain file pins an exact version (1.207033ms)
✔ the guard accepts white space around = and a trailing comment (0.359826ms)
✔ the guard accepts single quotes, as TOML does (2.682562ms)
✔ a commented-out channel is ignored, not read (0.539975ms)
✔ the guard fails on channel = "stable" (0.429748ms)
✔ the guard fails on channel = "1.100" (0.181558ms)
✔ the guard fails on channel = "nightly" (0.233486ms)
✔ the guard fails closed when the file has no channel (0.474136ms)
✔ the guard fails when the channel is written twice (0.414121ms)
ℹ tests 9
ℹ pass 9
ℹ fail 0
```

The write order was test first: the file was written while `rust-toolchain.toml` still said `stable`, and
the run failed with:

```
✖ the toolchain file pins an exact version (1.951051ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  actual: 'rust-toolchain.toml: channel "stable" is not an exact x.y.z version. To bump the pin, follow the five steps in CONTRIBUTING.md ("Bumping the Rust version"): change the version, run rustup show once, then cargo clippy --all-targets -- -D warnings, cargo test and pnpm build:wasm; fix the new lints in the same pull request.',
  expected: null,
```

then the pin made it pass (the message is now the pointer in section 4, one place for the steps).

### F4 — local clones work

```
$ rustup show
Default host: x86_64-unknown-linux-gnu
rustup home:  /home/Aldebaran64/.rustup

installed toolchains
--------------------
stable-x86_64-unknown-linux-gnu (default)
nightly-x86_64-unknown-linux-gnu
1.100.0-x86_64-unknown-linux-gnu (active)

active toolchain
----------------
name: 1.100.0-x86_64-unknown-linux-gnu
active because: overridden by '/home/Aldebaran64/webtomata-ds/rust-toolchain.toml'
installed targets:
  wasm32-unknown-unknown
  x86_64-unknown-linux-gnu

$ cargo --version
cargo 1.100.0 (3acc79c0c 2026-11-05)

$ rustup run stable cargo --version
cargo 1.99.1 (5f94df478 2026-08-27)
```

This clone's default is another version (1.99.1) and the repo answers 1.100.0. The pre-flight's `E0463` is
recorded in the ADR: a 1.100.0 installed earlier has no wasm std until `rustup show` once, which the bump
procedure now has. **After the merge, the owner and both workers run `rustup show` once in their clone.**

## 3. Verification (AC2)

```
$ cargo fmt --check; echo "fmt exit=$?"
fmt exit=0

$ cargo clippy --all-targets -- -D warnings; echo "clippy exit=$?"
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.11s
clippy exit=0

$ cargo test; echo "test exit=$?"
test exit=0
$ grep -E "test result:" ~/tmp/t080/cargo-test.log | awk -F'[ ;]+' '{p+=$4; f+=$6} END {printf "%d result lines: %d passed, %d failed\n", NR, p, f}'
35 result lines: 478 passed, 0 failed
```

```
$ pnpm build:wasm
    Finished `test` profile [unoptimized + debuginfo] target(s) in 27.52s
     Running tests/ts_export.rs (target/debug/build/engine-core/f1a2c8570d2ac059/out/ts_export-f1a2c8570d2ac059)
running 1 test
test the_types_match_the_json ... ok
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s

$ pnpm test:tools
ℹ tests 147
ℹ pass 147
ℹ fail 0

$ pnpm test:web
 Test Files  122 passed (122)
      Tests  1424 passed | 3 skipped (1427)

$ pnpm check:workflows
ok   6 workflows follow the guard rails
$ pnpm check:contrast
ok   4.96 (need 3)  Success on ground (valid, saved)
$ pnpm check:tokens
ok   78 files use no raw colors
$ pnpm check:strings
ok   76 components have no hard-coded text
$ pnpm check:questions
ok   3 question(s) in content/questions

$ pnpm lint            → eslint ., exit 0
$ pnpm check           → svelte-check found 0 errors and 0 warnings
$ pnpm format:check    → All matched files use Prettier code style! (and cargo fmt --check)
```

The CI `rust` job is the one item of AC2 that waits for the push.

## 4. The breaks (AC3), on the committed final code `e728b7d`

| Break | The one line of `git diff` | The failing line |
| --- | --- | --- |
| **B1** `channel = "stable"` | `-channel = "1.100.0"` / `+channel = "stable"` (`@@ -2 +2 @@`) | `✖ the toolchain file pins an exact version`; `actual: 'rust-toolchain.toml: channel "stable" is not an exact x.y.z version. The bump procedure is "Bumping the Rust version" in CONTRIBUTING.md.'`, `expected: null` |
| **B2** `channel = "1.100"` | `-channel = "1.100.0"` / `+channel = "1.100"` (`@@ -2 +2 @@`) | `✖ the toolchain file pins an exact version`; `actual: 'rust-toolchain.toml: channel "1.100" is not an exact x.y.z version. The bump procedure is "Bumping the Rust version" in CONTRIBUTING.md.'`, `expected: null` |

Both were restored; `node --test tools/check-rust-toolchain.test.mjs` is 9/9 again and `git status --short`
is empty before this report's commit. The full diff of the branch is section 1's file list.

## 5. Deepening pass

- **New exports:** none. The guard's helpers (`channelsOf`, `problemWith`, `check`) are private to
  `tools/check-rust-toolchain.test.mjs`; `tools/*.test.mjs` files export nothing and are run by the test
  runner, so they do not need to.
- **New members of a public interface:** none.
- **Written twice?** The channel parse exists once, in the guard. The bump steps exist once, in
  `CONTRIBUTING.md`; the guard's message and `tools/README.md` point to them (the message first repeated the
  five steps, and was changed to a pointer so the two cannot drift).
- **Interface smaller than the work behind it:** one test file, no exported surface, no new script, no
  workflow change.
- **Casts added:** zero.
- **Limit, recorded in the ADR:** the guard checks the channel only; a dropped `targets` or `components`
  entry is F1's one-time check.

## 6. What I did not run, and notes

- **F2 / the CI `rust` job.** Not pushed, so there is no run; the log line is quoted in F2 and the planner
  can check it on the PR.
- **E2E and cross-browser.** No web code changed, so no spec opens anything this task touched.
- **A fuzz run.** Not needed for a toolchain pin; ADR 0060 records that `fuzz.yml`'s `cargo install` now
  uses the pinned version while `cargo +nightly fuzz` stays on nightly.
- **The pre-flight's side effects**, reported separately: this machine's rustup self-updated to 1.29.3 and
  its nightly was updated when the throwaway pin was probed; the throwaway 1.98.0 was uninstalled. Neither
  is part of the change.

# T-076 — A downloaded `.jff` keeps its name on Android, and a file is told by its content

Branch `task/T-076-file-names`, cut from `origin/staging` at `1271d15` (PR 216, the amended spec). Status:
`done`. Commits: `207097a` (the change) and the last commit of this branch (this report and the status).

The owner's report, reproduced before any change: a `.jff` downloaded from the PDA editor on Android Chrome
was saved as `aⁿbⁿ (n ≥ 1).jff.xml` and "Buka file…" answered `import.unknown_type`. The run is in the
pre-flight (section 1).

## 1. What changed

| File | Change |
| --- | --- |
| `web/src/lib/share/open-file.ts` | `fileKind(name, text)` (exported) = `importKind(name) ?? kindOfText(text)`; `kindOfText` private, first character after `/^\s*/`; `openFile` checks the size, then reads, then tells the kind; `titleOfFileName` strips `.jff`, else `.jff.xml`, else `.xml` |
| `web/src/lib/share/pda-files.ts` | `isPdaFile` and `openPdaFile` use `fileKind`, with the size check first; the doc comment of `isPdaFile` rewritten |
| `web/src/lib/share/files.ts` | `DOWNLOAD_TYPE = 'application/octet-stream'` |
| `ShareDialog.svelte`, `PdaFileDialog.svelte` | pass `DOWNLOAD_TYPE` for the `.jff` and the JSON; SVG and PNG unchanged |
| tests | `open-file.test.ts`, `pda-files.test.ts`, `files.test.ts`, `open-from-file.test.ts`; e2e `open-file.spec.ts`, `pda-files.spec.ts`, `share-link.spec.ts`; `web/e2e/fixtures.ts` (one shared blob spy, see 6) |
| docs | `docs/decisions/0057-file-kind-by-content.md`; `docs/agent/PLAN.md` (status) |

The size check is now the **first** thing in `openFile`, `isPdaFile` and `openPdaFile`: a file over
`FILE_BYTE_LIMIT` (1,048,576 bytes) is `import.too_big` (or "not a PDA file" for `isPdaFile`) whatever its
name, and `text()` is never called. Before, both readers decided the kind before the size, so an unknown
name was refused as `import.unknown_type` without ever being size-checked.

### The three existing tests that changed, and only these

The probe run of the pre-flight (`pnpm --filter web exec vitest run src/lib/share/*.test.ts`, 51 passed)
and this change:

| Test | Was | Now | Why |
| --- | --- | --- | --- |
| `open-file.test.ts:155` `reads a file by its content when the name does not say…` (was `refuses an extension that is not known, and says which one`) | `file('a.txt', '{}')` → `import.unknown_type` | `document.invalid_file` (the text starts with `{`, so it is JSON; the document parser refuses it), and a new `file('a.txt', 'halo')` → `import.unknown_type` | F1: a `.txt` whose text starts with `{` is JSON |
| `pda-files.test.ts:86` `tells a PDA by its content when the name does not say…` (was `says no for a name that is neither…`) | `isPdaFile('a.txt'/'a', '{"kind":"dpda"}')` → `false` | `true` (and `'a.txt'`/`halo` → `false`, `'a.json'`/`not json` → `false` kept) | F3: a PDA JSON named `anbn.txt` opens |
| `pda-files.test.ts:204` `checks the size before it reads the text, and reads a .txt that holds a PDA .jff` (was `…and refuses an unknown extension`) | `openPdaFile(file('a.txt', pdaJffText))` → `import.unknown_type` | the engine is called with the text and the result is `ok: true` | F1/F3: the content says `.jff` |

No other existing test was edited. The two e2e `catatan.txt`/`halo` cases and every `open-file.wasm`,
`pda-files.wasm`, `files.wasm` and `open-from-file` case pass unedited.

## 2. The derivations of the fixtures

**F1 — `fileKind(name, text)`.** Derivation: the name wins when `importKind` answers. `a.jff` → `jff`
(whatever the text), `a.json` and `a.webtomata.json` → `json`. Otherwise the first character after every
white space at the start of the text: `<` → `jff`, `{` → `json`, anything else → `null`. `\s` in
JavaScript matches `U+FEFF`, so a BOM is white space: `'\uFEFF{'` → `json`, `' \uFEFF\n{'` → `json`,
`'  \n\t<structure/>'` → `jff`. `halo` → `null`; `[]` → `null`; `''` and `' \n\t\uFEFF '` → `null` (the
search for `\S` finds nothing).
**F2 — the title.** The rule is one suffix, matched case-insensitively on the lower-cased name but sliced
from the original: `.jff` → `a.jff` gives `a`; `.jff.xml` → `aⁿbⁿ (n ≥ 1).jff.xml` gives
`aⁿbⁿ (n ≥ 1)` (8 characters off, not 4, so not `….jff`); `.xml` → `x.XML` and `a.jff.XML` give `x` and
`a`. `.jff.xml` alone leaves `''` (`checkTitle('')` is ok, and the empty title already opens as
`editor.untitled`). The existing cases (`Berakhiran 01.jff`, `x.JFF`, `.jff`, the 300 emoji, the control
characters) are unchanged because they end in `.jff`.
**F3 — both readers (Playwright).** The PDA `.jff` of `aⁿbⁿ` is written inline in `pda-files.spec.ts`
(`anbnJff`, checked against the real engine before the test was written: `ok: true`, states `q0`/`q1`,
kind `ndpda`). Named `anbn.jff.xml` it has no known extension, so the content decides: `<` → `jff`, and
`PDA_JFF` matches `<type>pda</type>` → `openPdaFile` → a new PDA record, the mode switches to `pda` in
the FSM mode and stays in the PDA mode; the title is `anbn` (F2). A PDA JSON named `anbn.txt` is `{` →
`json` → `PDA_JSON` matches `"kind":"dpda"` → a PDA, with the document's own title. An FSM `.jff` named
`even-a.jff.xml` is `jff` → `openFile` → the engine → an FSM machine, title `even-a`.
**F4 — the hostile files.** The unknown name `foto.jpg` (a name that says nothing) is the case that was
never size-checked before. At `1 MB − 1` and at `1 MB` it is read and sniffed (the text `{"schemaVersion":1}`
→ `json` → `document.invalid_file`; the PDA `.jff` text → `jff` → the engine); at `1 MB + 1` it is
`import.too_big` and `text()` is never called, in both readers (the spy count stays at 2). A `1 MB + 1`
`x.jff.xml` is also `import.too_big` with zero reads. `'\u0000\u0000'` named `x.jff.xml` is neither kind
→ `import.unknown_type` (the engine is not asked). `<broken` named `x.jff.xml` is `jff` → the engine → the
real engine answers `jff.xml_invalid` with line 1, column 1 (checked against the WASM engine, and asserted
in `open-file.spec.ts` as the visible text "File .jff ini rusak: XML-nya tidak terbaca di baris 1, kolom 1.").
Each refusal writes no record, opens nothing and says why (`open-from-file.test.ts`); the count of records
and the open machine are as before.
**F5 — the blob type.** `DOWNLOAD_TYPE` is `application/octet-stream`. `download()` builds
`new Blob([text], { type: `${type};charset=utf-8` })`, so the type the browser sees is
`application/octet-stream;charset=utf-8` for a `.jff` and for a JSON, `image/svg+xml;charset=utf-8` for the
SVG (also a string) and `image/png` for the PNG (a `Blob`, used as it is). The spy wraps
`URL.createObjectURL` with `page.addInitScript` before the page's first script and records `blob.type`, so
the test observes what the browser acts on; a `suggestedFilename()` check passes with `application/xml`
too and proves nothing.

## 3. Verification

All of it on the final code (after every break was restored; the restored files are byte-identical to the
files the checks ran on, `diff -q` empty).

```
$ pnpm format:check
All matched files use Prettier code style!

$ pnpm check
svelte-check found 0 errors and 0 warnings

$ pnpm lint
$ pnpm --filter web lint
$ eslint .

$ pnpm check:strings
ok   76 components have no hard-coded text

$ pnpm check:tokens
ok   78 files use no raw colors

$ pnpm test:web
 Test Files  122 passed (122)
      Tests  1424 passed | 3 skipped (1427)

$ pnpm --filter web exec vitest run src/lib/share/
 Test Files  10 passed (10)
      Tests  110 passed | 2 skipped (112)

$ pnpm --filter web exec vitest run src/lib/share/open-file.wasm.test.ts src/lib/share/pda-files.wasm.test.ts src/lib/share/files.wasm.test.ts src/lib/share/local-jff.test.ts
 Test Files  4 passed (4)
      Tests  23 passed | 2 skipped (25)

$ pnpm build && pnpm size
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

$ cd web && pnpm exec playwright test open-file pda-files share-link cross/open-file --project=desktop --project=phone
  2 skipped
  72 passed (1.3m)
```

The two skipped e2e cases are the tests that each project cannot run (a phone-only test on desktop and the
reverse).

**Sizes in bytes, all nine pages**, the metric of `tools/check-size.mjs` (the gzip sum of the `.js` that the
HTML references), before (`11577ba`) and after, measured by the same command both times:

| Page | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `index.html` | 83,801 | 83,802 | +1 |
| `panduan.html` | 82,949 | 82,950 | +1 |
| `panduan/berakhiran-x.html` | 89,329 | 89,330 | +1 |
| `sandbox.html` | 124,790 | 124,789 | −1 |
| `soal.html` | 84,444 | 84,445 | +1 |
| `soal/berakhiran-10.html` | 124,149 | 124,150 | +1 |
| `soal/jumlah-a-genap.html` | 124,149 | 124,150 | +1 |
| `soal/mengandung-101.html` | 124,149 | 124,150 | +1 |
| `tentang.html` | 82,247 | 82,248 | +1 |

No route grew by more than 1 byte (AC3 allows 102). The module that grew is lazy: the share reader is
`_app/immutable/chunks/BsyC2EOn.js`, 1,936 raw bytes (926 gzip, was 1,734 raw), and no HTML lists it.

## 4. The breaks (AC4), each on the final code

| Break | The one line | The test that failed |
| --- | --- | --- |
| **B1** `kindOfText` always `null` | `function kindOfText(text: string): ImportKind \| null { return null; }` (the five lines that read the character deleted) | `open-file.test.ts:61` `expected null to be 'jff'`; also `:158` and `:209` `expected 'import.unknown_type' to be 'document.invalid_file'`, and `:242` `expected [] to deeply equal [ '<broken' ]` |
| **B2a** the size check after the read, in `openFile` | `-  if (!(file.size <= FILE_BYTE_LIMIT)) return fail('import.too_big', …);` moved below `const text = await file.text();` | `open-file.test.ts:143` `expected true to be false` (a file of 1 MB + 1 was read); `:216` `expected 3 to be 2`; `:229` `expected 1 to be +0` |
| **B2b** the same in `isPdaFile` | `-  if (!(file.size <= FILE_BYTE_LIMIT)) return false;` moved below `text = await file.text();` | `pda-files.test.ts:101` `expected 1 to be +0`; `:238` `expected 3 to be 2` |
| **B3** `titleOfFileName` stops taking off `.xml` | `-const NAME_SUFFIXES = [JFF_EXTENSION, `${JFF_EXTENSION}.xml`, '.xml'] as const;` → without `'.xml'` | `open-file.test.ts:87` `expected 'x.XML' to be 'x'` |
| **B4** the constant back to `application/xml` | `-export const DOWNLOAD_TYPE = 'application/octet-stream';` → `'application/xml'` | `pda-files.spec.ts:289` and `share-link.spec.ts:464`: `- "application/octet-stream;charset=utf-8"` / `+ "application/xml;charset=utf-8"` |

Three further breaks, for rules that AC4 does not name, so that no new test is allowed to be unfalsifiable:

| Break | The one line | The test that failed |
| --- | --- | --- |
| the content wins over the name | `return kindOfText(text) ?? importKind(name);` | `open-file.test.ts:54` `expected 'json' to be 'jff'` |
| the `.xml` rule before the `.jff.xml` rule | `const NAME_SUFFIXES = ['.xml', `${JFF_EXTENSION}.xml`, JFF_EXTENSION] as const;` | `open-file.test.ts:86` `expected 'aⁿbⁿ (n ≥ 1).jff' to be 'aⁿbⁿ (n ≥ 1)'` |
| the size check after the read in `openPdaFile` | the same move as B2a, in `openPdaFile` | `pda-files.test.ts:216` `expected 1 to be +0`; `:253` `expected 3 to be 2` |

Every break was restored; `diff -q` against the backups prints nothing and the suite is green again
(section 3).

## 5. Deepening pass

**New exports.** `fileKind` (`open-file.ts`): used by `openFile`, `isPdaFile` and `openPdaFile` and tested
directly by F1 — it cannot be private, and `kindOfText` is private because only `fileKind` calls it.
`DOWNLOAD_TYPE` (`files.ts`): used by the two dialogs and by the constant test; it cannot be private
because the two dialogs are in two files. `watchBlobs` and `blobTypes` (`web/e2e/fixtures.ts`): test-only,
used by the two dialog specs; they are a seam because the same spy is needed in two spec files, and the
alternative was the same ten lines twice. That file is the one file this task touched beyond the scope's
list; the change is +26 lines, and the two specs import it. **No new member of a public interface**:
`ImportFile`, `ImportEngine`, `ImportPdaEngine` and `PdaJffEngine` are unchanged.

**Written twice?** The kind rule is in one place (`fileKind`), the title rule in one place
(`NAME_SUFFIXES`). The size predicate `file.size <= FILE_BYTE_LIMIT` stands in three readers, as it did
before, because each answers differently (`fail('import.too_big', …)` with the limit, or `false`); merging
them would add an interface to save three lines. The `fail` helper already existed in both modules.

**Casts added: zero.** The e2e spy declares `window.__blobTypes` with `declare global` instead of a cast.
The `as const` on `NAME_SUFFIXES` is a literal-type annotation, not a cast. No `any`, no `@ts-ignore`, no
`as unknown as`.

## 6. What I did not run, and the phone re-check

- **The owner's phone.** Nothing here reproduces Chrome on Android renaming a download; the type is proved,
  the rename is not. The owner should check, after the merge: a new `.jff` is saved as `….jff` and opens,
  and an already-saved `….jff.xml` opens.
- **The live site.** Not deployed; the check is on the built site.
- The full e2e suite and `pnpm test:e2e:cross` were not run (the task's verification is the specs of the
  area), and Firefox/WebKit were not run (the cross specs need `pnpm test:e2e:cross`, CI runs them).
- **Residual risk, for the phone check:** the picker's `accept=".jff,.json,application/json"` does not list
  `.xml`, so some phones may not offer a saved `….jff.xml` in the chooser at all. The owner's Chrome did.
  The list is left as it is (widening it would hide other files), as the spec says.
