//! Simplifying a regular expression with the identities of Rich's section 6.4 ("Manipulating
//! and Simplifying Regular Expressions"). Every step is one rewrite that makes the expression
//! smaller, so the process always ends. Union and concatenation are associative, so a rule
//! looks at all the parts of a union (or of a concatenation), not only at two neighbours.
//!
//! Rules, with the key of the message:
//! - union: `∅ ∪ α = α` (`union_empty`), `α ∪ α = α` (`union_idempotent`), `α ∪ β = α` if
//!   L(β) ⊆ L(α) (`union_subset`), and `αγ ∪ αδ = α(γ ∪ δ)` or `γα ∪ δα = (γ ∪ δ)α`
//!   (`union_factor_left`, `union_factor_right`; concatenation distributes over union, used in
//!   the direction that makes the expression smaller);
//!   and `γ ∪ α+γ = α*γ` or `γ ∪ γα+ = γα*`, where γ may be `ε` (`union_plus_absorb`);
//! - concatenation: `∅α = ∅` (`concat_empty`), `εα = α` (`concat_epsilon`), and a run of parts
//!   next to a star of the same run: `αα* = α+` or `α*α = α+` (`concat_star_plus`);
//! - star: `∅* = ε` (`star_empty`), `ε* = ε` (`star_epsilon`), `(α*)* = α*` (`star_star`),
//!   `(α+)* = α*` (`star_plus`), `α*α* = α*` (`star_repeat`), `α*β* = β*` if L(α*) ⊆ L(β*) and
//!   `α*β* = α*` if L(β*) ⊆ L(α*) (`concat_star_subset`), `(α ∪ β)* = α*` if L(β) ⊆ L(α*)
//!   (`star_union_subset`);
//! - plus: `(α*)+ = α*` (`plus_star`), `∅+ = ∅` (`plus_empty`), `ε+ = ε` (`plus_epsilon`).
//!
//! A rule with "if L(β) ⊆ L(α)" depends on the meaning of the parts. The engine decides it with
//! its own machines: it builds the machines for `α ∪ β` and for `α` and compares them with
//! `equivalent`. If that check is too big to decide, the rule is not used. This is always safe.
//!
//! The search is leftmost and innermost: the parts of an expression are tried before the
//! expression itself, from left to right. Each step holds the whole expression after the
//! rewrite (`Change::Expression`) and a message with the parts before and after.

use crate::equivalence::{Equivalence, EquivalenceBudget, equivalent};
use crate::fsm::{Alphabet, Fsm};
use crate::message::Message;
use crate::regex::Regex;
use crate::regex_fsm::{Compiled, RegexBudget, regex_to_fsm};
use crate::stop::StopReason;
use crate::trace::{Change, ConversionStep};
use serde::Deserialize;
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct SimplifyBudget {
    /// The most trace steps.
    pub max_steps: usize,
    /// The most checks of the form "is L(β) ⊆ L(α)?". A repeated question counts once.
    pub max_checks: usize,
}

impl Default for SimplifyBudget {
    fn default() -> Self {
        SimplifyBudget {
            max_steps: 10_000,
            max_checks: 5_000,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Simplification {
    Finished {
        regex: Regex,
        trace: Vec<ConversionStep>,
    },
    Stopped {
        reason: StopReason,
        partial_trace: Vec<ConversionStep>,
    },
}

enum Halt {
    Stop(StopReason),
    Error(Message),
}

impl From<Message> for Halt {
    fn from(m: Message) -> Self {
        Halt::Error(m)
    }
}

/// The new expression for the part that was looked at, and the message for the step.
type Rewrite = (Regex, Message);
type Join = fn(Box<Regex>, Box<Regex>) -> Regex;

fn bx(r: Regex) -> Box<Regex> {
    Box::new(r)
}

fn union_members(r: &Regex) -> Vec<Regex> {
    match r {
        Regex::Union(a, b) => {
            let mut all = union_members(a);
            all.extend(union_members(b));
            all
        }
        other => vec![other.clone()],
    }
}

fn concat_members(r: &Regex) -> Vec<Regex> {
    match r {
        Regex::Concat(a, b) => {
            let mut all = concat_members(a);
            all.extend(concat_members(b));
            all
        }
        other => vec![other.clone()],
    }
}

/// Joins the parts from left to right. There is at least one part.
fn fold(parts: Vec<Regex>, join: Join) -> Regex {
    let mut parts = parts.into_iter();
    let first = parts.next().unwrap_or(Regex::Empty);
    parts.fold(first, |left, right| join(bx(left), bx(right)))
}

fn without(parts: &[Regex], skip: usize) -> Vec<Regex> {
    let mut rest = parts.to_vec();
    rest.remove(skip);
    rest
}

/// The parts of a member of a union that `plus_absorb` compares: a concatenation is its parts and `ε`
/// is none.
fn rest_members(r: &Regex) -> Vec<Regex> {
    if *r == Regex::Epsilon {
        Vec::new()
    } else {
        concat_members(r)
    }
}

/// The concatenation of the parts, or `ε` for none.
fn join_parts(parts: Vec<Regex>) -> Regex {
    if parts.is_empty() {
        Regex::Epsilon
    } else {
        fold(parts, Regex::Concat)
    }
}

/// `γ ∪ α+γ = α*γ` and `γ ∪ γα+ = γα*`: when `y` is `γ` with a plus in front of it (or behind it), the union
/// of `x = γ` and `y` is the star of that plus with `γ`. Returns the new `x`, the plus, and `γ`.
fn plus_absorb(x: &Regex, y: &Regex) -> Option<(Regex, Regex, Vec<Regex>)> {
    let rest = rest_members(x);
    let parts = concat_members(y);
    if let Some(Regex::Plus(body)) = parts.first()
        && parts[1..] == rest[..]
    {
        let mut all = vec![Regex::Star(body.clone())];
        all.extend(rest.clone());
        return Some((join_parts(all), parts[0].clone(), rest));
    }
    let last = parts.len() - 1;
    if let Some(Regex::Plus(body)) = parts.last()
        && parts[..last] == rest[..]
    {
        let mut all = rest.clone();
        all.push(Regex::Star(body.clone()));
        return Some((join_parts(all), parts[last].clone(), rest));
    }
    None
}

fn check_symbols(r: &Regex, alphabet: &Alphabet) -> Result<(), Message> {
    match r {
        Regex::Symbol(id) if alphabet.name(*id).is_none() => {
            Err(Message::new("simplify.unknown_symbol").with("symbol", u32::from(id.0)))
        }
        Regex::Union(a, b) | Regex::Concat(a, b) => {
            check_symbols(a, alphabet)?;
            check_symbols(b, alphabet)
        }
        Regex::Star(a) | Regex::Plus(a) => check_symbols(a, alphabet),
        _ => Ok(()),
    }
}

struct Run<'a> {
    alphabet: &'a Alphabet,
    budget: SimplifyBudget,
    checks: usize,
    /// Answers to "is L(small) ⊆ L(big)?", by the text of the two expressions.
    known: HashMap<(String, String), bool>,
}

impl Run<'_> {
    fn text(&self, r: &Regex) -> String {
        r.to_text(self.alphabet)
    }

    fn message(&self, rule: &'static str, before: &Regex, after: &Regex) -> Message {
        Message::new(rule)
            .with("before", self.text(before))
            .with("after", self.text(after))
    }

    /// A rewrite that drops `removed` and keeps `kept`.
    fn absorb(
        &self,
        rule: &'static str,
        before: &Regex,
        after: Regex,
        kept: &Regex,
        removed: &Regex,
    ) -> Rewrite {
        let message = self
            .message(rule, before, &after)
            .with("kept", self.text(kept))
            .with("removed", self.text(removed));
        (after, message)
    }

    fn compile(&self, r: &Regex) -> Result<Option<Fsm>, Message> {
        Ok(
            match regex_to_fsm(r, self.alphabet, RegexBudget::default())? {
                Compiled::Finished { fsm, .. } => Some(fsm),
                Compiled::Stopped { .. } => None,
            },
        )
    }

    /// Is L(small) ⊆ L(big)? This holds when `small ∪ big` and `big` have the same language.
    fn included(&mut self, small: &Regex, big: &Regex) -> Result<bool, Halt> {
        if small == big || *small == Regex::Empty {
            return Ok(true);
        }
        let key = (self.text(small), self.text(big));
        if let Some(&answer) = self.known.get(&key) {
            return Ok(answer);
        }
        if self.checks >= self.budget.max_checks {
            return Err(Halt::Stop(StopReason::MaxChecks));
        }
        self.checks += 1;
        let both = Regex::Union(bx(small.clone()), bx(big.clone()));
        let answer = match (self.compile(&both)?, self.compile(big)?) {
            (Some(a), Some(b)) => matches!(
                equivalent(&a, &b, EquivalenceBudget::default())?,
                Equivalence::Equivalent { .. }
            ),
            _ => false,
        };
        self.known.insert(key, answer);
        Ok(answer)
    }

    /// The first rewrite in `r`, parts before the whole, left to right.
    fn step(&mut self, r: &Regex) -> Result<Option<Rewrite>, Halt> {
        match r {
            Regex::Union(..) => {
                let parts = union_members(r);
                if let Some(done) = self.inside(&parts, Regex::Union)? {
                    return Ok(Some(done));
                }
                self.union_rule(r, &parts)
            }
            Regex::Concat(..) => {
                let parts = concat_members(r);
                if let Some(done) = self.inside(&parts, Regex::Concat)? {
                    return Ok(Some(done));
                }
                self.concat_rule(r, &parts)
            }
            Regex::Star(x) => {
                if let Some((new, message)) = self.step(x)? {
                    return Ok(Some((Regex::Star(bx(new)), message)));
                }
                self.star_rule(r, x)
            }
            Regex::Plus(x) => {
                if let Some((new, message)) = self.step(x)? {
                    return Ok(Some((Regex::Plus(bx(new)), message)));
                }
                Ok(self.plus_rule(r, x))
            }
            _ => Ok(None),
        }
    }

    /// A rewrite inside one part of a union or a concatenation.
    fn inside(&mut self, parts: &[Regex], join: Join) -> Result<Option<Rewrite>, Halt> {
        for (k, part) in parts.iter().enumerate() {
            if let Some((new, message)) = self.step(part)? {
                let mut all = parts.to_vec();
                all[k] = new;
                return Ok(Some((fold(all, join), message)));
            }
        }
        Ok(None)
    }

    fn union_rule(&mut self, r: &Regex, parts: &[Regex]) -> Result<Option<Rewrite>, Halt> {
        let n = parts.len();
        if let Some(i) = parts.iter().position(|p| *p == Regex::Empty) {
            let after = fold(without(parts, i), Regex::Union);
            let message = self.message("simplify.union_empty", r, &after);
            return Ok(Some((after, message)));
        }
        for i in 0..n {
            for j in i + 1..n {
                if parts[i] == parts[j] {
                    let after = fold(without(parts, j), Regex::Union);
                    return Ok(Some(self.absorb(
                        "simplify.union_idempotent",
                        r,
                        after,
                        &parts[i],
                        &parts[j],
                    )));
                }
            }
        }
        for i in 0..n {
            for j in 0..n {
                if i == j {
                    continue;
                }
                if let Some((new, plus, rest)) = plus_absorb(&parts[i], &parts[j]) {
                    let mut all = parts.to_vec();
                    all[i] = new;
                    all.remove(j);
                    let after = fold(all, Regex::Union);
                    let message = self
                        .message("simplify.union_plus_absorb", r, &after)
                        .with("plus", self.text(&plus))
                        .with("rest", self.text(&join_parts(rest)));
                    return Ok(Some((after, message)));
                }
            }
        }
        for i in 0..n {
            for j in 0..n {
                if i != j && self.included(&parts[j], &parts[i])? {
                    let after = fold(without(parts, j), Regex::Union);
                    return Ok(Some(self.absorb(
                        "simplify.union_subset",
                        r,
                        after,
                        &parts[i],
                        &parts[j],
                    )));
                }
            }
        }
        for i in 0..n {
            for j in i + 1..n {
                if let Some((merged, factor)) = factor(&parts[i], &parts[j]) {
                    let mut all = parts.to_vec();
                    all[i] = merged;
                    all.remove(j);
                    let after = fold(all, Regex::Union);
                    let rule = factor.rule;
                    let message = self
                        .message(rule, r, &after)
                        .with("factor", self.text(&factor.part));
                    return Ok(Some((after, message)));
                }
            }
        }
        Ok(None)
    }

    fn concat_rule(&mut self, r: &Regex, parts: &[Regex]) -> Result<Option<Rewrite>, Halt> {
        if parts.contains(&Regex::Empty) {
            let message = self.message("simplify.concat_empty", r, &Regex::Empty);
            return Ok(Some((Regex::Empty, message)));
        }
        if let Some(i) = parts.iter().position(|p| *p == Regex::Epsilon) {
            let after = fold(without(parts, i), Regex::Concat);
            let message = self.message("simplify.concat_epsilon", r, &after);
            return Ok(Some((after, message)));
        }
        for (i, part) in parts.iter().enumerate() {
            let Regex::Star(body) = part else {
                continue;
            };
            let run = concat_members(body);
            let k = run.len();
            // The run is just before the star (αα*), or just after it (α*α).
            let from = if i >= k && parts[i - k..i] == run[..] {
                i - k
            } else if i + k < parts.len() && parts[i + 1..=i + k] == run[..] {
                i
            } else {
                continue;
            };
            let mut all = parts[..from].to_vec();
            all.push(Regex::Plus(body.clone()));
            all.extend_from_slice(&parts[from + k + 1..]);
            let after = fold(all, Regex::Concat);
            let message = self
                .message("simplify.concat_star_plus", r, &after)
                .with("body", self.text(body));
            return Ok(Some((after, message)));
        }
        for i in 0..parts.len().saturating_sub(1) {
            let (Regex::Star(x), Regex::Star(y)) = (&parts[i], &parts[i + 1]) else {
                continue;
            };
            let (rule, drop) = if x == y {
                ("simplify.star_repeat", i + 1)
            } else if self.included(&parts[i], &parts[i + 1])? {
                ("simplify.concat_star_subset", i)
            } else if self.included(&parts[i + 1], &parts[i])? {
                ("simplify.concat_star_subset", i + 1)
            } else {
                continue;
            };
            let kept = if drop == i { i + 1 } else { i };
            let after = fold(without(parts, drop), Regex::Concat);
            return Ok(Some(self.absorb(
                rule,
                r,
                after,
                &parts[kept],
                &parts[drop],
            )));
        }
        Ok(None)
    }

    fn star_rule(&mut self, r: &Regex, x: &Regex) -> Result<Option<Rewrite>, Halt> {
        let simple = match x {
            Regex::Empty => Some(("simplify.star_empty", Regex::Epsilon)),
            Regex::Epsilon => Some(("simplify.star_epsilon", Regex::Epsilon)),
            Regex::Star(_) => Some(("simplify.star_star", x.clone())),
            Regex::Plus(y) => Some(("simplify.star_plus", Regex::Star(y.clone()))),
            _ => None,
        };
        if let Some((rule, after)) = simple {
            let message = self.message(rule, r, &after);
            return Ok(Some((after, message)));
        }
        if let Regex::Union(..) = x {
            let parts = union_members(x);
            for i in 0..parts.len() {
                let big = Regex::Star(bx(parts[i].clone()));
                for j in 0..parts.len() {
                    if i != j && self.included(&parts[j], &big)? {
                        let after = Regex::Star(bx(fold(without(&parts, j), Regex::Union)));
                        return Ok(Some(self.absorb(
                            "simplify.star_union_subset",
                            r,
                            after,
                            &parts[i],
                            &parts[j],
                        )));
                    }
                }
            }
        }
        Ok(None)
    }

    fn plus_rule(&self, r: &Regex, x: &Regex) -> Option<Rewrite> {
        let (rule, after) = match x {
            Regex::Star(_) => ("simplify.plus_star", x.clone()),
            Regex::Empty => ("simplify.plus_empty", Regex::Empty),
            Regex::Epsilon => ("simplify.plus_epsilon", Regex::Epsilon),
            _ => return None,
        };
        let message = self.message(rule, r, &after);
        Some((after, message))
    }
}

/// The rule and the common part of two concatenations that share their first or last part.
struct Common {
    rule: &'static str,
    part: Regex,
}

/// `αγ ∪ αδ` becomes `α(γ ∪ δ)`, and `γα ∪ δα` becomes `(γ ∪ δ)α`. Both must be
/// concatenations; the result is then smaller by at least the size of `α`.
fn factor(a: &Regex, b: &Regex) -> Option<(Regex, Common)> {
    if !matches!((a, b), (Regex::Concat(..), Regex::Concat(..))) {
        return None;
    }
    let (pa, pb) = (concat_members(a), concat_members(b));
    if pa[0] == pb[0] {
        let rest = Regex::Union(
            bx(fold(pa[1..].to_vec(), Regex::Concat)),
            bx(fold(pb[1..].to_vec(), Regex::Concat)),
        );
        let merged = Regex::Concat(bx(pa[0].clone()), bx(rest));
        let common = Common {
            rule: "simplify.union_factor_left",
            part: pa[0].clone(),
        };
        return Some((merged, common));
    }
    let (la, lb) = (pa.len() - 1, pb.len() - 1);
    if pa[la] == pb[lb] {
        let rest = Regex::Union(
            bx(fold(pa[..la].to_vec(), Regex::Concat)),
            bx(fold(pb[..lb].to_vec(), Regex::Concat)),
        );
        let merged = Regex::Concat(bx(rest), bx(pa[la].clone()));
        let common = Common {
            rule: "simplify.union_factor_right",
            part: pa[la].clone(),
        };
        return Some((merged, common));
    }
    None
}

/// Rewrites `regex` into a shorter one with the same language, one identity at a time. Returns
/// an error message if a symbol of the expression is not in the alphabet.
pub fn simplify(
    regex: &Regex,
    alphabet: &Alphabet,
    budget: SimplifyBudget,
) -> Result<Simplification, Message> {
    check_symbols(regex, alphabet)?;
    let mut run = Run {
        alphabet,
        budget,
        checks: 0,
        known: HashMap::new(),
    };
    let mut current = regex.clone();
    let mut trace = Vec::new();
    loop {
        match run.step(&current) {
            Err(Halt::Error(message)) => return Err(message),
            Err(Halt::Stop(reason)) => {
                return Ok(Simplification::Stopped {
                    reason,
                    partial_trace: trace,
                });
            }
            Ok(None) => {
                return Ok(Simplification::Finished {
                    regex: current,
                    trace,
                });
            }
            Ok(Some((whole, message))) => {
                if trace.len() >= budget.max_steps {
                    return Ok(Simplification::Stopped {
                        reason: StopReason::MaxSteps,
                        partial_trace: trace,
                    });
                }
                trace.push(ConversionStep {
                    message,
                    change: Change::Expression {
                        expression: run.text(&whole),
                    },
                });
                current = whole;
            }
        }
    }
}
