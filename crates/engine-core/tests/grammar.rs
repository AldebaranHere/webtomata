use engine_core::grammar::{CnfTransformer, CykParser, Grammar, GrammarParser, Symbol};

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
