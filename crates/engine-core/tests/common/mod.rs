//! Shared test helpers.

use engine_core::{Alphabet, Fsm, FsmKind, StateId, SymbolId, Transition};
use proptest::prelude::*;

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
