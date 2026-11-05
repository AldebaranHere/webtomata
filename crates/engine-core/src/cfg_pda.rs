//! CFG to PDA top-down conversion (Slide13, page 4).

use std::collections::{BTreeSet, HashSet};

use crate::fsm::{Alphabet, StateId, limit_exceeded};
use crate::grammar::{Grammar, Symbol};
use crate::message::Message;
use crate::pda::{MAX_PDA_STRING, Pda, PdaKind, PdaTransition, PdaWireTransition};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct StateName {
    pub id: StateId,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct CfgPdaStep {
    pub transition: PdaWireTransition,
    pub message: Message,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct CfgToPda {
    #[cfg_attr(feature = "ts", ts(as = "crate::pda::PdaWire"))]
    pub pda: Pda,
    pub states: Vec<StateName>,
    pub steps: Vec<CfgPdaStep>,
}

/// Converts a context-free grammar to an equivalent PDA top-down.
pub fn cfg_to_pda_topdown(grammar: &Grammar) -> Result<CfgToPda, Message> {
    // 1. Input alphabet: sorted terminals
    let terminals = grammar.terminals();
    let terminal_names: BTreeSet<String> = terminals.iter().map(|c| c.to_string()).collect();
    let input = Alphabet::new(terminal_names.iter().cloned().collect::<Vec<_>>())?;

    // 2. Variables and Name clash check (Decision 4)
    let variables = grammar.variables();
    for var in &variables {
        if terminal_names.contains(var) {
            return Err(Message::new("pda.cfg.symbol_clash").with("symbol", var.clone()));
        }
    }

    // 3. Stack alphabet: ONE list (variables and terminals together) sorted by name in byte order
    let mut stack_names_set = BTreeSet::new();
    for var in variables {
        stack_names_set.insert(var);
    }
    for term_name in terminal_names {
        stack_names_set.insert(term_name);
    }
    let stack = Alphabet::new(stack_names_set.into_iter().collect::<Vec<_>>())?;

    // 4. States: p = 0 (start), q = 1 (accepting)
    let p = StateId(0);
    let q = StateId(1);
    let state_names = vec![
        StateName {
            id: p,
            name: "p".to_string(),
        },
        StateName {
            id: q,
            name: "q".to_string(),
        },
    ];

    let mut transitions = Vec::new();
    let mut steps = Vec::new();

    // Step 1: Start transition: ((p, ε, ε), (q, S))
    let start_id = stack
        .id(&grammar.start)
        .expect("start variable is in stack alphabet");
    transitions.push(PdaTransition {
        from: p,
        read: None,
        pop: vec![],
        push: vec![start_id],
        to: q,
    });
    steps.push(CfgPdaStep {
        transition: PdaWireTransition {
            from: p.0,
            read: None,
            pop: vec![],
            push: vec![grammar.start.clone()],
            to: q.0,
        },
        message: Message::new("cfg_pda.top_down.start"),
    });

    // Step 2: Rule transitions: ((q, ε, X), (q, γ1…γn))
    // Duplicate rules are merged (Decision 5).
    let mut seen_rules = HashSet::new();
    for rule in &grammar.rules {
        if !seen_rules.insert((rule.head.clone(), rule.body.clone())) {
            continue;
        }

        if rule.body.len() > MAX_PDA_STRING {
            return Err(limit_exceeded("pda_string", MAX_PDA_STRING));
        }

        let head_id = stack
            .id(&rule.head)
            .expect("rule head is in stack alphabet");

        let mut push_ids = Vec::with_capacity(rule.body.len());
        let mut push_names = Vec::with_capacity(rule.body.len());

        for sym in &rule.body {
            let name = match sym {
                Symbol::Terminal(c) => c.to_string(),
                Symbol::NonTerminal(nt) => nt.clone(),
            };
            let sym_id = stack.id(&name).expect("symbol is in stack alphabet");
            push_ids.push(sym_id);
            push_names.push(name);
        }

        transitions.push(PdaTransition {
            from: q,
            read: None,
            pop: vec![head_id],
            push: push_ids,
            to: q,
        });
        steps.push(CfgPdaStep {
            transition: PdaWireTransition {
                from: q.0,
                read: None,
                pop: vec![rule.head.clone()],
                push: push_names,
                to: q.0,
            },
            message: Message::new("cfg_pda.top_down.rule").with("rule", rule.to_string()),
        });
    }

    // Step 3: Terminal transitions: ((q, c, c), (q, ε))
    for c in terminals {
        let term_str = c.to_string();
        let read_id = input.id(&term_str).expect("terminal is in input alphabet");
        let pop_id = stack.id(&term_str).expect("terminal is in stack alphabet");

        transitions.push(PdaTransition {
            from: q,
            read: Some(read_id),
            pop: vec![pop_id],
            push: vec![],
            to: q,
        });
        steps.push(CfgPdaStep {
            transition: PdaWireTransition {
                from: q.0,
                read: Some(term_str.clone()),
                pop: vec![term_str.clone()],
                push: vec![],
                to: q.0,
            },
            message: Message::new("cfg_pda.top_down.terminal").with("symbol", term_str),
        });
    }

    let pda = Pda::new(
        PdaKind::Ndpda,
        input,
        stack,
        vec![p, q],
        Some(p),
        vec![q],
        transitions,
    )?;

    Ok(CfgToPda {
        pda,
        states: state_names,
        steps,
    })
}
