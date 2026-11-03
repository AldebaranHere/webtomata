# Report — T-027

> Written by the worker at the end of the session. One file per task; overwrite each session.

## Task
- id: T-027
- title: The grammar parser reads `λ` as the empty string
- branch: `task/T-027-parser-lambda-empty`
- status: done

## What changed
- `crates/engine-core/src/grammar/parser.rs`:
  - Added `|| trimmed == "λ"` (U+03BB) to `parse_rhs_symbols`'s empty string / epsilon representations check.
  - When `λ` appears as a standalone alternative (e.g. `S -> a S b | λ`), it produces an empty production body (`Production::new(head, vec![])`), matching the existing behavior of `ε`, `^`, `\lambda`, `\epsilon`, `lambda`, and `epsilon`.
  - When `λ` appears inside a longer body (e.g. `S -> a λ`), it continues to be parsed as a terminal symbol `Symbol::Terminal('λ')`, matching the behavior of `ε`.
- `crates/engine-core/tests/grammar.rs`:
  - Updated `test_parse_arrow_variants_and_empty_symbols`: verified that rule 3 (`A -> λ`), rule 5 (`B -> ^`), and rule 6 (`B -> epsilon`) have empty bodies.
  - Added `test_parse_lambda_empty_symbol`: tests `S -> a S b | λ` yields an empty production body and no `Symbol::Terminal('λ')`; tests equivalent behavior for `ε` and `^`; pins inline `λ` behavior (`S -> a λ` yields `[Terminal('a'), Terminal('λ')]`).
  - Added `test_t027_audit_lambda_presets_and_grammars`: comprehensive audit covering `CFG_PAL`, `CFG_PAREN`, `CFG_EQ`, the default new custom grammar `S -> aSb | λ`, and the existing test grammar at line 31. Asserts valid CNF, acceptance of `""` in CYK, acceptance of valid language strings, rejection of non-language strings, and CNF idempotence.
- `web/src/lib/grammar/grammar-text.wasm.test.ts`:
  - Added `T-027: λ parsed as empty symbol across all presets`:
    - Verifies that every preset in `GRAMMAR_PRESETS` parses without containing terminal `λ` in any production body.
    - Verifies that CYK accepts the empty string `""` on each preset containing `λ` (`CFG_PAL`, `CFG_PAREN`, `CFG_EQ`).
    - Verifies that CYK accepts `""` on the default new custom grammar `S -> aSb | λ`.

---

## Audit of Grammars Containing `λ` & Textbook Rationale

### 1. `CFG_PAL` (`S -> aSa | bSb | a | b | λ`)
- **Old Result:** `λ` was parsed as `Symbol::Terminal('λ')`. `S` was not recognized as nullable. In Phase 1 `S0 -> S` was added, but in Phase 2 no epsilon productions were eliminated and no nullable variations were generated. The terminal `λ` was isolated as a terminal helper (e.g. `T_p1 -> λ`). The grammar generated palindromes containing literal `λ`, but could NOT generate `""`, `"aa"`, `"bb"`, or `"abba"`. CYK rejected `""`.
- **New Result:** `λ` parses as empty production `S -> ε`. `S` and `S0` are nullable. Phase 1 introduces `S0 -> S`. Phase 2 generates `S0 -> ε`, adds nullable variations `S -> a a | b b`, and removes `S -> ε`. Phase 3 eliminates unit rules `S0 -> S`. Phase 5 isolates terminals `T_a -> a`, `T_b -> b`. Phase 6 binarizes the rules. CYK accepts `""`, `"a"`, `"b"`, `"aa"`, `"bb"`, `"aba"`, `"abba"`.
- **Textbook Correctness (Rich ACCTA Ch. 11, Sipser Ch. 2):** In formal language theory, the language of palindromes over $\{a, b\}$ includes the empty word $\epsilon$ ($\epsilon^R = \epsilon$). In CNF, when $\epsilon \in L$, the only rule deriving $\epsilon$ is $S_0 \to \epsilon$. The new result correctly models $L = \{ w \in \{a, b\}^* : w = w^R \}$. The old result was textbook-incorrect because it treated $\lambda$ as an alphabet terminal.

### 2. `CFG_PAREN` (`S -> (S)S | λ`)
- **Old Result:** `λ` was treated as a terminal. `S` was not nullable. Empty string `""` and balanced string `"()"` could not be derived without terminal `λ`. CYK rejected `""`.
- **New Result:** `λ` produces empty body. `S` and `S0` are nullable. Phase 2 generates combinations `( )`, `( ) S`, `( S )`, `( S ) S` and $S_0 \to \epsilon$. Terminals `(` and `)` are isolated as `T_p1` and `T_p2`. CYK accepts `""`, `"()"`, `"(())"`, `"()()"`, `"(()())"`, and rejects `"("`, `")("`.
- **Textbook Correctness:** The Dyck language of balanced parentheses includes $\epsilon$ (0 pairs of parentheses). The new CNF correctly accepts $\epsilon$ and all Dyck words.

### 3. `CFG_EQ` (`S -> aSbS | bSaS | λ`)
- **Old Result:** `λ` was parsed as terminal `'λ'`. `S` was not nullable. Empty string `""` was rejected.
- **New Result:** `λ` produces empty body. `S` is nullable, yielding $S_0 \to \epsilon$ and combinations for nullable `S` in Phase 2 (`a b`, `a b S`, `a S b`, etc.). CYK accepts `""`, `"ab"`, `"ba"`, `"aabb"`, `"baba"`, and rejects `"a"`, `"b"`, `"aab"`.
- **Textbook Correctness:** For $L = \{ w \in \{a, b\}^* : \#_a(w) = \#_b(w) \}$, $\#_a(\epsilon) = 0 = \#_b(\epsilon)$, so $\epsilon \in L$. The new CNF result correctly includes $\epsilon$.

### 4. Default New Custom Grammar in `GrammarWorkstation.svelte` (`S -> aSb | λ`)
- **Old Result:** Generated $L = \{ a^n \lambda b^n \}$. Rejected `""` and `"ab"`.
- **New Result:** Correctly recognized as canonical CFG for $\{ a^n b^n : n \ge 0 \}$. CNF derives $S_0 \to \epsilon \mid T_a T_b \mid T_a X_1$, $S \to T_a T_b \mid T_a X_1$, $X_1 \to S T_b$. CYK accepts `""`, `"ab"`, `"aabb"`, `"aaabbb"`.
- **Textbook Correctness:** Canonical textbook language $\{ a^n b^n : n \ge 0 \}$ where $n=0$ is $\epsilon$.

### 5. Line 31 Test Grammar (`S → A | B`, `A ::= a | λ`, `B -> b | ^ | epsilon`)
- **Old Result:** Rule 3 was `A -> Terminal('λ')`. Only `B` was nullable, so `A` was not nullable.
- **New Result:** Both `A` and `B` have empty bodies and are nullable. Thus `S` is nullable ($S \to \epsilon$). Unit rules eliminate `A` and `B`, giving final minimal CNF `S -> a | b | ε`. CYK accepts `""`, `"a"`, `"b"`.
- **Textbook Correctness:** $S \to A \mid B$ with $A \to a \mid \epsilon$ and $B \to b \mid \epsilon$ generates $L = \{ \epsilon, a, b \}$. The new CNF is minimal and textbook-correct.

---

## Idempotence Re-check (T-026 & T-027)
- `CFG_PAL`: Idempotent in Rust (`assert_cnf_idempotent`) and in Vitest WASM test.
- `CFG_EQ`: Idempotent in Rust (`assert_cnf_idempotent`) and in Vitest WASM test.
- `CFG_PAREN`: Idempotent in Rust (`assert_cnf_idempotent`) and in Vitest WASM test.
- All 9 presets pass the CNF idempotence test suite in `grammar-text.wasm.test.ts`.

---

## Tests First: Failing Test Output Before Code Change

Before adding `|| trimmed == "λ"` to `parser.rs`, the new test in `crates/engine-core/tests/grammar.rs` was run:

```
$ cargo test -p engine-core --test grammar test_parse
   Compiling engine-core v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-core)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 2.85s
     Running tests/grammar.rs (target/debug/deps/grammar-55e09d754fbe5e9c)

running 3 tests
test test_parse_simple_grammar ... ok
test test_parse_arrow_variants_and_empty_symbols ... FAILED
test test_parse_lambda_empty_symbol ... FAILED

failures:

---- test_parse_arrow_variants_and_empty_symbols stdout ----

thread 'test_parse_arrow_variants_and_empty_symbols' (516285) panicked at crates/engine-core/tests/grammar.rs:39:5:
A -> λ should have empty body
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace

---- test_parse_lambda_empty_symbol stdout ----

thread 'test_parse_lambda_empty_symbol' (516286) panicked at crates/engine-core/tests/grammar.rs:59:5:
Rule for λ should have an empty body, but got [Terminal('λ')]


failures:
    test_parse_arrow_variants_and_empty_symbols
    test_parse_lambda_empty_symbol

test result: FAILED. 1 passed; 2 failed; 0 ignored; 0 measured; 16 filtered out; finished in 0.00s

error: test failed, to rerun pass `-p engine-core --test grammar`
```

---

## Deliberate Break

Temporarily removing `|| trimmed == "λ"` from `crates/engine-core/src/grammar/parser.rs` causes `test_parse_lambda_empty_symbol` to fail:

```
thread 'test_parse_lambda_empty_symbol' panicked at crates/engine-core/tests/grammar.rs:59:5:
Rule for λ should have an empty body, but got [Terminal('λ')]
```

After restoring `trimmed == "λ"`, all tests pass.

---

## WASM Size Report
```
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-DmuDISdj.wasm: 206.3 KB gzip (limit 250 KB)
```
Budget: 250 KB. Actual: 206.3 KB gzip. Well within budget.

---

## What was not run and why
- **Firefox E2E tests (`pnpm test:e2e:cross` with `firefox`)**: Not run locally because Firefox does not start in this WSL environment (per `AGENTS.md`: "Firefox does not start on the owner's laptop; the Firefox tests run only in CI"). The WebKit suite (`webkit-phone`) was run locally and passed completely (119 passed, 14 skipped, 0 failed).
- **Physical mobile devices**: Not run directly; emulated via Playwright's mobile emulation profiles (`phone` = Pixel 7, `webkit-phone` = iPhone 13).

---

## Verification Commands & Actual Outputs

### 1. `cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test`
```
$ cargo fmt --check
(exited 0 with no diff)

$ cargo clippy --all-targets -- -D warnings
    Checking engine-core v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-core)
    Checking engine-wasm v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-wasm)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.62s

$ cargo test
     Running unittests src/lib.rs (target/debug/deps/engine_core-670a3d94c89462ba)
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
     Running tests/api.rs (target/debug/deps/api-b80225d7cef47478)
test result: ok. 24 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.16s
     Running tests/boundaries.rs (target/debug/deps/boundaries-86334ddba1c3c79e)
test result: ok. 20 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.11s
     Running tests/determinize.rs (target/debug/deps/determinize-b9746edb6b0d6811)
test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.12s
     Running tests/differential.rs (target/debug/deps/differential-859c5c32261d2a58)
test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.69s
     Running tests/fsm_to_regex.rs (target/debug/deps/fsm_to_regex-1941d4f40f0653c4)
test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s
     Running tests/grammar.rs (target/debug/deps/grammar-53ed0d438fef75e6)
running 20 tests
test test_cnf_cfg_paren_helper_names_readable ... ok
test test_cnf_phase1_start_symbol_collision_with_existing_s0 ... ok
test test_cnf_slide_example_eliminating_long_rhs ... ok
test test_cnf_variable_fresh_when_t_p1_already_exists ... ok
test test_cyk_empty_string ... ok
test test_parse_arrow_variants_and_empty_symbols ... ok
test test_cyk_parser_on_cnf ... ok
test test_parse_simple_grammar ... ok
test test_parse_lambda_empty_symbol ... ok
test test_cnf_variable_deduplication_step6 ... ok
test test_full_pipeline_cfg_to_cnf_to_cyk ... ok
test test_cnf_transformation_trace_6_phases ... ok
test test_cnf_presets_alphanumeric_helpers_unchanged ... ok
test test_cnf_preset_order ... ok
test test_t027_audit_lambda_presets_and_grammars ... ok
test test_cnf_preset_unit_chain ... ok
test cnf_proptest_variables_read_back_as_single_variable ... ok
test test_cnf_preset_start_long ... ok
test test_cnf_preset_nullable ... ok
test test_cnf_preset_shared_tail ... ok
test result: ok. 20 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 18.04s
     Running tests/language.rs (target/debug/deps/language-4f057c7d8ae31e90)
test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
     Running tests/minimize.rs (target/debug/deps/minimize-b6b23a9d70034a81)
test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.16s
     Running tests/nondeterministic_states.rs (target/debug/deps/nondeterministic_states-3d2382bc19445199)
test result: ok. 9 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s
     Running tests/regex_compile.rs (target/debug/deps/regex_compile-514ffc3ea31828f7)
test result: ok. 15 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s
     Running tests/regex_parser.rs (target/debug/deps/regex_parser-5d26ae810ba2b5a1)
test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s
     Running tests/regex_simplify.rs (target/debug/deps/regex_simplify-006d6ae2a7e71954)
test result: ok. 9 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.15s
     Running tests/regex_oracle.rs (target/debug/deps/regex_oracle-8160578fcffdab82)
test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.95s
     Running tests/simulate.rs (target/debug/deps/simulate-1dbd64b6389fef35)
test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.07s
     Running tests/trap_state.rs (target/debug/deps/trap_state-4aee2a592eea6543)
test result: ok. 9 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.14s
     Running tests/ts_export.rs (target/debug/deps/ts_export-33cfd47880a3bf7a)
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
     Running tests/validate.rs (target/debug/deps/validate-6703e515f13f4509)
test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s
     Running tests/xor.rs (target/debug/deps/xor-64f20ad6e96eb367)
test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.67s
     Running unittests src/lib.rs (target/debug/deps/engine_wasm-c813d8d0c2a39401)
test result: ok. 9 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
   Doc-tests engine_core
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
   Doc-tests engine_wasm
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

### 2. `wasm-pack test --node crates/engine-wasm`
```
[INFO]: 🎯  Checking for the Wasm target...
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.12s
[INFO]: ⬇️  Installing wasm-bindgen...
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.25s
     Running unittests src/lib.rs (target/wasm32-unknown-unknown/debug/deps/engine_wasm-b764f7b99cfd7388.wasm)
running 9 tests
test tests::version_matches_crate_version ... ok
test tests::transform_to_cnf_answers_in_envelope ... ok
test tests::simulate_answers_in_the_envelope ... ok
test tests::parse_grammar_answers_in_envelope ... ok
test tests::equivalent_names_the_witness ... ok
test tests::enumerate_language_answers_in_envelope ... ok
test tests::cyk_parse_answers_in_envelope ... ok
test tests::bad_input_is_an_error_and_not_a_trap ... ok
test tests::a_budget_that_is_too_small_stops_the_run ... ok

test result: ok. 9 passed; 0 failed; 0 ignored; 0 filtered out; finished in 0.06s
```

### 3. `pnpm build:wasm && pnpm --filter web exec vitest run`
```
$ pnpm build:wasm
[INFO]: ✨   Done in 25.23s
[INFO]: 📦   Your wasm pkg is ready to publish at web/src/lib/engine/wasm.

$ pnpm --filter web test
 RUN  v5.0.3 /home/Aldebaran64/webtomata/web
 Test Files  90 passed (90)
      Tests  1160 passed | 2 skipped (1162)
   Duration  4.33s
```

### 4. `pnpm check && pnpm lint && pnpm format:check && pnpm check:strings`
```
$ pnpm check
svelte-check found 0 errors and 0 warnings

$ pnpm lint
(exited 0 with no errors)

$ pnpm format:check
Checking formatting...
All matched files use Prettier code style!

$ pnpm check:strings
ok   63 components have no hard-coded text
```

### 5. `pnpm build && pnpm size`
```
$ pnpm build
✓ built in 1.34s
Wrote site to "build"

$ pnpm size
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
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-DmuDISdj.wasm: 206.3 KB gzip (limit 250 KB)
```

### 6. `pnpm test:e2e`
```
Running 856 tests using 6 workers
  137 skipped
  719 passed (11.6m)
```

### 7. `pnpm --filter web exec playwright test --project=webkit-phone`
```
Running 133 tests using 6 workers
  14 skipped
  119 passed (2.3m)
```
