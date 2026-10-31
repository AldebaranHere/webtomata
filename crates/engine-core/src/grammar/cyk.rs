use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};

use super::error::GrammarError;
use super::types::{Grammar, Symbol};

#[cfg(feature = "ts")]
use ts_rs::TS;

/// Result of running the Cocke-Younger-Kasami (CYK) dynamic programming algorithm.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(TS))]
#[cfg_attr(feature = "ts", ts(export))]
pub struct CykResult {
    pub input: String,
    pub accepted: bool,
    /// CYK table where `table[length - 1][start_index]` contains the sorted nonterminals
    /// that derive `input[start_index .. start_index + length]`.
    pub table: Vec<Vec<Vec<String>>>,
    pub is_cnf: bool,
}

pub struct CykParser;

impl CykParser {
    pub const MAX_INPUT_LEN: usize = 100;

    /// Verifies if a grammar conforms strictly to Chomsky Normal Form (CNF):
    /// - A -> BC (two nonterminals)
    /// - A -> a (single terminal)
    /// - S -> ε (only if start symbol and ε is in the language)
    pub fn is_cnf(grammar: &Grammar) -> bool {
        for rule in &grammar.rules {
            if rule.body.is_empty() {
                if rule.head != grammar.start {
                    return false;
                }
            } else if rule.body.len() == 1 {
                if !rule.body[0].is_terminal() {
                    return false;
                }
            } else if rule.body.len() == 2 {
                if !rule.body[0].is_non_terminal() || !rule.body[1].is_non_terminal() {
                    return false;
                }
            } else {
                return false;
            }
        }
        true
    }

    /// Executes the CYK dynamic programming algorithm on a CNF grammar.
    pub fn parse(grammar: &Grammar, input: &str) -> Result<CykResult, GrammarError> {
        let chars: Vec<char> = input.chars().collect();
        let n = chars.len();

        if n > Self::MAX_INPUT_LEN {
            return Err(GrammarError::BudgetExceeded(format!(
                "Panjang string CYK ({} karakter) melebihi batas maksimal {}",
                n,
                Self::MAX_INPUT_LEN
            )));
        }

        let is_cnf = Self::is_cnf(grammar);
        if !is_cnf {
            return Err(GrammarError::InvalidRuleFormat(
                "Tata bahasa harus berada dalam Bentuk Normal Chomsky (CNF) untuk menjalankan algoritma CYK."
                    .into(),
            ));
        }

        // Handle empty string ε
        if n == 0 {
            let accepted = grammar
                .rules
                .iter()
                .any(|r| r.head == grammar.start && r.body.is_empty());
            return Ok(CykResult {
                input: input.to_string(),
                accepted,
                table: Vec::new(),
                is_cnf: true,
            });
        }

        // Initialize triangular table: table[length - 1][start_index]
        let mut raw_table: Vec<Vec<BTreeSet<String>>> = Vec::with_capacity(n);
        for len in 1..=n {
            let count = n - len + 1;
            raw_table.push(vec![BTreeSet::new(); count]);
        }

        // Base case: Substrings of length 1
        for i in 0..n {
            let target_char = chars[i];
            for rule in &grammar.rules {
                if rule.body.as_slice() == [Symbol::Terminal(target_char)] {
                    raw_table[0][i].insert(rule.head.clone());
                }
            }
        }

        // Inductive step: Substrings of length 2 to n
        for len in 2..=n {
            let l_idx = len - 1;
            for i in 0..=(n - len) {
                let mut derived = BTreeSet::new();
                for k in 1..len {
                    let left_set = &raw_table[k - 1][i];
                    let right_set = &raw_table[len - k - 1][i + k];
                    if left_set.is_empty() || right_set.is_empty() {
                        continue;
                    }

                    for rule in &grammar.rules {
                        if let [Symbol::NonTerminal(b), Symbol::NonTerminal(c)] = &rule.body[..] {
                            let can_derive = left_set.contains(b) && right_set.contains(c);
                            if can_derive {
                                derived.insert(rule.head.clone());
                            }
                        }
                    }
                }
                raw_table[l_idx][i] = derived;
            }
        }

        let accepted = raw_table[n - 1][0].contains(&grammar.start);

        let table: Vec<Vec<Vec<String>>> = raw_table
            .into_iter()
            .map(|row| {
                row.into_iter()
                    .map(|set| set.into_iter().collect())
                    .collect()
            })
            .collect();

        Ok(CykResult {
            input: input.to_string(),
            accepted,
            table,
            is_cnf: true,
        })
    }
}
