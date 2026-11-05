use std::collections::{BTreeMap, BTreeSet, HashSet, VecDeque};

use serde::{Deserialize, Serialize};

use super::error::GrammarError;
use super::types::{Grammar, Production, Symbol};

#[cfg(feature = "ts")]
use ts_rs::TS;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(TS))]
#[cfg_attr(feature = "ts", ts(export))]
pub struct CnfStepResult {
    pub phase: usize,
    pub phase_key: String,
    pub note_key: Option<String>,
    pub grammar: Grammar,
    pub added_rules: Vec<Production>,
    pub removed_rules: Vec<Production>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(TS))]
#[cfg_attr(feature = "ts", ts(export))]
pub struct CnfTransformationTrace {
    pub original: Grammar,
    pub steps: Vec<CnfStepResult>,
    pub final_grammar: Grammar,
}

pub struct CnfTransformer;

impl CnfTransformer {
    pub fn transform(grammar: &Grammar) -> Result<CnfTransformationTrace, GrammarError> {
        Self::transform_with_options(grammar, false)
    }

    pub fn transform_with_options(
        grammar: &Grammar,
        short_version: bool,
    ) -> Result<CnfTransformationTrace, GrammarError> {
        let mut steps = Vec::new();
        let mut current = grammar.clone();

        // Phase 1: Remove Unreachable Rules
        let (p1_grammar, p1_added, p1_removed) = Self::phase1_eliminate_unreachable(&current);
        steps.push(CnfStepResult {
            phase: 1,
            phase_key: "grammar.cnf.phase_unreachable".into(),
            note_key: None,
            grammar: p1_grammar.clone(),
            added_rules: p1_added,
            removed_rules: p1_removed,
        });
        current = p1_grammar;

        // Phase 2: Remove Non-Productive Rules (and rules made unreachable by their removal)
        let (p2_grammar, p2_added, p2_removed) = Self::phase2_eliminate_nonproductive(&current);
        steps.push(CnfStepResult {
            phase: 2,
            phase_key: "grammar.cnf.phase_nonproductive".into(),
            note_key: None,
            grammar: p2_grammar.clone(),
            added_rules: p2_added,
            removed_rules: p2_removed,
        });
        current = p2_grammar;

        // Phase 3: Eliminate ε-productions and returning ε
        let (p3_grammar, p3_added, p3_removed, p3_added_s0) =
            Self::phase3_eliminate_epsilon(&current)?;
        let p3_note = if p3_added_s0 {
            Some("grammar.cnf.phase_epsilon.note".into())
        } else {
            None
        };
        steps.push(CnfStepResult {
            phase: 3,
            phase_key: "grammar.cnf.phase_epsilon".into(),
            note_key: p3_note,
            grammar: p3_grammar.clone(),
            added_rules: p3_added,
            removed_rules: p3_removed,
        });
        current = p3_grammar;

        // Phase 4: Eliminate Unit Productions (A -> B)
        let (p4_grammar, p4_added, p4_removed) = Self::phase4_eliminate_unit(&current);
        steps.push(CnfStepResult {
            phase: 4,
            phase_key: "grammar.cnf.phase_unit".into(),
            note_key: None,
            grammar: p4_grammar.clone(),
            added_rules: p4_added,
            removed_rules: p4_removed,
        });
        current = p4_grammar;

        // Phase 5: Replace Terminals in Mixed Productions (length >= 2)
        let (p5_grammar, p5_added, p5_removed, p5_reused) =
            Self::phase5_isolate_terminals(&current, short_version);
        let p5_note = if short_version && p5_reused {
            Some("grammar.cnf.phase_mixed.note_short".into())
        } else {
            None
        };
        steps.push(CnfStepResult {
            phase: 5,
            phase_key: "grammar.cnf.phase_mixed".into(),
            note_key: p5_note,
            grammar: p5_grammar.clone(),
            added_rules: p5_added,
            removed_rules: p5_removed,
        });
        current = p5_grammar;

        // Phase 6: Binarize Long RHS Productions (length >= 3)
        let (p6_grammar, p6_added, p6_removed, p6_shared) =
            Self::phase6_binarize_long(&current, short_version);
        let p6_note = if short_version && p6_shared {
            Some("grammar.cnf.phase_long.note_short".into())
        } else {
            None
        };
        steps.push(CnfStepResult {
            phase: 6,
            phase_key: "grammar.cnf.phase_long".into(),
            note_key: p6_note,
            grammar: p6_grammar.clone(),
            added_rules: p6_added,
            removed_rules: p6_removed,
        });
        let final_grammar = p6_grammar;

        Ok(CnfTransformationTrace {
            original: grammar.clone(),
            steps,
            final_grammar,
        })
    }

    /// Phase 1: Eliminate unreachable variables and their rules.
    fn phase1_eliminate_unreachable(
        grammar: &Grammar,
    ) -> (Grammar, Vec<Production>, Vec<Production>) {
        let mut reachable: HashSet<String> = HashSet::new();
        let mut queue = VecDeque::new();

        reachable.insert(grammar.start.clone());
        queue.push_back(grammar.start.clone());

        while let Some(curr) = queue.pop_front() {
            for r in &grammar.rules {
                if r.head == curr {
                    for sym in &r.body {
                        if let Symbol::NonTerminal(nt) = sym
                            && reachable.insert(nt.clone())
                        {
                            queue.push_back(nt.clone());
                        }
                    }
                }
            }
        }

        let mut final_rules: Vec<Production> = grammar
            .rules
            .iter()
            .filter(|r| {
                reachable.contains(&r.head)
                    && r.body.iter().all(|s| match s {
                        Symbol::Terminal(_) => true,
                        Symbol::NonTerminal(nt) => reachable.contains(nt),
                    })
            })
            .cloned()
            .collect();

        Self::sort_productions(&mut final_rules, &grammar.start);

        let removed_rules: Vec<Production> = grammar
            .rules
            .iter()
            .filter(|r| !final_rules.contains(r))
            .cloned()
            .collect();

        (
            Grammar::new(grammar.start.clone(), final_rules),
            Vec::new(),
            removed_rules,
        )
    }

    /// Phase 2: Eliminate non-productive variables, their rules, and variables made unreachable.
    fn phase2_eliminate_nonproductive(
        grammar: &Grammar,
    ) -> (Grammar, Vec<Production>, Vec<Production>) {
        // 1. Find productive variables (variables that can derive a terminal string)
        let mut productive: HashSet<String> = HashSet::new();
        let mut changed = true;

        while changed {
            changed = false;
            for rule in &grammar.rules {
                if productive.contains(&rule.head) {
                    continue;
                }
                let body_is_productive = rule.body.iter().all(|s| match s {
                    Symbol::Terminal(_) => true,
                    Symbol::NonTerminal(nt) => productive.contains(nt),
                });
                if body_is_productive {
                    productive.insert(rule.head.clone());
                    changed = true;
                }
            }
        }

        // Filter out rules with unproductive symbols
        let p_rules: Vec<Production> = grammar
            .rules
            .iter()
            .filter(|r| {
                productive.contains(&r.head)
                    && r.body.iter().all(|s| match s {
                        Symbol::Terminal(_) => true,
                        Symbol::NonTerminal(nt) => productive.contains(nt),
                    })
            })
            .cloned()
            .collect();

        // 2. Reachability pass to eliminate variables made unreachable by unproductive removal
        let mut reachable: HashSet<String> = HashSet::new();
        let mut queue = VecDeque::new();

        if productive.contains(&grammar.start) {
            reachable.insert(grammar.start.clone());
            queue.push_back(grammar.start.clone());
        }

        while let Some(curr) = queue.pop_front() {
            for r in &p_rules {
                if r.head == curr {
                    for sym in &r.body {
                        if let Symbol::NonTerminal(nt) = sym
                            && reachable.insert(nt.clone())
                        {
                            queue.push_back(nt.clone());
                        }
                    }
                }
            }
        }

        let mut final_rules: Vec<Production> = p_rules
            .into_iter()
            .filter(|r| {
                reachable.contains(&r.head)
                    && r.body.iter().all(|s| match s {
                        Symbol::Terminal(_) => true,
                        Symbol::NonTerminal(nt) => reachable.contains(nt),
                    })
            })
            .collect();

        Self::sort_productions(&mut final_rules, &grammar.start);

        let removed_rules: Vec<Production> = grammar
            .rules
            .iter()
            .filter(|r| !final_rules.contains(r))
            .cloned()
            .collect();

        (
            Grammar::new(grammar.start.clone(), final_rules),
            Vec::new(),
            removed_rules,
        )
    }

    /// Phase 3: Eliminate epsilon productions and apply returning ε if start is nullable.
    fn phase3_eliminate_epsilon(
        grammar: &Grammar,
    ) -> Result<(Grammar, Vec<Production>, Vec<Production>, bool), GrammarError> {
        // 1. Find all nullable variables using fixed-point iteration
        let mut nullable: HashSet<String> = HashSet::new();
        let mut changed = true;

        while changed {
            changed = false;
            for rule in &grammar.rules {
                if nullable.contains(&rule.head) {
                    continue;
                }
                let is_nullable = rule.body.is_empty()
                    || rule.body.iter().all(|s| match s {
                        Symbol::NonTerminal(nt) => nullable.contains(nt),
                        Symbol::Terminal(_) => false,
                    });
                if is_nullable {
                    nullable.insert(rule.head.clone());
                    changed = true;
                }
            }
        }

        let start_is_nullable = nullable.contains(&grammar.start);
        let mut new_rules_set: BTreeSet<Production> = BTreeSet::new();

        // 2. For each rule, generate all combinations omitting nullable non-terminals
        for rule in &grammar.rules {
            if rule.body.is_empty() {
                continue;
            }

            let nullable_indices: Vec<usize> = rule
                .body
                .iter()
                .enumerate()
                .filter_map(|(idx, s)| match s {
                    Symbol::NonTerminal(nt) if nullable.contains(nt) => Some(idx),
                    _ => None,
                })
                .collect();

            if nullable_indices.is_empty() {
                new_rules_set.insert(rule.clone());
                continue;
            }

            // Cap subset combination explosion to avoid OOM
            if nullable_indices.len() > 10 {
                return Err(GrammarError::BudgetExceeded(format!(
                    "aturan '{}' memiliki terlalu banyak variabel nullable (> 10)",
                    rule
                )));
            }

            let num_combinations = 1 << nullable_indices.len();
            for mask in 0..num_combinations {
                let mut new_body = Vec::new();
                for (i, sym) in rule.body.iter().enumerate() {
                    if let Some(pos) = nullable_indices.iter().position(|&idx| idx == i) {
                        if (mask & (1 << pos)) == 0 {
                            new_body.push(sym.clone());
                        }
                    } else {
                        new_body.push(sym.clone());
                    }
                }

                // If non-empty, keep it
                if !new_body.is_empty() {
                    new_rules_set.insert(Production::new(rule.head.clone(), new_body));
                }
            }
        }

        // Returning ε: if start symbol is nullable, add S0 -> S | ε
        let final_start = if start_is_nullable {
            let new_start =
                Self::fresh_variable_name(&grammar.variables(), &format!("{}0", grammar.start));
            new_rules_set.insert(Production::new(
                new_start.clone(),
                vec![Symbol::NonTerminal(grammar.start.clone())],
            ));
            new_rules_set.insert(Production::new(new_start.clone(), Vec::new()));
            new_start
        } else {
            grammar.start.clone()
        };

        let mut final_rules: Vec<Production> = new_rules_set.into_iter().collect();
        Self::sort_productions(&mut final_rules, &final_start);

        let removed_rules: Vec<Production> = grammar
            .rules
            .iter()
            .filter(|r| !final_rules.contains(r))
            .cloned()
            .collect();

        let added_rules: Vec<Production> = final_rules
            .iter()
            .filter(|r| !grammar.rules.contains(r))
            .cloned()
            .collect();

        Ok((
            Grammar::new(final_start, final_rules),
            added_rules,
            removed_rules,
            start_is_nullable,
        ))
    }

    /// Phase 4: Eliminate unit productions (A -> B)
    fn phase4_eliminate_unit(grammar: &Grammar) -> (Grammar, Vec<Production>, Vec<Production>) {
        let vars = grammar.variables();

        // 1. Build unit graph
        let mut unit_graph: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
        for v in &vars {
            unit_graph.entry(v.clone()).or_default();
        }
        for rule in &grammar.rules {
            if let [Symbol::NonTerminal(target)] = &rule.body[..] {
                unit_graph
                    .entry(rule.head.clone())
                    .or_default()
                    .insert(target.clone());
            }
        }

        // 2. Find unit pairs (A, B) such that A =>* B using BFS
        let mut unit_pairs: Vec<(String, String)> = Vec::new();
        for v in &vars {
            let mut visited = HashSet::new();
            let mut queue = VecDeque::new();
            visited.insert(v.clone());
            queue.push_back(v.clone());

            while let Some(curr) = queue.pop_front() {
                unit_pairs.push((v.clone(), curr.clone()));
                if let Some(neighbors) = unit_graph.get(&curr) {
                    for n in neighbors {
                        if visited.insert(n.clone()) {
                            queue.push_back(n.clone());
                        }
                    }
                }
            }
        }

        // 3. Collect non-unit productions for each B
        let mut non_unit_rules: BTreeMap<String, Vec<Vec<Symbol>>> = BTreeMap::new();
        let mut removed_rules = Vec::new();

        for rule in &grammar.rules {
            if rule.is_unit() {
                removed_rules.push(rule.clone());
            } else {
                non_unit_rules
                    .entry(rule.head.clone())
                    .or_default()
                    .push(rule.body.clone());
            }
        }

        // 4. For each pair (A, B), add all non-unit rules of B as rules of A
        let mut new_rules_set: BTreeSet<Production> = BTreeSet::new();
        for (a, b) in unit_pairs {
            if let Some(bodies) = non_unit_rules.get(&b) {
                for body in bodies {
                    new_rules_set.insert(Production::new(a.clone(), body.clone()));
                }
            }
        }

        let mut final_rules: Vec<Production> = new_rules_set.into_iter().collect();
        Self::sort_productions(&mut final_rules, &grammar.start);

        let added_rules: Vec<Production> = final_rules
            .iter()
            .filter(|r| !grammar.rules.contains(r))
            .cloned()
            .collect();

        (
            Grammar::new(grammar.start.clone(), final_rules),
            added_rules,
            removed_rules,
        )
    }

    /// Phase 5: Isolate terminals in mixed rules (length >= 2)
    fn phase5_isolate_terminals(
        grammar: &Grammar,
        short_version: bool,
    ) -> (Grammar, Vec<Production>, Vec<Production>, bool) {
        let mut existing_vars = grammar.variables();
        let mut term_map: BTreeMap<char, String> = BTreeMap::new();
        let mut new_rules = Vec::new();
        let mut helper_rules = Vec::new();
        let mut removed_rules = Vec::new();
        let mut p_counter = 1;
        let mut reused_any = false;

        // In short version:
        // For a terminal a, if some variable A has exactly one rule in the grammar
        // and that rule is A -> a, then every mixed rule uses A for a and no T_a is created.
        // If several variables qualify, take the first by name order.
        let mut reusable_vars: BTreeMap<char, String> = BTreeMap::new();
        if short_version {
            let mut head_counts: BTreeMap<String, usize> = BTreeMap::new();
            for r in &grammar.rules {
                *head_counts.entry(r.head.clone()).or_default() += 1;
            }

            let mut candidates_by_terminal: BTreeMap<char, Vec<String>> = BTreeMap::new();
            for r in &grammar.rules {
                if head_counts.get(&r.head) == Some(&1)
                    && let [Symbol::Terminal(c)] = &r.body[..]
                {
                    candidates_by_terminal
                        .entry(*c)
                        .or_default()
                        .push(r.head.clone());
                }
            }

            for (c, mut candidates) in candidates_by_terminal {
                candidates.sort();
                if let Some(first) = candidates.into_iter().next() {
                    reusable_vars.insert(c, first);
                }
            }
        }

        for rule in &grammar.rules {
            if rule.body.len() < 2 {
                new_rules.push(rule.clone());
                continue;
            }

            let has_terminals = rule.body.iter().any(|s| s.is_terminal());
            if !has_terminals {
                new_rules.push(rule.clone());
                continue;
            }

            removed_rules.push(rule.clone());
            let mut new_body = Vec::new();
            for sym in &rule.body {
                match sym {
                    Symbol::Terminal(c) => {
                        let var_name = if let Some(reused) = reusable_vars.get(c) {
                            reused_any = true;
                            reused.clone()
                        } else {
                            term_map
                                .entry(*c)
                                .or_insert_with(|| {
                                    let base = if c.is_ascii_alphanumeric() {
                                        format!("T_{}", c)
                                    } else {
                                        let name = format!("T_p{}", p_counter);
                                        p_counter += 1;
                                        name
                                    };
                                    let name = Self::fresh_variable_name(&existing_vars, &base);
                                    existing_vars.insert(name.clone());
                                    helper_rules.push(Production::new(
                                        name.clone(),
                                        vec![Symbol::Terminal(*c)],
                                    ));
                                    name
                                })
                                .clone()
                        };
                        new_body.push(Symbol::NonTerminal(var_name));
                    }
                    Symbol::NonTerminal(nt) => {
                        new_body.push(Symbol::NonTerminal(nt.clone()));
                    }
                }
            }
            new_rules.push(Production::new(rule.head.clone(), new_body));
        }

        new_rules.extend(helper_rules);
        Self::sort_productions(&mut new_rules, &grammar.start);

        let added_rules: Vec<Production> = new_rules
            .iter()
            .filter(|r| !grammar.rules.contains(r))
            .cloned()
            .collect();

        (
            Grammar::new(grammar.start.clone(), new_rules),
            added_rules,
            removed_rules,
            reused_any,
        )
    }

    /// Phase 6: Binarize long rules (length >= 3)
    fn phase6_binarize_long(
        grammar: &Grammar,
        short_version: bool,
    ) -> (Grammar, Vec<Production>, Vec<Production>, bool) {
        let mut existing_vars = grammar.variables();
        let mut pair_map: BTreeMap<(String, String), String> = BTreeMap::new();
        let mut final_rules = Vec::new();
        let mut helper_rules = Vec::new();
        let mut removed_rules = Vec::new();
        let mut shared_any = false;

        for rule in &grammar.rules {
            if rule.body.len() <= 2 {
                final_rules.push(rule.clone());
                continue;
            }

            removed_rules.push(rule.clone());
            let mut current_body = rule.body.clone();

            // Right-to-left reduction with caching of variable pairs (if short_version is enabled)
            while current_body.len() > 2 {
                let n = current_body.len();
                let sym1 = current_body[n - 2].to_string();
                let sym2 = current_body[n - 1].to_string();
                let pair_key = (sym1, sym2);

                let (helper_var, was_shared) = if short_version {
                    match pair_map.get(&pair_key) {
                        Some(existing_var) => (existing_var.clone(), true),
                        None => {
                            let fresh = Self::fresh_variable_name(&existing_vars, "X");
                            existing_vars.insert(fresh.clone());
                            pair_map.insert(pair_key, fresh.clone());
                            helper_rules.push(Production::new(
                                fresh.clone(),
                                vec![current_body[n - 2].clone(), current_body[n - 1].clone()],
                            ));
                            (fresh, false)
                        }
                    }
                } else {
                    let fresh = Self::fresh_variable_name(&existing_vars, "X");
                    existing_vars.insert(fresh.clone());
                    helper_rules.push(Production::new(
                        fresh.clone(),
                        vec![current_body[n - 2].clone(), current_body[n - 1].clone()],
                    ));
                    (fresh, false)
                };

                if was_shared {
                    shared_any = true;
                }

                current_body.truncate(n - 2);
                current_body.push(Symbol::NonTerminal(helper_var));
            }

            final_rules.push(Production::new(rule.head.clone(), current_body));
        }

        final_rules.extend(helper_rules);
        Self::sort_productions(&mut final_rules, &grammar.start);

        let added_rules: Vec<Production> = final_rules
            .iter()
            .filter(|r| !grammar.rules.contains(r))
            .cloned()
            .collect();

        (
            Grammar::new(grammar.start.clone(), final_rules),
            added_rules,
            removed_rules,
            shared_any,
        )
    }

    fn fresh_variable_name(vars: &BTreeSet<String>, base: &str) -> String {
        if !vars.contains(base) {
            return base.to_string();
        }
        let mut counter = 1;
        loop {
            let candidate = if base.contains('_') {
                format!("{}{}", base, counter)
            } else {
                format!("{}_{}", base, counter)
            };
            if !vars.contains(&candidate) {
                return candidate;
            }
            counter += 1;
        }
    }

    fn sort_productions(rules: &mut [Production], start: &str) {
        rules.sort_by(|a, b| {
            let a_is_start = a.head == start;
            let b_is_start = b.head == start;
            if a_is_start != b_is_start {
                return b_is_start.cmp(&a_is_start);
            }
            match a.head.cmp(&b.head) {
                std::cmp::Ordering::Equal => a.body.cmp(&b.body),
                other => other,
            }
        });
    }
}
