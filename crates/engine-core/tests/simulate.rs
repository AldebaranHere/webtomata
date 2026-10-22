use engine_core::{
    Alphabet, Budget, Fsm, Message, Param, Simulation, StopReason, SymbolId, simulate,
};
use proptest::prelude::*;
use std::collections::HashSet;

mod common;
use common::{A_STAR_B_STAR, ENDS_10, EVEN, PARTIAL, arb_fsm};

fn fsm(json: &str) -> Fsm {
    Fsm::from_json(json).unwrap()
}

fn run(machine: &str, text: &str) -> Simulation {
    let fsm = fsm(machine);
    let input = fsm.alphabet.tokenize(text).unwrap();
    simulate(&fsm, &input, Budget::default()).unwrap()
}

fn accepts(machine: &str, text: &str) -> bool {
    match run(machine, text) {
        Simulation::Finished { accepted, .. } => accepted,
        Simulation::Stopped { reason, .. } => panic!("stopped: {reason:?}"),
    }
}

/// (symbols read, symbol just read, active states) for each step.
fn shape(sim: &Simulation) -> Vec<(usize, Option<u16>, Vec<u32>)> {
    let trace = match sim {
        Simulation::Finished { trace, .. } => trace,
        Simulation::Stopped { partial_trace, .. } => partial_trace,
    };
    trace
        .iter()
        .map(|s| {
            (
                s.position,
                s.symbol.map(|x| x.0),
                s.states.iter().map(|x| x.0).collect(),
            )
        })
        .collect()
}

fn int(m: &Message, name: &str) -> i64 {
    match m.params.get(name) {
        Some(Param::Int(n)) => *n,
        other => panic!("param {name}: {other:?}"),
    }
}

fn text(m: &Message, name: &str) -> String {
    match m.params.get(name) {
        Some(Param::Text(t)) => t.clone(),
        other => panic!("param {name}: {other:?}"),
    }
}

// ---- textbook examples ----

#[test]
fn even_length_dfsm() {
    for w in ["", "ab", "abba", "aaaa"] {
        assert!(accepts(EVEN, w), "{w:?}");
    }
    for w in ["a", "aba", "bbb"] {
        assert!(!accepts(EVEN, w), "{w:?}");
    }
}

#[test]
fn even_length_trace_follows_the_single_state() {
    let sim = run(EVEN, "ab");
    assert_eq!(
        shape(&sim),
        vec![
            (0, None, vec![0]),
            (1, Some(0), vec![1]),
            (2, Some(1), vec![0])
        ]
    );
    let Simulation::Finished { trace, .. } = sim else {
        panic!()
    };
    assert_eq!(trace[0].message.key, "sim.start");
    assert_eq!(trace[1].message.key, "sim.read");
    assert_eq!(text(&trace[1].message, "symbol"), "a");
    assert_eq!(int(&trace[1].message, "position"), 1);
}

#[test]
fn ends_in_10_ndfsm_tracks_a_set_of_states() {
    for w in ["10", "110", "0110"] {
        assert!(accepts(ENDS_10, w), "{w:?}");
    }
    for w in ["", "1", "01", "101"] {
        assert!(!accepts(ENDS_10, w), "{w:?}");
    }
    assert_eq!(
        shape(&run(ENDS_10, "10")),
        vec![
            (0, None, vec![0]),
            (1, Some(1), vec![0, 1]),
            (2, Some(0), vec![0, 2])
        ]
    );
}

#[test]
fn epsilon_closure_is_applied_at_the_start_and_after_each_symbol() {
    for w in ["", "a", "aab", "abb", "bb"] {
        assert!(accepts(A_STAR_B_STAR, w), "{w:?}");
    }
    for w in ["ba", "aba"] {
        assert!(!accepts(A_STAR_B_STAR, w), "{w:?}");
    }
    let sim = run(A_STAR_B_STAR, "a");
    assert_eq!(
        shape(&sim),
        vec![(0, None, vec![0, 1]), (1, Some(0), vec![0, 1])]
    );
}

#[test]
fn an_empty_set_of_states_rejects_early() {
    let sim = run(PARTIAL, "abbb");
    assert_eq!(
        shape(&sim),
        vec![
            (0, None, vec![0]),
            (1, Some(0), vec![1]),
            (2, Some(1), vec![])
        ]
    );
    let Simulation::Finished { accepted, trace } = sim else {
        panic!()
    };
    assert!(!accepted);
    assert_eq!(trace[2].message.key, "sim.no_states");
}

// ---- errors ----

#[test]
fn a_machine_without_a_start_state_cannot_run() {
    let json = EVEN.replace(r#""start":0"#, r#""start":null"#);
    let m = simulate(&fsm(&json), &[], Budget::default()).unwrap_err();
    assert_eq!(m.key, "sim.no_start_state");
}

#[test]
fn a_symbol_outside_the_alphabet_is_an_error() {
    let m = simulate(&fsm(EVEN), &[SymbolId(0), SymbolId(9)], Budget::default()).unwrap_err();
    assert_eq!(m.key, "sim.unknown_symbol");
    assert_eq!(int(&m, "symbol"), 9);
}

// ---- budgets ----

fn budget(max_steps: usize, max_configurations: usize) -> Budget {
    Budget {
        max_steps,
        max_configurations,
    }
}

fn symbols(n: usize) -> Vec<SymbolId> {
    vec![SymbolId(0); n]
}

#[test]
fn too_many_steps_stops_with_the_trace_so_far() {
    let sim = simulate(&fsm(EVEN), &symbols(10), budget(5, usize::MAX)).unwrap();
    let Simulation::Stopped {
        reason,
        partial_trace,
    } = sim
    else {
        panic!("{sim:?}")
    };
    assert_eq!(reason, StopReason::MaxSteps);
    assert_eq!(partial_trace.len(), 6); // the start plus 5 symbols
}

#[test]
fn an_input_exactly_as_long_as_max_steps_finishes() {
    let sim = simulate(&fsm(EVEN), &symbols(5), budget(5, usize::MAX)).unwrap();
    assert!(matches!(
        sim,
        Simulation::Finished {
            accepted: false,
            ..
        }
    ));
}

#[test]
fn too_many_configurations_stops_before_the_step_that_overflows() {
    let sim = simulate(&fsm(EVEN), &symbols(5), budget(usize::MAX, 2)).unwrap();
    let Simulation::Stopped {
        reason,
        partial_trace,
    } = sim
    else {
        panic!("{sim:?}")
    };
    assert_eq!(reason, StopReason::MaxConfigurations);
    assert_eq!(partial_trace.len(), 2);
}

#[test]
fn a_zero_configuration_budget_stops_at_once() {
    let sim = simulate(&fsm(EVEN), &[], budget(usize::MAX, 0)).unwrap();
    let Simulation::Stopped {
        reason,
        partial_trace,
    } = sim
    else {
        panic!("{sim:?}")
    };
    assert_eq!(reason, StopReason::MaxConfigurations);
    assert!(partial_trace.is_empty());
}

#[test]
fn rejecting_early_finishes_even_with_a_small_step_budget() {
    let sim = simulate(
        &fsm(PARTIAL),
        &[SymbolId(1), SymbolId(0), SymbolId(0)],
        budget(1, 100),
    )
    .unwrap();
    assert!(matches!(
        sim,
        Simulation::Finished {
            accepted: false,
            ..
        }
    ));
}

// ---- tokenize ----

#[test]
fn single_character_alphabets_read_one_character_at_a_time() {
    let ab = Alphabet::new(vec!["a".into(), "b".into()]).unwrap();
    assert_eq!(
        ab.tokenize("abba").unwrap(),
        vec![SymbolId(0), SymbolId(1), SymbolId(1), SymbolId(0)]
    );
    assert_eq!(ab.tokenize("").unwrap(), vec![]);
    let m = ab.tokenize("ac").unwrap_err();
    assert_eq!(m.key, "input.unknown_symbol");
    assert_eq!(text(&m, "symbol"), "c");
    assert_eq!(int(&m, "position"), 1);
    assert_eq!(ab.tokenize("a b").unwrap_err().key, "input.unknown_symbol");
}

#[test]
fn other_alphabets_read_symbols_separated_by_spaces() {
    for names in [vec!["num", "plus"], vec!["a", "num"]] {
        let alphabet = Alphabet::new(names.iter().map(|s| s.to_string()).collect()).unwrap();
        let first = alphabet.id(names[0]).unwrap();
        let second = alphabet.id(names[1]).unwrap();
        let input = format!("{} {}  {}", names[0], names[1], names[0]);
        assert_eq!(
            alphabet.tokenize(&input).unwrap(),
            vec![first, second, first]
        );
        assert_eq!(alphabet.tokenize("").unwrap(), vec![]);
    }
    let alphabet = Alphabet::new(vec!["num".into(), "plus".into()]).unwrap();
    let m = alphabet.tokenize("num numplus").unwrap_err();
    assert_eq!(text(&m, "symbol"), "numplus");
    assert_eq!(int(&m, "position"), 1);
}

#[test]
fn an_empty_alphabet_only_accepts_the_empty_text() {
    let none = Alphabet::new(vec![]).unwrap();
    assert_eq!(none.tokenize("").unwrap(), vec![]);
    assert!(none.tokenize("a").is_err());
}

// ---- properties ----

/// Path search over (state, position) pairs, written independently of the engine.
fn reference_accepts(fsm: &Fsm, input: &[SymbolId]) -> bool {
    let mut seen = HashSet::new();
    let mut stack = vec![(fsm.start.unwrap(), 0usize)];
    while let Some((q, i)) = stack.pop() {
        if !seen.insert((q, i)) {
            continue;
        }
        if i == input.len() && fsm.accepting.contains(&q) {
            return true;
        }
        for t in fsm.transitions.iter().filter(|t| t.from == q) {
            match t.on {
                None => stack.push((t.to, i)),
                Some(s) if i < input.len() && s == input[i] => stack.push((t.to, i + 1)),
                Some(_) => {}
            }
        }
    }
    false
}

fn input_for(fsm: &Fsm, raw: &[usize]) -> Vec<SymbolId> {
    let k = fsm.alphabet.len();
    if k == 0 {
        return vec![];
    }
    raw.iter().map(|&i| SymbolId((i % k) as u16)).collect()
}

proptest! {
    #[test]
    fn set_simulation_agrees_with_path_search(
        fsm in arb_fsm(),
        raw in prop::collection::vec(0usize..16, 0..9),
    ) {
        prop_assume!(fsm.start.is_some());
        let input = input_for(&fsm, &raw);
        match simulate(&fsm, &input, Budget::default()).unwrap() {
            Simulation::Finished { accepted, .. } => {
                prop_assert_eq!(accepted, reference_accepts(&fsm, &input));
            }
            Simulation::Stopped { reason, .. } => prop_assert!(false, "stopped: {:?}", reason),
        }
    }

    #[test]
    fn small_budgets_never_panic_and_are_respected(
        fsm in arb_fsm(),
        raw in prop::collection::vec(0usize..16, 0..12),
        steps in 0usize..8,
        configs in 0usize..20,
    ) {
        prop_assume!(fsm.start.is_some());
        let input = input_for(&fsm, &raw);
        let first = simulate(&fsm, &input, budget(steps, configs)).unwrap();
        prop_assert_eq!(&first, &simulate(&fsm, &input, budget(steps, configs)).unwrap());
        let trace = match &first {
            Simulation::Finished { trace, .. } => trace,
            Simulation::Stopped { partial_trace, .. } => partial_trace,
        };
        prop_assert!(trace.len() <= steps + 1);
        prop_assert!(trace.iter().map(|s| s.states.len()).sum::<usize>() <= configs);
        prop_assert!(trace.iter().all(|s| s.states.windows(2).all(|w| w[0] < w[1])));
    }
}
