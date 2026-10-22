//! Regular expression → NDFSM by Rich's `regextofsm` (section 6.2.1 of the textbook and the
//! course slides). The expression is built from the primitive parts outwards, one step for each
//! part:
//! - `∅`: one start state that does not accept. `ε`: one start state that accepts.
//! - A symbol `c`: two states with one transition on `c`; the second state accepts.
//! - Union: a new start state with ε-transitions to both start states; accepts where either does.
//! - Concatenation: ε-transitions from every accepting state of the first machine to the start
//!   state of the second; accepts where the second does.
//! - Star: a new start state that accepts, with an ε-transition to the old start state, and
//!   ε-transitions from every old accepting state back to the old start state.
//! - Plus (`α+` = `αα*`): ε-transitions from every accepting state back to the start state.
//!   This accepts one or more strings of the language without copying the machine.

use crate::fsm::{Alphabet, Fsm, FsmKind, MAX_STATES, StateId, SymbolId, Transition};
use crate::message::Message;
use crate::regex::Regex;
use crate::stop::StopReason;
use crate::trace::{Change, ConversionStep};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RegexBudget {
    /// The most states the machine may have (at most [`MAX_STATES`]).
    pub max_states: usize,
}

impl Default for RegexBudget {
    fn default() -> Self {
        RegexBudget {
            max_states: MAX_STATES,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Compiled {
    Finished {
        fsm: Fsm,
        trace: Vec<ConversionStep>,
    },
    Stopped {
        reason: StopReason,
        partial_trace: Vec<ConversionStep>,
    },
}

/// The machine built so far for one sub-expression.
struct Part {
    start: StateId,
    accepting: Vec<StateId>,
}

struct Builder<'a> {
    alphabet: &'a Alphabet,
    max_states: usize,
    states: Vec<StateId>,
    transitions: Vec<Transition>,
    trace: Vec<ConversionStep>,
}

impl Builder<'_> {
    fn new_state(&mut self) -> Result<StateId, StopReason> {
        if self.states.len() >= self.max_states {
            return Err(StopReason::MaxStates);
        }
        let id = StateId(self.states.len() as u32);
        self.states.push(id);
        Ok(id)
    }

    fn edge(&mut self, from: StateId, on: Option<SymbolId>, to: StateId) {
        self.transitions.push(Transition { from, on, to });
    }

    fn build(&mut self, r: &Regex) -> Result<Part, StopReason> {
        // `marks` is where this step starts adding states and transitions: after its children.
        let (key, part, marks) = match r {
            Regex::Empty => {
                let marks = self.marks();
                let s = self.new_state()?;
                (
                    "regex.empty_set",
                    Part {
                        start: s,
                        accepting: vec![],
                    },
                    marks,
                )
            }
            Regex::Epsilon => {
                let marks = self.marks();
                let s = self.new_state()?;
                (
                    "regex.epsilon",
                    Part {
                        start: s,
                        accepting: vec![s],
                    },
                    marks,
                )
            }
            Regex::Symbol(c) => {
                let marks = self.marks();
                let (s, f) = (self.new_state()?, self.new_state()?);
                self.edge(s, Some(*c), f);
                (
                    "regex.symbol",
                    Part {
                        start: s,
                        accepting: vec![f],
                    },
                    marks,
                )
            }
            Regex::Union(a, b) => {
                let (pa, pb) = (self.build(a)?, self.build(b)?);
                let marks = self.marks();
                let s = self.new_state()?;
                self.edge(s, None, pa.start);
                self.edge(s, None, pb.start);
                let accepting = [pa.accepting, pb.accepting].concat();
                (
                    "regex.union",
                    Part {
                        start: s,
                        accepting,
                    },
                    marks,
                )
            }
            Regex::Concat(a, b) => {
                let (pa, pb) = (self.build(a)?, self.build(b)?);
                let marks = self.marks();
                for &q in &pa.accepting {
                    self.edge(q, None, pb.start);
                }
                (
                    "regex.concat",
                    Part {
                        start: pa.start,
                        accepting: pb.accepting,
                    },
                    marks,
                )
            }
            Regex::Star(a) => {
                let pa = self.build(a)?;
                let marks = self.marks();
                let s = self.new_state()?;
                self.edge(s, None, pa.start);
                for &q in &pa.accepting {
                    self.edge(q, None, pa.start);
                }
                let accepting = [vec![s], pa.accepting].concat();
                (
                    "regex.star",
                    Part {
                        start: s,
                        accepting,
                    },
                    marks,
                )
            }
            Regex::Plus(a) => {
                let pa = self.build(a)?;
                let marks = self.marks();
                for &q in &pa.accepting {
                    self.edge(q, None, pa.start);
                }
                ("regex.plus", pa, marks)
            }
        };

        let expression = r.to_text(self.alphabet);
        let mut message = Message::new(key).with("expression", expression.as_str());
        if let Regex::Symbol(c) = r {
            message = message.with("symbol", self.alphabet.name(*c).unwrap_or_default());
        }
        let mut accepting = part.accepting.clone();
        accepting.sort_unstable();
        self.trace.push(ConversionStep {
            message,
            change: Change::Fragment {
                expression,
                start: part.start,
                accepting,
                states: self.states[marks.0..].to_vec(),
                transitions: self.transitions[marks.1..].to_vec(),
            },
        });
        Ok(part)
    }

    fn marks(&self) -> (usize, usize) {
        (self.states.len(), self.transitions.len())
    }
}

/// Builds an NDFSM for `regex` and records each step. Returns an error message if a symbol of
/// the expression is not in the alphabet.
pub fn regex_to_fsm(
    regex: &Regex,
    alphabet: &Alphabet,
    budget: RegexBudget,
) -> Result<Compiled, Message> {
    let mut builder = Builder {
        alphabet,
        max_states: budget.max_states.min(MAX_STATES),
        states: Vec::new(),
        transitions: Vec::new(),
        trace: Vec::new(),
    };
    match builder.build(regex) {
        Err(reason) => Ok(Compiled::Stopped {
            reason,
            partial_trace: builder.trace,
        }),
        Ok(part) => {
            let fsm = Fsm::new(
                FsmKind::Ndfsm,
                alphabet.clone(),
                builder.states,
                Some(part.start),
                part.accepting,
                builder.transitions,
            )?;
            Ok(Compiled::Finished {
                fsm,
                trace: builder.trace,
            })
        }
    }
}
