use engine_core::language::{
    EnumerateOptions, LanguageEvaluator, LanguageParser, compare_proper_order,
};
use std::collections::HashMap;

#[test]
fn test_proper_ordering_comparator() {
    let mut words = vec!["ba", "a", "", "aaa", "ab", "b", "aa", "bb"];
    words.sort_by(|a, b| compare_proper_order(a, b));
    assert_eq!(words, vec!["", "a", "b", "aa", "ab", "ba", "bb", "aaa"]);
}

#[test]
fn test_finite_set_concatenation_and_proper_order() {
    let expr_str = "{bb, aac}{ca, ab}{ab, a, cac}";
    let expr = LanguageParser::parse(expr_str).expect("Failed to parse concatenation");
    let env = HashMap::new();
    let evaluator = LanguageEvaluator::new(&env);

    let options = EnumerateOptions {
        min_length: 0,
        max_count: 10,
        max_depth: 10,
    };
    let strings = evaluator
        .enumerate(&expr, options)
        .expect("Enumeration failed");

    // All results must be sorted in proper order
    for i in 1..strings.len() {
        assert_eq!(
            compare_proper_order(&strings[i - 1], &strings[i]),
            std::cmp::Ordering::Less
        );
    }

    // Smallest length combination: bb (2) + ab (2) + a (1) = 5 -> "bbaba"
    assert!(strings.contains(&"bbaba".to_string()));
}

#[test]
fn test_set_operations_union_diff_intersect() {
    let env = HashMap::new();
    let evaluator = LanguageEvaluator::new(&env);

    // Difference: {a, b, c} - {b} = {a, c}
    let diff = LanguageParser::parse("{a, b, c} - {b}").unwrap();
    assert!(evaluator.contains(&diff, "a").unwrap());
    assert!(!evaluator.contains(&diff, "b").unwrap());
    assert!(evaluator.contains(&diff, "c").unwrap());

    // Intersection: {ab, ba, a} ∩ {ba, bb} = {ba}
    let intersect = LanguageParser::parse("{ab, ba, a} ∩ {ba, bb}").unwrap();
    assert!(!evaluator.contains(&intersect, "ab").unwrap());
    assert!(evaluator.contains(&intersect, "ba").unwrap());

    // Union: {a} ∪ {b}
    let union = LanguageParser::parse("{a} ∪ {b}").unwrap();
    assert!(evaluator.contains(&union, "a").unwrap());
    assert!(evaluator.contains(&union, "b").unwrap());
    assert!(!evaluator.contains(&union, "c").unwrap());

    // XOR / Symmetric difference: {a, b} ⊕ {b, c} = {a, c}
    let xor = LanguageParser::parse("{a, b} ⊕ {b, c}").unwrap();
    assert!(evaluator.contains(&xor, "a").unwrap());
    assert!(!evaluator.contains(&xor, "b").unwrap());
    assert!(evaluator.contains(&xor, "c").unwrap());
}

#[test]
fn test_reversal_and_power() {
    let env = HashMap::new();
    let evaluator = LanguageEvaluator::new(&env);

    // Reversal: {ab, cat}^R = {ba, tac}
    let rev = LanguageParser::parse("{ab, cat}^R").unwrap();
    assert!(evaluator.contains(&rev, "ba").unwrap());
    assert!(evaluator.contains(&rev, "tac").unwrap());
    assert!(!evaluator.contains(&rev, "ab").unwrap());

    // Power: {ab}^2 = {abab}
    let pow = LanguageParser::parse("{ab}^2").unwrap();
    assert!(evaluator.contains(&pow, "abab").unwrap());
    assert!(!evaluator.contains(&pow, "ab").unwrap());
}

#[test]
fn test_kleene_star_and_plus() {
    let env = HashMap::new();
    let evaluator = LanguageEvaluator::new(&env);

    let star = LanguageParser::parse("{ab}*").unwrap();
    assert!(evaluator.contains(&star, "").unwrap());
    assert!(evaluator.contains(&star, "ab").unwrap());
    assert!(evaluator.contains(&star, "abab").unwrap());
    assert!(!evaluator.contains(&star, "a").unwrap());
    assert!(!evaluator.contains(&star, "ba").unwrap());

    let plus = LanguageParser::parse("{ab}+").unwrap();
    assert!(!evaluator.contains(&plus, "").unwrap());
    assert!(evaluator.contains(&plus, "ab").unwrap());
    assert!(evaluator.contains(&plus, "abab").unwrap());
}

#[test]
fn test_predicate_modulo() {
    let expr_str = "{ w in {a, b}* : #a(w) mod 3 = 0 }";
    let expr = LanguageParser::parse(expr_str).expect("Failed to parse modulo predicate");
    let env = HashMap::new();
    let evaluator = LanguageEvaluator::new(&env);

    let options = EnumerateOptions {
        min_length: 0,
        max_count: 10,
        max_depth: 5,
    };
    let strings = evaluator.enumerate(&expr, options).unwrap();

    assert_eq!(
        strings,
        vec![
            "".to_string(),
            "b".to_string(),
            "bb".to_string(),
            "aaa".to_string(),
            "bbb".to_string(),
            "aaab".to_string(),
            "aaba".to_string(),
            "abaa".to_string(),
            "baaa".to_string(),
            "bbbb".to_string(),
        ]
    );
}

#[test]
fn test_predicate_count_linear_and_min_length() {
    // 2#a(w) >= #b(w) with |w| >= 3
    let expr_str = "{ w in {a, b}* : 2#a(w) >= #b(w) }";
    let expr = LanguageParser::parse(expr_str).expect("Failed to parse count predicate");
    let env = HashMap::new();
    let evaluator = LanguageEvaluator::new(&env);

    let options = EnumerateOptions {
        min_length: 3,
        max_count: 6,
        max_depth: 4,
    };
    let strings = evaluator.enumerate(&expr, options).unwrap();

    // Check all words have length >= 3
    for s in &strings {
        assert!(s.len() >= 3);
        let count_a = s.chars().filter(|&c| c == 'a').count();
        let count_b = s.chars().filter(|&c| c == 'b').count();
        assert!(2 * count_a >= count_b);
    }
}

#[test]
fn test_predicate_universal_prefix() {
    // L15: ∀v ∈ prefix(w). (#a(v) >= 2#b(v)) and |w| >= 3
    let expr_str = "{ w in {a, b}* : ∀v ∈ prefix(w). (#a(v) >= 2#b(v)), |w| >= 3 }";
    let expr = LanguageParser::parse(expr_str).expect("Failed to parse prefix predicate");
    let env = HashMap::new();
    let evaluator = LanguageEvaluator::new(&env);

    let options = EnumerateOptions {
        min_length: 3,
        max_count: 5,
        max_depth: 4,
    };
    let strings = evaluator.enumerate(&expr, options).unwrap();

    // "aaa" has prefixes "", "a", "aa", "aaa", all satisfying #a >= 2#b.
    assert!(strings.contains(&"aaa".to_string()));
    // "baa" must not be included because prefix "b" has #a=0 < 2*#b=2.
    assert!(!strings.contains(&"baa".to_string()));
}

#[test]
fn test_environment_references_and_resolution() {
    let mut env = HashMap::new();
    env.insert("L1".to_string(), LanguageParser::parse("{a, b}").unwrap());
    env.insert("L2".to_string(), LanguageParser::parse("{c, d}").unwrap());

    let evaluator = LanguageEvaluator::new(&env);
    let combined = LanguageParser::parse("L1 L2").unwrap();

    assert!(evaluator.contains(&combined, "ac").unwrap());
    assert!(evaluator.contains(&combined, "bd").unwrap());
    assert!(!evaluator.contains(&combined, "ab").unwrap());
}

#[test]
fn test_juxtaposition_concatenation_parsing() {
    let expr1 = LanguageParser::parse("L15L1").expect("Failed to parse L15L1");
    match expr1 {
        engine_core::language::LanguageExpr::Concat(a, b) => {
            assert_eq!(
                *a,
                engine_core::language::LanguageExpr::Ref("L15".to_string())
            );
            assert_eq!(
                *b,
                engine_core::language::LanguageExpr::Ref("L1".to_string())
            );
        }
        other => panic!("Expected Concat, got {:?}", other),
    }

    let expr2 = LanguageParser::parse("L1^3L2^2").expect("Failed to parse L1^3L2^2");
    match expr2 {
        engine_core::language::LanguageExpr::Concat(a, b) => match (*a, *b) {
            (
                engine_core::language::LanguageExpr::Power(p1, 3),
                engine_core::language::LanguageExpr::Power(p2, 2),
            ) => {
                assert_eq!(
                    *p1,
                    engine_core::language::LanguageExpr::Ref("L1".to_string())
                );
                assert_eq!(
                    *p2,
                    engine_core::language::LanguageExpr::Ref("L2".to_string())
                );
            }
            other => panic!("Expected Power 3 and Power 2, got {:?}", other),
        },
        other => panic!("Expected Concat, got {:?}", other),
    }
}

#[test]
fn test_l1_cubed_l2_squared_minus_l7_star() {
    let mut env = HashMap::new();
    env.insert(
        "L1".to_string(),
        LanguageParser::parse("{bb, aac}{ca, ab}{ab, a, cac}").unwrap(),
    );
    env.insert(
        "L2".to_string(),
        LanguageParser::parse("{bb, aac}{ab, a, cac}{ac, bc}").unwrap(),
    );
    env.insert(
        "L7".to_string(),
        LanguageParser::parse("{ w in {a, b}* : #a(w) mod 3 = 0 }").unwrap(),
    );

    let expr = LanguageParser::parse("L1^3L2^2 - L7*").expect("Failed to parse L1^3L2^2 - L7*");
    let evaluator = LanguageEvaluator::new(&env);

    assert!(evaluator.can_generate(&expr));
    assert_eq!(evaluator.min_length(&expr), 25);

    let options = EnumerateOptions {
        min_length: 0,
        max_count: 13,
        max_depth: 30,
    };
    let start = std::time::Instant::now();
    let strings = evaluator
        .enumerate(&expr, options)
        .expect("Enumeration should succeed");
    let elapsed = start.elapsed();

    assert_eq!(strings.len(), 13, "Should return exactly 13 strings");
    // All 13 strings must have length 25 (minimum length of L1^3 L2^2)
    for s in &strings {
        assert_eq!(s.len(), 25);
    }
    // Verify proper ordering
    for i in 1..strings.len() {
        assert_eq!(
            compare_proper_order(&strings[i - 1], &strings[i]),
            std::cmp::Ordering::Less
        );
    }
    // Verify fast execution (< 50ms)
    assert!(
        elapsed.as_millis() < 50,
        "Enumeration took too long: {:?}",
        elapsed
    );
}

#[test]
fn test_parse_and_eval_all_preset_formulas() {
    let presets = vec![
        ("L1", "{ab, aca, b, ccab}"),
        ("L2", "{ac, c, bab, bcaa}"),
        ("L3", "{bb, bac, a, cbab}"),
        ("L4", "{ca, aab, b, caac}"),
        ("L5", "{bc, c, bca, cbac}"),
        ("L6", "{aa, bba, a, cbac}"),
        ("L7", "{ab, bc}"),
        ("L8", "{ba, ac}"),
        ("L9", "{ab, ca}"),
        ("L10", "{ac, cb}"),
        ("L11", "L1^3L2^2 - L7*"),
        ("L23", "L7* - L8(L1 ∪ L2)*"),
        ("L35", "(L6)^R L1*"),
        ("L47", "{ w in {a, b}* : 3#a(w) >= 5#b(w) + 3 }"),
        (
            "L55",
            "{ w in {a, b}* : ∀v ∈ prefix(w). (3#a(v) >= 6#b(v)) }",
        ),
        (
            "L59",
            "{ w in {a, b}* : ∀v ∈ suffix(w). (3#a(v) >= 6#b(v)) }",
        ),
    ];

    let mut env = HashMap::new();
    for (id, f) in &presets {
        let parsed =
            LanguageParser::parse(f).unwrap_or_else(|e| panic!("Failed to parse {}: {:?}", id, e));
        env.insert(id.to_string(), parsed);
    }

    let evaluator = LanguageEvaluator::new(&env);
    let options = EnumerateOptions {
        min_length: 0,
        max_count: 5,
        max_depth: 10,
    };

    for (id, _) in &presets {
        let expr = &env[*id];
        let res = evaluator.enumerate(expr, options);
        assert!(res.is_ok(), "Failed to enumerate {}: {:?}", id, res.err());
        let strings = res.unwrap();
        println!("{}: {:?}", id, strings);
    }
}
