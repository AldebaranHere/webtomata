//! AST and evaluator for formal languages and proper-order string enumeration.

pub mod parser;
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

/// Comparison function for strict proper (length-lexicographical) order.
/// 1. Shorter strings precede longer strings.
/// 2. Equal length strings are sorted alphabetically.
pub fn compare_proper_order(a: &str, b: &str) -> Ordering {
    match a.len().cmp(&b.len()) {
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

/// Errors that can occur during language parsing or evaluation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LanguageError {
    UndefinedReference(String),
    CyclicReference(String),
    InvalidSyntax(String),
    DepthExceeded,
}

impl std::fmt::Display for LanguageError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::UndefinedReference(name) => write!(f, "Bahasa '{name}' belum didefinisikan"),
            Self::CyclicReference(name) => write!(f, "Referensi siklik terdeteksi pada '{name}'"),
            Self::InvalidSyntax(msg) => write!(f, "Sintaks tidak valid: {msg}"),
            Self::DepthExceeded => write!(f, "Batas pencarian tercapai"),
        }
    }
}

impl std::error::Error for LanguageError {}

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
                    return Err(LanguageError::CyclicReference(name.clone()));
                }
                let target = self
                    .env
                    .get(name)
                    .ok_or_else(|| LanguageError::UndefinedReference(name.clone()))?;
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
                // Check all splits w = u + v
                for i in 0..=w.len() {
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
                // Reduce to Concat(a, Power(a, k - 1))
                let sub = LanguageExpr::Power(a.clone(), k - 1);
                self.contains_internal(&LanguageExpr::Concat(a.clone(), Box::new(sub)), w, visited)
            }
            LanguageExpr::Star(a) => {
                if w.is_empty() {
                    return Ok(true);
                }
                // Dynamic programming for Kleene star partition
                let n = w.len();
                let mut dp = vec![false; n + 1];
                dp[0] = true;
                for i in 1..=n {
                    for j in 0..i {
                        if dp[j] {
                            let part = &w[j..i];
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
                let count_a = w.chars().filter(|&c| c == *char_a).count();
                let count_b = w.chars().filter(|&c| c == *char_b).count();
                coeff_a * count_a >= coeff_b * count_b + offset
            }
            LanguagePredicate::CountLinearLte {
                char_a,
                coeff_a,
                char_b,
                coeff_b,
                offset,
            } => {
                let count_a = w.chars().filter(|&c| c == *char_a).count();
                let count_b = w.chars().filter(|&c| c == *char_b).count();
                coeff_a * count_a <= coeff_b * count_b + offset
            }
            LanguagePredicate::CountEq {
                char_a,
                coeff_a,
                char_b,
                coeff_b,
                offset,
            } => {
                let count_a = w.chars().filter(|&c| c == *char_a).count();
                let count_b = w.chars().filter(|&c| c == *char_b).count();
                coeff_a * count_a == coeff_b * count_b + offset
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
            LanguagePredicate::LengthGte(min) => w.len() >= *min,
            LanguagePredicate::LengthLte(max) => w.len() <= *max,
            LanguagePredicate::LengthEq(target) => w.len() == *target,
            LanguagePredicate::IsPalindrome => {
                let rev: String = w.chars().rev().collect();
                w == rev
            }
            LanguagePredicate::ContainsSubstring(sub) => w.contains(sub),
            LanguagePredicate::Not(sub) => !self.evaluate_predicate(sub, w),
            LanguagePredicate::ForallPrefix(sub) => {
                // Check every prefix of w, from length 0 to w.len()
                for i in 0..=w.len() {
                    let prefix = &w[..i];
                    if !self.evaluate_predicate(sub, prefix) {
                        return false;
                    }
                }
                true
            }
            LanguagePredicate::ForallSuffix(sub) => {
                // Check every suffix of w, from length 0 to w.len()
                for i in 0..=w.len() {
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
                Some(words.iter().map(|w| w.len()).max().unwrap_or(0))
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
                    words.iter().map(|w| w.len()).min().unwrap_or(0)
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
                    if w.len() == target_len {
                        results.insert(w.clone());
                    }
                }
            }
            LanguageExpr::Ref(name) => {
                if visited.contains(name) {
                    return Err(LanguageError::CyclicReference(name.clone()));
                }
                let target = self
                    .env
                    .get(name)
                    .ok_or_else(|| LanguageError::UndefinedReference(name.clone()))?;
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
                    let sub = LanguageExpr::Power(a.clone(), k - 1);
                    return self.generate_words_internal(
                        &LanguageExpr::Concat(a.clone(), Box::new(sub)),
                        target_len,
                        visited,
                    );
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

        let max_bound = self.max_length(expr);
        let end_len = match max_bound {
            Some(bound) => {
                if start_len > bound {
                    return Ok(Vec::new());
                }
                bound.min(start_len.saturating_add(options.max_depth))
            }
            None => start_len.saturating_add(options.max_depth),
        };

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
        current: &mut String,
        expr: &LanguageExpr,
        results: &mut Vec<String>,
        max_count: usize,
        budget: &mut usize,
    ) -> Result<(), LanguageError> {
        if *budget == 0 || results.len() >= max_count {
            return Ok(());
        }
        if current.len() == target_len {
            *budget = budget.saturating_sub(1);
            if self.contains(expr, current)? {
                results.push(current.clone());
            }
            return Ok(());
        }
        for &c in alphabet {
            current.push(c);
            self.generate_and_test(
                alphabet, target_len, current, expr, results, max_count, budget,
            )?;
            current.pop();
            if *budget == 0 || results.len() >= max_count {
                break;
            }
        }
        Ok(())
    }
}
