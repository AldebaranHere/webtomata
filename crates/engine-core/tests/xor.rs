//! XOR (the symmetric difference) of two regular languages, by the product machine: tests against
//! the definition ("exactly one of the two machines accepts"), the shape of the trace, the stages
//! that make the machines complete DFSMs first, the budgets, and the errors.

use engine_core::{
    Budget, Change, Conversion, ConversionBudget, ConversionStep, Equivalence, EquivalenceBudget,
    Fsm, FsmKind, Simulation, StateId, StopReason, SymbolId, Xor, complement, determinize,
    equivalent, simulate, validate, xor,
};
use engine_core::{Param, Severity};
use proptest::prelude::*;

mod common;
use common::{A_STAR, A_STAR_B_STAR, ENDS_10, EVEN, PARTIAL, all_strings, arb_pair};

fn fsm(json: &str) -> Fsm {
    Fsm::from_json(json).unwrap()
}

fn accepts(fsm: &Fsm, input: &[SymbolId]) -> bool {
    match simulate(fsm, input, Budget::default()).unwrap() {
        Simulation::Finished { accepted, .. } => accepted,
        Simulation::Stopped { .. } => panic!("stopped"),
    }
}

fn run(a: &str, b: &str) -> (Fsm, Vec<ConversionStep>) {
    match xor(&fsm(a), &fsm(b), ConversionBudget::default()).unwrap() {
        Xor::Finished { fsm, trace } => (fsm, trace),
        Xor::Stopped { reason, .. } => panic!("stopped: {reason:?}"),
    }
}

fn kinds(trace: &[ConversionStep]) -> Vec<&'static str> {
    trace
        .iter()
        .map(|s| match s.change {
            Change::Stage { .. } => "stage",
            Change::Pair { .. } => "pair",
            Change::Start { .. } => "start",
            Change::Transition { .. } => "transition",
            Change::Accepting { .. } => "accepting",
            _ => "other",
        })
        .collect()
}

fn stages(trace: &[ConversionStep]) -> Vec<(u8, usize)> {
    trace
        .iter()
        .filter_map(|s| match &s.change {
            Change::Stage { stage, inputs } => Some((*stage, inputs.len())),
            _ => None,
        })
        .collect()
}

fn word(raw: &[usize], k: usize) -> Vec<SymbolId> {
    if k == 0 {
        return vec![];
    }
    raw.iter().map(|&i| SymbolId((i % k) as u16)).collect()
}

#[test]
fn xor_accepts_exactly_what_one_of_the_machines_accepts() {
    // "even length" against "only a": the strings of even length with a b, and the odd strings of a.
    let (result, _) = run(EVEN, A_STAR);
    let (even, a_star) = (fsm(EVEN), fsm(A_STAR));
    assert_eq!(result.kind, FsmKind::Dfsm);
    for w in all_strings(2, 7) {
        assert_eq!(
            accepts(&result, &w),
            accepts(&even, &w) != accepts(&a_star, &w),
            "{w:?}"
        );
    }
}

#[test]
fn the_product_has_one_state_for_each_reachable_pair_and_follows_the_method_in_order() {
    let (result, trace) = run(EVEN, A_STAR);
    // Both machines are complete DFSMs, so there is no stage before the product (stage 3).
    assert_eq!(stages(&trace), vec![(3, 2)]);
    let kinds = kinds(&trace);
    assert_eq!(kinds[0], "stage");
    // The first pair, then the start state, then pairs and transitions, then the accepting pairs.
    assert_eq!(&kinds[1..3], ["pair", "start"]);
    let last_transition = kinds.iter().rposition(|k| *k == "transition").unwrap();
    assert!(
        kinds[last_transition + 1..]
            .iter()
            .all(|k| *k == "accepting")
    );
    // Each state is a pair, and each has a transition on each symbol: states * symbols.
    let pairs = kinds.iter().filter(|k| **k == "pair").count();
    assert_eq!(pairs, result.states.len());
    let transitions = kinds.iter().filter(|k| **k == "transition").count();
    assert_eq!(transitions, pairs * 2);
    // The accepting steps are the accepting states, in order.
    let accepting = kinds.iter().filter(|k| **k == "accepting").count();
    assert_eq!(accepting, result.accepting.len());
}

#[test]
fn a_pair_that_no_string_reaches_is_not_built() {
    // From (0,0) of "even length" x "only a", b leads to the dead state of the second machine and
    // the pair (even, odd) is reached by 'ab'; but the machine has 4 pairs at most, not more.
    let (result, _) = run(EVEN, A_STAR);
    assert!(result.states.len() <= 4);
    // Every pair is reachable from the start: the states are numbered in the order of discovery.
    let mut reached = vec![result.start.unwrap()];
    let mut i = 0;
    while i < reached.len() {
        let from = reached[i];
        for t in result.transitions.iter().filter(|t| t.from == from) {
            if !reached.contains(&t.to) {
                reached.push(t.to);
            }
        }
        i += 1;
    }
    assert_eq!(reached.len(), result.states.len());
}

#[test]
fn a_pair_step_names_the_two_states_that_it_pairs() {
    let (_, trace) = run(EVEN, A_STAR);
    let first = trace
        .iter()
        .find_map(|s| match s.change {
            Change::Pair {
                state,
                first,
                second,
            } => Some((s.message.key, state, first, second)),
            _ => None,
        })
        .unwrap();
    // The start pair is made of the start states of the two machines.
    assert_eq!(
        first,
        ("product.new_state", StateId(0), StateId(0), StateId(0))
    );
    let keys: Vec<_> = trace.iter().map(|s| s.message.key).collect();
    assert!(keys.contains(&"product.start"));
    assert!(keys.contains(&"product.transition"));
    assert!(keys.iter().any(|k| k.starts_with("product.accepting")));
}

#[test]
fn an_accepting_step_says_which_side_accepts_in_its_key() {
    let (_, trace) = run(EVEN, A_STAR);
    let keys: Vec<_> = trace
        .iter()
        .filter(|s| matches!(s.change, Change::Accepting { .. }))
        .map(|s| s.message.key)
        .collect();
    assert!(!keys.is_empty());
    for key in keys {
        assert!(
            key == "product.accepting_first" || key == "product.accepting_second",
            "{key}"
        );
    }
    // 'a' ends in the pair (even: no, only a: yes), so the second machine is the one that accepts.
    assert!(
        trace
            .iter()
            .any(|s| s.message.key == "product.accepting_second")
    );
    assert!(
        trace
            .iter()
            .any(|s| s.message.key == "product.accepting_first")
    );
}

#[test]
fn machines_that_are_not_complete_dfsms_are_made_complete_first() {
    // An NDFSM with ε (first) and a DFSM with a missing transition (second).
    let (result, trace) = run(A_STAR_B_STAR, PARTIAL);
    assert_eq!(stages(&trace), vec![(1, 1), (2, 1), (3, 2)]);
    let first_inputs: Vec<_> = trace
        .iter()
        .filter_map(|s| match &s.change {
            Change::Stage { stage, inputs } if *stage == 3 => Some(inputs.clone()),
            _ => None,
        })
        .next()
        .unwrap();
    // The product starts from the two complete DFSMs that stages 1 and 2 made.
    let b = ConversionBudget::default();
    let dfsm = |m: &Fsm| match determinize(m, b).unwrap() {
        Conversion::Finished { dfsm, .. } => dfsm,
        Conversion::Stopped { .. } => panic!("stopped"),
    };
    assert_eq!(first_inputs[0], dfsm(&fsm(A_STAR_B_STAR)));
    assert_eq!(first_inputs[1], dfsm(&fsm(PARTIAL)));
    let (x, y) = (fsm(A_STAR_B_STAR), fsm(PARTIAL));
    for w in all_strings(2, 6) {
        assert_eq!(
            accepts(&result, &w),
            accepts(&x, &w) != accepts(&y, &w),
            "{w:?}"
        );
    }
}

#[test]
fn a_stage_that_has_nothing_to_do_is_skipped() {
    // The second machine is complete and the first is not: only stage 1 and the product.
    let (_, trace) = run(PARTIAL, EVEN);
    assert_eq!(stages(&trace), vec![(1, 1), (3, 2)]);
}

#[test]
fn a_language_xor_itself_is_empty_and_nothing_accepts() {
    let (result, _) = run(EVEN, EVEN);
    assert!(result.accepting.is_empty());
    // As the equivalence test of Rich's chapter 9 says: the machines are equivalent.
    let same = equivalent(&fsm(EVEN), &fsm(EVEN), EquivalenceBudget::default()).unwrap();
    assert!(matches!(same, Equivalence::Equivalent { .. }));
}

#[test]
fn a_language_xor_its_complement_is_everything() {
    let even = fsm(EVEN);
    let not_even = complement(&even).unwrap().fsm;
    let result = match xor(&even, &not_even, ConversionBudget::default()).unwrap() {
        Xor::Finished { fsm, .. } => fsm,
        Xor::Stopped { .. } => panic!("stopped"),
    };
    for w in all_strings(2, 6) {
        assert!(accepts(&result, &w), "{w:?}");
    }
}

#[test]
fn the_result_is_a_valid_complete_dfsm() {
    let (result, _) = run(A_STAR_B_STAR, A_STAR);
    assert_eq!(result.kind, FsmKind::Dfsm);
    assert!(
        validate(&result)
            .iter()
            .all(|i| i.severity != Severity::Error)
    );
}

#[test]
fn the_order_of_the_symbols_of_the_second_machine_does_not_matter() {
    let swapped = A_STAR.replace(r#""alphabet":["a","b"]"#, r#""alphabet":["b","a"]"#);
    let (one, _) = run(EVEN, A_STAR);
    let (two, _) = run(EVEN, &swapped);
    for w in all_strings(2, 6) {
        assert_eq!(accepts(&one, &w), accepts(&two, &w), "{w:?}");
    }
}

#[test]
fn a_budget_of_states_stops_it_with_the_trace_so_far() {
    let tiny = ConversionBudget {
        max_states: 1,
        ..ConversionBudget::default()
    };
    match xor(&fsm(EVEN), &fsm(A_STAR), tiny).unwrap() {
        Xor::Stopped {
            reason,
            partial_trace,
        } => {
            assert_eq!(reason, StopReason::MaxStates);
            assert!(
                partial_trace
                    .iter()
                    .any(|s| matches!(s.change, Change::Pair { .. }))
            );
        }
        Xor::Finished { .. } => panic!("the budget should stop it"),
    }
}

#[test]
fn a_budget_of_steps_stops_it_and_never_panics() {
    for max_steps in 0..14 {
        let budget = ConversionBudget {
            max_steps,
            ..ConversionBudget::default()
        };
        let result = xor(&fsm(A_STAR_B_STAR), &fsm(PARTIAL), budget).unwrap();
        if let Xor::Stopped { reason, .. } = result {
            assert_eq!(reason, StopReason::MaxSteps);
        }
    }
}

#[test]
fn xor_needs_start_states_and_the_same_symbols() {
    let no_start = EVEN.replace(r#""start":0"#, r#""start":null"#);
    let b = ConversionBudget::default();
    let m = xor(&fsm(&no_start), &fsm(EVEN), b).unwrap_err();
    assert_eq!(m.key, "xor.no_start_state");
    assert_eq!(m.params.get("side"), Some(&Param::Text("first".into())));
    let m = xor(&fsm(EVEN), &fsm(&no_start), b).unwrap_err();
    assert_eq!(m.params.get("side"), Some(&Param::Text("second".into())));
    let m = xor(&fsm(EVEN), &fsm(ENDS_10), b).unwrap_err();
    assert_eq!(m.key, "xor.alphabet_mismatch");
}

proptest! {
    #[test]
    fn xor_accepts_a_string_exactly_when_one_machine_accepts_it(
        (a, b) in arb_pair(),
        raw in prop::collection::vec(0usize..16, 0..8),
    ) {
        prop_assume!(a.start.is_some() && b.start.is_some());
        let result = xor(&a, &b, ConversionBudget::default()).unwrap();
        let Xor::Finished { fsm: x, .. } = result else { return Ok(()) };
        prop_assert_eq!(x.kind, FsmKind::Dfsm);
        prop_assert!(validate(&x).iter().all(|i| i.severity != Severity::Error));
        let w = word(&raw, a.alphabet.len());
        prop_assert_eq!(accepts(&x, &w), accepts(&a, &w) != accepts(&b, &w));
    }

    #[test]
    fn xor_has_no_accepting_state_exactly_when_the_machines_are_equivalent((a, b) in arb_pair()) {
        prop_assume!(a.start.is_some() && b.start.is_some());
        let Xor::Finished { fsm: x, .. } = xor(&a, &b, ConversionBudget::default()).unwrap()
        else { return Ok(()) };
        let same = matches!(
            equivalent(&a, &b, EquivalenceBudget::default()).unwrap(),
            Equivalence::Equivalent { .. }
        );
        prop_assert_eq!(x.accepting.is_empty(), same);
    }

    #[test]
    fn small_budgets_never_panic((a, b) in arb_pair(), states in 0usize..6, steps in 0usize..40) {
        prop_assume!(a.start.is_some() && b.start.is_some());
        let budget = ConversionBudget { max_states: states, max_steps: steps };
        let _ = xor(&a, &b, budget);
    }
}
