use std::fmt;

use crate::message::Message;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GrammarError {
    EmptyGrammar,
    RuleWithoutArrow { line: String },
    EmptyRuleHead,
    NotChomskyNormalForm,
    TooManyNullable { rule: String, limit: usize },
    InputTooLong { length: usize, limit: usize },
}

impl GrammarError {
    fn key(&self) -> &'static str {
        match self {
            GrammarError::EmptyGrammar => "grammar.error.empty",
            GrammarError::RuleWithoutArrow { .. } => "grammar.error.no_arrow",
            GrammarError::EmptyRuleHead => "grammar.error.empty_head",
            GrammarError::NotChomskyNormalForm => "grammar.error.not_cnf",
            GrammarError::TooManyNullable { .. } => "grammar.error.too_many_nullable",
            GrammarError::InputTooLong { .. } => "grammar.cyk_input_too_long",
        }
    }
}

impl From<GrammarError> for Message {
    fn from(error: GrammarError) -> Self {
        let key = error.key();
        match error {
            GrammarError::EmptyGrammar
            | GrammarError::EmptyRuleHead
            | GrammarError::NotChomskyNormalForm => Message::new(key),
            GrammarError::RuleWithoutArrow { line } => Message::new(key).with("line", line),
            GrammarError::TooManyNullable { rule, limit } => {
                Message::new(key).with("rule", rule).with("limit", limit)
            }
            GrammarError::InputTooLong { length, limit } => Message::new(key)
                .with("limit", limit)
                .with("length", length),
        }
    }
}

impl fmt::Display for GrammarError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.key())
    }
}

impl std::error::Error for GrammarError {}
