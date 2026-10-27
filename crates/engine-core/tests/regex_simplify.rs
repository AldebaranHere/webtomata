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
        ("aa*", "a+", "simplify.concat_star_plus"),
        ("a*a", "a+", "simplify.concat_star_plus"),
        ("(ab)(ab)*", "(ab)+", "simplify.concat_star_plus"),
        ("c(ab)*ab", "c(ab)+", "simplify.concat_star_plus"),
        ("(a∪b)(a∪b)*", "(a∪b)+", "simplify.concat_star_plus"),
        ("ε∪a+", "a*", "simplify.union_plus_absorb"),
        ("a+∪ε", "a*", "simplify.union_plus_absorb"),
        ("b∪a+b", "a*b", "simplify.union_plus_absorb"),
        ("b∪ba+", "ba*", "simplify.union_plus_absorb"),
        ("cb∪a+cb", "a*cb", "simplify.union_plus_absorb"),
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
        // The run before the star is not the body of the star.
        "ba*", "aba*", "(ab)*a", "a*b", "a∪a+b", "b∪a+c", "ab∪a+c",
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

// ---- the identities that turn the expression of a machine into a short one (S7-4a) ----

#[test]
fn a_run_of_parts_before_a_star_of_the_same_run_becomes_a_plus() {
    let a = alphabet(&["0", "1"]);
    // The star is the loop of the run, so the run and the star are one plus.
    assert_eq!(
        run("1*00*1(1*00*1)*", &a),
        (
            "(1*0+1)+".to_string(),
            vec![
                "simplify.concat_star_plus",
                "simplify.concat_star_plus",
                "simplify.concat_star_plus"
            ]
        )
    );
}

#[test]
fn the_expression_of_the_minimal_machine_and_the_one_of_the_owner_reach_the_same_plus() {
    let a = alphabet(&["0", "1"]);
    // From fsm_to_regex of the minimal DFSM of (1*00*1)+, and the expression that Sederhanakan made of it.
    for text in ["1*00*1(00*1∪11*00*1)*", "1*00*1((0∪11*0)0*1)*"] {
        assert_eq!(run(text, &a).0, "(1*0+1)+", "{text}");
    }
    // 0 ∪ 11*0 is 1*0.
    assert_eq!(run("0∪11*0", &a).0, "1*0");
}

#[test]
fn the_new_identities_name_the_parts() {
    let a = alphabet(&["a", "b"]);
    let Simplification::Finished { trace, .. } =
        simplify(&parse("b∪a+b", &a), &a, SimplifyBudget::default()).unwrap()
    else {
        panic!("stopped");
    };
    let step = &trace[0];
    assert_eq!(step.message.key, "simplify.union_plus_absorb");
    assert_eq!(text_param(&step.message, "plus"), "a+");
    assert_eq!(text_param(&step.message, "rest"), "b");
    assert_eq!(text_param(&step.message, "after"), "a*b");
    let Simplification::Finished { trace, .. } =
        simplify(&parse("(ab)(ab)*", &a), &a, SimplifyBudget::default()).unwrap()
    else {
        panic!("stopped");
    };
    assert_eq!(text_param(&trace[0].message, "body"), "ab");
    let Simplification::Finished { trace, .. } =
        simplify(&parse("ε∪a+", &a), &a, SimplifyBudget::default()).unwrap()
    else {
        panic!("stopped");
    };
    assert_eq!(text_param(&trace[0].message, "rest"), "ε");
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
    fn the_new_identities_keep_the_language(alpha in arb_regex(), rest in arb_regex()) {
        let a = abc();
        let plus = Regex::Plus(Box::new(alpha.clone()));
        let star = Regex::Star(Box::new(alpha.clone()));
        let cat = |x: &Regex, y: &Regex| Regex::Concat(Box::new(x.clone()), Box::new(y.clone()));
        let union = |x: &Regex, y: &Regex| Regex::Union(Box::new(x.clone()), Box::new(y.clone()));
        let starts = [
            union(&rest, &cat(&plus, &rest)),
            union(&rest, &cat(&rest, &plus)),
            union(&Regex::Epsilon, &plus),
            cat(&alpha, &star),
            cat(&star, &alpha),
            cat(&cat(&rest, &alpha), &star),
        ];
        for start in starts {
            let Simplification::Finished { regex, .. } =
                simplify(&start, &a, SimplifyBudget::default()).unwrap()
            else {
                panic!("stopped");
            };
            prop_assert!(regex.size() <= start.size());
            prop_assert!(same_language(&start, &regex, &a), "{}", start.to_text(&a));
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
