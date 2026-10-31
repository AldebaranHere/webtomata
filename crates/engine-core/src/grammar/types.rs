use std::collections::BTreeSet;
use std::fmt;

use serde::{Deserialize, Serialize};

#[cfg(feature = "ts")]
use ts_rs::TS;

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(tag = "type", content = "value", rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(TS))]
#[cfg_attr(feature = "ts", ts(export))]
pub enum Symbol {
    Terminal(char),
    NonTerminal(String),
}

impl Symbol {
    pub fn is_terminal(&self) -> bool {
        matches!(self, Symbol::Terminal(_))
    }

    pub fn is_non_terminal(&self) -> bool {
        matches!(self, Symbol::NonTerminal(_))
    }
}

impl fmt::Display for Symbol {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Symbol::Terminal(c) => write!(f, "{}", c),
            Symbol::NonTerminal(nt) => write!(f, "{}", nt),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(TS))]
#[cfg_attr(feature = "ts", ts(export))]
pub struct Production {
    pub head: String,
    pub body: Vec<Symbol>,
}

impl Production {
    pub fn new(head: impl Into<String>, body: Vec<Symbol>) -> Self {
        Self {
            head: head.into(),
            body,
        }
    }

    pub fn is_epsilon(&self) -> bool {
        self.body.is_empty()
    }

    pub fn is_unit(&self) -> bool {
        self.body.len() == 1 && self.body[0].is_non_terminal()
    }
}

impl fmt::Display for Production {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} -> ", self.head)?;
        if self.body.is_empty() {
            write!(f, "ε")
        } else {
            for sym in &self.body {
                write!(f, "{}", sym)?;
            }
            Ok(())
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(TS))]
#[cfg_attr(feature = "ts", ts(export))]
pub struct Grammar {
    pub start: String,
    pub rules: Vec<Production>,
}

impl Grammar {
    pub fn new(start: impl Into<String>, rules: Vec<Production>) -> Self {
        Self {
            start: start.into(),
            rules,
        }
    }

    pub fn variables(&self) -> BTreeSet<String> {
        let mut vars = BTreeSet::new();
        vars.insert(self.start.clone());
        for rule in &self.rules {
            vars.insert(rule.head.clone());
            for sym in &rule.body {
                if let Symbol::NonTerminal(nt) = sym {
                    vars.insert(nt.clone());
                }
            }
        }
        vars
    }

    pub fn terminals(&self) -> BTreeSet<char> {
        let mut terms = BTreeSet::new();
        for rule in &self.rules {
            for sym in &rule.body {
                if let Symbol::Terminal(c) = sym {
                    terms.insert(*c);
                }
            }
        }
        terms
    }

    pub fn to_display_string(&self) -> String {
        let mut result = String::new();
        let mut seen_heads = BTreeSet::new();

        // Print start symbol rules first
        let mut heads = vec![self.start.clone()];
        for r in &self.rules {
            if !heads.contains(&r.head) {
                heads.push(r.head.clone());
            }
        }

        for head in heads {
            if !seen_heads.insert(head.clone()) {
                continue;
            }
            let bodies: Vec<&Production> = self.rules.iter().filter(|r| r.head == head).collect();
            if bodies.is_empty() {
                continue;
            }
            if !result.is_empty() {
                result.push('\n');
            }
            result.push_str(&head);
            result.push_str(" -> ");
            for (i, p) in bodies.iter().enumerate() {
                if i > 0 {
                    result.push_str(" | ");
                }
                if p.body.is_empty() {
                    result.push('ε');
                } else {
                    for sym in &p.body {
                        match sym {
                            Symbol::Terminal(c) => result.push(*c),
                            Symbol::NonTerminal(nt) => result.push_str(nt),
                        }
                    }
                }
            }
        }
        result
    }
}
