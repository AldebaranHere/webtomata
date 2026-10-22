use engine_core::{Alphabet, Fsm, FsmKind, Message, Param, StateId, SymbolId, Transition};
use proptest::prelude::*;

mod common;
use common::arb_fsm;

const DFSM: &str = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,1],"start":0,"accepting":[1],"transitions":[{"from":0,"on":"a","to":1},{"from":0,"on":"b","to":0},{"from":1,"on":"a","to":1},{"from":1,"on":"b","to":0}]}"#;

fn err(input: &str) -> Message {
    Fsm::from_json(input).expect_err("input should be rejected")
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

/// The valid DFSM above with one top-level field replaced by the given JSON value.
fn with(field: &str, value: &str) -> String {
    let mut v: serde_json::Value = serde_json::from_str(DFSM).unwrap();
    v[field] = serde_json::from_str(value).unwrap();
    v.to_string()
}

// ---- round trips ----

#[test]
fn dfsm_round_trips_to_identical_json() {
    let fsm = Fsm::from_json(DFSM).unwrap();
    assert_eq!(fsm.kind, FsmKind::Dfsm);
    assert_eq!(fsm.to_json(), DFSM);
    assert_eq!(Fsm::from_json(&fsm.to_json()).unwrap(), fsm);
}

#[test]
fn ndfsm_epsilon_transition_uses_null() {
    let json = r#"{"schemaVersion":1,"kind":"ndfsm","alphabet":["a"],"states":[0,1,2],"start":0,"accepting":[2],"transitions":[{"from":0,"on":null,"to":1},{"from":1,"on":"a","to":2}]}"#;
    let fsm = Fsm::from_json(json).unwrap();
    assert_eq!(fsm.kind, FsmKind::Ndfsm);
    assert_eq!(fsm.transitions[0].on, None);
    assert_eq!(fsm.transitions[1].on, Some(SymbolId(0)));
    assert_eq!(fsm.to_json(), json);
}

#[test]
fn multi_character_symbols_are_interned() {
    let json = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["num","plus"],"states":[0],"start":0,"accepting":[0],"transitions":[{"from":0,"on":"plus","to":0}]}"#;
    let fsm = Fsm::from_json(json).unwrap();
    assert_eq!(fsm.alphabet.id("plus"), Some(SymbolId(1)));
    assert_eq!(fsm.alphabet.name(SymbolId(0)), Some("num"));
    assert_eq!(fsm.to_json(), json);
}

#[test]
fn output_is_sorted_whatever_the_input_order() {
    let json = r#"{"schemaVersion":1,"kind":"ndfsm","alphabet":["b","a"],"states":[2,0,1],"start":0,"accepting":[2,1],"transitions":[{"from":2,"on":"a","to":0},{"from":0,"on":"a","to":1},{"from":0,"on":null,"to":2}]}"#;
    let sorted = r#"{"schemaVersion":1,"kind":"ndfsm","alphabet":["b","a"],"states":[0,1,2],"start":0,"accepting":[1,2],"transitions":[{"from":0,"on":null,"to":2},{"from":0,"on":"a","to":1},{"from":2,"on":"a","to":0}]}"#;
    assert_eq!(Fsm::from_json(json).unwrap().to_json(), sorted);
}

#[test]
fn machine_without_start_state_is_representable() {
    let fsm = Fsm::from_json(&with("start", "null")).unwrap();
    assert_eq!(fsm.start, None);
    assert_eq!(Fsm::from_json(&fsm.to_json()).unwrap(), fsm);
}

#[test]
fn invalid_but_expressible_machines_still_load() {
    // E2 reports these; the loader must not reject them.
    let json = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a"],"states":[0,1],"start":null,"accepting":[],"transitions":[{"from":0,"on":"a","to":1},{"from":0,"on":"a","to":0},{"from":1,"on":null,"to":1}]}"#;
    assert!(Fsm::from_json(json).is_ok());
}

// ---- syntax and structure errors ----

#[test]
fn not_json_is_json_invalid_with_position() {
    let m = err("not json");
    assert_eq!(m.key, "machine.json_invalid");
    assert_eq!(int(&m, "line"), 1);
    assert!(int(&m, "column") >= 1);
}

#[test]
fn deeply_nested_input_is_rejected_not_crashed() {
    assert_eq!(err(&"[".repeat(100_000)).key, "machine.json_invalid");
}

#[test]
fn wrong_shape_is_invalid_structure() {
    for input in [
        "[]".to_string(),
        "null".to_string(),
        "{}".to_string(),
        r#"{"schemaVersion":1}"#.to_string(),
        r#"{"kind":"dfsm"}"#.to_string(),
        with("states", r#""x""#),
        with("kind", r#""pda""#),
        with("extra", "1"),
        with("schemaVersion", r#""1""#),
        with("schemaVersion", "1.5"),
        with("alphabet", "[1]"),
        with("transitions", r#"[{"from":0,"to":1}]"#),
        with(
            "transitions",
            r#"[{"from":0,"on":"a","to":1,"extra":true}]"#,
        ),
        with("transitions", r#"[{"from":-1,"on":"a","to":1}]"#),
    ] {
        assert_eq!(err(&input).key, "machine.invalid_structure", "{input}");
    }
}

#[test]
fn unsupported_schema_versions_report_the_version() {
    for v in [0i64, 2, 99] {
        let m = err(&with("schemaVersion", &v.to_string()));
        assert_eq!(m.key, "machine.unsupported_schema_version");
        assert_eq!(int(&m, "found"), v);
    }
}

// ---- limits ----

#[test]
fn input_over_one_mebibyte_is_rejected_before_parsing() {
    let padded = format!("{DFSM}{}", " ".repeat(1024 * 1024));
    let m = err(&padded);
    assert_eq!(m.key, "machine.limit_exceeded");
    assert_eq!(text(&m, "what"), "bytes");
    assert_eq!(int(&m, "limit"), 1024 * 1024);
}

#[test]
fn too_many_states_symbols_and_transitions_are_rejected() {
    let states: Vec<String> = (0..2001).map(|n| n.to_string()).collect();
    let m = err(&with("states", &format!("[{}]", states.join(","))));
    assert_eq!(m.key, "machine.limit_exceeded");
    assert_eq!(text(&m, "what"), "states");
    assert_eq!(int(&m, "limit"), 2000);

    let symbols: Vec<String> = (0..257).map(|n| format!("\"s{n}\"")).collect();
    let m = err(&with("alphabet", &format!("[{}]", symbols.join(","))));
    assert_eq!(text(&m, "what"), "symbols");

    let loop_at_0 = Transition {
        from: StateId(0),
        on: None,
        to: StateId(0),
    };
    let m = Fsm::new(
        FsmKind::Ndfsm,
        Alphabet::new(vec![]).unwrap(),
        vec![StateId(0)],
        Some(StateId(0)),
        vec![],
        vec![loop_at_0; 100_001],
    )
    .unwrap_err();
    assert_eq!(text(&m, "what"), "transitions");
    assert_eq!(int(&m, "limit"), 100_000);
}

#[test]
fn symbol_length_limit_is_32_characters() {
    assert!(Alphabet::new(vec!["x".repeat(32)]).is_ok());
    let m = Alphabet::new(vec!["x".repeat(33)]).unwrap_err();
    assert_eq!(m.key, "machine.limit_exceeded");
    assert_eq!(text(&m, "what"), "symbol_length");
    assert_eq!(
        err(&with("alphabet", &format!(r#"["{}"]"#, "x".repeat(33)))).key,
        "machine.limit_exceeded"
    );
}

// ---- model errors ----

#[test]
fn invalid_symbols_are_rejected() {
    for bad in ["", "ε", "a b", "a\tb", "a\u{0}"] {
        let m = Alphabet::new(vec![bad.to_string()]).unwrap_err();
        assert_eq!(m.key, "machine.invalid_symbol", "{bad:?}");
    }
}

#[test]
fn duplicate_symbol_is_rejected() {
    let m = err(&with("alphabet", r#"["a","b","a"]"#));
    assert_eq!(m.key, "machine.duplicate_symbol");
    assert_eq!(text(&m, "symbol"), "a");
}

#[test]
fn duplicate_states_are_rejected() {
    let m = err(&with("states", "[0,1,1]"));
    assert_eq!(m.key, "machine.duplicate_state");
    assert_eq!(int(&m, "state"), 1);
    assert_eq!(
        err(&with("accepting", "[1,1]")).key,
        "machine.duplicate_state"
    );
}

#[test]
fn references_to_missing_states_and_symbols_are_rejected() {
    for (field, value) in [
        ("start", "7"),
        ("accepting", "[7]"),
        ("transitions", r#"[{"from":7,"on":"a","to":0}]"#),
        ("transitions", r#"[{"from":0,"on":"a","to":7}]"#),
    ] {
        let m = err(&with(field, value));
        assert_eq!(m.key, "machine.unknown_state", "{field}");
        assert_eq!(int(&m, "state"), 7);
    }
    let m = err(&with("transitions", r#"[{"from":0,"on":"zzz","to":0}]"#));
    assert_eq!(m.key, "machine.unknown_symbol");
    assert_eq!(text(&m, "symbol"), "zzz");
}

// ---- properties ----

proptest! {
    #[test]
    fn random_machines_round_trip(fsm in arb_fsm()) {
        let json = fsm.to_json();
        let back = Fsm::from_json(&json).unwrap();
        prop_assert_eq!(&back, &fsm);
        prop_assert_eq!(back.to_json(), json);
    }

    #[test]
    fn arbitrary_text_never_panics(s in ".*") {
        let _ = Fsm::from_json(&s);
    }

    #[test]
    fn mutated_valid_json_never_panics(cut in 1usize..400, byte in 0u8..128, at in 0usize..400) {
        let mut bytes = DFSM.as_bytes().to_vec();
        if at < bytes.len() {
            bytes[at] = byte;
        }
        bytes.truncate(cut);
        if let Ok(s) = String::from_utf8(bytes) {
            let _ = Fsm::from_json(&s);
        }
    }
}
