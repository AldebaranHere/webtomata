# Report — T-060

> Written by the worker at the end of the session. One file per task; overwrite each session.

## Task
- id: T-060
- title: CNF phases in the homework order, with message keys
- branch: `task/T-060-cnf-homework-order`
- status: in-progress

---

## Hand Derivations (Pre-implementation)

As required, hand derivations are recorded here before writing code or running tests.

### Grammar 1: T-010 Flow Grammar (`SIX_PHASE_GRAMMAR`)
Original grammar:
```
S -> a S b | A | U
A -> B
B -> b B | λ
U -> U c
```
(Start symbol: `S`, empty production body: `ε`)

- **Phase 1: Hapus Aturan Tak Terjangkau (Remove Unreachable Rules)**
  - Reachable set from `S`:
    - From `S`: `{S, A, U}`
    - From `A`: `{B}`
    - From `B`: `{B}`
    - From `U`: `{U}`
    - Total reachable variables: `{S, A, B, U}`.
  - Removed rules: `[]`
  - Added rules: `[]`
  - Grammar (7 rules):
    ```
    S -> a S b | A | U
    A -> B
    B -> b B | ε
    U -> U c
    ```

- **Phase 2: Hapus Aturan Tak Produktif (Remove Non-Productive Rules)**
  - Productive variables:
    - Base: `B -> ε` (derives empty string of terminals) => `B` is productive.
    - Iteration 1: `A -> B` => `A` is productive; `B -> b B` => `B` productive.
    - Iteration 2: `S -> A` => `S` is productive; `S -> a S b` => `S` productive.
    - `U -> U c` cannot derive any terminal string without `U` => `U` is non-productive.
  - Eliminate non-productive variable `U` and rules referencing `U`:
    - Remove: `S -> U`, `U -> U c`.
  - Reachability check on remaining rules from `S`:
    - `S -> a S b | A`, `A -> B`, `B -> b B | ε`.
    - Reachable: `{S, A, B}`. No variables became unreachable.
  - Removed rules (2): `['S → U', 'U → U c']`
  - Added rules (0): `[]`
  - Grammar (5 rules):
    ```
    S -> a S b | A
    A -> B
    B -> b B | ε
    ```

- **Phase 3: Hapus Aturan ε (Remove ε Rules & Returning ε)**
  - Nullable variables:
    - `B -> ε` => `B` is nullable.
    - `A -> B` => `A` is nullable.
    - `S -> A` => `S` is nullable.
    - Nullable set: `{S, A, B}`.
  - Combinations:
    - `S -> a S b`: omit `S` => `S -> a b`.
    - `S -> A`: omit `A` => empty body.
    - `A -> B`: omit `B` => empty body.
    - `B -> b B`: omit `B` => `B -> b`.
    - `B -> ε` is removed.
  - "Returning ε":
    - Start symbol `S` is nullable!
    - Create fresh start symbol `S0`.
    - Add rules `S0 -> S | ε`.
  - Removed rules (1): `['B → λ']`
  - Added rules (4): `['S0 → S', 'S0 → λ', 'S → a b', 'B → b']`
  - Grammar (8 rules):
    ```
    S0 -> S | ε
    S -> a S b | a b | A
    A -> B
    B -> b B | b
    ```

- **Phase 4: Hapus Aturan Unit (Remove Unit Rules)**
  - Unit rules: `S0 -> S`, `S -> A`, `A -> B`.
  - Unit pairs:
    - `(S0, S)` => inherits non-unit rules of `S`: `S0 -> a S b`, `S0 -> a b`.
    - `(S0, A)` => non-unit rules of `A` (initially none).
    - `(S0, B)` => inherits non-unit rules of `B`: `S0 -> b B`, `S0 -> b`.
    - `(S, A)` => non-unit rules of `A`.
    - `(S, B)` => inherits non-unit rules of `B`: `S -> b B`, `S -> b`.
    - `(A, B)` => inherits non-unit rules of `B`: `A -> b B`, `A -> b`.
  - Removed rules (3): `['S0 → S', 'S → A', 'A → B']`
  - Added rules (8):
    `['S0 → a S b', 'S0 → a b', 'S0 → b B', 'S0 → b', 'S → b B', 'S → b', 'A → b B', 'A → b']`
  - Grammar (13 rules):
    ```
    S0 -> ε | a S b | a b | b B | b
    S -> a S b | a b | b B | b
    A -> b B | b
    B -> b B | b
    ```

- **Phase 5: Ganti Terminal pada Aturan Campuran (Replace Terminals in Mixed Rules)**
  - Rules with length $\ge 2$ containing terminals replace terminals with helper variables:
    `a -> T_a`, `b -> T_b`.
  - Removed rules (8):
    `['S0 → a S b', 'S0 → a b', 'S0 → b B', 'S → a S b', 'S → a b', 'S → b B', 'A → b B', 'B → b B']`
  - Added rules (10):
    `['S0 → T_a S T_b', 'S0 → T_a T_b', 'S0 → T_b B', 'S → T_a S T_b', 'S → T_a T_b', 'S → T_b B', 'A → T_b B', 'B → T_b B', 'T_a → a', 'T_b → b']`
  - Grammar (15 rules):
    ```
    S0 -> ε | b | T_a S T_b | T_a T_b | T_b B
    S -> b | T_a S T_b | T_a T_b | T_b B
    A -> b | T_b B
    B -> b | T_b B
    T_a -> a
    T_b -> b
    ```

- **Phase 6: Pecah Aturan Panjang (Split Long Rules)**
  - Rules with length $\ge 3$:
    `S0 -> T_a S T_b` (length 3)
    `S -> T_a S T_b` (length 3)
  - With default `share_helpers = false`:
    - `S0 -> T_a S T_b` => `S0 -> T_a X`, `X -> S T_b`
    - `S -> T_a S T_b` => `S -> T_a X_1`, `X_1 -> S T_b`
  - Removed rules (2): `['S0 → T_a S T_b', 'S → T_a S T_b']`
  - Added rules (4): `['S0 → T_a X', 'S → T_a X_1', 'X → S T_b', 'X_1 → S T_b']`
  - Final Grammar (17 rules):
    ```
    S0 -> ε | b | T_a T_b | T_b B | T_a X
    S -> b | T_a T_b | T_b B | T_a X_1
    A -> b | T_b B
    B -> b | T_b B
    T_a -> a
    T_b -> b
    X -> S T_b
    X_1 -> S T_b
    ```

---

### Grammar 2: Variable Becomes Unreachable Only After Phase 2 (`G_UNREACHABLE_AFTER_P2`)
Original grammar:
```
S -> a | A B
A -> a
B -> B b
```
(Start symbol: `S`)

- **Phase 1: Hapus Aturan Tak Terjangkau**
  - Reachable from `S`: `{S, A, B}`
  - All variables are reachable.
  - Removed rules (0): `[]`
  - Added rules (0): `[]`
  - Grammar (4 rules):
    ```
    S -> a | A B
    A -> a
    B -> B b
    ```

- **Phase 2: Hapus Aturan Tak Produktif (dan variabel yang menjadi tak terjangkau karenanya)**
  - Productive variables:
    `A -> a` => `A` productive.
    `S -> a` => `S` productive.
    `B -> B b` => `B` non-productive.
  - Non-productive variable `B` removed:
    Rules removed: `B -> B b`, `S -> A B`.
  - Cascaded reachability check from `S`:
    Remaining rules: `S -> a`, `A -> a`.
    Reachable from `S`: `{S}`.
    Variable `A` is no longer reachable from `S`!
    Variable `A` and rule `A -> a` are therefore removed.
  - Removed rules (3): `['S → A B', 'A → a', 'B → B b']`
  - Added rules (0): `[]`
  - Grammar (1 rule):
    ```
    S -> a
    ```

- **Phase 3: Hapus Aturan ε**
  - Nullable variables: None. `S` not nullable. No `S0`.
  - Removed rules (0): `[]`
  - Added rules (0): `[]`
  - Grammar (1 rule): `S -> a`

- **Phase 4: Hapus Aturan Unit**
  - Removed rules (0): `[]`
  - Added rules (0): `[]`
  - Grammar (1 rule): `S -> a`

- **Phase 5: Ganti Terminal pada Aturan Campuran**
  - Removed rules (0): `[]`
  - Added rules (0): `[]`
  - Grammar (1 rule): `S -> a`

- **Phase 6: Pecah Aturan Panjang**
  - Removed rules (0): `[]`
  - Added rules (0): `[]`
  - Final Grammar (1 rule):
    ```
    S -> a
    ```

---

### Grammar 3: $\varepsilon$ is Not in the Language and Start Symbol Appears on RHS (`G_NO_EPSILON`)
Original grammar:
```
S -> a S b | a b
```
(Start symbol: `S`, $L(G) = \{a^n b^n \mid n \ge 1\}$, $\varepsilon \notin L(G)$)

- **Phase 1: Hapus Aturan Tak Terjangkau**
  - Reachable: `{S}`
  - Removed rules (0): `[]`
  - Added rules (0): `[]`
  - Grammar (2 rules):
    ```
    S -> a S b | a b
    ```

- **Phase 2: Hapus Aturan Tak Produktif**
  - Productive: `S -> a b` => `S` productive.
  - Removed rules (0): `[]`
  - Added rules (0): `[]`
  - Grammar (2 rules):
    ```
    S -> a S b | a b
    ```

- **Phase 3: Hapus Aturan ε**
  - Nullable: None.
  - `S` is NOT nullable, so no `S0` is added (even though `S` is on RHS).
  - Removed rules (0): `[]`
  - Added rules (0): `[]`
  - Grammar (2 rules):
    ```
    S -> a S b | a b
    ```

- **Phase 4: Hapus Aturan Unit**
  - No unit rules.
  - Removed rules (0): `[]`
  - Added rules (0): `[]`
  - Grammar (2 rules):
    ```
    S -> a S b | a b
    ```

- **Phase 5: Ganti Terminal pada Aturan Campuran**
  - Replaces `a -> T_a`, `b -> T_b` in `S -> a S b` and `S -> a b`.
  - Removed rules (2): `['S → a S b', 'S → a b']`
  - Added rules (4): `['S → T_a S T_b', 'S → T_a T_b', 'T_a → a', 'T_b → b']`
  - Grammar (4 rules):
    ```
    S -> T_a S T_b | T_a T_b
    T_a -> a
    T_b -> b
    ```

- **Phase 6: Pecah Aturan Panjang**
  - Rule `S -> T_a S T_b` binarized to `S -> T_a X`, `X -> S T_b`.
  - Removed rules (1): `['S → T_a S T_b']`
  - Added rules (2): `['S → T_a X', 'X → S T_b']`
  - Final Grammar (5 rules):
    ```
    S -> T_a T_b | T_a X
    T_a -> a
    T_b -> b
    X -> S T_b
    ```
