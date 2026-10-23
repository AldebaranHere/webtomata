//! The TypeScript types of the engine API, made from the Rust types with `ts-rs`. Only built
//! with the feature `ts` (`pnpm build:types`); the WASM build does not include it.

use crate::json::{Wire, WireTransition};
use crate::{
    Budget, Change, Compiled, Conversion, ConversionBudget, ConversionStep, Counterexample,
    Equivalence, EquivalenceBudget, FsmKind, FsmToRegexBudget, Intersection, Issue, Jff, JffState,
    Label, Message, Minimization, MinimizeBudget, Nondeterminism, Operation, Param, RegexBudget,
    Severity, SimplifyBudget, Simulation, StateId, Step, StopReason, SymbolId, Transition, Witness,
};
use ts_rs::{Config, TS};

/// All declarations, in one text, in a fixed order.
pub fn declarations() -> String {
    // Numbers that are `i64` in Rust (message parameters) stay `number`: they are small.
    let cfg = Config::new().with_large_int("number");
    let mut out = String::from(
        "// Generated from the Rust types by `pnpm build:types`. Do not edit and do not commit.\n",
    );
    macro_rules! declare {
        ($($t:ty),* $(,)?) => {
            $( out.push_str("\nexport ");
               out.push_str(&<$t as TS>::decl(&cfg));
               out.push('\n'); )*
        };
    }
    declare!(
        Wire,
        WireTransition,
        FsmKind,
        StateId,
        SymbolId,
        Transition,
        Message,
        Param,
        StopReason,
        Witness,
        Label,
        Change,
        ConversionStep,
        Severity,
        Issue,
        Budget,
        ConversionBudget,
        MinimizeBudget,
        EquivalenceBudget,
        FsmToRegexBudget,
        RegexBudget,
        SimplifyBudget,
        Step,
        Simulation,
        Conversion,
        Minimization,
        Counterexample,
        Equivalence,
        Compiled,
        Operation,
        Intersection,
        JffState,
        Jff,
        Nondeterminism,
    );
    out
}
