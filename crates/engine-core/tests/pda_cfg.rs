//! Integration tests for T-037: PDA in restricted normal form (RNF) to CFG (`pda_to_cfg`).

use engine_core::grammar::{CnfTransformer, CykParser, Grammar, GrammarParser, Production, Symbol};
use engine_core::{
    Alphabet, CfgVariable, MAX_PDA_CFG_RULES, MAX_PDA_STRING, Message, Pda, PdaBudget, PdaKind,
    PdaSimulation, PdaTransition, StateId, SymbolId, api, cfg_to_pda_topdown, pda_to_cfg,
    pda_to_rnf, simulate_pda,
};
use proptest::prelude::*;
use std::collections::{BTreeMap, BTreeSet};
use std::time::Instant;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type RawTransition = (u32, Option<u16>, Vec<u16>, Vec<u16>, u32);

fn make_pda(
    kind: PdaKind,
    states: Vec<u32>,
    start: Option<u32>,
    accepting: Vec<u32>,
    input: &[&str],
    stack: &[&str],
    transitions: Vec<RawTransition>,
) -> Pda {
    let input_alpha = Alphabet::new(input.iter().map(|s| (*s).to_string()).collect()).unwrap();
    let stack_alpha = Alphabet::new(stack.iter().map(|s| (*s).to_string()).collect()).unwrap();
    let trans = transitions
        .into_iter()
        .map(|(from, read, pop, push, to)| PdaTransition {
            from: StateId(from),
            read: read.map(SymbolId),
            pop: pop.into_iter().map(SymbolId).collect(),
            push: push.into_iter().map(SymbolId).collect(),
            to: StateId(to),
        })
        .collect();
    Pda::new(
        kind,
        input_alpha,
        stack_alpha,
        states.into_iter().map(StateId).collect(),
        start.map(StateId),
        accepting.into_iter().map(StateId).collect(),
        trans,
    )
    .unwrap()
}

/// F1 of T-036: `wcw^R` (`w` in `{a, b}*`), converted to RNF via `pda_to_rnf`.
fn fixture_f1_rnf() -> Pda {
    let orig = make_pda(
        PdaKind::Ndpda,
        vec![0, 1],
        Some(0),
        vec![1],
        &["a", "b", "c"],
        &["a", "b"],
        vec![
            (0, Some(0), vec![], vec![0], 0),
            (0, Some(1), vec![], vec![1], 0),
            (0, Some(2), vec![], vec![], 1),
            (1, Some(0), vec![0], vec![], 1),
            (1, Some(1), vec![1], vec![], 1),
        ],
    );
    pda_to_rnf(&orig).unwrap().pda
}

/// F2 of T-036: `a^n b^n` (`n >= 1`) with multi-pop `[A, A]`, converted to RNF via `pda_to_rnf`.
fn fixture_f2_rnf() -> Pda {
    let orig = make_pda(
        PdaKind::Ndpda,
        vec![0, 1],
        Some(0),
        vec![1],
        &["a", "b"],
        &["A"],
        vec![
            (0, Some(0), vec![], vec![0, 0], 0),
            (0, Some(1), vec![0, 0], vec![], 1),
            (1, Some(1), vec![0, 0], vec![], 1),
        ],
    );
    pda_to_rnf(&orig).unwrap().pda
}

/// F3: Smallest RNF machine accepting `{ε}`.
fn fixture_f3_rnf() -> Pda {
    make_pda(
        PdaKind::Ndpda,
        vec![0, 1, 2],
        Some(0),
        vec![2],
        &["a"],
        &["#"],
        vec![(0, None, vec![], vec![0], 1), (1, None, vec![0], vec![], 2)],
    )
}

/// Format a single production as `"HEAD -> BODY"` (with `"ε"` for empty body).
fn format_rule(rule: &Production) -> String {
    if rule.body.is_empty() {
        format!("{} -> ε", rule.head)
    } else {
        let rhs: Vec<String> = rule.body.iter().map(ToString::to_string).collect();
        format!("{} -> {}", rule.head, rhs.join(" "))
    }
}

/// Canonical grammar text writer matching `grammarToText` in `web/src/lib/grammar/grammar-text.ts`:
/// one line per head, start symbol first, one space between symbols, `ε` for empty body.
fn grammar_to_text(grammar: &Grammar) -> String {
    let mut groups: Vec<(String, Vec<String>)> = Vec::new();
    let mut index_by_head: BTreeMap<String, usize> = BTreeMap::new();

    for rule in &grammar.rules {
        let rhs = if rule.body.is_empty() {
            "ε".to_string()
        } else {
            rule.body
                .iter()
                .map(ToString::to_string)
                .collect::<Vec<_>>()
                .join(" ")
        };
        if let Some(&idx) = index_by_head.get(&rule.head) {
            groups[idx].1.push(rhs);
        } else {
            let idx = groups.len();
            index_by_head.insert(rule.head.clone(), idx);
            groups.push((rule.head.clone(), vec![rhs]));
        }
    }

    if let Some(&start_idx) = index_by_head.get(&grammar.start)
        && start_idx > 0
    {
        let start_group = groups.remove(start_idx);
        groups.insert(0, start_group);
    }

    groups
        .into_iter()
        .map(|(head, bodies)| format!("{} -> {}", head, bodies.join(" | ")))
        .collect::<Vec<_>>()
        .join("\n")
}

/// Assert that `grammar_to_text` followed by `GrammarParser::parse` preserves `start` and the
/// exact multiset of rules.
fn assert_grammar_text_roundtrip(grammar: &Grammar) {
    let text = grammar_to_text(grammar);
    let parsed = GrammarParser::parse(&text)
        .unwrap_or_else(|e| panic!("GrammarParser::parse failed on:\n{text}\nerror: {e}"));
    assert_eq!(parsed.start, grammar.start);
    let mut expected_rules: Vec<String> = grammar.rules.iter().map(format_rule).collect();
    let mut actual_rules: Vec<String> = parsed.rules.iter().map(format_rule).collect();
    expected_rules.sort();
    actual_rules.sort();
    assert_eq!(actual_rules, expected_rules);
}

/// Independent helper (not using `CnfTransformer`) that removes non-productive and unreachable
/// rules from a grammar, keeping remaining rules in their original order.
fn clean_productive_and_reachable(grammar: &Grammar) -> Vec<Production> {
    // 1. Productive variables (bottom-up fixed point).
    let mut productive: BTreeSet<String> = BTreeSet::new();
    loop {
        let mut changed = false;
        for rule in &grammar.rules {
            if productive.contains(&rule.head) {
                continue;
            }
            let body_productive = rule.body.iter().all(|sym| match sym {
                Symbol::Terminal(_) => true,
                Symbol::NonTerminal(v) => productive.contains(v),
            });
            if body_productive {
                productive.insert(rule.head.clone());
                changed = true;
            }
        }
        if !changed {
            break;
        }
    }

    let prod_rules: Vec<&Production> = grammar
        .rules
        .iter()
        .filter(|r| {
            productive.contains(&r.head)
                && r.body.iter().all(|sym| match sym {
                    Symbol::Terminal(_) => true,
                    Symbol::NonTerminal(v) => productive.contains(v),
                })
        })
        .collect();

    // 2. Reachable from `grammar.start` among productive rules (top-down fixed point).
    let mut reachable: BTreeSet<String> = BTreeSet::new();
    if productive.contains(&grammar.start) {
        reachable.insert(grammar.start.clone());
    }
    loop {
        let mut changed = false;
        for rule in &prod_rules {
            if !reachable.contains(&rule.head) {
                continue;
            }
            for sym in &rule.body {
                if let Symbol::NonTerminal(v) = sym
                    && reachable.insert(v.clone())
                {
                    changed = true;
                }
            }
        }
        if !changed {
            break;
        }
    }

    prod_rules
        .into_iter()
        .filter(|r| reachable.contains(&r.head))
        .cloned()
        .collect()
}

/// Pinning test for Reminder 1 & AC2: What do `CnfTransformer::transform` and `CykParser::parse`
/// do on a grammar whose language is empty?
#[test]
fn test_pin_empty_language_cnf_and_cyk() {
    let empty_grammar = Grammar::new(
        "S",
        vec![Production::new(
            "S",
            vec![Symbol::NonTerminal("V_0g0p1".to_string())],
        )],
    );
    let trace = CnfTransformer::transform(&empty_grammar)
        .expect("CnfTransformer::transform should succeed on an empty-language grammar");
    assert_eq!(trace.final_grammar.start, "S");
    assert!(
        trace.final_grammar.rules.is_empty(),
        "Expected empty rules for empty-language grammar, got: {:?}",
        trace.final_grammar.rules
    );

    let cyk_eps = CykParser::parse(&trace.final_grammar, "")
        .expect("CykParser::parse on empty string should succeed");
    assert!(!cyk_eps.accepted);

    let cyk_a = CykParser::parse(&trace.final_grammar, "a")
        .expect("CykParser::parse on 'a' should succeed");
    assert!(!cyk_a.accepted);
}

/// Helper `derives(grammar, w)` built from the pinned behavior of `CnfTransformer::transform`
/// and `CykParser::parse`. Any `Err` from either function panics as a test failure.
fn derives(grammar: &Grammar, w: &str) -> bool {
    let trace = CnfTransformer::transform(grammar)
        .unwrap_or_else(|e| panic!("CnfTransformer::transform failed: {e}"));
    let res = CykParser::parse(&trace.final_grammar, w)
        .unwrap_or_else(|e| panic!("CykParser::parse failed on {w:?}: {e}"));
    res.accepted
}

fn generate_strings(alphabet: &[char], max_len: usize) -> Vec<String> {
    let mut result = vec![String::new()];
    let mut current_level = vec![String::new()];
    for _ in 1..=max_len {
        let mut next_level = Vec::new();
        for prefix in &current_level {
            for &ch in alphabet {
                let mut s = prefix.clone();
                s.push(ch);
                result.push(s.clone());
                next_level.push(s);
            }
        }
        current_level = next_level;
    }
    result
}

// ---------------------------------------------------------------------------
// AC1: Fixtures F1 to F5
// ---------------------------------------------------------------------------

#[test]
fn test_grammar_text_roundtrip_f1_f2_f3() {
    for pda in [fixture_f1_rnf(), fixture_f2_rnf(), fixture_f3_rnf()] {
        let res = pda_to_cfg(&pda).unwrap();
        assert_grammar_text_roundtrip(&res.grammar);
    }
}

#[test]
fn test_fixture_f1_structure_and_cleanup() {
    let pda = fixture_f1_rnf();
    let res = pda_to_cfg(&pda).unwrap();

    // 76 rules and 14 steps.
    assert_eq!(res.grammar.start, "S");
    assert_eq!(res.grammar.rules.len(), 76);
    assert_eq!(res.steps.len(), 14);

    // Concatenation of step.added equals grammar.rules.
    let step_rules: Vec<Production> = res.steps.iter().flat_map(|s| s.added.clone()).collect();
    assert_eq!(res.grammar.rules, step_rules);

    // Step messages and rule counts in order.
    assert_eq!(res.steps[0].message, Message::new("pda_cfg.start"));
    assert_eq!(res.steps[0].added.len(), 1);
    assert_eq!(format_rule(&res.steps[0].added[0]), "S -> V_0g2p3");

    assert_eq!(
        res.steps[1].message,
        Message::new("pda_cfg.empty").with("count", 3usize)
    );
    assert_eq!(
        res.steps[1]
            .added
            .iter()
            .map(format_rule)
            .collect::<Vec<_>>(),
        vec!["V_0gep0 -> ε", "V_1gep1 -> ε", "V_3gep3 -> ε"]
    );

    // Steps 2..8: six 0->0 double pushes (each 9 rules).
    for idx in 2..8 {
        assert_eq!(
            res.steps[idx].message,
            Message::new("pda_cfg.push")
                .with("from", 0u32)
                .with("to", 0u32)
                .with("pushes", 2usize)
        );
        assert_eq!(res.steps[idx].added.len(), 9);
    }

    // First transition (0->0, a, [a], [a, a]) rules for (0,0), (0,1), (0,3), (1,0).
    let first_push_rules: Vec<String> = res.steps[2].added.iter().map(format_rule).collect();
    assert_eq!(first_push_rules[0], "V_0g0p0 -> a V_0g0p0 V_0g0p0");
    assert_eq!(first_push_rules[1], "V_0g0p1 -> a V_0g0p0 V_0g0p1");
    assert_eq!(first_push_rules[2], "V_0g0p3 -> a V_0g0p0 V_0g0p3");
    assert_eq!(first_push_rules[3], "V_0g0p0 -> a V_0g0p1 V_1g0p0");

    // Third transition (0->0, a, [#], [a, #]) first rule.
    assert_eq!(
        format_rule(&res.steps[4].added[0]),
        "V_0g2p0 -> a V_0g0p0 V_0g2p0"
    );

    // Steps 8..11: three 0->1 single pushes reading c (each 3 rules).
    for idx in 8..11 {
        assert_eq!(
            res.steps[idx].message,
            Message::new("pda_cfg.push")
                .with("from", 0u32)
                .with("to", 1u32)
                .with("pushes", 1usize)
        );
        assert_eq!(res.steps[idx].added.len(), 3);
    }
    assert_eq!(
        res.steps[8]
            .added
            .iter()
            .map(format_rule)
            .collect::<Vec<_>>(),
        vec![
            "V_0g0p0 -> c V_1g0p0",
            "V_0g0p1 -> c V_1g0p1",
            "V_0g0p3 -> c V_1g0p3",
        ]
    );

    // Step 11: accept transition (1->3, ε, [#], []).
    assert_eq!(
        res.steps[11].message,
        Message::new("pda_cfg.push_none")
            .with("from", 1u32)
            .with("to", 3u32)
    );
    assert_eq!(
        res.steps[11]
            .added
            .iter()
            .map(format_rule)
            .collect::<Vec<_>>(),
        vec![
            "V_1g2p0 -> V_3gep0",
            "V_1g2p1 -> V_3gep1",
            "V_1g2p3 -> V_3gep3",
        ]
    );

    // Steps 12..14: 1->1 reading a and b (push_none).
    for idx in 12..14 {
        assert_eq!(
            res.steps[idx].message,
            Message::new("pda_cfg.push_none")
                .with("from", 1u32)
                .with("to", 1u32)
        );
        assert_eq!(res.steps[idx].added.len(), 3);
    }
    assert_eq!(format_rule(&res.steps[12].added[0]), "V_1g0p0 -> a V_1gep0");

    // Variables metadata check.
    assert_eq!(
        res.variables[0],
        CfgVariable {
            name: "V_0g0p0".to_string(),
            from: StateId(0),
            stack: Some("a".to_string()),
            to: StateId(0),
        }
    );
    let var_names: BTreeSet<String> = res.variables.iter().map(|v| v.name.clone()).collect();
    let mut rule_v_names: BTreeSet<String> = BTreeSet::new();
    for rule in &res.grammar.rules {
        if rule.head != "S" {
            rule_v_names.insert(rule.head.clone());
        }
        for sym in &rule.body {
            if let Symbol::NonTerminal(nt) = sym
                && nt != "S"
            {
                rule_v_names.insert(nt.clone());
            }
        }
    }
    assert_eq!(var_names, rule_v_names);

    // Independent cleanup of unreachable & non-productive rules leaves the exact 15 rules.
    let cleaned = clean_productive_and_reachable(&res.grammar);
    let cleaned_strs: Vec<String> = cleaned.iter().map(format_rule).collect();
    assert_eq!(cleaned_strs.len(), 15);
    assert_eq!(
        cleaned_strs,
        vec![
            "S -> V_0g2p3",
            "V_1gep1 -> ε",
            "V_3gep3 -> ε",
            "V_0g0p1 -> a V_0g0p1 V_1g0p1",
            "V_0g1p1 -> a V_0g0p1 V_1g1p1",
            "V_0g2p3 -> a V_0g0p1 V_1g2p3",
            "V_0g0p1 -> b V_0g1p1 V_1g0p1",
            "V_0g1p1 -> b V_0g1p1 V_1g1p1",
            "V_0g2p3 -> b V_0g1p1 V_1g2p3",
            "V_0g0p1 -> c V_1g0p1",
            "V_0g1p1 -> c V_1g1p1",
            "V_0g2p3 -> c V_1g2p3",
            "V_1g2p3 -> V_3gep3",
            "V_1g0p1 -> a V_1gep1",
            "V_1g1p1 -> b V_1gep1",
        ]
    );

    // Grammar-text round trip.
    assert_grammar_text_roundtrip(&res.grammar);
}

#[test]
fn test_fixture_f2_structure() {
    let pda = fixture_f2_rnf();
    let res = pda_to_cfg(&pda).unwrap();

    // 281 rules (1 + 5 + 5*5 + 2*125) and 9 steps.
    assert_eq!(res.grammar.rules.len(), 281);
    assert_eq!(res.steps.len(), 9);
    assert_eq!(res.steps[0].message, Message::new("pda_cfg.start"));
    assert_eq!(res.steps[0].added.len(), 1);
    assert_eq!(
        res.steps[1].message,
        Message::new("pda_cfg.empty").with("count", 5usize)
    );
    assert_eq!(res.steps[1].added.len(), 5);

    let push3_steps: Vec<_> = res
        .steps
        .iter()
        .filter(|s| s.message.key == "pda_cfg.push")
        .collect();
    assert_eq!(push3_steps.len(), 2);
    for step in &push3_steps {
        assert_eq!(
            step.message,
            Message::new("pda_cfg.push")
                .with("from", 0u32)
                .with("to", 0u32)
                .with("pushes", 3usize)
        );
        assert_eq!(step.added.len(), 125);
    }
    assert_eq!(
        format_rule(&push3_steps[0].added[5]),
        "V_0g0p0 -> a V_0g0p0 V_0g0p1 V_1g0p0"
    );

    let push_none_steps: Vec<_> = res
        .steps
        .iter()
        .filter(|s| s.message.key == "pda_cfg.push_none")
        .collect();
    assert_eq!(push_none_steps.len(), 5);
    for step in push_none_steps {
        assert_eq!(step.added.len(), 5);
    }

    assert_grammar_text_roundtrip(&res.grammar);
}

#[test]
fn test_fixture_f3_structure() {
    let pda = fixture_f3_rnf();
    let res = pda_to_cfg(&pda).unwrap();

    assert_eq!(res.grammar.rules.len(), 5);
    assert_eq!(res.steps.len(), 3);
    assert_eq!(res.steps[0].message, Message::new("pda_cfg.start"));
    assert_eq!(
        res.steps[1].message,
        Message::new("pda_cfg.empty").with("count", 2usize)
    );
    assert_eq!(
        res.steps[2].message,
        Message::new("pda_cfg.push_none")
            .with("from", 1u32)
            .with("to", 2u32)
    );

    let rules: Vec<String> = res.grammar.rules.iter().map(format_rule).collect();
    assert_eq!(
        rules,
        vec![
            "S -> V_1g0p2",
            "V_1gep1 -> ε",
            "V_2gep2 -> ε",
            "V_1g0p1 -> V_2gep1",
            "V_1g0p2 -> V_2gep2",
        ]
    );

    assert_grammar_text_roundtrip(&res.grammar);
}

#[test]
fn test_fixture_f4_input_errors() {
    // (a) No start state.
    let no_start = make_pda(
        PdaKind::Ndpda,
        vec![0, 1],
        None,
        vec![1],
        &["a"],
        &["#"],
        vec![],
    );
    assert_eq!(
        pda_to_cfg(&no_start).unwrap_err(),
        Message::new("pda_cfg.no_start_state")
    );

    // (b.1) Start state with two transitions.
    let start_two = make_pda(
        PdaKind::Ndpda,
        vec![0, 1, 2],
        Some(0),
        vec![2],
        &["a"],
        &["#"],
        vec![(0, None, vec![], vec![0], 1), (0, None, vec![], vec![0], 2)],
    );
    assert_eq!(
        pda_to_cfg(&start_two).unwrap_err(),
        Message::new("pda_cfg.bad_start").with("state", 0u32)
    );

    // (b.2) Start state with a transition that reads a symbol.
    let start_reads = make_pda(
        PdaKind::Ndpda,
        vec![0, 1, 2],
        Some(0),
        vec![2],
        &["a"],
        &["#"],
        vec![
            (0, Some(0), vec![], vec![0], 1),
            (1, None, vec![0], vec![], 2),
        ],
    );
    assert_eq!(
        pda_to_cfg(&start_reads).unwrap_err(),
        Message::new("pda_cfg.bad_start").with("state", 0u32)
    );

    // (b.3) Start state with a transition that pushes two symbols.
    let start_pushes_two = make_pda(
        PdaKind::Ndpda,
        vec![0, 1, 2],
        Some(0),
        vec![2],
        &["a"],
        &["#"],
        vec![
            (0, None, vec![], vec![0, 0], 1),
            (1, None, vec![0], vec![], 2),
        ],
    );
    assert_eq!(
        pda_to_cfg(&start_pushes_two).unwrap_err(),
        Message::new("pda_cfg.bad_start").with("state", 0u32)
    );

    // (b.4) Start state with a transition into it.
    let into_start = make_pda(
        PdaKind::Ndpda,
        vec![0, 1, 2],
        Some(0),
        vec![2],
        &["a"],
        &["#"],
        vec![(0, None, vec![], vec![0], 1), (1, None, vec![0], vec![], 0)],
    );
    assert_eq!(
        pda_to_cfg(&into_start).unwrap_err(),
        Message::new("pda_cfg.bad_start").with("state", 0u32)
    );

    // (b.5) Start state is accepting.
    let start_accepting = make_pda(
        PdaKind::Ndpda,
        vec![0, 1],
        Some(0),
        vec![0],
        &["a"],
        &["#"],
        vec![(0, None, vec![], vec![0], 1)],
    );
    assert_eq!(
        pda_to_cfg(&start_accepting).unwrap_err(),
        Message::new("pda_cfg.bad_start").with("state", 0u32)
    );

    // (c.1) No accepting state.
    let zero_accepting = make_pda(
        PdaKind::Ndpda,
        vec![0, 1],
        Some(0),
        vec![],
        &["a"],
        &["#"],
        vec![(0, None, vec![], vec![0], 1)],
    );
    assert_eq!(
        pda_to_cfg(&zero_accepting).unwrap_err(),
        Message::new("pda_cfg.not_one_accepting").with("count", 0usize)
    );

    // (c.2) Two accepting states.
    let two_accepting = make_pda(
        PdaKind::Ndpda,
        vec![0, 1, 2],
        Some(0),
        vec![1, 2],
        &["a"],
        &["#"],
        vec![(0, None, vec![], vec![0], 1)],
    );
    assert_eq!(
        pda_to_cfg(&two_accepting).unwrap_err(),
        Message::new("pda_cfg.not_one_accepting").with("count", 2usize)
    );

    // (d.1) Transition into `a` that reads a symbol.
    let accept_reads = make_pda(
        PdaKind::Ndpda,
        vec![0, 1, 2],
        Some(0),
        vec![2],
        &["a"],
        &["#"],
        vec![
            (0, None, vec![], vec![0], 1),
            (1, Some(0), vec![0], vec![], 2),
        ],
    );
    assert_eq!(
        pda_to_cfg(&accept_reads).unwrap_err(),
        Message::new("pda_cfg.bad_accept").with("from", 1u32)
    );

    // (d.2) Transition into `a` that pops `[A]` instead of the marker `#`.
    let accept_wrong_pop = make_pda(
        PdaKind::Ndpda,
        vec![0, 1, 2],
        Some(0),
        vec![2],
        &["a"],
        &["A", "#"],
        vec![(0, None, vec![], vec![1], 1), (1, None, vec![0], vec![], 2)],
    );
    assert_eq!(
        pda_to_cfg(&accept_wrong_pop).unwrap_err(),
        Message::new("pda_cfg.bad_accept").with("from", 1u32)
    );

    // (d.3) Transition into `a` that pushes a symbol.
    let accept_pushes = make_pda(
        PdaKind::Ndpda,
        vec![0, 1, 2],
        Some(0),
        vec![2],
        &["a"],
        &["#"],
        vec![
            (0, None, vec![], vec![0], 1),
            (1, None, vec![0], vec![0], 2),
        ],
    );
    assert_eq!(
        pda_to_cfg(&accept_pushes).unwrap_err(),
        Message::new("pda_cfg.bad_accept").with("from", 1u32)
    );

    // (e.1) Transition not from `s'` that pops nothing.
    let pops_nothing = make_pda(
        PdaKind::Ndpda,
        vec![0, 1, 2],
        Some(0),
        vec![2],
        &["a"],
        &["#"],
        vec![
            (0, None, vec![], vec![0], 1),
            (1, Some(0), vec![], vec![0], 1),
            (1, None, vec![0], vec![], 2),
        ],
    );
    assert_eq!(
        pda_to_cfg(&pops_nothing).unwrap_err(),
        Message::new("pda_cfg.not_single_pop")
            .with("from", 1u32)
            .with("to", 1u32)
    );

    // (e.2) Transition not from `s'` that pops two symbols.
    let pops_two = make_pda(
        PdaKind::Ndpda,
        vec![0, 1, 2],
        Some(0),
        vec![2],
        &["a"],
        &["#"],
        vec![
            (0, None, vec![], vec![0], 1),
            (1, Some(0), vec![0, 0], vec![0], 1),
            (1, None, vec![0], vec![], 2),
        ],
    );
    assert_eq!(
        pda_to_cfg(&pops_two).unwrap_err(),
        Message::new("pda_cfg.not_single_pop")
            .with("from", 1u32)
            .with("to", 1u32)
    );

    // (f) Bad input symbols: `ab`, `A`, `<`, `[`, `|`, `\`, `λ`, `^`.
    // (Note: `" "` and `"ε"` are rejected at Alphabet::new level; we also test them via JSON / Alphabet::new
    // and test all valid-Alphabet bad symbols through pda_to_cfg.)
    for bad_sym in ["ab", "A", "<", "[", "|", "\\", "λ", "^"] {
        let pda = make_pda(
            PdaKind::Ndpda,
            vec![0, 1, 2],
            Some(0),
            vec![2],
            &[bad_sym],
            &["#"],
            vec![(0, None, vec![], vec![0], 1), (1, None, vec![0], vec![], 2)],
        );
        assert_eq!(
            pda_to_cfg(&pda).unwrap_err(),
            Message::new("pda_cfg.terminal_not_readable").with("symbol", bad_sym)
        );
    }
    assert!(Alphabet::new(vec![" ".to_string()]).is_err());
    assert!(Alphabet::new(vec!["ε".to_string()]).is_err());

    // Readable symbols such as `a`, `0`, `+`, `(` are accepted.
    for good_sym in ["a", "0", "+", "("] {
        let pda = make_pda(
            PdaKind::Ndpda,
            vec![0, 1, 2],
            Some(0),
            vec![2],
            &[good_sym],
            &["#"],
            vec![
                (0, None, vec![], vec![0], 1),
                (1, Some(0), vec![0], vec![0], 1),
                (1, None, vec![0], vec![], 2),
            ],
        );
        let res = pda_to_cfg(&pda).unwrap();
        assert_grammar_text_roundtrip(&res.grammar);
    }

    // Order of checks: a PDA with both a bad accept transition (no marker pop) and a bad terminal
    // (`"A"`) returns the earlier error (`pda_cfg.bad_accept`).
    let two_faults = make_pda(
        PdaKind::Ndpda,
        vec![0, 1, 2],
        Some(0),
        vec![2],
        &["A"],
        &["X", "#"],
        vec![(0, None, vec![], vec![1], 1), (1, None, vec![0], vec![], 2)],
    );
    assert_eq!(
        pda_to_cfg(&two_faults).unwrap_err(),
        Message::new("pda_cfg.bad_accept").with("from", 1u32)
    );
}

#[test]
fn test_fixture_f5_limits_and_high_state_ids() {
    // 1. 29 states besides s' (30 states total: 0 is s', 1 is s, 2 is a, 3..=29 extra) and one
    // transition s -> s pushing 4 symbols: 29^4 = 707,281 > 20,000, returning in under 50 ms.
    let states_30: Vec<u32> = (0..30).collect();
    let pda_29_4 = make_pda(
        PdaKind::Ndpda,
        states_30,
        Some(0),
        vec![2],
        &["a"],
        &["#"],
        vec![
            (0, None, vec![], vec![0], 1),
            (1, Some(0), vec![0], vec![0, 0, 0, 0], 1),
        ],
    );
    let t0 = Instant::now();
    let res_29_4 = pda_to_cfg(&pda_29_4);
    let elapsed = t0.elapsed();
    assert!(
        elapsed.as_millis() < 50,
        "Expected limit check to finish in < 50 ms, took {elapsed:?}"
    );
    assert_eq!(
        res_29_4.map(|r| r.grammar.rules.len()),
        Err(Message::new("machine.limit_exceeded")
            .with("what", "rules")
            .with("limit", MAX_PDA_CFG_RULES))
    );

    // 2. u64 overflow: 2 states besides s' (m = 2) and a transition pushing 64 symbols (MAX_PDA_STRING):
    // 2^64 overflows u64, returning the same limit_exceeded message.
    let pda_overflow = make_pda(
        PdaKind::Ndpda,
        vec![0, 1, 2],
        Some(0),
        vec![2],
        &["a"],
        &["#"],
        vec![
            (0, None, vec![], vec![0], 1),
            (1, Some(0), vec![0], vec![0; MAX_PDA_STRING], 1),
        ],
    );
    assert_eq!(
        pda_to_cfg(&pda_overflow).map(|r| r.grammar.rules.len()),
        Err(Message::new("machine.limit_exceeded")
            .with("what", "rules")
            .with("limit", MAX_PDA_CFG_RULES))
    );

    // 3. Machine just under the limit passes: k - 1 = 3 (states 0=s', 1=s, 2=a, 3=extra),
    // transition s -> s pushing 9 symbols gives 3^9 = 19,683 rules, plus 1 start rule + 3 empty
    // rules + 3 accept rules = 19,690 <= 20,000.
    let pda_under = make_pda(
        PdaKind::Ndpda,
        vec![0, 1, 2, 3],
        Some(0),
        vec![2],
        &["a"],
        &["#"],
        vec![
            (0, None, vec![], vec![0], 1),
            (1, Some(0), vec![0], vec![0; 9], 1),
            (1, None, vec![0], vec![], 2),
        ],
    );
    let res_under = pda_to_cfg(&pda_under).unwrap();
    assert_eq!(res_under.grammar.rules.len(), 1 + 3 + 19_683 + 3);
    assert!(res_under.grammar.rules.len() <= MAX_PDA_CFG_RULES);

    // 4. Exact boundary 20,000 and 20,007:
    // 7 states besides s' (ids 0..=7, s' = 0, s = 1, a = 2).
    // One transition from s' (ε, [], push [#]) and six transitions from s, each popping # and
    // reading its own input symbol, with push lengths 5, 4, 3, 3, 2, and 2, all going to s.
    // Rule count = 1 + 7 + 7^5 + 7^4 + 7^3 + 7^3 + 7^2 + 7^2 = 20,000 exactly.
    let states_8: Vec<u32> = (0..=7).collect();
    let base_transitions_20000 = vec![
        (0, None, vec![], vec![0], 1),
        (1, Some(0), vec![0], vec![0; 5], 1),
        (1, Some(1), vec![0], vec![0; 4], 1),
        (1, Some(2), vec![0], vec![0; 3], 1),
        (1, Some(3), vec![0], vec![0; 3], 1),
        (1, Some(4), vec![0], vec![0; 2], 1),
        (1, Some(5), vec![0], vec![0; 2], 1),
    ];
    let pda_20000 = make_pda(
        PdaKind::Ndpda,
        states_8.clone(),
        Some(0),
        vec![2],
        &["a", "b", "c", "d", "e", "f", "g"],
        &["#"],
        base_transitions_20000.clone(),
    );
    let res_20000 = pda_to_cfg(&pda_20000).map(|r| r.grammar.rules.len());
    assert_eq!(res_20000, Ok(20_000));

    // Plus one more transition from s that pushes 1 symbol (20,007 rules):
    let mut transitions_20007 = base_transitions_20000;
    transitions_20007.push((1, Some(6), vec![0], vec![0; 1], 1));
    let pda_20007 = make_pda(
        PdaKind::Ndpda,
        states_8,
        Some(0),
        vec![2],
        &["a", "b", "c", "d", "e", "f", "g"],
        &["#"],
        transitions_20007,
    );
    assert_eq!(
        pda_to_cfg(&pda_20007).map(|r| r.grammar.rules.len()),
        Err(Message::new("machine.limit_exceeded")
            .with("what", "rules")
            .with("limit", MAX_PDA_CFG_RULES))
    );

    // 5. State IDs near u32::MAX (e.g. s' = 4294967294, s = 4294967295, a = 4294967293).
    let hi_s = u32::MAX; // 4294967295
    let hi_start = u32::MAX - 1; // 4294967294
    let hi_a = u32::MAX - 2; // 4294967293
    let pda_hi = make_pda(
        PdaKind::Ndpda,
        vec![hi_a, hi_start, hi_s],
        Some(hi_start),
        vec![hi_a],
        &["a"],
        &["#"],
        vec![
            (hi_start, None, vec![], vec![0], hi_s),
            (hi_s, Some(0), vec![0], vec![0], hi_s),
            (hi_s, None, vec![0], vec![], hi_a),
        ],
    );
    let res_hi = pda_to_cfg(&pda_hi).unwrap();
    assert!(
        res_hi
            .variables
            .iter()
            .any(|v| v.name == "V_4294967295g0p4294967295")
    );
    assert_grammar_text_roundtrip(&res_hi.grammar);
}

// ---------------------------------------------------------------------------
// AC2: Language Equivalence by CYK
// ---------------------------------------------------------------------------

#[test]
fn test_ac2_f1_language_equivalence() {
    let pda = fixture_f1_rnf();
    let cfg = pda_to_cfg(&pda).unwrap().grammar;
    let trace = CnfTransformer::transform(&cfg).unwrap();
    let cnf = &trace.final_grammar;

    // 3280 strings over {a, b, c} of length 0..=7.
    let strings = generate_strings(&['a', 'b', 'c'], 7);
    assert_eq!(strings.len(), 3280);

    for w in &strings {
        let expected = {
            let parts: Vec<&str> = w.split('c').collect();
            if parts.len() == 2 {
                let left = parts[0];
                let right: String = parts[1].chars().rev().collect();
                left == right && left.chars().all(|c| c == 'a' || c == 'b')
            } else {
                false
            }
        };
        let actual = CykParser::parse(cnf, w).unwrap().accepted;
        assert_eq!(
            actual, expected,
            "F1 language mismatch on string {w:?}: expected {expected}, got {actual}"
        );
    }
}

#[test]
fn test_ac2_f2_language_equivalence() {
    let pda = fixture_f2_rnf();
    let cfg = pda_to_cfg(&pda).unwrap().grammar;
    let trace = CnfTransformer::transform(&cfg).unwrap();
    let cnf = &trace.final_grammar;

    // 511 strings over {a, b} of length 0..=8.
    let strings = generate_strings(&['a', 'b'], 8);
    assert_eq!(strings.len(), 511);

    for w in &strings {
        let a_count = w.chars().take_while(|&c| c == 'a').count();
        let b_count = w.chars().skip(a_count).take_while(|&c| c == 'b').count();
        let expected = a_count >= 1 && a_count == b_count && a_count + b_count == w.len();
        let actual = CykParser::parse(cnf, w).unwrap().accepted;
        assert_eq!(
            actual, expected,
            "F2 language mismatch on string {w:?}: expected {expected}, got {actual}"
        );
    }
}

#[test]
fn test_ac2_f3_language_equivalence() {
    let pda = fixture_f3_rnf();
    let cfg = pda_to_cfg(&pda).unwrap().grammar;
    assert!(derives(&cfg, ""));
    assert!(!derives(&cfg, "a"));
    assert!(!derives(&cfg, "aa"));
}

// ---------------------------------------------------------------------------
// AC3: Property Tests (a) and (b)
// ---------------------------------------------------------------------------

fn arb_small_pda() -> impl Strategy<Value = Pda> {
    (1usize..=3, 1usize..=5).prop_flat_map(|(num_states, num_transitions)| {
        let states: Vec<u32> = (0..num_states as u32).collect();
        let start_strat = (0..num_states as u32).prop_map(Some);
        let accepting_strat = proptest::collection::btree_set(0..num_states as u32, 0..=num_states)
            .prop_map(|s| s.into_iter().collect::<Vec<u32>>());
        let trans_strat = proptest::collection::vec(
            (
                0..num_states as u32,
                prop_oneof![Just(None), (0u16..2).prop_map(Some)],
                proptest::collection::vec(0u16..2, 0..=3),
                proptest::collection::vec(0u16..2, 0..=3),
                0..num_states as u32,
            ),
            num_transitions,
        );
        (start_strat, accepting_strat, trans_strat).prop_map(move |(start, accepting, trans)| {
            make_pda(
                PdaKind::Ndpda,
                states.clone(),
                start,
                accepting,
                &["a", "b"],
                &["A", "B"],
                trans,
            )
        })
    })
}

fn arb_small_grammar() -> impl Strategy<Value = Grammar> {
    let sym_strat = prop_oneof![
        Just(Symbol::NonTerminal("S".to_string())),
        Just(Symbol::NonTerminal("A".to_string())),
        Just(Symbol::Terminal('a')),
        Just(Symbol::Terminal('b')),
    ];
    let rule_strat = (
        prop_oneof![Just("S".to_string()), Just("A".to_string())],
        proptest::collection::vec(sym_strat, 0..=3),
    )
        .prop_map(|(head, body)| Production::new(head, body));

    proptest::collection::vec(rule_strat, 1..=4).prop_map(|mut rules| {
        if !rules.iter().any(|r| r.head == "S") {
            rules[0].head = "S".to_string();
        }
        // Deduplicate exact identical rules so Grammar has distinct rules.
        let mut unique = Vec::new();
        for r in rules {
            if !unique.contains(&r) {
                unique.push(r);
            }
        }
        Grammar::new("S", unique)
    })
}

proptest! {
    #[test]
    fn test_ac3a_random_pdas_through_rnf(pda in arb_small_pda()) {
        let rnf = pda_to_rnf(&pda).unwrap().pda;

        let s_prime = rnf.start.unwrap();
        let k_minus_1 = rnf.states.len() - 1;
        let non_start_transitions: Vec<_> = rnf
            .transitions
            .iter()
            .filter(|t| t.from != s_prime)
            .collect();

        let expected_rules: Option<usize> = non_start_transitions
            .iter()
            .try_fold(1 + k_minus_1, |acc, t| {
                let term = k_minus_1.checked_pow(t.push.len().max(1) as u32)?;
                acc.checked_add(term)
            });

        match pda_to_cfg(&rnf) {
            Err(err) => {
                prop_assert!(
                    expected_rules.is_none_or(|n| n > MAX_PDA_CFG_RULES),
                    "Expected rules {:?} <= {}, but got error: {:?}",
                    expected_rules,
                    MAX_PDA_CFG_RULES,
                    err
                );
                prop_assert_eq!(
                    err,
                    Message::new("machine.limit_exceeded")
                        .with("what", "rules")
                        .with("limit", MAX_PDA_CFG_RULES)
                );
            }
            Ok(res) => {
                let expected = expected_rules.unwrap();
                prop_assert!(expected <= MAX_PDA_CFG_RULES);
                prop_assert_eq!(res.grammar.rules.len(), expected);
                prop_assert_eq!(res.steps.len(), 2 + non_start_transitions.len());

                let var_names: BTreeSet<&str> =
                    res.variables.iter().map(|v| v.name.as_str()).collect();
                for rule in &res.grammar.rules {
                    prop_assert!(
                        rule.head == "S" || var_names.contains(rule.head.as_str()),
                        "Unexpected rule head: {}",
                        rule.head
                    );
                }

                assert_grammar_text_roundtrip(&res.grammar);

                let cnf_trace = CnfTransformer::transform(&res.grammar).unwrap();
                let cnf = &cnf_trace.final_grammar;
                let budget = PdaBudget {
                    max_steps: 240,
                    max_configurations: 20_000,
                    max_stack: 14,
                };
                let test_strings = generate_strings(&['a', 'b'], 4);
                for w in &test_strings {
                    let input_ids: Vec<SymbolId> = w
                        .chars()
                        .map(|c| SymbolId(if c == 'a' { 0 } else { 1 }))
                        .collect();
                    let sim = simulate_pda(&rnf, &input_ids, budget).unwrap();
                    if let PdaSimulation::Finished { accepted, .. } = sim {
                        let cyk_accepted = CykParser::parse(cnf, w).unwrap().accepted;
                        prop_assert_eq!(
                            cyk_accepted,
                            accepted,
                            "Mismatch on string {:?} for RNF PDA: PDA accepted={}, CFG accepted={}",
                            w,
                            accepted,
                            cyk_accepted
                        );
                    }
                }
            }
        }
    }

    #[test]
    fn test_ac3b_chain_cfg_pda_rnf_cfg(grammar in arb_small_grammar()) {
        let pda = cfg_to_pda_topdown(&grammar).unwrap().pda;
        let rnf = pda_to_rnf(&pda).unwrap().pda;
        let cfg2 = pda_to_cfg(&rnf).unwrap().grammar;

        let orig_cnf = CnfTransformer::transform(&grammar).unwrap().final_grammar;
        let new_cnf = CnfTransformer::transform(&cfg2).unwrap().final_grammar;

        let test_strings = generate_strings(&['a', 'b'], 5);
        for w in &test_strings {
            let orig_acc = CykParser::parse(&orig_cnf, w).unwrap().accepted;
            let new_acc = CykParser::parse(&new_cnf, w).unwrap().accepted;
            prop_assert_eq!(
                new_acc,
                orig_acc,
                "Chain mismatch on string {:?}: orig={}, new={}",
                w,
                orig_acc,
                new_acc
            );
        }
    }
}

// ---------------------------------------------------------------------------
// AC4: Robustness on Arbitrary Text and Random Non-RNF PDAs
// ---------------------------------------------------------------------------

fn arb_any_pda_including_high_ids() -> impl Strategy<Value = Pda> {
    let state_pool = prop_oneof![
        Just(0u32),
        Just(1u32),
        Just(2u32),
        Just(u32::MAX - 2),
        Just(u32::MAX - 1),
        Just(u32::MAX),
    ];
    proptest::collection::btree_set(state_pool, 1..=4).prop_flat_map(|state_set| {
        let states: Vec<u32> = state_set.into_iter().collect();
        let n = states.len();
        let start_strat = prop_oneof![
            Just(None),
            (0..n).prop_map({
                let states = states.clone();
                move |idx| Some(states[idx])
            })
        ];
        let accepting_strat = proptest::collection::btree_set(0..n, 0..=n).prop_map({
            let states = states.clone();
            move |idxs| idxs.into_iter().map(|i| states[i]).collect::<Vec<u32>>()
        });
        let input_strat = prop_oneof![
            Just(vec!["a"]),
            Just(vec!["a", "b"]),
            Just(vec!["ab"]),
            Just(vec!["A"]),
            Just(vec!["<"]),
        ];
        let stack_strat = prop_oneof![Just(vec!["#"]), Just(vec!["A", "#"])];
        let trans_strat = proptest::collection::vec(
            (
                0..n,
                prop_oneof![Just(None), Just(Some(0u16))],
                proptest::collection::vec(Just(0u16), 0..=2),
                proptest::collection::vec(Just(0u16), 0..=2),
                0..n,
            ),
            0..=4,
        )
        .prop_map({
            let states = states.clone();
            move |raw| {
                raw.into_iter()
                    .map(|(f, r, pop, push, t)| (states[f], r, pop, push, states[t]))
                    .collect::<Vec<_>>()
            }
        });

        (
            start_strat,
            accepting_strat,
            input_strat,
            stack_strat,
            trans_strat,
        )
            .prop_map(move |(start, accepting, input, stack, trans)| {
                make_pda(
                    PdaKind::Ndpda,
                    states.clone(),
                    start,
                    accepting,
                    &input,
                    &stack,
                    trans,
                )
            })
    })
}

proptest! {
    #[test]
    fn test_ac4_api_never_panics_on_arbitrary_text(s in ".*") {
        let out = api::pda_to_cfg(&s);
        prop_assert!(!out.is_empty());
    }

    #[test]
    fn test_ac4_non_rnf_pdas_and_high_state_ids(pda in arb_any_pda_including_high_ids()) {
        let allowed_keys = [
            "pda_cfg.no_start_state",
            "pda_cfg.bad_start",
            "pda_cfg.not_one_accepting",
            "pda_cfg.bad_accept",
            "pda_cfg.not_single_pop",
            "pda_cfg.terminal_not_readable",
            "machine.limit_exceeded",
        ];
        if let Err(msg) = pda_to_cfg(&pda) {
            prop_assert!(
                allowed_keys.contains(&msg.key),
                "Unexpected error key: {:?}",
                msg
            );
        }
    }
}
