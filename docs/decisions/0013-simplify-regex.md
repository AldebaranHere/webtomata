# 0013. Simplifying regular expressions

Status: accepted

## Context

Rich's section 6.4 lists identities for union, concatenation and star, and Example 6.17 simplifies one long expression step by step. Some identities depend on the meaning of the parts, for example "L(aa) ⊆ L(a*), so a* ∪ aa = a*". A student needs each step named, and the answer must be correct.

## Decision

- `simplify(regex, alphabet, budget)` applies one rewrite at a time and records a step: the message `simplify.<rule>` with the parameters `before` and `after` (the parts that changed; `kept` and `removed` for an absorption; `factor` for factoring) and `Change::Expression` with the whole expression after the step.
- Every rule makes the expression smaller, so the process ends. Rules that make it bigger (for example `(α ∪ β)* = (α*β*)*` and distribution to the right) are not used.
- Union and concatenation are associative, so a rule looks at all parts of a union (or a concatenation) and not only at two neighbours. The search is leftmost and innermost, so the same input always gives the same steps.
- Rules that say "if L(β) ⊆ L(α)" are decided by the engine: it builds the machines for `α ∪ β` and for `α`, and compares them with `equivalent`. No new automata code. If a check is too big to decide, the rule is not used. This is safe: the result may be less simple, never wrong.
- `∅ ∪ α = α` is its own rule (`union_empty`), although the book writes it as a subset step. Factoring (`ab ∪ ac = a(b ∪ c)`) is included because it is in Rich's list; it is used only when both parts are concatenations.
- Budget: `max_steps` (stops with `MaxSteps`) and `max_checks` (stops with the new `StopReason::MaxChecks`). A repeated question counts once.

## Consequences

- Example 6.17 gives `(a∪b)*` in 10 steps. The book shows 6 lines because it joins rewrites; the order of the rewrites also differs, since the engine tries the inner parts first.
- The identities do not simplify everything. `(a∪b)*(a∪ε)b*` stays as it is, because showing that it equals `(a∪b)*` needs distribution to the right, which makes the expression bigger first. The result is always equivalent to the input and never bigger.
- The simplifier never writes the Indonesian text; the UI maps the keys (S7).
