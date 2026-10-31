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
    pub phase_name: String,
    pub description: String,
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
        let mut steps = Vec::new();
        let mut current = grammar.clone();

        // Phase 1: Isolate Start Symbol (S0 -> S)
        let (p1_grammar, p1_added, p1_removed) = Self::phase1_isolate_start(&current);
        steps.push(CnfStepResult {
            phase: 1,
            phase_name: "Isolasi Simbol Awal".into(),
            description:
                "Membuat simbol awal baru S₀ jika simbol awal S muncul di ruas kanan (RHS).".into(),
            grammar: p1_grammar.clone(),
            added_rules: p1_added,
            removed_rules: p1_removed,
        });
        current = p1_grammar;

        // Phase 2: Eliminate ε-productions
        let (p2_grammar, p2_added, p2_removed) = Self::phase2_eliminate_epsilon(&current)?;
        steps.push(CnfStepResult {
            phase: 2,
            phase_name: "Eliminasi Aturan ε (Nullable)".into(),
            description: "Menghapus aturan kosong A → ε dan menambahkan variasi aturan yang menghilangkan variabel nullable."
                .into(),
            grammar: p2_grammar.clone(),
            added_rules: p2_added,
            removed_rules: p2_removed,
        });
        current = p2_grammar;

        // Phase 3: Eliminate Unit Productions (A -> B)
        let (p3_grammar, p3_added, p3_removed) = Self::phase3_eliminate_unit(&current);
        steps.push(CnfStepResult {
            phase: 3,
            phase_name: "Eliminasi Aturan Unit (A → B)".into(),
            description: "Menghapus rantai transisi unit antar variabel dan menggantikannya dengan aturan langsung."
                .into(),
            grammar: p3_grammar.clone(),
            added_rules: p3_added,
            removed_rules: p3_removed,
        });
        current = p3_grammar;

        // Phase 4: Eliminate Useless Symbols (Unproductive then Unreachable)
        let (p4_grammar, p4_added, p4_removed) = Self::phase4_eliminate_useless(&current);
        steps.push(CnfStepResult {
            phase: 4,
            phase_name: "Eliminasi Simbol Tak Berguna (Useless)".into(),
            description: "Menghapus simbol yang tidak menghasilkan terminal (unproductive) dan simbol yang tidak dapat dijangkau dari simbol awal (unreachable)."
                .into(),
            grammar: p4_grammar.clone(),
            added_rules: p4_added,
            removed_rules: p4_removed,
        });
        current = p4_grammar;

        // Phase 5: Replace Terminals in Mixed Productions (length >= 2)
        let (p5_grammar, p5_added, p5_removed) = Self::phase5_isolate_terminals(&current);
        steps.push(CnfStepResult {
            phase: 5,
            phase_name: "Isolasi Terminal pada Aturan Campuran".into(),
            description: "Menggantikan terminal pada aturan yang memiliki panjang ≥ 2 dengan variabel pembantu T_a → a."
                .into(),
            grammar: p5_grammar.clone(),
            added_rules: p5_added,
            removed_rules: p5_removed,
        });
        current = p5_grammar;

        // Phase 6: Binarize Long RHS Productions (length >= 3)
        let (p6_grammar, p6_added, p6_removed) = Self::phase6_binarize_long(&current);
        steps.push(CnfStepResult {
            phase: 6,
            phase_name: "Binarisasi Aturan Panjang (Panjang ≥ 3)".into(),
            description: "Memecah aturan dengan ≥ 3 variabel menjadi aturan biner (A → B C) menggunakan variabel kaskade."
                .into(),
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

    /// Phase 1: If start symbol S appears on RHS of any rule, create S_0 -> S
    fn phase1_isolate_start(grammar: &Grammar) -> (Grammar, Vec<Production>, Vec<Production>) {
        let start_on_rhs = grammar.rules.iter().any(|r| {
            r.body.iter().any(|sym| match sym {
                Symbol::NonTerminal(nt) => nt == &grammar.start,
                _ => false,
            })
        });

        if !start_on_rhs {
            return (grammar.clone(), Vec::new(), Vec::new());
        }

        let new_start =
            Self::fresh_variable_name(&grammar.variables(), &format!("{}0", grammar.start));
        let new_rule = Production::new(
            new_start.clone(),
            vec![Symbol::NonTerminal(grammar.start.clone())],
        );

        let mut rules = vec![new_rule.clone()];
        rules.extend(grammar.rules.clone());

        (Grammar::new(new_start, rules), vec![new_rule], Vec::new())
    }

    /// Phase 2: Eliminate epsilon productions
    fn phase2_eliminate_epsilon(
        grammar: &Grammar,
    ) -> Result<(Grammar, Vec<Production>, Vec<Production>), GrammarError> {
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

        let mut new_rules_set: BTreeSet<Production> = BTreeSet::new();
        let mut removed_rules = Vec::new();

        // 2. For each rule, generate all combinations omitting nullable non-terminals
        for rule in &grammar.rules {
            if rule.body.is_empty() {
                removed_rules.push(rule.clone());
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
                    "Aturan '{}' memiliki terlalu banyak variabel nullable (> 10)",
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

        // If the start symbol itself was nullable, preserve empty string via start -> ε
        if nullable.contains(&grammar.start) {
            new_rules_set.insert(Production::new(grammar.start.clone(), Vec::new()));
        }

        let mut final_rules: Vec<Production> = new_rules_set.into_iter().collect();
        // Sort stably: start rules first, then alphabetical by head
        Self::sort_productions(&mut final_rules, &grammar.start);

        let added_rules: Vec<Production> = final_rules
            .iter()
            .filter(|r| !grammar.rules.contains(r))
            .cloned()
            .collect();

        Ok((
            Grammar::new(grammar.start.clone(), final_rules),
            added_rules,
            removed_rules,
        ))
    }

    /// Phase 3: Eliminate unit productions (A -> B)
    fn phase3_eliminate_unit(grammar: &Grammar) -> (Grammar, Vec<Production>, Vec<Production>) {
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

    /// Phase 4: Eliminate useless symbols (Unproductive then Unreachable)
    fn phase4_eliminate_useless(grammar: &Grammar) -> (Grammar, Vec<Production>, Vec<Production>) {
        // 4a. Find productive variables (variables that can derive a terminal string)
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

        // 4b. Find reachable variables starting from grammar.start
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
                        if let Symbol::NonTerminal(nt) = sym {
                            let newly_inserted = reachable.insert(nt.clone());
                            if newly_inserted {
                                queue.push_back(nt.clone());
                            }
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

    /// Phase 5: Isolate terminals in mixed rules (length >= 2)
    fn phase5_isolate_terminals(grammar: &Grammar) -> (Grammar, Vec<Production>, Vec<Production>) {
        let mut existing_vars = grammar.variables();
        let mut term_map: BTreeMap<char, String> = BTreeMap::new();
        let mut new_rules = Vec::new();
        let mut helper_rules = Vec::new();
        let mut removed_rules = Vec::new();

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
                        let var_name = term_map.entry(*c).or_insert_with(|| {
                            let name =
                                Self::fresh_variable_name(&existing_vars, &format!("T_{}", c));
                            existing_vars.insert(name.clone());
                            helper_rules
                                .push(Production::new(name.clone(), vec![Symbol::Terminal(*c)]));
                            name
                        });
                        new_body.push(Symbol::NonTerminal(var_name.clone()));
                    }
                    Symbol::NonTerminal(nt) => {
                        new_body.push(Symbol::NonTerminal(nt.clone()));
                    }
                }
            }
            new_rules.push(Production::new(rule.head.clone(), new_body));
        }

        new_rules.extend(helper_rules.clone());
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
        )
    }

    /// Phase 6: Binarize long rules (length >= 3)
    fn phase6_binarize_long(grammar: &Grammar) -> (Grammar, Vec<Production>, Vec<Production>) {
        let mut existing_vars = grammar.variables();
        let mut final_rules = Vec::new();
        let mut removed_rules = Vec::new();
        let mut helper_counter = 1;

        for rule in &grammar.rules {
            if rule.body.len() <= 2 {
                final_rules.push(rule.clone());
                continue;
            }

            removed_rules.push(rule.clone());
            let mut current_head = rule.head.clone();
            let k = rule.body.len();

            for i in 0..(k - 2) {
                let fresh =
                    Self::fresh_variable_name(&existing_vars, &format!("X_{}", helper_counter));
                helper_counter += 1;
                existing_vars.insert(fresh.clone());

                final_rules.push(Production::new(
                    current_head,
                    vec![rule.body[i].clone(), Symbol::NonTerminal(fresh.clone())],
                ));
                current_head = fresh;
            }

            final_rules.push(Production::new(
                current_head,
                vec![rule.body[k - 2].clone(), rule.body[k - 1].clone()],
            ));
        }

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

    fn fresh_variable_name(vars: &BTreeSet<String>, base: &str) -> String {
        if !vars.contains(base) {
            return base.to_string();
        }
        let mut counter = 1;
        loop {
            let candidate = format!("{}_{}", base, counter);
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
