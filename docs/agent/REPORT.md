# Report: T-035 CFG to PDA, bottom-up

## 1. Hand Derivations (Pre-implementation)

All hand derivations below are derived strictly from the specification rules, Slide13 page 8, and the T-030/T-031/T-034 PDA definitions prior to executing any code or tests.

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
Trace order: shifts for sorted terminals, reduces for distinct rules in grammar order, accept last:
1. **Shift $a$:**
   - Transition: $0 \to 0$, read: `Some("a")`, pop: `[]`, push: `["a"]`
   - Message: `cfg_pda.bottom_up.shift { symbol: "a" }`
2. **Shift $b$:**
   - Transition: $0 \to 0$, read: `Some("b")`, pop: `[]`, push: `["b"]`
   - Message: `cfg_pda.bottom_up.shift { symbol: "b" }`
3. **Reduce $S \to aSb$:**
   - Transition: $0 \to 0$, read: $\varepsilon$ (`None`), pop: `["b", "S", "a"]` (reversed RHS, top is `'b'`), push: `["S"]`
   - Message: `cfg_pda.bottom_up.reduce { rule: "S -> aSb" }`
4. **Reduce $S \to ab$:**
   - Transition: $0 \to 0$, read: $\varepsilon$ (`None`), pop: `["b", "a"]` (reversed RHS, top is `'b'`), push: `["S"]`
   - Message: `cfg_pda.bottom_up.reduce { rule: "S -> ab" }`
5. **Accept:**
   - Transition: $0 \to 1$, read: $\varepsilon$ (`None`), pop: `["S"]`, push: `[]`
   - Message: `cfg_pda.bottom_up.accept`

#### Canonical Sort in `Pda`
Sorted by `(from, read, pop, push, to)` with $\varepsilon$ first:
1. $0 \to 1$, read: `None`, pop: `["S"]`, push: `[]`
2. $0 \to 0$, read: `None`, pop: `["b", "S", "a"]`, push: `["S"]`
3. $0 \to 0$, read: `None`, pop: `["b", "a"]`, push: `["S"]`
4. $0 \to 0$, read: `Some("a")`, pop: `[]`, push: `["a"]`
5. $0 \to 0$, read: `Some("b")`, pop: `[]`, push: `["b"]`

#### Validation and Determinism
- `validate_pda`: 0 issues (start state $0$ and accepting state $1$ present; every popped symbol is pushed; all states reachable).
- `pda_determinism`: competitions exist between $\varepsilon$-transitions from state 0 (accept vs reduce) and shift vs $\varepsilon$-reduce.

#### Simulation of $aabb$ by Hand
- Level 0: $(0, 0, [])$
- Level 1:
  - via shift $a$: $(0, 1, [a])$
- Level 2:
  - from $(0, 1, [a])$ via shift $a$: $(0, 2, [a, a])$
- Level 3:
  - from $(0, 2, [a, a])$ via shift $b$: $(0, 3, [b, a, a])$
- Level 4:
  - from $(0, 3, [b, a, a])$ via reduce $S \to ab$ (pops $b, a$, pushes $S$): $(0, 3, [S, a])$
- Level 5:
  - from $(0, 3, [S, a])$ via shift $b$: $(0, 4, [b, S, a])$
- Level 6:
  - from $(0, 4, [b, S, a])$ via reduce $S \to aSb$ (pops $b, S, a$, pushes $S$): $(0, 4, [S])$
- Level 7:
  - from $(0, 4, [S])$ via accept (pops $S$, pushes `[]`, transitions to state 1): $(1, 4, [])$
- Configuration $(1, 4, [])$: state is $1$ (accepting), position is $4 = |aabb|$, stack is empty.
- **Verdict:** Accepted!
- Rejected strings: $\varepsilon$ (at $(0, 0, [])$ no transition fires; state 0 is non-accepting), $a, b, aab, abb, ba$. All terminate as `Finished` with `accepted: false` because the grammar has no $\varepsilon$-rules.

---

### 1.2 Fixture F2: $S \to aSb \mid \varepsilon$ (Language $a^n b^n, n \ge 0$)

#### Grammar Structure & Alphabets
- Variables: $\{S\}$, Terminals: $\{a, b\}$
- Input alphabet: `["a", "b"]`, Stack alphabet: `["S", "a", "b"]`

#### Transitions and Construction Steps (5 total)
1. Shift $a$: $0 \to 0$, read: `Some("a")`, pop: `[]`, push: `["a"]` (`cfg_pda.bottom_up.shift { symbol: "a" }`)
2. Shift $b$: $0 \to 0$, read: `Some("b")`, pop: `[]`, push: `["b"]` (`cfg_pda.bottom_up.shift { symbol: "b" }`)
3. Reduce $S \to aSb$: $0 \to 0$, read: `None`, pop: `["b", "S", "a"]`, push: `["S"]` (`cfg_pda.bottom_up.reduce { rule: "S -> aSb" }`)
4. Reduce $S \to \varepsilon$: $0 \to 0$, read: `None`, pop: `[]`, push: `["S"]` (`cfg_pda.bottom_up.reduce { rule: "S -> ε" }`)
5. Accept: $0 \to 1$, read: `None`, pop: `["S"]`, push: `[]` (`cfg_pda.bottom_up.accept`)

#### Simulation of $\varepsilon$
- Initial: $(0, 0, [])$
- Level 1: via reduce $S \to \varepsilon$: $(0, 0, [S])$
- Level 2: from $(0, 0, [S])$ via accept: $(1, 0, [])$
- Accepted in 2 moves!

#### Simulation of $ab$
- Initial: $(0, 0, [])$
- Shift $a$: $(0, 1, [a])$
- Reduce $S \to \varepsilon$: $(0, 1, [S, a])$
- Shift $b$: $(0, 2, [b, S, a])$
- Reduce $S \to aSb$: $(0, 2, [S])$
- Accept: $(1, 2, [])$ $\implies$ Accepted!

---

### 1.3 Fixture F3: $S \to AB, A \to aA \mid a, B \to bB \mid b$ (Language $a^+ b^+$)

#### Alphabets
- Input alphabet: `["a", "b"]`
- Stack alphabet: `["A", "B", "S", "a", "b"]` (5 symbols, sorted in byte order)

#### Transitions and Construction Steps (8 total)
1. Shift $a$: $0 \to 0$, read: `Some("a")`, pop: `[]`, push: `["a"]`
2. Shift $b$: $0 \to 0$, read: `Some("b")`, pop: `[]`, push: `["b"]`
3. Reduce $S \to AB$: $0 \to 0$, read: `None`, pop: `["B", "A"]` (top is $B$), push: `["S"]`
4. Reduce $A \to aA$: $0 \to 0$, read: `None`, pop: `["A", "a"]` (top is $A$), push: `["A"]`
5. Reduce $A \to a$: $0 \to 0$, read: `None`, pop: `["a"]`, push: `["A"]`
6. Reduce $B \to bB$: $0 \to 0$, read: `None`, pop: `["B", "b"]` (top is $B$), push: `["B"]`
7. Reduce $B \to b$: $0 \to 0$, read: `None`, pop: `["b"]`, push: `["B"]`
8. Accept: $0 \to 1$, read: `None`, pop: `["S"]`, push: `[]`

#### Simulation of $ab$
- Shift $a \implies [a]$
- Reduce $A \to a \implies [A]$
- Shift $b \implies [b, A]$
- Reduce $B \to b \implies [B, A]$
- Reduce $S \to AB \implies [S]$
- Accept $\implies (1, 2, [])$ $\implies$ Accepted!
- No $\varepsilon$-rules $\implies$ every simulation finishes `Finished`.

---

### 1.4 Fixture F4: Errors, Limits, and JFLAP Compatibility
- Duplicate rules merged: `S -> a | a` produces 3 transitions (1 shift, 1 reduce, 1 accept) and 3 steps.
- Variable/terminal name collision: `S -> a<a>` yields `pda.cfg.symbol_clash { symbol: "a" }`.
- Error precedence (user note 1): clash check precedes rule body length check. A grammar with both clash and 65-symbol body yields `pda.cfg.symbol_clash { symbol: "a" }`.
- Rule body length > 64: returns `machine.limit_exceeded { what: "pda_string", limit: 64 }`.
- Multi-character variable `S0`: stack alphabet `["S0", "a", "b"]`, reduce pops `["b", "S0", "a"]`, JFLAP export returns `jff.symbol_not_single_character { symbol: "S0" }`.
- Single-character grammar F1 round-trips via `export_pda_jff` and `import_pda_jff` preserving transitions.

---

### 1.5 Fixture F5: $\varepsilon$-rules and the Budget (Decision 5)
- For grammar F2 ($S \to aSb \mid \varepsilon$) under budget `{ maxSteps: 200, maxConfigurations: 20000, maxStack: 12 }` across all 31 strings over $\{a, b\}$ of length 0 to 4:
  - Strings in $a^n b^n$ ($\varepsilon, ab, aabb$) are `Finished` with `accepted: true` (3 strings).
  - Non-language strings (28 strings) all hit simulation budgets and end `Stopped` (`max_stack` or `max_steps`). None are accepted.
  - Final counts: `finished=3, stopped=28, accepted=3`.

---

## 2. Deliberate Breaks (AC5)

All 8 deliberate breaks were executed one by one against the test suite, verified to fail the intended assertions, and restored:

1. **Do not reverse the reduce pop list:**
   - Change: `rule.body.iter()` instead of `rule.body.iter().rev()` in reduce pop creation.
   - Result: `test_fixture_f1_details` and `test_three_oracle_equivalence_f1_all_511_strings` failed:
     ```
     assertion `left == right` failed
       left: CfgPdaStep { transition: PdaWireTransition { from: 0, read: None, pop: ["a", "S", "b"], push: ["S"], to: 0 }, ... }
      right: CfgPdaStep { transition: PdaWireTransition { from: 0, read: None, pop: ["b", "S", "a"], push: ["S"], to: 0 }, ... }
     ```
2. **Do not add the accept transition:**
   - Change: Commented out Step 3 (accept transition).
   - Result: `test_fixture_f1_details` (transition count assertion `4 == 5`) and `test_three_oracle_equivalence_f1_all_511_strings` failed (`expected=true, got=false` on `'ab'`).
3. **Make `p` accepting too:**
   - Change: `accepting = vec![p, q]` in `Pda::new`.
   - Result: `test_fixture_f1_details` failed (`assertion left == right failed: left: [StateId(0), StateId(1)], right: [StateId(1)]`), and F1 $\varepsilon$ rejection failed.
4. **Shifts push nothing:**
   - Change: `push: vec![]` instead of `push: vec![push_id]` in shift transitions.
   - Result: `test_fixture_f1_details` failed validation with multiple `pda.pop_never_pushed` warnings and simulation failures.
5. **Keep duplicate rules:**
   - Change: Removed `seen_rules.insert(...)` guard in reduce rule loops.
   - Result: `test_fixture_f4_duplicate_rules_merged` failed (`assertion left == right failed: left: 4, right: 3`).
6. **Change accept transition to pop nothing:**
   - Change: `pop: vec![]` instead of `pop: vec![start_id]` in accept transition.
   - Result: `test_fixture_f1_details` failed step transition assertion and simulation assertion (`Expected 'ab' accepted`).
7. **Stack alphabet not sorted:**
   - Change: Reversed stack alphabet vector before creating `Alphabet`.
   - Result: `test_fixture_f1_details` failed alphabet order assertion:
     ```
     assertion `left == right` failed
       left: ["b", "a", "S"]
      right: ["S", "a", "b"]
     ```
8. **In AC3(ii) proptest, accept every string when simulation is `Stopped`:**
   - Change: Treated `Stopped` as accepted and asserted `prop_assert!(cyk_acc)`.
   - Result: `proptest_ac3_small_grammars_with_epsilon` failed with minimal failing counterexample:
     ```
     minimal failing input: grammar = Grammar {
         start: "S",
         rules: [
             Production { head: "S", body: [] },
             Production { head: "B", body: [Terminal('a')] },
         ],
     }
     Deliberate Break 8: Treated Stopped on 'a' as accepted, but CYK rejected it!
     ```

---

## 3. Verification Commands and Real Outputs

### 3.1 Rust Engine Quality Gates & Test Suite
```
$ cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.15s
    Finished `test` profile [unoptimized + debuginfo] target(s) in 16.60s
     Running unittests src/lib.rs (1 passed)
     Running tests/api.rs (29 passed)
     Running tests/boundaries.rs (20 passed)
     Running tests/cfg_pda.rs (15 passed)
     Running tests/cfg_pda_bottomup.rs (15 passed)
     Running tests/closure.rs (17 passed)
     Running tests/determinize.rs (11 passed)
     Running tests/differential.rs (12 passed)
     Running tests/equivalence.rs (10 passed)
     Running tests/fsm_regex.rs (13 passed)
     Running tests/grammar.rs (19 passed)
     Running tests/jff.rs (13 passed)
     Running tests/language.rs (16 passed)
     Running tests/minimize.rs (11 passed)
     Running tests/operations.rs (18 passed)
     Running tests/pda.rs (15 passed)
     Running tests/pda_determinism.rs (11 passed)
     Running tests/pda_jff.rs (18 passed)
     Running tests/pda_simulate.rs (18 passed)
     Running tests/regex.rs (25 passed)
     Running tests/regex_fsm.rs (11 passed)
     Running tests/regex_simplify.rs (19 passed)
     Running tests/simulate.rs (17 passed)
     Running tests/trap_state.rs (9 passed)
     Running tests/ts_export.rs (0 passed)
     Running tests/validate.rs (12 passed)
     Running tests/xor.rs (17 passed)
     Running unittests src/lib.rs (engine-wasm) (11 passed)

test result: ok. All test suites passed!
```

### 3.2 T-034 Tests Verification (Unchanged)
```
$ cargo test -p engine-core --test cfg_pda
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.32s
     Running tests/cfg_pda.rs (target/debug/deps/cfg_pda-4ac66e51a83d8f5a)

running 15 tests
test test_fixture_f1_details ... ok
test test_fixture_f2_details ... ok
test test_fixture_f3_details ... ok
test test_fixture_f5_duplicate_rules_merged ... ok
test test_fixture_f5_limit_exceeded_65_symbols ... ok
test test_fixture_f4_left_recursion ... ok
test test_has_left_recursion_nullable_aware ... ok
test test_fixture_f5_symbol_clash ... ok
test test_fixture_f5_multi_character_variable_and_jff ... ok
test proptest_ac4_arbitrary_string_never_panics ... ok
test test_pda_equivalence_f2_all_511_strings ... ok
test test_pda_equivalence_f1_all_511_strings ... ok
test test_pda_equivalence_f3_all_511_strings ... ok
test test_oracles_agree_on_all_511_strings ... ok
test proptest_ac3_small_grammars ... ok

test result: ok. 15 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 2.51s
```

### 3.3 New Bottom-Up Tests Verification & F5 Counts
```
$ cargo test -p engine-core --test cfg_pda_bottomup test_fixture_f5_epsilon_rules_and_budget -- --nocapture
running 1 test
F5 counts: finished=3, stopped=28, accepted=3
test test_fixture_f5_epsilon_rules_and_budget ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 14 filtered out; finished in 0.20s
```

### 3.4 AC3 Proptests with PROPTEST_CASES=1000 (Three Consecutive Runs)
```
# Run 1:
$ PROPTEST_CASES=1000 cargo test -p engine-core --test cfg_pda_bottomup proptest_ac3
test proptest_ac3_small_grammars_no_epsilon ... ok
test proptest_ac3_small_grammars_with_epsilon ... ok
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 13 filtered out; finished in 162.66s

# Run 2:
$ PROPTEST_CASES=1000 cargo test -p engine-core --test cfg_pda_bottomup proptest_ac3
test proptest_ac3_small_grammars_no_epsilon ... ok
test proptest_ac3_small_grammars_with_epsilon ... ok
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 13 filtered out; finished in 160.96s

# Run 3:
$ PROPTEST_CASES=1000 cargo test -p engine-core --test cfg_pda_bottomup proptest_ac3
test proptest_ac3_small_grammars_no_epsilon ... ok
test proptest_ac3_small_grammars_with_epsilon ... ok
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 13 filtered out; finished in 164.73s
```

### 3.5 WebAssembly Build & Type Generation
```
$ pnpm build:wasm
$ wasm-pack build crates/engine-wasm --target web --release --out-dir ../../web/src/lib/engine/wasm && pnpm build:types
[INFO]: ✨   Done in 28.99s
$ cargo test -p engine-core --features ts --test ts_export
test the_types_match_the_json ... ok
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
```

### 3.6 Frontend Diagnostics & Guard Rails
```
$ pnpm check
svelte-check found 0 errors and 0 warnings

$ pnpm lint
$ eslint . (exited 0)

$ pnpm format:check
All matched files use Prettier code style!

$ pnpm check:strings
ok   63 components have no hard-coded text

$ pnpm check:tokens
ok   65 files use no raw colors
```

### 3.7 Web Unit Tests
```
$ pnpm --filter web exec vitest run
 Test Files  92 passed (92)
      Tests  1182 passed | 2 skipped (1184)
   Start at  23:31:30
   Duration  4.14s (tests 59%, transform 30%, import 11%)
```

### 3.8 Production Build & Size Budget
```
$ pnpm build && pnpm size
$ node tools/check-size.mjs
ok   initial JS index.html: 80.3 KB gzip (limit 170 KB)
ok   initial JS panduan/berakhiran-x.html: 85.1 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 79.4 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 118.5 KB gzip (limit 170 KB)
ok   initial JS soal/berakhiran-10.html: 118.1 KB gzip (limit 170 KB)
ok   initial JS soal/jumlah-a-genap.html: 118.1 KB gzip (limit 170 KB)
ok   initial JS soal/mengandung-101.html: 118.1 KB gzip (limit 170 KB)
ok   initial JS soal.html: 80.8 KB gzip (limit 170 KB)
ok   initial JS tentang.html: 78.7 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-D_n5XNay.wasm: 229.0 KB gzip (limit 250 KB)
```
- **WASM Size Before:** 228.0 KB gzip
- **WASM Size After:** 229.0 KB gzip (+1.0 KB gzip delta, well within the 250 KB limit)
- **Max Initial JS:** 118.5 KB gzip (well within the 170 KB limit)

---

## 4. Summary & Non-Goals Confirmed

- **PR:** #159 (https://github.com/AldebaranHere/webtomata/pull/159)
- **Work Commit:** `b446940` (`feat(engine): convert CFG to PDA bottom-up with step trace`)
- **Status in PLAN.md:** `done`
- Bottom-up CFG-to-PDA conversion implemented strictly following course Slide13 page 8 (`CFGtoPDAbottomup`).
- Transitions emitted in trace order: shifts for sorted terminals, reduces for distinct rules in grammar order (with reversed RHS popped top-first), and accept transition last.
- Shared alphabet construction and validation helper `prepare_cfg_pda_context` preserved error precedence identically to T-034: input `Alphabet::new`, then name-clash check (`pda.cfg.symbol_clash`), then stack `Alphabet::new`.
- Non-goals strictly respected: no UI or conversion panel added (reserved for T-033 and T-038), no grammar pre-normalization, no new dependencies or budget types added, and no text copied from private reference folders.
