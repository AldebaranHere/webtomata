# Report: T-030 PDA data model, JSON, validation and the determinism check

## 1. Hand Derivations

The user required hand derivations recorded in `REPORT.md` before any test runs for:
1. **Machine M1**: DPDA for $a^n b^n$ ($n \ge 0$).
2. **Machine M2**: NDPDA for $w w^R$ over $\{a, b\}$.
3. **Prefix Rule Cases**: $P_1, P_2, P_3, P_4$.
4. **Accepting State Free Move Cases**: $F_1, F_2$.
5. **Bottom-Marker / Pop-Never-Pushed Case**.

---

### Machine M1: DPDA for $L = \{a^n b^n \mid n \ge 0\}$
- **Input alphabet**: $\Sigma = \{a, b\}$
- **Stack alphabet**: $\Gamma = \{a\}$
- **States**: $K = \{0, 1\}$
  - $0$: start state, accepting state
  - $1$: accepting state
- **Transitions**:
  - $t_0 = (0, a, [] \to [a], 0)$
  - $t_1 = (0, b, [a] \to [], 1)$
  - $t_2 = (1, b, [a] \to [], 1)$
- **Canonical sorted order**:
  - Index 0 ($t_0$): `(0, a, [] → [a], 0)`
  - Index 1 ($t_1$): `(0, b, [a] → [], 1)`
  - Index 2 ($t_2$): `(1, b, [a] → [], 1)`
- **Determinism Analysis**:
  - At state 0: compare index 0 and 1:
    - Reads: $a$ vs $b$ ($a \ne b$, neither is $\varepsilon$).
    - Do not compete.
  - At state 1: only index 2 exists.
  - Result: `determinism(&m1)` is empty `[]`.
- **Validation as `dpda`**:
  - Start state present ($0$).
  - Accepting states present ($\{0, 1\}$).
  - Reachable: $\{0, 1\}$ reachable from $0$.
  - No duplicate transitions.
  - Stack symbols popped: $\{a\}$; stack symbols pushed: $\{a\}$. No pop without push.
  - Determinism is empty $\implies$ no competing transitions error.
  - Accepting states $\{0, 1\}$:
    - From state 0: transitions read $a$ and $b$; neither reads $\varepsilon$ and pops $\varepsilon$.
    - From state 1: transition reads $b$; does not read $\varepsilon$ and pop $\varepsilon$.
  - Result: `validate_pda(&m1)` is empty `[]`.

---

### Machine M2: NDPDA for $L = \{w w^R \mid w \in \{a, b\}^*\}$
- **Input alphabet**: $\Sigma = \{a, b\}$
- **Stack alphabet**: $\Gamma = \{a, b\}$
- **States**: $K = \{0, 1\}$
  - $0$: start state (not accepting)
  - $1$: accepting state
- **Transitions**:
  - $(0, a, [] \to [a], 0)$
  - $(0, b, [] \to [b], 0)$
  - $(0, \varepsilon, [] \to [], 1)$
  - $(1, a, [a] \to [], 1)$
  - $(1, b, [b] \to [], 1)$
- **Canonical sorted order** (`from`, `read` with $\varepsilon$ first, `pop`, `push`, `to`):
  - Index 0: `(0, ε, [] → [], 1)`
  - Index 1: `(0, a, [] → [a], 0)`
  - Index 2: `(0, b, [] → [b], 0)`
  - Index 3: `(1, a, [a] → [], 1)`
  - Index 4: `(1, b, [b] → [], 1)`
- **Determinism Analysis**:
  - At state 0:
    - Index 0 vs Index 1:
      - Reads: index 0 reads $\varepsilon \implies$ read condition satisfied.
      - Pops: index 0 pops `[]`, index 1 pops `[]` $\implies$ prefix condition satisfied (`[]` prefix of `[]`).
      - $\implies$ Compete: `Competition { from: 0, first: 0, second: 1 }`.
    - Index 0 vs Index 2:
      - Reads: index 0 reads $\varepsilon \implies$ read condition satisfied.
      - Pops: `[]` prefix of `[]` $\implies$ prefix condition satisfied.
      - $\implies$ Compete: `Competition { from: 0, first: 0, second: 2 }`.
    - Index 1 vs Index 2:
      - Reads: $a$ vs $b$ ($a \ne b$, neither is $\varepsilon$).
      - Do not compete.
  - At state 1:
    - Index 3 vs Index 4:
      - Reads: $a$ vs $b$ ($a \ne b$, neither is $\varepsilon$).
      - Do not compete.
  - Result: `determinism(&m2)` returns exactly 2 pairs:
    1. `Competition { from: 0, first: 0, second: 1 }`
    2. `Competition { from: 0, first: 0, second: 2 }`
- **Validation**:
  - As `ndpda`:
    - All structural checks pass, competing transitions are allowed $\implies$ `[]` (empty).
  - As `dpda`:
    - Reports 2 errors:
      1. `pda.competing_transitions { from: 0, first: 0, second: 1 }`
      2. `pda.competing_transitions { from: 0, first: 0, second: 2 }`

---

### Prefix Rule Cases
Two transitions from state 0:
Rule: Compete iff $(\text{read}_1 = \text{read}_2 \lor \text{read}_1 = \varepsilon \lor \text{read}_2 = \varepsilon) \land (\text{pop}_1 \text{ is prefix of } \text{pop}_2 \lor \text{pop}_2 \text{ is prefix of } \text{pop}_1)$.
- **Case P1**: `(a, pop [a])` and `(a, pop [a, b])`
  - Reads: $a == a$ (true).
  - Pops: $[a]$ is prefix of $[a, b]$ (true).
  - **Verdict**: COMPETE.
- **Case P2**: `(a, pop [a])` and `(a, pop [b])`
  - Reads: $a == a$ (true).
  - Pops: $[a]$ not prefix of $[b]$, $[b]$ not prefix of $[a]$ (false).
  - **Verdict**: DO NOT COMPETE.
- **Case P3**: `(a, pop [a])` and `(b, pop [a])`
  - Reads: $a \ne b$, neither is $\varepsilon$ (false).
  - Pops: $[a]$ is prefix of $[a]$ (true).
  - **Verdict**: DO NOT COMPETE.
- **Case P4**: `(ε, pop [a])` and `(b, pop [a, b])`
  - Reads: one is $\varepsilon$ (true).
  - Pops: $[a]$ is prefix of $[a, b]$ (true).
  - **Verdict**: COMPETE.

---

### Accepting State Free Move Cases
Rule (for DPDA): Error `pda.accepting_state_free_move { state }` for any transition out of an accepting state that reads nothing ($\text{read} = \varepsilon$) AND pops nothing ($\text{pop} = []$).
- **Machine F1**: State 1 is accepting; transition $(1, \varepsilon, [] \to [x], 1)$:
  - $\text{read} = \varepsilon$ and $\text{pop} = []$.
  - **Verdict**: Error `pda.accepting_state_free_move { state: 1 }`.
- **Machine F2**: State 1 is accepting; transition $(1, \varepsilon, [x] \to [], 1)$:
  - $\text{read} = \varepsilon$, but $\text{pop} = [x] \ne []$.
  - **Verdict**: NO error (transition cannot fire if stack is empty).

---

### JFLAP Bottom Marker / Pop-Never-Pushed Case
- Transition: $(0, \varepsilon, [Z] \to [S, Z], 1)$ where $Z$ is never pushed by any transition in the machine.
- Since stack starts empty, this transition can never fire.
- **Verdict**: Warning `pda.pop_never_pushed { from: 0, symbol: "Z" }`.

---

## 2. Size Baseline
- Initial baseline (before changes):
  - wasm: `209.3 KB` gzip (limit `250 KB`)
  - initial JS index.html: `79.5 KB` gzip (limit `170 KB`)
