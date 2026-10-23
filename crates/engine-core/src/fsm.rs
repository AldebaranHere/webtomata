//! A finite state machine as plain data. Names and canvas positions belong to the
//! UI document, not here. A machine may be invalid in ways the model can express
//! (no start state, missing or duplicate transitions, ε in a DFSM); validation
//! reports those separately.

use crate::message::Message;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

pub const MAX_STATES: usize = 2_000;
pub const MAX_SYMBOLS: usize = 256;
pub const MAX_TRANSITIONS: usize = 100_000;
pub const MAX_SYMBOL_CHARS: usize = 32;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct StateId(pub u32);

/// A symbol interned as its position in the [`Alphabet`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct SymbolId(pub u16);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub enum FsmKind {
    Dfsm,
    Ndfsm,
}

pub(crate) fn limit_exceeded(what: &str, limit: usize) -> Message {
    Message::new("machine.limit_exceeded")
        .with("what", what)
        .with("limit", limit)
}

/// Unique symbols, each interned as its position. A symbol can have several
/// characters (for example `num`).
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Alphabet {
    symbols: Vec<String>,
}

impl Alphabet {
    pub fn new(symbols: Vec<String>) -> Result<Self, Message> {
        if symbols.len() > MAX_SYMBOLS {
            return Err(limit_exceeded("symbols", MAX_SYMBOLS));
        }
        let mut seen = HashSet::new();
        for s in &symbols {
            if s.chars().count() > MAX_SYMBOL_CHARS {
                return Err(limit_exceeded("symbol_length", MAX_SYMBOL_CHARS));
            }
            // ε is written as `null` in JSON, so it cannot also be a symbol name.
            if s.is_empty() || s == "ε" || s.chars().any(|c| c.is_whitespace() || c.is_control()) {
                return Err(Message::new("machine.invalid_symbol").with("symbol", s.as_str()));
            }
            if !seen.insert(s.as_str()) {
                return Err(Message::new("machine.duplicate_symbol").with("symbol", s.as_str()));
            }
        }
        Ok(Alphabet { symbols })
    }

    pub fn len(&self) -> usize {
        self.symbols.len()
    }

    pub fn is_empty(&self) -> bool {
        self.symbols.is_empty()
    }

    pub fn names(&self) -> &[String] {
        &self.symbols
    }

    pub fn name(&self, id: SymbolId) -> Option<&str> {
        self.symbols.get(usize::from(id.0)).map(String::as_str)
    }

    pub fn id(&self, name: &str) -> Option<SymbolId> {
        let i = self.symbols.iter().position(|s| s == name)?;
        u16::try_from(i).ok().map(SymbolId)
    }

    /// For each symbol of this alphabet, the symbol of `other` with the same name. Returns the
    /// message `key` (with `symbol` and `side`, the side that lacks the symbol) if the two
    /// alphabets do not have the same symbol names.
    pub(crate) fn match_by_name(
        &self,
        other: &Alphabet,
        key: &'static str,
        sides: (&str, &str),
    ) -> Result<Vec<SymbolId>, Message> {
        let mismatch =
            |symbol: &str, side: &str| Message::new(key).with("symbol", symbol).with("side", side);
        let mut map = Vec::with_capacity(self.len());
        for name in &self.symbols {
            match other.id(name) {
                Some(id) => map.push(id),
                None => return Err(mismatch(name, sides.1)),
            }
        }
        if let Some(name) = other.symbols.iter().find(|n| self.id(n).is_none()) {
            return Err(mismatch(name, sides.0));
        }
        Ok(map)
    }

    /// Turns text into symbols. If every symbol has one character, it reads one
    /// character at a time; otherwise symbols are separated by whitespace (for example
    /// `num plus num`). `position` in the error counts characters or symbols read so far.
    pub fn tokenize(&self, text: &str) -> Result<Vec<SymbolId>, Message> {
        let lookup = |name: &str, position: usize| {
            self.id(name).ok_or_else(|| {
                Message::new("input.unknown_symbol")
                    .with("symbol", name)
                    .with("position", position)
            })
        };
        if self.symbols.iter().all(|s| s.chars().count() == 1) {
            let mut buf = [0u8; 4];
            text.chars()
                .enumerate()
                .map(|(i, c)| lookup(c.encode_utf8(&mut buf), i))
                .collect()
        } else {
            text.split_whitespace()
                .enumerate()
                .map(|(i, token)| lookup(token, i))
                .collect()
        }
    }
}

/// `on: None` is an ε-transition.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct Transition {
    pub from: StateId,
    pub on: Option<SymbolId>,
    pub to: StateId,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Fsm {
    pub kind: FsmKind,
    pub alphabet: Alphabet,
    /// Sorted, unique. Ids may be sparse so deleting a state never renumbers the others.
    pub states: Vec<StateId>,
    pub start: Option<StateId>,
    /// Sorted, unique, a subset of `states`.
    pub accepting: Vec<StateId>,
    /// Sorted by (from, symbol, to); ε sorts first.
    pub transitions: Vec<Transition>,
}

impl Fsm {
    /// Checks that every reference resolves and the size limits hold, then sorts
    /// everything so equal machines are equal values.
    pub fn new(
        kind: FsmKind,
        alphabet: Alphabet,
        mut states: Vec<StateId>,
        start: Option<StateId>,
        mut accepting: Vec<StateId>,
        mut transitions: Vec<Transition>,
    ) -> Result<Fsm, Message> {
        if states.len() > MAX_STATES {
            return Err(limit_exceeded("states", MAX_STATES));
        }
        if transitions.len() > MAX_TRANSITIONS {
            return Err(limit_exceeded("transitions", MAX_TRANSITIONS));
        }
        states.sort_unstable();
        accepting.sort_unstable();
        check_unique(&states)?;
        check_unique(&accepting)?;

        let known = |s: StateId| states.binary_search(&s).is_ok();
        let unknown_state = |s: StateId| Message::new("machine.unknown_state").with("state", s.0);
        if let Some(s) = start.filter(|&s| !known(s)) {
            return Err(unknown_state(s));
        }
        if let Some(&s) = accepting.iter().find(|&&s| !known(s)) {
            return Err(unknown_state(s));
        }
        for t in &transitions {
            if let Some(&s) = [t.from, t.to].iter().find(|&&s| !known(s)) {
                return Err(unknown_state(s));
            }
            if let Some(sym) = t.on.filter(|sym| usize::from(sym.0) >= alphabet.len()) {
                return Err(Message::new("machine.unknown_symbol").with("symbol", u32::from(sym.0)));
            }
        }
        transitions.sort_unstable();
        Ok(Fsm {
            kind,
            alphabet,
            states,
            start,
            accepting,
            transitions,
        })
    }
}

fn check_unique(sorted: &[StateId]) -> Result<(), Message> {
    match sorted.windows(2).find(|w| w[0] == w[1]) {
        Some(w) => Err(Message::new("machine.duplicate_state").with("state", w[0].0)),
        None => Ok(()),
    }
}
