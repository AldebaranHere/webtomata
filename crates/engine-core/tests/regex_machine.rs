use engine_core::{
    Alphabet, Change, Compiled, ConversionStep, Equivalence, EquivalenceBudget, Param, Regex,
    RegexBudget, Simplification, SimplifyBudget, StopReason, SymbolId, ViaMachineBudget,
    equivalent, parse_regex, regex_to_fsm, simplify, simplify_via_machine,
};
use proptest::prelude::*;

mod common;
use common::arb_regex;

fn alphabet(names: &[&str]) -> Alphabet {
    Alphabet::new(names.iter().map(|s| s.to_string()).collect()).unwrap()
}

fn bits() -> Alphabet {
    alphabet(&["0", "1"])
}

fn abc() -> Alphabet {
    alphabet(&["a", "b", "c"])
}

fn parse(text: &str, alphabet: &Alphabet) -> Regex {
    parse_regex(text, alphabet).unwrap()
}

fn via(text: &str, alphabet: &Alphabet) -> (Regex, Vec<ConversionStep>) {
    match simplify_via_machine(
        &parse(text, alphabet),
        alphabet,
        ViaMachineBudget::default(),
    )
    .unwrap()
    {
        Simplification::Finished { regex, trace } => (regex, trace),
        Simplification::Stopped { reason, .. } => panic!("{text}: stopped, {reason:?}"),
    }
}

fn plain(text: &str, alphabet: &Alphabet) -> (Regex, Vec<ConversionStep>) {
    match simplify(&parse(text, alphabet), alphabet, SimplifyBudget::default()).unwrap() {
        Simplification::Finished { regex, trace } => (regex, trace),
        Simplification::Stopped { reason, .. } => panic!("{text}: stopped, {reason:?}"),
    }
}

fn keys(trace: &[ConversionStep]) -> Vec<&'static str> {
    trace.iter().map(|s| s.message.key).collect()
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

fn number(step: &ConversionStep, name: &str) -> usize {
    match step.message.params.get(name) {
        Some(Param::Int(n)) => *n as usize,
        other => panic!("param {name}: {other:?}"),
    }
}

// The long expression from the research of the owner (a hand proof showed it is (1*00*1)+).
const R1: &str = "(0∪11*0)(1∪00*1)(ε∪1((0∪11*0)(1∪00*1)1)*(0∪11*0)(1∪00*1)∪(0∪1((0∪11*0)(1∪00*1)1)*(0∪11*0)(1∪00*1)0)((1∪00*1)(0∪1((0∪11*0)(1∪00*1)1)*(0∪11*0)(1∪00*1)0))*(1∪00*1∪(1∪00*1)1((0∪11*0)(1∪00*1)1)*(0∪11*0)(1∪00*1)))";

#[test]
fn a_long_expression_becomes_the_short_plus_through_the_minimal_machine() {
    let a = bits();
    let (regex, trace) = via(R1, &a);
    assert_eq!(regex.to_text(&a), "(1*0+1)+");
    assert!(same_language(&parse(R1, &a), &regex, &a));
    // The identities alone shorten R1 but do not get to the short plus; the machine does.
    let (short, _) = plain(R1, &a);
    assert!(short.size() < parse(R1, &a).size());
    assert!(short.size() > regex.size() * 3, "{}", short.to_text(&a));
    // The steps: the machine, the expression of its state elimination, then the identities.
    assert_eq!(
        &keys(&trace)[..2],
        ["via_machine.machine", "via_machine.expression"]
    );
    assert!(keys(&trace)[2..].iter().all(|k| k.starts_with("simplify.")));
    assert_eq!(
        trace.last().unwrap().change,
        Change::Expression {
            expression: "(1*0+1)+".to_string()
        }
    );
}

#[test]
fn the_machine_step_says_how_big_each_machine_is() {
    let a = bits();
    let (_, trace) = via(R1, &a);
    let machine = &trace[0];
    // The minimal DFSM of (1*00*1)+ has three states, and the NDFSM and the DFSM are bigger.
    assert_eq!(number(machine, "minimal_states"), 3);
    assert!(number(machine, "ndfsm_states") > number(machine, "dfsm_states"));
    assert!(number(machine, "dfsm_states") >= 3);
    // The step shows the expression as the student typed it, and the next one the expression of the machine.
    assert_eq!(
        machine.change,
        Change::Expression {
            expression: parse(R1, &a).to_text(&a)
        }
    );
    assert_eq!(
        trace[1].change,
        Change::Expression {
            expression: "1*00*1(00*1∪11*00*1)*".to_string()
        }
    );
}

#[test]
fn an_expression_that_is_not_longer_than_the_machine_expression_is_kept() {
    let a = bits();
    // (1*00*1)+ simplifies to (1*0+1)+, and the machine gives the same size: a tie keeps the original.
    for text in ["(1*00*1)+", "01*", "(0∪1)*"] {
        let (regex, trace) = via(text, &a);
        assert_eq!(regex, plain(text, &a).0, "{text}");
        assert_eq!(keys(&trace)[0], "via_machine.kept_original", "{text}");
        let machine = number(&trace[0], "machine_size");
        let original = number(&trace[0], "original_size");
        assert!(machine >= original, "{text}: {machine} < {original}");
        assert_eq!(original, regex.size(), "{text}");
    }
}

#[test]
fn a_machine_that_is_too_big_gives_the_plain_result_and_says_so() {
    let a = bits();
    let budget = ViaMachineBudget {
        max_states: 2,
        ..ViaMachineBudget::default()
    };
    let text = "1*00*1((0∪11*0)0*1)*";
    let Simplification::Finished { regex, trace } =
        simplify_via_machine(&parse(text, &a), &a, budget).unwrap()
    else {
        panic!("stopped");
    };
    assert_eq!(keys(&trace)[0], "via_machine.too_big");
    // The identities alone get here from this expression.
    assert_eq!(regex.to_text(&a), "(1*0+1)+");
    // Labels that are too big stop the machine as well.
    let budget = ViaMachineBudget {
        max_nodes: 3,
        ..ViaMachineBudget::default()
    };
    let Simplification::Finished { trace, .. } =
        simplify_via_machine(&parse(R1, &a), &a, budget).unwrap()
    else {
        panic!("stopped");
    };
    assert_eq!(keys(&trace)[0], "via_machine.too_big");
}

#[test]
fn the_plain_budget_stops_the_whole_call() {
    let a = bits();
    let budget = ViaMachineBudget {
        max_checks: 0,
        ..ViaMachineBudget::default()
    };
    let result = simplify_via_machine(&parse("1*∪11", &a), &a, budget).unwrap();
    assert!(matches!(
        result,
        Simplification::Stopped {
            reason: StopReason::MaxChecks,
            ..
        }
    ));
}

#[test]
fn a_symbol_outside_the_alphabet_is_an_error() {
    let a = alphabet(&["a", "b"]);
    let regex = Regex::Symbol(SymbolId(7));
    let error = simplify_via_machine(&regex, &a, ViaMachineBudget::default()).unwrap_err();
    assert_eq!(error.key, "simplify.unknown_symbol");
}

#[test]
fn expressions_without_symbols_work() {
    let a = abc();
    for text in ["ε", "∅", "ε∪∅", "∅*"] {
        let (regex, _) = via(text, &a);
        assert!(same_language(&parse(text, &a), &regex, &a), "{text}");
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(48))]

    #[test]
    fn the_result_means_the_same_and_is_never_longer_than_the_plain_one(r in arb_regex()) {
        let a = abc();
        let Simplification::Finished { regex, trace } =
            simplify_via_machine(&r, &a, ViaMachineBudget::default()).unwrap()
        else {
            panic!("stopped");
        };
        let Simplification::Finished { regex: short, .. } =
            simplify(&r, &a, SimplifyBudget::default()).unwrap()
        else {
            panic!("stopped");
        };
        prop_assert!(regex.size() <= short.size());
        prop_assert!(same_language(&r, &regex, &a));
        // The last step is the result.
        let Some(last) = trace.last() else { panic!("no step") };
        prop_assert_eq!(&last.change, &Change::Expression { expression: regex.to_text(&a) });
    }

    #[test]
    fn the_same_expression_gives_the_same_answer(r in arb_regex()) {
        let a = abc();
        let once = simplify_via_machine(&r, &a, ViaMachineBudget::default()).unwrap();
        let twice = simplify_via_machine(&r, &a, ViaMachineBudget::default()).unwrap();
        prop_assert_eq!(once, twice);
    }
}
