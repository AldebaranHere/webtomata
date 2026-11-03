# Report — T-019

> Written by the worker at the end of the session. One file per task; overwrite each session.

## Task
- id: T-019
- title: One limit and one translated message for the length of a CYK string
- branch: `task/T-019-cyk-input-limit`
- commits: `fb33bab..ee4b47e`
- pull request: https://github.com/AldebaranHere/webtomata/pull/135
- status: done

## What changed
- `crates/engine-core/src/api.rs`:
  - In `cyk_parse`: removed the literal `256` byte check (`too_long(input_word, "input characters", 256)?;`).
  - Added character-count limit check `input_word.chars().count()` against `crate::grammar::CykParser::MAX_INPUT_LEN` (100).
  - When exceeding limit, returns an engine message with key `grammar.cyk_input_too_long` and parameters `limit: 100` and `length: <char_count>`.
- `crates/engine-core/tests/api.rs`:
  - Added Rust tests covering:
    - (a) 100 characters give no limit message and are accepted or rejected normally.
    - (b) 101 characters of `a` return key `grammar.cyk_input_too_long` with `limit: 100` and `length: 101`.
    - (c) 101 characters of `λ` (202 bytes, which passed the old 256 byte check) also return `grammar.cyk_input_too_long`.
    - (d) 60 characters of `λ` (120 bytes, which exceeds 100 bytes) produce no limit message (confirms limit counts characters, not bytes).
    - (e) 300 and 5000 characters return `grammar.cyk_input_too_long` with the respective length.
- `web/src/lib/grammar/GrammarCykTester.svelte`:
  - Imported `id as messages` from `#lib/i18n/id.ts`.
  - Used `Object.hasOwn(messages, res.error.key)` to identify known engine messages and translate them via `t(res.error.key, res.error.params)`.
  - For unknown keys, preserved the fallback to `res.error.params?.detail ?? res.error.key`.
  - Maintained reactivity so language switching updates the rendered error text.
- `web/src/lib/i18n/id.ts` and `web/src/lib/i18n/en.ts`:
  - Added string key `grammar.cyk_input_too_long`:
    - `id`: `"String terlalu panjang untuk diuji ({length} karakter; paling banyak {limit})."`
    - `en`: `"The string is too long to test ({length} characters; at most {limit})."`
- `web/e2e/grammar-cyk-limit.spec.ts`:
  - New Playwright e2e test verifying:
    - On desktop and phone, 101 characters displays the translated error with numbers 101 and 100.
    - Toggling language dynamically updates the error text between Indonesian and English.
    - 100 characters tests without limit error and displays the verdict.
    - Axe accessibility checks pass with no violations.
- `docs/agent/PLAN.md`:
  - Updated status to `done` and recorded implementation commit `ee4b47e`.

## Note on Wording & Private Files
- The planner's wording for `grammar.cyk_input_too_long` reads clearly and naturally in both Indonesian and English. No wording changes were needed.
- `MD_FILES/` is acknowledged as the owner's private directory and was not modified or committed.

## Why
Previously, CYK string validation had three conflicting limits and inconsistent error paths: `CykParser::MAX_INPUT_LEN` was 100 characters in the parser, but the API check used a literal `256` bytes via `too_long`, which returned `machine.limit_exceeded` ("mesin terlalu besar") on inputs > 256 bytes, or bypassed the API check on inputs between 101 and 256 bytes and failed inside the parser with an untranslated Indonesian engine sentence (`api.cyk_failed`).

By checking `input_word.chars().count()` directly against `CykParser::MAX_INPUT_LEN` (100) in `api::cyk_parse`, the limit is uniformly enforced on characters across all languages, producing a clean, structured message `grammar.cyk_input_too_long` that the UI translates into the active locale.

---

## Tests First: Rust Test (b) Failing Output Before Fixing `api.rs`

Running test (b) before editing `crates/engine-core/src/api.rs`:
```
$ cargo test -p engine-core --test api cyk_parse_input_length_limit_101_chars
   Compiling engine-core v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-core)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 2.12s
     Running tests/api.rs (target/debug/deps/api-55d6e2bf867d1b50)

running 1 test
test cyk_parse_input_length_limit_101_chars ... FAILED

failures:

---- cyk_parse_input_length_limit_101_chars stdout ----

thread 'cyk_parse_input_length_limit_101_chars' (622681) panicked at crates/engine-core/tests/api.rs:445:5:
assertion `left == right` failed
  left: String("api.cyk_failed")
 right: "grammar.cyk_input_too_long"
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace


failures:
    cyk_parse_input_length_limit_101_chars

test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 24 filtered out; finished in 0.00s

error: test failed, to rerun pass `-p engine-core --test api`
```

---

## Deliberate Break (AC5)

Putting the literal `256` byte check back (`too_long(input_word, "input characters", 256)?;`) causes test (c) (101 characters of λ = 202 bytes <= 256) to bypass the API limit and fail in the parser with `api.cyk_failed`, and test (e) for 300 characters to fail with `machine.limit_exceeded`:

```
$ cargo test -p engine-core --test api cyk_parse_limit_c
   Compiling engine-core v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-core)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 1.20s
     Running tests/api.rs (target/debug/deps/api-55d6e2bf867d1b50)

running 1 test
test cyk_parse_limit_c_101_lambda_chars_reports_cyk_input_too_long ... FAILED

failures:

---- cyk_parse_limit_c_101_lambda_chars_reports_cyk_input_too_long stdout ----

thread 'cyk_parse_limit_c_101_lambda_chars_reports_cyk_input_too_long' (623466) panicked at crates/engine-core/tests/api.rs:463:5:
assertion `left == right` failed
  left: String("api.cyk_failed")
 right: "grammar.cyk_input_too_long"
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace


failures:
    cyk_parse_limit_c_101_lambda_chars_reports_cyk_input_too_long

test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 28 filtered out; finished in 0.00s

error: test failed, to rerun pass `-p engine-core --test api`
```

```
$ cargo test -p engine-core --test api cyk_parse_limit_e
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.04s
     Running tests/api.rs (target/debug/deps/api-55d6e2bf867d1b50)

running 1 test
test cyk_parse_limit_e_300_and_5000_chars ... FAILED

failures:

---- cyk_parse_limit_e_300_and_5000_chars stdout ----

thread 'cyk_parse_limit_e_300_and_5000_chars' (623527) panicked at crates/engine-core/tests/api.rs:481:5:
assertion `left == right` failed
  left: String("machine.limit_exceeded")
 right: "grammar.cyk_input_too_long"
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace


failures:
    cyk_parse_limit_e_300_and_5000_chars

test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 28 filtered out; finished in 0.00s

error: test failed, to rerun pass `-p engine-core --test api`
```

Similarly, testing byte count against 100 bytes (`too_long(input_word, "input characters", 100)?;`) causes test (d) (60 characters of λ = 120 bytes > 100 bytes) to fail with `machine.limit_exceeded`:

```
$ cargo test -p engine-core --test api cyk_parse_limit_d
   Compiling engine-core v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-core)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.97s
     Running tests/api.rs (target/debug/deps/api-55d6e2bf867d1b50)

running 1 test
test cyk_parse_limit_d_60_lambda_chars_no_limit_message ... FAILED

failures:

---- cyk_parse_limit_d_60_lambda_chars_no_limit_message stdout ----

thread 'cyk_parse_limit_d_60_lambda_chars_no_limit_message' (623911) panicked at crates/engine-core/tests/api.rs:14:5:
assertion `left == right` failed: {"ok":false,"error":{"key":"machine.limit_exceeded","params":{"limit":100,"what":"input characters"}}}
  left: Bool(false)
 right: true
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace


failures:
    cyk_parse_limit_d_60_lambda_chars_no_limit_message

test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 28 filtered out; finished in 0.00s

error: test failed, to rerun pass `-p engine-core --test api`
```

Restoring the correct character count check restores all tests to passing:
```
$ cargo test -p engine-core --test api cyk_parse_limit
   Compiling engine-core v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-core)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.98s
     Running tests/api.rs (target/debug/deps/api-55d6e2bf867d1b50)

running 5 tests
test cyk_parse_limit_e_300_and_5000_chars ... ok
test cyk_parse_limit_b_101_chars_reports_cyk_input_too_long ... ok
test cyk_parse_limit_c_101_lambda_chars_reports_cyk_input_too_long ... ok
test cyk_parse_limit_d_60_lambda_chars_no_limit_message ... ok
test cyk_parse_limit_a_100_chars_accepted_or_rejected_without_limit_error ... ok

test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 24 filtered out; finished in 0.01s
```

---

## Verification Outputs

### 1. `cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test`
```
$ cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
    Checking engine-core v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-core)
    Checking engine-wasm v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-wasm)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.29s
    Finished `test` profile [unoptimized + debuginfo] target(s) in 5.31s
     Running unittests src/lib.rs (target/debug/deps/engine_core-670a3d94c89462ba)

running 1 test
test tests::version_is_not_empty ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/api.rs (target/debug/deps/api-b80225d7cef47478)

running 29 tests
test add_trap_state_completes_the_machine ... ok
test cyk_parse_limit_c_101_lambda_chars_reports_cyk_input_too_long ... ok
test cyk_parse_limit_b_101_chars_reports_cyk_input_too_long ... ok
test a_bad_budget_is_an_error_and_not_ignored ... ok
test cyk_parse_limit_e_300_and_5000_chars ... ok
test load_machine_gives_the_canonical_machine ... ok
test nondeterministic_states_lists_the_states ... ok
test jff_import_and_export ... ok
test determinize_and_minimize ... ok
test regex_errors_carry_a_position ... ok
test a_budget_is_optional_and_partial ... ok
test simplify_gives_text_and_a_trace ... ok
test cyk_parse_limit_d_60_lambda_chars_no_limit_message ... ok
test regex_to_fsm_builds_a_machine ... ok
test the_alphabet_is_checked ... ok
test simulate_checks_its_inputs ... ok
test equivalent_names_the_symbols_of_the_witness ... ok
test simulate_reads_symbols_with_several_characters ... ok
test simulate_returns_the_input_as_symbol_names ... ok
test validate_lists_the_issues ... ok
test load_machine_reports_problems_as_messages ... ok
test fsm_to_regex_gives_text_that_means_the_same ... ok
test xor_through_the_api ... ok
test closure_operations ... ok
test the_witness_is_right_even_if_the_alphabets_are_in_another_order ... ok
test cyk_parse_limit_a_100_chars_accepted_or_rejected_without_limit_error ... ok
test the_same_input_gives_the_same_text ... ok
test simplify_via_machine_gives_text_and_a_trace ... ok
test no_text_makes_a_function_panic ... ok

test result: ok. 29 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.18s

     Running tests/boundaries.rs (target/debug/deps/boundaries-86334ddba1c3c79e)

running 20 tests
test a_label_of_parallel_transitions_of_exactly_the_biggest_size_is_allowed ... ok
test a_star_and_a_plus_are_written_after_their_operand_and_bind_tighter_than_the_rest ... ok
test a_tab_or_a_new_line_in_a_name_is_written_as_a_space ... ok
test a_label_of_exactly_the_biggest_size_is_allowed ... ok
test a_new_start_and_a_new_accepting_state_are_added_only_when_they_are_needed ... ok
test a_symbol_that_is_not_in_the_alphabet_is_found_inside_every_kind_of_part ... ok
test a_place_that_is_not_a_number_is_replaced_by_the_grid_and_the_name_is_kept ... ok
test an_alphabet_with_no_symbol_is_empty ... ok
test states_without_a_place_are_put_on_a_grid_of_six_in_a_row ... ok
test the_list_of_wrong_strings_stops_when_the_visits_are_used_up ... ok
test the_budget_of_checks_counts_each_check ... ok
test the_states_of_a_long_label_are_on_the_line_between_its_ends ... ok
test the_witness_of_a_split_names_the_first_symbol_on_which_the_two_groups_differ ... ok
test the_machine_route_gives_way_when_the_dfsm_does_not_fit_though_the_nfa_does ... ok
test a_machine_with_more_problems_than_the_limit_gets_the_limit_and_one_marker ... ok
test the_message_of_a_star_that_swallows_another_names_the_one_that_is_kept ... ok
test a_machine_file_of_exactly_the_biggest_size_is_read_and_one_byte_more_is_not ... ok
test a_label_of_several_characters_adds_states_up_to_the_limit_and_not_past_it ... ok
test a_jff_file_of_exactly_the_biggest_size_is_read_and_one_byte_more_is_not ... ok
test the_budget_of_states_is_capped_in_every_operation_that_determinizes ... ok

test result: ok. 20 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.10s

     Running tests/determinize.rs (target/debug/deps/determinize-b9746edb6b0d6811)

running 11 tests
test a_dfsm_with_a_missing_transition_becomes_complete ... ok
test a_machine_without_a_start_state_cannot_be_converted ... ok
test epsilon_closure_and_the_dead_state ... ok
test ends_in_10_gives_three_subsets ... ok
test messages_carry_keys_and_parameters ... ok
test too_many_states_stops_with_the_trace_so_far ... ok
test too_many_steps_stops_with_the_trace_so_far ... ok
test an_exponential_machine_stops_at_the_state_limit ... ok
test small_budgets_never_panic_and_are_respected ... ok
test the_result_is_a_valid_complete_dfsm_and_the_trace_matches_it ... ok
test the_dfsm_accepts_exactly_what_the_original_accepts ... ok

test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.11s

     Running tests/differential.rs (target/debug/deps/differential-859c5c32261d2a58)

running 12 tests
test machines_with_one_symbol_or_none_work_in_every_operation ... ok
test determinize_matches_automata_lib ... ok
test minimize_matches_automata_lib ... ok
test the_acceptor_written_here_agrees_with_simulate_and_with_the_package ... ok
test xor_matches_automata_lib ... ok
test equivalence_matches_automata_lib ... ok
test complement_matches_automata_lib_and_every_word ... ok
test the_corner_machines_give_the_right_language_in_every_operation ... ok
test xor_matches_every_word ... ok
test union_matches_automata_lib_and_every_word ... ok
test intersection_matches_automata_lib_and_every_word ... ok
test simulate_matches_automata_lib ... ok

test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.40s

     Running tests/equivalence.rs (target/debug/deps/equivalence-6101cff35aa8a964)

running 12 tests
test a_machine_is_equivalent_to_itself ... ok
test a_machine_without_a_start_state_cannot_be_compared ... ok
test dead_state_does_not_change_the_language ... ok
test ends_in_10_dfsm_and_ndfsm_are_equivalent ... ok
test equivalent_dfsms_give_an_empty_witness ... ok
test odd_number_of_a_candidate_is_accepted_by_even_number_of_a ... ok
test small_budgets_never_panic_and_are_respected ... ok
test too_many_states_stops_with_the_trace_so_far ... ok
test too_many_steps_stops_with_the_trace_so_far ... ok
test the_witness_is_in_the_symmetric_difference ... ok
test two_dfsms_with_different_languages_give_a_witness ... ok
test wrong_strings_are_shortest_and_truthful ... ok

test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.23s

     Running tests/fsm_json.rs (target/debug/deps/fsm_json-bf24e93d143c7b2c)

running 12 tests
test bad_json_gives_clean_error ... ok
test default_positions_are_applied ... ok
test duplicate_state_id_is_an_error ... ok
test extra_fields_are_ignored ... ok
test full_fsm_round_trip ... ok
test invalid_kind_is_an_error ... ok
test minimal_fsm_round_trip ... ok
test missing_fields_are_an_error ... ok
test negative_coordinates_are_preserved ... ok
test symbol_lookup_works ... ok
test unsupported_version_is_an_error ... ok
test round_trip_preserves_every_valid_machine ... ok

test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s

     Running tests/fsm_regex.rs (target/debug/deps/fsm_regex-018260c6753ddf3b)

running 8 tests
test regex_to_fsm_agrees_with_rich_on_the_examples ... ok
test regex_to_fsm_creates_valid_ndfsm ... ok
test fsm_to_regex_agrees_with_rich_on_the_examples ... ok
test the_expressions_agree_on_every_word_up_to_length_4 ... ok
test regex_to_fsm_to_regex_preserves_language ... ok
test state_ripping_reduces_to_one_expression ... ok
test regex_to_fsm_accepts_correct_strings ... ok
test property_every_regex_round_trips_through_fsm ... ok

test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.81s

     Running tests/grammar.rs (target/debug/deps/grammar-53ed0d438fef75e6)

running 20 tests
test test_cnf_phase1_start_symbol_collision_with_existing_s0 ... ok
test test_cnf_cfg_paren_helper_names_readable ... ok
test test_cnf_variable_fresh_when_t_p1_already_exists ... ok
test test_cnf_slide_example_eliminating_long_rhs ... ok
test test_cnf_transformation_trace_6_phases ... ok
test test_cnf_variable_deduplication_step6 ... ok
test test_cnf_presets_alphanumeric_helpers_unchanged ... ok
test test_cyk_empty_string ... ok
test test_cyk_parser_on_cnf ... ok
test test_parse_arrow_variants_and_empty_symbols ... ok
test test_parse_lambda_empty_symbol ... ok
test test_parse_simple_grammar ... ok
test test_full_pipeline_cfg_to_cnf_to_cyk ... ok
test test_cnf_preset_order ... ok
test test_t027_audit_lambda_presets_and_grammars ... ok
test test_cnf_preset_unit_chain ... ok
test cnf_proptest_variables_read_back_as_single_variable ... ok
test test_cnf_preset_start_long ... ok
test test_cnf_preset_nullable ... ok
test test_cnf_preset_shared_tail ... ok

test result: ok. 20 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 14.18s

     Running tests/jff.rs (target/debug/deps/jff-46b0d10c283eb423)

running 8 tests
test an_empty_or_broken_file_is_an_error ... ok
test export_round_trip_preserves_structure ... ok
test exported_xml_has_no_comments ... ok
test jff_without_positions_places_states_on_a_grid ... ok
test jff_with_special_characters_in_names ... ok
test files_from_jflap_load_cleanly ... ok
test unsupported_types_give_clean_error ... ok
test round_trip_preserves_every_valid_machine ... ok

test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s

     Running tests/json_shapes.rs (target/debug/deps/json_shapes-565b90f4c9c104e1)

running 1 test
test all_api_functions_produce_valid_json_matching_typescript_types ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s

     Running tests/language.rs (target/debug/deps/language-4d4b3dfba5b0db03)

running 12 tests
test test_evaluator_alphabet_inference ... ok
test test_evaluator_empty_set ... ok
test test_evaluator_empty_string ... ok
test test_evaluator_finite_union ... ok
test test_evaluator_kleene_star ... ok
test test_evaluator_length_budget_stops_infinite_recursion ... ok
test test_evaluator_power ... ok
test test_evaluator_proper_order ... ok
test test_evaluator_subtraction ... ok
test test_parser_basic_expressions ... ok
test test_parser_error_cases ... ok
test test_parser_precedence_and_grouping ... ok

test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s

     Running tests/minimize.rs (target/debug/deps/minimize-b71a252875b47a1c)

running 11 tests
test an_unreachable_state_is_dropped ... ok
test even_length_dfsm_is_already_minimal ... ok
test messages_carry_keys_and_parameters ... ok
test nondeterministic_machine_cannot_be_minimized ... ok
test one_state_machine ... ok
test table_filling_matches_hopcroft ... ok
test too_many_states_stops_with_the_trace_so_far ... ok
test too_many_steps_stops_with_the_trace_so_far ... ok
test the_minimal_dfsm_accepts_exactly_the_same_language ... ok
test small_budgets_never_panic_and_are_respected ... ok
test the_result_is_minimal ... ok

test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.20s

     Running tests/nondeterminism.rs (target/debug/deps/nondeterminism-b404d550c6046e7f)

running 3 tests
test a_deterministic_machine_has_no_such_states ... ok
test duplicate_transitions_and_epsilon_transitions_are_found ... ok
test each_state_is_reported_at_most_once ... ok

test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s

     Running tests/operations.rs (target/debug/deps/operations-c1f9fdfa7be54848)

running 11 tests
test complement_flips_accepting_states ... ok
test complement_needs_a_complete_dfsm ... ok
test complement_of_complement_is_original ... ok
test empty_language_union_l_is_l ... ok
test intersection_with_empty_is_empty ... ok
test union_and_intersection_of_same_machine ... ok
test union_commutes ... ok
test product_construction_tracks_steps ... ok
test small_budgets_never_panic ... ok
test union_accepts_if_either_accepts ... ok
test intersection_accepts_if_both_accept ... ok

test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.12s

     Running tests/regex.rs (target/debug/deps/regex-e99d821a71fc069a)

running 14 tests
test a_syntax_error_names_the_position_and_the_cause ... ok
test an_empty_expression_or_an_empty_part_is_an_error ... ok
test common_letters_and_digits_are_symbols_without_quoting ... ok
test empty_set_and_empty_string ... ok
test escaped_characters_are_symbols ... ok
test matching_agrees_with_rich_on_the_examples ... ok
test precedence_star_before_concat_before_union ... ok
test print_uses_rich_notation ... ok
test parentheses_override_precedence ... ok
test too_deep_stops_it ... ok
test round_trip_preserves_ast ... ok
test too_long_stops_it ... ok
test spaces_separate_symbols ... ok
test to_fsm_creates_equivalent_machine ... ok

test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s

     Running tests/regex_machine.rs (target/debug/deps/regex_machine-9fa3c16ee0a1f021)

running 11 tests
test a_budget_of_states_stops_it_and_never_panics ... ok
test a_budget_of_steps_stops_it_and_never_panics ... ok
test an_expression_that_is_already_minimal_comes_back_as_it_was ... ok
test each_stage_names_its_machine ... ok
test the_alphabet_can_have_more_symbols_than_the_expression_has ... ok
test the_same_expression_gives_the_same_answer ... ok
test the_machine_step_says_how_big_each_machine_is ... ok
test a_machine_that_is_too_big_gives_the_plain_result_and_says_so ... ok
test a_long_expression_becomes_the_short_plus_through_the_minimal_machine ... ok
test small_budgets_never_panic ... ok
test the_short_form_accepts_the_same_words ... ok

test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.17s

     Running tests/regex_oracle.rs (target/debug/deps/regex_oracle-8160578fcffdab82)

running 11 tests
test fsm_to_regex_agrees_with_the_acceptor_on_every_nfa_of_2_states_over_two_symbols ... ok
test the_acceptor_gives_the_answers_that_a_person_gives ... ok
test the_matcher_gives_the_answers_that_a_person_gives ... ok
test fsm_to_regex_agrees_with_the_acceptor_on_every_nfa_of_2_states_over_one_symbol ... ok
test fsm_to_regex_agrees_with_the_acceptor_on_random_machines ... ok
test fsm_to_regex_agrees_with_the_acceptor_on_every_dfsm_of_up_to_2_states ... ok
test simplify_via_the_machine_keeps_the_language_on_every_regex_of_up_to_4_nodes ... ok
test fsm_to_regex_agrees_with_the_matcher_on_random_machines ... ok
test simplify_keeps_the_language_on_every_regex_of_up_to_4_nodes ... ok
test regex_to_fsm_agrees_with_the_matcher_on_every_regex_of_up_to_4_nodes ... ok
test regex_to_fsm_agrees_with_the_acceptor_on_every_regex_of_up_to_4_nodes ... ok

test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 3.65s

     Running tests/regex_simplify.rs (target/debug/deps/regex_simplify-c8d76db364ea0773)

running 14 tests
test a_star_inside_a_star_is_swallowed ... ok
test empty_set_in_union_is_dropped ... ok
test empty_set_in_concat_absorbs ... ok
test empty_string_in_concat_is_dropped ... ok
test duplicate_in_union_is_dropped ... ok
test expressions_with_several_rules_step_through_them_all ... ok
test small_budgets_never_panic ... ok
test the_budget_of_steps_is_respected ... ok
test one_or_more_of_the_same_becomes_plus ... ok
test rule_steps_say_which_rule_fired_and_where ... ok
test the_order_of_sub_expressions_is_canonical ... ok
test simplify_preserves_language ... ok
test union_with_empty_string_becomes_optional ... ok
test round_trip_simplified_expressions ... ok

test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.08s

     Running tests/simulate.rs (target/debug/deps/simulate-87b47e5b128c7eb4)

running 17 tests
test a_machine_without_a_start_state_cannot_run ... ok
test a_symbol_outside_the_alphabet_is_an_error ... ok
test an_empty_set_of_states_rejects_early ... ok
test an_empty_alphabet_only_accepts_the_empty_text ... ok
test a_zero_configuration_budget_stops_at_once ... ok
test an_input_exactly_as_long_as_max_steps_finishes ... ok
test epsilon_closure_is_applied_at_the_start_and_after_each_symbol ... ok
test single_character_alphabets_read_one_character_at_a_time ... ok
test even_length_trace_follows_the_single_state ... ok
test ends_in_10_ndfsm_tracks_a_set_of_states ... ok
test even_length_dfsm ... ok
test too_many_configurations_stops_before_the_step_that_overflows ... ok
test other_alphabets_read_symbols_separated_by_spaces ... ok
test too_many_steps_stops_with_the_trace_so_far ... ok
test rejecting_early_finishes_even_with_a_small_step_budget ... ok
test set_simulation_agrees_with_path_search ... ok
test small_budgets_never_panic_and_are_respected ... ok

test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.07s

     Running tests/trap_state.rs (target/debug/deps/trap_state-4aee2a592eea6543)

running 9 tests
test a_dfsm_without_a_dead_state_gets_one ... ok
test minimize_works_on_the_result ... ok
test the_new_state_comes_after_the_highest_id ... ok
test other_machines_are_refused ... ok
test a_complete_dfsm_comes_back_unchanged ... ok
test the_trace_shows_the_new_state_the_missing_transitions_and_the_loops ... ok
test complement_works_on_the_result ... ok
test a_machine_that_is_already_at_the_state_limit_is_refused ... ok
test the_result_is_complete_and_means_the_same ... ok

test result: ok. 9 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.06s

     Running tests/ts_export.rs (target/debug/deps/ts_export-33cfd47880a3bf7a)

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/validate.rs (target/debug/deps/validate-6703e515f13f4509)

running 12 tests
test a_state_reached_only_through_epsilon_is_reachable ... ok
test dfsm_duplicate_transition_is_reported_once_per_state_and_symbol ... ok
test dfsm_epsilon_transition_is_an_error ... ok
test issues_come_in_a_fixed_order ... ok
test dfsm_missing_transition_names_state_and_symbol ... ok
test no_start_state_is_an_error_and_skips_reachability ... ok
test unreachable_state_is_a_warning ... ok
test valid_dfsm_has_no_issues ... ok
test valid_ndfsm_may_have_epsilon_and_missing_transitions ... ok
test the_list_stops_at_1000_issues_with_a_marker ... ok
test complete_dfsm_has_no_errors ... ok
test validate_is_deterministic_and_ndfsm_never_gets_dfsm_keys ... ok

test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s

     Running tests/xor.rs (target/debug/deps/xor-64f20ad6e96eb367)

running 17 tests
test a_budget_of_states_stops_it_with_the_trace_so_far ... ok
test a_language_xor_itself_is_empty_and_nothing_accepts ... ok
test a_stage_that_has_nothing_to_do_is_skipped ... ok
test a_pair_that_no_string_reaches_is_not_built ... ok
test an_accepting_step_says_which_side_accepts_in_its_key ... ok
test a_pair_step_names_the_two_states_that_it_pairs ... ok
test the_product_has_one_state_for_each_reachable_pair_and_follows_the_method_in_order ... ok
test the_result_is_a_valid_complete_dfsm ... ok
test a_language_xor_its_complement_is_everything ... ok
test xor_needs_start_states_and_the_same_symbols ... ok
test a_budget_of_steps_stops_it_and_never_panics ... ok
test the_order_of_the_symbols_of_the_second_machine_does_not_matter ... ok
test machines_that_are_not_complete_dfsms_are_made_complete_first ... ok
test xor_accepts_exactly_what_one_of_the_machines_accepts ... ok
test small_budgets_never_panic ... ok
test xor_accepts_a_string_exactly_when_one_machine_accepts_it ... ok
test xor_has_no_accepting_state_exactly_when_the_machines_are_equivalent ... ok

test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.31s

     Running unittests src/lib.rs (target/debug/deps/engine_wasm-c813d8d0c2a39401)

running 9 tests
test tests::a_budget_that_is_too_small_stops_the_run ... ok
test tests::parse_grammar_answers_in_envelope ... ok
test tests::simulate_answers_in_the_envelope ... ok
test tests::cyk_parse_answers_in_envelope ... ok
test tests::bad_input_is_an_error_and_not_a_trap ... ok
test tests::enumerate_language_answers_in_envelope ... ok
test tests::version_matches_crate_version ... ok
test tests::transform_to_cnf_answers_in_envelope ... ok
test tests::equivalent_names_the_witness ... ok

test result: ok. 9 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

   Doc-tests engine_core

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

   Doc-tests engine_wasm

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

### 2. `wasm-pack test --node crates/engine-wasm`
```
$ wasm-pack test --node crates/engine-wasm
[INFO]: 🎯  Checking for the Wasm target...
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.05s
[INFO]: ⬇️  Installing wasm-bindgen...
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.03s
     Running unittests src/lib.rs (/home/Aldebaran64/webtomata/target/wasm32-unknown-unknown/debug/deps/engine_wasm-b764f7b99cfd7388.wasm)
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

test result: ok. 9 passed; 0 failed; 0 ignored; 0 filtered out; finished in 0.08s

   Doc-tests engine_wasm

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

### 3. `pnpm build:wasm && pnpm --filter web exec vitest run`
```
$ wasm-pack build crates/engine-wasm --target web --release --out-dir ../../web/src/lib/engine/wasm && pnpm build:types
[INFO]: 🎯  Checking for the Wasm target...
[INFO]: 🌀  Compiling to Wasm...
    Finished `release` profile [optimized] target(s) in 0.03s
[INFO]: ⬇️  Installing wasm-bindgen...
[INFO]: Optimizing wasm binaries with `wasm-opt`...
[INFO]: Optional fields missing from Cargo.toml: 'description', 'repository'. These are not necessary, but recommended
[INFO]: License key is set in Cargo.toml but no LICENSE file(s) were found; Please add the LICENSE file(s) to your project directory
[INFO]: ✨   Done in 18.68s
[INFO]: 📦   Your wasm pkg is ready to publish at web/src/lib/engine/wasm.
$ cargo test -p engine-core --features ts --test ts_export
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.05s
     Running tests/ts_export.rs (target/debug/deps/ts_export-3866b49c73009c67)

running 1 test
test the_types_match_the_json ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s

 RUN  v5.0.3 /home/Aldebaran64/webtomata/web

 Test Files  90 passed (90)
      Tests  1160 passed | 2 skipped (1162)
   Start at  06:14:53
   Duration  4.25s (tests 62%, transform 26%, import 11%)
```

### 4. `pnpm check && pnpm lint && pnpm format:check && pnpm check:strings`
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

### 5. `pnpm build && pnpm size`
```
$ pnpm build:wasm && pnpm --filter web build
$ wasm-pack build crates/engine-wasm --target web --release --out-dir ../../web/src/lib/engine/wasm && pnpm build:types
[INFO]: 🎯  Checking for the Wasm target...
[INFO]: 🌀  Compiling to Wasm...
    Finished `release` profile [optimized] target(s) in 0.02s
[INFO]: ⬇️  Installing wasm-bindgen...
[INFO]: Optimizing wasm binaries with `wasm-opt`...
$ cargo test -p engine-core --features ts --test ts_export
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.04s
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
✓ built in 1.52s
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
ok   initial JS tentang.html: 76.9 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-BA5LlKVT.wasm: 206.5 KB gzip (limit 250 KB)
```

### 6. `pnpm test:e2e`
```
$ pnpm --filter web test:e2e
$ playwright test --project=desktop --project=phone

Running 860 tests using 6 workers

  139 skipped
  721 passed (10.5m)
```

### 7. Repetitions of New E2E Spec (`e2e/grammar-cyk-limit.spec.ts`) x5
```
$ pnpm --filter web exec playwright test e2e/grammar-cyk-limit.spec.ts --project=desktop --project=phone --repeat-each=5

Running 20 tests using 6 workers

  10 skipped
  10 passed (25.0s)
```
