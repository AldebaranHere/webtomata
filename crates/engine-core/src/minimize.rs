//! DFSM minimization by partition refinement, as in the course slides (Rich's minDFSM,
//! "ver 2") with one addition: unreachable states are dropped first, because otherwise
//! the result may not be minimal.
//!
//! Step 1: start with two classes, the accepting states and the others. Step 2: scan the
//! classes in order. A class that has more than one state is divisible if two of its states
//! go to different classes on some symbol. At the first divisible class, the states that
//! differ from the first state move to a new class placed right after it, and a new scan
//! starts. Step 3: when a scan finds nothing to split, each class becomes one state.

use crate::fsm::{Fsm, FsmKind, MAX_TRANSITIONS, StateId, SymbolId, Transition};
use crate::message::Message;
use crate::stop::StopReason;
use crate::trace::{Change, ConversionStep, Witness};
use crate::validate::{Severity, validate};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct MinimizeBudget {
    /// The most trace steps.
    pub max_steps: usize,
}

impl Default for MinimizeBudget {
    fn default() -> Self {
        MinimizeBudget {
            max_steps: MAX_TRANSITIONS,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(
    tag = "result",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub enum Minimization {
    Finished {
        #[cfg_attr(feature = "ts", ts(as = "crate::json::Wire"))]
        dfsm: Fsm,
        /// `classes[i]` holds the original states in state `i` of the minimal DFSM.
        classes: Vec<Vec<StateId>>,
        trace: Vec<ConversionStep>,
    },
    Stopped {
        reason: StopReason,
        partial_trace: Vec<ConversionStep>,
    },
}

struct Trace {
    steps: Vec<ConversionStep>,
    max_steps: usize,
}

impl Trace {
    fn push(&mut self, message: Message, change: Change) -> Result<(), StopReason> {
        if self.steps.len() >= self.max_steps {
            return Err(StopReason::MaxSteps);
        }
        self.steps.push(ConversionStep { message, change });
        Ok(())
    }
}

/// The finished pieces of the minimal DFSM.
struct Parts {
    classes: Vec<Vec<StateId>>,
    start: StateId,
    transitions: Vec<Transition>,
    accepting: Vec<StateId>,
}

fn state_id(i: usize) -> StateId {
    StateId(i as u32)
}

fn symbol_id(i: usize) -> SymbolId {
    SymbolId(i as u16)
}

fn class_map(classes: &[Vec<StateId>]) -> HashMap<StateId, usize> {
    classes
        .iter()
        .enumerate()
        .flat_map(|(i, class)| class.iter().map(move |&q| (q, i)))
        .collect()
}

fn refine(fsm: &Fsm, start: StateId, out: &mut Trace) -> Result<Parts, StopReason> {
    let k = fsm.alphabet.len();
    let delta: HashMap<(StateId, SymbolId), StateId> = fsm
        .transitions
        .iter()
        .filter_map(|t| Some(((t.from, t.on?), t.to)))
        .collect();

    // Drop the states that no input can reach.
    let mut reachable = HashSet::from([start]);
    let mut queue = VecDeque::from([start]);
    while let Some(q) = queue.pop_front() {
        for c in 0..k {
            if let Some(&to) = delta.get(&(q, symbol_id(c)))
                && reachable.insert(to)
            {
                queue.push_back(to);
            }
        }
    }
    for &q in fsm.states.iter().filter(|q| !reachable.contains(q)) {
        let message = Message::new("minimize.remove_unreachable").with("state", q.0);
        out.push(message, Change::RemoveUnreachable { state: q })?;
    }

    // Step 1: two classes, the accepting states first.
    let is_accepting = |q: &StateId| fsm.accepting.binary_search(q).is_ok();
    let (accepting, rest): (Vec<StateId>, Vec<StateId>) = fsm
        .states
        .iter()
        .copied()
        .filter(|q| reachable.contains(q))
        .partition(is_accepting);
    let mut classes: Vec<Vec<StateId>> = [accepting, rest]
        .into_iter()
        .filter(|c| !c.is_empty())
        .collect();
    out.push(
        Message::new("minimize.initial_classes"),
        Change::Classes {
            classes: classes.clone(),
        },
    )?;

    // Step 2: scan the classes in order; stop each scan at the first split.
    loop {
        let class_of = class_map(&classes);
        let mut split = false;
        for ci in 0..classes.len() {
            if classes[ci].len() < 2 {
                continue;
            }
            let class = classes[ci].clone();
            let message = Message::new("minimize.examine").with("size", class.len());
            out.push(
                message,
                Change::Examine {
                    class: class.clone(),
                },
            )?;

            // Group the states by the classes they reach on each symbol.
            let mut groups: Vec<(Vec<usize>, Vec<StateId>)> = Vec::new();
            for &q in &class {
                let signature: Vec<usize> = (0..k)
                    .map(|c| {
                        delta
                            .get(&(q, symbol_id(c)))
                            .and_then(|to| class_of.get(to))
                            .copied()
                            .unwrap_or(usize::MAX)
                    })
                    .collect();
                match groups.iter_mut().find(|(s, _)| *s == signature) {
                    Some((_, members)) => members.push(q),
                    None => groups.push((signature, vec![q])),
                }
            }
            if groups.len() == 1 {
                out.push(Message::new("minimize.no_split"), Change::NoSplit { class })?;
                continue;
            }

            let kept = groups[0].1.clone();
            let mut new: Vec<StateId> = groups[1..]
                .iter()
                .flat_map(|(_, members)| members.iter().copied())
                .collect();
            new.sort_unstable();
            let symbol = (0..k)
                .find(|&c| groups[0].0[c] != groups[1].0[c])
                .unwrap_or(0);
            let witness = Witness {
                p: kept[0],
                q: groups[1].1[0],
                symbol: symbol_id(symbol),
            };
            classes[ci] = kept.clone();
            classes.insert(ci + 1, new.clone());
            let message = Message::new("minimize.split")
                .with("p", witness.p.0)
                .with("q", witness.q.0)
                .with(
                    "symbol",
                    fsm.alphabet.name(witness.symbol).unwrap_or_default(),
                );
            let change = Change::Split {
                class,
                kept,
                new,
                witness,
                classes: classes.clone(),
            };
            out.push(message, change)?;
            split = true;
            break;
        }
        if !split {
            break;
        }
    }

    // Step 3: each class becomes a state.
    let class_of = class_map(&classes);
    for (i, members) in classes.iter().enumerate() {
        let message = Message::new("minimize.new_state").with("state", i);
        let change = Change::NewState {
            state: state_id(i),
            members: members.clone(),
        };
        out.push(message, change)?;
    }
    let start_class = state_id(class_of.get(&start).copied().unwrap_or(0));
    out.push(
        Message::new("minimize.start").with("state", start_class.0),
        Change::Start { state: start_class },
    )?;
    let mut transitions = Vec::new();
    for (i, members) in classes.iter().enumerate() {
        let from = state_id(i);
        for c in 0..k {
            let symbol = symbol_id(c);
            let to = members
                .first()
                .and_then(|q| delta.get(&(*q, symbol)))
                .and_then(|to| class_of.get(to))
                .map_or(from, |&j| state_id(j));
            let message = Message::new("minimize.transition")
                .with("from", from.0)
                .with("symbol", fsm.alphabet.name(symbol).unwrap_or_default())
                .with("to", to.0);
            out.push(message, Change::Transition { from, symbol, to })?;
            transitions.push(Transition {
                from,
                on: Some(symbol),
                to,
            });
        }
    }
    let mut accepting = Vec::new();
    for (i, members) in classes.iter().enumerate() {
        if members.first().is_some_and(is_accepting) {
            let state = state_id(i);
            let message = Message::new("minimize.accepting").with("state", state.0);
            out.push(message, Change::Accepting { state })?;
            accepting.push(state);
        }
    }
    Ok(Parts {
        classes,
        start: start_class,
        transitions,
        accepting,
    })
}

/// Minimizes a complete DFSM and records each step. Returns an error message if the machine
/// is not a DFSM, or if validation finds an error (no start state, a missing or duplicate
/// transition, an ε-transition).
pub fn minimize(fsm: &Fsm, budget: MinimizeBudget) -> Result<Minimization, Message> {
    if fsm.kind != FsmKind::Dfsm {
        return Err(Message::new("minimize.not_a_dfsm"));
    }
    let invalid = || Message::new("minimize.invalid_machine");
    if validate(fsm).iter().any(|i| i.severity == Severity::Error) {
        return Err(invalid());
    }
    let start = fsm.start.ok_or_else(invalid)?;
    let mut out = Trace {
        steps: Vec::new(),
        max_steps: budget.max_steps,
    };
    match refine(fsm, start, &mut out) {
        Err(reason) => Ok(Minimization::Stopped {
            reason,
            partial_trace: out.steps,
        }),
        Ok(parts) => {
            let states = (0..parts.classes.len()).map(state_id).collect();
            let dfsm = Fsm::new(
                FsmKind::Dfsm,
                fsm.alphabet.clone(),
                states,
                Some(parts.start),
                parts.accepting,
                parts.transitions,
            )?;
            Ok(Minimization::Finished {
                dfsm,
                classes: parts.classes,
                trace: out.steps,
            })
        }
    }
}
