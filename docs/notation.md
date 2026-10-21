# Notation

The engine is notation-neutral. Labels below live only in the UI and message files. The default is Rich (the course textbook); Sipser is an option in the notation switch (S1).

| Concept | Rich (default) | Sipser |
| --- | --- | --- |
| DFSM / DFA | M = (K, Σ, δ, s, A) | M = (Q, Σ, δ, q₀, F) |
| NDFSM / NFA | M = (K, Σ, Δ, s, A) | N = (Q, Σ, δ, q₀, F), δ: Q × Σε → P(Q) |
| States | K | Q |
| Start state | s | q₀ |
| Accepting states | A | F |
| Transition | δ(q, a) = p (function); Δ is a relation | δ(q, a) = p (function); NFA gives a set |
| Configuration | (q, w) in K × Σ\*, with the yields relation ⊢ | not used |
| Empty string | ε | ε |
| Regex operators | union ∪, concatenation, Kleene star \*, also ε and ∅ | union ∪, concatenation, star \*, also ε and ∅ |

TODO(review): confirm the exact regex symbols and the Rich transition notation against the book before E7. JFLAP uses `+` for union and `!` for ε; that is an import/export dialect, not a notation option.
