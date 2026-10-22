//! Equivalence of two machines, with the shortest witness string and lists of the strings
//! they classify differently. Both machines are explored together, one pair of active-state
//! sets at a time, in breadth-first order, so no DFSM has to be built first and the first
//! difference found is the shortest. Among strings of the same length it is the first in
//! alphabet order.

use crate::closure::{Moves, closure, moves_of, step};
use crate::fsm::{Fsm, StateId, SymbolId};
use crate::message::Message;
use crate::stop::StopReason;
use crate::trace::{Change, ConversionStep};
use std::collections::{HashSet, VecDeque};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EquivalenceBudget {
    /// The most pairs of state sets to explore when deciding equivalence.
    pub max_pairs: usize,
    /// The most strings to look at when listing wrong strings.
    pub max_visits: usize,
    /// The longest string that is listed.
    pub max_length: usize,
    /// The most strings in each list.
    pub max_strings: usize,
}

impl Default for EquivalenceBudget {
    fn default() -> Self {
        EquivalenceBudget {
            max_pairs: 100_000,
            max_visits: 100_000,
            max_length: 8,
            max_strings: 5,
        }
    }
}

/// A string that the two machines classify differently. Symbols refer to the alphabet of the
/// first machine (the candidate).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Counterexample {
    pub string: Vec<SymbolId>,
    /// True if the candidate accepts it and the reference rejects it.
    pub candidate_accepts: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Equivalence {
    Equivalent {
        /// How many pairs of state sets were explored.
        pairs: usize,
    },
    Different {
        /// The shortest string the machines classify differently.
        witness: Counterexample,
        /// Strings the candidate accepts and the reference rejects, shortest first.
        accepted_but_should_reject: Vec<Vec<SymbolId>>,
        /// Strings the candidate rejects and the reference accepts, shortest first.
        rejected_but_should_accept: Vec<Vec<SymbolId>>,
        /// True if the lists were cut off by `max_strings` or `max_visits`. Strings longer
        /// than `max_length` are never listed.
        lists_truncated: bool,
        /// The witness path through both machines.
        trace: Vec<ConversionStep>,
    },
    Stopped {
        reason: StopReason,
    },
}

struct Side<'a> {
    fsm: &'a Fsm,
    moves: Moves,
}

impl Side<'_> {
    fn accepts(&self, states: &[StateId]) -> bool {
        states
            .iter()
            .any(|q| self.fsm.accepting.binary_search(q).is_ok())
    }
}

/// A pair of active-state sets reached by reading `via` from the pair at index `parent`.
struct Node {
    candidate: Vec<StateId>,
    reference: Vec<StateId>,
    parent: Option<(usize, SymbolId)>,
}

fn start_of<'a>(fsm: &'a Fsm, side: &'static str) -> Result<Side<'a>, Message> {
    if fsm.start.is_none() {
        return Err(Message::new("equivalent.no_start_state").with("side", side));
    }
    Ok(Side {
        fsm,
        moves: moves_of(fsm),
    })
}

/// Compares `candidate` with `reference`. Returns an error message if a machine has no start
/// state or the alphabets do not have the same symbols (in any order).
pub fn equivalent(
    candidate: &Fsm,
    reference: &Fsm,
    budget: EquivalenceBudget,
) -> Result<Equivalence, Message> {
    let a = start_of(candidate, "candidate")?;
    let b = start_of(reference, "reference")?;
    let map = candidate.alphabet.match_by_name(
        &reference.alphabet,
        "equivalent.alphabet_mismatch",
        ("candidate", "reference"),
    )?;
    let k = map.len();
    let (Some(sa), Some(sb)) = (candidate.start, reference.start) else {
        return Err(Message::new("equivalent.no_start_state"));
    };
    let next = |nodes: &[Node], i: usize, c: usize| {
        let symbol = SymbolId(c as u16);
        (
            step(&a.moves, &nodes[i].candidate, symbol),
            step(&b.moves, &nodes[i].reference, map[c]),
        )
    };

    // Decide equivalence: explore pairs breadth-first until one differs.
    let root = Node {
        candidate: closure(&a.moves, [sa]).into_iter().collect(),
        reference: closure(&b.moves, [sb]).into_iter().collect(),
        parent: None,
    };
    let mut seen = HashSet::from([(root.candidate.clone(), root.reference.clone())]);
    let mut nodes = vec![root];
    let mut i = 0;
    while i < nodes.len() {
        if a.accepts(&nodes[i].candidate) != b.accepts(&nodes[i].reference) {
            let candidate_accepts = a.accepts(&nodes[i].candidate);
            return Ok(different(
                &a,
                &b,
                &map,
                &nodes,
                i,
                candidate_accepts,
                budget,
            ));
        }
        for c in 0..k {
            let (ca, cb) = next(&nodes, i, c);
            if ca.is_empty() && cb.is_empty() {
                continue; // both machines reject every extension
            }
            if seen.insert((ca.clone(), cb.clone())) {
                if nodes.len() >= budget.max_pairs {
                    return Ok(Equivalence::Stopped {
                        reason: StopReason::MaxPairs,
                    });
                }
                nodes.push(Node {
                    candidate: ca,
                    reference: cb,
                    parent: Some((i, SymbolId(c as u16))),
                });
            }
        }
        i += 1;
    }
    Ok(Equivalence::Equivalent { pairs: nodes.len() })
}

fn different(
    a: &Side,
    b: &Side,
    map: &[SymbolId],
    nodes: &[Node],
    found: usize,
    candidate_accepts: bool,
    budget: EquivalenceBudget,
) -> Equivalence {
    // The path from the first pair to the pair that differs.
    let mut path = vec![found];
    while let Some((parent, _)) = nodes[*path.last().unwrap_or(&0)].parent {
        path.push(parent);
    }
    path.reverse();

    let last = path.len() - 1;
    let final_key = if candidate_accepts {
        "equivalent.accepted_but_should_reject"
    } else {
        "equivalent.rejected_but_should_accept"
    };
    let mut string = Vec::new();
    let mut trace = Vec::new();
    for (position, &index) in path.iter().enumerate() {
        let symbol = nodes[index].parent.map(|(_, c)| c);
        string.extend(symbol);
        let key = match (position == last, position) {
            (true, _) => final_key,
            (false, 0) => "equivalent.start",
            (false, _) => "equivalent.read",
        };
        let mut message = Message::new(key).with("position", position);
        if let Some(c) = symbol {
            message = message.with("symbol", a.fsm.alphabet.name(c).unwrap_or_default());
        }
        trace.push(ConversionStep {
            message,
            change: Change::Product {
                position,
                symbol,
                candidate: nodes[index].candidate.clone(),
                reference: nodes[index].reference.clone(),
            },
        });
    }

    let (accepted_but_should_reject, rejected_but_should_accept, lists_truncated) =
        list_wrong_strings(a, b, map, budget);
    Equivalence::Different {
        witness: Counterexample {
            string,
            candidate_accepts,
        },
        accepted_but_should_reject,
        rejected_but_should_accept,
        lists_truncated,
        trace,
    }
}

/// Goes through the strings by length, then alphabet order, and collects the ones the machines
/// classify differently.
fn list_wrong_strings(
    a: &Side,
    b: &Side,
    map: &[SymbolId],
    budget: EquivalenceBudget,
) -> (Vec<Vec<SymbolId>>, Vec<Vec<SymbolId>>, bool) {
    let mut accepted = Vec::new();
    let mut rejected = Vec::new();
    let mut truncated = false;
    let (Some(sa), Some(sb)) = (a.fsm.start, b.fsm.start) else {
        return (accepted, rejected, truncated);
    };
    let mut queue = VecDeque::from([(
        Vec::new(),
        closure(&a.moves, [sa]).into_iter().collect::<Vec<_>>(),
        closure(&b.moves, [sb]).into_iter().collect::<Vec<_>>(),
    )]);
    let mut visits = 0;
    while let Some((string, ca, cb)) = queue.pop_front() {
        if visits >= budget.max_visits {
            truncated = true;
            break;
        }
        visits += 1;
        let (ya, yb) = (a.accepts(&ca), b.accepts(&cb));
        if ya != yb {
            let list = if ya { &mut accepted } else { &mut rejected };
            if list.len() < budget.max_strings {
                list.push(string.clone());
            } else {
                truncated = true;
            }
        }
        let full = |list: &Vec<_>| list.len() >= budget.max_strings;
        if truncated && full(&accepted) && full(&rejected) {
            break;
        }
        if string.len() < budget.max_length {
            for (c, &mapped) in map.iter().enumerate() {
                let symbol = SymbolId(c as u16);
                let (na, nb) = (step(&a.moves, &ca, symbol), step(&b.moves, &cb, mapped));
                if na.is_empty() && nb.is_empty() {
                    continue;
                }
                let mut longer = string.clone();
                longer.push(symbol);
                queue.push_back((longer, na, nb));
            }
        }
        if queue.len() > budget.max_visits {
            truncated = true;
            break;
        }
    }
    (accepted, rejected, truncated)
}
