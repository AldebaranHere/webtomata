# Report — T-023

> Written by the worker at the end of the session. One file per task; overwrite each session.

## Task
- id: T-023
- title: Open the CNF result as a new grammar
- branch: `task/T-023-open-cnf-as-grammar`
- pull request: https://github.com/AldebaranHere/webtomata/pull/124

## What changed
- `web/src/lib/grammar/grammar-text.ts`:
  - `grammarToText(grammar: Grammar, emptySymbol = 'ε'): string`:
    - Outputs one line per non-terminal head in order of appearance (start symbol first): `Head -> body1 | body2`.
    - Single space between RHS symbols (`A 1` vs `A1`).
    - Uses `'ε'` by default for empty bodies so that the output matches the engine parser's empty-word symbol.
    - Does not invent `S -> ε` when a start symbol has no rules in `grammar.rules`.
  - `nextCustomId(existing: Array<{ id: string }>): string`:
    - Calculates first unused `G<n>` (`G1`, `G2`, etc.) to prevent duplicate ID collisions after deletions.
- `web/src/lib/grammar/GrammarCnfStepper.svelte`:
  - Added optional `onopen?: () => void` prop.
  - Rendered `.btn-open-result` button (`grammar.open_cnf_as_new`) conditionally on step 6.
  - Styled with min 44px height and responsive full-width display on phone screens (`@media (max-width: 900px)`).
- `web/src/lib/grammar/GrammarWorkstation.svelte`:
  - Uses `nextCustomId` in `createNewCustomGrammar`.
  - Added `computeCnfTitle` helper producing `<title> (CNF)`, `<title> (CNF 2)`, etc.
  - Implemented `handleOpenCnfAsNewGrammar`: converts `cnfTrace.finalGrammar` with `grammarToText`, saves to custom grammars in `localStorage`, selects it, switches to `editor` tab, and persists state without adding any message or toast elements.
  - Passed `onopen={handleOpenCnfAsNewGrammar}` to `<GrammarCnfStepper>`.
- `web/src/lib/i18n/id.ts` & `web/src/lib/i18n/en.ts`:
  - Added `grammar.open_cnf_as_new` (`"Buka sebagai tata bahasa baru"` / `"Open as a new grammar"`).
- `web/eslint.config.js`:
  - Added `src/lib/grammar/grammar-text.wasm.test.ts` to `no-restricted-imports` exceptions.
- Tests:
  - `web/src/lib/grammar/grammar-text.test.ts`:
    - AC1: handwritten grammars with empty rule defaulting to `ε`, custom empty symbol `λ`, no rule invention for empty start symbol, `S_0` with `T_a`/`X1`, and `X10` next to digit terminal.
    - AC7: `nextCustomId` collision tests.
  - `web/src/lib/grammar/grammar-text.wasm.test.ts`:
    - AC2: production default path (`grammarToText(g)`) round-trips every preset and CNF result directly, including `CNF_NULLABLE`.
    - AC5: CNF idempotence verified for all presets, including `CNF_NULLABLE`.
    - `CFG_PAREN`: CNF round-trip and AC5 idempotence marked `it.fails` with comment `"known until T-026"`.
    - Seeded generator: 200 random grammars round-trip with default `grammarToText`.
  - `web/e2e/grammar-open-cnf.spec.ts`:
    - AC3, AC4, AC6, AC8 on desktop and phone.
    - Added test opening `CNF_NULLABLE` ('Variabel Nullable Majemuk (Fase 2)'), tapping the button, and verifying the new grammar's CNF tab shows the exact same rules as the original CNF result.
  - `web/e2e/cross/workstation-phone.spec.ts`: Step 6 button visibility and axe scan for `webkit-phone`.

---

## Engine Findings & Known Issues

1. **CFG_PAREN Phase 5 Helper Variable Names (`crates/engine-core/src/grammar/parser.rs` lines 124–127):**
   - For preset `CFG_PAREN`, CNF Phase 5 creates helper variables `T_(` and `T_)`.
   - The engine parser accepts only ASCII alphanumeric characters after an underscore (`_`), so `T_(` is parsed as non-terminal `T_` followed by terminal `(`.
   - Per reviewer direction, the two tests asserting this issue (`round-trips CNF result of CFG_PAREN` and `is idempotent on preset CFG_PAREN`) are marked `it.fails` with comment `"known until T-026"`.

2. **CNF_NULLABLE & Default `'ε'`:**
   - With `grammarToText` writing `'ε'` by default for empty bodies, `CNF_NULLABLE` and its CNF output (`S0 -> ε`) round-trip cleanly in the engine parser, and AC5 CNF idempotence passes completely for `CNF_NULLABLE`.

---

## What was not run and why
- **Firefox E2E tests (`pnpm test:e2e:cross` with `firefox`)**: Not run locally because Firefox does not start in this WSL environment (per `AGENTS.md`: "Firefox does not start on the owner's laptop; the Firefox tests run only in CI"). The WebKit phone tests (`webkit-phone`) were run locally and passed.
- **Physical mobile devices**: Not run directly; simulated via Playwright's mobile emulation profiles (`phone` = Pixel 7, `webkit-phone` = iPhone 13).

---

## Deliberate Break Demonstration (AC10)

Symbols in `grammarToText` were joined without spaces (`body.map((s) => s.value).join('')`):

```
$ pnpm --filter web exec vitest run src/lib/grammar
...
 FAIL  src/lib/grammar/grammar-text.test.ts > grammarToText (AC1) > serializes grammar with two-digit helper X10 next to a digit terminal
AssertionError: expected 'S -> X10 0\nX10 -> 1' to deeply equal 'S -> X100\nX10 -> 1'

- Expected:
S -> X100
X10 -> 1

+ Received:
S -> X10 0
X10 -> 1

 ❯ src/lib/grammar/grammar-text.test.ts:114:44
...
 Test Files  2 failed | 1 passed (3)
      Tests  17 failed | 2 expected fail | 22 passed (41)
```

Upon restoring the single-space separator between RHS symbols, all tests in `src/lib/grammar` passed cleanly.

---

## Verification Outputs

### 1. Unit Tests (`src/lib/grammar`)
```
$ pnpm --filter web exec vitest run src/lib/grammar

 RUN  v5.0.3 /home/Aldebaran64/webtomata/web

 ✓ src/lib/grammar/grammar-text.test.ts (10 tests) 8ms
 ✓ src/lib/grammar/presets.test.ts (3 tests) 12ms
 ✓ src/lib/grammar/grammar-text.wasm.test.ts (28 tests) 119ms

 Test Files  3 passed (3)
      Tests  39 passed | 2 expected fail (41)
   Start at  21:34:28
   Duration  468ms (transform 51%, tests 29%, import 14%, worker 5%)
```

### 2. Svelte Check
```
$ pnpm check
$ svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings
Loading svelte-check in workspace: /home/Aldebaran64/webtomata/web
Getting Svelte diagnostics...

svelte-check found 0 errors and 0 warnings
```

### 3. Lint
```
$ pnpm lint
$ eslint .
```

### 4. Format Check
```
$ pnpm format:check
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!
```

### 5. Guard Rails (Strings, Tokens, Contrast)
```
$ pnpm check:strings
ok   63 components have no hard-coded text

$ pnpm check:tokens
ok   65 files use no raw colors

$ pnpm check:contrast
Contrast check passed: all 13 text/background token pairs meet WCAG AA (4.5:1).
```

### 6. Bundle Size Check
```
$ pnpm size
$ node tools/check-size.mjs
ok   initial JS index.html: 78.4 KB gzip (limit 170 KB)
ok   initial JS panduan/berakhiran-x.html: 83.3 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 77.6 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 116.7 KB gzip (limit 170 KB)
ok   initial JS soal/berakhiran-10.html: 116.3 KB gzip (limit 170 KB)
ok   initial JS soal/jumlah-a-genap.html: 116.3 KB gzip (limit 170 KB)
ok   initial JS soal/mengandung-101.html: 116.3 KB gzip (limit 170 KB)
ok   initial JS soal.html: 79.0 KB gzip (limit 170 KB)
ok   initial JS tentang.html: 76.9 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-qpglZrwP.wasm: 206.2 KB gzip (limit 250 KB)
```

### 7. New E2E Suite Repeated 10 Times (`--repeat-each=10`)
```
$ pnpm --filter web exec playwright test --project=desktop --project=phone e2e/grammar-open-cnf.spec.ts --repeat-each=10

Running 60 tests using 6 workers

  ✓  5 [desktop] › e2e/grammar-open-cnf.spec.ts:81:1 › desktop: open nullable preset, tap open CNF result, and check new grammar CNF tab shows same rules (4.7s)
  ✓  3 [desktop] › e2e/grammar-open-cnf.spec.ts:81:1 › desktop: open nullable preset, tap open CNF result, and check new grammar CNF tab shows same rules (5.0s)
  ✓  8 [desktop] › e2e/grammar-open-cnf.spec.ts:81:1 › desktop: open nullable preset, tap open CNF result, and check new grammar CNF tab shows same rules (3.7s)
  ✓  2 [desktop] › e2e/grammar-open-cnf.spec.ts:15:1 › desktop: open CNF result as new grammar (AC3, AC4, AC6, AC8) (11.6s)
  ✓  4 [desktop] › e2e/grammar-open-cnf.spec.ts:15:1 › desktop: open CNF result as new grammar (AC3, AC4, AC6, AC8) (11.5s)
  ✓  7 [desktop] › e2e/grammar-open-cnf.spec.ts:15:1 › desktop: open CNF result as new grammar (AC3, AC4, AC6, AC8) (10.6s)
  ✓ 11 [desktop] › e2e/grammar-open-cnf.spec.ts:81:1 › desktop: open nullable preset, tap open CNF result, and check new grammar CNF tab shows same rules (4.4s)
  ✓ 14 [desktop] › e2e/grammar-open-cnf.spec.ts:81:1 › desktop: open nullable preset, tap open CNF result, and check new grammar CNF tab shows same rules (4.0s)
  ✓ 10 [desktop] › e2e/grammar-open-cnf.spec.ts:15:1 › desktop: open CNF result as new grammar (AC3, AC4, AC6, AC8) (11.7s)
  ✓ 17 [desktop] › e2e/grammar-open-cnf.spec.ts:81:1 › desktop: open nullable preset, tap open CNF result, and check new grammar CNF tab shows same rules (3.7s)
  ✓ 13 [desktop] › e2e/grammar-open-cnf.spec.ts:15:1 › desktop: open CNF result as new grammar (AC3, AC4, AC6, AC8) (11.1s)
  ✓ 20 [desktop] › e2e/grammar-open-cnf.spec.ts:81:1 › desktop: open nullable preset, tap open CNF result, and check new grammar CNF tab shows same rules (4.3s)
  ✓ 16 [desktop] › e2e/grammar-open-cnf.spec.ts:15:1 › desktop: open CNF result as new grammar (AC3, AC4, AC6, AC8) (11.0s)
  ✓ 23 [desktop] › e2e/grammar-open-cnf.spec.ts:81:1 › desktop: open nullable preset, tap open CNF result, and check new grammar CNF tab shows same rules (3.7s)
  ✓ 19 [desktop] › e2e/grammar-open-cnf.spec.ts:15:1 › desktop: open CNF result as new grammar (AC3, AC4, AC6, AC8) (11.0s)
  ✓ 26 [desktop] › e2e/grammar-open-cnf.spec.ts:81:1 › desktop: open nullable preset, tap open CNF result, and check new grammar CNF tab shows same rules (3.9s)
  ✓ 22 [desktop] › e2e/grammar-open-cnf.spec.ts:15:1 › desktop: open CNF result as new grammar (AC3, AC4, AC6, AC8) (10.9s)
  ✓ 29 [desktop] › e2e/grammar-open-cnf.spec.ts:81:1 › desktop: open nullable preset, tap open CNF result, and check new grammar CNF tab shows same rules (3.4s)
  ✓ 25 [desktop] › e2e/grammar-open-cnf.spec.ts:15:1 › desktop: open CNF result as new grammar (AC3, AC4, AC6, AC8) (10.3s)
  ✓ 28 [desktop] › e2e/grammar-open-cnf.spec.ts:15:1 › desktop: open CNF result as new grammar (AC3, AC4, AC6, AC8) (10.1s)
  ✓ 33 [phone] › e2e/grammar-open-cnf.spec.ts:127:1 › phone: open CNF result as new grammar button size, navigation, and axe (AC3, AC4, AC8) (6.7s)
  ✓ 36 [phone] › e2e/grammar-open-cnf.spec.ts:127:1 › phone: open CNF result as new grammar button size, navigation, and axe (AC3, AC4, AC8) (7.2s)
  ✓ 39 [phone] › e2e/grammar-open-cnf.spec.ts:127:1 › phone: open CNF result as new grammar button size, navigation, and axe (AC3, AC4, AC8) (6.9s)
  ✓ 42 [phone] › e2e/grammar-open-cnf.spec.ts:127:1 › phone: open CNF result as new grammar button size, navigation, and axe (AC3, AC4, AC8) (6.7s)
  ✓ 44 [phone] › e2e/grammar-open-cnf.spec.ts:127:1 › phone: open CNF result as new grammar button size, navigation, and axe (AC3, AC4, AC8) (6.9s)
  ✓ 48 [phone] › e2e/grammar-open-cnf.spec.ts:127:1 › phone: open CNF result as new grammar button size, navigation, and axe (AC3, AC4, AC8) (6.9s)
  ✓ 51 [phone] › e2e/grammar-open-cnf.spec.ts:127:1 › phone: open CNF result as new grammar button size, navigation, and axe (AC3, AC4, AC8) (7.0s)
  ✓ 54 [phone] › e2e/grammar-open-cnf.spec.ts:127:1 › phone: open CNF result as new grammar button size, navigation, and axe (AC3, AC4, AC8) (6.3s)
  ✓ 57 [phone] › e2e/grammar-open-cnf.spec.ts:127:1 › phone: open CNF result as new grammar button size, navigation, and axe (AC3, AC4, AC8) (5.0s)
  ✓ 60 [phone] › e2e/grammar-open-cnf.spec.ts:127:1 › phone: open CNF result as new grammar button size, navigation, and axe (AC3, AC4, AC8) (3.7s)

  30 skipped
  30 passed (1.1m)
```

### 8. WebKit Phone Cross-Browser Test
```
$ pnpm --filter web exec playwright test --project=webkit-phone e2e/cross/workstation-phone.spec.ts

Running 2 tests using 2 workers

  ✓  2 [webkit-phone] › e2e/cross/workstation-phone.spec.ts:69:1 › language phone layout on WebKit phone: tab navigation and axe (4.8s)
  ✓  1 [webkit-phone] › e2e/cross/workstation-phone.spec.ts:30:1 › grammar phone layout on WebKit phone: tab navigation, shortcut, and axe (5.0s)

  2 passed (6.1s)
```

### 9. Full Web Unit Test Suite
```
$ pnpm test:web
$ pnpm --filter web test
$ vitest run

 Test Files  90 passed (90)
      Tests  1154 passed | 2 expected fail | 3 skipped (1159)
   Start at  21:36:03
   Duration  4.72s (tests 62%, transform 29%, import 9%)
```
