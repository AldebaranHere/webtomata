//! Pure Rust finite state machine engine. No browser or OS code.

pub mod api;
pub mod cfg_pda;
mod closure;
mod determinize;
mod equivalence;
mod fsm;
mod fsm_regex;
pub mod grammar;
mod jff;
mod json;
pub mod language;
mod message;
mod minimize;
mod nondeterminism;
mod operations;
pub mod pda;
pub mod pda_simulate;
mod regex;
mod regex_fsm;
mod regex_machine;
mod regex_simplify;
mod simulate;
mod stop;
mod trace;
#[cfg(feature = "ts")]
mod ts;
mod validate;
mod xor;

pub use api::{export_jff, export_pda_jff, import_jff, import_pda_jff};
pub use cfg_pda::{CfgPdaStep, CfgToPda, StateName, cfg_to_pda_bottomup, cfg_to_pda_topdown};
pub use determinize::{Conversion, ConversionBudget, determinize};
pub use equivalence::{Counterexample, Equivalence, EquivalenceBudget, equivalent};
pub use fsm::{
    Alphabet, Fsm, FsmKind, MAX_STATES, MAX_SYMBOL_CHARS, MAX_SYMBOLS, MAX_TRANSITIONS, StateId,
    SymbolId, Transition,
};
pub use fsm_regex::{Extraction, FsmToRegexBudget, fsm_to_regex};
pub use jff::{Jff, JffState, MAX_JFF_BYTES, PdaJff, parse_jff, parse_pda_jff, to_jff, to_pda_jff};
pub use json::MAX_JSON_BYTES;
pub use message::{Message, Param};
pub use minimize::{Minimization, MinimizeBudget, minimize};
pub use nondeterminism::{Nondeterminism, nondeterministic_states};
pub use operations::{Intersection, Operation, add_trap_state, complement, intersection, union};
pub use pda::{
    Competition, MAX_PDA_STRING, Pda, PdaKind, PdaTransition, determinism, validate_pda,
};
pub use pda_simulate::{PdaBudget, PdaSimulation, PdaStep, simulate_pda};
pub use regex::{MAX_REGEX_CHARS, MAX_REGEX_DEPTH, Regex, parse_regex};
pub use regex_fsm::{Compiled, RegexBudget, regex_to_fsm};
pub use regex_machine::{ViaMachineBudget, simplify_via_machine};
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
