# Report — T-016

> Written by the worker at the end of the session. One file per task; overwrite each session.

## Task
- id: T-016
- title: Phone layout of the grammar and the language workstations
- branch: `task/T-016-workstation-phone-layout`
- commit: `b0ec336`
- pull request: https://github.com/AldebaranHere/webtomata/pull/121
- CI run: https://github.com/AldebaranHere/webtomata/actions/runs/41488442216

## What changed
- `web/src/lib/components/WorkstationPhoneTabs.svelte` (new):
  - Created reusable ARIA tab strip component for phone viewports (`role="tablist"` with `aria-label`).
  - Supports tabs with `role="tab"`, `aria-selected`, `aria-controls`, `id`, and keyboard arrow navigation (Left/Right, Home/End) with auto-activation and wrapping.
  - Sticky at top (`position: sticky; top: 0; z-index: 10;`) with horizontal touch scrolling and hidden scrollbar.
  - Sized at least 44px min-height/min-width for all tabs with accessible focus rings and active highlight line.
  - Automatically hidden at viewports `>= 900.02px`.
- `web/src/lib/i18n/id.ts` & `web/src/lib/i18n/en.ts`:
  - Added translation keys:
    - `workstation.tab_library`: "Pustaka" / "Library"
    - `workstation.tab_editor`: "Editor" / "Editor"
    - `workstation.tab_cnf`: "CNF" / "CNF"
    - `workstation.tab_cyk`: "CYK" / "CYK"
    - `workstation.tab_results`: "Hasil" / "Results"
    - `workstation.tabs_grammar_aria`: "Navigasi area tata bahasa" / "Grammar workstation areas"
    - `workstation.tabs_language_aria`: "Navigasi area bahasa" / "Language workstation areas"
    - `grammar.btn_convert_to_cnf`: "Ubah ke CNF" / "Convert to CNF"
- `web/src/lib/grammar/GrammarWorkstation.svelte`:
  - Added `WorkstationPhoneTabs` under the mode bar.
  - Added responsive layout below 900px: columns convert from 3-column split grid to full-width tab panels (`role="tabpanel"` on `div` columns).
  - Selected tab state (`phoneTab`) controls visibility; selecting a preset or custom item automatically switches to `editor` tab and displays selection name in header.
  - Added primary shortcut button "Ubah ke CNF" at end of Editor tab content on phone layout, hidden on laptop (`>= 900px`).
- `web/src/lib/grammar/GrammarCnfStepper.svelte`:
  - Stepper header (`.stepper-header`) styled as sticky under phone tab strip (`top: 52px; z-index: 5; background: var(--color-surface)`).
  - Step pills and navigation buttons enlarged to min 44x44px touch targets.
  - Heading level adjusted from `h3` to `h2` to maintain proper heading hierarchy under `h1` in phone view when other columns are hidden.
- `web/src/lib/grammar/GrammarCykTester.svelte`:
  - Stacked input field and "Uji String" button to full width below 900px with min 44px touch targets.
  - Example chips wrap with min 44px tap targets.
  - CYK table scrolls horizontally within its own box (`.table-scroll`).
- `web/src/lib/language/LanguageWorkstation.svelte`:
  - Replaced 1024px media query with unified 900px breakpoint.
  - Added `WorkstationPhoneTabs` (`Pustaka`, `Editor`, `Hasil`).
  - Selection of preset or custom item jumps to `editor` tab with active title displayed.
  - Reordered Editor elements via flex `order`: formula textarea (4 rows) placed above the symbol toolbar (`order: 1` vs `order: 2`), symbol toolbar wraps with min 44px touch buttons.
  - Hasil tab: settings organized in a compact 3-column grid (`Panjang Min`, `Jumlah String`, `Format String Kosong`), followed immediately by results.
- Tests:
  - `web/e2e/grammar-phone.spec.ts`: E2E suite covering phone viewports (360x780 and 390x844), tab navigation, touch target dimensions (>= 44px), sticky stepper header, scroll checks, preset jump, shortcut button, arrow keys, and axe accessibility.
  - `web/e2e/language-phone.spec.ts`: E2E suite covering language phone layout, formula ordering above toolbar, compact settings, results visibility, touch targets, arrow keys, preset jump, and axe accessibility.
  - `web/e2e/cross/workstation-phone.spec.ts`: WebKit phone cross-browser test covering both workstations.

---

## Acceptance Criteria Verification

- **AC1 (Tab strip & area visibility)**: Tested in `grammar-phone.spec.ts` and `language-phone.spec.ts`. Each workstation shows tab strip with correct tab items (`Pustaka`, `Editor`, `CNF`, `CYK` for Grammar; `Pustaka`, `Editor`, `Hasil` for Language). Exactly one area visible at a time; tapping changes `aria-selected` and `hidden`.
- **AC2 (Page scrolling as a whole)**: Verified in tests. No element except `.table-scroll` (CYK table) has vertical overflow scroll (`scrollHeight > clientHeight`). Page scrolls as a whole.
- **AC3 (Grammar CNF tab sticky stepper & visibility)**: Title of phase and chips visible without scroll. Stepper header stays visible after scrolling down step card.
- **AC4 (Language Hasil tab first result row visible)**: Verified without scrolling on 360x780 and 390x844 viewports.
- **AC5 (Language Editor formula box above toolbar)**: Formula box appears before symbol toolbar in DOM order/visual flow and is fully visible.
- **AC6 (44x44px touch targets)**: Measured programmatically in tests: all tabs, preset cards, buttons, symbol buttons, step pills, and nav buttons have `width >= 44` and `height >= 44`.
- **AC7 (Preset jump to editor with name)**: Tapping preset selects it, switches active tab to Editor, and active name displays in header badge.
- **AC8 (Arrow keys, axe zero violations, WebKit phone)**: Arrow Left/Right/Home/End navigate tabs. Axe reports 0 violations across all tabs. `workstation-phone.spec.ts` passes on `webkit-phone`.
- **AC9 (Laptop layout unchanged)**: At 1280x800 and 1440x900, splitters, 3 columns, and desktop workstation flows pass without regressions.
- **AC10 (i18n & guard rails)**: All strings in `id.ts` and `en.ts`. `check:strings`, `check:tokens`, `check:contrast` pass with 0 errors.
- **AC11 (Deliberate break demonstrated)**: Removing `position: sticky` on `.stepper-header` caused AC3 bounding-box sticky test to fail (`Received: 178`, `Expected: <= 70`). Restoring it brought tests back to green.
- **AC12 ("Ubah ke CNF" shortcut button)**: Primary full-width button (>= 44px height) at bottom of grammar Editor tab opens CNF tab. Hidden on laptop screens.

---

## Deliberate Break Demonstration (AC11)

When `position: sticky` was removed from `.stepper-header` in `GrammarCnfStepper.svelte`:
```
  1) [phone] › e2e/grammar-phone.spec.ts:23:2 › grammar phone layout at 360x780: tabs, panels, touch targets, and scrolling 

    Error: expect(received).toBeLessThanOrEqual(expected)

    Expected: <= 70
    Received:    178

      78 | 		// With position: sticky and top: 52px, scrolledHeaderBox.y stays near 52px (within tolerance).
      79 | 		expect(scrolledHeaderBox!.y).toBeGreaterThanOrEqual(40);
    > 80 | 		expect(scrolledHeaderBox!.y).toBeLessThanOrEqual(70);
         | 		                             ^

  2 failed
    [phone] › e2e/grammar-phone.spec.ts:23:2 › grammar phone layout at 360x780: tabs, panels, touch targets, and scrolling 
    [phone] › e2e/grammar-phone.spec.ts:23:2 › grammar phone layout at 390x844: tabs, panels, touch targets, and scrolling 
```
Upon restoring `position: sticky` and `top: 52px`, tests passed immediately.

---

## Verification Outputs

### 1. `pnpm check`
```
$ pnpm --filter web check
$ svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings
Loading svelte-check in workspace: /home/Aldebaran64/webtomata/web
Getting Svelte diagnostics...

svelte-check found 0 errors and 0 warnings
```

### 2. `pnpm lint`
```
$ pnpm --filter web lint
$ eslint .
```

### 3. `pnpm format:check`
```
$ pnpm --filter web format:check && cargo fmt --check
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!
```

### 4. `pnpm check:strings`
```
$ node tools/check-strings.mjs
ok   63 components have no hard-coded text
```

### 5. `pnpm check:tokens`
```
$ node tools/check-tokens-usage.mjs
ok   65 files use no raw colors
```

### 6. `pnpm check:contrast`
```
$ node tools/check-contrast.mjs
ok   16.57 (need 4.5)  Ink on ground
ok   17.76 (need 4.5)  Ink on surface
ok   15.55 (need 4.5)  Ink on neutral tint
ok   6.13 (need 4.5)  Muted on surface
ok   5.72 (need 4.5)  Muted on ground
ok   5.37 (need 4.5)  Muted on neutral tint
ok   8.99 (need 4.5)  Neutral ink on neutral tint (chips)
ok   10.26 (need 4.5)  Neutral ink on surface
ok   9.57 (need 4.5)  Neutral ink on ground
ok   5.90 (need 4.5)  On accent on accent (primary button)
ok   17.76 (need 4.5)  On ink on ink (selected tab)
ok   5.90 (need 4.5)  Accent on surface (link)
ok   5.51 (need 4.5)  Accent on ground (link)
ok   8.13 (need 4.5)  Accent ink on accent tint (active state)
ok   9.29 (need 4.5)  Accent ink on surface
ok   5.32 (need 4.5)  Success on surface
ok   4.67 (need 4.5)  Success on success tint (badge)
ok   7.02 (need 4.5)  Success ink on success tint
ok   8.40 (need 4.5)  Warning ink on warning tint
ok   9.16 (need 4.5)  Warning ink on surface
ok   8.55 (need 4.5)  Warning ink on ground
ok   9.57 (need 3)  Diagram stroke on ground
ok   8.98 (need 3)  Diagram stroke on accent tint
ok   5.51 (need 3)  Accent on ground (active state, focus ring)
ok   5.90 (need 3)  Accent on surface (focus ring)
ok   5.17 (need 3)  Accent on accent tint (active state edge)
ok   3.72 (need 3)  Warning on ground (wrong part of an answer)
ok   3.99 (need 3)  Warning on surface
ok   3.66 (need 3)  Warning on warning tint (label edge)
ok   4.96 (need 3)  Success on ground (valid, saved)
ok   4.27 (need 3)  Border strong on surface (input edge)
ok   3.98 (need 3)  Border strong on ground (input edge)
```

### 7. `pnpm --filter web exec vitest run`
```
 RUN  v5.0.3 /home/Aldebaran64/webtomata/web

 ✓ src/lib/editor/conversion.wasm.test.ts (49 tests) 488ms
 ✓ src/lib/editor/compare.wasm.test.ts (6 tests) 458ms
 ✓ src/lib/editor/interaction/editor.test.ts (41 tests) 520ms
 ✓ src/lib/share/link.test.ts (15 tests) 872ms
 ✓ src/lib/questions/check.wasm.test.ts (27 tests) 594ms
 ✓ src/lib/editor/diagram/geometry.test.ts (38 tests) 892ms
 ✓ src/lib/questions/load.test.ts (32 tests) 370ms
 ✓ src/lib/editor/regex-compile.wasm.test.ts (5 tests) 159ms
 ✓ src/lib/editor/regex-simplify.wasm.test.ts (6 tests) 391ms
 ✓ src/lib/editor/run.wasm.test.ts (29 tests) 187ms
 ✓ src/lib/editor/commands.test.ts (26 tests) 371ms
 ✓ src/lib/editor/history.property.test.ts (7 tests) 1395ms
 ✓ src/lib/share/files.wasm.test.ts (6 tests | 1 skipped) 122ms
 ✓ src/lib/questions/grade.wasm.test.ts (13 tests) 279ms
 ✓ src/lib/editor/document.test.ts (32 tests) 183ms
 ✓ src/lib/i18n/i18n.test.ts (14 tests) 108ms
 ✓ src/lib/questions/question.test.ts (4 tests) 59ms
 ✓ src/lib/editor/regex-conversion.wasm.test.ts (4 tests) 200ms
 ✓ src/lib/storage/autosave.tests-field.test.ts (9 tests) 115ms
 ✓ src/lib/storage/library.test.ts (21 tests) 100ms
 ✓ src/lib/editor/history.test.ts (20 tests) 20ms
 ✓ src/lib/storage/autosave.test.ts (12 tests) 19ms
 ✓ src/lib/questions/summaries.test.ts (10 tests) 161ms
 ✓ src/lib/engine/client.test.ts (30 tests) 54ms
 ✓ src/lib/guides/load.test.ts (10 tests) 93ms
 ✓ src/lib/editor/table.test.ts (22 tests) 50ms
 ✓ src/lib/share/image.test.ts (10 tests) 18ms
 ✓ src/lib/share/open-file.wasm.test.ts (8 tests | 1 skipped) 43ms
 ✓ src/lib/questions/statement.test.ts (15 tests) 19ms
 ✓ src/lib/editor/layout-client.test.ts (9 tests) 16ms
 ✓ src/lib/storage/library.svelte.test.ts (14 tests) 21ms
 ✓ src/lib/storage/example.test.ts (7 tests) 20ms
 ✓ src/lib/questions/answer.test.ts (12 tests) 26ms
 ✓ src/lib/storage/progress.test.ts (8 tests) 16ms
 ✓ src/lib/questions/feedback-view.test.ts (12 tests) 30ms
 ✓ src/lib/storage/autosave.progress.test.ts (5 tests) 14ms
 ✓ src/lib/questions/statement-fold.test.ts (6 tests) 18ms
 ✓ src/lib/storage/question-work.test.ts (13 tests) 18ms
 ✓ src/lib/editor/tester.test.ts (11 tests) 17ms
 ✓ src/lib/questions/machine.test.ts (17 tests) 18ms
 ✓ src/lib/storage/titles.test.ts (10 tests) 16ms
 ✓ src/lib/editor/interaction/editor.link.test.ts (19 tests) 18ms
 ✓ src/lib/storage/machines.test.ts (9 tests) 16ms
 ✓ src/lib/engine/handlers.test.ts (14 tests) 16ms
 ✓ src/lib/storage/memory.test.ts (6 tests) 15ms
 ✓ src/lib/questions/list.test.ts (18 tests) 17ms
 ✓ src/lib/questions/feedback-text.test.ts (6 tests) 16ms
 ✓ src/lib/storage/migrate.test.ts (8 tests) 16ms
 ✓ src/lib/language/language-math.test.ts (16 tests) 16ms
 ✓ src/lib/editor/checker.test.ts (2 tests) 14ms
 ✓ src/lib/editor/checks.test.ts (4 tests) 14ms
 ✓ src/lib/editor/definition.test.ts (6 tests) 14ms
 ✓ src/lib/seo.test.ts (6 tests) 14ms
 ✓ src/lib/editor/conversion-text.test.ts (8 tests) 14ms
 ✓ src/lib/share/files.test.ts (11 tests) 14ms
 ✓ src/lib/lint.test.ts (1 test) 15ms

 Test Files  56 passed (56)
      Tests  776 passed | 2 skipped (778)
   Start at  04:02:10
   Duration  4.92s (transform 2.05s, setup 0ms, collect 5.17s, tests 10.74s, environment 1ms, prepare 2.12s)
```

### 8. `pnpm build`
```
$ pnpm build:wasm && pnpm --filter web build
$ wasm-pack build --target web --out-dir ../../web/src/lib/engine/wasm crates/engine-wasm
[INFO]: Checking for the Wasm target...
[INFO]: Compiling to Wasm...
    Finished `release` profile [optimized] target(s) in 0.04s
[INFO]: Installing wasm-bindgen...
[INFO]: Optimizing wasm binaries with `wasm-opt`...
[INFO]: Optional refmt was not run
[INFO]: :-) Done in 0.50s
$ vite build
vite v8.3.4 building ssr environment for production...
✓ 321 modules transformed.
✓ built in 1.44s
Prerendering
> Using @sveltejs/adapter-static
Wrote site to "build"
✔ done
```

### 9. `pnpm size`
```
$ node tools/check-size.mjs
ok   initial js 101.1 kB gzip (budget 170 kB, 59% used)
ok   wasm 193.3 kB gzip (budget 250 kB, 77% used)
```

### 10. Repeated phone specs (30 runs across viewports)
```
$ pnpm --filter web exec playwright test --project=phone grammar-phone.spec.ts language-phone.spec.ts --repeat-each=5

Running 30 tests using 3 workers
  30 passed (32.6s)
```

### 11. `webkit-phone` cross-browser tests
```
$ pnpm --filter web exec playwright test --project=webkit-phone workstation-phone.spec.ts

Running 2 tests using 2 workers

  ✓  1 [webkit-phone] › e2e/cross/workstation-phone.spec.ts:30:1 › grammar phone layout on WebKit phone: tab navigation, shortcut, and axe (3.5s)
  ✓  2 [webkit-phone] › e2e/cross/workstation-phone.spec.ts:56:1 › language phone layout on WebKit phone: tab navigation and axe (3.8s)

  2 passed (4.8s)
```
