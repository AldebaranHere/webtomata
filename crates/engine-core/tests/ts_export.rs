//! Writes the TypeScript types of the engine API to `web/src/lib/engine/types.ts`.
//! Run with `cargo test -p engine-core --features ts --test ts_export` (the script
//! `pnpm build:types` does this). The file is generated and not committed.

#![cfg(feature = "ts")]

use std::fs;
use std::path::Path;

#[test]
fn the_types_match_the_json() {
    let text = engine_core::typescript_declarations();

    // Every type that the web app reads or sends.
    for name in [
        "Machine",
        "MachineTransition",
        "FsmKind",
        "StateId",
        "SymbolId",
        "Transition",
        "Message",
        "Param",
        "StopReason",
        "Witness",
        "Label",
        "Change",
        "ConversionStep",
        "Severity",
        "Issue",
        "SimulateBudget",
        "ConversionBudget",
        "MinimizeBudget",
        "EquivalenceBudget",
        "FsmToRegexBudget",
        "RegexBudget",
        "SimplifyBudget",
        "SimulationStep",
        "Simulation",
        "Conversion",
        "Minimization",
        "Counterexample",
        "Equivalence",
        "Compiled",
        "Operation",
        "Intersection",
        "JffState",
        "Jff",
        "Nondeterminism",
    ] {
        assert!(
            text.contains(&format!("export type {name} =")),
            "missing {name}"
        );
    }

    // The names and shapes that json_shapes.rs checks on the JSON.
    for part in [
        "{ schemaVersion: number, kind: FsmKind,",
        "start: number | null",
        "{ \"result\": \"stopped\", reason: StopReason, partialTrace: Array<ConversionStep>, }",
        "candidateAccepts: boolean",
        "{ \"kind\": \"already_complete\" }",
        "export type Param = number | string;",
        "maxSteps: number",
        "maxChecks: number",
    ] {
        assert!(text.contains(part), "missing: {part}");
    }

    // Snake_case field names would mean that a `rename_all` is missing in Rust.
    assert!(!text.contains("partial_trace") && !text.contains("max_steps:"));
    // Numbers must not turn into bigint (the message parameters are `i64` in Rust).
    assert!(!text.contains("bigint"));

    let file = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../web/src/lib/engine/types.ts");
    fs::write(file, text).unwrap();
}
