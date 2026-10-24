//! The TypeScript types of the engine API, made from the Rust types with `ts-rs`, and golden
//! samples: real answers of the API, written as constants that must fit their types. If a
//! Rust type changes in a way that the web app does not follow, `pnpm check` fails on the
//! samples. Only built with the feature `ts` (`pnpm build:types`); the WASM build does not
//! include it.

use crate::api::{self, EquivalenceReport, RegexOutcome, SimulationReport};
use crate::json::{Wire, WireTransition};
use crate::{
    Budget, Change, Compiled, Conversion, ConversionBudget, ConversionStep, Counterexample,
    Equivalence, EquivalenceBudget, FsmKind, FsmToRegexBudget, Intersection, Issue, Jff, JffState,
    Label, Message, Minimization, MinimizeBudget, Nondeterminism, Operation, Param, RegexBudget,
    Severity, SimplifyBudget, Simulation, StateId, Step, StopReason, SymbolId, Transition, Witness,
};
use ts_rs::{Config, TS};

// Machines for the samples (Rich's examples, as in the tests).
const EVEN: &str = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,1],"start":0,"accepting":[0],"transitions":[{"from":0,"on":"a","to":1},{"from":0,"on":"b","to":1},{"from":1,"on":"a","to":0},{"from":1,"on":"b","to":0}]}"#;
const ENDS_10: &str = r#"{"schemaVersion":1,"kind":"ndfsm","alphabet":["0","1"],"states":[0,1,2],"start":0,"accepting":[2],"transitions":[{"from":0,"on":"0","to":0},{"from":0,"on":"1","to":0},{"from":0,"on":"1","to":1},{"from":1,"on":"0","to":2}]}"#;
const PARTIAL: &str = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,1],"start":0,"accepting":[1],"transitions":[{"from":0,"on":"a","to":1}]}"#;
const A_STAR: &str = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,1],"start":0,"accepting":[0],"transitions":[{"from":0,"on":"a","to":0},{"from":0,"on":"b","to":1},{"from":1,"on":"a","to":1},{"from":1,"on":"b","to":1}]}"#;
const EVEN_MOD_4: &str = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,1,2,3],"start":0,"accepting":[0,2],"transitions":[{"from":0,"on":"a","to":1},{"from":0,"on":"b","to":1},{"from":1,"on":"a","to":2},{"from":1,"on":"b","to":2},{"from":2,"on":"a","to":3},{"from":2,"on":"b","to":3},{"from":3,"on":"a","to":0},{"from":3,"on":"b","to":0}]}"#;
const AB: &str = r#"["a","b"]"#;
const JFF: &str = r#"<?xml version="1.0"?><structure><type>fa</type><automaton><state id="0" name="q0"><x>10.0</x><y>20.0</y><initial/></state><state id="1" name="q1"><x>30.0</x><y>20.0</y><final/></state><transition><from>0</from><to>1</to><read>ab</read></transition></automaton></structure>"#;

/// The answer of every API function, once as a success and, for some, as a stopped run or an
/// error. Each sample is `(constant name, TypeScript type of the value, answer text)`.
fn samples() -> Vec<(&'static str, &'static str, String)> {
    let tiny = Some(r#"{"maxSteps": 1}"#);
    let imported = api::import_jff(JFF);
    let layout = serde_json::from_str::<serde_json::Value>(&imported)
        .map(|v| v["value"]["states"].to_string())
        .unwrap_or_default();
    vec![
        ("sampleLoadMachine", "Machine", api::load_machine(EVEN)),
        ("sampleLoadMachineError", "Machine", api::load_machine("{")),
        ("sampleValidate", "Array<Issue>", api::validate(PARTIAL)),
        (
            "sampleNondeterministicStates",
            "Array<Nondeterminism>",
            api::nondeterministic_states(ENDS_10),
        ),
        (
            "sampleAddTrapState",
            "Operation",
            api::add_trap_state(PARTIAL),
        ),
        (
            "sampleSimulate",
            "SimulationReport",
            api::simulate(EVEN, "ab", None),
        ),
        (
            "sampleSimulateStopped",
            "SimulationReport",
            api::simulate(EVEN, "abab", tiny),
        ),
        (
            "sampleDeterminize",
            "Conversion",
            api::determinize(ENDS_10, None),
        ),
        (
            "sampleDeterminizeStopped",
            "Conversion",
            api::determinize(ENDS_10, tiny),
        ),
        (
            "sampleMinimize",
            "Minimization",
            api::minimize(EVEN_MOD_4, None),
        ),
        (
            "sampleEquivalent",
            "EquivalenceReport",
            api::equivalent(EVEN, EVEN, None),
        ),
        (
            "sampleEquivalentDifferent",
            "EquivalenceReport",
            api::equivalent(EVEN, A_STAR, None),
        ),
        (
            "sampleRegexToFsm",
            "Compiled",
            api::regex_to_fsm("a*b", AB, None),
        ),
        (
            "sampleFsmToRegex",
            "RegexOutcome",
            api::fsm_to_regex(EVEN_MOD_4, None),
        ),
        (
            "sampleFsmToRegexStopped",
            "RegexOutcome",
            api::fsm_to_regex(EVEN_MOD_4, tiny),
        ),
        (
            "sampleSimplify",
            "RegexOutcome",
            api::simplify("a*∪aa", AB, None),
        ),
        ("sampleComplement", "Operation", api::complement(A_STAR)),
        ("sampleUnion", "Operation", api::union(EVEN, A_STAR)),
        (
            "sampleIntersection",
            "Intersection",
            api::intersection(EVEN, A_STAR, None),
        ),
        ("sampleImportJff", "Jff", imported),
        ("sampleExportJff", "string", api::export_jff(EVEN, &layout)),
    ]
}

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
        SimulationReport,
        EquivalenceReport,
        RegexOutcome,
    );

    // The envelope of every API function (see `api`).
    out.push_str(
        "\nexport type EngineResult<T> = { ok: true, value: T, } | { ok: false, error: Message, };\n",
    );

    out.push_str("\n// Real answers of the engine. A type that drifts from the JSON fails here.\n");
    for (name, ty, text) in samples() {
        out.push_str(&format!(
            "export const {name} = {text} satisfies EngineResult<{ty}>;\n"
        ));
    }
    out
}
