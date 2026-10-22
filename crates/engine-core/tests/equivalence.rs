use engine_core::{
    Budget, Change, Conversion, ConversionBudget, Equivalence, EquivalenceBudget, Fsm, FsmKind,
    Minimization, MinimizeBudget, Param, Simulation, StateId, StopReason, SymbolId, determinize,
    equivalent, minimize, simulate,
};
use proptest::prelude::*;

mod common;
use common::{
    A_STAR, A_STAR_B_STAR, A_STAR_B_STAR_DFSM, ENDS_10, EVEN, EVEN_MOD_4, arb_fsm, arb_pair,
    nth_from_end,
};

fn fsm(json: &str) -> Fsm {
    Fsm::from_json(json).unwrap()
}

fn odd() -> String {
    EVEN.replace(r#""accepting":[0]"#, r#""accepting":[1]"#)
}

fn limits(max_length: usize, max_strings: usize) -> EquivalenceBudget {
    EquivalenceBudget {
        max_length,
        max_strings,
        ..EquivalenceBudget::default()
    }
}

fn run(candidate: &str, reference: &str, budget: EquivalenceBudget) -> Equivalence {
    equivalent(&fsm(candidate), &fsm(reference), budget).unwrap()
}

fn ids(strings: &[Vec<SymbolId>]) -> Vec<Vec<u16>> {
    strings
        .iter()
        .map(|s| s.iter().map(|x| x.0).collect())
        .collect()
}

fn is_equivalent(result: &Equivalence) -> bool {
    matches!(result, Equivalence::Equivalent { .. })
}

fn states(xs: &[StateId]) -> Vec<u32> {
    xs.iter().map(|s| s.0).collect()
}

// ---- equivalent machines ----

#[test]
fn machines_for_the_same_language_are_equivalent() {
    let reordered = EVEN
        .replace(r#""alphabet":["a","b"]"#, r#""alphabet":["b","a"]"#)
        .replace(r#""on":"a""#, r#""on":"x""#)
        .replace(r#""on":"b""#, r#""on":"a""#)
        .replace(r#""on":"x""#, r#""on":"b""#);
    for (a, b) in [
        (EVEN, EVEN_MOD_4),
        (EVEN_MOD_4, EVEN),
        (A_STAR_B_STAR, A_STAR_B_STAR_DFSM),
        (A_STAR_B_STAR_DFSM, A_STAR_B_STAR),
        (EVEN, EVEN),
        (EVEN, reordered.as_str()),
    ] {
        let result = run(a, b, EquivalenceBudget::default());
        assert!(matches!(result, Equivalence::Equivalent { .. }), "{a}\n{b}");
    }
}

#[test]
fn an_ndfsm_equals_its_determinization() {
    let ndfsm = fsm(ENDS_10);
    let Conversion::Finished { dfsm, .. } =
        determinize(&ndfsm, ConversionBudget::default()).unwrap()
    else {
        panic!()
    };
    let result = equivalent(&ndfsm, &dfsm, EquivalenceBudget::default()).unwrap();
    assert!(matches!(result, Equivalence::Equivalent { .. }));
}

// ---- different machines ----

#[test]
fn even_against_odd_has_the_empty_string_as_witness() {
    let Equivalence::Different {
        witness,
        accepted_but_should_reject,
        rejected_but_should_accept,
        lists_truncated,
        trace,
    } = run(EVEN, &odd(), limits(3, 5))
    else {
        panic!()
    };
    assert!(witness.string.is_empty());
    assert!(witness.candidate_accepts);
    assert_eq!(
        ids(&accepted_but_should_reject),
        vec![vec![], vec![0, 0], vec![0, 1], vec![1, 0], vec![1, 1]]
    );
    assert_eq!(
        ids(&rejected_but_should_accept),
        vec![
            vec![0],
            vec![1],
            vec![0, 0, 0],
            vec![0, 0, 1],
            vec![0, 1, 0]
        ]
    );
    assert!(lists_truncated);
    assert_eq!(trace.len(), 1);
    assert_eq!(
        trace[0].message.key,
        "equivalent.accepted_but_should_reject"
    );
    assert_eq!(
        trace[0].change,
        Change::Product {
            position: 0,
            symbol: None,
            candidate: vec![StateId(0)],
            reference: vec![StateId(0)],
        }
    );
}

#[test]
fn complete_lists_when_the_limits_are_large_enough() {
    let Equivalence::Different {
        accepted_but_should_reject,
        rejected_but_should_accept,
        lists_truncated,
        ..
    } = run(EVEN, &odd(), limits(3, 100))
    else {
        panic!()
    };
    assert_eq!(accepted_but_should_reject.len(), 1 + 4);
    assert_eq!(rejected_but_should_accept.len(), 2 + 8);
    assert!(!lists_truncated);
}

#[test]
fn a_star_against_a_star_b_star_has_the_witness_b() {
    let Equivalence::Different {
        witness,
        accepted_but_should_reject,
        rejected_but_should_accept,
        lists_truncated,
        trace,
    } = run(A_STAR, A_STAR_B_STAR, limits(3, 5))
    else {
        panic!()
    };
    assert_eq!(ids(&[witness.string]), vec![vec![1]]);
    assert!(!witness.candidate_accepts);
    assert!(accepted_but_should_reject.is_empty());
    assert_eq!(
        ids(&rejected_but_should_accept),
        vec![
            vec![1],
            vec![0, 1],
            vec![1, 1],
            vec![0, 0, 1],
            vec![0, 1, 1]
        ]
    );
    assert!(lists_truncated);

    // The witness path, in both machines: the reference starts with eps-closure {0, 1}.
    let keys: Vec<&str> = trace.iter().map(|s| s.message.key).collect();
    assert_eq!(
        keys,
        ["equivalent.start", "equivalent.rejected_but_should_accept"]
    );
    let Change::Product {
        position,
        symbol,
        candidate,
        reference,
    } = &trace[0].change
    else {
        panic!()
    };
    assert_eq!((*position, *symbol), (0, None));
    assert_eq!(
        (states(candidate), states(reference)),
        (vec![0], vec![0, 1])
    );
    let Change::Product {
        position,
        symbol,
        candidate,
        reference,
    } = &trace[1].change
    else {
        panic!()
    };
    assert_eq!((*position, *symbol), (1, Some(SymbolId(1))));
    assert_eq!((states(candidate), states(reference)), (vec![1], vec![1]));
    assert_eq!(
        trace[1].message.params.get("position"),
        Some(&Param::Int(1))
    );
}

#[test]
fn the_witness_is_the_first_of_the_shortest_strings() {
    // "" is accepted by both. "a" is accepted by a*b* only, and "a" comes before "b".
    let Equivalence::Different { witness, .. } = run(EVEN, A_STAR_B_STAR, limits(2, 5)) else {
        panic!()
    };
    assert_eq!(ids(&[witness.string]), vec![vec![0]]);
    assert!(!witness.candidate_accepts);
}

// ---- errors and budgets ----

#[test]
fn both_machines_need_a_start_state() {
    let no_start = EVEN.replace(r#""start":0"#, r#""start":null"#);
    let m = equivalent(&fsm(&no_start), &fsm(EVEN), EquivalenceBudget::default()).unwrap_err();
    assert_eq!(m.key, "equivalent.no_start_state");
    assert_eq!(m.params.get("side"), Some(&Param::Text("candidate".into())));
    let m = equivalent(&fsm(EVEN), &fsm(&no_start), EquivalenceBudget::default()).unwrap_err();
    assert_eq!(m.params.get("side"), Some(&Param::Text("reference".into())));
}

#[test]
fn the_alphabets_must_have_the_same_symbols() {
    let m = equivalent(&fsm(EVEN), &fsm(ENDS_10), EquivalenceBudget::default()).unwrap_err();
    assert_eq!(m.key, "equivalent.alphabet_mismatch");
    assert!(m.params.contains_key("symbol") && m.params.contains_key("side"));
}

#[test]
fn too_many_pairs_stops_the_search() {
    let json = nth_from_end(12); // 4,096 pairs against itself
    let small = EquivalenceBudget {
        max_pairs: 100,
        ..EquivalenceBudget::default()
    };
    assert_eq!(
        run(&json, &json, small),
        Equivalence::Stopped {
            reason: StopReason::MaxPairs
        }
    );
    let result = run(&json, &json, EquivalenceBudget::default());
    assert!(matches!(result, Equivalence::Equivalent { pairs } if pairs > 4000));
}

#[test]
fn the_visit_budget_cuts_the_lists_but_not_the_witness() {
    let tiny = EquivalenceBudget {
        max_visits: 3,
        ..limits(8, 5)
    };
    let Equivalence::Different {
        witness,
        lists_truncated,
        ..
    } = run(EVEN, &odd(), tiny)
    else {
        panic!()
    };
    assert!(witness.string.is_empty());
    assert!(lists_truncated);
}

// ---- properties ----

fn accepts(fsm: &Fsm, input: &[SymbolId]) -> bool {
    match simulate(fsm, input, Budget::default()).unwrap() {
        Simulation::Finished { accepted, .. } => accepted,
        Simulation::Stopped { .. } => panic!("stopped"),
    }
}

/// Every string over `k` symbols with at most `max_len` symbols, shortest first.
fn all_strings(k: usize, max_len: usize) -> Vec<Vec<SymbolId>> {
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

proptest! {
    #[test]
    fn every_reported_string_really_tells_the_machines_apart((a, b) in arb_pair()) {
        prop_assume!(a.start.is_some() && b.start.is_some());
        let budget = limits(4, 6);
        let result = equivalent(&a, &b, budget).unwrap();
        let Equivalence::Different {
            witness,
            accepted_but_should_reject: wrongly_accepted,
            rejected_but_should_accept: wrongly_rejected,
            ..
        } = result else {
            return Ok(());
        };
        prop_assert_eq!(accepts(&a, &witness.string), witness.candidate_accepts);
        prop_assert_eq!(accepts(&b, &witness.string), !witness.candidate_accepts);
        for s in &wrongly_accepted {
            prop_assert!(accepts(&a, s) && !accepts(&b, s));
        }
        for s in &wrongly_rejected {
            prop_assert!(!accepts(&a, s) && accepts(&b, s));
        }
        let first = if witness.candidate_accepts { &wrongly_accepted } else { &wrongly_rejected };
        if witness.string.len() <= budget.max_length {
            prop_assert_eq!(first.first(), Some(&witness.string));
        }
        let key = |s: &Vec<SymbolId>| (s.len(), s.clone());
        for list in [&wrongly_accepted, &wrongly_rejected] {
            prop_assert!(list.windows(2).all(|w| key(&w[0]) < key(&w[1])));
            prop_assert!(list.iter().all(|s| s.len() <= budget.max_length));
            prop_assert!(list.len() <= budget.max_strings);
        }
    }

    #[test]
    fn nothing_shorter_than_the_witness_tells_the_machines_apart((a, b) in arb_pair()) {
        prop_assume!(a.start.is_some() && b.start.is_some());
        let k = a.alphabet.len();
        let result = equivalent(&a, &b, EquivalenceBudget::default()).unwrap();
        match result {
            Equivalence::Different { witness, .. } if witness.string.len() <= 7 => {
                let shorter = all_strings(k, witness.string.len().saturating_sub(1));
                let limit = if witness.string.is_empty() { 0 } else { shorter.len() };
                for s in &shorter[..limit] {
                    prop_assert_eq!(accepts(&a, s), accepts(&b, s));
                }
            }
            Equivalence::Equivalent { .. } => {
                for s in all_strings(k, 5) {
                    prop_assert_eq!(accepts(&a, &s), accepts(&b, &s));
                }
            }
            _ => {}
        }
    }

    #[test]
    fn complete_lists_match_brute_force((a, b) in arb_pair()) {
        prop_assume!(a.start.is_some() && b.start.is_some());
        let k = a.alphabet.len();
        let budget = EquivalenceBudget { max_strings: 1_000_000, ..limits(4, 0) };
        let budget = EquivalenceBudget { max_strings: 1_000_000, ..budget };
        let Equivalence::Different {
            accepted_but_should_reject: wrongly_accepted,
            rejected_but_should_accept: wrongly_rejected,
            lists_truncated,
            ..
        } = equivalent(&a, &b, budget).unwrap() else {
            return Ok(());
        };
        prop_assert!(!lists_truncated);
        let all = all_strings(k, 4);
        let expect = |want: bool| -> Vec<Vec<SymbolId>> {
            all.iter()
                .filter(|s| accepts(&a, s) != accepts(&b, s) && accepts(&a, s) == want)
                .cloned()
                .collect()
        };
        prop_assert_eq!(wrongly_accepted, expect(true));
        prop_assert_eq!(wrongly_rejected, expect(false));
    }

    #[test]
    fn swapping_the_machines_swaps_the_direction((a, b) in arb_pair()) {
        prop_assume!(a.start.is_some() && b.start.is_some());
        let forward = equivalent(&a, &b, EquivalenceBudget::default()).unwrap();
        let backward = equivalent(&b, &a, EquivalenceBudget::default()).unwrap();
        match (forward, backward) {
            (Equivalence::Equivalent { .. }, Equivalence::Equivalent { .. }) => {}
            (Equivalence::Different { witness: w1, .. }, Equivalence::Different { witness: w2, .. }) => {
                prop_assert_eq!(&w1.string, &w2.string);
                prop_assert_eq!(w1.candidate_accepts, !w2.candidate_accepts);
            }
            (x, y) => prop_assert!(false, "{:?} vs {:?}", x, y),
        }
    }

    #[test]
    fn a_machine_equals_itself_its_determinization_and_its_minimization(original in arb_fsm()) {
        prop_assume!(original.start.is_some());
        let default = EquivalenceBudget::default();
        let same = equivalent(&original, &original, default).unwrap();
        prop_assert!(is_equivalent(&same));
        let Conversion::Finished { dfsm, .. } =
            determinize(&original, ConversionBudget::default()).unwrap()
        else {
            return Ok(());
        };
        let same = equivalent(&original, &dfsm, default).unwrap();
        prop_assert!(is_equivalent(&same));
        let Minimization::Finished { dfsm: minimal, .. } =
            minimize(&dfsm, MinimizeBudget::default()).unwrap()
        else {
            return Ok(());
        };
        prop_assert_eq!(minimal.kind, FsmKind::Dfsm);
        let same = equivalent(&dfsm, &minimal, default).unwrap();
        prop_assert!(is_equivalent(&same));
    }

    #[test]
    fn small_budgets_never_panic(
        (a, b) in arb_pair(),
        max_pairs in 0usize..6,
        max_visits in 0usize..20,
        max_length in 0usize..5,
        max_strings in 0usize..4,
    ) {
        prop_assume!(a.start.is_some() && b.start.is_some());
        let budget = EquivalenceBudget { max_pairs, max_visits, max_length, max_strings };
        let first = equivalent(&a, &b, budget).unwrap();
        prop_assert_eq!(&first, &equivalent(&a, &b, budget).unwrap());
        if let Equivalence::Different { accepted_but_should_reject, rejected_but_should_accept, .. } = &first {
            prop_assert!(accepted_but_should_reject.len() <= max_strings);
            prop_assert!(rejected_but_should_accept.len() <= max_strings);
        }
    }
}
