# Report — T-026

> Written by the worker at the end of the session. One file per task; overwrite each session.

## Task
- id: T-026
- title: CNF helper variables that the grammar parser can read back
- branch: `task/T-026-readable-cnf-helper-names`
- pull request: https://github.com/AldebaranHere/webtomata/pull/126

## What changed
- `crates/engine-core/src/grammar/cnf.rs`:
  - In CNF Phase 5 (`phase5_isolate_terminals`), helper variables for isolated terminals:
    - If `c.is_ascii_alphanumeric()`, maintains existing `T_<c>` naming (`T_a`, `T_0`).
    - If `c` is non-alphanumeric (e.g. `(`, `+`, `*`), assigns `T_p<n>` where `n` starts at 1 and increments for each distinct non-alphanumeric terminal encountered.
  - In `fresh_variable_name`:
    - Prevented generating names with multiple underscores (`T_a_1` or `T_p1_1`), which `GrammarParser` (`parser.rs`) rejects because its variable regex/tokenization is `[A-Z]_[A-Za-z0-9]+` or `[A-Z][0-9]+`.
    - If the base name already contains an underscore or starts with an uppercase letter followed by digits, collision resolution appends numeric digits directly (e.g. `T_p11`, `T_a1`) without introducing a second underscore.
- `crates/engine-core/tests/grammar.rs`:
  - Added `grammar_to_text` helper mirroring `grammarToText` formatting with spaces between RHS symbols.
  - Test (a) `test_cnf_phase5_helper_names_unchanged_for_standard_presets`: Verifies standard presets (like `CFG_EXPR`, `CFG_PALINDROME`, `CFG_ARITH`) continue using `T_a`, `T_0`, etc., producing identical CNF results as before.
  - Test (b) `test_cfg_paren_cnf_helper_variables_use_tp`: Verifies `CFG_PAREN` CNF result helpers are `T_p1` and `T_p2`, and confirms no variable name contains non-alphanumeric characters.
  - Test (c) `test_cnf_proptest_roundtrip_all_variables_readable`: Property-based test (`proptest`) generating random grammars over alphabet `a-z`, digits `0-9`, and symbols `( ) + * , ;`. Verifies that every variable of `final_grammar` parses back as exactly one variable, and the reconstructed rule set is identical.
  - Test (d) `test_cnf_phase5_collision_with_existing_tp_variable`: Verifies that if a grammar already contains variable `T_p1`, a fresh parser-readable variable name is allocated.
- `web/src/lib/grammar/grammar-text.wasm.test.ts`:
  - Converted the two tests previously marked `it.fails` with "known until T-026" (`CFG_PAREN` CNF round-trip and `CFG_PAREN` CNF idempotence) into regular passing tests.
  - Removed `preset.id !== 'CFG_PAREN'` exception filter so all presets are uniformly tested.
  - Added `CFG_PAREN` to `idempotentPresets`.

---

## What was not run and why
- **Firefox E2E tests (`pnpm test:e2e:cross` with `firefox`)**: Not run locally because Firefox does not start in this WSL environment (per `AGENTS.md`: "Firefox does not start on the owner's laptop; the Firefox tests run only in CI"). The WebKit suite (`webkit-phone`) was run locally and passed completely (119 passed, 14 skipped, 0 failed).
- **Physical mobile devices**: Not run directly; emulated via Playwright's mobile emulation profiles (`phone` = Pixel 7, `webkit-phone` = iPhone 13).

---

## Tests First: Test (b) Failing Before Code Changes

Before modifying `crates/engine-core/src/grammar/cnf.rs`, test (b) was executed to prove that the existing implementation failed on `CFG_PAREN`:

```
$ cargo test --test grammar test_cfg_paren_cnf_helper_variables_use_tp
running 1 test
test test_cfg_paren_cnf_helper_variables_use_tp ... FAILED

failures:

---- test_cfg_paren_cnf_helper_variables_use_tp stdout ----
thread 'test_cfg_paren_cnf_helper_variables_use_tp' panicked at crates/engine-core/tests/grammar.rs:188:9:
Expected T_p1 for helper rule of '(', left: "T_(", right: "T_p1"
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace

failures:
    test_cfg_paren_cnf_helper_variables_use_tp

test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 17 filtered out; finished in 0.00s
```

---

## Deliberate Break Demonstration

To verify the test suite's sensitivity, `cnf.rs` was deliberately modified to restore the legacy `format!("T_{c}")` behavior for all terminals:

1. **Rust Test (b) Failure:**
```
$ cargo test --test grammar test_cfg_paren_cnf_helper_variables_use_tp
running 1 test
test test_cfg_paren_cnf_helper_variables_use_tp ... FAILED

failures:

---- test_cfg_paren_cnf_helper_variables_use_tp stdout ----
thread 'test_cfg_paren_cnf_helper_variables_use_tp' panicked at crates/engine-core/tests/grammar.rs:188:9:
Expected T_p1 for helper rule of '(', left: "T_(", right: "T_p1"
```

2. **Vitest `CFG_PAREN` Round-trip & Idempotence Failures:**
```
$ pnpm --filter web exec vitest run src/lib/grammar/grammar-text.wasm.test.ts
 FAIL  src/lib/grammar/grammar-text.wasm.test.ts > grammarToText with WASM engine > round-trips CNF result of CFG_PAREN
AssertionError: expected [ Array(4) ] to deeply equal [ Array(4) ]
- Expected:
Array [
  Rule { "body": Array [ Symbol { "kind": "variable", "value": "T_(" } ], "head": "S" },
...
]
+ Received:
Array [
  Rule { "body": Array [ Symbol { "kind": "variable", "value": "T_" }, Symbol { "kind": "terminal", "value": "(" } ], "head": "S" },
...
]

 FAIL  src/lib/grammar/grammar-text.wasm.test.ts > grammarToText with WASM engine (AC5) > is idempotent on preset CFG_PAREN
AssertionError: expected 'S -> T_( T_) | λ...' to deeply equal 'S -> T_p1 T_p2 | λ...'
```

Restoring the `T_p<n>` implementation caused all tests to pass immediately.

---

## WASM Size Budget Verification

- Budget limit: **250 KB** (gzip)
- Actual `.wasm` size: **206.3 KB** (gzip)

```
$ pnpm size
dist/assets/engine_wasm_bg-CS8gvYFB.wasm: 671.3 kB (gzip: 206.3 kB)
Within 250 KB limit.
```

---

## Verification Outputs

### 1. Rust Format, Clippy, and Tests
```
$ cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.05s
     Running unittests src/lib.rs (target/debug/deps/engine_core-9310a08e1a6134b2)
running 15 tests
test fsm::dfsm::tests::test_dfsm_step ... ok
test fsm::dfsm::tests::test_dfsm_run ... ok
test fsm::ndfsm::tests::test_ndfsm_epsilon_closure ... ok
test fsm::ndfsm::tests::test_ndfsm_step ... ok
test fsm::ndfsm::tests::test_ndfsm_run ... ok
test fsm::regex_convert::tests::test_char_class ... ok
test fsm::regex_convert::tests::test_literal_nfa ... ok
test fsm::regex_convert::tests::test_concat_nfa ... ok
test fsm::regex_convert::tests::test_union_nfa ... ok
test fsm::regex_convert::tests::test_star_nfa ... ok
test fsm::regex_convert::tests::test_plus_nfa ... ok
test fsm::regex_convert::tests::test_question_nfa ... ok
test fsm::regex_convert::tests::test_complex_regex ... ok
test fsm::regex_convert::tests::test_empty_regex ... ok
test fsm::regex_convert::tests::test_epsilon_transitive ... ok

test result: ok. 15 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/fsm.rs (target/debug/deps/fsm-78f7736ec7a7a0b3)
running 4 tests
test test_dfsm_accepts ... ok
test test_ndfsm_accepts ... ok
test test_ndfsm_to_dfsm ... ok
test test_dfsm_minimize ... ok

test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/grammar.rs (target/debug/deps/grammar-d1d7373f7ddca2bf)
running 18 tests
test test_cyk_accepts ... ok
test test_grammar_parser_rejects_lowercase_lhs ... ok
test test_cfg_paren_cnf_helper_variables_use_tp ... ok
test test_grammar_parser_rejects_empty_input ... ok
test test_grammar_parser ... ok
test test_cnf_phase5_helper_names_unchanged_for_standard_presets ... ok
test test_cnf_phase5_collision_with_existing_tp_variable ... ok
test test_cnf_conversion ... ok
test test_cyk_empty_string ... ok
test test_cnf_step_trace_rich_order ... ok
test test_grammar_parser_pipe_alternatives ... ok
test test_grammar_parser_rules_preserve_input_order ... ok
test test_grammar_parser_multi_char_variable_names ... ok
test test_grammar_parser_whitespace_tolerance ... ok
test test_cnf_proptest_roundtrip_all_variables_readable ... ok
test test_grammar_parser_empty_word_symbols ... ok
test test_grammar_parser_rejects_missing_arrow ... ok
test test_grammar_parser_rejects_empty_rule ... ok

test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.44s
```

### 2. WASM Node Tests
```
$ wasm-pack test --node crates/engine-wasm
[INFO]: Checking for the Wasm target...
[INFO]: Compiling to Wasm...
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.16s
[INFO]: Installing wasm-bindgen...
[INFO]: Running Wasm tests with wasm-bindgen-test-runner...
running 5 tests
test crates/engine-wasm/tests/web.rs:25:wasm_dfsm_run ... ok
test crates/engine-wasm/tests/web.rs:18:wasm_regex_to_nfa ... ok
test crates/engine-wasm/tests/web.rs:56:wasm_grammar_cyk ... ok
test crates/engine-wasm/tests/web.rs:43:wasm_grammar_to_cnf ... ok
test crates/engine-wasm/tests/web.rs:34:wasm_grammar_parse ... ok

test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

### 3. WASM Build & Vitest Unit Tests
```
$ pnpm build:wasm && pnpm --filter web exec vitest run
 ✓ src/lib/grammar/grammar-text.wasm.test.ts (7 tests) 115ms
 ...
 Test Files  90 passed (90)
      Tests  1156 passed (1156)
   Start at  22:42:00
   Duration  4.95s (transform 3.03s, setup 3ms, collect 3.65s, tests 7.29s, environment 44.89s, prepare 13.91s)
```

### 4. Code Quality & Guardrails
```
$ pnpm check && pnpm lint && pnpm format:check && pnpm check:strings
svelte-check found 0 errors and 0 warnings
All 181 source files passed linting.
Checking formatting...
All matched files are use prettier code style!
check:strings: All checks passed.
```

### 5. Build and Size
```
$ pnpm build && pnpm size
✓ built in 1.25s
dist/assets/engine_wasm_bg-CS8gvYFB.wasm: 671.3 kB (gzip: 206.3 kB)
Within 250 KB limit.
```

### 6. Full Desktop & Phone E2E
```
$ pnpm test:e2e
Running 856 tests using 6 workers
  137 skipped
  719 passed (1.7m)
```

### 7. Cross-Browser E2E (WebKit)
```
$ pnpm --filter web exec playwright test --project=webkit-phone e2e/cross
Running 133 tests using 6 workers
  14 skipped
  119 passed (2.2m)
```
