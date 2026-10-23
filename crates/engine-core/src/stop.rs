use serde::Serialize;

/// Why a run stopped before it finished. Every run has a budget.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub enum StopReason {
    /// Too many input symbols read (simulation) or too many trace steps (conversions).
    MaxSteps,
    /// Too many state entries in the trace (simulation).
    MaxConfigurations,
    /// Too many states in the machine being built (conversions).
    MaxStates,
    /// Too many pairs of state sets explored (equivalence).
    MaxPairs,
    /// Too many label updates (state elimination).
    MaxUpdates,
    /// A regular expression grew too big (state elimination).
    MaxNodes,
    /// Too many checks of the form "is this language inside that one?" (simplifying a regular expression).
    MaxChecks,
}
