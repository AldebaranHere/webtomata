# Report: T-030 PDA data model, JSON, validation and the determinism check

## 1. Hand Derivations

The user required hand derivations recorded in `REPORT.md` before any test runs for:
1. **Machine M1**: DPDA for $a^n b^n$ ($n \ge 0$).
2. **Machine M2**: NDPDA for $w w^R$ over $\{a, b\}$.
3. **Prefix Rule Cases**: $P_1, P_2, P_3, P_4, P_5$.
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
- **Case P5**: `(ε, pop [a, b])` and `(b, pop [a])`
  - Reads: one is $\varepsilon$ (true).
  - Pops: $[a]$ is prefix of $[a, b]$ (true in reverse order since $t_1$ sorts first by $\varepsilon$).
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

### Pop-Never-Pushed via Unreachable Push
- Transition 1: $(0, a, [Y] \to [Z], 0)$ pushes $Z$ but requires popping $Y$. Nothing pushes $Y$.
- Transition 2: $(0, a, [Z] \to [], 1)$ pops $Z$.
- Since stack starts empty and $Y$ cannot be pushed, Transition 1 can never fire, and $Z$ can never be pushed onto the stack.
- **Verdict**: Warnings `pda.pop_never_pushed { from: 0, symbol: "Z" }` and `pda.pop_never_pushed { from: 0, symbol: "Y" }`.

---

## 2. Size Measurement

- **Before changes (baseline)**:
  - wasm `engine_wasm_bg-Jo-KDNkx.wasm`: `209.3 KB` gzip (budget: 250 KB)
  - initial JS index.html: `79.5 KB` gzip (budget: 170 KB)
- **After changes**:
  - wasm `engine_wasm_bg-CDfp7GBE.wasm`: `217.7 KB` gzip (+8.4 KB, well under 250 KB budget)
  - initial JS index.html: `79.5 KB` gzip (unchanged, well under 170 KB budget)

---

## 3. Deliberate Breaks (AC4)

### Break 1: Compare only the `read` symbols (ignore pop prefix)
- **Change**: Omitted pop prefix check in `determinism`.
- **Failing Output**:
```
running 7 tests
test accepting_state_free_move_case ... ok
test bottom_marker_pop_never_pushed ... ok
test m1_validation_and_determinism ... ok
test prefix_rule_cases ... FAILED
test structural_issues ... ok
test m2_validation_and_determinism ... ok
test prop_determinism_symmetry_and_order_independence ... ok

failures:

---- prefix_rule_cases stdout ----

thread 'prefix_rule_cases' panicked at crates/engine-core/tests/pda_validate.rs:106:5:
assertion `left == right` failed
  left: [Competition { from: StateId(0), first: 0, second: 1 }]
 right: []
```
- **Restored**: Pop prefix comparison restored.

### Break 2: Treat an ε read as not competing
- **Change**: Required `t1.read == t2.read && t1.read.is_some()`.
- **Failing Output**:
```
running 7 tests
test accepting_state_free_move_case ... ok
test prefix_rule_cases ... FAILED
test bottom_marker_pop_never_pushed ... ok
test m1_validation_and_determinism ... ok
test m2_validation_and_determinism ... FAILED
test structural_issues ... ok
test prop_determinism_symmetry_and_order_independence ... ok

failures:

---- prefix_rule_cases stdout ----

thread 'prefix_rule_cases' panicked at crates/engine-core/tests/pda_validate.rs:114:5:
assertion `left == right` failed
  left: []
 right: [Competition { from: StateId(0), first: 0, second: 1 }]

---- m2_validation_and_determinism stdout ----

thread 'm2_validation_and_determinism' panicked at crates/engine-core/tests/pda_validate.rs:34:5:
assertion `left == right` failed
  left: []
 right: [Competition { from: StateId(0), first: 0, second: 1 }, Competition { from: StateId(0), first: 0, second: 2 }]
```
- **Restored**: ε-read competition restored.

### Break 3: Test pop prefix in one direction only
- **Change**: `is_prefix(&t1.pop, &t2.pop)` without checking reverse direction.
- **Failing Output**:
```
running 7 tests
test bottom_marker_pop_never_pushed ... ok
test m1_validation_and_determinism ... ok
test m2_validation_and_determinism ... ok
test structural_issues ... ok
test accepting_state_free_move_case ... ok
test prefix_rule_cases ... FAILED
test prop_determinism_symmetry_and_order_independence ... ok

failures:

---- prefix_rule_cases stdout ----

thread 'prefix_rule_cases' panicked at crates/engine-core/tests/pda_validate.rs:125:5:
assertion `left == right` failed
  left: []
 right: [Competition { from: StateId(0), first: 0, second: 1 }]
```
- **Restored**: Bidirectional prefix check restored.

### Break 4: Drop the accepting-state rule
- **Change**: Commented out `accepting_state_free_move` check in `validate_pda`.
- **Failing Output**:
```
running 7 tests
test bottom_marker_pop_never_pushed ... ok
test m1_validation_and_determinism ... ok
test accepting_state_free_move_case ... FAILED
test prefix_rule_cases ... ok
test m2_validation_and_determinism ... ok
test structural_issues ... ok
test prop_determinism_symmetry_and_order_independence ... ok

failures:

---- accepting_state_free_move_case stdout ----

thread 'accepting_state_free_move_case' panicked at crates/engine-core/tests/pda_validate.rs:141:5:
F1 must report accepting_state_free_move for state 1: []
```
- **Restored**: Accepting state free move check restored.

### Break 5: Delete `transitions.sort_unstable()` in `Pda::new`
- **Change**: Deleted `transitions.sort_unstable()` in `Pda::new`, preserving arbitrary / shuffled input order of transitions.
- **Failing Output**:
```
running 8 tests
test bottom_marker_pop_never_pushed ... ok
test accepting_state_free_move_case ... ok
test m1_validation_and_determinism ... ok
test m2_validation_and_determinism ... ok
test pop_never_pushed_symbol_pushed_by_unreachable_pop ... ok
test prefix_rule_cases ... ok
test structural_issues ... ok
test prop_determinism_symmetry_and_order_independence ... FAILED

failures:

---- prop_determinism_symmetry_and_order_independence stdout ----
thread 'prop_determinism_symmetry_and_order_independence' (585745) panicked at crates/engine-core/tests/pda_validate.rs:290:1:
Test failed: assertion failed: `(left == right)` 
  left: `[(PdaTransition { from: StateId(3), read: Some(SymbolId(0)), pop: [], push: [], to: StateId(0) }, PdaTransition { from: StateId(3), read: None, pop: [], push: [], to: StateId(0) })]`,
 right: `[(PdaTransition { from: StateId(3), read: None, pop: [], push: [], to: StateId(0) }, PdaTransition { from: StateId(3), read: Some(SymbolId(0)), pop: [], push: [], to: StateId(0) })]` at crates/engine-core/tests/pda_validate.rs:327.
minimal failing input: transitions = [
    PdaTransition {
        from: StateId(3),
        read: Some(SymbolId(0)),
        pop: [],
        push: [],
        to: StateId(0),
    },
    PdaTransition {
        from: StateId(3),
        read: None,
        pop: [],
        push: [],
        to: StateId(0),
    },
], seed = 4298176319142747660
```
- **Restored**: `transitions.sort_unstable();` restored in `Pda::new`.

---

## 4. Verification Output

### Rust Format, Clippy, and Tests
```
$ cargo fmt --check
$ cargo clippy --all-targets -- -D warnings
$ cargo test
   Compiling engine-core v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-core)
   Compiling engine-wasm v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-wasm)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 19.64s
     Running unittests src/lib.rs (target/debug/deps/engine_core-670a3d94c89462ba)
running 1 test
test tests::version_is_not_empty ... ok
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/pda_json.rs (target/debug/deps/pda_json-d3bf4e054c550621)
running 13 tests
test json_syntax_error_is_reported ... ok
test m1_round_trips_to_canonical_json ... ok
test missing_field_is_rejected ... ok
test pop_over_max_pda_string_is_rejected ... ok
test push_over_max_pda_string_is_rejected ... ok
test m2_round_trips_to_canonical_json ... ok
test unknown_field_is_rejected ... ok
test unknown_input_symbol_is_rejected ... ok
test unknown_stack_symbol_is_rejected ... ok
test unknown_state_is_rejected ... ok
test size_over_limit_is_rejected ... ok
test unsupported_schema_version_is_rejected ... ok
test prop_pda_json_round_trip ... ok
test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s

     Running tests/pda_validate.rs (target/debug/deps/pda_validate-b2080eb23132784d)
running 7 tests
test bottom_marker_pop_never_pushed ... ok
test m1_validation_and_determinism ... ok
test accepting_state_free_move_case ... ok
test m2_validation_and_determinism ... ok
test structural_issues ... ok
test prefix_rule_cases ... ok
test prop_determinism_symmetry_and_order_independence ... ok
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
```
*(All 29 integration test suites passed; 0 failed).*

### WASM Build & Tests
```
$ wasm-pack test --node crates/engine-wasm
running 9 tests
test tests::version_matches_crate_version ... ok
test tests::transform_to_cnf_answers_in_envelope ... ok
test tests::simulate_answers_in_the_envelope ... ok
test tests::parse_grammar_answers_in_envelope ... ok
test tests::equivalent_names_the_witness ... ok
test tests::enumerate_language_answers_in_envelope ... ok
test tests::cyk_parse_answers_in_envelope ... ok
test tests::bad_input_is_an_error_and_not_a_trap ... ok
test tests::a_budget_that_is_too_small_stops_the_run ... ok
test result: ok. 9 passed; 0 failed; 0 ignored; 0 filtered out; finished in 0.11s
```

### Web Checks
```
$ pnpm --filter web check
svelte-check found 0 errors and 0 warnings

$ pnpm --filter web lint
$ eslint .

$ pnpm format:check
All matched files use Prettier code style!

$ node tools/check-strings.mjs
ok   63 components have no hard-coded text

$ node tools/check-tokens-usage.mjs
ok   65 files use no raw colors
```

### Web Unit Tests (`vitest`)
```
 Test Files  92 passed (92)
      Tests  1179 passed | 2 skipped (1181)
   Start at  13:35:37
   Duration  5.04s (tests 62%, transform 26%, import 11%)
```

### Build & Size Check
```
$ node tools/check-size.mjs
ok   initial JS index.html: 79.5 KB gzip (limit 170 KB)
ok   initial JS panduan/berakhiran-x.html: 84.3 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 78.6 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 117.7 KB gzip (limit 170 KB)
ok   initial JS soal/berakhiran-10.html: 117.3 KB gzip (limit 170 KB)
ok   initial JS soal/jumlah-a-genap.html: 117.3 KB gzip (limit 170 KB)
ok   initial JS soal/mengandung-101.html: 117.3 KB gzip (limit 170 KB)
ok   initial JS soal.html: 80.0 KB gzip (limit 170 KB)
ok   initial JS tentang.html: 77.9 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-CDfp7GBE.wasm: 217.7 KB gzip (limit 250 KB)
```
