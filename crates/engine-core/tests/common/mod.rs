//! Shared test helpers. Each test file uses only some of them.

#![allow(dead_code)]

use engine_core::{Alphabet, Fsm, FsmKind, Regex, StateId, SymbolId, Transition};
use proptest::prelude::*;
use std::collections::{BTreeSet, HashMap};

// Rich: L = {w in {a, b}* : |w| is even}
pub const EVEN: &str = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,1],"start":0,"accepting":[0],"transitions":[{"from":0,"on":"a","to":1},{"from":0,"on":"b","to":1},{"from":1,"on":"a","to":0},{"from":1,"on":"b","to":0}]}"#;

// L = {w in {0, 1}* : w ends in 10}, as an NDFSM
pub const ENDS_10: &str = r#"{"schemaVersion":1,"kind":"ndfsm","alphabet":["0","1"],"states":[0,1,2],"start":0,"accepting":[2],"transitions":[{"from":0,"on":"0","to":0},{"from":0,"on":"1","to":0},{"from":0,"on":"1","to":1},{"from":1,"on":"0","to":2}]}"#;

// L = a*b*, as an NDFSM with an epsilon transition
pub const A_STAR_B_STAR: &str = r#"{"schemaVersion":1,"kind":"ndfsm","alphabet":["a","b"],"states":[0,1],"start":0,"accepting":[1],"transitions":[{"from":0,"on":"a","to":0},{"from":0,"on":null,"to":1},{"from":1,"on":"b","to":1}]}"#;

// A DFSM that only knows "a" from state 0
pub const PARTIAL: &str = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,1],"start":0,"accepting":[1],"transitions":[{"from":0,"on":"a","to":1}]}"#;

// L = {w : |w| is even}, counting modulo 4 (states 0 and 2 accept)
pub const EVEN_MOD_4: &str = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,1,2,3],"start":0,"accepting":[0,2],"transitions":[{"from":0,"on":"a","to":1},{"from":0,"on":"b","to":1},{"from":1,"on":"a","to":2},{"from":1,"on":"b","to":2},{"from":2,"on":"a","to":3},{"from":2,"on":"b","to":3},{"from":3,"on":"a","to":0},{"from":3,"on":"b","to":0}]}"#;

// L = a*, as a complete DFSM
pub const A_STAR: &str = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,1],"start":0,"accepting":[0],"transitions":[{"from":0,"on":"a","to":0},{"from":0,"on":"b","to":1},{"from":1,"on":"a","to":1},{"from":1,"on":"b","to":1}]}"#;

// L = a*b*, as a complete DFSM
pub const A_STAR_B_STAR_DFSM: &str = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,1,2],"start":0,"accepting":[0,1],"transitions":[{"from":0,"on":"a","to":0},{"from":0,"on":"b","to":1},{"from":1,"on":"a","to":2},{"from":1,"on":"b","to":1},{"from":2,"on":"a","to":2},{"from":2,"on":"b","to":2}]}"#;

/// "The n-th symbol from the end is a" as an NDFSM. Its DFSM needs 2^n states.
pub fn nth_from_end(n: u32) -> String {
    let mut t = vec![
        r#"{"from":0,"on":"a","to":0}"#.to_string(),
        r#"{"from":0,"on":"b","to":0}"#.to_string(),
        r#"{"from":0,"on":"a","to":1}"#.to_string(),
    ];
    for i in 1..n {
        t.push(format!(r#"{{"from":{i},"on":"a","to":{}}}"#, i + 1));
        t.push(format!(r#"{{"from":{i},"on":"b","to":{}}}"#, i + 1));
    }
    let states: Vec<String> = (0..=n).map(|i| i.to_string()).collect();
    format!(
        r#"{{"schemaVersion":1,"kind":"ndfsm","alphabet":["a","b"],"states":[{}],"start":0,"accepting":[{n}],"transitions":[{}]}}"#,
        states.join(","),
        t.join(",")
    )
}

/// Random machines over the given symbols, of both kinds, with sparse state ids and any mix
/// of valid and invalid structure (missing start, missing transitions, ε).
pub fn machine(symbols: Vec<String>) -> impl Strategy<Value = Fsm> {
    (
        prop::bool::ANY,
        1u32..8,
        prop::option::of(0u32..8),
        prop::collection::vec(prop::bool::ANY, 8),
        prop::collection::vec((0u32..8, 0usize..6, 0u32..8), 0..20),
    )
        .prop_map(move |(ndfsm, n, start, accepting, edges)| {
            let k = symbols.len();
            let id = |i: u32| StateId((i % n) * 3); // sparse ids
            let transitions = edges
                .into_iter()
                .map(|(f, s, t)| Transition {
                    from: id(f),
                    on: (s % (k + 1) < k).then(|| SymbolId((s % (k + 1)) as u16)),
                    to: id(t),
                })
                .collect();
            Fsm::new(
                if ndfsm { FsmKind::Ndfsm } else { FsmKind::Dfsm },
                Alphabet::new(symbols.clone()).unwrap(),
                (0..n).map(id).collect(),
                start.map(id),
                (0..n).filter(|&i| accepting[i as usize]).map(id).collect(),
                transitions,
            )
            .unwrap()
        })
}

pub fn arb_fsm() -> impl Strategy<Value = Fsm> {
    prop::collection::btree_set("[a-z]{1,4}", 0..5)
        .prop_flat_map(|symbols| machine(symbols.into_iter().collect()))
}

/// Two random machines over the same alphabet.
pub fn arb_pair() -> impl Strategy<Value = (Fsm, Fsm)> {
    prop::collection::btree_set("[a-z]{1,3}", 1..4).prop_flat_map(|symbols| {
        let symbols: Vec<String> = symbols.into_iter().collect();
        (machine(symbols.clone()), machine(symbols))
    })
}

pub fn bx(r: Regex) -> Box<Regex> {
    Box::new(r)
}

pub fn union(a: Regex, b: Regex) -> Regex {
    Regex::Union(bx(a), bx(b))
}

pub fn concat(a: Regex, b: Regex) -> Regex {
    Regex::Concat(bx(a), bx(b))
}

pub fn star(a: Regex) -> Regex {
    Regex::Star(bx(a))
}

/// Small random regular expressions over the symbols 0, 1 and 2.
pub fn arb_regex() -> impl Strategy<Value = Regex> {
    let leaf = prop_oneof![
        Just(Regex::Empty),
        Just(Regex::Epsilon),
        (0u16..3).prop_map(|i| Regex::Symbol(SymbolId(i))),
    ];
    leaf.prop_recursive(4, 14, 2, |inner| {
        prop_oneof![
            (inner.clone(), inner.clone()).prop_map(|(a, b)| union(a, b)),
            (inner.clone(), inner.clone()).prop_map(|(a, b)| concat(a, b)),
            inner.clone().prop_map(star),
            inner.prop_map(|a| Regex::Plus(bx(a))),
        ]
    })
}

/// Every string over `k` symbols with at most `max_len` symbols, shortest first.
pub fn all_strings(k: usize, max_len: usize) -> Vec<Vec<SymbolId>> {
    let mut all = vec![vec![]];
    let mut level = vec![vec![]];
    for _ in 0..max_len {
        level = level
            .iter()
            .flat_map(|s: &Vec<SymbolId>| {
                (0..k).map(move |c| {
                    let mut t = s.clone();
                    t.push(SymbolId(c as u16));
                    t
                })
            })
            .collect();
        all.extend(level.iter().cloned());
    }
    all
}

// ---- references that are written in the tests and do not use the engine's algorithms ----

/// Every word over the symbols, by length up to `max`, as lists of names.
pub fn all_words(names: &[String], max: usize) -> Vec<Vec<String>> {
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
pub fn longest(names: usize) -> usize {
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
pub fn member(fsm: &Fsm, word: &[String]) -> bool {
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

/// Does the regular expression match the word (a list of names of the alphabet)? Dynamic
/// programming over the pieces of the word: `r` matches `word[i..j]`. It uses no machine and no
/// derivative, and none of the code of the engine except the syntax tree, so it is a reference
/// for `regex_to_fsm`, `fsm_to_regex` and `simplify` that shares no algorithm with them.
pub fn matches(regex: &Regex, alphabet: &Alphabet, word: &[String]) -> bool {
    let word: Vec<SymbolId> = word
        .iter()
        .map(|name| alphabet.id(name).expect("a symbol of the alphabet"))
        .collect();
    let mut memo = HashMap::new();
    pieces(regex, &word, 0, word.len(), &mut memo)
}

/// `kind` 0: `regex` matches `word[i..j]`. `kind` 1: `regex*` does.
type Memo = HashMap<(usize, u8, usize, usize), bool>;

fn pieces(regex: &Regex, word: &[SymbolId], i: usize, j: usize, memo: &mut Memo) -> bool {
    let key = (regex as *const Regex as usize, 0, i, j);
    if let Some(&known) = memo.get(&key) {
        return known;
    }
    let answer = match regex {
        Regex::Empty => false,
        Regex::Epsilon => i == j,
        Regex::Symbol(c) => j == i + 1 && word[i] == *c,
        Regex::Union(a, b) => pieces(a, word, i, j, memo) || pieces(b, word, i, j, memo),
        Regex::Concat(a, b) => {
            (i..=j).any(|k| pieces(a, word, i, k, memo) && pieces(b, word, k, j, memo))
        }
        Regex::Star(a) => repeats(a, word, i, j, memo),
        // One or more: a piece, then any number of pieces.
        Regex::Plus(a) => {
            (i..=j).any(|k| pieces(a, word, i, k, memo) && repeats(a, word, k, j, memo))
        }
    };
    memo.insert(key, answer);
    answer
}

/// Does `regex*` match `word[i..j]`? The empty piece, or a nonempty piece and then `regex*` again.
fn repeats(regex: &Regex, word: &[SymbolId], i: usize, j: usize, memo: &mut Memo) -> bool {
    let key = (regex as *const Regex as usize, 1, i, j);
    if let Some(&known) = memo.get(&key) {
        return known;
    }
    let answer = i == j
        || (i + 1..=j).any(|k| pieces(regex, word, i, k, memo) && repeats(regex, word, k, j, memo));
    memo.insert(key, answer);
    answer
}
