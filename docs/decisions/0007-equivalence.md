# 0007. Equivalence and witness strings

Status: accepted

## Context

The Soal feedback panel (Q4) and the Sandbox "compare with" tool (S8) need to say whether two machines accept the same language and, if not, show strings that prove it. FSM Builder (see `COMPETITORS.md`) lists wrongly accepted and wrongly rejected strings and the path of one wrong string.

## Decision

- `equivalent(candidate, reference, EquivalenceBudget) -> Result<Equivalence, Message>`. The first machine is the student's, the second is the reference.
- The two machines are explored together, one pair of active-state sets at a time, in breadth-first order. This works for any mix of DFSMs and NDFSMs without building a DFSM first. The first pair on which acceptance differs gives the shortest witness; among strings of equal length it is the first in alphabet order. A pair where both sets are empty is skipped, because both machines reject every extension.
- Result: `Equivalent { pairs }`, `Different { witness, accepted_but_should_reject, rejected_but_should_accept, lists_truncated, trace }` or `Stopped { reason }`. "Accepted but should reject" means the candidate accepts and the reference rejects; the other list is the reverse.
- The lists come from a second search over strings in order of length, then alphabet order. The witness is the first item of its list when it is not longer than `max_length`. `lists_truncated` is true if `max_strings` or `max_visits` cut the lists off; strings longer than `max_length` are never listed.
- Trace: only the witness path, one `Change::Product` step per prefix with the active states of both machines. The keys of the first and the middle steps are `equivalent.start` and `equivalent.read`. The last step has the key `equivalent.accepted_but_should_reject` or `equivalent.rejected_but_should_accept`. A trace of every explored pair can have 100,000 steps, so it is left out; it can be added if a teaching view needs it.
- Budget: `max_pairs` (default 100,000; the reason is `max_pairs`), `max_visits` (100,000), `max_length` (8) and `max_strings` for each list (5).
- Alphabets: both machines must have the same symbol names, in any order; otherwise `equivalent.alphabet_mismatch { symbol, side }`. Symbols in the result refer to the candidate's alphabet. A missing start state gives `equivalent.no_start_state { side }`.

## Consequences

- The UI should check the student's alphabet against the question's alphabet first and show its own message.
- The feedback panel can call `simulate` on the witness for each machine, or use the witness trace directly.
- The search can take up to `max_pairs` pairs for NDFSMs with many subsets; E13 will measure it.
