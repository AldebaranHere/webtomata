use engine_core::{
    Alphabet, Change, Compiled, Equivalence, EquivalenceBudget, Param, Regex, RegexBudget,
    Simplification, SimplifyBudget, StopReason, SymbolId, equivalent, parse_regex, regex_to_fsm,
    simplify,
};
use proptest::prelude::*;

mod common;
use common::arb_regex;

fn alphabet(names: &[&str]) -> Alphabet {
    Alphabet::new(names.iter().map(|s| s.to_string()).collect()).unwrap()
}

fn abc() -> Alphabet {
    alphabet(&["a", "b", "c"])
}

fn parse(text: &str, alphabet: &Alphabet) -> Regex {
    parse_regex(text, alphabet).unwrap()
}

/// The result text and the rule keys of the trace.
fn run(text: &str, alphabet: &Alphabet) -> (String, Vec<&'static str>) {
    match simplify(&parse(text, alphabet), alphabet, SimplifyBudget::default()).unwrap() {
        Simplification::Finished { regex, trace } => (
            regex.to_text(alphabet),
            trace.iter().map(|s| s.message.key).collect(),
        ),
        Simplification::Stopped { reason, .. } => panic!("{text}: stopped, {reason:?}"),
    }
}

fn same_language(a: &Regex, b: &Regex, alphabet: &Alphabet) -> bool {
    let build = |r: &Regex| match regex_to_fsm(r, alphabet, RegexBudget::default()).unwrap() {
        Compiled::Finished { fsm, .. } => fsm,
        Compiled::Stopped { .. } => panic!("stopped"),
    };
    matches!(
        equivalent(&build(a), &build(b), EquivalenceBudget::default()).unwrap(),
        Equivalence::Equivalent { .. }
    )
}

fn text_param(message: &engine_core::Message, name: &str) -> String {
    match message.params.get(name) {
        Some(Param::Text(t)) => t.clone(),
        other => panic!("param {name}: {other:?}"),
    }
}

// ---- Rich's identities, one rule each ----

#[test]
fn each_rule_rewrites_and_names_itself() {
    let cases = [
        ("a∪∅", "a", "simplify.union_empty"),
        ("∅∪a", "a", "simplify.union_empty"),
        ("a∪a", "a", "simplify.union_idempotent"),
        ("a*∪aa", "a*", "simplify.union_subset"),
        ("aa∪a*", "a*", "simplify.union_subset"),
        ("ab∪ac", "a(b∪c)", "simplify.union_factor_left"),
        ("ba∪ca", "(b∪c)a", "simplify.union_factor_right"),
        ("a∅", "∅", "simplify.concat_empty"),
        ("∅a", "∅", "simplify.concat_empty"),
        ("aε", "a", "simplify.concat_epsilon"),
        ("εa", "a", "simplify.concat_epsilon"),
        ("∅*", "ε", "simplify.star_empty"),
        ("ε*", "ε", "simplify.star_epsilon"),
        ("(a*)*", "a*", "simplify.star_star"),
        ("(a+)*", "a*", "simplify.star_plus"),
        ("(a*)+", "a*", "simplify.plus_star"),
        ("∅+", "∅", "simplify.plus_empty"),
        ("ε+", "ε", "simplify.plus_epsilon"),
        ("a*a*", "a*", "simplify.star_repeat"),
        ("a*(a∪b)*", "(a∪b)*", "simplify.concat_star_subset"),
        ("(a∪b)*a*", "(a∪b)*", "simplify.concat_star_subset"),
        ("(a∪ε)*", "a*", "simplify.star_union_subset"),
        ("(b∪bb)*", "b*", "simplify.star_union_subset"),
    ];
    for (input, expected, key) in cases {
        assert_eq!(
            run(input, &abc()),
            (expected.to_string(), vec![key]),
            "{input}"
        );
    }
}

#[test]
fn rules_do_not_fire_when_their_condition_fails() {
    for input in [
        "a", "a∪b", "ab∪ba", "a*∪b", "a*b*", "(a∪b)*", "(ab)*", "a+", "aa∪b",
    ] {
        assert_eq!(run(input, &abc()), (input.to_string(), vec![]), "{input}");
    }
}

#[test]
fn absorption_works_between_parts_that_are_not_next_to_each_other() {
    // Union is associative and commutative, so aa is absorbed by a* across the b.
    assert_eq!(
        run("a*∪b∪aa", &abc()),
        ("a*∪b".to_string(), vec!["simplify.union_subset"])
    );
    // Concatenation is associative, so the two b* meet once ε is gone.
    assert_eq!(
        run("b*εb*", &abc()),
        (
            "b*".to_string(),
            vec!["simplify.concat_epsilon", "simplify.star_repeat"]
        )
    );
}

#[test]
fn the_message_names_the_parts() {
    let a = abc();
    let Simplification::Finished { trace, .. } =
        simplify(&parse("a*∪aa", &a), &a, SimplifyBudget::default()).unwrap()
    else {
        panic!("stopped");
    };
    let step = &trace[0];
    assert_eq!(text_param(&step.message, "before"), "a*∪aa");
    assert_eq!(text_param(&step.message, "after"), "a*");
    assert_eq!(text_param(&step.message, "kept"), "a*");
    assert_eq!(text_param(&step.message, "removed"), "aa");
    assert_eq!(
        step.change,
        Change::Expression {
            expression: "a*".to_string()
        }
    );
}

// ---- Rich's Example 6.17 ----

#[test]
fn example_6_17() {
    let a = alphabet(&["a", "b"]);
    let (result, keys) = run("((a*∪∅)*∪aa)(b∪bb)*b*((a∪b)*b*∪ab)*", &a);
    assert_eq!(result, "(a∪b)*");
    // The book joins some rewrites in one line; here there is one rewrite in each step.
    assert_eq!(
        keys,
        vec![
            "simplify.union_empty",
            "simplify.star_star",
            "simplify.union_subset",
            "simplify.star_union_subset",
            "simplify.concat_star_subset",
            "simplify.union_subset",
            "simplify.star_star",
            "simplify.star_repeat",
            "simplify.concat_star_subset",
            "simplify.concat_star_subset",
        ]
    );
}

#[test]
fn every_line_of_example_6_17_is_equivalent_to_the_start() {
    let a = alphabet(&["a", "b"]);
    let start = parse("((a*∪∅)*∪aa)(b∪bb)*b*((a∪b)*b*∪ab)*", &a);
    let Simplification::Finished { trace, .. } =
        simplify(&start, &a, SimplifyBudget::default()).unwrap()
    else {
        panic!("stopped");
    };
    for step in &trace {
        let Change::Expression { expression } = &step.change else {
            panic!("not an expression");
        };
        assert!(
            same_language(&start, &parse(expression, &a), &a),
            "{expression}"
        );
    }
}

// ---- Exercise 3 of section 6.5 ----

#[test]
fn exercise_3_simplifies_as_far_as_the_identities_go() {
    let a = alphabet(&["a", "b"]);
    assert_eq!(run("(a∪b)*a*∪b", &a).0, "(a∪b)*"); // c
    assert_eq!(run("((a∪b)*)*", &a).0, "(a∪b)*"); // d
    assert_eq!(run("((a∪b)+)*", &a).0, "(a∪b)*"); // e
    // a, b and f: the result is equivalent and not bigger.
    for text in [
        "(a∪b)*(a∪ε)b*",
        "(ε*∪b)b*",
        "a((a∪b)(b∪a))*∪a((a∪b)a)*∪a((b∪a)b)*",
    ] {
        let start = parse(text, &a);
        let Simplification::Finished { regex, .. } =
            simplify(&start, &a, SimplifyBudget::default()).unwrap()
        else {
            panic!("stopped");
        };
        assert!(regex.size() <= start.size(), "{text}");
        assert!(same_language(&start, &regex, &a), "{text}");
    }
}

// ---- budgets and errors ----

#[test]
fn a_small_step_budget_stops_with_a_partial_trace() {
    let a = alphabet(&["a", "b"]);
    let start = parse("((a*∪∅)*∪aa)(b∪bb)*b*((a∪b)*b*∪ab)*", &a);
    let budget = SimplifyBudget {
        max_steps: 3,
        ..SimplifyBudget::default()
    };
    match simplify(&start, &a, budget).unwrap() {
        Simplification::Stopped {
            reason,
            partial_trace,
        } => {
            assert_eq!(reason, StopReason::MaxSteps);
            assert_eq!(partial_trace.len(), 3);
        }
        other => panic!("{other:?}"),
    }
}

#[test]
fn a_small_check_budget_stops() {
    let a = alphabet(&["a", "b"]);
    let start = parse("((a*∪∅)*∪aa)(b∪bb)*b*((a∪b)*b*∪ab)*", &a);
    let budget = SimplifyBudget {
        max_checks: 0,
        ..SimplifyBudget::default()
    };
    match simplify(&start, &a, budget).unwrap() {
        Simplification::Stopped {
            reason,
            partial_trace,
        } => {
            assert_eq!(reason, StopReason::MaxChecks);
            // The rules that need no check ran first.
            assert_eq!(partial_trace.len(), 2);
        }
        other => panic!("{other:?}"),
    }
}

#[test]
fn a_symbol_outside_the_alphabet_is_an_error() {
    let a = abc();
    let error = simplify(&Regex::Symbol(SymbolId(9)), &a, SimplifyBudget::default()).unwrap_err();
    assert_eq!(error.key, "simplify.unknown_symbol");
}

#[test]
fn a_symbol_alphabet_with_long_names_works() {
    let a = alphabet(&["num", "plus"]);
    assert_eq!(
        run("(num∪num plus)*", &a),
        ("(num∪num plus)*".to_string(), vec![])
    );
    assert_eq!(run("(num plus)* (num plus)*", &a).0, "(num plus)*");
}

// ---- properties ----

proptest! {
    #![proptest_config(ProptestConfig::with_cases(64))]

    #[test]
    fn the_result_means_the_same_and_is_not_bigger(r in arb_regex()) {
        let a = abc();
        let Simplification::Finished { regex, trace } =
            simplify(&r, &a, SimplifyBudget::default()).unwrap()
        else {
            panic!("stopped");
        };
        prop_assert!(regex.size() <= r.size());
        prop_assert!(same_language(&r, &regex, &a));
        // Every step is smaller than the one before, and the last one is the result.
        let mut size = r.size();
        for step in &trace {
            let Change::Expression { expression } = &step.change else {
                panic!("not an expression");
            };
            let now = parse(expression, &a);
            prop_assert!(now.size() < size, "{expression}");
            prop_assert!(same_language(&r, &now, &a), "{expression}");
            size = now.size();
        }
        match trace.last() {
            Some(step) => prop_assert_eq!(
                &step.change,
                &Change::Expression { expression: regex.to_text(&a) }
            ),
            None => prop_assert_eq!(&regex, &r),
        }
    }

    #[test]
    fn simplifying_twice_changes_nothing(r in arb_regex()) {
        let a = abc();
        let Simplification::Finished { regex, .. } =
            simplify(&r, &a, SimplifyBudget::default()).unwrap()
        else {
            panic!("stopped");
        };
        // The text of the result gives the same answer, whatever the grouping.
        let again = parse(&regex.to_text(&a), &a);
        let Simplification::Finished { trace, .. } =
            simplify(&again, &a, SimplifyBudget::default()).unwrap()
        else {
            panic!("stopped");
        };
        prop_assert!(trace.is_empty(), "{}", regex.to_text(&a));
    }

    #[test]
    fn a_tiny_budget_never_loops(r in arb_regex(), steps in 0usize..4, checks in 0usize..4) {
        let a = abc();
        let budget = SimplifyBudget { max_steps: steps, max_checks: checks };
        match simplify(&r, &a, budget).unwrap() {
            Simplification::Finished { trace, .. } => prop_assert!(trace.len() <= steps),
            Simplification::Stopped { partial_trace, .. } => {
                prop_assert!(partial_trace.len() <= steps)
            }
        }
    }
}
