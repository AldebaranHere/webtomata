//! NDFSM → DFSM by Rich's subset construction (the method in the course slides).
//! Step 1: compute eps(q) for every state. Step 2: s' = eps(s). Step 3: take each active
//! state Q in the order it was found and, for each symbol c, compute the union of eps(p) over
//! the states p reached from Q on c. Step 4: the active states are K'. Step 5: A' holds the
//! subsets that contain an accepting state. The result is a complete DFSM; the empty set is
//! a state like any other.

use crate::closure::{closure, moves_of};
use crate::fsm::{Fsm, FsmKind, MAX_STATES, MAX_TRANSITIONS, StateId, SymbolId, Transition};
use crate::message::Message;
use crate::stop::StopReason;
use crate::trace::{Change, ConversionStep};
use std::collections::{BTreeSet, HashMap};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ConversionBudget {
    /// The most states the new DFSM may have (at most [`MAX_STATES`]).
    pub max_states: usize,
    /// The most trace steps (at most [`MAX_TRANSITIONS`], since every transition is a step).
    pub max_steps: usize,
}

impl Default for ConversionBudget {
    fn default() -> Self {
        ConversionBudget {
            max_states: MAX_STATES,
            max_steps: MAX_TRANSITIONS,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Conversion {
    Finished {
        dfsm: Fsm,
        /// `subsets[i]` holds the original states that make up DFSM state `i`.
        subsets: Vec<Vec<StateId>>,
        trace: Vec<ConversionStep>,
    },
    Stopped {
        reason: StopReason,
        partial_trace: Vec<ConversionStep>,
    },
}

struct Builder {
    trace: Vec<ConversionStep>,
    max_steps: usize,
}

impl Builder {
    fn push(&mut self, message: Message, change: Change) -> Result<(), StopReason> {
        if self.trace.len() >= self.max_steps {
            return Err(StopReason::MaxSteps);
        }
        self.trace.push(ConversionStep { message, change });
        Ok(())
    }
}

/// The subsets found so far; subset `i` becomes DFSM state `i`.
struct Subsets {
    list: Vec<Vec<StateId>>,
    index: HashMap<Vec<StateId>, StateId>,
    max: usize,
}

impl Subsets {
    /// Adds a new subset as the next DFSM state, unless the state budget is used up.
    fn add(&mut self, members: Vec<StateId>, out: &mut Builder) -> Result<StateId, StopReason> {
        if self.list.len() >= self.max {
            return Err(StopReason::MaxStates);
        }
        let id = StateId(u32::try_from(self.list.len()).map_err(|_| StopReason::MaxStates)?);
        let message = Message::new("determinize.new_state").with("state", id.0);
        let change = Change::NewState {
            state: id,
            members: members.clone(),
        };
        out.push(message, change)?;
        self.index.insert(members.clone(), id);
        self.list.push(members);
        Ok(id)
    }
}

/// The finished pieces of the new DFSM.
struct Parts {
    subsets: Vec<Vec<StateId>>,
    transitions: Vec<Transition>,
    accepting: Vec<StateId>,
}

fn build(
    fsm: &Fsm,
    start: StateId,
    max_states: usize,
    out: &mut Builder,
) -> Result<Parts, StopReason> {
    let moves = moves_of(fsm);

    // 1. eps(q) for every state q
    let mut eps: HashMap<StateId, BTreeSet<StateId>> = HashMap::new();
    for &q in &fsm.states {
        let set = closure(&moves, [q]);
        let message = Message::new("determinize.closure").with("state", q.0);
        let change = Change::Closure {
            state: q,
            closure: set.iter().copied().collect(),
        };
        out.push(message, change)?;
        eps.insert(q, set);
    }

    let mut subsets = Subsets {
        list: Vec::new(),
        index: HashMap::new(),
        max: max_states,
    };

    // 2. s' = eps(s)
    let first: Vec<StateId> = eps
        .get(&start)
        .map(|set| set.iter().copied().collect())
        .unwrap_or_else(|| vec![start]);
    let s = subsets.add(first, out)?;
    out.push(
        Message::new("determinize.start").with("state", s.0),
        Change::Start { state: s },
    )?;

    // 3. transitions, taking active states in the order they were found
    let mut transitions = Vec::new();
    let mut i = 0;
    while i < subsets.list.len() {
        let from = StateId(u32::try_from(i).map_err(|_| StopReason::MaxStates)?);
        let members = subsets.list[i].clone();
        for (c, name) in fsm.alphabet.names().iter().enumerate() {
            let symbol = SymbolId(u16::try_from(c).map_err(|_| StopReason::MaxStates)?);
            let reached = members
                .iter()
                .flat_map(|&q| moves.get(&(q, Some(symbol))).into_iter().flatten().copied());
            let target: BTreeSet<StateId> = reached
                .flat_map(|p| eps.get(&p).into_iter().flatten().copied())
                .collect();
            let target: Vec<StateId> = target.into_iter().collect();
            let to = match subsets.index.get(&target) {
                Some(&id) => id,
                None => subsets.add(target, out)?,
            };
            let message = Message::new("determinize.transition")
                .with("from", from.0)
                .with("symbol", name.as_str())
                .with("to", to.0);
            out.push(message, Change::Transition { from, symbol, to })?;
            transitions.push(Transition {
                from,
                on: Some(symbol),
                to,
            });
        }
        i += 1;
    }

    // 4. K' is the list of subsets. 5. A' = subsets that contain an accepting state.
    let mut accepting = Vec::new();
    for (i, members) in subsets.list.iter().enumerate() {
        if members
            .iter()
            .any(|q| fsm.accepting.binary_search(q).is_ok())
        {
            let id = StateId(u32::try_from(i).map_err(|_| StopReason::MaxStates)?);
            let message = Message::new("determinize.accepting").with("state", id.0);
            out.push(message, Change::Accepting { state: id })?;
            accepting.push(id);
        }
    }
    Ok(Parts {
        subsets: subsets.list,
        transitions,
        accepting,
    })
}

/// Converts any machine to an equivalent DFSM and records each step. Returns an error
/// message if the machine has no start state.
pub fn determinize(fsm: &Fsm, budget: ConversionBudget) -> Result<Conversion, Message> {
    let start = fsm
        .start
        .ok_or_else(|| Message::new("determinize.no_start_state"))?;
    let mut out = Builder {
        trace: Vec::new(),
        max_steps: budget.max_steps.min(MAX_TRANSITIONS),
    };
    let max_states = budget.max_states.min(MAX_STATES);
    match build(fsm, start, max_states, &mut out) {
        Err(reason) => Ok(Conversion::Stopped {
            reason,
            partial_trace: out.trace,
        }),
        Ok(parts) => {
            let states = (0..parts.subsets.len())
                .map(|i| StateId(i as u32))
                .collect();
            let dfsm = Fsm::new(
                FsmKind::Dfsm,
                fsm.alphabet.clone(),
                states,
                Some(StateId(0)),
                parts.accepting,
                parts.transitions,
            )?;
            Ok(Conversion::Finished {
                dfsm,
                subsets: parts.subsets,
                trace: out.trace,
            })
        }
    }
}
