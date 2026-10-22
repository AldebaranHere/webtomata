//! Shared test helpers. Each test file uses only some of them.

#![allow(dead_code)]

use engine_core::{Alphabet, Fsm, FsmKind, StateId, SymbolId, Transition};
use proptest::prelude::*;

// L = {w in {0, 1}* : w ends in 10}, as an NDFSM
pub const ENDS_10: &str = r#"{"schemaVersion":1,"kind":"ndfsm","alphabet":["0","1"],"states":[0,1,2],"start":0,"accepting":[2],"transitions":[{"from":0,"on":"0","to":0},{"from":0,"on":"1","to":0},{"from":0,"on":"1","to":1},{"from":1,"on":"0","to":2}]}"#;

// L = a*b*, as an NDFSM with an epsilon transition
pub const A_STAR_B_STAR: &str = r#"{"schemaVersion":1,"kind":"ndfsm","alphabet":["a","b"],"states":[0,1],"start":0,"accepting":[1],"transitions":[{"from":0,"on":"a","to":0},{"from":0,"on":null,"to":1},{"from":1,"on":"b","to":1}]}"#;

// A DFSM that only knows "a" from state 0
pub const PARTIAL: &str = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,1],"start":0,"accepting":[1],"transitions":[{"from":0,"on":"a","to":1}]}"#;

/// Random machines of both kinds, with sparse state ids and any mix of
/// valid and invalid structure (missing start, missing transitions, ε).
pub fn arb_fsm() -> impl Strategy<Value = Fsm> {
    (
        prop::bool::ANY,
        prop::collection::btree_set("[a-z]{1,4}", 0..5),
        1u32..8,
        prop::option::of(0u32..8),
        prop::collection::vec(prop::bool::ANY, 8),
        prop::collection::vec((0u32..8, 0usize..6, 0u32..8), 0..20),
    )
        .prop_map(|(ndfsm, symbols, n, start, accepting, edges)| {
            let symbols: Vec<String> = symbols.into_iter().collect();
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
                Alphabet::new(symbols).unwrap(),
                (0..n).map(id).collect(),
                start.map(id),
                (0..n).filter(|&i| accepting[i as usize]).map(id).collect(),
                transitions,
            )
            .unwrap()
        })
}
