//! Parser for language expressions.
//! Supports:
//! - Finite sets: {ab, aca, b}, {ε}, {^}
//! - Set operators: ∪ (UNION), ∩ (INTERSECT), - (MINUS), ⊕ (XOR)
//! - Postfix operators: *, +, ^R, ^k
//! - Grouping: (A - B)*
//! - Identifiers: L1, L2, etc.
//! - Predicate set-builder: { w in {a, b}* : #a(w) mod 3 = 0 }

use super::{LanguageError, LanguageExpr, LanguagePredicate};

pub struct LanguageParser<'a> {
    input: &'a str,
    pos: usize,
}

/// A relation operator of a predicate. The list is closed, so matching it is exhaustive: the old
/// `_ =>` error arms for an unknown operator could never be reached by any input.
#[derive(Clone, Copy, PartialEq, Eq)]
enum RelOp {
    Gte,
    Gt,
    Lte,
    Lt,
    Eq,
}

impl<'a> LanguageParser<'a> {
    pub fn parse(input: &'a str) -> Result<LanguageExpr, LanguageError> {
        let mut parser = Self { input, pos: 0 };
        let expr = parser.parse_union_difference()?;
        parser.skip_whitespace();
        if parser.pos < parser.input.len() {
            return Err(LanguageError::UnexpectedCharacter {
                position: parser.pos,
                rest: parser.input[parser.pos..].to_string(),
            });
        }
        Ok(expr)
    }

    fn skip_whitespace(&mut self) {
        while let Some(ch) = self.peek_char() {
            if ch.is_whitespace() {
                self.pos += ch.len_utf8();
            } else {
                break;
            }
        }
    }

    fn peek_char(&self) -> Option<char> {
        if self.pos >= self.input.len() {
            None
        } else {
            self.input[self.pos..].chars().next()
        }
    }

    fn parse_union_difference(&mut self) -> Result<LanguageExpr, LanguageError> {
        let mut left = self.parse_intersection()?;
        loop {
            self.skip_whitespace();
            if self.starts_with("∪") || self.starts_with_ci("UNION") || self.starts_with("\\cup")
            {
                if self.starts_with("∪") {
                    self.pos += '∪'.len_utf8();
                } else if self.starts_with_ci("UNION") {
                    self.pos += 5;
                } else {
                    self.pos += 5; // \cup
                }
                let right = self.parse_intersection()?;
                left = LanguageExpr::Union(Box::new(left), Box::new(right));
            } else if self.starts_with("⊕") || self.starts_with_ci("XOR") {
                if self.starts_with("⊕") {
                    self.pos += '⊕'.len_utf8();
                } else {
                    self.pos += 3;
                }
                let right = self.parse_intersection()?;
                let diff_ab =
                    LanguageExpr::Difference(Box::new(left.clone()), Box::new(right.clone()));
                let diff_ba = LanguageExpr::Difference(Box::new(right), Box::new(left));
                left = LanguageExpr::Union(Box::new(diff_ab), Box::new(diff_ba));
            } else if self.starts_with("-")
                || self.starts_with("–")
                || self.starts_with("—")
                || self.starts_with("\\")
                || self.starts_with_ci("MINUS")
            {
                if self.starts_with("-") {
                    self.pos += 1;
                } else if self.starts_with("–") {
                    self.pos += '–'.len_utf8();
                } else if self.starts_with("—") {
                    self.pos += '—'.len_utf8();
                } else if self.starts_with("\\") {
                    self.pos += 1;
                } else {
                    self.pos += 5;
                }
                let right = self.parse_intersection()?;
                left = LanguageExpr::Difference(Box::new(left), Box::new(right));
            } else {
                break;
            }
        }
        Ok(left)
    }

    fn parse_intersection(&mut self) -> Result<LanguageExpr, LanguageError> {
        let mut left = self.parse_concat()?;
        loop {
            self.skip_whitespace();
            if self.starts_with("∩")
                || self.starts_with_ci("INTERSECT")
                || self.starts_with("\\cap")
            {
                if self.starts_with("∩") {
                    self.pos += '∩'.len_utf8();
                } else if self.starts_with_ci("INTERSECT") {
                    self.pos += 9;
                } else {
                    self.pos += 5; // \cap
                }
                let right = self.parse_concat()?;
                left = LanguageExpr::Intersection(Box::new(left), Box::new(right));
            } else {
                break;
            }
        }
        Ok(left)
    }

    fn parse_concat(&mut self) -> Result<LanguageExpr, LanguageError> {
        let mut left = self.parse_postfix()?;
        loop {
            self.skip_whitespace();
            // Check if next token can be a primary expression (starts concatenation)
            if self.can_start_primary() {
                let right = self.parse_postfix()?;
                left = LanguageExpr::Concat(Box::new(left), Box::new(right));
            } else {
                break;
            }
        }
        Ok(left)
    }

    fn can_start_primary(&self) -> bool {
        if let Some(ch) = self.peek_char() {
            ch == '{'
                || ch == '('
                || ch.is_alphanumeric()
                    && !self.starts_with("∪")
                    && !self.starts_with_ci("UNION")
                    && !self.starts_with("∩")
                    && !self.starts_with_ci("INTERSECT")
                    && !self.starts_with("⊕")
                    && !self.starts_with_ci("XOR")
        } else {
            false
        }
    }

    fn parse_postfix(&mut self) -> Result<LanguageExpr, LanguageError> {
        let mut expr = self.parse_primary()?;
        loop {
            self.skip_whitespace();
            if self.starts_with("*") {
                self.pos += 1;
                expr = LanguageExpr::Star(Box::new(expr));
            } else if self.starts_with("+") {
                self.pos += 1;
                expr = LanguageExpr::Plus(Box::new(expr));
            } else if self.starts_with("^R") || self.starts_with("^r") || self.starts_with("ᴿ") {
                if self.starts_with("ᴿ") {
                    self.pos += 'ᴿ'.len_utf8();
                } else {
                    self.pos += 2;
                }
                expr = LanguageExpr::Reverse(Box::new(expr));
            } else if self.starts_with("^") {
                // Exponent power: e.g. ^2, ^3
                self.pos += 1;
                let power_val = self.parse_number()?;
                expr = LanguageExpr::Power(Box::new(expr), power_val);
            } else {
                break;
            }
        }
        Ok(expr)
    }

    fn parse_number(&mut self) -> Result<usize, LanguageError> {
        self.skip_whitespace();
        let start = self.pos;
        while let Some(ch) = self.peek_char() {
            if ch.is_ascii_digit() {
                self.pos += 1;
            } else {
                break;
            }
        }
        if start == self.pos {
            return Err(LanguageError::ExpectedPowerNumber);
        }
        // Only `PosOverflow` is possible here: the scan above accepted at least one and only ASCII
        // digits, so `Empty` and `InvalidDigit` cannot happen, and `usize` has no sign, so
        // `NegOverflow` cannot either. The limit is 64-bit natively and 32-bit in the WASM build.
        self.input[start..self.pos]
            .parse::<usize>()
            .map_err(|_| LanguageError::NumberTooLarge)
    }

    fn parse_primary(&mut self) -> Result<LanguageExpr, LanguageError> {
        self.skip_whitespace();
        if self.starts_with("{") {
            self.parse_set()
        } else if self.starts_with("(") {
            self.pos += 1;
            let inner = self.parse_union_difference()?;
            self.skip_whitespace();
            if !self.starts_with(")") {
                return Err(LanguageError::UnclosedParenthesis);
            }
            self.pos += 1;
            Ok(inner)
        } else if let Some(ch) = self.peek_char() {
            if ch.is_alphabetic() {
                self.parse_identifier()
            } else {
                Err(LanguageError::UnexpectedSymbol { symbol: ch })
            }
        } else {
            Err(LanguageError::UnexpectedEnd)
        }
    }

    fn parse_identifier(&mut self) -> Result<LanguageExpr, LanguageError> {
        let start = self.pos;
        let mut seen_digits = false;
        while let Some(ch) = self.peek_char() {
            if ch.is_ascii_digit() {
                seen_digits = true;
                self.pos += ch.len_utf8();
            } else if ch.is_alphabetic() {
                // If we already saw digits (e.g. L15), another letter (e.g. L in L15L1)
                // indicates juxtaposition concatenation of adjacent identifiers.
                if seen_digits {
                    break;
                }
                self.pos += ch.len_utf8();
            } else if ch == '_' {
                if seen_digits {
                    break;
                }
                self.pos += ch.len_utf8();
            } else {
                break;
            }
        }
        let name = self.input[start..self.pos].to_string();
        Ok(LanguageExpr::Ref(name))
    }

    fn parse_set(&mut self) -> Result<LanguageExpr, LanguageError> {
        let checkpoint = self.pos;
        self.pos += 1; // skip '{'
        self.skip_whitespace();

        // Check if this is a set-builder notation: { w in {a, b}* : ... }
        if let Some(pred_expr) = self.try_parse_set_builder()? {
            return Ok(pred_expr);
        }

        // Backtrack and parse as finite set of words
        self.pos = checkpoint + 1;
        let mut words = Vec::new();
        self.skip_whitespace();

        if self.starts_with("}") {
            self.pos += 1;
            return Ok(LanguageExpr::FiniteSet(words));
        }

        loop {
            self.skip_whitespace();
            let mut word = String::new();
            while let Some(ch) = self.peek_char() {
                if ch == ',' || ch == '}' || ch.is_whitespace() {
                    break;
                }
                // Handle empty string notation: ε or ^
                if ch == 'ε' || ch == '^' {
                    self.pos += ch.len_utf8();
                    break;
                }
                word.push(ch);
                self.pos += ch.len_utf8();
            }

            words.push(word);
            self.skip_whitespace();

            if self.starts_with(",") {
                self.pos += 1;
                continue;
            } else if self.starts_with("}") {
                self.pos += 1;
                break;
            } else {
                return Err(LanguageError::ExpectedCommaOrBrace);
            }
        }

        Ok(LanguageExpr::FiniteSet(words))
    }

    /// Tries to read a set-builder. `Ok(None)` means "not a set-builder": the caller backtracks
    /// and reads the braces as a finite set of words. `Err(NumberTooLarge)` propagates out so an
    /// overflowing bound or offset is reported instead of falling back to a syntax error.
    fn try_parse_set_builder(&mut self) -> Result<Option<LanguageExpr>, LanguageError> {
        let start_pos = self.pos;
        self.skip_whitespace();

        // Must read variable name, e.g. "w" or "v"
        let var_start = self.pos;
        while let Some(ch) = self.peek_char() {
            if ch.is_alphanumeric() || ch == '_' {
                self.pos += ch.len_utf8();
            } else {
                break;
            }
        }
        if var_start == self.pos {
            self.pos = start_pos;
            return Ok(None);
        }

        self.skip_whitespace();
        let mut alphabet = vec!['a', 'b'];

        // Optional membership: "in", "∈", "\in"
        if self.starts_with("∈") || self.starts_with_ci("in") || self.starts_with("\\in") {
            if self.starts_with("∈") {
                self.pos += '∈'.len_utf8();
            } else if self.starts_with_ci("in") {
                self.pos += 2;
            } else {
                self.pos += 3;
            }
            self.skip_whitespace();

            // Alphabet set: e.g. {a, b}*
            if self.starts_with("{") {
                self.pos += 1;
                let mut custom_alpha = Vec::new();
                while let Some(ch) = self.peek_char() {
                    if ch == '}' {
                        self.pos += 1;
                        break;
                    }
                    if ch != ',' && !ch.is_whitespace() {
                        custom_alpha.push(ch);
                    }
                    self.pos += ch.len_utf8();
                }
                if !custom_alpha.is_empty() {
                    alphabet = custom_alpha;
                }
                self.skip_whitespace();
                if self.starts_with("*") {
                    self.pos += 1;
                }
            }
        }

        self.skip_whitespace();
        // Expect delimiter ':' or '|'
        if self.starts_with(":") || self.starts_with("|") {
            self.pos += 1;
        } else {
            self.pos = start_pos;
            return Ok(None);
        }

        // Parse predicate expression
        let Some(predicate) = self.parse_pred_or()? else {
            self.pos = start_pos;
            return Ok(None);
        };

        self.skip_whitespace();
        if !self.starts_with("}") {
            self.pos = start_pos;
            return Ok(None);
        }
        self.pos += 1;

        Ok(Some(LanguageExpr::PredicateLanguage {
            alphabet,
            predicate,
        }))
    }

    fn parse_pred_number(&mut self) -> Result<Option<usize>, LanguageError> {
        match self.parse_number() {
            Ok(n) => Ok(Some(n)),
            Err(LanguageError::ExpectedPowerNumber) => Ok(None),
            Err(err) => Err(err),
        }
    }

    fn parse_pred_or(&mut self) -> Result<Option<LanguagePredicate>, LanguageError> {
        let Some(mut left) = self.parse_pred_and()? else {
            return Ok(None);
        };
        loop {
            self.skip_whitespace();
            if self.starts_with("∨") || self.starts_with_ci("OR") || self.starts_with("||") {
                if self.starts_with("∨") {
                    self.pos += '∨'.len_utf8();
                } else {
                    self.pos += 2; // "OR" or "||"
                }
                let Some(right) = self.parse_pred_and()? else {
                    return Ok(None);
                };
                left = LanguagePredicate::Or(Box::new(left), Box::new(right));
            } else {
                break;
            }
        }
        Ok(Some(left))
    }

    fn parse_pred_and(&mut self) -> Result<Option<LanguagePredicate>, LanguageError> {
        let Some(mut left) = self.parse_pred_unary()? else {
            return Ok(None);
        };
        loop {
            self.skip_whitespace();
            if self.starts_with("∧")
                || self.starts_with_ci("AND")
                || self.starts_with("&&")
                || self.starts_with(",")
            {
                if self.starts_with("∧") {
                    self.pos += '∧'.len_utf8();
                } else if self.starts_with_ci("AND") {
                    self.pos += 3;
                } else if self.starts_with("&&") {
                    self.pos += 2;
                } else {
                    self.pos += 1; // ','
                }
                let Some(right) = self.parse_pred_unary()? else {
                    return Ok(None);
                };
                left = LanguagePredicate::And(Box::new(left), Box::new(right));
            } else {
                break;
            }
        }
        Ok(Some(left))
    }

    fn parse_pred_unary(&mut self) -> Result<Option<LanguagePredicate>, LanguageError> {
        self.skip_whitespace();
        if self.starts_with("¬") || self.starts_with("!") || self.starts_with_ci("NOT") {
            if self.starts_with("¬") {
                self.pos += '¬'.len_utf8();
            } else if self.starts_with("!") {
                self.pos += 1;
            } else {
                self.pos += 3;
            }
            let Some(inner) = self.parse_pred_unary()? else {
                return Ok(None);
            };
            Ok(Some(LanguagePredicate::Not(Box::new(inner))))
        } else {
            self.parse_pred_atom()
        }
    }

    fn parse_pred_atom(&mut self) -> Result<Option<LanguagePredicate>, LanguageError> {
        self.skip_whitespace();
        if self.starts_with("(") {
            self.pos += 1;
            let Some(inner) = self.parse_pred_or()? else {
                return Ok(None);
            };
            self.skip_whitespace();
            if !self.starts_with(")") {
                return Ok(None);
            }
            self.pos += 1;
            return Ok(Some(inner));
        }

        // Universal prefix or suffix: ∀v ∈ prefix(w) / forall v in prefix(w)
        if self.starts_with("∀") || self.starts_with_ci("forall") {
            if self.starts_with("∀") {
                self.pos += '∀'.len_utf8();
            } else {
                self.pos += 6;
            }
            self.skip_whitespace();
            // Variable name: v
            while let Some(ch) = self.peek_char() {
                if ch.is_alphabetic() {
                    self.pos += ch.len_utf8();
                } else {
                    break;
                }
            }
            self.skip_whitespace();
            if self.starts_with("∈") || self.starts_with_ci("in") || self.starts_with("\\in") {
                if self.starts_with("∈") {
                    self.pos += '∈'.len_utf8();
                } else if self.starts_with_ci("in") {
                    self.pos += 2;
                } else {
                    self.pos += 3;
                }
            }
            self.skip_whitespace();

            let is_prefix = if self.starts_with_ci("prefix") {
                self.pos += 6;
                true
            } else if self.starts_with_ci("suffix") {
                self.pos += 6;
                false
            } else {
                return Ok(None);
            };

            // Optional (w)
            self.skip_whitespace();
            if self.starts_with("(") {
                while let Some(ch) = self.peek_char() {
                    self.pos += ch.len_utf8();
                    if ch == ')' {
                        break;
                    }
                }
            }

            self.skip_whitespace();
            if self.starts_with(".") || self.starts_with(":") {
                self.pos += 1;
            }

            let Some(sub) = self.parse_pred_atom()? else {
                return Ok(None);
            };
            if is_prefix {
                return Ok(Some(LanguagePredicate::ForallPrefix(Box::new(sub))));
            } else {
                return Ok(Some(LanguagePredicate::ForallSuffix(Box::new(sub))));
            }
        }

        // Palindrome condition: w = w^R or w = wR
        if self.starts_with("w = w^R")
            || self.starts_with("w == w^R")
            || self.starts_with("w = wR")
            || self.starts_with("w == wR")
            || self.starts_with("w = wᴿ")
        {
            while let Some(ch) = self.peek_char() {
                if ch == 'R' || ch == 'r' || ch == 'ᴿ' {
                    self.pos += ch.len_utf8();
                    break;
                }
                self.pos += ch.len_utf8();
            }
            return Ok(Some(LanguagePredicate::IsPalindrome));
        }

        // Length condition: |w| >= N, |w| <= N, |w| == N
        if self.starts_with("|") {
            self.pos += 1;
            while let Some(ch) = self.peek_char() {
                if ch == '|' {
                    self.pos += 1;
                    break;
                }
                self.pos += ch.len_utf8();
            }
            self.skip_whitespace();
            let Some((op, num)) = self.parse_cmp_and_num()? else {
                return Ok(None);
            };
            let pred = match op {
                RelOp::Gte => LanguagePredicate::LengthGte(num),
                RelOp::Gt => LanguagePredicate::LengthGte(
                    num.checked_add(1).ok_or(LanguageError::NumberTooLarge)?,
                ),
                RelOp::Lte => LanguagePredicate::LengthLte(num),
                RelOp::Lt => LanguagePredicate::LengthLte(num.saturating_sub(1)),
                RelOp::Eq => LanguagePredicate::LengthEq(num),
            };
            return Ok(Some(pred));
        }

        // Count condition: e.g. 3#a(w) >= 6#b(w) + 1 or #a(w) mod 3 = 0
        let coeff_a = if let Some(ch) = self.peek_char() {
            if ch.is_ascii_digit() {
                let Some(n) = self.parse_pred_number()? else {
                    return Ok(None);
                };
                n
            } else {
                1
            }
        } else {
            1
        };

        self.skip_whitespace();
        if self.starts_with("*") {
            self.pos += 1;
            self.skip_whitespace();
        }

        if !self.starts_with("#") {
            return Ok(None);
        }
        self.pos += 1; // skip '#'

        let Some(char_a) = self.peek_char() else {
            return Ok(None);
        };
        self.pos += char_a.len_utf8();

        self.skip_whitespace();
        // Optional (w) or (v)
        if self.starts_with("(") {
            while let Some(ch) = self.peek_char() {
                self.pos += ch.len_utf8();
                if ch == ')' {
                    break;
                }
            }
        }

        self.skip_whitespace();
        // Modulo check: #a(w) mod 3 = 0 or #a(w) % 3 == 0
        if self.starts_with_ci("mod") || self.starts_with("%") {
            if self.starts_with_ci("mod") {
                self.pos += 3;
            } else {
                self.pos += 1;
            }
            let Some(modulus) = self.parse_pred_number()? else {
                return Ok(None);
            };
            self.skip_whitespace();
            if self.starts_with("==") || self.starts_with("=") {
                if self.starts_with("==") {
                    self.pos += 2;
                } else {
                    self.pos += 1;
                }
            }
            let Some(remainder) = self.parse_pred_number()? else {
                return Ok(None);
            };
            return Ok(Some(LanguagePredicate::CountMod {
                char_a,
                modulus,
                remainder,
            }));
        }

        // Comparison operator
        let Some(op) = self.parse_relational_op() else {
            return Ok(None);
        };
        self.skip_whitespace();

        // Right hand side: could be coeff_b * #b(w) + offset OR a constant integer
        if let Some(ch) = self.peek_char() {
            if ch.is_ascii_digit() {
                let Some(num) = self.parse_pred_number()? else {
                    return Ok(None);
                };
                self.skip_whitespace();
                if self.starts_with("*") {
                    self.pos += 1;
                    self.skip_whitespace();
                }
                if self.starts_with("#") {
                    // It was coeff_b * #char_b
                    self.pos += 1;
                    let Some(char_b) = self.peek_char() else {
                        return Ok(None);
                    };
                    self.pos += char_b.len_utf8();
                    self.skip_parens_if_any();
                    let Some(offset) = self.parse_optional_offset()? else {
                        return Ok(None);
                    };
                    return Ok(Some(
                        self.make_count_pred(op, char_a, coeff_a, char_b, num, offset)?,
                    ));
                } else {
                    // It was a constant number!
                    return Ok(Some(
                        self.make_count_pred(op, char_a, coeff_a, '_', 0, num)?,
                    ));
                }
            } else if self.starts_with("#") {
                self.pos += 1;
                let Some(char_b) = self.peek_char() else {
                    return Ok(None);
                };
                self.pos += char_b.len_utf8();
                self.skip_parens_if_any();
                let Some(offset) = self.parse_optional_offset()? else {
                    return Ok(None);
                };
                return Ok(Some(
                    self.make_count_pred(op, char_a, coeff_a, char_b, 1, offset)?,
                ));
            }
        }

        Ok(None)
    }

    fn skip_parens_if_any(&mut self) {
        self.skip_whitespace();
        if self.starts_with("(") {
            while let Some(ch) = self.peek_char() {
                self.pos += ch.len_utf8();
                if ch == ')' {
                    break;
                }
            }
        }
    }

    fn parse_optional_offset(&mut self) -> Result<Option<usize>, LanguageError> {
        self.skip_whitespace();
        if self.starts_with("+") {
            self.pos += 1;
            self.parse_pred_number()
        } else {
            Ok(Some(0))
        }
    }

    fn parse_relational_op(&mut self) -> Option<RelOp> {
        self.skip_whitespace();
        let ops = [
            (">=", RelOp::Gte),
            ("≥", RelOp::Gte),
            ("<=", RelOp::Lte),
            ("≤", RelOp::Lte),
            ("==", RelOp::Eq),
            ("=", RelOp::Eq),
            (">", RelOp::Gt),
            ("<", RelOp::Lt),
        ];
        for (text, op) in ops {
            if self.starts_with(text) {
                self.pos += text.len();
                return Some(op);
            }
        }
        None
    }

    fn parse_cmp_and_num(&mut self) -> Result<Option<(RelOp, usize)>, LanguageError> {
        let Some(op) = self.parse_relational_op() else {
            return Ok(None);
        };
        let Some(num) = self.parse_pred_number()? else {
            return Ok(None);
        };
        Ok(Some((op, num)))
    }

    fn make_count_pred(
        &self,
        op: RelOp,
        char_a: char,
        coeff_a: usize,
        char_b: char,
        coeff_b: usize,
        offset: usize,
    ) -> Result<LanguagePredicate, LanguageError> {
        Ok(match op {
            RelOp::Gte => LanguagePredicate::CountLinearGte {
                char_a,
                coeff_a,
                char_b,
                coeff_b,
                offset,
            },
            RelOp::Gt => LanguagePredicate::CountLinearGte {
                char_a,
                coeff_a,
                char_b,
                coeff_b,
                offset: offset.checked_add(1).ok_or(LanguageError::NumberTooLarge)?,
            },
            RelOp::Lte => LanguagePredicate::CountLinearLte {
                char_a,
                coeff_a,
                char_b,
                coeff_b,
                offset,
            },
            RelOp::Lt => LanguagePredicate::CountLinearLte {
                char_a,
                coeff_a,
                char_b,
                coeff_b,
                offset: offset.saturating_sub(1),
            },
            RelOp::Eq => LanguagePredicate::CountEq {
                char_a,
                coeff_a,
                char_b,
                coeff_b,
                offset,
            },
        })
    }

    fn starts_with(&self, prefix: &str) -> bool {
        self.input[self.pos..].starts_with(prefix)
    }

    fn starts_with_ci(&self, prefix: &str) -> bool {
        self.input[self.pos..]
            .get(..prefix.len())
            .is_some_and(|s| s.eq_ignore_ascii_case(prefix))
    }
}
