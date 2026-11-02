# Report — T-014

> Written by the worker at the end of the session. One file per task; overwrite each session.

## Task
- id: T-014
- title: CNF phase 6 follows the course method (no shared helper variables by default)
- branch: `task/T-014-cnf-course-method`
- commits: `d4aec74`
- pull request: https://github.com/AldebaranHere/webtomata/pull/112
- CI run: https://github.com/AldebaranHere/webtomata/actions/runs/41423323507

## What changed
- `crates/engine-core/src/grammar/cnf.rs`:
  - Added `transform_with_options(grammar: &Grammar, share_helpers: bool) -> Result<CnfTransformationTrace, GrammarError>`.
  - Updated `transform(grammar: &Grammar)` to delegate to `transform_with_options(grammar, false)`.
  - Updated `phase6_binarize_long` with `share_helpers: bool`. When `false`, every long rule of length $n > 2$ receives its own cascade of $n - 2$ fresh helper variables without variable pair caching or cross-rule sharing. When `true`, variable pair deduplication (`pair_map`) is active as before.
- `crates/engine-core/src/api.rs`:
  - Updated `transform_to_cnf(grammar_text: &str, share_helpers: bool) -> String`.
- `crates/engine-core/src/ts.rs`:
  - Updated `sampleTransformToCnf` call to `api::transform_to_cnf("S -> a S b | a b", false)`.
- `crates/engine-wasm/src/lib.rs`:
  - Updated `transform_to_cnf(grammar: &str, share_helpers: Option<bool>) -> String`, defaulting to `false` when omitted or `None`.
  - Updated WASM envelope unit tests to test both default (`None`) and `Some(true)`.
- `web/src/lib/engine/protocol.ts`:
  - Updated `transformToCnf(grammar: string, shareHelpers?: boolean): EngineResult<CnfTransformationTrace>`.
- `web/src/lib/engine/handlers.ts`:
  - Updated `Wasm` interface and `createHandlers` implementation for `transformToCnf(grammar, shareHelpers = false)`.
- `web/src/lib/engine/handlers.test.ts`:
  - Added unit test coverage for `transformToCnf` with default parameters and with explicit `shareHelpers: true`.
- `crates/engine-core/tests/grammar.rs`:
  - AC1 check in `test_cnf_preset_start_long`: Verifies `S0` and `S` have separate helper variables on their RHS with default `false`, and identical helper variables when `share_helpers: true`.
  - AC2 check in `test_cnf_preset_shared_tail`: Verifies two distinct helper chains under default `false`, and a shared tail variable when `share_helpers: true`. Both versions are verified to maintain language equivalence via exhaustive CYK checks up to length 8.
  - AC3 test `test_cnf_slide_example_eliminating_long_rhs`: Verifies that the course slide example `A -> B C D E` produces exactly `A -> B M1`, `M1 -> C M2`, `M2 -> D E` (comparing structure and disjoint helper identities).
  - Updated `test_cnf_variable_deduplication_step6` to test both course default (no sharing: 3 separate helper rules deriving `A B`) and `share_helpers: true` (deduplication: exactly 1 rule `X -> A B` shared across `S0`, `A`, and `S`).

## Notes on Lecture Slide Comparison (Non-goals & Findings)
In `REFERENCES/PACIL-TBA/KKI-GANJIL-2526/Slide11 CFG2_19e01.pdf` (Page 23, "Example of Eliminating Mixed Productions"):
- The slide includes a note: `Note: since previously there has been rules A → a in G, then Ta can take A instead.`
- Current engine behavior in Phase 5 (`phase5_isolate_terminals` in `crates/engine-core/src/grammar/cnf.rs`): Phase 5 always allocates a new variable `T_a -> a` for each terminal appearing in rules of length $\ge 2$, regardless of whether a rule $A \to a$ already existed in the original grammar.
- In accordance with the non-goals of task T-014, Phase 5 terminal isolation logic was left unmodified; reported here for future planner review.

## Deliberate Breaks (AC4)

### Deliberate Break: Force `share_helpers: true` by default in `CnfTransformer::transform`
Temporarily altered `CnfTransformer::transform` to call `Self::transform_with_options(grammar, true)`:
```
   Compiling engine-core v0.0.0 (D:\dev\webtomata\crates\engine-core)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 1.67s
     Running tests\grammar.rs (target\debug\deps\grammar-199d0ea18dd40240.exe)

running 1 test

thread 'test_cnf_preset_start_long' (12424) panicked at crates\engine-core\tests\grammar.rs:194:5:
assertion `left != right` failed: Default course method must not share helper variables between S0 and S
  left: NonTerminal("X_1")
 right: NonTerminal("X_1")
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
test test_cnf_preset_start_long ... FAILED

failures:

failures:
    test_cnf_preset_start_long

test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 12 filtered out; finished in 0.00s

error: test failed, to rerun pass `-p engine-core --test grammar`
```
Code was restored to `Self::transform_with_options(grammar, false)`.

---

## Verification Outputs

### 1. `cargo fmt --check`
```
(exited 0 with no output)
```

### 2. `cargo clippy --all-targets -- -D warnings`
```
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.30s
```

### 3. `cargo test -p engine-core --test grammar`
```
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.25s
     Running tests\grammar.rs (target\debug\deps\grammar-199d0ea18dd40240.exe)

running 13 tests
test test_cnf_transformation_trace_6_phases ... ok
test test_cnf_slide_example_eliminating_long_rhs ... ok
test test_cyk_empty_string ... ok
test test_full_pipeline_cfg_to_cnf_to_cyk ... ok
test test_parse_arrow_variants_and_empty_symbols ... ok
test test_cyk_parser_on_cnf ... ok
test test_parse_simple_grammar ... ok
test test_cnf_variable_deduplication_step6 ... ok
test test_cnf_preset_order ... ok
test test_cnf_preset_unit_chain ... ok
test test_cnf_preset_start_long ... ok
test test_cnf_preset_nullable ... ok
test test_cnf_preset_shared_tail ... ok

test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 27.77s
```

### 4. `pnpm build:wasm`
```
$ wasm-pack build crates/engine-wasm --target web --release --out-dir ../../web/src/lib/engine/wasm && pnpm build:types
[INFO]: 🎯  Checking for the Wasm target...
[INFO]: 🌀  Compiling to Wasm...
   Compiling wasm-bindgen v0.2.129
   Compiling engine-wasm v0.0.0 (/mnt/d/dev/webtomata/crates/engine-wasm)
    Finished `release` profile [optimized] target(s) in 4.47s
[INFO]: ⬇️  Installing wasm-bindgen...
[INFO]: Optimizing wasm binaries with `wasm-opt`...
[INFO]: Optional fields missing from Cargo.toml: 'description', 'repository'. These are not necessary, but recommended
[INFO]: License key is set in Cargo.toml but no LICENSE file(s) were found; Please add the LICENSE file(s) to your project directory
[INFO]: ✨   Done in 28.63s
[INFO]: 📦   Your wasm pkg is ready to publish at web/src/lib/engine/wasm.
[WARN]: ⚠️   There's a newer version of wasm-pack available, the new version is: 0.15.1, you are using: 0.15.0. To update, navigate to: https://wasm-bindgen.github.io/wasm-pack/installer/
$ cargo test -p engine-core --features ts --test ts_export
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.29s
     Running tests\ts_export.rs (target\debug\deps\ts_export-8de845deb713870f.exe)

running 1 test
test the_types_match_the_json ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
```

### 5. `pnpm test:wasm`
```
$ wasm-pack test --node crates/engine-wasm
[INFO]: 🎯  Checking for the Wasm target...
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.60s
[INFO]: ⬇️  Installing wasm-bindgen...
    Finished `test` profile [unoptimized + debuginfo] target(s) in 2.27s
     Running unittests src/lib.rs (/mnt/d/dev/webtomata/target/wasm32-unknown-unknown/debug/deps/engine_wasm-b764f7b99cfd7388.wasm)
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

test result: ok. 9 passed; 0 failed; 0 ignored; 0 filtered out; finished in 0.09s

   Doc-tests engine_wasm

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

[WARN]: ⚠️   There's a newer version of wasm-pack available, the new version is: 0.15.1, you are using: 0.15.0. To update, navigate to: https://wasm-bindgen.github.io/wasm-pack/installer/
```

### 6. `pnpm --filter web test`
```
$ vitest run

 RUN  v5.0.3 D:/dev/webtomata/web

 ✓ src/lib/editor/compare.wasm.test.ts (6 tests) 511ms
   ✓ Bandingkan with the real engine (6)
     ✓ is right for random machines and random expressions: the verdict, the witness and both lists 361ms
 ✓ src/lib/editor/conversion.wasm.test.ts (49 tests) 672ms
 ✓ src/lib/editor/interaction/editor.test.ts (41 tests) 686ms
   ✓ add a state (7)
     ✓ says why when the document refuses (the limit of states) 621ms
 ✓ src/lib/questions/check.wasm.test.ts (27 tests) 551ms
 ✓ src/lib/editor/commands.test.ts (26 tests) 368ms
   ✓ states (10)
     ✓ refuses the 2001st state 332ms
 ✓ src/lib/editor/run.wasm.test.ts (29 tests) 230ms
 ✓ src/lib/share/link.test.ts (15 tests) 1377ms
   ✓ a link holds a machine (6)
     ✓ gives the same document back, for the sample and for many random documents 397ms
   ✓ a link that is not a machine fails calmly, and never throws (5)
     ✓ refuses a link that was cut or changed, and a random text 413ms
   ✓ a link that would expand to something huge is stopped while it is read (2)
     ✓ refuses a small link that inflates to far more than a document may hold 395ms
 ✓ src/lib/editor/regex-compile.wasm.test.ts (5 tests) 143ms
 ✓ src/lib/questions/load.test.ts (32 tests) 532ms
 ✓ src/lib/editor/regex-simplify.wasm.test.ts (6 tests) 230ms
 ✓ src/lib/editor/diagram/geometry.test.ts (37 tests) 1423ms
   ✓ the whole drawing (7)
     ✓ draws the worst case, 600 random edges across 200 states, in well under a second (96 ms measured) 628ms
   ✓ no two labels overlap, and no label covers a state (random machines on a grid) (1)
     ✓ holds for 300 random machines 483ms
 ✓ src/lib/share/open-file.wasm.test.ts (8 tests | 1 skipped) 24ms
 ✓ src/lib/share/files.wasm.test.ts (6 tests | 1 skipped) 127ms
 ✓ src/lib/editor/document.test.ts (32 tests) 192ms
 ✓ src/lib/engine/handlers.test.ts (14 tests) 36ms
 ✓ src/lib/questions/summaries.test.ts (10 tests) 106ms
 ✓ src/lib/questions/grade.wasm.test.ts (15 tests) 543ms
 ✓ src/lib/editor/regex-conversion.wasm.test.ts (4 tests) 98ms
 ✓ src/lib/engine/client.test.ts (30 tests) 32ms
 ✓ src/lib/editor/table.test.ts (22 tests) 55ms
 ✓ src/lib/editor/history.property.test.ts (7 tests) 1923ms
   ✓ random sequences of commands (6)
     ✓ keep every rule of the document after every step, and a refused command changes nothing 314ms
     ✓ a random walk of undo and redo always shows the document that was recorded for that step 663ms
     ✓ survive being saved and read back, and become a machine and back 333ms
   ✓ speed (1)
     ✓ moves a state of a document with 2,000 states 300 times in well under a second 440ms
 ✓ src/lib/i18n/i18n.test.ts (14 tests) 89ms
 ✓ src/lib/storage/autosave.tests-field.test.ts (9 tests) 45ms
 ✓ src/lib/storage/library.test.ts (21 tests) 39ms
 ✓ src/lib/storage/autosave.test.ts (12 tests) 28ms
 ✓ src/lib/editor/tester.test.ts (11 tests) 21ms
 ✓ src/lib/editor/interaction/editor.states.test.ts (17 tests) 18ms
 ✓ src/lib/editor/history.test.ts (20 tests) 15ms
 ✓ src/lib/questions/grade.test.ts (20 tests) 23ms
 ✓ src/lib/share/image.test.ts (10 tests) 28ms
 ✓ src/lib/editor/interaction/editor.edges.test.ts (15 tests) 18ms
 ✓ src/lib/editor/interaction/camera.test.ts (25 tests) 15ms
 ✓ src/lib/storage/example.test.ts (6 tests) 14ms
 ✓ src/lib/editor/layout-client.test.ts (9 tests) 14ms
 ✓ src/lib/editor/interaction/editor.link.test.ts (19 tests) 22ms
 ✓ src/lib/guides/load.test.ts (10 tests) 76ms
 ✓ src/lib/editor/conversion-text.test.ts (4 tests) 8ms
 ✓ src/lib/questions/answer.test.ts (7 tests) 12ms
 ✓ src/lib/share/open-file.test.ts (13 tests) 9ms
 ✓ src/lib/storage/question-work.test.ts (13 tests) 10ms
 ✓ src/lib/storage/autosave.progress.test.ts (8 tests) 12ms
 ✓ src/lib/questions/question.test.ts (4 tests) 65ms
 ✓ src/lib/editor/regex-compile.test.ts (15 tests) 12ms
 ✓ src/lib/editor/interaction/keys.test.ts (49 tests) 12ms
 ✓ src/lib/storage/tests-field.test.ts (7 tests) 9ms
 ✓ src/lib/storage/machines.test.ts (8 tests) 12ms
 ✓ src/lib/editor/regex-conversion.test.ts (13 tests) 7ms
 ✓ src/lib/examples/examples.test.ts (9 tests) 9ms
 ✓ src/lib/share/files.test.ts (11 tests) 9ms
 ✓ src/lib/editor/checker.test.ts (6 tests) 21ms
 ✓ src/lib/questions/feedback-text.test.ts (14 tests) 9ms
 ✓ src/lib/editor/interaction/menu.test.ts (4 tests) 16ms
 ✓ src/lib/storage/migrate.test.ts (9 tests) 12ms
 ✓ src/lib/editor/interaction/placement.test.ts (7 tests) 14ms
 ✓ src/lib/storage/progress.test.ts (13 tests) 11ms
 ✓ src/lib/editor/interaction/canvas.test.ts (12 tests) 11ms
 ✓ src/lib/editor/definition.test.ts (10 tests) 16ms
 ✓ src/lib/questions/list.test.ts (14 tests) 9ms
 ✓ src/lib/editor/run-text.test.ts (7 tests) 7ms
 ✓ src/lib/editor/compare.test.ts (11 tests) 12ms
 ✓ src/lib/editor/interaction/editor.apply.test.ts (7 tests) 12ms
 ✓ src/lib/editor/panel-width.test.ts (13 tests) 11ms
 ✓ src/lib/questions/machine.test.ts (13 tests) 8ms
 ✓ src/lib/editor/panel-height.test.ts (12 tests) 8ms
 ✓ src/lib/editor/panel-tab.test.ts (8 tests) 8ms
 ✓ src/lib/editor/test-list.test.ts (13 tests) 7ms
 ✓ src/lib/editor/tour.test.ts (8 tests) 8ms
 ✓ src/lib/editor/regex-simplify.test.ts (12 tests) 8ms
 ✓ src/lib/editor/interaction/selection.test.ts (11 tests) 7ms
 ✓ src/lib/language/language-math.test.ts (5 tests) 8ms
 ✓ src/lib/editor/checks.test.ts (7 tests) 6ms
 ✓ src/lib/editor/regex-math.test.ts (8 tests) 6ms
 ✓ src/lib/editor/interaction/label.test.ts (14 tests) 8ms
 ✓ src/lib/seo.test.ts (1 test) 7ms
 ✓ src/lib/storage/memory.test.ts (5 tests) 7ms
 ✓ src/lib/editor/table-grid.test.ts (4 tests) 3ms
 ✓ src/lib/grammar/presets.test.ts (3 tests) 3ms
 ✓ src/lib/guides/list.test.ts (3 tests) 4ms
 ✓ src/lib/questions/statement-fold.test.ts (4 tests) 4ms
 ✓ src/lib/engine/problem.test.ts (5 tests) 4ms
 ✓ src/lib/questions/feedback-view.test.ts (6 tests) 4ms
 ✓ src/lib/storage/titles.test.ts (3 tests) 3ms
 ✓ src/lib/examples/examples.wasm.test.ts (6 tests) 13ms
 ✓ src/lib/editor/document.wasm.test.ts (10 tests) 3218ms
   ✓ the rules for symbols are the rules of the engine (3)
     ✓ agree on every character of the Basic Multilingual Plane 2309ms
   ✓ a document becomes a machine that the engine accepts (5)
     ✓ is accepted at the limits of the engine 581ms
 ✓ src/lib/editor/layout.test.ts (16 tests) 3381ms
   ✓ placing the states (10)
     ✓ property: any machine of up to 40 states is placed inside the limits with no overlap 3192ms
 ✓ src/lib/editor/interaction/editor.property.test.ts (4 tests) 3641ms
   ✓ random sequences of actions in the editor (4)
     ✓ keep every rule after every step 3508ms
 ✓ src/lib/lint.test.ts (2 tests) 4639ms
   ✓ the lint rule for {@html} (2)
     ✓ refuses a component that shows text as markup 4607ms

 Test Files  88 passed (88)
      Tests  1120 passed | 2 skipped (1122)
   Start at  20:39:29
   Duration  6.03s (tests 59%, transform 29%, import 11%)
```

### 7. `pnpm check`
```
$ pnpm --filter web check
$ svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings
Loading svelte-check in workspace: d:\dev\webtomata\web
Getting Svelte diagnostics...

svelte-check found 0 errors and 0 warnings
```

### 8. `pnpm lint`
```
$ pnpm --filter web lint
$ eslint .
```
(exited 0)

### 9. `pnpm format:check`
```
$ pnpm --filter web format:check && cargo fmt --check
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!
```
