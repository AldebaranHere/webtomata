# 0034. Pushdown automaton (PDA) data model, JSON schema, validation, and determinism

Status: accepted (2026-11-05).

## Context

Pushdown automata (PDAs) extend finite state machines with an unbounded LIFO stack to recognize context-free languages (Elaine Rich Chapter 12; course slides Slide12 and Slide13).

The engine requires an exact, minimal, and secure representation of PDAs as plain data, adhering to course conventions and textbook theory:
1. Transitions in course lecture slides use the notation `((q1, c, γ1), (q2, γ2))` where reading symbol `c` (or $\varepsilon$) pops stack string `γ1` (or nothing) and pushes stack string `γ2` (or nothing).
2. The course grader and slides specify that the stack starts **empty** without an automatic bottom-of-stack marker. Machines written for JFLAP often expect an initial symbol ($Z$ or $Z_0$) to be present; without it, such transitions can never fire.
3. Acceptance semantics in the course require $(q, \varepsilon, \varepsilon)$ with $q \in A$: input exhausted, stack empty, and machine in an accepting state. There is no alternative "accept by final state with non-empty stack" mode.
4. Non-determinism is the general default for PDAs (NDPDA). A deterministic PDA (DPDA) is the special case where no two transitions compete from any state. Unlike finite automata, not all context-free languages have a DPDA, so no NDPDA-to-DPDA conversion exists in general.

## Decision

- **Dedicated Engine Module:**
  Implemented in `crates/engine-core/src/pda.rs` with API endpoints `load_pda`, `validate_pda`, and `pda_determinism` in `crates/engine-core/src/api.rs`, exposed to the browser via `crates/engine-wasm/src/lib.rs` and typed RPC contracts in `web/src/lib/engine/protocol.ts`.
- **Data Model:**
  - `Pda`: contains `kind: PdaKind` (`Dpda` or `Ndpda`), `input: Alphabet`, `stack: Alphabet`, `states: Vec<StateId>`, `start: Option<StateId>`, `accepting: Vec<StateId>`, and canonical sorted `transitions: Vec<PdaTransition>`.
  - `PdaTransition`: `from: StateId`, `read: Option<SymbolId>`, `pop: Vec<SymbolId>`, `push: Vec<SymbolId>`, `to: StateId`.
  - Symbols in both input and stack alphabets reuse the existing `Alphabet` interned storage (names up to 32 characters, allowing names like `Z0`, `S0`, `T_a`).
  - Stack strings `pop` and `push` are ordered top-first (index 0 is the top of the stack). A transition with `pop = []` checks nothing on the stack and applies whether the stack is empty or non-empty.
  - Sorting: `states` and `accepting` are sorted and deduplicated; `transitions` are sorted by `(from, read, pop, push, to)` with $\varepsilon$ (`read: None`) sorting before terminal symbols.
- **Limits:**
  - Reuses `MAX_STATES = 2_000`, `MAX_SYMBOLS = 256`, and `MAX_TRANSITIONS = 100_000`.
  - Adds `MAX_PDA_STRING = 64` for the maximum length of any single `pop` or `push` list.
- **Untrusted JSON Schema (`schemaVersion: 1`):**
  - Payload capped at `MAX_JSON_BYTES = 1 MB`, unknown fields denied (`deny_unknown_fields`), and schema version checked prior to full deserialization.
  - Wire format maps symbol ids to their string names; $\varepsilon$ read is represented as `null`.
- **Determinism Check:**
  - `determinism(&Pda) -> Vec<Competition>` identifies all pairs of transitions from the same state that compete:
    Two transitions $t_1, t_2$ of state $q$ compete iff:
    1. Their read symbols match ($t_1.read == t_2.read$ or at least one reads $\varepsilon$), AND
    2. One transition's pop string is a prefix of the other's (where empty list `[]` is a prefix of every list).
  - Empty competition list implies the machine is deterministic.
- **Validation Rules (`validate_pda`):**
  - Errors: `pda.no_start_state`.
  - Warnings: `pda.no_accepting_state`, `pda.unreachable_state { state }`, `pda.duplicate_transition { from }`, and `pda.pop_never_pushed { from, symbol }` (identifies stack symbols popped by a transition that cannot be reached/pushed starting from an empty stack, catching JFLAP bottom-marker mismatches).
  - DPDA-only checks:
    - Error `pda.competing_transitions { from, first, second }` for every competing pair.
    - Error `pda.accepting_state_free_move { state }` for any transition exiting an accepting state that reads nothing ($\varepsilon$) and pops nothing (`[]`).

## Consequences

- The engine now has a sound, mathematically grounded, and canonical representation for pushdown automata matching Fasilkom UI course slides and Elaine Rich's textbook.
- JFLAP-style bottom-marker assumptions are caught immediately by validation warnings (`pda.pop_never_pushed`).
- Determinism and non-determinism are strictly verified through pairwise prefix and $\varepsilon$-read competition rules.
- Types and validation results are fully typed in TypeScript via `ts-rs`.

