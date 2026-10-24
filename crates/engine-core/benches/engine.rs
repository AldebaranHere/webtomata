//! Benchmarks of `determinize`, `minimize` and `equivalent` (E13), on named families of machines
//! at 10, 100 and 500 states, so that the numbers can be explained. Run `cargo bench -p
//! engine-core`; `cargo test -p engine-core --benches` runs each case once.
//!
//! Before a case is timed, the setup checks that the call finishes and gives the size that the
//! family promises, so a benchmark never times a stopped or wrong answer. Machines are built from
//! fixed numbers, so every run uses the same input. The benchmark profile uses the release
//! settings of the workspace (`opt-level = "z"`), as the shipped engine does.

use criterion::{BenchmarkId, Criterion, criterion_group, criterion_main};
use engine_core::{
    Alphabet, Conversion, ConversionBudget, Equivalence, EquivalenceBudget, Fsm, FsmKind,
    Minimization, MinimizeBudget, StateId, SymbolId, Transition, determinize, equivalent, minimize,
};
use std::hint::black_box;

const SIZES: [u32; 3] = [10, 100, 500];
/// The k-th symbol from the end: the DFSM has 2^k states, and the limit is 2,000 states.
const EXPONENTIAL: [u32; 3] = [6, 8, 10];

fn alphabet(names: &[&str]) -> Alphabet {
    Alphabet::new(names.iter().map(|s| (*s).to_owned()).collect()).unwrap()
}

fn t(from: u32, symbol: u16, to: u32) -> Transition {
    Transition {
        from: StateId(from),
        on: Some(SymbolId(symbol)),
        to: StateId(to),
    }
}

fn machine(
    kind: FsmKind,
    alphabet: Alphabet,
    n: u32,
    start: u32,
    accepting: Vec<u32>,
    transitions: Vec<Transition>,
) -> Fsm {
    Fsm::new(
        kind,
        alphabet,
        (0..n).map(StateId).collect(),
        Some(StateId(start)),
        accepting.into_iter().map(StateId).collect(),
        transitions,
    )
    .unwrap()
}

/// NDFSM with n states for "w ends in n-1 a's". Its DFSM has n states.
fn ends_with_a(n: u32) -> Fsm {
    let mut ts = vec![t(0, 0, 0), t(0, 1, 0), t(0, 0, 1)];
    ts.extend((1..n - 1).map(|i| t(i, 0, i + 1)));
    machine(FsmKind::Ndfsm, alphabet(&["a", "b"]), n, 0, vec![n - 1], ts)
}

/// NDFSM with k+1 states for "the k-th symbol from the end is a". Its DFSM has 2^k states.
fn kth_from_end(k: u32) -> Fsm {
    let mut ts = vec![t(0, 0, 0), t(0, 1, 0), t(0, 0, 1)];
    for i in 1..k {
        ts.push(t(i, 0, i + 1));
        ts.push(t(i, 1, i + 1));
    }
    machine(FsmKind::Ndfsm, alphabet(&["a", "b"]), k + 1, 0, vec![k], ts)
}

/// A complete DFSM with n states over a, b, c, from a fixed linear congruential generator.
fn random_dfsm(n: u32) -> Fsm {
    let mut x: u64 = 12345;
    let mut next = || {
        x = x
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        (x >> 33) as u32
    };
    let mut ts = Vec::new();
    for s in 0..n {
        for c in 0..3 {
            ts.push(t(s, c, next() % n));
        }
    }
    let accepting = (0..n).filter(|_| next() % 2 == 0).collect();
    machine(
        FsmKind::Dfsm,
        alphabet(&["a", "b", "c"]),
        n,
        0,
        accepting,
        ts,
    )
}

/// A chain of n states on `a`; only the last accepts. Partition refinement needs about n
/// rounds, and no two states are equivalent.
fn chain(n: u32) -> Fsm {
    let ts = (0..n).map(|i| t(i, 0, (i + 1).min(n - 1))).collect();
    machine(FsmKind::Dfsm, alphabet(&["a"]), n, 0, vec![n - 1], ts)
}

/// A counter modulo n over a (+1) and b (+2). It accepts when the count is 0. With `renumber`
/// the state numbers run backwards, so the machine is the same language under other names.
fn counter(n: u32, renumber: bool) -> Fsm {
    let id = |i: u32| if renumber { n - 1 - i } else { i };
    let mut ts = Vec::new();
    for i in 0..n {
        ts.push(t(id(i), 0, id((i + 1) % n)));
        ts.push(t(id(i), 1, id((i + 2) % n)));
    }
    machine(
        FsmKind::Dfsm,
        alphabet(&["a", "b"]),
        n,
        id(0),
        vec![id(0)],
        ts,
    )
}

fn finished_determinize(fsm: &Fsm) -> Fsm {
    match determinize(fsm, ConversionBudget::default()).unwrap() {
        Conversion::Finished { dfsm, .. } => dfsm,
        Conversion::Stopped { reason, .. } => panic!("determinize stopped: {reason:?}"),
    }
}

fn finished_minimize(fsm: &Fsm) -> Fsm {
    match minimize(fsm, MinimizeBudget::default()).unwrap() {
        Minimization::Finished { dfsm, .. } => dfsm,
        Minimization::Stopped { reason, .. } => panic!("minimize stopped: {reason:?}"),
    }
}

fn determinize_cases(c: &mut Criterion) {
    let mut group = c.benchmark_group("determinize/ends_with_a (n states in, n out)");
    for n in SIZES {
        let nfa = ends_with_a(n);
        assert_eq!(finished_determinize(&nfa).states.len(), n as usize);
        group.bench_with_input(BenchmarkId::from_parameter(n), &nfa, |b, nfa| {
            b.iter(|| determinize(black_box(nfa), ConversionBudget::default()))
        });
    }
    group.finish();

    let mut group = c.benchmark_group("determinize/kth_from_end (k+1 states in, 2^k out)");
    for k in EXPONENTIAL {
        let nfa = kth_from_end(k);
        assert_eq!(finished_determinize(&nfa).states.len(), 1 << k);
        group.bench_with_input(BenchmarkId::from_parameter(k), &nfa, |b, nfa| {
            b.iter(|| determinize(black_box(nfa), ConversionBudget::default()))
        });
    }
    group.finish();
}

fn minimize_cases(c: &mut Criterion) {
    let mut group = c.benchmark_group("minimize/random (n states, 3 symbols)");
    for n in SIZES {
        let dfsm = random_dfsm(n);
        assert!(finished_minimize(&dfsm).states.len() <= n as usize);
        group.bench_with_input(BenchmarkId::from_parameter(n), &dfsm, |b, dfsm| {
            b.iter(|| minimize(black_box(dfsm), MinimizeBudget::default()))
        });
    }
    group.finish();

    let mut group = c.benchmark_group("minimize/chain (n states, already minimal)");
    for n in SIZES {
        let dfsm = chain(n);
        assert_eq!(finished_minimize(&dfsm).states.len(), n as usize);
        group.bench_with_input(BenchmarkId::from_parameter(n), &dfsm, |b, dfsm| {
            b.iter(|| minimize(black_box(dfsm), MinimizeBudget::default()))
        });
    }
    group.finish();
}

fn equivalent_cases(c: &mut Criterion) {
    let mut group = c.benchmark_group("equivalent/same_language (n states each)");
    for n in SIZES {
        let (a, b) = (counter(n, false), counter(n, true));
        assert!(matches!(
            equivalent(&a, &b, EquivalenceBudget::default()).unwrap(),
            Equivalence::Equivalent { pairs } if pairs == n as usize
        ));
        group.bench_with_input(BenchmarkId::from_parameter(n), &(a, b), |bench, (a, b)| {
            bench.iter(|| equivalent(black_box(a), black_box(b), EquivalenceBudget::default()))
        });
    }
    group.finish();

    let mut group = c.benchmark_group("equivalent/different (n and n+2 states)");
    for n in SIZES {
        let (a, b) = (counter(n, false), counter(n + 2, false));
        assert!(matches!(
            equivalent(&a, &b, EquivalenceBudget::default()).unwrap(),
            Equivalence::Different { .. }
        ));
        group.bench_with_input(BenchmarkId::from_parameter(n), &(a, b), |bench, (a, b)| {
            bench.iter(|| equivalent(black_box(a), black_box(b), EquivalenceBudget::default()))
        });
    }
    group.finish();
}

criterion_group!(benches, determinize_cases, minimize_cases, equivalent_cases);
criterion_main!(benches);
