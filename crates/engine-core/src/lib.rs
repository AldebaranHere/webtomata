//! Pure Rust finite state machine engine. No browser or OS code.

mod fsm;
mod json;
mod message;

pub use fsm::{
    Alphabet, Fsm, FsmKind, MAX_STATES, MAX_SYMBOL_CHARS, MAX_SYMBOLS, MAX_TRANSITIONS, StateId,
    SymbolId, Transition,
};
pub use json::MAX_JSON_BYTES;
pub use message::{Message, Param};

/// Engine version, taken from the crate version.
pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_is_not_empty() {
        assert!(!version().is_empty());
    }
}
