use engine_core::{
    Alphabet, Change, Compiled, ConversionStep, Equivalence, EquivalenceBudget, Extraction, Fsm,
    FsmToRegexBudget, Label, Regex, RegexBudget, StateId, StopReason, equivalent, fsm_to_regex,
    parse_regex, regex_to_fsm,
};
use proptest::prelude::*;

mod common;
use common::{EVEN, arb_fsm, arb_regex};

// Rich, Example 6.7 (the machine behind the regular expression (ab ∪ aaa*b)*(a ∪ ε) in the
// textbook and the course slides): states 1, 2, 3; start 1; accepting 1 and 2.
const RICH_6_7: &str = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[1,2,3],"start":1,"accepting":[1,2],"transitions":[{"from":1,"on":"a","to":2},{"from":2,"on":"b","to":1},{"from":2,"on":"a","to":3},{"from":3,"on":"a","to":3},{"from":3,"on":"b","to":1}]}"#;

const EVEN_WITH_UNREACHABLE: &str = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,1,2],"start":0,"accepting":[0,2],"transitions":[{"from":0,"on":"a","to":1},{"from":0,"on":"b","to":1},{"from":1,"on":"a","to":0},{"from":1,"on":"b","to":0},{"from":2,"on":"a","to":2},{"from":2,"on":"b","to":2}]}"#;

fn fsm(json: &str) -> Fsm {
    Fsm::from_json(json).unwrap()
}

fn extract(json: &str, budget: FsmToRegexBudget) -> Extraction {
    fsm_to_regex(&fsm(json), budget).unwrap()
}

fn finished(json: &str) -> (String, Vec<ConversionStep>) {
    let machine = fsm(json);
    match fsm_to_regex(&machine, FsmToRegexBudget::default()).unwrap() {
        Extraction::Finished { regex, trace } => (regex.to_text(&machine.alphabet), trace),
        Extraction::Stopped { reason, .. } => panic!("stopped: {reason:?}"),
    }
}

fn keys(trace: &[ConversionStep]) -> Vec<&'static str> {
    trace.iter().map(|s| s.message.key).collect()
}

fn labels(labels: &[Label]) -> Vec<(u32, u32, String)> {
    labels
        .iter()
        .map(|l| (l.from.0, l.to.0, l.expression.clone()))
        .collect()
}

fn s(label: &str) -> String {
    label.to_string()
}

// ---- textbook examples ----

#[test]
fn rich_example_6_7_removes_states_3_2_1() {
    let (text, trace) = finished(RICH_6_7);
    assert_eq!(text, "(a(b∪aa*b))*(ε∪a)");
    assert_eq!(
        keys(&trace),
        [
            "fsm_to_regex.new_start",
            "fsm_to_regex.new_accepting",
            "fsm_to_regex.table",
            "fsm_to_regex.rip",
            "fsm_to_regex.rip",
            "fsm_to_regex.rip",
            "fsm_to_regex.result"
        ]
    );
    assert_eq!(trace[0].change, Change::Start { state: StateId(4) });
    assert_eq!(trace[1].change, Change::Accepting { state: StateId(5) });
    let Change::Labels { labels: table } = &trace[2].change else {
        panic!()
    };
    assert_eq!(
        labels(table),
        vec![
            (1, 2, s("a")),
            (1, 5, s("ε")),
            (2, 1, s("b")),
            (2, 3, s("a")),
            (2, 5, s("ε")),
            (3, 1, s("b")),
            (3, 3, s("a")),
            (4, 1, s("ε")),
        ]
    );
    let rip = |i: usize| match &trace[i].change {
        Change::Rip { state, updates } => (state.0, labels(updates)),
        other => panic!("{other:?}"),
    };
    assert_eq!(rip(3), (3, vec![(2, 1, s("b∪aa*b"))]));
    assert_eq!(rip(4), (2, vec![(1, 1, s("a(b∪aa*b)")), (1, 5, s("ε∪a"))]));
    assert_eq!(rip(5), (1, vec![(4, 5, s("(a(b∪aa*b))*(ε∪a)"))]));
    assert_eq!(
        trace[6].change,
        Change::Expression {
            expression: s("(a(b∪aa*b))*(ε∪a)")
        }
    );
    assert_eq!(
        trace[3].message.params.get("state"),
        Some(&engine_core::Param::Int(3))
    );
}

#[test]
fn the_result_for_example_6_7_equals_the_expression_in_the_slides() {
    let machine = fsm(RICH_6_7);
    let Extraction::Finished { regex, .. } =
        fsm_to_regex(&machine, FsmToRegexBudget::default()).unwrap()
    else {
        panic!()
    };
    let slides = parse_regex("(ab∪aaa*b)*(a∪ε)", &machine.alphabet).unwrap();
    assert!(same_language(&regex, &slides, &machine.alphabet));
}

#[test]
fn even_length_gives_the_expression_of_rich_example_6_3() {
    let (text, trace) = finished(EVEN);
    assert_eq!(text, "((a∪b)(a∪b))*");
    assert_eq!(trace.len(), 6);
}

// ---- edge cases ----

#[test]
fn no_accepting_state_gives_the_empty_set() {
    let json = EVEN.replace(r#""accepting":[0]"#, r#""accepting":[]"#);
    let (text, trace) = finished(&json);
    assert_eq!(text, "∅");
    assert_eq!(keys(&trace), ["fsm_to_regex.no_accepting"]);
}

#[test]
fn one_state_without_transitions_gives_epsilon() {
    let json = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a"],"states":[0],"start":0,"accepting":[0],"transitions":[]}"#;
    let (text, trace) = finished(json);
    assert_eq!(text, "ε");
    assert_eq!(keys(&trace), ["fsm_to_regex.only_one_state"]);
}

#[test]
fn one_state_with_a_loop_gives_a_star() {
    let json = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a"],"states":[0],"start":0,"accepting":[0],"transitions":[{"from":0,"on":"a","to":0}]}"#;
    let (text, trace) = finished(json);
    assert_eq!(text, "a*");
    assert_eq!(trace.len(), 5);
}

#[test]
fn unreachable_states_are_removed_first() {
    let (text, trace) = finished(EVEN_WITH_UNREACHABLE);
    assert_eq!(text, "((a∪b)(a∪b))*");
    assert_eq!(keys(&trace)[0], "fsm_to_regex.remove_unreachable");
    assert_eq!(
        trace[0].change,
        Change::RemoveUnreachable { state: StateId(2) }
    );
}

#[test]
fn a_machine_without_a_start_state_cannot_be_converted() {
    let json = EVEN.replace(r#""start":0"#, r#""start":null"#);
    let m = fsm_to_regex(&fsm(&json), FsmToRegexBudget::default()).unwrap_err();
    assert_eq!(m.key, "fsm_to_regex.no_start_state");
}

#[test]
fn epsilon_transitions_are_labels_too() {
    let json = r#"{"schemaVersion":1,"kind":"ndfsm","alphabet":["a","b"],"states":[0,1],"start":0,"accepting":[1],"transitions":[{"from":0,"on":"a","to":0},{"from":0,"on":null,"to":1},{"from":1,"on":"b","to":1}]}"#;
    let (text, _) = finished(json);
    let machine = fsm(json);
    let parsed = parse_regex(&text, &machine.alphabet).unwrap();
    let expected = parse_regex("a*b*", &machine.alphabet).unwrap();
    assert!(same_language(&parsed, &expected, &machine.alphabet));
}

// ---- budgets ----

fn budget(max_steps: usize, max_updates: usize, max_nodes: usize) -> FsmToRegexBudget {
    FsmToRegexBudget {
        max_steps,
        max_updates,
        max_nodes,
    }
}

fn stopped(b: FsmToRegexBudget) -> (StopReason, usize) {
    match extract(EVEN, b) {
        Extraction::Stopped {
            reason,
            partial_trace,
        } => (reason, partial_trace.len()),
        Extraction::Finished { .. } => panic!("should have stopped"),
    }
}

#[test]
fn too_many_steps_stops_with_the_trace_so_far() {
    assert!(matches!(
        extract(EVEN, budget(6, 100, 100)),
        Extraction::Finished { .. }
    ));
    assert_eq!(stopped(budget(5, 100, 100)), (StopReason::MaxSteps, 5));
    assert_eq!(stopped(budget(0, 100, 100)), (StopReason::MaxSteps, 0));
}

#[test]
fn too_many_label_updates_stop_the_run() {
    assert!(matches!(
        extract(EVEN, budget(100, 2, 100)),
        Extraction::Finished { .. }
    ));
    assert_eq!(stopped(budget(100, 1, 100)), (StopReason::MaxUpdates, 4));
    assert_eq!(stopped(budget(100, 0, 100)), (StopReason::MaxUpdates, 3));
}

#[test]
fn a_label_that_grows_too_big_stops_the_run() {
    // (a∪b)(a∪b) has 7 nodes and ((a∪b)(a∪b))* has 8.
    assert!(matches!(
        extract(EVEN, budget(100, 100, 8)),
        Extraction::Finished { .. }
    ));
    assert_eq!(stopped(budget(100, 100, 7)), (StopReason::MaxNodes, 4));
    assert_eq!(stopped(budget(100, 100, 6)), (StopReason::MaxNodes, 3));
}

// ---- properties ----

fn same_language(a: &Regex, b: &Regex, alphabet: &Alphabet) -> bool {
    let compile = |r: &Regex| match regex_to_fsm(r, alphabet, RegexBudget::default()).unwrap() {
        Compiled::Finished { fsm, .. } => fsm,
        Compiled::Stopped { .. } => panic!("stopped"),
    };
    matches!(
        equivalent(&compile(a), &compile(b), EquivalenceBudget::default()).unwrap(),
        Equivalence::Equivalent { .. }
    )
}

fn is_different(result: &Equivalence) -> bool {
    matches!(result, Equivalence::Different { .. })
}

/// True if no rule for ∅ and ε could still be applied anywhere in the expression.
fn simplified(r: &Regex) -> bool {
    use Regex::{Concat, Empty, Epsilon, Star, Union};
    match r {
        Union(a, b) => {
            !matches!(**a, Empty)
                && !matches!(**b, Empty)
                && a != b
                && simplified(a)
                && simplified(b)
        }
        Concat(a, b) => {
            !matches!(**a, Empty | Epsilon)
                && !matches!(**b, Empty | Epsilon)
                && simplified(a)
                && simplified(b)
        }
        Star(a) => !matches!(**a, Empty | Epsilon) && simplified(a),
        _ => true,
    }
}

proptest! {
    #[test]
    fn regex_to_ndfsm_to_regex_keeps_the_language(r in arb_regex()) {
        let alphabet = Alphabet::new(vec!["a".into(), "b".into(), "c".into()]).unwrap();
        let Compiled::Finished { fsm: machine, .. } =
            regex_to_fsm(&r, &alphabet, RegexBudget::default()).unwrap()
        else {
            return Ok(());
        };
        let Extraction::Finished { regex, .. } =
            fsm_to_regex(&machine, FsmToRegexBudget::default()).unwrap()
        else {
            return Ok(());
        };
        let Compiled::Finished { fsm: again, .. } =
            regex_to_fsm(&regex, &alphabet, RegexBudget::default()).unwrap()
        else {
            return Ok(());
        };
        let result = equivalent(&machine, &again, EquivalenceBudget::default()).unwrap();
        prop_assert!(!is_different(&result));
    }

    #[test]
    fn a_random_machine_and_its_expression_accept_the_same_strings(machine in arb_fsm()) {
        prop_assume!(machine.start.is_some());
        let Extraction::Finished { regex, .. } =
            fsm_to_regex(&machine, FsmToRegexBudget::default()).unwrap()
        else {
            return Ok(());
        };
        let Compiled::Finished { fsm: again, .. } =
            regex_to_fsm(&regex, &machine.alphabet, RegexBudget::default()).unwrap()
        else {
            return Ok(());
        };
        let result = equivalent(&machine, &again, EquivalenceBudget::default()).unwrap();
        prop_assert!(!is_different(&result));
    }

    #[test]
    fn the_result_is_simplified_and_states_are_removed_highest_first(machine in arb_fsm()) {
        prop_assume!(machine.start.is_some());
        let budget = FsmToRegexBudget::default();
        let Extraction::Finished { regex, trace } = fsm_to_regex(&machine, budget).unwrap() else {
            return Ok(());
        };
        prop_assert!(simplified(&regex));
        prop_assert!(regex.size() <= budget.max_nodes);
        let ripped: Vec<u32> = trace
            .iter()
            .filter_map(|s| match &s.change {
                Change::Rip { state, .. } => Some(state.0),
                _ => None,
            })
            .collect();
        prop_assert!(ripped.windows(2).all(|w| w[0] > w[1]));
    }

    #[test]
    fn small_budgets_never_panic_and_are_respected(
        machine in arb_fsm(),
        max_steps in 0usize..10,
        max_updates in 0usize..20,
        max_nodes in 0usize..20,
    ) {
        prop_assume!(machine.start.is_some());
        let b = budget(max_steps, max_updates, max_nodes);
        let first = fsm_to_regex(&machine, b).unwrap();
        prop_assert_eq!(format!("{first:?}"), format!("{:?}", fsm_to_regex(&machine, b).unwrap()));
        let trace = match &first {
            Extraction::Finished { trace, .. } => trace,
            Extraction::Stopped { partial_trace, .. } => partial_trace,
        };
        prop_assert!(trace.len() <= max_steps);
    }
}
