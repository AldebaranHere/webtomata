//! Pure Rust finite state machine engine. No browser or OS code.

pub mod api;
mod closure;
mod determinize;
mod equivalence;
mod fsm;
mod fsm_regex;
mod jff;
mod json;
mod message;
mod minimize;
mod nondeterminism;
mod operations;
mod regex;
mod regex_fsm;
mod regex_simplify;
mod simulate;
mod stop;
mod trace;
#[cfg(feature = "ts")]
mod ts;
mod validate;
mod xor;

pub use determinize::{Conversion, ConversionBudget, determinize};
pub use equivalence::{Counterexample, Equivalence, EquivalenceBudget, equivalent};
pub use fsm::{
    Alphabet, Fsm, FsmKind, MAX_STATES, MAX_SYMBOL_CHARS, MAX_SYMBOLS, MAX_TRANSITIONS, StateId,
    SymbolId, Transition,
};
pub use fsm_regex::{Extraction, FsmToRegexBudget, fsm_to_regex};
pub use jff::{Jff, JffState, MAX_JFF_BYTES, parse_jff, to_jff};
pub use json::MAX_JSON_BYTES;
pub use message::{Message, Param};
pub use minimize::{Minimization, MinimizeBudget, minimize};
pub use nondeterminism::{Nondeterminism, nondeterministic_states};
pub use operations::{Intersection, Operation, add_trap_state, complement, intersection, union};
pub use regex::{MAX_REGEX_CHARS, MAX_REGEX_DEPTH, Regex, parse_regex};
pub use regex_fsm::{Compiled, RegexBudget, regex_to_fsm};
pub use regex_simplify::{Simplification, SimplifyBudget, simplify};
pub use simulate::{Budget, Simulation, Step, simulate};
pub use stop::StopReason;
pub use trace::{Change, ConversionStep, Label, Witness};
#[cfg(feature = "ts")]
pub use ts::declarations as typescript_declarations;
pub use validate::{Issue, MAX_ISSUES, Severity, validate};
pub use xor::{Xor, xor};

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
