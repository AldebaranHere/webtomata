use engine_core::{
    Fsm, FsmKind, Nondeterminism, Param, StateId, SymbolId, Transition, nondeterministic_states,
    validate,
};
use proptest::prelude::*;
use std::collections::BTreeSet;

mod common;
use common::{A_STAR_B_STAR, ENDS_10, EVEN, PARTIAL, arb_fsm};

fn fsm(json: &str) -> Fsm {
    Fsm::from_json(json).unwrap()
}

fn entry(state: u32, symbols: &[u16], epsilon: bool) -> Nondeterminism {
    Nondeterminism {
        state: StateId(state),
        symbols: symbols.iter().map(|&s| SymbolId(s)).collect(),
        epsilon,
    }
}

// ---- Rich's machines ----

#[test]
fn two_transitions_on_one_symbol_mark_the_state() {
    // ENDS_10 has 0 -1-> 0 and 0 -1-> 1. The symbol "1" is number 1 in the alphabet.
    assert_eq!(
        nondeterministic_states(&fsm(ENDS_10)),
        vec![entry(0, &[1], false)]
    );
}

#[test]
fn an_epsilon_transition_marks_the_state() {
    assert_eq!(
        nondeterministic_states(&fsm(A_STAR_B_STAR)),
        vec![entry(0, &[], true)]
    );
}

#[test]
fn a_dfsm_has_no_nondeterministic_state() {
    assert_eq!(nondeterministic_states(&fsm(EVEN)), vec![]);
}

#[test]
fn a_missing_transition_is_not_nondeterminism() {
    assert_eq!(nondeterministic_states(&fsm(PARTIAL)), vec![]);
}

#[test]
fn a_machine_without_transitions_has_none() {
    let json = r#"{"schemaVersion":1,"kind":"ndfsm","alphabet":[],"states":[0],"start":0,"accepting":[],"transitions":[]}"#;
    assert_eq!(nondeterministic_states(&fsm(json)), vec![]);
}

// ---- details ----

#[test]
fn a_state_can_have_both_problems_and_several_symbols() {
    // State 5: two transitions on a, two on c, and an ε-transition. State 2: two on b.
    let json = r#"{"schemaVersion":1,"kind":"ndfsm","alphabet":["a","b","c"],"states":[2,5,7],"start":5,"accepting":[7],
        "transitions":[
          {"from":5,"on":"c","to":7},{"from":5,"on":"c","to":5},
          {"from":5,"on":"a","to":2},{"from":5,"on":"a","to":7},
          {"from":5,"on":null,"to":2},
          {"from":2,"on":"b","to":2},{"from":2,"on":"b","to":7},
          {"from":7,"on":"a","to":7}]}"#;
    assert_eq!(
        nondeterministic_states(&fsm(json)),
        vec![entry(2, &[1], false), entry(5, &[0, 2], true)]
    );
}

#[test]
fn two_identical_transitions_count_as_two() {
    // The same as validate: two transitions on one symbol, even with the same target.
    let json = r#"{"schemaVersion":1,"kind":"ndfsm","alphabet":["a"],"states":[0,1],"start":0,"accepting":[1],
        "transitions":[{"from":0,"on":"a","to":1},{"from":0,"on":"a","to":1}]}"#;
    assert_eq!(
        nondeterministic_states(&fsm(json)),
        vec![entry(0, &[0], false)]
    );
}

#[test]
fn the_kind_of_the_machine_does_not_matter() {
    // A machine that says it is a DFSM but is not one still gets a list.
    let json = ENDS_10.replace(r#""kind":"ndfsm""#, r#""kind":"dfsm""#);
    assert_eq!(
        nondeterministic_states(&fsm(&json)),
        vec![entry(0, &[1], false)]
    );
}

// ---- properties ----

fn number(m: &engine_core::Message, name: &str) -> u32 {
    match m.params.get(name) {
        Some(Param::Int(n)) => *n as u32,
        other => panic!("param {name}: {other:?}"),
    }
}

proptest! {
    #[test]
    fn the_list_follows_the_definition(m in arb_fsm()) {
        let list = nondeterministic_states(&m);

        // Sorted by state, no state twice, symbols sorted without repeats, no empty entry.
        prop_assert!(list.windows(2).all(|w| w[0].state < w[1].state));
        for e in &list {
            prop_assert!(e.symbols.windows(2).all(|w| w[0] < w[1]));
            prop_assert!(!e.symbols.is_empty() || e.epsilon);
        }

        // The definition, written again from the transitions.
        for &state in &m.states {
            let from: Vec<&Transition> = m.transitions.iter().filter(|t| t.from == state).collect();
            let epsilon = from.iter().any(|t| t.on.is_none());
            let symbols: Vec<SymbolId> = (0..m.alphabet.len() as u16)
                .map(SymbolId)
                .filter(|&s| from.iter().filter(|t| t.on == Some(s)).count() >= 2)
                .collect();
            let found = list.iter().find(|e| e.state == state);
            match found {
                Some(e) => {
                    prop_assert_eq!(&e.symbols, &symbols);
                    prop_assert_eq!(e.epsilon, epsilon);
                }
                None => prop_assert!(symbols.is_empty() && !epsilon),
            }
        }
    }

    /// `validate` is independent code. Read as a DFSM, the machine has an error exactly for the
    /// states and symbols in the list.
    #[test]
    fn the_list_agrees_with_validate(m in arb_fsm()) {
        let list = nondeterministic_states(&m);
        let as_dfsm = Fsm::new(
            FsmKind::Dfsm,
            m.alphabet.clone(),
            m.states.clone(),
            m.start,
            m.accepting.clone(),
            m.transitions.clone(),
        )
        .unwrap();

        let mut doubles = BTreeSet::new();
        let mut epsilons = BTreeSet::new();
        for issue in validate(&as_dfsm) {
            match issue.message.key {
                "dfsm.duplicate_transition" => {
                    let symbol = match issue.message.params.get("symbol") {
                        Some(Param::Text(t)) => m.alphabet.id(t).unwrap(),
                        other => panic!("{other:?}"),
                    };
                    doubles.insert((number(&issue.message, "state"), symbol.0));
                }
                "dfsm.epsilon_transition" => {
                    epsilons.insert(number(&issue.message, "from"));
                }
                _ => {}
            }
        }
        let from_list_doubles: BTreeSet<(u32, u16)> = list
            .iter()
            .flat_map(|e| e.symbols.iter().map(move |s| (e.state.0, s.0)))
            .collect();
        let from_list_epsilons: BTreeSet<u32> =
            list.iter().filter(|e| e.epsilon).map(|e| e.state.0).collect();
        prop_assert_eq!(from_list_doubles, doubles);
        prop_assert_eq!(from_list_epsilons, epsilons);
    }
}
