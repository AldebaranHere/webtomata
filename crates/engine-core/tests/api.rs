//! The engine API for the web app (`engine_core::api`): JSON text in, JSON text out, and
//! every answer in the same envelope. These tests go through the JSON, as the browser does.

use engine_core::api;
use proptest::prelude::*;
use serde_json::{Value, json};

mod common;
use common::{A_STAR, ENDS_10, EVEN, EVEN_MOD_4, PARTIAL};

/// Reads the envelope: returns the value of an answer that worked.
fn ok(text: String) -> Value {
    let envelope: Value = serde_json::from_str(&text).unwrap();
    assert_eq!(envelope["ok"], true, "{text}");
    assert_eq!(keys(&envelope), ["ok", "value"]);
    envelope["value"].clone()
}

/// Reads the envelope: returns the message of an answer that failed.
fn err(text: String) -> Value {
    let envelope: Value = serde_json::from_str(&text).unwrap();
    assert_eq!(envelope["ok"], false, "{text}");
    assert_eq!(keys(&envelope), ["error", "ok"]);
    envelope["error"].clone()
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

fn ab() -> String {
    json!(["a", "b"]).to_string()
}

// ---- machines ----

#[test]
fn load_machine_gives_the_canonical_machine() {
    let value = ok(api::load_machine(EVEN));
    assert_eq!(value["schemaVersion"], 1);
    assert_eq!(value["kind"], "dfsm");
    assert_eq!(value["states"], json!([0, 1]));
}

#[test]
fn load_machine_reports_problems_as_messages() {
    assert_eq!(
        err(api::load_machine("{")).get("key").unwrap(),
        "machine.json_invalid"
    );
    let too_big = format!("{}{}", " ".repeat(2 * 1024 * 1024), EVEN);
    let message = err(api::load_machine(&too_big));
    assert_eq!(message["key"], "machine.limit_exceeded");
}

#[test]
fn validate_lists_the_issues() {
    assert_eq!(ok(api::validate(EVEN)), json!([]));
    let issues = ok(api::validate(PARTIAL));
    assert_eq!(issues[0]["severity"], "error");
    assert_eq!(issues[0]["message"]["key"], "dfsm.missing_transition");
    // A bad machine file is an error, not a list.
    assert_eq!(err(api::validate("[]"))["key"], "machine.invalid_structure");
}

#[test]
fn nondeterministic_states_lists_the_states() {
    assert_eq!(
        ok(api::nondeterministic_states(ENDS_10)),
        json!([{"state": 0, "symbols": [1], "epsilon": false}])
    );
    assert_eq!(ok(api::nondeterministic_states(EVEN)), json!([]));
}

#[test]
fn add_trap_state_completes_the_machine() {
    let value = ok(api::add_trap_state(PARTIAL));
    assert_eq!(value["fsm"]["states"], json!([0, 1, 2]));
    assert_eq!(value["trace"][0]["change"]["kind"], "new_state");
    assert_eq!(err(api::add_trap_state(ENDS_10))["key"], "trap.not_a_dfsm");
}

// ---- simulate ----

#[test]
fn simulate_returns_the_input_as_symbol_names() {
    let value = ok(api::simulate(EVEN, "ab", None));
    assert_eq!(value["input"], json!(["a", "b"]));
    assert_eq!(value["simulation"]["result"], "finished");
    assert_eq!(value["simulation"]["accepted"], true);
    assert_eq!(value["simulation"]["trace"].as_array().unwrap().len(), 3);
}

#[test]
fn simulate_reads_symbols_with_several_characters() {
    let json = EVEN
        .replace(r#""alphabet":["a","b"]"#, r#""alphabet":["num","plus"]"#)
        .replace(r#""on":"a""#, r#""on":"num""#)
        .replace(r#""on":"b""#, r#""on":"plus""#);
    let value = ok(api::simulate(&json, "num plus", None));
    assert_eq!(value["input"], json!(["num", "plus"]));
    assert_eq!(value["simulation"]["accepted"], true);
}

#[test]
fn simulate_checks_its_inputs() {
    let message = err(api::simulate(EVEN, "abc", None));
    assert_eq!(message["key"], "input.unknown_symbol");
    assert_eq!(message["params"]["position"], 2);

    let too_long = "a".repeat(api::MAX_INPUT_BYTES + 1);
    let message = err(api::simulate(EVEN, &too_long, None));
    assert_eq!(message["key"], "machine.limit_exceeded");
    assert_eq!(message["params"]["what"], "input bytes");
}

#[test]
fn a_budget_is_optional_and_partial() {
    let value = ok(api::simulate(EVEN, "abab", Some(r#"{"maxSteps": 2}"#)));
    assert_eq!(value["simulation"]["result"], "stopped");
    assert_eq!(value["simulation"]["reason"], "max_steps");
    // Empty text or a missing budget means the defaults.
    for budget in [None, Some(""), Some("  "), Some("{}")] {
        let value = ok(api::simulate(EVEN, "abab", budget));
        assert_eq!(value["simulation"]["result"], "finished");
    }
}

#[test]
fn a_bad_budget_is_an_error_and_not_ignored() {
    for budget in [
        r#"{"max_steps": 2}"#,
        r#"{"maxStep": 2}"#,
        r#"{"maxSteps": "2"}"#,
        r#"{"maxSteps": -1}"#,
        "null",
        "[",
    ] {
        assert_eq!(
            err(api::simulate(EVEN, "ab", Some(budget)))["key"],
            "api.invalid_budget",
            "{budget}"
        );
    }
    let huge = format!(r#"{{"maxSteps": {}}}"#, " ".repeat(api::MAX_BUDGET_BYTES));
    let message = err(api::simulate(EVEN, "ab", Some(&huge)));
    assert_eq!(message["params"]["what"], "budget bytes");
}

// ---- conversions ----

#[test]
fn determinize_and_minimize() {
    let value = ok(api::determinize(ENDS_10, None));
    assert_eq!(value["result"], "finished");
    assert_eq!(value["dfsm"]["kind"], "dfsm");
    let stopped = ok(api::determinize(ENDS_10, Some(r#"{"maxSteps": 1}"#)));
    assert_eq!(stopped["result"], "stopped");

    let value = ok(api::minimize(EVEN_MOD_4, None));
    assert_eq!(value["result"], "finished");
    assert_eq!(value["classes"].as_array().unwrap().len(), 2);
    assert_eq!(
        err(api::minimize(ENDS_10, None))["key"],
        "minimize.not_a_dfsm"
    );
}

#[test]
fn equivalent_names_the_symbols_of_the_witness() {
    let same = ok(api::equivalent(EVEN, EVEN, None));
    assert_eq!(same["equivalence"]["result"], "equivalent");
    assert_eq!(same["witness"], Value::Null);
    assert_eq!(same["acceptedButShouldReject"], json!([]));

    let different = ok(api::equivalent(EVEN, A_STAR, None));
    assert_eq!(different["equivalence"]["result"], "different");
    let witness = different["witness"].as_array().unwrap();
    assert!(!witness.is_empty());
    assert!(witness.iter().all(Value::is_string));
}

#[test]
fn the_witness_is_right_even_if_the_alphabets_are_in_another_order() {
    // The reference lists its symbols as b, a. Numbers would then point to other symbols.
    let swapped = A_STAR.replace(r#""alphabet":["a","b"]"#, r#""alphabet":["b","a"]"#);
    let report = ok(api::equivalent(EVEN, &swapped, None));
    assert_eq!(report["equivalence"]["result"], "different");
    let text: String = report["witness"]
        .as_array()
        .unwrap()
        .iter()
        .map(|s| s.as_str().unwrap())
        .collect();

    // Run the witness on both machines. They must disagree, as the report says.
    let on =
        |machine: &str| ok(api::simulate(machine, &text, None))["simulation"]["accepted"].clone();
    assert_ne!(on(EVEN), on(&swapped));
    assert_eq!(
        on(EVEN),
        report["equivalence"]["witness"]["candidateAccepts"]
    );
    // The lists use names too.
    for list in ["acceptedButShouldReject", "rejectedButShouldAccept"] {
        for string in report[list].as_array().unwrap() {
            assert!(string.as_array().unwrap().iter().all(Value::is_string));
        }
    }
}

// ---- regular expressions ----

#[test]
fn regex_to_fsm_builds_a_machine() {
    let value = ok(api::regex_to_fsm("a*b", &ab(), None));
    assert_eq!(value["result"], "finished");
    let machine = value["fsm"].to_string();
    assert_eq!(
        ok(api::simulate(&machine, "aab", None))["simulation"]["accepted"],
        true
    );
    assert_eq!(
        ok(api::simulate(&machine, "aba", None))["simulation"]["accepted"],
        false
    );

    let stopped = ok(api::regex_to_fsm("a*b", &ab(), Some(r#"{"maxStates": 1}"#)));
    assert_eq!(stopped["result"], "stopped");
}

#[test]
fn regex_errors_carry_a_position() {
    let message = err(api::regex_to_fsm("a*c", &ab(), None));
    assert_eq!(message["key"], "regex.unknown_symbol");
    assert_eq!(message["params"]["position"], 2);
    assert_eq!(
        err(api::regex_to_fsm("(a", &ab(), None))["key"],
        "regex.unbalanced_parenthesis"
    );
    assert_eq!(
        err(api::simplify("a∪", &ab(), None))["key"],
        "regex.unexpected_end"
    );
}

#[test]
fn the_alphabet_is_checked() {
    for alphabet in ["", "{", r#"{"a": 1}"#, "[1, 2]"] {
        assert_eq!(
            err(api::regex_to_fsm("a", alphabet, None))["key"],
            "api.invalid_alphabet",
            "{alphabet}"
        );
    }
    // A list that is a list of strings, but not a good alphabet.
    let message = err(api::regex_to_fsm("a", r#"["a", "a"]"#, None));
    assert!(
        message["key"].as_str().unwrap().starts_with("machine."),
        "{message}"
    );
}

#[test]
fn fsm_to_regex_gives_text_that_means_the_same() {
    let value = ok(api::fsm_to_regex(EVEN_MOD_4, None));
    assert_eq!(value["result"], "finished");
    let text = value["regex"].as_str().unwrap();
    assert!(!text.is_empty());

    // The text is a regular expression over the alphabet: read it back and compare.
    let back = ok(api::regex_to_fsm(text, &ab(), None));
    let machine = back["fsm"].to_string();
    let report = ok(api::equivalent(&machine, EVEN_MOD_4, None));
    assert_eq!(report["equivalence"]["result"], "equivalent", "{text}");

    let stopped = ok(api::fsm_to_regex(EVEN_MOD_4, Some(r#"{"maxSteps": 1}"#)));
    assert_eq!(stopped["result"], "stopped");
}

#[test]
fn simplify_gives_text_and_a_trace() {
    let value = ok(api::simplify("a*∪aa", &ab(), None));
    assert_eq!(value["result"], "finished");
    assert_eq!(value["regex"], "a*");
    assert_eq!(value["trace"][0]["message"]["key"], "simplify.union_subset");

    let stopped = ok(api::simplify("a*∪aa", &ab(), Some(r#"{"maxChecks": 0}"#)));
    assert_eq!(stopped["result"], "stopped");
    assert_eq!(stopped["reason"], "max_checks");
}

// ---- closure operations ----

#[test]
fn closure_operations() {
    let value = ok(api::complement(A_STAR));
    assert_eq!(value["fsm"]["accepting"], json!([1]));
    assert_eq!(
        err(api::complement(PARTIAL))["key"],
        "complement.invalid_machine"
    );

    let value = ok(api::union(EVEN, A_STAR));
    assert_eq!(value["fsm"]["kind"], "ndfsm");
    assert_eq!(err(api::union(EVEN, "{"))["key"], "machine.json_invalid");

    let value = ok(api::intersection(EVEN, A_STAR, None));
    assert_eq!(value["result"], "finished");
    let machine = value["fsm"].to_string();
    // The intersection of "even length" and "only a" is "a of even length".
    assert_eq!(
        ok(api::simulate(&machine, "aa", None))["simulation"]["accepted"],
        true
    );
    assert_eq!(
        ok(api::simulate(&machine, "a", None))["simulation"]["accepted"],
        false
    );
}

// ---- JFLAP ----

#[test]
fn jff_import_and_export() {
    let xml = r#"<?xml version="1.0"?><structure><type>fa</type><automaton>
        <state id="0" name="q0"><x>10.0</x><y>20.0</y><initial/></state>
        <state id="1" name="q1"><x>30.0</x><y>20.0</y><final/></state>
        <transition><from>0</from><to>1</to><read>a</read></transition>
        </automaton></structure>"#;
    let imported = ok(api::import_jff(xml));
    assert_eq!(imported["fsm"]["states"], json!([0, 1]));
    assert_eq!(imported["states"][0]["name"], "q0");

    let layout = imported["states"].to_string();
    let exported = ok(api::export_jff(&imported["fsm"].to_string(), &layout));
    let text = exported.as_str().unwrap();
    assert!(text.contains("<structure>") && text.contains("name=\"q0\""));
    // What was written reads back as the same machine.
    assert_eq!(ok(api::import_jff(text))["fsm"], imported["fsm"]);

    assert_eq!(err(api::import_jff("<a/>"))["key"], "jff.invalid_structure");
    for layout in [
        "",
        "{",
        r#"[{"id": 0}]"#,
        r#"[{"id":0,"name":"q","x":1,"y":2,"z":3}]"#,
    ] {
        assert_eq!(
            err(api::export_jff(EVEN, layout))["key"],
            "api.invalid_layout",
            "{layout}"
        );
    }
    // Nothing needs a layout: states without one get a name and a place.
    assert!(
        ok(api::export_jff(EVEN, "[]"))
            .as_str()
            .unwrap()
            .contains("<state id=\"0\"")
    );
}

// ---- always an envelope, always the same answer ----

#[test]
fn the_same_input_gives_the_same_text() {
    assert_eq!(
        api::determinize(ENDS_10, None),
        api::determinize(ENDS_10, None)
    );
    assert_eq!(
        api::equivalent(EVEN, A_STAR, None),
        api::equivalent(EVEN, A_STAR, None)
    );
}

fn is_envelope(text: &str) -> bool {
    let envelope: Value = serde_json::from_str(text).unwrap();
    match envelope["ok"].as_bool() {
        Some(true) => envelope.get("value").is_some(),
        Some(false) => envelope["error"]["key"].is_string(),
        None => false,
    }
}

proptest! {
    /// Whatever text comes in, a function answers with an envelope. It does not panic.
    #[test]
    fn no_text_makes_a_function_panic(a in ".{0,200}", b in ".{0,60}", c in ".{0,60}") {
        let budget = Some(b.as_str());
        for text in [
            api::load_machine(&a),
            api::validate(&a),
            api::nondeterministic_states(&a),
            api::add_trap_state(&a),
            api::simulate(&a, &b, budget),
            api::simulate(EVEN, &a, budget),
            api::determinize(&a, budget),
            api::minimize(&a, budget),
            api::equivalent(&a, &b, Some(&c)),
            api::equivalent(EVEN, &a, Some(&c)),
            api::regex_to_fsm(&a, &b, Some(&c)),
            api::regex_to_fsm(&a, &ab(), Some(&c)),
            api::fsm_to_regex(&a, budget),
            api::simplify(&a, &b, Some(&c)),
            api::simplify(&a, &ab(), Some(&c)),
            api::complement(&a),
            api::union(&a, &b),
            api::intersection(&a, &b, Some(&c)),
            api::import_jff(&a),
            api::export_jff(&a, &b),
            api::export_jff(EVEN, &a),
        ] {
            prop_assert!(is_envelope(&text), "{text}");
        }
    }
}
