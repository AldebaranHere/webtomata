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

impl<'a> LanguageParser<'a> {
    pub fn parse(input: &'a str) -> Result<LanguageExpr, LanguageError> {
        let mut parser = Self { input, pos: 0 };
        let expr = parser.parse_union_difference()?;
        parser.skip_whitespace();
        if parser.pos < parser.input.len() {
            return Err(LanguageError::InvalidSyntax(format!(
                "Karakter tak terduga pada posisi {}: '{}'",
                parser.pos,
                &parser.input[parser.pos..]
            )));
        }
        Ok(expr)
    }

    fn skip_whitespace(&mut self) {
        while self.pos < self.input.len() {
            let ch = self.input[self.pos..].chars().next().unwrap();
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
            return Err(LanguageError::InvalidSyntax(
                "Diharapkan angka setelah operator pangkat/koefisien".to_string(),
            ));
        }
        self.input[start..self.pos]
            .parse::<usize>()
            .map_err(|e| LanguageError::InvalidSyntax(e.to_string()))
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
                return Err(LanguageError::InvalidSyntax(
                    "Kurung buka '(' tidak memiliki pasangan ')'".to_string(),
                ));
            }
            self.pos += 1;
            Ok(inner)
        } else if let Some(ch) = self.peek_char() {
            if ch.is_alphabetic() {
                self.parse_identifier()
            } else {
                Err(LanguageError::InvalidSyntax(format!(
                    "Simbol tak terduga: '{ch}'"
                )))
            }
        } else {
            Err(LanguageError::InvalidSyntax(
                "Ekspresi berakhir tiba-tiba".to_string(),
            ))
        }
    }

    fn parse_identifier(&mut self) -> Result<LanguageExpr, LanguageError> {
        let start = self.pos;
        while let Some(ch) = self.peek_char() {
            if ch.is_alphanumeric() || ch == '_' {
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
        if let Ok(pred_expr) = self.try_parse_set_builder() {
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
                return Err(LanguageError::InvalidSyntax(
                    "Diharapkan ',' atau '}' dalam himpunan kata".to_string(),
                ));
            }
        }

        Ok(LanguageExpr::FiniteSet(words))
    }

    fn try_parse_set_builder(&mut self) -> Result<LanguageExpr, LanguageError> {
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
            return Err(LanguageError::InvalidSyntax("Bukan predikat".into()));
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
            return Err(LanguageError::InvalidSyntax(
                "Diharapkan ':' atau '|'".into(),
            ));
        }

        // Parse predicate expression
        let predicate = self.parse_pred_or()?;

        self.skip_whitespace();
        if !self.starts_with("}") {
            self.pos = start_pos;
            return Err(LanguageError::InvalidSyntax("Diharapkan '}'".into()));
        }
        self.pos += 1;

        Ok(LanguageExpr::PredicateLanguage {
            alphabet,
            predicate,
        })
    }

    fn parse_pred_or(&mut self) -> Result<LanguagePredicate, LanguageError> {
        let mut left = self.parse_pred_and()?;
        loop {
            self.skip_whitespace();
            if self.starts_with("∨") || self.starts_with_ci("OR") || self.starts_with("||") {
                if self.starts_with("∨") {
                    self.pos += '∨'.len_utf8();
                } else {
                    self.pos += 2; // "OR" or "||"
                }
                let right = self.parse_pred_and()?;
                left = LanguagePredicate::Or(Box::new(left), Box::new(right));
            } else {
                break;
            }
        }
        Ok(left)
    }

    fn parse_pred_and(&mut self) -> Result<LanguagePredicate, LanguageError> {
        let mut left = self.parse_pred_unary()?;
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
                let right = self.parse_pred_unary()?;
                left = LanguagePredicate::And(Box::new(left), Box::new(right));
            } else {
                break;
            }
        }
        Ok(left)
    }

    fn parse_pred_unary(&mut self) -> Result<LanguagePredicate, LanguageError> {
        self.skip_whitespace();
        if self.starts_with("¬") || self.starts_with("!") || self.starts_with_ci("NOT") {
            if self.starts_with("¬") {
                self.pos += '¬'.len_utf8();
            } else if self.starts_with("!") {
                self.pos += 1;
            } else {
                self.pos += 3;
            }
            let inner = self.parse_pred_unary()?;
            Ok(LanguagePredicate::Not(Box::new(inner)))
        } else {
            self.parse_pred_atom()
        }
    }

    fn parse_pred_atom(&mut self) -> Result<LanguagePredicate, LanguageError> {
        self.skip_whitespace();
        if self.starts_with("(") {
            self.pos += 1;
            let inner = self.parse_pred_or()?;
            self.skip_whitespace();
            if !self.starts_with(")") {
                return Err(LanguageError::InvalidSyntax(
                    "Kurung buka '(' tidak memiliki pasangan ')'".into(),
                ));
            }
            self.pos += 1;
            return Ok(inner);
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
                return Err(LanguageError::InvalidSyntax(
                    "Diharapkan 'prefix(w)' atau 'suffix(w)'".into(),
                ));
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

            let sub = self.parse_pred_atom()?;
            if is_prefix {
                return Ok(LanguagePredicate::ForallPrefix(Box::new(sub)));
            } else {
                return Ok(LanguagePredicate::ForallSuffix(Box::new(sub)));
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
            return Ok(LanguagePredicate::IsPalindrome);
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
            let (op, num) = self.parse_cmp_and_num()?;
            return match op.as_str() {
                ">=" | "≥" => Ok(LanguagePredicate::LengthGte(num)),
                ">" => Ok(LanguagePredicate::LengthGte(num + 1)),
                "<=" | "≤" => Ok(LanguagePredicate::LengthLte(num)),
                "<" => Ok(LanguagePredicate::LengthLte(if num > 0 {
                    num - 1
                } else {
                    0
                })),
                "==" | "=" => Ok(LanguagePredicate::LengthEq(num)),
                _ => Err(LanguageError::InvalidSyntax(format!(
                    "Operator relasi tidak dikenal: '{op}'"
                ))),
            };
        }

        // Count condition: e.g. 3#a(w) >= 6#b(w) + 1 or #a(w) mod 3 = 0
        let coeff_a = if let Some(ch) = self.peek_char() {
            if ch.is_ascii_digit() {
                self.parse_number()?
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
            return Err(LanguageError::InvalidSyntax(format!(
                "Diharapkan '#' pada posisi {}: '{}'",
                self.pos,
                &self.input[self.pos..]
            )));
        }
        self.pos += 1; // skip '#'

        let char_a = self.peek_char().ok_or_else(|| {
            LanguageError::InvalidSyntax("Diharapkan karakter setelah '#'".into())
        })?;
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
            let modulus = self.parse_number()?;
            self.skip_whitespace();
            if self.starts_with("==") || self.starts_with("=") {
                if self.starts_with("==") {
                    self.pos += 2;
                } else {
                    self.pos += 1;
                }
            }
            let remainder = self.parse_number()?;
            return Ok(LanguagePredicate::CountMod {
                char_a,
                modulus,
                remainder,
            });
        }

        // Comparison operator
        let op = self.parse_relational_op()?;
        self.skip_whitespace();

        // Right hand side: could be coeff_b * #b(w) + offset OR a constant integer
        if let Some(ch) = self.peek_char() {
            if ch.is_ascii_digit() {
                let num = self.parse_number()?;
                self.skip_whitespace();
                if self.starts_with("*") {
                    self.pos += 1;
                    self.skip_whitespace();
                }
                if self.starts_with("#") {
                    // It was coeff_b * #char_b
                    self.pos += 1;
                    let char_b = self.peek_char().ok_or_else(|| {
                        LanguageError::InvalidSyntax("Diharapkan karakter setelah '#'".into())
                    })?;
                    self.pos += char_b.len_utf8();
                    self.skip_parens_if_any();
                    let offset = self.parse_optional_offset()?;
                    return self.make_count_pred(&op, char_a, coeff_a, char_b, num, offset);
                } else {
                    // It was a constant number!
                    return self.make_count_pred(&op, char_a, coeff_a, '_', 0, num);
                }
            } else if self.starts_with("#") {
                self.pos += 1;
                let char_b = self.peek_char().ok_or_else(|| {
                    LanguageError::InvalidSyntax("Diharapkan karakter setelah '#'".into())
                })?;
                self.pos += char_b.len_utf8();
                self.skip_parens_if_any();
                let offset = self.parse_optional_offset()?;
                return self.make_count_pred(&op, char_a, coeff_a, char_b, 1, offset);
            }
        }

        Err(LanguageError::InvalidSyntax(
            "Sintaks predikat hitungan tidak lengkap".into(),
        ))
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

    fn parse_optional_offset(&mut self) -> Result<usize, LanguageError> {
        self.skip_whitespace();
        if self.starts_with("+") {
            self.pos += 1;
            self.parse_number()
        } else {
            Ok(0)
        }
    }

    fn parse_relational_op(&mut self) -> Result<String, LanguageError> {
        self.skip_whitespace();
        let ops = [">=", "≥", "<=", "≤", "==", "=", ">", "<"];
        for &op in &ops {
            if self.starts_with(op) {
                self.pos += op.len();
                return Ok(op.to_string());
            }
        }
        Err(LanguageError::InvalidSyntax(
            "Diharapkan operator relasi (>=, <=, ==, =, >, <)".into(),
        ))
    }

    fn parse_cmp_and_num(&mut self) -> Result<(String, usize), LanguageError> {
        let op = self.parse_relational_op()?;
        let num = self.parse_number()?;
        Ok((op, num))
    }

    fn make_count_pred(
        &self,
        op: &str,
        char_a: char,
        coeff_a: usize,
        char_b: char,
        coeff_b: usize,
        offset: usize,
    ) -> Result<LanguagePredicate, LanguageError> {
        match op {
            ">=" | "≥" => Ok(LanguagePredicate::CountLinearGte {
                char_a,
                coeff_a,
                char_b,
                coeff_b,
                offset,
            }),
            ">" => Ok(LanguagePredicate::CountLinearGte {
                char_a,
                coeff_a,
                char_b,
                coeff_b,
                offset: offset + 1,
            }),
            "<=" | "≤" => Ok(LanguagePredicate::CountLinearLte {
                char_a,
                coeff_a,
                char_b,
                coeff_b,
                offset,
            }),
            "<" => Ok(LanguagePredicate::CountLinearLte {
                char_a,
                coeff_a,
                char_b,
                coeff_b,
                offset: if offset > 0 { offset - 1 } else { 0 },
            }),
            "==" | "=" => Ok(LanguagePredicate::CountEq {
                char_a,
                coeff_a,
                char_b,
                coeff_b,
                offset,
            }),
            _ => Err(LanguageError::InvalidSyntax(format!(
                "Operator relasi '{op}' tidak didukung"
            ))),
        }
    }

    fn starts_with(&self, prefix: &str) -> bool {
        self.input[self.pos..].starts_with(prefix)
    }

    fn starts_with_ci(&self, prefix: &str) -> bool {
        if self.input.len() < self.pos + prefix.len() {
            return false;
        }
        self.input[self.pos..self.pos + prefix.len()].eq_ignore_ascii_case(prefix)
    }
}
