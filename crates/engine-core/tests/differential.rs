//! Differential tests: the engine against answers from the Python package `automata-lib`.
//! The fixtures are made by `tools/gen_fixtures.py` and are committed, so these tests do not
//! need Python. Languages are compared with `equivalent`, because the two programs number
//! their states in different ways.

use engine_core::{
    Budget, Conversion, ConversionBudget, Equivalence, EquivalenceBudget, Fsm, FsmKind,
    Intersection, Minimization, MinimizeBudget, Severity, Simulation, StateId, SymbolId, Xor,
    complement, determinize, equivalent, intersection, minimize, simulate, union, validate, xor,
};
use serde_json::Value;
use std::collections::BTreeSet;

fn cases(text: &str) -> Vec<Value> {
    let file: Value = serde_json::from_str(text).unwrap();
    file["cases"].as_array().unwrap().clone()
}

fn fsm(case: &Value, key: &str) -> Fsm {
    Fsm::from_json(&case[key].to_string()).unwrap()
}

fn strings(case: &Value, fsm: &Fsm) -> Vec<Vec<SymbolId>> {
    case["strings"]
        .as_array()
        .unwrap()
        .iter()
        .map(|s| {
            s.as_array()
                .unwrap()
                .iter()
                .map(|c| fsm.alphabet.id(c.as_str().unwrap()).unwrap())
                .collect()
        })
        .collect()
}

fn verdicts(case: &Value, key: &str) -> Vec<bool> {
    case[key]
        .as_array()
        .unwrap()
        .iter()
        .map(|b| b.as_bool().unwrap())
        .collect()
}

fn accepts(fsm: &Fsm, input: &[SymbolId]) -> bool {
    match simulate(fsm, input, Budget::default()).unwrap() {
        Simulation::Finished { accepted, .. } => accepted,
        Simulation::Stopped { .. } => panic!("the run stopped"),
    }
}

/// The machine accepts and rejects the strings as the reference says.
fn check_strings(case: &Value, fsm: &Fsm, expected: &[bool], what: &str) {
    for (input, want) in strings(case, fsm).iter().zip(expected) {
        assert_eq!(accepts(fsm, input), *want, "{what} on {input:?}");
    }
}

fn same_language(a: &Fsm, b: &Fsm, what: &str) {
    let result = equivalent(a, b, EquivalenceBudget::default()).unwrap();
    assert!(
        matches!(result, Equivalence::Equivalent { .. }),
        "{what}: {result:?}"
    );
}

#[test]
fn determinize_matches_automata_lib() {
    let all = cases(include_str!("fixtures/determinize.json"));
    assert!(all.len() >= 100);
    for (n, case) in all.iter().enumerate() {
        let nfa = fsm(case, "input");
        let expected = fsm(case, "expected");
        let Conversion::Finished { dfsm, .. } =
            determinize(&nfa, ConversionBudget::default()).unwrap()
        else {
            panic!("case {n}: the conversion stopped");
        };
        assert_eq!(dfsm.kind, FsmKind::Dfsm, "case {n}");
        same_language(&dfsm, &expected, &format!("case {n}: language"));
        let verdicts = verdicts(case, "accepts");
        check_strings(case, &nfa, &verdicts, &format!("case {n}: NDFSM"));
        check_strings(case, &dfsm, &verdicts, &format!("case {n}: DFSM"));
    }
}

#[test]
fn minimize_matches_automata_lib() {
    let all = cases(include_str!("fixtures/minimize.json"));
    assert!(all.len() >= 100);
    for (n, case) in all.iter().enumerate() {
        let dfa = fsm(case, "input");
        let expected = fsm(case, "expected");
        let Minimization::Finished { dfsm, .. } =
            minimize(&dfa, MinimizeBudget::default()).unwrap()
        else {
            panic!("case {n}: the minimization stopped");
        };
        same_language(&dfsm, &expected, &format!("case {n}: language"));
        // A minimal DFSM is unique up to the names of its states, so the sizes must agree.
        let states = case["expectedStates"].as_u64().unwrap() as usize;
        assert_eq!(dfsm.states.len(), states, "case {n}: number of states");
        check_strings(
            case,
            &dfsm,
            &verdicts(case, "accepts"),
            &format!("case {n}"),
        );
    }
}

#[test]
fn equivalence_matches_automata_lib() {
    let all = cases(include_str!("fixtures/equivalence.json"));
    assert!(all.len() >= 100);
    let (mut same, mut different) = (0, 0);
    for (n, case) in all.iter().enumerate() {
        let first = fsm(case, "first");
        let second = fsm(case, "second");
        check_strings(case, &first, &verdicts(case, "firstAccepts"), "first");
        check_strings(case, &second, &verdicts(case, "secondAccepts"), "second");
        let result = equivalent(&first, &second, EquivalenceBudget::default()).unwrap();
        match result {
            Equivalence::Equivalent { .. } => {
                same += 1;
                assert!(case["equivalent"].as_bool().unwrap(), "case {n}");
            }
            Equivalence::Different { witness, .. } => {
                different += 1;
                assert!(!case["equivalent"].as_bool().unwrap(), "case {n}");
                // The witness is accepted by exactly one machine, as the result says.
                let word = &witness.string;
                assert_eq!(accepts(&first, word), witness.candidate_accepts, "case {n}");
                assert_ne!(accepts(&first, word), accepts(&second, word), "case {n}");
            }
            other => panic!("case {n}: {other:?}"),
        }
    }
    // The fixtures hold both kinds of pair.
    assert!(
        same >= 20 && different >= 20,
        "{same} equal, {different} different"
    );
}

/// Is any accepting state reachable from the start state?
fn accepts_something(fsm: &Fsm) -> bool {
    let mut seen = vec![fsm.start.unwrap()];
    let mut next = 0;
    while next < seen.len() {
        let from = seen[next];
        next += 1;
        for t in fsm.transitions.iter().filter(|t| t.from == from) {
            if !seen.contains(&t.to) {
                seen.push(t.to);
            }
        }
    }
    seen.iter().any(|q| fsm.accepting.contains(q))
}

#[test]
fn xor_matches_automata_lib() {
    let all = cases(include_str!("fixtures/xor.json"));
    assert!(all.len() >= 100);
    let (mut empty, mut not_empty, mut with_ndfsm) = (0, 0, 0);
    for (n, case) in all.iter().enumerate() {
        let first = fsm(case, "first");
        let second = fsm(case, "second");
        if first.kind == FsmKind::Ndfsm || second.kind == FsmKind::Ndfsm {
            with_ndfsm += 1;
        }
        let Xor::Finished { fsm: result, .. } =
            xor(&first, &second, ConversionBudget::default()).unwrap()
        else {
            panic!("case {n}: stopped");
        };
        assert_eq!(result.kind, FsmKind::Dfsm, "case {n}");
        // A string is in the XOR exactly when one machine accepts it and the other does not:
        // the verdicts of the two machines that were given are the reference.
        let expected = verdicts(case, "accepts");
        for ((a, b), want) in verdicts(case, "firstAccepts")
            .into_iter()
            .zip(verdicts(case, "secondAccepts"))
            .zip(&expected)
        {
            assert_eq!(a != b, *want, "case {n}: the fixture itself");
        }
        check_strings(case, &result, &expected, &format!("case {n}"));
        // The same language as `(a ^ b).minify()` of automata-lib, and the same size when minimal.
        same_language(&result, &fsm(case, "expected"), &format!("case {n}"));
        let Minimization::Finished { dfsm: minimal, .. } =
            minimize(&result, MinimizeBudget::default()).unwrap()
        else {
            panic!("case {n}: minimize stopped");
        };
        assert_eq!(
            minimal.states.len() as u64,
            case["expectedStates"].as_u64().unwrap(),
            "case {n}"
        );
        // Empty exactly when the two machines are equivalent.
        let is_empty = !accepts_something(&result);
        assert_eq!(is_empty, case["empty"].as_bool().unwrap(), "case {n}");
        let both = equivalent(&first, &second, EquivalenceBudget::default()).unwrap();
        assert_eq!(
            is_empty,
            matches!(both, Equivalence::Equivalent { .. }),
            "case {n}"
        );
        if is_empty {
            empty += 1;
        } else {
            not_empty += 1;
        }
    }
    // The fixtures hold both: pairs that are equivalent and pairs that are not, and NDFSMs.
    assert!(
        empty >= 10 && not_empty >= 10 && with_ndfsm >= 30,
        "{empty} empty, {not_empty} not empty, {with_ndfsm} with an NDFSM"
    );
}

// ---- union, intersection and complement ----
//
// Three references. The package `automata-lib` (the fixtures); the verdicts of the two machines that
// were given (a string is in the union when one of them accepts it, and so on); and an acceptor that
// is written here and does not use the engine at all (`member`), which is asked about *every* string
// up to a length, not only the sample of the fixtures.

/// Every word over the symbols, by length up to `max`, as lists of names.
fn all_words(names: &[String], max: usize) -> Vec<Vec<String>> {
    let mut words = vec![Vec::new()];
    let mut from = 0;
    for _ in 0..max {
        let end = words.len();
        for i in from..end {
            for name in names {
                let mut longer = words[i].clone();
                longer.push(name.clone());
                words.push(longer);
            }
        }
        from = end;
    }
    words
}

/// How long the words are, so that every alphabet gives about the same number of them.
fn longest(names: usize) -> usize {
    match names {
        0 => 0,
        1 => 10,
        2 => 8,
        _ => 6,
    }
}

/// Does the machine accept the word? Sets of states and the closure of ε-transitions, written
/// here on purpose: it does not use `simulate`, so a mistake there cannot hide a mistake in an
/// operation. The word is a list of names, because two machines may number the symbols differently.
fn member(fsm: &Fsm, word: &[String]) -> bool {
    let close = |set: &mut BTreeSet<StateId>| {
        let mut stack: Vec<StateId> = set.iter().copied().collect();
        while let Some(q) = stack.pop() {
            for t in fsm
                .transitions
                .iter()
                .filter(|t| t.from == q && t.on.is_none())
            {
                if set.insert(t.to) {
                    stack.push(t.to);
                }
            }
        }
    };
    let Some(start) = fsm.start else {
        return false;
    };
    let mut now = BTreeSet::from([start]);
    close(&mut now);
    for name in word {
        let Some(symbol) = fsm.alphabet.id(name) else {
            return false;
        };
        let mut next = BTreeSet::new();
        for t in &fsm.transitions {
            if t.on == Some(symbol) && now.contains(&t.from) {
                next.insert(t.to);
            }
        }
        close(&mut next);
        now = next;
    }
    now.iter().any(|q| fsm.accepting.binary_search(q).is_ok())
}

/// A result of an operation must be a machine that the engine itself calls valid.
fn assert_valid(fsm: &Fsm, what: &str) {
    let errors: Vec<_> = validate(fsm)
        .into_iter()
        .filter(|i| i.severity == Severity::Error)
        .collect();
    assert!(errors.is_empty(), "{what}: {errors:?}");
}

/// The number of states of the minimal DFSM of the machine.
fn minimal_states(fsm: &Fsm, what: &str) -> usize {
    let dfsm = if fsm.kind == FsmKind::Ndfsm {
        match determinize(fsm, ConversionBudget::default()).unwrap() {
            Conversion::Finished { dfsm, .. } => dfsm,
            Conversion::Stopped { .. } => panic!("{what}: determinize stopped"),
        }
    } else {
        fsm.clone()
    };
    match minimize(&dfsm, MinimizeBudget::default()).unwrap() {
        Minimization::Finished { dfsm, .. } => dfsm.states.len(),
        Minimization::Stopped { .. } => panic!("{what}: minimize stopped"),
    }
}

/// `result` agrees with `combine` of the two machines on every word up to the length.
fn check_every_word(
    first: &Fsm,
    second: &Fsm,
    result: &Fsm,
    combine: &dyn Fn(bool, bool) -> bool,
    what: &str,
) {
    let names = first.alphabet.names();
    for word in all_words(names, longest(names.len())) {
        let want = combine(member(first, &word), member(second, &word));
        assert_eq!(member(result, &word), want, "{what} on {word:?}");
    }
}

type Operation2 = fn(&Fsm, &Fsm) -> Fsm;

fn run_union(a: &Fsm, b: &Fsm) -> Fsm {
    union(a, b).unwrap().fsm
}

fn run_intersection(a: &Fsm, b: &Fsm) -> Fsm {
    match intersection(a, b, ConversionBudget::default()).unwrap() {
        Intersection::Finished { fsm, .. } => fsm,
        Intersection::Stopped { reason, .. } => panic!("intersection stopped, {reason:?}"),
    }
}

fn run_xor(a: &Fsm, b: &Fsm) -> Fsm {
    match xor(a, b, ConversionBudget::default()).unwrap() {
        Xor::Finished { fsm, .. } => fsm,
        Xor::Stopped { reason, .. } => panic!("xor stopped, {reason:?}"),
    }
}

/// The cases of an operation on two machines, against all three references. Returns how many of the
/// results are empty and how many are not, so that the file can say whether it tried both.
fn check_pair_file(
    text: &str,
    operation: Operation2,
    combine: &dyn Fn(bool, bool) -> bool,
    kind: FsmKind,
    name: &str,
) -> (usize, usize) {
    let all = cases(text);
    assert!(all.len() >= 100, "{name}");
    let (mut empty, mut nonempty) = (0, 0);
    for (n, case) in all.iter().enumerate() {
        let what = format!("{name} case {n}");
        let first = fsm(case, "first");
        let second = fsm(case, "second");
        let result = operation(&first, &second);
        assert_eq!(result.kind, kind, "{what}");
        assert_valid(&result, &what);
        // 1. Every word, against the acceptor written here.
        check_every_word(&first, &second, &result, combine, &what);
        // 2. The words of the fixture: the verdicts of the machines that were given (the reference that
        //    does not use the operation of the package) and of the engine's own `simulate`.
        let expected = verdicts(case, "accepts");
        check_strings(case, &result, &expected, &what);
        for (index, input) in strings(case, &first).iter().enumerate() {
            let (a, b) = (accepts(&first, input), accepts(&second, input));
            assert_eq!(a, verdicts(case, "firstAccepts")[index], "{what}: first");
            assert_eq!(b, verdicts(case, "secondAccepts")[index], "{what}: second");
            assert_eq!(combine(a, b), expected[index], "{what}: the fixture itself");
        }
        // 3. The machine of the package: the same language, and the same size when both are minimal.
        same_language(&result, &fsm(case, "expected"), &what);
        assert_eq!(
            minimal_states(&result, &what) as u64,
            case["expectedStates"].as_u64().unwrap(),
            "{what}"
        );
        if case["empty"].as_bool().unwrap() {
            empty += 1;
        } else {
            nonempty += 1;
        }
    }
    (empty, nonempty)
}

#[test]
fn union_matches_automata_lib_and_every_word() {
    let (empty, nonempty) = check_pair_file(
        include_str!("fixtures/union.json"),
        run_union,
        &|a, b| a || b,
        FsmKind::Ndfsm,
        "union",
    );
    assert!(
        empty >= 1 && nonempty >= 50,
        "{empty} empty, {nonempty} not empty"
    );
}

#[test]
fn intersection_matches_automata_lib_and_every_word() {
    let (empty, nonempty) = check_pair_file(
        include_str!("fixtures/intersection.json"),
        run_intersection,
        &|a, b| a && b,
        FsmKind::Dfsm,
        "intersection",
    );
    // The intersection is often empty, and often not: both are tried.
    assert!(
        empty >= 5 && nonempty >= 20,
        "{empty} empty, {nonempty} not empty"
    );
}

#[test]
fn xor_matches_every_word() {
    let (empty, nonempty) = check_pair_file(
        include_str!("fixtures/xor.json"),
        run_xor,
        &|a, b| a != b,
        FsmKind::Dfsm,
        "xor",
    );
    assert!(
        empty >= 10 && nonempty >= 10,
        "{empty} empty, {nonempty} not empty"
    );
}

#[test]
fn complement_matches_automata_lib_and_every_word() {
    let all = cases(include_str!("fixtures/complement.json"));
    assert!(all.len() >= 100);
    let mut empty = 0;
    for (n, case) in all.iter().enumerate() {
        let what = format!("complement case {n}");
        let input = fsm(case, "input");
        let result = complement(&input).unwrap().fsm;
        assert_eq!(result.kind, FsmKind::Dfsm, "{what}");
        assert_valid(&result, &what);
        // The same states and transitions: only the accepting states change.
        assert_eq!(result.states, input.states, "{what}");
        assert_eq!(result.transitions, input.transitions, "{what}");
        assert_eq!(result.start, input.start, "{what}");
        let names = input.alphabet.names();
        for word in all_words(names, longest(names.len())) {
            assert_eq!(
                member(&result, &word),
                !member(&input, &word),
                "{what} on {word:?}"
            );
        }
        check_strings(case, &input, &verdicts(case, "inputAccepts"), &what);
        check_strings(case, &result, &verdicts(case, "accepts"), &what);
        same_language(&result, &fsm(case, "expected"), &what);
        assert_eq!(
            minimal_states(&result, &what) as u64,
            case["expectedStates"].as_u64().unwrap(),
            "{what}"
        );
        // The complement of the complement is the machine itself.
        assert_eq!(complement(&result).unwrap().fsm, input, "{what}");
        if case["empty"].as_bool().unwrap() {
            empty += 1;
        }
    }
    assert!(empty >= 1, "no empty complement was tried");
}

/// The words of a case, as lists of names.
fn named_strings(case: &Value) -> Vec<Vec<String>> {
    case["strings"]
        .as_array()
        .unwrap()
        .iter()
        .map(|s| {
            s.as_array()
                .unwrap()
                .iter()
                .map(|c| c.as_str().unwrap().to_string())
                .collect()
        })
        .collect()
}

#[test]
fn the_acceptor_written_here_agrees_with_simulate_and_with_the_package() {
    // `member` is the reference of the tests above, so it is checked first: against the verdicts of
    // the package, and against the engine's `simulate`, on every machine of the fixtures.
    let files: [(&str, &[(&str, &str)]); 5] = [
        (
            include_str!("fixtures/determinize.json"),
            &[("input", "accepts")],
        ),
        (
            include_str!("fixtures/minimize.json"),
            &[("input", "accepts")],
        ),
        (
            include_str!("fixtures/equivalence.json"),
            &[("first", "firstAccepts"), ("second", "secondAccepts")],
        ),
        (
            include_str!("fixtures/union.json"),
            &[("first", "firstAccepts"), ("second", "secondAccepts")],
        ),
        (
            include_str!("fixtures/complement.json"),
            &[("input", "inputAccepts")],
        ),
    ];
    for (text, keys) in files {
        for case in cases(text) {
            for (machine, verdict) in keys {
                let m = fsm(&case, machine);
                let want = verdicts(&case, verdict);
                for (word, want) in named_strings(&case).iter().zip(&want) {
                    assert_eq!(member(&m, word), *want, "{machine} on {word:?}");
                }
                check_strings(&case, &m, &want, machine);
            }
        }
    }
}

// ---- hand-made machines for the corners that random machines rarely reach ----

fn machine(
    kind: &str,
    alphabet: &str,
    states: &str,
    accepting: &str,
    start: u32,
    edges: &[String],
) -> Fsm {
    Fsm::from_json(&format!(
        r#"{{"schemaVersion":1,"kind":"{kind}","alphabet":{alphabet},"states":{states},"start":{start},"accepting":{accepting},"transitions":[{}]}}"#,
        edges.join(",")
    ))
    .unwrap()
}

fn edge(from: u32, on: &str, to: u32) -> String {
    let on = if on.is_empty() {
        "null".to_string()
    } else {
        format!("\"{on}\"")
    };
    format!(r#"{{"from":{from},"on":{on},"to":{to}}}"#)
}

/// Machines over {a, b} that cover the language that accepts nothing, every string, only the empty
/// string, ε-transitions that loop, nondeterminism, a state that no string reaches, symbols in another
/// order, and sparse state numbers. The flag says which of them are complete DFSMs.
fn corner_machines() -> Vec<(&'static str, Fsm, bool)> {
    let ab = r#"["a","b"]"#;
    let loops = |q: u32| vec![edge(q, "a", q), edge(q, "b", q)];
    vec![
        (
            "nothing",
            machine("dfsm", ab, "[0]", "[]", 0, &loops(0)),
            true,
        ),
        (
            "everything",
            machine("dfsm", ab, "[0]", "[0]", 0, &loops(0)),
            true,
        ),
        (
            "only the empty string",
            machine(
                "dfsm",
                ab,
                "[0,1]",
                "[0]",
                0,
                &[vec![edge(0, "a", 1), edge(0, "b", 1)], loops(1)].concat(),
            ),
            true,
        ),
        (
            "epsilon cycle",
            machine(
                "ndfsm",
                ab,
                "[0,1,2]",
                "[2]",
                0,
                &[
                    edge(0, "", 1),
                    edge(1, "", 0),
                    edge(1, "a", 2),
                    edge(2, "b", 0),
                ],
            ),
            false,
        ),
        (
            "nondeterministic, with a state that nobody reaches",
            machine(
                "ndfsm",
                ab,
                "[0,1,2,3]",
                "[2,3]",
                0,
                &[
                    edge(0, "a", 0),
                    edge(0, "a", 1),
                    edge(1, "b", 2),
                    edge(3, "a", 3),
                ],
            ),
            false,
        ),
        (
            "symbols in the other order",
            machine(
                "dfsm",
                r#"["b","a"]"#,
                "[0,1]",
                "[1]",
                0,
                &[
                    edge(0, "a", 1),
                    edge(0, "b", 0),
                    edge(1, "a", 1),
                    edge(1, "b", 0),
                ],
            ),
            true,
        ),
        (
            "sparse state numbers",
            machine(
                "dfsm",
                ab,
                "[5,9,12]",
                "[5,12]",
                9,
                &[
                    edge(5, "a", 9),
                    edge(5, "b", 5),
                    edge(9, "a", 12),
                    edge(9, "b", 5),
                    edge(12, "a", 12),
                    edge(12, "b", 9),
                ],
            ),
            true,
        ),
    ]
}

#[test]
fn the_corner_machines_give_the_right_language_in_every_operation() {
    let machines = corner_machines();
    for (name_a, a, _) in &machines {
        for (name_b, b, _) in &machines {
            let what = format!("{name_a} and {name_b}");
            check_every_word(
                a,
                b,
                &run_union(a, b),
                &|x, y| x || y,
                &format!("union of {what}"),
            );
            check_every_word(
                a,
                b,
                &run_intersection(a, b),
                &|x, y| x && y,
                &format!("intersection of {what}"),
            );
            check_every_word(
                a,
                b,
                &run_xor(a, b),
                &|x, y| x != y,
                &format!("xor of {what}"),
            );
        }
    }
    for (name, a, complete) in &machines {
        if !complete {
            // Not a complete DFSM: the engine says so, and does not guess.
            assert!(complement(a).is_err(), "complement of {name}");
            continue;
        }
        let result = complement(a).unwrap().fsm;
        assert_valid(&result, name);
        check_every_word(a, a, &result, &|x, _| !x, &format!("complement of {name}"));
    }
}

#[test]
fn machines_with_one_symbol_or_none_work_in_every_operation() {
    // One symbol: even and odd length. No symbols: the empty string is the only string there is.
    let a = r#"["a"]"#;
    let turn = [edge(0, "a", 1), edge(1, "a", 0)];
    let even = machine("dfsm", a, "[0,1]", "[0]", 0, &turn);
    let odd = machine("dfsm", a, "[0,1]", "[1]", 0, &turn);
    let accept = machine("dfsm", "[]", "[0]", "[0]", 0, &[]);
    let reject = machine("dfsm", "[]", "[0]", "[]", 0, &[]);
    let pairs = [
        (&even, &odd),
        (&even, &even),
        (&odd, &odd),
        (&accept, &reject),
        (&accept, &accept),
        (&reject, &reject),
    ];
    for (a, b) in pairs {
        check_every_word(a, b, &run_union(a, b), &|x, y| x || y, "union");
        check_every_word(
            a,
            b,
            &run_intersection(a, b),
            &|x, y| x && y,
            "intersection",
        );
        check_every_word(a, b, &run_xor(a, b), &|x, y| x != y, "xor");
    }
    for machine in [&even, &odd, &accept, &reject] {
        let result = complement(machine).unwrap().fsm;
        check_every_word(machine, machine, &result, &|x, _| !x, "complement");
    }
    // The union of even and odd is every string, and their intersection is none: one state each.
    assert_eq!(minimal_states(&run_union(&even, &odd), "union"), 1);
    assert_eq!(
        minimal_states(&run_intersection(&even, &odd), "intersection"),
        1
    );
}
