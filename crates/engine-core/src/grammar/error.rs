use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GrammarError {
    EmptyGrammar,
    MissingStartSymbol,
    InvalidRuleFormat(String),
    UnexpectedToken(String),
    BudgetExceeded(String),
}

impl fmt::Display for GrammarError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            GrammarError::EmptyGrammar => write!(f, "Tata bahasa tidak memiliki aturan produksi"),
            GrammarError::MissingStartSymbol => {
                write!(f, "Simbol awal (start symbol) tidak ditentukan")
            }
            GrammarError::InvalidRuleFormat(msg) => {
                write!(f, "Format aturan produksi tidak valid: {}", msg)
            }
            GrammarError::UnexpectedToken(msg) => write!(f, "Token tidak terduga: {}", msg),
            GrammarError::BudgetExceeded(msg) => {
                write!(f, "Batas komputasi tata bahasa terlampaui: {}", msg)
            }
        }
    }
}

impl std::error::Error for GrammarError {}
