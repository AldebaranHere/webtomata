//! AST and evaluator for formal languages and proper-order string enumeration.

mod error;
pub mod parser;
pub use error::LanguageError;
pub use parser::LanguageParser;

use std::cmp::Ordering;
use std::collections::{BTreeSet, HashMap};

/// An atomic expression in the language algebra.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LanguageExpr {
    /// Explicit finite set of words, e.g. {"ab", "aca", "b"}
    FiniteSet(Vec<String>),
    /// Named reference to another language, e.g. "L1"
    Ref(String),
    /// Set union: A ∪ B
    Union(Box<LanguageExpr>, Box<LanguageExpr>),
    /// Set intersection: A ∩ B
    Intersection(Box<LanguageExpr>, Box<LanguageExpr>),
    /// Set difference: A - B
    Difference(Box<LanguageExpr>, Box<LanguageExpr>),
    /// Concatenation: A B
    Concat(Box<LanguageExpr>, Box<LanguageExpr>),
    /// Kleene Star: A*
    Star(Box<LanguageExpr>),
    /// Kleene Plus: A+
    Plus(Box<LanguageExpr>),
    /// Language Reversal: A^R
    Reverse(Box<LanguageExpr>),
    /// Concatenation Power: A^k
    Power(Box<LanguageExpr>, usize),
    /// Predicate: { w ∈ Σ* : Condition(w) }
    PredicateLanguage {
        alphabet: Vec<char>,
        predicate: LanguagePredicate,
    },
}

/// Predicate conditions evaluated on candidate strings.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LanguagePredicate {
    /// Count condition: c_a * #a(w) >= c_b * #b(w) + offset
    CountLinearGte {
        char_a: char,
        coeff_a: usize,
        char_b: char,
        coeff_b: usize,
        offset: usize,
    },
    /// Count condition: c_a * #a(w) <= c_b * #b(w) + offset
    CountLinearLte {
        char_a: char,
        coeff_a: usize,
        char_b: char,
        coeff_b: usize,
        offset: usize,
    },
    /// Count condition: c_a * #a(w) == c_b * #b(w) + offset
    CountEq {
        char_a: char,
        coeff_a: usize,
        char_b: char,
        coeff_b: usize,
        offset: usize,
    },
    /// Modulo condition: #a(w) mod modulus == remainder
    CountMod {
        char_a: char,
        modulus: usize,
        remainder: usize,
    },
    /// String length condition: |w| >= min
    LengthGte(usize),
    /// String length condition: |w| <= max
    LengthLte(usize),
    /// String length condition: |w| == target
    LengthEq(usize),
    /// Reversal palindrome condition: w = w^R
    IsPalindrome,
    /// Substring condition: w contains sub
    ContainsSubstring(String),
    /// Logical negation: ¬P
    Not(Box<LanguagePredicate>),
    /// Universal prefix invariant: ∀v ∈ prefix(w). Condition(v)
    ForallPrefix(Box<LanguagePredicate>),
    /// Universal suffix invariant: ∀v ∈ suffix(w). Condition(v)
    ForallSuffix(Box<LanguagePredicate>),
    /// Conjunction of multiple predicates: P1 ∧ P2
    And(Box<LanguagePredicate>, Box<LanguagePredicate>),
    /// Disjunction of multiple predicates: P1 ∨ P2
    Or(Box<LanguagePredicate>, Box<LanguagePredicate>),
}

/// Maximum starting (and enumerated) string length in characters (ADR 0071).
pub const ENUMERATION_MAX_LENGTH: usize = 200;

/// Yields every valid UTF-8 byte boundary in `w`, from `0` through `w.len()` inclusive.
fn char_boundary_indices(w: &str) -> impl Iterator<Item = usize> + '_ {
    w.char_indices()
        .map(|(i, _)| i)
        .chain(std::iter::once(w.len()))
}

/// Evaluates `coeff_a * #char_a(w)` and `coeff_b * #char_b(w) + offset` in exact `u128` arithmetic.
fn eval_linear_counts(
    w: &str,
    char_a: char,
    coeff_a: usize,
    char_b: char,
    coeff_b: usize,
    offset: usize,
) -> (u128, u128) {
    let to_u128 = |v: usize| u128::try_from(v).unwrap_or(u128::MAX);
    let count_a = to_u128(w.chars().filter(|&c| c == char_a).count());
    let count_b = to_u128(w.chars().filter(|&c| c == char_b).count());
    let lhs = to_u128(coeff_a) * count_a;
    let rhs = to_u128(coeff_b) * count_b + to_u128(offset);
    (lhs, rhs)
}

/// Comparison function for strict proper (length-lexicographical) order.
/// 1. Shorter strings (in Unicode characters) precede longer strings.
/// 2. Equal length strings are sorted lexicographically.
pub fn compare_proper_order(a: &str, b: &str) -> Ordering {
    match a.chars().count().cmp(&b.chars().count()) {
        Ordering::Equal => a.cmp(b),
        other => other,
    }
}

/// Configuration options for string enumeration.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EnumerateOptions {
    /// Minimum string length: |w| >= min_length
    pub min_length: usize,
    /// Maximum number of strings to collect (1 to 100)
    pub max_count: usize,
    /// Maximum search depth/length to prevent infinite loops on empty languages
    pub max_depth: usize,
}

impl Default for EnumerateOptions {
    fn default() -> Self {
        Self {
            min_length: 0,
            max_count: 10,
            max_depth: 30,
        }
    }
}

/// Evaluates language membership and enumerates strings in proper order.
pub struct LanguageEvaluator<'a> {
    env: &'a HashMap<String, LanguageExpr>,
}

impl<'a> LanguageEvaluator<'a> {
    pub fn new(env: &'a HashMap<String, LanguageExpr>) -> Self {
        Self { env }
    }

    /// Tests if candidate string `w` belongs to `expr`.
    pub fn contains(&self, expr: &LanguageExpr, w: &str) -> Result<bool, LanguageError> {
        self.contains_internal(expr, w, &mut Vec::new())
    }

    fn contains_internal(
        &self,
        expr: &LanguageExpr,
        w: &str,
        visited: &mut Vec<String>,
    ) -> Result<bool, LanguageError> {
        match expr {
            LanguageExpr::FiniteSet(words) => Ok(words.iter().any(|item| item == w)),
            LanguageExpr::Ref(name) => {
                if visited.contains(name) {
                    return Err(LanguageError::CyclicReference { name: name.clone() });
                }
                let target = self
                    .env
                    .get(name)
                    .ok_or_else(|| LanguageError::UndefinedReference { name: name.clone() })?;
                visited.push(name.clone());
                let res = self.contains_internal(target, w, visited);
                visited.pop();
                res
            }
            LanguageExpr::Union(a, b) => {
                Ok(self.contains_internal(a, w, visited)?
                    || self.contains_internal(b, w, visited)?)
            }
            LanguageExpr::Intersection(a, b) => {
                Ok(self.contains_internal(a, w, visited)?
                    && self.contains_internal(b, w, visited)?)
            }
            LanguageExpr::Difference(a, b) => {
                Ok(self.contains_internal(a, w, visited)?
                    && !self.contains_internal(b, w, visited)?)
            }
            LanguageExpr::Concat(a, b) => {
                // Check all splits w = u + v on UTF-8 character boundaries
                for i in char_boundary_indices(w) {
                    let u = &w[..i];
                    let v = &w[i..];
                    if self.contains_internal(a, u, visited)?
                        && self.contains_internal(b, v, visited)?
                    {
                        return Ok(true);
                    }
                }
                Ok(false)
            }
            LanguageExpr::Power(a, k) => {
                if *k == 0 {
                    return Ok(w.is_empty());
                }
                if *k == 1 {
                    return self.contains_internal(a, w, visited);
                }
                let bounds: Vec<usize> = char_boundary_indices(w).collect();
                let n = bounds.len() - 1;
                let a_has_empty = self.contains_internal(a, "", visited)?;
                if n == 0 {
                    return Ok(a_has_empty);
                }
                if !a_has_empty && *k > n {
                    return Ok(false);
                }
                // Iterative DP bounded by min(k, n) non-empty pieces (never recurses k times).
                let max_steps = (*k).min(n);
                let mut dp = vec![false; n + 1];
                dp[0] = true;
                for _ in 0..max_steps {
                    let mut next = vec![false; n + 1];
                    for j in 0..n {
                        if !dp[j] {
                            continue;
                        }
                        for i in (j + 1)..=n {
                            if !next[i]
                                && self.contains_internal(a, &w[bounds[j]..bounds[i]], visited)?
                            {
                                next[i] = true;
                            }
                        }
                    }
                    dp = next;
                    if a_has_empty && dp[n] {
                        return Ok(true);
                    }
                    if !dp.iter().any(|&reachable| reachable) {
                        return Ok(false);
                    }
                }
                Ok(dp[n])
            }
            LanguageExpr::Star(a) => {
                if w.is_empty() {
                    return Ok(true);
                }
                // Dynamic programming for Kleene star partition on UTF-8 character boundaries
                let bounds: Vec<usize> = char_boundary_indices(w).collect();
                let n = bounds.len() - 1;
                let mut dp = vec![false; n + 1];
                dp[0] = true;
                for i in 1..=n {
                    for j in 0..i {
                        if dp[j] {
                            let part = &w[bounds[j]..bounds[i]];
                            if !part.is_empty() && self.contains_internal(a, part, visited)? {
                                dp[i] = true;
                                break;
                            }
                        }
                    }
                }
                Ok(dp[n])
            }
            LanguageExpr::Plus(a) => {
                if w.is_empty() {
                    return Ok(false);
                }
                let star = LanguageExpr::Star(a.clone());
                self.contains_internal(&LanguageExpr::Concat(a.clone(), Box::new(star)), w, visited)
            }
            LanguageExpr::Reverse(a) => {
                let rev_w: String = w.chars().rev().collect();
                self.contains_internal(a, &rev_w, visited)
            }
            LanguageExpr::PredicateLanguage {
                alphabet,
                predicate,
            } => {
                // Verify all characters belong to alphabet
                if !w.chars().all(|c| alphabet.contains(&c)) {
                    return Ok(false);
                }
                Ok(self.evaluate_predicate(predicate, w))
            }
        }
    }

    /// Evaluates a predicate condition on string `w`.
    pub fn evaluate_predicate(&self, pred: &LanguagePredicate, w: &str) -> bool {
        match pred {
            LanguagePredicate::CountLinearGte {
                char_a,
                coeff_a,
                char_b,
                coeff_b,
                offset,
            } => {
                let (lhs, rhs) =
                    eval_linear_counts(w, *char_a, *coeff_a, *char_b, *coeff_b, *offset);
                lhs >= rhs
            }
            LanguagePredicate::CountLinearLte {
                char_a,
                coeff_a,
                char_b,
                coeff_b,
                offset,
            } => {
                let (lhs, rhs) =
                    eval_linear_counts(w, *char_a, *coeff_a, *char_b, *coeff_b, *offset);
                lhs <= rhs
            }
            LanguagePredicate::CountEq {
                char_a,
                coeff_a,
                char_b,
                coeff_b,
                offset,
            } => {
                let (lhs, rhs) =
                    eval_linear_counts(w, *char_a, *coeff_a, *char_b, *coeff_b, *offset);
                lhs == rhs
            }
            LanguagePredicate::CountMod {
                char_a,
                modulus,
                remainder,
            } => {
                if *modulus == 0 {
                    return false;
                }
                let count = w.chars().filter(|&c| c == *char_a).count();
                count % modulus == *remainder
            }
            LanguagePredicate::LengthGte(min) => w.chars().count() >= *min,
            LanguagePredicate::LengthLte(max) => w.chars().count() <= *max,
            LanguagePredicate::LengthEq(target) => w.chars().count() == *target,
            LanguagePredicate::IsPalindrome => {
                let rev: String = w.chars().rev().collect();
                w == rev
            }
            LanguagePredicate::ContainsSubstring(sub) => w.contains(sub),
            LanguagePredicate::Not(sub) => !self.evaluate_predicate(sub, w),
            LanguagePredicate::ForallPrefix(sub) => {
                // Check every prefix of w on UTF-8 character boundaries
                for i in char_boundary_indices(w) {
                    let prefix = &w[..i];
                    if !self.evaluate_predicate(sub, prefix) {
                        return false;
                    }
                }
                true
            }
            LanguagePredicate::ForallSuffix(sub) => {
                // Check every suffix of w on UTF-8 character boundaries
                for i in char_boundary_indices(w) {
                    let suffix = &w[i..];
                    if !self.evaluate_predicate(sub, suffix) {
                        return false;
                    }
                }
                true
            }
            LanguagePredicate::And(left, right) => {
                self.evaluate_predicate(left, w) && self.evaluate_predicate(right, w)
            }
            LanguagePredicate::Or(left, right) => {
                self.evaluate_predicate(left, w) || self.evaluate_predicate(right, w)
            }
        }
    }

    /// Gathers all alphabet symbols involved in an expression.
    pub fn infer_alphabet(&self, expr: &LanguageExpr) -> BTreeSet<char> {
        let mut chars = BTreeSet::new();
        self.collect_alphabet(expr, &mut chars, &mut Vec::new());
        chars
    }

    fn collect_alphabet(
        &self,
        expr: &LanguageExpr,
        chars: &mut BTreeSet<char>,
        visited: &mut Vec<String>,
    ) {
        match expr {
            LanguageExpr::FiniteSet(words) => {
                for w in words {
                    for c in w.chars() {
                        chars.insert(c);
                    }
                }
            }
            LanguageExpr::Ref(name) => {
                if visited.contains(name) {
                    return;
                }
                if let Some(target) = self.env.get(name) {
                    visited.push(name.clone());
                    self.collect_alphabet(target, chars, visited);
                    visited.pop();
                }
            }
            LanguageExpr::Union(a, b)
            | LanguageExpr::Intersection(a, b)
            | LanguageExpr::Difference(a, b)
            | LanguageExpr::Concat(a, b) => {
                self.collect_alphabet(a, chars, visited);
                self.collect_alphabet(b, chars, visited);
            }
            LanguageExpr::Star(a) | LanguageExpr::Plus(a) | LanguageExpr::Reverse(a) => {
                self.collect_alphabet(a, chars, visited);
            }
            LanguageExpr::Power(a, _) => {
                self.collect_alphabet(a, chars, visited);
            }
            LanguageExpr::PredicateLanguage { alphabet, .. } => {
                for &c in alphabet {
                    chars.insert(c);
                }
            }
        }
    }

    /// Computes the maximum word length if the language is guaranteed to be finite.
    pub fn max_length(&self, expr: &LanguageExpr) -> Option<usize> {
        self.max_length_internal(expr, &mut Vec::new())
    }

    fn max_length_internal(&self, expr: &LanguageExpr, visited: &mut Vec<String>) -> Option<usize> {
        match expr {
            LanguageExpr::FiniteSet(words) => {
                Some(words.iter().map(|w| w.chars().count()).max().unwrap_or(0))
            }
            LanguageExpr::Ref(name) => {
                if visited.contains(name) {
                    return None;
                }
                if let Some(target) = self.env.get(name) {
                    visited.push(name.clone());
                    let res = self.max_length_internal(target, visited);
                    visited.pop();
                    res
                } else {
                    None
                }
            }
            LanguageExpr::Union(a, b) => match (
                self.max_length_internal(a, visited),
                self.max_length_internal(b, visited),
            ) {
                (Some(la), Some(lb)) => Some(la.max(lb)),
                _ => None,
            },
            LanguageExpr::Intersection(a, b) => match (
                self.max_length_internal(a, visited),
                self.max_length_internal(b, visited),
            ) {
                (Some(la), Some(lb)) => Some(la.min(lb)),
                (Some(la), None) => Some(la),
                (None, Some(lb)) => Some(lb),
                (None, None) => None,
            },
            LanguageExpr::Difference(a, _) => self.max_length_internal(a, visited),
            LanguageExpr::Concat(a, b) => match (
                self.max_length_internal(a, visited),
                self.max_length_internal(b, visited),
            ) {
                (Some(la), Some(lb)) => Some(la.saturating_add(lb)),
                _ => None,
            },
            LanguageExpr::Power(a, k) => self
                .max_length_internal(a, visited)
                .map(|la| la.saturating_mul(*k)),
            LanguageExpr::Reverse(a) => self.max_length_internal(a, visited),
            LanguageExpr::Star(_)
            | LanguageExpr::Plus(_)
            | LanguageExpr::PredicateLanguage { .. } => None,
        }
    }

    /// Computes the minimum possible word length for an expression.
    pub fn min_length(&self, expr: &LanguageExpr) -> usize {
        self.min_length_internal(expr, &mut Vec::new())
    }

    fn min_length_internal(&self, expr: &LanguageExpr, visited: &mut Vec<String>) -> usize {
        match expr {
            LanguageExpr::FiniteSet(words) => {
                if words.is_empty() {
                    0
                } else {
                    words.iter().map(|w| w.chars().count()).min().unwrap_or(0)
                }
            }
            LanguageExpr::Ref(name) => {
                if visited.contains(name) {
                    return 0;
                }
                if let Some(target) = self.env.get(name) {
                    visited.push(name.clone());
                    let res = self.min_length_internal(target, visited);
                    visited.pop();
                    res
                } else {
                    0
                }
            }
            LanguageExpr::Union(a, b) => {
                let la = self.min_length_internal(a, visited);
                let lb = self.min_length_internal(b, visited);
                la.min(lb)
            }
            LanguageExpr::Intersection(a, b) => {
                let la = self.min_length_internal(a, visited);
                let lb = self.min_length_internal(b, visited);
                la.max(lb)
            }
            LanguageExpr::Difference(a, _) => self.min_length_internal(a, visited),
            LanguageExpr::Concat(a, b) => {
                let la = self.min_length_internal(a, visited);
                let lb = self.min_length_internal(b, visited);
                la.saturating_add(lb)
            }
            LanguageExpr::Power(a, k) => {
                let la = self.min_length_internal(a, visited);
                la.saturating_mul(*k)
            }
            LanguageExpr::Reverse(a) => self.min_length_internal(a, visited),
            LanguageExpr::Star(_) => 0,
            LanguageExpr::Plus(a) => self.min_length_internal(a, visited),
            LanguageExpr::PredicateLanguage { predicate, .. } => {
                self.min_length_predicate(predicate)
            }
        }
    }

    fn min_length_predicate(&self, pred: &LanguagePredicate) -> usize {
        match pred {
            LanguagePredicate::LengthGte(m) | LanguagePredicate::LengthEq(m) => *m,
            LanguagePredicate::And(a, b) => self
                .min_length_predicate(a)
                .max(self.min_length_predicate(b)),
            LanguagePredicate::Or(a, b) => self
                .min_length_predicate(a)
                .min(self.min_length_predicate(b)),
            _ => 0,
        }
    }

    /// Determines if words can be generated constructively rather than brute-forcing candidates.
    pub fn can_generate(&self, expr: &LanguageExpr) -> bool {
        self.can_generate_internal(expr, &mut Vec::new())
    }

    fn can_generate_internal(&self, expr: &LanguageExpr, visited: &mut Vec<String>) -> bool {
        match expr {
            LanguageExpr::FiniteSet(_) => true,
            LanguageExpr::Ref(name) => {
                if visited.contains(name) {
                    return false;
                }
                if let Some(target) = self.env.get(name) {
                    visited.push(name.clone());
                    let res = self.can_generate_internal(target, visited);
                    visited.pop();
                    res
                } else {
                    false
                }
            }
            LanguageExpr::Reverse(a)
            | LanguageExpr::Power(a, _)
            | LanguageExpr::Star(a)
            | LanguageExpr::Plus(a) => self.can_generate_internal(a, visited),
            LanguageExpr::Concat(a, b) | LanguageExpr::Union(a, b) => {
                self.can_generate_internal(a, visited) && self.can_generate_internal(b, visited)
            }
            LanguageExpr::Difference(a, _) => self.can_generate_internal(a, visited),
            LanguageExpr::Intersection(a, b) => {
                self.can_generate_internal(a, visited) || self.can_generate_internal(b, visited)
            }
            LanguageExpr::PredicateLanguage { .. } => false,
        }
    }

    /// Generates words of an exact `target_len` constructively.
    pub fn generate_words_for_length(
        &self,
        expr: &LanguageExpr,
        target_len: usize,
    ) -> Result<BTreeSet<String>, LanguageError> {
        let mut visited = Vec::new();
        self.generate_words_internal(expr, target_len, &mut visited)
    }

    fn generate_words_internal(
        &self,
        expr: &LanguageExpr,
        target_len: usize,
        visited: &mut Vec<String>,
    ) -> Result<BTreeSet<String>, LanguageError> {
        let mut results = BTreeSet::new();
        match expr {
            LanguageExpr::FiniteSet(words) => {
                for w in words {
                    if w.chars().count() == target_len {
                        results.insert(w.clone());
                    }
                }
            }
            LanguageExpr::Ref(name) => {
                if visited.contains(name) {
                    return Err(LanguageError::CyclicReference { name: name.clone() });
                }
                let target = self
                    .env
                    .get(name)
                    .ok_or_else(|| LanguageError::UndefinedReference { name: name.clone() })?;
                visited.push(name.clone());
                let res = self.generate_words_internal(target, target_len, visited);
                visited.pop();
                return res;
            }
            LanguageExpr::Reverse(a) => {
                let inner = self.generate_words_internal(a, target_len, visited)?;
                for w in inner {
                    results.insert(w.chars().rev().collect());
                }
            }
            LanguageExpr::Union(a, b) => {
                let set_a = self.generate_words_internal(a, target_len, visited)?;
                let set_b = self.generate_words_internal(b, target_len, visited)?;
                results.extend(set_a);
                results.extend(set_b);
            }
            LanguageExpr::Intersection(a, b) => {
                if self.can_generate_internal(a, visited) {
                    let set_a = self.generate_words_internal(a, target_len, visited)?;
                    for w in set_a {
                        if self.contains_internal(b, &w, visited)? {
                            results.insert(w);
                        }
                    }
                } else {
                    let set_b = self.generate_words_internal(b, target_len, visited)?;
                    for w in set_b {
                        if self.contains_internal(a, &w, visited)? {
                            results.insert(w);
                        }
                    }
                }
            }
            LanguageExpr::Difference(a, b) => {
                let set_a = self.generate_words_internal(a, target_len, visited)?;
                for w in set_a {
                    if !self.contains_internal(b, &w, visited)? {
                        results.insert(w);
                    }
                }
            }
            LanguageExpr::Concat(a, b) => {
                for i in 0..=target_len {
                    let set_a = self.generate_words_internal(a, i, visited)?;
                    if set_a.is_empty() {
                        continue;
                    }
                    let set_b = self.generate_words_internal(b, target_len - i, visited)?;
                    if set_b.is_empty() {
                        continue;
                    }
                    for u in &set_a {
                        for v in &set_b {
                            let mut combined = String::with_capacity(u.len() + v.len());
                            combined.push_str(u);
                            combined.push_str(v);
                            results.insert(combined);
                        }
                    }
                }
            }
            LanguageExpr::Power(a, k) => {
                if *k == 0 {
                    if target_len == 0 {
                        results.insert(String::new());
                    }
                } else if *k == 1 {
                    return self.generate_words_internal(a, target_len, visited);
                } else {
                    let a_has_empty = !self.generate_words_internal(a, 0, visited)?.is_empty();
                    if target_len == 0 {
                        if a_has_empty {
                            results.insert(String::new());
                        }
                        return Ok(results);
                    }
                    if !a_has_empty && *k > target_len {
                        return Ok(results);
                    }
                    // Iterative DP bounded by min(k, target_len) non-empty pieces.
                    let max_steps = (*k).min(target_len);
                    let max_piece_len = if a_has_empty {
                        target_len
                    } else {
                        target_len - (*k - 1)
                    };
                    let mut non_empty = vec![BTreeSet::new(); max_piece_len + 1];
                    for (len, slot) in non_empty.iter_mut().enumerate().skip(1) {
                        *slot = self.generate_words_internal(a, len, visited)?;
                    }
                    let mut current_sets = vec![BTreeSet::new(); target_len + 1];
                    current_sets[0].insert(String::new());
                    for _ in 0..max_steps {
                        let mut next_sets = vec![BTreeSet::new(); target_len + 1];
                        for (prev_len, prefixes) in current_sets.iter().enumerate() {
                            if prefixes.is_empty() || prev_len >= target_len {
                                continue;
                            }
                            let max_add = (target_len - prev_len).min(max_piece_len);
                            for (piece_len, pieces) in
                                non_empty.iter().enumerate().take(max_add + 1).skip(1)
                            {
                                if pieces.is_empty() {
                                    continue;
                                }
                                let dest = &mut next_sets[prev_len + piece_len];
                                for u in prefixes {
                                    for v in pieces {
                                        let mut combined = String::with_capacity(u.len() + v.len());
                                        combined.push_str(u);
                                        combined.push_str(v);
                                        dest.insert(combined);
                                    }
                                }
                            }
                        }
                        current_sets = next_sets;
                        if a_has_empty {
                            results.extend(current_sets[target_len].iter().cloned());
                        }
                        if current_sets.iter().all(BTreeSet::is_empty) {
                            break;
                        }
                    }
                    if !a_has_empty {
                        results = current_sets.pop().unwrap_or_default();
                    }
                }
            }
            LanguageExpr::Star(a) => {
                if target_len == 0 {
                    results.insert(String::new());
                } else {
                    for i in 1..=target_len {
                        let set_a = self.generate_words_internal(a, i, visited)?;
                        if set_a.is_empty() {
                            continue;
                        }
                        let set_star =
                            self.generate_words_internal(expr, target_len - i, visited)?;
                        if set_star.is_empty() {
                            continue;
                        }
                        for u in &set_a {
                            for v in &set_star {
                                let mut combined = String::with_capacity(u.len() + v.len());
                                combined.push_str(u);
                                combined.push_str(v);
                                results.insert(combined);
                            }
                        }
                    }
                }
            }
            LanguageExpr::Plus(a) => {
                let star = LanguageExpr::Star(a.clone());
                return self.generate_words_internal(
                    &LanguageExpr::Concat(a.clone(), Box::new(star)),
                    target_len,
                    visited,
                );
            }
            LanguageExpr::PredicateLanguage { .. } => {}
        }
        Ok(results)
    }

    /// Enumerates strings in strict proper order (|w| >= min_length, up to max_count).
    pub fn enumerate(
        &self,
        expr: &LanguageExpr,
        options: EnumerateOptions,
    ) -> Result<Vec<String>, LanguageError> {
        let alphabet = self.infer_alphabet(expr);
        let alphabet_vec: Vec<char> = alphabet.into_iter().collect();

        let expr_min = self.min_length(expr);
        let start_len = options.min_length.max(expr_min);
        if start_len > ENUMERATION_MAX_LENGTH {
            return Err(LanguageError::LengthTooLarge {
                limit: ENUMERATION_MAX_LENGTH,
            });
        }

        let max_bound = self.max_length(expr);
        let end_len = match max_bound {
            Some(bound) => {
                if start_len > bound {
                    return Ok(Vec::new());
                }
                bound.min(start_len.saturating_add(options.max_depth))
            }
            None => start_len.saturating_add(options.max_depth),
        }
        .min(ENUMERATION_MAX_LENGTH);

        let mut results = Vec::new();

        if self.can_generate(expr) {
            for len in start_len..=end_len {
                let words_set = self.generate_words_for_length(expr, len)?;
                for w in words_set {
                    results.push(w);
                    if results.len() >= options.max_count {
                        return Ok(results);
                    }
                }
            }
            return Ok(results);
        }

        // If alphabet is empty and expr accepts empty string
        if alphabet_vec.is_empty() {
            if options.min_length == 0 && self.contains(expr, "")? {
                return Ok(vec![String::new()]);
            }
            return Ok(Vec::new());
        }

        let mut budget = 50_000usize; // candidate inspection budget

        for len in start_len..=end_len {
            let mut current = String::with_capacity(len);
            self.generate_and_test(
                &alphabet_vec,
                len,
                0,
                &mut current,
                expr,
                &mut results,
                options.max_count,
                &mut budget,
            )?;
            if results.len() >= options.max_count || budget == 0 {
                break;
            }
        }

        Ok(results)
    }

    #[allow(clippy::too_many_arguments)]
    fn generate_and_test(
        &self,
        alphabet: &[char],
        target_len: usize,
        depth: usize,
        current: &mut String,
        expr: &LanguageExpr,
        results: &mut Vec<String>,
        max_count: usize,
        budget: &mut usize,
    ) -> Result<(), LanguageError> {
        if *budget == 0 || results.len() >= max_count {
            return Ok(());
        }
        if depth == target_len {
            *budget = budget.saturating_sub(1);
            if self.contains(expr, current)? {
                results.push(current.clone());
            }
            return Ok(());
        }
        for &c in alphabet {
            current.push(c);
            self.generate_and_test(
                alphabet,
                target_len,
                depth + 1,
                current,
                expr,
                results,
                max_count,
                budget,
            )?;
            current.pop();
            if *budget == 0 || results.len() >= max_count {
                break;
            }
        }
        Ok(())
    }
}
