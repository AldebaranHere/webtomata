# 0036. Pushdown automaton (PDA) JFLAP `.jff` import and export

Status: accepted (2026-11-05).

## Context

Students and instructors in formal language courses (e.g. Fasilkom UI Teori Bahasa dan Automata) use JFLAP alongside WebTomata. For finite state machines, ADR 0011 specified reading and writing `.jff` files with `<type>fa</type>`. To support pushdown automata, the engine must import and export `.jff` files with `<type>pda</type>`.

JFLAP PDA files have the following characteristics:
1. Root structure: `<structure><type>pda</type><automaton>` with `<state id name>` elements (containing `<x>`, `<y>`, optional `<initial/>` and `<final/>`) and `<transition>` elements containing `<from>`, `<to>`, `<read>`, `<pop>`, `<push>`.
2. Empty `<read/>`, `<pop/>`, or `<push/>` tags represent $\varepsilon$ (for read) and empty lists (for pop/push).
3. Pop and push strings: JFLAP reads pop and push strings one character per stack symbol, with the first (leftmost) character on top of the stack. E.g. `pop="Z0"` pops `Z` and then `0`; `push="aSb"` pushes `a`, `S`, and `b` leaving `a` on top. This matches WebTomata's PDA internal convention where index 0 is the top of the stack.
4. Input and stack alphabets: A `.jff` file contains no explicit alphabet definitions, no acceptance setting, and no determinism indicator.
5. Bottom-of-stack marker: JFLAP automatically pushes its own bottom marker `Z` at runtime. In contrast, following the course slides (Slide12), WebTomata starts with an empty stack and adds no implicit marker.

## Decision

- **Code Location and Sharing:**
  PDA import and export are implemented in `crates/engine-core/src/jff.rs` next to the FSM code. Parsing helpers (`child`, `children`, `number`, `coordinate`, `read_states`, `escape`, `xml_char`) are shared directly to maintain DRY code without modifying existing FSM behavior.
- **Import (`parse_pda_jff`):**
  - File size is capped at `MAX_JFF_BYTES` (1 MiB), DTDs are forbidden, and the node limit (200,000) applies.
  - The type must be exactly `pda`. Any other type yields `jff.unsupported_type { type }`. (The FSM `parse_jff` continues returning `jff.unsupported_type { type: "pda" }` so the editor can route accordingly).
  - Transitions require `<from>`, `<to>`, `<read>`, `<pop>`, and `<push>`; missing elements yield `jff.invalid_structure { element, line }`.
  - `<read>` with more than one character is rejected with `jff.pda_read_not_single { label, from, to }`. Unlike FSMs where multi-character labels are expanded into state chains, PDA transitions cannot be safely decomposed without altering stack semantics.
  - Each character in `<pop>` and `<push>` is one stack symbol (top of stack is the first character).
  - The input alphabet is the sorted unique set of characters read; the stack alphabet is the sorted unique set of characters popped or pushed.
  - The imported PDA is assigned `kind: Ndpda` (the user can toggle to `Dpda` in the editor).
  - State coordinates, IDs, names, and start/accepting markers are parsed into `Vec<JffState>`.
- **Bottom-of-Stack Marker Handling:**
  No bottom marker is added or removed during import or simulation. If a JFLAP file relies on an implicit bottom marker `Z` without pushing it first, `validate_pda` issues `pda.pop_never_pushed { from, symbol }` warnings and simulation will reject on an empty stack.
- **Export (`to_pda_jff`):**
  - Writes plain XML matching JFLAP structure (`<from>`, `<to>`, `<read>`, `<pop>`, `<push>`) without comments, using the XML declaration `<?xml version="1.0" encoding="UTF-8" standalone="no"?>`.
  - Empty lists and $\varepsilon$ are written as self-closed elements (`<read/>`, `<pop/>`, `<push/>`).
  - Characters in pop and push lists are serialized top-first.
  - If any input or stack symbol has more than one character, export fails with `jff.symbol_not_single_character { symbol }` because JFLAP cannot represent multi-character symbols. Consequently, PDAs generated from CFG conversions (tasks T-034/T-035) with multi-character helper variables (e.g. `S0`, `T_a`) cannot be exported to JFLAP.
  - Unused symbols and machine `kind` are omitted.

## Consequences

- Students can import JFLAP PDAs into WebTomata and export single-character PDAs back to JFLAP.
- Clear diagnostics warn students when imported machines rely on JFLAP's implicit bottom marker.
- Safety boundaries (`MAX_JFF_BYTES`, `MAX_STATES`, `MAX_PDA_STRING`) prevent memory exhaustion or panics on arbitrary or malformed input.
