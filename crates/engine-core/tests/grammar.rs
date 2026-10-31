use engine_core::grammar::{CnfTransformer, CykParser, GrammarParser, Symbol};

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

#[test]
fn test_cnf01_from_fasilkom_hw05() {
    let input = r#"
        S -> A D | F B a
        A -> a A d | a D | a
        D -> a D | B | \lambda
        B -> b B c c c | b B c c c c | b B c c c c c | \lambda
        E -> a F b A
        F -> b E
        C -> B S b b
    "#;
    let grammar = GrammarParser::parse(input).expect("Should parse CNF01");
    let trace = CnfTransformer::transform(&grammar).expect("CNF transformation should succeed");

    // Must be valid CNF
    assert!(
        CykParser::is_cnf(&trace.final_grammar),
        "Final grammar must be CNF:\n{}",
        trace.final_grammar.to_display_string()
    );

    // Check that unproductive / unreachable symbols E, F are cleaned up
    let final_vars = trace.final_grammar.variables();
    assert!(!final_vars.contains("E"), "E should be eliminated");
    assert!(!final_vars.contains("F"), "F should be eliminated");
    assert!(!final_vars.contains("C"), "C should be eliminated");
}

#[test]
fn test_cnf04_from_fasilkom_hw05() {
    let input = r#"
        S -> A B C F | S a D a
        A -> a A a | a | \lambda
        B -> b B | \lambda
        C -> c C c | c | \lambda
        D -> d D a | b D
        E -> d F a | S a B
        F -> d F | \lambda
    "#;
    let grammar = GrammarParser::parse(input).expect("Should parse CNF04");
    let trace = CnfTransformer::transform(&grammar).expect("CNF transformation should succeed");

    assert!(
        CykParser::is_cnf(&trace.final_grammar),
        "Final grammar must be CNF:\n{}",
        trace.final_grammar.to_display_string()
    );
}

#[test]
fn test_cnf05_from_fasilkom_hw05() {
    let input = r#"
        S -> A B E F | S D a
        A -> a A | \lambda
        B -> b B b | b | \lambda
        C -> a B a A | S c
        D -> D c A | b D a
        E -> c E | \lambda
        F -> d F d | d | \lambda
    "#;
    let grammar = GrammarParser::parse(input).expect("Should parse CNF05");
    let trace = CnfTransformer::transform(&grammar).expect("CNF transformation should succeed");

    assert!(
        CykParser::is_cnf(&trace.final_grammar),
        "Final grammar must be CNF:\n{}",
        trace.final_grammar.to_display_string()
    );
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
