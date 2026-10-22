//! Structural checks on a machine. Returns every problem found as a message key
//! with parameters, in a fixed order, and never panics.

use crate::fsm::{Fsm, FsmKind, StateId, SymbolId};
use crate::message::Message;
use serde::Serialize;
use std::collections::{HashMap, HashSet, VecDeque};

/// The list stops here so a huge empty DFSM cannot produce hundreds of thousands of messages.
pub const MAX_ISSUES: usize = 1_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Error,
    Warning,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Issue {
    pub severity: Severity,
    pub message: Message,
}

/// Collects issues up to [`MAX_ISSUES`], then adds one marker and ignores the rest.
struct Issues {
    list: Vec<Issue>,
    truncated: bool,
}

impl Issues {
    fn is_full(&self) -> bool {
        self.truncated
    }

    fn push(&mut self, severity: Severity, message: Message) {
        if self.list.len() >= MAX_ISSUES {
            self.truncated = true;
        } else {
            self.list.push(Issue { severity, message });
        }
    }

    fn finish(mut self) -> Vec<Issue> {
        if self.truncated {
            let message = Message::new("fsm.too_many_issues").with("limit", MAX_ISSUES);
            self.list.push(Issue {
                severity: Severity::Warning,
                message,
            });
        }
        self.list
    }
}

/// Order: no start state; per DFSM state and symbol, duplicate or missing transitions;
/// DFSM ε-transitions; unreachable states.
pub fn validate(fsm: &Fsm) -> Vec<Issue> {
    let mut issues = Issues {
        list: Vec::new(),
        truncated: false,
    };
    if fsm.start.is_none() {
        issues.push(Severity::Error, Message::new("fsm.no_start_state"));
    }
    if fsm.kind == FsmKind::Dfsm {
        check_dfsm(fsm, &mut issues);
    }
    if let Some(start) = fsm.start {
        check_reachable(fsm, start, &mut issues);
    }
    issues.finish()
}

fn check_dfsm(fsm: &Fsm, issues: &mut Issues) {
    let mut counts: HashMap<(StateId, SymbolId), usize> = HashMap::new();
    for t in &fsm.transitions {
        if let Some(symbol) = t.on {
            *counts.entry((t.from, symbol)).or_default() += 1;
        }
    }
    'states: for &state in &fsm.states {
        for (i, name) in fsm.alphabet.names().iter().enumerate() {
            if issues.is_full() {
                break 'states;
            }
            let Ok(i) = u16::try_from(i) else { continue };
            let key = match counts.get(&(state, SymbolId(i))).copied().unwrap_or(0) {
                0 => "dfsm.missing_transition",
                1 => continue,
                _ => "dfsm.duplicate_transition",
            };
            let message = Message::new(key)
                .with("state", state.0)
                .with("symbol", name.as_str());
            issues.push(Severity::Error, message);
        }
    }
    for t in fsm.transitions.iter().filter(|t| t.on.is_none()) {
        let message = Message::new("dfsm.epsilon_transition")
            .with("from", t.from.0)
            .with("to", t.to.0);
        issues.push(Severity::Error, message);
    }
}

fn check_reachable(fsm: &Fsm, start: StateId, issues: &mut Issues) {
    let mut next: HashMap<StateId, Vec<StateId>> = HashMap::new();
    for t in &fsm.transitions {
        next.entry(t.from).or_default().push(t.to);
    }
    let mut reached = HashSet::from([start]);
    let mut queue = VecDeque::from([start]);
    while let Some(state) = queue.pop_front() {
        for &to in next.get(&state).into_iter().flatten() {
            if reached.insert(to) {
                queue.push_back(to);
            }
        }
    }
    for &state in fsm.states.iter().filter(|s| !reached.contains(s)) {
        let message = Message::new("fsm.unreachable_state").with("state", state.0);
        issues.push(Severity::Warning, message);
    }
}
