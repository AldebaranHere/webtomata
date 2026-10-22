//! Runs a machine on an input string. Every machine is simulated as a set of active
//! states with ε-closure; a DFSM is the case where the set has one state. Every run has
//! a budget, so a huge input or machine cannot freeze the page.

use crate::fsm::{Fsm, StateId, SymbolId};
use crate::message::Message;
use serde::Serialize;
use std::collections::{BTreeSet, HashMap};

/// Limits for one run.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Budget {
    /// The most input symbols the run may read.
    pub max_steps: usize,
    /// The most state entries the whole trace may hold (the sum of the set sizes).
    pub max_configurations: usize,
}

impl Default for Budget {
    fn default() -> Self {
        Budget {
            max_steps: 100_000,
            max_configurations: 1_000_000,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum StopReason {
    MaxSteps,
    MaxConfigurations,
}

/// One configuration of the run: the states that are active after `position` symbols.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Step {
    /// How many symbols have been read.
    pub position: usize,
    /// The symbol just read; `None` for the first step.
    pub symbol: Option<SymbolId>,
    /// Active states, sorted.
    pub states: Vec<StateId>,
    pub message: Message,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "result", rename_all = "snake_case")]
pub enum Simulation {
    Finished {
        accepted: bool,
        trace: Vec<Step>,
    },
    Stopped {
        reason: StopReason,
        partial_trace: Vec<Step>,
    },
}

type Moves = HashMap<(StateId, Option<SymbolId>), Vec<StateId>>;

/// The states reachable from `seed` through ε-transitions, including `seed`.
fn closure(moves: &Moves, seed: impl IntoIterator<Item = StateId>) -> BTreeSet<StateId> {
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

/// Adds a step unless it would pass the configuration budget.
fn push(
    trace: &mut Vec<Step>,
    used: &mut usize,
    budget: Budget,
    step: Step,
) -> Result<(), StopReason> {
    let total = used.saturating_add(step.states.len());
    if total > budget.max_configurations {
        return Err(StopReason::MaxConfigurations);
    }
    *used = total;
    trace.push(step);
    Ok(())
}

/// Simulates `fsm` on `input`. A DFSM that has no transition for a symbol rejects as soon
/// as the set of active states is empty. Returns an error message if the machine has no
/// start state or the input has a symbol outside the alphabet.
pub fn simulate(fsm: &Fsm, input: &[SymbolId], budget: Budget) -> Result<Simulation, Message> {
    let start = fsm
        .start
        .ok_or_else(|| Message::new("sim.no_start_state"))?;
    if let Some(bad) = input
        .iter()
        .find(|s| usize::from(s.0) >= fsm.alphabet.len())
    {
        return Err(Message::new("sim.unknown_symbol").with("symbol", u32::from(bad.0)));
    }

    let mut moves = Moves::new();
    for t in &fsm.transitions {
        moves.entry((t.from, t.on)).or_default().push(t.to);
    }

    let mut trace = Vec::new();
    let mut used = 0;
    let mut states = closure(&moves, [start]);
    let first = Step {
        position: 0,
        symbol: None,
        states: states.iter().copied().collect(),
        message: Message::new("sim.start"),
    };
    if let Err(reason) = push(&mut trace, &mut used, budget, first) {
        return Ok(Simulation::Stopped {
            reason,
            partial_trace: trace,
        });
    }

    for (i, &symbol) in input.iter().enumerate() {
        if i >= budget.max_steps {
            return Ok(Simulation::Stopped {
                reason: StopReason::MaxSteps,
                partial_trace: trace,
            });
        }
        let reached = states
            .iter()
            .flat_map(|&q| moves.get(&(q, Some(symbol))).into_iter().flatten().copied())
            .collect::<Vec<_>>();
        states = closure(&moves, reached);
        let key = if states.is_empty() {
            "sim.no_states"
        } else {
            "sim.read"
        };
        let step = Step {
            position: i + 1,
            symbol: Some(symbol),
            states: states.iter().copied().collect(),
            message: Message::new(key)
                .with("symbol", fsm.alphabet.name(symbol).unwrap_or_default())
                .with("position", i + 1),
        };
        if let Err(reason) = push(&mut trace, &mut used, budget, step) {
            return Ok(Simulation::Stopped {
                reason,
                partial_trace: trace,
            });
        }
        if states.is_empty() {
            return Ok(Simulation::Finished {
                accepted: false,
                trace,
            });
        }
    }

    let accepted = states
        .iter()
        .any(|s| fsm.accepting.binary_search(s).is_ok());
    Ok(Simulation::Finished { accepted, trace })
}
