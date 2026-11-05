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

---

## 2. AC5 Deliberate Breaks

Each deliberate break was performed on purpose in `crates/engine-core/src/cfg_pda.rs`, verified to fail the intended tests, and then restored to clean working state.

### Break 1: Wrong Push Order (`rev()`)
- **Modification:** Changed production rule push sequence to reverse order: `push.reverse();`.
- **Result:** FAILED tests:
  - `test_fixture_f1_details`
  - `test_fixture_f2_details`
  - `test_fixture_f3_details`
  - `test_fixture_f4_left_recursion`
  - `proptest_ac3_small_grammars`
- **Restoration:** Restored forward push order `rule.body.iter().map(...)`. Verified tests pass.

### Break 2: Start Transition Target Inverted ($q \to p$)
- **Modification:** Changed start transition from `(0, 1)` to `(1, 0)`: `from: q, to: p`.
- **Result:** FAILED tests:
  - `test_fixture_f1_details`
  - `test_fixture_f2_details`
  - `test_fixture_f3_details`
  - `test_fixture_f4_left_recursion`
  - `test_fixture_f5_duplicate_rules_merged`
  - `test_pda_equivalence_f1_all_511_strings`
  - `test_pda_equivalence_f2_all_511_strings`
  - `test_pda_equivalence_f3_all_511_strings`
  - `proptest_ac3_small_grammars`
- **Restoration:** Restored `from: p, to: q`. Verified tests pass.

### Break 3: Terminal Transition Pop Empty (`pop: vec![]`)
- **Modification:** Changed terminal transition pop to empty slice: `pop: vec![]`.
- **Result:** FAILED tests:
  - `test_fixture_f1_details`
  - `test_fixture_f2_details`
  - `test_fixture_f3_details`
  - `test_fixture_f4_left_recursion`
  - `test_fixture_f5_duplicate_rules_merged`
  - `test_pda_equivalence_f1_all_511_strings`
  - `test_pda_equivalence_f2_all_511_strings`
  - `test_pda_equivalence_f3_all_511_strings`
  - `proptest_ac3_small_grammars`
- **Restoration:** Restored `pop: vec![c_sym]`. Verified tests pass.

### Break 4: Skip Duplicate Rule Deduplication
- **Modification:** Removed `seen_rules` hashset deduplication in rule loop.
- **Result:** FAILED test:
  - `test_fixture_f5_duplicate_rules_merged`
- **Restoration:** Restored `seen_rules.insert((rule.head, &rule.body))`. Verified tests pass.

### Break 5: Allow Variable/Terminal Symbol Clash
- **Modification:** Commented out `var_names.intersection(&term_names)` check.
- **Result:** FAILED test:
  - `test_fixture_f5_symbol_clash` (failed with `pda.invalid_alphabet` / duplicate symbol instead of expected `pda.cfg.symbol_clash`).
- **Restoration:** Restored symbol clash check. Verified tests pass.

### Break 6: Incorrect Stack Alphabet Sorting (variables then terminals joined)
- **Modification:** Separated variables and terminals into two independently sorted lists and concatenated them (`vars` then `terms`), rather than sorting all symbols together in byte order.
- **Result:** FAILED tests:
  - `test_fixture_f1_details`
  - `test_fixture_f2_details`
  - `test_fixture_f3_details`
  - `test_fixture_f4_left_recursion`
  - `test_fixture_f5_duplicate_rules_merged`
  - `proptest_ac4_arbitrary_string_never_panics`
- **Restoration:** Restored unified `BTreeSet<String>` across all variable and terminal names. Verified tests pass.

---

## 3. Verification Output (Verbatim)

### 3.1 Rust Checks and Formatting
```
$ cargo fmt --check && cargo clippy --all-targets -- -D warnings
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.08s
```

### 3.2 Target Test Suite: `crates/engine-core/tests/cfg_pda.rs`
```
$ cargo test -p engine-core --test cfg_pda
    Finished `test` profile [unoptimized + debuginfo] target(s) in 4.32s
     Running tests/cfg_pda.rs (target/debug/deps/cfg_pda-4ac66e51a83d8f5a)

running 14 tests
test test_fixture_f3_details ... ok
test test_fixture_f1_details ... ok
test test_fixture_f4_left_recursion ... ok
test test_fixture_f2_details ... ok
test test_fixture_f5_limit_exceeded_65_symbols ... ok
test test_fixture_f5_duplicate_rules_merged ... ok
test test_fixture_f5_symbol_clash ... ok
test test_fixture_f5_multi_character_variable_and_jff ... ok
test test_pda_equivalence_f2_all_511_strings ... ok
test proptest_ac4_arbitrary_string_never_panics ... ok
test test_pda_equivalence_f1_all_511_strings ... ok
test test_pda_equivalence_f3_all_511_strings ... ok
test test_oracles_agree_on_all_511_strings ... ok
test proptest_ac3_small_grammars ... ok

test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 2.78s
```

### 3.3 Engine Core Entire Test Suite
```
$ cargo test -p engine-core
    Finished `test` profile [unoptimized + debuginfo] target(s) in 10.83s
     Running unittests src/lib.rs (target/debug/deps/engine_core-4d42c56399407537)
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/api.rs
test result: ok. 29 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.15s

     Running tests/boundaries.rs
test result: ok. 20 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.09s

     Running tests/cfg_pda.rs
test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.36s

     Running tests/determinize.rs
test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s

     Running tests/dfsm.rs
test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s

     Running tests/equiv.rs
test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.08s

     Running tests/grammar.rs
test result: ok. 31 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.08s

     Running tests/jff.rs
test result: ok. 22 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s

     Running tests/minimize.rs
test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.04s

     Running tests/ndfsm.rs
test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.04s

     Running tests/pda_jff.rs
test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.08s

     Running tests/pda_json.rs
test result: ok. 15 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s

     Running tests/pda_simulate.rs
test result: ok. 23 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.35s

     Running tests/pda_validate.rs
test result: ok. 22 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.06s

     Running tests/proptests.rs
test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 4.90s

     Running tests/regex.rs
test result: ok. 25 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.07s

     Running tests/simplify.rs
test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.21s

     Running tests/simulate.rs
test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.06s

     Running tests/trap_state.rs
test result: ok. 9 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.16s

     Running tests/ts_export.rs
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/validate.rs
test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s

     Running tests/xor.rs
test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.29s
```

### 3.4 Engine WASM Test Suite
```
$ cargo test -p engine-wasm
    Finished `test` profile [unoptimized + debuginfo] target(s) in 8.24s
     Running unittests src/lib.rs (target/debug/deps/engine_wasm-ca623b5f692ebe3b)

running 10 tests
test tests::enumerate_language_answers_in_envelope ... ok
test tests::a_budget_that_is_too_small_stops_the_run ... ok
test tests::cfg_to_pda_topdown_answers_in_envelope ... ok
test tests::parse_grammar_answers_in_envelope ... ok
test tests::cyk_parse_answers_in_envelope ... ok
test tests::bad_input_is_an_error_and_not_a_trap ... ok
test tests::version_matches_crate_version ... ok
test tests::simulate_answers_in_the_envelope ... ok
test tests::transform_to_cnf_answers_in_envelope ... ok
test tests::equivalent_names_the_witness ... ok

test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

### 3.5 Web Typecheck, Lint, Formatting, and Guard Rails
```
$ pnpm --filter web check
$ svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings
Loading svelte-check in workspace: /home/Aldebaran64/webtomata/web
Getting Svelte diagnostics...

svelte-check found 0 errors and 0 warnings

$ pnpm --filter web lint
$ eslint .

$ pnpm --filter web format:check && cargo fmt --check
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!

$ node tools/check-strings.mjs
ok   63 components have no hard-coded text

$ node tools/check-tokens-usage.mjs
ok   65 files use no raw colors
```

### 3.6 Web Unit Tests
```
$ pnpm --filter web exec vitest run
 Test Files  92 passed (92)
      Tests  1181 passed | 2 skipped (1183)
   Start at  19:54:40
   Duration  11.27s (transform 3.82s, setup 0ms, collect 3.91s, tests 18.52s, environment 0ms, prepare 2.15s)
```

### 3.7 Tool Tests
```
$ pnpm test:tools
ℹ tests 132
ℹ suites 3
ℹ pass 132
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 11271.61218
```

### 3.8 Build and Size Verification (WASM Delta)
```
$ pnpm build && pnpm size
$ node tools/check-size.mjs
ok   initial JS index.html: 80.1 KB gzip (limit 170 KB)
ok   initial JS panduan/berakhiran-x.html: 85.0 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 79.2 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 118.4 KB gzip (limit 170 KB)
ok   initial JS soal/berakhiran-10.html: 118.0 KB gzip (limit 170 KB)
ok   initial JS jumlah-a-genap.html: 118.0 KB gzip (limit 170 KB)
ok   initial JS soal/mengandung-101.html: 118.0 KB gzip (limit 170 KB)
ok   initial JS soal.html: 80.7 KB gzip (limit 170 KB)
ok   initial JS tentang.html: 78.5 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-lENq6a09.wasm: 228.0 KB gzip (limit 250 KB)
```
- **WASM Size Before:** 224.3 KB gzip
- **WASM Size After:** 228.0 KB gzip (+3.7 KB gzip, comfortably below the 250 KB budget)

---

## 4. Summary & Non-Goals Confirmed
- **PR:** #157 (https://github.com/AldebaranHere/webtomata/pull/157)
- **Work Commit:** `e6cefdd` (`feat(engine): convert CFG to PDA top-down with step trace`)
- **Status in PLAN.md:** `done`
- No UI components or screens were introduced or altered (T-033/T-038 remain deferred).
- Conversion algorithm executes strictly Slide13 page 4: 1 start transition, 1 transition per distinct production rule, 1 transition per terminal symbol.
- No grammar normalization is performed; duplicate production rules merged; symbol clashes between variables and terminals correctly rejected with `pda.cfg.symbol_clash`.
- Top-down push sequence preserves top-first order (`[γ1, ..., γn]`).
- All 15 tests in `crates/engine-core/tests/cfg_pda.rs` passed cleanly, including two-oracle agreement test on 511 strings and proptests.

---

## 5. Review Fixes (PR 157 Review)

### 5.1 Fix 1: Nullable-Aware Left Recursion Detection & CYK Oracle Failure
- **Problem**: `has_left_recursion` previously only inspected the first symbol `r.body.first()`. Grammars with left recursion through nullable variables (such as `S -> A a ; A -> B S a ; B -> ε`, where $B \Rightarrow \varepsilon$ produces the derivation $S \Rightarrow A a \Rightarrow B S a \Rightarrow S a a$) were not identified as left-recursive. Consequently, the non-left-recursive branch budget gate (`skipped <= total / 2`) fired when BFS configuration trees stopped on non-language strings.
- **Implementation**:
  1. Fixed-point nullable computation: iteratively computes all non-terminals that can derive $\varepsilon$.
  2. Directed left-corner graph: for each rule $X \to \gamma_1\dots\gamma_n$, inspects each $\gamma_i$; if $\gamma_i$ is a non-terminal, adds directed edge $X \to \gamma_i$ and continues only if $\gamma_i$ is nullable. Stops at first non-nullable non-terminal or any terminal.
  3. Cycle check: searches for directed cycles from each node.
  4. Added unit test `test_has_left_recursion_nullable_aware` verifying counterexample `S -> A a\nA -> B S a\nB -> ε` (returns `true`), plain non-left-recursive grammar `S -> a S b | a b` (returns `false`), and direct left recursion `S -> S a | b` (returns `true`).
  5. CYK oracle assertion: replaced `.unwrap_or(false)` with `.expect("CYK parse must succeed").accepted`, ensuring CYK parse failures fail the test immediately.
- **Verification (3 Consecutive Runs with `PROPTEST_CASES=1000`)**:
  - Run 1:
    `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 14 filtered out; finished in 40.45s`
  - Run 2:
    `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 14 filtered out; finished in 40.62s`
  - Run 3:
    `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 14 filtered out; finished in 54.38s`

### 5.2 Fix 2: Elimination of `.expect(...)` in Non-Test Code
- **Problem**: `crates/engine-core/src/cfg_pda.rs` had five `.expect(...)` calls on symbol lookups (`start_id`, `head_id`, `sym_id`, `read_id`, `pop_id`).
- **Implementation**: Replaced each `.expect(...)` with `.ok_or_else(|| Message::new("machine.unknown_symbol").with("symbol", <name>))?`.
- **Result**: Zero `.unwrap()` or `.expect()` calls remain in `crates/engine-core/src/cfg_pda.rs`. All error handling routes cleanly through `Result<_, Message>` using `?`.

