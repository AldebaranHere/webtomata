//! PDA to restricted normal form (RNF) conversion (Slide13, pages 13–19).

use crate::cfg_pda::StateName;
use crate::fsm::{Alphabet, MAX_STATES, MAX_TRANSITIONS, StateId, SymbolId, limit_exceeded};
use crate::message::Message;
use crate::pda::{Pda, PdaKind, PdaTransition, PdaWireTransition};
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct RnfStep {
    pub removed: Option<PdaWireTransition>,
    pub added: Vec<PdaWireTransition>,
    pub message: Message,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct RnfResult {
    #[cfg_attr(feature = "ts", ts(as = "crate::pda::PdaWire"))]
    pub pda: Pda,
    pub new_states: Vec<StateName>,
    pub steps: Vec<RnfStep>,
}

fn to_wire(
    t: &PdaTransition,
    input: &Alphabet,
    stack: &Alphabet,
) -> Result<PdaWireTransition, Message> {
    let read = match t.read {
        Some(sym) => Some(
            input
                .name(sym)
                .ok_or_else(|| {
                    Message::new("machine.unknown_symbol").with("symbol", sym.0.to_string())
                })?
                .to_owned(),
        ),
        None => None,
    };
    let mut pop = Vec::with_capacity(t.pop.len());
    for &sym in &t.pop {
        let name = stack.name(sym).ok_or_else(|| {
            Message::new("machine.unknown_symbol").with("symbol", sym.0.to_string())
        })?;
        pop.push(name.to_owned());
    }
    let mut push = Vec::with_capacity(t.push.len());
    for &sym in &t.push {
        let name = stack.name(sym).ok_or_else(|| {
            Message::new("machine.unknown_symbol").with("symbol", sym.0.to_string())
        })?;
        push.push(name.to_owned());
    }
    Ok(PdaWireTransition {
        from: t.from.0,
        read,
        pop,
        push,
        to: t.to.0,
    })
}

/// Converts a PDA to restricted normal form (RNF) with an incremental step trace.
pub fn pda_to_rnf(pda: &Pda) -> Result<RnfResult, Message> {
    // 1. Input checks (Decision 1)
    let orig_start = pda
        .start
        .ok_or_else(|| Message::new("pda.rnf.no_start_state"))?;

    for i in 0..pda.stack.len() {
        if let Some("#") = pda.stack.name(SymbolId(i as u16)) {
            return Err(Message::new("pda.rnf.marker_clash").with("symbol", "#".to_string()));
        }
    }

    // 2. Alphabets (Decision 2)
    let new_input = pda.input.clone();
    let mut stack_names = pda.stack.names().to_vec();
    stack_names.push("#".to_string());
    let new_stack = Alphabet::new(stack_names)?;
    let marker_id = SymbolId(pda.stack.len() as u16);

    // 3. New state IDs & checked arithmetic (Decision 3)
    let max_id = pda.states.iter().map(|s| s.0).max().unwrap_or(0);
    let s_prime_id = max_id
        .checked_add(1)
        .ok_or_else(|| limit_exceeded("states", MAX_STATES))?;
    let a_id = max_id
        .checked_add(2)
        .ok_or_else(|| limit_exceeded("states", MAX_STATES))?;

    let s_prime = StateId(s_prime_id);
    let a = StateId(a_id);

    let mut new_states = vec![
        StateName {
            id: s_prime,
            name: "s'".to_string(),
        },
        StateName {
            id: a,
            name: "a".to_string(),
        },
    ];

    let mut next_v_id = max_id
        .checked_add(3)
        .ok_or_else(|| limit_exceeded("states", MAX_STATES))?;
    let mut v_counter: usize = 1;

    let mut steps = Vec::new();
    let mut all_transitions = Vec::new();

    // 4 (a). Step 2: Start transition ((s', ε, []), (orig_start, [#]))
    let start_transition = PdaTransition {
        from: s_prime,
        read: None,
        pop: Vec::new(),
        push: vec![marker_id],
        to: orig_start,
    };
    let start_wire = to_wire(&start_transition, &new_input, &new_stack)?;
    steps.push(RnfStep {
        removed: None,
        added: vec![start_wire],
        message: Message::new("pda.rnf.start"),
    });
    all_transitions.push(start_transition);

    // 4 (b). Step 3: Accept transitions ((qk, ε, [#]), (a, [])) for qk in pda.accepting
    for &qk in &pda.accepting {
        let accept_trans = PdaTransition {
            from: qk,
            read: None,
            pop: vec![marker_id],
            push: Vec::new(),
            to: a,
        };
        let accept_wire = to_wire(&accept_trans, &new_input, &new_stack)?;
        steps.push(RnfStep {
            removed: None,
            added: vec![accept_wire],
            message: Message::new("pda.rnf.accept").with("state", qk.0),
        });
        all_transitions.push(accept_trans);
    }

    // 4 (c). Step 4: Multi-pop split transitions (pop.len() >= 2)
    for t in &pda.transitions {
        if t.pop.len() >= 2 {
            let n = t.pop.len();
            let mut split_trans = Vec::with_capacity(n);
            let mut split_wires = Vec::with_capacity(n);

            let mut prev_state = t.from;
            for i in 0..(n - 1) {
                let v_id = next_v_id;
                next_v_id = next_v_id
                    .checked_add(1)
                    .ok_or_else(|| limit_exceeded("states", MAX_STATES))?;

                let v_state = StateId(v_id);
                new_states.push(StateName {
                    id: v_state,
                    name: format!("v{v_counter}"),
                });
                v_counter += 1;

                // Pre-check MAX_STATES
                if pda.states.len() + new_states.len() > MAX_STATES {
                    return Err(limit_exceeded("states", MAX_STATES));
                }

                let trans = PdaTransition {
                    from: prev_state,
                    read: None,
                    pop: vec![t.pop[i]],
                    push: Vec::new(),
                    to: v_state,
                };
                split_wires.push(to_wire(&trans, &new_input, &new_stack)?);
                split_trans.push(trans);
                prev_state = v_state;
            }

            // The last transition reads the original input symbol and pushes gammaP
            let last_trans = PdaTransition {
                from: prev_state,
                read: t.read,
                pop: vec![t.pop[n - 1]],
                push: t.push.clone(),
                to: t.to,
            };
            split_wires.push(to_wire(&last_trans, &new_input, &new_stack)?);
            split_trans.push(last_trans);

            steps.push(RnfStep {
                removed: Some(to_wire(t, &new_input, &new_stack)?),
                added: split_wires,
                message: Message::new("pda.rnf.split")
                    .with("from", t.from.0)
                    .with("to", t.to.0)
                    .with("pops", n as u32),
            });
            all_transitions.extend(split_trans);
        }
    }

    // Pre-check result transition count before building expanded transitions in step 5
    let single_pop_count = pda.transitions.iter().filter(|t| t.pop.len() == 1).count();
    let pop_nothing_count = pda.transitions.iter().filter(|t| t.pop.is_empty()).count();
    let mut multi_pop_sum = 0usize;
    for t in &pda.transitions {
        if t.pop.len() >= 2 {
            multi_pop_sum = multi_pop_sum
                .checked_add(t.pop.len())
                .ok_or_else(|| limit_exceeded("transitions", MAX_TRANSITIONS))?;
        }
    }
    let expanded_count = pop_nothing_count
        .checked_mul(new_stack.len())
        .ok_or_else(|| limit_exceeded("transitions", MAX_TRANSITIONS))?;
    let total_transitions = 1usize
        .checked_add(pda.accepting.len())
        .and_then(|n| n.checked_add(single_pop_count))
        .and_then(|n| n.checked_add(multi_pop_sum))
        .and_then(|n| n.checked_add(expanded_count))
        .ok_or_else(|| limit_exceeded("transitions", MAX_TRANSITIONS))?;
    if total_transitions > MAX_TRANSITIONS {
        return Err(limit_exceeded("transitions", MAX_TRANSITIONS));
    }

    // 4 (d). Step 5: Expand pop-nothing transitions (pop.len() == 0)
    for t in &pda.transitions {
        if t.pop.is_empty() {
            let mut expand_trans = Vec::with_capacity(new_stack.len());
            let mut expand_wires = Vec::with_capacity(new_stack.len());

            for sym_idx in 0..new_stack.len() {
                let gamma_0 = SymbolId(sym_idx as u16);
                let mut push = t.push.clone();
                push.push(gamma_0);

                let trans = PdaTransition {
                    from: t.from,
                    read: t.read,
                    pop: vec![gamma_0],
                    push,
                    to: t.to,
                };
                expand_wires.push(to_wire(&trans, &new_input, &new_stack)?);
                expand_trans.push(trans);
            }

            steps.push(RnfStep {
                removed: Some(to_wire(t, &new_input, &new_stack)?),
                added: expand_wires,
                message: Message::new("pda.rnf.expand")
                    .with("from", t.from.0)
                    .with("to", t.to.0),
            });
            all_transitions.extend(expand_trans);
        }
    }

    // 4 (e). Retain single-pop transitions (pop.len() == 1)
    for t in &pda.transitions {
        if t.pop.len() == 1 {
            all_transitions.push(t.clone());
        }
    }

    // Combine all states
    let mut all_states = pda.states.clone();
    for ns in &new_states {
        all_states.push(ns.id);
    }

    if all_states.len() > MAX_STATES {
        return Err(limit_exceeded("states", MAX_STATES));
    }
    if all_transitions.len() > MAX_TRANSITIONS {
        return Err(limit_exceeded("transitions", MAX_TRANSITIONS));
    }

    let result_pda = Pda::new(
        PdaKind::Ndpda,
        new_input,
        new_stack,
        all_states,
        Some(s_prime),
        vec![a],
        all_transitions,
    )?;

    Ok(RnfResult {
        pda: result_pda,
        new_states,
        steps,
    })
}
