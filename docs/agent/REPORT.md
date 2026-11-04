# Report — T-025

> Written by the worker at the end of the session. One file per task; overwrite each session.

## Task
- id: T-025
- title: Landmarks on a laptop, tab panels on a phone
- branch: `task/T-025-workstation-landmarks`
- commits: `c9aaa81..1e26263`
- pull request: https://github.com/AldebaranHere/webtomata/pull/139
- status: done

## What changed
- `web/src/lib/grammar/GrammarWorkstation.svelte`:
  - Added reactive `isPhone = $state(false)` state driven by `window.matchMedia('(max-width: 900px)')` initialized after mount and updated on media query changes with cleanup on unmount.
  - Column 1 (`.library-col`): `role={isPhone ? 'tabpanel' : 'complementary'}`, `aria-labelledby={isPhone ? 'grammar-tab-pustaka' : undefined}`.
  - Column 2 (`.editor-col`): `role={isPhone ? 'tabpanel' : 'region'}`, `aria-labelledby={isPhone ? 'grammar-tab-editor' : undefined}`.
  - Column 3 (`.output-col`): `role={isPhone ? undefined : 'region'}`. On phone, inner panels (`#grammar-pane-cnf` and `#grammar-pane-cyk`) serve as the active tabpanels with `aria-labelledby`.
  - Preserved existing `aria-label` texts on all three columns.
- `web/src/lib/language/LanguageWorkstation.svelte`:
  - Added reactive `isPhone = $state(false)` state driven by `window.matchMedia('(max-width: 900px)')` initialized after mount and updated on media query changes with cleanup on unmount.
  - Column 1 (`.library-col`): `role={isPhone ? 'tabpanel' : 'complementary'}`, `aria-labelledby={isPhone ? 'language-tab-pustaka' : undefined}`.
  - Column 2 (`.editor-col`): `role={isPhone ? 'tabpanel' : 'region'}`, `aria-labelledby={isPhone ? 'language-tab-editor' : undefined}`.
  - Column 3 (`.output-col` / `#language-pane-hasil`): `role={isPhone ? 'tabpanel' : 'region'}`, `aria-labelledby={isPhone ? 'language-tab-hasil' : undefined}`.
  - Preserved existing `aria-label` texts on all three columns.
- `web/e2e/grammar-phone.spec.ts`:
  - Added test for desktop project at 1280x800 verifying AC1 (no `role="tabpanel"` among the three columns, 1 complementary landmark and 2 region landmarks each with its accessible name, tab strip hidden, axe clean).
  - Added AC3 resize verification across 900px without reload: at 900px (phone side) tab strip visible, no column is landmark, active editor column is tabpanel; at 901px (laptop side) tab strip hidden, landmark roles restored, no tabpanel column; at 899px (phone side again) tab strip visible and landmark roles removed.
  - Added test verifying AC2 on phone viewports (360x780 and 390x844): tab strip visible, active pane has `role="tabpanel"` with `aria-labelledby` pointing to its tab, no column is a landmark.
  - Added T-013 follow-up test: in English locale, library preset displays "Palindromes {a, b}", newly created grammar is titled "Grammar G1", and switching back to Indonesian keeps "Grammar G1".
- `web/e2e/language-phone.spec.ts`:
  - Added test for desktop project at 1280x800 verifying AC1 (no `role="tabpanel"` among columns, 1 complementary landmark, 2 region landmarks, tab strip hidden, axe clean).
  - Added AC3 resize verification across 900px without reload (900px, 901px, 899px, 1280px).
  - Added AC2 on phone viewports (360x780 and 390x844): active pane has `role="tabpanel"` with `aria-labelledby`, no column is a landmark.
  - Added T-013 follow-up test: in English locale, library preset displays "Finite Set {ab, bc}", and switching back to Indonesian displays "Himpunan Hingga {ab, bc}".
- `web/e2e/cross/workstation-phone.spec.ts`:
  - Added assertions for WebKit phone verifying active pane has `role="tabpanel"`, `aria-labelledby` points to its tab, no column is a landmark, and axe reports 0 violations.

## AC Checks Summary
- **AC1:** At 1280 × 800, in both workstations, no element has `role="tabpanel"` among the three columns. There is exactly one complementary landmark (`.library-col`) and two region landmarks (`.editor-col`, `.output-col`), each with its accessible name via `aria-label`. The tab strip is hidden (`toBeHidden()`).
- **AC2:** At 390 × 844, the tab strip is visible. The shown column has `role="tabpanel"` and its `aria-labelledby` points to its corresponding tab (`grammar-tab-<id>` / `language-tab-<id>`). No column is a landmark (0 complementary and 0 region landmarks among the columns).
- **AC3:** Roles change reactively when the window is resized across 900 px without page reload, verified at 900 px, 901 px, 899 px, and 1280 px.
- **AC4:** Axe reports no violations at both widths, on every phone tab, in Chromium and WebKit phone.
- **AC5:** Deliberate break demonstrated: hardcoding `role="tabpanel"` on `library-col` in `GrammarWorkstation.svelte` caused AC1 desktop test to fail with `expect(await col.getAttribute('role')).not.toBe('tabpanel')`. Code was restored and test re-verified green.

---

## Deliberate Break Output (AC5)
Leaving phone role `role="tabpanel"` on `library-col` at 1280x800 on desktop:
```
  1) [desktop] › e2e/grammar-phone.spec.ts:270:1 › at 1280x800 and 390x844 on the desktop project: landmarks on laptop, tab panels on phone, and resize across 900px 

    Error: expect(received).not.toBe(expected) // Object.is equality

    Expected: not "tabpanel"

      281 | 	await expect(cols).toHaveCount(3);
      282 | 	for (const col of await cols.all()) {
    > 283 | 		expect(await col.getAttribute('role')).not.toBe('tabpanel');
          | 		                                           ^
      284 | 	}
      285 |
      286 | 	const complementary = page.locator('.workstation > .col[role="complementary"]');
        at /home/Aldebaran64/webtomata/web/e2e/grammar-phone.spec.ts:283:46
```

---

## Verification Outputs

### 1. `pnpm check && pnpm lint && pnpm format:check && pnpm check:strings && pnpm check:tokens`
```
$ pnpm --filter web check
$ svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings
Loading svelte-check in workspace: /home/Aldebaran64/webtomata/web
Getting Svelte diagnostics...

svelte-check found 0 errors and 0 warnings
$ pnpm --filter web lint
$ eslint .
$ pnpm --filter web format:check && cargo fmt --check
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!
$ node tools/check-strings.mjs
ok   63 components have no hard-coded text
$ node tools/check-tokens-usage.mjs
ok   65 files use no raw colors
```

### 2. `pnpm build && pnpm size`
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
[INFO]: ✨   Done in 19.40s
[INFO]: 📦   Your wasm pkg is ready to publish at web/src/lib/engine/wasm.
[WARN]: ⚠️   There's a newer version of wasm-pack available, the new version is: 0.15.1, you are using: 0.15.0. To update, navigate to: https://wasm-bindgen.github.io/wasm-pack/installer/
$ cargo test -p engine-core --features ts --test ts_export
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.06s
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
✓ built in 1.54s
Prerendering
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

### 3. Area specs 5x repeat (`e2e/grammar-phone.spec.ts` & `e2e/language-phone.spec.ts`)
```
pnpm --filter web exec playwright test --project=desktop --project=phone e2e/grammar-phone.spec.ts e2e/language-phone.spec.ts --repeat-each=5

Running 150 tests using 6 workers
...
  75 skipped
  75 passed (1.8m)
```

### 4. Cross-browser specs (`e2e/cross/workstation-phone.spec.ts`)
```
pnpm --filter web exec playwright test --project=webkit-phone e2e/cross/workstation-phone.spec.ts

Running 2 tests using 2 workers

  ✓  2 [webkit-phone] › e2e/cross/workstation-phone.spec.ts:77:1 › language phone layout on WebKit phone: tab navigation and axe (4.4s)
  ✓  1 [webkit-phone] › e2e/cross/workstation-phone.spec.ts:30:1 › grammar phone layout on WebKit phone: tab navigation, shortcut, and axe (4.5s)

  2 passed (5.6s)
```
*Note on Firefox:* As stated in `AGENTS.md` ("Firefox does not start on the owner's laptop; the Firefox tests run only in CI"), local Firefox execution fails because the binary is not installed in the WSL environment (`ls ~/.cache/ms-playwright` contains only Chromium and WebKit). Firefox tests run in CI.

### 5. Other workstation area specs
```
pnpm --filter web exec playwright test e2e/grammar-cyk-limit.spec.ts e2e/grammar-open-cnf.spec.ts

Running 10 tests using 6 workers
  5 skipped
  5 passed (14.9s)
```
Names of workstation area specs executed:
- `web/e2e/grammar-phone.spec.ts`
- `web/e2e/language-phone.spec.ts`
- `web/e2e/cross/workstation-phone.spec.ts`
- `web/e2e/grammar-cyk-limit.spec.ts`
- `web/e2e/grammar-open-cnf.spec.ts`

### 6. Web unit test suite (`pnpm test:web`)
```
Test Files  92 passed (92)
     Tests  1178 passed | 2 skipped (1180)
```
