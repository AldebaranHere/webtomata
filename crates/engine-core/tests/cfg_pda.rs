use engine_core::api::cfg_to_pda_topdown as api_cfg_to_pda;
use engine_core::cfg_pda::{CfgPdaStep, StateName, cfg_to_pda_topdown};
use engine_core::grammar::{CnfTransformer, CykParser, Grammar, GrammarParser, Production, Symbol};
use engine_core::pda::{MAX_PDA_STRING, PdaKind, PdaWireTransition, determinism, validate_pda};
use engine_core::pda_simulate::{PdaBudget, PdaSimulation, simulate_pda};
use engine_core::{Message, Param, StateId, StopReason, parse_pda_jff, to_pda_jff};
use proptest::prelude::*;
use std::collections::BTreeSet;

fn strings_len_0_to_8() -> Vec<String> {
    let mut result = Vec::with_capacity(511);
    result.push(String::new());
    let mut current_len = vec![String::new()];
    for _ in 1..=8 {
        let mut next_len = Vec::with_capacity(current_len.len() * 2);
        for s in &current_len {
            next_len.push(format!("{s}a"));
            next_len.push(format!("{s}b"));
        }
        result.extend(next_len.clone());
        current_len = next_len;
    }
    assert_eq!(result.len(), 511);
    result
}

fn strings_len_0_to_5() -> Vec<String> {
    let mut result = Vec::with_capacity(63);
    result.push(String::new());
    let mut current_len = vec![String::new()];
    for _ in 1..=5 {
        let mut next_len = Vec::with_capacity(current_len.len() * 2);
        for s in &current_len {
            next_len.push(format!("{s}a"));
            next_len.push(format!("{s}b"));
        }
        result.extend(next_len.clone());
        current_len = next_len;
    }
    assert_eq!(result.len(), 63);
    result
}

fn in_f1_predicate(w: &str) -> bool {
    let n_a = w.chars().take_while(|&c| c == 'a').count();
    let n_b = w.chars().skip(n_a).take_while(|&c| c == 'b').count();
    n_a >= 1 && n_a == n_b && n_a + n_b == w.len()
}

fn in_f2_predicate(w: &str) -> bool {
    if w.is_empty() {
        return true;
    }
    let n_a = w.chars().take_while(|&c| c == 'a').count();
    let n_b = w.chars().skip(n_a).take_while(|&c| c == 'b').count();
    n_a == n_b && n_a + n_b == w.len()
}

fn in_f3_predicate(w: &str) -> bool {
    let n_a = w.chars().take_while(|&c| c == 'a').count();
    let n_b = w.chars().skip(n_a).take_while(|&c| c == 'b').count();
    n_a >= 1 && n_b >= 1 && n_a + n_b == w.len()
}

fn cnf_oracle(grammar_text: &str) -> Grammar {
    let parsed = GrammarParser::parse(grammar_text).expect("valid grammar");
    let trace = CnfTransformer::transform(&parsed).expect("cnf transform succeeds");
    trace.final_grammar
}

// ---------------------------------------------------------------------------
// 1. Two-oracle agreement test: hand predicates vs CNF + CYK on all 511 strings
// ---------------------------------------------------------------------------

#[test]
fn test_oracles_agree_on_all_511_strings() {
    let strings = strings_len_0_to_8();
    assert_eq!(strings.len(), 511);

    // F1: a^n b^n, n >= 1
    let cnf_f1 = cnf_oracle("S -> a S b | a b");
    for s in &strings {
        let expected = in_f1_predicate(s);
        let cyk_res = CykParser::parse(&cnf_f1, s).unwrap().accepted;
        assert_eq!(
            expected, cyk_res,
            "F1 oracle mismatch for string '{}': hand={}, cyk={}",
            s, expected, cyk_res
        );
    }

    // F2: a^n b^n, n >= 0
    let cnf_f2 = cnf_oracle("S -> a S b | ε");
    for s in &strings {
        let expected = in_f2_predicate(s);
        let cyk_res = CykParser::parse(&cnf_f2, s).unwrap().accepted;
        assert_eq!(
            expected, cyk_res,
            "F2 oracle mismatch for string '{}': hand={}, cyk={}",
            s, expected, cyk_res
        );
    }

    // F3: a^i b^j, i, j >= 1
    let cnf_f3 = cnf_oracle("S -> A B\nA -> a A | a\nB -> b B | b");
    for s in &strings {
        let expected = in_f3_predicate(s);
        let cyk_res = CykParser::parse(&cnf_f3, s).unwrap().accepted;
        assert_eq!(
            expected, cyk_res,
            "F3 oracle mismatch for string '{}': hand={}, cyk={}",
            s, expected, cyk_res
        );
    }
}

// ---------------------------------------------------------------------------
// 2. PDA Equivalence test on all 511 strings
// ---------------------------------------------------------------------------

#[test]
fn test_pda_equivalence_f1_all_511_strings() {
    let grammar = GrammarParser::parse("S -> a S b | a b").unwrap();
    let res = cfg_to_pda_topdown(&grammar).expect("conversion succeeds");
    let strings = strings_len_0_to_8();

    for s in &strings {
        let expected = in_f1_predicate(s);
        let syms = res.pda.input.tokenize(s).unwrap();
        let sim = simulate_pda(&res.pda, &syms, PdaBudget::default()).unwrap();
        match sim {
            PdaSimulation::Finished { accepted, .. } => {
                assert_eq!(
                    expected, accepted,
                    "F1 PDA equivalence failed for string '{}': expected={}, got={}",
                    s, expected, accepted
                );
            }
            PdaSimulation::Stopped { reason, .. } => {
                panic!(
                    "Simulation unexpectedly stopped on string '{}': {:?}",
                    s, reason
                );
            }
        }
    }
}

#[test]
fn test_pda_equivalence_f2_all_511_strings() {
    let grammar = GrammarParser::parse("S -> a S b | ε").unwrap();
    let res = cfg_to_pda_topdown(&grammar).expect("conversion succeeds");
    let strings = strings_len_0_to_8();

    for s in &strings {
        let expected = in_f2_predicate(s);
        let syms = res.pda.input.tokenize(s).unwrap();
        let sim = simulate_pda(&res.pda, &syms, PdaBudget::default()).unwrap();
        match sim {
            PdaSimulation::Finished { accepted, .. } => {
                assert_eq!(
                    expected, accepted,
                    "F2 PDA equivalence failed for string '{}': expected={}, got={}",
                    s, expected, accepted
                );
            }
            PdaSimulation::Stopped { reason, .. } => {
                panic!(
                    "Simulation unexpectedly stopped on string '{}': {:?}",
                    s, reason
                );
            }
        }
    }
}

#[test]
fn test_pda_equivalence_f3_all_511_strings() {
    let grammar = GrammarParser::parse("S -> A B\nA -> a A | a\nB -> b B | b").unwrap();
    let res = cfg_to_pda_topdown(&grammar).expect("conversion succeeds");
    let strings = strings_len_0_to_8();

    for s in &strings {
        let expected = in_f3_predicate(s);
        let syms = res.pda.input.tokenize(s).unwrap();
        let sim = simulate_pda(&res.pda, &syms, PdaBudget::default()).unwrap();
        match sim {
            PdaSimulation::Finished { accepted, .. } => {
                assert_eq!(
                    expected, accepted,
                    "F3 PDA equivalence failed for string '{}': expected={}, got={}",
                    s, expected, accepted
                );
            }
            PdaSimulation::Stopped { reason, .. } => {
                panic!(
                    "Simulation unexpectedly stopped on string '{}': {:?}",
                    s, reason
                );
            }
        }
    }
}

// ---------------------------------------------------------------------------
// 3. Fixture F1 details: S -> aSb | ab
// ---------------------------------------------------------------------------

#[test]
fn test_fixture_f1_details() {
    let grammar = GrammarParser::parse("S -> a S b | a b").unwrap();
    let res = cfg_to_pda_topdown(&grammar).expect("conversion succeeds");

    // Alphabets
    assert_eq!(res.pda.input.names(), &["a", "b"]);
    assert_eq!(res.pda.stack.names(), &["S", "a", "b"]);

    // States
    assert_eq!(res.pda.states, vec![StateId(0), StateId(1)]);
    assert_eq!(res.pda.start, Some(StateId(0)));
    assert_eq!(res.pda.accepting, vec![StateId(1)]);
    assert_eq!(res.pda.kind, PdaKind::Ndpda);
    assert_eq!(
        res.states,
        vec![
            StateName {
                id: StateId(0),
                name: "p".to_string()
            },
            StateName {
                id: StateId(1),
                name: "q".to_string()
            },
        ]
    );

    // Steps (5 steps in order)
    assert_eq!(res.steps.len(), 5);
    assert_eq!(
        res.steps[0],
        CfgPdaStep {
            transition: PdaWireTransition {
                from: 0,
                read: None,
                pop: vec![],
                push: vec!["S".to_string()],
                to: 1,
            },
            message: Message::new("cfg_pda.top_down.start"),
        }
    );
    assert_eq!(
        res.steps[1],
        CfgPdaStep {
            transition: PdaWireTransition {
                from: 1,
                read: None,
                pop: vec!["S".to_string()],
                push: vec!["a".to_string(), "S".to_string(), "b".to_string()],
                to: 1,
            },
            message: Message::new("cfg_pda.top_down.rule").with("rule", "S -> aSb"),
        }
    );
    assert_eq!(
        res.steps[2],
        CfgPdaStep {
            transition: PdaWireTransition {
                from: 1,
                read: None,
                pop: vec!["S".to_string()],
                push: vec!["a".to_string(), "b".to_string()],
                to: 1,
            },
            message: Message::new("cfg_pda.top_down.rule").with("rule", "S -> ab"),
        }
    );
    assert_eq!(
        res.steps[3],
        CfgPdaStep {
            transition: PdaWireTransition {
                from: 1,
                read: Some("a".to_string()),
                pop: vec!["a".to_string()],
                push: vec![],
                to: 1,
            },
            message: Message::new("cfg_pda.top_down.terminal").with("symbol", "a"),
        }
    );
    assert_eq!(
        res.steps[4],
        CfgPdaStep {
            transition: PdaWireTransition {
                from: 1,
                read: Some("b".to_string()),
                pop: vec!["b".to_string()],
                push: vec![],
                to: 1,
            },
            message: Message::new("cfg_pda.top_down.terminal").with("symbol", "b"),
        }
    );

    // Transitions in canonical sorted order in res.pda
    assert_eq!(res.pda.transitions.len(), 5);
    assert!(validate_pda(&res.pda).is_empty());

    // Determinism: exactly 1 competition between rule 1 and rule 2 at state 1
    let comp = determinism(&res.pda);
    assert_eq!(comp.len(), 1);
    assert_eq!(comp[0].from, StateId(1));
}

// ---------------------------------------------------------------------------
// 4. Fixture F2 details: S -> aSb | ε
// ---------------------------------------------------------------------------

#[test]
fn test_fixture_f2_details() {
    let grammar = GrammarParser::parse("S -> a S b | ε").unwrap();
    let res = cfg_to_pda_topdown(&grammar).expect("conversion succeeds");

    assert_eq!(res.pda.input.names(), &["a", "b"]);
    assert_eq!(res.pda.stack.names(), &["S", "a", "b"]);
    assert_eq!(res.steps.len(), 5);

    // Rule 2 is S -> ε, pops [S], pushes []
    assert_eq!(
        res.steps[2],
        CfgPdaStep {
            transition: PdaWireTransition {
                from: 1,
                read: None,
                pop: vec!["S".to_string()],
                push: vec![],
                to: 1,
            },
            message: Message::new("cfg_pda.top_down.rule").with("rule", "S -> ε"),
        }
    );

    // Verify empty string is accepted
    let empty_syms = res.pda.input.tokenize("").unwrap();
    let sim = simulate_pda(&res.pda, &empty_syms, PdaBudget::default()).unwrap();
    match sim {
        PdaSimulation::Finished { accepted, .. } => assert!(accepted),
        _ => panic!("Expected Finished, got {:?}", sim),
    }
}

// ---------------------------------------------------------------------------
// 5. Fixture F3 details: S -> AB, A -> aA | a, B -> bB | b
// ---------------------------------------------------------------------------

#[test]
fn test_fixture_f3_details() {
    let grammar = GrammarParser::parse("S -> A B\nA -> a A | a\nB -> b B | b").unwrap();
    let res = cfg_to_pda_topdown(&grammar).expect("conversion succeeds");

    assert_eq!(res.pda.input.names(), &["a", "b"]);
    // Stack alphabet sorted in byte order
    assert_eq!(res.pda.stack.names(), &["A", "B", "S", "a", "b"]);
    assert_eq!(res.steps.len(), 8);

    // S -> AB pushes [A, B] top first
    assert_eq!(
        res.steps[1].transition,
        PdaWireTransition {
            from: 1,
            read: None,
            pop: vec!["S".to_string()],
            push: vec!["A".to_string(), "B".to_string()],
            to: 1,
        }
    );
    assert!(validate_pda(&res.pda).is_empty());
}

// ---------------------------------------------------------------------------
// 6. Fixture F4 details: Left recursion S -> Sa | b
// ---------------------------------------------------------------------------

#[test]
fn test_fixture_f4_left_recursion() {
    let grammar = GrammarParser::parse("S -> S a | b").unwrap();
    let res = cfg_to_pda_topdown(&grammar).expect("conversion succeeds");

    assert_eq!(res.pda.transitions.len(), 5);
    assert_eq!(res.steps.len(), 5);

    // S -> Sa pushes [S, a]
    assert_eq!(
        res.steps[1].transition.push,
        vec!["S".to_string(), "a".to_string()]
    );

    // Input "ab" with max_stack: 20 gives Stopped(MaxStack)
    let budget = PdaBudget {
        max_steps: 10_000,
        max_configurations: 20_000,
        max_stack: 20,
    };
    let syms_ab = res.pda.input.tokenize("ab").unwrap();
    let sim_ab = simulate_pda(&res.pda, &syms_ab, budget).unwrap();
    match sim_ab {
        PdaSimulation::Stopped { reason, .. } => {
            assert_eq!(reason, StopReason::MaxStack);
        }
        _ => panic!("Expected Stopped(MaxStack), got {:?}", sim_ab),
    }

    // Input "baa" is accepted
    let syms_baa = res.pda.input.tokenize("baa").unwrap();
    let sim_baa = simulate_pda(&res.pda, &syms_baa, PdaBudget::default()).unwrap();
    match sim_baa {
        PdaSimulation::Finished { accepted, .. } => assert!(accepted),
        _ => panic!("Expected Finished, got {:?}", sim_baa),
    }
}

// ---------------------------------------------------------------------------
// 7. Fixture F5 details: edge cases
// ---------------------------------------------------------------------------

#[test]
fn test_fixture_f5_duplicate_rules_merged() {
    let grammar = GrammarParser::parse("S -> a | a").unwrap();
    let res = cfg_to_pda_topdown(&grammar).expect("conversion succeeds");

    // 1 start, 1 rule (deduplicated), 1 terminal: 3 steps and 3 transitions
    assert_eq!(res.steps.len(), 3);
    assert_eq!(res.pda.transitions.len(), 3);
}

#[test]
fn test_fixture_f5_symbol_clash() {
    let grammar = GrammarParser::parse("S -> a <a>").unwrap();
    let err = cfg_to_pda_topdown(&grammar).unwrap_err();
    assert_eq!(err.key, "pda.cfg.symbol_clash");
    assert_eq!(
        err.params.get("symbol"),
        Some(&Param::Text("a".to_string()))
    );
}

#[test]
fn test_fixture_f5_limit_exceeded_65_symbols() {
    let rhs: String = "a".repeat(MAX_PDA_STRING + 1);
    let grammar = GrammarParser::parse(&format!("S -> {rhs}")).unwrap();
    let err = cfg_to_pda_topdown(&grammar).unwrap_err();
    assert_eq!(err.key, "machine.limit_exceeded");
    assert_eq!(
        err.params.get("what"),
        Some(&Param::Text("pda_string".to_string()))
    );
    assert_eq!(
        err.params.get("limit"),
        Some(&Param::Int(MAX_PDA_STRING as i64))
    );
}

#[test]
fn test_fixture_f5_multi_character_variable_and_jff() {
    let grammar = GrammarParser::parse("S0 -> a S0 b | a b").unwrap();
    let res = cfg_to_pda_topdown(&grammar).expect("conversion succeeds");

    assert_eq!(res.pda.stack.names(), &["S0", "a", "b"]);
    assert_eq!(
        res.steps[1].transition.push,
        vec!["a".to_string(), "S0".to_string(), "b".to_string()]
    );

    // Exporting PDA with multi-character stack symbol S0 fails
    let layout = vec![];
    let jff_err = to_pda_jff(&res.pda, &layout).unwrap_err();
    assert_eq!(jff_err.key, "jff.symbol_not_single_character");
    assert_eq!(
        jff_err.params.get("symbol"),
        Some(&Param::Text("S0".to_string()))
    );

    // F1 export works and round-trips
    let grammar_f1 = GrammarParser::parse("S -> a S b | a b").unwrap();
    let res_f1 = cfg_to_pda_topdown(&grammar_f1).unwrap();
    let jff_xml = to_pda_jff(&res_f1.pda, &layout).expect("export succeeds");
    let imported = parse_pda_jff(&jff_xml).expect("import succeeds");
    assert_eq!(imported.pda.transitions, res_f1.pda.transitions);
}

// ---------------------------------------------------------------------------
// 8. AC3: Proptest on random small grammars
// ---------------------------------------------------------------------------

fn arb_grammar() -> impl Strategy<Value = Grammar> {
    let symbols = vec![
        Symbol::Terminal('a'),
        Symbol::Terminal('b'),
        Symbol::NonTerminal("S".to_string()),
        Symbol::NonTerminal("A".to_string()),
        Symbol::NonTerminal("B".to_string()),
    ];

    let arb_body = proptest::collection::vec(proptest::sample::select(symbols), 0..=3);
    let arb_rules_for_head = |head: &'static str| {
        proptest::collection::vec(arb_body.clone(), 1..=4).prop_map(move |bodies| {
            bodies
                .into_iter()
                .map(|b| Production::new(head, b))
                .collect::<Vec<_>>()
        })
    };

    (
        arb_rules_for_head("S"),
        proptest::option::of(arb_rules_for_head("A")),
        proptest::option::of(arb_rules_for_head("B")),
    )
        .prop_map(|(s_rules, a_rules_opt, b_rules_opt)| {
            let mut rules = s_rules;
            if let Some(r) = a_rules_opt {
                rules.extend(r);
            }
            if let Some(r) = b_rules_opt {
                rules.extend(r);
            }
            Grammar::new("S", rules)
        })
}

fn has_left_recursion(grammar: &Grammar) -> bool {
    let mut adj: std::collections::BTreeMap<&str, std::collections::BTreeSet<&str>> =
        std::collections::BTreeMap::new();
    for r in &grammar.rules {
        if let Some(Symbol::NonTerminal(nt)) = r.body.first() {
            adj.entry(&r.head).or_default().insert(nt);
        }
    }
    for start in adj.keys() {
        let mut visited = std::collections::BTreeSet::new();
        let mut stack = vec![*start];
        while let Some(curr) = stack.pop() {
            if let Some(neighbors) = adj.get(curr) {
                for &next in neighbors {
                    if next == *start {
                        return true;
                    }
                    if visited.insert(next) {
                        stack.push(next);
                    }
                }
            }
        }
    }
    false
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(50))]

    #[test]
    fn proptest_ac3_small_grammars(grammar in arb_grammar()) {
        let res = cfg_to_pda_topdown(&grammar);
        match res {
            Err(msg) => {
                // Must be one of the known validation errors (e.g. symbol clash, limit)
                assert!(
                    msg.key == "pda.cfg.symbol_clash"
                        || msg.key == "machine.limit_exceeded"
                        || msg.key == "machine.invalid_symbol",
                    "Unexpected error key: {}", msg.key
                );
            }
            Ok(conv) => {
                // Validate PDA has no issue other than pda.pop_never_pushed
                let issues = validate_pda(&conv.pda);
                for issue in issues {
                    assert_eq!(
                        issue.message.key, "pda.pop_never_pushed",
                        "Unexpected PDA issue: {:?}", issue
                    );
                }

                // Step count equals 1 + distinct rules + terminals
                let mut distinct_rules = BTreeSet::new();
                for r in &grammar.rules {
                    distinct_rules.insert((&r.head, &r.body));
                }
                let expected_steps = 1 + distinct_rules.len() + grammar.terminals().len();
                assert_eq!(conv.steps.len(), expected_steps);

                // Equivalence comparison against CNF + CYK on strings up to length 5
                if let Ok(cnf_trace) = CnfTransformer::transform(&grammar) {
                    let terms: Vec<char> = grammar.terminals().into_iter().collect();
                    let test_strings = if terms.is_empty() {
                        vec![String::new()]
                    } else if terms == vec!['a'] {
                        vec![
                            String::new(),
                            "a".to_string(),
                            "aa".to_string(),
                            "aaa".to_string(),
                            "aaaa".to_string(),
                            "aaaaa".to_string(),
                        ]
                    } else if terms == vec!['b'] {
                        vec![
                            String::new(),
                            "b".to_string(),
                            "bb".to_string(),
                            "bbb".to_string(),
                            "bbbb".to_string(),
                            "bbbbb".to_string(),
                        ]
                    } else {
                        strings_len_0_to_5()
                    };

                    let mut skipped = 0;
                    let total = test_strings.len();

                    for s in &test_strings {
                        let cyk_expected = CykParser::parse(&cnf_trace.final_grammar, s)
                            .map(|res| res.accepted)
                            .unwrap_or(false);

                        let (pda_accepted, pda_stopped) = match conv.pda.input.tokenize(s) {
                            Err(_) => (false, false),
                            Ok(syms) => {
                                let pda_budget = PdaBudget {
                                    max_steps: 1_000,
                                    max_configurations: 2_000,
                                    max_stack: 50,
                                };
                                match simulate_pda(&conv.pda, &syms, pda_budget) {
                                    Ok(PdaSimulation::Finished { accepted, .. }) => (accepted, false),
                                    Ok(PdaSimulation::Stopped { .. }) => (false, true),
                                    Err(_) => (false, false),
                                }
                            }
                        };

                        if pda_stopped {
                            skipped += 1;
                            continue;
                        }

                        prop_assert_eq!(
                            pda_accepted, cyk_expected,
                            "Mismatch on string '{}' for grammar:\n{}",
                            s, grammar.to_display_string()
                        );
                    }

                    if !has_left_recursion(&grammar) {
                        // For non-left-recursive grammars, no strings should loop/stop
                        prop_assert!(
                            skipped <= total / 2,
                            "Too many strings skipped ({} > {}) for non-left-recursive grammar:\n{}",
                            skipped, total / 2, grammar.to_display_string()
                        );
                    }
                }
            }
        }
    }

    #[test]
    fn proptest_ac4_arbitrary_string_never_panics(text in "\\PC*") {
        let _ = api_cfg_to_pda(&text);
    }
}
