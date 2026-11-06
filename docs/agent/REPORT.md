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

#### Break 8a: Change `>` to `>=` in the in-loop size check (`total_rules >= MAX_PDA_CFG_RULES as u64`)

- **Failed test:** `test_fixture_f5_limits_and_high_state_ids` (the exact 20,000-rule boundary machine fails with `machine.limit_exceeded` instead of returning `Ok(20000)`)
- **Actual output:**

```text
   Compiling engine-core v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-core)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 1.59s
     Running tests/pda_cfg.rs (target/debug/deps/pda_cfg-eb0def828ef96cfd)

running 1 test
test test_fixture_f5_limits_and_high_state_ids ... FAILED

failures:

---- test_fixture_f5_limits_and_high_state_ids stdout ----

thread 'test_fixture_f5_limits_and_high_state_ids' (2447) panicked at crates/engine-core/tests/pda_cfg.rs:930:5:
assertion `left == right` failed
  left: Err(Message { key: "machine.limit_exceeded", params: {"limit": Int(20000), "what": Text("rules")} })
 right: Ok(20000)
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace


failures:
    test_fixture_f5_limits_and_high_state_ids

test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 13 filtered out; finished in 0.12s
```

#### Break 8b: Remove the in-loop size check (`if total_rules > MAX_PDA_CFG_RULES as u64`)

- **Failed test:** `test_fixture_f5_limits_and_high_state_ids` (the `29^4 = 707,281` timing test fails the `< 50 ms` check because it builds all 707,288 rules in ~3.19s)
- **Actual output:**

```text
   Compiling engine-core v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-core)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 1.61s
     Running tests/pda_cfg.rs (target/debug/deps/pda_cfg-eb0def828ef96cfd)

running 1 test
test test_fixture_f5_limits_and_high_state_ids ... FAILED

failures:

---- test_fixture_f5_limits_and_high_state_ids stdout ----

thread 'test_fixture_f5_limits_and_high_state_ids' (2886) panicked at crates/engine-core/tests/pda_cfg.rs:853:5:
Expected limit check to finish in < 50 ms, took 3.19028733s
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace


failures:
    test_fixture_f5_limits_and_high_state_ids

test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 13 filtered out; finished in 3.57s
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
   Compiling engine-core v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-core)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 1.46s
     Running tests/pda_cfg.rs (target/debug/deps/pda_cfg-eb0def828ef96cfd)

running 2 tests
test test_ac3b_chain_cfg_pda_rnf_cfg ... ok
test test_ac3a_random_pdas_through_rnf ... ok

test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 12 filtered out; finished in 41.98s
```

### Run 2

```text
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.05s
     Running tests/pda_cfg.rs (target/debug/deps/pda_cfg-eb0def828ef96cfd)

running 2 tests
test test_ac3b_chain_cfg_pda_rnf_cfg ... ok
test test_ac3a_random_pdas_through_rnf ... ok

test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 12 filtered out; finished in 41.39s
```

### Run 3

```text
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.05s
     Running tests/pda_cfg.rs (target/debug/deps/pda_cfg-eb0def828ef96cfd)

running 2 tests
test test_ac3b_chain_cfg_pda_rnf_cfg ... ok
test test_ac3a_random_pdas_through_rnf ... ok

test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 12 filtered out; finished in 38.58s
```

---

## 4. Verification Outputs & Bundle Budgets

### 4.1 Rust Format, Clippy, and Tests

Command: `cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test`

```text
    Checking engine-core v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-core)
    Checking engine-wasm v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-wasm)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 2.06s
   Compiling engine-core v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-core)
   Compiling engine-wasm v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-wasm)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 8.12s
     Running unittests src/lib.rs (target/debug/deps/engine_core-670a3d94c89462ba)

running 1 test
test tests::version_is_not_empty ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/api.rs (target/debug/deps/api-b80225d7cef47478)

running 29 tests
test cyk_parse_limit_c_101_lambda_chars_reports_cyk_input_too_long ... ok
test cyk_parse_limit_b_101_chars_reports_cyk_input_too_long ... ok
test cyk_parse_limit_e_300_and_5000_chars ... ok
test add_trap_state_completes_the_machine ... ok
test a_bad_budget_is_an_error_and_not_ignored ... ok
test a_budget_is_optional_and_partial ... ok
test nondeterministic_states_lists_the_states ... ok
test regex_errors_carry_a_position ... ok
test load_machine_gives_the_canonical_machine ... ok
test jff_import_and_export ... ok
test determinize_and_minimize ... ok
test simplify_gives_text_and_a_trace ... ok
test regex_to_fsm_builds_a_machine ... ok
test simulate_checks_its_inputs ... ok
test cyk_parse_limit_d_60_lambda_chars_no_limit_message ... ok
test simulate_returns_the_input_as_symbol_names ... ok
test the_alphabet_is_checked ... ok
test simulate_reads_symbols_with_several_characters ... ok
test fsm_to_regex_gives_text_that_means_the_same ... ok
test validate_lists_the_issues ... ok
test closure_operations ... ok
test load_machine_reports_problems_as_messages ... ok
test equivalent_names_the_symbols_of_the_witness ... ok
test xor_through_the_api ... ok
test the_witness_is_right_even_if_the_alphabets_are_in_another_order ... ok
test cyk_parse_limit_a_100_chars_accepted_or_rejected_without_limit_error ... ok
test the_same_input_gives_the_same_text ... ok
test simplify_via_machine_gives_text_and_a_trace ... ok
test no_text_makes_a_function_panic ... ok

test result: ok. 29 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.19s

     Running tests/boundaries.rs (target/debug/deps/boundaries-86334ddba1c3c79e)

running 20 tests
test an_alphabet_with_no_symbol_is_empty ... ok
test a_star_and_a_plus_are_written_after_their_operand_and_bind_tighter_than_the_rest ... ok
test a_place_that_is_not_a_number_is_replaced_by_the_grid_and_the_name_is_kept ... ok
test a_label_of_parallel_transitions_of_exactly_the_biggest_size_is_allowed ... ok
test a_new_start_and_a_new_accepting_state_are_added_only_when_they_are_needed ... ok
test a_tab_or_a_new_line_in_a_name_is_written_as_a_space ... ok
test a_label_of_exactly_the_biggest_size_is_allowed ... ok
test states_without_a_place_are_put_on_a_grid_of_six_in_a_row ... ok
test a_symbol_that_is_not_in_the_alphabet_is_found_inside_every_kind_of_part ... ok
test the_list_of_wrong_strings_stops_when_the_visits_are_used_up ... ok
test the_budget_of_checks_counts_each_check ... ok
test a_machine_with_more_problems_than_the_limit_gets_the_limit_and_one_marker ... ok
test the_states_of_a_long_label_are_on_the_line_between_its_ends ... ok
test the_witness_of_a_split_names_the_first_symbol_on_which_the_two_groups_differ ... ok
test the_machine_route_gives_way_when_the_dfsm_does_not_fit_though_the_nfa_does ... ok
test the_message_of_a_star_that_swallows_another_names_the_one_that_is_kept ... ok
test a_machine_file_of_exactly_the_biggest_size_is_read_and_one_byte_more_is_not ... ok
test a_jff_file_of_exactly_the_biggest_size_is_read_and_one_byte_more_is_not ... ok
test a_label_of_several_characters_adds_states_up_to_the_limit_and_not_past_it ... ok
test the_budget_of_states_is_capped_in_every_operation_that_determinizes ... ok

test result: ok. 20 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.13s

     Running tests/cfg_pda.rs (target/debug/deps/cfg_pda-b35047c6841be213)

running 15 tests
test test_fixture_f5_duplicate_rules_merged ... ok
test test_fixture_f2_details ... ok
test test_fixture_f5_symbol_clash ... ok
test test_fixture_f1_details ... ok
test test_fixture_f5_limit_exceeded_65_symbols ... ok
test test_fixture_f3_details ... ok
test test_fixture_f4_left_recursion ... ok
test test_fixture_f5_multi_character_variable_and_jff ... ok
test test_has_left_recursion_nullable_aware ... ok
test proptest_ac4_arbitrary_string_never_panics ... ok
test test_pda_equivalence_f2_all_511_strings ... ok
test test_pda_equivalence_f1_all_511_strings ... ok
test test_pda_equivalence_f3_all_511_strings ... ok
test test_oracles_agree_on_all_511_strings ... ok
test proptest_ac3_small_grammars ... ok

test result: ok. 15 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 4.15s

     Running tests/cfg_pda_bottomup.rs (target/debug/deps/cfg_pda_bottomup-49439e331ad1ce86)

running 15 tests
test test_fixture_f1_details ... ok
test test_fixture_f2_details ... ok
test test_fixture_f4_limit_exceeded_65_symbols ... ok
test test_fixture_f4_duplicate_rules_merged ... ok
test test_fixture_f3_details ... ok
test test_fixture_f4_error_precedence_clash_over_body_length ... ok
test test_fixture_f4_symbol_clash ... ok
test test_fixture_f4_multi_character_variable_and_jff ... ok
test proptest_ac4_arbitrary_string_never_panics ... ok
test test_oracles_agree_on_all_511_strings ... ok
test test_three_oracle_equivalence_f1_all_511_strings ... ok
test test_fixture_f5_epsilon_rules_and_budget ... ok
test proptest_ac3_small_grammars_no_epsilon ... ok
test test_three_oracle_equivalence_f3_all_511_strings ... ok
test proptest_ac3_small_grammars_with_epsilon ... ok

test result: ok. 15 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 8.20s

     Running tests/determinize.rs (target/debug/deps/determinize-b9746edb6b0d6811)

running 11 tests
test a_machine_without_a_start_state_cannot_be_converted ... ok
test messages_carry_keys_and_parameters ... ok
test too_many_states_stops_with_the_trace_so_far ... ok
test a_dfsm_with_a_missing_transition_becomes_complete ... ok
test too_many_steps_stops_with_the_trace_so_far ... ok
test epsilon_closure_and_the_dead_state ... ok
test ends_in_10_gives_three_subsets ... ok
test an_exponential_machine_stops_at_the_state_limit ... ok
test the_dfsm_accepts_exactly_what_the_original_accepts ... ok
test small_budgets_never_panic_and_are_respected ... ok
test the_result_is_a_valid_complete_dfsm_and_the_trace_matches_it ... ok

test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.14s

     Running tests/differential.rs (target/debug/deps/differential-859c5c32261d2a58)

running 12 tests
test machines_with_one_symbol_or_none_work_in_every_operation ... ok
test minimize_matches_automata_lib ... ok
test determinize_matches_automata_lib ... ok
test the_acceptor_written_here_agrees_with_simulate_and_with_the_package ... ok
test xor_matches_automata_lib ... ok
test complement_matches_automata_lib_and_every_word ... ok
test equivalence_matches_automata_lib ... ok
test the_corner_machines_give_the_right_language_in_every_operation ... ok
test union_matches_automata_lib_and_every_word ... ok
test intersection_matches_automata_lib_and_every_word ... ok
test xor_matches_every_word ... ok
test regex_to_fsm_matches_automata_lib_the_matcher_and_every_word ... ok

test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 6.95s

     Running tests/equivalence.rs (target/debug/deps/equivalence-bb6d90569fd57614)

running 16 tests
test a_star_against_a_star_b_star_has_the_witness_b ... ok
test complete_lists_when_the_limits_are_large_enough ... ok
test both_machines_need_a_start_state ... ok
test an_ndfsm_equals_its_determinization ... ok
test machines_for_the_same_language_are_equivalent ... ok
test even_against_odd_has_the_empty_string_as_witness ... ok
test the_alphabets_must_have_the_same_symbols ... ok
test the_witness_is_the_first_of_the_shortest_strings ... ok
test the_visit_budget_cuts_the_lists_but_not_the_witness ... ok
test a_machine_equals_itself_its_determinization_and_its_minimization ... ok
test small_budgets_never_panic ... ok
test too_many_pairs_stops_the_search ... ok
test every_reported_string_really_tells_the_machines_apart ... ok
test complete_lists_match_brute_force ... ok
test nothing_shorter_than_the_witness_tells_the_machines_apart ... ok
test swapping_the_machines_swaps_the_direction ... ok

test result: ok. 16 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 4.01s

     Running tests/fsm_json.rs (target/debug/deps/fsm_json-a1f035e974a7ff8e)

running 20 tests
test deeply_nested_input_is_rejected_not_crashed ... ok
test dfsm_round_trips_to_identical_json ... ok
test duplicate_symbol_is_rejected ... ok
test duplicate_states_are_rejected ... ok
test invalid_but_expressible_machines_still_load ... ok
test invalid_symbols_are_rejected ... ok
test multi_character_symbols_are_interned ... ok
test machine_without_start_state_is_representable ... ok
test ndfsm_epsilon_transition_uses_null ... ok
test not_json_is_json_invalid_with_position ... ok
test output_is_sorted_whatever_the_input_order ... ok
test symbol_length_limit_is_32_characters ... ok
test references_to_missing_states_and_symbols_are_rejected ... ok
test input_over_one_mebibyte_is_rejected_before_parsing ... ok
test unsupported_schema_versions_report_the_version ... ok
test wrong_shape_is_invalid_structure ... ok
test too_many_states_symbols_and_transitions_are_rejected ... ok
test arbitrary_text_never_panics ... ok
test mutated_valid_json_never_panics ... ok
test random_machines_round_trip ... ok

test result: ok. 20 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.08s

     Running tests/fsm_regex.rs (target/debug/deps/fsm_regex-66d70b6b9fd6038a)

running 16 tests
test a_label_that_grows_too_big_stops_the_run ... ok
test no_accepting_state_gives_the_empty_set ... ok
test even_length_gives_the_expression_of_rich_example_6_3 ... ok
test one_state_without_transitions_gives_epsilon ... ok
test one_state_with_a_loop_gives_a_star ... ok
test rich_example_6_7_removes_states_3_2_1 ... ok
test a_machine_without_a_start_state_cannot_be_converted ... ok
test too_many_label_updates_stop_the_run ... ok
test too_many_steps_stops_with_the_trace_so_far ... ok
test epsilon_transitions_are_labels_too ... ok
test unreachable_states_are_removed_first ... ok
test the_result_for_example_6_7_equals_the_expression_in_the_slides ... ok
test regex_to_ndfsm_to_regex_keeps_the_language ... ok
test small_budgets_never_panic_and_are_respected ... ok
test the_result_is_simplified_and_states_are_removed_highest_first ... ok
test a_random_machine_and_its_expression_accept_the_same_strings ... ok

test result: ok. 16 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.40s

     Running tests/grammar.rs (target/debug/deps/grammar-53ed0d438fef75e6)

running 30 tests
test test_cnf_phase3_start_symbol_collision_with_existing_s0 ... ok
test test_cnf_variable_deduplication_step6 ... ok
test test_cnf_variable_fresh_when_t_p1_already_exists ... ok
test test_cyk_empty_string ... ok
test test_cyk_parser_on_cnf ... ok
test test_full_pipeline_cfg_to_cnf_to_cyk ... ok
test test_hand_derivation_no_epsilon_start_on_rhs ... ok
test test_cnf_slide_example_eliminating_long_rhs ... ok
test test_cnf_transformation_trace_6_phases ... ok
test test_cnf_cfg_paren_helper_names_readable ... ok
test test_cnf_presets_alphanumeric_helpers_unchanged ... ok
test test_hand_derivation_t010_flow_grammar ... ok
test test_hand_derivation_unreachable_after_phase2 ... ok
test test_parse_arrow_variants_and_empty_symbols ... ok
test test_parse_lambda_empty_symbol ... ok
test test_parse_simple_grammar ... ok
test test_phase5_tie_rule_first_by_name ... ok
test test_s0_conditions ... ok
test test_hand_derivation_r2_must_not_reuse ... ok
test test_cnf_preset_order ... ok
test test_t027_audit_lambda_presets_and_grammars ... ok
test test_cnf_preset_unit_chain ... ok
test test_hand_derivation_r1_version_toggle ... ok
test cnf_proptest_variables_read_back_as_single_variable ... ok
test test_cnf_preset_start_long ... ok
test cnf_proptest_short_version_equiv_and_leq_rules ... ok
test test_hand_derivation_r3b_truly_identical ... ok
test test_hand_derivation_r3a_t010_flow_grammar ... ok
test test_cnf_preset_nullable ... ok
test test_cnf_preset_shared_tail ... ok

test result: ok. 30 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 22.29s

     Running tests/jff.rs (target/debug/deps/jff-bee3247b6fde88a3)

running 22 tests
test a_dtd_is_refused_so_entity_attacks_cannot_work ... ok
test a_file_with_the_wrong_shape_names_the_element ... ok
test a_long_label_on_a_loop_works_too ... ok
test a_file_written_by_jflap_is_read_into_a_machine_with_names_and_positions ... ok
test a_label_with_several_characters_reads_them_one_after_the_other ... ok
test an_empty_read_element_is_an_epsilon_transition ... ok
test a_file_without_an_initial_state_still_loads ... ok
test only_finite_automata_are_supported ... ok
test export_writes_plain_xml_in_a_fixed_order ... ok
test export_uses_the_given_names_and_positions_and_escapes_text ... ok
test new_states_for_long_labels_get_ids_after_the_highest_one ... ok
test state_ids_can_be_sparse_and_names_are_kept ... ok
test symbols_with_several_characters_cannot_be_exported ... ok
test problems_in_the_machine_itself_reuse_the_machine_messages ... ok
test text_that_is_not_xml_is_reported_with_its_position ... ok
test the_kind_follows_the_structure_of_the_transitions ... ok
test xml_entities_are_decoded ... ok
test any_text_is_read_without_panicking ... ok
test size_limits_hold ... ok
test damaged_files_are_read_without_panicking ... ok
test multi_character_labels_mean_what_they_mean_in_jflap ... ok
test export_then_import_gives_the_same_machine ... ok

test result: ok. 22 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.10s

     Running tests/json_shapes.rs (target/debug/deps/json_shapes-b56372bf89e19334)

running 10 tests
test budgets_refuse_unknown_or_wrong_fields ... ok
test budgets_read_partial_json ... ok
test a_machine_serializes_to_the_machine_file ... ok
test jff ... ok
test small_results ... ok
test regex_machine ... ok
test simulation ... ok
test conversions ... ok
test operations ... ok
test equivalence ... ok

test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/language.rs (target/debug/deps/language-accd54191f4164ad)

running 12 tests
test test_finite_set_concatenation_and_proper_order ... ok
test test_predicate_count_linear_and_min_length ... ok
test test_parse_and_eval_all_preset_formulas ... ok
test test_kleene_star_and_plus ... ok
test test_juxtaposition_concatenation_parsing ... ok
test test_environment_references_and_resolution ... ok
test test_predicate_modulo ... ok
test test_proper_ordering_comparator ... ok
test test_predicate_universal_prefix ... ok
test test_set_operations_union_diff_intersect ... ok
test test_reversal_and_power ... ok
test test_l1_cubed_l2_squared_minus_l7_star ... ok

test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s

     Running tests/minimize.rs (target/debug/deps/minimize-acc011b82e52c706)

running 11 tests
test a_machine_that_counts_modulo_4_reduces_to_two_states ... ok
test a_minimal_machine_comes_back_unchanged ... ok
test messages_carry_keys_and_parameters ... ok
test only_complete_valid_dfsms_can_be_minimized ... ok
test unreachable_states_are_removed_first_as_visible_steps ... ok
test rich_example_5_28_follows_the_slide_round_by_round ... ok
test one_class_means_a_one_state_machine ... ok
test too_many_steps_stops_with_the_trace_so_far ... ok
test small_budgets_never_panic_and_are_respected ... ok
test the_result_is_minimal_and_minimizing_again_changes_nothing ... ok
test the_minimal_dfsm_accepts_the_same_strings ... ok

test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.09s

     Running tests/nondeterminism.rs (target/debug/deps/nondeterminism-1dd14d5a3580c559)

running 10 tests
test a_machine_without_transitions_has_none ... ok
test a_dfsm_has_no_nondeterministic_state ... ok
test a_missing_transition_is_not_nondeterminism ... ok
test an_epsilon_transition_marks_the_state ... ok
test the_kind_of_the_machine_does_not_matter ... ok
test a_state_can_have_both_problems_and_several_symbols ... ok
test two_identical_transitions_count_as_two ... ok
test two_transitions_on_one_symbol_mark_the_state ... ok
test the_list_follows_the_definition ... ok
test the_list_agrees_with_validate ... ok

test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s

     Running tests/operations.rs (target/debug/deps/operations-8e3a4145f0d88980)

running 20 tests
test a_stopped_intersection_keeps_the_machines_of_the_stages_it_began ... ok
test a_stage_that_is_skipped_has_no_marker_and_the_next_one_starts_from_the_machine ... ok
test complement_swaps_the_accepting_states ... ok
test complementing_twice_gives_the_original_machine ... ok
test a_machine_and_its_complement_have_nothing_in_common ... ok
test intersection_needs_start_states_and_the_same_symbols ... ok
test each_stage_carries_the_machines_it_starts_from ... ok
test only_complete_valid_dfsms_can_be_complemented ... ok
test machines_that_are_not_complete_dfsms_are_made_complete_first ... ok
test union_adds_a_start_state_with_two_epsilon_transitions ... ok
test the_second_machine_is_renumbered_after_the_highest_state_of_the_first ... ok
test symbols_are_matched_by_name_whatever_the_order ... ok
test union_needs_start_states_and_the_same_symbols ... ok
test intersection_runs_the_de_morgan_stages ... ok
test a_union_over_the_state_limit_is_an_error ... ok
test a_budget_stop_inside_a_stage_returns_the_trace_so_far ... ok
test the_complement_accepts_exactly_the_other_strings ... ok
test the_union_accepts_what_either_machine_accepts ... ok
test small_budgets_never_panic ... ok
test the_intersection_accepts_what_both_machines_accept ... ok

test result: ok. 20 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.36s

     Running tests/pda_cfg.rs (target/debug/deps/pda_cfg-943b1024f54bb9c6)

running 14 tests
test test_ac2_f3_language_equivalence ... ok
test test_fixture_f4_input_errors ... ok
test test_fixture_f3_structure ... ok
test test_pin_empty_language_cnf_and_cyk ... ok
test test_fixture_f1_structure_and_cleanup ... ok
test test_fixture_f2_structure ... ok
test test_grammar_text_roundtrip_f1_f2_f3 ... ok
test test_ac4_api_never_panics_on_arbitrary_text ... ok
test test_ac2_f2_language_equivalence ... ok
test test_ac4_non_rnf_pdas_and_high_state_ids ... ok
test test_ac2_f1_language_equivalence ... ok
test test_fixture_f5_limits_and_high_state_ids ... ok
test test_ac3b_chain_cfg_pda_rnf_cfg ... ok
test test_ac3a_random_pdas_through_rnf ... ok

test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 16.57s

     Running tests/pda_jff.rs (target/debug/deps/pda_jff-e2d4009859d14fcc)

running 17 tests
test dtd_and_malformed_xml_refused ... ok
test export_m2_writes_empty_read_pop_push_tags ... ok
test export_m1_round_trips_and_is_idempotent ... ok
test fa_type_refused_by_pda_importer ... ok
test api_envelope_works_for_pda_jff ... ok
test export_multi_character_symbol_refused ... ok
test missing_transition_elements_refused ... ok
test multiple_initial_states_refused ... ok
test fixture_f2_imports_and_reports_pop_never_pushed ... ok
test pop_and_push_order_is_explicitly_preserved ... ok
test pda_type_refused_by_fsm_importer_with_pda_type ... ok
test read_single_char_accepted_multiple_chars_refused_with_key ... ok
test pop_and_push_length_boundary_64_accepted_65_refused ... ok
test fixture_f1_imports_and_simulates_correctly ... ok
test proptest_parse_pda_jff_never_panics ... ok
test proptest_pda_jff_round_trip ... ok
test file_size_boundary_max_bytes_accepted_plus_one_refused ... ok

test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s

     Running tests/pda_json.rs (target/debug/deps/pda_json-d22a4dcb328d5516)

running 13 tests
test json_syntax_error_is_reported ... ok
test unknown_field_is_rejected ... ok
test m1_round_trips_to_canonical_json ... ok
test pop_over_max_pda_string_is_rejected ... ok
test missing_field_is_rejected ... ok
test m2_round_trips_to_canonical_json ... ok
test unknown_input_symbol_is_rejected ... ok
test unknown_stack_symbol_is_rejected ... ok
test push_over_max_pda_string_is_rejected ... ok
test unknown_state_is_rejected ... ok
test unsupported_schema_version_is_rejected ... ok
test size_over_limit_is_rejected ... ok
test prop_pda_json_round_trip ... ok

test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.04s

     Running tests/pda_rnf.rs (target/debug/deps/pda_rnf-b01db6b1c6f1a42c)

running 12 tests
test test_ac4_max_id_is_a_limit_message ... ok
test test_fixture_f1_structure ... ok
test test_fixture_f2_structure ... ok
test test_fixture_f4_small_cases ... ok
test test_f5_transitions_limit_precheck_is_fast ... ok
test test_fixture_f3_structure ... ok
test test_fixture_f5_errors ... ok
test test_ac4_ids_near_top_of_u32_never_panic ... ok
test test_ac2_f2_language_equivalence ... ok
test test_ac4_arbitrary_text_never_panics ... ok
test test_ac2_f1_language_equivalence ... ok
test test_ac3_proptest_random_pdas ... ok

test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.27s

     Running tests/pda_simulate.rs (target/debug/deps/pda_simulate-fbf5775a6fa175da)

running 23 tests
test test_m1_a ... ok
test test_m1_abb ... ok
test test_m1_aab ... ok
test test_level_order_determinism ... ok
test test_m1_ab ... ok
test test_m1_b ... ok
test test_m1_empty ... ok
test test_m2_ab ... ok
test test_m2_aa ... ok
test test_m1_aabb ... ok
test test_max_stack_boundary_exact_depth ... ok
test test_no_change_loop ... ok
test test_max_steps_boundary_m2_aa ... ok
test test_message_priority_not_accepting_over_stack_not_empty ... ok
test test_stack_growing_loop_max_stack ... ok
test test_peak_after_dropping_repeats ... ok
test test_stack_growing_loop_max_steps ... ok
test test_simulation_determinism_fixed ... ok
test test_stack_growing_loop_max_configurations ... ok
test proptest_m1_oracle ... ok
test proptest_m2_oracle ... ok
test test_unrelated_transitions_performance ... ok
test test_worst_case_budget_memory ... ok

test result: ok. 23 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.07s

     Running tests/pda_validate.rs (target/debug/deps/pda_validate-9f51002862253f9a)

running 8 tests
test m1_validation_and_determinism ... ok
test prefix_rule_cases ... ok
test accepting_state_free_move_case ... ok
test m2_validation_and_determinism ... ok
test pop_never_pushed_symbol_pushed_by_unreachable_pop ... ok
test bottom_marker_pop_never_pushed ... ok
test structural_issues ... ok
test prop_determinism_symmetry_and_order_independence ... ok

test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.04s

     Running tests/regex.rs (target/debug/deps/regex-144dbbc15ae111e6)

running 15 tests
test expressions_print_back_in_rich_notation ... ok
test errors_name_the_position ... ok
test all_the_pieces_of_rich_syntax_parse ... ok
test multi_character_symbols_are_separated_by_spaces_and_operators ... ok
test rich_example_6_5_builds_the_machine_of_the_book ... ok
test precedence_is_star_then_concatenation_then_union ... ok
test spaces_are_ignored ... ok
test union_and_concatenation_group_to_the_left ... ok
test the_state_budget_stops_the_construction ... ok
test small_cases_follow_the_constructions_of_the_book ... ok
test size_limits_and_operator_symbols_are_rejected ... ok
test the_parser_never_panics ... ok
test printing_and_parsing_again_keeps_the_language ... ok
test the_machine_accepts_what_a_reference_matcher_accepts ... ok
test plus_means_the_expression_followed_by_its_star ... ok

test result: ok. 15 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.09s

     Running tests/regex_machine.rs (target/debug/deps/regex_machine-68c888f702cbaaf7)

running 9 tests
test a_symbol_outside_the_alphabet_is_an_error ... ok
test an_expression_that_is_not_longer_than_the_machine_expression_is_kept ... ok
test expressions_without_symbols_work ... ok
test the_plain_budget_stops_the_whole_call ... ok
test the_result_means_the_same_and_is_never_longer_than_the_plain_one ... ok
test the_same_expression_gives_the_same_answer ... ok
test the_machine_step_says_how_big_each_machine_is ... ok
test a_machine_that_is_too_big_gives_the_plain_result_and_says_so ... ok
test a_long_expression_becomes_the_short_plus_through_the_minimal_machine ... ok

test result: ok. 9 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.22s

     Running tests/regex_oracle.rs (target/debug/deps/regex_oracle-8160578fcffdab82)

running 11 tests
test fsm_to_regex_agrees_with_the_acceptor_on_every_nfa_of_2_states_over_two_symbols ... ok
test the_acceptor_gives_the_answers_that_a_person_gives ... ok
test the_matcher_gives_the_answers_that_a_person_gives ... ok
test fsm_to_regex_agrees_with_the_acceptor_on_every_nfa_of_2_states_over_one_symbol ... ok
test fsm_to_regex_agrees_with_the_acceptor_on_random_machines ... ok
test simplify_via_the_machine_keeps_the_language_on_every_regex_of_up_to_4_nodes ... ok
test fsm_to_regex_agrees_with_the_acceptor_on_every_dfsm_of_up_to_2_states ... ok
test regex_to_fsm_agrees_with_the_matcher_on_random_regexes ... ok
test simplify_keeps_the_language_on_random_regexes ... ok
test simplify_keeps_the_language_on_every_regex_of_up_to_4_nodes ... ok
test regex_to_fsm_agrees_with_the_matcher_on_every_regex_of_up_to_5_nodes ... ok

test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 12.27s

     Running tests/regex_simplify.rs (target/debug/deps/regex_simplify-4e0f64ba565dd42f)

running 18 tests
test a_run_of_parts_before_a_star_of_the_same_run_becomes_a_plus ... ok
test a_symbol_outside_the_alphabet_is_an_error ... ok
test a_small_check_budget_stops ... ok
test a_symbol_alphabet_with_long_names_works ... ok
test a_small_step_budget_stops_with_a_partial_trace ... ok
test absorption_works_between_parts_that_are_not_next_to_each_other ... ok
test rules_do_not_fire_when_their_condition_fails ... ok
test the_expression_of_the_minimal_machine_and_the_one_of_the_owner_reach_the_same_plus ... ok
test the_new_identities_name_the_parts ... ok
test the_message_names_the_parts ... ok
test example_6_17 ... ok
test exercise_3_simplifies_as_far_as_the_identities_go ... ok
test each_rule_rewrites_and_names_itself ... ok
test a_tiny_budget_never_loops ... ok
test every_line_of_example_6_17_is_equivalent_to_the_start ... ok
test simplifying_twice_changes_nothing ... ok
test the_result_means_the_same_and_is_not_bigger ... ok
test the_new_identities_keep_the_language ... ok

test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.16s

     Running tests/simulate.rs (target/debug/deps/simulate-bf852def55e9877a)

running 17 tests
test a_machine_without_a_start_state_cannot_run ... ok
test a_symbol_outside_the_alphabet_is_an_error ... ok
test a_zero_configuration_budget_stops_at_once ... ok
test an_empty_alphabet_only_accepts_the_empty_text ... ok
test an_input_exactly_as_long_as_max_steps_finishes ... ok
test an_empty_set_of_states_rejects_early ... ok
test ends_in_10_ndfsm_tracks_a_set_of_states ... ok
test epsilon_closure_is_applied_at_the_start_and_after_each_symbol ... ok
test rejecting_early_finishes_even_with_a_small_step_budget ... ok
test even_length_trace_follows_the_single_state ... ok
test other_alphabets_read_symbols_separated_by_spaces ... ok
test even_length_dfsm ... ok
test single_character_alphabets_read_one_character_at_a_time ... ok
test too_many_configurations_stops_before_the_step_that_overflows ... ok
test too_many_steps_stops_with_the_trace_so_far ... ok
test small_budgets_never_panic_and_are_respected ... ok
test set_simulation_agrees_with_path_search ... ok

test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.09s

     Running tests/trap_state.rs (target/debug/deps/trap_state-4aee2a592eea6543)

running 9 tests
test the_new_state_comes_after_the_highest_id ... ok
test a_complete_dfsm_comes_back_unchanged ... ok
test the_trace_shows_the_new_state_the_missing_transitions_and_the_loops ... ok
test other_machines_are_refused ... ok
test minimize_works_on_the_result ... ok
test a_dfsm_without_a_dead_state_gets_one ... ok
test a_machine_that_is_already_at_the_state_limit_is_refused ... ok
test complement_works_on_the_result ... ok
test the_result_is_complete_and_means_the_same ... ok

test result: ok. 9 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.27s

     Running tests/ts_export.rs (target/debug/deps/ts_export-33cfd47880a3bf7a)

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/validate.rs (target/debug/deps/validate-6703e515f13f4509)

running 12 tests
test a_state_reached_only_through_epsilon_is_reachable ... ok
test dfsm_epsilon_transition_is_an_error ... ok
test dfsm_duplicate_transition_is_reported_once_per_state_and_symbol ... ok
test no_start_state_is_an_error_and_skips_reachability ... ok
test unreachable_state_is_a_warning ... ok
test valid_ndfsm_may_have_epsilon_and_missing_transitions ... ok
test dfsm_missing_transition_names_state_and_symbol ... ok
test valid_dfsm_has_no_issues ... ok
test issues_come_in_a_fixed_order ... ok
test the_list_stops_at_1000_issues_with_a_marker ... ok
test complete_dfsm_has_no_errors ... ok
test validate_is_deterministic_and_ndfsm_never_gets_dfsm_keys ... ok

test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s

     Running tests/xor.rs (target/debug/deps/xor-64f20ad6e96eb367)

running 17 tests
test a_budget_of_states_stops_it_with_the_trace_so_far ... ok
test a_pair_step_names_the_two_states_that_it_pairs ... ok
test a_pair_that_no_string_reaches_is_not_built ... ok
test a_stage_that_has_nothing_to_do_is_skipped ... ok
test an_accepting_step_says_which_side_accepts_in_its_key ... ok
test the_product_has_one_state_for_each_reachable_pair_and_follows_the_method_in_order ... ok
test the_result_is_a_valid_complete_dfsm ... ok
test a_language_xor_itself_is_empty_and_nothing_accepts ... ok
test xor_needs_start_states_and_the_same_symbols ... ok
test a_language_xor_its_complement_is_everything ... ok
test a_budget_of_steps_stops_it_and_never_panics ... ok
test the_order_of_the_symbols_of_the_second_machine_does_not_matter ... ok
test machines_that_are_not_complete_dfsms_are_made_complete_first ... ok
test xor_accepts_exactly_what_one_of_the_machines_accepts ... ok
test small_budgets_never_panic ... ok
test xor_accepts_a_string_exactly_when_one_machine_accepts_it ... ok
test xor_has_no_accepting_state_exactly_when_the_machines_are_equivalent ... ok

test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.63s

     Running unittests src/lib.rs (target/debug/deps/engine_wasm-c813d8d0c2a39401)

running 13 tests
test tests::cyk_parse_answers_in_envelope ... ok
test tests::a_budget_that_is_too_small_stops_the_run ... ok
test tests::enumerate_language_answers_in_envelope ... ok
test tests::cfg_to_pda_topdown_answers_in_envelope ... ok
test tests::parse_grammar_answers_in_envelope ... ok
test tests::pda_to_cfg_answers_in_envelope ... ok
test tests::version_matches_crate_version ... ok
test tests::simulate_answers_in_the_envelope ... ok
test tests::cfg_to_pda_bottomup_answers_in_envelope ... ok
test tests::bad_input_is_an_error_and_not_a_trap ... ok
test tests::transform_to_cnf_answers_in_envelope ... ok
test tests::pda_to_rnf_answers_in_envelope ... ok
test tests::equivalent_names_the_witness ... ok

test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s

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

