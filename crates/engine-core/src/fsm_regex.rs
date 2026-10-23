//! FSM → regular expression by state elimination (Rich's `fsmtoregex`: `standardize` and
//! `buildregex`, section 6.2.2 of the textbook; the slides call it "Algoritma Umum").
//!
//! Step 1: remove the states that no input can reach. Step 2: if no accepting state is
//! left, the result is `∅`. Step 3: if the start state has transitions into it, add a new
//! start state with an ε-transition to it. Step 4: if there is more than one accepting state,
//! or the only one has transitions out of it, add a new accepting state with an ε-transition
//! from each old one. Step 5: if one state is left, the result is `ε`. Step 6: keep one label
//! for each pair of states (several transitions are joined with `∪`; no transition is `∅`).
//! Step 7: remove the other states one at a time, highest number first. When `rip` goes, each
//! pair `p`, `q` gets the label `R(p,q) ∪ R(p,rip) R(rip,rip)* R(rip,q)`. Step 8: the label
//! from the start state to the accepting state is the result.
//!
//! Light simplification: `∅ ∪ r = r`, `r ∪ r = r`, `∅ r = ∅`, `ε r = r`, `∅* = ε`, `ε* = ε`.

use crate::fsm::{Fsm, StateId, SymbolId};
use crate::message::Message;
use crate::regex::Regex;
use crate::stop::StopReason;
use crate::trace::{Change, ConversionStep, Label};
use serde::Deserialize;
use std::collections::{BTreeMap, HashMap, HashSet, VecDeque};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct FsmToRegexBudget {
    /// The most trace steps.
    pub max_steps: usize,
    /// The most label updates over the whole run.
    pub max_updates: usize,
    /// The size (in parts) of the biggest label.
    pub max_nodes: usize,
}

impl Default for FsmToRegexBudget {
    fn default() -> Self {
        FsmToRegexBudget {
            max_steps: 100_000,
            max_updates: 1_000_000,
            max_nodes: 2_000,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Extraction {
    Finished {
        regex: Regex,
        trace: Vec<ConversionStep>,
    },
    Stopped {
        reason: StopReason,
        partial_trace: Vec<ConversionStep>,
    },
}

fn union(a: Regex, b: Regex) -> Regex {
    match (a, b) {
        (Regex::Empty, r) | (r, Regex::Empty) => r,
        (a, b) if a == b => a,
        (a, b) => Regex::Union(Box::new(a), Box::new(b)),
    }
}

fn concat(a: Regex, b: Regex) -> Regex {
    match (a, b) {
        (Regex::Empty, _) | (_, Regex::Empty) => Regex::Empty,
        (Regex::Epsilon, r) | (r, Regex::Epsilon) => r,
        (a, b) => Regex::Concat(Box::new(a), Box::new(b)),
    }
}

fn star(a: Regex) -> Regex {
    match a {
        Regex::Empty | Regex::Epsilon => Regex::Epsilon,
        a => Regex::Star(Box::new(a)),
    }
}

struct Run<'a> {
    fsm: &'a Fsm,
    budget: FsmToRegexBudget,
    trace: Vec<ConversionStep>,
    /// The label of each pair of states; a pair that is missing has the label `∅`.
    table: HashMap<(StateId, StateId), Regex>,
    updates: usize,
}

impl Run<'_> {
    fn push(&mut self, message: Message, change: Change) -> Result<(), StopReason> {
        if self.trace.len() >= self.budget.max_steps {
            return Err(StopReason::MaxSteps);
        }
        self.trace.push(ConversionStep { message, change });
        Ok(())
    }

    fn label(&self, from: StateId, to: StateId, regex: &Regex) -> Label {
        Label {
            from,
            to,
            expression: regex.to_text(&self.fsm.alphabet),
        }
    }

    fn all_labels(&self) -> Vec<Label> {
        let mut pairs: Vec<_> = self.table.iter().collect();
        pairs.sort_by_key(|((from, to), _)| (*from, *to));
        pairs
            .into_iter()
            .map(|((from, to), r)| self.label(*from, *to, r))
            .collect()
    }

    fn finish_with(&mut self, key: &'static str, regex: Regex) -> Result<Regex, StopReason> {
        let expression = regex.to_text(&self.fsm.alphabet);
        let message = Message::new(key).with("expression", expression.as_str());
        self.push(message, Change::Expression { expression })?;
        Ok(regex)
    }

    fn run(&mut self, start: StateId) -> Result<Regex, StopReason> {
        let fsm = self.fsm;

        // Step 1: drop the states that no input can reach.
        let mut reachable = HashSet::from([start]);
        let mut queue = VecDeque::from([start]);
        while let Some(q) = queue.pop_front() {
            for t in fsm.transitions.iter().filter(|t| t.from == q) {
                if reachable.insert(t.to) {
                    queue.push_back(t.to);
                }
            }
        }
        for &q in fsm.states.iter().filter(|q| !reachable.contains(q)) {
            let message = Message::new("fsm_to_regex.remove_unreachable").with("state", q.0);
            self.push(message, Change::RemoveUnreachable { state: q })?;
        }

        // Step 2: no accepting state, no strings.
        let accepting: Vec<StateId> = fsm
            .accepting
            .iter()
            .copied()
            .filter(|q| reachable.contains(q))
            .collect();
        if accepting.is_empty() {
            return self.finish_with("fsm_to_regex.no_accepting", Regex::Empty);
        }

        // Step 6 (done early): one label for each pair of states.
        let mut by_pair: BTreeMap<(StateId, StateId), Vec<Option<SymbolId>>> = BTreeMap::new();
        for t in fsm
            .transitions
            .iter()
            .filter(|t| reachable.contains(&t.from))
        {
            by_pair.entry((t.from, t.to)).or_default().push(t.on);
        }
        for ((from, to), mut symbols) in by_pair {
            symbols.sort_by_key(|s| (s.is_none(), *s)); // ε last
            symbols.dedup();
            let regex = symbols.into_iter().fold(Regex::Empty, |acc, s| {
                union(acc, s.map_or(Regex::Epsilon, Regex::Symbol))
            });
            if regex.size() > self.budget.max_nodes {
                return Err(StopReason::MaxNodes);
            }
            self.table.insert((from, to), regex);
        }

        // Steps 3 and 4: a start state with nothing going in, an accepting state with
        // nothing going out.
        let mut next_id = fsm.states.iter().map(|s| s.0).max().map_or(0, |m| m + 1);
        let mut fresh = || {
            next_id += 1;
            StateId(next_id - 1)
        };
        let mut start = start;
        if self.table.keys().any(|&(_, to)| to == start) {
            let s = fresh();
            self.table.insert((s, start), Regex::Epsilon);
            start = s;
            let message = Message::new("fsm_to_regex.new_start").with("state", s.0);
            self.push(message, Change::Start { state: s })?;
        }
        let single =
            accepting.len() == 1 && !self.table.keys().any(|&(from, _)| from == accepting[0]);
        let accept = if single {
            accepting[0]
        } else {
            let f = fresh();
            for &q in &accepting {
                self.table.insert((q, f), Regex::Epsilon);
            }
            let message = Message::new("fsm_to_regex.new_accepting").with("state", f.0);
            self.push(message, Change::Accepting { state: f })?;
            f
        };

        // Step 5: one state is both the start and the accepting state.
        if start == accept {
            return self.finish_with("fsm_to_regex.only_one_state", Regex::Epsilon);
        }

        let labels = self.all_labels();
        self.push(
            Message::new("fsm_to_regex.table"),
            Change::Labels { labels },
        )?;

        // Step 7: remove the other states, highest number first.
        let mut rest: Vec<StateId> = fsm
            .states
            .iter()
            .copied()
            .filter(|q| reachable.contains(q) && *q != start && *q != accept)
            .collect();
        rest.reverse();
        for rip in rest {
            let looping = star(self.table.get(&(rip, rip)).cloned().unwrap_or(Regex::Empty));
            let mut incoming: Vec<(StateId, Regex)> = Vec::new();
            let mut outgoing: Vec<(StateId, Regex)> = Vec::new();
            for (&(from, to), r) in &self.table {
                if to == rip && from != rip {
                    incoming.push((from, r.clone()));
                } else if from == rip && to != rip {
                    outgoing.push((to, r.clone()));
                }
            }
            incoming.sort_by_key(|(q, _)| *q);
            outgoing.sort_by_key(|(q, _)| *q);

            let mut changed = Vec::new();
            for (p, into) in &incoming {
                for (q, out) in &outgoing {
                    self.updates += 1;
                    if self.updates > self.budget.max_updates {
                        return Err(StopReason::MaxUpdates);
                    }
                    let old = self.table.get(&(*p, *q)).cloned().unwrap_or(Regex::Empty);
                    let through = concat(concat(into.clone(), looping.clone()), out.clone());
                    let new = union(old, through);
                    if new.size() > self.budget.max_nodes {
                        return Err(StopReason::MaxNodes);
                    }
                    changed.push(self.label(*p, *q, &new));
                    self.table.insert((*p, *q), new);
                }
            }
            self.table.retain(|&(from, to), _| from != rip && to != rip);
            changed.sort_by_key(|l| (l.from, l.to));
            let message = Message::new("fsm_to_regex.rip").with("state", rip.0);
            self.push(
                message,
                Change::Rip {
                    state: rip,
                    updates: changed,
                },
            )?;
        }

        // Step 8: the label from the start state to the accepting state.
        let result = self
            .table
            .get(&(start, accept))
            .cloned()
            .unwrap_or(Regex::Empty);
        self.finish_with("fsm_to_regex.result", result)
    }
}

/// Builds a regular expression for the language of `fsm` and records each step. Works for
/// DFSMs and NDFSMs. Returns an error message if the machine has no start state.
pub fn fsm_to_regex(fsm: &Fsm, budget: FsmToRegexBudget) -> Result<Extraction, Message> {
    let start = fsm
        .start
        .ok_or_else(|| Message::new("fsm_to_regex.no_start_state"))?;
    let mut run = Run {
        fsm,
        budget,
        trace: Vec::new(),
        table: HashMap::new(),
        updates: 0,
    };
    Ok(match run.run(start) {
        Ok(regex) => Extraction::Finished {
            regex,
            trace: run.trace,
        },
        Err(reason) => Extraction::Stopped {
            reason,
            partial_trace: run.trace,
        },
    })
}
