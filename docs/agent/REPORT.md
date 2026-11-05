# Report: T-032 PDA .jff import and export

## 1. Hand Derivations (Pre-implementation)

All hand derivations below are performed strictly from the specification rules, Slide12, and the T-031 simulator rules before running tests.

---

### 1.1 Fixture F1 (Homework-style machine for $a^n b^n$)

#### Structure and Transitions
- States:
  - 0: initial
  - 1: internal
  - 2: internal
  - 3: final (accepting)
- Transitions:
  1. $0 \to 1$: read $\varepsilon$, pop `[]`, push `["Z", "0"]` (top is `'Z'`, followed by `'0'`)
  2. $1 \to 1$: read `a`, pop `[]`, push `["A"]` (top is `'A'`)
  3. $1 \to 2$: read `b`, pop `["A"]` (top is `'A'`), push `[]`
  4. $2 \to 2$: read `b`, pop `["A"]` (top is `'A'`), push `[]`
  5. $1 \to 3$: read $\varepsilon$, pop `["Z", "0"]` (top is `'Z'`, followed by `'0'`), push `[]`
  6. $2 \to 3$: read $\varepsilon$, pop `["Z", "0"]` (top is `'Z'`, followed by `'0'`), push `[]`

#### Alphabets (Sorted by Character)
- Input alphabet: `["a", "b"]` (characters occurring in `<read>`)
- Stack alphabet: `["0", "A", "Z"]` (characters occurring in `<pop>` and `<push>`, sorted: `'0' < 'A' < 'Z'`)

#### Machine Kind
- `kind`: `ndpda` (imported JFLAP PDAs default to `ndpda`)

#### Validation
- `validate_pda`: 0 issues.
  - Start state present: 0
  - Accepting state present: 3
  - All states 0, 1, 2, 3 reachable
  - Stack symbols: `'Z'` and `'0'` pushed by transition 1, `'A'` pushed by transition 2. All popped symbols are pushed by firing paths.

#### Simulation Traces and Configuration Derivations
- **Input $\varepsilon$:**
  - Level 0: $\{(0, 0, [])\}$
  - Level 1: $\{(1, 0, [Z, 0])\}$ (via trans 1)
  - Level 2: $\{(3, 0, [])\}$ (via trans 5, pop `[Z, 0]`)
  - State 3 is accepting, position $0 = |\varepsilon|$, stack is empty `[]`.
  - **Verdict:** Accepted.

- **Input $ab$ (Level by Level):**
  - Level 0: $\{(0, 0, [])\}$
  - Level 1: $\{(1, 0, [Z, 0])\}$ (via trans 1, read $\varepsilon$)
  - Level 2:
    - via trans 2: read `a`, push `A` $\implies (1, 1, [A, Z, 0])$
    - via trans 5: read $\varepsilon$, pop `[Z, 0]` $\implies (3, 0, [])$
  - Level 3:
    - from $(1, 1, [A, Z, 0])$ via trans 3: read `b`, pop `A` $\implies (2, 2, [Z, 0])$
    - from $(3, 0, [])$: no transitions can fire
  - Level 4:
    - from $(2, 2, [Z, 0])$ via trans 6: read $\varepsilon$, pop `[Z, 0]` $\implies (3, 2, [])$
  - State 3 is accepting, position $2 = |ab|$, stack is empty `[]`.
  - **Verdict:** Accepted.

- **Input $aabb$:**
  - Level 0: $\{(0, 0, [])\}$
  - Level 1: $\{(1, 0, [Z, 0])\}$
  - Level 2: $\{(1, 1, [A, Z, 0]), (3, 0, [])\}$
  - Level 3: $\{(1, 2, [A, A, Z, 0])\}$ (from read `a`)
  - Level 4: $\{(2, 3, [A, Z, 0])\}$ (from read `b`, pop `A`)
  - Level 5: $\{(2, 4, [Z, 0])\}$ (from read `b`, pop `A`)
  - Level 6: $\{(3, 4, [])\}$ (from read $\varepsilon$, pop `[Z, 0]`)
  - State 3 is accepting, position 4, stack empty.
  - **Verdict:** Accepted.

- **Input $a$ (Scoring & Ranking of Terminal Configurations):**
  - Level 0: $\{(0, 0, [])\}$
  - Level 1: $\{(1, 0, [Z, 0])\}$
  - Level 2:
    - node 2: $(1, 1, [A, Z, 0])$ (read `a`)
    - node 3: $(3, 0, [])$ (read $\varepsilon$)
  - Level 3 is empty: node 2 cannot read more (input len 1), node 3 has no outgoing transitions.
  - Both node 2 and node 3 are terminal configurations (`!has_unseen_succ`).
  - Scoring:
    - Node 2 $(1, 1, [A, Z, 0])$: pos 1 == len 1 (+1), state 1 in F (0), stack empty (0) $\implies$ Score = 1.
    - Node 3 $(3, 0, [])$: pos 0 == len 1 (0), state 3 in F (+1), stack empty (+1) $\implies$ Score = 2.
  - Ranking selects Node 3 $(3, 0, [])$ since Score 2 > Score 1.
  - Failure message: pos 0 < len 1 $\implies$ `pda.sim.input_left { left: 1 }`.
  - **Verdict:** Rejected.

- **Input $aab$ (Level by Level & Scoring):**
  - Level 0: $\{(0, 0, [])\}$
  - Level 1: $\{(1, 0, [Z, 0])\}$
  - Level 2: $\{(1, 1, [A, Z, 0]), (3, 0, [])\}$
  - Level 3: $\{(1, 2, [A, A, Z, 0])\}$
  - Level 4: $\{(2, 3, [A, Z, 0])\}$
  - Level 5 is empty: from $(2, 3, [A, Z, 0])$ input exhausted (pos 3), stack top is `'A'` while trans 6 needs `[Z, 0]`.
  - Terminal configurations:
    - Node $(2, 3, [A, Z, 0])$: pos 3 == len 3 (+1), state 2 in F (0), stack empty (0) $\implies$ Score = 1.
    - Node $(3, 0, [])$: pos 0 == len 3 (0), state 3 in F (+1), stack empty (+1) $\implies$ Score = 2.
  - Ranking selects Node $(3, 0, [])$ since Score 2 > Score 1.
  - Failure message: pos 0 < len 3 $\implies$ `pda.sim.input_left { left: 3 }`.
  - **Verdict:** Rejected.

- **Input $abb$:**
  - Terminal candidate $(3, 2, [])$ has Score 2, pos 2. Candidate $(3, 0, [])$ has Score 2, pos 0.
  - Larger position tie-breaker picks $(3, 2, [])$.
  - Failure message: pos 2 < len 3 $\implies$ `pda.sim.input_left { left: 1 }`.
  - **Verdict:** Rejected.

- **Input $b$:**
  - Level 1 has $(1, 0, [Z, 0])$; Level 2 has $(3, 0, [])$. Level 3 empty.
  - Terminal config $(3, 0, [])$ has Score 2.
  - Failure message: pos 0 < len 1 $\implies$ `pda.sim.input_left { left: 1 }`.
  - **Verdict:** Rejected.

---

### 1.2 Fixture F2 (LL Grammar Conversion shape from JFLAP)

#### States & Transitions
- States: 0 (initial), 1, 2 (final)
- Transitions:
  1. $0 \to 1$: read $\varepsilon$, pop `["Z"]`, push `["S", "Z"]`
  2. $1 \to 1$: read $\varepsilon$, pop `["S"]`, push `["a", "S", "b"]`
  3. $1 \to 1$: read $\varepsilon$, pop `["S"]`, push `["a", "b"]`
  4. $1 \to 1$: read `a`, pop `["a"]`, push `[]`
  5. $1 \to 1$: read `b`, pop `["b"]`, push `[]`
  6. $1 \to 2$: read $\varepsilon$, pop `["Z"]`, push `[]`

#### Transitions Firing from Empty Stack
- None. Every transition has a non-empty pop list (`["Z"]`, `["S"]`, `["a"]`, `["b"]`). Since simulation begins with an empty stack `[]`, no transition can fire from the initial configuration $(0, 0, [])$.

#### Exact List of `pda.pop_never_pushed` Warnings
Because no transition can fire from an empty stack, no transitions can ever push any symbol on any reachable execution path. Therefore, every popped symbol is never pushed:
1. `(0, "Z")`
2. `(1, "S")`
3. `(1, "a")`
4. `(1, "b")`
5. `(1, "Z")`

#### Simulation of $aabb$
- Start config: $(0, 0, [])$.
- No transition applies. Next level is empty.
- Best final config is $(0, 0, [])$, with 4 unconsumed input symbols.
- Failure message: `pda.sim.input_left { left: 4 }`.
- **Verdict:** Rejected.

---

### 1.3 Export and Round-Trip Specification

#### XML Layout
Export mirrors `to_jff`:
- Declaration: `<?xml version="1.0" encoding="UTF-8" standalone="no"?>`
- Root: `<structure>\n\t<type>pda</type>\n\t<automaton>\n`
- State elements: `<state id="0" name="q0">\n\t\t\t<x>100.0</x>\n\t\t\t<y>100.0</y>\n\t\t\t<initial/>\n\t\t</state>\n`
- Transition elements:
  - Tags order: `<from>`, `<to>`, `<read>`, `<pop>`, `<push>`
  - Empty values:
    - $\varepsilon$ read $\implies$ `<read/>`
    - Empty pop $\implies$ `<pop/>`
    - Empty push $\implies$ `<push/>`
- Symbol ordering:
  - `pop = ["a", "b"]` $\implies$ `<pop>ab</pop>`
  - `push = ["a", "S", "b"]` $\implies$ `<push>aSb</push>`

---

### 1.4 Real Error Message Keys from Code
- `machine.limit_exceeded` (parameters: `what`, `limit`)
- `jff.xml_invalid` (parameters: `line`, `column`)
- `jff.invalid_structure` (parameters: `element`, `line`)
- `jff.unsupported_type` (parameters: `type`)
- `jff.multiple_initial_states`
- `jff.symbol_not_single_character` (parameters: `symbol`)
- `jff.pda_read_not_single` (parameters: `label`, `from`, `to`)
- `machine.duplicate_state` (parameter: `state`)
