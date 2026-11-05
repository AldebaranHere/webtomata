use engine_core::pda::{Competition, Pda, PdaKind, PdaTransition, determinism, validate_pda};
use engine_core::{Alphabet, Issue, Param, Severity, StateId, SymbolId};
use proptest::prelude::*;

const M1_JSON: &str = r#"{"schemaVersion":1,"kind":"dpda","inputAlphabet":["a","b"],"stackAlphabet":["a"],"states":[0,1],"start":0,"accepting":[0,1],"transitions":[{"from":0,"read":"a","pop":[],"push":["a"],"to":0},{"from":0,"read":"b","pop":["a"],"push":[],"to":1},{"from":1,"read":"b","pop":["a"],"push":[],"to":1}]}"#;

const M2_JSON: &str = r#"{"schemaVersion":1,"kind":"ndpda","inputAlphabet":["a","b"],"stackAlphabet":["a","b"],"states":[0,1],"start":0,"accepting":[1],"transitions":[{"from":0,"read":null,"pop":[],"push":[],"to":1},{"from":0,"read":"a","pop":[],"push":["a"],"to":0},{"from":0,"read":"b","pop":[],"push":["b"],"to":0},{"from":1,"read":"a","pop":["a"],"push":[],"to":1},{"from":1,"read":"b","pop":["b"],"push":[],"to":1}]}"#;

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

#[test]
fn m1_validation_and_determinism() {
    let pda = Pda::from_json(M1_JSON).unwrap();
    assert_eq!(determinism(&pda), vec![]);
    assert_eq!(validate_pda(&pda), vec![]);
}

#[test]
fn m2_validation_and_determinism() {
    let pda = Pda::from_json(M2_JSON).unwrap();
    let comp = determinism(&pda);
    assert_eq!(
        comp,
        vec![
            Competition {
                from: StateId(0),
                first: 0,
                second: 1,
            },
            Competition {
                from: StateId(0),
                first: 0,
                second: 2,
            },
        ]
    );

    // Declared as ndpda: 0 issues
    assert_eq!(validate_pda(&pda), vec![]);

    // Declared as dpda: 2 competing_transitions errors
    let mut dpda_json: serde_json::Value = serde_json::from_str(M2_JSON).unwrap();
    dpda_json["kind"] = serde_json::Value::String("dpda".to_string());
    let dpda = Pda::from_json(&dpda_json.to_string()).unwrap();
    let issues = validate_pda(&dpda);
    assert_eq!(issues.len(), 2);
    assert_eq!(issues[0].severity, Severity::Error);
    assert_eq!(issues[0].message.key, "pda.competing_transitions");
    assert_eq!(int(&issues[0], "from"), 0);
    assert_eq!(int(&issues[0], "first"), 0);
    assert_eq!(int(&issues[0], "second"), 1);

    assert_eq!(issues[1].severity, Severity::Error);
    assert_eq!(issues[1].message.key, "pda.competing_transitions");
    assert_eq!(int(&issues[1], "from"), 0);
    assert_eq!(int(&issues[1], "first"), 0);
    assert_eq!(int(&issues[1], "second"), 2);
}

#[test]
fn prefix_rule_cases() {
    let make_pda = |t1: (&str, Vec<&str>), t2: (&str, Vec<&str>)| -> Pda {
        let t1_read = if t1.0 == "ε" {
            "null".to_string()
        } else {
            format!("\"{}\"", t1.0)
        };
        let t2_read = if t2.0 == "ε" {
            "null".to_string()
        } else {
            format!("\"{}\"", t2.0)
        };
        let t1_pop = serde_json::to_string(&t1.1).unwrap();
        let t2_pop = serde_json::to_string(&t2.1).unwrap();
        let json = format!(
            r#"{{"schemaVersion":1,"kind":"dpda","inputAlphabet":["a","b"],"stackAlphabet":["a","b"],"states":[0],"start":0,"accepting":[0],"transitions":[{{"from":0,"read":{t1_read},"pop":{t1_pop},"push":[],"to":0}},{{"from":0,"read":{t2_read},"pop":{t2_pop},"push":[],"to":0}}]}}"#
        );
        Pda::from_json(&json).unwrap()
    };

    // Case P1: (a, pop [a]) and (a, pop [a, b]) compete
    let p1 = make_pda(("a", vec!["a"]), ("a", vec!["a", "b"]));
    assert_eq!(
        determinism(&p1),
        vec![Competition {
            from: StateId(0),
            first: 0,
            second: 1
        }]
    );

    // Case P2: (a, pop [a]) and (a, pop [b]) do not compete
    let p2 = make_pda(("a", vec!["a"]), ("a", vec!["b"]));
    assert_eq!(determinism(&p2), vec![]);

    // Case P3: (a, pop [a]) and (b, pop [a]) do not compete
    let p3 = make_pda(("a", vec!["a"]), ("b", vec!["a"]));
    assert_eq!(determinism(&p3), vec![]);

    // Case P4: (ε, pop [a]) and (b, pop [a, b]) compete
    let p4 = make_pda(("ε", vec!["a"]), ("b", vec!["a", "b"]));
    assert_eq!(
        determinism(&p4),
        vec![Competition {
            from: StateId(0),
            first: 0,
            second: 1
        }]
    );

    // Case P5: (ε, pop [a, b]) and (b, pop [a]) compete (t1.pop is longer, but sorts first because read is ε)
    let p5 = make_pda(("ε", vec!["a", "b"]), ("b", vec!["a"]));
    assert_eq!(
        determinism(&p5),
        vec![Competition {
            from: StateId(0),
            first: 0,
            second: 1
        }]
    );
}

#[test]
fn accepting_state_free_move_case() {
    // Machine F1: accepting state 1 has (1, ε, [] -> [x], 1)
    let f1_json = r#"{"schemaVersion":1,"kind":"dpda","inputAlphabet":["a"],"stackAlphabet":["x"],"states":[0,1],"start":0,"accepting":[1],"transitions":[{"from":0,"read":"a","pop":[],"push":[],"to":1},{"from":1,"read":null,"pop":[],"push":["x"],"to":1}]}"#;
    let f1 = Pda::from_json(f1_json).unwrap();
    let issues1 = validate_pda(&f1);
    assert!(
        issues1.iter().any(|i| i.severity == Severity::Error
            && i.message.key == "pda.accepting_state_free_move"
            && int(i, "state") == 1),
        "F1 must report accepting_state_free_move for state 1: {issues1:?}"
    );

    // Machine F2: accepting state 1 has (1, ε, [x] -> [], 1) (pops non-empty, so not free)
    let f2_json = r#"{"schemaVersion":1,"kind":"dpda","inputAlphabet":["a"],"stackAlphabet":["x"],"states":[0,1],"start":0,"accepting":[1],"transitions":[{"from":0,"read":"a","pop":[],"push":["x"],"to":1},{"from":1,"read":null,"pop":["x"],"push":[],"to":1}]}"#;
    let f2 = Pda::from_json(f2_json).unwrap();
    let issues2 = validate_pda(&f2);
    assert!(
        !issues2
            .iter()
            .any(|i| i.message.key == "pda.accepting_state_free_move"),
        "F2 must not report accepting_state_free_move: {issues2:?}"
    );
}

#[test]
fn bottom_marker_pop_never_pushed() {
    // (0, ε, [Z] -> [S, Z], 1) with no transition pushing Z
    let json = r#"{"schemaVersion":1,"kind":"ndpda","inputAlphabet":["a"],"stackAlphabet":["S","Z"],"states":[0,1],"start":0,"accepting":[1],"transitions":[{"from":0,"read":null,"pop":["Z"],"push":["S","Z"],"to":1}]}"#;
    let pda = Pda::from_json(json).unwrap();
    let issues = validate_pda(&pda);
    assert!(
        issues.iter().any(|i| i.severity == Severity::Warning
            && i.message.key == "pda.pop_never_pushed"
            && int(i, "from") == 0
            && text(i, "symbol") == "Z"),
        "Must warn pda.pop_never_pushed for symbol Z: {issues:?}"
    );
}

#[test]
fn structural_issues() {
    // No start state
    let json_no_start = r#"{"schemaVersion":1,"kind":"ndpda","inputAlphabet":["a"],"stackAlphabet":["a"],"states":[0],"start":null,"accepting":[0],"transitions":[]}"#;
    let pda_no_start = Pda::from_json(json_no_start).unwrap();
    let issues = validate_pda(&pda_no_start);
    assert!(
        issues
            .iter()
            .any(|i| i.severity == Severity::Error && i.message.key == "pda.no_start_state")
    );

    // No accepting state
    let json_no_acc = r#"{"schemaVersion":1,"kind":"ndpda","inputAlphabet":["a"],"stackAlphabet":["a"],"states":[0],"start":0,"accepting":[],"transitions":[]}"#;
    let pda_no_acc = Pda::from_json(json_no_acc).unwrap();
    let issues_acc = validate_pda(&pda_no_acc);
    assert!(
        issues_acc
            .iter()
            .any(|i| i.severity == Severity::Warning && i.message.key == "pda.no_accepting_state")
    );

    // Unreachable state
    let json_unreach = r#"{"schemaVersion":1,"kind":"ndpda","inputAlphabet":["a"],"stackAlphabet":["a"],"states":[0,1],"start":0,"accepting":[0],"transitions":[]}"#;
    let pda_unreach = Pda::from_json(json_unreach).unwrap();
    let issues_unreach = validate_pda(&pda_unreach);
    assert!(
        issues_unreach
            .iter()
            .any(|i| i.severity == Severity::Warning
                && i.message.key == "pda.unreachable_state"
                && int(i, "state") == 1)
    );

    // Duplicate transition
    let json_dup = r#"{"schemaVersion":1,"kind":"ndpda","inputAlphabet":["a"],"stackAlphabet":["a"],"states":[0],"start":0,"accepting":[0],"transitions":[{"from":0,"read":"a","pop":[],"push":[],"to":0},{"from":0,"read":"a","pop":[],"push":[],"to":0}]}"#;
    let pda_dup = Pda::from_json(json_dup).unwrap();
    let issues_dup = validate_pda(&pda_dup);
    assert!(
        issues_dup.iter().any(
            |i| i.severity == Severity::Warning && i.message.key == "pda.duplicate_transition"
        )
    );
}

prop_compose! {
    fn arb_random_pda()(
        num_transitions in 0usize..10,
    ) -> (Pda, Vec<PdaTransition>) {
        let states = vec![StateId(0), StateId(1)];
        let input = Alphabet::new(vec!["a".to_string(), "b".to_string()]).unwrap();
        let stack = Alphabet::new(vec!["X".to_string(), "Y".to_string()]).unwrap();
        let start = Some(StateId(0));
        let accepting = vec![StateId(1)];
        let mut transitions = Vec::new();
        for i in 0..num_transitions {
            let from = StateId((i % 2) as u32);
            let to = StateId(((i + 1) % 2) as u32);
            let read = if i % 3 == 0 { None } else { Some(SymbolId((i % 2) as u16)) };
            let pop = if i % 2 == 0 { vec![] } else { vec![SymbolId(0)] };
            let push = if i % 4 == 0 { vec![SymbolId(1)] } else { vec![] };
            transitions.push(PdaTransition { from, read, pop, push, to });
        }
        let pda = Pda::new(PdaKind::Ndpda, input, stack, states, start, accepting, transitions.clone()).unwrap();
        (pda, transitions)
    }
}

proptest! {
    #[test]
    fn prop_determinism_symmetry_and_order_independence((pda, transitions) in arb_random_pda()) {
        let comp = determinism(&pda);
        for c in &comp {
            prop_assert!(c.first < c.second);
        }

        // Reversed transitions in Pda::new should result in identical determinism output
        let mut rev_trans = transitions;
        rev_trans.reverse();
        let pda_rev = Pda::new(
            pda.kind,
            pda.input.clone(),
            pda.stack.clone(),
            pda.states.clone(),
            pda.start,
            pda.accepting.clone(),
            rev_trans
        ).unwrap();
        let comp_rev = determinism(&pda_rev);
        prop_assert_eq!(comp, comp_rev);
    }
}
