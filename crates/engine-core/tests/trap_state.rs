use engine_core::{
    Alphabet, Budget, Change, ConversionStep, Equivalence, EquivalenceBudget, Fsm, FsmKind,
    Message, Minimization, MinimizeBudget, Param, Severity, Simulation, StateId, SymbolId,
    Transition, add_trap_state, complement, equivalent, minimize, simulate, validate,
};
use proptest::prelude::*;

mod common;
use common::{A_STAR, ENDS_10, PARTIAL, all_strings};

fn fsm(json: &str) -> Fsm {
    Fsm::from_json(json).unwrap()
}

// L = {w in {a, b}* : w starts with ab}. The dead state is not drawn, as in JFLAP.
const STARTS_AB: &str = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,1,2],"start":0,"accepting":[2],"transitions":[{"from":0,"on":"a","to":1},{"from":1,"on":"b","to":2},{"from":2,"on":"a","to":2},{"from":2,"on":"b","to":2}]}"#;

fn keys(trace: &[ConversionStep]) -> Vec<&'static str> {
    trace.iter().map(|s| s.message.key).collect()
}

fn accepts(fsm: &Fsm, input: &[SymbolId]) -> bool {
    match simulate(fsm, input, Budget::default()).unwrap() {
        Simulation::Finished { accepted, .. } => accepted,
        Simulation::Stopped { .. } => panic!("the run stopped"),
    }
}

fn text(m: &Message, name: &str) -> String {
    match m.params.get(name) {
        Some(Param::Text(t)) => t.clone(),
        other => panic!("param {name}: {other:?}"),
    }
}

fn int(m: &Message, name: &str) -> i64 {
    match m.params.get(name) {
        Some(Param::Int(n)) => *n,
        other => panic!("param {name}: {other:?}"),
    }
}

fn t(from: u32, on: u16, to: u32) -> Transition {
    Transition {
        from: StateId(from),
        on: Some(SymbolId(on)),
        to: StateId(to),
    }
}

// ---- the textbook case ----

#[test]
fn a_dfsm_without_a_dead_state_gets_one() {
    let op = add_trap_state(&fsm(STARTS_AB)).unwrap();
    let d = &op.fsm;
    assert_eq!(d.kind, FsmKind::Dfsm);
    assert_eq!(d.states, [0, 1, 2, 3].map(StateId));
    assert_eq!(d.start, Some(StateId(0)));
    assert_eq!(d.accepting, vec![StateId(2)]);
    assert_eq!(
        d.transitions,
        vec![
            t(0, 0, 1),
            t(0, 1, 3),
            t(1, 0, 3),
            t(1, 1, 2),
            t(2, 0, 2),
            t(2, 1, 2),
            t(3, 0, 3),
            t(3, 1, 3),
        ]
    );
    assert!(validate(d).iter().all(|i| i.severity != Severity::Error));
}

#[test]
fn the_trace_shows_the_new_state_the_missing_transitions_and_the_loops() {
    let op = add_trap_state(&fsm(STARTS_AB)).unwrap();
    assert_eq!(
        keys(&op.trace),
        [
            "trap.new_state",
            "trap.transition",
            "trap.transition",
            "trap.loop",
            "trap.loop"
        ]
    );
    let changes: Vec<&Change> = op.trace.iter().map(|s| &s.change).collect();
    assert_eq!(
        changes,
        vec![
            &Change::NewState {
                state: StateId(3),
                members: vec![]
            },
            &Change::Transition {
                from: StateId(0),
                symbol: SymbolId(1),
                to: StateId(3)
            },
            &Change::Transition {
                from: StateId(1),
                symbol: SymbolId(0),
                to: StateId(3)
            },
            &Change::Transition {
                from: StateId(3),
                symbol: SymbolId(0),
                to: StateId(3)
            },
            &Change::Transition {
                from: StateId(3),
                symbol: SymbolId(1),
                to: StateId(3)
            },
        ]
    );
    let m = &op.trace[0].message;
    assert_eq!(int(m, "state"), 3);
    let m = &op.trace[1].message;
    assert_eq!(
        (int(m, "state"), text(m, "symbol").as_str(), int(m, "to")),
        (0, "b", 3)
    );
    assert_eq!(text(&op.trace[4].message, "symbol"), "b");
}

#[test]
fn the_new_state_comes_after_the_highest_id() {
    // PARTIAL has the states 0 and 1; move them to 4 and 9.
    let json = PARTIAL
        .replace(r#""states":[0,1]"#, r#""states":[4,9]"#)
        .replace(r#""start":0"#, r#""start":4"#)
        .replace(r#""accepting":[1]"#, r#""accepting":[9]"#)
        .replace(r#""from":0,"on":"a","to":1"#, r#""from":4,"on":"a","to":9"#);
    let op = add_trap_state(&fsm(&json)).unwrap();
    assert_eq!(op.fsm.states, [4, 9, 10].map(StateId));
    assert_eq!(op.fsm.accepting, vec![StateId(9)]);
}

#[test]
fn a_complete_dfsm_comes_back_unchanged() {
    for json in [A_STAR, common::EVEN] {
        let d = fsm(json);
        let op = add_trap_state(&d).unwrap();
        assert_eq!(op.fsm, d);
        assert_eq!(keys(&op.trace), ["trap.already_complete"]);
        assert_eq!(op.trace[0].change, Change::AlreadyComplete);
    }
}

// ---- errors ----

#[test]
fn other_machines_are_refused() {
    let ndfsm = add_trap_state(&fsm(ENDS_10)).unwrap_err();
    assert_eq!(ndfsm.key, "trap.not_a_dfsm");

    // A start state is needed.
    let no_start = STARTS_AB.replace(r#""start":0"#, r#""start":null"#);
    assert_eq!(
        add_trap_state(&fsm(&no_start)).unwrap_err().key,
        "trap.invalid_machine"
    );

    // A DFSM with two transitions on one symbol, or with an ε-transition.
    let duplicate = STARTS_AB.replace(
        r#"{"from":2,"on":"b","to":2}"#,
        r#"{"from":2,"on":"b","to":2},{"from":2,"on":"b","to":1}"#,
    );
    let epsilon = STARTS_AB.replace(
        r#"{"from":2,"on":"b","to":2}"#,
        r#"{"from":2,"on":"b","to":2},{"from":2,"on":null,"to":1}"#,
    );
    for json in [duplicate, epsilon] {
        assert_eq!(
            add_trap_state(&fsm(&json)).unwrap_err().key,
            "trap.invalid_machine"
        );
    }
}

#[test]
fn a_machine_that_is_already_at_the_state_limit_is_refused() {
    let alphabet = Alphabet::new(vec!["a".into()]).unwrap();
    let states: Vec<StateId> = (0..engine_core::MAX_STATES as u32).map(StateId).collect();
    let big = Fsm::new(
        FsmKind::Dfsm,
        alphabet,
        states,
        Some(StateId(0)),
        vec![],
        vec![], // every state misses its transition on a
    )
    .unwrap();
    let error = add_trap_state(&big).unwrap_err();
    assert_eq!(error.key, "machine.limit_exceeded");
    assert_eq!(text(&error, "what"), "states");
}

// ---- what the button is for ----

#[test]
fn complement_works_on_the_result() {
    let d = fsm(STARTS_AB);
    assert_eq!(
        complement(&d).unwrap_err().key,
        "complement.invalid_machine"
    );
    let complete = add_trap_state(&d).unwrap().fsm;
    let opposite = complement(&complete).unwrap().fsm;
    for input in all_strings(2, 6) {
        assert_eq!(
            accepts(&opposite, &input),
            !accepts(&d, &input),
            "{input:?}"
        );
    }
}

#[test]
fn minimize_works_on_the_result() {
    let d = fsm(STARTS_AB);
    assert_eq!(
        minimize(&d, MinimizeBudget::default()).unwrap_err().key,
        "minimize.invalid_machine"
    );
    let complete = add_trap_state(&d).unwrap().fsm;
    let Minimization::Finished { dfsm, .. } =
        minimize(&complete, MinimizeBudget::default()).unwrap()
    else {
        panic!("stopped");
    };
    // The prefix ab needs four classes: before a, after a, after ab, and the dead state.
    assert_eq!(dfsm.states.len(), 4);
}

// ---- properties ----

/// Random DFSMs over 1 to 3 symbols. Each (state, symbol) has a target or is missing.
fn arb_partial_dfsm() -> impl Strategy<Value = Fsm> {
    (1usize..4, 1u32..6).prop_flat_map(|(k, n)| {
        (
            prop::collection::vec(prop::option::weighted(0.6, 0..n), (n as usize) * k),
            prop::collection::vec(prop::bool::ANY, n as usize),
            Just((k, n)),
        )
            .prop_map(|(targets, accepting, (k, n))| {
                let id = |i: u32| StateId(i * 3);
                let transitions = targets
                    .iter()
                    .enumerate()
                    .filter_map(|(i, to)| {
                        to.map(|to| Transition {
                            from: id((i / k) as u32),
                            on: Some(SymbolId((i % k) as u16)),
                            to: id(to),
                        })
                    })
                    .collect();
                let names = ["a", "b", "c"][..k].iter().map(|s| s.to_string()).collect();
                Fsm::new(
                    FsmKind::Dfsm,
                    Alphabet::new(names).unwrap(),
                    (0..n).map(id).collect(),
                    Some(id(0)),
                    (0..n).filter(|&i| accepting[i as usize]).map(id).collect(),
                    transitions,
                )
                .unwrap()
            })
    })
}

proptest! {
    #[test]
    fn the_result_is_complete_and_means_the_same(d in arb_partial_dfsm()) {
        let op = add_trap_state(&d).unwrap();
        let r = &op.fsm;
        prop_assert!(validate(r).iter().all(|i| i.severity != Severity::Error));
        prop_assert_eq!(&r.accepting, &d.accepting);
        prop_assert_eq!(r.start, d.start);

        let complete = d.states.len() * d.alphabet.len() == d.transitions.len();
        if complete {
            prop_assert_eq!(r, &d);
        } else {
            // One new state, after the highest id, and it does not accept.
            prop_assert_eq!(r.states.len(), d.states.len() + 1);
            let trap = *r.states.last().unwrap();
            prop_assert_eq!(trap.0, d.states.last().unwrap().0 + 1);
            prop_assert!(!r.accepting.contains(&trap));
            // Every new transition leads to the trap; the trap only loops.
            let added: Vec<_> = r.transitions.iter().filter(|x| !d.transitions.contains(x)).collect();
            prop_assert_eq!(added.len(), r.transitions.len() - d.transitions.len());
            prop_assert!(added.iter().all(|x| x.to == trap));
            // One step for the state, one for each new transition.
            prop_assert_eq!(op.trace.len(), 1 + added.len());
        }

        let same = matches!(
            equivalent(&d, r, EquivalenceBudget::default()).unwrap(),
            Equivalence::Equivalent { .. }
        );
        prop_assert!(same);
        for input in all_strings(d.alphabet.len(), 5) {
            prop_assert_eq!(accepts(&d, &input), accepts(r, &input));
        }
    }
}
