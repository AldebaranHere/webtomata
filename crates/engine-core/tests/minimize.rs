use engine_core::{
    Budget, Change, Conversion, ConversionBudget, ConversionStep, Fsm, FsmKind, Minimization,
    MinimizeBudget, Simulation, StopReason, SymbolId, determinize, minimize, simulate,
};
use proptest::prelude::*;
use std::collections::HashMap;

mod common;
use common::{ENDS_10, EVEN, PARTIAL, arb_fsm};

// Rich, Example 5.28 (and the course slides): six states over {a, b}, start 1, accepting {2, 4}.
const RICH_5_28: &str = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[1,2,3,4,5,6],"start":1,"accepting":[2,4],"transitions":[{"from":1,"on":"a","to":2},{"from":1,"on":"b","to":4},{"from":2,"on":"a","to":3},{"from":2,"on":"b","to":6},{"from":3,"on":"a","to":2},{"from":3,"on":"b","to":4},{"from":4,"on":"a","to":6},{"from":4,"on":"b","to":5},{"from":5,"on":"a","to":2},{"from":5,"on":"b","to":4},{"from":6,"on":"a","to":6},{"from":6,"on":"b","to":6}]}"#;

// L = {w : |w| is even}, counting modulo 4 (states 0 and 2 accept)
const EVEN_MOD_4: &str = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,1,2,3],"start":0,"accepting":[0,2],"transitions":[{"from":0,"on":"a","to":1},{"from":0,"on":"b","to":1},{"from":1,"on":"a","to":2},{"from":1,"on":"b","to":2},{"from":2,"on":"a","to":3},{"from":2,"on":"b","to":3},{"from":3,"on":"a","to":0},{"from":3,"on":"b","to":0}]}"#;

// EVEN plus a state 2 that no input can reach
const EVEN_WITH_UNREACHABLE: &str = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,1,2],"start":0,"accepting":[0,2],"transitions":[{"from":0,"on":"a","to":1},{"from":0,"on":"b","to":1},{"from":1,"on":"a","to":0},{"from":1,"on":"b","to":0},{"from":2,"on":"a","to":2},{"from":2,"on":"b","to":2}]}"#;

const ALL_ACCEPTING: &str = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a"],"states":[0,1,2],"start":0,"accepting":[0,1,2],"transitions":[{"from":0,"on":"a","to":1},{"from":1,"on":"a","to":2},{"from":2,"on":"a","to":0}]}"#;

const NONE_ACCEPTING: &str = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a"],"states":[0,1,2],"start":0,"accepting":[],"transitions":[{"from":0,"on":"a","to":1},{"from":1,"on":"a","to":2},{"from":2,"on":"a","to":0}]}"#;

fn fsm(json: &str) -> Fsm {
    Fsm::from_json(json).unwrap()
}

fn run(json: &str) -> Minimization {
    minimize(&fsm(json), MinimizeBudget::default()).unwrap()
}

fn finished(json: &str) -> (Fsm, Vec<Vec<u32>>, Vec<String>) {
    match run(json) {
        Minimization::Finished {
            dfsm,
            classes,
            trace,
        } => (dfsm, nested(&classes), describe(&trace)),
        Minimization::Stopped { reason, .. } => panic!("stopped: {reason:?}"),
    }
}

fn raw(xs: &[engine_core::StateId]) -> Vec<u32> {
    xs.iter().map(|s| s.0).collect()
}

fn nested(xs: &[Vec<engine_core::StateId>]) -> Vec<Vec<u32>> {
    xs.iter().map(|x| raw(x)).collect()
}

/// One short line per step, so tests can compare the whole trace at once.
fn describe(trace: &[ConversionStep]) -> Vec<String> {
    trace
        .iter()
        .map(|s| match &s.change {
            Change::RemoveUnreachable { state } => format!("unreachable {}", state.0),
            Change::Classes { classes } => format!("classes {:?}", nested(classes)),
            Change::Examine { class } => format!("examine {:?}", raw(class)),
            Change::NoSplit { class } => format!("no_split {:?}", raw(class)),
            Change::Split {
                class,
                kept,
                new,
                witness,
                classes,
            } => format!(
                "split {:?} -> {:?} | {:?} by {} {} {} => {:?}",
                raw(class),
                raw(kept),
                raw(new),
                witness.p.0,
                witness.q.0,
                witness.symbol.0,
                nested(classes)
            ),
            Change::NewState { state, members } => format!("new {} {:?}", state.0, raw(members)),
            Change::Start { state } => format!("start {}", state.0),
            Change::Transition { from, symbol, to } => {
                format!("t {} {} {}", from.0, symbol.0, to.0)
            }
            Change::Accepting { state } => format!("acc {}", state.0),
            other => panic!("unexpected change: {other:?}"),
        })
        .collect()
}

fn transitions(dfsm: &Fsm) -> Vec<(u32, u16, u32)> {
    dfsm.transitions
        .iter()
        .map(|t| (t.from.0, t.on.unwrap().0, t.to.0))
        .collect()
}

// ---- textbook example ----

#[test]
fn rich_example_5_28_follows_the_slide_round_by_round() {
    let (dfsm, classes, trace) = finished(RICH_5_28);
    assert_eq!(classes, vec![vec![2], vec![4], vec![1, 3, 5], vec![6]]);
    assert_eq!(dfsm.start.map(|s| s.0), Some(2));
    assert_eq!(raw(&dfsm.accepting), vec![0, 1]);
    assert_eq!(
        transitions(&dfsm),
        vec![
            (0, 0, 2),
            (0, 1, 3),
            (1, 0, 3),
            (1, 1, 2),
            (2, 0, 0),
            (2, 1, 1),
            (3, 0, 3),
            (3, 1, 3)
        ]
    );
    assert_eq!(
        trace,
        [
            "classes [[2, 4], [1, 3, 5, 6]]",
            // round 1
            "examine [2, 4]",
            "no_split [2, 4]",
            "examine [1, 3, 5, 6]",
            "split [1, 3, 5, 6] -> [1, 3, 5] | [6] by 1 6 0 => [[2, 4], [1, 3, 5], [6]]",
            // round 2
            "examine [2, 4]",
            "split [2, 4] -> [2] | [4] by 2 4 0 => [[2], [4], [1, 3, 5], [6]]",
            // round 3
            "examine [1, 3, 5]",
            "no_split [1, 3, 5]",
            // the minimal machine
            "new 0 [2]",
            "new 1 [4]",
            "new 2 [1, 3, 5]",
            "new 3 [6]",
            "start 2",
            "t 0 0 2",
            "t 0 1 3",
            "t 1 0 3",
            "t 1 1 2",
            "t 2 0 0",
            "t 2 1 1",
            "t 3 0 3",
            "t 3 1 3",
            "acc 0",
            "acc 1",
        ]
    );
}

#[test]
fn messages_carry_keys_and_parameters() {
    let Minimization::Finished { trace, .. } = run(RICH_5_28) else {
        panic!()
    };
    let split = trace
        .iter()
        .find(|s| s.message.key == "minimize.split")
        .unwrap();
    assert!(
        ["p", "q", "symbol"]
            .iter()
            .all(|k| split.message.params.contains_key(k))
    );
    let keys: Vec<&str> = trace.iter().map(|s| s.message.key).collect();
    for key in [
        "minimize.initial_classes",
        "minimize.examine",
        "minimize.no_split",
        "minimize.new_state",
        "minimize.start",
        "minimize.transition",
        "minimize.accepting",
    ] {
        assert!(keys.contains(&key), "{key}");
    }
}

// ---- other machines ----

#[test]
fn a_machine_that_counts_modulo_4_reduces_to_two_states() {
    let (dfsm, classes, _) = finished(EVEN_MOD_4);
    assert_eq!(classes, vec![vec![0, 2], vec![1, 3]]);
    assert_eq!(dfsm, fsm(EVEN));
}

#[test]
fn a_minimal_machine_comes_back_unchanged() {
    let (dfsm, classes, trace) = finished(EVEN);
    assert_eq!(classes, vec![vec![0], vec![1]]);
    assert_eq!(dfsm, fsm(EVEN));
    assert!(!trace.iter().any(|s| s.starts_with("examine")));
}

#[test]
fn unreachable_states_are_removed_first_as_visible_steps() {
    let (dfsm, classes, trace) = finished(EVEN_WITH_UNREACHABLE);
    assert_eq!(trace[0], "unreachable 2");
    assert_eq!(trace[1], "classes [[0], [1]]");
    assert_eq!(classes, vec![vec![0], vec![1]]);
    assert_eq!(dfsm, fsm(EVEN));
}

#[test]
fn one_class_means_a_one_state_machine() {
    for (json, accepting) in [(ALL_ACCEPTING, vec![0]), (NONE_ACCEPTING, vec![])] {
        let (dfsm, classes, trace) = finished(json);
        assert_eq!(classes, vec![vec![0, 1, 2]]);
        assert_eq!(raw(&dfsm.accepting), accepting);
        assert_eq!(dfsm.states.len(), 1);
        assert_eq!(&trace[1..3], ["examine [0, 1, 2]", "no_split [0, 1, 2]"]);
    }
}

// ---- errors ----

#[test]
fn only_complete_valid_dfsms_can_be_minimized() {
    let ndfsm = minimize(&fsm(ENDS_10), MinimizeBudget::default()).unwrap_err();
    assert_eq!(ndfsm.key, "minimize.not_a_dfsm");
    let partial = minimize(&fsm(PARTIAL), MinimizeBudget::default()).unwrap_err();
    assert_eq!(partial.key, "minimize.invalid_machine");
    let no_start = EVEN.replace(r#""start":0"#, r#""start":null"#);
    let m = minimize(&fsm(&no_start), MinimizeBudget::default()).unwrap_err();
    assert_eq!(m.key, "minimize.invalid_machine");
}

// ---- budget ----

fn budget(max_steps: usize) -> MinimizeBudget {
    MinimizeBudget { max_steps }
}

#[test]
fn too_many_steps_stops_with_the_trace_so_far() {
    // The whole minimization of Example 5.28 takes 24 steps.
    assert!(matches!(
        minimize(&fsm(RICH_5_28), budget(24)).unwrap(),
        Minimization::Finished { .. }
    ));
    for (limit, kept) in [(23, 23), (5, 5), (0, 0)] {
        let Minimization::Stopped {
            reason,
            partial_trace,
        } = minimize(&fsm(RICH_5_28), budget(limit)).unwrap()
        else {
            panic!("limit {limit}")
        };
        assert_eq!(reason, StopReason::MaxSteps);
        assert_eq!(partial_trace.len(), kept);
    }
}

// ---- properties ----

fn input_for(fsm: &Fsm, raw: &[usize]) -> Vec<SymbolId> {
    let k = fsm.alphabet.len();
    if k == 0 {
        return vec![];
    }
    raw.iter().map(|&i| SymbolId((i % k) as u16)).collect()
}

fn accepted(fsm: &Fsm, input: &[SymbolId]) -> bool {
    match simulate(fsm, input, Budget::default()).unwrap() {
        Simulation::Finished { accepted, .. } => accepted,
        Simulation::Stopped { .. } => panic!("stopped"),
    }
}

/// A random complete DFSM: the subset construction of a random machine.
fn complete_dfsm(original: &Fsm) -> Option<Fsm> {
    original.start?;
    match determinize(original, ConversionBudget::default()).unwrap() {
        Conversion::Finished { dfsm, .. } => Some(dfsm),
        Conversion::Stopped { .. } => None,
    }
}

/// Table filling, written independently of the engine: true if every two states of the
/// complete DFSM can be told apart by some string.
fn all_states_distinguishable(dfsm: &Fsm) -> bool {
    let delta: HashMap<(u32, u16), u32> = dfsm
        .transitions
        .iter()
        .map(|t| ((t.from.0, t.on.unwrap().0), t.to.0))
        .collect();
    let states: Vec<u32> = dfsm.states.iter().map(|s| s.0).collect();
    let accepting = |s: u32| dfsm.accepting.iter().any(|a| a.0 == s);
    let key = |p: u32, q: u32| (p.min(q), p.max(q));
    let mut marked: std::collections::HashSet<(u32, u32)> = states
        .iter()
        .flat_map(|&p| states.iter().map(move |&q| (p, q)))
        .filter(|&(p, q)| p < q && accepting(p) != accepting(q))
        .collect();
    loop {
        let mut changed = false;
        for &p in &states {
            for &q in states.iter().filter(|&&q| p < q) {
                if marked.contains(&(p, q)) {
                    continue;
                }
                let differ = (0..dfsm.alphabet.len() as u16).any(|c| {
                    let (a, b) = (delta[&(p, c)], delta[&(q, c)]);
                    a != b && marked.contains(&key(a, b))
                });
                if differ {
                    marked.insert((p, q));
                    changed = true;
                }
            }
        }
        if !changed {
            break;
        }
    }
    let n = states.len();
    marked.len() == n * n.saturating_sub(1) / 2
}

proptest! {
    #[test]
    fn the_minimal_dfsm_accepts_the_same_strings(
        original in arb_fsm(),
        raw in prop::collection::vec(0usize..16, 0..9),
    ) {
        let Some(dfsm) = complete_dfsm(&original) else { return Ok(()) };
        let Minimization::Finished { dfsm: minimal, .. } =
            minimize(&dfsm, MinimizeBudget::default()).unwrap()
        else {
            return Err(TestCaseError::fail("stopped"));
        };
        let input = input_for(&dfsm, &raw);
        prop_assert_eq!(accepted(&dfsm, &input), accepted(&minimal, &input));
        prop_assert_eq!(minimal.kind, FsmKind::Dfsm);
    }

    #[test]
    fn the_result_is_minimal_and_minimizing_again_changes_nothing(original in arb_fsm()) {
        let Some(dfsm) = complete_dfsm(&original) else { return Ok(()) };
        let Minimization::Finished { dfsm: minimal, .. } =
            minimize(&dfsm, MinimizeBudget::default()).unwrap()
        else {
            return Err(TestCaseError::fail("stopped"));
        };
        prop_assert!(minimal.states.len() <= dfsm.states.len());
        prop_assert!(all_states_distinguishable(&minimal));
        let Minimization::Finished { dfsm: again, .. } =
            minimize(&minimal, MinimizeBudget::default()).unwrap()
        else {
            return Err(TestCaseError::fail("stopped"));
        };
        prop_assert_eq!(again.states.len(), minimal.states.len());
    }

    #[test]
    fn small_budgets_never_panic_and_are_respected(original in arb_fsm(), max_steps in 0usize..40) {
        let Some(dfsm) = complete_dfsm(&original) else { return Ok(()) };
        let first = minimize(&dfsm, budget(max_steps)).unwrap();
        match &first {
            Minimization::Finished { trace, .. } => prop_assert!(trace.len() <= max_steps),
            Minimization::Stopped { partial_trace, .. } => {
                prop_assert_eq!(partial_trace.len(), max_steps)
            }
        }
        let again = minimize(&dfsm, budget(max_steps)).unwrap();
        prop_assert_eq!(format!("{first:?}"), format!("{again:?}"));
    }
}
