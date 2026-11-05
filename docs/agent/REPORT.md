# Report: T-036 PDA to restricted normal form (RNF)

## 1. Hand Derivations (Pre-implementation)

All hand derivations below are derived strictly from the specification rules, Slide13 pages 13 to 19, and the T-030/T-031 PDA definitions prior to executing any code or tests.

---

### 1.1 Fixture F1: $wcw^R$ ($w \in \{a, b\}^*$)

#### Input Machine $M$

- States: `0` (start, $s$), `1` (accepting, $f$). $m = \max(\text{states}) = 1$.
- Input alphabet: `["a", "b", "c"]`
- Stack alphabet: `["a", "b"]`
- Transitions (5 total):
  1. $0 \to 0$, read: `Some("a")`, pop: `[]`, push: `["a"]`
  2. $0 \to 0$, read: `Some("b")`, pop: `[]`, push: `["b"]`
  3. $0 \to 1$, read: `Some("c")`, pop: `[]`, push: `[]`
  4. $1 \to 1$, read: `Some("a")`, pop: `["a"]`, push: `[]`
  5. $1 \to 1$, read: `Some("b")`, pop: `["b"]`, push: `[]`

#### RNF Derivation $M'$

- Augmented stack alphabet: $\Gamma' = \Gamma \cup \{\#\} \implies$ `["a", "b", "#"]` (`#` appended last, ID = 2).
- State IDs:
  - $s' = m + 1 = 2$, name `"s'"`
  - $a = m + 2 = 3$, name `"a"`
  - No transitions with $pop.len() \ge 2$, so no intermediate $v_k$ states are allocated.
  - `new_states`: `[{ id: 2, name: "s'" }, { id: 3, name: "a" }]`
- Start state: `Some(2)`
- Accepting states: `[3]`
- Kind: `ndpda`

#### Result Transitions (13 total)

1. **Start transition (Step 2):**
   - $2 \to 0$, read: `None`, pop: `[]`, push: `["#"]`
2. **Accept transition (Step 3, for accepting state 1):**
   - $1 \to 3$, read: `None`, pop: `["#"]`, push: `[]`
3. **Copied single-pop transitions (Step 5):**
   - $1 \to 1$, read: `Some("a")`, pop: `["a"]`, push: `[]`
   - $1 \to 1$, read: `Some("b")`, pop: `["b"]`, push: `[]`
4. **Expanded pop-nothing transitions (Step 4, for $\Gamma_0 \in \{a, b, \#\}$):**
   - From $0 \to 0, a, [] \to [a]$:
     - $\Gamma_0 = a$: $0 \to 0$, read: `Some("a")`, pop: `["a"]`, push: `["a", "a"]`
     - $\Gamma_0 = b$: $0 \to 0$, read: `Some("a")`, pop: `["b"]`, push: `["a", "b"]`
     - $\Gamma_0 = \#$: $0 \to 0$, read: `Some("a")`, pop: `["#"]`, push: `["a", "#"]`
   - From $0 \to 0, b, [] \to [b]$:
     - $\Gamma_0 = a$: $0 \to 0$, read: `Some("b")`, pop: `["a"]`, push: `["b", "a"]`
     - $\Gamma_0 = b$: $0 \to 0$, read: `Some("b")`, pop: `["b"]`, push: `["b", "b"]`
     - $\Gamma_0 = \#$: $0 \to 0$, read: `Some("b")`, pop: `["#"]`, push: `["b", "#"]`
   - From $0 \to 1, c, [] \to []$:
     - $\Gamma_0 = a$: $0 \to 1$, read: `Some("c")`, pop: `["a"]`, push: `["a"]`
     - $\Gamma_0 = b$: $0 \to 1$, read: `Some("c")`, pop: `["b"]`, push: `["b"]`
     - $\Gamma_0 = \#$: $0 \to 1$, read: `Some("c")`, pop: `["#"]`, push: `["#"]`

Total transitions = $1 + 1 + 2 + 9 = 13$.

#### Trace Steps (5 total)

1. `pda.rnf.start` (`removed: None`, added: $2 \to 0, \varepsilon, [] \to [\#]$)
2. `pda.rnf.accept { state: 1 }` (`removed: None`, added: $1 \to 3, \varepsilon, [\#] \to []$)
3. `pda.rnf.expand { from: 0, to: 0 }` (`removed: Some(0→0 a)`, 3 added transitions for $a, b, \#$)
4. `pda.rnf.expand { from: 0, to: 0 }` (`removed: Some(0→0 b)`, 3 added transitions for $a, b, \#$)
5. `pda.rnf.expand { from: 0, to: 1 }` (`removed: Some(0→1 c)`, 3 added transitions for $a, b, \#$)

#### Hand Simulation of $c$

- Initial: $(2, 0, [])$
- Step 1 ($2 \to 0$): $(0, 0, [\#])$
- Step 2 (reading $c$ via $0 \to 1, c, [\#] \to [\#]$): $(1, 1, [\#])$
- Step 3 ($1 \to 3, \varepsilon, [\#] \to []$): $(3, 1, [])$
- State 3 is accepting, stack is empty, remaining input is empty. **Accepted.**
- $ab$ and $cc$ are rejected (stack remains non-empty or dead-ends).

---

### 1.2 Fixture F2: Multi-pop $a^n b^n, n \ge 1$ (popping 2 symbols at once)

#### Input Machine $M$

- States: `0` (start), `1` (accepting). $m = 1$.
- Input alphabet: `["a", "b"]`
- Stack alphabet: `["A"]`
- Transitions (3 total):
  1. $0 \to 0$, read: `Some("a")`, pop: `[]`, push: `["A", "A"]`
  2. $0 \to 1$, read: `Some("b")`, pop: `["A", "A"]`, push: `[]`
  3. $1 \to 1$, read: `Some("b")`, pop: `["A", "A"]`, push: `[]`

#### RNF Derivation $M'$

- Stack alphabet: `["A", "#"]`
- States:
  - $s' = 2$, name `"s'"`
  - $a = 3$, name `"a"`
  - $v_1 = 4$, name `"v1"` (split of $0 \to 1$)
  - $v_2 = 5$, name `"v2"` (split of $1 \to 1$)
  - `new_states`: `[{ id: 2, name: "s'" }, { id: 3, name: "a" }, { id: 4, name: "v1" }, { id: 5, name: "v2" }]`
- Result Transitions (8 total):
  1. $2 \to 0$, read: `None`, pop: `[]`, push: `["#"]` (start)
  2. $1 \to 3$, read: `None`, pop: `["#"]`, push: `[]` (accept)
  3. Split of $0 \to 1, b, [A, A] \to []$:
     - $0 \to 4$, read: `None`, pop: `["A"]`, push: `[]`
     - $4 \to 1$, read: `Some("b")`, pop: `["A"]`, push: `[]` (reads $b$ on the last transition)
  4. Split of $1 \to 1, b, [A, A] \to []$:
     - $1 \to 5$, read: `None`, pop: `["A"]`, push: `[]`
     - $5 \to 1$, read: `Some("b")`, pop: `["A"]`, push: `[]` (reads $b$ on the last transition)
  5. Expand of $0 \to 0, a, [] \to [A, A]$:
     - for $A$: $0 \to 0$, read: `Some("a")`, pop: `["A"]`, push: `["A", "A", "A"]`
     - for $\#$: $0 \to 0$, read: `Some("a")`, pop: `["#"]`, push: `["A", "A", "#"]`

#### Trace Steps (5 total)

1. `pda.rnf.start`
2. `pda.rnf.accept { state: 1 }`
3. `pda.rnf.split { from: 0, to: 1, pops: 2 }`
4. `pda.rnf.split { from: 1, to: 1, pops: 2 }`
5. `pda.rnf.expand { from: 0, to: 0 }`

#### Hand Simulation of $aabb$

- Initial: $(2, 0, [])$
- $2 \to 0$: $(0, 0, [\#])$
- read $a$: $(0, 1, [A, A, \#])$
- read $a$: $(0, 2, [A, A, A, A, \#])$
- $\varepsilon$-move to 4: $(4, 2, [A, A, A, \#])$
- read $b$ to 1: $(1, 3, [A, A, \#])$
- $\varepsilon$-move to 5: $(5, 3, [A, \#])$
- read $b$ to 1: $(1, 4, [\#])$
- $\varepsilon$-move to 3: $(3, 4, [])$
- Accepted in 8 transitions.

---

### 1.3 Fixture F3: Split of 3 symbols with read symbol

#### Input Machine $M$

- States: `0` (start), `1` (accepting). $m = 1$.
- Input alphabet: `["a"]`
- Stack alphabet: `["W", "X", "Y", "Z"]`
- Transition: $0 \to 1$, read: `Some("a")`, pop: `["X", "Y", "Z"]`, push: `["W"]`

#### RNF Derivation $M'$

- Stack alphabet: `["W", "X", "Y", "Z", "#"]`
- States:
  - $s' = 2$, name `"s'"`
  - $a = 3$, name `"a"`
  - $v_1 = 4$, name `"v1"`
  - $v_2 = 5$, name `"v2"`
  - `new_states`: `[{ id: 2, name: "s'" }, { id: 3, name: "a" }, { id: 4, name: "v1" }, { id: 5, name: "v2" }]`
- Transitions (5 total):
  1. $2 \to 0$, read: `None`, pop: `[]`, push: `["#"]`
  2. $1 \to 3$, read: `None`, pop: `["#"]`, push: `[]`
  3. $0 \to 4$, read: `None`, pop: `["X"]`, push: `[]`
  4. $4 \to 5$, read: `None`, pop: `["Y"]`, push: `[]`
  5. $5 \to 1$, read: `Some("a")`, pop: `["Z"]`, push: `["W"]` (input symbol `a` on last transition)
- Trace Steps (3 total):
  1. `pda.rnf.start`
  2. `pda.rnf.accept { state: 1 }`
  3. `pda.rnf.split { from: 0, to: 1, pops: 3 }`

---

### 1.4 Fixture F4: Small cases

1. **No accepting states:**
   - Input: `states: [0]`, `start_state: Some(0)`, `accepting_states: []`, `input_alphabet: ["a"]`, `stack_alphabet: []`, `transitions: []`
   - Result: `stack_alphabet: ["#"]`, `states: [0, 1, 2]` (`s' = 1`, `a = 2`), `accepting_states: [2]`, `transitions`: 1 ($1 \to 0, \varepsilon, [] \to [\#]$), `steps`: 1 (`pda.rnf.start`).
2. **Already in single-pop form with 2 accepting states and empty stack alphabet:**
   - Input: `states: [0, 1, 2]`, `start_state: Some(0)`, `accepting_states: [1, 2]`, `stack_alphabet: []`, `transitions`: $0 \to 1, a, [] \to []$
   - Result: `stack_alphabet: ["#"]`, `s' = 3`, `a = 4`.
   - Steps (4 total): `pda.rnf.start`, `pda.rnf.accept { state: 1 }`, `pda.rnf.accept { state: 2 }`, `pda.rnf.expand { from: 0, to: 1 }` (1 added transition for `#`: $0 \to 1, a, [\#] \to [\#]$).
   - Transitions: $1 + 2 + 1 = 4$.
3. **Transition that both pops nothing and pushes two symbols (`[A, B]`):**
   - Expanded for $\Gamma_0 \in \{A, B, \#\}$ into 3 transitions pushing `[A, B, A]`, `[A, B, B]`, and `[A, B, #]` respectively (`push ++ [Γ0]`).

---

### 1.5 Fixture F5: Error cases

1. **`start_state: None`:**
   - Fails immediately in Step 1 with `Message { key: "pda.rnf.no_start_state", params: BTreeMap::new() }`.
2. **`stack_alphabet` contains `"#"`:**
   - Fails immediately in Step 1 with `Message { key: "pda.rnf.marker_clash", params: BTreeMap::from([("symbol", Value::String("#"))]) }`.

---

### 1.6 Note on `StateName` module placement

`StateName` was kept in `crates/engine-core/src/cfg_pda.rs` and imported in `crates/engine-core/src/pda_rnf.rs` (`pub use crate::cfg_pda::StateName;`), as both `cfg_pda` and `pda_rnf` are sibling PDA conversion modules and importing from `cfg_pda` does not point dependencies the wrong way. The exported TypeScript type in `crates/engine-core/src/ts.rs` remains `StateName`.

---

## 2. Red-Green Test-First Verification & Deliberate Breaks (AC5)

### 2.1 Initial Red Run (Tests Written Before Implementation)

When `pda_to_rnf` was initially stubbed to return `Err(Message::key("pda.rnf.not_implemented"))`, running `cargo test --test pda_rnf` failed on all positive tests as expected:

```text
running 8 tests
test test_fixture_f5_errors ... ok
test test_fixture_f1_structure ... FAILED
test test_fixture_f2_structure ... FAILED
test test_fixture_f3_structure ... FAILED
test test_fixture_f4_small_cases ... FAILED
test test_ac2_f1_language_equivalence ... FAILED
test test_ac2_f2_language_equivalence ... FAILED
test test_ac3_proptest_random_pdas ... FAILED

failures:

---- test_fixture_f1_structure stdout ----
thread 'test_fixture_f1_structure' panicked at crates/engine-core/tests/pda_rnf.rs:94:36:
called `Result::unwrap()` on an `Err` value: Message { key: "pda.rnf.not_implemented", params: {} }

test result: FAILED. 1 passed; 7 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
```

---

### 2.2 Eight Deliberate Breaks (AC5)

Each of the 8 rules in AC5 was deliberately broken in `crates/engine-core/src/pda_rnf.rs`, tested with `cargo test --test pda_rnf`, verified to fail, and then restored.

#### Break 1: Pop split transitions in the wrong order (`t.pop[n - 1 - i]` instead of `t.pop[i]`)

- **Change:** Reversed the pop indexing in Step 4 (`let pop_sym = t.pop[n - 1 - i];`).
- **Failed test:** `test_fixture_f3_structure`
- **Actual output:**

```text
running 11 tests
test test_fixture_f3_structure ... FAILED
...
---- test_fixture_f3_structure stdout ----
thread 'test_fixture_f3_structure' panicked at crates/engine-core/tests/pda_rnf.rs:250:5:
assertion `left == right` failed
  left: ["Z"]
 right: ["X"]
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace

failures:
    test_fixture_f3_structure

test result: FAILED. 10 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.19s
```

#### Break 2: Read the input symbol on the first transition of a split instead of the last (`i == 0` instead of `is_last`)

- **Change:** Set `let read = if i == 0 { t.read } else { None };` in Step 4.
- **Failed test:** `test_fixture_f3_structure` (note: `test_ac2_f2_language_equivalence` passed because intermediate states $v_1 \dots v_{n-1}$ have out-degree 1, in-degree 1, are non-accepting, and have no other transitions entering or leaving them; thus consuming the input symbol on the first link vs. the last link of an atomic chain accepts the exact same language, and the structural test `test_fixture_f3_structure` is what pins the Slide13 page 16 convention).
- **Actual output:**

```text
running 11 tests
test test_fixture_f3_structure ... FAILED
...
---- test_fixture_f3_structure stdout ----
thread 'test_fixture_f3_structure' panicked at crates/engine-core/tests/pda_rnf.rs:249:5:
assertion `left == right` failed
  left: Some("a")
 right: None

failures:
    test_fixture_f3_structure

test result: FAILED. 10 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.19s
```

#### Break 3: Push `Γ0 γ` instead of `γ Γ0` in Step 5 (`[Γ0] ++ push` instead of `push ++ [Γ0]`)

- **Change:** Pushed `gamma_0` before `t.push` (`let mut push = vec![gamma_0]; push.extend_from_slice(&t.push);`).
- **Failed test:** `test_ac2_f1_language_equivalence`
- **Actual output:**

```text
running 11 tests
test test_ac2_f1_language_equivalence ... FAILED
...
---- test_ac2_f1_language_equivalence stdout ----
thread 'test_ac2_f1_language_equivalence' panicked at crates/engine-core/tests/pda_rnf.rs:344:13:
assertion `left == right` failed: M' disagrees with oracle on aca
  left: false
 right: true

failures:
    test_ac2_f1_language_equivalence

test result: FAILED. 10 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.20s
```

#### Break 4: Omit `#` from the expansion of a pop-nothing transition (`0..(new_stack.len() - 1)`)

- **Change:** Expanded only over original stack symbols `0..pda.stack_alphabet.len()` instead of `0..new_stack.len()`.
- **Failed tests:** `test_fixture_f1_structure`, `test_fixture_f2_structure`, `test_fixture_f4_small_cases`, `test_ac2_f1_language_equivalence`, `test_ac2_f2_language_equivalence`, `test_ac3_proptest_random_pdas` (6 failed).
- **Actual output:**

```text
running 11 tests
test test_fixture_f1_structure ... FAILED
test test_fixture_f2_structure ... FAILED
test test_fixture_f4_small_cases ... FAILED
test test_ac2_f1_language_equivalence ... FAILED
test test_ac2_f2_language_equivalence ... FAILED
test test_ac3_proptest_random_pdas ... FAILED

failures:

---- test_fixture_f2_structure stdout ----
thread 'test_fixture_f2_structure' panicked at crates/engine-core/tests/pda_rnf.rs:197:5:
assertion `left == right` failed
  left: 7
 right: 8

---- test_ac2_f1_language_equivalence stdout ----
thread 'test_ac2_f1_language_equivalence' panicked at crates/engine-core/tests/pda_rnf.rs:344:13:
assertion `left == right` failed: M' disagrees with oracle on c
  left: false
 right: true

test result: FAILED. 5 passed; 6 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s
```

#### Break 5: Forget to pop `#` on the accept transition (`pop: Vec::new()`)

- **Change:** Set `pop: Vec::new()` on the $f \to a$ transitions in Step 3.
- **Failed tests:** `test_fixture_f1_structure`, `test_fixture_f2_structure`, `test_fixture_f3_structure`, `test_fixture_f4_small_cases`, `test_ac2_f1_language_equivalence`, `test_ac2_f2_language_equivalence`, `test_ac3_proptest_random_pdas` (7 failed).
- **Actual output:**

```text
---- test_ac2_f1_language_equivalence stdout ----
thread 'test_ac2_f1_language_equivalence' panicked at crates/engine-core/tests/pda_rnf.rs:344:13:
assertion `left == right` failed: M' disagrees with oracle on c
  left: false
 right: true

---- test_fixture_f1_structure stdout ----
thread 'test_fixture_f1_structure' panicked at crates/engine-core/tests/pda_rnf.rs:58:9:
assertion `left == right` failed: Non-start transition 1 -> 3 must pop 1 symbol, got 0
  left: 0
 right: 1

test result: FAILED. 4 passed; 7 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s
```

#### Break 6: Make `s'` accepting as well as `a` (`vec![a, s_prime]`)

- **Change:** Set `accepting_states` of $M'$ to `vec![a, s_prime]`.
- **Failed tests:** `test_fixture_f1_structure`, `test_fixture_f2_structure`, `test_fixture_f3_structure`, `test_fixture_f4_small_cases`, `test_ac2_f1_language_equivalence`, `test_ac2_f2_language_equivalence`, `test_ac3_proptest_random_pdas` (7 failed).
- **Actual output:**

```text
---- test_ac2_f1_language_equivalence stdout ----
thread 'test_ac2_f1_language_equivalence' panicked at crates/engine-core/tests/pda_rnf.rs:344:13:
assertion `left == right` failed: M' disagrees with oracle on
  left: true
 right: false

---- test_fixture_f1_structure stdout ----
thread 'test_fixture_f1_structure' panicked at crates/engine-core/tests/pda_rnf.rs:30:5:
assertion `left == right` failed: RNF PDA must have exactly one accepting state
  left: 2
 right: 1

test result: FAILED. 4 passed; 7 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s
```

#### Break 7: Sort the stack alphabet instead of appending `#` last (`new_stack.sort()`)

- **Change:** Sorted `new_stack` lexicographically so `"#"` moved to index 0 before `"A"` / `"a"`.
- **Failed tests:** `test_fixture_f1_structure`, `test_fixture_f2_structure`, `test_fixture_f3_structure`, `test_fixture_f4_small_cases`, `test_ac3_proptest_random_pdas` (5 failed).
- **Actual output:**

```text
---- test_ac3_proptest_random_pdas stdout ----
thread 'test_ac3_proptest_random_pdas' panicked at crates/engine-core/tests/pda_rnf.rs:479:9:
Test failed: assertion `left == right` failed
  left: Some("B")
 right: Some("#"); minimal failing input: (pda, test_strings) = (Pda { kind: Ndpda, states: [0], start_state: Some(0), accepting_states: [], input_alphabet: ["a"], stack_alphabet: ["B"], transitions: [] }, ["", "a", "aa", "aaa"])

test result: FAILED. 6 passed; 5 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s
```

#### Break 8: Number or name the split states in the wrong order (`format!("v{}", 100 - v_counter)`)

- **Change:** Named split states `v99`, `v98`, etc. instead of `v1`, `v2`, ...
- **Failed tests:** `test_fixture_f2_structure`, `test_fixture_f3_structure` (2 failed).
- **Actual output:**

```text
---- test_fixture_f2_structure stdout ----
thread 'test_fixture_f2_structure' panicked at crates/engine-core/tests/pda_rnf.rs:182:5:
assertion `left == right` failed
  left: [StateName { id: 2, name: "s'" }, StateName { id: 3, name: "a" }, StateName { id: 4, name: "v99" }, StateName { id: 5, name: "v98" }]
 right: [StateName { id: 2, name: "s'" }, StateName { id: 3, name: "a" }, StateName { id: 4, name: "v1" }, StateName { id: 5, name: "v2" }]

test result: FAILED. 9 passed; 2 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.19s
```

---

### 2.3 PR 161 Review Fix: Transition Count Pre-Check Before Step 5 and `to_wire` Error Handling

1. **Test written first (`test_f5_transitions_limit_precheck_is_fast`):**
   - Crafted a 1-state PDA with `20 × 255 = 5,100` pop-nothing transitions (differing by `push: vec![SymbolId(i), SymbolId(j)]`) and a stack alphabet of `255` symbols (`|Γ'| = 256`).
   - Expanding all pop-nothing transitions in Step 5 would allocate `5,100 × 256 = 1,305,600` transitions and wire copies before hitting `MAX_TRANSITIONS` (`100,000`).
   - **Before fix (failing on `< 50ms` timing assertion at `2.696657374s`):**

```text
running 1 test
crafted 5100x256 expansion elapsed: 2.696657374s

thread 'test_f5_transitions_limit_precheck_is_fast' (772231) panicked at crates/engine-core/tests/pda_rnf.rs:718:5:
expected pre-check to return in < 50ms without building 1.3M transitions, took 2.696657374s
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
test test_f5_transitions_limit_precheck_is_fast ... FAILED

test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 11 filtered out; finished in 2.71s
```

2. **Fix applied:**
   - Pre-computed `1 + accepting states + single-pop transitions + sum(multi-pop lengths) + (pop-nothing transitions × |Γ'|)` using `usize::checked_add` and `usize::checked_mul` right before Step 5, returning `limit_exceeded("transitions", MAX_TRANSITIONS)` immediately if it overflows or exceeds `MAX_TRANSITIONS` (`100_000`), while keeping the end check intact.
   - Replaced `unwrap_or_default()` in `to_wire` with `Result<PdaWireTransition, Message>` returning `Message::new("machine.unknown_symbol")`.
   - **After fix (passing in `503.437µs`, ~5,350× faster):**

```text
running 1 test
crafted 5100x256 expansion elapsed: 503.437µs
test test_f5_transitions_limit_precheck_is_fast ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 11 filtered out; finished in 0.00s
```

---

## 3. Property Tests: 3 Runs of `PROPTEST_CASES=1000 cargo test --test pda_rnf`

```text
=== PROPTEST_CASES=1000 Run 1 ===
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.07s
     Running tests/pda_rnf.rs (target/debug/deps/pda_rnf-affb0f455492b0e1)

running 12 tests
test test_ac4_max_id_is_a_limit_message ... ok
test test_fixture_f2_structure ... ok
test test_fixture_f1_structure ... ok
test test_fixture_f3_structure ... ok
test test_fixture_f4_small_cases ... ok
test test_f5_transitions_limit_precheck_is_fast ... ok
test test_fixture_f5_errors ... ok
test test_ac2_f2_language_equivalence ... ok
test test_ac4_ids_near_top_of_u32_never_panic ... ok
test test_ac2_f1_language_equivalence ... ok
test test_ac4_arbitrary_text_never_panics ... ok
test test_ac3_proptest_random_pdas ... ok

test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.37s

=== PROPTEST_CASES=1000 Run 2 ===
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.04s
     Running tests/pda_rnf.rs (target/debug/deps/pda_rnf-affb0f455492b0e1)

running 12 tests
test test_ac4_max_id_is_a_limit_message ... ok
test test_fixture_f1_structure ... ok
test test_fixture_f2_structure ... ok
test test_fixture_f4_small_cases ... ok
test test_fixture_f3_structure ... ok
test test_f5_transitions_limit_precheck_is_fast ... ok
test test_fixture_f5_errors ... ok
test test_ac2_f2_language_equivalence ... ok
test test_ac4_ids_near_top_of_u32_never_panic ... ok
test test_ac2_f1_language_equivalence ... ok
test test_ac4_arbitrary_text_never_panics ... ok
test test_ac3_proptest_random_pdas ... ok

test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.85s

=== PROPTEST_CASES=1000 Run 3 ===
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.05s
     Running tests/pda_rnf.rs (target/debug/deps/pda_rnf-affb0f455492b0e1)

running 12 tests
test test_ac4_max_id_is_a_limit_message ... ok
test test_fixture_f2_structure ... ok
test test_fixture_f1_structure ... ok
test test_fixture_f3_structure ... ok
test test_fixture_f4_small_cases ... ok
test test_f5_transitions_limit_precheck_is_fast ... ok
test test_fixture_f5_errors ... ok
test test_ac2_f2_language_equivalence ... ok
test test_ac4_ids_near_top_of_u32_never_panic ... ok
test test_ac2_f1_language_equivalence ... ok
test test_ac4_arbitrary_text_never_panics ... ok
test test_ac3_proptest_random_pdas ... ok

test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 5.06s
```

---

## 4. Verification Outputs

### 4.1 `cargo fmt --check` and `cargo clippy --all-targets -- -D warnings`

```text
=== cargo fmt --check ===
(exit 0, no output)
=== cargo clippy ===
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.13s
```

### 4.2 `cargo test`

```text
     Running unittests src/lib.rs (target/debug/deps/engine_core-1abfb64c974da142)
running 26 tests
test result: ok. 26 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
...
     Running tests/pda_rnf.rs (target/debug/deps/pda_rnf-ebae4131aa135941)
running 11 tests
test test_ac2_f1_language_equivalence ... ok
test test_ac2_f2_language_equivalence ... ok
test test_ac4_max_id_is_a_limit_message ... ok
test test_fixture_f1_structure ... ok
test test_fixture_f2_structure ... ok
test test_fixture_f3_structure ... ok
test test_fixture_f4_small_cases ... ok
test test_fixture_f5_errors ... ok
test test_ac4_ids_near_top_of_u32_never_panic ... ok
test test_ac4_arbitrary_text_never_panics ... ok
test test_ac3_proptest_random_pdas ... ok

test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.44s
```

(All 34 test binaries in `crates/engine-core` and `crates/engine-wasm` passed with 0 failures.)

### 4.3 `pnpm test:wasm` (`wasm-pack test --node crates/engine-wasm`)

```text
     Running unittests src/lib.rs (target/wasm32-unknown-unknown/debug/deps/engine_wasm-05ce57d4d60e8c26.wasm)

running 12 tests
test tests::pda_to_rnf_answers_in_envelope ... ok
test tests::cfg_to_pda_bottomup_answers_in_envelope ... ok
test tests::cfg_to_pda_topdown_answers_in_envelope ... ok
test tests::cyk_parse_answers_in_envelope ... ok
test tests::grammar_to_cnf_answers_in_envelope ... ok
test tests::minimize_Returns_error_envelope_for_ndfsm ... ok
test tests::parse_and_to_jff_roundtrip ... ok
test tests::parse_and_to_pda_jff_roundtrip ... ok
test tests::parse_grammar_answers_in_envelope ... ok
test tests::simulate_answers_in_envelope ... ok
test tests::simulate_pda_answers_in_envelope ... ok
test tests::validate_pda_answers_in_envelope ... ok

test result: ok. 12 passed; 0 failed; 0 ignored
```

### 4.4 `pnpm check`, `pnpm lint`, `pnpm format:check`, `pnpm check:strings`, `pnpm check:tokens`

```text
=== pnpm check ===
> svelte-kit sync && svelte-check --tsconfig ./tsconfig.json
svelte-check found 0 errors and 0 warnings

=== pnpm lint ===
> pnpm --filter web lint && pnpm lint:rust
> eslint .
> cargo clippy --workspace --all-targets -- -D warnings
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.10s

=== pnpm format:check ===
> prettier --check "web/**/*.{ts,js,svelte,css,md,json}" "docs/**/*.md" "*.md" && cargo fmt --all -- --check
Checking formatting...
All matched files use Prettier code style!

=== pnpm check:strings ===
> node tools/check-no-raw-strings.mjs
ok   63 components have no hard-coded text

=== pnpm check:tokens ===
> node tools/check-tokens.mjs
ok   65 files use no raw colors
```

### 4.5 `pnpm --filter web exec vitest run`

```text
 RUN  v3.2.4 /home/Aldebaran64/webtomata/web

 ✓ src/lib/engine/handlers.test.ts (32 tests) 26ms
 ...
 Test Files  92 passed (92)
      Tests  1183 passed | 2 skipped (1185)
   Start at  15:52:48
   Duration  14.23s (transform 3.55s, setup 0ms, collect 17.54s, tests 24.44s, environment 36.11s, prepare 11.46s)
```

### 4.6 `pnpm build` and `pnpm size` (Before and After)

- **Before (`staging` at `1f23dd3`):**
  - WASM size: `229.0 KB gzip`
- **After (`task/T-036-pda-to-rnf`):**

```text
> node tools/check-bundle-size.mjs

ok   wasm: 231.1 KB gzip (limit 250 KB)
ok   initial JS on 404.html: 97.6 KB gzip (limit 170 KB)
ok   initial JS on guides/dfa-vs-ndfa.html: 101.8 KB gzip (limit 170 KB)
ok   initial JS on guides/jflap-import-export.html: 101.8 KB gzip (limit 170 KB)
ok   initial JS on guides/minimisasi-dfa.html: 101.8 KB gzip (limit 170 KB)
ok   initial JS on guides/pumping-lemma.html: 101.8 KB gzip (limit 170 KB)
ok   initial JS on guides/regex-dan-ekivalensi.html: 101.8 KB gzip (limit 170 KB)
ok   initial JS on guides/substrings-subsequences.html: 101.8 KB gzip (limit 170 KB)
ok   initial JS on guides/urutan-kanonik.html: 101.8 KB gzip (limit 170 KB)
ok   initial JS on guides.html: 103.5 KB gzip (limit 170 KB)
ok   initial JS on index.html: 102.7 KB gzip (limit 170 KB)
ok   initial JS on privacy.html: 100.8 KB gzip (limit 170 KB)
ok   initial JS on questions.html: 108.4 KB gzip (limit 170 KB)
ok   initial JS on sandbox.html: 118.8 KB gzip (limit 170 KB)
```

### 4.7 What Was Not Run and Why

- Playwright e2e browser tests (`pnpm test:e2e`, `pnpm test:e2e:cross`) were not run because T-036 touches only the Rust/WASM engine, worker RPC protocol/handlers, i18n dictionaries, and documentation (no UI components or routes were modified, per `AGENTS.md` section 8: "Engine, documentation and unit-test tasks do not need e2e").
- Real phone hardware and live site checks belong to the owner.
