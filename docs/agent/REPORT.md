# Report — T-002

> Written by the worker at the end of the session. One file per task; overwrite each session.

## Task
- id: T-002
- title: Remove the stale `tokio` audit ignore
- branch: `task/T-002-tokio-audit`
- commits: `760951d..9dcad9d`
- status: done

## What changed
- `.cargo/audit.toml`:
  - Removed the stale advisory ignore entry `ignore = ["RUSTSEC-2026-0384"]` and the associated comments accepting the advisory until 2026-11-04.
- `docs/agent/PLAN.md`:
  - Marked status of task T-002 as `done` and recorded commit `9dcad9d`.

## Note on Dated Chore & Private Files
- The dated chore (`tokio` RUSTSEC-2026-0384 accepted until 2026-11-04) is done. Tokio in `Cargo.lock` is at version 1.54.1 (the fixed version) and has met the two-week age rule since its release on 2026-10-21.
- `MD_FILES/` is acknowledged as the owner's private directory and was not modified or committed.

## Why
`Cargo.lock` has had `tokio 1.54.1` (the patched version resolving RUSTSEC-2026-0384) since commit `2d0dba6` on 2026-10-25. The temporary advisory acceptance was set to expire on 2026-11-04. Removing the ignore ensures that `cargo audit` runs in CI and locally without any ignored security advisories, confirming the build is clean.

## Verification (paste real output, do not summarize)

### Tokio Dependency Version (`cargo tree -i tokio --target all`)
```
tokio v1.54.1
└── wasm-bindgen-futures v0.4.79
    └── wasm-bindgen-test v0.3.79
        [dev-dependencies]
        └── engine-wasm v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-wasm)
```

### Tokio Dependency Version (`cargo tree -i tokio`)
```
warning: nothing to print.

To find dependencies that require specific target platforms, try to use option `--target all` first, and then narrow your search scope accordingly.
```

### Cargo Audit (`cargo audit`)
```
    Fetching advisory database from `https://github.com/RustSec/advisory-db.git`
      Loaded 1403 security advisories (from /home/Aldebaran64/.cargo/advisory-db)
    Updating crates.io index
    Scanning Cargo.lock for vulnerabilities (107 crate dependencies)
```

### Cargo Audit on Fuzz Lockfile (`cargo audit --file fuzz/Cargo.lock`)
```
    Fetching advisory database from `https://github.com/RustSec/advisory-db.git`
      Loaded 1403 security advisories (from /home/Aldebaran64/.cargo/advisory-db)
    Updating crates.io index
    Scanning fuzz/Cargo.lock for vulnerabilities (24 crate dependencies)
```

### Cargo Tests (`cargo test`)
```
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.07s
     Running unittests src/lib.rs (target/debug/deps/engine_core-670a3d94c89462ba)

running 1 test
test tests::version_is_not_empty ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/api.rs (target/debug/deps/api-b80225d7cef47478)

running 24 tests
test load_machine_gives_the_canonical_machine ... ok
test add_trap_state_completes_the_machine ... ok
test regex_errors_carry_a_position ... ok
test nondeterministic_states_lists_the_states ... ok
test a_budget_is_optional_and_partial ... ok
test simplify_gives_text_and_a_trace ... ok
test simulate_reads_symbols_with_several_characters ... ok
test simulate_checks_its_inputs ... ok
test regex_to_fsm_builds_a_machine ... ok
test simulate_returns_the_input_as_symbol_names ... ok
test a_bad_budget_is_an_error_and_not_ignored ... ok
test the_alphabet_is_checked ... ok
test load_machine_reports_problems_as_messages ... ok
test jff_import_and_export ... ok
test validate_lists_the_issues ... ok
test determinize_and_minimize ... ok
test closure_operations ... ok
test equivalent_names_the_symbols_of_the_witness ... ok
test xor_through_the_api ... ok
test fsm_to_regex_gives_text_that_means_the_same ... ok
test the_witness_is_right_even_if_the_alphabets_are_in_another_order ... ok
test the_same_input_gives_the_same_text ... ok
test simplify_via_machine_gives_text_and_a_trace ... ok
test no_text_makes_a_function_panic ... ok

test result: ok. 24 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.25s

     Running tests/boundaries.rs (target/debug/deps/boundaries-86334ddba1c3c79e)

running 20 tests
test a_symbol_that_is_not_in_the_alphabet_is_found_inside_every_kind_of_part ... ok
test a_star_and_a_plus_are_written_after_their_operand_and_bind_tighter_than_the_rest ... ok
test a_label_of_parallel_transitions_of_exactly_the_biggest_size_is_allowed ... ok
test a_label_of_exactly_the_biggest_size_is_allowed ... ok
test a_new_start_and_a_new_accepting_state_are_added_only_when_they_are_needed ... ok
test a_place_that_is_not_a_number_is_replaced_by_the_grid_and_the_name_is_kept ... ok
test a_tab_or_a_new_line_in_a_name_is_written_as_a_space ... ok
test states_without_a_place_are_put_on_a_grid_of_six_in_a_row ... ok
test the_list_of_wrong_strings_stops_when_the_visits_are_used_up ... ok
test an_alphabet_with_no_symbol_is_empty ... ok
test the_states_of_a_long_label_are_on_the_line_between_its_ends ... ok
test the_witness_of_a_split_names_the_first_symbol_on_which_the_two_groups_differ ... ok
test the_budget_of_checks_counts_each_check ... ok
test a_machine_with_more_problems_than_the_limit_gets_the_limit_and_one_marker ... ok
test the_machine_route_gives_way_when_the_dfsm_does_not_fit_though_the_nfa_does ... ok
test the_message_of_a_star_that_swallows_another_names_the_one_that_is_kept ... ok
test a_jff_file_of_exactly_the_biggest_size_is_read_and_one_byte_more_is_not ... ok
test a_machine_file_of_exactly_the_biggest_size_is_read_and_one_byte_more_is_not ... ok
test a_label_of_several_characters_adds_states_up_to_the_limit_and_not_past_it ... ok
test the_budget_of_states_is_capped_in_every_operation_that_determinizes ... ok

test result: ok. 20 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.11s

     Running tests/determinize.rs (target/debug/deps/determinize-b9746edb6b0d6811)

running 11 tests
test a_machine_without_a_start_state_cannot_be_converted ... ok
test a_dfsm_with_a_missing_transition_becomes_complete ... ok
test epsilon_closure_and_the_dead_state ... ok
test ends_in_10_gives_three_subsets ... ok
test too_many_steps_stops_with_the_trace_so_far ... ok
test too_many_states_stops_with_the_trace_so_far ... ok
test messages_carry_keys_and_parameters ... ok
test an_exponential_machine_stops_at_the_state_limit ... ok
test the_dfsm_accepts_exactly_what_the_original_accepts ... ok
test small_budgets_never_panic_and_are_respected ... ok
test the_result_is_a_valid_complete_dfsm_and_the_trace_matches_it ... ok

test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.14s

     Running tests/differential.rs (target/debug/deps/differential-859c5c32261d2a58)

running 12 tests
test machines_with_one_symbol_or_none_work_in_every_operation ... ok
test minimize_matches_automata_lib ... ok
test determinize_matches_automata_lib ... ok
test the_acceptor_written_here_agrees_with_simulate_and_with_the_package ... ok
test xor_matches_automata_lib ... ok
test equivalence_matches_automata_lib ... ok
test complement_matches_automata_lib_and_every_word ... ok
test union_matches_automata_lib_and_every_word ... ok
test intersection_matches_automata_lib_and_every_word ... ok
test xor_matches_every_word ... ok
test the_corner_machines_give_the_right_language_in_every_operation ... ok
test regex_to_fsm_matches_automata_lib_the_matcher_and_every_word ... ok

test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 6.72s

     Running tests/equivalence.rs (target/debug/deps/equivalence-bb6d90569fd57614)

running 16 tests
test both_machines_need_a_start_state ... ok
test an_ndfsm_equals_its_determinization ... ok
test a_star_against_a_star_b_star_has_the_witness_b ... ok
test complete_lists_when_the_limits_are_large_enough ... ok
test even_against_odd_has_the_empty_string_as_witness ... ok
test the_visit_budget_cuts_the_lists_but_not_the_witness ... ok
test machines_for_the_same_language_are_equivalent ... ok
test the_alphabets_must_have_the_same_symbols ... ok
test the_witness_is_the_first_of_the_shortest_strings ... ok
test a_machine_equals_itself_its_determinization_and_its_minimization ... ok
test too_many_pairs_stops_the_search ... ok
test small_budgets_never_panic ... ok
test every_reported_string_really_tells_the_machines_apart ... ok
test complete_lists_match_brute_force ... ok
test nothing_shorter_than_the_witness_tells_the_machines_apart ... ok
test swapping_the_machines_swaps_the_direction ... ok

test result: ok. 16 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 5.04s

     Running tests/fsm_json.rs (target/debug/deps/fsm_json-a1f035e974a7ff8e)

running 20 tests
test invalid_but_expressible_machines_still_load ... ok
test invalid_symbols_are_rejected ... ok
test duplicate_symbol_is_rejected ... ok
test deeply_nested_input_is_rejected_not_crashed ... ok
test duplicate_states_are_rejected ... ok
test machine_without_start_state_is_representable ... ok
test ndfsm_epsilon_transition_uses_null ... ok
test not_json_is_json_invalid_with_position ... ok
test multi_character_symbols_are_interned ... ok
test output_is_sorted_whatever_the_input_order ... ok
test symbol_length_limit_is_32_characters ... ok
test dfsm_round_trips_to_identical_json ... ok
test unsupported_schema_versions_report_the_version ... ok
test input_over_one_mebibyte_is_rejected_before_parsing ... ok
test references_to_missing_states_and_symbols_are_rejected ... ok
test wrong_shape_is_invalid_structure ... ok
test too_many_states_symbols_and_transitions_are_rejected ... ok
test mutated_valid_json_never_panics ... ok
test arbitrary_text_never_panics ... ok
test random_machines_round_trip ... ok

test result: ok. 20 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.08s

     Running tests/fsm_regex.rs (target/debug/deps/fsm_regex-66d70b6b9fd6038a)

running 16 tests
test no_accepting_state_gives_the_empty_set ... ok
test a_label_that_grows_too_big_stops_the_run ... ok
test even_length_gives_the_expression_of_rich_example_6_3 ... ok
test one_state_without_transitions_gives_epsilon ... ok
test one_state_with_a_loop_gives_a_star ... ok
test epsilon_transitions_are_labels_too ... ok
test a_machine_without_a_start_state_cannot_be_converted ... ok
test rich_example_6_7_removes_states_3_2_1 ... ok
test unreachable_states_are_removed_first ... ok
test too_many_label_updates_stop_the_run ... ok
test too_many_steps_stops_with_the_trace_so_far ... ok
test the_result_for_example_6_7_equals_the_expression_in_the_slides ... ok
test regex_to_ndfsm_to_regex_keeps_the_language ... ok
test the_result_is_simplified_and_states_are_removed_highest_first ... ok
test small_budgets_never_panic_and_are_respected ... ok
test a_random_machine_and_its_expression_accept_the_same_strings ... ok

test result: ok. 16 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.50s

     Running tests/grammar.rs (target/debug/deps/grammar-53ed0d438fef75e6)

running 20 tests
test test_cnf_phase1_start_symbol_collision_with_existing_s0 ... ok
test test_cnf_cfg_paren_helper_names_readable ... ok
test test_cnf_slide_example_eliminating_long_rhs ... ok
test test_cnf_transformation_trace_6_phases ... ok
test test_cnf_variable_deduplication_step6 ... ok
test test_cnf_presets_alphanumeric_helpers_unchanged ... ok
test test_cyk_empty_string ... ok
test test_cnf_variable_fresh_when_t_p1_already_exists ... ok
test test_cyk_parser_on_cnf ... ok
test test_parse_arrow_variants_and_empty_symbols ... ok
test test_parse_simple_grammar ... ok
test test_full_pipeline_cfg_to_cnf_to_cyk ... ok
test test_parse_lambda_empty_symbol ... ok
test test_t027_audit_lambda_presets_and_grammars ... ok
test test_cnf_preset_order ... ok
test test_cnf_preset_unit_chain ... ok
test cnf_proptest_variables_read_back_as_single_variable ... ok
test test_cnf_preset_start_long ... ok
test test_cnf_preset_nullable ... ok
test test_cnf_preset_shared_tail ... ok

test result: ok. 20 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 23.91s

     Running tests/jff.rs (target/debug/deps/jff-bee3247b6fde88a3)

running 22 tests
test a_dtd_is_refused_so_entity_attacks_cannot_work ... ok
test a_file_without_an_initial_state_still_loads ... ok
test a_file_with_the_wrong_shape_names_the_element ... ok
test a_long_label_on_a_loop_works_too ... ok
test a_file_written_by_jflap_is_read_into_a_machine_with_names_and_positions ... ok
test a_label_with_several_characters_reads_them_one_after_the_other ... ok
test export_writes_plain_xml_in_a_fixed_order ... ok
test export_uses_the_given_names_and_positions_and_escapes_text ... ok
test an_empty_read_element_is_an_epsilon_transition ... ok
test new_states_for_long_labels_get_ids_after_the_highest_one ... ok
test symbols_with_several_characters_cannot_be_exported ... ok
test only_finite_automata_are_supported ... ok
test xml_entities_are_decoded ... ok
test text_that_is_not_xml_is_reported_with_its_position ... ok
test the_kind_follows_the_structure_of_the_transitions ... ok
test state_ids_can_be_sparse_and_names_are_kept ... ok
test problems_in_the_machine_itself_reuse_the_machine_messages ... ok
test damaged_files_are_read_without_panicking ... ok
test any_text_is_read_without_panicking ... ok
test size_limits_hold ... ok
test multi_character_labels_mean_what_they_mean_in_jflap ... ok
test export_then_import_gives_the_same_machine ... ok

test result: ok. 22 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.12s

     Running tests/json_shapes.rs (target/debug/deps/json_shapes-b56372bf89e19334)

running 10 tests
test budgets_read_partial_json ... ok
test budgets_refuse_unknown_or_wrong_fields ... ok
test a_machine_serializes_to_the_machine_file ... ok
test jff ... ok
test simulation ... ok
test regex_machine ... ok
test small_results ... ok
test conversions ... ok
test operations ... ok
test equivalence ... ok

test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/language.rs (target/debug/deps/language-accd54191f4164ad)

running 12 tests
test test_finite_set_concatenation_and_proper_order ... ok
test test_juxtaposition_concatenation_parsing ... ok
test test_environment_references_and_resolution ... ok
test test_kleene_star_and_plus ... ok
test test_predicate_count_linear_and_min_length ... ok
test test_predicate_modulo ... ok
test test_proper_ordering_comparator ... ok
test test_predicate_universal_prefix ... ok
test test_parse_and_eval_all_preset_formulas ... ok
test test_reversal_and_power ... ok
test test_set_operations_union_diff_intersect ... ok
test test_l1_cubed_l2_squared_minus_l7_star ... ok

test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s

     Running tests/minimize.rs (target/debug/deps/minimize-acc011b82e52c706)

running 11 tests
test a_machine_that_counts_modulo_4_reduces_to_two_states ... ok
test a_minimal_machine_comes_back_unchanged ... ok
test only_complete_valid_dfsms_can_be_minimized ... ok
test messages_carry_keys_and_parameters ... ok
test rich_example_5_28_follows_the_slide_round_by_round ... ok
test one_class_means_a_one_state_machine ... ok
test unreachable_states_are_removed_first_as_visible_steps ... ok
test too_many_steps_stops_with_the_trace_so_far ... ok
test the_result_is_minimal_and_minimizing_again_changes_nothing ... ok
test the_minimal_dfsm_accepts_the_same_strings ... ok
test small_budgets_never_panic_and_are_respected ... ok

test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.08s

     Running tests/nondeterminism.rs (target/debug/deps/nondeterminism-1dd14d5a3580c559)

running 10 tests
test a_dfsm_has_no_nondeterministic_state ... ok
test an_epsilon_transition_marks_the_state ... ok
test a_state_can_have_both_problems_and_several_symbols ... ok
test two_identical_transitions_count_as_two ... ok
test a_machine_without_transitions_has_none ... ok
test the_kind_of_the_machine_does_not_matter ... ok
test two_transitions_on_one_symbol_mark_the_state ... ok
test a_missing_transition_is_not_nondeterminism ... ok
test the_list_follows_the_definition ... ok
test the_list_agrees_with_validate ... ok

test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s

     Running tests/operations.rs (target/debug/deps/operations-8e3a4145f0d88980)

running 20 tests
test a_stopped_intersection_keeps_the_machines_of_the_stages_it_began ... ok
test complement_swaps_the_accepting_states ... ok
test a_stage_that_is_skipped_has_no_marker_and_the_next_one_starts_from_the_machine ... ok
test complementing_twice_gives_the_original_machine ... ok
test each_stage_carries_the_machines_it_starts_from ... ok
test a_machine_and_its_complement_have_nothing_in_common ... ok
test only_complete_valid_dfsms_can_be_complemented ... ok
test intersection_needs_start_states_and_the_same_symbols ... ok
test symbols_are_matched_by_name_whatever_the_order ... ok
test machines_that_are_not_complete_dfsms_are_made_complete_first ... ok
test the_second_machine_is_renumbered_after_the_highest_state_of_the_first ... ok
test union_adds_a_start_state_with_two_epsilon_transitions ... ok
test union_needs_start_states_and_the_same_symbols ... ok
test intersection_runs_the_de_morgan_stages ... ok
test a_union_over_the_state_limit_is_an_error ... ok
test a_budget_stop_inside_a_stage_returns_the_trace_so_far ... ok
test the_complement_accepts_exactly_the_other_strings ... ok
test the_union_accepts_what_either_machine_accepts ... ok
test small_budgets_never_panic ... ok
test the_intersection_accepts_what_both_machines_accept ... ok

test result: ok. 20 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.40s

     Running tests/regex.rs (target/debug/deps/regex-144dbbc15ae111e6)

running 15 tests
test all_the_pieces_of_rich_syntax_parse ... ok
test expressions_print_back_in_rich_notation ... ok
test errors_name_the_position ... ok
test multi_character_symbols_are_separated_by_spaces_and_operators ... ok
test precedence_is_star_then_concatenation_then_union ... ok
test spaces_are_ignored ... ok
test the_state_budget_stops_the_construction ... ok
test union_and_concatenation_group_to_the_left ... ok
test small_cases_follow_the_constructions_of_the_book ... ok
test rich_example_6_5_builds_the_machine_of_the_book ... ok
test size_limits_and_operator_symbols_are_rejected ... ok
test the_parser_never_panics ... ok
test printing_and_parsing_again_keeps_the_language ... ok
test the_machine_accepts_what_a_reference_matcher_accepts ... ok
test plus_means_the_expression_followed_by_its_star ... ok

test result: ok. 15 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.09s

     Running tests/regex_machine.rs (target/debug/deps/regex_machine-68c888f702cbaaf7)

running 9 tests
test expressions_without_symbols_work ... ok
test the_plain_budget_stops_the_whole_call ... ok
test a_symbol_outside_the_alphabet_is_an_error ... ok
test an_expression_that_is_not_longer_than_the_machine_expression_is_kept ... ok
test the_result_means_the_same_and_is_never_longer_than_the_plain_one ... ok
test the_same_expression_gives_the_same_answer ... ok
test a_machine_that_is_too_big_gives_the_plain_result_and_says_so ... ok
test the_machine_step_says_how_big_each_machine_is ... ok
test a_long_expression_becomes_the_short_plus_through_the_minimal_machine ... ok

test result: ok. 9 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.24s

     Running tests/regex_oracle.rs (target/debug/deps/regex_oracle-8160578fcffdab82)

running 11 tests
test fsm_to_regex_agrees_with_the_acceptor_on_every_nfa_of_2_states_over_two_symbols ... ok
test the_acceptor_gives_the_answers_that_a_person_gives ... ok
test the_matcher_gives_the_answers_that_a_person_gives ... ok
test fsm_to_regex_agrees_with_the_acceptor_on_every_nfa_of_2_states_over_one_symbol ... ok
test fsm_to_regex_agrees_with_the_acceptor_on_random_machines ... ok
test fsm_to_regex_agrees_with_the_acceptor_on_every_dfsm_of_up_to_2_states ... ok
test simplify_via_the_machine_keeps_the_language_on_every_regex_of_up_to_4_nodes ... ok
test regex_to_fsm_agrees_with_the_matcher_on_random_regexes ... ok
test simplify_keeps_the_language_on_every_regex_of_up_to_4_nodes ... ok
test simplify_keeps_the_language_on_random_regexes ... ok
test regex_to_fsm_agrees_with_the_matcher_on_every_regex_of_up_to_5_nodes ... ok

test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 12.62s

     Running tests/regex_simplify.rs (target/debug/deps/regex_simplify-4e0f64ba565dd42f)

running 18 tests
test a_run_of_parts_before_a_star_of_the_same_run_becomes_a_plus ... ok
test a_small_check_budget_stops ... ok
test a_small_step_budget_stops_with_a_partial_trace ... ok
test a_symbol_alphabet_with_long_names_works ... ok
test absorption_works_between_parts_that_are_not_next_to_each_other ... ok
test a_symbol_outside_the_alphabet_is_an_error ... ok
test the_expression_of_the_minimal_machine_and_the_one_of_the_owner_reach_the_same_plus ... ok
test the_message_names_the_parts ... ok
test the_new_identities_name_the_parts ... ok
test example_6_17 ... ok
test rules_do_not_fire_when_their_condition_fails ... ok
test exercise_3_simplifies_as_far_as_the_identities_go ... ok
test a_tiny_budget_never_loops ... ok
test each_rule_rewrites_and_names_itself ... ok
test every_line_of_example_6_17_is_equivalent_to_the_start ... ok
test simplifying_twice_changes_nothing ... ok
test the_result_means_the_same_and_is_not_bigger ... ok
test the_new_identities_keep_the_language ... ok

test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.25s

     Running tests/simulate.rs (target/debug/deps/simulate-bf852def55e9877a)

running 17 tests
test a_symbol_outside_the_alphabet_is_an_error ... ok
test an_empty_alphabet_only_accepts_the_empty_text ... ok
test an_input_exactly_as_long_as_max_steps_finishes ... ok
test a_machine_without_a_start_state_cannot_run ... ok
test an_empty_set_of_states_rejects_early ... ok
test even_length_trace_follows_the_single_state ... ok
test a_zero_configuration_budget_stops_at_once ... ok
test rejecting_early_finishes_even_with_a_small_step_budget ... ok
test ends_in_10_ndfsm_tracks_a_set_of_states ... ok
test single_character_alphabets_read_one_character_at_a_time ... ok
test epsilon_closure_is_applied_at_the_start_and_after_each_symbol ... ok
test other_alphabets_read_symbols_separated_by_spaces ... ok
test too_many_configurations_stops_before_the_step_that_overflows ... ok
test even_length_dfsm ... ok
test too_many_steps_stops_with_the_trace_so_far ... ok
test set_simulation_agrees_with_path_search ... ok
test small_budgets_never_panic_and_are_respected ... ok

test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.11s

     Running tests/trap_state.rs (target/debug/deps/trap_state-4aee2a592eea6543)

running 9 tests
test a_dfsm_without_a_dead_state_gets_one ... ok
test a_complete_dfsm_comes_back_unchanged ... ok
test the_new_state_comes_after_the_highest_id ... ok
test other_machines_are_refused ... ok
test the_trace_shows_the_new_state_the_missing_transitions_and_the_loops ... ok
test minimize_works_on_the_result ... ok
test a_machine_that_is_already_at_the_state_limit_is_refused ... ok
test complement_works_on_the_result ... ok
test the_result_is_complete_and_means_the_same ... ok

test result: ok. 9 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.92s

     Running tests/ts_export.rs (target/debug/deps/ts_export-33cfd47880a3bf7a)

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/validate.rs (target/debug/deps/validate-6703e515f13f4509)

running 12 tests
test a_state_reached_only_through_epsilon_is_reachable ... ok
test issues_come_in_a_fixed_order ... ok
test dfsm_missing_transition_names_state_and_symbol ... ok
test dfsm_duplicate_transition_is_reported_once_per_state_and_symbol ... ok
test dfsm_epsilon_transition_is_an_error ... ok
test no_start_state_is_an_error_and_skips_reachability ... ok
test valid_ndfsm_may_have_epsilon_and_missing_transitions ... ok
test unreachable_state_is_a_warning ... ok
test valid_dfsm_has_no_issues ... ok
test the_list_stops_at_1000_issues_with_a_marker ... ok
test complete_dfsm_has_no_errors ... ok
test validate_is_deterministic_and_ndfsm_never_gets_dfsm_keys ... ok

test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.07s

     Running tests/xor.rs (target/debug/deps/xor-64f20ad6e96eb367)

running 17 tests
test a_budget_of_states_stops_it_with_the_trace_so_far ... ok
test a_language_xor_itself_is_empty_and_nothing_accepts ... ok
test a_pair_that_no_string_reaches_is_not_built ... ok
test a_budget_of_steps_stops_it_and_never_panics ... ok
test the_result_is_a_valid_complete_dfsm ... ok
test an_accepting_step_says_which_side_accepts_in_its_key ... ok
test a_stage_that_has_nothing_to_do_is_skipped ... ok
test xor_needs_start_states_and_the_same_symbols ... ok
test the_product_has_one_state_for_each_reachable_pair_and_follows_the_method_in_order ... ok
test a_pair_step_names_the_two_states_that_it_pairs ... ok
test a_language_xor_its_complement_is_everything ... ok
test the_order_of_the_symbols_of_the_second_machine_does_not_matter ... ok
test machines_that_are_not_complete_dfsms_are_made_complete_first ... ok
test xor_accepts_exactly_what_one_of_the_machines_accepts ... ok
test small_budgets_never_panic ... ok
test xor_accepts_a_string_exactly_when_one_machine_accepts_it ... ok
test xor_has_no_accepting_state_exactly_when_the_machines_are_equivalent ... ok

test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 2.53s

     Running unittests src/lib.rs (target/debug/deps/engine_wasm-c813d8d0c2a39401)

running 9 tests
test tests::parse_grammar_answers_in_envelope ... ok
test tests::cyk_parse_answers_in_envelope ... ok
test tests::enumerate_language_answers_in_envelope ... ok
test tests::bad_input_is_an_error_and_not_a_trap ... ok
test tests::version_matches_crate_version ... ok
test tests::a_budget_that_is_too_small_stops_the_run ... ok
test tests::simulate_answers_in_the_envelope ... ok
test tests::transform_to_cnf_answers_in_envelope ... ok
test tests::equivalent_names_the_witness ... ok

test result: ok. 9 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s

   Doc-tests engine_core

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

   Doc-tests engine_wasm

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

### WASM Tests (`pnpm test:wasm`)
```
$ wasm-pack test --node crates/engine-wasm
[INFO]: 🎯  Checking for the Wasm target...
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.03s
[INFO]: ⬇️  Installing wasm-bindgen...
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.04s
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

[WARN]: ⚠️   There's a newer version of wasm-pack available, the new version is: 0.15.1, you are using: 0.15.0. To update, navigate to: https://wasm-bindgen.github.io/wasm-pack/installer/
```

### Format (`pnpm format:check`)
```
$ pnpm --filter web format:check && cargo fmt --check
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!
```

### Typecheck (`pnpm check`)
```
$ pnpm --filter web check
$ svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings
Loading svelte-check in workspace: /home/Aldebaran64/webtomata/web
Getting Svelte diagnostics...

svelte-check found 0 errors and 0 warnings
```

### Lint (`pnpm lint && pnpm lint:rust`)
```
$ pnpm --filter web lint
$ eslint .
$ cargo fmt --check && cargo clippy --all-targets -- -D warnings
    Checking engine-core v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-core)
    Checking engine-wasm v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-wasm)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.62s
```

### Workflows Guard Rail (`pnpm check:workflows`)
```
$ node tools/check-workflows.mjs
ok   6 workflows follow the guard rails
```

### E2E
No UI, storage, touch, layout, or worker changes in this task (dependency audit configuration only).

### Deviations from plan
None.

### Defects raised
None.

### Follow-ups logged (proposed in PLAN.md)
None.

### Status
- [x] done — every verification command above passed
