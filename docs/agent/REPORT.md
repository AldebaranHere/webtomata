# Report — T-013

> Written by the worker at the end of the session. One file per task; overwrite each session.

## Task
- id: T-013
- title: Preset text in `id` and `en`, and readable rule chips
- branch: `task/T-013-preset-text-and-rule-chips`
- commits: `9c5dc37..ba5ff97`
- pull request: https://github.com/AldebaranHere/webtomata/pull/137
- status: done

## What changed
- `web/src/lib/grammar/presets.ts`:
  - Updated `PresetGrammar` interface: `title` -> `titleId` and `titleEn`; `description` -> `descriptionId` and `descriptionEn`.
  - Added natural English translations (`titleEn`, `descriptionEn`) for all 9 grammar presets while preserving existing Indonesian strings identically in `titleId` and `descriptionId`.
- `web/src/lib/language/presets.ts`:
  - Updated `PresetLanguage` interface: `name` -> `nameId` and `nameEn`.
  - Added natural English translations (`nameEn`) for all 16 language presets while preserving existing Indonesian strings in `nameId`.
- `web/src/lib/grammar/presets.test.ts`:
  - Added unit test (AC1) verifying non-empty, distinct `Id` and `En` fields for every grammar preset, and verifying no homework/fasilkom references.
- `web/src/lib/language/presets.test.ts` (new):
  - Added unit test (AC1) verifying non-empty, distinct `Id` and `En` fields for every language preset, and valid non-empty formulas.
- `web/src/lib/grammar/grammar-text.ts`:
  - Added pure function `formatRuleDisplay(rule: Production): string` formatting production rules as `head → ` with one space between each body symbol, and `λ` for an empty body.
  - Added pure function `computeCnfTitle(baseTitle: string, existingGrammars: Array<{ title: string }>): string` returning `<baseTitle> (CNF)` or `<baseTitle> (CNF <n>)`.
- `web/src/lib/grammar/grammar-text.test.ts`:
  - Added unit tests for `formatRuleDisplay` (AC3): `S → T_a S T_b`, `S → λ` for empty body, and one space between every two symbols for bodies with 1, 2, and 3 symbols.
  - Added unit tests for `computeCnfTitle` and custom grammar title localization (AC4).
- `web/src/lib/grammar/GrammarCnfStepper.svelte`:
  - Replaced local `formatRule` with `formatRuleDisplay` from `./grammar-text.ts` so stepper rule chips display spaced symbols (e.g. `S → T_a S T_b`).
- `web/src/lib/grammar/GrammarWorkstation.svelte`:
  - Imported `getLocale` from `#lib/i18n/index.svelte.ts` and `computeCnfTitle` from `./grammar-text.ts`.
  - Updated preset title and description lookups to use `getLocale() === 'en' ? preset.titleEn : preset.titleId` and `getLocale() === 'en' ? preset.descriptionEn : preset.descriptionId`.
  - Updated `createNewCustomGrammar` to use localized string `t('grammar.default_custom_title', { id })`.
- `web/src/lib/language/LanguageWorkstation.svelte`:
  - Updated active title and preset name lookups to use `getLocale() === 'en' ? preset.nameEn : preset.nameId`.
- `web/src/lib/i18n/id.ts` & `web/src/lib/i18n/en.ts`:
  - Added `'grammar.default_custom_title': 'Tata Bahasa {id}'` to `id.ts` and `'grammar.default_custom_title': 'Grammar {id}'` to `en.ts`.
- `docs/agent/PLAN.md`:
  - Set T-013 status to `in-progress` in first commit, and `done` in final commit with commit hash `ed249ef`.

## AC Checks Summary
- **AC1:** Unit tests in `presets.test.ts` (grammar and language) pass. Every preset has non-empty `Id` and `En` fields for each text, and `En` differs from `Id`.
- **AC2:** When locale is `en`, workstation libraries and active headers display English titles and descriptions (`titleEn`/`nameEn`, `descriptionEn`). In `id`, Indonesian texts are preserved identically.
- **AC3:** `formatRuleDisplay` returns `S → T_a S T_b` for rule `S → T_a S T_b`, `S → λ` for empty body, and one space between each symbol for bodies of 1, 2, and 3 symbols. Stepper chips use `formatRuleDisplay`.
- **AC4:** A new custom grammar receives its title from `grammar.default_custom_title` parameterized by `{ id }` in the active locale at creation time (`Tata Bahasa G1` in `id`, `Grammar G1` in `en`). `computeCnfTitle` tests confirm `<name> (CNF)` and `<name> (CNF <n>)` sequence continues to work.
- **AC5:** Existing e2e tests (including `grammar-open-cnf.spec.ts`, `grammar-phone.spec.ts`, and `language-phone.spec.ts`) pass without regressions.
- **AC6:** `check:strings`, `check:tokens`, and `check:contrast` pass with 0 errors.
- **AC7:** Deliberate break demonstrated: joining symbols without spaces in `formatRuleDisplay` (`.join('')`) caused AC3 test to fail with `AssertionError: expected 'S → T_aST_b' to be 'S → T_a S T_b'`. Code was restored and re-verified.

---

## Deliberate Break Output (AC7)
When `formatRuleDisplay` joined body symbols with `.join('')` instead of `.join(' ')`:
```
 RUN  v5.0.3 /home/Aldebaran64/webtomata/web

 ❯ src/lib/grammar/grammar-text.test.ts (18 tests | 3 failed) 16ms
   ❯ grammar-text (18)
     ✓ grammarToText (AC1) (5)
     ✓ nextCustomId (AC7) (5)
     ❯ formatRuleDisplay (AC3) (5)
       × formats rule S → T_a S T_b with spaces between symbols 6ms
       ✓ formats rule with empty body as S → λ 0ms
       ✓ formats body with 1 symbol without extra spaces 0ms
       × formats body with 2 symbols separated by one space 1ms
       × formats body with 3 symbols separated by one space between each 1ms
     ✓ computeCnfTitle (AC4) (3)

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/lib/grammar/grammar-text.test.ts > grammar-text > formatRuleDisplay (AC3) > formats rule S → T_a S T_b with spaces between symbols
AssertionError: expected 'S → T_aST_b' to be 'S → T_a S T_b' // Object.is equality

Expected: "S → T_a S T_b"
Received: "S → T_aST_b"

 ❯ src/lib/grammar/grammar-text.test.ts:135:36
    133|     ]
    134|    };
    135|    expect(formatRuleDisplay(rule)).toBe('S → T_a S T_b');
       |                                    ^
```

---

## Verification Outputs

### 1. `pnpm --filter web exec vitest run src/lib/grammar src/lib/language`
```
 RUN  v5.0.3 /home/Aldebaran64/webtomata/web

 ✓ src/lib/language/presets.test.ts (2 tests) 8ms
 ✓ src/lib/language/language-math.test.ts (5 tests) 8ms
 ✓ src/lib/grammar/presets.test.ts (4 tests) 11ms
 ✓ src/lib/grammar/grammar-text.test.ts (19 tests) 8ms
 ✓ src/lib/grammar/grammar-text.wasm.test.ts (31 tests) 84ms

 Test Files  5 passed (5)
      Tests  61 passed (61)
   Start at  13:33:32
   Duration  475ms (transform 65%, import 19%, tests 13%, worker 4%)
```

### 2. `pnpm check && pnpm lint && pnpm format:check && pnpm check:strings`
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
```

### 3. `pnpm build && pnpm size`
```
$ pnpm build:wasm && pnpm --filter web build
$ wasm-pack build crates/engine-wasm --target web --release --out-dir ../../web/src/lib/engine/wasm && pnpm build:types
[INFO]: 🎯  Checking for the Wasm target...
[INFO]: 🌀  Compiling to Wasm...
    Finished `release` profile [optimized] target(s) in 0.05s
[INFO]: ⬇️  Installing wasm-bindgen...
[INFO]: Optimizing wasm binaries with `wasm-opt`...
[INFO]: ✨   Done in 18.54s
[INFO]: 📦   Your wasm pkg is ready to publish at web/src/lib/engine/wasm.
$ cargo test -p engine-core --features ts --test ts_export
running 1 test
test the_types_match_the_json ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s

$ vite build
vite v8.3.4 building ssr environment for production...
✓ 321 modules transformed.
rendering chunks...
computing gzip size...
✓ built in 1.29s
Prerendering
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

### 4. `pnpm test:e2e`
```
$ pnpm --filter web test:e2e
$ playwright test --project=desktop --project=phone

Running 860 tests using 6 workers
...
  139 skipped
  721 passed (10.0m)
```

### 5. Cross-Browser Workstation Spec (WebKit phone)
```
$ pnpm --filter web exec playwright test --project=webkit-phone e2e/cross/workstation-phone.spec.ts

Running 2 tests using 2 workers

  ✓  1 [webkit-phone] › e2e/cross/workstation-phone.spec.ts:30:1 › grammar phone layout on WebKit phone: tab navigation, shortcut, and axe (4.8s)
  ✓  2 [webkit-phone] › e2e/cross/workstation-phone.spec.ts:69:1 › language phone layout on WebKit phone: tab navigation and axe (4.8s)

  2 passed (6.1s)
```

### 6. What was not run and why
- Firefox tests under `test:e2e:cross`: As stated in `AGENTS.md` ("Firefox does not start on the owner's laptop; the Firefox tests run only in CI"), Firefox binaries are not available in local WSL and run strictly in CI. WebKit phone workstation tests were run locally and passed 2/2.
