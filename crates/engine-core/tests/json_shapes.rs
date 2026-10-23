//! The JSON that the web app reads. Field names are camelCase, as in the machine file
//! (`schemaVersion`); the `result` or `kind` tag of an enum is snake_case. The tests check
//! the names and the nesting, because the TypeScript types are made from the same Rust types.

use engine_core::{
    Budget, ConversionBudget, EquivalenceBudget, Fsm, FsmToRegexBudget, MinimizeBudget,
    RegexBudget, SimplifyBudget, SymbolId, add_trap_state, complement, determinize, equivalent,
    intersection, minimize, nondeterministic_states, parse_jff, regex_to_fsm, simulate, union,
    validate,
};
use serde_json::{Value, json, to_value};

mod common;
use common::{A_STAR, ENDS_10, EVEN, PARTIAL};

fn fsm(json: &str) -> Fsm {
    Fsm::from_json(json).unwrap()
}

fn keys(value: &Value) -> Vec<&str> {
    let mut keys: Vec<&str> = value
        .as_object()
        .unwrap()
        .keys()
        .map(String::as_str)
        .collect();
    keys.sort_unstable();
    keys
}

// ---- the machine ----

#[test]
fn a_machine_serializes_to_the_machine_file() {
    for json in [EVEN, ENDS_10, PARTIAL] {
        let m = fsm(json);
        let as_value = to_value(&m).unwrap();
        assert_eq!(
            as_value,
            serde_json::from_str::<Value>(&m.to_json()).unwrap()
        );
        assert_eq!(as_value["schemaVersion"], 1);
    }
}

// ---- results ----

#[test]
fn simulation() {
    let m = fsm(EVEN);
    let input = [SymbolId(0), SymbolId(1)];
    let done = to_value(simulate(&m, &input, Budget::default()).unwrap()).unwrap();
    assert_eq!(keys(&done), ["accepted", "result", "trace"]);
    assert_eq!(done["result"], "finished");
    assert_eq!(
        keys(&done["trace"][0]),
        ["message", "position", "states", "symbol"]
    );
    assert_eq!(done["trace"][1]["symbol"], 0);

    let tiny = Budget {
        max_steps: 1,
        ..Budget::default()
    };
    let stopped = to_value(simulate(&m, &input, tiny).unwrap()).unwrap();
    assert_eq!(keys(&stopped), ["partialTrace", "reason", "result"]);
    assert_eq!(stopped["result"], "stopped");
    assert_eq!(stopped["reason"], "max_steps");
}

#[test]
fn conversions() {
    let done = to_value(determinize(&fsm(ENDS_10), ConversionBudget::default()).unwrap()).unwrap();
    assert_eq!(keys(&done), ["dfsm", "result", "subsets", "trace"]);
    assert_eq!(done["result"], "finished");
    assert_eq!(done["dfsm"]["kind"], "dfsm");
    assert_eq!(done["subsets"][0], json!([0]));
    assert_eq!(done["trace"][0]["change"]["kind"], "closure");

    let tiny = ConversionBudget {
        max_steps: 1,
        ..ConversionBudget::default()
    };
    let stopped = to_value(determinize(&fsm(ENDS_10), tiny).unwrap()).unwrap();
    assert_eq!(keys(&stopped), ["partialTrace", "reason", "result"]);

    let done =
        to_value(minimize(&fsm(common::EVEN_MOD_4), MinimizeBudget::default()).unwrap()).unwrap();
    assert_eq!(keys(&done), ["classes", "dfsm", "result", "trace"]);
    assert_eq!(done["result"], "finished");
}

#[test]
fn equivalence() {
    let same = to_value(equivalent(&fsm(EVEN), &fsm(EVEN), EquivalenceBudget::default()).unwrap())
        .unwrap();
    assert_eq!(keys(&same), ["pairs", "result"]);
    assert_eq!(same["result"], "equivalent");

    let different =
        to_value(equivalent(&fsm(EVEN), &fsm(A_STAR), EquivalenceBudget::default()).unwrap())
            .unwrap();
    assert_eq!(different["result"], "different");
    assert_eq!(
        keys(&different),
        [
            "acceptedButShouldReject",
            "listsTruncated",
            "rejectedButShouldAccept",
            "result",
            "trace",
            "witness"
        ]
    );
    assert_eq!(keys(&different["witness"]), ["candidateAccepts", "string"]);

    let tiny = EquivalenceBudget {
        max_pairs: 1,
        ..EquivalenceBudget::default()
    };
    let stopped = to_value(equivalent(&fsm(EVEN_MOD_4_COPY), &fsm(EVEN), tiny).unwrap()).unwrap();
    assert_eq!(keys(&stopped), ["reason", "result"]);
    assert_eq!(stopped["result"], "stopped");
}

const EVEN_MOD_4_COPY: &str = common::EVEN_MOD_4;

#[test]
fn regex_machine() {
    let alphabet = fsm(EVEN).alphabet;
    let r = engine_core::parse_regex("a*b", &alphabet).unwrap();
    let done = to_value(regex_to_fsm(&r, &alphabet, RegexBudget::default()).unwrap()).unwrap();
    assert_eq!(keys(&done), ["fsm", "result", "trace"]);
    assert_eq!(done["result"], "finished");
    assert_eq!(done["trace"][0]["change"]["kind"], "fragment");
}

#[test]
fn operations() {
    let op = to_value(complement(&fsm(A_STAR)).unwrap()).unwrap();
    assert_eq!(keys(&op), ["fsm", "trace"]);

    let op = to_value(union(&fsm(EVEN), &fsm(A_STAR)).unwrap()).unwrap();
    assert_eq!(keys(&op), ["fsm", "trace"]);

    let op = to_value(add_trap_state(&fsm(PARTIAL)).unwrap()).unwrap();
    assert_eq!(keys(&op), ["fsm", "trace"]);
    assert_eq!(op["trace"][0]["change"]["kind"], "new_state");

    let done =
        to_value(intersection(&fsm(EVEN), &fsm(A_STAR), ConversionBudget::default()).unwrap())
            .unwrap();
    assert_eq!(keys(&done), ["fsm", "result", "trace"]);
    assert_eq!(done["result"], "finished");
}

#[test]
fn small_results() {
    let issues = to_value(validate(&fsm(PARTIAL))).unwrap();
    assert_eq!(keys(&issues[0]), ["message", "severity"]);
    assert_eq!(issues[0]["severity"], "error");

    let list = to_value(nondeterministic_states(&fsm(ENDS_10))).unwrap();
    assert_eq!(
        list,
        json!([{"state": 0, "symbols": [1], "epsilon": false}])
    );
}

#[test]
fn jff() {
    let xml = r#"<?xml version="1.0"?><structure><type>fa</type><automaton>
        <state id="0" name="q0"><x>10.0</x><y>20.0</y><initial/></state>
        <state id="1" name="q1"><x>30.0</x><y>20.0</y><final/></state>
        <transition><from>0</from><to>1</to><read>ab</read></transition>
        </automaton></structure>"#;
    let done = to_value(parse_jff(xml).unwrap()).unwrap();
    assert_eq!(keys(&done), ["fsm", "notes", "states"]);
    assert_eq!(done["fsm"]["schemaVersion"], 1);
    assert_eq!(keys(&done["states"][0]), ["id", "name", "x", "y"]);
    assert_eq!(done["notes"][0]["key"], "jff.label_expanded");
}

// ---- budgets come in as JSON, with camelCase names and defaults for what is missing ----

#[test]
fn budgets_read_partial_json() {
    let b: Budget = serde_json::from_str(r#"{"maxSteps": 7}"#).unwrap();
    assert_eq!(b.max_steps, 7);
    assert_eq!(b.max_configurations, Budget::default().max_configurations);

    let b: Budget = serde_json::from_str("{}").unwrap();
    assert_eq!(b, Budget::default());

    let b: ConversionBudget = serde_json::from_str(r#"{"maxStates": 5}"#).unwrap();
    assert_eq!(b.max_states, 5);
    let b: MinimizeBudget = serde_json::from_str(r#"{"maxSteps": 5}"#).unwrap();
    assert_eq!(b.max_steps, 5);
    let b: EquivalenceBudget =
        serde_json::from_str(r#"{"maxPairs": 5, "maxVisits": 6, "maxLength": 7, "maxStrings": 8}"#)
            .unwrap();
    assert_eq!(
        (b.max_pairs, b.max_visits, b.max_length, b.max_strings),
        (5, 6, 7, 8)
    );
    let b: FsmToRegexBudget =
        serde_json::from_str(r#"{"maxSteps": 5, "maxUpdates": 6, "maxNodes": 7}"#).unwrap();
    assert_eq!((b.max_steps, b.max_updates, b.max_nodes), (5, 6, 7));
    let b: RegexBudget = serde_json::from_str(r#"{"maxStates": 5}"#).unwrap();
    assert_eq!(b.max_states, 5);
    let b: SimplifyBudget = serde_json::from_str(r#"{"maxChecks": 5}"#).unwrap();
    assert_eq!(b.max_checks, 5);
    assert_eq!(b.max_steps, SimplifyBudget::default().max_steps);
}

#[test]
fn budgets_refuse_unknown_or_wrong_fields() {
    // A misspelled name must not be ignored: the caller would think the budget was set.
    assert!(serde_json::from_str::<Budget>(r#"{"max_steps": 7}"#).is_err());
    assert!(serde_json::from_str::<Budget>(r#"{"maxStep": 7}"#).is_err());
    assert!(serde_json::from_str::<Budget>(r#"{"maxSteps": -1}"#).is_err());
    assert!(serde_json::from_str::<Budget>(r#"{"maxSteps": "7"}"#).is_err());
}
