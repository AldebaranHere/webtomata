# Report: T-034 CFG to PDA, top-down

## 1. Hand Derivations (Pre-implementation)

All hand derivations below are derived strictly from the specification rules, Slide13 page 4, and the T-030/T-031 PDA definitions prior to executing any code or tests.

---

### 1.1 Fixture F1: $S \to aSb \mid ab$ (Language $a^n b^n, n \ge 1$)

#### Grammar Structure
- Variables: $\{S\}$
- Terminals: $\{a, b\}$
- Productions:
  1. $S \to aSb$
  2. $S \to ab$

#### Alphabets
- Input alphabet: sorted terminals $\implies$ `["a", "b"]`
- Stack alphabet: variables $\cup$ terminals sorted in byte order $\implies$ `["S", "a", "b"]` (ASCII `'S'` = 83, `'a'` = 97, `'b'` = 98)

#### States & Machine Definition
- States: `0` ($p$, initial) and `1` ($q$, accepting)
- Metadata: `states: [{ id: 0, name: "p" }, { id: 1, name: "q" }]`
- `start`: `Some(0)`
- `accepting`: `[1]`
- `kind`: `ndpda`

#### Transitions and Construction Steps (5 total)
1. **Start transition:**
   - Transition: $0 \to 1$, read: $\varepsilon$ (`None`), pop: `[]`, push: `["S"]`
   - Message: `cfg_pda.top_down.start`
2. **Rule 1 ($S \to aSb$):**
   - Transition: $1 \to 1$, read: $\varepsilon$ (`None`), pop: `["S"]`, push: `["a", "S", "b"]` (top is `'a'`)
   - Message: `cfg_pda.top_down.rule { rule: "S -> aSb" }`
3. **Rule 2 ($S \to ab$):**
   - Transition: $1 \to 1$, read: $\varepsilon$ (`None`), pop: `["S"]`, push: `["a", "b"]` (top is `'a'`)
   - Message: `cfg_pda.top_down.rule { rule: "S -> ab" }`
4. **Terminal $a$:**
   - Transition: $1 \to 1$, read: `Some("a")`, pop: `["a"]`, push: `[]`
   - Message: `cfg_pda.top_down.terminal { symbol: "a" }`
5. **Terminal $b$:**
   - Transition: $1 \to 1$, read: `Some("b")`, pop: `["b"]`, push: `[]`
   - Message: `cfg_pda.top_down.terminal { symbol: "b" }`

#### Canonical Sort in `Pda`
Sorted by `(from, read, pop, push, to)` with $\varepsilon$ first:
1. $0 \to 1$, read: `None`, pop: `[]`, push: `["S"]`
2. $1 \to 1$, read: `None`, pop: `["S"]`, push: `["a", "b"]`
3. $1 \to 1$, read: `None`, pop: `["S"]`, push: `["a", "S", "b"]`
4. $1 \to 1$, read: `Some("a")`, pop: `["a"]`, push: `[]`
5. $1 \to 1$, read: `Some("b")`, pop: `["b"]`, push: `[]`

#### Validation and Determinism
- `validate_pda`: 0 issues (start and accepting present, all states reachable, all popped symbols pushed).
- `pda_determinism`: exactly 1 competition between rule transitions 2 and 3 at state $1$ (both read $\varepsilon$ and have identical pop `["S"]`).

#### Simulation of $aabb$ by Hand
- Level 0: $(0, 0, [])$
- Level 1: $(1, 0, [S])$ (via trans 1)
- Level 2:
  - via trans 2: $(1, 0, [a, S, b])$
  - via trans 3: $(1, 0, [a, b])$
- Level 3:
  - from $(1, 0, [a, S, b])$ via terminal $a$: $(1, 1, [S, b])$
  - from $(1, 0, [a, b])$ via terminal $a$: $(1, 1, [b])$
- Level 4:
  - from $(1, 1, [S, b])$ via trans 2: $(1, 1, [a, S, b, b])$
  - from $(1, 1, [S, b])$ via trans 3: $(1, 1, [a, b, b])$
  - from $(1, 1, [b])$: dead end (input position 1 is `'a'`, pop is `'b'`)
- Level 5:
  - from $(1, 1, [a, b, b])$ via terminal $a$: $(1, 2, [b, b])$
  - from $(1, 1, [a, S, b, b])$ via terminal $a$: $(1, 2, [S, b, b])$
- Level 6:
  - from $(1, 2, [b, b])$ via terminal $b$: $(1, 3, [b])$
- Level 7:
  - from $(1, 3, [b])$ via terminal $b$: $(1, 4, [])$
- Configuration $(1, 4, [])$: state is $1$ (accepting), position is $4 = |aabb|$, stack is empty.
- **Verdict:** Accepted!
- Rejected strings: $\varepsilon$ (stack stays non-empty at position 0), $a, b, aab, abb, ba$.

---

### 1.2 Fixture F2: $S \to aSb \mid \varepsilon$ (Language $a^n b^n, n \ge 0$)

#### Grammar Structure & Alphabets
- Variables: $\{S\}$, Terminals: $\{a, b\}$
- Input alphabet: `["a", "b"]`, Stack alphabet: `["S", "a", "b"]`

#### Transitions and Construction Steps (5 total)
1. Start: $0 \to 1$, read: `None`, pop: `[]`, push: `["S"]` (`cfg_pda.top_down.start`)
2. Rule 1 ($S \to aSb$): $1 \to 1$, read: `None`, pop: `["S"]`, push: `["a", "S", "b"]` (`cfg_pda.top_down.rule { rule: "S -> aSb" }`)
3. Rule 2 ($S \to \varepsilon$): $1 \to 1$, read: `None`, pop: `["S"]`, push: `[]` (`cfg_pda.top_down.rule { rule: "S -> ε" }`)
4. Terminal $a$: $1 \to 1$, read: `Some("a")`, pop: `["a"]`, push: `[]` (`cfg_pda.top_down.terminal { symbol: "a" }`)
5. Terminal $b$: $1 \to 1$, read: `Some("b")`, pop: `["b"]`, push: `[]` (`cfg_pda.top_down.terminal { symbol: "b" }`)

#### Simulation of $\varepsilon$
- Initial: $(0, 0, [])$
- Via trans 1: $(1, 0, [S])$
- Via trans 3 ($\varepsilon$-rule): $(1, 0, [])$
- Accepting state $1$, position $0 = |\varepsilon|$, stack is `[]`.
- **Verdict:** Accepted!

---

### 1.3 Fixture F3: Two Variables $S \to AB, A \to aA \mid a, B \to bB \mid b$ (Language $a^i b^j, i, j \ge 1$)

#### Grammar Structure & Alphabets
- Variables: $\{A, B, S\}$, Terminals: $\{a, b\}$
- Input: `["a", "b"]`
- Stack: `["A", "B", "S", "a", "b"]` (sorted: `'A' < 'B' < 'S' < 'a' < 'b'`)

#### Transitions and Construction Steps (8 total)
1. Start: $0 \to 1$, read: `None`, pop: `[]`, push: `["S"]`
2. Rule $S \to AB$: $1 \to 1$, read: `None`, pop: `["S"]`, push: `["A", "B"]` (top is `'A'`)
3. Rule $A \to aA$: $1 \to 1$, read: `None`, pop: `["A"]`, push: `["a", "A"]`
4. Rule $A \to a$: $1 \to 1$, read: `None`, pop: `["A"]`, push: `["a"]`
5. Rule $B \to bB$: $1 \to 1$, read: `None`, pop: `["B"]`, push: `["b", "B"]`
6. Rule $B \to b$: $1 \to 1$, read: `None`, pop: `["B"]`, push: `["b"]`
7. Terminal $a$: $1 \to 1$, read: `Some("a")`, pop: `["a"]`, push: `[]`
8. Terminal $b$: $1 \to 1$, read: `Some("b")`, pop: `["b"]`, push: `[]`

#### Stack Ordering
After expanding $S \to AB$, the stack holds `["A", "B"]`. Because `'A'` is on top, only derivations for $A$ and terminal consumptions of `'a'` can occur until all $A$-symbols are eliminated, at which point `'B'` becomes exposed. This guarantees all $a$'s precede all $b$'s.

---

### 1.4 Fixture F4: Left Recursion $S \to Sa \mid b$ (Language $b a^n, n \ge 0$)

#### Grammar Structure & Alphabets
- Variables: $\{S\}$, Terminals: $\{a, b\}$
- Input: `["a", "b"]`, Stack: `["S", "a", "b"]`
- Transitions (5 total):
  1. $0 \to 1$, read: `None`, pop: `[]`, push: `["S"]`
  2. $1 \to 1$, read: `None`, pop: `["S"]`, push: `["S", "a"]` (top is `'S'`)
  3. $1 \to 1$, read: `None`, pop: `["S"]`, push: `["b"]`
  4. $1 \to 1$, read: `Some("a")`, pop: `["a"]`, push: `[]`
  5. $1 \to 1$, read: `Some("b")`, pop: `["b"]`, push: `[]`

#### Simulation of $ab$ under Budget `{ maxSteps: 10000, maxConfigurations: 20000, maxStack: 20 }`
- At $(1, 0, [S])$, rule 3 replaces $S$ with $b \implies (1, 0, [b])$, which cannot read input symbol `'a'` and immediately terminates.
- Rule 2 replaces $S$ with `[S, a]`, then `[S, a, a]`, etc. Since $S$ remains on top and reads $\varepsilon$, this branch never consumes input and increases stack depth by 1 at each BFS step.
- At level 20, stack length exceeds `maxStack = 20`.
- **Verdict:** `Stopped` with `StopReason::MaxStack`.
- String $baa$ is accepted.

---

### 1.5 Fixture F5: Edge Cases

1. **Duplicate Rules Merging ($S \to a \mid a$):**
   - Duplicate production `S -> a` is merged. Emits 3 steps and 3 transitions: 1 start, 1 rule, 1 terminal.
2. **Symbol Clash ($S \to a\langle a\rangle$):**
   - Variable `a` (from `<a>`) and terminal `a` have identical names.
   - Refused with `pda.cfg.symbol_clash { symbol: "a" }`.
3. **Rule Body Limit (65 symbols):**
   - Exceeds `MAX_PDA_STRING = 64`.
   - Refused with `machine.limit_exceeded { what: "pda_string", limit: 64 }`.
4. **Multi-character Variable $S_0$ ($S_0 \to aS_0b \mid ab$):**
   - Stack alphabet: `["S0", "a", "b"]`.
   - Transition pushes `["a", "S0", "b"]`.
   - Conversion succeeds; subsequent JFLAP export via `export_pda_jff` returns `jff.symbol_not_single_character { symbol: "S0" }`.
5. **JFLAP Round-trip on F1:**
   - Single-character symbols export cleanly to `<type>pda</type>` XML.
   - Re-import yields equivalent transitions.
