# 0009. FSM → regular expression (state elimination)

Status: accepted

## Context
E8 builds a regular expression from a machine. Rich's textbook (section 6.2.2) gives `fsmtoregexheuristic` and the general `fsmtoregex` (`standardize` and `buildregex`); the course slides (`Regular2`) give the same ideas as "Algoritma" and "Algoritma Umum". The result for the textbook example is `(ab ∪ aaa*b)*(a ∪ ε)`.

## Decision
- Follow the general algorithm: drop unreachable states; no accepting state gives `∅`; add a new start state if the start state has transitions into it; add a new accepting state if there are several accepting states or the only one has transitions out; one state left gives `ε`; keep one label for each pair of states (several transitions are joined with `∪`, ε last, no transition is `∅`); remove the other states one at a time with `R(p,q) ∪ R(p,rip) R(rip,rip)* R(rip,q)`; the label from the start to the accepting state is the result.
- Order of removal: the highest state number first. The book allows any order and the language never depends on it; this order is deterministic and removes states 3, 2, 1 in Rich's Example 6.7, so the test can check the exact steps. A later practice exercise can let the student choose the order.
- Light simplification only: `∅ ∪ r = r`, `r ∪ r = r`, `∅ r = ∅`, `ε r = r`, `∅* = ε`, `ε* = ε`. For Example 6.7 the result is `(a(b∪aa*b))*(ε∪a)`, which equals the slide's expression except for distribution and the order inside the last union (a test checks that they are equivalent). A stronger simplification is a separate task, E8b, so the steps here stay the same as the book's.
- Works for DFSMs and NDFSMs; ε-transitions become `ε` labels.
- Trace: `fsm_to_regex.remove_unreachable`, `.new_start`, `.new_accepting`, `.table` (all labels that are not `∅`), one `.rip { state }` for each removed state (with the labels that changed, shown as text), and `.result { expression }`; or `.no_accepting` / `.only_one_state`. A machine with no start state gives `fsm_to_regex.no_start_state`.
- Budget: `max_steps` (100,000), `max_updates` (1,000,000 label updates) and `max_nodes` (2,000 parts in the biggest label). The expression can grow very fast, so on overflow the result is `Stopped` with reason `max_steps`, `max_updates` or `max_nodes`. The last two reasons are new.

## Consequences
- `regex → NDFSM → regex` is checked with the E6 equivalence on random expressions, as `CLAUDE.md` asks.
- A result near the limit may be longer than the 1,000 characters that `parse_regex` accepts.
- The result is the `Regex` tree of E7, so `to_text` prints it and E8b can rewrite it.
