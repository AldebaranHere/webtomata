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
    assert_eq!(grammar.rules[2].body, vec![Symbol::Terminal('a')]);
    assert!(
        grammar.rules[3].body.is_empty(),
        "A -> λ should have empty body"
    );
    assert_eq!(grammar.rules[4].body, vec![Symbol::Terminal('b')]);
    assert!(
        grammar.rules[5].body.is_empty(),
        "B -> ^ should have empty body"
    );
    assert!(
        grammar.rules[6].body.is_empty(),
        "B -> epsilon should have empty body"
    );
}

#[test]
fn test_parse_lambda_empty_symbol() {
    let input = "S -> a S b | λ";
    let grammar = GrammarParser::parse(input).expect("Should parse grammar with λ");
    assert_eq!(grammar.rules.len(), 2);
    assert_eq!(
        grammar.rules[0].body,
        vec![
            Symbol::Terminal('a'),
            Symbol::NonTerminal("S".into()),
            Symbol::Terminal('b'),
        ]
    );
    // λ as standalone alternative must yield an empty production body
    assert!(
        grammar.rules[1].body.is_empty(),
        "Rule for λ should have an empty body, but got {:?}",
        grammar.rules[1].body
    );
    assert!(
        !grammar
            .rules
            .iter()
            .any(|r| r.body.contains(&Symbol::Terminal('λ'))),
        "Grammar must not contain terminal 'λ'"
    );

    // Equivalent behavior for ε and ^
    let input_eps = "S -> a S b | ε";
    let grammar_eps = GrammarParser::parse(input_eps).unwrap();
    assert!(grammar_eps.rules[1].body.is_empty());
    assert!(
        !grammar_eps
            .rules
            .iter()
            .any(|r| r.body.contains(&Symbol::Terminal('ε')))
    );

    let input_caret = "S -> a S b | ^";
    let grammar_caret = GrammarParser::parse(input_caret).unwrap();
    assert!(grammar_caret.rules[1].body.is_empty());
    assert!(
        !grammar_caret
            .rules
            .iter()
            .any(|r| r.body.contains(&Symbol::Terminal('^')))
    );

    // λ inside a longer body (e.g. "a λ") is treated as a terminal symbol 'λ'
    let input_inline = "S -> a λ";
    let grammar_inline = GrammarParser::parse(input_inline).unwrap();
    assert_eq!(
        grammar_inline.rules[0].body,
        vec![Symbol::Terminal('a'), Symbol::Terminal('λ')]
    );
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

fn check_cyk_equivalence(g1: &Grammar, g2: &Grammar, alphabet: &[char], max_len: usize) {
    fn dfs(g1: &Grammar, g2: &Grammar, current: &mut String, max_len: usize, alphabet: &[char]) {
        let r1 = CykParser::parse(g1, current)
            .map(|r| r.accepted)
            .unwrap_or(false);
        let r2 = CykParser::parse(g2, current)
            .map(|r| r.accepted)
            .unwrap_or(false);
        assert_eq!(
            r1, r2,
            "CYK acceptance mismatch for word '{}' (g1: {}, g2: {})",
            current, r1, r2
        );
        if current.len() < max_len {
            for &c in alphabet {
                current.push(c);
                dfs(g1, g2, current, max_len, alphabet);
                current.pop();
            }
        }
    }
    let mut current = String::with_capacity(max_len);
    dfs(g1, g2, &mut current, max_len, alphabet);
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
    // S is not nullable -> start symbol remains S under homework order
    assert_eq!(trace.final_grammar.start, "S");

    let s_binary: Vec<_> = trace
        .final_grammar
        .rules
        .iter()
        .filter(|r| r.head == "S" && r.body.len() == 2)
        .collect();
    assert_eq!(s_binary.len(), 1, "S should have 1 binary rule");

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
    assert_eq!(trace.final_grammar.start, "S");

    // S must have 3 rules: [T_b, T_b], [T_c, C], [c]
    let s_rules: Vec<_> = trace
        .final_grammar
        .rules
        .iter()
        .filter(|r| r.head == "S")
        .collect();
    assert_eq!(s_rules.len(), 3, "S should have exactly 3 rules");

    // Language oracle for {bb} U c+
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
        .expect("CNF transformation with short_version should succeed");
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
        "With short_version: true, the tail helper variable must be shared"
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
    // In course default, without S0 (since S is not nullable), separate helper rules exist
    assert_eq!(
        default_rules_with_ab.len(),
        2,
        "Course default must produce separate helper rules"
    );

    // Option short_version: true enables deduplication (behavior of commit a82bf0e)
    let trace = CnfTransformer::transform_with_options(&grammar, true)
        .expect("CNF transformation with short_version should succeed");

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
        "Expected exactly 1 rule deriving AB with short_version: true, found: {:?}",
        rules_with_ab
    );
    let helper_var = &rules_with_ab[0].head;
    assert_eq!(helper_var, "X");

    // Check A, S both have rule with [T_a, X]
    for head in &["A", "S"] {
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
            "Expected {} -> T_a X in final grammar with short_version: true:\n{}",
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

/// With a variable S0 already in the grammar, the new start symbol isolated in Phase 3
/// must be S0_1, preserving the underscore naming scheme rather than changing to S01.
#[test]
fn test_cnf_phase3_start_symbol_collision_with_existing_s0() {
    let input = r#"
        S -> a S | S0 | ε
        S0 -> b
    "#;
    let grammar = GrammarParser::parse(input).expect("Should parse grammar with S0");
    let trace = CnfTransformer::transform(&grammar).expect("CNF transformation should succeed");
    assert_eq!(
        trace.final_grammar.start, "S0_1",
        "When S0 already exists, the isolated start symbol must remain S0_1"
    );
}

#[test]
fn test_s0_conditions() {
    // 1. Nullable and on RHS => S0 added
    let g1 = GrammarParser::parse("S -> a S | ε").unwrap();
    let t1 = CnfTransformer::transform(&g1).unwrap();
    assert_eq!(t1.final_grammar.start, "S0");
    assert_eq!(t1.steps[2].phase_key, "grammar.cnf.phase_epsilon");
    assert!(t1.steps[2].note_key.is_some());

    // 2. Nullable and not on RHS => S0 added
    let g2 = GrammarParser::parse("S -> a A | ε\nA -> a").unwrap();
    let t2 = CnfTransformer::transform(&g2).unwrap();
    assert_eq!(t2.final_grammar.start, "S0");
    assert_eq!(t2.steps[2].phase_key, "grammar.cnf.phase_epsilon");
    assert!(t2.steps[2].note_key.is_some());

    // 3. Not nullable and on RHS => NO S0 added
    let g3 = GrammarParser::parse("S -> a S | b").unwrap();
    let t3 = CnfTransformer::transform(&g3).unwrap();
    assert_eq!(t3.final_grammar.start, "S");
    assert_eq!(t3.steps[2].phase_key, "grammar.cnf.phase_epsilon");
    assert!(t3.steps[2].note_key.is_none());

    // 4. Not nullable and not on RHS => NO S0 added
    let g4 = GrammarParser::parse("S -> a A | b\nA -> a").unwrap();
    let t4 = CnfTransformer::transform(&g4).unwrap();
    assert_eq!(t4.final_grammar.start, "S");
    assert_eq!(t4.steps[2].phase_key, "grammar.cnf.phase_epsilon");
    assert!(t4.steps[2].note_key.is_none());
}

#[test]
fn test_hand_derivation_t010_flow_grammar() {
    let input = r#"
        S -> a S b | A | U
        A -> B
        B -> b B | λ
        U -> U c
    "#;
    let grammar = GrammarParser::parse(input).expect("Should parse SIX_PHASE_GRAMMAR");
    let trace = CnfTransformer::transform(&grammar).expect("CNF transformation should succeed");

    assert_eq!(trace.steps.len(), 6);

    // Phase 1: Unreachable
    assert_eq!(trace.steps[0].phase_key, "grammar.cnf.phase_unreachable");
    assert_eq!(trace.steps[0].removed_rules.len(), 0);
    assert_eq!(trace.steps[0].added_rules.len(), 0);
    assert_eq!(trace.steps[0].grammar.rules.len(), 7);

    // Phase 2: Non-productive
    assert_eq!(trace.steps[1].phase_key, "grammar.cnf.phase_nonproductive");
    assert_eq!(trace.steps[1].removed_rules.len(), 2);
    assert_eq!(trace.steps[1].added_rules.len(), 0);
    assert_eq!(trace.steps[1].grammar.rules.len(), 5);

    // Phase 3: Epsilon
    assert_eq!(trace.steps[2].phase_key, "grammar.cnf.phase_epsilon");
    assert_eq!(
        trace.steps[2].note_key,
        Some("grammar.cnf.phase_epsilon.note".into())
    );
    assert_eq!(trace.steps[2].grammar.start, "S0");
    assert_eq!(trace.steps[2].removed_rules.len(), 1);
    assert_eq!(trace.steps[2].added_rules.len(), 4);
    assert_eq!(trace.steps[2].grammar.rules.len(), 8);

    // Phase 4: Unit
    assert_eq!(trace.steps[3].phase_key, "grammar.cnf.phase_unit");
    assert_eq!(trace.steps[3].removed_rules.len(), 3);
    assert_eq!(trace.steps[3].added_rules.len(), 8);
    assert_eq!(trace.steps[3].grammar.rules.len(), 13);

    // Phase 5: Mixed
    assert_eq!(trace.steps[4].phase_key, "grammar.cnf.phase_mixed");
    assert_eq!(trace.steps[4].removed_rules.len(), 8);
    assert_eq!(trace.steps[4].added_rules.len(), 10);
    assert_eq!(trace.steps[4].grammar.rules.len(), 15);

    // Phase 6: Long
    assert_eq!(trace.steps[5].phase_key, "grammar.cnf.phase_long");
    assert_eq!(trace.steps[5].removed_rules.len(), 2);
    assert_eq!(trace.steps[5].added_rules.len(), 4);
    assert_eq!(trace.steps[5].grammar.rules.len(), 17);

    assert_valid_cnf(&trace.final_grammar);
}

#[test]
fn test_hand_derivation_r1_version_toggle() {
    let input = r#"
        S -> x B y | z B y | z B | x
        B -> x
    "#;
    let grammar = GrammarParser::parse(input).expect("Should parse R1");

    let is_r1_lang = |w: &str| w == "x" || w == "xxy" || w == "zxy" || w == "zx";

    // 1. Long version
    let trace_long = CnfTransformer::transform_with_options(&grammar, false).unwrap();
    assert_eq!(trace_long.steps[4].removed_rules.len(), 3);
    assert_eq!(trace_long.steps[4].added_rules.len(), 6);
    assert_eq!(trace_long.steps[4].grammar.rules.len(), 8);
    assert_eq!(trace_long.steps[4].note_key, None);

    assert_eq!(trace_long.steps[5].removed_rules.len(), 2);
    assert_eq!(trace_long.steps[5].added_rules.len(), 4);
    assert_eq!(trace_long.steps[5].grammar.rules.len(), 10);
    assert_eq!(trace_long.steps[5].note_key, None);
    assert_valid_cnf(&trace_long.final_grammar);
    check_exhaustive_cyk(&trace_long.final_grammar, &['x', 'y', 'z'], 6, is_r1_lang);

    // 2. Short version
    let trace_short = CnfTransformer::transform_with_options(&grammar, true).unwrap();
    assert_eq!(trace_short.steps[4].removed_rules.len(), 3);
    assert_eq!(trace_short.steps[4].added_rules.len(), 5);
    assert_eq!(trace_short.steps[4].grammar.rules.len(), 7);
    assert_eq!(
        trace_short.steps[4].note_key,
        Some("grammar.cnf.phase_mixed.note_short".into())
    );

    assert_eq!(trace_short.steps[5].removed_rules.len(), 2);
    assert_eq!(trace_short.steps[5].added_rules.len(), 3);
    assert_eq!(trace_short.steps[5].grammar.rules.len(), 8);
    assert_eq!(
        trace_short.steps[5].note_key,
        Some("grammar.cnf.phase_long.note_short".into())
    );
    assert_valid_cnf(&trace_short.final_grammar);
    check_exhaustive_cyk(&trace_short.final_grammar, &['x', 'y', 'z'], 6, is_r1_lang);
}

#[test]
fn test_hand_derivation_r2_must_not_reuse() {
    let input = r#"
        S -> a C
        C -> c | a
    "#;
    let grammar = GrammarParser::parse(input).expect("Should parse R2");

    let is_r2_lang = |w: &str| w == "ac" || w == "aa";

    for &short in &[false, true] {
        let trace = CnfTransformer::transform_with_options(&grammar, short).unwrap();
        assert_eq!(trace.steps[4].removed_rules.len(), 1);
        assert_eq!(trace.steps[4].added_rules.len(), 2);
        assert_eq!(trace.steps[4].grammar.rules.len(), 4);
        assert_eq!(trace.steps[4].note_key, None);

        assert_eq!(trace.steps[5].removed_rules.len(), 0);
        assert_eq!(trace.steps[5].added_rules.len(), 0);
        assert_eq!(trace.steps[5].grammar.rules.len(), 4);
        assert_eq!(trace.steps[5].note_key, None);

        assert_valid_cnf(&trace.final_grammar);
        check_exhaustive_cyk(&trace.final_grammar, &['a', 'c'], 6, is_r2_lang);
    }
}

#[test]
fn test_hand_derivation_r3a_t010_flow_grammar() {
    let input = r#"
        S -> a S b | A | U
        A -> B
        B -> b B | λ
        U -> U c
    "#;
    let grammar = GrammarParser::parse(input).expect("Should parse R3a");

    // Long
    let trace_long = CnfTransformer::transform_with_options(&grammar, false).unwrap();
    assert_eq!(trace_long.steps[4].grammar.rules.len(), 15);
    assert_eq!(trace_long.steps[4].note_key, None);
    assert_eq!(trace_long.steps[5].removed_rules.len(), 2);
    assert_eq!(trace_long.steps[5].added_rules.len(), 4);
    assert_eq!(trace_long.steps[5].grammar.rules.len(), 17);
    assert_eq!(trace_long.steps[5].note_key, None);
    assert_valid_cnf(&trace_long.final_grammar);

    // Short
    let trace_short = CnfTransformer::transform_with_options(&grammar, true).unwrap();
    assert_eq!(trace_short.steps[4].grammar.rules.len(), 15);
    assert_eq!(trace_short.steps[4].note_key, None);
    assert_eq!(trace_short.steps[5].removed_rules.len(), 2);
    assert_eq!(trace_short.steps[5].added_rules.len(), 3);
    assert_eq!(trace_short.steps[5].grammar.rules.len(), 16);
    assert_eq!(
        trace_short.steps[5].note_key,
        Some("grammar.cnf.phase_long.note_short".into())
    );
    assert_valid_cnf(&trace_short.final_grammar);

    // Both accept the same strings up to length 8 over {a, b, c}
    check_cyk_equivalence(
        &trace_long.final_grammar,
        &trace_short.final_grammar,
        &['a', 'b', 'c'],
        8,
    );
}

#[test]
fn test_hand_derivation_r3b_truly_identical() {
    let input = r#"
        S -> a S b | c
    "#;
    let grammar = GrammarParser::parse(input).expect("Should parse R3b");

    let is_r3b_lang = |w: &str| {
        if !w.contains('c') {
            return false;
        }
        let parts: Vec<&str> = w.split('c').collect();
        if parts.len() != 2 {
            return false;
        }
        let n = parts[0].len();
        parts[0].chars().all(|ch| ch == 'a')
            && parts[1].len() == n
            && parts[1].chars().all(|ch| ch == 'b')
    };

    for &short in &[false, true] {
        let trace = CnfTransformer::transform_with_options(&grammar, short).unwrap();
        assert_eq!(trace.steps[0].grammar.rules.len(), 2);
        assert_eq!(trace.steps[1].grammar.rules.len(), 2);
        assert_eq!(trace.steps[2].grammar.rules.len(), 2);
        assert_eq!(trace.steps[3].grammar.rules.len(), 2);

        assert_eq!(trace.steps[4].removed_rules.len(), 1);
        assert_eq!(trace.steps[4].added_rules.len(), 3);
        assert_eq!(trace.steps[4].grammar.rules.len(), 4);
        assert_eq!(trace.steps[4].note_key, None);

        assert_eq!(trace.steps[5].removed_rules.len(), 1);
        assert_eq!(trace.steps[5].added_rules.len(), 2);
        assert_eq!(trace.steps[5].grammar.rules.len(), 5);
        assert_eq!(trace.steps[5].note_key, None);

        assert_valid_cnf(&trace.final_grammar);
        check_exhaustive_cyk(&trace.final_grammar, &['a', 'b', 'c'], 8, is_r3b_lang);
    }
}

#[test]
fn test_phase5_tie_rule_first_by_name() {
    let input = r#"
        S -> a P Q
        P -> a
        Q -> a
    "#;
    let grammar = GrammarParser::parse(input).expect("Should parse tie grammar");

    // Long version: creates T_a -> a, so S -> T_a P Q
    let trace_long =
        CnfTransformer::transform_with_options(&grammar, false).expect("Long CNF should succeed");
    let p5_long = &trace_long.steps[4];
    assert!(p5_long.grammar.rules.contains(&Production::new(
        "S",
        vec![
            Symbol::NonTerminal("T_a".into()),
            Symbol::NonTerminal("P".into()),
            Symbol::NonTerminal("Q".into()),
        ],
    )));
    assert_eq!(p5_long.note_key, None);

    // Short version: candidates for 'a' are P and Q (both have single rule V -> a).
    // In name order, 'P' < 'Q'. Tie rule requires first by name, which is P.
    let trace_short =
        CnfTransformer::transform_with_options(&grammar, true).expect("Short CNF should succeed");
    let p5_short = &trace_short.steps[4];
    assert_eq!(
        p5_short.note_key,
        Some("grammar.cnf.phase_mixed.note_short".into())
    );

    // Assert S -> P P Q is present
    assert!(
        p5_short.grammar.rules.contains(&Production::new(
            "S",
            vec![
                Symbol::NonTerminal("P".into()),
                Symbol::NonTerminal("P".into()),
                Symbol::NonTerminal("Q".into()),
            ],
        )),
        "Phase 5 short version must reuse P (first in name order P < Q), yielding S -> P P Q"
    );

    // Assert S -> Q P Q is NOT present
    assert!(
        !p5_short.grammar.rules.contains(&Production::new(
            "S",
            vec![
                Symbol::NonTerminal("Q".into()),
                Symbol::NonTerminal("P".into()),
                Symbol::NonTerminal("Q".into()),
            ],
        )),
        "Phase 5 short version must NOT reuse Q (which is second/last in name order)"
    );

    // Phase 6 binarization: S -> P P Q becomes S -> P X, X -> P Q
    let p6_short = &trace_short.steps[5];
    assert!(p6_short.grammar.rules.contains(&Production::new(
        "S",
        vec![
            Symbol::NonTerminal("P".into()),
            Symbol::NonTerminal("X".into())
        ],
    )));
    assert_valid_cnf(&trace_short.final_grammar);
    let cyk = |g: &Grammar, w: &str| CykParser::parse(g, w).unwrap().accepted;
    assert!(cyk(&trace_short.final_grammar, "aaa"));
    assert!(!cyk(&trace_short.final_grammar, "a"));
    assert!(!cyk(&trace_short.final_grammar, "aa"));
    assert!(!cyk(&trace_short.final_grammar, "aaaa"));
}

#[test]
fn test_hand_derivation_unreachable_after_phase2() {
    let input = r#"
        S -> A B | c
        A -> a
        B -> B b
    "#;
    let grammar = GrammarParser::parse(input).expect("Should parse G_UNREACHABLE_AFTER_P2");
    let trace = CnfTransformer::transform(&grammar).expect("CNF transformation should succeed");

    // Phase 1: Unreachable
    assert_eq!(trace.steps[0].phase_key, "grammar.cnf.phase_unreachable");
    assert_eq!(trace.steps[0].removed_rules.len(), 0);
    assert_eq!(trace.steps[0].added_rules.len(), 0);
    assert_eq!(trace.steps[0].grammar.rules.len(), 4);

    // Phase 2: Non-productive (B is non-productive, removing it makes A unreachable)
    assert_eq!(trace.steps[1].phase_key, "grammar.cnf.phase_nonproductive");
    assert_eq!(trace.steps[1].removed_rules.len(), 3); // S -> A B, B -> B b, and A -> a
    assert_eq!(trace.steps[1].added_rules.len(), 0);
    assert_eq!(trace.steps[1].grammar.rules.len(), 1);
    assert_eq!(trace.steps[1].grammar.rules[0].head, "S");
    assert_eq!(
        trace.steps[1].grammar.rules[0].body,
        vec![Symbol::Terminal('c')]
    );

    assert_valid_cnf(&trace.final_grammar);
}

#[test]
fn test_hand_derivation_no_epsilon_start_on_rhs() {
    let input = r#"
        S -> a S | b
    "#;
    let grammar = GrammarParser::parse(input).expect("Should parse G_NO_EPSILON");
    let trace = CnfTransformer::transform(&grammar).expect("CNF transformation should succeed");

    // S is on RHS, but NOT nullable -> Start symbol must remain S!
    assert_eq!(trace.final_grammar.start, "S");
    assert_valid_cnf(&trace.final_grammar);
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

    /// AC2: proptest property on random grammars:
    /// the short final grammar is in CNF and equivalent to the long final grammar (same strings up to length 4, by CYK),
    /// and has no more rules than the long one.
    #[test]
    fn cnf_proptest_short_version_equiv_and_leq_rules(g in arb_grammar()) {
        let trace_long = match CnfTransformer::transform_with_options(&g, false) {
            Ok(t) => t,
            Err(_) => return Ok(()),
        };
        let trace_short = match CnfTransformer::transform_with_options(&g, true) {
            Ok(t) => t,
            Err(_) => return Ok(()),
        };

        let cnf_long = &trace_long.final_grammar;
        let cnf_short = &trace_short.final_grammar;

        prop_assert!(CykParser::is_cnf(cnf_short), "Short grammar must be valid CNF");
        prop_assert!(
            cnf_short.rules.len() <= cnf_long.rules.len(),
            "Short grammar should have no more rules than long (short: {}, long: {})",
            cnf_short.rules.len(),
            cnf_long.rules.len()
        );

        let terms: Vec<char> = g.terminals().into_iter().take(3).collect();
        check_cyk_equivalence(cnf_long, cnf_short, &terms, 4);
    }
}

fn assert_cnf_idempotent(grammar: &Grammar) {
    let serialized = grammar_to_text(grammar);
    let parsed = GrammarParser::parse(&serialized).expect("Serialized CNF must parse");
    let trace2 = CnfTransformer::transform(&parsed).expect("Transform of CNF must succeed");
    assert_valid_cnf(&trace2.final_grammar);
}

#[test]
fn test_t027_audit_lambda_presets_and_grammars() {
    let cyk = |g: &Grammar, w: &str| CykParser::parse(g, w).unwrap().accepted;

    // 1. CFG_PAL
    let pal_src = "S -> a S a | b S b | a | b | λ";
    let pal_grammar = GrammarParser::parse(pal_src).expect("CFG_PAL with λ must parse");
    let pal_trace = CnfTransformer::transform(&pal_grammar).expect("CFG_PAL CNF must succeed");
    assert_valid_cnf(&pal_trace.final_grammar);
    assert!(
        cyk(&pal_trace.final_grammar, ""),
        "CFG_PAL must accept empty string"
    );
    assert!(cyk(&pal_trace.final_grammar, "a"));
    assert!(cyk(&pal_trace.final_grammar, "b"));
    assert!(cyk(&pal_trace.final_grammar, "aba"));
    assert!(cyk(&pal_trace.final_grammar, "abba"));
    assert!(!cyk(&pal_trace.final_grammar, "ab"));
    assert!(!cyk(&pal_trace.final_grammar, "abb"));
    assert_cnf_idempotent(&pal_trace.final_grammar);

    // 2. CFG_PAREN
    let paren_src = "S -> ( S ) S | λ";
    let paren_grammar = GrammarParser::parse(paren_src).expect("CFG_PAREN with λ must parse");
    let paren_trace =
        CnfTransformer::transform(&paren_grammar).expect("CFG_PAREN CNF must succeed");
    assert_valid_cnf(&paren_trace.final_grammar);
    assert!(
        cyk(&paren_trace.final_grammar, ""),
        "CFG_PAREN must accept empty string"
    );
    assert!(cyk(&paren_trace.final_grammar, "()"));
    assert!(cyk(&paren_trace.final_grammar, "(())"));
    assert!(cyk(&paren_trace.final_grammar, "()()"));
    assert!(cyk(&paren_trace.final_grammar, "(()())"));
    assert!(!cyk(&paren_trace.final_grammar, "("));
    assert!(!cyk(&paren_trace.final_grammar, ")("));
    assert_cnf_idempotent(&paren_trace.final_grammar);

    // 3. CFG_EQ
    let eq_src = "S -> a S b S | b S a S | λ";
    let eq_grammar = GrammarParser::parse(eq_src).expect("CFG_EQ with λ must parse");
    let eq_trace = CnfTransformer::transform(&eq_grammar).expect("CFG_EQ CNF must succeed");
    assert_valid_cnf(&eq_trace.final_grammar);
    assert!(
        cyk(&eq_trace.final_grammar, ""),
        "CFG_EQ must accept empty string"
    );
    assert!(cyk(&eq_trace.final_grammar, "ab"));
    assert!(cyk(&eq_trace.final_grammar, "ba"));
    assert!(cyk(&eq_trace.final_grammar, "aabb"));
    assert!(cyk(&eq_trace.final_grammar, "baba"));
    assert!(!cyk(&eq_trace.final_grammar, "aab"));
    assert!(!cyk(&eq_trace.final_grammar, "abb"));
    assert_cnf_idempotent(&eq_trace.final_grammar);

    // 4. Default new grammar: S -> aSb | λ
    let default_src = "S -> a S b | λ";
    let default_grammar = GrammarParser::parse(default_src).expect("Default grammar must parse");
    let default_trace =
        CnfTransformer::transform(&default_grammar).expect("Default CNF must succeed");
    assert_valid_cnf(&default_trace.final_grammar);
    assert!(
        cyk(&default_trace.final_grammar, ""),
        "Default grammar S -> aSb | λ must accept empty string"
    );
    assert!(cyk(&default_trace.final_grammar, "ab"));
    assert!(cyk(&default_trace.final_grammar, "aabb"));
    assert!(cyk(&default_trace.final_grammar, "aaabbb"));
    assert!(!cyk(&default_trace.final_grammar, "a"));
    assert!(!cyk(&default_trace.final_grammar, "b"));
    assert!(!cyk(&default_trace.final_grammar, "aab"));
    assert!(!cyk(&default_trace.final_grammar, "ba"));
    assert_cnf_idempotent(&default_trace.final_grammar);

    // 5. Existing test at line 31
    let line31_src = "
        S → A | B
        A ::= a | λ
        B -> b | ^ | epsilon
    ";
    let line31_grammar = GrammarParser::parse(line31_src).expect("Line 31 grammar must parse");
    let line31_trace =
        CnfTransformer::transform(&line31_grammar).expect("Line 31 CNF must succeed");
    assert_valid_cnf(&line31_trace.final_grammar);
    assert!(
        cyk(&line31_trace.final_grammar, ""),
        "Line 31 grammar must accept empty string"
    );
    assert!(cyk(&line31_trace.final_grammar, "a"));
    assert!(cyk(&line31_trace.final_grammar, "b"));
    assert!(!cyk(&line31_trace.final_grammar, "c"));
    assert!(!cyk(&line31_trace.final_grammar, "ab"));
    assert_cnf_idempotent(&line31_trace.final_grammar);
}
