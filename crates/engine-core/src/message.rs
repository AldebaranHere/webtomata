//! The engine never writes sentences. It returns a message key plus parameters,
//! and the UI turns them into text in the user's language.

use serde::Serialize;
use std::collections::BTreeMap;

/// A message parameter.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(untagged)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub enum Param {
    Int(i64),
    Text(String),
}

impl From<i64> for Param {
    fn from(n: i64) -> Self {
        Param::Int(n)
    }
}

impl From<u32> for Param {
    fn from(n: u32) -> Self {
        Param::Int(n.into())
    }
}

impl From<usize> for Param {
    fn from(n: usize) -> Self {
        Param::Int(i64::try_from(n).unwrap_or(i64::MAX))
    }
}

impl From<&str> for Param {
    fn from(s: &str) -> Self {
        Param::Text(s.to_owned())
    }
}

impl From<String> for Param {
    fn from(s: String) -> Self {
        Param::Text(s)
    }
}

/// A message key such as `machine.unknown_state` with named parameters.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct Message {
    pub key: &'static str,
    pub params: BTreeMap<&'static str, Param>,
}

impl Message {
    pub fn new(key: &'static str) -> Self {
        Message {
            key,
            params: BTreeMap::new(),
        }
    }

    pub fn with(mut self, name: &'static str, value: impl Into<Param>) -> Self {
        self.params.insert(name, value.into());
        self
    }
}
