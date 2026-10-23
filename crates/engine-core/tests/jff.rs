use engine_core::{
    Budget, Fsm, FsmKind, Jff, JffState, MAX_JFF_BYTES, Message, Param, Simulation, StateId,
    parse_jff, simulate, to_jff,
};
use proptest::prelude::*;
use std::collections::HashSet;

mod common;
use common::machine;

/// A file in the style that JFLAP writes: header comment, comments inside, tabs, and `&#13;`
/// after each line.
const CONTAINS_AA: &str = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?><!--Created with JFLAP 7.1.--><structure>&#13;\n\t<type>fa</type>&#13;\n\t<automaton>&#13;\n\t\t<!--The list of states.-->&#13;\n\t\t<state id=\"0\" name=\"q0\">&#13;\n\t\t\t<x>110.0</x>&#13;\n\t\t\t<y>120.0</y>&#13;\n\t\t\t<initial/>&#13;\n\t\t</state>&#13;\n\t\t<state id=\"1\" name=\"q1\">&#13;\n\t\t\t<x>240.0</x>&#13;\n\t\t\t<y>120.0</y>&#13;\n\t\t</state>&#13;\n\t\t<state id=\"2\" name=\"q2\">&#13;\n\t\t\t<x>370.0</x>&#13;\n\t\t\t<y>120.5</y>&#13;\n\t\t\t<final/>&#13;\n\t\t</state>&#13;\n\t\t<!--The list of transitions.-->&#13;\n\t\t<transition>&#13;\n\t\t\t<from>2</from>&#13;\n\t\t\t<to>2</to>&#13;\n\t\t\t<read>b</read>&#13;\n\t\t</transition>&#13;\n\t\t<transition>&#13;\n\t\t\t<from>0</from>&#13;\n\t\t\t<to>1</to>&#13;\n\t\t\t<read>a</read>&#13;\n\t\t</transition>&#13;\n\t\t<transition>&#13;\n\t\t\t<from>1</from>&#13;\n\t\t\t<to>2</to>&#13;\n\t\t\t<read>a</read>&#13;\n\t\t</transition>&#13;\n\t\t<transition>&#13;\n\t\t\t<from>0</from>&#13;\n\t\t\t<to>0</to>&#13;\n\t\t\t<read>b</read>&#13;\n\t\t</transition>&#13;\n\t\t<transition>&#13;\n\t\t\t<from>1</from>&#13;\n\t\t\t<to>0</to>&#13;\n\t\t\t<read>b</read>&#13;\n\t\t</transition>&#13;\n\t\t<transition>&#13;\n\t\t\t<from>2</from>&#13;\n\t\t\t<to>2</to>&#13;\n\t\t\t<read>a</read>&#13;\n\t\t</transition>&#13;\n\t</automaton>&#13;\n</structure>";

/// A small file: `states` are (id, flags) with `i` for initial and `f` for final;
/// `transitions` are (from, to, label). States sit on a row, 100 apart.
fn jff(states: &[(u32, &str)], transitions: &[(u32, u32, &str)]) -> String {
    let mut s = String::from("<structure><type>fa</type><automaton>");
    for (n, (id, flags)) in states.iter().enumerate() {
        s += &format!(
            r#"<state id="{id}" name="s{id}"><x>{}.0</x><y>50.0</y>"#,
            100 * (n + 1)
        );
        if flags.contains('i') {
            s += "<initial/>";
        }
        if flags.contains('f') {
            s += "<final/>";
        }
        s += "</state>";
    }
    for (from, to, label) in transitions {
        s += &format!(
            "<transition><from>{from}</from><to>{to}</to><read>{label}</read></transition>"
        );
    }
    s + "</automaton></structure>"
}

fn ok(xml: &str) -> Jff {
    parse_jff(xml).unwrap()
}

fn err(xml: &str) -> Message {
    parse_jff(xml).expect_err("file should be rejected")
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

fn fsm(json: &str) -> Fsm {
    Fsm::from_json(json).unwrap()
}

fn accepts(fsm: &Fsm, input: &str) -> Option<bool> {
    let symbols = fsm.alphabet.tokenize(input).ok()?;
    match simulate(fsm, &symbols, Budget::default()).unwrap() {
        Simulation::Finished { accepted, .. } => Some(accepted),
        Simulation::Stopped { .. } => panic!("stopped"),
    }
}

// ---- import ----

#[test]
fn a_file_written_by_jflap_is_read_into_a_machine_with_names_and_positions() {
    let imported = ok(CONTAINS_AA);
    let expected = fsm(
        r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,1,2],"start":0,"accepting":[2],"transitions":[{"from":0,"on":"a","to":1},{"from":0,"on":"b","to":0},{"from":1,"on":"a","to":2},{"from":1,"on":"b","to":0},{"from":2,"on":"a","to":2},{"from":2,"on":"b","to":2}]}"#,
    );
    assert_eq!(imported.fsm, expected);
    assert!(imported.notes.is_empty());
    let layout: Vec<(u32, &str, f64, f64)> = imported
        .states
        .iter()
        .map(|s| (s.id.0, s.name.as_str(), s.x, s.y))
        .collect();
    assert_eq!(
        layout,
        vec![
            (0, "q0", 110.0, 120.0),
            (1, "q1", 240.0, 120.0),
            (2, "q2", 370.0, 120.5)
        ]
    );
}

#[test]
fn an_empty_read_element_is_an_epsilon_transition() {
    let xml = jff(&[(0, "i"), (1, "f")], &[(0, 1, ""), (1, 1, "a")]);
    let imported = ok(&xml);
    assert_eq!(imported.fsm.kind, FsmKind::Ndfsm);
    assert_eq!(imported.fsm.transitions[0].on, None);
    let self_closing = "<structure><type>fa</type><automaton><state id=\"0\" name=\"q0\"><initial/><final/></state><transition><from>0</from><to>0</to><read/></transition></automaton></structure>";
    let imported = ok(self_closing);
    assert_eq!(imported.fsm.transitions.len(), 1);
    assert_eq!(imported.fsm.transitions[0].on, None);
}

#[test]
fn the_kind_follows_the_structure_of_the_transitions() {
    let deterministic = ok(&jff(&[(0, "i"), (1, "f")], &[(0, 1, "a")]));
    assert_eq!(deterministic.fsm.kind, FsmKind::Dfsm); // a missing transition is still deterministic
    let two_on_a = ok(&jff(&[(0, "i"), (1, "f")], &[(0, 1, "a"), (0, 0, "a")]));
    assert_eq!(two_on_a.fsm.kind, FsmKind::Ndfsm);
}

#[test]
fn a_file_without_an_initial_state_still_loads() {
    let imported = ok(&jff(&[(0, ""), (1, "f")], &[(0, 1, "a")]));
    assert_eq!(imported.fsm.start, None);
}

#[test]
fn state_ids_can_be_sparse_and_names_are_kept() {
    let imported = ok(&jff(&[(5, "i"), (9, "f")], &[(5, 9, "a")]));
    let ids: Vec<u32> = imported.fsm.states.iter().map(|s| s.0).collect();
    assert_eq!(ids, vec![5, 9]);
    assert_eq!(imported.states[1].name, "s9");
}

#[test]
fn a_label_with_several_characters_reads_them_one_after_the_other() {
    let imported = ok(&jff(&[(0, "i"), (1, "f")], &[(0, 1, "ab")]));
    let expected = fsm(
        r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,1,2],"start":0,"accepting":[1],"transitions":[{"from":0,"on":"a","to":2},{"from":2,"on":"b","to":1}]}"#,
    );
    assert_eq!(imported.fsm, expected);
    assert_eq!(imported.notes.len(), 1);
    let note = &imported.notes[0];
    assert_eq!(note.key, "jff.label_expanded");
    assert_eq!(text(note, "label"), "ab");
    assert_eq!((int(note, "from"), int(note, "to")), (0, 1));
    // the new state sits half way between the two states
    let new = &imported.states[2];
    assert_eq!(
        (new.id, new.name.as_str(), new.x, new.y),
        (StateId(2), "m2", 150.0, 50.0)
    );
    assert_eq!(accepts(&imported.fsm, "ab"), Some(true));
    assert_eq!(accepts(&imported.fsm, "a"), Some(false));
    assert_eq!(accepts(&imported.fsm, "b"), Some(false));
}

#[test]
fn new_states_for_long_labels_get_ids_after_the_highest_one() {
    let imported = ok(&jff(&[(5, "i"), (9, "f")], &[(5, 9, "abc"), (9, 9, "a")]));
    let ids: Vec<u32> = imported.fsm.states.iter().map(|s| s.0).collect();
    assert_eq!(ids, vec![5, 9, 10, 11]);
    assert_eq!(accepts(&imported.fsm, "abc"), Some(true));
    assert_eq!(accepts(&imported.fsm, "abcaa"), Some(true));
    assert_eq!(accepts(&imported.fsm, "ab"), Some(false));
}

#[test]
fn a_long_label_on_a_loop_works_too() {
    let imported = ok(&jff(&[(0, "if")], &[(0, 0, "ab")]));
    assert_eq!(accepts(&imported.fsm, ""), Some(true));
    assert_eq!(accepts(&imported.fsm, "abab"), Some(true));
    assert_eq!(accepts(&imported.fsm, "aba"), Some(false));
}

#[test]
fn xml_entities_are_decoded() {
    let xml = "<structure><type>fa</type><automaton><state id=\"0\" name=\"a&amp;b &lt;1&gt;\"><initial/><final/></state><transition><from>0</from><to>0</to><read>&lt;</read></transition></automaton></structure>";
    let imported = ok(xml);
    assert_eq!(imported.states[0].name, "a&b <1>");
    assert_eq!(imported.fsm.alphabet.names(), ["<"]);
}

// ---- import errors ----

#[test]
fn text_that_is_not_xml_is_reported_with_its_position() {
    let m = err("this is not xml");
    assert_eq!(m.key, "jff.xml_invalid");
    assert_eq!(int(&m, "line"), 1);
    assert!(int(&m, "column") >= 1);
    assert_eq!(err("").key, "jff.xml_invalid");
}

#[test]
fn a_dtd_is_refused_so_entity_attacks_cannot_work() {
    let bomb = r#"<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;">]><structure><type>&lol2;</type></structure>"#;
    assert_eq!(err(bomb).key, "jff.xml_invalid");
}

#[test]
fn only_finite_automata_are_supported() {
    for kind in ["pda", "turing", "mealy", "moore"] {
        let xml = format!("<structure><type>{kind}</type><automaton/></structure>");
        let m = err(&xml);
        assert_eq!(m.key, "jff.unsupported_type");
        assert_eq!(text(&m, "type"), kind);
    }
}

#[test]
fn a_file_with_the_wrong_shape_names_the_element() {
    let state = |attrs: &str| {
        format!("<structure><type>fa</type><automaton><state {attrs}/></automaton></structure>")
    };
    let cases = [
        ("<foo/>".to_string(), "structure"),
        ("<structure><automaton/></structure>".to_string(), "type"),
        ("<structure><type>fa</type></structure>".to_string(), "automaton"),
        (state(r#"name="q0""#), "state"),
        (state(r#"id="abc""#), "state"),
        (state(r#"id="-1""#), "state"),
        (state(r#"id="4294967296""#), "state"),
        (
            "<structure><type>fa</type><automaton><state id=\"0\"><x>NaN</x></state></automaton></structure>".to_string(),
            "x",
        ),
        (
            "<structure><type>fa</type><automaton><state id=\"0\"><y>inf</y></state></automaton></structure>".to_string(),
            "y",
        ),
        (
            "<structure><type>fa</type><automaton><state id=\"0\"/><transition><to>0</to><read>a</read></transition></automaton></structure>".to_string(),
            "from",
        ),
        (
            "<structure><type>fa</type><automaton><state id=\"0\"/><transition><from>0</from><to>x</to><read>a</read></transition></automaton></structure>".to_string(),
            "to",
        ),
        (
            "<structure><type>fa</type><automaton><state id=\"0\"/><transition><from>0</from><to>0</to></transition></automaton></structure>".to_string(),
            "read",
        ),
    ];
    for (xml, element) in cases {
        let m = err(&xml);
        assert_eq!(m.key, "jff.invalid_structure", "{xml}");
        assert_eq!(text(&m, "element"), element, "{xml}");
    }
}

#[test]
fn problems_in_the_machine_itself_reuse_the_machine_messages() {
    let m = err(&jff(&[(0, "i")], &[(0, 7, "a")]));
    assert_eq!((m.key, int(&m, "state")), ("machine.unknown_state", 7));
    assert_eq!(
        err(&jff(&[(0, "i"), (0, "")], &[])).key,
        "machine.duplicate_state"
    );
    assert_eq!(
        err(&jff(&[(0, "i"), (1, "i")], &[])).key,
        "jff.multiple_initial_states"
    );
    assert_eq!(
        err(&jff(&[(0, "i")], &[(0, 0, " ")])).key,
        "machine.invalid_symbol"
    );
}

#[test]
fn size_limits_hold() {
    let padded = format!("{}{}", jff(&[(0, "i")], &[]), " ".repeat(MAX_JFF_BYTES));
    let m = err(&padded);
    assert_eq!(m.key, "machine.limit_exceeded");
    assert_eq!(text(&m, "what"), "bytes");

    let states: Vec<(u32, &str)> = (0..2001).map(|i| (i, "")).collect();
    let m = err(&jff(&states, &[]));
    assert_eq!(
        (m.key, text(&m, "what")),
        ("machine.limit_exceeded", "states".to_string())
    );

    // a label of 3,000 characters would need 2,999 new states
    let long = "a".repeat(3000);
    let m = err(&jff(&[(0, "i"), (1, "f")], &[(0, 1, &long)]));
    assert_eq!(
        (m.key, text(&m, "what")),
        ("machine.limit_exceeded", "states".to_string())
    );
}

// ---- export ----

#[test]
fn export_writes_plain_xml_in_a_fixed_order() {
    let machine = fsm(
        r#"{"schemaVersion":1,"kind":"ndfsm","alphabet":["a"],"states":[0,1],"start":0,"accepting":[1],"transitions":[{"from":0,"on":"a","to":1},{"from":1,"on":null,"to":0}]}"#,
    );
    let xml = to_jff(&machine, &[]).unwrap();
    let expected = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\n<structure>\n\t<type>fa</type>\n\t<automaton>\n\t\t<state id=\"0\" name=\"q0\">\n\t\t\t<x>100.0</x>\n\t\t\t<y>100.0</y>\n\t\t\t<initial/>\n\t\t</state>\n\t\t<state id=\"1\" name=\"q1\">\n\t\t\t<x>230.0</x>\n\t\t\t<y>100.0</y>\n\t\t\t<final/>\n\t\t</state>\n\t\t<transition>\n\t\t\t<from>0</from>\n\t\t\t<to>1</to>\n\t\t\t<read>a</read>\n\t\t</transition>\n\t\t<transition>\n\t\t\t<from>1</from>\n\t\t\t<to>0</to>\n\t\t\t<read/>\n\t\t</transition>\n\t</automaton>\n</structure>\n";
    assert_eq!(xml, expected);
    assert_eq!(to_jff(&machine, &[]).unwrap(), xml);
}

#[test]
fn export_uses_the_given_names_and_positions_and_escapes_text() {
    let machine = fsm(
        r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["<"],"states":[0,1],"start":0,"accepting":[1],"transitions":[{"from":0,"on":"<","to":1}]}"#,
    );
    let layout = [
        JffState {
            id: StateId(1),
            name: "a<b&\"c'\u{1}d".into(),
            x: 5.5,
            y: 7.5,
        },
        JffState {
            id: StateId(9),
            name: "not in the machine".into(),
            x: 0.0,
            y: 0.0,
        },
    ];
    let xml = to_jff(&machine, &layout).unwrap();
    assert!(xml.contains("name=\"a&lt;b&amp;&quot;c&apos;?d\""));
    assert!(xml.contains("<x>5.5</x>"));
    assert!(xml.contains("<y>7.5</y>"));
    assert!(xml.contains("<read>&lt;</read>"));
    assert!(!xml.contains("not in the machine"));
    let back = ok(&xml);
    assert_eq!(back.fsm.alphabet.names(), ["<"]);
    assert_eq!(back.states[1].name, "a<b&\"c'?d");
}

#[test]
fn symbols_with_several_characters_cannot_be_exported() {
    let machine = fsm(
        r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["num"],"states":[0],"start":0,"accepting":[0],"transitions":[{"from":0,"on":"num","to":0}]}"#,
    );
    let m = to_jff(&machine, &[]).unwrap_err();
    assert_eq!(m.key, "jff.symbol_not_single_character");
    assert_eq!(text(&m, "symbol"), "num");
}

// ---- properties ----

/// Single-character symbols, since a `.jff` file cannot hold any other kind.
fn arb_single_char_machine() -> impl Strategy<Value = Fsm> {
    prop::collection::btree_set("[a-z]", 0..5)
        .prop_flat_map(|symbols| machine(symbols.into_iter().collect()))
}

/// What a machine is, without the numbers that stand for its symbols.
#[derive(Debug, PartialEq)]
struct Shape {
    states: Vec<u32>,
    start: Option<u32>,
    accepting: Vec<u32>,
    transitions: Vec<(u32, Option<String>, u32)>,
}

fn shape(fsm: &Fsm) -> Shape {
    let mut transitions: Vec<_> = fsm
        .transitions
        .iter()
        .map(|t| {
            (
                t.from.0,
                t.on.and_then(|s| fsm.alphabet.name(s)).map(str::to_owned),
                t.to.0,
            )
        })
        .collect();
    transitions.sort();
    Shape {
        states: fsm.states.iter().map(|s| s.0).collect(),
        start: fsm.start.map(|s| s.0),
        accepting: fsm.accepting.iter().map(|s| s.0).collect(),
        transitions,
    }
}

/// A reader of the labels as JFLAP reads them: a label is a string of characters that must
/// match the next characters of the input; an empty label reads nothing.
fn jflap_accepts(
    start: u32,
    finals: &HashSet<u32>,
    transitions: &[(u32, u32, String)],
    input: &str,
) -> bool {
    let mut seen = HashSet::new();
    let mut stack = vec![(start, 0usize)];
    while let Some((q, i)) = stack.pop() {
        if !seen.insert((q, i)) {
            continue;
        }
        if i == input.len() && finals.contains(&q) {
            return true;
        }
        for (from, to, label) in transitions {
            if *from == q && input[i..].starts_with(label.as_str()) {
                stack.push((*to, i + label.len()));
            }
        }
    }
    false
}

proptest! {
    #[test]
    fn export_then_import_gives_the_same_machine(original in arb_single_char_machine()) {
        let back = ok(&to_jff(&original, &[]).unwrap());
        prop_assert_eq!(shape(&back.fsm), shape(&original));
        prop_assert!(back.notes.is_empty());
    }

    #[test]
    fn multi_character_labels_mean_what_they_mean_in_jflap(
        edges in prop::collection::vec((0u32..4, 0u32..4, "[abc]{0,4}"), 0..8),
        finals in prop::collection::vec(prop::bool::ANY, 4),
        input in "[abc]{0,7}",
    ) {
        let flags: Vec<String> = (0..4)
            .map(|i| format!("{}{}", if i == 0 { "i" } else { "" }, if finals[i] { "f" } else { "" }))
            .collect();
        let states: Vec<(u32, &str)> = (0..4).map(|i| (i as u32, flags[i].as_str())).collect();
        let labels: Vec<(u32, u32, &str)> = edges.iter().map(|(a, b, l)| (*a, *b, l.as_str())).collect();
        let imported = ok(&jff(&states, &labels));
        let final_ids: HashSet<u32> = (0..4u32).filter(|&i| finals[i as usize]).collect();
        let expected = jflap_accepts(0, &final_ids, &edges, &input);
        // A character that no label contains is not in the alphabet, so nothing can read it.
        prop_assert_eq!(accepts(&imported.fsm, &input).unwrap_or(false), expected);
    }

    #[test]
    fn any_text_is_read_without_panicking(s in ".*") {
        let _ = parse_jff(&s);
    }

    #[test]
    fn damaged_files_are_read_without_panicking(cut in 1usize..900, at in 0usize..900, byte in 0u8..128) {
        let mut bytes = CONTAINS_AA.as_bytes().to_vec();
        if at < bytes.len() {
            bytes[at] = byte;
        }
        bytes.truncate(cut);
        if let Ok(s) = String::from_utf8(bytes) {
            let _ = parse_jff(&s);
        }
    }
}
