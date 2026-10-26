# 0008. Regular expressions and regex → NDFSM

Status: accepted

## Context

E7 parses regular expressions and builds an NDFSM. The notation must match the course (Rich, textbook section 6.1; the slides `Regular1`), and the construction must follow `regextofsm` so students recognize each step.

## Decision

- Syntax: Rich's rules 1 to 8: `∅`, `ε`, a symbol, concatenation by writing expressions side by side, `∪` for union, `*`, `+` (one or more, the same as `αα*`) and parentheses. Precedence, highest first: star and plus, concatenation, union. Union and concatenation group to the left. Only `∪` is accepted for union (JFLAP's `+` and the programming `|` are not), so the notation stays one notation; the UI adds buttons and a note.
- Symbols: one character each if every symbol of the alphabet has one character; otherwise symbols are separated by spaces or operators (`(num plus)* num`). Spaces are ignored. If an alphabet symbol contains an operator character, parsing is refused with `regex.operator_symbol`.
- Limits: 1,000 characters (`regex.too_long`) and 100 levels of parentheses (`regex.too_deep`), so the recursive passes cannot overflow the stack.
- Errors carry the position in characters: `regex.empty`, `regex.unexpected { found, position }`, `regex.unexpected_end { position }`, `regex.unbalanced_parenthesis { position }` (the position of the unmatched parenthesis), `regex.unknown_symbol { symbol, position }`.
- `Regex` is a public tree with binary `Union` and `Concat`, so each node is one construction step. `to_text` writes it with only the needed parentheses.
- Construction (`regex_to_fsm`): Rich's `regextofsm`, from the primitive parts outwards: `∅` and `ε` are one state, a symbol is two states, union adds a start state with two ε-transitions, concatenation adds ε-transitions from the first machine's accepting states to the second's start, star adds an accepting start state and ε-transitions back. `α+` adds ε-transitions from the accepting states back to the start and no new state, which accepts one or more strings of the language without copying the machine. A property test checks that `r+` is equivalent to `rr*` using the E6 equivalence.
- Trace: one step for each part, with keys `regex.empty_set`, `.epsilon`, `.symbol { symbol }`, `.union`, `.concat`, `.star`, `.plus` (all with `expression`), and a `Fragment` change holding the new states, the new transitions, the start state, the accepting states and the text of the sub-expression. States are numbered in the order they are created.
- Budget: `max_states` (default and limit 2,000); on overflow, `Stopped { reason: max_states, partial_trace }`.

## Consequences

- E8 (FSM → regex) builds a `Regex` and can print it with `to_text`.
- The machines are highly nondeterministic with many ε-transitions, as the book says; `determinize` and `minimize` clean them up.
- The glyphs of `∪` and `ε` on the slides are still to be checked against the slide images (see `docs/notation.md`).
