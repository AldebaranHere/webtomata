//! Reading and writing JFLAP `.jff` files for finite automata (XML). Files are untrusted input:
//! the size is limited, DTDs are refused, and every problem comes back as a message.
//!
//! A file holds `<state id name>` elements (with `<x>`, `<y>`, `<initial/>`, `<final/>`) and
//! `<transition>` elements (`<from>`, `<to>`, `<read>`). An empty `<read/>` is an ε-transition.
//! There is no alphabet in the file: it is the set of characters that the transitions read.
//! JFLAP reads a label of several characters one character after the other, so on import such a
//! transition becomes a chain of transitions through new states, and a note says so. A symbol
//! with several characters cannot be written back, because JFLAP has no such thing.

use crate::fsm::{Alphabet, Fsm, FsmKind, MAX_STATES, StateId, Transition};
use crate::message::Message;
use roxmltree::{Document, Node, ParsingOptions};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, HashMap, HashSet};
use std::fmt::Write;
use std::str::FromStr;

pub const MAX_JFF_BYTES: usize = 1024 * 1024;

/// A state as the file describes it. Names and positions belong to the UI, not to the machine.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct JffState {
    pub id: StateId,
    pub name: String,
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct Jff {
    #[cfg_attr(feature = "ts", ts(as = "crate::json::Wire"))]
    pub fsm: Fsm,
    /// Every state of the machine, by id. This includes the states that were added for labels with
    /// several characters.
    pub states: Vec<JffState>,
    /// What was changed on import, for example `jff.label_expanded { label, from, to }`.
    pub notes: Vec<Message>,
}

fn limit_exceeded(what: &str, limit: usize) -> Message {
    Message::new("machine.limit_exceeded")
        .with("what", what)
        .with("limit", limit)
}

fn child<'a, 'i>(node: Node<'a, 'i>, name: &str) -> Option<Node<'a, 'i>> {
    node.children()
        .find(|c| c.is_element() && c.tag_name().name() == name)
}

fn children<'a, 'i>(node: Node<'a, 'i>, name: &'a str) -> impl Iterator<Item = Node<'a, 'i>> + 'a {
    node.children()
        .filter(move |c| c.is_element() && c.tag_name().name() == name)
}

/// Reads a text element as `T`, or says which element is wrong.
fn number<T: FromStr>(
    parent: Node,
    name: &str,
    bad: &dyn Fn(&str, Node) -> Message,
) -> Result<T, Message> {
    let node = child(parent, name).ok_or_else(|| bad(name, parent))?;
    node.text()
        .unwrap_or("")
        .trim()
        .parse()
        .map_err(|_| bad(name, node))
}

fn coordinate(node: Node, name: &str, bad: &dyn Fn(&str, Node) -> Message) -> Result<f64, Message> {
    match child(node, name) {
        None => Ok(0.0),
        Some(c) => match c.text().unwrap_or("").trim().parse::<f64>() {
            Ok(v) if v.is_finite() => Ok(v),
            _ => Err(bad(name, c)),
        },
    }
}

/// Reads a `.jff` file of type `fa`.
pub fn parse_jff(xml: &str) -> Result<Jff, Message> {
    if xml.len() > MAX_JFF_BYTES {
        return Err(limit_exceeded("bytes", MAX_JFF_BYTES));
    }
    let options = ParsingOptions {
        allow_dtd: false,
        nodes_limit: 200_000,
        entity_resolver: None,
    };
    let doc = Document::parse_with_options(xml, options).map_err(|e| {
        let at = e.pos();
        Message::new("jff.xml_invalid")
            .with("line", at.row)
            .with("column", at.col)
    })?;
    let bad = |element: &str, node: Node| {
        Message::new("jff.invalid_structure")
            .with("element", element)
            .with("line", doc.text_pos_at(node.range().start).row)
    };

    let root = doc.root_element();
    if root.tag_name().name() != "structure" {
        return Err(bad("structure", root));
    }
    let kind = child(root, "type").ok_or_else(|| bad("type", root))?;
    let kind = kind.text().unwrap_or("").trim();
    if kind != "fa" {
        let shown: String = kind.chars().take(32).collect();
        return Err(Message::new("jff.unsupported_type").with("type", shown));
    }
    let automaton = child(root, "automaton").ok_or_else(|| bad("automaton", root))?;

    // States.
    let mut states: Vec<JffState> = Vec::new();
    let mut starts = Vec::new();
    let mut accepting = Vec::new();
    for node in children(automaton, "state") {
        let id = node
            .attribute("id")
            .and_then(|v| v.trim().parse::<u32>().ok())
            .map(StateId)
            .ok_or_else(|| bad("state", node))?;
        if states.len() >= MAX_STATES {
            return Err(limit_exceeded("states", MAX_STATES));
        }
        let name = node
            .attribute("name")
            .map_or_else(|| format!("q{}", id.0), str::to_owned);
        states.push(JffState {
            id,
            name,
            x: coordinate(node, "x", &bad)?,
            y: coordinate(node, "y", &bad)?,
        });
        if child(node, "initial").is_some() {
            starts.push(id);
        }
        if child(node, "final").is_some() {
            accepting.push(id);
        }
    }
    if starts.len() > 1 {
        return Err(Message::new("jff.multiple_initial_states"));
    }

    // Transitions. A label of several characters becomes a chain through new states.
    let mut next_id = states
        .iter()
        .map(|s| s.id.0)
        .max()
        .map_or(Some(0), |m| m.checked_add(1))
        .ok_or_else(|| limit_exceeded("states", MAX_STATES))?;
    let position: HashMap<StateId, (f64, f64)> =
        states.iter().rev().map(|s| (s.id, (s.x, s.y))).collect();
    let mut notes = Vec::new();
    let mut edges: Vec<(StateId, Option<char>, StateId)> = Vec::new();
    for node in children(automaton, "transition") {
        let from = StateId(number(node, "from", &bad)?);
        let to = StateId(number(node, "to", &bad)?);
        let read = child(node, "read").ok_or_else(|| bad("read", node))?;
        let label: Vec<char> = read.text().unwrap_or("").chars().collect();
        match label.as_slice() {
            [] => edges.push((from, None, to)),
            [c] => edges.push((from, Some(*c), to)),
            _ => {
                let extra = label.len() - 1;
                if states.len() + extra > MAX_STATES {
                    return Err(limit_exceeded("states", MAX_STATES));
                }
                notes.push(
                    Message::new("jff.label_expanded")
                        .with("label", label.iter().collect::<String>())
                        .with("from", from.0)
                        .with("to", to.0),
                );
                let (x1, y1) = position.get(&from).copied().unwrap_or((0.0, 0.0));
                let (x2, y2) = position.get(&to).copied().unwrap_or((0.0, 0.0));
                let mut before = from;
                for (i, c) in label.iter().enumerate() {
                    let after = if i == extra {
                        to
                    } else {
                        let id = StateId(next_id);
                        next_id = next_id
                            .checked_add(1)
                            .ok_or_else(|| limit_exceeded("states", MAX_STATES))?;
                        let t = (i + 1) as f64 / label.len() as f64;
                        states.push(JffState {
                            id,
                            name: format!("m{}", id.0),
                            x: x1 + (x2 - x1) * t,
                            y: y1 + (y2 - y1) * t,
                        });
                        id
                    };
                    edges.push((before, Some(*c), after));
                    before = after;
                }
            }
        }
    }

    // The alphabet is the sorted set of characters that are read.
    let chars: Vec<char> = edges
        .iter()
        .filter_map(|e| e.1)
        .collect::<BTreeSet<char>>()
        .into_iter()
        .collect();
    let alphabet = Alphabet::new(chars.iter().map(char::to_string).collect())?;
    let transitions: Vec<Transition> = edges
        .iter()
        .map(|&(from, on, to)| Transition {
            from,
            on: on.and_then(|c| alphabet.id(&c.to_string())),
            to,
        })
        .collect();
    let mut seen = HashSet::new();
    let deterministic = edges
        .iter()
        .all(|&(from, on, _)| on.is_some_and(|c| seen.insert((from, c))));

    states.sort_by_key(|s| s.id);
    let fsm = Fsm::new(
        if deterministic {
            FsmKind::Dfsm
        } else {
            FsmKind::Ndfsm
        },
        alphabet,
        states.iter().map(|s| s.id).collect(),
        starts.first().copied(),
        accepting,
        transitions,
    )?;
    Ok(Jff { fsm, states, notes })
}

/// A character that XML 1.0 can hold.
fn xml_char(c: char) -> bool {
    matches!(c, '\t' | '\n' | '\r' | '\u{20}'..='\u{D7FF}' | '\u{E000}'..='\u{FFFD}' | '\u{10000}'..='\u{10FFFF}')
}

/// Escapes text for an element or an attribute. Characters that XML cannot hold become `?`, and
/// tabs and line breaks in names become spaces.
fn escape(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for c in text.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            '\t' | '\n' | '\r' => out.push(' '),
            c if xml_char(c) => out.push(c),
            _ => out.push('?'),
        }
    }
    out
}

/// Writes a `.jff` file. `layout` gives names and positions; a state with no entry gets the
/// name `q<id>` and a place on a grid. Returns an error message if a symbol has more than one
/// character, because JFLAP cannot hold it. Symbols that no transition reads are not written.
pub fn to_jff(fsm: &Fsm, layout: &[JffState]) -> Result<String, Message> {
    if let Some(symbol) = fsm.alphabet.names().iter().find(|n| n.chars().count() != 1) {
        return Err(Message::new("jff.symbol_not_single_character").with("symbol", symbol.as_str()));
    }
    let given: HashMap<StateId, &JffState> = layout.iter().map(|s| (s.id, s)).collect();
    let mut out = String::from(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\n<structure>\n\t<type>fa</type>\n\t<automaton>\n",
    );
    for (i, &id) in fsm.states.iter().enumerate() {
        let (name, x, y) = match given.get(&id) {
            Some(s) if s.x.is_finite() && s.y.is_finite() => (s.name.clone(), s.x, s.y),
            other => (
                other.map_or_else(|| format!("q{}", id.0), |s| s.name.clone()),
                100.0 + 130.0 * (i % 6) as f64,
                100.0 + 130.0 * (i / 6) as f64,
            ),
        };
        let _ = write!(
            out,
            "\t\t<state id=\"{}\" name=\"{}\">\n\t\t\t<x>{x:.1}</x>\n\t\t\t<y>{y:.1}</y>\n",
            id.0,
            escape(&name)
        );
        if fsm.start == Some(id) {
            out.push_str("\t\t\t<initial/>\n");
        }
        if fsm.accepting.binary_search(&id).is_ok() {
            out.push_str("\t\t\t<final/>\n");
        }
        out.push_str("\t\t</state>\n");
    }
    for t in &fsm.transitions {
        let _ = write!(
            out,
            "\t\t<transition>\n\t\t\t<from>{}</from>\n\t\t\t<to>{}</to>\n",
            t.from.0, t.to.0
        );
        match t.on.and_then(|s| fsm.alphabet.name(s)) {
            Some(symbol) => {
                let _ = writeln!(out, "\t\t\t<read>{}</read>", escape(symbol));
            }
            None => out.push_str("\t\t\t<read/>\n"),
        }
        out.push_str("\t\t</transition>\n");
    }
    out.push_str("\t</automaton>\n</structure>\n");
    Ok(out)
}
