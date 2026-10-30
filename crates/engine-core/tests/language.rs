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
