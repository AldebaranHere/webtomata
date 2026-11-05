use engine_core::api::cfg_to_pda_bottomup as api_cfg_to_pda;
use engine_core::cfg_pda::{CfgPdaStep, StateName, cfg_to_pda_bottomup, cfg_to_pda_topdown};
use engine_core::grammar::{CnfTransformer, CykParser, Grammar, GrammarParser, Production, Symbol};
use engine_core::pda::{MAX_PDA_STRING, PdaKind, PdaWireTransition, validate_pda};
use engine_core::pda_simulate::{PdaBudget, PdaSimulation, simulate_pda};
use engine_core::{Message, Param, StateId, parse_pda_jff, to_pda_jff};
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

fn strings_len_0_to_4() -> Vec<String> {
    let mut result = Vec::with_capacity(31);
    result.push(String::new());
    let mut current_len = vec![String::new()];
    for _ in 1..=4 {
        let mut next_len = Vec::with_capacity(current_len.len() * 2);
        for s in &current_len {
            next_len.push(format!("{s}a"));
            next_len.push(format!("{s}b"));
        }
        result.extend(next_len.clone());
        current_len = next_len;
    }
    assert_eq!(result.len(), 31);
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
// 2. Three-oracle equivalence tests for F1 and F3 on all 511 strings
// ---------------------------------------------------------------------------

#[test]
fn test_three_oracle_equivalence_f1_all_511_strings() {
    let grammar_text = "S -> a S b | a b";
    let grammar = GrammarParser::parse(grammar_text).unwrap();
    let cnf = cnf_oracle(grammar_text);

    // Oracle (c): top-down PDA of T-034
    let topdown_res = cfg_to_pda_topdown(&grammar).expect("topdown succeeds");
    let topdown_pda = topdown_res.pda;

    // Bottom-up PDA
    let res = cfg_to_pda_bottomup(&grammar).expect("conversion succeeds");
    let strings = strings_len_0_to_8();

    for s in &strings {
        // Oracle (a): hand predicate
        let hand_exp = in_f1_predicate(s);

        // Oracle (b): CNF + CYK
        let cyk_exp = CykParser::parse(&cnf, s).unwrap().accepted;
        assert_eq!(hand_exp, cyk_exp, "Oracle (a) and (b) mismatch on '{}'", s);

        // Oracle (c): Top-down PDA simulation
        let topdown_syms = topdown_pda.input.tokenize(s).unwrap();
        let topdown_sim = simulate_pda(&topdown_pda, &topdown_syms, PdaBudget::default()).unwrap();
        let topdown_acc = match topdown_sim {
            PdaSimulation::Finished { accepted, .. } => accepted,
            PdaSimulation::Stopped { reason, .. } => {
                panic!("Top-down unexpectedly stopped on '{}': {:?}", s, reason)
            }
        };
        assert_eq!(
            hand_exp, topdown_acc,
            "Oracle (a) and (c) mismatch on '{}'",
            s
        );

        // Bottom-up PDA simulation: must be Finished and match all 3 oracles
        let bu_syms = res.pda.input.tokenize(s).unwrap();
        let bu_sim = simulate_pda(&res.pda, &bu_syms, PdaBudget::default()).unwrap();
        match bu_sim {
            PdaSimulation::Finished { accepted, .. } => {
                assert_eq!(
                    hand_exp, accepted,
                    "F1 Bottom-up PDA failed for '{}': expected={}, got={}",
                    s, hand_exp, accepted
                );
            }
            PdaSimulation::Stopped { reason, .. } => {
                panic!(
                    "F1 Bottom-up simulation unexpectedly stopped on '{}': {:?}",
                    s, reason
                );
            }
        }
    }
}

#[test]
fn test_three_oracle_equivalence_f3_all_511_strings() {
    let grammar_text = "S -> A B\nA -> a A | a\nB -> b B | b";
    let grammar = GrammarParser::parse(grammar_text).unwrap();
    let cnf = cnf_oracle(grammar_text);

    // Oracle (c): top-down PDA of T-034
    let topdown_res = cfg_to_pda_topdown(&grammar).expect("topdown succeeds");
    let topdown_pda = topdown_res.pda;

    // Bottom-up PDA
    let res = cfg_to_pda_bottomup(&grammar).expect("conversion succeeds");
    let strings = strings_len_0_to_8();

    for s in &strings {
        // Oracle (a): hand predicate
        let hand_exp = in_f3_predicate(s);

        // Oracle (b): CNF + CYK
        let cyk_exp = CykParser::parse(&cnf, s).unwrap().accepted;
        assert_eq!(hand_exp, cyk_exp, "Oracle (a) and (b) mismatch on '{}'", s);

        // Oracle (c): Top-down PDA simulation
        let topdown_syms = topdown_pda.input.tokenize(s).unwrap();
        let topdown_sim = simulate_pda(&topdown_pda, &topdown_syms, PdaBudget::default()).unwrap();
        let topdown_acc = match topdown_sim {
            PdaSimulation::Finished { accepted, .. } => accepted,
            PdaSimulation::Stopped { reason, .. } => {
                panic!("Top-down unexpectedly stopped on '{}': {:?}", s, reason)
            }
        };
        assert_eq!(
            hand_exp, topdown_acc,
            "Oracle (a) and (c) mismatch on '{}'",
            s
        );

        // Bottom-up PDA simulation: must be Finished and match all 3 oracles
        let bu_syms = res.pda.input.tokenize(s).unwrap();
        let bu_sim = simulate_pda(&res.pda, &bu_syms, PdaBudget::default()).unwrap();
        match bu_sim {
            PdaSimulation::Finished { accepted, .. } => {
                assert_eq!(
                    hand_exp, accepted,
                    "F3 Bottom-up PDA failed for '{}': expected={}, got={}",
                    s, hand_exp, accepted
                );
            }
            PdaSimulation::Stopped { reason, .. } => {
                panic!(
                    "F3 Bottom-up simulation unexpectedly stopped on '{}': {:?}",
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
    let res = cfg_to_pda_bottomup(&grammar).expect("conversion succeeds");

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

    // Steps (5 steps in exact trace order: shifts, reduces, accept)
    assert_eq!(res.steps.len(), 5);
    assert_eq!(
        res.steps[0],
        CfgPdaStep {
            transition: PdaWireTransition {
                from: 0,
                read: Some("a".to_string()),
                pop: vec![],
                push: vec!["a".to_string()],
                to: 0,
            },
            message: Message::new("cfg_pda.bottom_up.shift").with("symbol", "a"),
        }
    );
    assert_eq!(
        res.steps[1],
        CfgPdaStep {
            transition: PdaWireTransition {
                from: 0,
                read: Some("b".to_string()),
                pop: vec![],
                push: vec!["b".to_string()],
                to: 0,
            },
            message: Message::new("cfg_pda.bottom_up.shift").with("symbol", "b"),
        }
    );
    assert_eq!(
        res.steps[2],
        CfgPdaStep {
            transition: PdaWireTransition {
                from: 0,
                read: None,
                pop: vec!["b".to_string(), "S".to_string(), "a".to_string()],
                push: vec!["S".to_string()],
                to: 0,
            },
            message: Message::new("cfg_pda.bottom_up.reduce").with("rule", "S -> aSb"),
        }
    );
    assert_eq!(
        res.steps[3],
        CfgPdaStep {
            transition: PdaWireTransition {
                from: 0,
                read: None,
                pop: vec!["b".to_string(), "a".to_string()],
                push: vec!["S".to_string()],
                to: 0,
            },
            message: Message::new("cfg_pda.bottom_up.reduce").with("rule", "S -> ab"),
        }
    );
    assert_eq!(
        res.steps[4],
        CfgPdaStep {
            transition: PdaWireTransition {
                from: 0,
                read: None,
                pop: vec!["S".to_string()],
                push: vec![],
                to: 1,
            },
            message: Message::new("cfg_pda.bottom_up.accept"),
        }
    );

    // PDA transitions count
    assert_eq!(res.pda.transitions.len(), 5);

    // Validation
    let issues = validate_pda(&res.pda);
    assert_eq!(issues, vec![]);

    // Simulation checks: aabb and ab are accepted
    for word in &["ab", "aabb"] {
        let syms = res.pda.input.tokenize(word).unwrap();
        let sim = simulate_pda(&res.pda, &syms, PdaBudget::default()).unwrap();
        match sim {
            PdaSimulation::Finished { accepted, .. } => {
                assert!(accepted, "Expected '{word}' accepted")
            }
            _ => panic!("Expected Finished for '{word}'"),
        }
    }

    // Rejection checks: ε, a, b, aab, abb, ba
    for word in &["", "a", "b", "aab", "abb", "ba"] {
        let syms = res.pda.input.tokenize(word).unwrap();
        let sim = simulate_pda(&res.pda, &syms, PdaBudget::default()).unwrap();
        match sim {
            PdaSimulation::Finished { accepted, .. } => {
                assert!(!accepted, "Expected '{word}' rejected")
            }
            _ => panic!("Expected Finished for '{word}'"),
        }
    }
}

// ---------------------------------------------------------------------------
// 4. Fixture F2 details: S -> aSb | ε
// ---------------------------------------------------------------------------

#[test]
fn test_fixture_f2_details() {
    let grammar = GrammarParser::parse("S -> a S b | ε").unwrap();
    let res = cfg_to_pda_bottomup(&grammar).expect("conversion succeeds");

    assert_eq!(res.pda.input.names(), &["a", "b"]);
    assert_eq!(res.pda.stack.names(), &["S", "a", "b"]);
    assert_eq!(res.steps.len(), 5);

    // Step 0: shift a
    assert_eq!(res.steps[0].message.key, "cfg_pda.bottom_up.shift");
    // Step 1: shift b
    assert_eq!(res.steps[1].message.key, "cfg_pda.bottom_up.shift");
    // Step 2: reduce S -> aSb
    assert_eq!(
        res.steps[2],
        CfgPdaStep {
            transition: PdaWireTransition {
                from: 0,
                read: None,
                pop: vec!["b".to_string(), "S".to_string(), "a".to_string()],
                push: vec!["S".to_string()],
                to: 0,
            },
            message: Message::new("cfg_pda.bottom_up.reduce").with("rule", "S -> aSb"),
        }
    );
    // Step 3: reduce S -> ε: pop [], push ["S"]
    assert_eq!(
        res.steps[3],
        CfgPdaStep {
            transition: PdaWireTransition {
                from: 0,
                read: None,
                pop: vec![],
                push: vec!["S".to_string()],
                to: 0,
            },
            message: Message::new("cfg_pda.bottom_up.reduce").with("rule", "S -> ε"),
        }
    );
    // Step 4: accept
    assert_eq!(
        res.steps[4],
        CfgPdaStep {
            transition: PdaWireTransition {
                from: 0,
                read: None,
                pop: vec!["S".to_string()],
                push: vec![],
                to: 1,
            },
            message: Message::new("cfg_pda.bottom_up.accept"),
        }
    );

    // Simulation of ε: must be accepted!
    let syms_empty = res.pda.input.tokenize("").unwrap();
    let sim_empty = simulate_pda(&res.pda, &syms_empty, PdaBudget::default()).unwrap();
    match sim_empty {
        PdaSimulation::Finished { accepted, .. } => assert!(accepted, "ε must be accepted"),
        _ => panic!("Expected Finished for ε"),
    }

    // Simulation of ab: must be accepted!
    let syms_ab = res.pda.input.tokenize("ab").unwrap();
    let sim_ab = simulate_pda(&res.pda, &syms_ab, PdaBudget::default()).unwrap();
    match sim_ab {
        PdaSimulation::Finished { accepted, .. } => assert!(accepted, "'ab' must be accepted"),
        _ => panic!("Expected Finished for 'ab'"),
    }
}

// ---------------------------------------------------------------------------
// 5. Fixture F3 details: S -> AB, A -> aA | a, B -> bB | b
// ---------------------------------------------------------------------------

#[test]
fn test_fixture_f3_details() {
    let grammar = GrammarParser::parse("S -> A B\nA -> a A | a\nB -> b B | b").unwrap();
    let res = cfg_to_pda_bottomup(&grammar).expect("conversion succeeds");

    assert_eq!(res.pda.input.names(), &["a", "b"]);
    assert_eq!(res.pda.stack.names(), &["A", "B", "S", "a", "b"]);
    assert_eq!(res.steps.len(), 8);

    // Check reduce S -> AB: pops [B, A], pushes [S]
    assert_eq!(
        res.steps[2],
        CfgPdaStep {
            transition: PdaWireTransition {
                from: 0,
                read: None,
                pop: vec!["B".to_string(), "A".to_string()],
                push: vec!["S".to_string()],
                to: 0,
            },
            message: Message::new("cfg_pda.bottom_up.reduce").with("rule", "S -> AB"),
        }
    );

    // Check reduce A -> aA: pops [A, a], pushes [A]
    assert_eq!(
        res.steps[3],
        CfgPdaStep {
            transition: PdaWireTransition {
                from: 0,
                read: None,
                pop: vec!["A".to_string(), "a".to_string()],
                push: vec!["A".to_string()],
                to: 0,
            },
            message: Message::new("cfg_pda.bottom_up.reduce").with("rule", "A -> aA"),
        }
    );

    // Check reduce A -> a: pops [a], pushes [A]
    assert_eq!(
        res.steps[4],
        CfgPdaStep {
            transition: PdaWireTransition {
                from: 0,
                read: None,
                pop: vec!["a".to_string()],
                push: vec!["A".to_string()],
                to: 0,
            },
            message: Message::new("cfg_pda.bottom_up.reduce").with("rule", "A -> a"),
        }
    );

    // Check reduce B -> bB: pops [B, b], pushes [B]
    assert_eq!(
        res.steps[5],
        CfgPdaStep {
            transition: PdaWireTransition {
                from: 0,
                read: None,
                pop: vec!["B".to_string(), "b".to_string()],
                push: vec!["B".to_string()],
                to: 0,
            },
            message: Message::new("cfg_pda.bottom_up.reduce").with("rule", "B -> bB"),
        }
    );

    // Check reduce B -> b: pops [b], pushes [B]
    assert_eq!(
        res.steps[6],
        CfgPdaStep {
            transition: PdaWireTransition {
                from: 0,
                read: None,
                pop: vec!["b".to_string()],
                push: vec!["B".to_string()],
                to: 0,
            },
            message: Message::new("cfg_pda.bottom_up.reduce").with("rule", "B -> b"),
        }
    );

    // Check accept step: pops [S], to 1
    assert_eq!(
        res.steps[7],
        CfgPdaStep {
            transition: PdaWireTransition {
                from: 0,
                read: None,
                pop: vec!["S".to_string()],
                push: vec![],
                to: 1,
            },
            message: Message::new("cfg_pda.bottom_up.accept"),
        }
    );

    // Validation
    assert_eq!(validate_pda(&res.pda), vec![]);

    // ab is accepted
    let syms = res.pda.input.tokenize("ab").unwrap();
    let sim = simulate_pda(&res.pda, &syms, PdaBudget::default()).unwrap();
    match sim {
        PdaSimulation::Finished { accepted, .. } => assert!(accepted),
        _ => panic!("Expected Finished for 'ab'"),
    }
}

// ---------------------------------------------------------------------------
// 6. Fixture F4: Error handling, limits, deduplication, JFLAP export
// ---------------------------------------------------------------------------

#[test]
fn test_fixture_f4_duplicate_rules_merged() {
    let grammar = GrammarParser::parse("S -> a | a").unwrap();
    let res = cfg_to_pda_bottomup(&grammar).expect("conversion succeeds");
    // Duplicate merged: 1 shift + 1 reduce + 1 accept = 3 steps
    assert_eq!(res.steps.len(), 3);
    assert_eq!(res.pda.transitions.len(), 3);
}

#[test]
fn test_fixture_f4_symbol_clash() {
    let grammar = GrammarParser::parse("S -> a <a>").unwrap();
    let err = cfg_to_pda_bottomup(&grammar).unwrap_err();
    assert_eq!(err.key, "pda.cfg.symbol_clash");
    assert_eq!(
        err.params.get("symbol"),
        Some(&Param::Text("a".to_string()))
    );
}

#[test]
fn test_fixture_f4_error_precedence_clash_over_body_length() {
    // Note 1: Test with a grammar that has both a clash and a 65-symbol body.
    // Error precedence must check clash before body length!
    let long_body = "a ".repeat(65);
    let grammar_text = format!("S -> a <a> | {long_body}");
    let grammar = GrammarParser::parse(&grammar_text).unwrap();
    let err = cfg_to_pda_bottomup(&grammar).unwrap_err();
    assert_eq!(
        err.key, "pda.cfg.symbol_clash",
        "Error precedence: clash must precede limit_exceeded"
    );
    assert_eq!(
        err.params.get("symbol"),
        Some(&Param::Text("a".to_string()))
    );
}

#[test]
fn test_fixture_f4_limit_exceeded_65_symbols() {
    let rhs: String = "a".repeat(MAX_PDA_STRING + 1);
    let grammar_text = format!("S -> {rhs}");
    let grammar = GrammarParser::parse(&grammar_text).unwrap();
    let err = cfg_to_pda_bottomup(&grammar).unwrap_err();
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
fn test_fixture_f4_multi_character_variable_and_jff() {
    let grammar = GrammarParser::parse("S0 -> a S0 b | a b").unwrap();
    let res = cfg_to_pda_bottomup(&grammar).expect("conversion succeeds");
    assert_eq!(res.pda.stack.names(), &["S0", "a", "b"]);

    // JFLAP export fails with symbol_not_single_character
    let export_err = to_pda_jff(&res.pda, &[]).unwrap_err();
    assert_eq!(export_err.key, "jff.symbol_not_single_character");
    assert_eq!(
        export_err.params.get("symbol"),
        Some(&Param::Text("S0".to_string()))
    );

    // Single-character F1 round-trip
    let grammar_f1 = GrammarParser::parse("S -> a S b | a b").unwrap();
    let res_f1 = cfg_to_pda_bottomup(&grammar_f1).unwrap();
    let jff_xml = to_pda_jff(&res_f1.pda, &[]).unwrap();
    let imported = parse_pda_jff(&jff_xml).unwrap();
    assert_eq!(imported.pda.transitions, res_f1.pda.transitions);
}

// ---------------------------------------------------------------------------
// 7. Fixture F5: ε-rules and budget (Decision 5)
// ---------------------------------------------------------------------------

#[test]
fn test_fixture_f5_epsilon_rules_and_budget() {
    let grammar = GrammarParser::parse("S -> a S b | ε").unwrap();
    let res = cfg_to_pda_bottomup(&grammar).expect("conversion succeeds");

    let budget = PdaBudget {
        max_steps: 200,
        max_configurations: 20_000,
        max_stack: 12,
    };

    let strings = strings_len_0_to_4();
    assert_eq!(strings.len(), 31);

    let mut finished_count = 0;
    let mut stopped_count = 0;
    let mut accepted_count = 0;

    for s in &strings {
        let is_in_lang = in_f2_predicate(s);
        let syms = res.pda.input.tokenize(s).unwrap();
        let sim = simulate_pda(&res.pda, &syms, budget).unwrap();

        match sim {
            PdaSimulation::Finished { accepted, .. } => {
                finished_count += 1;
                if accepted {
                    accepted_count += 1;
                    assert!(
                        is_in_lang,
                        "String '{}' was accepted but is not in language a^n b^n",
                        s
                    );
                } else {
                    assert!(
                        !is_in_lang,
                        "String '{}' is in language but was Finished with accepted=false",
                        s
                    );
                }
            }
            PdaSimulation::Stopped { reason, .. } => {
                stopped_count += 1;
                assert!(
                    !is_in_lang,
                    "String '{}' in language was Stopped with {:?}",
                    s, reason
                );
            }
        }
    }

    // Languages strings in length 0..=4: "", "ab", "aabb" (3 strings)
    assert_eq!(accepted_count, 3);
    assert_eq!(finished_count + stopped_count, 31);
    println!(
        "F5 counts: finished={}, stopped={}, accepted={}",
        finished_count, stopped_count, accepted_count
    );
}

// ---------------------------------------------------------------------------
// 8. AC3 Property tests: Small random grammars
// ---------------------------------------------------------------------------

// Generator for grammars WITHOUT epsilon rules (bodies of 1 to 3 symbols)
fn arb_grammar_no_epsilon() -> impl Strategy<Value = Grammar> {
    let symbols = vec![
        Symbol::Terminal('a'),
        Symbol::Terminal('b'),
        Symbol::NonTerminal("S".to_string()),
        Symbol::NonTerminal("A".to_string()),
        Symbol::NonTerminal("B".to_string()),
    ];

    let arb_body = proptest::collection::vec(proptest::sample::select(symbols), 1..=3);
    let arb_rules_for_head = |head: &'static str| {
        let arb_body = arb_body.clone();
        proptest::collection::vec(arb_body, 1..=4).prop_map(move |bodies| {
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

// Generator for grammars WITH epsilon rules allowed (bodies of 0 to 3 symbols)
fn arb_grammar_with_epsilon() -> impl Strategy<Value = Grammar> {
    let symbols = vec![
        Symbol::Terminal('a'),
        Symbol::Terminal('b'),
        Symbol::NonTerminal("S".to_string()),
        Symbol::NonTerminal("A".to_string()),
        Symbol::NonTerminal("B".to_string()),
    ];

    let arb_body = proptest::collection::vec(proptest::sample::select(symbols), 0..=3);
    let arb_rules_for_head = |head: &'static str| {
        let arb_body = arb_body.clone();
        proptest::collection::vec(arb_body, 1..=4).prop_map(move |bodies| {
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

proptest! {
    #![proptest_config(ProptestConfig::with_cases(50))]

    #[test]
    fn proptest_ac3_small_grammars_no_epsilon(grammar in arb_grammar_no_epsilon()) {
        let conv_res = cfg_to_pda_bottomup(&grammar);
        match conv_res {
            Err(msg) => {
                prop_assert!(
                    msg.key == "pda.cfg.symbol_clash"
                        || msg.key == "machine.limit_exceeded"
                        || msg.key == "machine.invalid_symbol",
                    "Unexpected error: {}",
                    msg.key
                );
            }
            Ok(res) => {
                // Steps = terminals + distinct rules + 1
                let term_count = grammar.terminals().len();
                let mut distinct_rules = BTreeSet::new();
                for r in &grammar.rules {
                    distinct_rules.insert((&r.head, &r.body));
                }
                prop_assert_eq!(res.steps.len(), term_count + distinct_rules.len() + 1);

                // validate_pda has no issue other than pop_never_pushed
                let issues = validate_pda(&res.pda);
                for issue in &issues {
                    prop_assert!(issue.message.key == "pda.pop_never_pushed");
                }

                // Equivalence comparison against CYK on CNF form for all strings up to length 5
                if let Ok(trace) = CnfTransformer::transform(&grammar) {
                    let cnf = trace.final_grammar;
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

                    for s in &test_strings {
                        let cyk_acc = CykParser::parse(&cnf, s).unwrap().accepted;
                        let syms = res.pda.input.tokenize(s).unwrap();
                        let sim = simulate_pda(&res.pda, &syms, PdaBudget::default()).unwrap();
                        match sim {
                            PdaSimulation::Finished { accepted, .. } => {
                                prop_assert_eq!(
                                    accepted, cyk_acc,
                                    "Mismatch on string '{}': pda={}, cyk={}",
                                    s, accepted, cyk_acc
                                );
                            }
                            PdaSimulation::Stopped { reason, .. } => {
                                prop_assert!(
                                    false,
                                    "Simulation without epsilon rules must never be Stopped! Stopped on '{}' with {:?}",
                                    s, reason
                                );
                            }
                        }
                    }
                }
            }
        }
    }

    #[test]
    fn proptest_ac3_small_grammars_with_epsilon(grammar in arb_grammar_with_epsilon()) {
        let conv_res = cfg_to_pda_bottomup(&grammar);
        match conv_res {
            Err(msg) => {
                prop_assert!(
                    msg.key == "pda.cfg.symbol_clash"
                        || msg.key == "machine.limit_exceeded"
                        || msg.key == "machine.invalid_symbol",
                    "Unexpected error: {}",
                    msg.key
                );
            }
            Ok(res) => {
                if let Ok(trace) = CnfTransformer::transform(&grammar) {
                    let cnf = trace.final_grammar;
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
                        ]
                    } else if terms == vec!['b'] {
                        vec![
                            String::new(),
                            "b".to_string(),
                            "bb".to_string(),
                            "bbb".to_string(),
                            "bbbb".to_string(),
                        ]
                    } else {
                        strings_len_0_to_4()
                    };

                    for s in &test_strings {
                        let cyk_acc = CykParser::parse(&cnf, s).unwrap().accepted;
                        let syms = res.pda.input.tokenize(s).unwrap();
                        let budget = PdaBudget {
                            max_steps: 200,
                            max_configurations: 5_000,
                            max_stack: 15,
                        };
                        let sim = simulate_pda(&res.pda, &syms, budget).unwrap();
                        match sim {
                            PdaSimulation::Finished { accepted, .. } => {
                                prop_assert_eq!(
                                    accepted, cyk_acc,
                                    "Mismatch on '{}': pda={}, cyk={}",
                                    s, accepted, cyk_acc
                                );
                            }
                            PdaSimulation::Stopped { .. } => {
                                // Skip string when Stopped
                            }
                        }
                        // Crucial condition: no string that CYK rejects is ever accepted!
                        if let PdaSimulation::Finished { accepted: true, .. } = sim {
                            prop_assert!(cyk_acc, "PDA accepted '{}' but CYK rejected it!", s);
                        }
                    }
                }
            }
        }
    }

    #[test]
    fn proptest_ac4_arbitrary_string_never_panics(text in ".*") {
        let _ = api_cfg_to_pda(&text);
    }
}
