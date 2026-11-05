//! Pushdown automaton (PDA) data model, canonical JSON, validation, and determinism.
//!
//! Notation follows the course slides (Slide12, Slide13) and Elaine Rich:
//! - Transitions are `((q1, c, γ1), (q2, γ2))`: read `c` (or ε), pop `γ1`, push `γ2`.
//! - Stack starts empty (no default bottom marker).
//! - Top of the stack is the leftmost element (index 0).
//! - Competing transitions define non-determinism; a DPDA has no competing pairs.

use crate::fsm::{Alphabet, MAX_STATES, MAX_TRANSITIONS, StateId, SymbolId, limit_exceeded};
use crate::json::MAX_JSON_BYTES;
use crate::message::Message;
use crate::validate::{Issue, MAX_ISSUES, Severity};
use serde::{Deserialize, Serialize};
use std::collections::{HashSet, VecDeque};

pub const MAX_PDA_STRING: usize = 64;
const SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub enum PdaKind {
    Dpda,
    Ndpda,
}

/// A transition between states.
/// `read: None` means an ε-transition (reads nothing).
/// `pop` and `push` are lists of stack symbols, leftmost is top.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize)]
pub struct PdaTransition {
    pub from: StateId,
    pub read: Option<SymbolId>,
    pub pop: Vec<SymbolId>,
    pub push: Vec<SymbolId>,
    pub to: StateId,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct Competition {
    pub from: StateId,
    pub first: usize,
    pub second: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Pda {
    pub kind: PdaKind,
    pub input: Alphabet,
    pub stack: Alphabet,
    pub states: Vec<StateId>,
    pub start: Option<StateId>,
    pub accepting: Vec<StateId>,
    pub transitions: Vec<PdaTransition>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(rename = "Pda"))]
pub struct PdaWire {
    pub schema_version: u32,
    pub kind: PdaKind,
    pub input_alphabet: Vec<String>,
    pub stack_alphabet: Vec<String>,
    pub states: Vec<u32>,
    #[serde(deserialize_with = "Option::deserialize")]
    pub start: Option<u32>,
    pub accepting: Vec<u32>,
    pub transitions: Vec<PdaWireTransition>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(rename = "PdaTransition"))]
pub struct PdaWireTransition {
    pub from: u32,
    #[serde(deserialize_with = "Option::deserialize")]
    pub read: Option<String>,
    pub pop: Vec<String>,
    pub push: Vec<String>,
    pub to: u32,
}

fn parse_error(e: serde_json::Error) -> Message {
    let key = if e.is_data() {
        "machine.invalid_structure"
    } else {
        "machine.json_invalid"
    };
    Message::new(key)
        .with("line", e.line())
        .with("column", e.column())
}

fn check_unique_states(sorted: &[StateId]) -> Result<(), Message> {
    match sorted.windows(2).find(|w| w[0] == w[1]) {
        Some(w) => Err(Message::new("machine.duplicate_state").with("state", w[0].0)),
        None => Ok(()),
    }
}

impl Pda {
    pub fn new(
        kind: PdaKind,
        input: Alphabet,
        stack: Alphabet,
        mut states: Vec<StateId>,
        start: Option<StateId>,
        mut accepting: Vec<StateId>,
        mut transitions: Vec<PdaTransition>,
    ) -> Result<Self, Message> {
        if states.len() > MAX_STATES {
            return Err(limit_exceeded("states", MAX_STATES));
        }
        if transitions.len() > MAX_TRANSITIONS {
            return Err(limit_exceeded("transitions", MAX_TRANSITIONS));
        }

        states.sort_unstable();
        accepting.sort_unstable();
        check_unique_states(&states)?;
        check_unique_states(&accepting)?;

        let known = |s: StateId| states.binary_search(&s).is_ok();
        let unknown_state = |s: StateId| Message::new("machine.unknown_state").with("state", s.0);

        if let Some(s) = start.filter(|&s| !known(s)) {
            return Err(unknown_state(s));
        }
        for &s in &accepting {
            if !known(s) {
                return Err(unknown_state(s));
            }
        }

        for t in &transitions {
            if !known(t.from) {
                return Err(unknown_state(t.from));
            }
            if !known(t.to) {
                return Err(unknown_state(t.to));
            }
            if let Some(sym) = t.read.filter(|sym| usize::from(sym.0) >= input.len()) {
                return Err(Message::new("machine.unknown_symbol").with("symbol", u32::from(sym.0)));
            }
            if t.pop.len() > MAX_PDA_STRING {
                return Err(limit_exceeded("pda_string", MAX_PDA_STRING));
            }
            for &sym in &t.pop {
                if usize::from(sym.0) >= stack.len() {
                    return Err(
                        Message::new("machine.unknown_symbol").with("symbol", u32::from(sym.0))
                    );
                }
            }
            if t.push.len() > MAX_PDA_STRING {
                return Err(limit_exceeded("pda_string", MAX_PDA_STRING));
            }
            for &sym in &t.push {
                if usize::from(sym.0) >= stack.len() {
                    return Err(
                        Message::new("machine.unknown_symbol").with("symbol", u32::from(sym.0))
                    );
                }
            }
        }

        transitions.sort_unstable();

        Ok(Pda {
            kind,
            input,
            stack,
            states,
            start,
            accepting,
            transitions,
        })
    }

    pub fn from_json(input_text: &str) -> Result<Self, Message> {
        if input_text.len() > MAX_JSON_BYTES {
            return Err(limit_exceeded("bytes", MAX_JSON_BYTES));
        }

        let value: serde_json::Value = serde_json::from_str(input_text).map_err(parse_error)?;
        match value
            .get("schemaVersion")
            .and_then(serde_json::Value::as_i64)
        {
            Some(1) => {}
            Some(found) => {
                return Err(Message::new("machine.unsupported_schema_version").with("found", found));
            }
            None => return Err(Message::new("machine.invalid_structure")),
        }

        let wire: PdaWire = serde_json::from_str(input_text).map_err(parse_error)?;

        let input = Alphabet::new(wire.input_alphabet)?;
        let stack = Alphabet::new(wire.stack_alphabet)?;

        let transitions = wire
            .transitions
            .into_iter()
            .map(|t| {
                let read = match t.read {
                    None => None,
                    Some(ref name) => match input.id(name) {
                        Some(id) => Some(id),
                        None => {
                            return Err(Message::new("machine.unknown_symbol")
                                .with("symbol", name.as_str()));
                        }
                    },
                };

                let mut pop = Vec::with_capacity(t.pop.len());
                for name in &t.pop {
                    match stack.id(name) {
                        Some(id) => pop.push(id),
                        None => {
                            return Err(Message::new("machine.unknown_symbol")
                                .with("symbol", name.as_str()));
                        }
                    }
                }

                let mut push = Vec::with_capacity(t.push.len());
                for name in &t.push {
                    match stack.id(name) {
                        Some(id) => push.push(id),
                        None => {
                            return Err(Message::new("machine.unknown_symbol")
                                .with("symbol", name.as_str()));
                        }
                    }
                }

                Ok(PdaTransition {
                    from: StateId(t.from),
                    read,
                    pop,
                    push,
                    to: StateId(t.to),
                })
            })
            .collect::<Result<Vec<_>, Message>>()?;

        Pda::new(
            wire.kind,
            input,
            stack,
            wire.states.into_iter().map(StateId).collect(),
            wire.start.map(StateId),
            wire.accepting.into_iter().map(StateId).collect(),
            transitions,
        )
    }

    pub fn to_wire(&self) -> PdaWire {
        PdaWire {
            schema_version: SCHEMA_VERSION,
            kind: self.kind,
            input_alphabet: self.input.names().to_vec(),
            stack_alphabet: self.stack.names().to_vec(),
            states: self.states.iter().map(|s| s.0).collect(),
            start: self.start.map(|s| s.0),
            accepting: self.accepting.iter().map(|s| s.0).collect(),
            transitions: self
                .transitions
                .iter()
                .map(|t| PdaWireTransition {
                    from: t.from.0,
                    read: t
                        .read
                        .and_then(|sym| self.input.name(sym))
                        .map(str::to_owned),
                    pop: t
                        .pop
                        .iter()
                        .map(|&sym| self.stack.name(sym).unwrap_or_default().to_owned())
                        .collect(),
                    push: t
                        .push
                        .iter()
                        .map(|&sym| self.stack.name(sym).unwrap_or_default().to_owned())
                        .collect(),
                    to: t.to.0,
                })
                .collect(),
        }
    }

    pub fn to_json(&self) -> String {
        serde_json::to_string(&self.to_wire()).expect("plain data always serializes")
    }
}

impl Serialize for Pda {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        self.to_wire().serialize(serializer)
    }
}

fn is_prefix(a: &[SymbolId], b: &[SymbolId]) -> bool {
    a.len() <= b.len() && &b[..a.len()] == a
}

/// Identifies all pairs of competing transitions.
/// Two distinct transitions of the same state compete iff:
/// 1. (their read symbols are equal, or at least one is ε), and
/// 2. (one pop list is a prefix of the other, with [] prefix of all).
pub fn determinism(pda: &Pda) -> Vec<Competition> {
    let mut competitions = Vec::new();
    let n = pda.transitions.len();

    for i in 0..n {
        let t1 = &pda.transitions[i];
        for j in (i + 1)..n {
            let t2 = &pda.transitions[j];
            if t1.from != t2.from {
                break;
            }

            let read_competes = t1.read == t2.read || t1.read.is_none() || t2.read.is_none();
            if !read_competes {
                continue;
            }

            let pop_competes = is_prefix(&t1.pop, &t2.pop) || is_prefix(&t2.pop, &t1.pop);
            if pop_competes {
                competitions.push(Competition {
                    from: t1.from,
                    first: i,
                    second: j,
                });
            }
        }
    }

    competitions
}

struct Issues {
    list: Vec<Issue>,
    truncated: bool,
}

impl Issues {
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

/// Validates a PDA and returns all detected issues in fixed order.
pub fn validate_pda(pda: &Pda) -> Vec<Issue> {
    let mut issues = Issues {
        list: Vec::new(),
        truncated: false,
    };

    // 1. Error: no start state
    if pda.start.is_none() {
        issues.push(Severity::Error, Message::new("pda.no_start_state"));
    }

    // 2. Warning: no accepting state
    if pda.accepting.is_empty() {
        issues.push(Severity::Warning, Message::new("pda.no_accepting_state"));
    }

    // 3. Warning: unreachable states (by transition graph alone, ignoring stack)
    if let Some(start) = pda.start {
        let mut visited = HashSet::new();
        let mut queue = VecDeque::new();
        visited.insert(start);
        queue.push_back(start);

        while let Some(current) = queue.pop_front() {
            for t in &pda.transitions {
                if t.from == current && visited.insert(t.to) {
                    queue.push_back(t.to);
                }
            }
        }

        for &s in &pda.states {
            if !visited.contains(&s) {
                issues.push(
                    Severity::Warning,
                    Message::new("pda.unreachable_state").with("state", s.0),
                );
            }
        }
    }

    // 4. Warning: duplicate transitions
    for w in pda.transitions.windows(2) {
        if w[0] == w[1] {
            issues.push(
                Severity::Warning,
                Message::new("pda.duplicate_transition").with("from", w[0].from.0),
            );
        }
    }

    // 5. Warning: pop_never_pushed { from, symbol }
    // A stack symbol can only ever be on the stack if it is reachable from the empty stack.
    let mut pushed = HashSet::new();
    let mut changed = true;
    while changed {
        changed = false;
        for t in &pda.transitions {
            if t.pop.iter().all(|sym| pushed.contains(sym)) {
                for &sym in &t.push {
                    if pushed.insert(sym) {
                        changed = true;
                    }
                }
            }
        }
    }

    let mut reported_pop_never_pushed = HashSet::new();
    for t in &pda.transitions {
        for &sym in &t.pop {
            if !pushed.contains(&sym) && reported_pop_never_pushed.insert((t.from, sym)) {
                let name = pda.stack.name(sym).unwrap_or_default();
                issues.push(
                    Severity::Warning,
                    Message::new("pda.pop_never_pushed")
                        .with("from", t.from.0)
                        .with("symbol", name),
                );
            }
        }
    }

    // 6. DPDA-only checks: competing_transitions and accepting_state_free_move
    if pda.kind == PdaKind::Dpda {
        for comp in determinism(pda) {
            issues.push(
                Severity::Error,
                Message::new("pda.competing_transitions")
                    .with("from", comp.from.0)
                    .with("first", comp.first as i64)
                    .with("second", comp.second as i64),
            );
        }

        let mut reported_free_moves = HashSet::new();
        for t in &pda.transitions {
            if pda.accepting.binary_search(&t.from).is_ok()
                && t.read.is_none()
                && t.pop.is_empty()
                && reported_free_moves.insert(t.from)
            {
                issues.push(
                    Severity::Error,
                    Message::new("pda.accepting_state_free_move").with("state", t.from.0),
                );
            }
        }
    }

    issues.finish()
}
