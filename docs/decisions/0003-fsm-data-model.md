# 0003. FSM data model and JSON format

Status: accepted

## Context

The engine needs one machine type that the editor, the algorithms and share links all use. The editor sends half-built machines, so the model must be able to hold machines that validation (E2) will reject. Later versions may add PDAs, Turing machines and grammars, and may add a lecturer mode, so files must stay readable by future versions.

## Decision

- One raw type, `Fsm`, with `kind` (`dfsm` or `ndfsm`). Typed machines that are valid by construction can be added after E2. PDAs and others will be separate types next to it, selected by the same top-level `kind`.
- States are `u32` ids in an explicit sorted list (ids may be sparse, so deleting a state never renumbers the rest). Symbols are interned as `u16` positions in an `Alphabet`; a symbol may have several characters. ε is `None`. Names and canvas positions live in the UI document.
- Versioned JSON (`"schemaVersion": 1`): symbols appear by name, ε is `null`, `start` and `on` are required but nullable, unknown fields are rejected. Output is canonical (sorted), so equal machines give identical text. The loader reads the version first and reports `machine.unsupported_schema_version` for any other. Future versions get migrations; old files are never broken.
- The loader rejects what the model cannot represent: references to undeclared states or symbols, duplicate states or symbols, and symbols that are empty, `ε`, or contain whitespace or control characters.
- Untrusted input limits: 1 MiB of JSON, 2,000 states, 256 symbols (32 characters each), 100,000 transitions. Errors are `Message { key, params }` values, never sentences and never panics. Keys so far: `machine.json_invalid`, `machine.invalid_structure`, `machine.unsupported_schema_version`, `machine.limit_exceeded`, `machine.invalid_symbol`, `machine.duplicate_symbol`, `machine.duplicate_state`, `machine.unknown_state`, `machine.unknown_symbol`.

## Consequences

- E2 validates what the loader allows. `validate(&Fsm)` returns a list of `Issue { severity, message }` in a fixed order, stopping at 1,000 issues. Keys: `fsm.no_start_state`, `dfsm.missing_transition { state, symbol }`, `dfsm.duplicate_transition { state, symbol }`, `dfsm.epsilon_transition { from, to }` (errors); `fsm.unreachable_state { state }` and `fsm.too_many_issues { limit }` (warnings).
- The limits are starting values; E13 benchmarks may change them.
- Every message key needs `id` and `en` text in the UI (S1).
