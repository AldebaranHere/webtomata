//! Versioned JSON for machines (`"schemaVersion": 1`). Symbols appear by name and
//! ε is `null`. Input is untrusted: size and structure are checked, and nothing here panics.

use crate::fsm::{Alphabet, Fsm, FsmKind, StateId, SymbolId, Transition, limit_exceeded};
use crate::message::Message;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub const MAX_JSON_BYTES: usize = 1024 * 1024;
const SCHEMA_VERSION: u32 = 1;

/// The machine file. In TypeScript it is the type `Machine`.
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(rename = "Machine"))]
pub(crate) struct Wire {
    schema_version: u32,
    kind: FsmKind,
    alphabet: Vec<String>,
    states: Vec<u32>,
    // `deserialize_with` makes the field required even though it may be null.
    #[serde(deserialize_with = "Option::deserialize")]
    start: Option<u32>,
    accepting: Vec<u32>,
    transitions: Vec<WireTransition>,
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(rename = "MachineTransition"))]
pub(crate) struct WireTransition {
    from: u32,
    #[serde(deserialize_with = "Option::deserialize")]
    on: Option<String>,
    to: u32,
}

fn parse_error(e: serde_json::Error) -> Message {
    let key = if e.is_data() {
        "machine.invalid_structure"
    } else {
        "machine.json_invalid"
    };
    Message::new(key)
        .with("line", e.line())
        .with("column", e.column())
}

impl Fsm {
    pub fn from_json(input: &str) -> Result<Fsm, Message> {
        if input.len() > MAX_JSON_BYTES {
            return Err(limit_exceeded("bytes", MAX_JSON_BYTES));
        }
        // Read the version first so a future schema gets a clear error, not a shape error.
        let value: serde_json::Value = serde_json::from_str(input).map_err(parse_error)?;
        match value
            .get("schemaVersion")
            .and_then(serde_json::Value::as_i64)
        {
            Some(1) => {}
            Some(found) => {
                return Err(Message::new("machine.unsupported_schema_version").with("found", found));
            }
            None => return Err(Message::new("machine.invalid_structure")),
        }
        let wire: Wire = serde_json::from_str(input).map_err(parse_error)?;

        let alphabet = Alphabet::new(wire.alphabet)?;
        let ids: HashMap<&str, SymbolId> = alphabet
            .names()
            .iter()
            .zip(0u16..)
            .map(|(name, i)| (name.as_str(), SymbolId(i)))
            .collect();
        let transitions = wire
            .transitions
            .into_iter()
            .map(|t| {
                let on = match t.on {
                    None => None,
                    Some(name) => match ids.get(name.as_str()) {
                        Some(&id) => Some(id),
                        None => {
                            return Err(Message::new("machine.unknown_symbol").with("symbol", name));
                        }
                    },
                };
                Ok(Transition {
                    from: StateId(t.from),
                    on,
                    to: StateId(t.to),
                })
            })
            .collect::<Result<Vec<_>, Message>>()?;
        drop(ids);

        Fsm::new(
            wire.kind,
            alphabet,
            wire.states.into_iter().map(StateId).collect(),
            wire.start.map(StateId),
            wire.accepting.into_iter().map(StateId).collect(),
            transitions,
        )
    }

    /// The machine file, with sorted lists.
    fn to_wire(&self) -> Wire {
        let mut states = self.states.clone();
        let mut accepting = self.accepting.clone();
        let mut transitions = self.transitions.clone();
        states.sort_unstable();
        accepting.sort_unstable();
        transitions.sort_unstable();
        Wire {
            schema_version: SCHEMA_VERSION,
            kind: self.kind,
            alphabet: self.alphabet.names().to_vec(),
            states: states.iter().map(|s| s.0).collect(),
            start: self.start.map(|s| s.0),
            accepting: accepting.iter().map(|s| s.0).collect(),
            transitions: transitions
                .iter()
                .map(|t| WireTransition {
                    from: t.from.0,
                    on: t.on.and_then(|s| self.alphabet.name(s)).map(str::to_owned),
                    to: t.to.0,
                })
                .collect(),
        }
    }

    /// Canonical JSON: sorted lists, so the same machine always gives the same text.
    pub fn to_json(&self) -> String {
        serde_json::to_string(&self.to_wire()).expect("plain data always serializes")
    }
}

impl Serialize for Fsm {
    /// A machine serializes as the machine file.
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        self.to_wire().serialize(serializer)
    }
}
