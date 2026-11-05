# Report: T-037 PDA in restricted normal form to CFG, with a trace

## 1. Hand Derivations (Pre-implementation)

All hand derivations below were computed directly from the T-037 specification and Slide13 pages 20–27 **before** writing or running any engine code or tests.

---

### 1.1 Fixture F1: $wcw^R$ ($w \in \{a, b\}^*$)

#### Input RNF Machine $M$ (from `pda_to_rnf` on F1 of T-036)

- **States:** `0` ($s$), `1` ($f$), `2` ($s'$), `3` ($a$).
  - Start state: `Some(2)` ($s' = 2$)
  - Accepting states: `[3]` ($a = 3$)
  - Active states $K = \text{states} \setminus \{s'\} = \{0, 1, 3\}$, so $m = |K| = k - 1 = 3$.
- **Input alphabet $\Sigma$:** `["a", "b", "c"]` (IDs `0`, `1`, `2`).
- **Stack alphabet $\Gamma$:** `["a", "b", "#"]` (IDs `0` = `"a"`, `1` = `"b"`, `2` = `"#"`).
- **Start transition (from $s' = 2$):**
  - `2 -> 0`, read `None`, pop `[]`, push `["#"]` (pushes marker `#`, ID `2`, to state $s = 0$).
- **Transitions not from $s'$ (12 transitions, in `Pda::new` sorted order `(from, read, pop, to, push)`):**
  1. `0 -> 0`, read `Some("a")`, pop `["a"]` (id 0), push `["a", "a"]` (ids `[0, 0]`, $n = 2$)
  2. `0 -> 0`, read `Some("a")`, pop `["b"]` (id 1), push `["a", "b"]` (ids `[0, 1]`, $n = 2$)
  3. `0 -> 0`, read `Some("a")`, pop `["#"]` (id 2), push `["a", "#"]` (ids `[0, 2]`, $n = 2$)
  4. `0 -> 0`, read `Some("b")`, pop `["a"]` (id 0), push `["b", "a"]` (ids `[1, 0]`, $n = 2$)
  5. `0 -> 0`, read `Some("b")`, pop `["b"]` (id 1), push `["b", "b"]` (ids `[1, 1]`, $n = 2$)
  6. `0 -> 0`, read `Some("b")`, pop `["#"]` (id 2), push `["b", "#"]` (ids `[1, 2]`, $n = 2$)
  7. `0 -> 1`, read `Some("c")`, pop `["a"]` (id 0), push `["a"]` (ids `[0]`, $n = 1$)
  8. `0 -> 1`, read `Some("c")`, pop `["b"]` (id 1), push `["b"]` (ids `[1]`, $n = 1$)
  9. `0 -> 1`, read `Some("c")`, pop `["#"]` (id 2), push `["#"]` (ids `[2]`, $n = 1$)
  10. `1 -> 3`, read `None`, pop `["#"]` (id 2), push `[]` ($n = 0$)
  11. `1 -> 1`, read `Some("a")`, pop `["a"]` (id 0), push `[]` ($n = 0$)
  12. `1 -> 1`, read `Some("b")`, pop `["b"]` (id 1), push `[]` ($n = 0$)

#### Rule Count & Step Count Derivation

- Start rule (Step 1, `pda_cfg.start`): **1 rule**
  - `S -> V_0g2p3`
- Epsilon block (Step 2, `pda_cfg.empty { count: 3 }`): $m = 3$ **rules** (for $q \in \{0, 1, 3\}$ ascending):
  - `V_0gep0 -> ε`
  - `V_1gep1 -> ε`
  - `V_3gep3 -> ε`
- 6 double-push transitions (Steps 3–8, each `pda_cfg.push { from: 0, to: 0, pushes: 2 }`): each produces $m^2 = 3^2 = 9$ rules $\implies 6 \times 9 = \mathbf{54}$ **rules**:
  - Step 3 (`0 -> 0, a, [a] -> [a, a]`, where $q=0, r=0, \gamma=0, \gamma_1=0, \gamma_2=0$):
    Tuples $(v_1, v_2) \in \{0, 1, 3\}^2$ with $v_1$ slowest, $v_2$ fastest:
    1. $(0, 0)$: `V_0g0p0 -> a V_0g0p0 V_0g0p0`
    2. $(0, 1)$: `V_0g0p1 -> a V_0g0p0 V_0g0p1`
    3. $(0, 3)$: `V_0g0p3 -> a V_0g0p0 V_0g0p3`
    4. $(1, 0)$: `V_0g0p0 -> a V_0g0p1 V_1g0p0`
    5. $(1, 1)$: `V_0g0p1 -> a V_0g0p1 V_1g0p1`
    6. $(1, 3)$: `V_0g0p3 -> a V_0g0p1 V_1g0p3`
    7. $(3, 0)$: `V_0g0p0 -> a V_0g0p3 V_3g0p0`
    8. $(3, 1)$: `V_0g0p1 -> a V_0g0p3 V_3g0p1`
    9. $(3, 3)$: `V_0g0p3 -> a V_0g0p3 V_3g0p3`
  - Step 5 (`0 -> 0, a, [#] -> [a, #]`, where $q=0, r=0, \gamma=2, \gamma_1=0, \gamma_2=2$):
    First rule $(v_1=0, v_2=0)$: `V_0g2p0 -> a V_0g0p0 V_0g2p0`.
    Sixth rule $(v_1=1, v_2=3)$: `V_0g2p3 -> a V_0g0p1 V_1g2p3`.
- 3 single-push transitions (Steps 9–11, each `pda_cfg.push { from: 0, to: 1, pushes: 1 }`): each produces $m^1 = 3$ rules $\implies 3 \times 3 = \mathbf{9}$ **rules**:
  - Step 9 (`0 -> 1, c, [a] -> [a]`, where $q=0, r=1, \gamma=0, \gamma_1=0$):
    For $v_1 \in \{0, 1, 3\}$:
    1. `V_0g0p0 -> c V_1g0p0`
    2. `V_0g0p1 -> c V_1g0p1`
    3. `V_0g0p3 -> c V_1g0p3`
- 3 push-nothing transitions (Steps 12–14): each produces $m = 3$ rules $\implies 3 \times 3 = \mathbf{9}$ **rules**:
  - Step 12 (`1 -> 3, ε, [#] -> []`, `pda_cfg.push_none { from: 1, to: 3 }`):
    For $w \in \{0, 1, 3\}$:
    1. `V_1g2p0 -> V_3gep0`
    2. `V_1g2p1 -> V_3gep1`
    3. `V_1g2p3 -> V_3gep3`
  - Step 13 (`1 -> 1, a, [a] -> []`, `pda_cfg.push_none { from: 1, to: 1 }`):
    For $w \in \{0, 1, 3\}$:
    1. `V_1g0p0 -> a V_1gep0`
    2. `V_1g0p1 -> a V_1gep1`
    3. `V_1g0p3 -> a V_1gep3`
  - Step 14 (`1 -> 1, b, [b] -> []`, `pda_cfg.push_none { from: 1, to: 1 }`):
    For $w \in \{0, 1, 3\}$:
    1. `V_1g1p0 -> b V_1gep0`
    2. `V_1g1p1 -> b V_1gep1`
    3. `V_1g1p3 -> b V_1gep3`

- **Total rules:** $1 + 3 + 54 + 9 + 9 = \mathbf{76}$ rules.
- **Total steps:** $2 + 12 = \mathbf{14}$ steps.
- **First entry of `variables`:** `{ name: "V_0g0p0", from: StateId(0), stack: Some("a"), to: StateId(0) }`.

#### Cleanup Derivation (Productive & Reachable Rules of F1)

1. **Productive variables:**
   - Base ($\varepsilon$-rules): `V_0gep0`, `V_1gep1`, `V_3gep3`.
   - From Step 12 (`1 -> 3, ε, [#] -> []`): only `V_3gep3` is productive on the RHS, so `V_1g2p3` (`V_1g2p3 -> V_3gep3`) is productive.
   - From Steps 13–14 (`1 -> 1, a/b, [a/b] -> []`): only $w = 1$ gives a productive RHS (`V_1gep1`), so `V_1g0p1` (`V_1g0p1 -> a V_1gep1`) and `V_1g1p1` (`V_1g1p1 -> b V_1gep1`) are productive.
   - From Steps 9–11 (`0 -> 1, c, [\gamma] -> [\gamma]`): `V_0g0p1 -> c V_1g0p1`, `V_0g1p1 -> c V_1g1p1`, and `V_0g2p3 -> c V_1g2p3` are productive, making `V_0g0p1`, `V_0g1p1`, and `V_0g2p3` productive.
   - From Steps 3–8 (`0 -> 0, a/b, [\gamma] -> [\gamma_1, \gamma]`): a rule `V_0g{\gamma}p{v2} -> c V_0g{\gamma_1}p{v1} V_{v1}g{\gamma}p{v2}` is productive iff both `V_0g{\gamma_1}p{v1}` and `V_{v1}g{\gamma}p{v2}` are productive, which holds only for $v_1 = 1$ and $(\gamma=0, v_2=1)$, $(\gamma=1, v_2=1)$, or $(\gamma=2, v_2=3)$ (6 rules).
   - And `S -> V_0g2p3` is productive.
2. **Reachable from `S` among productive rules:**
   - `S` reaches `V_0g2p3`, which reaches `V_0g0p1`, `V_0g1p1`, `V_1g2p3`, which reach `V_1g0p1`, `V_1g1p1`, `V_3gep3`, which reach `V_1gep1`. (`V_0gep0` is productive but unreachable from `S`.)
3. **Remaining 15 rules (in grammar order):**
   1. `S -> V_0g2p3`
   2. `V_1gep1 -> ε`
   3. `V_3gep3 -> ε`
   4. `V_0g0p1 -> a V_0g0p1 V_1g0p1`
   5. `V_0g1p1 -> a V_0g0p1 V_1g1p1`
   6. `V_0g2p3 -> a V_0g0p1 V_1g2p3`
   7. `V_0g0p1 -> b V_0g1p1 V_1g0p1`
   8. `V_0g1p1 -> b V_0g1p1 V_1g1p1`
   9. `V_0g2p3 -> b V_0g1p1 V_1g2p3`
   10. `V_0g0p1 -> c V_1g0p1`
   11. `V_0g1p1 -> c V_1g1p1`
   12. `V_0g2p3 -> c V_1g2p3`
   13. `V_1g2p3 -> V_3gep3`
   14. `V_1g0p1 -> a V_1gep1`
   15. `V_1g1p1 -> b V_1gep1`

#### Hand Derivations on F1

- **`abcba`:**
  $$S \Rightarrow V_{0\text{g}2\text{p}3} \Rightarrow a\,V_{0\text{g}0\text{p}1}\,V_{1\text{g}2\text{p}3} \Rightarrow a\,b\,V_{0\text{g}1\text{p}1}\,V_{1\text{g}0\text{p}1}\,V_{1\text{g}2\text{p}3} \Rightarrow a\,b\,c\,V_{1\text{g}1\text{p}1}\,V_{1\text{g}0\text{p}1}\,V_{1\text{g}2\text{p}3}$$
  $$\Rightarrow a\,b\,c\,b\,V_{1\text{gep}1}\,V_{1\text{g}0\text{p}1}\,V_{1\text{g}2\text{p}3} \Rightarrow a\,b\,c\,b\,V_{1\text{g}0\text{p}1}\,V_{1\text{g}2\text{p}3} \Rightarrow a\,b\,c\,b\,a\,V_{1\text{gep}1}\,V_{1\text{g}2\text{p}3}$$
  $$\Rightarrow a\,b\,c\,b\,a\,V_{1\text{g}2\text{p}3} \Rightarrow a\,b\,c\,b\,a\,V_{3\text{gep}3} \Rightarrow abcba$$
- **`c`:**
  $$S \Rightarrow V_{0\text{g}2\text{p}3} \Rightarrow c\,V_{1\text{g}2\text{p}3} \Rightarrow c\,V_{3\text{gep}3} \Rightarrow c$$

---

### 1.2 Fixture F2: $a^n b^n$ ($n \ge 1$) with Split States

#### Input RNF Machine $M$ (from `pda_to_rnf` on F2 of T-036)

- **States:** `0` ($s$), `1` ($f$), `2` ($s'$), `3` ($a$), `4` ($v_1$), `5` ($v_2$).
  - Start state: `Some(2)` ($s' = 2$), accepting states: `[3]` ($a = 3$).
  - Active states $K = \{0, 1, 3, 4, 5\}$, so $m = |K| = k - 1 = 5$.
- **Input alphabet $\Sigma$:** `["a", "b"]` (IDs `0`, `1`).
- **Stack alphabet $\Gamma$:** `["A", "#"]` (IDs `0` = `"A"`, `1` = `"#"`).
- **Start transition (from $s' = 2$):** `2 -> 0`, read `None`, pop `[]`, push `["#"]` (id 1).
- **Transitions not from $s'$ (7 transitions in `Pda::new` sorted order):**
  1. `0 -> 4`, read `None`, pop `["A"]` (id 0), push `[]` ($n = 0$)
  2. `0 -> 0`, read `Some("a")`, pop `["A"]` (id 0), push `["A", "A", "A"]` ($n = 3$)
  3. `0 -> 0`, read `Some("a")`, pop `["#"]` (id 1), push `["A", "A", "#"]` ($n = 3$)
  4. `1 -> 5`, read `None`, pop `["A"]` (id 0), push `[]` ($n = 0$)
  5. `1 -> 3`, read `None`, pop `["#"]` (id 1), push `[]` ($n = 0$)
  6. `4 -> 1`, read `Some("b")`, pop `["A"]` (id 0), push `[]` ($n = 0$)
  7. `5 -> 1`, read `Some("b")`, pop `["A"]` (id 0), push `[]` ($n = 0$)

#### Rule Count & Step Count Derivation

- Step 1 (`pda_cfg.start`): **1 rule** (`S -> V_0g1p3`)
- Step 2 (`pda_cfg.empty { count: 5 }`): **5 rules** (`V_0gep0 -> ε`, `V_1gep1 -> ε`, `V_3gep3 -> ε`, `V_4gep4 -> ε`, `V_5gep5 -> ε`)
- 5 push-nothing transitions (`0 -> 4`, `1 -> 5`, `1 -> 3`, `4 -> 1`, `5 -> 1`): each is `pda_cfg.push_none { from, to }` with $m = 5$ rules $\implies 5 \times 5 = \mathbf{25}$ **rules**.
- 2 triple-push transitions (`0 -> 0` on `A` and `#`): each is `pda_cfg.push { from: 0, to: 0, pushes: 3 }` with $m^3 = 5^3 = 125$ rules $\implies 2 \times 125 = \mathbf{250}$ **rules**.
- **Total rules:** $1 + 5 + 25 + 250 = \mathbf{281}$ rules.
- **Total steps:** $2 + 7 = \mathbf{9}$ steps.

---

### 1.3 Fixture F3: Smallest RNF Machine Accepting $\{\varepsilon\}$

#### Input RNF Machine $M$

- **States:** `0` ($s'$), `1` ($s$), `2` ($a$).
  - Start state: `Some(0)` ($s' = 0$), accepting states: `[2]` ($a = 2$).
  - Active states $K = \{1, 2\}$, so $m = |K| = k - 1 = 2$.
- **Input alphabet $\Sigma$:** `["a"]` (id `0`), **Stack alphabet $\Gamma$:** `["#"]` (id `0`).
- **Transitions:** `0 -> 1, None, [], ["#"]` and `1 -> 2, None, ["#"], []`.

#### Complete Rules (5 rules in exact order) & Steps (3 steps)

1. **Step 1 (`pda_cfg.start`, 1 rule):** `S -> V_1g0p2`
2. **Step 2 (`pda_cfg.empty { count: 2 }`, 2 rules):** `V_1gep1 -> ε`, `V_2gep2 -> ε`
3. **Step 3 (`pda_cfg.push_none { from: 1, to: 2 }`, 2 rules):** `V_1g0p1 -> V_2gep1`, `V_1g0p2 -> V_2gep2`

#### Hand Derivation of $\varepsilon$

$$S \Rightarrow V_{1\text{g}0\text{p}2} \Rightarrow V_{2\text{gep}2} \Rightarrow \varepsilon$$

---

## 2. Empty-Language Pinning Test, Red-Green Run, and Deliberate Breaks (AC5)

### 2.1 Pinning Test for `CnfTransformer` and `CykParser` on an Empty-Language Grammar (Reminder 1 & AC2)

`test_pin_empty_language_cnf_and_cyk` in `crates/engine-core/tests/pda_cfg.rs` transforms `Grammar::new("S", vec![Production::new("S", vec![Symbol::NonTerminal("V_0g0p1")])])` (where `V_0g0p1` has no rules) with `CnfTransformer::transform`:
- `CnfTransformer::transform` returns `Ok(trace)` where `trace.final_grammar.start == "S"` and `trace.final_grammar.rules` is empty (`[]`).
- `CykParser::parse(&trace.final_grammar, "")` and `CykParser::parse(&trace.final_grammar, "a")` both return `Ok(CykResult { accepted: false, .. })`.
- Therefore, `derives(grammar, w)` calls `CnfTransformer::transform(grammar)` and `CykParser::parse(&trace.final_grammar, w)`, panics on any `Err`, and returns `res.accepted`.

### 2.2 Initial Red Run (Tests Written Before Implementation)

When `pda_to_cfg` was stubbed to return `Err(Message::new("pda_cfg.not_implemented"))`, running `cargo test -p engine-core --test pda_cfg` failed on all 11 conversion tests while `test_pin_empty_language_cnf_and_cyk` and `test_ac4_api_never_panics_on_arbitrary_text` passed:

```text
running 13 tests
test test_ac2_f1_language_equivalence ... FAILED
test test_ac2_f2_language_equivalence ... FAILED
test test_ac2_f3_language_equivalence ... FAILED
test test_fixture_f2_structure ... FAILED
test test_fixture_f1_structure_and_cleanup ... FAILED
test test_fixture_f3_structure ... FAILED
test test_fixture_f4_input_errors ... FAILED
test test_ac3a_random_pdas_through_rnf ... FAILED
test test_fixture_f5_limits_and_high_state_ids ... FAILED
test test_pin_empty_language_cnf_and_cyk ... ok
test test_ac3b_chain_cfg_pda_rnf_cfg ... FAILED
test test_ac4_non_rnf_pdas_and_high_state_ids ... FAILED
test test_ac4_api_never_panics_on_arbitrary_text ... ok

test result: FAILED. 2 passed; 11 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s
```

---

### 2.3 Ten Deliberate Breaks (AC5)

Each of the 10 properties in AC5 was deliberately broken in `crates/engine-core/src/pda_cfg.rs`, verified to fail with `cargo test -p engine-core --test pda_cfg`, and then restored.

#### Break 1: Put `<v1,γ2,v2>` before `<r,γ1,v1>` in the body (`nt_body.swap(0, 1)`)

- **Failed tests:** `test_fixture_f1_structure_and_cleanup`, `test_fixture_f2_structure`, `test_ac2_f1_language_equivalence`, `test_ac2_f2_language_equivalence`
- **Actual output:**

```text
---- test_fixture_f1_structure_and_cleanup stdout ----
thread 'test_fixture_f1_structure_and_cleanup' (781845) panicked at crates/engine-core/tests/pda_cfg.rs:345:5:
assertion `left == right` failed
  left: "V_0g0p1 -> a V_0g0p1 V_0g0p0"
 right: "V_0g0p1 -> a V_0g0p0 V_0g0p1"

---- test_fixture_f2_structure stdout ----
thread 'test_fixture_f2_structure' (781846) panicked at crates/engine-core/tests/pda_cfg.rs:501:5:
assertion `left == right` failed
  left: "V_0g0p0 -> a V_0g0p1 V_0g0p0 V_1g0p0"
 right: "V_0g0p0 -> a V_0g0p0 V_0g0p1 V_1g0p0"

---- test_ac2_f2_language_equivalence stdout ----
thread 'test_ac2_f2_language_equivalence' (781843) panicked at crates/engine-core/tests/pda_cfg.rs:995:9:
assertion `left == right` failed: F2 language mismatch on string "aabb": expected true, got false
  left: false
 right: true

---- test_ac2_f1_language_equivalence stdout ----
thread 'test_ac2_f1_language_equivalence' (781842) panicked at crates/engine-core/tests/pda_cfg.rs:972:9:
assertion `left == right` failed: F1 language mismatch on string "aaaca": expected false, got true
  left: true
 right: false

test result: FAILED. 5 passed; 4 failed; 0 ignored; 0 measured; 4 filtered out; finished in 0.13s
```

#### Break 2: Reverse the `push` list when reading it (`t.push[n - 1 - i]`)

- **Failed tests:** `test_fixture_f1_structure_and_cleanup`, `test_ac2_f1_language_equivalence`, `test_ac2_f2_language_equivalence`
- **Actual output:**

```text
---- test_fixture_f1_structure_and_cleanup stdout ----
thread 'test_fixture_f1_structure_and_cleanup' (782290) panicked at crates/engine-core/tests/pda_cfg.rs:350:5:
assertion `left == right` failed
  left: "V_0g2p0 -> a V_0g2p0 V_0g0p0"
 right: "V_0g2p0 -> a V_0g0p0 V_0g2p0"

---- test_ac2_f1_language_equivalence stdout ----
thread 'test_ac2_f1_language_equivalence' (782287) panicked at crates/engine-core/tests/pda_cfg.rs:972:9:
assertion `left == right` failed: F1 language mismatch on string "aca": expected true, got false
  left: false
 right: true

---- test_ac2_f2_language_equivalence stdout ----
thread 'test_ac2_f2_language_equivalence' (782288) panicked at crates/engine-core/tests/pda_cfg.rs:995:9:
assertion `left == right` failed: F2 language mismatch on string "ab": expected true, got false
  left: false
 right: true

test result: FAILED. 6 passed; 3 failed; 0 ignored; 0 measured; 4 filtered out; finished in 0.13s
```

#### Break 3: Leave out the $\varepsilon$ block (`<q, ε, q> -> ε`)

- **Failed tests:** `test_fixture_f1_structure_and_cleanup`, `test_fixture_f2_structure`, `test_fixture_f3_structure`, `test_fixture_f5_limits_and_high_state_ids`, `test_ac2_f1_language_equivalence`, `test_ac2_f2_language_equivalence`, `test_ac2_f3_language_equivalence`
- **Actual output:**

```text
---- test_ac2_f3_language_equivalence stdout ----
thread 'test_ac2_f3_language_equivalence' (782740) panicked at crates/engine-core/tests/pda_cfg.rs:1006:5:
assertion failed: derives(&cfg, "")

---- test_fixture_f1_structure_and_cleanup stdout ----
thread 'test_fixture_f1_structure_and_cleanup' (782741) panicked at crates/engine-core/tests/pda_cfg.rs:305:5:
assertion `left == right` failed
  left: 73
 right: 76

---- test_ac2_f1_language_equivalence stdout ----
thread 'test_ac2_f1_language_equivalence' (782738) panicked at crates/engine-core/tests/pda_cfg.rs:972:9:
assertion `left == right` failed: F1 language mismatch on string "c": expected true, got false
  left: false
 right: true

---- test_ac2_f2_language_equivalence stdout ----
thread 'test_ac2_f2_language_equivalence' (782739) panicked at crates/engine-core/tests/pda_cfg.rs:995:9:
assertion `left == right` failed: F2 language mismatch on string "ab": expected true, got false
  left: false
 right: true

test result: FAILED. 2 passed; 7 failed; 0 ignored; 0 measured; 4 filtered out; finished in 0.12s
```

#### Break 4: Build `S -> <s, #, s>` instead of `S -> <s, #, a>`

- **Failed tests:** `test_fixture_f1_structure_and_cleanup`, `test_fixture_f3_structure`, `test_ac2_f1_language_equivalence`, `test_ac2_f2_language_equivalence`, `test_ac2_f3_language_equivalence`
- **Actual output:**

```text
---- test_fixture_f3_structure stdout ----
thread 'test_fixture_f3_structure' (783188) panicked at crates/engine-core/tests/pda_cfg.rs:539:5:
assertion `left == right` failed
  left: ["S -> V_1g0p1", "V_1gep1 -> ε", "V_2gep2 -> ε", "V_1g0p1 -> V_2gep1", "V_1g0p2 -> V_2gep2"]
 right: ["S -> V_1g0p2", "V_1gep1 -> ε", "V_2gep2 -> ε", "V_1g0p1 -> V_2gep1", "V_1g0p2 -> V_2gep2"]

---- test_fixture_f1_structure_and_cleanup stdout ----
thread 'test_fixture_f1_structure_and_cleanup' (783186) panicked at crates/engine-core/tests/pda_cfg.rs:315:5:
assertion `left == right` failed
  left: "S -> V_0g2p0"
 right: "S -> V_0g2p3"

---- test_ac2_f1_language_equivalence stdout ----
thread 'test_ac2_f1_language_equivalence' (783183) panicked at crates/engine-core/tests/pda_cfg.rs:972:9:
assertion `left == right` failed: F1 language mismatch on string "c": expected true, got false
  left: false
 right: true

test result: FAILED. 4 passed; 5 failed; 0 ignored; 0 measured; 4 filtered out; finished in 0.13s
```

#### Break 5: In Case A write `<r, γ, w>` instead of `<r, ε, w>`

- **Failed tests:** `test_fixture_f1_structure_and_cleanup`, `test_fixture_f3_structure`, `test_ac2_f1_language_equivalence`, `test_ac2_f2_language_equivalence`, `test_ac2_f3_language_equivalence`
- **Actual output:**

```text
---- test_fixture_f1_structure_and_cleanup stdout ----
thread 'test_fixture_f1_structure_and_cleanup' (783635) panicked at crates/engine-core/tests/pda_cfg.rs:386:5:
assertion `left == right` failed
  left: ["V_1g2p0 -> V_3g2p0", "V_1g2p1 -> V_3g2p1", "V_1g2p3 -> V_3g2p3"]
 right: ["V_1g2p0 -> V_3gep0", "V_1g2p1 -> V_3gep1", "V_1g2p3 -> V_3gep3"]

---- test_ac2_f1_language_equivalence stdout ----
thread 'test_ac2_f1_language_equivalence' (783632) panicked at crates/engine-core/tests/pda_cfg.rs:972:9:
assertion `left == right` failed: F1 language mismatch on string "c": expected true, got false
  left: false
 right: true

test result: FAILED. 4 passed; 5 failed; 0 ignored; 0 measured; 4 filtered out; finished in 0.12s
```

#### Break 6: Let `w` and the `v` tuples range over all states including `s'`

- **Failed tests:** `test_fixture_f1_structure_and_cleanup`, `test_fixture_f2_structure`, `test_fixture_f3_structure`, `test_fixture_f5_limits_and_high_state_ids`
- **Do the language tests fail?** **No** (`test_ac2_f1_language_equivalence`, `test_ac2_f2_language_equivalence`, and `test_ac2_f3_language_equivalence` all pass!).
- **What this shows:** In RNF, `s'` has no incoming transitions and its single outgoing transition (`s' -> s` pushing `#`) is handled solely by Step 1 (`S -> <s, #, a>`) and produces no step-S4 rules. Therefore, when `s'` is included in `K`, the extra rules involving `s'` (increasing F1 from 76 rules to $1 + 4 + 6 \times 16 + 3 \times 4 + 3 \times 4 = 125$ rules, or 108 rules from the 6 double pushes and 6 single/empty transitions) are all either unreachable from `S` or unproductive (no rule has head `<s', γ, p>` for any stack symbol $\gamma \in \Gamma$), so they cannot participate in any terminal derivation from `S`. Only the structural rule-count and trace assertions catch this bug.
- **Actual output:**

```text
running 9 tests
test test_fixture_f3_structure ... FAILED
test test_fixture_f1_structure_and_cleanup ... FAILED
test test_ac2_f3_language_equivalence ... ok
test test_fixture_f5_limits_and_high_state_ids ... FAILED
test test_fixture_f4_input_errors ... ok
test test_pin_empty_language_cnf_and_cyk ... ok
test test_fixture_f2_structure ... FAILED
test test_ac2_f2_language_equivalence ... ok
test test_ac2_f1_language_equivalence ... ok

failures:

---- test_fixture_f3_structure stdout ----
thread 'test_fixture_f3_structure' (784086) panicked at crates/engine-core/tests/pda_cfg.rs:524:5:
assertion `left == right` failed
  left: 7
 right: 5

---- test_fixture_f1_structure_and_cleanup stdout ----
thread 'test_fixture_f1_structure_and_cleanup' (784084) panicked at crates/engine-core/tests/pda_cfg.rs:305:5:
assertion `left == right` failed
  left: 125
 right: 76

test result: FAILED. 5 passed; 4 failed; 0 ignored; 0 measured; 4 filtered out; finished in 0.20s
```

#### Break 7: Enumerate the tuples with `v1` as the fastest index

- **Failed test:** `test_fixture_f1_structure_and_cleanup`
- **Actual output:**

```text
---- test_fixture_f1_structure_and_cleanup stdout ----
thread 'test_fixture_f1_structure_and_cleanup' (784544) panicked at crates/engine-core/tests/pda_cfg.rs:345:5:
assertion `left == right` failed
  left: "V_0g0p0 -> a V_0g0p1 V_1g0p0"
 right: "V_0g0p1 -> a V_0g0p0 V_0g0p1"

test result: FAILED. 8 passed; 1 failed; 0 ignored; 0 measured; 4 filtered out; finished in 0.21s
```

#### Break 8: Remove the size check (`MAX_PDA_CFG_RULES`)

- **Failed test:** `test_fixture_f5_limits_and_high_state_ids`
- **Actual output:**

```text
---- test_fixture_f5_limits_and_high_state_ids stdout ----
thread 'test_fixture_f5_limits_and_high_state_ids' (785445) panicked at crates/engine-core/tests/pda_cfg.rs:866:5:
Expected limit check to finish in < 50 ms, took 3.010892943s

test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 12 filtered out; finished in 3.39s
```

#### Break 9: Remove the check of Decision 1 (b) (`pda_cfg.bad_start`)

- **Failed test:** `test_fixture_f4_input_errors`
- **Actual output:**

```text
---- test_fixture_f4_input_errors stdout ----
thread 'test_fixture_f4_input_errors' (785891) panicked at crates/engine-core/tests/pda_cfg.rs:583:5:
assertion `left == right` failed
  left: Message { key: "pda_cfg.bad_accept", params: {"from": Int(0)} }
 right: Message { key: "pda_cfg.bad_start", params: {"state": Int(0)} }

test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 12 filtered out; finished in 0.00s
```

#### Break 10: Name a variable without the `V_` prefix (`V0g2p3`)

- **Failed test:** `test_grammar_text_roundtrip_f1_f2_f3` (because `GrammarParser` parses `V0g2p3` in the RHS as `NonTerminal("V0")` followed by terminals `'g'`, `'2'`, `'p'`, `'3'`)
- **Actual output:**

```text
---- test_grammar_text_roundtrip_f1_f2_f3 stdout ----
thread 'test_grammar_text_roundtrip_f1_f2_f3' (786366) panicked at crates/engine-core/tests/pda_cfg.rs:166:5:
assertion `left == right` failed
  left: ["S -> V0 g 2 p 3", "V0g0p0 -> a V0 g 0 p 0 V0 g 0 p 0", ...]
 right: ["S -> V0g2p3", "V0g0p0 -> a V0g0p0 V0g0p0", ...]

test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 13 filtered out; finished in 0.00s
```

---

## 3. AC3 Property Tests: Three Consecutive 1000-Case Runs

Command: `PROPTEST_CASES=1000 cargo test -p engine-core --test pda_cfg test_ac3`

*(Note on AC3(b) timing: `test_ac3b_chain_cfg_pda_rnf_cfg` with bodies of 0..=3 symbols completed 1000 cases in ~2.4s in debug mode, well under the 1-minute threshold, so the grammar generator did not need to be shrunk.)*

### Run 1

```text
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.39s
     Running tests/pda_cfg.rs (target/debug/deps/pda_cfg-eb0def828ef96cfd)

running 2 tests
test test_ac3b_chain_cfg_pda_rnf_cfg ... ok
test test_ac3a_random_pdas_through_rnf ... ok

test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 12 filtered out; finished in 38.69s
```

### Run 2

```text
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.05s
     Running tests/pda_cfg.rs (target/debug/deps/pda_cfg-eb0def828ef96cfd)

running 2 tests
test test_ac3b_chain_cfg_pda_rnf_cfg ... ok
test test_ac3a_random_pdas_through_rnf ... ok

test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 12 filtered out; finished in 34.97s
```

### Run 3

```text
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.06s
     Running tests/pda_cfg.rs (target/debug/deps/pda_cfg-eb0def828ef96cfd)

running 2 tests
test test_ac3b_chain_cfg_pda_rnf_cfg ... ok
test test_ac3a_random_pdas_through_rnf ... ok

test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 12 filtered out; finished in 46.98s
```

---

## 4. Verification Outputs & Bundle Budgets

### 4.1 Rust Format, Clippy, and Tests

Command: `cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test`

```text
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.14s
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.15s
     Running unittests src/lib.rs (target/debug/deps/engine_core-125a34e957707825)

running 8 tests
test grammar::parser::tests::test_parse_error_empty ... ok
test grammar::parser::tests::test_parse_error_no_arrow ... ok
test grammar::parser::tests::test_parse_multi_char_non_terminal ... ok
test grammar::parser::tests::test_parse_simple_grammar ... ok
test pda::tests::empty_string_is_rejected ... ok
test pda::tests::over_budget_is_inconclusive ... ok
test pda::tests::wwr_accepts_palindromes ... ok
test ts::export_bindings_is_up_to_date ... ok

test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s

     Running tests/api_test.rs (target/debug/deps/api_test-bc83d6a22f3c42a3)

running 17 tests
test api_check_equivalence_and_minimize_round_trip ... ok
test api_Clean_And_Cnf_And_Cyk ... ok
test api_derive_and_parse_tree ... ok
test api_first_follow_and_ll1 ... ok
test api_fsm_to_regex_and_regex_to_fsm ... ok
test api_invalid_json_returns_bad_input ... ok
test api_parse_grammar_and_validate_rigorous ... ok
test api_pda_accepts_and_traces ... ok
test api_regex_parse_and_accepts ... ok
test api_run_automaton_and_trace ... ok
test api_subset_construction ... ok
test api_tm_run_and_trace ... ok
test api_unknown_action_returns_error ... ok
test test_api_check_equivalence_witness ... ok
test test_api_fsm_minimize ... ok
test test_api_parse_grammar ... ok
test test_api_subset_construction ... ok

test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s

     Running tests/cfg_pda.rs (target/debug/deps/cfg_pda-e808a90264ae370c)

running 19 tests
test ac1_f1_top_down_anbn ... ok
test ac1_f2_bottom_up_anbn ... ok
test ac1_f3_top_down_epsilon_and_unit ... ok
test ac1_f4_bottom_up_two_char_terminal ... ok
test ac1_f5_empty_rules_rejected ... ok
test ac1_f6_rule_limit_exceeded ... ok
test ac1_f7_symbol_with_arrow_rejected ... ok
test ac2_f1_top_down_language_equivalence ... ok
test ac2_f2_bottom_up_language_equivalence ... ok
test ac2_f3_top_down_language_equivalence ... ok
test ac2_f4_bottom_up_language_equivalence ... ok
test ac2_palindromes_top_down_and_bottom_up ... ok
test ac4_api_invalid_json_returns_bad_input ... ok
test ac4_bottom_up_reduce_order_matches_rules ... ok
test ac4_top_down_expand_order_matches_rules ... ok
test ac4_top_down_long_rhs_chains_states_in_reverse ... ok
test ac3_proptest_bottom_up_matches_cnf_cyk ... ok
test ac3_proptest_top_down_matches_cnf_cyk ... ok
test ac4_proptest_api_never_panics_on_arbitrary_strings ... ok

test result: ok. 19 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.65s

     Running tests/cnf_cyk_test.rs (target/debug/deps/cnf_cyk_test-4de5228a2e1a1aa0)

running 7 tests
test test_clean_grammar ... ok
test test_cnf_and_cyk_accepts_and_rejects ... ok
test test_cnf_preserves_epsilon_in_start ... ok
test test_cnf_step_descriptions ... ok
test test_cyk_empty_string ... ok
test test_cyk_parse_tree ... ok
test test_cyk_table_dimensions ... ok

test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/conformance.rs (target/debug/deps/conformance-b9b99878e97eb66a)

running 14 tests
test conformance_anbn_cfg_and_pda_agree ... ok
test conformance_dfsm_minimization_preserves_language ... ok
test conformance_fsm_complement_inverts_language ... ok
test conformance_fsm_intersection_matches_both ... ok
test conformance_fsm_kleene_star ... ok
test conformance_fsm_product_union_matches_either ... ok
test conformance_fsm_reversal_reverses_language ... ok
test conformance_fsm_to_regex_roundtrip ... ok
test conformance_ll1_and_cyk_agree_on_simple_expr ... ok
test conformance_ndfsm_to_dfsm_preserves_language ... ok
test conformance_pda_anbn ... ok
test conformance_regex_thompson_glushkov_equivalent ... ok
test conformance_tm_anbncn ... ok
test conformance_tm_binary_increment ... ok

test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.04s

     Running tests/fsm_test.rs (target/debug/deps/fsm_test-045fc847f699ef1d)

running 25 tests
test test_accepts_basic_dfsm ... ok
test test_accepts_epsilon_closure ... ok
test test_complement ... ok
test test_concatenation ... ok
test test_determine_type_dfsm ... ok
test test_determine_type_eps_ndfsm ... ok
test test_determine_type_ndfsm ... ok
test test_Difference ... ok
test test_equivalence_identical ... ok
test test_equivalence_minimal_vs_unminimized ... ok
test test_equivalence_witness ... ok
test test_fsm_to_regex ... ok
test test_intersection ... ok
test test_kleene_star ... ok
test test_minimize_already_minimal ... ok
test test_minimize_dfsm ... ok
test test_minimize_unreachable_states ... ok
test test_missing_start_state_error ... ok
test test_ndfsm_to_dfsm ... ok
test test_product_construction_steps ... ok
test test_reversal ... ok
test test_run_automaton_trace ... ok
test test_state_limit_exceeded ... ok
test test_total_dfsm_adds_dead_state ... ok
test test_union ... ok

test result: ok. 25 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s

     Running tests/grammar_rigorous_test.rs (target/debug/deps/grammar_rigorous_test-393c28321b40ff7e)

running 12 tests
test test_chomsky_classification_cfg ... ok
test test_chomsky_classification_csg ... ok
test test_chomsky_classification_regular ... ok
test test_chomsky_classification_unrestricted ... ok
test test_derivation_steps ... ok
test test_first_and_follow_sets ... ok
test test_left_factoring ... ok
test test_left_recursion_elimination ... ok
test test_ll1_conflict_detection ... ok
test test_ll1_parse_success ... ok
test test_ll1_table_construction ... ok
test test_parse_tree_generation ... ok

test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/Json_Schema.rs (target/debug/deps/Json_Schema-5572c693ec0ca325)

running 3 tests
test fsm_roundtrip_json ... ok
test grammar_roundtrip_json ... ok
test tm_roundtrip_json ... ok

test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/pda_cfg.rs (target/debug/deps/pda_cfg-eb0def828ef96cfd)

running 14 tests
test test_ac2_f3_language_equivalence ... ok
test test_fixture_f1_structure_and_cleanup ... ok
test test_fixture_f2_structure ... ok
test test_fixture_f3_structure ... ok
test test_fixture_f4_input_errors ... ok
test test_fixture_f5_limits_and_high_state_ids ... ok
test test_grammar_text_roundtrip_f1_f2_f3 ... ok
test test_pin_empty_language_cnf_and_cyk ... ok
test test_ac2_f2_language_equivalence ... ok
test test_ac4_api_never_panics_on_arbitrary_text ... ok
test test_ac2_f1_language_equivalence ... ok
test test_ac4_non_rnf_pdas_and_high_state_ids ... ok
test test_ac3b_chain_cfg_pda_rnf_cfg ... ok
test test_ac3a_random_pdas_through_rnf ... ok

test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 8.69s

     Running tests/pda_rnf.rs (target/debug/deps/pda_rnf-3fb228ae41df2d3e)

running 16 tests
test ac1_f1_already_rnf_except_accepting ... ok
test ac1_f2_pop_two_and_push_three ... ok
test ac1_f3_pop_zero_and_epsilon_accept ... ok
test ac1_f4_empty_stack_alphabet_gives_bottom ... ok
test ac1_f5_no_start_state_is_rejected ... ok
test ac1_f6_state_limit_exceeded ... ok
test ac1_f7_transition_limit_exceeded ... ok
test ac2_f1_language_equivalence ... ok
test ac2_f2_language_equivalence ... ok
test ac2_f3_language_equivalence ... ok
test ac2_f4_language_equivalence ... ok
test ac4_api_invalid_json_returns_bad_input ... ok
test ac4_collision_free_fresh_symbols_and_high_state_ids ... ok
test ac3_proptest_cfg_top_down_then_rnf ... ok
test ac4_proptest_api_never_panics_on_arbitrary_strings ... ok
test ac3_proptest_random_pda_rnf_equivalence ... ok

test result: ok. 16 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.18s

     Running tests/properties.rs (target/debug/deps/properties-55bc63cc1fc79263)

running 9 tests
test prop_cnf_preserves_membership_on_small_strings ... ok
test prop_dfsm_complement_inverts_acceptance ... ok
test prop_dfsm_minimization_idempotent ... ok
test prop_dfsm_minimization_preserves_acceptance ... ok
test prop_fsm_reversal_reverses_strings ... ok
test prop_glushkov_has_no_epsilon_transitions ... ok
test prop_ndfsm_to_dfsm_preserves_acceptance ... ok
test prop_regex_thompson_and_glushkov_agree ... ok
test prop_union_accepts_iff_either_accepts ... ok

test result: ok. 9 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.65s

     Running tests/regex_test.rs (target/debug/deps/regex_test-cfcf1597cd56d22f)

running 14 tests
test test_ast_to_string_roundtrip ... ok
test test_ Derivative ... ok
test test_empty_and_epsilon ... ok
test test_glushkov_construction ... ok
test test_invalid_regex_errors ... ok
test test_kleene_plus_and_optional ... ok
test test_operator_precedence ... ok
test test_regex_accepts ... ok
test test_regex_equivalence ... ok
test test_regex_simplify ... ok
test test_regex_to_dfa_direct ... ok
test test_thompson_construction ... ok
test test_unicode_and_escaped_chars ... ok
test test_unmatched_parens ... ok

test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s

     Running unittests src/lib.rs (target/debug/deps/engine_wasm-e1f48cb3b5efdd96)

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

   Doc-tests engine_core

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

   Doc-tests engine_wasm

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

### 4.2 WASM Build & WASM Tests

Command: `pnpm build:wasm && pnpm test:wasm`

```text
> webtomata@0.0.1 build:wasm /home/Aldebaran64/webtomata
> wasm-pack build crates/engine-wasm --target web --out-dir ../../web/src/lib/engine/pkg && rm -f web/src/lib/engine/pkg/.gitignore web/src/lib/engine/pkg/package.json && cargo test -p engine-core --lib ts::export_bindings_is_up_to_date

[INFO]: 🎯  Checking for the Wasm target...
[INFO]: 🌀  Compiling to Wasm...
    Finished `release` profile [optimized] target(s) in 0.25s
[INFO]: ⬇️  Installing wasm-bindgen...
[INFO]: Optimizing wasm binaries with `wasm-opt`...
[INFO]: ✨   Done in 1.94s
[INFO]: 📦   Your wasm pkg is ready to publish at /home/Aldebaran64/webtomata/crates/engine-wasm/../../web/src/lib/engine/pkg.
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.05s
     Running unittests src/lib.rs (target/debug/deps/engine_core-125a34e957707825)

running 1 test
test ts::export_bindings_is_up_to_date ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 7 filtered out; finished in 0.01s

> webtomata@0.0.1 test:wasm /home/Aldebaran64/webtomata
> wasm-pack test --node crates/engine-wasm

[INFO]: 🎯  Checking for the Wasm target...
[INFO]: 🌀  Compiling to Wasm...
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.08s
[INFO]: ⬇️  Installing wasm-bindgen...
[INFO]: Running Wasm tests with Node.js...
     Running unittests src/lib.rs (target/wasm32-unknown-unknown/debug/deps/engine_wasm-05fa5c90858a5f64.wasm)

running 13 tests
test tests::pda_to_cfg_answers_in_envelope ... ok
test tests::pda_to_rnf_answers_in_envelope ... ok
test tests::cfg_to_pda_bottom_up_answers_in_envelope ... ok
test tests::cfg_to_pda_top_down_answers_in_envelope ... ok
test tests::pda_accepts_answers_in_envelope ... ok
test tests::tm_run_answers_in_envelope ... ok
test tests::cyk_parse_answers_in_envelope ... ok
test tests::to_cnf_answers_in_envelope ... ok
test tests::clean_grammar_answers_in_envelope ... ok
test tests::parse_grammar_answers_in_envelope ... ok
test tests::regex_to_fsm_answers_in_envelope ... ok
test tests::fsm_minimize_answers_in_envelope ... ok
test tests::run_automaton_answers_in_envelope ... ok

test result: ok. 13 passed; 0 failed; 0 ignored
```

### 4.3 Type Check, Lint, Format Check, Strings, and Tokens

Command: `pnpm check && pnpm lint && pnpm format:check && pnpm check:strings && pnpm check:tokens`

```text
> webtomata@0.0.1 check /home/Aldebaran64/webtomata
> pnpm --filter web check

> web@0.0.1 check /home/Aldebaran64/webtomata/web
> svelte-kit sync && svelte-check --tsconfig ./tsconfig.json

Loading svelte-check in workspace: /home/Aldebaran64/webtomata/web
Getting Svelte diagnostics...

svelte-check found 0 errors and 0 warnings

> webtomata@0.0.1 lint /home/Aldebaran64/webtomata
> pnpm --filter web lint

> web@0.0.1 lint /home/Aldebaran64/webtomata/web
> eslint .

> webtomata@0.0.1 format:check /home/Aldebaran64/webtomata
> prettier --check . && cargo fmt --check

Checking formatting...
All matched files use Prettier code style!

> webtomata@0.0.1 check:strings /home/Aldebaran64/webtomata
> node tools/check-strings.mjs

ok 63 components have no hard-coded text

> webtomata@0.0.1 check:tokens /home/Aldebaran64/webtomata
> node tools/check-tokens.mjs

ok 65 files use no raw colors
```

### 4.4 Web Unit Tests (Vitest)

Command: `pnpm --filter web exec vitest run`

```text
 RUN  v3.2.4 /home/Aldebaran64/webtomata/web

 ✓ src/lib/engine/handlers.test.ts (19 tests) 38ms
 ...
 Test Files  92 passed (92)
      Tests  1184 passed | 2 skipped (1186)
   Start at  10:04:12
   Duration  14.21s
```

### 4.5 Build & Bundle Size Budgets (AC6)

Command: `pnpm build && pnpm size`

- **WASM size before (T-036):** `231.1 KB gzip`
- **WASM size after (T-037):** `237.0 KB gzip` (limit `250 KB gzip`)
- **Initial JS max:** `119.4 KB gzip` on `sandbox.html` (limit `170 KB gzip`)

```text
> webtomata@0.0.1 size /home/Aldebaran64/webtomata
> node tools/check-size.mjs

wasm _app/immutable/workers/assets/engine_wasm_bg-CADCtJF9.wasm: 237.0 KB gzip (limit 250 KB)
page 404.html: 79.5 KB gzip (limit 170 KB)
page about.html: 84.5 KB gzip (limit 170 KB)
page guide.html: 91.5 KB gzip (limit 170 KB)
page index.html: 118.4 KB gzip (limit 170 KB)
page questions.html: 98.4 KB gzip (limit 170 KB)
page sandbox.html: 119.4 KB gzip (limit 170 KB)
ok all bundle budgets met
```

### 4.6 Glossary Additions (`docs/glossary.md`)

Added the following four Indonesian terms with `TODO(review)` in `docs/glossary.md`:
- `aturan awal` — start rule (`S -> V_{s, bottom, a}`) (`TODO(review)`)
- `aturan ε` — ε-rules (`V_{q, ε, q} -> ε`) (`TODO(review)`)
- `tupel state perantara` — intermediate state tuples (`(q_1, ..., q_{n-1}) in K^{n-1}`) (`TODO(review)`)
- `tanpa push` — pop-only transition that pushes nothing (`push = ε`) (`TODO(review)`)

### 4.7 What Was Not Run

- **Playwright E2E tests / phone / live site:** Not run because T-037 is an engine, worker-protocol, i18n, and documentation task with no UI changes (per `AGENTS.md` §8 and `PLAN.md` T-037 Verification).

