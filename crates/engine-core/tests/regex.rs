use engine_core::{
    Alphabet, Budget, Change, Compiled, Equivalence, EquivalenceBudget, Fsm, FsmKind, Message,
    Param, Regex, RegexBudget, Severity, Simulation, StateId, StopReason, SymbolId, Transition,
    equivalent, parse_regex, regex_to_fsm, simulate, validate,
};
use proptest::prelude::*;

mod common;
use common::{arb_regex, bx, concat, star, union};

use Regex::{Concat, Empty, Epsilon, Plus, Star, Union};

fn alphabet(names: &[&str]) -> Alphabet {
    Alphabet::new(names.iter().map(|s| s.to_string()).collect()).unwrap()
}

fn abc() -> Alphabet {
    alphabet(&["a", "b", "c"])
}

fn multi() -> Alphabet {
    alphabet(&["num", "plus", "x1"])
}

fn sym(i: u16) -> Regex {
    Regex::Symbol(SymbolId(i))
}

fn parse(text: &str) -> Regex {
    parse_regex(text, &abc()).unwrap()
}

fn error(text: &str, alphabet: &Alphabet) -> Message {
    parse_regex(text, alphabet).unwrap_err()
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

// ---- parser ----

#[test]
fn precedence_is_star_then_concatenation_then_union() {
    assert_eq!(parse("a∪bc*"), union(sym(0), concat(sym(1), star(sym(2)))));
    assert_eq!(parse("ab∪c"), union(concat(sym(0), sym(1)), sym(2)));
    assert_eq!(
        parse("(a∪b)*b"),
        concat(star(union(sym(0), sym(1))), sym(1))
    );
}

#[test]
fn union_and_concatenation_group_to_the_left() {
    assert_eq!(parse("a∪b∪c"), union(union(sym(0), sym(1)), sym(2)));
    assert_eq!(parse("abc"), concat(concat(sym(0), sym(1)), sym(2)));
}

#[test]
fn all_the_pieces_of_rich_syntax_parse() {
    assert_eq!(parse("∅"), Empty);
    assert_eq!(parse("ε"), Epsilon);
    assert_eq!(parse("a+"), Plus(bx(sym(0))));
    assert_eq!(parse("a*+"), Plus(bx(star(sym(0)))));
    assert_eq!(parse("(a)"), sym(0));
    assert_eq!(parse("((a∪b))*"), star(union(sym(0), sym(1))));
    assert_eq!(
        parse("(ab∪b)*(a∪ε)"),
        concat(
            star(union(concat(sym(0), sym(1)), sym(1))),
            union(sym(0), Epsilon)
        )
    );
}

#[test]
fn spaces_are_ignored() {
    assert_eq!(parse("( a ∪ b ) *"), parse("(a∪b)*"));
}

#[test]
fn multi_character_symbols_are_separated_by_spaces_and_operators() {
    let m = multi();
    assert_eq!(
        parse_regex("(num plus)* num", &m).unwrap(),
        concat(star(concat(sym(0), sym(1))), sym(0))
    );
    assert_eq!(
        parse_regex("num∪plus+", &m).unwrap(),
        union(sym(0), Plus(bx(sym(1))))
    );
    assert_eq!(
        parse_regex("(num∪x1)*", &m).unwrap(),
        star(union(sym(0), sym(2)))
    );
    let e = error("numplus", &m);
    assert_eq!(e.key, "regex.unknown_symbol");
    assert_eq!(
        (text(&e, "symbol"), int(&e, "position")),
        ("numplus".to_string(), 0)
    );
}

#[test]
fn errors_name_the_position() {
    let abc = abc();
    let cases: [(&str, &str, i64); 9] = [
        ("*a", "regex.unexpected", 0),
        ("a∪∪b", "regex.unexpected", 2),
        ("()", "regex.unexpected", 1),
        ("a∪", "regex.unexpected_end", 2),
        ("(ab", "regex.unbalanced_parenthesis", 0),
        ("a(b(c)", "regex.unbalanced_parenthesis", 1),
        ("ab)", "regex.unbalanced_parenthesis", 2),
        ("a$", "regex.unknown_symbol", 1),
        ("a +b d", "regex.unknown_symbol", 5),
    ];
    for (input, key, position) in cases {
        let e = error(input, &abc);
        assert_eq!((e.key, int(&e, "position")), (key, position), "{input}");
    }
    assert_eq!(text(&error("*a", &abc), "found"), "*");
    assert_eq!(error("", &abc).key, "regex.empty");
    assert_eq!(error("   ", &abc).key, "regex.empty");
}

#[test]
fn size_limits_and_operator_symbols_are_rejected() {
    let abc = abc();
    assert_eq!(error(&"a".repeat(1001), &abc).key, "regex.too_long");
    assert!(parse_regex(&"a".repeat(1000), &abc).is_ok());
    assert_eq!(
        error(&format!("{}a{}", "(".repeat(101), ")".repeat(101)), &abc).key,
        "regex.too_deep"
    );
    assert!(parse_regex(&format!("{}a{}", "(".repeat(100), ")".repeat(100)), &abc).is_ok());
    let plus = alphabet(&["a", "+"]);
    let e = error("a", &plus);
    assert_eq!(e.key, "regex.operator_symbol");
    assert_eq!(text(&e, "symbol"), "+");
}

#[test]
fn expressions_print_back_in_rich_notation() {
    let abc = abc();
    for source in [
        "a∪bc*",
        "(a∪b)*b",
        "ab∪c",
        "a∪b∪c",
        "abc",
        "(ab)*",
        "a*+",
        "ε∪∅",
        "(a∪b)+",
    ] {
        assert_eq!(parse(source).to_text(&abc), source, "{source}");
    }
    assert_eq!(concat(sym(0), concat(sym(1), sym(2))).to_text(&abc), "abc");
    let m = multi();
    let source = "(num plus)* num";
    assert_eq!(parse_regex(source, &m).unwrap().to_text(&m), source);
}

// ---- construction ----

fn compile(regex: &str) -> (Fsm, Vec<engine_core::ConversionStep>) {
    let alphabet = abc();
    let r = parse_regex(regex, &alphabet).unwrap();
    match regex_to_fsm(&r, &alphabet, RegexBudget::default()).unwrap() {
        Compiled::Finished { fsm, trace } => (fsm, trace),
        Compiled::Stopped { reason, .. } => panic!("stopped: {reason:?}"),
    }
}

fn machine(json: &str) -> Fsm {
    Fsm::from_json(json).unwrap()
}

fn t(from: u32, on: Option<u16>, to: u32) -> Transition {
    Transition {
        from: StateId(from),
        on: on.map(SymbolId),
        to: StateId(to),
    }
}

fn ids(xs: &[StateId]) -> Vec<u32> {
    xs.iter().map(|s| s.0).collect()
}

#[test]
fn rich_example_6_5_builds_the_machine_of_the_book() {
    let (fsm, trace) = compile("(b∪ab)*");
    let expected = machine(
        r#"{"schemaVersion":1,"kind":"ndfsm","alphabet":["a","b","c"],"states":[0,1,2,3,4,5,6,7],"start":7,"accepting":[1,5,7],"transitions":[{"from":0,"on":"b","to":1},{"from":1,"on":null,"to":6},{"from":2,"on":"a","to":3},{"from":3,"on":null,"to":4},{"from":4,"on":"b","to":5},{"from":5,"on":null,"to":6},{"from":6,"on":null,"to":0},{"from":6,"on":null,"to":2},{"from":7,"on":null,"to":6}]}"#,
    );
    assert_eq!(fsm, expected);

    let keys: Vec<&str> = trace.iter().map(|s| s.message.key).collect();
    assert_eq!(
        keys,
        [
            "regex.symbol",
            "regex.symbol",
            "regex.symbol",
            "regex.concat",
            "regex.union",
            "regex.star"
        ]
    );
    let fragment = |i: usize| match &trace[i].change {
        Change::Fragment {
            expression,
            start,
            accepting,
            states,
            transitions,
        } => (
            expression.clone(),
            start.0,
            ids(accepting),
            ids(states),
            transitions.clone(),
        ),
        other => panic!("{other:?}"),
    };
    assert_eq!(
        fragment(0),
        ("b".into(), 0, vec![1], vec![0, 1], vec![t(0, Some(1), 1)])
    );
    assert_eq!(
        fragment(3),
        ("ab".into(), 2, vec![5], vec![], vec![t(3, None, 4)])
    );
    assert_eq!(
        fragment(4),
        (
            "b∪ab".into(),
            6,
            vec![1, 5],
            vec![6],
            vec![t(6, None, 0), t(6, None, 2)]
        )
    );
    assert_eq!(
        fragment(5),
        (
            "(b∪ab)*".into(),
            7,
            vec![1, 5, 7],
            vec![7],
            vec![t(7, None, 6), t(1, None, 6), t(5, None, 6)]
        )
    );
    assert_eq!(text(&trace[0].message, "symbol"), "b");
    assert_eq!(text(&trace[5].message, "expression"), "(b∪ab)*");
}

#[test]
fn small_cases_follow_the_constructions_of_the_book() {
    let json = |states: &str, start: u32, accepting: &str, transitions: &str| {
        machine(&format!(
            r#"{{"schemaVersion":1,"kind":"ndfsm","alphabet":["a","b","c"],"states":{states},"start":{start},"accepting":{accepting},"transitions":[{transitions}]}}"#
        ))
    };
    let cases = [
        ("∅", json("[0]", 0, "[]", "")),
        ("ε", json("[0]", 0, "[0]", "")),
        (
            "a",
            json("[0,1]", 0, "[1]", r#"{"from":0,"on":"a","to":1}"#),
        ),
        (
            "a∪b",
            json(
                "[0,1,2,3,4]",
                4,
                "[1,3]",
                r#"{"from":0,"on":"a","to":1},{"from":2,"on":"b","to":3},{"from":4,"on":null,"to":0},{"from":4,"on":null,"to":2}"#,
            ),
        ),
        (
            "ab",
            json(
                "[0,1,2,3]",
                0,
                "[3]",
                r#"{"from":0,"on":"a","to":1},{"from":1,"on":null,"to":2},{"from":2,"on":"b","to":3}"#,
            ),
        ),
        (
            "a*",
            json(
                "[0,1,2]",
                2,
                "[1,2]",
                r#"{"from":0,"on":"a","to":1},{"from":1,"on":null,"to":0},{"from":2,"on":null,"to":0}"#,
            ),
        ),
        (
            "a+",
            json(
                "[0,1]",
                0,
                "[1]",
                r#"{"from":0,"on":"a","to":1},{"from":1,"on":null,"to":0}"#,
            ),
        ),
    ];
    for (source, expected) in cases {
        assert_eq!(compile(source).0, expected, "{source}");
    }
}

#[test]
fn the_state_budget_stops_the_construction() {
    let alphabet = abc();
    let r = parse_regex("(ab)*", &alphabet).unwrap(); // 2 + 2 + 1 states
    let run = |max_states| regex_to_fsm(&r, &alphabet, RegexBudget { max_states }).unwrap();
    assert!(matches!(run(5), Compiled::Finished { .. }));
    let Compiled::Stopped {
        reason,
        partial_trace,
    } = run(4)
    else {
        panic!()
    };
    assert_eq!(reason, StopReason::MaxStates);
    assert_eq!(partial_trace.len(), 3); // a, b, and the concatenation
}

// ---- properties ----

fn nodes(r: &Regex) -> usize {
    match r {
        Union(a, b) | Concat(a, b) => 1 + nodes(a) + nodes(b),
        Star(a) | Plus(a) => 1 + nodes(a),
        _ => 1,
    }
}

// A reference matcher that shares no code with the construction: Brzozowski derivatives.
fn nullable(r: &Regex) -> bool {
    match r {
        Empty | Regex::Symbol(_) => false,
        Epsilon | Star(_) => true,
        Union(a, b) => nullable(a) || nullable(b),
        Concat(a, b) => nullable(a) && nullable(b),
        Plus(a) => nullable(a),
    }
}

fn derivative(r: &Regex, c: SymbolId) -> Regex {
    match r {
        Empty | Epsilon => Empty,
        Regex::Symbol(s) => {
            if *s == c {
                Epsilon
            } else {
                Empty
            }
        }
        Union(a, b) => union(derivative(a, c), derivative(b, c)),
        Concat(a, b) if nullable(a) => {
            union(concat(derivative(a, c), (**b).clone()), derivative(b, c))
        }
        Concat(a, b) => concat(derivative(a, c), (**b).clone()),
        Star(a) | Plus(a) => concat(derivative(a, c), star((**a).clone())),
    }
}

fn matches(r: &Regex, word: &[SymbolId]) -> bool {
    let mut current = r.clone();
    for &c in word {
        current = derivative(&current, c);
    }
    nullable(&current)
}

fn build(r: &Regex, alphabet: &Alphabet) -> (Fsm, usize) {
    match regex_to_fsm(r, alphabet, RegexBudget::default()).unwrap() {
        Compiled::Finished { fsm, trace } => (fsm, trace.len()),
        Compiled::Stopped { reason, .. } => panic!("stopped: {reason:?}"),
    }
}

fn word(raw: &[u16]) -> Vec<SymbolId> {
    raw.iter().map(|&i| SymbolId(i % 3)).collect()
}

fn accepts(fsm: &Fsm, input: &[SymbolId]) -> bool {
    match simulate(fsm, input, Budget::default()).unwrap() {
        Simulation::Finished { accepted, .. } => accepted,
        Simulation::Stopped { .. } => panic!("stopped"),
    }
}

proptest! {
    #[test]
    fn the_machine_accepts_what_a_reference_matcher_accepts(
        r in arb_regex(),
        raw in prop::collection::vec(0u16..3, 0..7),
    ) {
        let (fsm, steps) = build(&r, &abc());
        prop_assert_eq!(fsm.kind, FsmKind::Ndfsm);
        prop_assert_eq!(steps, nodes(&r));
        prop_assert!(validate(&fsm).iter().all(|i| i.severity != Severity::Error));
        let w = word(&raw);
        prop_assert_eq!(accepts(&fsm, &w), matches(&r, &w));
    }

    #[test]
    fn printing_and_parsing_again_keeps_the_language(
        r in arb_regex(),
        raw in prop::collection::vec(0u16..3, 0..7),
        use_multi in prop::bool::ANY,
    ) {
        let alphabet = if use_multi { multi() } else { abc() };
        let printed = r.to_text(&alphabet);
        let parsed = parse_regex(&printed, &alphabet).unwrap();
        let w = word(&raw);
        prop_assert_eq!(matches(&parsed, &w), matches(&r, &w));
        prop_assert_eq!(parsed.to_text(&alphabet), printed);
    }

    #[test]
    fn plus_means_the_expression_followed_by_its_star(r in arb_regex()) {
        let alphabet = abc();
        let (with_plus, _) = build(&Plus(bx(r.clone())), &alphabet);
        let (expanded, _) = build(&concat(r.clone(), star(r)), &alphabet);
        match equivalent(&with_plus, &expanded, EquivalenceBudget::default()).unwrap() {
            Equivalence::Equivalent { .. } | Equivalence::Stopped { .. } => {}
            Equivalence::Different { witness, .. } => prop_assert!(false, "witness {:?}", witness.string),
        }
    }

    #[test]
    fn the_parser_never_panics(s in ".*") {
        let _ = parse_regex(&s, &abc());
        let _ = parse_regex(&s, &multi());
    }
}
