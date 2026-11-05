use engine_core::pda::{MAX_PDA_STRING, Pda, PdaKind};
use engine_core::{Alphabet, MAX_JSON_BYTES, Message, Param, StateId, SymbolId};
use proptest::prelude::*;

const M1_JSON: &str = r#"{"schemaVersion":1,"kind":"dpda","inputAlphabet":["a","b"],"stackAlphabet":["a"],"states":[0,1],"start":0,"accepting":[0,1],"transitions":[{"from":0,"read":"a","pop":[],"push":["a"],"to":0},{"from":0,"read":"b","pop":["a"],"push":[],"to":1},{"from":1,"read":"b","pop":["a"],"push":[],"to":1}]}"#;

const M2_JSON: &str = r#"{"schemaVersion":1,"kind":"ndpda","inputAlphabet":["a","b"],"stackAlphabet":["a","b"],"states":[0,1],"start":0,"accepting":[1],"transitions":[{"from":0,"read":null,"pop":[],"push":[],"to":1},{"from":0,"read":"a","pop":[],"push":["a"],"to":0},{"from":0,"read":"b","pop":[],"push":["b"],"to":0},{"from":1,"read":"a","pop":["a"],"push":[],"to":1},{"from":1,"read":"b","pop":["b"],"push":[],"to":1}]}"#;

fn err(input: &str) -> Message {
    Pda::from_json(input).expect_err("input should be rejected")
}

fn int(m: &Message, name: &str) -> i64 {
    match m.params.get(name) {
        Some(Param::Int(n)) => *n,
        other => panic!("param {name}: {other:?}"),
    }
}

fn text(m: &Message, name: &str) -> String {
    match m.params.get(name) {
        Some(Param::Text(t)) => t.clone(),
        other => panic!("param {name}: {other:?}"),
    }
}

fn with_field(json: &str, field: &str, value: &str) -> String {
    let mut v: serde_json::Value = serde_json::from_str(json).unwrap();
    v[field] = serde_json::from_str(value).unwrap();
    v.to_string()
}

#[test]
fn m1_round_trips_to_canonical_json() {
    let pda = Pda::from_json(M1_JSON).unwrap();
    assert_eq!(pda.kind, PdaKind::Dpda);
    assert_eq!(pda.to_json(), M1_JSON);
    assert_eq!(Pda::from_json(&pda.to_json()).unwrap(), pda);
}

#[test]
fn m2_round_trips_to_canonical_json() {
    let pda = Pda::from_json(M2_JSON).unwrap();
    assert_eq!(pda.kind, PdaKind::Ndpda);
    assert_eq!(pda.to_json(), M2_JSON);
    assert_eq!(Pda::from_json(&pda.to_json()).unwrap(), pda);
}

#[test]
fn unsupported_schema_version_is_rejected() {
    let bad = with_field(M1_JSON, "schemaVersion", "2");
    let m = err(&bad);
    assert_eq!(m.key, "machine.unsupported_schema_version");
    assert_eq!(int(&m, "found"), 2);
}

#[test]
fn unknown_field_is_rejected() {
    let mut v: serde_json::Value = serde_json::from_str(M1_JSON).unwrap();
    v["extra"] = serde_json::Value::Bool(true);
    let m = err(&v.to_string());
    assert_eq!(m.key, "machine.invalid_structure");
}

#[test]
fn missing_field_is_rejected() {
    let mut v: serde_json::Value = serde_json::from_str(M1_JSON).unwrap();
    v.as_object_mut().unwrap().remove("inputAlphabet");
    let m = err(&v.to_string());
    assert_eq!(m.key, "machine.invalid_structure");
}

#[test]
fn json_syntax_error_is_reported() {
    let m = err("{ not json }");
    assert_eq!(m.key, "machine.json_invalid");
}

#[test]
fn size_over_limit_is_rejected() {
    let big = " ".repeat(MAX_JSON_BYTES + 1);
    let m = err(&big);
    assert_eq!(m.key, "machine.limit_exceeded");
    assert_eq!(text(&m, "what"), "bytes");
    assert_eq!(int(&m, "limit"), MAX_JSON_BYTES as i64);
}

#[test]
fn pop_over_max_pda_string_is_rejected() {
    let pop_long: Vec<String> = (0..=MAX_PDA_STRING).map(|_| "a".to_string()).collect();
    let pop_json = serde_json::to_string(&pop_long).unwrap();
    let json = format!(
        r#"{{"schemaVersion":1,"kind":"dpda","inputAlphabet":["a"],"stackAlphabet":["a"],"states":[0],"start":0,"accepting":[0],"transitions":[{{"from":0,"read":"a","pop":{pop_json},"push":[],"to":0}}]}}"#
    );
    let m = err(&json);
    assert_eq!(m.key, "machine.limit_exceeded");
    assert_eq!(text(&m, "what"), "pda_string");
    assert_eq!(int(&m, "limit"), MAX_PDA_STRING as i64);
}

#[test]
fn push_over_max_pda_string_is_rejected() {
    let push_long: Vec<String> = (0..=MAX_PDA_STRING).map(|_| "a".to_string()).collect();
    let push_json = serde_json::to_string(&push_long).unwrap();
    let json = format!(
        r#"{{"schemaVersion":1,"kind":"dpda","inputAlphabet":["a"],"stackAlphabet":["a"],"states":[0],"start":0,"accepting":[0],"transitions":[{{"from":0,"read":"a","pop":[],"push":{push_json},"to":0}}]}}"#
    );
    let m = err(&json);
    assert_eq!(m.key, "machine.limit_exceeded");
    assert_eq!(text(&m, "what"), "pda_string");
    assert_eq!(int(&m, "limit"), MAX_PDA_STRING as i64);
}

#[test]
fn unknown_input_symbol_is_rejected() {
    let json = r#"{"schemaVersion":1,"kind":"dpda","inputAlphabet":["a"],"stackAlphabet":["a"],"states":[0],"start":0,"accepting":[0],"transitions":[{"from":0,"read":"unknown","pop":[],"push":[],"to":0}]}"#;
    let m = err(json);
    assert_eq!(m.key, "machine.unknown_symbol");
    assert_eq!(text(&m, "symbol"), "unknown");
}

#[test]
fn unknown_stack_symbol_is_rejected() {
    let json = r#"{"schemaVersion":1,"kind":"dpda","inputAlphabet":["a"],"stackAlphabet":["a"],"states":[0],"start":0,"accepting":[0],"transitions":[{"from":0,"read":"a","pop":["unknown"],"push":[],"to":0}]}"#;
    let m = err(json);
    assert_eq!(m.key, "machine.unknown_symbol");
    assert_eq!(text(&m, "symbol"), "unknown");
}

#[test]
fn unknown_state_is_rejected() {
    let json = r#"{"schemaVersion":1,"kind":"dpda","inputAlphabet":["a"],"stackAlphabet":["a"],"states":[0],"start":0,"accepting":[99],"transitions":[]}"#;
    let m = err(json);
    assert_eq!(m.key, "machine.unknown_state");
    assert_eq!(int(&m, "state"), 99);
}

prop_compose! {
    fn arb_small_pda()(
        kind in prop_oneof![Just(PdaKind::Dpda), Just(PdaKind::Ndpda)],
        num_states in 1usize..5,
        num_transitions in 0usize..8,
    ) -> Pda {
        let states: Vec<StateId> = (0..num_states as u32).map(StateId).collect();
        let input = Alphabet::new(vec!["a".to_string(), "b".to_string()]).unwrap();
        let stack = Alphabet::new(vec!["X".to_string(), "Y".to_string()]).unwrap();
        let start = Some(StateId(0));
        let accepting = vec![StateId(0)];
        let mut transitions = Vec::new();
        for i in 0..num_transitions {
            let from = StateId((i % num_states) as u32);
            let to = StateId(((i + 1) % num_states) as u32);
            let read = if i % 3 == 0 { None } else { Some(SymbolId((i % 2) as u16)) };
            let pop = if i % 2 == 0 { vec![] } else { vec![SymbolId(0)] };
            let push = if i % 4 == 0 { vec![SymbolId(0), SymbolId(1)] } else { vec![] };
            transitions.push(engine_core::pda::PdaTransition { from, read, pop, push, to });
        }
        Pda::new(kind, input, stack, states, start, accepting, transitions).unwrap()
    }
}

proptest! {
    #[test]
    fn prop_pda_json_round_trip(pda in arb_small_pda()) {
        let json = pda.to_json();
        let parsed = Pda::from_json(&json).expect("serialized PDA must parse");
        prop_assert_eq!(&parsed, &pda);
        prop_assert_eq!(parsed.to_json(), json);
    }
}
