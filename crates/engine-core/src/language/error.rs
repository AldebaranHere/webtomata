use std::fmt;

use crate::message::Message;

/// What can go wrong while parsing or evaluating a language expression.
///
/// The variants hold data only (positions, the user's own text, names, a symbol); the sentences
/// live in the message files, keyed by `language.error.*` (`docs/decisions/0069`, `0070`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LanguageError {
    /// The expression parses, but a character is left after it.
    UnexpectedCharacter { position: usize, rest: String },
    /// A `^` is not followed by a number.
    ExpectedPowerNumber,
    /// A number does not fit in `usize` (64-bit natively, 32-bit in the WASM build).
    NumberTooLarge,
    /// A `(` has no matching `)`.
    UnclosedParenthesis,
    /// A character appears where an expression must start.
    UnexpectedSymbol { symbol: char },
    /// The expression ends where an expression must start.
    UnexpectedEnd,
    /// A set of words is not closed by `}` and does not separate its words with `,`.
    ExpectedCommaOrBrace,
    /// An expression refers to a language that the environment does not define.
    UndefinedReference { name: String },
    /// An expression refers to a language that refers back to itself.
    CyclicReference { name: String },
}

impl LanguageError {
    fn key(&self) -> &'static str {
        match self {
            Self::UnexpectedCharacter { .. } => "language.error.unexpected_character",
            Self::ExpectedPowerNumber => "language.error.expected_power_number",
            Self::NumberTooLarge => "language.error.number_too_large",
            Self::UnclosedParenthesis => "language.error.unclosed_parenthesis",
            Self::UnexpectedSymbol { .. } => "language.error.unexpected_symbol",
            Self::UnexpectedEnd => "language.error.unexpected_end",
            Self::ExpectedCommaOrBrace => "language.error.expected_comma_or_brace",
            Self::UndefinedReference { .. } => "language.error.undefined_reference",
            Self::CyclicReference { .. } => "language.error.cyclic_reference",
        }
    }
}

impl From<LanguageError> for Message {
    fn from(error: LanguageError) -> Self {
        let key = error.key();
        match error {
            LanguageError::UnexpectedCharacter { position, rest } => Message::new(key)
                .with("position", position)
                .with("rest", rest),
            LanguageError::ExpectedPowerNumber
            | LanguageError::NumberTooLarge
            | LanguageError::UnclosedParenthesis
            | LanguageError::UnexpectedEnd
            | LanguageError::ExpectedCommaOrBrace => Message::new(key),
            LanguageError::UnexpectedSymbol { symbol } => {
                Message::new(key).with("symbol", symbol.to_string())
            }
            LanguageError::UndefinedReference { name }
            | LanguageError::CyclicReference { name } => Message::new(key).with("name", name),
        }
    }
}

impl fmt::Display for LanguageError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.key())
    }
}

impl std::error::Error for LanguageError {}
