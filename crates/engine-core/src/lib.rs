//! Pure Rust finite state machine engine. No browser or OS code.

mod closure;
mod determinize;
mod equivalence;
mod fsm;
mod json;
mod message;
mod minimize;
mod regex;
mod regex_fsm;
mod simulate;
mod stop;
mod trace;
mod validate;

pub use determinize::{Conversion, ConversionBudget, determinize};
pub use equivalence::{Counterexample, Equivalence, EquivalenceBudget, equivalent};
pub use fsm::{
    Alphabet, Fsm, FsmKind, MAX_STATES, MAX_SYMBOL_CHARS, MAX_SYMBOLS, MAX_TRANSITIONS, StateId,
    SymbolId, Transition,
};
pub use json::MAX_JSON_BYTES;
pub use message::{Message, Param};
pub use minimize::{Minimization, MinimizeBudget, minimize};
pub use regex::{MAX_REGEX_CHARS, MAX_REGEX_DEPTH, Regex, parse_regex};
pub use regex_fsm::{Compiled, RegexBudget, regex_to_fsm};
pub use simulate::{Budget, Simulation, Step, simulate};
pub use stop::StopReason;
pub use trace::{Change, ConversionStep, Witness};
pub use validate::{Issue, MAX_ISSUES, Severity, validate};

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
