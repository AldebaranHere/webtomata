//! Sederhanakan through the minimal machine. The identities of `regex_simplify` only shorten an
//! expression one local rewrite at a time, so they cannot move an expression that is long for a
//! reason that is not local (the expression of a machine, a long union that means a short loop).
//! The minimal DFSM is the one object that every regular expression of a language leads to
//! (Myhill-Nerode), so the route is: regex → NDFSM → DFSM → minimal DFSM → regex (state
//! elimination) → the identities. The result is the shorter of this and the plain identities;
//! a tie keeps the plain result, because its steps are all identities of the book.
//!
//! The trace says which route was taken: `via_machine.machine` and `via_machine.expression`, then
//! the steps of the identities, or `via_machine.kept_original` (or `via_machine.too_big` when a
//! machine did not fit the budget), then the steps of the plain identities. Every step holds the
//! whole expression at that step, as in `regex_simplify`.

use crate::determinize::{Conversion, ConversionBudget, determinize};
use crate::fsm::{Alphabet, MAX_STATES};
use crate::fsm_regex::{Extraction, FsmToRegexBudget, fsm_to_regex};
use crate::message::Message;
use crate::minimize::{Minimization, MinimizeBudget, minimize};
use crate::regex::Regex;
use crate::regex_fsm::{Compiled, RegexBudget, regex_to_fsm};
use crate::regex_simplify::{Simplification, SimplifyBudget, simplify};
use crate::trace::{Change, ConversionStep};
use serde::Deserialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct ViaMachineBudget {
    /// The most states of the NDFSM and of the DFSM.
    pub max_states: usize,
    /// The size (in parts) of the biggest label of the state elimination.
    pub max_nodes: usize,
    /// The most steps of the identities (for each run of them).
    pub max_steps: usize,
    /// The most checks of the identities (for each run of them).
    pub max_checks: usize,
}

impl Default for ViaMachineBudget {
    fn default() -> Self {
        ViaMachineBudget {
            max_states: MAX_STATES,
            max_nodes: FsmToRegexBudget::default().max_nodes,
            max_steps: SimplifyBudget::default().max_steps,
            max_checks: SimplifyBudget::default().max_checks,
        }
    }
}

/// The expression that the minimal machine gives (before the identities), and the sizes of the
/// machines on the way. `None` when a machine does not fit the budget.
struct Through {
    expression: Regex,
    ndfsm: usize,
    dfsm: usize,
    minimal: usize,
}

fn through_machine(
    regex: &Regex,
    alphabet: &Alphabet,
    budget: ViaMachineBudget,
) -> Result<Option<Through>, Message> {
    let Compiled::Finished { fsm, .. } = regex_to_fsm(
        regex,
        alphabet,
        RegexBudget {
            max_states: budget.max_states,
        },
    )?
    else {
        return Ok(None);
    };
    let Conversion::Finished { dfsm, .. } = determinize(
        &fsm,
        ConversionBudget {
            max_states: budget.max_states,
            ..ConversionBudget::default()
        },
    )?
    else {
        return Ok(None);
    };
    let Minimization::Finished { dfsm: minimal, .. } = minimize(&dfsm, MinimizeBudget::default())?
    else {
        return Ok(None);
    };
    let Extraction::Finished {
        regex: expression, ..
    } = fsm_to_regex(
        &minimal,
        FsmToRegexBudget {
            max_nodes: budget.max_nodes,
            ..FsmToRegexBudget::default()
        },
    )?
    else {
        return Ok(None);
    };
    Ok(Some(Through {
        expression,
        ndfsm: fsm.states.len(),
        dfsm: dfsm.states.len(),
        minimal: minimal.states.len(),
    }))
}

fn step(message: Message, regex: &Regex, alphabet: &Alphabet) -> ConversionStep {
    ConversionStep {
        message,
        change: Change::Expression {
            expression: regex.to_text(alphabet),
        },
    }
}

/// Simplifies `regex` the plain way and through the minimal machine, and keeps the shorter. Returns an
/// error message if a symbol of the expression is not in the alphabet. A budget that the plain run
/// uses up stops the whole call; a machine that does not fit is only said in the trace.
pub fn simplify_via_machine(
    regex: &Regex,
    alphabet: &Alphabet,
    budget: ViaMachineBudget,
) -> Result<Simplification, Message> {
    let plain_budget = SimplifyBudget {
        max_steps: budget.max_steps,
        max_checks: budget.max_checks,
    };
    let (short, short_trace) = match simplify(regex, alphabet, plain_budget)? {
        stopped @ Simplification::Stopped { .. } => return Ok(stopped),
        Simplification::Finished { regex, trace } => (regex, trace),
    };
    let keep = |first: ConversionStep| {
        let mut trace = vec![first];
        trace.extend(short_trace.clone());
        Ok(Simplification::Finished {
            regex: short.clone(),
            trace,
        })
    };
    let Some(through) = through_machine(regex, alphabet, budget)? else {
        return keep(step(Message::new("via_machine.too_big"), regex, alphabet));
    };
    // The identities on the expression of the machine; if they do not finish, the machine did not fit.
    let (long, long_trace) = match simplify(&through.expression, alphabet, plain_budget)? {
        Simplification::Finished { regex, trace } => (regex, trace),
        Simplification::Stopped { .. } => {
            return keep(step(Message::new("via_machine.too_big"), regex, alphabet));
        }
    };
    if long.size() >= short.size() {
        let message = Message::new("via_machine.kept_original")
            .with("machine_size", long.size())
            .with("original_size", short.size());
        return keep(step(message, regex, alphabet));
    }
    let machine = Message::new("via_machine.machine")
        .with("ndfsm_states", through.ndfsm)
        .with("dfsm_states", through.dfsm)
        .with("minimal_states", through.minimal);
    let expression = Message::new("via_machine.expression")
        .with("expression", through.expression.to_text(alphabet));
    let mut trace = vec![
        step(machine, regex, alphabet),
        step(expression, &through.expression, alphabet),
    ];
    trace.extend(long_trace);
    Ok(Simplification::Finished { regex: long, trace })
}
