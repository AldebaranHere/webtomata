//! Shared test helpers. Each test file uses only some of them.

#![allow(dead_code)]

use engine_core::{Alphabet, Fsm, FsmKind, StateId, SymbolId, Transition};
use proptest::prelude::*;

// Rich: L = {w in {a, b}* : |w| is even}
pub const EVEN: &str = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,1],"start":0,"accepting":[0],"transitions":[{"from":0,"on":"a","to":1},{"from":0,"on":"b","to":1},{"from":1,"on":"a","to":0},{"from":1,"on":"b","to":0}]}"#;

// L = {w in {0, 1}* : w ends in 10}, as an NDFSM
pub const ENDS_10: &str = r#"{"schemaVersion":1,"kind":"ndfsm","alphabet":["0","1"],"states":[0,1,2],"start":0,"accepting":[2],"transitions":[{"from":0,"on":"0","to":0},{"from":0,"on":"1","to":0},{"from":0,"on":"1","to":1},{"from":1,"on":"0","to":2}]}"#;

// L = a*b*, as an NDFSM with an epsilon transition
pub const A_STAR_B_STAR: &str = r#"{"schemaVersion":1,"kind":"ndfsm","alphabet":["a","b"],"states":[0,1],"start":0,"accepting":[1],"transitions":[{"from":0,"on":"a","to":0},{"from":0,"on":null,"to":1},{"from":1,"on":"b","to":1}]}"#;

// A DFSM that only knows "a" from state 0
pub const PARTIAL: &str = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,1],"start":0,"accepting":[1],"transitions":[{"from":0,"on":"a","to":1}]}"#;

// L = {w : |w| is even}, counting modulo 4 (states 0 and 2 accept)
pub const EVEN_MOD_4: &str = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,1,2,3],"start":0,"accepting":[0,2],"transitions":[{"from":0,"on":"a","to":1},{"from":0,"on":"b","to":1},{"from":1,"on":"a","to":2},{"from":1,"on":"b","to":2},{"from":2,"on":"a","to":3},{"from":2,"on":"b","to":3},{"from":3,"on":"a","to":0},{"from":3,"on":"b","to":0}]}"#;

// L = a*, as a complete DFSM
pub const A_STAR: &str = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,1],"start":0,"accepting":[0],"transitions":[{"from":0,"on":"a","to":0},{"from":0,"on":"b","to":1},{"from":1,"on":"a","to":1},{"from":1,"on":"b","to":1}]}"#;

// L = a*b*, as a complete DFSM
pub const A_STAR_B_STAR_DFSM: &str = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,1,2],"start":0,"accepting":[0,1],"transitions":[{"from":0,"on":"a","to":0},{"from":0,"on":"b","to":1},{"from":1,"on":"a","to":2},{"from":1,"on":"b","to":1},{"from":2,"on":"a","to":2},{"from":2,"on":"b","to":2}]}"#;

/// "The n-th symbol from the end is a" as an NDFSM. Its DFSM needs 2^n states.
pub fn nth_from_end(n: u32) -> String {
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
    format!(
        r#"{{"schemaVersion":1,"kind":"ndfsm","alphabet":["a","b"],"states":[{}],"start":0,"accepting":[{n}],"transitions":[{}]}}"#,
        states.join(","),
        t.join(",")
    )
}

/// Random machines over the given symbols, of both kinds, with sparse state ids and any mix
/// of valid and invalid structure (missing start, missing transitions, ε).
pub fn machine(symbols: Vec<String>) -> impl Strategy<Value = Fsm> {
    (
        prop::bool::ANY,
        1u32..8,
        prop::option::of(0u32..8),
        prop::collection::vec(prop::bool::ANY, 8),
        prop::collection::vec((0u32..8, 0usize..6, 0u32..8), 0..20),
    )
        .prop_map(move |(ndfsm, n, start, accepting, edges)| {
            let k = symbols.len();
            let id = |i: u32| StateId((i % n) * 3); // sparse ids
            let transitions = edges
                .into_iter()
                .map(|(f, s, t)| Transition {
                    from: id(f),
                    on: (s % (k + 1) < k).then(|| SymbolId((s % (k + 1)) as u16)),
                    to: id(t),
                })
                .collect();
            Fsm::new(
                if ndfsm { FsmKind::Ndfsm } else { FsmKind::Dfsm },
                Alphabet::new(symbols.clone()).unwrap(),
                (0..n).map(id).collect(),
                start.map(id),
                (0..n).filter(|&i| accepting[i as usize]).map(id).collect(),
                transitions,
            )
            .unwrap()
        })
}

pub fn arb_fsm() -> impl Strategy<Value = Fsm> {
    prop::collection::btree_set("[a-z]{1,4}", 0..5)
        .prop_flat_map(|symbols| machine(symbols.into_iter().collect()))
}

/// Two random machines over the same alphabet.
pub fn arb_pair() -> impl Strategy<Value = (Fsm, Fsm)> {
    prop::collection::btree_set("[a-z]{1,3}", 1..4).prop_flat_map(|symbols| {
        let symbols: Vec<String> = symbols.into_iter().collect();
        (machine(symbols.clone()), machine(symbols))
    })
}
