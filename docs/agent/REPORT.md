# Report — T-003

> Written by the worker at the end of the session. One file per task; overwrite each session.

## Task
- id: T-003
- title: Replace the four HW05 CNF presets with five original ones
- branch: `task/T-003-original-cnf-presets`
- commits: `d938e2a..4a32a3d`
- pull request: https://github.com/AldebaranHere/webtomata/pull/110
- CI run: https://github.com/AldebaranHere/webtomata/actions/runs/41413215417

## What changed
- `web/src/lib/grammar/presets.ts`: Replaced four presets (`CNF01`, `CNF03`, `CNF04`, `CNF05` referencing HW05 Fasilkom UI) with five original grammars (`CNF_ORDER`, `CNF_NULLABLE`, `CNF_START_LONG`, `CNF_UNIT_CHAIN`, `CNF_SHARED_TAIL`) with Indonesian titles and descriptions without any course/homework mentions.
- `web/src/lib/grammar/GrammarWorkstation.svelte`: Updated default `selectedId` state from `'CNF01'` to `'CNF_ORDER'`.
- `web/src/lib/grammar/presets.test.ts`: Added unit test validating presence of the 5 new presets, 4 preserved CFG presets, and absence of course/homework naming patterns.
- `crates/engine-core/tests/grammar.rs`: Replaced three `*_from_fasilkom_hw05` tests with five test suites corresponding to the new presets. Each test verifies strict CNF validity and tests all strings over the grammar's alphabet up to length 8 against the language oracle via CYK parsing. Structural checks are enforced for `CNF_ORDER` and `CNF_UNIT_CHAIN`.

## Verification of Course Independence (AC5)
Compared the five grammars with all HW05 documents in `REFERENCES/PACIL-TBA/`. None of the five grammars is equal to any HW05 problem grammar or a symbol-renaming thereof.

## Deliberate Breaks (AC6)

### Deliberate Break 1: Swap Phase 4a and 4b (`CNF_ORDER`)
Swapped reachability (4b) and productivity (4a) in `phase4_eliminate_useless`:
```
   Compiling engine-core v0.0.0 (D:\dev\webtomata\crates\engine-core)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 2.41s
     Running tests\grammar.rs (target\debug\deps\grammar-199d0ea18dd40240.exe)

running 1 test
test test_cnf_preset_order ... FAILED

failures:

---- test_cnf_preset_order stdout ----

thread 'test_cnf_preset_order' (19136) panicked at crates\engine-core\tests\grammar.rs:124:5:
assertion `left == right` failed: CNF_ORDER should end with exactly 1 rule
  left: 2
 right: 1
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace

failures:
    test_cnf_preset_order

test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 11 filtered out; finished in 0.00s
```

### Deliberate Break 2: Skip Phase 4b (`CNF_UNIT_CHAIN`)
Skipped reachability filtering in `phase4_eliminate_useless`:
```
   Compiling engine-core v0.0.0 (D:\dev\webtomata\crates\engine-core)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 2.34s
     Running tests\grammar.rs (target\debug\deps\grammar-199d0ea18dd40240.exe)

running 1 test
test test_cnf_preset_unit_chain ... FAILED

failures:

---- test_cnf_preset_unit_chain stdout ----

thread 'test_cnf_preset_unit_chain' (7568) panicked at crates\engine-core\tests\grammar.rs:209:5:
A should be eliminated
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace

failures:
    test_cnf_preset_unit_chain

test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 11 filtered out; finished in 0.00s
```

## Verification (paste real output, do not summarize)

### 1. cargo fmt --check
```
$ cargo fmt --check
(exited 0 with no output)
```

### 2. cargo clippy --all-targets -- -D warnings
```
$ cargo clippy --all-targets -- -D warnings
    Checking engine-core v0.0.0 (D:\dev\webtomata\crates\engine-core)
    Checking engine-wasm v0.0.0 (D:\dev\webtomata\crates\engine-wasm)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 6.49s
```

### 3. cargo test -p engine-core --test grammar
```
$ cargo test -p engine-core --test grammar
   Compiling engine-core v0.0.0 (D:\dev\webtomata\crates\engine-core)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 1.21s
     Running tests\grammar.rs (target\debug\deps\grammar-199d0ea18dd40240.exe)

running 12 tests
test test_cyk_parser_on_cnf ... ok
test test_cnf_transformation_trace_6_phases ... ok
test test_full_pipeline_cfg_to_cnf_to_cyk ... ok
test test_parse_arrow_variants_and_empty_symbols ... ok
test test_parse_simple_grammar ... ok
test test_cnf_variable_deduplication_step6 ... ok
test test_cyk_empty_string ... ok
test test_cnf_preset_order ... ok
test test_cnf_preset_unit_chain ... ok
test test_cnf_preset_start_long ... ok
test test_cnf_preset_nullable ... ok
test test_cnf_preset_shared_tail ... ok

test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 20.54s
```

### 4. pnpm --filter web test
```
$ pnpm --filter web test
$ vitest run

 RUN  v5.0.3 D:/dev/webtomata/web

 ✓ src/lib/editor/conversion.wasm.test.ts (49 tests) 684ms
 ✓ src/lib/questions/check.wasm.test.ts (27 tests) 549ms
 ✓ src/lib/editor/interaction/editor.test.ts (41 tests) 661ms
 ✓ src/lib/editor/diagram/geometry.test.ts (37 tests) 979ms
 ✓ src/lib/share/link.test.ts (15 tests) 1125ms
 ✓ src/lib/questions/grade.wasm.test.ts (15 tests) 521ms
 ✓ src/lib/editor/compare.wasm.test.ts (6 tests) 327ms
 ✓ src/lib/editor/regex-compile.wasm.test.ts (5 tests) 242ms
 ✓ src/lib/share/files.wasm.test.ts (6 tests | 1 skipped) 110ms
 ✓ src/lib/editor/commands.test.ts (26 tests) 632ms
 ✓ src/lib/editor/regex-simplify.wasm.test.ts (6 tests) 317ms
 ✓ src/lib/editor/regex-conversion.wasm.test.ts (4 tests) 107ms
 ✓ src/lib/questions/summaries.test.ts (10 tests) 56ms
 ✓ src/lib/editor/document.test.ts (32 tests) 143ms
 ✓ src/lib/share/open-file.wasm.test.ts (8 tests | 1 skipped) 20ms
 ✓ src/lib/engine/handlers.test.ts (14 tests) 39ms
 ✓ src/lib/i18n/i18n.test.ts (14 tests) 47ms
 ✓ src/lib/questions/load.test.ts (32 tests) 457ms
 ✓ src/lib/editor/table.test.ts (22 tests) 35ms
 ✓ src/lib/editor/history.property.test.ts (7 tests) 1769ms
 ✓ src/lib/editor/run.wasm.test.ts (29 tests) 106ms
 ✓ src/lib/storage/autosave.tests-field.test.ts (9 tests) 71ms
 ✓ src/lib/engine/client.test.ts (30 tests) 32ms
 ✓ src/lib/storage/autosave.test.ts (12 tests) 22ms
 ✓ src/lib/share/image.test.ts (10 tests) 17ms
 ✓ src/lib/editor/interaction/editor.link.test.ts (19 tests) 24ms
 ✓ src/lib/questions/grade.test.ts (20 tests) 16ms
 ✓ src/lib/questions/question.test.ts (4 tests) 17ms
 ✓ src/lib/editor/interaction/camera.test.ts (25 tests) 12ms
 ✓ src/lib/storage/library.test.ts (21 tests) 34ms
 ✓ src/lib/editor/history.test.ts (20 tests) 12ms
 ✓ src/lib/editor/checker.test.ts (6 tests) 9ms
 ✓ src/lib/editor/interaction/editor.edges.test.ts (15 tests) 13ms
 ✓ src/lib/editor/tester.test.ts (11 tests) 21ms
 ✓ src/lib/editor/interaction/editor.states.test.ts (17 tests) 12ms
 ✓ src/lib/storage/progress.test.ts (13 tests) 7ms
 ✓ src/lib/storage/question-work.test.ts (13 tests) 13ms
 ✓ src/lib/editor/regex-compile.test.ts (15 tests) 10ms
 ✓ src/lib/examples/examples.test.ts (9 tests) 6ms
 ✓ src/lib/examples/examples.wasm.test.ts (6 tests) 7ms
 ✓ src/lib/storage/example.test.ts (6 tests) 16ms
 ✓ src/lib/editor/regex-conversion.test.ts (13 tests) 10ms
 ✓ src/lib/storage/machines.test.ts (8 tests) 6ms
 ✓ src/lib/share/files.test.ts (11 tests) 10ms
 ✓ src/lib/storage/autosave.progress.test.ts (8 tests) 29ms
 ✓ src/lib/share/open-file.test.ts (13 tests) 20ms
 ✓ src/lib/guides/load.test.ts (10 tests) 114ms
 ✓ src/lib/editor/conversion-text.test.ts (4 tests) 20ms
 ✓ src/lib/editor/interaction/keys.test.ts (49 tests) 33ms
 ✓ src/lib/questions/answer.test.ts (7 tests) 38ms
 ✓ src/lib/questions/machine.test.ts (13 tests) 19ms
 ✓ src/lib/questions/feedback-text.test.ts (14 tests) 23ms
 ✓ src/lib/editor/compare.test.ts (11 tests) 12ms
 ✓ src/lib/editor/layout-client.test.ts (9 tests) 30ms
 ✓ src/lib/questions/list.test.ts (14 tests) 13ms
 ✓ src/lib/editor/interaction/label.test.ts (14 tests) 13ms
 ✓ src/lib/editor/interaction/editor.apply.test.ts (7 tests) 11ms
 ✓ src/lib/editor/test-list.test.ts (13 tests) 13ms
 ✓ src/lib/editor/checks.test.ts (7 tests) 11ms
 ✓ src/lib/editor/regex-simplify.test.ts (12 tests) 12ms
 ✓ src/lib/editor/interaction/selection.test.ts (11 tests) 15ms
 ✓ src/lib/storage/tests-field.test.ts (7 tests) 15ms
 ✓ src/lib/editor/panel-tab.test.ts (8 tests) 11ms
 ✓ src/lib/editor/tour.test.ts (8 tests) 15ms
 ✓ src/lib/editor/panel-width.test.ts (13 tests) 15ms
 ✓ src/lib/editor/interaction/placement.test.ts (7 tests) 6ms
 ✓ src/lib/editor/interaction/canvas.test.ts (12 tests) 8ms
 ✓ src/lib/editor/definition.test.ts (10 tests) 9ms
 ✓ src/lib/grammar/presets.test.ts (3 tests) 3ms
 ✓ src/lib/storage/migrate.test.ts (9 tests) 14ms
 ✓ src/lib/questions/feedback-view.test.ts (6 tests) 7ms
 ✓ src/lib/engine/problem.test.ts (5 tests) 6ms
 ✓ src/lib/editor/run-text.test.ts (7 tests) 11ms
 ✓ src/lib/editor/document.wasm.test.ts (10 tests) 3114ms
 ✓ src/lib/questions/statement.test.ts (12 tests) 13ms
 ✓ src/lib/language/language-math.test.ts (5 tests) 6ms
 ✓ src/lib/questions/statement-fold.test.ts (4 tests) 3ms
 ✓ src/lib/editor/panel-height.test.ts (12 tests) 12ms
 ✓ src/lib/editor/interaction/menu.test.ts (4 tests) 4ms
 ✓ src/lib/editor/regex-math.test.ts (8 tests) 8ms
 ✓ src/lib/editor/table-grid.test.ts (4 tests) 3ms
 ✓ src/lib/storage/memory.test.ts (5 tests) 3ms
 ✓ src/lib/guides/list.test.ts (3 tests) 9ms
 ✓ src/lib/seo.test.ts (1 test) 1ms
 ✓ src/lib/storage/titles.test.ts (3 tests) 2ms
 ✓ src/lib/editor/layout.test.ts (16 tests) 3243ms
 ✓ src/lib/editor/interaction/editor.property.test.ts (4 tests) 4015ms
 ✓ src/lib/lint.test.ts (2 tests) 4808ms

 Test Files  88 passed (88)
      Tests  1120 passed | 2 skipped (1122)
   Start at  19:20:50
   Duration  5.72s (tests 62%, transform 28%, import 10%)
```

### 5. pnpm check
```
$ pnpm check
$ pnpm --filter web check
$ svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings
Loading svelte-check in workspace: d:\dev\webtomata\web
Getting Svelte diagnostics...

svelte-check found 0 errors and 0 warnings
```

### 6. pnpm lint
```
$ pnpm lint
$ pnpm --filter web lint
$ eslint .
(exited 0 with no errors)
```

### 7. pnpm format:check
```
$ pnpm format:check
$ pnpm --filter web format:check && cargo fmt --check
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!
```

### 8. pnpm check:strings
```
$ pnpm check:strings
$ node tools/check-strings.mjs
ok   62 components have no hard-coded text
```

### 9. pnpm check:tokens
```
$ pnpm check:tokens
$ node tools/check-tokens-usage.mjs
ok   64 files use no raw colors
```

### 10. Check no HW05 occurrence in touched areas
```
$ git grep -i "hw05" crates/ web/src/lib/grammar/
(exited 1 with no output)
```

## Deviations from plan
None.

## Defects raised
None.

## Follow-ups logged
None.
