//! The engine API for the web app. Each function takes text (JSON, plain text or XML) and
//! returns one text: JSON in the same envelope every time, so the browser never has to catch
//! an error and never reads a half answer.
//!
//! - Worked: `{"ok":true,"value":…}`. Failed: `{"ok":false,"error":<message>}`.
//! - A machine is the machine file (`schemaVersion` 1). A budget is a JSON object with some or
//!   all of the budget fields; what is missing keeps its default, and an unknown field is an
//!   error. A missing or empty budget means the defaults.
//! - A regular expression is text, and its alphabet is a JSON list of symbol names.
//! - Results that hold strings also hold the symbol names, so the caller never has to look up
//!   a number in an alphabet (the witness of `equivalent` uses the alphabet of the candidate).
//! - Every input has a size limit. Nothing here panics.
//!
//! `engine-wasm` only adds `wasm-bindgen` to these functions.

use crate::fsm::{Alphabet, Fsm, SymbolId, limit_exceeded};
use crate::jff::JffState;
use crate::message::Message;
use crate::trace::ConversionStep;
use crate::{
    Compiled, Conversion, ConversionBudget, Equivalence, EquivalenceBudget, Extraction,
    FsmToRegexBudget, MAX_JSON_BYTES, Minimization, MinimizeBudget, RegexBudget, Simplification,
    SimplifyBudget, Simulation, StopReason, ViaMachineBudget,
};
use serde::Serialize;
use serde::de::DeserializeOwned;

/// The longest input text for `simulate`, in bytes.
pub const MAX_INPUT_BYTES: usize = 100_000;
/// The longest budget text, in bytes.
pub const MAX_BUDGET_BYTES: usize = 4_096;

/// What `simulate` returns: the symbols that were read, and the run.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct SimulationReport {
    /// The input as symbol names; `simulation.trace[i].symbol` is the number of the symbol
    /// that `input[i - 1]` names.
    pub input: Vec<String>,
    pub simulation: Simulation,
}

/// What `equivalent` returns. The symbols of the strings are names in the alphabet of the
/// candidate, so a string can be shown and run on both machines without any lookup.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct EquivalenceReport {
    pub equivalence: Equivalence,
    /// The shortest string that the machines classify differently, if they are different.
    pub witness: Option<Vec<String>>,
    pub accepted_but_should_reject: Vec<Vec<String>>,
    pub rejected_but_should_accept: Vec<Vec<String>>,
}

/// What `fsm_to_regex` and `simplify` return. The expression is text in Rich's notation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(
    tag = "result",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub enum RegexOutcome {
    Finished {
        regex: String,
        trace: Vec<ConversionStep>,
    },
    Stopped {
        reason: StopReason,
        partial_trace: Vec<ConversionStep>,
    },
}

#[derive(Serialize)]
struct Success<'a, T: Serialize> {
    ok: bool,
    value: &'a T,
}

#[derive(Serialize)]
struct Failure<'a> {
    ok: bool,
    error: &'a Message,
}

/// Turns an answer into the envelope.
fn finish<T: Serialize>(answer: Result<T, Message>) -> String {
    let text = match &answer {
        Ok(value) => serde_json::to_string(&Success { ok: true, value }),
        Err(error) => serde_json::to_string(&Failure { ok: false, error }),
    };
    // Plain data always serializes; this is only a way out that never panics.
    text.unwrap_or_else(|_| {
        String::from(r#"{"ok":false,"error":{"key":"api.internal","params":{}}}"#)
    })
}

fn machine(text: &str) -> Result<Fsm, Message> {
    Fsm::from_json(text)
}

fn too_long(text: &str, what: &str, limit: usize) -> Result<(), Message> {
    if text.len() > limit {
        return Err(limit_exceeded(what, limit));
    }
    Ok(())
}

/// A budget from text. Missing or empty text means the defaults.
fn budget<T: DeserializeOwned + Default>(text: Option<&str>) -> Result<T, Message> {
    let Some(text) = text.filter(|t| !t.trim().is_empty()) else {
        return Ok(T::default());
    };
    too_long(text, "budget bytes", MAX_BUDGET_BYTES)?;
    serde_json::from_str(text).map_err(|_| Message::new("api.invalid_budget"))
}

/// An alphabet from a JSON list of symbol names.
fn alphabet(text: &str) -> Result<Alphabet, Message> {
    too_long(text, "alphabet bytes", MAX_JSON_BYTES)?;
    let names: Vec<String> =
        serde_json::from_str(text).map_err(|_| Message::new("api.invalid_alphabet"))?;
    Alphabet::new(names)
}

fn names(alphabet: &Alphabet, string: &[SymbolId]) -> Vec<String> {
    string
        .iter()
        .map(|&s| alphabet.name(s).unwrap_or_default().to_owned())
        .collect()
}

/// Reads a machine file and gives it back in its canonical form.
pub fn load_machine(json: &str) -> String {
    finish(machine(json))
}

/// The issues of a machine, errors and warnings.
pub fn validate(machine_json: &str) -> String {
    finish(machine(machine_json).map(|m| crate::validate(&m)))
}

/// The states that make a machine nondeterministic.
pub fn nondeterministic_states(machine_json: &str) -> String {
    finish(machine(machine_json).map(|m| crate::nondeterministic_states(&m)))
}

pub fn add_trap_state(machine_json: &str) -> String {
    finish(machine(machine_json).and_then(|m| crate::add_trap_state(&m)))
}

/// Runs a machine on `input`, read as symbols of its alphabet (see `Alphabet::tokenize`).
pub fn simulate(machine_json: &str, input: &str, budget_json: Option<&str>) -> String {
    let run = || -> Result<SimulationReport, Message> {
        let fsm = machine(machine_json)?;
        let budget = budget(budget_json)?;
        too_long(input, "input bytes", MAX_INPUT_BYTES)?;
        let symbols = fsm.alphabet.tokenize(input)?;
        let simulation = crate::simulate(&fsm, &symbols, budget)?;
        Ok(SimulationReport {
            input: names(&fsm.alphabet, &symbols),
            simulation,
        })
    };
    finish(run())
}

pub fn determinize(machine_json: &str, budget_json: Option<&str>) -> String {
    let run = || -> Result<Conversion, Message> {
        crate::determinize(
            &machine(machine_json)?,
            budget::<ConversionBudget>(budget_json)?,
        )
    };
    finish(run())
}

pub fn minimize(machine_json: &str, budget_json: Option<&str>) -> String {
    let run = || -> Result<Minimization, Message> {
        crate::minimize(
            &machine(machine_json)?,
            budget::<MinimizeBudget>(budget_json)?,
        )
    };
    finish(run())
}

/// Compares two machines. Strings in the answer use the symbol names of the candidate.
pub fn equivalent(candidate_json: &str, reference_json: &str, budget_json: Option<&str>) -> String {
    let run = || -> Result<EquivalenceReport, Message> {
        let candidate = machine(candidate_json)?;
        let reference = machine(reference_json)?;
        let budget = budget::<EquivalenceBudget>(budget_json)?;
        let equivalence = crate::equivalent(&candidate, &reference, budget)?;
        let alphabet = &candidate.alphabet;
        Ok(match &equivalence {
            Equivalence::Different {
                witness,
                accepted_but_should_reject,
                rejected_but_should_accept,
                ..
            } => EquivalenceReport {
                witness: Some(names(alphabet, &witness.string)),
                accepted_but_should_reject: accepted_but_should_reject
                    .iter()
                    .map(|s| names(alphabet, s))
                    .collect(),
                rejected_but_should_accept: rejected_but_should_accept
                    .iter()
                    .map(|s| names(alphabet, s))
                    .collect(),
                equivalence,
            },
            _ => EquivalenceReport {
                witness: None,
                accepted_but_should_reject: vec![],
                rejected_but_should_accept: vec![],
                equivalence,
            },
        })
    };
    finish(run())
}

/// Builds the NDFSM for a regular expression over the given alphabet (a JSON list of names).
pub fn regex_to_fsm(text: &str, alphabet_json: &str, budget_json: Option<&str>) -> String {
    let run = || -> Result<Compiled, Message> {
        let alphabet = alphabet(alphabet_json)?;
        let budget = budget::<RegexBudget>(budget_json)?;
        let regex = crate::parse_regex(text, &alphabet)?;
        crate::regex_to_fsm(&regex, &alphabet, budget)
    };
    finish(run())
}

/// The regular expression for a machine, by state elimination.
pub fn fsm_to_regex(machine_json: &str, budget_json: Option<&str>) -> String {
    let run = || -> Result<RegexOutcome, Message> {
        let fsm = machine(machine_json)?;
        let budget = budget::<FsmToRegexBudget>(budget_json)?;
        Ok(match crate::fsm_to_regex(&fsm, budget)? {
            Extraction::Finished { regex, trace } => RegexOutcome::Finished {
                regex: regex.to_text(&fsm.alphabet),
                trace,
            },
            Extraction::Stopped {
                reason,
                partial_trace,
            } => RegexOutcome::Stopped {
                reason,
                partial_trace,
            },
        })
    };
    finish(run())
}

/// Simplifies a regular expression with Rich's identities, one step at a time.
pub fn simplify(text: &str, alphabet_json: &str, budget_json: Option<&str>) -> String {
    let run = || -> Result<RegexOutcome, Message> {
        let alphabet = alphabet(alphabet_json)?;
        let budget = budget::<SimplifyBudget>(budget_json)?;
        let regex = crate::parse_regex(text, &alphabet)?;
        Ok(match crate::simplify(&regex, &alphabet, budget)? {
            Simplification::Finished { regex, trace } => RegexOutcome::Finished {
                regex: regex.to_text(&alphabet),
                trace,
            },
            Simplification::Stopped {
                reason,
                partial_trace,
            } => RegexOutcome::Stopped {
                reason,
                partial_trace,
            },
        })
    };
    finish(run())
}

/// Simplifies a regular expression the plain way and through the minimal machine, and keeps the
/// shorter. The trace says which route was taken.
pub fn simplify_via_machine(text: &str, alphabet_json: &str, budget_json: Option<&str>) -> String {
    let run = || -> Result<RegexOutcome, Message> {
        let alphabet = alphabet(alphabet_json)?;
        let budget = budget::<ViaMachineBudget>(budget_json)?;
        let regex = crate::parse_regex(text, &alphabet)?;
        Ok(
            match crate::simplify_via_machine(&regex, &alphabet, budget)? {
                Simplification::Finished { regex, trace } => RegexOutcome::Finished {
                    regex: regex.to_text(&alphabet),
                    trace,
                },
                Simplification::Stopped {
                    reason,
                    partial_trace,
                } => RegexOutcome::Stopped {
                    reason,
                    partial_trace,
                },
            },
        )
    };
    finish(run())
}

pub fn complement(machine_json: &str) -> String {
    finish(machine(machine_json).and_then(|m| crate::complement(&m)))
}

pub fn union(first_json: &str, second_json: &str) -> String {
    let run = || crate::union(&machine(first_json)?, &machine(second_json)?);
    finish(run())
}

pub fn intersection(first_json: &str, second_json: &str, budget_json: Option<&str>) -> String {
    let run = || {
        crate::intersection(
            &machine(first_json)?,
            &machine(second_json)?,
            budget::<ConversionBudget>(budget_json)?,
        )
    };
    finish(run())
}

pub fn xor(first_json: &str, second_json: &str, budget_json: Option<&str>) -> String {
    let run = || {
        crate::xor(
            &machine(first_json)?,
            &machine(second_json)?,
            budget::<ConversionBudget>(budget_json)?,
        )
    };
    finish(run())
}

/// Reads a JFLAP file: the machine, the names and places of its states, and notes.
pub fn import_jff(xml: &str) -> String {
    finish(crate::parse_jff(xml))
}

/// Writes a JFLAP file. `layout_json` is a JSON list of `{id, name, x, y}`; a state with no
/// entry gets a name and a place on a grid.
pub fn export_jff(machine_json: &str, layout_json: &str) -> String {
    let run = || -> Result<String, Message> {
        let fsm = machine(machine_json)?;
        too_long(layout_json, "layout bytes", MAX_JSON_BYTES)?;
        let layout: Vec<JffState> =
            serde_json::from_str(layout_json).map_err(|_| Message::new("api.invalid_layout"))?;
        crate::to_jff(&fsm, &layout)
    };
    finish(run())
}

/// What `enumerate_language` returns: strings in proper order and inferred alphabet.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct EnumerateReport {
    pub strings: Vec<String>,
    pub alphabet: Vec<String>,
}

/// Enumerates strings for a formal language expression in strict proper order.
pub fn enumerate_language(
    expr_text: &str,
    min_length: usize,
    max_count: usize,
    env_json: Option<&str>,
) -> String {
    let run = || -> Result<EnumerateReport, Message> {
        too_long(expr_text, "expression characters", 4096)?;

        let mut env = std::collections::HashMap::new();
        if let Some(json) = env_json.filter(|j| !j.trim().is_empty()) {
            too_long(json, "environment bytes", MAX_JSON_BYTES)?;
            let raw_map: std::collections::HashMap<String, String> =
                serde_json::from_str(json).map_err(|_| Message::new("api.invalid_environment"))?;
            for (k, v) in raw_map {
                let parsed = crate::language::LanguageParser::parse(&v).map_err(|e| {
                    Message::new("api.invalid_language").with("detail", e.to_string())
                })?;
                env.insert(k, parsed);
            }
        }

        let expr = crate::language::LanguageParser::parse(expr_text)
            .map_err(|e| Message::new("api.invalid_language").with("detail", e.to_string()))?;

        let evaluator = crate::language::LanguageEvaluator::new(&env);
        let alphabet_set = evaluator.infer_alphabet(&expr);
        let alphabet: Vec<String> = alphabet_set.into_iter().map(|c| c.to_string()).collect();

        let options = crate::language::EnumerateOptions {
            min_length: min_length.clamp(0, 100),
            max_count: max_count.clamp(1, 100),
            max_depth: 30.max(min_length + 20),
        };

        let strings = evaluator
            .enumerate(&expr, options)
            .map_err(|e| Message::new("api.enumeration_failed").with("detail", e.to_string()))?;

        Ok(EnumerateReport { strings, alphabet })
    };
    finish(run())
}

/// Parses a context-free grammar string into its AST.
pub fn parse_grammar(grammar_text: &str) -> String {
    let run = || -> Result<crate::grammar::Grammar, Message> {
        too_long(grammar_text, "grammar characters", 8192)?;
        crate::grammar::GrammarParser::parse(grammar_text)
            .map_err(|e| Message::new("api.invalid_grammar").with("detail", e.to_string()))
    };
    finish(run())
}

/// Transforms a context-free grammar to Chomsky Normal Form (CNF) with a step-by-step trace.
pub fn transform_to_cnf(grammar_text: &str) -> String {
    let run = || -> Result<crate::grammar::CnfTransformationTrace, Message> {
        too_long(grammar_text, "grammar characters", 8192)?;
        let grammar = crate::grammar::GrammarParser::parse(grammar_text)
            .map_err(|e| Message::new("api.invalid_grammar").with("detail", e.to_string()))?;
        crate::grammar::CnfTransformer::transform(&grammar).map_err(|e| {
            Message::new("api.cnf_transformation_failed").with("detail", e.to_string())
        })
    };
    finish(run())
}

/// Tests whether an input string is accepted by a CNF grammar using the CYK algorithm.
pub fn cyk_parse(grammar_text: &str, input_word: &str) -> String {
    let run = || -> Result<crate::grammar::CykResult, Message> {
        too_long(grammar_text, "grammar characters", 8192)?;
        too_long(input_word, "input characters", 256)?;
        let grammar = crate::grammar::GrammarParser::parse(grammar_text)
            .map_err(|e| Message::new("api.invalid_grammar").with("detail", e.to_string()))?;
        crate::grammar::CykParser::parse(&grammar, input_word)
            .map_err(|e| Message::new("api.cyk_failed").with("detail", e.to_string()))
    };
    finish(run())
}
