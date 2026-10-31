use super::error::GrammarError;
use super::types::{Grammar, Production, Symbol};

pub struct GrammarParser;

impl GrammarParser {
    pub fn parse(input: &str) -> Result<Grammar, GrammarError> {
        let mut rules = Vec::new();
        let mut start_symbol: Option<String> = None;

        for line in input.lines() {
            let trimmed = line.trim();
            // Skip empty lines and comment lines
            if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with("//") {
                continue;
            }

            // Find arrow separator: "->", "→", or "::="
            let (head_part, body_part) = if let Some((h, b)) = trimmed.split_once("->") {
                (h, b)
            } else if let Some((h, b)) = trimmed.split_once('→') {
                (h, b)
            } else if let Some((h, b)) = trimmed.split_once("::=") {
                (h, b)
            } else {
                return Err(GrammarError::InvalidRuleFormat(format!(
                    "Baris '{}' tidak memiliki pemisah panah (-> atau →)",
                    trimmed
                )));
            };

            let head = head_part.trim().to_string();
            if head.is_empty() {
                return Err(GrammarError::InvalidRuleFormat(
                    "Ruas kiri (head) aturan produksi tidak boleh kosong".into(),
                ));
            }

            if start_symbol.is_none() {
                start_symbol = Some(head.clone());
            }

            // Parse alternatives separated by '|'
            for alt in body_part.split('|') {
                let symbols = Self::parse_rhs_symbols(alt.trim())?;
                rules.push(Production::new(head.clone(), symbols));
            }
        }

        if rules.is_empty() {
            return Err(GrammarError::EmptyGrammar);
        }

        let start = start_symbol.ok_or(GrammarError::MissingStartSymbol)?;
        Ok(Grammar::new(start, rules))
    }

    fn parse_rhs_symbols(rhs: &str) -> Result<Vec<Symbol>, GrammarError> {
        let trimmed = rhs.trim();
        // Check for epsilon / empty string representations
        if trimmed.is_empty()
            || trimmed == "ε"
            || trimmed == "^"
            || trimmed == "\\lambda"
            || trimmed == "\\epsilon"
            || trimmed.eq_ignore_ascii_case("lambda")
            || trimmed.eq_ignore_ascii_case("epsilon")
        {
            return Ok(Vec::new());
        }

        let mut symbols = Vec::new();
        let chars: Vec<char> = trimmed.chars().collect();
        let mut i = 0;

        while i < chars.len() {
            let ch = chars[i];

            // Skip internal whitespace between symbols
            if ch.is_whitespace() {
                i += 1;
                continue;
            }

            // LaTeX \lambda or \epsilon inline
            if ch == '\\' {
                let rest: String = chars[i..].iter().collect();
                if rest.starts_with("\\lambda") {
                    i += "\\lambda".len();
                    continue;
                }
                if rest.starts_with("\\epsilon") {
                    i += "\\epsilon".len();
                    continue;
                }
            }

            // Bracketed non-terminal: <Var> or [Var]
            if ch == '<' || ch == '[' {
                let close_char = if ch == '<' { '>' } else { ']' };
                i += 1;
                let mut name = String::new();
                while i < chars.len() && chars[i] != close_char {
                    name.push(chars[i]);
                    i += 1;
                }
                if i < chars.len() && chars[i] == close_char {
                    i += 1;
                }
                symbols.push(Symbol::NonTerminal(name));
                continue;
            }

            // Uppercase variable with possible subscript/digits: e.g. S, A, T_a, X1, C_1
            if ch.is_ascii_uppercase() {
                let mut name = String::new();
                name.push(ch);
                i += 1;
                // Allow helper variable naming like T_a or X1 or S0
                if i < chars.len() && (chars[i] == '_' || chars[i].is_ascii_digit()) {
                    if chars[i] == '_' {
                        name.push('_');
                        i += 1;
                        while i < chars.len() && (chars[i].is_ascii_alphanumeric()) {
                            name.push(chars[i]);
                            i += 1;
                        }
                    } else {
                        while i < chars.len() && chars[i].is_ascii_digit() {
                            name.push(chars[i]);
                            i += 1;
                        }
                    }
                }
                symbols.push(Symbol::NonTerminal(name));
                continue;
            }

            // Otherwise, it's a terminal symbol (lowercase character, punctuation, digit)
            symbols.push(Symbol::Terminal(ch));
            i += 1;
        }

        Ok(symbols)
    }
}
