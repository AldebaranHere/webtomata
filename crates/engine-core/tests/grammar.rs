use std::collections::BTreeSet;

use engine_core::grammar::{CnfTransformer, CykParser, Grammar, GrammarParser, Production, Symbol};
use proptest::prelude::*;

#[test]
fn test_parse_simple_grammar() {
    let input = r#"
        # CFG for balanced parentheses or simple strings
        S -> a S b | ε
    "#;
    let grammar = GrammarParser::parse(input).expect("Should parse simple grammar");
    assert_eq!(grammar.start, "S");
    assert_eq!(grammar.rules.len(), 2);
    assert_eq!(grammar.rules[0].head, "S");
    assert_eq!(
        grammar.rules[0].body,
        vec![
            Symbol::Terminal('a'),
            Symbol::NonTerminal("S".into()),
            Symbol::Terminal('b'),
        ]
    );
    assert!(grammar.rules[1].body.is_empty());
}

#[test]
fn test_parse_arrow_variants_and_empty_symbols() {
    let input = "
        S → A | B
        A ::= a | λ
        B -> b | ^ | epsilon
    ";
    let grammar = GrammarParser::parse(input).expect("Should parse arrow variants");
    assert_eq!(grammar.start, "S");
    // S -> A | B (2 rules), A -> a | λ (2 rules), B -> b | ^ | epsilon (3 rules)
    assert_eq!(grammar.rules.len(), 7);
}

#[test]
fn test_cnf_transformation_trace_6_phases() {
    // S -> a S b | a b
    let input = "S -> a S b | a b";
    let grammar = GrammarParser::parse(input).unwrap();
    let trace = CnfTransformer::transform(&grammar).unwrap();

    assert_eq!(trace.steps.len(), 6);
    assert_eq!(trace.steps[0].phase, 1);
    assert_eq!(trace.steps[1].phase, 2);
    assert_eq!(trace.steps[2].phase, 3);
    assert_eq!(trace.steps[3].phase, 4);
    assert_eq!(trace.steps[4].phase, 5);
    assert_eq!(trace.steps[5].phase, 6);

    // Verify final grammar is strictly CNF
    assert!(CykParser::is_cnf(&trace.final_grammar));
}

fn assert_valid_cnf(grammar: &Grammar) {
    assert!(
        CykParser::is_cnf(grammar),
        "Final grammar must be CNF:\n{}",
        grammar.to_display_string()
    );
    let has_empty = grammar
        .rules
        .iter()
        .any(|r| r.head == grammar.start && r.body.is_empty());
    if has_empty {
        let appears_on_right = grammar.rules.iter().any(|r| {
            r.body.iter().any(|sym| match sym {
                Symbol::NonTerminal(nt) => nt == &grammar.start,
                _ => false,
            })
        });
        assert!(
            !appears_on_right,
            "Start symbol {} must not appear on RHS when S -> ε exists",
            grammar.start
        );
    }
}

fn check_exhaustive_cyk<F>(grammar: &Grammar, alphabet: &[char], max_len: usize, mut oracle: F)
where
    F: FnMut(&str) -> bool,
{
    fn dfs(
        grammar: &Grammar,
        current: &mut String,
        max_len: usize,
        alphabet: &[char],
        oracle: &mut impl FnMut(&str) -> bool,
    ) {
        let expected = oracle(current);
        let result = CykParser::parse(grammar, current).expect("CYK parse should succeed");
        assert_eq!(
            result.accepted, expected,
            "CYK acceptance mismatch for word '{}' (expected {})",
            current, expected
        );
        if current.len() < max_len {
            for &c in alphabet {
                current.push(c);
                dfs(grammar, current, max_len, alphabet, oracle);
                current.pop();
            }
        }
    }

    let mut current = String::with_capacity(max_len);
    dfs(grammar, &mut current, max_len, alphabet, &mut oracle);
}

#[test]
fn test_cnf_preset_order() {
    let input = r#"
        S -> a | A B
        A -> a
        B -> B b
    "#;
    let grammar = GrammarParser::parse(input).expect("Should parse CNF_ORDER");
    let trace = CnfTransformer::transform(&grammar).expect("CNF transformation should succeed");
    assert_valid_cnf(&trace.final_grammar);

    // AC3: CNF_ORDER ends as exactly S -> a
    assert_eq!(
        trace.final_grammar.rules.len(),
        1,
        "CNF_ORDER should end with exactly 1 rule"
    );
    assert_eq!(trace.final_grammar.rules[0].head, "S");
    assert_eq!(
        trace.final_grammar.rules[0].body,
        vec![Symbol::Terminal('a')]
    );

    // AC2: Exhaustive CYK check for all strings over {a, b} up to length 8
    check_exhaustive_cyk(&trace.final_grammar, &['a', 'b'], 8, |w| w == "a");
}

#[test]
fn test_cnf_preset_nullable() {
    let input = r#"
        S -> A B C
        A -> a A | ε
        B -> b B | A
        C -> c | ε
    "#;
    let grammar = GrammarParser::parse(input).expect("Should parse CNF_NULLABLE");
    let trace = CnfTransformer::transform(&grammar).expect("CNF transformation should succeed");
    assert_valid_cnf(&trace.final_grammar);

    // AC2: Language oracle for a* b* a* (c or empty)
    check_exhaustive_cyk(&trace.final_grammar, &['a', 'b', 'c'], 8, |w| {
        let mut chars = w.chars().peekable();
        while chars.peek() == Some(&'a') {
            chars.next();
        }
        while chars.peek() == Some(&'b') {
            chars.next();
        }
        while chars.peek() == Some(&'a') {
            chars.next();
        }
        if chars.peek() == Some(&'c') {
            chars.next();
        }
        chars.next().is_none()
    });
}

#[test]
fn test_cnf_preset_start_long() {
    let input = r#"
        S -> x S y y | z
    "#;
    let grammar = GrammarParser::parse(input).expect("Should parse CNF_START_LONG");
    let trace = CnfTransformer::transform(&grammar).expect("CNF transformation should succeed");
    assert_valid_cnf(&trace.final_grammar);

    // AC1: With the default, CNF_START_LONG makes separate helper variables for S0 and S
    let s0_binary: Vec<_> = trace
        .final_grammar
        .rules
        .iter()
        .filter(|r| r.head == "S0" && r.body.len() == 2)
        .collect();
    let s_binary: Vec<_> = trace
        .final_grammar
        .rules
        .iter()
        .filter(|r| r.head == "S" && r.body.len() == 2)
        .collect();
    assert_eq!(s0_binary.len(), 1, "S0 should have 1 binary rule");
    assert_eq!(s_binary.len(), 1, "S should have 1 binary rule");
    assert_ne!(
        s0_binary[0].body[1], s_binary[0].body[1],
        "Default course method must not share helper variables between S0 and S"
    );

    // AC1: With share_helpers: true, they share them (the behavior of today)
    let trace_shared = CnfTransformer::transform_with_options(&grammar, true)
        .expect("CNF transformation with share_helpers should succeed");
    assert_valid_cnf(&trace_shared.final_grammar);
    let s0_binary_shared: Vec<_> = trace_shared
        .final_grammar
        .rules
        .iter()
        .filter(|r| r.head == "S0" && r.body.len() == 2)
        .collect();
    let s_binary_shared: Vec<_> = trace_shared
        .final_grammar
        .rules
        .iter()
        .filter(|r| r.head == "S" && r.body.len() == 2)
        .collect();
    assert_eq!(s0_binary_shared.len(), 1);
    assert_eq!(s_binary_shared.len(), 1);
    assert_eq!(
        s0_binary_shared[0].body[1], s_binary_shared[0].body[1],
        "With share_helpers: true, S0 and S must share helper variables"
    );

    // AC2: Language oracle for x^n z y^{2n}, n >= 0
    check_exhaustive_cyk(&trace.final_grammar, &['x', 'y', 'z'], 8, |w| {
        let n_x = w.chars().take_while(|&c| c == 'x').count();
        let rem = &w[n_x..];
        if !rem.starts_with('z') {
            return false;
        }
        let y_part = &rem[1..];
        if y_part.len() != 2 * n_x {
            return false;
        }
        y_part.chars().all(|c| c == 'y')
    });
}

#[test]
fn test_cnf_preset_unit_chain() {
    let input = r#"
        S -> A
        A -> B
        B -> C | b b
        C -> c C | c
    "#;
    let grammar = GrammarParser::parse(input).expect("Should parse CNF_UNIT_CHAIN");
    let trace = CnfTransformer::transform(&grammar).expect("CNF transformation should succeed");
    assert_valid_cnf(&trace.final_grammar);

    // AC3: CNF_UNIT_CHAIN ends with no A or B and with the rules shown (compare structure, not names)
    // Expected structure: S -> T_b T_b | T_c C | c, C -> T_c C | c, T_b -> b, T_c -> c
    let final_vars = trace.final_grammar.variables();
    assert!(!final_vars.contains("A"), "A should be eliminated");
    assert!(!final_vars.contains("B"), "B should be eliminated");

    // S must have 3 rules: [T_b, T_b], [T_c, C], [c]
    // C must have 2 rules: [T_c, C], [c]
    // T_b must have 1 rule: [b]
    // T_c must have 1 rule: [c]
    let s_rules: Vec<_> = trace
        .final_grammar
        .rules
        .iter()
        .filter(|r| r.head == "S")
        .collect();
    let c_rules: Vec<_> = trace
        .final_grammar
        .rules
        .iter()
        .filter(|r| r.head == "C")
        .collect();
    assert_eq!(s_rules.len(), 3, "S should have exactly 3 rules");
    assert_eq!(c_rules.len(), 2, "C should have exactly 2 rules");

    // Find helper variable for 'c' (distinct from C and S) and 'b'
    let t_c_rule = trace
        .final_grammar
        .rules
        .iter()
        .find(|r| r.head != "C" && r.head != "S" && r.body == vec![Symbol::Terminal('c')]);
    assert!(
        t_c_rule.is_some(),
        "Helper variable for terminal 'c' must exist in final grammar:\n{}",
        trace.final_grammar.to_display_string()
    );
    let t_c = t_c_rule.unwrap().head.clone();

    let t_b_rule = trace
        .final_grammar
        .rules
        .iter()
        .find(|r| r.body == vec![Symbol::Terminal('b')]);
    assert!(
        t_b_rule.is_some(),
        "Helper variable for terminal 'b' must exist"
    );
    let t_b = t_b_rule.unwrap().head.clone();

    // Verify S rules
    assert!(
        s_rules
            .iter()
            .any(|r| r.body == vec![Symbol::Terminal('c')])
    );
    assert!(s_rules.iter().any(|r| {
        r.body
            == vec![
                Symbol::NonTerminal(t_b.clone()),
                Symbol::NonTerminal(t_b.clone()),
            ]
    }));
    assert!(s_rules.iter().any(|r| {
        r.body
            == vec![
                Symbol::NonTerminal(t_c.clone()),
                Symbol::NonTerminal("C".into()),
            ]
    }));

    // Verify C rules
    assert!(
        c_rules
            .iter()
            .any(|r| r.body == vec![Symbol::Terminal('c')])
    );
    assert!(c_rules.iter().any(|r| {
        r.body
            == vec![
                Symbol::NonTerminal(t_c.clone()),
                Symbol::NonTerminal("C".into()),
            ]
    }));

    // AC2: Language oracle for {bb} U c+
    check_exhaustive_cyk(&trace.final_grammar, &['b', 'c'], 8, |w| {
        w == "bb" || (!w.is_empty() && w.chars().all(|c| c == 'c'))
    });
}

#[test]
fn test_cnf_preset_shared_tail() {
    let input = r#"
        S -> a B C D | b B C D
        B -> x
        C -> y
        D -> z
    "#;
    let grammar = GrammarParser::parse(input).expect("Should parse CNF_SHARED_TAIL");
    let trace = CnfTransformer::transform(&grammar).expect("CNF transformation should succeed");
    assert_valid_cnf(&trace.final_grammar);

    // AC2: Default has two separate helper chains:
    let s_binary: Vec<_> = trace
        .final_grammar
        .rules
        .iter()
        .filter(|r| r.head == "S" && r.body.len() == 2)
        .collect();
    assert_eq!(s_binary.len(), 2, "S should have 2 binary rules");
    assert_ne!(
        s_binary[0].body[1], s_binary[1].body[1],
        "Default course method must not share helper chains for S -> a B C D | b B C D"
    );

    // AC2: Language oracle for {axyz, bxyz}
    check_exhaustive_cyk(&trace.final_grammar, &['a', 'b', 'x', 'y', 'z'], 8, |w| {
        w == "axyz" || w == "bxyz"
    });

    // AC2: With true, the tail is shared:
    let trace_shared = CnfTransformer::transform_with_options(&grammar, true)
        .expect("CNF transformation with share_helpers should succeed");
    assert_valid_cnf(&trace_shared.final_grammar);
    let s_binary_shared: Vec<_> = trace_shared
        .final_grammar
        .rules
        .iter()
        .filter(|r| r.head == "S" && r.body.len() == 2)
        .collect();
    assert_eq!(
        s_binary_shared.len(),
        2,
        "S should have 2 binary rules in shared mode"
    );
    assert_eq!(
        s_binary_shared[0].body[1], s_binary_shared[1].body[1],
        "With share_helpers: true, the tail helper variable must be shared"
    );

    // Both versions accept the same language {axyz, bxyz}
    check_exhaustive_cyk(
        &trace_shared.final_grammar,
        &['a', 'b', 'x', 'y', 'z'],
        8,
        |w| w == "axyz" || w == "bxyz",
    );
}

#[test]
fn test_cnf_slide_example_eliminating_long_rhs() {
    // AC3: A test written from the slide example A -> B C D E gives exactly
    // A -> B M1, M1 -> C M2, M2 -> D E (names of helpers may differ; compare structure)
    let input = r#"
        A -> B C D E
        B -> b
        C -> c
        D -> d
        E -> e
    "#;
    let grammar = GrammarParser::parse(input).expect("Should parse grammar");
    let trace = CnfTransformer::transform(&grammar).expect("CNF transformation should succeed");
    assert_valid_cnf(&trace.final_grammar);

    // Find the rule for A: A -> B M1
    let a_rules: Vec<_> = trace
        .final_grammar
        .rules
        .iter()
        .filter(|r| r.head == "A")
        .collect();
    assert_eq!(a_rules.len(), 1, "A should have 1 rule");
    assert_eq!(a_rules[0].body.len(), 2, "A rule should be binary");
    assert_eq!(a_rules[0].body[0], Symbol::NonTerminal("B".into()));
    let m1 = match &a_rules[0].body[1] {
        Symbol::NonTerminal(name) => name.clone(),
        _ => panic!("Expected NonTerminal for M1"),
    };

    // Find rule for M1: M1 -> C M2
    let m1_rules: Vec<_> = trace
        .final_grammar
        .rules
        .iter()
        .filter(|r| r.head == m1)
        .collect();
    assert_eq!(m1_rules.len(), 1, "M1 should have exactly 1 rule");
    assert_eq!(m1_rules[0].body.len(), 2, "M1 rule should be binary");
    assert_eq!(m1_rules[0].body[0], Symbol::NonTerminal("C".into()));
    let m2 = match &m1_rules[0].body[1] {
        Symbol::NonTerminal(name) => name.clone(),
        _ => panic!("Expected NonTerminal for M2"),
    };

    // Find rule for M2: M2 -> D E
    let m2_rules: Vec<_> = trace
        .final_grammar
        .rules
        .iter()
        .filter(|r| r.head == m2)
        .collect();
    assert_eq!(m2_rules.len(), 1, "M2 should have exactly 1 rule");
    assert_eq!(
        m2_rules[0].body,
        vec![
            Symbol::NonTerminal("D".into()),
            Symbol::NonTerminal("E".into())
        ],
        "M2 must expand to D E"
    );

    assert_ne!(m1, m2, "M1 and M2 must be distinct helper variables");
}

#[test]
fn test_cyk_parser_on_cnf() {
    // S -> A B | B C
    // A -> B A | a
    // B -> C C | b
    // C -> A B | a
    let cnf_src = r#"
        S -> A B | B C
        A -> B A | a
        B -> C C | b
        C -> A B | a
    "#;
    let grammar = GrammarParser::parse(cnf_src).unwrap();
    assert!(CykParser::is_cnf(&grammar));

    // Test string "baaba"
    let result = CykParser::parse(&grammar, "baaba").unwrap();
    assert!(result.accepted, "baaba should be accepted");
    assert_eq!(result.table.len(), 5);

    // Test rejected string
    let rejected = CykParser::parse(&grammar, "bb").unwrap();
    assert!(!rejected.accepted, "bb should be rejected");
}

#[test]
fn test_cyk_empty_string() {
    // S -> A B | ε
    // A -> a
    // B -> b
    let cnf_src = "S -> A B | ε\nA -> a\nB -> b";
    let grammar = GrammarParser::parse(cnf_src).unwrap();
    assert!(CykParser::is_cnf(&grammar));

    let res_empty = CykParser::parse(&grammar, "").unwrap();
    assert!(res_empty.accepted);

    let res_ab = CykParser::parse(&grammar, "ab").unwrap();
    assert!(res_ab.accepted);

    let res_a = CykParser::parse(&grammar, "a").unwrap();
    assert!(!res_a.accepted);
}

#[test]
fn test_full_pipeline_cfg_to_cnf_to_cyk() {
    // Palindrome CFG: S -> a S a | b S b | a | b | ε
    // Note: CYK on transformed CNF will correctly recognize palindromes!
    let cfg = "S -> a S a | b S b | a | b | ε";
    let grammar = GrammarParser::parse(cfg).unwrap();
    let trace = CnfTransformer::transform(&grammar).unwrap();
    let cnf_grammar = trace.final_grammar;

    assert!(CykParser::is_cnf(&cnf_grammar));

    let cases = vec![
        ("", true),
        ("a", true),
        ("b", true),
        ("aba", true),
        ("abba", true),
        ("ab", false),
        ("abb", false),
        ("aab", false),
    ];

    for (word, expected) in cases {
        let res = CykParser::parse(&cnf_grammar, word).unwrap();
        assert_eq!(
            res.accepted, expected,
            "Word '{}' acceptance mismatch (expected {})",
            word, expected
        );
    }
}

#[test]
fn test_cnf_variable_deduplication_step6() {
    let input = r#"
        S -> a A B | A a | b D
        A -> a B | B S | ε
        B -> a | A b | ε
        C -> a A | b B
        D -> b D
    "#;
    let grammar = GrammarParser::parse(input).expect("Should parse grammar");

    // Course method default: no sharing between rules
    let trace_default =
        CnfTransformer::transform(&grammar).expect("CNF transformation should succeed");
    assert!(
        CykParser::is_cnf(&trace_default.final_grammar),
        "Final grammar must be CNF:\n{}",
        trace_default.final_grammar.to_display_string()
    );
    let default_rules_with_ab: Vec<_> = trace_default
        .final_grammar
        .rules
        .iter()
        .filter(|r| {
            r.body
                == vec![
                    Symbol::NonTerminal("A".into()),
                    Symbol::NonTerminal("B".into()),
                ]
        })
        .collect();
    // In course default, each rule gets its own helper variable (3 rules for S0, A, S)
    assert_eq!(
        default_rules_with_ab.len(),
        3,
        "Course default must produce separate helper rules"
    );

    // Option share_helpers: true enables deduplication (behavior of commit a82bf0e)
    let trace = CnfTransformer::transform_with_options(&grammar, true)
        .expect("CNF transformation with share_helpers should succeed");

    assert!(
        CykParser::is_cnf(&trace.final_grammar),
        "Final grammar must be CNF:\n{}",
        trace.final_grammar.to_display_string()
    );

    // Verify deduplication: exactly one rule for X -> A B exists, and S0, A, S all point to X
    let rules_with_ab: Vec<_> = trace
        .final_grammar
        .rules
        .iter()
        .filter(|r| {
            r.body
                == vec![
                    Symbol::NonTerminal("A".into()),
                    Symbol::NonTerminal("B".into()),
                ]
        })
        .collect();

    assert_eq!(
        rules_with_ab.len(),
        1,
        "Expected exactly 1 rule deriving AB with share_helpers: true, found: {:?}",
        rules_with_ab
    );
    let helper_var = &rules_with_ab[0].head;
    assert_eq!(helper_var, "X");

    // Check S0, A, S all have rule with [T_a, X]
    for head in &["S0", "A", "S"] {
        let has_rule = trace.final_grammar.rules.iter().any(|r| {
            &r.head == head
                && r.body
                    == vec![
                        Symbol::NonTerminal("T_a".into()),
                        Symbol::NonTerminal("X".into()),
                    ]
        });
        assert!(
            has_rule,
            "Expected {} -> T_a X in final grammar with share_helpers: true:\n{}",
            head,
            trace.final_grammar.to_display_string()
        );
    }
}

fn grammar_to_text(grammar: &Grammar) -> String {
    let mut result = String::new();
    let mut seen_heads = BTreeSet::new();

    let mut heads = vec![grammar.start.clone()];
    for r in &grammar.rules {
        if !heads.contains(&r.head) {
            heads.push(r.head.clone());
        }
    }

    for head in heads {
        if !seen_heads.insert(head.clone()) {
            continue;
        }
        let bodies: Vec<&Production> = grammar.rules.iter().filter(|r| r.head == head).collect();
        if bodies.is_empty() {
            continue;
        }
        if !result.is_empty() {
            result.push('\n');
        }
        result.push_str(&head);
        result.push_str(" -> ");
        for (i, p) in bodies.iter().enumerate() {
            if i > 0 {
                result.push_str(" | ");
            }
            if p.body.is_empty() {
                result.push('ε');
            } else {
                let symbols: Vec<String> = p
                    .body
                    .iter()
                    .map(|sym| match sym {
                        Symbol::Terminal(c) => c.to_string(),
                        Symbol::NonTerminal(nt) => nt.clone(),
                    })
                    .collect();
                result.push_str(&symbols.join(" "));
            }
        }
    }
    result
}

/// (a) Helper variable names for each preset exactly match what current staging gives
#[test]
fn test_cnf_presets_alphanumeric_helpers_unchanged() {
    let presets: [(&str, &str, &[&str]); 8] = [
        ("CNF_ORDER", "S -> a | A B\nA -> a\nB -> B b", &[]),
        (
            "CNF_NULLABLE",
            "S -> A B C\nA -> a A | ε\nB -> b B | A\nC -> c | ε",
            &["T_a", "T_b"],
        ),
        ("CNF_START_LONG", "S -> x S y y | z", &["T_x", "T_y"]),
        (
            "CNF_UNIT_CHAIN",
            "S -> A\nA -> B\nB -> C | b b\nC -> c C | c",
            &["T_b", "T_c"],
        ),
        (
            "CNF_SHARED_TAIL",
            "S -> a B C D | b B C D\nB -> x\nC -> y\nD -> z",
            &["T_a", "T_b"],
        ),
        ("CFG_PAL", "S -> a S a | b S b | a | b | ε", &["T_a", "T_b"]),
        ("CFG_ANBN", "S -> a S b | a b", &["T_a", "T_b"]),
        ("CFG_EQ", "S -> a S b S | b S a S | ε", &["T_a", "T_b"]),
    ];

    for (id, src, expected_helpers) in presets {
        let grammar = GrammarParser::parse(src).expect(id);
        let trace = CnfTransformer::transform(&grammar).expect(id);
        assert_valid_cnf(&trace.final_grammar);

        let mut actual_helpers: Vec<String> = trace
            .final_grammar
            .variables()
            .into_iter()
            .filter(|v| v.starts_with("T_"))
            .collect();
        actual_helpers.sort();

        let expected_vec: Vec<String> = expected_helpers.iter().map(|s| s.to_string()).collect();
        assert_eq!(
            actual_helpers, expected_vec,
            "Preset {} helper variable set must exactly match staging",
            id
        );
    }
}

/// (b) CFG_PAREN gives T_p1 and T_p2 and no name with a non-alphanumeric character
#[test]
fn test_cnf_cfg_paren_helper_names_readable() {
    let input = "S -> ( S ) S | ε";
    let grammar = GrammarParser::parse(input).expect("Should parse CFG_PAREN");
    let trace = CnfTransformer::transform(&grammar).expect("CNF transformation should succeed");
    assert_valid_cnf(&trace.final_grammar);

    let p1 = trace
        .final_grammar
        .rules
        .iter()
        .find(|r| r.body == vec![Symbol::Terminal('(')]);
    let p2 = trace
        .final_grammar
        .rules
        .iter()
        .find(|r| r.body == vec![Symbol::Terminal(')')]);

    assert!(p1.is_some(), "Helper for '(' must exist");
    assert!(p2.is_some(), "Helper for ')' must exist");

    assert_eq!(
        p1.unwrap().head,
        "T_p1",
        "Expected T_p1 for helper rule of '('"
    );
    assert_eq!(
        p2.unwrap().head,
        "T_p2",
        "Expected T_p2 for helper rule of ')'"
    );

    for var in trace.final_grammar.variables() {
        assert!(
            var.chars().all(|c| c.is_ascii_alphanumeric() || c == '_'),
            "Variable '{}' contains invalid characters for the parser",
            var
        );
        assert!(
            !var.contains('(') && !var.contains(')'),
            "Variable '{}' must not contain parentheses",
            var
        );
    }
}

/// (d) A grammar that already has a variable T_p1 still gets a fresh name
#[test]
fn test_cnf_variable_fresh_when_t_p1_already_exists() {
    let input = r#"
        S -> ( S ) | T_p1 a
        T_p1 -> a
    "#;
    let grammar = GrammarParser::parse(input).expect("Should parse grammar with T_p1");
    let trace = CnfTransformer::transform(&grammar).expect("CNF transformation should succeed");
    assert_valid_cnf(&trace.final_grammar);

    let helper_rule = trace
        .final_grammar
        .rules
        .iter()
        .find(|r| r.body == vec![Symbol::Terminal('(')]);
    assert!(helper_rule.is_some(), "Helper for '(' must exist");
    let helper_name = &helper_rule.unwrap().head;
    assert_ne!(helper_name, "T_p1", "Helper for '(' must get a fresh name");
    let suffix = helper_name
        .strip_prefix("T_")
        .expect("Helper name should start with T_");
    assert!(
        suffix.chars().all(|c| c.is_ascii_alphanumeric()),
        "Helper name '{}' must have alphanumeric suffix after T_",
        helper_name
    );
}

/// With a variable S0 already in the grammar, the new start symbol isolated in Phase 1
/// must be S0_1, preserving the underscore naming scheme rather than changing to S01.
#[test]
fn test_cnf_phase1_start_symbol_collision_with_existing_s0() {
    let input = r#"
        S -> a S | S0
        S0 -> b
    "#;
    let grammar = GrammarParser::parse(input).expect("Should parse grammar with S0");
    let trace = CnfTransformer::transform(&grammar).expect("CNF transformation should succeed");
    assert_eq!(
        trace.final_grammar.start, "S0_1",
        "When S0 already exists, the isolated start symbol must remain S0_1"
    );
}

fn arb_symbol() -> impl Strategy<Value = Symbol> {
    prop_oneof![
        3 => prop::sample::select(vec!['a', 'b', 'c', '0', '1', '(', ')', '+', '*', ',', ';']).prop_map(Symbol::Terminal),
        2 => prop::sample::select(vec!["S".to_string(), "A".to_string(), "B".to_string(), "C".to_string()]).prop_map(Symbol::NonTerminal),
    ]
}

fn arb_grammar() -> impl Strategy<Value = Grammar> {
    let heads = vec![
        "S".to_string(),
        "A".to_string(),
        "B".to_string(),
        "C".to_string(),
    ];
    prop::collection::vec(
        (
            prop::sample::select(heads),
            prop::collection::vec(arb_symbol(), 0..=3),
        ),
        1..=8,
    )
    .prop_map(|rules| {
        let mut productions: Vec<Production> = rules
            .into_iter()
            .map(|(h, b)| Production::new(h, b))
            .collect();
        // Ensure start symbol S has at least one production deriving a terminal
        if !productions.iter().any(|r| r.head == "S") {
            productions.push(Production::new(
                "S".to_string(),
                vec![Symbol::Terminal('a')],
            ));
        }
        Grammar::new("S".to_string(), productions)
    })
}

proptest! {
    /// (c) proptest: for random grammars over letters, digits and ( ) + * , ;
    /// every variable of finalGrammar is read back as exactly one variable when you write
    /// the rules with grammarToText-style spacing and parse them again, and the rule set is equal
    #[test]
    fn cnf_proptest_variables_read_back_as_single_variable(g in arb_grammar()) {
        if let Ok(trace) = CnfTransformer::transform(&g) {
            let cnf = &trace.final_grammar;
            if cnf.rules.is_empty() {
                return Ok(());
            }
            let text = grammar_to_text(cnf);
            let parsed = GrammarParser::parse(&text).expect("CNF output must be parseable");
            prop_assert_eq!(&parsed.start, &cnf.start);

            let cnf_rules: BTreeSet<_> = cnf.rules.iter().cloned().collect();
            let parsed_rules: BTreeSet<_> = parsed.rules.iter().cloned().collect();
            prop_assert_eq!(parsed_rules, cnf_rules);
            prop_assert_eq!(parsed.variables(), cnf.variables());

            for var in cnf.variables() {
                prop_assert!(
                    var.chars().all(|c| c.is_ascii_alphanumeric() || c == '_'),
                    "Variable '{}' contains non-alphanumeric characters",
                    var
                );
            }
        }
    }
}
