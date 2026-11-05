use engine_core::{
    Alphabet, JffState, MAX_JFF_BYTES, Param, Pda, PdaBudget, PdaJff, PdaKind, PdaSimulation,
    PdaTransition, StateId, SymbolId, export_pda_jff, import_pda_jff, parse_jff, parse_pda_jff,
    simulate_pda, to_pda_jff, validate_pda,
};
use proptest::prelude::*;
use std::collections::BTreeSet;

/// Fixture F1 in JFLAP layout: header comment, XML comments, tabs, and &#13;\n.
const F1_XML: &str = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?><!--Created with JFLAP 7.1.--><structure>&#13;\n\t<type>pda</type>&#13;\n\t<automaton>&#13;\n\t\t<!--The list of states.-->&#13;\n\t\t<state id=\"0\" name=\"q0\">&#13;\n\t\t\t<x>100.0</x>&#13;\n\t\t\t<y>100.0</y>&#13;\n\t\t\t<initial/>&#13;\n\t\t</state>&#13;\n\t\t<state id=\"1\" name=\"q1\">&#13;\n\t\t\t<x>200.0</x>&#13;\n\t\t\t<y>100.0</y>&#13;\n\t\t</state>&#13;\n\t\t<state id=\"2\" name=\"q2\">&#13;\n\t\t\t<x>300.0</x>&#13;\n\t\t\t<y>100.0</y>&#13;\n\t\t</state>&#13;\n\t\t<state id=\"3\" name=\"q3\">&#13;\n\t\t\t<x>400.0</x>&#13;\n\t\t\t<y>100.0</y>&#13;\n\t\t\t<final/>&#13;\n\t\t</state>&#13;\n\t\t<!--The list of transitions.-->&#13;\n\t\t<transition>&#13;\n\t\t\t<from>0</from>&#13;\n\t\t\t<to>1</to>&#13;\n\t\t\t<read/>&#13;\n\t\t\t<pop/>&#13;\n\t\t\t<push>Z0</push>&#13;\n\t\t</transition>&#13;\n\t\t<transition>&#13;\n\t\t\t<from>1</from>&#13;\n\t\t\t<to>1</to>&#13;\n\t\t\t<read>a</read>&#13;\n\t\t\t<pop/>&#13;\n\t\t\t<push>A</push>&#13;\n\t\t</transition>&#13;\n\t\t<transition>&#13;\n\t\t\t<from>1</from>&#13;\n\t\t\t<to>2</to>&#13;\n\t\t\t<read>b</read>&#13;\n\t\t\t<pop>A</pop>&#13;\n\t\t\t<push/>&#13;\n\t\t</transition>&#13;\n\t\t<transition>&#13;\n\t\t\t<from>2</from>&#13;\n\t\t\t<to>2</to>&#13;\n\t\t\t<read>b</read>&#13;\n\t\t\t<pop>A</pop>&#13;\n\t\t\t<push/>&#13;\n\t\t</transition>&#13;\n\t\t<transition>&#13;\n\t\t\t<from>1</from>&#13;\n\t\t\t<to>3</to>&#13;\n\t\t\t<read/>&#13;\n\t\t\t<pop>Z0</pop>&#13;\n\t\t\t<push/>&#13;\n\t\t</transition>&#13;\n\t\t<transition>&#13;\n\t\t\t<from>2</from>&#13;\n\t\t\t<to>3</to>&#13;\n\t\t\t<read/>&#13;\n\t\t\t<pop>Z0</pop>&#13;\n\t\t\t<push/>&#13;\n\t\t</transition>&#13;\n\t</automaton>&#13;\n</structure>";

/// Fixture F2: JFLAP LL grammar conversion style.
const F2_XML: &str = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?><!--Created with JFLAP 7.1.--><structure>&#13;\n\t<type>pda</type>&#13;\n\t<automaton>&#13;\n\t\t<!--The list of states.-->&#13;\n\t\t<state id=\"0\" name=\"q0\">&#13;\n\t\t\t<x>100.0</x>&#13;\n\t\t\t<y>100.0</y>&#13;\n\t\t\t<initial/>&#13;\n\t\t</state>&#13;\n\t\t<state id=\"1\" name=\"q1\">&#13;\n\t\t\t<x>200.0</x>&#13;\n\t\t\t<y>100.0</y>&#13;\n\t\t</state>&#13;\n\t\t<state id=\"2\" name=\"q2\">&#13;\n\t\t\t<x>300.0</x>&#13;\n\t\t\t<y>100.0</y>&#13;\n\t\t\t<final/>&#13;\n\t\t</state>&#13;\n\t\t<!--The list of transitions.-->&#13;\n\t\t<transition>&#13;\n\t\t\t<from>0</from>&#13;\n\t\t\t<to>1</to>&#13;\n\t\t\t<read/>&#13;\n\t\t\t<pop>Z</pop>&#13;\n\t\t\t<push>SZ</push>&#13;\n\t\t</transition>&#13;\n\t\t<transition>&#13;\n\t\t\t<from>1</from>&#13;\n\t\t\t<to>1</to>&#13;\n\t\t\t<read/>&#13;\n\t\t\t<pop>S</pop>&#13;\n\t\t\t<push>aSb</push>&#13;\n\t\t</transition>&#13;\n\t\t<transition>&#13;\n\t\t\t<from>1</from>&#13;\n\t\t\t<to>1</to>&#13;\n\t\t\t<read/>&#13;\n\t\t\t<pop>S</pop>&#13;\n\t\t\t<push>ab</push>&#13;\n\t\t</transition>&#13;\n\t\t<transition>&#13;\n\t\t\t<from>1</from>&#13;\n\t\t\t<to>1</to>&#13;\n\t\t\t<read>a</read>&#13;\n\t\t\t<pop>a</pop>&#13;\n\t\t\t<push/>&#13;\n\t\t</transition>&#13;\n\t\t<transition>&#13;\n\t\t\t<from>1</from>&#13;\n\t\t\t<to>1</to>&#13;\n\t\t\t<read>b</read>&#13;\n\t\t\t<pop>b</pop>&#13;\n\t\t\t<push/>&#13;\n\t\t</transition>&#13;\n\t\t<transition>&#13;\n\t\t\t<from>1</from>&#13;\n\t\t\t<to>2</to>&#13;\n\t\t\t<read/>&#13;\n\t\t\t<pop>Z</pop>&#13;\n\t\t\t<push/>&#13;\n\t\t</transition>&#13;\n\t</automaton>&#13;\n</structure>";

fn make_pda_jff(
    states: &[(u32, &str, f64, f64)],
    transitions: &[(u32, u32, &str, &str, &str)],
) -> String {
    let mut out = String::from(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\n<structure>\n\t<type>pda</type>\n\t<automaton>\n",
    );
    for (id, flags, x, y) in states {
        out.push_str(&format!(
            "\t\t<state id=\"{id}\" name=\"q{id}\">\n\t\t\t<x>{x:.1}</x>\n\t\t\t<y>{y:.1}</y>\n"
        ));
        if flags.contains('i') {
            out.push_str("\t\t\t<initial/>\n");
        }
        if flags.contains('f') {
            out.push_str("\t\t\t<final/>\n");
        }
        out.push_str("\t\t</state>\n");
    }
    for (from, to, read, pop, push) in transitions {
        out.push_str(&format!(
            "\t\t<transition>\n\t\t\t<from>{from}</from>\n\t\t\t<to>{to}</to>\n"
        ));
        if read.is_empty() {
            out.push_str("\t\t\t<read/>\n");
        } else {
            out.push_str(&format!("\t\t\t<read>{read}</read>\n"));
        }
        if pop.is_empty() {
            out.push_str("\t\t\t<pop/>\n");
        } else {
            out.push_str(&format!("\t\t\t<pop>{pop}</pop>\n"));
        }
        if push.is_empty() {
            out.push_str("\t\t\t<push/>\n");
        } else {
            out.push_str(&format!("\t\t\t<push>{push}</push>\n"));
        }
        out.push_str("\t\t</transition>\n");
    }
    out.push_str("\t</automaton>\n</structure>\n");
    out
}

fn m1() -> Pda {
    let input = Alphabet::new(vec!["a".to_string(), "b".to_string()]).unwrap();
    let stack = Alphabet::new(vec!["a".to_string()]).unwrap();
    Pda::new(
        PdaKind::Dpda,
        input,
        stack,
        vec![StateId(0), StateId(1)],
        Some(StateId(0)),
        vec![StateId(0), StateId(1)],
        vec![
            PdaTransition {
                from: StateId(0),
                read: Some(SymbolId(0)),
                pop: vec![],
                push: vec![SymbolId(0)],
                to: StateId(0),
            },
            PdaTransition {
                from: StateId(0),
                read: Some(SymbolId(1)),
                pop: vec![SymbolId(0)],
                push: vec![],
                to: StateId(1),
            },
            PdaTransition {
                from: StateId(1),
                read: Some(SymbolId(1)),
                pop: vec![SymbolId(0)],
                push: vec![],
                to: StateId(1),
            },
        ],
    )
    .unwrap()
}

fn m2() -> Pda {
    let input = Alphabet::new(vec!["a".to_string(), "b".to_string()]).unwrap();
    let stack = Alphabet::new(vec!["a".to_string(), "b".to_string()]).unwrap();
    Pda::new(
        PdaKind::Ndpda,
        input,
        stack,
        vec![StateId(0), StateId(1)],
        Some(StateId(0)),
        vec![StateId(1)],
        vec![
            PdaTransition {
                from: StateId(0),
                read: None,
                pop: vec![],
                push: vec![],
                to: StateId(1),
            },
            PdaTransition {
                from: StateId(0),
                read: Some(SymbolId(0)),
                pop: vec![],
                push: vec![SymbolId(0)],
                to: StateId(0),
            },
            PdaTransition {
                from: StateId(0),
                read: Some(SymbolId(1)),
                pop: vec![],
                push: vec![SymbolId(1)],
                to: StateId(0),
            },
            PdaTransition {
                from: StateId(1),
                read: Some(SymbolId(0)),
                pop: vec![SymbolId(0)],
                push: vec![],
                to: StateId(1),
            },
            PdaTransition {
                from: StateId(1),
                read: Some(SymbolId(1)),
                pop: vec![SymbolId(1)],
                push: vec![],
                to: StateId(1),
            },
        ],
    )
    .unwrap()
}

// -------------------------------------------------------------------------
// AC1: Fixtures F1 and F2
// -------------------------------------------------------------------------

#[test]
fn fixture_f1_imports_and_simulates_correctly() {
    let PdaJff { pda, states } = parse_pda_jff(F1_XML).expect("F1 must parse");

    assert_eq!(pda.kind, PdaKind::Ndpda);
    assert_eq!(pda.input.names(), &["a", "b"]);
    assert_eq!(pda.stack.names(), &["0", "A", "Z"]);
    assert_eq!(
        pda.states,
        vec![StateId(0), StateId(1), StateId(2), StateId(3)]
    );
    assert_eq!(pda.start, Some(StateId(0)));
    assert_eq!(pda.accepting, vec![StateId(3)]);
    assert_eq!(states.len(), 4);

    let issues = validate_pda(&pda);
    assert!(
        issues.is_empty(),
        "F1 must have no validation issues: {issues:?}"
    );

    // Check transition 0 -> 1 pushes Z then 0 (Z on top)
    let t0 = &pda.transitions[0];
    assert_eq!(t0.from, StateId(0));
    assert_eq!(t0.to, StateId(1));
    assert_eq!(t0.read, None);
    assert_eq!(t0.pop, vec![]);
    let z_id = pda.stack.id("Z").unwrap();
    let zero_id = pda.stack.id("0").unwrap();
    assert_eq!(t0.push, vec![z_id, zero_id]);

    let test_run = |input_str: &str| {
        let syms = pda.input.tokenize(input_str).unwrap();
        simulate_pda(&pda, &syms, PdaBudget::default()).unwrap()
    };

    // Accepted cases
    match test_run("") {
        PdaSimulation::Finished { accepted, .. } => assert!(accepted),
        _ => panic!("empty string must finish"),
    }
    match test_run("ab") {
        PdaSimulation::Finished { accepted, .. } => assert!(accepted),
        _ => panic!("ab must finish"),
    }
    match test_run("aabb") {
        PdaSimulation::Finished { accepted, .. } => assert!(accepted),
        _ => panic!("aabb must finish"),
    }

    // Rejected cases
    match test_run("a") {
        PdaSimulation::Finished {
            accepted: false,
            trace,
            ..
        } => {
            let last_msg = &trace.last().unwrap().message;
            assert_eq!(last_msg.key, "pda.sim.input_left");
            assert_eq!(last_msg.params.get("left"), Some(&Param::Int(1)));
        }
        other => panic!("a rejected expectation failed: {other:?}"),
    }
    match test_run("aab") {
        PdaSimulation::Finished {
            accepted: false,
            trace,
            ..
        } => {
            let last_msg = &trace.last().unwrap().message;
            assert_eq!(last_msg.key, "pda.sim.input_left");
            assert_eq!(last_msg.params.get("left"), Some(&Param::Int(3)));
        }
        other => panic!("aab rejected expectation failed: {other:?}"),
    }
    match test_run("abb") {
        PdaSimulation::Finished {
            accepted: false,
            trace,
            ..
        } => {
            let last_msg = &trace.last().unwrap().message;
            assert_eq!(last_msg.key, "pda.sim.input_left");
            assert_eq!(last_msg.params.get("left"), Some(&Param::Int(1)));
        }
        other => panic!("abb rejected expectation failed: {other:?}"),
    }
    match test_run("b") {
        PdaSimulation::Finished {
            accepted: false,
            trace,
            ..
        } => {
            let last_msg = &trace.last().unwrap().message;
            assert_eq!(last_msg.key, "pda.sim.input_left");
            assert_eq!(last_msg.params.get("left"), Some(&Param::Int(1)));
        }
        other => panic!("b rejected expectation failed: {other:?}"),
    }
}

#[test]
fn fixture_f2_imports_and_reports_pop_never_pushed() {
    let PdaJff { pda, .. } = parse_pda_jff(F2_XML).expect("F2 must parse");

    assert_eq!(pda.kind, PdaKind::Ndpda);
    assert_eq!(pda.input.names(), &["a", "b"]);
    assert_eq!(pda.stack.names(), &["S", "Z", "a", "b"]);

    let issues = validate_pda(&pda);
    let mut pop_never_pushed: Vec<(u32, String)> = issues
        .iter()
        .filter(|iss| iss.message.key == "pda.pop_never_pushed")
        .map(|iss| {
            let from = match iss.message.params.get("from") {
                Some(Param::Int(n)) => *n as u32,
                _ => panic!("missing from"),
            };
            let sym = match iss.message.params.get("symbol") {
                Some(Param::Text(t)) => t.clone(),
                _ => panic!("missing symbol"),
            };
            (from, sym)
        })
        .collect();
    pop_never_pushed.sort();

    assert_eq!(
        pop_never_pushed,
        vec![
            (0, "Z".to_string()),
            (1, "S".to_string()),
            (1, "Z".to_string()),
            (1, "a".to_string()),
            (1, "b".to_string()),
        ]
    );

    // Simulation of aabb: rejected immediately with input_left = 4
    let syms = pda.input.tokenize("aabb").unwrap();
    match simulate_pda(&pda, &syms, PdaBudget::default()).unwrap() {
        PdaSimulation::Finished {
            accepted: false,
            trace,
            ..
        } => {
            assert_eq!(trace.len(), 1);
            let msg = &trace[0].message;
            assert_eq!(msg.key, "pda.sim.input_left");
            assert_eq!(msg.params.get("left"), Some(&Param::Int(4)));
        }
        other => panic!("aabb must reject immediately: {other:?}"),
    }
}

// -------------------------------------------------------------------------
// AC2: Export, idempotence and round-trip
// -------------------------------------------------------------------------

#[test]
fn export_m1_round_trips_and_is_idempotent() {
    let machine = m1();
    let layout = vec![
        JffState {
            id: StateId(0),
            name: "start".into(),
            x: 50.0,
            y: 50.0,
        },
        JffState {
            id: StateId(1),
            name: "accept".into(),
            x: 200.0,
            y: 50.0,
        },
    ];

    let xml = to_pda_jff(&machine, &layout).expect("export m1 must succeed");
    assert!(xml.contains("<type>pda</type>"));
    assert!(!xml.contains("<!--Created with JFLAP")); // mirrors to_jff: no comments

    let PdaJff {
        pda: imported,
        states: imported_layout,
    } = parse_pda_jff(&xml).expect("reimport must succeed");
    assert_eq!(imported.kind, PdaKind::Ndpda); // kind becomes ndpda
    assert_eq!(imported.input.names(), machine.input.names());
    assert_eq!(imported.stack.names(), machine.stack.names());
    assert_eq!(imported.states, machine.states);
    assert_eq!(imported.start, machine.start);
    assert_eq!(imported.accepting, machine.accepting);
    assert_eq!(imported.transitions, machine.transitions);
    assert_eq!(imported_layout, layout);

    let xml2 = to_pda_jff(&imported, &imported_layout).expect("second export must succeed");
    assert_eq!(xml, xml2, "export must be idempotent");
}

#[test]
fn export_m2_writes_empty_read_pop_push_tags() {
    let machine = m2();
    let xml = to_pda_jff(&machine, &[]).expect("export m2 must succeed");
    // ε-guess transition from 0 to 1 should have <read/>, <pop/>, <push/>
    assert!(xml.contains("<transition>\n\t\t\t<from>0</from>\n\t\t\t<to>1</to>\n\t\t\t<read/>\n\t\t\t<pop/>\n\t\t\t<push/>\n\t\t</transition>"));
}

// -------------------------------------------------------------------------
// AC3 & Rule 6: Order and Boundary Tests
// -------------------------------------------------------------------------

#[test]
fn pop_and_push_order_is_explicitly_preserved() {
    let input = Alphabet::new(vec!["a".to_string()]).unwrap();
    let stack = Alphabet::new(vec!["a".to_string(), "b".to_string(), "S".to_string()]).unwrap();
    let pda = Pda::new(
        PdaKind::Ndpda,
        input,
        stack,
        vec![StateId(0), StateId(1)],
        Some(StateId(0)),
        vec![StateId(1)],
        vec![PdaTransition {
            from: StateId(0),
            read: None,
            pop: vec![SymbolId(0), SymbolId(1)], // [a, b]
            push: vec![SymbolId(0), SymbolId(2), SymbolId(1)], // [a, S, b]
            to: StateId(1),
        }],
    )
    .unwrap();

    let xml = to_pda_jff(&pda, &[]).unwrap();
    assert!(xml.contains("<pop>ab</pop>"));
    assert!(xml.contains("<push>aSb</push>"));

    let PdaJff { pda: imported, .. } = parse_pda_jff(&xml).unwrap();
    let t = &imported.transitions[0];
    let a_id = imported.stack.id("a").unwrap();
    let b_id = imported.stack.id("b").unwrap();
    let s_id = imported.stack.id("S").unwrap();
    assert_eq!(t.pop, vec![a_id, b_id]);
    assert_eq!(t.push, vec![a_id, s_id, b_id]);
}

#[test]
fn pop_and_push_length_boundary_64_accepted_65_refused() {
    let s64 = "a".repeat(64);
    let s65 = "a".repeat(65);

    let xml_64 = make_pda_jff(
        &[(0, "i", 0.0, 0.0), (1, "f", 100.0, 0.0)],
        &[(0, 1, "a", &s64, &s64)],
    );
    assert!(parse_pda_jff(&xml_64).is_ok());

    let xml_pop_65 = make_pda_jff(
        &[(0, "i", 0.0, 0.0), (1, "f", 100.0, 0.0)],
        &[(0, 1, "a", &s65, "")],
    );
    let err = parse_pda_jff(&xml_pop_65).unwrap_err();
    assert_eq!(err.key, "machine.limit_exceeded");
    assert_eq!(
        err.params.get("what"),
        Some(&Param::Text("pda_string".into()))
    );
    assert_eq!(err.params.get("limit"), Some(&Param::Int(64)));

    let xml_push_65 = make_pda_jff(
        &[(0, "i", 0.0, 0.0), (1, "f", 100.0, 0.0)],
        &[(0, 1, "a", "", &s65)],
    );
    let err2 = parse_pda_jff(&xml_push_65).unwrap_err();
    assert_eq!(err2.key, "machine.limit_exceeded");
    assert_eq!(
        err2.params.get("what"),
        Some(&Param::Text("pda_string".into()))
    );
    assert_eq!(err2.params.get("limit"), Some(&Param::Int(64)));
}

#[test]
fn file_size_boundary_max_bytes_accepted_plus_one_refused() {
    let base = make_pda_jff(
        &[(0, "i", 0.0, 0.0), (1, "f", 100.0, 0.0)],
        &[(0, 1, "a", "x", "y")],
    );
    let padding_len = MAX_JFF_BYTES - base.len();
    let exact = format!("{base}{}", " ".repeat(padding_len));
    assert_eq!(exact.len(), MAX_JFF_BYTES);
    assert!(parse_pda_jff(&exact).is_ok());

    let too_large = format!("{exact} ");
    let err = parse_pda_jff(&too_large).unwrap_err();
    assert_eq!(err.key, "machine.limit_exceeded");
    assert_eq!(err.params.get("what"), Some(&Param::Text("bytes".into())));
    assert_eq!(
        err.params.get("limit"),
        Some(&Param::Int(MAX_JFF_BYTES as i64))
    );
}

#[test]
fn read_single_char_accepted_multiple_chars_refused_with_key() {
    let xml_single = make_pda_jff(
        &[(0, "i", 0.0, 0.0), (1, "f", 100.0, 0.0)],
        &[(0, 1, "a", "", "")],
    );
    assert!(parse_pda_jff(&xml_single).is_ok());

    let xml_double = make_pda_jff(
        &[(0, "i", 0.0, 0.0), (1, "f", 100.0, 0.0)],
        &[(0, 1, "ab", "", "")],
    );
    let err = parse_pda_jff(&xml_double).unwrap_err();
    assert_eq!(err.key, "jff.pda_read_not_single");
    assert_eq!(err.params.get("label"), Some(&Param::Text("ab".into())));
    assert_eq!(err.params.get("from"), Some(&Param::Int(0)));
    assert_eq!(err.params.get("to"), Some(&Param::Int(1)));
}

// -------------------------------------------------------------------------
// AC4 & Rule 9: Error Cases and Editor Bridge
// -------------------------------------------------------------------------

#[test]
fn fa_type_refused_by_pda_importer() {
    let xml = "<structure><type>fa</type><automaton/></structure>";
    let err = parse_pda_jff(xml).unwrap_err();
    assert_eq!(err.key, "jff.unsupported_type");
    assert_eq!(err.params.get("type"), Some(&Param::Text("fa".into())));
}

#[test]
fn pda_type_refused_by_fsm_importer_with_pda_type() {
    // Rule 9 requirement for editor router
    let err = parse_jff(F1_XML).unwrap_err();
    assert_eq!(err.key, "jff.unsupported_type");
    assert_eq!(err.params.get("type"), Some(&Param::Text("pda".into())));
}

#[test]
fn missing_transition_elements_refused() {
    let no_pop = "<structure><type>pda</type><automaton><state id=\"0\" name=\"q0\"/><transition><from>0</from><to>0</to><read>a</read><push/></transition></automaton></structure>";
    let err = parse_pda_jff(no_pop).unwrap_err();
    assert_eq!(err.key, "jff.invalid_structure");
    assert_eq!(err.params.get("element"), Some(&Param::Text("pop".into())));

    let no_push = "<structure><type>pda</type><automaton><state id=\"0\" name=\"q0\"/><transition><from>0</from><to>0</to><read>a</read><pop/></transition></automaton></structure>";
    let err = parse_pda_jff(no_push).unwrap_err();
    assert_eq!(err.key, "jff.invalid_structure");
    assert_eq!(err.params.get("element"), Some(&Param::Text("push".into())));

    let no_read = "<structure><type>pda</type><automaton><state id=\"0\" name=\"q0\"/><transition><from>0</from><to>0</to><pop/><push/></transition></automaton></structure>";
    let err = parse_pda_jff(no_read).unwrap_err();
    assert_eq!(err.key, "jff.invalid_structure");
    assert_eq!(err.params.get("element"), Some(&Param::Text("read".into())));
}

#[test]
fn multiple_initial_states_refused() {
    let xml = make_pda_jff(&[(0, "i", 0.0, 0.0), (1, "i", 100.0, 0.0)], &[]);
    let err = parse_pda_jff(&xml).unwrap_err();
    assert_eq!(err.key, "jff.multiple_initial_states");
}

#[test]
fn dtd_and_malformed_xml_refused() {
    let dtd =
        "<!DOCTYPE structure [ <!ELEMENT structure ANY > ]><structure><type>pda</type></structure>";
    let err = parse_pda_jff(dtd).unwrap_err();
    assert_eq!(err.key, "jff.xml_invalid");

    let malformed = "<structure><type>pda</type><automaton>";
    let err2 = parse_pda_jff(malformed).unwrap_err();
    assert_eq!(err2.key, "jff.xml_invalid");
}

#[test]
fn export_multi_character_symbol_refused() {
    let input = Alphabet::new(vec!["num".to_string()]).unwrap();
    let stack = Alphabet::new(vec!["a".to_string()]).unwrap();
    let pda_bad_input = Pda::new(
        PdaKind::Ndpda,
        input,
        stack,
        vec![StateId(0)],
        Some(StateId(0)),
        vec![],
        vec![],
    )
    .unwrap();
    let err1 = to_pda_jff(&pda_bad_input, &[]).unwrap_err();
    assert_eq!(err1.key, "jff.symbol_not_single_character");
    assert_eq!(err1.params.get("symbol"), Some(&Param::Text("num".into())));

    let input2 = Alphabet::new(vec!["a".to_string()]).unwrap();
    let stack2 = Alphabet::new(vec!["Z0".to_string()]).unwrap();
    let pda_bad_stack = Pda::new(
        PdaKind::Ndpda,
        input2,
        stack2,
        vec![StateId(0)],
        Some(StateId(0)),
        vec![],
        vec![],
    )
    .unwrap();
    let err2 = to_pda_jff(&pda_bad_stack, &[]).unwrap_err();
    assert_eq!(err2.key, "jff.symbol_not_single_character");
    assert_eq!(err2.params.get("symbol"), Some(&Param::Text("Z0".into())));
}

#[test]
fn api_envelope_works_for_pda_jff() {
    let import_res = import_pda_jff(F1_XML);
    assert!(import_res.contains(r#""ok":true"#));
    assert!(import_res.contains(r#""kind":"ndpda""#));

    let export_res = export_pda_jff(
        r#"{"schemaVersion":1,"kind":"ndpda","inputAlphabet":["a","b"],"stackAlphabet":["a"],"states":[0,1],"start":0,"accepting":[1],"transitions":[{"from":0,"read":"a","pop":[],"push":["a"],"to":1}]}"#,
        r#"[{"id":0,"name":"q0","x":100.0,"y":100.0}]"#,
    );
    assert!(export_res.contains(r#""ok":true"#));
    assert!(export_res.contains("<type>pda</type>"));
}

// -------------------------------------------------------------------------
// AC3 & AC4: Property Tests (Round-trip & Fuzzing)
// -------------------------------------------------------------------------

fn arb_pda() -> impl Strategy<Value = Pda> {
    let sym_chars = vec!['a', 'b', '$', '<', '&', '"', '\''];
    (
        1usize..=4, // num states
        prop::collection::vec(
            (
                0u32..4,                                                               // from
                0u32..4,                                                               // to
                prop::option::of(prop::sample::select(sym_chars.clone())),             // read
                prop::collection::vec(prop::sample::select(sym_chars.clone()), 0..=3), // pop
                prop::collection::vec(prop::sample::select(sym_chars), 0..=3),         // push
            ),
            0..=6, // num transitions
        ),
    )
        .prop_map(move |(num_states, raw_transitions)| {
            let states: Vec<StateId> = (0..num_states as u32).map(StateId).collect();
            let mut input_syms = BTreeSet::new();
            let mut stack_syms = BTreeSet::new();

            for (_, _, r, pop, push) in &raw_transitions {
                if let Some(c) = r {
                    input_syms.insert(c.to_string());
                }
                for c in pop {
                    stack_syms.insert(c.to_string());
                }
                for c in push {
                    stack_syms.insert(c.to_string());
                }
            }
            if input_syms.is_empty() {
                input_syms.insert("a".to_string());
            }
            if stack_syms.is_empty() {
                stack_syms.insert("Z".to_string());
            }

            let input_alpha = Alphabet::new(input_syms.into_iter().collect()).unwrap();
            let stack_alpha = Alphabet::new(stack_syms.into_iter().collect()).unwrap();

            let transitions = raw_transitions
                .into_iter()
                .map(|(from, to, r, pop, push)| PdaTransition {
                    from: StateId(from % num_states as u32),
                    to: StateId(to % num_states as u32),
                    read: r.and_then(|c| input_alpha.id(&c.to_string())),
                    pop: pop
                        .into_iter()
                        .map(|c| stack_alpha.id(&c.to_string()).unwrap())
                        .collect(),
                    push: push
                        .into_iter()
                        .map(|c| stack_alpha.id(&c.to_string()).unwrap())
                        .collect(),
                })
                .collect();

            Pda::new(
                PdaKind::Ndpda,
                input_alpha,
                stack_alpha,
                states,
                Some(StateId(0)),
                vec![StateId(0)],
                transitions,
            )
            .unwrap()
        })
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(50))]

    #[test]
    fn proptest_pda_jff_round_trip(pda in arb_pda()) {
        let xml1 = to_pda_jff(&pda, &[]).expect("export should succeed");
        let PdaJff { pda: imported, states } = parse_pda_jff(&xml1).expect("import should succeed");
        let xml2 = to_pda_jff(&imported, &states).expect("second export should succeed");

        prop_assert_eq!(&xml1, &xml2, "round trip XML must be identical");

        // Compare transitions by symbol names
        prop_assert_eq!(pda.transitions.len(), imported.transitions.len());
        for (t_orig, t_imp) in pda.transitions.iter().zip(imported.transitions.iter()) {
            prop_assert_eq!(t_orig.from, t_imp.from);
            prop_assert_eq!(t_orig.to, t_imp.to);
            let orig_read = t_orig.read.map(|s| pda.input.name(s).unwrap());
            let imp_read = t_imp.read.map(|s| imported.input.name(s).unwrap());
            prop_assert_eq!(orig_read, imp_read);

            let orig_pop: Vec<&str> = t_orig.pop.iter().map(|&s| pda.stack.name(s).unwrap()).collect();
            let imp_pop: Vec<&str> = t_imp.pop.iter().map(|&s| imported.stack.name(s).unwrap()).collect();
            prop_assert_eq!(orig_pop, imp_pop);

            let orig_push: Vec<&str> = t_orig.push.iter().map(|&s| pda.stack.name(s).unwrap()).collect();
            let imp_push: Vec<&str> = t_imp.push.iter().map(|&s| imported.stack.name(s).unwrap()).collect();
            prop_assert_eq!(orig_push, imp_push);
        }
    }

    #[test]
    fn proptest_parse_pda_jff_never_panics(s in "\\PC*") {
        let _ = parse_pda_jff(&s);
    }
}
