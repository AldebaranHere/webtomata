//! The boundaries and details that the audit of the engine (`cargo mutants`, 611 changes of the code,
//! one at a time) found that no test noticed: a limit that is exactly reached, a budget that is passed
//! down to a stage, the kept and the removed part in a message, the order of two symbols, and the
//! details of the `.jff` writer. Each test says what the change of the code was that it catches.

use engine_core::{
    Alphabet, Compiled, Conversion, ConversionBudget, Equivalence, EquivalenceBudget, Extraction,
    Fsm, FsmToRegexBudget, Jff, JffState, MAX_ISSUES, MAX_JFF_BYTES, MAX_JSON_BYTES, Minimization,
    MinimizeBudget, Param, Regex, RegexBudget, Simplification, SimplifyBudget, StopReason,
    SymbolId, ViaMachineBudget, Xor, determinize, equivalent, fsm_to_regex, intersection, minimize,
    parse_jff, parse_regex, regex_to_fsm, simplify, simplify_via_machine, to_jff, validate, xor,
};

mod common;

fn machine(text: &str) -> Fsm {
    Fsm::from_json(text).unwrap()
}

fn ab() -> Alphabet {
    Alphabet::new(vec!["a".into(), "b".into()]).unwrap()
}

const UNIVERSAL: &str = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0],"start":0,"accepting":[0],"transitions":[{"from":0,"on":"a","to":0},{"from":0,"on":"b","to":0}]}"#;

// ---- the lists of wrong strings ----

#[test]
fn the_list_of_wrong_strings_stops_when_the_visits_are_used_up() {
    // Changing `visits += 1` into `visits *= 1` made the count of visits stay at 0, so that the budget of
    // visits was never used up. A second check (the strings that wait in the queue) stops a list over two
    // symbols in the same place, so the machines have one symbol: the queue then holds one string, and
    // only the count of visits can stop the list before the length of 8.
    let universal = machine(
        r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a"],"states":[0],"start":0,"accepting":[0],"transitions":[{"from":0,"on":"a","to":0}]}"#,
    );
    let nothing = machine(
        r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a"],"states":[0],"start":0,"accepting":[],"transitions":[{"from":0,"on":"a","to":0}]}"#,
    );
    let budget = EquivalenceBudget {
        max_visits: 5,
        max_strings: 100,
        ..EquivalenceBudget::default()
    };
    let result = equivalent(&universal, &nothing, budget).unwrap();
    let Equivalence::Different {
        accepted_but_should_reject,
        rejected_but_should_accept,
        lists_truncated,
        ..
    } = result
    else {
        panic!("{result:?}");
    };
    // The five shortest strings: ε, a, aa, aaa, aaaa.
    assert_eq!(accepted_but_should_reject.len(), 5);
    assert!(rejected_but_should_accept.is_empty());
    assert!(lists_truncated);
}

// ---- fsm_to_regex ----

fn regex_budget(max_nodes: usize) -> FsmToRegexBudget {
    FsmToRegexBudget {
        max_nodes,
        ..FsmToRegexBudget::default()
    }
}

#[test]
fn a_label_of_exactly_the_biggest_size_is_allowed() {
    // The expression of "even length" has 8 parts: ((a∪b)(a∪b))*. Changing `size > max_nodes` into
    // `size >= max_nodes` made 8 too small.
    let even = machine(common::EVEN);
    let Extraction::Finished { regex, .. } = fsm_to_regex(&even, regex_budget(8)).unwrap() else {
        panic!("8 parts must be enough");
    };
    assert_eq!(regex.size(), 8);
    assert!(matches!(
        fsm_to_regex(&even, regex_budget(7)).unwrap(),
        Extraction::Stopped {
            reason: StopReason::MaxNodes,
            ..
        }
    ));
}

#[test]
fn a_label_of_parallel_transitions_of_exactly_the_biggest_size_is_allowed() {
    // Two transitions from 0 to 1, on a and on b, make the label a∪b of 3 parts at the start. Changing
    // `size > max_nodes` into `>=` or `==` (in the first table of labels) refused 3 parts.
    let two = machine(
        r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,1],"start":0,"accepting":[1],"transitions":[{"from":0,"on":"a","to":1},{"from":0,"on":"b","to":1}]}"#,
    );
    assert!(matches!(
        fsm_to_regex(&two, regex_budget(3)).unwrap(),
        Extraction::Finished { .. }
    ));
    assert!(matches!(
        fsm_to_regex(&two, regex_budget(2)).unwrap(),
        Extraction::Stopped {
            reason: StopReason::MaxNodes,
            ..
        }
    ));
}

fn keys(machine: &Fsm) -> Vec<&'static str> {
    match fsm_to_regex(machine, FsmToRegexBudget::default()).unwrap() {
        Extraction::Finished { trace, .. } => trace.iter().map(|s| s.message.key).collect(),
        Extraction::Stopped { reason, .. } => panic!("{reason:?}"),
    }
}

#[test]
fn a_new_start_and_a_new_accepting_state_are_added_only_when_they_are_needed() {
    // 0 -a-> 1, state 1 accepts and has no transition out, and nothing goes into 0: neither is needed.
    // Changing `from == accepting[0]` into `from != accepting[0]` added a new accepting state anyway.
    let plain = machine(
        r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,1],"start":0,"accepting":[1],"transitions":[{"from":0,"on":"a","to":1}]}"#,
    );
    let plain_keys = keys(&plain);
    assert!(
        !plain_keys.contains(&"fsm_to_regex.new_start"),
        "{plain_keys:?}"
    );
    assert!(
        !plain_keys.contains(&"fsm_to_regex.new_accepting"),
        "{plain_keys:?}"
    );
    // "Even length": transitions go into the start state and out of the accepting state: both are added.
    let even_keys = keys(&machine(common::EVEN));
    assert!(
        even_keys.contains(&"fsm_to_regex.new_start"),
        "{even_keys:?}"
    );
    assert!(
        even_keys.contains(&"fsm_to_regex.new_accepting"),
        "{even_keys:?}"
    );
}

// ---- minimize ----

#[test]
fn the_witness_of_a_split_names_the_first_symbol_on_which_the_two_groups_differ() {
    // States 1 and 2 act alike on `a` and differ on `b` only (1 goes to the accepting state 3 on `b`).
    // Changing `!=` into `==` named the first symbol on which they are the same, which is `a`.
    let dfsm = machine(
        r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,1,2,3],"start":1,"accepting":[3],"transitions":[{"from":0,"on":"a","to":0},{"from":0,"on":"b","to":0},{"from":1,"on":"a","to":0},{"from":1,"on":"b","to":3},{"from":2,"on":"a","to":0},{"from":2,"on":"b","to":0},{"from":3,"on":"a","to":3},{"from":3,"on":"b","to":3}]}"#,
    );
    let Minimization::Finished { trace, .. } = minimize(&dfsm, MinimizeBudget::default()).unwrap()
    else {
        panic!("stopped");
    };
    let splits: Vec<_> = trace
        .iter()
        .filter_map(|s| match &s.change {
            engine_core::Change::Split { witness, .. } => Some(*witness),
            _ => None,
        })
        .collect();
    assert!(!splits.is_empty());
    assert_eq!(splits[0].symbol, SymbolId(1), "the first split is on b");
}

// ---- the budget that is passed down to the stages ----

#[test]
fn the_budget_of_states_is_capped_in_every_operation_that_determinizes() {
    // The machine "the 12th symbol from the end is a" needs 4,096 states as a DFSM, more than the 2,000
    // that the engine allows. Deleting the field `max_states` of the budget in `intersection`, in `xor`
    // and in `through_machine` let a huge budget (usize::MAX) through.
    let huge = machine(&common::nth_from_end(12));
    let budget = ConversionBudget {
        max_states: usize::MAX,
        max_steps: usize::MAX,
    };
    assert!(matches!(
        determinize(&huge, budget).unwrap(),
        Conversion::Stopped {
            reason: StopReason::MaxStates,
            ..
        }
    ));
    assert!(matches!(
        xor(&huge, &huge, budget).unwrap(),
        Xor::Stopped {
            reason: StopReason::MaxStates,
            ..
        }
    ));
    assert!(matches!(
        intersection(&huge, &huge, budget).unwrap(),
        engine_core::Intersection::Stopped {
            reason: StopReason::MaxStates,
            ..
        }
    ));
}

#[test]
fn the_machine_route_gives_way_when_the_dfsm_does_not_fit_though_the_nfa_does() {
    // The NFA of this expression has 29 states and its DFSM has 33, but its language is empty (the last
    // part is ∅), so that the minimal machine is one state and its expression is ∅: with enough room the
    // route works and the plain result is kept (a tie). With 31 states the NFA fits and the DFSM does not,
    // so the stage that stops is `determinize`. Deleting the field `max_states` of its budget let it use
    // the default of the engine, and the route went on.
    let a = ab();
    let regex = parse_regex("((a∪b)*a(a∪b)(a∪b)(a∪b)(a∪b))∅", &a).unwrap();
    let Compiled::Finished { fsm, .. } = regex_to_fsm(&regex, &a, RegexBudget::default()).unwrap()
    else {
        panic!("stopped");
    };
    assert_eq!(fsm.states.len(), 29);
    let first_step = |max_states| {
        let budget = ViaMachineBudget {
            max_states,
            ..ViaMachineBudget::default()
        };
        let Simplification::Finished { trace, .. } =
            simplify_via_machine(&regex, &a, budget).unwrap()
        else {
            panic!("stopped");
        };
        trace[0].message.key
    };
    assert_eq!(first_step(31), "via_machine.too_big");
    assert_eq!(first_step(33), "via_machine.kept_original");
}

// ---- regular expressions ----

#[test]
fn a_star_and_a_plus_are_written_after_their_operand_and_bind_tighter_than_the_rest() {
    // Taking the arm of star and plus out of `write` gave them the level of an atom, which changed how
    // they are written when they are the operand of another star or plus.
    let a = ab();
    let text = |t: &str| parse_regex(t, &a).unwrap().to_text(&a);
    assert_eq!(text("(a*)*"), "a**");
    assert_eq!(text("(a*)+"), "a*+");
    assert_eq!(text("(a+)*"), "a+*");
    assert_eq!(text("a*b"), "a*b");
    assert_eq!(text("(ab)*"), "(ab)*");
    assert_eq!(text("(a∪b)*"), "(a∪b)*");
}

#[test]
fn a_symbol_that_is_not_in_the_alphabet_is_found_inside_every_kind_of_part() {
    // Taking the arms for union, concatenation, star and plus out of `check_symbols` made the check
    // look only at the top of the expression.
    let a = ab();
    let bad = || Box::new(Regex::Symbol(SymbolId(7)));
    let ok = || Box::new(Regex::Symbol(SymbolId(0)));
    for regex in [
        Regex::Union(ok(), bad()),
        Regex::Concat(ok(), bad()),
        Regex::Star(bad()),
        Regex::Plus(bad()),
        Regex::Star(Box::new(Regex::Union(ok(), Box::new(Regex::Plus(bad()))))),
    ] {
        let error = simplify(&regex, &a, SimplifyBudget::default()).unwrap_err();
        assert_eq!(error.key, "simplify.unknown_symbol", "{regex:?}");
    }
}

#[test]
fn the_budget_of_checks_counts_each_check() {
    // `a*∪aa∪aaa` needs two checks of the form "is L(β) ⊆ L(α)?". Changing `checks += 1` into
    // `checks *= 1` left the count at 0, so that even one check was never "used up".
    let a = ab();
    let regex = parse_regex("a*∪aa∪aaa", &a).unwrap();
    let with = |max_checks| SimplifyBudget {
        max_checks,
        ..SimplifyBudget::default()
    };
    assert!(matches!(
        simplify(&regex, &a, with(1)).unwrap(),
        Simplification::Stopped {
            reason: StopReason::MaxChecks,
            ..
        }
    ));
    assert!(matches!(
        simplify(&regex, &a, with(2)).unwrap(),
        Simplification::Finished { .. }
    ));
}

#[test]
fn the_message_of_a_star_that_swallows_another_names_the_one_that_is_kept() {
    // Changing `drop == i` into `drop != i` swapped the kept and the removed part in the message.
    let a = ab();
    for text in ["a*(a∪b)*", "(a∪b)*a*"] {
        let regex = parse_regex(text, &a).unwrap();
        let Simplification::Finished { trace, .. } =
            simplify(&regex, &a, SimplifyBudget::default()).unwrap()
        else {
            panic!("stopped");
        };
        let step = &trace[0];
        assert_eq!(step.message.key, "simplify.concat_star_subset", "{text}");
        let param = |name: &str| match step.message.params.get(name) {
            Some(Param::Text(t)) => t.clone(),
            other => panic!("{name}: {other:?}"),
        };
        assert_eq!(param("kept"), "(a∪b)*", "{text}");
        assert_eq!(param("removed"), "a*", "{text}");
    }
}

// ---- the lists of problems ----

#[test]
fn a_machine_with_more_problems_than_the_limit_gets_the_limit_and_one_marker() {
    // 1,200 states of a DFSM over one symbol, with no transition at all: every state is a problem.
    let states: Vec<String> = (0..1_200).map(|i| i.to_string()).collect();
    let fsm = machine(&format!(
        r#"{{"schemaVersion":1,"kind":"dfsm","alphabet":["a"],"states":[{}],"start":0,"accepting":[],"transitions":[]}}"#,
        states.join(",")
    ));
    let issues = validate(&fsm);
    assert_eq!(issues.len(), MAX_ISSUES + 1);
    assert_eq!(issues.last().unwrap().message.key, "fsm.too_many_issues");
    assert!(
        issues[..MAX_ISSUES]
            .iter()
            .all(|i| i.message.key != "fsm.too_many_issues")
    );
}

#[test]
fn an_alphabet_with_no_symbol_is_empty() {
    assert!(Alphabet::new(vec![]).unwrap().is_empty());
    assert!(!ab().is_empty());
}

// ---- the size limits of the files ----

#[test]
fn a_machine_file_of_exactly_the_biggest_size_is_read_and_one_byte_more_is_not() {
    // Changing `len > MAX_JSON_BYTES` into `>=` refused the biggest file that is allowed.
    let mut text = String::from(UNIVERSAL);
    text.push_str(&" ".repeat(MAX_JSON_BYTES - text.len()));
    assert_eq!(text.len(), MAX_JSON_BYTES);
    assert!(Fsm::from_json(&text).is_ok());
    text.push(' ');
    assert_eq!(
        Fsm::from_json(&text).unwrap_err().key,
        "machine.limit_exceeded"
    );
}

fn jff(states: &[(u32, f64, f64)], transitions: &[(u32, u32, &str)]) -> String {
    let mut out = String::from(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?><structure><type>fa</type><automaton>",
    );
    for &(id, x, y) in states {
        out.push_str(&format!(
            "<state id=\"{id}\" name=\"q{id}\"><x>{x}</x><y>{y}</y>{}</state>",
            if id == 0 { "<initial/>" } else { "" }
        ));
    }
    for (from, to, read) in transitions {
        out.push_str(&format!(
            "<transition><from>{from}</from><to>{to}</to><read>{read}</read></transition>"
        ));
    }
    out.push_str("</automaton></structure>");
    out
}

#[test]
fn a_jff_file_of_exactly_the_biggest_size_is_read_and_one_byte_more_is_not() {
    // Changing `xml.len() > MAX_JFF_BYTES` into `>=`. The padding is a comment after the first line.
    let base = jff(&[(0, 0.0, 0.0), (1, 100.0, 0.0)], &[(0, 1, "a")]);
    let (head, rest) = base.split_once("?>").unwrap();
    let padded = |extra: usize| {
        let filler = MAX_JFF_BYTES + extra - base.len() - "<!---->".len();
        format!("{head}?><!--{}-->{rest}", " ".repeat(filler))
    };
    assert_eq!(padded(0).len(), MAX_JFF_BYTES);
    assert!(parse_jff(&padded(0)).is_ok());
    assert_eq!(
        parse_jff(&padded(1)).unwrap_err().key,
        "machine.limit_exceeded"
    );
}

#[test]
fn a_label_of_several_characters_adds_states_up_to_the_limit_and_not_past_it() {
    // A label of 3 characters adds 2 states. With 1,998 states there are 2,000, which is the limit;
    // with 1,999 there would be 2,001. Changing `>` into `>=`, `==` or `+` into `*` moved the limit.
    let build = |count: u32| {
        let states: Vec<(u32, f64, f64)> = (0..count).map(|i| (i, 0.0, 0.0)).collect();
        jff(&states, &[(0, 1, "abc")])
    };
    let Jff { fsm, .. } = parse_jff(&build(1_998)).unwrap();
    assert_eq!(fsm.states.len(), 2_000);
    assert_eq!(
        parse_jff(&build(1_999)).unwrap_err().key,
        "machine.limit_exceeded"
    );
}

#[test]
fn the_states_of_a_long_label_are_on_the_line_between_its_ends() {
    // From (0, 0) to (300, 60) with the label "abc": two new states, at a third and two thirds of the
    // way. Changing the arithmetic of the places moved them.
    let jff_file = jff(&[(0, 0.0, 0.0), (1, 300.0, 60.0)], &[(0, 1, "abc")]);
    let parsed = parse_jff(&jff_file).unwrap();
    let new: Vec<&JffState> = parsed.states.iter().filter(|s| s.id.0 > 1).collect();
    assert_eq!(new.len(), 2);
    let near = |a: f64, b: f64| (a - b).abs() < 1e-9;
    assert!(
        near(new[0].x, 100.0) && near(new[0].y, 20.0),
        "{:?}",
        new[0]
    );
    assert!(
        near(new[1].x, 200.0) && near(new[1].y, 40.0),
        "{:?}",
        new[1]
    );
}

// ---- the .jff writer ----

fn machine_of_states(count: u32) -> Fsm {
    let states: Vec<String> = (0..count).map(|i| i.to_string()).collect();
    machine(&format!(
        r#"{{"schemaVersion":1,"kind":"dfsm","alphabet":["a"],"states":[{}],"start":0,"accepting":[],"transitions":[]}}"#,
        states.join(",")
    ))
}

fn state_of(jff: &Jff, id: u32) -> JffState {
    jff.states.iter().find(|s| s.id.0 == id).unwrap().clone()
}

#[test]
fn states_without_a_place_are_put_on_a_grid_of_six_in_a_row() {
    // The i-th state goes to x = 100 + 130 (i mod 6), y = 100 + 130 (i div 6).
    let text = to_jff(&machine_of_states(8), &[]).unwrap();
    let parsed = parse_jff(&text).unwrap();
    for (i, (x, y)) in [
        (100.0, 100.0),
        (230.0, 100.0),
        (360.0, 100.0),
        (490.0, 100.0),
        (620.0, 100.0),
        (750.0, 100.0),
        (100.0, 230.0),
        (230.0, 230.0),
    ]
    .into_iter()
    .enumerate()
    {
        let s = state_of(&parsed, i as u32);
        assert_eq!((s.x, s.y), (x, y), "state {i}");
    }
}

#[test]
fn a_place_that_is_not_a_number_is_replaced_by_the_grid_and_the_name_is_kept() {
    // The guard is "both coordinates are finite". Changing `&&` into `||`, or the guard into `true`,
    // wrote NaN or infinity, which no file can hold.
    let fsm = machine_of_states(2);
    let layout = [
        JffState {
            id: engine_core::StateId(0),
            name: "x".into(),
            x: f64::NAN,
            y: 5.0,
        },
        JffState {
            id: engine_core::StateId(1),
            name: "y".into(),
            x: 5.0,
            y: f64::INFINITY,
        },
    ];
    let parsed = parse_jff(&to_jff(&fsm, &layout).unwrap()).unwrap();
    let first = state_of(&parsed, 0);
    let second = state_of(&parsed, 1);
    assert_eq!((first.name.as_str(), first.x, first.y), ("x", 100.0, 100.0));
    assert_eq!(
        (second.name.as_str(), second.x, second.y),
        ("y", 230.0, 100.0)
    );
}

#[test]
fn a_tab_or_a_new_line_in_a_name_is_written_as_a_space() {
    // An attribute that has a raw new line or tab is read back as a space by every XML reader, and a
    // carriage return as a new line; the writer says it plainly. Taking the arm out wrote them raw.
    let fsm = machine_of_states(1);
    for raw in ["a\nb", "a\tb", "a\rb"] {
        let layout = [JffState {
            id: engine_core::StateId(0),
            name: raw.into(),
            x: 1.0,
            y: 2.0,
        }];
        let text = to_jff(&fsm, &layout).unwrap();
        assert!(text.contains("name=\"a b\""), "{raw:?}: {text}");
    }
}
