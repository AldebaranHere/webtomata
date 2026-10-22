use engine_core::{
    Budget, Change, Conversion, ConversionBudget, ConversionStep, Fsm, FsmKind, Severity,
    Simulation, StopReason, SymbolId, determinize, simulate, validate,
};
use proptest::prelude::*;

mod common;
use common::{A_STAR_B_STAR, ENDS_10, PARTIAL, arb_fsm};

fn fsm(json: &str) -> Fsm {
    Fsm::from_json(json).unwrap()
}

fn convert(json: &str, budget: ConversionBudget) -> Conversion {
    determinize(&fsm(json), budget).unwrap()
}

fn finished(json: &str) -> (Fsm, Vec<Vec<u32>>, Vec<String>) {
    match convert(json, ConversionBudget::default()) {
        Conversion::Finished {
            dfsm,
            subsets,
            trace,
        } => (
            dfsm,
            subsets
                .iter()
                .map(|s| s.iter().map(|x| x.0).collect())
                .collect(),
            describe(&trace),
        ),
        Conversion::Stopped { reason, .. } => panic!("stopped: {reason:?}"),
    }
}

fn ids<T: Copy>(xs: &[T], f: impl Fn(T) -> u32) -> Vec<u32> {
    xs.iter().map(|&x| f(x)).collect()
}

/// One short line per step, so tests can compare the whole trace at once.
fn describe(trace: &[ConversionStep]) -> Vec<String> {
    trace
        .iter()
        .map(|s| match &s.change {
            Change::Closure { state, closure } => {
                format!("closure {} {:?}", state.0, ids(closure, |x| x.0))
            }
            Change::NewState { state, members } => {
                format!("new {} {:?}", state.0, ids(members, |x| x.0))
            }
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

fn budget(max_states: usize, max_steps: usize) -> ConversionBudget {
    ConversionBudget {
        max_states,
        max_steps,
    }
}

// ---- textbook examples (Rich, subset construction) ----

#[test]
fn ends_in_10_gives_three_subsets() {
    let (dfsm, subsets, trace) = finished(ENDS_10);
    assert_eq!(dfsm.kind, FsmKind::Dfsm);
    assert_eq!(subsets, vec![vec![0], vec![0, 1], vec![0, 2]]);
    assert_eq!(dfsm.start.map(|s| s.0), Some(0));
    assert_eq!(ids(&dfsm.accepting, |s| s.0), vec![2]);
    assert_eq!(
        transitions(&dfsm),
        vec![
            (0, 0, 0),
            (0, 1, 1),
            (1, 0, 2),
            (1, 1, 1),
            (2, 0, 0),
            (2, 1, 1)
        ]
    );
    assert_eq!(
        trace,
        [
            "closure 0 [0]",
            "closure 1 [1]",
            "closure 2 [2]",
            "new 0 [0]",
            "start 0",
            "t 0 0 0",
            "new 1 [0, 1]",
            "t 0 1 1",
            "new 2 [0, 2]",
            "t 1 0 2",
            "t 1 1 1",
            "t 2 0 0",
            "t 2 1 1",
            "acc 2",
        ]
    );
}

#[test]
fn epsilon_closure_and_the_dead_state() {
    let (dfsm, subsets, trace) = finished(A_STAR_B_STAR);
    assert_eq!(subsets, vec![vec![0, 1], vec![1], vec![]]);
    assert_eq!(ids(&dfsm.accepting, |s| s.0), vec![0, 1]);
    assert_eq!(
        transitions(&dfsm),
        vec![
            (0, 0, 0),
            (0, 1, 1),
            (1, 0, 2),
            (1, 1, 1),
            (2, 0, 2),
            (2, 1, 2)
        ]
    );
    assert_eq!(
        trace,
        [
            "closure 0 [0, 1]",
            "closure 1 [1]",
            "new 0 [0, 1]",
            "start 0",
            "t 0 0 0",
            "new 1 [1]",
            "t 0 1 1",
            "new 2 []",
            "t 1 0 2",
            "t 1 1 1",
            "t 2 0 2",
            "t 2 1 2",
            "acc 0",
            "acc 1",
        ]
    );
}

#[test]
fn a_dfsm_with_a_missing_transition_becomes_complete() {
    let (dfsm, subsets, _) = finished(PARTIAL);
    assert_eq!(subsets, vec![vec![0], vec![1], vec![]]);
    assert_eq!(ids(&dfsm.accepting, |s| s.0), vec![1]);
    assert!(
        validate(&dfsm)
            .iter()
            .all(|i| i.severity != Severity::Error)
    );
}

#[test]
fn messages_carry_keys_and_parameters() {
    let Conversion::Finished { trace, .. } = convert(ENDS_10, ConversionBudget::default()) else {
        panic!()
    };
    let keys: Vec<&str> = trace.iter().map(|s| s.message.key).collect();
    assert_eq!(keys[0], "determinize.closure");
    assert_eq!(keys[3], "determinize.new_state");
    assert_eq!(keys[4], "determinize.start");
    assert_eq!(keys[5], "determinize.transition");
    assert_eq!(*keys.last().unwrap(), "determinize.accepting");
    assert!(trace[5].message.params.contains_key("symbol"));
}

// ---- errors and budgets ----

#[test]
fn a_machine_without_a_start_state_cannot_be_converted() {
    let json = ENDS_10.replace(r#""start":0"#, r#""start":null"#);
    let m = determinize(&fsm(&json), ConversionBudget::default()).unwrap_err();
    assert_eq!(m.key, "determinize.no_start_state");
}

fn stopped(json: &str, b: ConversionBudget) -> (StopReason, usize) {
    match convert(json, b) {
        Conversion::Stopped {
            reason,
            partial_trace,
        } => (reason, partial_trace.len()),
        Conversion::Finished { .. } => panic!("should have stopped"),
    }
}

#[test]
fn too_many_states_stops_with_the_trace_so_far() {
    assert!(matches!(
        convert(ENDS_10, budget(3, 100_000)),
        Conversion::Finished { .. }
    ));
    assert_eq!(
        stopped(ENDS_10, budget(2, 100_000)),
        (StopReason::MaxStates, 8)
    );
    assert_eq!(
        stopped(ENDS_10, budget(0, 100_000)),
        (StopReason::MaxStates, 3)
    );
}

#[test]
fn too_many_steps_stops_with_the_trace_so_far() {
    // The whole conversion takes 14 steps.
    assert!(matches!(
        convert(ENDS_10, budget(2000, 14)),
        Conversion::Finished { .. }
    ));
    assert_eq!(
        stopped(ENDS_10, budget(2000, 13)),
        (StopReason::MaxSteps, 13)
    );
    assert_eq!(stopped(ENDS_10, budget(2000, 0)), (StopReason::MaxSteps, 0));
}

#[test]
fn an_exponential_machine_stops_at_the_state_limit() {
    // "The 12th symbol from the end is a" needs 2^12 = 4096 subsets.
    let n = 12;
    let mut t = vec![
        r#"{"from":0,"on":"a","to":0}"#.to_string(),
        r#"{"from":0,"on":"b","to":0}"#.to_string(),
        r#"{"from":0,"on":"a","to":1}"#.to_string(),
    ];
    for i in 1..n {
        t.push(format!(r#"{{"from":{i},"on":"a","to":{}}}"#, i + 1));
        t.push(format!(r#"{{"from":{i},"on":"b","to":{}}}"#, i + 1));
    }
    let states: Vec<String> = (0..=n).map(|i| i.to_string()).collect();
    let json = format!(
        r#"{{"schemaVersion":1,"kind":"ndfsm","alphabet":["a","b"],"states":[{}],"start":0,"accepting":[{n}],"transitions":[{}]}}"#,
        states.join(","),
        t.join(",")
    );
    let (reason, _) = stopped(&json, ConversionBudget::default());
    assert_eq!(reason, StopReason::MaxStates);
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

proptest! {
    #[test]
    fn the_dfsm_accepts_exactly_what_the_original_accepts(
        original in arb_fsm(),
        raw in prop::collection::vec(0usize..16, 0..9),
    ) {
        prop_assume!(original.start.is_some());
        let Conversion::Finished { dfsm, .. } =
            determinize(&original, ConversionBudget::default()).unwrap()
        else {
            return Err(TestCaseError::fail("stopped"));
        };
        let input = input_for(&original, &raw);
        prop_assert_eq!(accepted(&original, &input), accepted(&dfsm, &input));
    }

    #[test]
    fn the_result_is_a_valid_complete_dfsm_and_the_trace_matches_it(original in arb_fsm()) {
        prop_assume!(original.start.is_some());
        let Conversion::Finished { dfsm, subsets, trace } =
            determinize(&original, ConversionBudget::default()).unwrap()
        else {
            return Err(TestCaseError::fail("stopped"));
        };
        prop_assert_eq!(dfsm.kind, FsmKind::Dfsm);
        prop_assert!(validate(&dfsm).iter().all(|i| i.severity != Severity::Error));
        prop_assert_eq!(dfsm.transitions.len(), dfsm.states.len() * dfsm.alphabet.len());
        prop_assert_eq!(subsets.len(), dfsm.states.len());
        let count = |f: fn(&Change) -> bool| trace.iter().filter(|s| f(&s.change)).count();
        prop_assert_eq!(count(|c| matches!(c, Change::Closure { .. })), original.states.len());
        prop_assert_eq!(count(|c| matches!(c, Change::NewState { .. })), dfsm.states.len());
        prop_assert_eq!(count(|c| matches!(c, Change::Transition { .. })), dfsm.transitions.len());
        prop_assert_eq!(count(|c| matches!(c, Change::Accepting { .. })), dfsm.accepting.len());
    }

    #[test]
    fn small_budgets_never_panic_and_are_respected(
        original in arb_fsm(),
        max_states in 0usize..6,
        max_steps in 0usize..30,
    ) {
        prop_assume!(original.start.is_some());
        let b = budget(max_states, max_steps);
        let first = determinize(&original, b).unwrap();
        match &first {
            Conversion::Finished { dfsm, trace, .. } => {
                prop_assert!(dfsm.states.len() <= max_states);
                prop_assert!(trace.len() <= max_steps);
            }
            Conversion::Stopped { partial_trace, .. } => prop_assert!(partial_trace.len() <= max_steps),
        }
        let again = determinize(&original, b).unwrap();
        prop_assert_eq!(format!("{first:?}"), format!("{again:?}"));
    }
}
