use engine_core::{
    Budget, Change, Conversion, ConversionBudget, ConversionStep, Equivalence, EquivalenceBudget,
    Fsm, FsmKind, Intersection, Param, Severity, Simulation, StateId, StopReason, SymbolId,
    complement, determinize, equivalent, intersection, simulate, union, validate,
};
use proptest::prelude::*;

mod common;
use common::{
    A_STAR_B_STAR, A_STAR_B_STAR_DFSM, ENDS_10, EVEN, EVEN_MOD_4, PARTIAL, all_strings, arb_fsm,
    arb_pair, nth_from_end,
};

fn fsm(json: &str) -> Fsm {
    Fsm::from_json(json).unwrap()
}

fn odd() -> String {
    EVEN.replace(r#""accepting":[0]"#, r#""accepting":[1]"#)
}

fn accepts(fsm: &Fsm, input: &[SymbolId]) -> bool {
    match simulate(fsm, input, Budget::default()).unwrap() {
        Simulation::Finished { accepted, .. } => accepted,
        Simulation::Stopped { .. } => panic!("stopped"),
    }
}

fn keys(trace: &[ConversionStep]) -> Vec<&'static str> {
    trace.iter().map(|s| s.message.key).collect()
}

fn ids(xs: &[StateId]) -> Vec<u32> {
    xs.iter().map(|s| s.0).collect()
}

// ---- complement ----

#[test]
fn complement_swaps_the_accepting_states() {
    let op = complement(&fsm(EVEN)).unwrap();
    assert_eq!(op.fsm, fsm(&odd()));
    assert_eq!(
        keys(&op.trace),
        ["complement.not_accepting", "complement.accepting"]
    );
    assert_eq!(
        op.trace[0].change,
        Change::NotAccepting { state: StateId(0) }
    );
    assert_eq!(op.trace[1].change, Change::Accepting { state: StateId(1) });
    assert_eq!(
        op.trace[0].message.params.get("state"),
        Some(&Param::Int(0))
    );
}

#[test]
fn complementing_twice_gives_the_original_machine() {
    for json in [EVEN, EVEN_MOD_4, A_STAR_B_STAR_DFSM] {
        let once = complement(&fsm(json)).unwrap().fsm;
        assert_eq!(complement(&once).unwrap().fsm, fsm(json));
    }
    let op = complement(&fsm(EVEN_MOD_4)).unwrap();
    assert_eq!(ids(&op.fsm.accepting), vec![1, 3]);
    assert_eq!(op.trace.len(), 4);
}

#[test]
fn only_complete_valid_dfsms_can_be_complemented() {
    let ndfsm = complement(&fsm(ENDS_10)).unwrap_err();
    assert_eq!(ndfsm.key, "complement.not_a_dfsm");
    let partial = complement(&fsm(PARTIAL)).unwrap_err();
    assert_eq!(partial.key, "complement.invalid_machine");
    let no_start = EVEN.replace(r#""start":0"#, r#""start":null"#);
    assert_eq!(
        complement(&fsm(&no_start)).unwrap_err().key,
        "complement.invalid_machine"
    );
}

// ---- union ----

const ONLY_A: &str = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,1],"start":0,"accepting":[1],"transitions":[{"from":0,"on":"a","to":1}]}"#;
const ONLY_B: &str = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,1],"start":0,"accepting":[1],"transitions":[{"from":0,"on":"b","to":1}]}"#;

#[test]
fn union_adds_a_start_state_with_two_epsilon_transitions() {
    let op = union(&fsm(ONLY_A), &fsm(ONLY_B)).unwrap();
    let expected = fsm(
        r#"{"schemaVersion":1,"kind":"ndfsm","alphabet":["a","b"],"states":[0,1,2,3,4],"start":4,"accepting":[1,3],"transitions":[{"from":0,"on":"a","to":1},{"from":2,"on":"b","to":3},{"from":4,"on":null,"to":0},{"from":4,"on":null,"to":2}]}"#,
    );
    assert_eq!(op.fsm, expected);
    assert_eq!(
        keys(&op.trace),
        [
            "union.copy_first",
            "union.copy_second",
            "union.new_start",
            "union.epsilon",
            "union.epsilon"
        ]
    );
    assert_eq!(
        op.trace[1].change,
        Change::Copy {
            machine: 2,
            from: vec![StateId(0), StateId(1)],
            to: vec![StateId(2), StateId(3)],
            start: StateId(2),
            accepting: vec![StateId(3)],
        }
    );
    assert_eq!(op.trace[2].change, Change::Start { state: StateId(4) });
    assert_eq!(
        op.trace[3].change,
        Change::Epsilon {
            from: StateId(4),
            to: StateId(0)
        }
    );
    assert_eq!(
        op.trace[4].change,
        Change::Epsilon {
            from: StateId(4),
            to: StateId(2)
        }
    );
}

#[test]
fn the_second_machine_is_renumbered_after_the_highest_state_of_the_first() {
    let sparse = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,5],"start":0,"accepting":[5],"transitions":[{"from":0,"on":"a","to":5}]}"#;
    let op = union(&fsm(sparse), &fsm(ONLY_B)).unwrap();
    assert_eq!(ids(&op.fsm.states), vec![0, 5, 6, 7, 8]);
    assert_eq!(op.fsm.start, Some(StateId(8)));
    assert_eq!(ids(&op.fsm.accepting), vec![5, 7]);
}

#[test]
fn symbols_are_matched_by_name_whatever_the_order() {
    let reordered = ONLY_B.replace(r#""alphabet":["a","b"]"#, r#""alphabet":["b","a"]"#);
    let op = union(&fsm(ONLY_A), &fsm(&reordered)).unwrap();
    assert_eq!(op.fsm, union(&fsm(ONLY_A), &fsm(ONLY_B)).unwrap().fsm);
}

#[test]
fn union_needs_start_states_and_the_same_symbols() {
    let no_start = ONLY_A.replace(r#""start":0"#, r#""start":null"#);
    let m = union(&fsm(&no_start), &fsm(ONLY_B)).unwrap_err();
    assert_eq!(m.key, "union.no_start_state");
    assert_eq!(m.params.get("side"), Some(&Param::Text("first".into())));
    let m = union(&fsm(ONLY_A), &fsm(&no_start)).unwrap_err();
    assert_eq!(m.params.get("side"), Some(&Param::Text("second".into())));
    let m = union(&fsm(ONLY_A), &fsm(ENDS_10)).unwrap_err();
    assert_eq!(m.key, "union.alphabet_mismatch");
}

#[test]
fn a_union_over_the_state_limit_is_an_error() {
    let chain = |n: usize| {
        let states: Vec<String> = (0..n).map(|i| i.to_string()).collect();
        let edges: Vec<String> = (0..n - 1)
            .map(|i| format!(r#"{{"from":{i},"on":"a","to":{}}}"#, i + 1))
            .collect();
        fsm(&format!(
            r#"{{"schemaVersion":1,"kind":"dfsm","alphabet":["a"],"states":[{}],"start":0,"accepting":[{}],"transitions":[{}]}}"#,
            states.join(","),
            n - 1,
            edges.join(",")
        ))
    };
    assert!(union(&chain(900), &chain(900)).is_ok());
    let m = union(&chain(1000), &chain(1000)).unwrap_err();
    assert_eq!(m.key, "machine.limit_exceeded");
}

// ---- intersection (De Morgan) ----

fn run(a: &str, b: &str) -> (Fsm, Vec<ConversionStep>) {
    match intersection(&fsm(a), &fsm(b), ConversionBudget::default()).unwrap() {
        Intersection::Finished { fsm, trace } => (fsm, trace),
        Intersection::Stopped { reason, .. } => panic!("stopped: {reason:?}"),
    }
}

fn stages(trace: &[ConversionStep]) -> Vec<u8> {
    trace
        .iter()
        .filter_map(|s| match s.change {
            Change::Stage { stage } => Some(stage),
            _ => None,
        })
        .collect()
}

#[test]
fn intersection_runs_the_de_morgan_stages() {
    let (result, trace) = run(EVEN, A_STAR_B_STAR_DFSM);
    // Both machines are complete DFSMs, so only the union needs to be made complete.
    assert_eq!(stages(&trace), vec![2, 4, 5, 6, 7]);
    let stage_keys: Vec<&str> = trace
        .iter()
        .filter(|s| matches!(s.change, Change::Stage { .. }))
        .map(|s| s.message.key)
        .collect();
    assert_eq!(
        stage_keys,
        [
            "intersection.stage.complement_first",
            "intersection.stage.complement_second",
            "intersection.stage.union",
            "intersection.stage.complete_union",
            "intersection.stage.complement_union",
        ]
    );
    assert!(keys(&trace).contains(&"determinize.closure"));
    assert!(keys(&trace).contains(&"union.new_start"));
    assert!(keys(&trace).contains(&"complement.accepting"));
    assert_eq!(result.kind, FsmKind::Dfsm);
    assert!(
        validate(&result)
            .iter()
            .all(|i| i.severity != Severity::Error)
    );
    // even length and of the form a*b*
    for w in all_strings(2, 6) {
        let in_a_star_b_star = w
            .windows(2)
            .all(|p| !(p[0] == SymbolId(1) && p[1] == SymbolId(0)));
        assert_eq!(
            accepts(&result, &w),
            w.len() % 2 == 0 && in_a_star_b_star,
            "{w:?}"
        );
    }
}

#[test]
fn machines_that_are_not_complete_dfsms_are_made_complete_first() {
    let (_, trace) = run(A_STAR_B_STAR, ONLY_A);
    assert_eq!(stages(&trace), vec![1, 2, 3, 4, 5, 6, 7]);
    assert_eq!(keys(&trace)[0], "intersection.stage.complete_first");
}

#[test]
fn a_machine_and_its_complement_have_nothing_in_common() {
    let (result, _) = run(EVEN, &odd());
    for w in all_strings(2, 5) {
        assert!(!accepts(&result, &w));
    }
}

#[test]
fn intersection_needs_start_states_and_the_same_symbols() {
    let no_start = EVEN.replace(r#""start":0"#, r#""start":null"#);
    let b = ConversionBudget::default();
    let m = intersection(&fsm(&no_start), &fsm(EVEN), b).unwrap_err();
    assert_eq!(m.key, "intersection.no_start_state");
    assert_eq!(m.params.get("side"), Some(&Param::Text("first".into())));
    let m = intersection(&fsm(EVEN), &fsm(ENDS_10), b).unwrap_err();
    assert_eq!(m.key, "intersection.alphabet_mismatch");
}

#[test]
fn a_budget_stop_inside_a_stage_returns_the_trace_so_far() {
    let big = nth_from_end(12); // its DFSM needs 4,096 states
    let result = intersection(&fsm(&big), &fsm(&big), ConversionBudget::default()).unwrap();
    let Intersection::Stopped {
        reason,
        partial_trace,
    } = result
    else {
        panic!()
    };
    assert_eq!(reason, StopReason::MaxStates);
    assert_eq!(keys(&partial_trace)[0], "intersection.stage.complete_first");
    assert!(partial_trace.len() > 1);
}

// ---- properties ----

fn word(raw: &[usize], k: usize) -> Vec<SymbolId> {
    if k == 0 {
        return vec![];
    }
    raw.iter().map(|&i| SymbolId((i % k) as u16)).collect()
}

fn is_different(r: &Equivalence) -> bool {
    matches!(r, Equivalence::Different { .. })
}

proptest! {
    #[test]
    fn the_union_accepts_what_either_machine_accepts(
        (a, b) in arb_pair(),
        raw in prop::collection::vec(0usize..16, 0..8),
    ) {
        prop_assume!(a.start.is_some() && b.start.is_some());
        let op = union(&a, &b).unwrap();
        prop_assert_eq!(op.fsm.kind, FsmKind::Ndfsm);
        prop_assert!(validate(&op.fsm).iter().all(|i| i.severity != Severity::Error));
        let w = word(&raw, a.alphabet.len());
        prop_assert_eq!(accepts(&op.fsm, &w), accepts(&a, &w) || accepts(&b, &w));
    }

    #[test]
    fn the_intersection_accepts_what_both_machines_accept(
        (a, b) in arb_pair(),
        raw in prop::collection::vec(0usize..16, 0..8),
    ) {
        prop_assume!(a.start.is_some() && b.start.is_some());
        let result = intersection(&a, &b, ConversionBudget::default()).unwrap();
        let Intersection::Finished { fsm: both, .. } = result else { return Ok(()) };
        prop_assert_eq!(both.kind, FsmKind::Dfsm);
        prop_assert!(validate(&both).iter().all(|i| i.severity != Severity::Error));
        let w = word(&raw, a.alphabet.len());
        prop_assert_eq!(accepts(&both, &w), accepts(&a, &w) && accepts(&b, &w));
    }

    #[test]
    fn the_complement_accepts_exactly_the_other_strings(
        original in arb_fsm(),
        raw in prop::collection::vec(0usize..16, 0..8),
    ) {
        prop_assume!(original.start.is_some());
        let Conversion::Finished { dfsm: same, .. } =
            determinize(&original, ConversionBudget::default()).unwrap()
        else {
            return Ok(());
        };
        // `same` is a complete DFSM for the language of `original`.
        let op = complement(&same).unwrap();
        let w = word(&raw, original.alphabet.len());
        prop_assert_eq!(accepts(&op.fsm, &w), !accepts(&original, &w));
        prop_assert_eq!(op.trace.len(), same.states.len());
        prop_assert_eq!(&complement(&op.fsm).unwrap().fsm, &same);
        // A language and its complement always differ (at least on one string).
        let quick = EquivalenceBudget { max_visits: 20, max_length: 2, max_strings: 1, ..EquivalenceBudget::default() };
        prop_assert!(is_different(&equivalent(&same, &op.fsm, quick).unwrap()));
    }

    #[test]
    fn small_budgets_never_panic(
        (a, b) in arb_pair(),
        max_states in 0usize..6,
        max_steps in 0usize..30,
    ) {
        prop_assume!(a.start.is_some() && b.start.is_some());
        let budget = ConversionBudget { max_states, max_steps };
        let first = intersection(&a, &b, budget).unwrap();
        let again = intersection(&a, &b, budget).unwrap();
        prop_assert_eq!(format!("{first:?}"), format!("{again:?}"));
    }
}
