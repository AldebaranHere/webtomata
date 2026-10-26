# Notation

The engine is notation-neutral. Labels below live only in the UI and message files. The default is Rich (the course textbook); Sipser is an option in the notation switch (S1).

| Concept          | Rich (default)                                                                                 | Sipser                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| DFSM / DFA       | M = (K, Σ, δ, s, A)                                                                            | M = (Q, Σ, δ, q₀, F)                                                   |
| NDFSM / NFA      | M = (K, Σ, Δ, s, A)                                                                            | N = (Q, Σ, δ, q₀, F), δ: Q × Σε → P(Q)                                 |
| States           | K                                                                                              | Q                                                                      |
| Start state      | s                                                                                              | q₀                                                                     |
| Accepting states | A                                                                                              | F                                                                      |
| Transition       | δ(q, a) = p (function); Δ is a relation                                                        | δ(q, a) = p (function); NFA gives a set                                |
| Configuration    | (q, w) in K × Σ\*, with the yields relation ⊢                                                  | not used                                                               |
| Empty string     | ε                                                                                              | ε                                                                      |
| Regex operators  | union ∪, concatenation (side by side), Kleene star \*, plus + (one or more), ε, ∅, parentheses | union ∪, concatenation, star \*, plus + (R⁺ = RR\*), ε, ∅, parentheses |

## Regular expressions

The engine reads Rich's syntax (textbook section 6.1, rules 1 to 8) and writes it back in the same form: `∅`, `ε`, a symbol, concatenation by writing symbols side by side, `α∪β`, `α*`, `α+` (the same as `αα*`) and parentheses. Precedence, highest first: star and plus, concatenation, union. If every symbol has one character, each character is a symbol; otherwise symbols are separated by spaces, for example `(num plus)* num`.

Only `∪` is accepted for union. The UI offers buttons for `∪`, `ε` and `∅`, and a small note that other tools write union differently: JFLAP uses `+` (and `!` for ε), and programming languages use `|`. Here `+` always means "one or more".

The slides draw union as `∪` and the empty string as `ε` (checked by the owner on 2026-10-24; the text extraction of the PDFs loses these glyphs). TODO(review): confirm the Rich transition notation (Δ, yields) against the book.
