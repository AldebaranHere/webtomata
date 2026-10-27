//! The regular expression operations against a reference that shares no algorithm with them.
//!
//! `matches` (in `common`) decides whether a regular expression matches a word by dynamic
//! programming over the pieces of the word: no machine, no derivative, nothing of the engine but the
//! syntax tree. `member` decides whether a machine accepts a word with sets of states. Both are
//! written in the tests. With them, `regex_to_fsm`, `fsm_to_regex`, `simplify` and
//! `simplify_via_machine` are asked about *every* word up to a length, and about *every* small
//! regular expression and *every* small machine, not only a sample.

use engine_core::{
    Alphabet, Compiled, Extraction, Fsm, FsmKind, FsmToRegexBudget, Regex, RegexBudget, Severity,
    Simplification, SimplifyBudget, StateId, SymbolId, Transition, ViaMachineBudget, fsm_to_regex,
    parse_regex, regex_to_fsm, simplify, simplify_via_machine, validate,
};
use proptest::prelude::*;

mod common;
use common::{all_words, arb_regex, longest, machine, matches, member};

/// The audit of the engine runs the exhaustive tests bigger: `WEBTOMATA_EXHAUSTIVE=1 cargo test -p
/// engine-core --test regex_oracle --release`. A debug build takes minutes for the audit sizes, and the
/// tests that every pull request runs must stay short, so they use the small sizes.
fn audit() -> bool {
    std::env::var_os("WEBTOMATA_EXHAUSTIVE").is_some()
}

fn alphabet(names: &[&str]) -> Alphabet {
    Alphabet::new(names.iter().map(|s| s.to_string()).collect()).unwrap()
}

fn ab() -> Alphabet {
    alphabet(&["a", "b"])
}

fn abc() -> Alphabet {
    alphabet(&["a", "b", "c"])
}

fn parse(text: &str, alphabet: &Alphabet) -> Regex {
    parse_regex(text, alphabet).unwrap()
}

fn bx(r: Regex) -> Box<Regex> {
    Box::new(r)
}

// ---- the reference is checked first, by hand ----

#[test]
fn the_matcher_gives_the_answers_that_a_person_gives() {
    let a = ab();
    let cases: [(&str, &str, bool); 36] = [
        ("∅", "", false),
        ("∅", "a", false),
        ("ε", "", true),
        ("ε", "a", false),
        ("a", "a", true),
        ("a", "", false),
        ("a", "b", false),
        ("a", "aa", false),
        ("a∪b", "b", true),
        ("a∪b", "ab", false),
        ("ab", "ab", true),
        ("ab", "a", false),
        ("ab", "ba", false),
        ("a*", "", true),
        ("a*", "aaa", true),
        ("a*", "ab", false),
        ("a+", "", false),
        ("a+", "a", true),
        ("a+", "aaaa", true),
        ("(a∪b)*abb", "abb", true),
        ("(a∪b)*abb", "aabb", true),
        ("(a∪b)*abb", "abab", false),
        ("(a∪b)*abb", "ab", false),
        ("(ab)*", "", true),
        ("(ab)*", "abab", true),
        ("(ab)*", "aba", false),
        ("(ab)+", "", false),
        ("(a*)*", "aa", true),
        ("(a*)+", "", true),
        ("(ε∪a)+", "", true),
        ("∅*", "", true),
        ("∅*", "a", false),
        ("∅+", "", false),
        ("a∅", "a", false),
        ("(a∪ε)(b∪ε)", "", true),
        ("(a∪ε)(b∪ε)", "ba", false),
    ];
    for (text, word, want) in cases {
        let r = parse(text, &a);
        let word: Vec<String> = word.chars().map(String::from).collect();
        assert_eq!(matches(&r, &a, &word), want, "{text} on {word:?}");
    }
}

#[test]
fn the_acceptor_gives_the_answers_that_a_person_gives() {
    // a*b over {a, b} with an ε-transition: 0 -ε-> 1, 1 -a-> 1, 1 -b-> 2, accepting 2.
    let fsm = machine_of(
        FsmKind::Ndfsm,
        &ab(),
        3,
        0,
        &[2],
        &[(0, None, 1), (1, Some(0), 1), (1, Some(1), 2)],
    );
    for (word, want) in [
        ("b", true),
        ("aab", true),
        ("", false),
        ("ba", false),
        ("abb", false),
    ] {
        let word: Vec<String> = word.chars().map(String::from).collect();
        assert_eq!(member(&fsm, &word), want, "{word:?}");
    }
}

// ---- every regular expression up to a size ----

/// Every regular expression with exactly `nodes` nodes over {a, b}: `∅`, `ε` and the two symbols are
/// one node; star and plus add one over their operand; union and concatenation add one over their two.
fn trees(nodes: usize, memo: &mut Vec<Vec<Regex>>) -> Vec<Regex> {
    if let Some(known) = memo.get(nodes).filter(|k| !k.is_empty() || nodes == 0) {
        return known.clone();
    }
    let mut all = Vec::new();
    if nodes == 1 {
        all.extend([
            Regex::Empty,
            Regex::Epsilon,
            Regex::Symbol(SymbolId(0)),
            Regex::Symbol(SymbolId(1)),
        ]);
    } else if nodes > 1 {
        for inner in trees(nodes - 1, memo) {
            all.push(Regex::Star(bx(inner.clone())));
            all.push(Regex::Plus(bx(inner)));
        }
        for left in 1..nodes - 1 {
            let (a, b) = (trees(left, memo), trees(nodes - 1 - left, memo));
            for x in &a {
                for y in &b {
                    all.push(Regex::Union(bx(x.clone()), bx(y.clone())));
                    all.push(Regex::Concat(bx(x.clone()), bx(y.clone())));
                }
            }
        }
    }
    while memo.len() <= nodes {
        memo.push(Vec::new());
    }
    memo[nodes] = all.clone();
    all
}

fn up_to(nodes: usize) -> Vec<Regex> {
    let mut memo = Vec::new();
    (1..=nodes).flat_map(|n| trees(n, &mut memo)).collect()
}

fn assert_valid(fsm: &Fsm, what: &str) {
    let errors: Vec<_> = validate(fsm)
        .into_iter()
        .filter(|i| i.severity == Severity::Error)
        .collect();
    assert!(errors.is_empty(), "{what}: {errors:?}");
}

fn build(regex: &Regex, alphabet: &Alphabet) -> Fsm {
    match regex_to_fsm(regex, alphabet, RegexBudget::default()).unwrap() {
        Compiled::Finished { fsm, .. } => fsm,
        Compiled::Stopped { reason, .. } => panic!("stopped, {reason:?}"),
    }
}

fn simplified(regex: &Regex, alphabet: &Alphabet) -> (Regex, Vec<String>) {
    match simplify(regex, alphabet, SimplifyBudget::default()).unwrap() {
        Simplification::Finished { regex, trace } => (
            regex,
            trace
                .iter()
                .map(|s| match &s.change {
                    engine_core::Change::Expression { expression } => expression.clone(),
                    other => panic!("not an expression: {other:?}"),
                })
                .collect(),
        ),
        Simplification::Stopped { reason, .. } => panic!("stopped, {reason:?}"),
    }
}

/// Both expressions match the same words, up to the length.
fn same_words(a: &Regex, b: &Regex, alphabet: &Alphabet, max: usize, what: &str) {
    for word in all_words(alphabet.names(), max) {
        assert_eq!(
            matches(a, alphabet, &word),
            matches(b, alphabet, &word),
            "{what} on {word:?}"
        );
    }
}

fn regex_to_fsm_on_all(nodes: usize) {
    let a = ab();
    let words = all_words(a.names(), 6);
    let mut count = 0;
    for regex in up_to(nodes) {
        let text = regex.to_text(&a);
        let fsm = build(&regex, &a);
        assert_eq!(fsm.kind, FsmKind::Ndfsm, "{text}");
        assert_valid(&fsm, &text);
        for word in &words {
            assert_eq!(
                member(&fsm, word),
                matches(&regex, &a, word),
                "{text} on {word:?}"
            );
        }
        count += 1;
    }
    println!(
        "regex_to_fsm: {count} regular expressions, {} words each",
        words.len()
    );
}

#[test]
fn regex_to_fsm_agrees_with_the_matcher_on_every_regex_of_up_to_5_nodes() {
    // 1,628 regular expressions; 9,436 with 6 nodes and 58,000 with 7 in the audit.
    regex_to_fsm_on_all(if audit() { 7 } else { 5 });
}

fn simplify_on_all(nodes: usize) {
    let a = ab();
    let (mut count, mut shorter) = (0, 0);
    for regex in up_to(nodes) {
        let text = regex.to_text(&a);
        let (result, steps) = simplified(&regex, &a);
        assert!(result.size() <= regex.size(), "{text}");
        same_words(&regex, &result, &a, 6, &text);
        // Every line of the derivation means what the start means, and is smaller than the line before.
        let mut size = regex.size();
        for step in &steps {
            let line = parse(step, &a);
            assert!(line.size() < size, "{text}: {step}");
            same_words(&regex, &line, &a, 6, &format!("{text} step {step}"));
            size = line.size();
        }
        if result.size() < regex.size() {
            shorter += 1;
        }
        count += 1;
    }
    // The rules are used: a good part of the small expressions get shorter.
    assert!(shorter * 10 >= count, "{shorter} of {count} got shorter");
    println!("simplify: {count} regular expressions, {shorter} got shorter");
}

#[test]
fn simplify_keeps_the_language_on_every_regex_of_up_to_4_nodes() {
    // 284 regular expressions; 1,628 with 5 nodes and 9,436 with 6 in the audit.
    simplify_on_all(if audit() { 6 } else { 4 });
}

#[test]
fn simplify_via_the_machine_keeps_the_language_on_every_regex_of_up_to_4_nodes() {
    let a = ab();
    for regex in up_to(if audit() { 5 } else { 4 }) {
        let text = regex.to_text(&a);
        let Simplification::Finished {
            regex: result,
            trace,
        } = simplify_via_machine(&regex, &a, ViaMachineBudget::default()).unwrap()
        else {
            panic!("{text}: stopped");
        };
        let (plain, _) = simplified(&regex, &a);
        assert!(result.size() <= plain.size(), "{text}");
        assert!(!trace.is_empty(), "{text}");
        same_words(&regex, &result, &a, 6, &text);
    }
}

// ---- every small machine ----

/// A machine from a list of edges: (from, symbol, to), with `None` for ε.
fn machine_of(
    kind: FsmKind,
    alphabet: &Alphabet,
    states: u32,
    start: u32,
    accepting: &[u32],
    edges: &[(u32, Option<u16>, u32)],
) -> Fsm {
    Fsm::new(
        kind,
        alphabet.clone(),
        (0..states).map(StateId).collect(),
        Some(StateId(start)),
        accepting.iter().map(|&q| StateId(q)).collect(),
        edges
            .iter()
            .map(|&(from, on, to)| Transition {
                from: StateId(from),
                on: on.map(SymbolId),
                to: StateId(to),
            })
            .collect(),
    )
    .unwrap()
}

/// The regular expression of the machine means what the machine means, on every word up to the length.
fn check_regex_of(fsm: &Fsm, max: usize, what: &str) {
    let regex = match fsm_to_regex(fsm, FsmToRegexBudget::default()).unwrap() {
        Extraction::Finished { regex, .. } => regex,
        Extraction::Stopped { reason, .. } => panic!("{what}: stopped, {reason:?}"),
    };
    // The text of the expression gives the same expression, so the text that the page shows is the truth.
    assert_eq!(
        parse_regex(&regex.to_text(&fsm.alphabet), &fsm.alphabet)
            .unwrap()
            .to_text(&fsm.alphabet),
        regex.to_text(&fsm.alphabet),
        "{what}"
    );
    for word in all_words(fsm.alphabet.names(), max) {
        assert_eq!(
            matches(&regex, &fsm.alphabet, &word),
            member(fsm, &word),
            "{what} on {word:?}"
        );
    }
}

/// Every complete DFSM with `states` states over {a, b}: start state 0, every choice of the
/// transitions and of the accepting states.
fn every_dfsm(states: u32, mut each: impl FnMut(Fsm, String)) {
    let a = ab();
    let slots = states * 2;
    let targets = (states as u64).pow(slots);
    for code in 0..targets {
        let mut rest = code;
        let mut edges = Vec::new();
        for from in 0..states {
            for symbol in 0..2u16 {
                edges.push((from, Some(symbol), (rest % states as u64) as u32));
                rest /= states as u64;
            }
        }
        for accept in 0..(1u32 << states) {
            let accepting: Vec<u32> = (0..states).filter(|q| accept >> q & 1 == 1).collect();
            let fsm = machine_of(FsmKind::Dfsm, &a, states, 0, &accepting, &edges);
            each(
                fsm,
                format!("{states} states, edges {code}, accepting {accept}"),
            );
        }
    }
}

#[test]
fn fsm_to_regex_agrees_with_the_acceptor_on_every_dfsm_of_up_to_2_states() {
    // 68 machines; 5,898 with 3 states in the audit.
    let mut count = 0;
    for states in 1..=(if audit() { 3 } else { 2 }) {
        every_dfsm(states, |fsm, what| {
            check_regex_of(&fsm, 7, &what);
            count += 1;
        });
    }
    println!("fsm_to_regex: {count} complete DFSMs");
}

/// Every NFA with `states` states over one symbol `a` and ε: every choice of the edges, of the start
/// state and of the accepting states.
fn every_small_nfa(
    states: u32,
    symbols: &[Option<u16>],
    names: &[&str],
    mut each: impl FnMut(Fsm, String),
) {
    let a = alphabet(names);
    let mut slots = Vec::new();
    for from in 0..states {
        for &on in symbols {
            for to in 0..states {
                slots.push((from, on, to));
            }
        }
    }
    for code in 0u64..(1u64 << slots.len()) {
        let edges: Vec<(u32, Option<u16>, u32)> = slots
            .iter()
            .enumerate()
            .filter(|(i, _)| code >> i & 1 == 1)
            .map(|(_, &e)| e)
            .collect();
        for start in 0..states {
            for accept in 0..(1u32 << states) {
                let accepting: Vec<u32> = (0..states).filter(|q| accept >> q & 1 == 1).collect();
                let fsm = machine_of(FsmKind::Ndfsm, &a, states, start, &accepting, &edges);
                each(
                    fsm,
                    format!("{states} states, edges {code}, start {start}, accepting {accept}"),
                );
            }
        }
    }
}

#[test]
fn fsm_to_regex_agrees_with_the_acceptor_on_every_nfa_of_2_states_over_one_symbol() {
    // 2,048 machines (the edges between two states over `a` and ε, every start and every set of
    // accepting states); only the words up to 6 in an ordinary run.
    let max = if audit() { 10 } else { 6 };
    let mut count = 0;
    every_small_nfa(2, &[Some(0), None], &["a"], |fsm, what| {
        check_regex_of(&fsm, max, &what);
        count += 1;
    });
    println!("fsm_to_regex: {count} NFAs");
}

#[test]
fn fsm_to_regex_agrees_with_the_acceptor_on_every_nfa_of_2_states_over_two_symbols() {
    // 2^12 sets of edges, 2 start states and 4 sets of accepting states: 32,768 machines. Only in the audit.
    if !audit() {
        return;
    }
    let mut count = 0;
    every_small_nfa(2, &[Some(0), Some(1), None], &["a", "b"], |fsm, what| {
        check_regex_of(&fsm, 7, &what);
        count += 1;
    });
    println!("fsm_to_regex: {count} NFAs");
}

// ---- random machines and expressions that are bigger than the exhaustive ones ----

proptest! {
    #![proptest_config(ProptestConfig::with_cases(64))]

    #[test]
    fn regex_to_fsm_agrees_with_the_matcher_on_random_regexes(r in arb_regex()) {
        let a = abc();
        let fsm = build(&r, &a);
        prop_assert!(validate(&fsm).iter().all(|i| i.severity != Severity::Error));
        for word in all_words(a.names(), longest(3)) {
            prop_assert_eq!(member(&fsm, &word), matches(&r, &a, &word), "{}", r.to_text(&a));
        }
    }

    #[test]
    fn simplify_keeps_the_language_on_random_regexes(r in arb_regex()) {
        let a = abc();
        let (result, _) = simplified(&r, &a);
        prop_assert!(result.size() <= r.size());
        for word in all_words(a.names(), longest(3)) {
            prop_assert_eq!(matches(&result, &a, &word), matches(&r, &a, &word), "{}", r.to_text(&a));
        }
    }

    #[test]
    fn fsm_to_regex_agrees_with_the_acceptor_on_random_machines(
        m in machine(vec!["a".into(), "b".into()])
    ) {
        // Machines of every shape: with and without a start state, with unreachable states,
        // sparse numbers. A machine that the engine refuses is not a case.
        let Ok(extraction) = fsm_to_regex(&m, FsmToRegexBudget::default()) else {
            return Ok(());
        };
        let Extraction::Finished { regex, .. } = extraction else {
            return Ok(());
        };
        for word in all_words(m.alphabet.names(), 7) {
            prop_assert_eq!(matches(&regex, &m.alphabet, &word), member(&m, &word));
        }
    }
}
