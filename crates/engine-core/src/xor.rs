//! XOR (the symmetric difference) of two regular languages by the product machine of Rich's closure
//! proofs (the "cross-product machine construction" of her table of closure properties). The set
//! of strings that exactly one of the two machines accepts is `L1 ⊕ L2 = (L1 − L2) ∪ (L2 − L1)`,
//! and it is the language of the test of equivalence in her chapter 9: the machines are equivalent
//! exactly when it is empty.
//!
//! Stage 1 and 2: a machine that is not a complete DFSM is made one with `determinize` (a stage
//! that has nothing to do is skipped, as in the intersection). Stage 3: the product machine. A
//! state is a pair (p, q) of a state of the first and a state of the second machine; the start
//! state is (s1, s2); on a symbol both machines move together; a pair accepts when exactly one of
//! p and q accepts. Only the pairs that some string reaches are built, in the order they are
//! found, as in the subset construction.

use crate::determinize::ConversionBudget;
use crate::fsm::{Fsm, FsmKind, MAX_STATES, MAX_TRANSITIONS, StateId, SymbolId, Transition};
use crate::message::Message;
use crate::operations::{Failure, make_complete, stage};
use crate::stop::StopReason;
use crate::trace::{Change, ConversionStep};
use serde::Serialize;
use std::collections::HashMap;

/// The result of an XOR: the DFSM of the product and the steps that built it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(
    tag = "result",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub enum Xor {
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

/// The pairs found so far; pair `i` becomes state `i` of the product.
struct Pairs {
    list: Vec<(StateId, StateId)>,
    index: HashMap<(StateId, StateId), StateId>,
    max_states: usize,
    max_steps: usize,
}

impl Pairs {
    fn push(
        &self,
        trace: &mut Vec<ConversionStep>,
        message: Message,
        change: Change,
    ) -> Result<(), StopReason> {
        if trace.len() >= self.max_steps {
            return Err(StopReason::MaxSteps);
        }
        trace.push(ConversionStep { message, change });
        Ok(())
    }

    /// Adds a new pair as the next state of the product, unless the state budget is used up.
    fn add(
        &mut self,
        pair: (StateId, StateId),
        trace: &mut Vec<ConversionStep>,
    ) -> Result<StateId, StopReason> {
        if self.list.len() >= self.max_states {
            return Err(StopReason::MaxStates);
        }
        let id = StateId(u32::try_from(self.list.len()).map_err(|_| StopReason::MaxStates)?);
        let message = Message::new("product.new_state")
            .with("state", id.0)
            .with("first", pair.0.0)
            .with("second", pair.1.0);
        let change = Change::Pair {
            state: id,
            first: pair.0,
            second: pair.1,
        };
        self.push(trace, message, change)?;
        self.index.insert(pair, id);
        self.list.push(pair);
        Ok(id)
    }
}

fn moves(fsm: &Fsm) -> HashMap<(StateId, SymbolId), StateId> {
    fsm.transitions
        .iter()
        .filter_map(|t| Some(((t.from, t.on?), t.to)))
        .collect()
}

/// The product machine of two complete DFSMs. `map[c]` is the symbol of `b` that has the name of
/// the symbol `c` of `a`.
fn product(
    a: &Fsm,
    b: &Fsm,
    map: &[SymbolId],
    budget: ConversionBudget,
    trace: &mut Vec<ConversionStep>,
) -> Result<Fsm, Failure> {
    let invalid = || Failure::Message(Message::new("xor.invalid_machine"));
    let (Some(sa), Some(sb)) = (a.start, b.start) else {
        return Err(invalid());
    };
    let (delta_a, delta_b) = (moves(a), moves(b));
    let mut pairs = Pairs {
        list: Vec::new(),
        index: HashMap::new(),
        max_states: budget.max_states.min(MAX_STATES),
        max_steps: budget.max_steps.min(MAX_TRANSITIONS),
    };

    let start = pairs.add((sa, sb), trace).map_err(Failure::Stopped)?;
    let message = Message::new("product.start").with("state", start.0);
    pairs
        .push(trace, message, Change::Start { state: start })
        .map_err(Failure::Stopped)?;

    // Each pair in the order it was found; each symbol in the order of the first alphabet.
    let mut transitions = Vec::new();
    let mut i = 0;
    while i < pairs.list.len() {
        let from = StateId(u32::try_from(i).map_err(|_| Failure::Stopped(StopReason::MaxStates))?);
        let (p, q) = pairs.list[i];
        for (c, name) in a.alphabet.names().iter().enumerate() {
            let symbol =
                SymbolId(u16::try_from(c).map_err(|_| Failure::Stopped(StopReason::MaxStates))?);
            let next = (
                *delta_a.get(&(p, symbol)).ok_or_else(invalid)?,
                *delta_b.get(&(q, map[c])).ok_or_else(invalid)?,
            );
            let to = match pairs.index.get(&next) {
                Some(&id) => id,
                None => pairs.add(next, trace).map_err(Failure::Stopped)?,
            };
            let message = Message::new("product.transition")
                .with("from", from.0)
                .with("symbol", name.as_str())
                .with("to", to.0);
            pairs
                .push(trace, message, Change::Transition { from, symbol, to })
                .map_err(Failure::Stopped)?;
            transitions.push(Transition {
                from,
                on: Some(symbol),
                to,
            });
        }
        i += 1;
    }

    // A pair accepts when exactly one of its two states accepts.
    let accepts = |fsm: &Fsm, q: StateId| fsm.accepting.binary_search(&q).is_ok();
    let mut accepting = Vec::new();
    for (i, &(p, q)) in pairs.list.iter().enumerate() {
        let (first, second) = (accepts(a, p), accepts(b, q));
        if first == second {
            continue;
        }
        let state = StateId(u32::try_from(i).map_err(|_| Failure::Stopped(StopReason::MaxStates))?);
        let message = Message::new("product.accepting")
            .with("state", state.0)
            .with("only", if first { "first" } else { "second" });
        pairs
            .push(trace, message, Change::Accepting { state })
            .map_err(Failure::Stopped)?;
        accepting.push(state);
    }

    let states = (0..pairs.list.len()).map(|i| StateId(i as u32)).collect();
    Fsm::new(
        FsmKind::Dfsm,
        a.alphabet.clone(),
        states,
        Some(start),
        accepting,
        transitions,
    )
    .map_err(Failure::Message)
}

/// The XOR of two machines, in three stages (a stage that has nothing to do is skipped). Returns an
/// error message if a machine has no start state or the alphabets do not have the same symbols
/// (in any order). The `budget` applies to each `determinize` call and to the product.
pub fn xor(a: &Fsm, b: &Fsm, budget: ConversionBudget) -> Result<Xor, Message> {
    let no_start = |side: &str| Message::new("xor.no_start_state").with("side", side);
    a.start.ok_or_else(|| no_start("first"))?;
    b.start.ok_or_else(|| no_start("second"))?;
    a.alphabet
        .match_by_name(&b.alphabet, "xor.alphabet_mismatch", ("first", "second"))?;
    let budget = ConversionBudget {
        max_states: budget.max_states.min(MAX_STATES),
        ..budget
    };
    let mut trace = Vec::new();
    let run = |trace: &mut Vec<ConversionStep>| -> Result<Fsm, Failure> {
        let d1 = make_complete(a, budget, 1, "xor.stage.complete_first", trace)?;
        let d2 = make_complete(b, budget, 2, "xor.stage.complete_second", trace)?;
        // The two complete DFSMs have the same symbol names, maybe in another order.
        let map = d1.alphabet.match_by_name(
            &d2.alphabet,
            "xor.alphabet_mismatch",
            ("first", "second"),
        )?;
        stage(trace, 3, "xor.stage.product", vec![d1.clone(), d2.clone()]);
        product(&d1, &d2, &map, budget, trace)
    };
    match run(&mut trace) {
        Ok(fsm) => Ok(Xor::Finished { fsm, trace }),
        Err(Failure::Stopped(reason)) => Ok(Xor::Stopped {
            reason,
            partial_trace: trace,
        }),
        Err(Failure::Message(m)) => Err(m),
    }
}
