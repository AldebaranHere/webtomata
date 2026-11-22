//! The many-strings call of the PDA engine (`api::simulate_pda_many`, T-038a): one call for the
//! list of a student, one outcome for each string in the order given.

use engine_core::api;
use serde_json::{Value, json};

/// The DPDA aⁿbⁿ of the task's F-DPDA: push `A` for each `a`, pop for each `b`, accept in q1.
const ANBN: &str = r#"{"schemaVersion":1,"kind":"dpda","inputAlphabet":["a","b"],"stackAlphabet":["A"],"states":[0,1],"start":0,"accepting":[1],"transitions":[{"from":0,"read":"a","pop":[],"push":["A"],"to":0},{"from":0,"read":"b","pop":["A"],"push":[],"to":1},{"from":1,"read":"b","pop":["A"],"push":[],"to":1}]}"#;

/// The NDPDA wwᴿ of the task's F-NDPDA: guess the middle with an ε-move.
const WWR: &str = r#"{"schemaVersion":1,"kind":"ndpda","inputAlphabet":["a","b"],"stackAlphabet":["A","B"],"states":[0,1],"start":0,"accepting":[1],"transitions":[{"from":0,"read":null,"pop":[],"push":[],"to":1},{"from":0,"read":"a","pop":[],"push":["A"],"to":0},{"from":0,"read":"b","pop":[],"push":["B"],"to":0},{"from":1,"read":"a","pop":["A"],"push":[],"to":1},{"from":1,"read":"b","pop":["B"],"push":[],"to":1}]}"#;

/// The task's F-LOOP: one state whose ε-transition pushes `A`, so every run is stopped.
const LOOP: &str = r#"{"schemaVersion":1,"kind":"ndpda","inputAlphabet":["a"],"stackAlphabet":["A"],"states":[0],"start":0,"accepting":[],"transitions":[{"from":0,"read":null,"pop":[],"push":["A"],"to":0}]}"#;

fn ok(text: String) -> Value {
    let envelope: Value = serde_json::from_str(&text).unwrap();
    assert_eq!(envelope["ok"], true, "{text}");
    envelope["value"].clone()
}

fn err(text: String) -> Value {
    let envelope: Value = serde_json::from_str(&text).unwrap();
    assert_eq!(envelope["ok"], false, "{text}");
    envelope["error"].clone()
}

fn many(pda: &str, inputs: &[&str]) -> Value {
    ok(api::simulate_pda_many(
        pda,
        &json!(inputs).to_string(),
        None,
    ))
}

#[test]
fn a_string_is_accepted_rejected_or_refused_with_its_peak() {
    let outcomes = many(ANBN, &["aabb", "aab", "abb", "c"]);

    assert_eq!(
        outcomes,
        json!([
            { "result": "accepted", "input": "aabb", "peak": 1 },
            { "result": "rejected", "input": "aab", "peak": 1 },
            { "result": "rejected", "input": "abb", "peak": 1 },
            {
                "result": "refused",
                "input": "c",
                "error": { "key": "input.unknown_symbol", "params": { "symbol": "c", "position": 0 } }
            }
        ])
    );
}

#[test]
fn a_refused_string_has_no_peak() {
    let outcomes = many(ANBN, &["c"]);
    let refused = &outcomes[0];
    assert_eq!(refused["result"], "refused");
    assert_eq!(refused.get("peak"), None, "{refused}");
}

#[test]
fn the_peak_is_the_number_of_the_one_run() {
    // The task's F-NDPDA: abba is accepted with peak 3; abab is rejected with peak 2.
    let outcomes = many(WWR, &["abba", "abab"]);
    assert_eq!(outcomes[0]["result"], "accepted");
    assert_eq!(outcomes[0]["peak"], 3);
    assert_eq!(outcomes[1]["result"], "rejected");
    assert_eq!(outcomes[1]["peak"], 2);
}

#[test]
fn a_stopped_string_keeps_its_reason_and_its_peak() {
    let outcomes = many(LOOP, &["a"]);
    assert_eq!(
        outcomes,
        json!([{ "result": "stopped", "input": "a", "reason": "max_stack", "peak": 1 }])
    );
}

#[test]
fn a_small_budget_stops_the_run_with_that_budget() {
    let answer = ok(api::simulate_pda_many(
        LOOP,
        r#"["a"]"#,
        Some(r#"{"maxStack": 5}"#),
    ));
    assert_eq!(answer[0]["result"], "stopped");
    assert_eq!(answer[0]["reason"], "max_stack");
}

#[test]
fn the_order_of_the_strings_is_kept() {
    let inputs = ["abb", "aabb", "aab"];
    let outcomes = many(ANBN, &inputs);
    let echoes: Vec<&str> = outcomes
        .as_array()
        .unwrap()
        .iter()
        .map(|o| o["input"].as_str().unwrap())
        .collect();
    assert_eq!(echoes, inputs);
}

#[test]
fn an_empty_list_asks_nothing() {
    assert_eq!(many(ANBN, &[]), json!([]));
}

#[test]
fn a_machine_with_no_start_state_refuses_each_string_with_the_machine_reason() {
    let no_start = ANBN.replace(r#""start":0"#, r#""start":null"#);
    assert!(no_start.contains(r#""start":null"#), "{no_start}");
    let outcomes = many(&no_start, &["a", "b"]);
    for outcome in outcomes.as_array().unwrap() {
        assert_eq!(outcome["result"], "refused");
        assert_eq!(outcome["error"]["key"], "pda.sim.no_start_state");
        assert_eq!(outcome.get("peak"), None);
    }
}

#[test]
fn an_invalid_budget_fails_the_whole_call_once() {
    let error = err(api::simulate_pda_many(ANBN, r#"["a"]"#, Some("{")));
    assert_eq!(error["key"], "api.invalid_budget");
}

#[test]
fn the_inputs_must_be_a_list_of_strings() {
    let error = err(api::simulate_pda_many(ANBN, r#"[1]"#, None));
    assert_eq!(error["key"], "api.invalid_inputs");
}

#[test]
fn a_string_that_is_too_long_is_refused_and_the_others_still_run() {
    let long = "a".repeat(api::MAX_INPUT_BYTES + 1);
    let outcomes = many(ANBN, &[long.as_str(), "aabb"]);
    assert_eq!(outcomes[0]["result"], "refused");
    assert_eq!(outcomes[0]["error"]["key"], "machine.limit_exceeded");
    assert_eq!(outcomes[1]["result"], "accepted");
}

#[test]
fn the_list_has_a_limit_of_one_hundred_strings() {
    let hundred: Vec<&str> = vec![""; 100];
    let outcomes = many(ANBN, &hundred);
    assert_eq!(outcomes.as_array().unwrap().len(), 100);

    let hundred_and_one: Vec<&str> = vec![""; 101];
    let error = err(api::simulate_pda_many(
        ANBN,
        &json!(hundred_and_one).to_string(),
        None,
    ));
    assert_eq!(error["key"], "machine.limit_exceeded");
    assert_eq!(error["params"]["what"], "inputs");
    assert_eq!(error["params"]["limit"], 100);
}
