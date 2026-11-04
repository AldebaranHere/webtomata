# Report — T-024

> Written by the worker at the end of the session. One file per task; overwrite each session.

## Task
- id: T-024
- title: Rule rows with 44 px targets on touch screens
- branch: `task/T-024-rule-rows-touch`
- commits: `12fc0c0..9cbc226`
- pull request: https://github.com/AldebaranHere/webtomata/pull/141
- status: done

## What changed
- `web/src/lib/grammar/GrammarWorkstation.svelte`:
  - Added responsive card styling for grammar rule rows inside media query `@media (max-width: 900px), (pointer: coarse)`.
  - Grid template on `tr.rule-row`: `grid-template-columns: 72px auto minmax(0, 1fr)`.
  - Added explicit delete row button (`<button type="button" class="btn-delete-row" aria-label={t('grammar.matrix_delete_row')}>×</button>`) in a new cell (`td.td-delete`). Hidden by default on desktop (`display: none`), visible on touch viewports meeting `--target-min: 2.75rem` (44 × 44 px).
  - Tapping delete row removes the row immediately without prompt, updates the grammar and notation card, leaves empty row `S` if deleting the only row, and moves focus to the first alternative of the row at the same index (or previous row if deleted row was last, or empty row 0).
  - Updated `handleRowFocusOut` to key on `rowId` instead of index so that row deletion does not accidentally prune alternatives of the adjacent row that shifts into its index.
  - Alternatives container (`.alt-cells`) wraps in one flowing line with `|` delimiters; each `.alt-cell-input` has `min-width: 64px; min-height: var(--target-min);` (44 px).
  - Symbol buttons (`.inline-sym-btn`) and add alternative button (`.inline-sym-btn.btn-add-alt`) meet 44 × 44 px on touch, wrapping neatly into a toolbar.
  - Add rule button (`button.btn-add-row`) expands to full width (`width: 100%`) with `min-height: var(--target-min)` on touch.
  - Column headers visually hidden on touch (`.sr-only` equivalent) to maintain accessibility while presenting rule cards.
  - Added explicit ARIA table semantics (`role="table"`, `role="rowgroup"`, `role="row"`, `role="columnheader"`, `role="cell"`) with `<!-- svelte-ignore a11y_no_redundant_roles -->` to prevent losing table structure when styling `tr` and `td` with CSS grid/flexbox.
  - Ensured desktop `.inline-sym-btn` has `min-width: 24px; min-height: 24px` to meet WCAG 2.2 AA target size on desktop.
- `web/e2e/grammar-rule-rows-touch.spec.ts`:
  - New test suite covering AC1–AC5:
    - AC1: Bounding boxes on phone (390×844) meet ≥ 44 px for LHS height, alt input height (and width ≥ 64 px), `+` button, delete button, symbol buttons, and `+ Tambah Baris` height. Also checked at 360, 768, and 820 px viewports.
    - AC2: Delete button removes row immediately, updates notation card, leaves empty `S` when deleting single row, and moves focus to adjacent row or empty row 0.
    - AC3: Desktop layout at 1280×800 hides delete button, displays column headers, and passes axe.
    - AC4: Touch screen wider than 900 px (1024×768 with `hasTouch: true` and `isMobile: true`) checks `pointer: coarse` and verifies touch layout.
    - AC5: ARIA table semantics (`table`, `rowgroup`, `row`, `columnheader`, `cell`) preserved, and axe reports 0 violations on phone and desktop.
- `web/e2e/cross/workstation-phone.spec.ts`:
  - Added cross-browser test `cross-browser grammar rule rows on webkit-phone and firefox (AC6)` asserting delete button ≥ 44×44 px and alt input ≥ 64×44 px.

## AC Checks Summary
- **AC1:** At 390 × 844 on the `phone` project, for a grammar with three rows and multiple alternatives per row: LHS height ≥ 44 px (44 px), alt input height ≥ 44 px (44 px) and width ≥ 64 px (64 px), "+" button 44 × 44 px, delete button 44 × 44 px, symbol buttons 44 × 44 px, and "+ Tambah Baris" height ≥ 44 px (44 px). Also verified across 360 px, 768 px, and 820 px.
- **AC2:** Tapping delete button immediately removes the row without confirmation prompt. Notation card and internal grammar state update. Deleting the sole row leaves an empty `S` row. Focus moves to the first alternative of the row with the same index, or previous row if the deleted row was the last one, or empty row 0.
- **AC3:** At 1280 × 800 on `desktop`, delete button is hidden (`display: none`), column headers are visible, and all grammar specs pass.
- **AC4:** Tested at 1024 × 768 with `hasTouch: true` and `isMobile: true`. Confirmed `matchMedia('(pointer: coarse)').matches` evaluates to `true` in Chromium, triggering the touch layout with 44 px targets and visible delete buttons.
- **AC5:** Explicit ARIA roles (`role="table"`, `role="rowgroup"`, `role="row"`, `role="columnheader"`, `role="cell"`) are present and recognized by Playwright's accessibility tree (`getByRole('table')`, `getByRole('row')`, `getByRole('columnheader')`). Axe reports 0 violations at 390 × 844 and 1280 × 800 with active focused row and visible symbol toolbar.
- **AC6:** Cross-browser test passes on `webkit-phone` (delete button and alt input meet ≥ 44 px). Firefox runs in CI (as documented in AGENTS.md, local laptop does not have Firefox in WSL).
- **AC7:** Deliberate breaks demonstrated, logged below, and restored.
- **AC8:** Hand-checked rows at 390 px (documented below).

---

## Hand-Checked Rows at 390 px Viewport (AC8)
Inspected on simulated mobile screen (390 × 844) across various rule shapes:
1. **Rule with 1 alternative (`S → a`):** Rendered as a single compact card. Top line contains 72 px LHS input, arrow icon, and the 44 × 44 px delete button (`×`). Directly beneath, single alternative input box (64 × 44 px) followed by 44 × 44 px `+` button. No overflow or extra whitespace.
2. **Rule with 4 alternatives (`S → a | b | c | d`):** Alternatives wrap cleanly across two lines with `|` delimiters between each box. Each box is easily tappable (min 64 px wide, 44 px high) with 44 × 44 px `+` button at the end. Layout reads naturally like standard textbook production notation.
3. **Rule with multi-letter non-terminal (`Expr → Term + Expr | Term`):** LHS input accommodates `Expr` within the 72 px box without clipping text. The top line aligns the delete button neatly to the right. Focus on alternatives brings up the 44 × 44 px symbol helper buttons wrapping into a dedicated toolbar.
4. **iOS Zoom note:** Inputs are styled with `--text-base: 1rem` (16 px base font), preventing Safari from automatically zooming into input fields upon focus.

---

## Deliberate Break Output (AC7)

### Break 1: Remove `min-height` on `.alt-cell-input`
Removed `min-height: var(--target-min);` from `.alt-cell-input` in the touch media query:
```
  1) [phone] › e2e/grammar-rule-rows-touch.spec.ts:20:2 › grammar rule rows on touch phone (390x844) › AC1 & AC5: 44px targets, table semantics, and axe on phone 

    Error: expect(received).toBeGreaterThanOrEqual(expected)

    Expected: >= 43.5
    Received: 22

      71 | 		const altBox = await altInput.boundingBox();
      72 | 		expect(altBox).not.toBeNull();
    > 73 | 		expect(altBox!.height).toBeGreaterThanOrEqual(43.5);
         | 		                       ^
      74 | 		expect(altBox!.width).toBeGreaterThanOrEqual(63.5);
```
Restored: `min-height: var(--target-min);`.

### Break 2: Hide delete button on touch layout
Set `.btn-delete-row { display: none !important; }` in the touch media query:
```
  1) [phone] › e2e/grammar-rule-rows-touch.spec.ts:113:2 › grammar rule rows on touch phone (390x844) › AC2: delete button removes row, updates notation, leaves empty S, and moves focus 

    Error: Timed out 5000ms waiting for expect(locator).toBeVisible()

    Locator: locator('.rule-row').first().locator('.btn-delete-row')
    Expected: visible
    Received: <element(s) not found>
```
Restored: `.btn-delete-row` display on touch.

### Break 3: Remove explicit ARIA roles
Removed `role="table"`, `role="rowgroup"`, `role="row"`, `role="columnheader"`, and `role="cell"` from table markup.
Outcome: In Chromium on Pixel 7 emulation, table semantics were still recognized natively by the browser engine (`getByRole('table')` and `getByRole('columnheader')` still passed). As required by AC7 ("if the engine drops the semantics; if it does not, say so in the report and keep the roles anyway"), the explicit ARIA roles are retained to safeguard against mobile WebKit / Gecko engine variants where CSS `display: grid` stripping of table semantics is known to occur.

---

## Verification Outputs

### 1. Static Checks
`pnpm check && pnpm lint && pnpm format:check && pnpm check:strings && pnpm check:tokens`
```
$ pnpm --filter web format:check && cargo fmt --check
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!
$ pnpm --filter web check
$ svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings
Loading svelte-check in workspace: /home/Aldebaran64/webtomata/web
Getting Svelte diagnostics...

svelte-check found 0 errors and 0 warnings
$ pnpm --filter web lint
$ eslint .
$ node tools/check-strings.mjs
ok   63 components have no hard-coded text
$ node tools/check-tokens-usage.mjs
ok   65 files use no raw colors
```

### 2. Build and Size Checks
`pnpm build && pnpm size`
```
$ pnpm build:wasm && pnpm --filter web build
$ wasm-pack build crates/engine-wasm --target web --release --out-dir ../../web/src/lib/engine/wasm && pnpm build:types
[INFO]: 🎯  Checking for the Wasm target...
[INFO]: 🌀  Compiling to Wasm...
    Finished `release` profile [optimized] target(s) in 0.03s
[INFO]: ⬇️  Installing wasm-bindgen...
[INFO]: Optimizing wasm binaries with `wasm-opt`...
[INFO]: Optional fields missing from Cargo.toml: 'description', 'repository'. These are not necessary, but recommended
[INFO]: License key is set in Cargo.toml but no LICENSE file(s) were found; Please add the LICENSE file(s) to your project directory
[INFO]: ✨   Done in 18.28s
[INFO]: 📦   Your wasm pkg is ready to publish at web/src/lib/engine/wasm.
$ cargo test -p engine-core --features ts --test ts_export
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.05s
     Running tests/ts_export.rs (target/debug/deps/ts_export-3866b49c73009c67)

running 1 test
test the_types_match_the_json ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s

$ vite build
vite v8.3.4 building ssr environment for production...
transforming...
✓ 321 modules transformed.
rendering chunks...
computing gzip size...
...
✓ built in 1.22s
Prerendering

Run npm run preview to preview your production build locally.

> Using @sveltejs/adapter-static
Wrote site to "build"
✔ done
$ node tools/check-size.mjs
ok   initial JS index.html: 78.5 KB gzip (limit 170 KB)
ok   initial JS panduan/berakhiran-x.html: 83.4 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 77.6 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 116.8 KB gzip (limit 170 KB)
ok   initial JS soal/berakhiran-10.html: 116.4 KB gzip (limit 170 KB)
ok   initial JS soal/jumlah-a-genap.html: 116.4 KB gzip (limit 170 KB)
ok   initial JS soal/mengandung-101.html: 116.4 KB gzip (limit 170 KB)
ok   initial JS soal.html: 79.1 KB gzip (limit 170 KB)
ok   initial JS tentang.html: 77.0 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-BA5LlKVT.wasm: 206.5 KB gzip (limit 250 KB)
```

### 3. Repeated e2e Suite (5x on desktop and phone)
`pnpm --filter web exec playwright test --project=desktop --project=phone e2e/grammar-rule-rows-touch.spec.ts --repeat-each=5`
```
Running 40 tests using 6 workers

  -   1 [desktop] › e2e/grammar-rule-rows-touch.spec.ts:113:2 › grammar rule rows on touch phone (390x844) › AC2: delete button removes row, updates notation, leaves empty S, and moves focus
  -   3 [desktop] › e2e/grammar-rule-rows-touch.spec.ts:20:2 › grammar rule rows on touch phone (390x844) › AC1 & AC5: 44px targets, table semantics, and axe on phone
  -   5 [desktop] › e2e/grammar-rule-rows-touch.spec.ts:113:2 › grammar rule rows on touch phone (390x844) › AC2: delete button removes row, updates notation, leaves empty S, and moves focus
  -   2 [desktop] › e2e/grammar-rule-rows-touch.spec.ts:20:2 › grammar rule rows on touch phone (390x844) › AC1 & AC5: 44px targets, table semantics, and axe on phone
  ✓   6 [desktop] › e2e/grammar-rule-rows-touch.spec.ts:209:2 › grammar rule rows on touch screen wider than 900px (AC4) › AC4: touch screen at 1024x768 gets touch layout if pointer is coarse (3.8s)
  ✓   8 [desktop] › e2e/grammar-rule-rows-touch.spec.ts:209:2 › grammar rule rows on touch screen wider than 900px (AC4) › AC4: touch screen at 1024x768 gets touch layout if pointer is coarse (2.9s)
  -   9 [desktop] › e2e/grammar-rule-rows-touch.spec.ts:20:2 › grammar rule rows on touch phone (390x844) › AC1 & AC5: 44px targets, table semantics, and axe on phone
  -  10 [desktop] › e2e/grammar-rule-rows-touch.spec.ts:113:2 › grammar rule rows on touch phone (390x844) › AC2: delete button removes row, updates notation, leaves empty S, and moves focus
  -  13 [desktop] › e2e/grammar-rule-rows-touch.spec.ts:20:2 › grammar rule rows on touch phone (390x844) › AC1 & AC5: 44px targets, table semantics, and axe on phone
  -  14 [desktop] › e2e/grammar-rule-rows-touch.spec.ts:113:2 › grammar rule rows on touch phone (390x844) › AC2: delete button removes row, updates notation, leaves empty S, and moves focus
  ✓   4 [desktop] › e2e/grammar-rule-rows-touch.spec.ts:174:2 › grammar rule rows on desktop (1280x800) › AC3 & AC5: desktop layout hides delete button, shows column headers, and passes axe (8.1s)
  ✓   7 [desktop] › e2e/grammar-rule-rows-touch.spec.ts:174:2 › grammar rule rows on desktop (1280x800) › AC3 & AC5: desktop layout hides delete button, shows column headers, and passes axe (8.1s)
  ✓  12 [desktop] › e2e/grammar-rule-rows-touch.spec.ts:209:2 › grammar rule rows on touch screen wider than 900px (AC4) › AC4: touch screen at 1024x768 gets touch layout if pointer is coarse (3.5s)
  ✓  16 [desktop] › e2e/grammar-rule-rows-touch.spec.ts:209:2 › grammar rule rows on touch screen wider than 900px (AC4) › AC4: touch screen at 1024x768 gets touch layout if pointer is coarse (2.6s)
  -  17 [desktop] › e2e/grammar-rule-rows-touch.spec.ts:20:2 › grammar rule rows on touch phone (390x844) › AC1 & AC5: 44px targets, table semantics, and axe on phone
  -  18 [desktop] › e2e/grammar-rule-rows-touch.spec.ts:113:2 › grammar rule rows on touch phone (390x844) › AC2: delete button removes row, updates notation, leaves empty S, and moves focus
  ✓  11 [desktop] › e2e/grammar-rule-rows-touch.spec.ts:174:2 › grammar rule rows on desktop (1280x800) › AC3 & AC5: desktop layout hides delete button, shows column headers, and passes axe (7.2s)
  ✓  15 [desktop] › e2e/grammar-rule-rows-touch.spec.ts:174:2 › grammar rule rows on desktop (1280x800) › AC3 & AC5: desktop layout hides delete button, shows column headers, and passes axe (7.4s)
  -  23 [phone] › e2e/grammar-rule-rows-touch.spec.ts:174:2 › grammar rule rows on desktop (1280x800) › AC3 & AC5: desktop layout hides delete button, shows column headers, and passes axe
  ✓  20 [desktop] › e2e/grammar-rule-rows-touch.spec.ts:209:2 › grammar rule rows on touch screen wider than 900px (AC4) › AC4: touch screen at 1024x768 gets touch layout if pointer is coarse (3.0s)
  ✓  22 [phone] › e2e/grammar-rule-rows-touch.spec.ts:113:2 › grammar rule rows on touch phone (390x844) › AC2: delete button removes row, updates notation, leaves empty S, and moves focus (3.1s)
  ✓  19 [desktop] › e2e/grammar-rule-rows-touch.spec.ts:174:2 › grammar rule rows on desktop (1280x800) › AC3 & AC5: desktop layout hides delete button, shows column headers, and passes axe (6.4s)
  ✓  24 [phone] › e2e/grammar-rule-rows-touch.spec.ts:209:2 › grammar rule rows on touch screen wider than 900px (AC4) › AC4: touch screen at 1024x768 gets touch layout if pointer is coarse (2.5s)
  -  27 [phone] › e2e/grammar-rule-rows-touch.spec.ts:174:2 › grammar rule rows on desktop (1280x800) › AC3 & AC5: desktop layout hides delete button, shows column headers, and passes axe
  ✓  21 [phone] › e2e/grammar-rule-rows-touch.spec.ts:20:2 › grammar rule rows on touch phone (390x844) › AC1 & AC5: 44px targets, table semantics, and axe on phone (7.4s)
  ✓  26 [phone] › e2e/grammar-rule-rows-touch.spec.ts:113:2 › grammar rule rows on touch phone (390x844) › AC2: delete button removes row, updates notation, leaves empty S, and moves focus (3.0s)
  ✓  28 [phone] › e2e/grammar-rule-rows-touch.spec.ts:209:2 › grammar rule rows on touch screen wider than 900px (AC4) › AC4: touch screen at 1024x768 gets touch layout if pointer is coarse (2.6s)
  -  32 [phone] › e2e/grammar-rule-rows-touch.spec.ts:174:2 › grammar rule rows on desktop (1280x800) › AC3 & AC5: desktop layout hides delete button, shows column headers, and passes axe
  ✓  30 [phone] › e2e/grammar-rule-rows-touch.spec.ts:113:2 › grammar rule rows on touch phone (390x844) › AC2: delete button removes row, updates notation, leaves empty S, and moves focus (3.5s)
  ✓  25 [phone] › e2e/grammar-rule-rows-touch.spec.ts:20:2 › grammar rule rows on touch phone (390x844) › AC1 & AC5: 44px targets, table semantics, and axe on phone (7.9s)
  ✓  31 [phone] › e2e/grammar-rule-rows-touch.spec.ts:209:2 › grammar rule rows on touch screen wider than 900px (AC4) › AC4: touch screen at 1024x768 gets touch layout if pointer is coarse (2.7s)
  -  35 [phone] › e2e/grammar-rule-rows-touch.spec.ts:174:2 › grammar rule rows on desktop (1280x800) › AC3 & AC5: desktop layout hides delete button, shows column headers, and passes axe
  ✓  34 [phone] › e2e/grammar-rule-rows-touch.spec.ts:113:2 › grammar rule rows on touch phone (390x844) › AC2: delete button removes row, updates notation, leaves empty S, and moves focus (3.1s)
  ✓  29 [phone] › e2e/grammar-rule-rows-touch.spec.ts:20:2 › grammar rule rows on touch phone (390x844) › AC1 & AC5: 44px targets, table semantics, and axe on phone (8.2s)
  ✓  36 [phone] › e2e/grammar-rule-rows-touch.spec.ts:209:2 › grammar rule rows on touch screen wider than 900px (AC4) › AC4: touch screen at 1024x768 gets touch layout if pointer is coarse (2.7s)
  -  40 [phone] › e2e/grammar-rule-rows-touch.spec.ts:174:2 › grammar rule rows on desktop (1280x800) › AC3 & AC5: desktop layout hides delete button, shows column headers, and passes axe
  ✓  33 [phone] › e2e/grammar-rule-rows-touch.spec.ts:20:2 › grammar rule rows on touch phone (390x844) › AC1 & AC5: 44px targets, table semantics, and axe on phone (7.4s)
  ✓  38 [phone] › e2e/grammar-rule-rows-touch.spec.ts:113:2 › grammar rule rows on touch phone (390x844) › AC2: delete button removes row, updates notation, leaves empty S, and moves focus (2.6s)
  ✓  39 [phone] › e2e/grammar-rule-rows-touch.spec.ts:209:2 › grammar rule rows on touch screen wider than 900px (AC4) › AC4: touch screen at 1024x768 gets touch layout if pointer is coarse (1.9s)
  ✓  37 [phone] › e2e/grammar-rule-rows-touch.spec.ts:20:2 › grammar rule rows on touch phone (390x844) › AC1 & AC5: 44px targets, table semantics, and axe on phone (5.4s)

  15 skipped
  25 passed (35.9s)
```

### 4. Area Specs
`pnpm --filter web exec playwright test --project=desktop --project=phone e2e/grammar-phone.spec.ts e2e/grammar-open-cnf.spec.ts e2e/grammar-cyk-limit.spec.ts`
```
Running 26 tests using 6 workers

  -   2 [desktop] › e2e/grammar-open-cnf.spec.ts:127:1 › phone: open CNF result as new grammar button size, navigation, and axe (AC3, AC4, AC8)
  -   5 [desktop] › e2e/grammar-cyk-limit.spec.ts:76:1 › phone: CYK 101-character limit message and 100-character test
  -   3 [desktop] › e2e/grammar-phone.spec.ts:27:2 › grammar phone layout at 360x780: tabs, panels, touch targets, and scrolling
  -   7 [desktop] › e2e/grammar-phone.spec.ts:27:2 › grammar phone layout at 390x844: tabs, panels, touch targets, and scrolling
  -   8 [desktop] › e2e/grammar-phone.spec.ts:135:1 › grammar phone layout: preset selection jumps to editor, shortcut button, arrow keys, and axe
  -   9 [desktop] › e2e/grammar-phone.spec.ts:191:1 › grammar phone layout at 390x480: CNF stepper header remains sticky at 52px when scrolled to bottom
  -  10 [desktop] › e2e/grammar-phone.spec.ts:224:1 › grammar phone layout: axe has no violation in every tab
  ✓  11 [desktop] › e2e/grammar-phone.spec.ts:250:1 › at 1280x800 on the desktop project, grammar workstation shows splitters, no tab strip and no Ubah ke CNF button (3.3s)
  ✓   6 [desktop] › e2e/grammar-open-cnf.spec.ts:81:1 › desktop: open nullable preset, tap open CNF result, and check new grammar CNF tab shows same rules (5.0s)
  ✓  13 [desktop] › e2e/grammar-phone.spec.ts:337:1 › on the desktop project, grammar preset titles and custom titles respect locale (3.4s)
  -  14 [phone] › e2e/grammar-cyk-limit.spec.ts:15:1 › CYK string length limits: 101 chars shows translated error in id and en, 100 chars works as before (AC2, AC3)
  -  16 [phone] › e2e/grammar-open-cnf.spec.ts:15:1 › desktop: open CNF result as new grammar (AC3, AC4, AC6, AC8)
  -  17 [phone] › e2e/grammar-open-cnf.spec.ts:81:1 › desktop: open nullable preset, tap open CNF result, and check new grammar CNF tab shows same rules
  ✓  12 [desktop] › e2e/grammar-phone.spec.ts:270:1 › at 1280x800 and 390x844 on the desktop project: landmarks on laptop, tab panels on phone, and resize across 900px (8.3s)
  ✓   1 [desktop] › e2e/grammar-cyk-limit.spec.ts:15:1 › CYK string length limits: 101 chars shows translated error in id and en, 100 chars works as before (AC2, AC3) (10.8s)
  ✓   4 [desktop] › e2e/grammar-open-cnf.spec.ts:15:1 › desktop: open CNF result as new grammar (AC3, AC4, AC6, AC8) (10.7s)
  ✓  19 [phone] › e2e/grammar-phone.spec.ts:27:2 › grammar phone layout at 360x780: tabs, panels, touch targets, and scrolling (4.4s)
  ✓  18 [phone] › e2e/grammar-open-cnf.spec.ts:127:1 › phone: open CNF result as new grammar button size, navigation, and axe (AC3, AC4, AC8) (7.2s)
  ✓  15 [phone] › e2e/grammar-cyk-limit.spec.ts:76:1 › phone: CYK 101-character limit message and 100-character test (8.2s)
  -  24 [phone] › e2e/grammar-phone.spec.ts:250:1 › at 1280x800 on the desktop project, grammar workstation shows splitters, no tab strip and no Ubah ke CNF button
  -  25 [phone] › e2e/grammar-phone.spec.ts:270:1 › at 1280x800 and 390x844 on the desktop project: landmarks on laptop, tab panels on phone, and resize across 900px
  -  26 [phone] › e2e/grammar-phone.spec.ts:337:1 › on the desktop project, grammar preset titles and custom titles respect locale
  ✓  21 [phone] › e2e/grammar-phone.spec.ts:191:1 › grammar phone layout at 390x480: CNF stepper header remains sticky at 52px when scrolled to bottom (3.5s)
  ✓  20 [phone] › e2e/grammar-phone.spec.ts:27:2 › grammar phone layout at 390x844: tabs, panels, touch targets, and scrolling (4.6s)
  ✓  22 [phone] › e2e/grammar-phone.spec.ts:135:1 › grammar phone layout: preset selection jumps to editor, shortcut button, arrow keys, and axe (4.7s)
  ✓  23 [phone] › e2e/grammar-phone.spec.ts:224:1 › grammar phone layout: axe has no violation in every tab (7.0s)

  13 skipped
  13 passed (20.9s)
```

### 5. Cross-Browser Spec
`pnpm --filter web exec playwright test --project=webkit-phone e2e/cross/workstation-phone.spec.ts`
```
Running 3 tests using 3 workers

  ✓  2 [webkit-phone] › e2e/cross/workstation-phone.spec.ts:116:1 › cross-browser grammar rule rows on webkit-phone and firefox (AC6) (2.7s)
  ✓  1 [webkit-phone] › e2e/cross/workstation-phone.spec.ts:79:1 › language phone layout on WebKit phone: tab navigation and axe (4.6s)
  ✓  3 [webkit-phone] › e2e/cross/workstation-phone.spec.ts:32:1 › grammar phone layout on WebKit phone: tab navigation, shortcut, and axe (4.6s)

  3 passed (5.6s)
```
*(Note: As documented in AGENTS.md, Firefox is not installed in WSL on the development machine and runs in CI. All 3 WebKit tests passed).*
