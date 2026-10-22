//! Transition lookup and ε-closure, shared by simulation and determinization.

use crate::fsm::{Fsm, StateId, SymbolId};
use std::collections::{BTreeSet, HashMap};

/// Targets of each (state, symbol) pair; `None` is ε.
pub(crate) type Moves = HashMap<(StateId, Option<SymbolId>), Vec<StateId>>;

pub(crate) fn moves_of(fsm: &Fsm) -> Moves {
    let mut moves = Moves::new();
    for t in &fsm.transitions {
        moves.entry((t.from, t.on)).or_default().push(t.to);
    }
    moves
}

/// The states reachable from `seed` through ε-transitions, including `seed` itself.
pub(crate) fn closure(moves: &Moves, seed: impl IntoIterator<Item = StateId>) -> BTreeSet<StateId> {
    let mut set = BTreeSet::new();
    let mut stack = Vec::new();
    for state in seed {
        if set.insert(state) {
            stack.push(state);
        }
    }
    while let Some(state) = stack.pop() {
        for &to in moves.get(&(state, None)).into_iter().flatten() {
            if set.insert(to) {
                stack.push(to);
            }
        }
    }
    set
}

/// The states reached from `states` by reading `symbol`, then following ε-transitions. Sorted.
pub(crate) fn step(moves: &Moves, states: &[StateId], symbol: SymbolId) -> Vec<StateId> {
    let reached = states
        .iter()
        .flat_map(|&q| moves.get(&(q, Some(symbol))).into_iter().flatten().copied())
        .collect::<Vec<_>>();
    closure(moves, reached).into_iter().collect()
}
