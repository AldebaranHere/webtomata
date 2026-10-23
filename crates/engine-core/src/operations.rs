//! Closure operations on regular languages, as in Rich's Theorems 8.3 and 8.4 and the course
//! slides.
//! - Complement: swap the accepting and the non-accepting states of a complete DFSM.
//! - Trap state: a new dead state that takes every missing transition of a DFSM, so that the
//!   machine becomes complete (JFLAP: "Add Trap State to DFA"; Rich: dead state).
//! - Union: a new start state with an ε-transition to each of the two start states.
//! - Intersection by De Morgan: `L1 ∩ L2 = ¬(¬L1 ∪ ¬L2)`, in stages. A machine that is not a
//!   complete DFSM is first made one with `determinize`.

use crate::determinize::{Conversion, ConversionBudget, determinize};
use crate::fsm::{Fsm, FsmKind, MAX_STATES, StateId, SymbolId, Transition, limit_exceeded};
use crate::message::Message;
use crate::stop::StopReason;
use crate::trace::{Change, ConversionStep};
use crate::validate::{Severity, validate};
use serde::Serialize;
use std::collections::HashSet;

/// The new machine and the steps that built it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct Operation {
    #[cfg_attr(feature = "ts", ts(as = "crate::json::Wire"))]
    pub fsm: Fsm,
    pub trace: Vec<ConversionStep>,
}

fn step(key: &'static str, change: Change) -> ConversionStep {
    ConversionStep {
        message: Message::new(key),
        change,
    }
}

fn is_complete_dfsm(fsm: &Fsm) -> bool {
    fsm.kind == FsmKind::Dfsm && !validate(fsm).iter().any(|i| i.severity == Severity::Error)
}

/// Complement of a complete DFSM. Other machines get an error: a NDFSM or a DFSM with a missing
/// transition must first be turned into a complete DFSM (see `determinize`).
pub fn complement(fsm: &Fsm) -> Result<Operation, Message> {
    if fsm.kind != FsmKind::Dfsm {
        return Err(Message::new("complement.not_a_dfsm"));
    }
    if !is_complete_dfsm(fsm) {
        return Err(Message::new("complement.invalid_machine"));
    }
    let mut accepting = Vec::new();
    let mut trace = Vec::new();
    for &state in &fsm.states {
        let message = |key: &'static str| Message::new(key).with("state", state.0);
        if fsm.accepting.binary_search(&state).is_ok() {
            trace.push(ConversionStep {
                message: message("complement.not_accepting"),
                change: Change::NotAccepting { state },
            });
        } else {
            accepting.push(state);
            trace.push(ConversionStep {
                message: message("complement.accepting"),
                change: Change::Accepting { state },
            });
        }
    }
    let result = Fsm::new(
        FsmKind::Dfsm,
        fsm.alphabet.clone(),
        fsm.states.clone(),
        fsm.start,
        accepting,
        fsm.transitions.clone(),
    )?;
    Ok(Operation { fsm: result, trace })
}

/// Completes a DFSM: a new state, with the id after the highest one, takes every missing
/// transition and loops on every symbol. It does not accept, so the language does not change.
/// A DFSM that is already complete comes back unchanged. Returns an error message if the
/// machine is not a DFSM, if it has no start state, an ε-transition or two transitions on one
/// symbol, or if the result would be too big.
pub fn add_trap_state(fsm: &Fsm) -> Result<Operation, Message> {
    if fsm.kind != FsmKind::Dfsm {
        return Err(Message::new("trap.not_a_dfsm"));
    }
    let invalid = || Message::new("trap.invalid_machine");
    if fsm.start.is_none() {
        return Err(invalid());
    }
    let mut seen = HashSet::new();
    for t in &fsm.transitions {
        match t.on {
            Some(symbol) if seen.insert((t.from, symbol)) => {}
            _ => return Err(invalid()),
        }
    }
    let symbols = (0..fsm.alphabet.len()).filter_map(|i| u16::try_from(i).ok().map(SymbolId));
    let symbols: Vec<SymbolId> = symbols.collect();
    let missing: Vec<(StateId, SymbolId)> = fsm
        .states
        .iter()
        .flat_map(|&state| symbols.iter().map(move |&symbol| (state, symbol)))
        .filter(|key| !seen.contains(key))
        .collect();
    if missing.is_empty() {
        return Ok(Operation {
            fsm: fsm.clone(),
            trace: vec![step("trap.already_complete", Change::AlreadyComplete)],
        });
    }

    let too_big = || limit_exceeded("states", MAX_STATES);
    let trap = StateId(
        fsm.states
            .last()
            .and_then(|s| s.0.checked_add(1))
            .ok_or_else(too_big)?,
    );
    let name = |symbol: SymbolId| fsm.alphabet.name(symbol).unwrap_or_default();
    let mut trace = vec![ConversionStep {
        message: Message::new("trap.new_state").with("state", trap.0),
        change: Change::NewState {
            state: trap,
            members: vec![],
        },
    }];
    let mut transitions = fsm.transitions.clone();
    for (from, symbol) in missing {
        trace.push(ConversionStep {
            message: Message::new("trap.transition")
                .with("state", from.0)
                .with("symbol", name(symbol))
                .with("to", trap.0),
            change: Change::Transition {
                from,
                symbol,
                to: trap,
            },
        });
        transitions.push(Transition {
            from,
            on: Some(symbol),
            to: trap,
        });
    }
    for &symbol in &symbols {
        trace.push(ConversionStep {
            message: Message::new("trap.loop").with("symbol", name(symbol)),
            change: Change::Transition {
                from: trap,
                symbol,
                to: trap,
            },
        });
        transitions.push(Transition {
            from: trap,
            on: Some(symbol),
            to: trap,
        });
    }
    let mut states = fsm.states.clone();
    states.push(trap);
    let result = Fsm::new(
        FsmKind::Dfsm,
        fsm.alphabet.clone(),
        states,
        fsm.start,
        fsm.accepting.clone(),
        transitions,
    )?;
    Ok(Operation { fsm: result, trace })
}

/// Union of two machines: the result is a NDFSM. The first machine keeps its state numbers.
/// The states of the second machine are renumbered, in order, after the highest state of the
/// first machine, and the new start state comes last. Symbols are matched by name.
pub fn union(first: &Fsm, second: &Fsm) -> Result<Operation, Message> {
    let no_start = |side: &str| Message::new("union.no_start_state").with("side", side);
    let start1 = first.start.ok_or_else(|| no_start("first"))?;
    let start2 = second.start.ok_or_else(|| no_start("second"))?;
    let to_second = first.alphabet.match_by_name(
        &second.alphabet,
        "union.alphabet_mismatch",
        ("first", "second"),
    )?;
    let mut to_first = vec![SymbolId(0); to_second.len()];
    for (i, s) in to_second.iter().enumerate() {
        to_first[usize::from(s.0)] = SymbolId(i as u16);
    }

    let too_big = || Message::new("machine.limit_exceeded").with("what", "state_id");
    let offset = first
        .states
        .iter()
        .map(|s| s.0)
        .max()
        .map_or(Some(0), |m| m.checked_add(1))
        .ok_or_else(too_big)?;
    let renumber = |q: StateId| -> Option<StateId> {
        let rank = u32::try_from(second.states.binary_search(&q).ok()?).ok()?;
        offset.checked_add(rank).map(StateId)
    };
    let mut renumbered = Vec::new();
    for &q in &second.states {
        renumbered.push(renumber(q).ok_or_else(too_big)?);
    }
    let new_start = StateId(
        offset
            .checked_add(second.states.len() as u32)
            .ok_or_else(too_big)?,
    );
    let moved = |q: StateId| renumber(q).unwrap_or(q);

    let accepting2: Vec<StateId> = second.accepting.iter().map(|&q| moved(q)).collect();
    let trace = vec![
        ConversionStep {
            message: Message::new("union.copy_first"),
            change: Change::Copy {
                machine: 1,
                from: first.states.clone(),
                to: first.states.clone(),
                start: start1,
                accepting: first.accepting.clone(),
            },
        },
        ConversionStep {
            message: Message::new("union.copy_second").with("offset", offset),
            change: Change::Copy {
                machine: 2,
                from: second.states.clone(),
                to: renumbered.clone(),
                start: moved(start2),
                accepting: accepting2.clone(),
            },
        },
        ConversionStep {
            message: Message::new("union.new_start").with("state", new_start.0),
            change: Change::Start { state: new_start },
        },
        epsilon(new_start, start1),
        epsilon(new_start, moved(start2)),
    ];

    let mut states = first.states.clone();
    states.extend(renumbered);
    states.push(new_start);
    let mut transitions = first.transitions.clone();
    transitions.extend(second.transitions.iter().map(|t| Transition {
        from: moved(t.from),
        on: t.on.map(|s| to_first[usize::from(s.0)]),
        to: moved(t.to),
    }));
    transitions.push(Transition {
        from: new_start,
        on: None,
        to: start1,
    });
    transitions.push(Transition {
        from: new_start,
        on: None,
        to: moved(start2),
    });
    let accepting = [first.accepting.clone(), accepting2].concat();
    let result = Fsm::new(
        FsmKind::Ndfsm,
        first.alphabet.clone(),
        states,
        Some(new_start),
        accepting,
        transitions,
    )?;
    Ok(Operation { fsm: result, trace })
}

fn epsilon(from: StateId, to: StateId) -> ConversionStep {
    ConversionStep {
        message: Message::new("union.epsilon")
            .with("from", from.0)
            .with("to", to.0),
        change: Change::Epsilon { from, to },
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(
    tag = "result",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub enum Intersection {
    Finished {
        #[cfg_attr(feature = "ts", ts(as = "crate::json::Wire"))]
        fsm: Fsm,
        trace: Vec<ConversionStep>,
    },
    Stopped {
        reason: StopReason,
        partial_trace: Vec<ConversionStep>,
    },
}

enum Failure {
    Stopped(StopReason),
    Message(Message),
}

impl From<Message> for Failure {
    fn from(m: Message) -> Self {
        Failure::Message(m)
    }
}

fn stage(trace: &mut Vec<ConversionStep>, number: u8, key: &'static str) {
    trace.push(step(key, Change::Stage { stage: number }));
}

/// A complete DFSM for the same language. A machine that already is one is returned as it is,
/// without steps; otherwise a stage starts and `determinize` runs.
fn make_complete(
    fsm: &Fsm,
    budget: ConversionBudget,
    number: u8,
    key: &'static str,
    trace: &mut Vec<ConversionStep>,
) -> Result<Fsm, Failure> {
    if is_complete_dfsm(fsm) {
        return Ok(fsm.clone());
    }
    stage(trace, number, key);
    match determinize(fsm, budget)? {
        Conversion::Finished {
            dfsm, trace: steps, ..
        } => {
            trace.extend(steps);
            Ok(dfsm)
        }
        Conversion::Stopped {
            reason,
            partial_trace,
        } => {
            trace.extend(partial_trace);
            Err(Failure::Stopped(reason))
        }
    }
}

fn complement_stage(
    fsm: &Fsm,
    number: u8,
    key: &'static str,
    trace: &mut Vec<ConversionStep>,
) -> Result<Fsm, Failure> {
    stage(trace, number, key);
    let op = complement(fsm)?;
    trace.extend(op.trace);
    Ok(op.fsm)
}

fn run(
    a: &Fsm,
    b: &Fsm,
    budget: ConversionBudget,
    trace: &mut Vec<ConversionStep>,
) -> Result<Fsm, Failure> {
    let d1 = make_complete(a, budget, 1, "intersection.stage.complete_first", trace)?;
    let c1 = complement_stage(&d1, 2, "intersection.stage.complement_first", trace)?;
    let d2 = make_complete(b, budget, 3, "intersection.stage.complete_second", trace)?;
    let c2 = complement_stage(&d2, 4, "intersection.stage.complement_second", trace)?;
    stage(trace, 5, "intersection.stage.union");
    let both = union(&c1, &c2)?;
    trace.extend(both.trace);
    let d3 = make_complete(
        &both.fsm,
        budget,
        6,
        "intersection.stage.complete_union",
        trace,
    )?;
    complement_stage(&d3, 7, "intersection.stage.complement_union", trace)
}

/// Intersection by De Morgan, in seven stages (a stage is skipped if it has nothing to do):
/// make the first machine a complete DFSM, complement it, the same for the second, take the union
/// of the two complements, make the union a complete DFSM, complement it. The `budget` applies
/// to each `determinize` call. Returns an error message if a machine has no start state or the
/// alphabets do not have the same symbols (in any order).
pub fn intersection(a: &Fsm, b: &Fsm, budget: ConversionBudget) -> Result<Intersection, Message> {
    let no_start = |side: &str| Message::new("intersection.no_start_state").with("side", side);
    a.start.ok_or_else(|| no_start("first"))?;
    b.start.ok_or_else(|| no_start("second"))?;
    a.alphabet.match_by_name(
        &b.alphabet,
        "intersection.alphabet_mismatch",
        ("first", "second"),
    )?;
    let mut trace = Vec::new();
    match run(
        a,
        b,
        ConversionBudget {
            max_states: budget.max_states.min(MAX_STATES),
            ..budget
        },
        &mut trace,
    ) {
        Ok(fsm) => Ok(Intersection::Finished { fsm, trace }),
        Err(Failure::Stopped(reason)) => Ok(Intersection::Stopped {
            reason,
            partial_trace: trace,
        }),
        Err(Failure::Message(m)) => Err(m),
    }
}
