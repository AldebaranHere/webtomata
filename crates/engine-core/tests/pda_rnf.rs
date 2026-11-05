use engine_core::api::pda_to_rnf as api_pda_to_rnf;
use engine_core::cfg_pda::StateName;
use engine_core::pda::{Pda, PdaKind, validate_pda};
use engine_core::pda_rnf::{RnfResult, pda_to_rnf};
use engine_core::pda_simulate::{PdaBudget, simulate_pda};
use engine_core::{Alphabet, Param, StateId, SymbolId};
use proptest::prelude::*;

const F1_JSON: &str = r#"{"schemaVersion":1,"kind":"ndpda","inputAlphabet":["a","b","c"],"stackAlphabet":["a","b"],"states":[0,1],"start":0,"accepting":[1],"transitions":[{"from":0,"read":"a","pop":[],"push":["a"],"to":0},{"from":0,"read":"b","pop":[],"push":["b"],"to":0},{"from":0,"read":"c","pop":[],"push":[],"to":1},{"from":1,"read":"a","pop":["a"],"push":[],"to":1},{"from":1,"read":"b","pop":["b"],"push":[],"to":1}]}"#;

const F2_JSON: &str = r#"{"schemaVersion":1,"kind":"ndpda","inputAlphabet":["a","b"],"stackAlphabet":["A"],"states":[0,1],"start":0,"accepting":[1],"transitions":[{"from":0,"read":"a","pop":[],"push":["A","A"],"to":0},{"from":0,"read":"b","pop":["A","A"],"push":[],"to":1},{"from":1,"read":"b","pop":["A","A"],"push":[],"to":1}]}"#;

const F3_JSON: &str = r#"{"schemaVersion":1,"kind":"ndpda","inputAlphabet":["a"],"stackAlphabet":["W","X","Y","Z"],"states":[0,1],"start":0,"accepting":[1],"transitions":[{"from":0,"read":"a","pop":["X","Y","Z"],"push":["W"],"to":1}]}"#;

/// Validates that a PDA conforms to the Restricted Normal Form (RNF) invariants.
pub fn assert_rnf_shape(pda: &Pda, _rnf: &RnfResult) {
    // 1. One start state s' and one accepting state a
    assert!(pda.start.is_some(), "RNF PDA must have a start state");
    let s_prime = pda.start.unwrap();
    assert_eq!(
        pda.accepting.len(),
        1,
        "RNF PDA must have exactly one accepting state"
    );
    let a = pda.accepting[0];
    assert_ne!(s_prime, a, "s' and a must be distinct");

    // 2. Start state s' has exactly one transition: read: None, pop: [], push: ["#"]
    let s_prime_trans: Vec<_> = pda
        .transitions
        .iter()
        .filter(|t| t.from == s_prime)
        .collect();
    assert_eq!(
        s_prime_trans.len(),
        1,
        "s' must have exactly one transition"
    );
    let st = s_prime_trans[0];
    assert_eq!(st.read, None);
    assert!(st.pop.is_empty());
    assert_eq!(st.push.len(), 1);
    let marker_id = st.push[0];
    assert_eq!(pda.stack.name(marker_id), Some("#"));

    // 3. Every transition into a reads nothing and pops exactly [#] and pushes nothing
    for t in &pda.transitions {
        if t.to == a {
            assert_eq!(t.read, None, "Transition into 'a' must read nothing");
            assert_eq!(t.pop, vec![marker_id], "Transition into 'a' must pop [#]");
            assert!(t.push.is_empty(), "Transition into 'a' must push nothing");
        }
    }

    // 4. Every other transition (not from s') pops exactly one symbol
    for t in &pda.transitions {
        if t.from != s_prime {
            assert_eq!(
                t.pop.len(),
                1,
                "All transitions not from s' must pop exactly one symbol"
            );
        }
    }

    // 5. '#' is pushed only by s' and the '#'-expansions (i.e. transitions popping '#')
    for t in &pda.transitions {
        if t.push.contains(&marker_id) {
            if t.from == s_prime {
                assert_eq!(t.push, vec![marker_id]);
            } else {
                assert_eq!(
                    t.pop,
                    vec![marker_id],
                    "Any transition pushing # must also pop #"
                );
                assert_eq!(
                    t.push.last(),
                    Some(&marker_id),
                    "Pushed # must be at bottom"
                );
            }
        }
    }
}

fn strings_abc_len_0_to_7() -> Vec<String> {
    // 3^0 + 3^1 + ... + 3^7 = (3^8 - 1) / 2 = (6561 - 1) / 2 = 3280 strings
    let mut result = Vec::with_capacity(3280);
    result.push(String::new());
    let mut current_len = vec![String::new()];
    for _ in 1..=7 {
        let mut next_len = Vec::with_capacity(current_len.len() * 3);
        for s in &current_len {
            next_len.push(format!("{s}a"));
            next_len.push(format!("{s}b"));
            next_len.push(format!("{s}c"));
        }
        result.extend(next_len.clone());
        current_len = next_len;
    }
    assert_eq!(result.len(), 3280);
    result
}

fn strings_ab_len_0_to_8() -> Vec<String> {
    // 2^0 + ... + 2^8 = 511 strings
    let mut result = Vec::with_capacity(511);
    result.push(String::new());
    let mut current_len = vec![String::new()];
    for _ in 1..=8 {
        let mut next_len = Vec::with_capacity(current_len.len() * 2);
        for s in &current_len {
            next_len.push(format!("{s}a"));
            next_len.push(format!("{s}b"));
        }
        result.extend(next_len.clone());
        current_len = next_len;
    }
    assert_eq!(result.len(), 511);
    result
}

fn strings_ab_len_0_to_4() -> Vec<String> {
    // 2^0 + ... + 2^4 = 31 strings
    let mut result = Vec::with_capacity(31);
    result.push(String::new());
    let mut current_len = vec![String::new()];
    for _ in 1..=4 {
        let mut next_len = Vec::with_capacity(current_len.len() * 2);
        for s in &current_len {
            next_len.push(format!("{s}a"));
            next_len.push(format!("{s}b"));
        }
        result.extend(next_len.clone());
        current_len = next_len;
    }
    assert_eq!(result.len(), 31);
    result
}

fn is_wcwr(s: &str) -> bool {
    let parts: Vec<&str> = s.split('c').collect();
    if parts.len() != 2 {
        return false;
    }
    let w = parts[0];
    let wr = parts[1];
    w.chars().all(|c| c == 'a' || c == 'b')
        && wr.chars().all(|c| c == 'a' || c == 'b')
        && w.chars().rev().collect::<String>() == wr
}

fn is_anbn_pos(s: &str) -> bool {
    let n_a = s.chars().take_while(|&c| c == 'a').count();
    let n_b = s.chars().skip(n_a).take_while(|&c| c == 'b').count();
    n_a >= 1 && n_a == n_b && n_a + n_b == s.len()
}

#[test]
fn test_fixture_f1_structure() {
    let pda = Pda::from_json(F1_JSON).unwrap();
    let rnf = pda_to_rnf(&pda).expect("pda_to_rnf F1 succeeds");

    assert_eq!(rnf.pda.kind, PdaKind::Ndpda);
    assert_eq!(rnf.pda.start, Some(StateId(2)));
    assert_eq!(rnf.pda.accepting, vec![StateId(3)]);
    assert_eq!(
        rnf.new_states,
        vec![
            StateName {
                id: StateId(2),
                name: "s'".to_string()
            },
            StateName {
                id: StateId(3),
                name: "a".to_string()
            },
        ]
    );
    assert_eq!(rnf.pda.stack.names(), vec!["a", "b", "#"]);
    assert_eq!(rnf.pda.input.names(), vec!["a", "b", "c"]);

    assert_eq!(rnf.pda.transitions.len(), 13);
    assert_eq!(rnf.steps.len(), 5);

    assert_eq!(rnf.steps[0].message.key, "pda.rnf.start");
    assert_eq!(rnf.steps[1].message.key, "pda.rnf.accept");
    assert_eq!(
        rnf.steps[1].message.params.get("state"),
        Some(&Param::Int(1))
    );

    assert_eq!(rnf.steps[2].message.key, "pda.rnf.expand");
    assert_eq!(
        rnf.steps[2].message.params.get("from"),
        Some(&Param::Int(0))
    );
    assert_eq!(rnf.steps[2].message.params.get("to"), Some(&Param::Int(0)));
    assert_eq!(rnf.steps[2].added.len(), 3);

    assert_eq!(rnf.steps[3].message.key, "pda.rnf.expand");
    assert_eq!(
        rnf.steps[3].message.params.get("from"),
        Some(&Param::Int(0))
    );
    assert_eq!(rnf.steps[3].message.params.get("to"), Some(&Param::Int(0)));
    assert_eq!(rnf.steps[3].added.len(), 3);

    assert_eq!(rnf.steps[4].message.key, "pda.rnf.expand");
    assert_eq!(
        rnf.steps[4].message.params.get("from"),
        Some(&Param::Int(0))
    );
    assert_eq!(rnf.steps[4].message.params.get("to"), Some(&Param::Int(1)));
    assert_eq!(rnf.steps[4].added.len(), 3);

    assert_rnf_shape(&rnf.pda, &rnf);
    assert_eq!(validate_pda(&rnf.pda), vec![]);
}

#[test]
fn test_fixture_f2_structure() {
    let pda = Pda::from_json(F2_JSON).unwrap();
    let rnf = pda_to_rnf(&pda).expect("pda_to_rnf F2 succeeds");

    assert_eq!(rnf.pda.start, Some(StateId(2)));
    assert_eq!(rnf.pda.accepting, vec![StateId(3)]);
    assert_eq!(
        rnf.new_states,
        vec![
            StateName {
                id: StateId(2),
                name: "s'".to_string()
            },
            StateName {
                id: StateId(3),
                name: "a".to_string()
            },
            StateName {
                id: StateId(4),
                name: "v1".to_string()
            },
            StateName {
                id: StateId(5),
                name: "v2".to_string()
            },
        ]
    );
    assert_eq!(rnf.pda.stack.names(), vec!["A", "#"]);

    assert_eq!(rnf.pda.transitions.len(), 8);
    assert_eq!(rnf.steps.len(), 5);

    assert_eq!(rnf.steps[0].message.key, "pda.rnf.start");
    assert_eq!(rnf.steps[1].message.key, "pda.rnf.accept");
    assert_eq!(rnf.steps[2].message.key, "pda.rnf.split");
    assert_eq!(
        rnf.steps[2].message.params.get("from"),
        Some(&Param::Int(0))
    );
    assert_eq!(rnf.steps[2].message.params.get("to"), Some(&Param::Int(1)));
    assert_eq!(
        rnf.steps[2].message.params.get("pops"),
        Some(&Param::Int(2))
    );
    assert_eq!(rnf.steps[2].added.len(), 2);
    // last transition in split reads input 'b'
    assert_eq!(rnf.steps[2].added[0].read, None);
    assert_eq!(rnf.steps[2].added[1].read, Some("b".to_string()));

    assert_eq!(rnf.steps[3].message.key, "pda.rnf.split");
    assert_eq!(
        rnf.steps[3].message.params.get("from"),
        Some(&Param::Int(1))
    );
    assert_eq!(rnf.steps[3].message.params.get("to"), Some(&Param::Int(1)));
    assert_eq!(
        rnf.steps[3].message.params.get("pops"),
        Some(&Param::Int(2))
    );
    assert_eq!(rnf.steps[3].added.len(), 2);
    assert_eq!(rnf.steps[3].added[0].read, None);
    assert_eq!(rnf.steps[3].added[1].read, Some("b".to_string()));

    assert_eq!(rnf.steps[4].message.key, "pda.rnf.expand");
    assert_eq!(rnf.steps[4].added.len(), 2);

    assert_rnf_shape(&rnf.pda, &rnf);
}

#[test]
fn test_fixture_f3_structure() {
    let pda = Pda::from_json(F3_JSON).unwrap();
    let rnf = pda_to_rnf(&pda).expect("pda_to_rnf F3 succeeds");

    assert_eq!(rnf.pda.start, Some(StateId(2)));
    assert_eq!(rnf.pda.accepting, vec![StateId(3)]);
    assert_eq!(
        rnf.new_states,
        vec![
            StateName {
                id: StateId(2),
                name: "s'".to_string()
            },
            StateName {
                id: StateId(3),
                name: "a".to_string()
            },
            StateName {
                id: StateId(4),
                name: "v1".to_string()
            },
            StateName {
                id: StateId(5),
                name: "v2".to_string()
            },
        ]
    );
    assert_eq!(rnf.pda.stack.names(), vec!["W", "X", "Y", "Z", "#"]);

    assert_eq!(rnf.pda.transitions.len(), 5);
    assert_eq!(rnf.steps.len(), 3);

    assert_eq!(rnf.steps[0].message.key, "pda.rnf.start");
    assert_eq!(rnf.steps[1].message.key, "pda.rnf.accept");
    assert_eq!(rnf.steps[2].message.key, "pda.rnf.split");
    assert_eq!(
        rnf.steps[2].message.params.get("from"),
        Some(&Param::Int(0))
    );
    assert_eq!(rnf.steps[2].message.params.get("to"), Some(&Param::Int(1)));
    assert_eq!(
        rnf.steps[2].message.params.get("pops"),
        Some(&Param::Int(3))
    );
    assert_eq!(rnf.steps[2].added.len(), 3);

    // Transitions in split: 0->4 (eps, pop X), 4->5 (eps, pop Y), 5->1 (read a, pop Z, push W)
    assert_eq!(rnf.steps[2].added[0].from, 0);
    assert_eq!(rnf.steps[2].added[0].to, 4);
    assert_eq!(rnf.steps[2].added[0].read, None);
    assert_eq!(rnf.steps[2].added[0].pop, vec!["X"]);
    assert!(rnf.steps[2].added[0].push.is_empty());

    assert_eq!(rnf.steps[2].added[1].from, 4);
    assert_eq!(rnf.steps[2].added[1].to, 5);
    assert_eq!(rnf.steps[2].added[1].read, None);
    assert_eq!(rnf.steps[2].added[1].pop, vec!["Y"]);
    assert!(rnf.steps[2].added[1].push.is_empty());

    assert_eq!(rnf.steps[2].added[2].from, 5);
    assert_eq!(rnf.steps[2].added[2].to, 1);
    assert_eq!(rnf.steps[2].added[2].read, Some("a".to_string()));
    assert_eq!(rnf.steps[2].added[2].pop, vec!["Z"]);
    assert_eq!(rnf.steps[2].added[2].push, vec!["W"]);

    assert_rnf_shape(&rnf.pda, &rnf);
}

#[test]
fn test_fixture_f4_small_cases() {
    // 1. No accepting state
    let json_no_acc = r#"{"schemaVersion":1,"kind":"ndpda","inputAlphabet":["a"],"stackAlphabet":["a"],"states":[0],"start":0,"accepting":[],"transitions":[]}"#;
    let pda_no_acc = Pda::from_json(json_no_acc).unwrap();
    let rnf_no_acc = pda_to_rnf(&pda_no_acc).unwrap();
    assert_eq!(rnf_no_acc.steps.len(), 1); // only start step
    assert_eq!(rnf_no_acc.pda.accepting, vec![StateId(2)]);
    assert_rnf_shape(&rnf_no_acc.pda, &rnf_no_acc);

    // 2. Two accepting states 1 and 2
    let json_two_acc = r#"{"schemaVersion":1,"kind":"ndpda","inputAlphabet":["a"],"stackAlphabet":["a"],"states":[0,1,2],"start":0,"accepting":[2,1],"transitions":[]}"#;
    let pda_two_acc = Pda::from_json(json_two_acc).unwrap();
    let rnf_two_acc = pda_to_rnf(&pda_two_acc).unwrap();
    // 1 start step + 2 accept steps (in ascending order of state id: 1, then 2)
    assert_eq!(rnf_two_acc.steps.len(), 3);
    assert_eq!(
        rnf_two_acc.steps[1].message.params.get("state"),
        Some(&Param::Int(1))
    );
    assert_eq!(
        rnf_two_acc.steps[2].message.params.get("state"),
        Some(&Param::Int(2))
    );
    assert_rnf_shape(&rnf_two_acc.pda, &rnf_two_acc);

    // 3. Transition 0->0, eps, [] -> []
    let json_eps_empty = r#"{"schemaVersion":1,"kind":"ndpda","inputAlphabet":["a"],"stackAlphabet":["A"],"states":[0],"start":0,"accepting":[],"transitions":[{"from":0,"read":null,"pop":[],"push":[],"to":0}]}"#;
    let pda_eps_empty = Pda::from_json(json_eps_empty).unwrap();
    let rnf_eps_empty = pda_to_rnf(&pda_eps_empty).unwrap();
    // |Gamma'| = 2 (A, #)
    assert_eq!(rnf_eps_empty.steps.len(), 2); // 1 start, 1 expand
    assert_eq!(rnf_eps_empty.steps[1].added.len(), 2);
    assert_rnf_shape(&rnf_eps_empty.pda, &rnf_eps_empty);
}

#[test]
fn test_fixture_f5_errors() {
    // 1. No start state
    let json_no_start = r#"{"schemaVersion":1,"kind":"ndpda","inputAlphabet":["a"],"stackAlphabet":["a"],"states":[0],"start":null,"accepting":[],"transitions":[]}"#;
    let pda_no_start = Pda::from_json(json_no_start).unwrap();
    assert_eq!(
        pda_to_rnf(&pda_no_start).unwrap_err().key,
        "pda.rnf.no_start_state"
    );

    // 2. Stack contains '#'
    let json_clash = r##"{"schemaVersion":1,"kind":"ndpda","inputAlphabet":["a"],"stackAlphabet":["#"],"states":[0],"start":0,"accepting":[],"transitions":[]}"##;
    let pda_clash = Pda::from_json(json_clash).unwrap();
    let err = pda_to_rnf(&pda_clash).unwrap_err();
    assert_eq!(err.key, "pda.rnf.marker_clash");
    assert_eq!(
        err.params.get("symbol"),
        Some(&Param::Text("#".to_string()))
    );

    // 3. Stack alphabet of 256 symbols
    let syms: Vec<String> = (0..256).map(|i| format!("s{i}")).collect();
    let pda_max_sym = Pda::new(
        PdaKind::Ndpda,
        Alphabet::new(vec!["a".to_string()]).unwrap(),
        Alphabet::new(syms).unwrap(),
        vec![StateId(0)],
        Some(StateId(0)),
        vec![],
        vec![],
    )
    .unwrap();
    let err_sym = pda_to_rnf(&pda_max_sym).unwrap_err();
    assert_eq!(err_sym.key, "machine.limit_exceeded");
    assert_eq!(
        err_sym.params.get("what"),
        Some(&Param::Text("symbols".to_string()))
    );
    assert_eq!(err_sym.params.get("limit"), Some(&Param::Int(256)));

    // 4. More states than MAX_STATES (2000): 32 transitions popping 64 symbols
    let mut transitions = Vec::new();
    let sym_a = SymbolId(0);
    for i in 0..32 {
        let pop = vec![sym_a; 64];
        let push = vec![sym_a; (i % 5) + 1];
        transitions.push(engine_core::pda::PdaTransition {
            from: StateId(0),
            read: None,
            pop,
            push,
            to: StateId(0),
        });
    }
    let pda_max_states = Pda::new(
        PdaKind::Ndpda,
        Alphabet::new(vec!["a".to_string()]).unwrap(),
        Alphabet::new(vec!["A".to_string()]).unwrap(),
        vec![StateId(0)],
        Some(StateId(0)),
        vec![],
        transitions,
    )
    .unwrap();
    let err_states = pda_to_rnf(&pda_max_states).unwrap_err();
    assert_eq!(err_states.key, "machine.limit_exceeded");
    assert_eq!(
        err_states.params.get("what"),
        Some(&Param::Text("states".to_string()))
    );
    assert_eq!(err_states.params.get("limit"), Some(&Param::Int(2000)));

    // 5. Overflow on u32 state id
    let pda_overflow = Pda::new(
        PdaKind::Ndpda,
        Alphabet::new(vec!["a".to_string()]).unwrap(),
        Alphabet::new(vec!["A".to_string()]).unwrap(),
        vec![StateId(u32::MAX)],
        Some(StateId(u32::MAX)),
        vec![],
        vec![],
    )
    .unwrap();
    let err_overflow = pda_to_rnf(&pda_overflow).unwrap_err();
    assert_eq!(err_overflow.key, "machine.limit_exceeded");
    assert_eq!(
        err_overflow.params.get("what"),
        Some(&Param::Text("states".to_string()))
    );
}

#[test]
fn test_ac2_f1_language_equivalence() {
    let pda = Pda::from_json(F1_JSON).unwrap();
    let rnf = pda_to_rnf(&pda).expect("pda_to_rnf F1 succeeds");
    let budget = PdaBudget::default();

    for w in strings_abc_len_0_to_7() {
        let syms_orig = pda.input.tokenize(&w).unwrap();
        let sim_orig = simulate_pda(&pda, &syms_orig, budget).unwrap();
        let accepted_orig = match sim_orig {
            engine_core::pda_simulate::PdaSimulation::Finished { accepted, .. } => accepted,
            engine_core::pda_simulate::PdaSimulation::Stopped { .. } => panic!("M stopped on {w}"),
        };

        let syms_rnf = rnf.pda.input.tokenize(&w).unwrap();
        let sim_rnf = simulate_pda(&rnf.pda, &syms_rnf, budget).unwrap();
        let accepted_rnf = match sim_rnf {
            engine_core::pda_simulate::PdaSimulation::Finished { accepted, .. } => accepted,
            engine_core::pda_simulate::PdaSimulation::Stopped { .. } => panic!("M' stopped on {w}"),
        };

        let oracle = is_wcwr(&w);
        assert_eq!(accepted_orig, oracle, "M disagrees with oracle on {w}");
        assert_eq!(accepted_rnf, oracle, "M' disagrees with oracle on {w}");
    }
}

#[test]
fn test_ac2_f2_language_equivalence() {
    let pda = Pda::from_json(F2_JSON).unwrap();
    let rnf = pda_to_rnf(&pda).expect("pda_to_rnf F2 succeeds");
    let budget = PdaBudget::default();

    for w in strings_ab_len_0_to_8() {
        let syms_orig = pda.input.tokenize(&w).unwrap();
        let sim_orig = simulate_pda(&pda, &syms_orig, budget).unwrap();
        let accepted_orig = match sim_orig {
            engine_core::pda_simulate::PdaSimulation::Finished { accepted, .. } => accepted,
            engine_core::pda_simulate::PdaSimulation::Stopped { .. } => panic!("M stopped on {w}"),
        };

        let syms_rnf = rnf.pda.input.tokenize(&w).unwrap();
        let sim_rnf = simulate_pda(&rnf.pda, &syms_rnf, budget).unwrap();
        let accepted_rnf = match sim_rnf {
            engine_core::pda_simulate::PdaSimulation::Finished { accepted, .. } => accepted,
            engine_core::pda_simulate::PdaSimulation::Stopped { .. } => panic!("M' stopped on {w}"),
        };

        let oracle = is_anbn_pos(&w);
        assert_eq!(accepted_orig, oracle, "M disagrees with oracle on {w}");
        assert_eq!(accepted_rnf, oracle, "M' disagrees with oracle on {w}");
    }
}

fn arb_pda(id_offset: u32) -> impl Strategy<Value = Pda> {
    (
        1usize..=3,
        prop::collection::vec(
            (
                0u32..3,
                0u32..3,
                0usize..=2, // 0: ε, 1: 'a', 2: 'b'
                prop::collection::vec(0u16..2, 0..=3),
                prop::collection::vec(0u16..2, 0..=3),
            ),
            1..=5,
        ),
        0u32..3,
        0u8..8,
    )
        .prop_map(move |(num_states, raw, start_state, accepting_bits)| {
            let n = num_states as u32;
            let states: Vec<StateId> = (0..n).map(|i| StateId(id_offset + i)).collect();
            let start = StateId(id_offset + start_state % n);
            let accepting: Vec<StateId> = states
                .iter()
                .enumerate()
                .filter(|(i, _)| accepting_bits & (1 << i) != 0)
                .map(|(_, s)| *s)
                .collect();
            let transitions = raw
                .into_iter()
                .map(
                    |(from, to, read, pop, push)| engine_core::pda::PdaTransition {
                        from: StateId(id_offset + from % n),
                        read: match read {
                            1 => Some(SymbolId(0)),
                            2 => Some(SymbolId(1)),
                            _ => None,
                        },
                        pop: pop.into_iter().map(SymbolId).collect(),
                        push: push.into_iter().map(SymbolId).collect(),
                        to: StateId(id_offset + to % n),
                    },
                )
                .collect();
            Pda::new(
                PdaKind::Ndpda,
                Alphabet::new(vec!["a".to_string(), "b".to_string()]).unwrap(),
                Alphabet::new(vec!["A".to_string(), "B".to_string()]).unwrap(),
                states,
                Some(start),
                accepting,
                transitions,
            )
            .unwrap()
        })
}

proptest! {
    #[test]
    fn test_ac3_proptest_random_pdas(pda in arb_pda(0)) {
        let rnf = pda_to_rnf(&pda).unwrap();
        assert_rnf_shape(&rnf.pda, &rnf);

        // Check counts
        let multi_pop_count = pda.transitions.iter().filter(|t| t.pop.len() >= 2).count();
        let non_pop_count = pda.transitions.iter().filter(|t| t.pop.is_empty()).count();
        let single_pop_count = pda.transitions.iter().filter(|t| t.pop.len() == 1).count();
        let sum_multi_pops: usize = pda.transitions.iter().filter(|t| t.pop.len() >= 2).map(|t| t.pop.len()).sum();
        let gamma_prime_len = pda.stack.len() + 1;

        let expected_steps = 1 + pda.accepting.len() + multi_pop_count + non_pop_count;
        let expected_transitions = 1 + pda.accepting.len() + single_pop_count + sum_multi_pops + (non_pop_count * gamma_prime_len);

        prop_assert_eq!(rnf.steps.len(), expected_steps);
        prop_assert_eq!(rnf.pda.transitions.len(), expected_transitions);

        // Simulation check
        let budget_orig = PdaBudget { max_steps: 60, max_configurations: 5000, max_stack: 12 };
        let budget_rnf = PdaBudget { max_steps: 240, max_configurations: 20000, max_stack: 14 };

        for w in strings_ab_len_0_to_4() {
            let syms_orig = pda.input.tokenize(&w).unwrap();
            let sim_orig = simulate_pda(&pda, &syms_orig, budget_orig).unwrap();
            let syms_rnf = rnf.pda.input.tokenize(&w).unwrap();
            let sim_rnf = simulate_pda(&rnf.pda, &syms_rnf, budget_rnf).unwrap();

            match (sim_orig, sim_rnf) {
                (engine_core::pda_simulate::PdaSimulation::Finished { accepted: acc_o, .. },
                 engine_core::pda_simulate::PdaSimulation::Finished { accepted: acc_r, .. }) => {
                    prop_assert_eq!(acc_o, acc_r, "Finished verdicts differ for {}", w);
                }
                (engine_core::pda_simulate::PdaSimulation::Finished { accepted: true, .. },
                 engine_core::pda_simulate::PdaSimulation::Stopped { .. }) => {
                    // Allowed: RNF simulation might reach budget before finding accept, but not rejected
                }
                (engine_core::pda_simulate::PdaSimulation::Stopped { .. },
                 engine_core::pda_simulate::PdaSimulation::Finished { accepted: true, .. }) => {
                    // Allowed
                }
                _ => {}
            }
        }
    }
}

proptest! {
    #[test]
    fn test_ac4_arbitrary_text_never_panics(s in "\\PC*") {
        let _ = api_pda_to_rnf(&s);
    }

    /// Random PDAs whose state ids sit at the very top of `u32`: an error or a result, never a panic.
    #[test]
    fn test_ac4_ids_near_top_of_u32_never_panic(pda in arb_pda(u32::MAX - 4)) {
        match pda_to_rnf(&pda) {
            Ok(r) => assert_rnf_shape(&r.pda, &r),
            Err(e) => prop_assert_eq!(e.key, "machine.limit_exceeded"),
        }
    }
}

/// An id of `u32::MAX` leaves no room for `s'`: the answer is the states limit message.
#[test]
fn test_ac4_max_id_is_a_limit_message() {
    let pda = Pda::new(
        PdaKind::Ndpda,
        Alphabet::new(vec!["a".to_string()]).unwrap(),
        Alphabet::new(vec!["A".to_string()]).unwrap(),
        vec![StateId(u32::MAX)],
        Some(StateId(u32::MAX)),
        vec![],
        vec![],
    )
    .unwrap();
    let err = pda_to_rnf(&pda).unwrap_err();
    assert_eq!(err.key, "machine.limit_exceeded");
}
