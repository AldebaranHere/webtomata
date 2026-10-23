//! Which states make a machine nondeterministic (JFLAP: "Highlight Nondeterminism").
//! In Rich's definition a state is nondeterministic if it has an ε-transition, or two
//! transitions on one symbol. A missing transition is not nondeterminism.

use crate::fsm::{Fsm, StateId, SymbolId};
use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};

/// A state that has at least one reason to be nondeterministic.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Nondeterminism {
    pub state: StateId,
    /// The symbols with two or more transitions out of this state, sorted. Two identical
    /// transitions count as two, as in `validate`.
    pub symbols: Vec<SymbolId>,
    /// The state has an ε-transition.
    pub epsilon: bool,
}

/// The nondeterministic states of `fsm`, sorted by state. The kind of the machine does not
/// matter, so a machine that says it is a DFSM but is not one still gets a list. A DFSM, also
/// one with missing transitions, gives an empty list.
pub fn nondeterministic_states(fsm: &Fsm) -> Vec<Nondeterminism> {
    let mut found: BTreeMap<StateId, (BTreeMap<SymbolId, usize>, bool)> = BTreeMap::new();
    for t in &fsm.transitions {
        let (counts, epsilon) = found.entry(t.from).or_default();
        match t.on {
            Some(symbol) => *counts.entry(symbol).or_default() += 1,
            None => *epsilon = true,
        }
    }
    found
        .into_iter()
        .filter_map(|(state, (counts, epsilon))| {
            let symbols: BTreeSet<SymbolId> = counts
                .into_iter()
                .filter(|&(_, n)| n >= 2)
                .map(|(symbol, _)| symbol)
                .collect();
            (epsilon || !symbols.is_empty()).then(|| Nondeterminism {
                state,
                symbols: symbols.into_iter().collect(),
                epsilon,
            })
        })
        .collect()
}
