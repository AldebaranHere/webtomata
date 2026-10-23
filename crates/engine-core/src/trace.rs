//! The step trace shared by the algorithms. Each step has a message key with parameters
//! and a `Change` that holds the data, so the UI can animate it and translate the message.

use crate::fsm::{StateId, SymbolId, Transition};
use crate::message::Message;
use serde::Serialize;

/// Two states that prove a class can be split: on `symbol` they go to different classes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct Witness {
    pub p: StateId,
    pub q: StateId,
    pub symbol: SymbolId,
}

/// A transition label that is a regular expression, shown as text (fsm_to_regex).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct Label {
    pub from: StateId,
    pub to: StateId,
    pub expression: String,
}

/// What a step changed. In `determinize`, `members` and `closure` hold states of the original
/// machine. In `minimize`, `classes`, `class`, `kept` and `new` hold states of the original
/// machine too. `state` in `NewState`, `Start`, `Accepting` and both `from` and `to` in
/// `Transition` are states of the machine being built.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub enum Change {
    /// determinize: eps(state)
    Closure {
        state: StateId,
        closure: Vec<StateId>,
    },
    /// minimize: a state no input can reach is dropped
    RemoveUnreachable {
        state: StateId,
    },
    /// minimize: the classes at the start of the algorithm
    Classes {
        classes: Vec<Vec<StateId>>,
    },
    /// minimize: this class is checked for a pair of states that behave differently
    Examine {
        class: Vec<StateId>,
    },
    /// minimize: all states of the class behave the same
    NoSplit {
        class: Vec<StateId>,
    },
    /// minimize: `class` becomes `kept` and `new`, shown with the classes that result
    Split {
        class: Vec<StateId>,
        kept: Vec<StateId>,
        new: Vec<StateId>,
        witness: Witness,
        classes: Vec<Vec<StateId>>,
    },
    /// equivalent: the active states of both machines after `position` symbols of the witness
    Product {
        position: usize,
        symbol: Option<SymbolId>,
        candidate: Vec<StateId>,
        reference: Vec<StateId>,
    },
    /// regex_to_fsm: the part of the machine that one step built (`states` and `transitions`
    /// are the new ones; `start` and `accepting` describe the machine for `expression`)
    Fragment {
        expression: String,
        start: StateId,
        accepting: Vec<StateId>,
        states: Vec<StateId>,
        transitions: Vec<Transition>,
    },
    /// fsm_to_regex: every transition label that is not `∅`, after the machine is standardized
    Labels {
        labels: Vec<Label>,
    },
    /// fsm_to_regex: `state` is removed; `updates` are the labels that changed
    Rip {
        state: StateId,
        updates: Vec<Label>,
    },
    /// fsm_to_regex: the regular expression for the whole machine
    Expression {
        expression: String,
    },
    /// union: machine 1 or 2 is copied; `from[i]` becomes `to[i]`
    Copy {
        machine: u8,
        from: Vec<StateId>,
        to: Vec<StateId>,
        start: StateId,
        accepting: Vec<StateId>,
    },
    /// union: a new ε-transition
    Epsilon {
        from: StateId,
        to: StateId,
    },
    /// complement: the state no longer accepts
    NotAccepting {
        state: StateId,
    },
    /// add_trap_state: no transition is missing, so the machine is not changed
    AlreadyComplete,
    /// intersection: a new stage of the De Morgan construction begins
    Stage {
        stage: u8,
    },
    NewState {
        state: StateId,
        members: Vec<StateId>,
    },
    Start {
        state: StateId,
    },
    Transition {
        from: StateId,
        symbol: SymbolId,
        to: StateId,
    },
    Accepting {
        state: StateId,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct ConversionStep {
    pub message: Message,
    pub change: Change,
}
