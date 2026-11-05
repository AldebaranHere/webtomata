use engine_core::{
    Alphabet, Param, Pda, PdaBudget, PdaKind, PdaSimulation, PdaStep, PdaTransition, StateId,
    StopReason, SymbolId, simulate_pda,
};
use proptest::prelude::*;

fn m1_json() -> &'static str {
    r#"{"schemaVersion":1,"kind":"dpda","inputAlphabet":["a","b"],"stackAlphabet":["a"],"states":[0,1],"start":0,"accepting":[0,1],"transitions":[{"from":0,"read":"a","pop":[],"push":["a"],"to":0},{"from":0,"read":"b","pop":["a"],"push":[],"to":1},{"from":1,"read":"b","pop":["a"],"push":[],"to":1}]}"#
}

fn m2_json() -> &'static str {
    r#"{"schemaVersion":1,"kind":"ndpda","inputAlphabet":["a","b"],"stackAlphabet":["a","b"],"states":[0,1],"start":0,"accepting":[1],"transitions":[{"from":0,"read":null,"pop":[],"push":[],"to":1},{"from":0,"read":"a","pop":[],"push":["a"],"to":0},{"from":0,"read":"b","pop":[],"push":["b"],"to":0},{"from":1,"read":"a","pop":["a"],"push":[],"to":1},{"from":1,"read":"b","pop":["b"],"push":[],"to":1}]}"#
}

fn no_change_loop_json() -> &'static str {
    r#"{"schemaVersion":1,"kind":"ndpda","inputAlphabet":["a"],"stackAlphabet":["a"],"states":[0],"start":0,"accepting":[],"transitions":[{"from":0,"read":null,"pop":[],"push":[],"to":0}]}"#
}

fn stack_growing_loop_json() -> &'static str {
    r#"{"schemaVersion":1,"kind":"ndpda","inputAlphabet":["a"],"stackAlphabet":["x"],"states":[0],"start":0,"accepting":[],"transitions":[{"from":0,"read":null,"pop":[],"push":["x"],"to":0}]}"#
}

fn syms(pda: &Pda, s: &str) -> Vec<SymbolId> {
    pda.input.tokenize(s).unwrap()
}

// -------------------------------------------------------------------------
// AC1: M1 (anbn) hand derivations
// -------------------------------------------------------------------------

#[test]
fn test_m1_empty() {
    let pda = Pda::from_json(m1_json()).unwrap();
    let res = simulate_pda(&pda, &[], PdaBudget::default()).unwrap();
    match res {
        PdaSimulation::Finished {
            accepted,
            trace,
            peak_configurations,
            ..
        } => {
            assert!(accepted);
            assert_eq!(peak_configurations, 1);
            assert_eq!(trace.len(), 1);
            assert_eq!(trace[0].state.0, 0);
            assert_eq!(trace[0].stack.len(), 0);
            assert_eq!(trace[0].message.key, "pda.sim.accepted");
        }
        _ => panic!("Expected Finished, got {:?}", res),
    }
}

#[test]
fn test_m1_ab() {
    let pda = Pda::from_json(m1_json()).unwrap();
    let input = syms(&pda, "ab");
    let res = simulate_pda(&pda, &input, PdaBudget::default()).unwrap();
    match res {
        PdaSimulation::Finished {
            accepted,
            trace,
            peak_configurations,
            ..
        } => {
            assert!(accepted);
            assert_eq!(peak_configurations, 1);
            assert_eq!(trace.len(), 3);
            assert_eq!(trace[0].message.key, "pda.sim.start");
            assert_eq!(trace[1].message.key, "pda.sim.move");
            assert_eq!(trace[2].message.key, "pda.sim.accepted");
            assert_eq!(trace[2].state.0, 1);
            assert_eq!(trace[2].stack.len(), 0);
        }
        _ => panic!("Expected Finished, got {:?}", res),
    }
}

#[test]
fn test_m1_aabb() {
    let pda = Pda::from_json(m1_json()).unwrap();
    let input = syms(&pda, "aabb");
    let res = simulate_pda(&pda, &input, PdaBudget::default()).unwrap();
    match res {
        PdaSimulation::Finished {
            accepted,
            trace,
            peak_configurations,
            ..
        } => {
            assert!(accepted);
            assert_eq!(peak_configurations, 1);
            assert_eq!(trace.len(), 5);
            assert_eq!(trace[4].message.key, "pda.sim.accepted");
        }
        _ => panic!("Expected Finished, got {:?}", res),
    }
}

#[test]
fn test_m1_a() {
    let pda = Pda::from_json(m1_json()).unwrap();
    let input = syms(&pda, "a");
    let res = simulate_pda(&pda, &input, PdaBudget::default()).unwrap();
    match res {
        PdaSimulation::Finished {
            accepted,
            trace,
            peak_configurations,
            ..
        } => {
            assert!(!accepted);
            assert_eq!(peak_configurations, 1);
            assert_eq!(trace.len(), 2);
            let last = trace.last().unwrap();
            assert_eq!(last.message.key, "pda.sim.stack_not_empty");
            assert_eq!(
                last.message.params.get("depth").unwrap(),
                &Param::from(1usize)
            );
            assert_eq!(last.state.0, 0);
            assert_eq!(last.stack.len(), 1);
        }
        _ => panic!("Expected Finished, got {:?}", res),
    }
}

#[test]
fn test_m1_aab() {
    let pda = Pda::from_json(m1_json()).unwrap();
    let input = syms(&pda, "aab");
    let res = simulate_pda(&pda, &input, PdaBudget::default()).unwrap();
    match res {
        PdaSimulation::Finished {
            accepted,
            trace,
            peak_configurations,
            ..
        } => {
            assert!(!accepted);
            assert_eq!(peak_configurations, 1);
            let last = trace.last().unwrap();
            assert_eq!(last.message.key, "pda.sim.stack_not_empty");
            assert_eq!(
                last.message.params.get("depth").unwrap(),
                &Param::from(1usize)
            );
            assert_eq!(last.state.0, 1);
            assert_eq!(last.stack.len(), 1);
        }
        _ => panic!("Expected Finished, got {:?}", res),
    }
}

#[test]
fn test_m1_b() {
    let pda = Pda::from_json(m1_json()).unwrap();
    let input = syms(&pda, "b");
    let res = simulate_pda(&pda, &input, PdaBudget::default()).unwrap();
    match res {
        PdaSimulation::Finished {
            accepted,
            trace,
            peak_configurations,
            ..
        } => {
            assert!(!accepted);
            assert_eq!(peak_configurations, 1);
            assert_eq!(trace.len(), 1);
            let last = trace.last().unwrap();
            assert_eq!(last.message.key, "pda.sim.input_left");
            assert_eq!(
                last.message.params.get("left").unwrap(),
                &Param::from(1usize)
            );
        }
        _ => panic!("Expected Finished, got {:?}", res),
    }
}

#[test]
fn test_m1_abb() {
    let pda = Pda::from_json(m1_json()).unwrap();
    let input = syms(&pda, "abb");
    let res = simulate_pda(&pda, &input, PdaBudget::default()).unwrap();
    match res {
        PdaSimulation::Finished {
            accepted,
            trace,
            peak_configurations,
            ..
        } => {
            assert!(!accepted);
            assert_eq!(peak_configurations, 1);
            assert_eq!(trace.len(), 3);
            let last = trace.last().unwrap();
            assert_eq!(last.state.0, 1);
            assert_eq!(last.stack.len(), 0);
            assert_eq!(last.message.key, "pda.sim.input_left");
            assert_eq!(
                last.message.params.get("left").unwrap(),
                &Param::from(1usize)
            );
        }
        _ => panic!("Expected Finished, got {:?}", res),
    }
}

// -------------------------------------------------------------------------
// AC1: M2 (wwR) hand derivations
// -------------------------------------------------------------------------

#[test]
fn test_m2_aa() {
    let pda = Pda::from_json(m2_json()).unwrap();
    let input = syms(&pda, "aa");
    let res = simulate_pda(&pda, &input, PdaBudget::default()).unwrap();
    match res {
        PdaSimulation::Finished {
            accepted,
            trace,
            peak_configurations,
            ..
        } => {
            assert!(accepted);
            assert_eq!(peak_configurations, 2);
            assert_eq!(trace.len(), 4);
            // Steps: (0,0,[]), (0,1,[a]), (1,1,[a]), (1,2,[])
            assert_eq!(trace[0].state.0, 0);
            assert_eq!(trace[0].position, 0);
            assert_eq!(trace[0].stack.len(), 0);

            assert_eq!(trace[1].state.0, 0);
            assert_eq!(trace[1].position, 1);
            assert_eq!(trace[1].transition, Some(1)); // a-push

            assert_eq!(trace[2].state.0, 1);
            assert_eq!(trace[2].position, 1);
            assert_eq!(trace[2].transition, Some(0)); // eps

            assert_eq!(trace[3].state.0, 1);
            assert_eq!(trace[3].position, 2);
            assert_eq!(trace[3].transition, Some(3)); // a-pop
            assert_eq!(trace[3].stack.len(), 0);
            assert_eq!(trace[3].message.key, "pda.sim.accepted");
        }
        _ => panic!("Expected Finished, got {:?}", res),
    }
}

#[test]
fn test_m2_ab() {
    let pda = Pda::from_json(m2_json()).unwrap();
    let input = syms(&pda, "ab");
    let res = simulate_pda(&pda, &input, PdaBudget::default()).unwrap();
    match res {
        PdaSimulation::Finished {
            accepted,
            trace,
            peak_configurations,
            ..
        } => {
            assert!(!accepted);
            assert_eq!(peak_configurations, 2);
            let last = trace.last().unwrap();
            assert_eq!(last.state.0, 1);
            assert_eq!(last.position, 2);
            assert_eq!(last.stack.len(), 2);
            assert_eq!(last.message.key, "pda.sim.stack_not_empty");
            assert_eq!(
                last.message.params.get("depth").unwrap(),
                &Param::from(2usize)
            );
        }
        _ => panic!("Expected Finished, got {:?}", res),
    }
}

// -------------------------------------------------------------------------
// AC1: Loop machines
// -------------------------------------------------------------------------

#[test]
fn test_no_change_loop() {
    let pda = Pda::from_json(no_change_loop_json()).unwrap();
    let res = simulate_pda(&pda, &[], PdaBudget::default()).unwrap();
    match res {
        PdaSimulation::Finished {
            accepted,
            trace,
            peak_configurations,
            ..
        } => {
            assert!(!accepted);
            assert_eq!(peak_configurations, 1);
            assert_eq!(trace.len(), 1);
            assert_eq!(trace[0].message.key, "pda.sim.not_accepting_state");
        }
        _ => panic!("Expected Finished, got {:?}", res),
    }
}

#[test]
fn test_stack_growing_loop_max_stack() {
    let pda = Pda::from_json(stack_growing_loop_json()).unwrap();
    let budget = PdaBudget {
        max_steps: 1000,
        max_configurations: 1000,
        max_stack: 5,
    };
    let res = simulate_pda(&pda, &[], budget).unwrap();
    match res {
        PdaSimulation::Stopped {
            reason,
            partial_trace,
            ..
        } => {
            assert_eq!(reason, StopReason::MaxStack);
            assert!(!partial_trace.is_empty());
        }
        _ => panic!("Expected Stopped(MaxStack), got {:?}", res),
    }
}

#[test]
fn test_stack_growing_loop_max_steps() {
    let pda = Pda::from_json(stack_growing_loop_json()).unwrap();
    let budget = PdaBudget {
        max_steps: 3,
        max_configurations: 1000,
        max_stack: 500,
    };
    let res = simulate_pda(&pda, &[], budget).unwrap();
    match res {
        PdaSimulation::Stopped {
            reason,
            partial_trace,
            ..
        } => {
            assert_eq!(reason, StopReason::MaxSteps);
            assert!(!partial_trace.is_empty());
        }
        _ => panic!("Expected Stopped(MaxSteps), got {:?}", res),
    }
}

#[test]
fn test_stack_growing_loop_max_configurations() {
    let pda = Pda::from_json(stack_growing_loop_json()).unwrap();
    let budget = PdaBudget {
        max_steps: 1000,
        max_configurations: 3,
        max_stack: 500,
    };
    let res = simulate_pda(&pda, &[], budget).unwrap();
    match res {
        PdaSimulation::Stopped {
            reason,
            partial_trace,
            ..
        } => {
            assert_eq!(reason, StopReason::MaxConfigurations);
            assert!(!partial_trace.is_empty());
        }
        _ => panic!("Expected Stopped(MaxConfigurations), got {:?}", res),
    }
}

// -------------------------------------------------------------------------
// AC2: Proptests with independent reference & trace legality validation
// -------------------------------------------------------------------------

fn is_an_bn(w: &str) -> bool {
    let bytes = w.as_bytes();
    let n = bytes.len();
    if !n.is_multiple_of(2) {
        return false;
    }
    let k = n / 2;
    bytes[..k].iter().all(|&b| b == b'a') && bytes[k..].iter().all(|&b| b == b'b')
}

fn is_even_palindrome(w: &str) -> bool {
    let bytes = w.as_bytes();
    let n = bytes.len();
    if !n.is_multiple_of(2) {
        return false;
    }
    bytes == bytes.iter().rev().copied().collect::<Vec<_>>().as_slice()
}

fn validate_trace_legality(pda: &Pda, input: &[SymbolId], trace: &[PdaStep], accepted: bool) {
    assert!(!trace.is_empty(), "Trace must not be empty");
    // First step is start
    let start_state = pda.start.unwrap();
    assert_eq!(trace[0].state, start_state);
    assert_eq!(trace[0].position, 0);
    assert_eq!(trace[0].stack, Vec::<SymbolId>::new());
    assert_eq!(trace[0].transition, None);
    assert_eq!(trace[0].symbol, None);

    // Each step transition is legal
    for w in trace.windows(2) {
        let prev = &w[0];
        let curr = &w[1];
        let t_idx = curr
            .transition
            .expect("Non-start step must have transition index");
        let t = &pda.transitions[t_idx];
        assert_eq!(t.from, prev.state);
        assert_eq!(t.to, curr.state);
        if let Some(r) = t.read {
            assert_eq!(curr.symbol, Some(r));
            assert_eq!(curr.position, prev.position + 1);
            assert_eq!(input[prev.position], r);
        } else {
            assert_eq!(curr.symbol, None);
            assert_eq!(curr.position, prev.position);
        }
        // Stack pop check: t.pop is prefix of prev.stack
        assert!(prev.stack.starts_with(&t.pop));
        // curr.stack is t.push ++ prev.stack[t.pop.len()..]
        let mut expected_stack = t.push.clone();
        expected_stack.extend_from_slice(&prev.stack[t.pop.len()..]);
        assert_eq!(curr.stack, expected_stack);
    }

    if accepted {
        let last = trace.last().unwrap();
        assert!(pda.accepting.binary_search(&last.state).is_ok());
        assert_eq!(last.position, input.len());
        assert!(last.stack.is_empty());
        assert_eq!(last.message.key, "pda.sim.accepted");
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(50))]

    #[test]
    fn proptest_m1_oracle(w in "[ab]{0,10}") {
        let pda = Pda::from_json(m1_json()).unwrap();
        let input = syms(&pda, &w);
        let res = simulate_pda(&pda, &input, PdaBudget::default()).unwrap();
        match res {
            PdaSimulation::Finished { accepted, trace, .. } => {
                let expected = is_an_bn(&w);
                prop_assert_eq!(accepted, expected, "Mismatch for input {:?}", w);
                validate_trace_legality(&pda, &input, &trace, accepted);
            }
            _ => prop_assert!(false, "Did not finish on input {:?}", w),
        }
    }

    #[test]
    fn proptest_m2_oracle(w in "[ab]{0,10}") {
        let pda = Pda::from_json(m2_json()).unwrap();
        let input = syms(&pda, &w);
        let res = simulate_pda(&pda, &input, PdaBudget::default()).unwrap();
        match res {
            PdaSimulation::Finished { accepted, trace, .. } => {
                let expected = is_even_palindrome(&w);
                prop_assert_eq!(accepted, expected, "Mismatch for input {:?}", w);
                validate_trace_legality(&pda, &input, &trace, accepted);
            }
            _ => prop_assert!(false, "Did not finish on input {:?}", w),
        }
    }
}

// -------------------------------------------------------------------------
// AC4 & Worst Case Memory Measurement
// -------------------------------------------------------------------------

#[test]
fn test_peak_after_dropping_repeats() {
    // Machine where 3 states produce the same 2 configurations:
    // Start 0:
    // (0, a, [] -> [x], 1)
    // (0, a, [] -> [x], 2)
    // (0, a, [] -> [x], 3)
    // (1, b, [x] -> [], 4)
    // (2, b, [x] -> [], 4)
    // (3, b, [x] -> [], 4)
    // (1, b, [x] -> [y], 5)
    // (2, b, [x] -> [y], 5)
    // (3, b, [x] -> [y], 5)
    let json = r#"{"schemaVersion":1,"kind":"ndpda","inputAlphabet":["a","b"],"stackAlphabet":["x","y"],"states":[0,1,2,3,4,5],"start":0,"accepting":[4],"transitions":[
        {"from":0,"read":"a","pop":[],"push":["x"],"to":1},
        {"from":0,"read":"a","pop":[],"push":["x"],"to":2},
        {"from":0,"read":"a","pop":[],"push":["x"],"to":3},
        {"from":1,"read":"b","pop":["x"],"push":[],"to":4},
        {"from":2,"read":"b","pop":["x"],"push":[],"to":4},
        {"from":3,"read":"b","pop":["x"],"push":[],"to":4},
        {"from":1,"read":"b","pop":["x"],"push":["y"],"to":5},
        {"from":2,"read":"b","pop":["x"],"push":["y"],"to":5},
        {"from":3,"read":"b","pop":["x"],"push":["y"],"to":5}
    ]}"#;
    let pda = Pda::from_json(json).unwrap();
    let input = syms(&pda, "ab");
    let res = simulate_pda(&pda, &input, PdaBudget::default()).unwrap();
    match res {
        PdaSimulation::Finished {
            accepted,
            peak_configurations,
            ..
        } => {
            assert!(accepted);
            // Level 0: 1 config
            // Level 1: 3 configs
            // Level 2: 2 unique configs (4 and 5). If repeats were not dropped before peak, it would be 6!
            assert_eq!(peak_configurations, 3);
        }
        _ => panic!("Expected Finished, got {:?}", res),
    }
}

fn get_vm_rss_bytes() -> usize {
    if let Ok(status) = std::fs::read_to_string("/proc/self/status") {
        for line in status.lines() {
            if line.starts_with("VmRSS:") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2
                    && let Ok(kb) = parts[1].parse::<usize>()
                {
                    return kb * 1024;
                }
            }
        }
    }
    0
}

#[test]
fn test_worst_case_budget_memory() {
    // Chain 485 states pushing 'x', then state 485 branches pushing 'x' and 'y'
    // Total stack length stays <= 500, so it hits max_configurations = 20,000 first.
    let mut transitions = Vec::new();
    let n_chain = 485;
    for i in 0..n_chain {
        transitions.push(format!(
            r#"{{"from":{},"read":null,"pop":[],"push":["x"],"to":{}}}"#,
            i,
            i + 1
        ));
    }
    transitions.push(format!(
        r#"{{"from":{},"read":null,"pop":[],"push":["x"],"to":{}}}"#,
        n_chain, n_chain
    ));
    transitions.push(format!(
        r#"{{"from":{},"read":null,"pop":[],"push":["y"],"to":{}}}"#,
        n_chain, n_chain
    ));

    let states_json = (0..=n_chain)
        .map(|i| i.to_string())
        .collect::<Vec<_>>()
        .join(",");
    let json = format!(
        r#"{{"schemaVersion":1,"kind":"ndpda","inputAlphabet":["a"],"stackAlphabet":["x","y"],"states":[{}],"start":0,"accepting":[],"transitions":[{}]}}"#,
        states_json,
        transitions.join(",")
    );

    let pda = Pda::from_json(&json).unwrap();
    let before_rss = get_vm_rss_bytes();
    let res = simulate_pda(&pda, &[], PdaBudget::default()).unwrap();
    let after_rss = get_vm_rss_bytes();
    let diff_mb = if after_rss > before_rss {
        (after_rss - before_rss) as f64 / (1024.0 * 1024.0)
    } else {
        0.0
    };

    match res {
        PdaSimulation::Stopped {
            reason,
            explored,
            peak_configurations,
            partial_trace,
        } => {
            assert_eq!(reason, StopReason::MaxConfigurations);
            assert_eq!(explored, 20_000);
            assert!(!partial_trace.is_empty());
            println!(
                "WORST CASE METRICS: explored={}, peak={}, RSS diff={:.2} MB, after_rss={:.2} MB",
                explored,
                peak_configurations,
                diff_mb,
                after_rss as f64 / (1024.0 * 1024.0)
            );
            // Must be well below 50 MB
            assert!(diff_mb < 50.0, "RSS diff {:.2} MB exceeds 50 MB", diff_mb);
        }
        _ => panic!("Expected Stopped(MaxConfigurations), got {:?}", res),
    }
}

#[test]
fn test_simulation_determinism_fixed() {
    let pda = Pda::from_json(m2_json()).unwrap();
    let input = syms(&pda, "aa");
    let res1 = simulate_pda(&pda, &input, PdaBudget::default()).unwrap();
    let res2 = simulate_pda(&pda, &input, PdaBudget::default()).unwrap();
    match (res1, res2) {
        (
            PdaSimulation::Finished {
                accepted: a1,
                trace: t1,
                peak_configurations: p1,
                explored: e1,
            },
            PdaSimulation::Finished {
                accepted: a2,
                trace: t2,
                peak_configurations: p2,
                explored: e2,
            },
        ) => {
            assert_eq!(a1, a2);
            assert_eq!(p1, p2);
            assert_eq!(e1, e2);
            assert_eq!(t1, t2);
            // Fixed expectation
            assert_eq!(t1.len(), 4);
            assert_eq!(t1[1].transition, Some(1));
            assert_eq!(t1[2].transition, Some(0));
            assert_eq!(t1[3].transition, Some(3));
        }
        _ => panic!("Both runs must be Finished"),
    }
}

#[test]
fn test_level_order_determinism() {
    let json = r#"{"schemaVersion":1,"kind":"ndpda","inputAlphabet":["a"],"stackAlphabet":["a"],"states":[0,1,2],"start":0,"accepting":[1,2],"transitions":[
        {"from":0,"read":"a","pop":[],"push":[],"to":1},
        {"from":0,"read":"a","pop":[],"push":[],"to":2}
    ]}"#;
    let pda = Pda::from_json(json).unwrap();
    let input = syms(&pda, "a");
    let res = simulate_pda(&pda, &input, PdaBudget::default()).unwrap();
    match res {
        PdaSimulation::Finished {
            accepted, trace, ..
        } => {
            assert!(accepted);
            // Must deterministically pick transition 0 (to state 1), never transition 1 (to state 2)
            assert_eq!(trace.len(), 2);
            assert_eq!(trace[1].state.0, 1);
            assert_eq!(trace[1].transition, Some(0));
        }
        _ => panic!("Expected Finished"),
    }
}

#[test]
fn test_unrelated_transitions_performance() {
    let alphabet = Alphabet::new(vec!["a".to_string(), "b".to_string()]).unwrap();
    let states: Vec<StateId> = (0..=1000).map(StateId).collect();
    let mut transitions = vec![
        PdaTransition {
            from: StateId(0),
            read: None,
            pop: vec![],
            push: vec![SymbolId(0)],
            to: StateId(0),
        },
        PdaTransition {
            from: StateId(0),
            read: None,
            pop: vec![],
            push: vec![SymbolId(1)],
            to: StateId(0),
        },
    ];
    for s in 1..=1000 {
        for _ in 0..50 {
            transitions.push(PdaTransition {
                from: StateId(s),
                read: None,
                pop: vec![],
                push: vec![],
                to: StateId(s),
            });
        }
    }
    assert_eq!(transitions.len(), 50_002);
    let pda = Pda::new(
        PdaKind::Ndpda,
        alphabet.clone(),
        alphabet,
        states,
        Some(StateId(0)),
        vec![],
        transitions,
    )
    .unwrap();

    let start = std::time::Instant::now();
    let res = simulate_pda(&pda, &[], PdaBudget::default()).unwrap();
    let elapsed = start.elapsed();
    eprintln!(
        "test_unrelated_transitions_performance AFTER elapsed: {:?}",
        elapsed
    );
    match res {
        PdaSimulation::Stopped {
            reason, explored, ..
        } => {
            assert_eq!(reason, StopReason::MaxConfigurations);
            assert_eq!(explored, 20_000);
        }
        _ => panic!("Expected Stopped(MaxConfigurations)"),
    }
}

#[test]
fn test_message_priority_not_accepting_over_stack_not_empty() {
    // M1 with accepting: [] (no accepting states) on input "a".
    // State 0 consumes "a", pushes "a", and halts at position 1.
    // The final configuration has consumed all input, is in a non-accepting state,
    // and has a non-empty stack.
    // Priority rule: not_accepting_state takes precedence over stack_not_empty.
    let json = r#"{"schemaVersion":1,"kind":"dpda","inputAlphabet":["a","b"],"stackAlphabet":["a"],"states":[0,1],"start":0,"accepting":[],"transitions":[{"from":0,"read":"a","pop":[],"push":["a"],"to":0},{"from":0,"read":"b","pop":["a"],"push":[],"to":1},{"from":1,"read":"b","pop":["a"],"push":[],"to":1}]}"#;
    let pda = Pda::from_json(json).unwrap();
    let input = syms(&pda, "a");
    let res = simulate_pda(&pda, &input, PdaBudget::default()).unwrap();
    match res {
        PdaSimulation::Finished {
            accepted, trace, ..
        } => {
            assert!(!accepted);
            assert_eq!(trace.len(), 2);
            assert_eq!(trace[1].message.key, "pda.sim.not_accepting_state");
        }
        _ => panic!("Expected Finished(rejected)"),
    }
}

#[test]
fn test_max_steps_boundary_m2_aa() {
    let pda = Pda::from_json(m2_json()).unwrap();
    let input = syms(&pda, "aa");

    // Hand derivation:
    // Level 0: C0 = (0, 0, []) -> explored = 1
    // Level 1: C1 = (1, 0, []), C2 = (0, 1, ["a"]) -> explored = 3
    // Level 2: C3 = (1, 1, ["a"]), C4 = (0, 2, ["a", "a"]) -> explored = 5
    // Level 3: C5 = (1, 2, []) [ACCEPTED], C6 = (1, 2, ["a", "a"]) -> explored = 7
    //
    // With max_steps: 3:
    // Levels 0, 1, 2 are expanded (level_num = 0, 1, 2).
    // Level 3 is reached and C5 is accepted!
    let budget_3 = PdaBudget {
        max_steps: 3,
        max_configurations: 20_000,
        max_stack: 500,
    };
    let res_3 = simulate_pda(&pda, &input, budget_3).unwrap();
    match res_3 {
        PdaSimulation::Finished {
            accepted,
            explored,
            trace,
            ..
        } => {
            assert!(accepted);
            assert_eq!(explored, 7);
            assert_eq!(trace.len(), 4); // C0 -> C2 -> C3 -> C5
        }
        _ => panic!("Expected Finished with max_steps: 3"),
    }

    // With max_steps: 2:
    // Levels 0, 1 are expanded (level_num = 0, 1).
    // When level_num reaches 2, level_num >= budget.max_steps (2 >= 2) triggers.
    // Simulation stops before level 2 is expanded.
    // Exactly 5 configurations have been explored (C0, C1, C2, C3, C4).
    let budget_2 = PdaBudget {
        max_steps: 2,
        max_configurations: 20_000,
        max_stack: 500,
    };
    let res_2 = simulate_pda(&pda, &input, budget_2).unwrap();
    match res_2 {
        PdaSimulation::Stopped {
            reason,
            explored,
            partial_trace,
            ..
        } => {
            assert_eq!(reason, StopReason::MaxSteps);
            assert_eq!(explored, 5);
            assert!(!partial_trace.is_empty());
        }
        _ => panic!("Expected Stopped(MaxSteps) with max_steps: 2"),
    }
}

#[test]
fn test_max_stack_boundary_exact_depth() {
    let pda = Pda::from_json(stack_growing_loop_json()).unwrap();
    let budget = PdaBudget {
        max_steps: 10_000,
        max_configurations: 20_000,
        max_stack: 5,
    };
    let res = simulate_pda(&pda, &[], budget).unwrap();
    match res {
        PdaSimulation::Stopped {
            reason,
            partial_trace,
            ..
        } => {
            assert_eq!(reason, StopReason::MaxStack);
            let deepest = partial_trace
                .iter()
                .map(|step| step.stack.len())
                .max()
                .unwrap_or(0);
            assert_eq!(deepest, 5);
        }
        _ => panic!("Expected Stopped(MaxStack)"),
    }
}
