//! PDA simulation: breadth-first search by levels, stack trace, peak configurations.
//!
//! Semantics follows the course slides (Slide12):
//! - A configuration is `(state, position, stack)` where `position` is symbols read,
//!   and `stack` is top-first (index 0 is the top of the stack).
//! - Acceptance requires: `position == input.len()`, `stack.is_empty()`, and
//!   `state` is an accepting state.
//! - Pop of `[]` applies to any stack (does not mean "empty stack").
//! - Non-determinism explores configurations breadth-first level by level, in a fixed
//!   order (parent order, then sorted transition order). Repeated configurations are dropped.
//! - `peak_configurations` is the maximum number of configurations alive in a single level.

use crate::fsm::{StateId, SymbolId};
use crate::message::Message;
use crate::pda::Pda;
use crate::stop::StopReason;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

/// Limits for a PDA simulation run.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(rename = "PdaBudget"))]
pub struct PdaBudget {
    /// Maximum BFS levels to explore.
    pub max_steps: usize,
    /// Maximum total configurations explored/created.
    pub max_configurations: usize,
    /// Maximum number of stack symbols allowed on any single configuration.
    pub max_stack: usize,
}

impl Default for PdaBudget {
    fn default() -> Self {
        Self {
            max_steps: 10_000,
            max_configurations: 20_000,
            max_stack: 500,
        }
    }
}

/// One step in the single computation trace of a PDA simulation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(rename = "PdaStep"))]
pub struct PdaStep {
    /// How many input symbols have been read.
    pub position: usize,
    /// The input symbol read in this step; `None` for the start step or an ε-transition.
    pub symbol: Option<SymbolId>,
    /// Index into the PDA's sorted transition list; `None` for the initial start configuration.
    pub transition: Option<usize>,
    /// The state reached after this step.
    pub state: StateId,
    /// The stack after this step (top first).
    pub stack: Vec<SymbolId>,
    /// Message explaining the step.
    pub message: Message,
}

/// The result of a PDA simulation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(
    tag = "result",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub enum PdaSimulation {
    Finished {
        accepted: bool,
        trace: Vec<PdaStep>,
        peak_configurations: usize,
        explored: usize,
    },
    Stopped {
        reason: StopReason,
        partial_trace: Vec<PdaStep>,
        peak_configurations: usize,
        explored: usize,
    },
}

#[derive(Clone, PartialEq, Eq, Hash)]
struct Config {
    state: StateId,
    position: usize,
    stack: Vec<SymbolId>,
}

struct Node {
    config: Config,
    parent: Option<usize>,
    transition: Option<usize>,
    symbol: Option<SymbolId>,
    has_unseen_succ: bool,
}

#[derive(Copy, Clone)]
enum TraceStatus {
    Accepted,
    Rejected,
    Stopped,
}

fn score_config(c: &Config, pda: &Pda, input_len: usize) -> u8 {
    let mut score = 0;
    if c.position == input_len {
        score += 1;
    }
    if pda.accepting.binary_search(&c.state).is_ok() {
        score += 1;
    }
    if c.stack.is_empty() {
        score += 1;
    }
    score
}

fn is_better(a_idx: usize, a: &Node, b_idx: usize, b: &Node, pda: &Pda, input_len: usize) -> bool {
    let score_a = score_config(&a.config, pda, input_len);
    let score_b = score_config(&b.config, pda, input_len);
    if score_a != score_b {
        return score_a > score_b;
    }
    if a.config.position != b.config.position {
        return a.config.position > b.config.position;
    }
    // Earlier creation in BFS is preferred
    a_idx < b_idx
}

fn failure_message(c: &Config, pda: &Pda, input_len: usize) -> Message {
    if c.position < input_len {
        Message::new("pda.sim.input_left").with("left", input_len - c.position)
    } else if pda.accepting.binary_search(&c.state).is_err() {
        Message::new("pda.sim.not_accepting_state")
    } else if !c.stack.is_empty() {
        Message::new("pda.sim.stack_not_empty").with("depth", c.stack.len())
    } else {
        Message::new("pda.sim.move")
    }
}

fn trace_from_node(
    nodes: &[Node],
    target_idx: usize,
    pda: &Pda,
    input_len: usize,
    status: TraceStatus,
) -> Vec<PdaStep> {
    let mut path = Vec::new();
    let mut curr = Some(target_idx);
    while let Some(idx) = curr {
        path.push(idx);
        curr = nodes[idx].parent;
    }
    path.reverse();

    let len = path.len();
    let mut trace = Vec::with_capacity(len);
    for (step_idx, &idx) in path.iter().enumerate() {
        let node = &nodes[idx];
        let is_last = step_idx == len - 1;
        let message = if is_last {
            match status {
                TraceStatus::Accepted => Message::new("pda.sim.accepted"),
                TraceStatus::Rejected => failure_message(&node.config, pda, input_len),
                TraceStatus::Stopped => {
                    if step_idx == 0 {
                        Message::new("pda.sim.start")
                    } else {
                        Message::new("pda.sim.move")
                    }
                }
            }
        } else if step_idx == 0 {
            Message::new("pda.sim.start")
        } else {
            Message::new("pda.sim.move")
        };

        trace.push(PdaStep {
            position: node.config.position,
            symbol: node.symbol,
            transition: node.transition,
            state: node.config.state,
            stack: node.config.stack.clone(),
            message,
        });
    }
    trace
}

/// Simulates `pda` on `input` string of symbol IDs breadth-first up to `budget`.
pub fn simulate_pda(
    pda: &Pda,
    input: &[SymbolId],
    budget: PdaBudget,
) -> Result<PdaSimulation, Message> {
    let start_state = pda
        .start
        .ok_or_else(|| Message::new("pda.sim.no_start_state"))?;

    for &s in input {
        if usize::from(s.0) >= pda.input.len() {
            return Err(Message::new("pda.sim.unknown_symbol").with("symbol", u32::from(s.0)));
        }
    }

    let mut nodes: Vec<Node> = Vec::new();
    let mut seen: HashSet<Config> = HashSet::new();

    let start_config = Config {
        state: start_state,
        position: 0,
        stack: Vec::new(),
    };

    nodes.push(Node {
        config: start_config.clone(),
        parent: None,
        transition: None,
        symbol: None,
        has_unseen_succ: false,
    });
    seen.insert(start_config);

    let mut current_level = vec![0];
    let mut explored = 1;
    let mut peak = 1;

    // Check level 0 for acceptance
    if pda.accepting.binary_search(&start_state).is_ok() && input.is_empty() {
        let trace = trace_from_node(&nodes, 0, pda, input.len(), TraceStatus::Accepted);
        return Ok(PdaSimulation::Finished {
            accepted: true,
            trace,
            peak_configurations: peak,
            explored,
        });
    }

    let mut level_num = 0;

    let best_so_far = |nodes: &[Node]| -> usize {
        let mut best = 0;
        for i in 1..nodes.len() {
            if is_better(i, &nodes[i], best, &nodes[best], pda, input.len()) {
                best = i;
            }
        }
        best
    };

    while !current_level.is_empty() {
        if level_num >= budget.max_steps {
            let best_idx = best_so_far(&nodes);
            let partial_trace =
                trace_from_node(&nodes, best_idx, pda, input.len(), TraceStatus::Stopped);
            return Ok(PdaSimulation::Stopped {
                reason: StopReason::MaxSteps,
                partial_trace,
                peak_configurations: peak,
                explored,
            });
        }

        let mut next_level = Vec::new();

        for &node_idx in &current_level {
            for (t_idx, t) in pda.transitions.iter().enumerate() {
                let node_config = &nodes[node_idx].config;
                if t.from != node_config.state {
                    continue;
                }
                let consumes = match t.read {
                    Some(r) => {
                        if node_config.position < input.len() && input[node_config.position] == r {
                            1
                        } else {
                            continue;
                        }
                    }
                    None => 0,
                };
                if !node_config.stack.starts_with(&t.pop) {
                    continue;
                }

                let next_pos = node_config.position + consumes;
                let mut next_stack = t.push.clone();
                next_stack.extend_from_slice(&node_config.stack[t.pop.len()..]);

                if next_stack.len() > budget.max_stack {
                    let best_idx = best_so_far(&nodes);
                    let partial_trace =
                        trace_from_node(&nodes, best_idx, pda, input.len(), TraceStatus::Stopped);
                    return Ok(PdaSimulation::Stopped {
                        reason: StopReason::MaxStack,
                        partial_trace,
                        peak_configurations: peak,
                        explored,
                    });
                }

                let next_config = Config {
                    state: t.to,
                    position: next_pos,
                    stack: next_stack,
                };

                if seen.insert(next_config.clone()) {
                    nodes[node_idx].has_unseen_succ = true;
                    if explored >= budget.max_configurations {
                        let best_idx = best_so_far(&nodes);
                        let partial_trace = trace_from_node(
                            &nodes,
                            best_idx,
                            pda,
                            input.len(),
                            TraceStatus::Stopped,
                        );
                        return Ok(PdaSimulation::Stopped {
                            reason: StopReason::MaxConfigurations,
                            partial_trace,
                            peak_configurations: peak,
                            explored,
                        });
                    }
                    explored += 1;
                    let new_idx = nodes.len();
                    nodes.push(Node {
                        config: next_config,
                        parent: Some(node_idx),
                        transition: Some(t_idx),
                        symbol: t.read,
                        has_unseen_succ: false,
                    });
                    next_level.push(new_idx);
                }
            }
        }

        if next_level.is_empty() {
            // Rejected: find best final configuration
            let mut best_final: Option<usize> = None;
            for (idx, node) in nodes.iter().enumerate() {
                if !node.has_unseen_succ {
                    match best_final {
                        None => best_final = Some(idx),
                        Some(prev_best) => {
                            if is_better(idx, node, prev_best, &nodes[prev_best], pda, input.len())
                            {
                                best_final = Some(idx);
                            }
                        }
                    }
                }
            }
            let best_idx = best_final.unwrap_or(0);
            let trace = trace_from_node(&nodes, best_idx, pda, input.len(), TraceStatus::Rejected);
            return Ok(PdaSimulation::Finished {
                accepted: false,
                trace,
                peak_configurations: peak,
                explored,
            });
        }

        peak = peak.max(next_level.len());

        // Check if next_level contains an accepting configuration
        for &idx in &next_level {
            let c = &nodes[idx].config;
            if pda.accepting.binary_search(&c.state).is_ok()
                && c.position == input.len()
                && c.stack.is_empty()
            {
                let trace = trace_from_node(&nodes, idx, pda, input.len(), TraceStatus::Accepted);
                return Ok(PdaSimulation::Finished {
                    accepted: true,
                    trace,
                    peak_configurations: peak,
                    explored,
                });
            }
        }

        current_level = next_level;
        level_num += 1;
    }

    unreachable!()
}
