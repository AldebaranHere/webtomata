# Verification output

## Format
```
$ pnpm --filter web format:check && cargo fmt --check
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!
```

## Svelte check
```
$ svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings
Loading svelte-check in workspace: d:\dev\webtomata\web
Getting Svelte diagnostics...

svelte-check found 0 errors and 0 warnings
```

## Lint
```
$ eslint .
```

## Unit tests
```
$ vitest run

 RUN  v5.0.3 D:/dev/webtomata/web

 ✓ src/lib/editor/conversion.wasm.test.ts (49 tests) 534ms
 ✓ src/lib/editor/compare.wasm.test.ts (6 tests) 459ms
   ✓ Bandingkan with the real engine (6)
     ✓ is right for random machines and random expressions: the verdict, the witness and both lists 355ms
 ✓ src/lib/editor/commands.test.ts (26 tests) 300ms
 ✓ src/lib/editor/interaction/editor.test.ts (41 tests) 650ms
   ✓ add a state (7)
     ✓ says why when the document refuses (the limit of states) 586ms
 ✓ src/lib/editor/diagram/geometry.test.ts (37 tests) 951ms
   ✓ the whole drawing (7)
     ✓ draws the worst case, 600 random edges across 200 states, in well under a second (96 ms measured) 584ms
 ✓ src/lib/questions/load.test.ts (32 tests) 272ms
 ✓ src/lib/editor/document.test.ts (32 tests) 115ms
 ✓ src/lib/questions/grade.wasm.test.ts (15 tests) 446ms
 ✓ src/lib/share/link.test.ts (15 tests) 1191ms
   ✓ a link that is not a machine fails calmly, and never throws (5)
     ✓ refuses a link that was cut or changed, and a random text 400ms
   ✓ a link that would expand to something huge is stopped while it is read (2)
     ✓ refuses a small link that inflates to far more than a document may hold 418ms
 ✓ src/lib/editor/run.wasm.test.ts (29 tests) 126ms
 ✓ src/lib/editor/regex-conversion.wasm.test.ts (4 tests) 101ms
 ✓ src/lib/editor/regex-simplify.wasm.test.ts (6 tests) 304ms
 ✓ src/lib/engine/handlers.test.ts (14 tests) 79ms
 ✓ src/lib/share/open-file.wasm.test.ts (8 tests | 1 skipped) 20ms
 ✓ src/lib/share/files.wasm.test.ts (6 tests | 1 skipped) 216ms
 ✓ src/lib/editor/regex-compile.wasm.test.ts (5 tests) 75ms
 ✓ src/lib/questions/summaries.test.ts (10 tests) 68ms
 ✓ src/lib/editor/table.test.ts (22 tests) 26ms
 ✓ src/lib/i18n/i18n.test.ts (14 tests) 82ms
 ✓ src/lib/editor/history.property.test.ts (7 tests) 1554ms
   ✓ random sequences of commands (6)
     ✓ a random walk of undo and redo always shows the document that was recorded for that step 603ms
   ✓ speed (1)
     ✓ moves a state of a document with 2,000 states 300 times in well under a second 446ms
 ✓ src/lib/storage/autosave.tests-field.test.ts (9 tests) 42ms
 ✓ src/lib/engine/client.test.ts (30 tests) 24ms
 ✓ src/lib/questions/check.wasm.test.ts (27 tests) 373ms
 ✓ src/lib/editor/tester.test.ts (11 tests) 12ms
 ✓ src/lib/share/image.test.ts (10 tests) 15ms
 ✓ src/lib/editor/checker.test.ts (6 tests) 9ms
 ✓ src/lib/questions/grade.test.ts (20 tests) 22ms
 ✓ src/lib/storage/autosave.test.ts (12 tests) 32ms
 ✓ src/lib/storage/library.test.ts (21 tests) 42ms
 ✓ src/lib/editor/interaction/editor.states.test.ts (17 tests) 15ms
 ✓ src/lib/storage/autosave.progress.test.ts (8 tests) 9ms
 ✓ src/lib/questions/question.test.ts (4 tests) 20ms
 ✓ src/lib/editor/history.test.ts (20 tests) 12ms
 ✓ src/lib/editor/interaction/editor.link.test.ts (19 tests) 11ms
 ✓ src/lib/editor/interaction/camera.test.ts (25 tests) 17ms
 ✓ src/lib/editor/interaction/editor.edges.test.ts (15 tests) 13ms
 ✓ src/lib/questions/answer.test.ts (7 tests) 17ms
 ✓ src/lib/storage/example.test.ts (6 tests) 8ms
 ✓ src/lib/editor/conversion-text.test.ts (4 tests) 11ms
 ✓ src/lib/editor/regex-compile.test.ts (15 tests) 15ms
 ✓ src/lib/storage/machines.test.ts (8 tests) 8ms
 ✓ src/lib/editor/interaction/keys.test.ts (49 tests) 8ms
 ✓ src/lib/editor/interaction/label.test.ts (14 tests) 9ms
 ✓ src/lib/storage/question-work.test.ts (13 tests) 7ms
 ✓ src/lib/editor/regex-conversion.test.ts (13 tests) 3ms
 ✓ src/lib/editor/checks.test.ts (7 tests) 4ms
 ✓ src/lib/questions/feedback-text.test.ts (14 tests) 5ms
 ✓ src/lib/examples/examples.wasm.test.ts (6 tests) 7ms
 ✓ src/lib/guides/load.test.ts (10 tests) 44ms
 ✓ src/lib/editor/compare.test.ts (11 tests) 5ms
 ✓ src/lib/questions/list.test.ts (14 tests) 4ms
 ✓ src/lib/share/open-file.test.ts (13 tests) 11ms
 ✓ src/lib/examples/examples.test.ts (9 tests) 6ms
 ✓ src/lib/editor/panel-height.test.ts (12 tests) 6ms
 ✓ src/lib/questions/machine.test.ts (13 tests) 6ms
 ✓ src/lib/storage/migrate.test.ts (9 tests) 4ms
 ✓ src/lib/editor/layout-client.test.ts (9 tests) 12ms
 ✓ src/lib/editor/interaction/canvas.test.ts (12 tests) 5ms
 ✓ src/lib/editor/interaction/selection.test.ts (11 tests) 6ms
 ✓ src/lib/editor/tour.test.ts (8 tests) 8ms
 ✓ src/lib/share/files.test.ts (11 tests) 7ms
 ✓ src/lib/questions/statement.test.ts (12 tests) 3ms
 ✓ src/lib/editor/regex-simplify.test.ts (12 tests) 7ms
 ✓ src/lib/editor/interaction/placement.test.ts (7 tests) 4ms
 ✓ src/lib/editor/panel-tab.test.ts (8 tests) 4ms
 ✓ src/lib/editor/interaction/editor.apply.test.ts (7 tests) 4ms
 ✓ src/lib/editor/definition.test.ts (10 tests) 5ms
 ✓ src/lib/storage/tests-field.test.ts (7 tests) 5ms
 ✓ src/lib/storage/progress.test.ts (13 tests) 4ms
 ✓ src/lib/questions/feedback-view.test.ts (6 tests) 4ms
 ✓ src/lib/editor/table-grid.test.ts (4 tests) 1ms
 ✓ src/lib/editor/test-list.test.ts (13 tests) 7ms
 ✓ src/lib/editor/regex-math.test.ts (8 tests) 3ms
 ✓ src/lib/storage/memory.test.ts (5 tests) 3ms
 ✓ src/lib/editor/run-text.test.ts (7 tests) 6ms
 ✓ src/lib/language/language-math.test.ts (5 tests) 4ms
 ✓ src/lib/seo.test.ts (1 test) 1ms
 ✓ src/lib/guides/list.test.ts (3 tests) 3ms
 ✓ src/lib/editor/panel-width.test.ts (13 tests) 6ms
 ✓ src/lib/engine/problem.test.ts (5 tests) 2ms
 ✓ src/lib/editor/interaction/menu.test.ts (4 tests) 2ms
 ✓ src/lib/questions/statement-fold.test.ts (4 tests) 2ms
 ✓ src/lib/storage/titles.test.ts (3 tests) 1ms
 ✓ src/lib/editor/document.wasm.test.ts (10 tests) 2517ms
   ✓ the rules for symbols are the rules of the engine (3)
     ✓ agree on every character of the Basic Multilingual Plane 1877ms
   ✓ a document becomes a machine that the engine accepts (5)
     ✓ is accepted at the limits of the engine 447ms
 ✓ src/lib/editor/layout.test.ts (16 tests) 2418ms
   ✓ placing the states (10)
     ✓ property: any machine of up to 40 states is placed inside the limits with no overlap 2275ms
 ✓ src/lib/editor/interaction/editor.property.test.ts (4 tests) 2535ms
   ✓ random sequences of actions in the editor (4)
     ✓ keep every rule after every step 2404ms
 ✓ src/lib/lint.test.ts (2 tests) 3557ms
   ✓ the lint rule for {@html} (2)
     ✓ refuses a component that shows text as markup 3499ms

 Test Files  87 passed (87)
      Tests  1117 passed | 2 skipped (1119)
   Start at  12:39:32
   Duration  4.15s (tests 65%, transform 24%, import 10%)

```

## Node tests (tools/)
```
✔ the WCAG ratio of known colors (3.706ms)
✔ the ratio does not depend on the order, and short colors work (0.674ms)
✔ a color that is not a color is an error (1.2863ms)
✔ tokens are read from custom properties, and var() is followed (1.1863ms)
✔ a loop of var() is an error and not a hang (0.6378ms)
✔ a pair that passes, and a pair that fails, are told apart (2.3853ms)
✔ a pair that names a token that does not exist is a failure (1.2355ms)
✔ every pair in the list names two tokens and a known level (0.738ms)
✔ a color token that no pair checks is found (1.2491ms)
✔ the real tokens.css passes every pair, and every color token is checked (3.6611ms)
✔ a response with all required security headers and strict CSP passes (3.6591ms)
✔ each missing or weakened security header fails its check (2.823ms)
✔ unsafe-inline or unsafe-eval in CSP header or meta CSP fails (0.5808ms)
✔ missing wasm-unsafe-eval, script sha256, style-src-attr single hash, or default-src self fails (0.5871ms)
✔ web/static/_headers defines the four response headers and frame-ancestors none (1.3752ms)
▶ the shape of the files (--schema-only, no engine)
  ✔ an empty folder is fine (52.7673ms)
  ✔ a good file passes, and files that are not questions are skipped (48.4858ms)
  ✔ a field with a problem is named, with its file and line (22.476ms)
  ✔ a mistake in the YAML is reported at its line (18.3211ms)
  ✔ the id must be the name of the file (16.6418ms)
  ✔ a file of more than 64 KB is not read (14.5214ms)
  ✔ every file is reported, not only the first with a problem (20.3501ms)
✔ the shape of the files (--schema-only, no engine) (195.8042ms)
▶ the checks with the engine
  ✔ a sound question passes (46.8405ms)
  ✔ an example that the solution gets wrong is a problem (16.527ms)
  ✔ a solution with a missing transition is a problem, by the name of the state (14.9259ms)
  ✔ --report lists the first strings that the solution accepts (19.2055ms)
  ✔ the engine is needed, and the error says how to get it (15.295ms)
✔ the checks with the engine (113.6146ms)
▶ the command
  ✔ exits 0 for good files and 1 for a broken one, as CI needs (459.9936ms)
  ✔ runs the TypeScript of the site directly, with no warning or crash (212.9239ms)
✔ the command (673.1227ms)
✔ a build within all budgets and with dagre isolated in the layout worker passes (22.4713ms)
✔ fails when a route exceeds the initial JS gzip budget (15.9151ms)
✔ fails when the layout library marker appears in initial page JS (12.437ms)
✔ fails when the layout worker is missing from the build (11ms)
✔ fails when the layout worker or .wasm file exceeds its gzip budget (36.5098ms)
✔ accepts markup whose text comes from messages (25.7029ms)
✔ refuses literal text in an element (1.7926ms)
✔ refuses literal text next to an expression, in blocks and in the head (7.6705ms)
✔ refuses a literal in the attributes that users read (4.38ms)
✔ refuses a string literal inside braces (1.2271ms)
✔ allows text without letters: symbols, numbers and punctuation (2.1233ms)
✔ allows attributes that are not for people to read (0.8107ms)
✔ does not read the script or the style (1.4509ms)
✔ reports the line of the text (0.9779ms)
✔ a component that uses tokens has no problems (5.7031ms)
✔ a raw color in a style block is a problem (1.8414ms)
✔ transparent, currentColor and inherit are allowed (0.4009ms)
✔ a raw color in an inline style or an SVG attribute is a problem (0.4545ms)
✔ an anchor or an entity that looks like a hex color is not a problem (0.4186ms)
✔ a color in a comment is not a problem (0.4877ms)
✔ a plain css file is checked, and tokens.css is the one place for raw colors (0.3908ms)
✔ colors that are not for text cannot be used as the text color (0.7123ms)
✔ the problem says the file and the line (0.5806ms)
✔ the real components of the app use no raw colors (41.9849ms)
✔ a workflow that follows the rules has no problems (7.7482ms)
✔ a secret in the build job is a problem (1.0351ms)
✔ a secret in the verify job is a problem (0.6828ms)
✔ a secret in another workflow file is a problem, even in a job named deploy (0.6302ms)
✔ the word secrets in a comment is not a problem (0.5557ms)
✔ an action that is not pinned to a full commit is a problem (2.8657ms)
✔ a local action is allowed without a pin (0.5925ms)
✔ pull_request_target is a problem (0.5199ms)
✔ the deploy job must install without running scripts (0.7941ms)
✔ the deploy job runs no build code (1.2784ms)
✔ every problem is listed, with the file and the job (1.0087ms)
✔ the real workflows of this repository follow the rules (6.1042ms)
✔ a job without timeout-minutes is a problem: a stalled step must not run for six hours (0.9269ms)
✔ a timeout of one job does not cover the next job (0.6635ms)
✔ a timeout that is not a number is a problem (0.4218ms)
✔ a timeout of more than 30 minutes is a problem: CI must not hang for long (0.6045ms)
✔ a gate job web that waits for every other job, and runs always, has no problems (0.6807ms)
✔ a job that the gate does not wait for is a problem, so that a new job cannot be left out (0.4364ms)
✔ the job rust does not have to be in the needs of the gate: it is required by itself (0.428ms)
✔ a gate without if: always() is a problem: a skipped required check counts as passed (0.4431ms)
✔ a ci.yml without the gate job web is a problem (0.6354ms)
✔ the gate is only asked of ci.yml (0.2676ms)
✔ actions: write is a problem in any workflow but cleanup-caches.yml (0.2316ms)
✔ actions: write is allowed in cleanup-caches.yml (0.2367ms)
✔ contents: write is a problem everywhere (1.6729ms)
✔ a runner with a -latest label is a problem: the runner image is pinned (0.777ms)
✔ a pinned runner is not a problem (0.3957ms)
✔ read rights are not a problem (0.7839ms)
﹣ nothing is installed when Playwright says that nothing is missing (4.1499ms) # SKIP
﹣ what is missing is installed, once, without the recommended packages (0.4134ms) # SKIP
﹣ a slow try is given up, and the next one uses the main Ubuntu archive (0.3112ms) # SKIP
﹣ the index of the packages is updated before each try (0.6129ms) # SKIP
﹣ when every try is slow it fails, after three tries, and does not hang (0.3497ms) # SKIP
﹣ an apt that ignores the polite stop is killed after a short wait (0.3061ms) # SKIP
﹣ repairs dpkg before retrying when a try fails (0.2511ms) # SKIP
✔ serves index.html at /, soal.html at /soal even when soal/ exists, and 404 for a missing route (109.7311ms)
✔ refuses path traversal and sibling folders whose name starts with the build folder name (23.0336ms)
✔ a page that shows the engine version and reports nothing passes (2.7326ms)
✔ a version that never appeared fails (0.5819ms)
✔ a version with three numbers passes, with a suffix too (0.2478ms)
✔ a console error, an exception, a failed request and a bad response each fail (0.4833ms)
✔ every problem is listed, with what it was (0.4568ms)
✔ a request that the page itself canceled is not a failure (0.2307ms)
✔ a promise that is fast enough gives its value (16.7492ms)
✔ a promise that is too slow fails with the name and the time (32.4835ms)
✔ the error of a promise that is fast enough is its own error (1.2578ms)
✔ a promise that was given up and fails later does not crash the process (44.6652ms)
✔ the timer is cleared, so a fast promise does not keep the process open (0.7551ms)
✔ retrying gives the value of the first try that works, without a second try (0.4735ms)
✔ retrying tries again after a failure, and says what failed and which try it was (1.4301ms)
✔ retrying gives up after the last try, with the last error (0.574ms)
✔ retrying does not run onFail after the last try (0.5355ms)
ℹ tests 105
ℹ suites 3
ℹ pass 98
ℹ fail 0
ℹ cancelled 0
ℹ skipped 7
ℹ todo 0
ℹ duration_ms 1372.9631
```

## Workflow guard rails
```
ok   6 workflows follow the guard rails
```

## Contrast guard rails
```
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

## Token usage
```
ok   64 files use no raw colors
```

## Strings
```
ok   62 components have no hard-coded text
```

## Questions
```
ok   4 question(s) in content/questions
```

## Rust engine tests
```
test an_exponential_machine_stops_at_the_state_limit ... ok
test the_dfsm_accepts_exactly_what_the_original_accepts ... ok
test small_budgets_never_panic_and_are_respected ... ok
test the_result_is_a_valid_complete_dfsm_and_the_trace_matches_it ... ok

test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.11s

     Running tests\differential.rs (target\debug\deps\differential-e4b359c17376639d.exe)

running 12 tests
test machines_with_one_symbol_or_none_work_in_every_operation ... ok
test minimize_matches_automata_lib ... ok
test determinize_matches_automata_lib ... ok
test the_acceptor_written_here_agrees_with_simulate_and_with_the_package ... ok
test xor_matches_automata_lib ... ok
test equivalence_matches_automata_lib ... ok
test complement_matches_automata_lib_and_every_word ... ok
test intersection_matches_automata_lib_and_every_word ... ok
test xor_matches_every_word ... ok
test union_matches_automata_lib_and_every_word ... ok
test the_corner_machines_give_the_right_language_in_every_operation ... ok
test regex_to_fsm_matches_automata_lib_the_matcher_and_every_word ... ok

test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 8.07s

     Running tests\equivalence.rs (target\debug\deps\equivalence-052ad36215929b93.exe)

running 16 tests
test complete_lists_when_the_limits_are_large_enough ... ok
test a_star_against_a_star_b_star_has_the_witness_b ... ok
test both_machines_need_a_start_state ... ok
test even_against_odd_has_the_empty_string_as_witness ... ok
test an_ndfsm_equals_its_determinization ... ok
test machines_for_the_same_language_are_equivalent ... ok
test the_alphabets_must_have_the_same_symbols ... ok
test the_visit_budget_cuts_the_lists_but_not_the_witness ... ok
test the_witness_is_the_first_of_the_shortest_strings ... ok
test a_machine_equals_itself_its_determinization_and_its_minimization ... ok
test too_many_pairs_stops_the_search ... ok
test small_budgets_never_panic ... ok
test every_reported_string_really_tells_the_machines_apart ... ok
test complete_lists_match_brute_force ... ok
test nothing_shorter_than_the_witness_tells_the_machines_apart ... ok
test swapping_the_machines_swaps_the_direction ... ok

test result: ok. 16 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 2.61s

     Running tests\fsm_json.rs (target\debug\deps\fsm_json-e56003a2e820edcf.exe)

running 20 tests
test invalid_symbols_are_rejected ... ok
test deeply_nested_input_is_rejected_not_crashed ... ok
test invalid_but_expressible_machines_still_load ... ok
test duplicate_states_are_rejected ... ok
test multi_character_symbols_are_interned ... ok
test ndfsm_epsilon_transition_uses_null ... ok
test input_over_one_mebibyte_is_rejected_before_parsing ... ok
test machine_without_start_state_is_representable ... ok
test duplicate_symbol_is_rejected ... ok
test dfsm_round_trips_to_identical_json ... ok
test not_json_is_json_invalid_with_position ... ok
test output_is_sorted_whatever_the_input_order ... ok
test symbol_length_limit_is_32_characters ... ok
test references_to_missing_states_and_symbols_are_rejected ... ok
test unsupported_schema_versions_report_the_version ... ok
test wrong_shape_is_invalid_structure ... ok
test too_many_states_symbols_and_transitions_are_rejected ... ok
test mutated_valid_json_never_panics ... ok
test arbitrary_text_never_panics ... ok
test random_machines_round_trip ... ok

test result: ok. 20 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.07s

     Running tests\fsm_regex.rs (target\debug\deps\fsm_regex-aebea551f8fe9a9d.exe)

running 16 tests
test a_machine_without_a_start_state_cannot_be_converted ... ok
test a_label_that_grows_too_big_stops_the_run ... ok
test even_length_gives_the_expression_of_rich_example_6_3 ... ok
test one_state_with_a_loop_gives_a_star ... ok
test epsilon_transitions_are_labels_too ... ok
test no_accepting_state_gives_the_empty_set ... ok
test one_state_without_transitions_gives_epsilon ... ok
test rich_example_6_7_removes_states_3_2_1 ... ok
test the_result_for_example_6_7_equals_the_expression_in_the_slides ... ok
test too_many_label_updates_stop_the_run ... ok
test too_many_steps_stops_with_the_trace_so_far ... ok
test unreachable_states_are_removed_first ... ok
test regex_to_ndfsm_to_regex_keeps_the_language ... ok
test the_result_is_simplified_and_states_are_removed_highest_first ... ok
test small_budgets_never_panic_and_are_respected ... ok
test a_random_machine_and_its_expression_accept_the_same_strings ... ok

test result: ok. 16 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.56s

     Running tests\grammar.rs (target\debug\deps\grammar-a3d99bd9ae7d2d5e.exe)

running 10 tests
test test_cyk_parser_on_cnf ... ok
test test_cyk_empty_string ... ok
test test_cnf_variable_deduplication_step6 ... ok
test test_full_pipeline_cfg_to_cnf_to_cyk ... ok
test test_cnf_transformation_trace_6_phases ... ok
test test_parse_simple_grammar ... ok
test test_parse_arrow_variants_and_empty_symbols ... ok
test test_cnf01_from_fasilkom_hw05 ... ok
test test_cnf04_from_fasilkom_hw05 ... ok
test test_cnf05_from_fasilkom_hw05 ... ok

test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests\jff.rs (target\debug\deps\jff-7bbe08d2887df277.exe)

running 22 tests
test an_empty_read_element_is_an_epsilon_transition ... ok
test export_writes_plain_xml_in_a_fixed_order ... ok
test a_file_without_an_initial_state_still_loads ... ok
test a_file_written_by_jflap_is_read_into_a_machine_with_names_and_positions ... ok
test a_label_with_several_characters_reads_them_one_after_the_other ... ok
test a_long_label_on_a_loop_works_too ... ok
test export_uses_the_given_names_and_positions_and_escapes_text ... ok
test a_dtd_is_refused_so_entity_attacks_cannot_work ... ok
test a_file_with_the_wrong_shape_names_the_element ... ok
test only_finite_automata_are_supported ... ok
test problems_in_the_machine_itself_reuse_the_machine_messages ... ok
test new_states_for_long_labels_get_ids_after_the_highest_one ... ok
test symbols_with_several_characters_cannot_be_exported ... ok
test text_that_is_not_xml_is_reported_with_its_position ... ok
test state_ids_can_be_sparse_and_names_are_kept ... ok
test the_kind_follows_the_structure_of_the_transitions ... ok
test xml_entities_are_decoded ... ok
test size_limits_hold ... ok
test any_text_is_read_without_panicking ... ok
test damaged_files_are_read_without_panicking ... ok
test multi_character_labels_mean_what_they_mean_in_jflap ... ok
test export_then_import_gives_the_same_machine ... ok

test result: ok. 22 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.12s

     Running tests\json_shapes.rs (target\debug\deps\json_shapes-8dcabf6bf9b1536d.exe)

running 10 tests
test budgets_refuse_unknown_or_wrong_fields ... ok
test a_machine_serializes_to_the_machine_file ... ok
test budgets_read_partial_json ... ok
test conversions ... ok
test simulation ... ok
test jff ... ok
test small_results ... ok
test operations ... ok
test regex_machine ... ok
test equivalence ... ok

test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s

     Running tests\language.rs (target\debug\deps\language-e9bf4316be0f334b.exe)

running 12 tests
test test_environment_references_and_resolution ... ok
test test_kleene_star_and_plus ... ok
test test_finite_set_concatenation_and_proper_order ... ok
test test_parse_and_eval_all_preset_formulas ... ok
test test_juxtaposition_concatenation_parsing ... ok
test test_proper_ordering_comparator ... ok
test test_predicate_modulo ... ok
test test_reversal_and_power ... ok
test test_predicate_universal_prefix ... ok
test test_set_operations_union_diff_intersect ... ok
test test_predicate_count_linear_and_min_length ... ok
test test_l1_cubed_l2_squared_minus_l7_star ... ok

test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s

     Running tests\minimize.rs (target\debug\deps\minimize-90fd575ea80c7ff9.exe)

running 11 tests
test a_minimal_machine_comes_back_unchanged ... ok
test a_machine_that_counts_modulo_4_reduces_to_two_states ... ok
test only_complete_valid_dfsms_can_be_minimized ... ok
test one_class_means_a_one_state_machine ... ok
test unreachable_states_are_removed_first_as_visible_steps ... ok
test messages_carry_keys_and_parameters ... ok
test rich_example_5_28_follows_the_slide_round_by_round ... ok
test too_many_steps_stops_with_the_trace_so_far ... ok
test the_minimal_dfsm_accepts_the_same_strings ... ok
test small_budgets_never_panic_and_are_respected ... ok
test the_result_is_minimal_and_minimizing_again_changes_nothing ... ok

test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.07s

     Running tests\nondeterminism.rs (target\debug\deps\nondeterminism-3213e51f36a7c02a.exe)

running 10 tests
test a_dfsm_has_no_nondeterministic_state ... ok
test two_identical_transitions_count_as_two ... ok
test a_state_can_have_both_problems_and_several_symbols ... ok
test the_kind_of_the_machine_does_not_matter ... ok
test an_epsilon_transition_marks_the_state ... ok
test a_missing_transition_is_not_nondeterminism ... ok
test two_transitions_on_one_symbol_mark_the_state ... ok
test a_machine_without_transitions_has_none ... ok
test the_list_follows_the_definition ... ok
test the_list_agrees_with_validate ... ok

test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s

     Running tests\operations.rs (target\debug\deps\operations-bb1bee8451bee805.exe)

running 20 tests
test a_stopped_intersection_keeps_the_machines_of_the_stages_it_began ... ok
test complement_swaps_the_accepting_states ... ok
test a_stage_that_is_skipped_has_no_marker_and_the_next_one_starts_from_the_machine ... ok
test intersection_needs_start_states_and_the_same_symbols ... ok
test complementing_twice_gives_the_original_machine ... ok
test only_complete_valid_dfsms_can_be_complemented ... ok
test machines_that_are_not_complete_dfsms_are_made_complete_first ... ok
test symbols_are_matched_by_name_whatever_the_order ... ok
test the_second_machine_is_renumbered_after_the_highest_state_of_the_first ... ok
test each_stage_carries_the_machines_it_starts_from ... ok
test union_adds_a_start_state_with_two_epsilon_transitions ... ok
test union_needs_start_states_and_the_same_symbols ... ok
test a_machine_and_its_complement_have_nothing_in_common ... ok
test intersection_runs_the_de_morgan_stages ... ok
test a_budget_stop_inside_a_stage_returns_the_trace_so_far ... ok
test a_union_over_the_state_limit_is_an_error ... ok
test the_complement_accepts_exactly_the_other_strings ... ok
test the_union_accepts_what_either_machine_accepts ... ok
test small_budgets_never_panic ... ok
test the_intersection_accepts_what_both_machines_accept ... ok

test result: ok. 20 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.36s

     Running tests\regex.rs (target\debug\deps\regex-0fac1ed992da3c6f.exe)

running 15 tests
test all_the_pieces_of_rich_syntax_parse ... ok
test errors_name_the_position ... ok
test rich_example_6_5_builds_the_machine_of_the_book ... ok
test expressions_print_back_in_rich_notation ... ok
test precedence_is_star_then_concatenation_then_union ... ok
test multi_character_symbols_are_separated_by_spaces_and_operators ... ok
test small_cases_follow_the_constructions_of_the_book ... ok
test size_limits_and_operator_symbols_are_rejected ... ok
test spaces_are_ignored ... ok
test union_and_concatenation_group_to_the_left ... ok
test the_state_budget_stops_the_construction ... ok
test the_parser_never_panics ... ok
test the_machine_accepts_what_a_reference_matcher_accepts ... ok
test printing_and_parsing_again_keeps_the_language ... ok
test plus_means_the_expression_followed_by_its_star ... ok

test result: ok. 15 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.08s

     Running tests\regex_machine.rs (target\debug\deps\regex_machine-96dc698913b04ab5.exe)

running 9 tests
test a_symbol_outside_the_alphabet_is_an_error ... ok
test the_plain_budget_stops_the_whole_call ... ok
test expressions_without_symbols_work ... ok
test an_expression_that_is_not_longer_than_the_machine_expression_is_kept ... ok
test the_result_means_the_same_and_is_never_longer_than_the_plain_one ... ok
test the_same_expression_gives_the_same_answer ... ok
test a_machine_that_is_too_big_gives_the_plain_result_and_says_so ... ok
test the_machine_step_says_how_big_each_machine_is ... ok
test a_long_expression_becomes_the_short_plus_through_the_minimal_machine ... ok

test result: ok. 9 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.14s

     Running tests\regex_oracle.rs (target\debug\deps\regex_oracle-289b8cabb165272c.exe)

running 11 tests
test the_matcher_gives_the_answers_that_a_person_gives ... ok
test the_acceptor_gives_the_answers_that_a_person_gives ... ok
test fsm_to_regex_agrees_with_the_acceptor_on_every_nfa_of_2_states_over_two_symbols ... ok
test fsm_to_regex_agrees_with_the_acceptor_on_every_nfa_of_2_states_over_one_symbol ... ok
test fsm_to_regex_agrees_with_the_acceptor_on_random_machines ... ok
test fsm_to_regex_agrees_with_the_acceptor_on_every_dfsm_of_up_to_2_states ... ok
test simplify_via_the_machine_keeps_the_language_on_every_regex_of_up_to_4_nodes ... ok
test simplify_keeps_the_language_on_random_regexes ... ok
test regex_to_fsm_agrees_with_the_matcher_on_random_regexes ... ok
test simplify_keeps_the_language_on_every_regex_of_up_to_4_nodes ... ok
test regex_to_fsm_agrees_with_the_matcher_on_every_regex_of_up_to_5_nodes ... ok

test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 12.53s

     Running tests\regex_simplify.rs (target\debug\deps\regex_simplify-33dfd96a4f1765ba.exe)

running 18 tests
test a_symbol_outside_the_alphabet_is_an_error ... ok
test a_run_of_parts_before_a_star_of_the_same_run_becomes_a_plus ... ok
test a_small_check_budget_stops ... ok
test absorption_works_between_parts_that_are_not_next_to_each_other ... ok
test a_small_step_budget_stops_with_a_partial_trace ... ok
test a_symbol_alphabet_with_long_names_works ... ok
test the_message_names_the_parts ... ok
test the_new_identities_name_the_parts ... ok
test the_expression_of_the_minimal_machine_and_the_one_of_the_owner_reach_the_same_plus ... ok
test rules_do_not_fire_when_their_condition_fails ... ok
test example_6_17 ... ok
test each_rule_rewrites_and_names_itself ... ok
test exercise_3_simplifies_as_far_as_the_identities_go ... ok
test simplifying_twice_changes_nothing ... ok
test a_tiny_budget_never_loops ... ok
test every_line_of_example_6_17_is_equivalent_to_the_start ... ok
test the_result_means_the_same_and_is_not_bigger ... ok
test the_new_identities_keep_the_language ... ok

test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.14s

     Running tests\simulate.rs (target\debug\deps\simulate-40139dfbb59dcb16.exe)

running 17 tests
test a_machine_without_a_start_state_cannot_run ... ok
test a_symbol_outside_the_alphabet_is_an_error ... ok
test rejecting_early_finishes_even_with_a_small_step_budget ... ok
test a_zero_configuration_budget_stops_at_once ... ok
test an_input_exactly_as_long_as_max_steps_finishes ... ok
test an_empty_set_of_states_rejects_early ... ok
test even_length_trace_follows_the_single_state ... ok
test an_empty_alphabet_only_accepts_the_empty_text ... ok
test even_length_dfsm ... ok
test other_alphabets_read_symbols_separated_by_spaces ... ok
test epsilon_closure_is_applied_at_the_start_and_after_each_symbol ... ok
test single_character_alphabets_read_one_character_at_a_time ... ok
test ends_in_10_ndfsm_tracks_a_set_of_states ... ok
test too_many_configurations_stops_before_the_step_that_overflows ... ok
test too_many_steps_stops_with_the_trace_so_far ... ok
test set_simulation_agrees_with_path_search ... ok
test small_budgets_never_panic_and_are_respected ... ok

test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.07s

     Running tests\trap_state.rs (target\debug\deps\trap_state-b624c4ced542bf8b.exe)

running 9 tests
test the_trace_shows_the_new_state_the_missing_transitions_and_the_loops ... ok
test minimize_works_on_the_result ... ok
test other_machines_are_refused ... ok
test a_dfsm_without_a_dead_state_gets_one ... ok
test a_complete_dfsm_comes_back_unchanged ... ok
test the_new_state_comes_after_the_highest_id ... ok
test a_machine_that_is_already_at_the_state_limit_is_refused ... ok
test complement_works_on_the_result ... ok
test the_result_is_complete_and_means_the_same ... ok

test result: ok. 9 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.20s

     Running tests\ts_export.rs (target\debug\deps\ts_export-b98c6d2e92630494.exe)

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests\validate.rs (target\debug\deps\validate-b6fcd7bb3dd25c79.exe)

running 12 tests
test a_state_reached_only_through_epsilon_is_reachable ... ok
test dfsm_epsilon_transition_is_an_error ... ok
test issues_come_in_a_fixed_order ... ok
test no_start_state_is_an_error_and_skips_reachability ... ok
test valid_dfsm_has_no_issues ... ok
test dfsm_missing_transition_names_state_and_symbol ... ok
test unreachable_state_is_a_warning ... ok
test dfsm_duplicate_transition_is_reported_once_per_state_and_symbol ... ok
test valid_ndfsm_may_have_epsilon_and_missing_transitions ... ok
test the_list_stops_at_1000_issues_with_a_marker ... ok
test complete_dfsm_has_no_errors ... ok
test validate_is_deterministic_and_ndfsm_never_gets_dfsm_keys ... ok

test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.04s

     Running tests\xor.rs (target\debug\deps\xor-efc76a81c4c28ca9.exe)

running 17 tests
test a_pair_that_no_string_reaches_is_not_built ... ok
test a_language_xor_itself_is_empty_and_nothing_accepts ... ok
test a_budget_of_states_stops_it_with_the_trace_so_far ... ok
test a_stage_that_has_nothing_to_do_is_skipped ... ok
test an_accepting_step_says_which_side_accepts_in_its_key ... ok
test a_budget_of_steps_stops_it_and_never_panics ... ok
test a_language_xor_its_complement_is_everything ... ok
test the_product_has_one_state_for_each_reachable_pair_and_follows_the_method_in_order ... ok
test a_pair_step_names_the_two_states_that_it_pairs ... ok
test the_result_is_a_valid_complete_dfsm ... ok
test xor_needs_start_states_and_the_same_symbols ... ok
test machines_that_are_not_complete_dfsms_are_made_complete_first ... ok
test the_order_of_the_symbols_of_the_second_machine_does_not_matter ... ok
test xor_accepts_exactly_what_one_of_the_machines_accepts ... ok
test small_budgets_never_panic ... ok
test xor_accepts_a_string_exactly_when_one_machine_accepts_it ... ok
test xor_has_no_accepting_state_exactly_when_the_machines_are_equivalent ... ok

test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.18s

   Doc-tests engine_core

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

```

## Build
```
$ vite build
vite v8.3.4 building ssr environment for production...
transforming...
✓ 322 modules transformed.
rendering chunks...
computing gzip size...
.svelte-kit/output/server/_app/immutable/assets/jetbrains-mono-greek-400-normal.C190GLew.woff2       4.22 kB
.svelte-kit/output/server/_app/immutable/assets/jetbrains-mono-greek-600-normal.H7WoG9Et.woff2       4.30 kB
.svelte-kit/output/server/_app/immutable/assets/plus-jakarta-sans-latin-400-normal.Dhut76fR.woff2   11.81 kB
.svelte-kit/output/server/_app/immutable/assets/plus-jakarta-sans-latin-600-normal.DLTa1BUW.woff2   12.18 kB
.svelte-kit/output/server/.vite/manifest.json                                                       15.70 kB │ gzip:  1.83 kB
.svelte-kit/output/server/_app/immutable/assets/jetbrains-mono-latin-400-normal.V6pRDFza.woff2      21.16 kB
.svelte-kit/output/server/_app/immutable/assets/jetbrains-mono-latin-600-normal.C8RAYTDA.woff2      21.86 kB
.svelte-kit/output/server/_app/immutable/assets/problem.DP-X_MrA.css                                 0.62 kB │ gzip:  0.29 kB
.svelte-kit/output/server/_app/immutable/assets/_page.D2I1JaFn.css                                   1.14 kB │ gzip:  0.41 kB
.svelte-kit/output/server/_app/immutable/assets/_page.Bj9Ti1Q1.css                                   1.21 kB │ gzip:  0.39 kB
.svelte-kit/output/server/_app/immutable/assets/ShareDialog.uXp6zjwI.css                             2.68 kB │ gzip:  0.82 kB
.svelte-kit/output/server/_app/immutable/assets/DiagramDrawing.DWl0Vyju.css                          2.71 kB │ gzip:  0.63 kB
.svelte-kit/output/server/_app/immutable/assets/_page.eTCs7hbJ.css                                   3.50 kB │ gzip:  0.87 kB
.svelte-kit/output/server/_app/immutable/assets/_page.DNIhdgjq.css                                   3.81 kB │ gzip:  1.01 kB
.svelte-kit/output/server/_app/immutable/assets/_page.D7oFu7y0.css                                   4.42 kB │ gzip:  0.98 kB
.svelte-kit/output/server/_app/immutable/assets/TourDialog._Uh7tub6.css                              4.61 kB │ gzip:  1.03 kB
.svelte-kit/output/server/_app/immutable/assets/_page.Dbpd2WAk.css                                   5.93 kB │ gzip:  1.32 kB
.svelte-kit/output/server/_app/immutable/assets/_page.D_YFoG2s.css                                   6.97 kB │ gzip:  1.29 kB
.svelte-kit/output/server/_app/immutable/assets/_layout.BqgOgyhY.css                                 7.45 kB │ gzip:  2.07 kB
.svelte-kit/output/server/_app/immutable/assets/Editor.CpZQ0Eo8.css                                 30.16 kB │ gzip:  4.47 kB
.svelte-kit/output/server/chunks/paths.js                                                            0.03 kB │ gzip:  0.05 kB
.svelte-kit/output/server/entries/pages/_layout.ts.js                                                0.12 kB │ gzip:  0.12 kB │ map:   0.18 kB
.svelte-kit/output/server/chunks/server.js                                                           0.22 kB │ gzip:  0.15 kB │ map:   0.64 kB
.svelte-kit/output/server/env.js                                                                     0.31 kB │ gzip:  0.19 kB │ map:   0.57 kB
.svelte-kit/output/server/entries/hooks.server.js                                                    0.33 kB │ gzip:  0.23 kB │ map:   1.03 kB
.svelte-kit/output/server/chunks/titles.js                                                           0.35 kB │ gzip:  0.23 kB │ map:   0.91 kB
.svelte-kit/output/server/entries/pages/soal/_page.server.ts.js                                      0.37 kB │ gzip:  0.24 kB │ map:   0.91 kB
.svelte-kit/output/server/chunks/index-server.js                                                     0.50 kB │ gzip:  0.31 kB │ map:   1.70 kB
.svelte-kit/output/server/entries/fallbacks/error.svelte.js                                          0.53 kB │ gzip:  0.34 kB │ map:   0.54 kB
.svelte-kit/output/server/entries/pages/panduan/_page.server.ts.js                                   0.53 kB │ gzip:  0.28 kB │ map:   0.97 kB
.svelte-kit/output/server/entries/endpoints/sitemap.xml/_server.ts.js                                0.64 kB │ gzip:  0.38 kB │ map:   1.07 kB
.svelte-kit/output/server/chunks/navigation.js                                                       0.67 kB │ gzip:  0.33 kB │ map:   1.27 kB
.svelte-kit/output/server/entries/pages/panduan/_id_/_page.server.ts.js                              0.77 kB │ gzip:  0.40 kB │ map:   1.26 kB
.svelte-kit/output/server/chunks/state.js                                                            0.84 kB │ gzip:  0.37 kB │ map:   2.30 kB
.svelte-kit/output/server/entries/pages/soal/_id_/_page.server.ts.js                                 1.00 kB │ gzip:  0.49 kB │ map:   1.97 kB
.svelte-kit/output/server/chunks/seo.js                                                              1.01 kB │ gzip:  0.61 kB │ map:   1.82 kB
.svelte-kit/output/server/entries/endpoints/soal/_id_/jawaban.json/_server.ts.js                     1.05 kB │ gzip:  0.54 kB │ map:   4.63 kB
.svelte-kit/output/server/chunks/progress.js                                                         2.14 kB │ gzip:  0.93 kB │ map:  10.24 kB
.svelte-kit/output/server/chunks/list2.js                                                            2.38 kB │ gzip:  0.94 kB │ map:   5.57 kB
.svelte-kit/output/server/index.js                                                                   2.38 kB │ gzip:  0.97 kB │ map:   3.41 kB
.svelte-kit/output/server/entries/pages/_page.svelte.js                                              2.82 kB │ gzip:  1.01 kB │ map:   4.78 kB
.svelte-kit/output/server/chunks/list.js                                                             2.88 kB │ gzip:  1.20 kB │ map:   5.92 kB
.svelte-kit/output/server/entries/pages/tentang/_page.svelte.js                                      3.19 kB │ gzip:  0.83 kB │ map:   5.23 kB
.svelte-kit/output/server/chunks/storage.js                                                          3.39 kB │ gzip:  1.29 kB │ map:   7.95 kB
.svelte-kit/output/server/chunks/ShareDialog.js                                                      3.74 kB │ gzip:  1.22 kB │ map:  15.85 kB
.svelte-kit/output/server/chunks/TourDialog.js                                                       4.68 kB │ gzip:  1.35 kB │ map:  12.53 kB
.svelte-kit/output/server/entries/pages/_layout.svelte.js                                            4.89 kB │ gzip:  1.46 kB │ map:  11.34 kB
.svelte-kit/output/server/entries/pages/panduan/_page.svelte.js                                      4.91 kB │ gzip:  1.54 kB │ map:  10.57 kB
.svelte-kit/output/server/entries/pages/sandbox/_page.svelte.js                                      7.24 kB │ gzip:  2.14 kB │ map:  25.73 kB
.svelte-kit/output/server/chunks/problem.js                                                          7.80 kB │ gzip:  2.94 kB │ map:  19.64 kB
.svelte-kit/output/server/entries/pages/soal/_page.svelte.js                                         7.91 kB │ gzip:  2.12 kB │ map:  20.32 kB
.svelte-kit/output/server/entries/pages/soal/_id_/_page.svelte.js                                    9.69 kB │ gzip:  2.82 kB │ map:  30.77 kB
.svelte-kit/output/server/entries/pages/panduan/_id_/_page.svelte.js                                11.41 kB │ gzip:  2.74 kB │ map:  22.09 kB
.svelte-kit/output/server/chunks/link.js                                                            13.49 kB │ gzip:  4.49 kB │ map:  25.77 kB
.svelte-kit/output/server/chunks/library.svelte.js                                                  18.50 kB │ gzip:  5.34 kB │ map:  45.74 kB
.svelte-kit/output/server/chunks/uneval.js                                                          19.42 kB │ gzip:  5.37 kB │ map:  40.87 kB
.svelte-kit/output/server/chunks/guides.js                                                          19.50 kB │ gzip:  6.27 kB │ map:  34.65 kB
.svelte-kit/output/server/chunks/test-list.js                                                       21.77 kB │ gzip:  6.03 kB │ map:  50.68 kB
.svelte-kit/output/server/chunks/DiagramDrawing.js                                                  22.22 kB │ gzip:  6.98 kB │ map:  47.66 kB
.svelte-kit/output/server/chunks/server-errors.js                                                   24.17 kB │ gzip:  4.57 kB │ map:  34.90 kB
.svelte-kit/output/server/chunks/questions.js                                                       27.52 kB │ gzip:  7.58 kB │ map:  30.36 kB
.svelte-kit/output/server/chunks/server2.js                                                         46.65 kB │ gzip: 12.67 kB │ map: 128.50 kB
.svelte-kit/output/server/remote-entry.js                                                           54.98 kB │ gzip: 11.89 kB │ map:  90.36 kB
.svelte-kit/output/server/chunks/Editor.js                                                          99.05 kB │ gzip: 24.60 kB │ map: 301.42 kB
.svelte-kit/output/server/chunks/index.svelte.js                                                   106.34 kB │ gzip: 28.80 kB │ map: 136.12 kB
.svelte-kit/output/server/chunks/internal.js                                                       113.56 kB │ gzip: 29.94 kB │ map: 242.10 kB
.svelte-kit/output/server/chunks/instance.js                                                       129.58 kB │ gzip: 34.78 kB │ map: 258.32 kB

✓ built in 762ms
Analysing routes
(node:18108) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
Building app
vite v8.3.4 building client environment for production...
transforming...
✓ 387 modules transformed.
rendering chunks...
computing gzip size...
.svelte-kit/output/client/_app/version.json                                                          0.02 kB │ gzip:   0.04 kB
.svelte-kit/output/client/_app/immutable/assets/jetbrains-mono-greek-400-normal.C190GLew.woff2       4.22 kB
.svelte-kit/output/client/_app/immutable/assets/jetbrains-mono-greek-600-normal.H7WoG9Et.woff2       4.30 kB
.svelte-kit/output/client/_app/immutable/assets/plus-jakarta-sans-latin-400-normal.Dhut76fR.woff2   11.81 kB
.svelte-kit/output/client/_app/immutable/assets/plus-jakarta-sans-latin-600-normal.DLTa1BUW.woff2   12.18 kB
.svelte-kit/output/client/_app/immutable/workers/worker-DQBpx1_O.js                                 13.24 kB
.svelte-kit/output/client/.vite/manifest.json                                                       17.30 kB │ gzip:   2.12 kB
.svelte-kit/output/client/_app/immutable/assets/jetbrains-mono-latin-400-normal.V6pRDFza.woff2      21.16 kB
.svelte-kit/output/client/_app/immutable/assets/jetbrains-mono-latin-600-normal.C8RAYTDA.woff2      21.86 kB
.svelte-kit/output/client/_app/immutable/workers/layout.worker-DvXNapDG.js                          47.23 kB
.svelte-kit/output/client/_app/immutable/workers/assets/engine_wasm_bg-BpMQzz4d.wasm               492.31 kB │ gzip: 210.80 kB
.svelte-kit/output/client/_app/immutable/assets/problem.DP-X_MrA.css                                 0.62 kB │ gzip:   0.29 kB
.svelte-kit/output/client/_app/immutable/assets/2.D2I1JaFn.css                                       1.14 kB │ gzip:   0.41 kB
.svelte-kit/output/client/_app/immutable/assets/8.Bj9Ti1Q1.css                                       1.21 kB │ gzip:   0.39 kB
.svelte-kit/output/client/_app/immutable/assets/ShareDialog.uXp6zjwI.css                             2.68 kB │ gzip:   0.82 kB
.svelte-kit/output/client/_app/immutable/assets/DiagramDrawing.DWl0Vyju.css                          2.71 kB │ gzip:   0.63 kB
.svelte-kit/output/client/_app/immutable/assets/3.eTCs7hbJ.css                                       3.50 kB │ gzip:   0.87 kB
.svelte-kit/output/client/_app/immutable/assets/5.DNIhdgjq.css                                       3.81 kB │ gzip:   1.01 kB
.svelte-kit/output/client/_app/immutable/assets/TableView.xpL8CO50.css                               4.61 kB │ gzip:   1.00 kB
.svelte-kit/output/client/_app/immutable/assets/TourDialog._Uh7tub6.css                              4.61 kB │ gzip:   1.03 kB
.svelte-kit/output/client/_app/immutable/assets/LibraryDialog.BY6b98Gg.css                           4.82 kB │ gzip:   1.19 kB
.svelte-kit/output/client/_app/immutable/assets/6.Dbpd2WAk.css                                       5.93 kB │ gzip:   1.32 kB
.svelte-kit/output/client/_app/immutable/assets/4.D_YFoG2s.css                                       6.97 kB │ gzip:   1.29 kB
.svelte-kit/output/client/_app/immutable/assets/7.CkhJ12Zs.css                                       7.35 kB │ gzip:   1.29 kB
.svelte-kit/output/client/_app/immutable/assets/0.BqgOgyhY.css                                       7.45 kB │ gzip:   2.07 kB
.svelte-kit/output/client/_app/immutable/assets/LanguageWorkstation.CYWMbSV9.css                    12.21 kB │ gzip:   2.10 kB
.svelte-kit/output/client/_app/immutable/assets/ConversionPanel.D6_GpYE9.css                        15.05 kB │ gzip:   1.91 kB
.svelte-kit/output/client/_app/immutable/assets/GrammarWorkstation.m8CAIXK2.css                     21.56 kB │ gzip:   3.26 kB
.svelte-kit/output/client/_app/immutable/assets/Editor.DJcVKrUx.css                                 30.42 kB │ gzip:   4.51 kB
.svelte-kit/output/client/_app/immutable/chunks/BPVwp-J3.js                                          0.02 kB │ gzip:   0.04 kB
.svelte-kit/output/client/_app/immutable/chunks/DIgHpIFL.js                                          0.02 kB │ gzip:   0.04 kB
.svelte-kit/output/client/_app/immutable/chunks/BxQG6IBk.js                                          0.05 kB │ gzip:   0.06 kB
.svelte-kit/output/client/_app/immutable/entry/payload.DSmR2FwN.js                                   0.06 kB │ gzip:   0.07 kB
.svelte-kit/output/client/_app/immutable/chunks/CZonfyO3.js                                          0.08 kB │ gzip:   0.09 kB
.svelte-kit/output/client/_app/immutable/chunks/DK3Fl9T5.js                                          0.15 kB │ gzip:   0.15 kB
.svelte-kit/output/client/_app/immutable/nodes/1.CTRrEFOJ.js                                         0.35 kB │ gzip:   0.25 kB
.svelte-kit/output/client/_app/immutable/entry/start.rxJlbQJO.js                                     0.57 kB │ gzip:   0.32 kB
.svelte-kit/output/client/_app/immutable/chunks/Ihgk-fnS.js                                          0.94 kB │ gzip:   0.54 kB
.svelte-kit/output/client/_app/immutable/chunks/D1tszMii.js                                          0.95 kB │ gzip:   0.63 kB
.svelte-kit/output/client/_app/immutable/chunks/Bjy-W4x2.js                                          1.36 kB │ gzip:   0.65 kB
.svelte-kit/output/client/_app/immutable/chunks/CRzLMJPS.js                                          1.53 kB │ gzip:   0.80 kB
.svelte-kit/output/client/_app/immutable/chunks/BvEIQBIe.js                                          1.60 kB │ gzip:   0.70 kB
.svelte-kit/output/client/_app/immutable/chunks/ChayO4h9.js                                          2.11 kB │ gzip:   0.99 kB
.svelte-kit/output/client/_app/immutable/chunks/D0H5LO5n.js                                          2.12 kB │ gzip:   1.03 kB
.svelte-kit/output/client/_app/immutable/nodes/2.rrQE62rd.js                                         2.23 kB │ gzip:   1.04 kB
.svelte-kit/output/client/_app/immutable/entry/app.mcpkIX5R.js                                       2.72 kB │ gzip:   1.07 kB
.svelte-kit/output/client/_app/immutable/nodes/8.C-rsCzkR.js                                         3.37 kB │ gzip:   1.18 kB
.svelte-kit/output/client/_app/immutable/chunks/DvTktrFW.js                                          3.73 kB │ gzip:   1.73 kB
.svelte-kit/output/client/_app/immutable/chunks/Cyt8LZpN.js                                          3.80 kB │ gzip:   1.69 kB
.svelte-kit/output/client/_app/immutable/nodes/0.Cwp0cBHv.js                                         4.26 kB │ gzip:   1.84 kB
.svelte-kit/output/client/_app/immutable/nodes/3.Be8kCa9F.js                                         4.48 kB │ gzip:   1.88 kB
.svelte-kit/output/client/_app/immutable/chunks/DVBFMp1X.js                                          4.88 kB │ gzip:   1.79 kB
.svelte-kit/output/client/_app/immutable/chunks/CVBQYMwQ.js                                          6.16 kB │ gzip:   2.47 kB
.svelte-kit/output/client/_app/immutable/chunks/MvsrUAjh.js                                          7.36 kB │ gzip:   2.53 kB
.svelte-kit/output/client/_app/immutable/chunks/BATFg811.js                                          8.15 kB │ gzip:   3.35 kB
.svelte-kit/output/client/_app/immutable/nodes/4.C_686kgB.js                                         8.41 kB │ gzip:   3.06 kB
.svelte-kit/output/client/_app/immutable/nodes/6.fbb-kkCb.js                                         8.87 kB │ gzip:   3.38 kB
.svelte-kit/output/client/_app/immutable/chunks/CLRV5URg.js                                         11.52 kB │ gzip:   4.65 kB
.svelte-kit/output/client/_app/immutable/chunks/Dv9yxh75.js                                         12.28 kB │ gzip:   4.44 kB
.svelte-kit/output/client/_app/immutable/chunks/DvmFIDWB.js                                         14.55 kB │ gzip:   4.98 kB
.svelte-kit/output/client/_app/immutable/chunks/CGQqhCXS.js                                         16.65 kB │ gzip:   5.55 kB
.svelte-kit/output/client/_app/immutable/nodes/5.BudS2oeC.js                                        17.71 kB │ gzip:   6.54 kB
.svelte-kit/output/client/_app/immutable/nodes/7.D6-SjoOT.js                                        19.71 kB │ gzip:   7.20 kB
.svelte-kit/output/client/_app/immutable/chunks/BxL-eAdJ.js                                         28.80 kB │ gzip:   8.11 kB
.svelte-kit/output/client/_app/immutable/chunks/D7VRuSZt.js                                         33.91 kB │ gzip:  10.71 kB
.svelte-kit/output/client/_app/immutable/chunks/C700-W4m.js                                         37.48 kB │ gzip:  11.21 kB
.svelte-kit/output/client/_app/immutable/chunks/VWQ1smrR.js                                         42.35 kB │ gzip:  15.61 kB
.svelte-kit/output/client/_app/immutable/chunks/Rs8CaRec.js                                         46.80 kB │ gzip:  18.03 kB
.svelte-kit/output/client/_app/immutable/chunks/FbwsrAr6.js                                         87.09 kB │ gzip:  28.19 kB
.svelte-kit/output/client/_app/immutable/chunks/DyqVeVm5.js                                        100.47 kB │ gzip:  28.21 kB

✓ built in 935ms
(node:18108) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
Prerendering

Run npm run preview to preview your production build locally.

> Using @sveltejs/adapter-static
Wrote site to "build"
✔ done
```

