//! Differential tests: the engine against answers from the Python package `automata-lib`.
//! The fixtures are made by `tools/gen_fixtures.py` and are committed, so these tests do not
//! need Python. Languages are compared with `equivalent`, because the two programs number
//! their states in different ways.

use engine_core::{
    Budget, Conversion, ConversionBudget, Equivalence, EquivalenceBudget, Fsm, FsmKind,
    Minimization, MinimizeBudget, Simulation, SymbolId, determinize, equivalent, minimize,
    simulate,
};
use serde_json::Value;

fn cases(text: &str) -> Vec<Value> {
    let file: Value = serde_json::from_str(text).unwrap();
    file["cases"].as_array().unwrap().clone()
}

fn fsm(case: &Value, key: &str) -> Fsm {
    Fsm::from_json(&case[key].to_string()).unwrap()
}

fn strings(case: &Value, fsm: &Fsm) -> Vec<Vec<SymbolId>> {
    case["strings"]
        .as_array()
        .unwrap()
        .iter()
        .map(|s| {
            s.as_array()
                .unwrap()
                .iter()
                .map(|c| fsm.alphabet.id(c.as_str().unwrap()).unwrap())
                .collect()
        })
        .collect()
}

fn verdicts(case: &Value, key: &str) -> Vec<bool> {
    case[key]
        .as_array()
        .unwrap()
        .iter()
        .map(|b| b.as_bool().unwrap())
        .collect()
}

fn accepts(fsm: &Fsm, input: &[SymbolId]) -> bool {
    match simulate(fsm, input, Budget::default()).unwrap() {
        Simulation::Finished { accepted, .. } => accepted,
        Simulation::Stopped { .. } => panic!("the run stopped"),
    }
}

/// The machine accepts and rejects the strings as the reference says.
fn check_strings(case: &Value, fsm: &Fsm, expected: &[bool], what: &str) {
    for (input, want) in strings(case, fsm).iter().zip(expected) {
        assert_eq!(accepts(fsm, input), *want, "{what} on {input:?}");
    }
}

fn same_language(a: &Fsm, b: &Fsm, what: &str) {
    let result = equivalent(a, b, EquivalenceBudget::default()).unwrap();
    assert!(
        matches!(result, Equivalence::Equivalent { .. }),
        "{what}: {result:?}"
    );
}

#[test]
fn determinize_matches_automata_lib() {
    let all = cases(include_str!("fixtures/determinize.json"));
    assert!(all.len() >= 100);
    for (n, case) in all.iter().enumerate() {
        let nfa = fsm(case, "input");
        let expected = fsm(case, "expected");
        let Conversion::Finished { dfsm, .. } =
            determinize(&nfa, ConversionBudget::default()).unwrap()
        else {
            panic!("case {n}: the conversion stopped");
        };
        assert_eq!(dfsm.kind, FsmKind::Dfsm, "case {n}");
        same_language(&dfsm, &expected, &format!("case {n}: language"));
        let verdicts = verdicts(case, "accepts");
        check_strings(case, &nfa, &verdicts, &format!("case {n}: NDFSM"));
        check_strings(case, &dfsm, &verdicts, &format!("case {n}: DFSM"));
    }
}

#[test]
fn minimize_matches_automata_lib() {
    let all = cases(include_str!("fixtures/minimize.json"));
    assert!(all.len() >= 100);
    for (n, case) in all.iter().enumerate() {
        let dfa = fsm(case, "input");
        let expected = fsm(case, "expected");
        let Minimization::Finished { dfsm, .. } =
            minimize(&dfa, MinimizeBudget::default()).unwrap()
        else {
            panic!("case {n}: the minimization stopped");
        };
        same_language(&dfsm, &expected, &format!("case {n}: language"));
        // A minimal DFSM is unique up to the names of its states, so the sizes must agree.
        let states = case["expectedStates"].as_u64().unwrap() as usize;
        assert_eq!(dfsm.states.len(), states, "case {n}: number of states");
        check_strings(
            case,
            &dfsm,
            &verdicts(case, "accepts"),
            &format!("case {n}"),
        );
    }
}

#[test]
fn equivalence_matches_automata_lib() {
    let all = cases(include_str!("fixtures/equivalence.json"));
    assert!(all.len() >= 100);
    let (mut same, mut different) = (0, 0);
    for (n, case) in all.iter().enumerate() {
        let first = fsm(case, "first");
        let second = fsm(case, "second");
        check_strings(case, &first, &verdicts(case, "firstAccepts"), "first");
        check_strings(case, &second, &verdicts(case, "secondAccepts"), "second");
        let result = equivalent(&first, &second, EquivalenceBudget::default()).unwrap();
        match result {
            Equivalence::Equivalent { .. } => {
                same += 1;
                assert!(case["equivalent"].as_bool().unwrap(), "case {n}");
            }
            Equivalence::Different { witness, .. } => {
                different += 1;
                assert!(!case["equivalent"].as_bool().unwrap(), "case {n}");
                // The witness is accepted by exactly one machine, as the result says.
                let word = &witness.string;
                assert_eq!(accepts(&first, word), witness.candidate_accepts, "case {n}");
                assert_ne!(accepts(&first, word), accepts(&second, word), "case {n}");
            }
            other => panic!("case {n}: {other:?}"),
        }
    }
    // The fixtures hold both kinds of pair.
    assert!(
        same >= 20 && different >= 20,
        "{same} equal, {different} different"
    );
}
