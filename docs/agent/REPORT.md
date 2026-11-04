# Report — T-029

> Written by the worker at the end of the session. One file per task; overwrite each session.

## Task
- id: T-029
- title: The CYK tester must space the symbols of a rule
- branch: `task/T-029-cyk-text-spacing`
- commits: `1665a38`
- status: done

## What changed
- `web/src/lib/grammar/GrammarCykTester.svelte`:
  - Removed the inline `grammarText` `$derived.by` block which joined symbols of a production body with an empty string (`.join('')`).
  - Replaced it with canonical serialization via `grammarToText(grammar)` from `./grammar-text.ts`, ensuring that symbols in production rule bodies are separated by a space (e.g. `T_b T_b` instead of `T_bT_b`) and preserving start-symbol-first ordering and epsilon representations.
- `web/e2e/grammar-flow.spec.ts`:
  - Added new test suite `CYK tester with opened CNF grammar (T-029)`:
    - Opens preset `CNF_UNIT_CHAIN` (`S → A`, `A → B`, `B → C | b b`, `C → c C | c`; language $\{bb\} \cup c^+$).
    - Navigates to step 6 of the CNF transformation stepper and clicks "Buka sebagai tata bahasa baru" to save and select the transformed grammar (which contains helper variables such as `T_b` and `T_c`).
    - Switches to the CYK testing tab.
    - Tests words in the language: `bb` (accepted), `c` (accepted), `ccc` (accepted).
    - Tests words not in the language: `b` (rejected), `bc` (rejected).
    - Runs cleanly on both `desktop` (1280x800) and `phone` (390x844).

---

## Deliberate Break (AC2)

Before updating `GrammarCykTester.svelte` (with the local `.join('')` rule serializer active):
- When opening the CNF result of `CNF_UNIT_CHAIN` and testing word `bb` in the CYK tab, the CYK parser reported that the grammar was not in Chomsky Normal Form because rule bodies with multi-character variables were concatenated without spaces (`T_bT_b`).
- An error banner `role="alert"` was rendered with text:
  `! Format aturan produksi tidak valid: Tata bahasa harus berada dalam Bentuk Normal Chomsky (CNF) untuk menjalankan algoritma CYK.`
- Playwright test failed waiting for `.cyk-verdict`:
  ```
    1) [desktop] › e2e/grammar-flow.spec.ts:565:2 › CYK tester with opened CNF grammar (T-029) › open CNF result of CNF_UNIT_CHAIN and verify strings in CYK 

      Error: expect(locator).toHaveClass(expected) failed

      Locator: locator('#grammar-pane-cyk').locator('.cyk-verdict')
      Expected pattern: /accepted/
      Timeout: 5000ms
      Error: element(s) not found

        624 | 			await inputField.fill(word);
        625 | 			await testBtn.click();
      > 626 | 			await expect(verdict).toHaveClass(new RegExp(expectedStatus));
            | 			                      ^
        627 | 		};
  ```
- With `grammarToText(grammar)` applied, the grammar string produces `T_b T_b`, which is correctly parsed into two variable symbols, satisfying CNF and passing the tests.

---

## Verification Outputs

### 1. Static Checks
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

### 2. Build
```
$ pnpm build:wasm && pnpm --filter web build
$ wasm-pack build crates/engine-wasm --target web --release --out-dir ../../web/src/lib/engine/wasm && pnpm build:types
[INFO]: 🎯  Checking for the Wasm target...
[INFO]: 🌀  Compiling to Wasm...
    Finished `release` profile [optimized] target(s) in 0.04s
[INFO]: ⬇️  Installing wasm-bindgen...
[INFO]: Optimizing wasm binaries with `wasm-opt`...
[INFO]: ✨   Done in 22.97s
[INFO]: 📦   Your wasm pkg is ready to publish at web/src/lib/engine/wasm.
$ cargo test -p engine-core --features ts --test ts_export
running 1 test
test the_types_match_the_json ... ok
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s

$ vite build
vite v8.3.4 building ssr environment for production...
transforming...
✓ 321 modules transformed.
rendering chunks...
✓ built in 1.70s
Prerendering
> Using @sveltejs/adapter-static
Wrote site to "build"
✔ done
```

### 3. Grammar Flow Tests Repeated 5 Times
```
pnpm --filter web exec playwright test --project=desktop --project=phone e2e/grammar-flow.spec.ts --repeat-each=5

Running 80 tests using 6 workers

  35 skipped
  45 passed (1.5m)
```

Specs run in this suite:
- `e2e/grammar-flow.spec.ts` (desktop and phone): matrix editing, 6 CNF phases walkthrough & hand derivation, CYK tester & English locale, CYK tester with opened CNF grammar (T-029), and axe accessibility scans.

### 4. Area Specs
```
pnpm --filter web exec playwright test --project=desktop --project=phone e2e/grammar-phone.spec.ts e2e/grammar-open-cnf.spec.ts e2e/grammar-cyk-limit.spec.ts

Running 26 tests using 6 workers

  13 skipped
  13 passed (27.1s)
```

Specs run:
- `e2e/grammar-phone.spec.ts` (desktop and phone)
- `e2e/grammar-open-cnf.spec.ts` (desktop and phone)
- `e2e/grammar-cyk-limit.spec.ts` (desktop and phone)
