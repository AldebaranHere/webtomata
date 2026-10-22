use engine_core::{Fsm, Issue, Param, Severity, validate};
use proptest::prelude::*;

mod common;
use common::arb_fsm;

use Severity::{Error, Warning};

/// A machine over the alphabet {a, b}.
fn build(kind: &str, states: &str, start: &str, transitions: &str) -> Fsm {
    Fsm::from_json(&format!(
        r#"{{"schemaVersion":1,"kind":"{kind}","alphabet":["a","b"],"states":{states},"start":{start},"accepting":[],"transitions":{transitions}}}"#
    ))
    .unwrap()
}

const COMPLETE: &str = r#"[{"from":0,"on":"a","to":1},{"from":0,"on":"b","to":0},{"from":1,"on":"a","to":1},{"from":1,"on":"b","to":0}]"#;

fn summary(issues: &[Issue]) -> Vec<(Severity, &'static str)> {
    issues.iter().map(|i| (i.severity, i.message.key)).collect()
}

fn int(i: &Issue, name: &str) -> i64 {
    match i.message.params.get(name) {
        Some(Param::Int(n)) => *n,
        other => panic!("param {name}: {other:?}"),
    }
}

fn text(i: &Issue, name: &str) -> String {
    match i.message.params.get(name) {
        Some(Param::Text(t)) => t.clone(),
        other => panic!("param {name}: {other:?}"),
    }
}

// ---- valid machines ----

#[test]
fn valid_dfsm_has_no_issues() {
    assert_eq!(validate(&build("dfsm", "[0,1]", "0", COMPLETE)), vec![]);
}

#[test]
fn valid_ndfsm_may_have_epsilon_and_missing_transitions() {
    let t = r#"[{"from":0,"on":null,"to":1},{"from":1,"on":"a","to":2}]"#;
    assert_eq!(validate(&build("ndfsm", "[0,1,2]", "0", t)), vec![]);
}

// ---- one test per message key ----

#[test]
fn no_start_state_is_an_error_and_skips_reachability() {
    let issues = validate(&build("dfsm", "[0,1]", "null", COMPLETE));
    assert_eq!(summary(&issues), vec![(Error, "fsm.no_start_state")]);
}

#[test]
fn dfsm_missing_transition_names_state_and_symbol() {
    let t = r#"[{"from":0,"on":"a","to":1},{"from":0,"on":"b","to":0},{"from":1,"on":"a","to":1}]"#;
    let issues = validate(&build("dfsm", "[0,1]", "0", t));
    assert_eq!(summary(&issues), vec![(Error, "dfsm.missing_transition")]);
    assert_eq!(int(&issues[0], "state"), 1);
    assert_eq!(text(&issues[0], "symbol"), "b");
}

#[test]
fn dfsm_duplicate_transition_is_reported_once_per_state_and_symbol() {
    let t = r#"[{"from":0,"on":"a","to":1},{"from":0,"on":"a","to":0},{"from":0,"on":"a","to":0},{"from":0,"on":"b","to":0},{"from":1,"on":"a","to":1},{"from":1,"on":"b","to":0}]"#;
    let issues = validate(&build("dfsm", "[0,1]", "0", t));
    assert_eq!(summary(&issues), vec![(Error, "dfsm.duplicate_transition")]);
    assert_eq!(int(&issues[0], "state"), 0);
    assert_eq!(text(&issues[0], "symbol"), "a");
}

#[test]
fn dfsm_epsilon_transition_is_an_error() {
    let t = r#"[{"from":0,"on":"a","to":1},{"from":0,"on":"b","to":0},{"from":1,"on":"a","to":1},{"from":1,"on":"b","to":0},{"from":1,"on":null,"to":0}]"#;
    let issues = validate(&build("dfsm", "[0,1]", "0", t));
    assert_eq!(summary(&issues), vec![(Error, "dfsm.epsilon_transition")]);
    assert_eq!(int(&issues[0], "from"), 1);
    assert_eq!(int(&issues[0], "to"), 0);
}

#[test]
fn unreachable_state_is_a_warning() {
    let t = r#"[{"from":0,"on":"a","to":0},{"from":2,"on":"a","to":0}]"#;
    let issues = validate(&build("ndfsm", "[0,1,2]", "0", t));
    assert_eq!(
        summary(&issues),
        vec![
            (Warning, "fsm.unreachable_state"),
            (Warning, "fsm.unreachable_state")
        ]
    );
    assert_eq!(int(&issues[0], "state"), 1);
    assert_eq!(int(&issues[1], "state"), 2);
}

#[test]
fn a_state_reached_only_through_epsilon_is_reachable() {
    let t = r#"[{"from":0,"on":null,"to":1}]"#;
    assert_eq!(validate(&build("ndfsm", "[0,1]", "0", t)), vec![]);
}

// ---- order and budget ----

#[test]
fn issues_come_in_a_fixed_order() {
    let t =
        r#"[{"from":0,"on":"a","to":0},{"from":0,"on":"a","to":1},{"from":1,"on":null,"to":0}]"#;
    let issues = validate(&build("dfsm", "[0,1,2]", "0", t));
    assert_eq!(
        summary(&issues),
        vec![
            (Error, "dfsm.duplicate_transition"), // state 0, a
            (Error, "dfsm.missing_transition"),   // state 0, b
            (Error, "dfsm.missing_transition"),   // state 1, a
            (Error, "dfsm.missing_transition"),   // state 1, b
            (Error, "dfsm.missing_transition"),   // state 2, a
            (Error, "dfsm.missing_transition"),   // state 2, b
            (Error, "dfsm.epsilon_transition"),   // 1 -> 0
            (Warning, "fsm.unreachable_state"),   // state 2
        ]
    );
}

#[test]
fn the_list_stops_at_1000_issues_with_a_marker() {
    let states: Vec<String> = (0..2000).map(|n| n.to_string()).collect();
    let fsm = build("dfsm", &format!("[{}]", states.join(",")), "0", "[]");
    let issues = validate(&fsm);
    assert_eq!(issues.len(), 1001);
    assert!(
        issues[..1000]
            .iter()
            .all(|i| i.message.key == "dfsm.missing_transition")
    );
    let last = &issues[1000];
    assert_eq!(
        (last.severity, last.message.key),
        (Warning, "fsm.too_many_issues")
    );
    assert_eq!(int(last, "limit"), 1000);
}

// ---- properties ----

fn complete_dfsm_json(n: usize, k: usize, targets: &[usize]) -> String {
    let symbols: Vec<String> = (0..k).map(|i| format!("\"s{i}\"")).collect();
    let states: Vec<String> = (0..n).map(|i| i.to_string()).collect();
    let mut edges = Vec::new();
    for s in 0..n {
        for a in 0..k {
            let to = targets[(s * k + a) % targets.len()] % n;
            edges.push(format!(r#"{{"from":{s},"on":"s{a}","to":{to}}}"#));
        }
    }
    format!(
        r#"{{"schemaVersion":1,"kind":"dfsm","alphabet":[{}],"states":[{}],"start":0,"accepting":[],"transitions":[{}]}}"#,
        symbols.join(","),
        states.join(","),
        edges.join(",")
    )
}

proptest! {
    #[test]
    fn complete_dfsm_has_no_errors(
        n in 1usize..6,
        k in 1usize..4,
        targets in prop::collection::vec(0usize..6, 1..24),
    ) {
        let fsm = Fsm::from_json(&complete_dfsm_json(n, k, &targets)).unwrap();
        prop_assert!(validate(&fsm).iter().all(|i| i.severity != Error));
    }

    #[test]
    fn validate_is_deterministic_and_ndfsm_never_gets_dfsm_keys(fsm in arb_fsm()) {
        let first = validate(&fsm);
        prop_assert_eq!(&first, &validate(&fsm));
        if fsm.kind == engine_core::FsmKind::Ndfsm {
            prop_assert!(first.iter().all(|i| !i.message.key.starts_with("dfsm.")));
        }
    }
}
