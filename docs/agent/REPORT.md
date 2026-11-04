# Report: T-060 Align CNF stepper phases with course homework order and message keys

## 1. Hand Derivations

The user required hand derivations recorded in `REPORT.md` before any test runs for:
1. **The T-010 grammar** (`CNF_NULLABLE`)
2. **Grammar where a variable becomes unreachable only after Phase 2** (`G_CASCADE_UNREACHABLE`)
3. **Grammar where $\varepsilon$ is not in the language** (`G_NO_EPSILON`)

---

### Grammar 1: T-010 Grammar (`CNF_NULLABLE`)
- **Alphabet**: $\{a, b\}$
- **Variables**: $\{S, A, B, C\}$
- **Start**: $S$
- **Rules**:
  - $S \to A B C \mid a$
  - $A \to a A \mid \varepsilon$
  - $B \to b B \mid \varepsilon$
  - $C \to c$

#### Phase 1: Unreachable Rules (`grammar.cnf.phase_unreachable`)
- Reachable from $S$:
  - Start $\{S\}$.
  - $S \to A B C \mid a \implies \{S, A, B, C\}$.
  - All variables are reachable.
- **Rules after Phase 1**:
  - $S \to A B C \mid a$
  - $A \to a A \mid \varepsilon$
  - $B \to b B \mid \varepsilon$
  - $C \to c$

#### Phase 2: Non-productive Rules (`grammar.cnf.phase_nonproductive`)
- Productive variables:
  - Base: $S \to a$ ($S$), $A \to \varepsilon$ ($A$), $B \to \varepsilon$ ($B$), $C \to c$ ($C$). All variables productive.
- Unreachable after pruning: none.
- **Rules after Phase 2**: Same as Phase 1.

#### Phase 3: $\varepsilon$-Rules (`grammar.cnf.phase_epsilon`)
- Nullable variables:
  - Base: $A \to \varepsilon$, $B \to \varepsilon \implies \{A, B\}$.
  - $C$ not nullable.
  - $S \to A B C$ ($C$ is not nullable), $S \to a$ (terminal). Thus $S$ is NOT nullable ($\varepsilon \notin L(G)$).
- Expand rules removing nullable combinations (cannot eliminate all if entire RHS nullable):
  - $S \to A B C \mid B C \mid A C \mid C \mid a$
  - $A \to a A \mid a$
  - $B \to b B \mid b$
  - $C \to c$
- Start symbol nullable? $S \notin \text{Nullable}$. Therefore, $S_0$ is **NOT** introduced.
- `note_key`: `None`.

#### Phase 4: Unit Rules (`grammar.cnf.phase_unit`)
- Unit pairs:
  - $(S, C) \implies S \to c$.
- All unit rules removed.
- **Rules after Phase 4**:
  - $S \to A B C \mid B C \mid A C \mid c \mid a$
  - $A \to a A \mid a$
  - $B \to b B \mid b$
  - $C \to c$

#### Phase 5: Mixed Rules (`grammar.cnf.phase_mixed`)
- For RHS length $\ge 2$, replace terminals with new variables:
  - $A \to a A \implies A \to T_a A, T_a \to a$
  - $B \to b B \implies B \to T_b B, T_b \to b$
- **Rules after Phase 5**:
  - $S \to A B C \mid B C \mid A C \mid c \mid a$
  - $A \to T_a A \mid a$
  - $B \to T_b B \mid b$
  - $C \to c$
  - $T_a \to a$
  - $T_b \to b$

#### Phase 6: Long Rules (`grammar.cnf.phase_long`)
- Break RHS of length $> 2$:
  - $S \to A B C \implies S \to A X_1, X_1 \to B C$
- **Rules after Phase 6 (Final CNF)**:
  - $S \to A X_1 \mid B C \mid A C \mid c \mid a$
  - $X_1 \to B C$
  - $A \to T_a A \mid a$
  - $B \to T_b B \mid b$
  - $C \to c$
  - $T_a \to a$
  - $T_b \to b$

---

### Grammar 2: Variable Becomes Unreachable Only After Phase 2 (`G_CASCADE_UNREACHABLE`)
- **Alphabet**: $\{a, b\}$
- **Variables**: $\{S, A, B, C, D\}$
- **Start**: $S$
- **Rules**:
  - $S \to A B \mid a$
  - $A \to a$
  - $B \to b C$
  - $C \to c C$  (non-productive!)
  - $D \to a$     (unreachable in Phase 1)

#### Phase 1: Unreachable Rules
- Reachable from $S$: $\{S, A, B, C\}$.
- Variable $D$ is unreachable $\implies$ drop $D \to a$.
- **Rules after Phase 1**:
  - $S \to A B \mid a$
  - $A \to a$
  - $B \to b C$
  - $C \to c C$

#### Phase 2: Non-productive & Cascaded Unreachable Rules
1. Productive set:
   - Base: $S \to a \implies \{S\}$; $A \to a \implies \{A\}$.
   - $C$ has only $C \to c C$, no terminal base $\implies C$ not productive.
   - $B$ has only $B \to b C$, depends on $C \implies B$ not productive.
   - Productive set is $\{S, A\}$.
2. Drop rules with non-productive variables:
   - Drop $C \to c C$.
   - Drop $B \to b C$.
   - Drop $S \to A B$.
   - Remaining rules:
     - $S \to a$
     - $A \to a$
3. Cascaded unreachable check:
   - Reachable from $S$ in remaining rules: only $\{S\}$.
   - Variable $A$ was reachable before, but now has no incoming rules from $S$!
   - Cascaded unreachable: $A$ is dropped.
- **Rules after Phase 2**:
  - $S \to a$

#### Phase 3: $\varepsilon$-Rules
- No nullable variables. $S_0$ not created.
- **Rules after Phase 3**: $S \to a$.

#### Phase 4: Unit Rules
- No unit rules.
- **Rules after Phase 4**: $S \to a$.

#### Phase 5: Mixed Rules
- No mixed rules of length $\ge 2$.
- **Rules after Phase 5**: $S \to a$.

#### Phase 6: Long Rules
- No rules of length $> 2$.
- **Rules after Phase 6 (Final CNF)**:
  - $S \to a$

---

### Grammar 3: Grammar where $\varepsilon$ is Not in Language with Start on RHS (`G_NO_EPSILON`)
- **Alphabet**: $\{a, b\}$
- **Variables**: $\{S, A\}$
- **Start**: $S$
- **Rules**:
  - $S \to a S \mid A$
  - $A \to b$

#### Phase 1: Unreachable Rules
- Reachable from $S$: $\{S, A\}$.
- All variables reachable.

#### Phase 2: Non-productive Rules
- Productive: $A \to b \implies A$; $S \to A \implies S$. All productive.

#### Phase 3: $\varepsilon$-Rules
- Nullable variables: None.
- Note: Even though $S$ appears on the RHS of $S \to a S$, $S$ is **NOT** nullable!
- Homework rule: $S_0$ is added if and only if $S$ is nullable.
- Therefore, $S_0$ is **NOT** added. Start remains $S$.

#### Phase 4: Unit Rules
- Unit pair: $(S, A) \implies S \to b$.
- Drop $S \to A$.
- **Rules after Phase 4**:
  - $S \to a S \mid b$
  - $A \to b$

#### Phase 5: Mixed Rules
- $S \to a S \implies S \to T_a S, T_a \to a$.
- **Rules after Phase 5**:
  - $S \to T_a S \mid b$
  - $A \to b$
  - $T_a \to a$

#### Phase 6: Long Rules
- All rules length $\le 2$.
- **Rules after Phase 6 (Final CNF)**:
  - $S \to T_a S \mid b$
  - $A \to b$
  - $T_a \to a$

---

## 2. AC4 Deliberate Breaks and Restorations

Each of the three deliberate breaks mandated by AC4 was executed, witnessed failing, and then restored to green:

### Break 1: Swap Phases 1 and 2 in `cnf.rs`
- **Change**: Swapped phase execution order so `phase_nonproductive` ran before `phase_unreachable`.
- **Expected failure**: `test_hand_derivation_unreachable_after_phase2` panicked because phase 1 key was `grammar.cnf.phase_nonproductive` instead of `grammar.cnf.phase_unreachable`.
- **Actual output**:
  ```text
  thread 'test_hand_derivation_unreachable_after_phase2' panicked at crates/engine-core/tests/grammar.rs:188:9:
  assertion `left == right` failed
    left: "grammar.cnf.phase_nonproductive"
   right: "grammar.cnf.phase_unreachable"
  ```
- **Restoration**: Order restored to 1: unreachable, 2: non-productive. Test passed.

### Break 2: Never Add $S_0$
- **Change**: Commented out the $S_0$ insertion in Phase 3 even when start symbol is nullable.
- **Expected failure**: `test_s0_conditions` panicked on nullable start grammar.
- **Actual output**:
  ```text
  thread 'test_s0_conditions' panicked at crates/engine-core/tests/grammar.rs:219:9:
  assertion `left == right` failed: start variable must be S0 when start is nullable
    left: "S"
   right: "S0"
  ```
- **Restoration**: Restored $S_0$ generation condition `if start_is_nullable`. Test passed.

### Break 3: Missing Localization Key in `en.ts`
- **Change**: Commented out `'grammar.cnf.phase_unreachable.title'` in `web/src/lib/i18n/en.ts`.
- **Expected failure**: `pnpm test:web` (`i18n.test.ts`) failed checking parity between English and Indonesian dictionaries.
- **Actual output**:
  ```text
  FAIL  src/lib/i18n/i18n.test.ts > i18n dictionary completeness > en dictionary has all keys present in id
  AssertionError: expected false to be true // Object.is equality
  - Expected
  + Received
  - true
  + false
  at /home/Aldebaran64/webtomata/web/src/lib/i18n/i18n.test.ts:46:17
  ```
- **Restoration**: Restored translation key in `en.ts`. Test passed.

---

## 3. Real Verification Outputs

### 3.1 Rust Verification (`cargo fmt`, `cargo clippy`, `cargo test`)
Command:
```bash
wsl.exe -d Ubuntu --cd ~/webtomata -e bash -lc '. "$HOME/.cargo/env" && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test'
```
Output:
```text
   Compiling engine-core v0.1.0 (/home/Aldebaran64/webtomata/crates/engine-core)
   Compiling engine-wasm v0.1.0 (/home/Aldebaran64/webtomata/crates/engine-wasm)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 2.68s
     Running unittests src/lib.rs (target/debug/deps/engine_core-ea13a7c365691d1e)

running 43 tests
test fsm::dfa::tests::dfa_rejects_empty_alphabet ... ok
test fsm::dfa::tests::dfa_rejects_empty_states ... ok
test fsm::dfa::tests::dfa_requires_all_transitions ... ok
test fsm::dfa::tests::dfa_accepts_valid_string ... ok
test fsm::dfa::tests::dfa_deterministic_single_path ... ok
test fsm::dfa::tests::dfa_rejects_symbol_not_in_alphabet ... ok
test fsm::dfa::tests::dfa_step_reports_missing_transition ... ok
test fsm::mealy::tests::mealy_empty_input ... ok
test fsm::mealy::tests::mealy_parity_detector ... ok
test fsm::mealy::tests::mealy_trace_execution ... ok
test fsm::moore::tests::moore_empty_input ... ok
test fsm::moore::tests::moore_mod3_counter ... ok
test fsm::moore::tests::moore_trace_execution ... ok
test fsm::nfa::tests::nfa_accepts_via_backtracking ... ok
test fsm::nfa::tests::nfa_handles_cycle_with_depth_limit ... ok
test fsm::nfa::tests::nfa_multiple_paths ... ok
test fsm::nfa::tests::nfa_rejects_dead_end ... ok
test fsm::pda::tests::pda_cycle_depth_limit ... ok
test fsm::pda::tests::pda_empty_stack_check ... ok
test fsm::pda::tests::pda_rejects_unbalanced_parentheses ... ok
test fsm::pda::tests::pda_recognizes_balanced_parentheses ... ok
test fsm::tm::tests::tm_detects_infinite_loop_step_limit ... ok
test fsm::tm::tests::tm_handles_blank_tape ... ok
test fsm::tm::tests::tm_rejects_invalid_head_direction ... ok
test fsm::tm::tests::tm_simple_incrementer ... ok
test fsm::trace::tests::trace_event_serialization ... ok
test grammar::cfg::tests::cfg_simple_derivation ... ok
test grammar::cfg::tests::cfg_handles_cycle_depth_limit ... ok
test grammar::cfg::tests::cfg_validates_terminals ... ok
test grammar::cnf::tests::empty_grammar ... ok
test grammar::cnf::tests::grammar_with_start_on_rhs ... ok
test grammar::cnf::tests::already_in_cnf ... ok
test grammar::cnf::tests::grammar_with_epsilon ... ok
test grammar::cnf::tests::full_pipeline_step_by_step ... ok
test grammar::cnf::tests::grammar_with_unit_rules ... ok
test grammar::cnf::tests::grammar_with_mixed_and_long ... ok
test grammar::cyk::tests::cyk_parses_simple_string ... ok
test grammar::cyk::tests::cyk_rejects_string_not_in_language ... ok
test grammar::cyk::tests::cyk_produces_parse_table ... ok
test grammar::cyk::tests::cyk_handles_empty_string ... ok
test regex::thompson::tests::thompson_handles_complex_regex ... ok
test regex::thompson::tests::thompson_rejects_empty_regex ... ok
test regex::thompson::tests::thompson_constructs_valid_nfa ... ok

test result: ok. 43 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s

     Running tests/grammar.rs (target/debug/deps/grammar-d10fb96001258285)

running 24 tests
test test_already_cnf ... ok
test test_cnf_empty_productions ... ok
test test_cnf_extreme_long_rhs ... ok
test test_cnf_infinite_unit_cycle ... ok
test test_cnf_multiple_start_rules ... ok
test test_cnf_no_productive_rules ... ok
test test_cnf_nonterminal_terminal_mix_extreme ... ok
test test_cnf_single_terminal ... ok
test test_cnf_start_not_in_variables ... ok
test test_cnf_unreachable_rules ... ok
test test_cyk_empty_string ... ok
test test_cyk_invalid_grammar_not_cnf ... ok
test test_cyk_large_input_string ... ok
test test_cyk_membership_palindromes ... ok
test test_cyk_parse_table_structure ... ok
test test_cyk_unreachable_terminal ... ok
test test_hand_derivation_cnf_nullable ... ok
test test_hand_derivation_no_epsilon ... ok
test test_hand_derivation_unreachable_after_phase2 ... ok
test test_s0_conditions ... ok
test test_start_variable_collision ... ok
test test_step_by_step_step_order ... ok
test test_stepper_preset_balanced_parentheses ... ok
test test_stepper_preset_nullable ... ok

test result: ok. 24 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.04s

     Running unittests src/lib.rs (target/debug/deps/engine_wasm-a5e2f7b823e20ec6)

running 9 tests
test tests::test_parse_fsm_definition ... ok
test tests::test_simulate_fsm_execution ... ok
test tests::test_cyk_parse ... ok
test tests::test_step_fsm_single ... ok
test tests::test_convert_cfg_to_cnf ... ok
test tests::test_trace_fsm_complete ... ok
test tests::test_regex_to_nfa ... ok
test tests::test_step_cnf_transformation ... ok
test tests::test_step_fsm_until_breakpoint ... ok

test result: ok. 9 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
```

### 3.2 WASM Build (`pnpm build:wasm`)
Command:
```bash
wsl.exe -d Ubuntu --cd ~/webtomata -e bash -lc '. "$HOME/.cargo/env" && export PATH="$HOME/tools/node/bin:$PATH" && pnpm build:wasm'
```
Output:
```text
> webtomata@0.1.0 build:wasm /home/Aldebaran64/webtomata
> wasm-pack build --target web --out-dir ../../web/src/lib/engine/wasm crates/engine-wasm && pnpm ts:export

[INFO]: 🎯  Checking for the Wasm target...
[INFO]: 🌀  Compiling to Wasm...
   Compiling engine-core v0.1.0 (/home/Aldebaran64/webtomata/crates/engine-core)
   Compiling engine-wasm v0.1.0 (/home/Aldebaran64/webtomata/crates/engine-wasm)
    Finished `release` profile [optimized] target(s) in 17.50s
[INFO]: ⬇️  Installing wasm-bindgen...
[INFO]:   Executing `wasm-opt` on the WebAssembly binary...
[INFO]: 📦  Packaging your codes...
[INFO]: ⬇️  Installing wasm-pack...
[INFO]: 🎉  Your wasm pkg is ready to publish at /home/Aldebaran64/webtomata/web/src/lib/engine/wasm.

> webtomata@0.1.0 ts:export /home/Aldebaran64/webtomata
> tsx tools/export-types.ts

TypeScript definitions exported successfully.
```

### 3.3 Static Checks (`pnpm check`, `pnpm lint`, `pnpm format:check`, `pnpm check:strings`)
Command:
```bash
wsl.exe -d Ubuntu --cd ~/webtomata -e bash -lc 'export PATH="$HOME/tools/node/bin:$PATH" && pnpm check && pnpm lint && pnpm format:check && pnpm check:strings'
```
Output:
```text
> webtomata@0.1.0 check /home/Aldebaran64/webtomata
> svelte-kit sync && svelte-check --tsconfig ./tsconfig.json

Loading svelte-check in workspace: /home/Aldebaran64/webtomata/web
Getting Svelte diagnostics...

====================================
svelte-check found 0 errors and 0 warnings

> webtomata@0.1.0 lint /home/Aldebaran64/webtomata
> eslint .

> webtomata@0.1.0 format:check /home/Aldebaran64/webtomata
> prettier --check .

Checking formatting...
All matched files use Prettier code style!

> webtomata@0.1.0 check:strings /home/Aldebaran64/webtomata
> tsx tools/check-hardcoded-strings.ts

Auditing Svelte components for hardcoded Indonesian strings...
Scanned 63 Svelte components:
  All clean! No raw Indonesian words found in Svelte templates.
```

### 3.4 Unit Tests & WASM Integration Tests (`pnpm test:web`, `pnpm test:wasm`)
Command:
```bash
wsl.exe -d Ubuntu --cd ~/webtomata -e bash -lc 'export PATH="$HOME/tools/node/bin:$PATH" && pnpm test:web && pnpm test:wasm'
```
Output:
```text
> webtomata@0.1.0 test:web /home/Aldebaran64/webtomata
> vitest run --exclude '**/*.wasm.test.ts'

 ❯ src/lib/i18n/i18n.test.ts (2 tests) 20ms
 ❯ src/lib/editor/diagram-layout.test.ts (2 tests) 6ms
 ❯ src/lib/editor/history.test.ts (8 tests) 9ms
 ❯ src/lib/editor/tape.test.ts (6 tests) 11ms
 ❯ src/lib/editor/export.test.ts (8 tests) 8ms
 ❯ src/lib/editor/preset-loader.test.ts (7 tests) 8ms
 ❯ src/lib/editor/fsm-canvas.test.ts (7 tests) 10ms
 ❯ src/lib/grammar/grammar-presets.test.ts (5 tests) 9ms
 ❯ src/lib/editor/editor-navigation.test.ts (2 tests) 7ms
 ❯ src/lib/editor/state-ops.test.ts (22 tests) 11ms
 ❯ src/lib/editor/fsm-canvas-gestures.test.ts (6 tests) 7ms
 ❯ src/lib/editor/fsm-canvas-touch.test.ts (9 tests) 9ms
 ❯ src/lib/editor/fsm-canvas-pan-zoom.test.ts (5 tests) 7ms
 ❯ src/lib/editor/fsm-canvas-keyboard.test.ts (8 tests) 13ms
 ❯ src/lib/editor/fsm-canvas-multitouch.test.ts (5 tests) 8ms
 ❯ src/lib/editor/fsm-canvas-transitions.test.ts (11 tests) 13ms

 Test Files  16 passed (16)
      Tests  113 passed (113)
   Start at  04:47:05
   Duration  1.69s (transform 376ms,setup 0ms,collect 1.63s,tests 146ms,environment 1.70s,prepare 587ms)

> webtomata@0.1.0 test:wasm /home/Aldebaran64/webtomata
> vitest run --include '**/*.wasm.test.ts'

 ❯ src/lib/grammar/cyk-matrix.wasm.test.ts (4 tests) 16ms
 ❯ src/lib/grammar/grammar-text.wasm.test.ts (6 tests) 27ms
 ❯ src/lib/grammar/grammar-editor.wasm.test.ts (5 tests) 31ms

 Test Files  3 passed (3)
      Tests  15 passed (15)
   Start at  04:47:09
   Duration  1.07s (transform 122ms,setup 0ms,collect 361ms,tests 74ms,environment 692ms,prepare 418ms)
```

### 3.5 Build & Size (`pnpm build && pnpm size`)
Command:
```bash
wsl.exe -d Ubuntu --cd ~/webtomata -e bash -lc 'export PATH="$HOME/tools/node/bin:$PATH" && pnpm build && pnpm size'
```
Output:
```text
> webtomata@0.1.0 build /home/Aldebaran64/webtomata
> vite build

vite v6.4.1 building for production...
✓ 131 modules transformed.
.svelte-kit/output/client/_app/version.json                            0.03 kB │ gzip:  0.05 kB
.svelte-kit/output/client/vite-manifest.json                          9.43 kB │ gzip:  1.21 kB
.svelte-kit/output/client/_app/immutable/assets/0.BhL0gQ21.css        8.85 kB │ gzip:  2.32 kB
.svelte-kit/output/client/_app/immutable/assets/3.B5jB6L65.css        3.42 kB │ gzip:  0.94 kB
.svelte-kit/output/client/_app/immutable/chunks/C3fBwPfq.js           0.18 kB │ gzip:  0.16 kB
.svelte-kit/output/client/_app/immutable/chunks/D3f-fDk4.js           0.27 kB │ gzip:  0.22 kB
.svelte-kit/output/client/_app/immutable/chunks/B0iJjYv_.js           0.30 kB │ gzip:  0.23 kB
.svelte-kit/output/client/_app/immutable/chunks/B1qjDq0N.js           0.51 kB │ gzip:  0.34 kB
.svelte-kit/output/client/_app/immutable/chunks/Bf3R1_Qc.js           0.60 kB │ gzip:  0.39 kB
.svelte-kit/output/client/_app/immutable/chunks/CHq_jN7E.js           0.64 kB │ gzip:  0.41 kB
.svelte-kit/output/client/_app/immutable/chunks/B4mH43Qk.js           0.70 kB │ gzip:  0.42 kB
.svelte-kit/output/client/_app/immutable/chunks/D96Y9QoD.js           0.80 kB │ gzip:  0.48 kB
.svelte-kit/output/client/_app/immutable/chunks/B_h4r-tC.js           0.82 kB │ gzip:  0.47 kB
.svelte-kit/output/client/_app/immutable/chunks/B485K0P_.js           1.01 kB │ gzip:  0.59 kB
.svelte-kit/output/client/_app/immutable/nodes/2.CksJ22r_.js          1.07 kB │ gzip:  0.64 kB
.svelte-kit/output/client/_app/immutable/chunks/C_q83w1s.js           1.39 kB │ gzip:  0.78 kB
.svelte-kit/output/client/_app/immutable/chunks/BHq6e4l4.js           1.60 kB │ gzip:  0.86 kB
.svelte-kit/output/client/_app/immutable/nodes/1.B0-mQ9eC.js          1.67 kB │ gzip:  0.93 kB
.svelte-kit/output/client/_app/immutable/chunks/CPn2o5p1.js           2.47 kB │ gzip:  1.17 kB
.svelte-kit/output/client/_app/immutable/chunks/CRBvU8Zq.js           3.37 kB │ gzip:  1.34 kB
.svelte-kit/output/client/_app/immutable/chunks/CVfXm_y4.js           3.60 kB │ gzip:  1.42 kB
.svelte-kit/output/client/_app/immutable/chunks/CW0VjD0K.js           4.25 kB │ gzip:  1.82 kB
.svelte-kit/output/client/_app/immutable/chunks/DUo9vQG5.js           5.32 kB │ gzip:  2.16 kB
.svelte-kit/output/client/_app/immutable/chunks/DCjO3M1s.js           5.58 kB │ gzip:  2.24 kB
.svelte-kit/output/client/_app/immutable/chunks/D56f4d2g.js           7.07 kB │ gzip:  2.58 kB
.svelte-kit/output/client/_app/immutable/entry/app.D8iT2l71.js        7.97 kB │ gzip:  3.12 kB
.svelte-kit/output/client/_app/immutable/nodes/3.CSiYwB2v.js         12.18 kB │ gzip:  4.27 kB
.svelte-kit/output/client/_app/immutable/chunks/CcT8q_mX.js          13.62 kB │ gzip:  4.70 kB
.svelte-kit/output/client/_app/immutable/entry/start.CYm_a48j.js     17.51 kB │ gzip:  6.48 kB
.svelte-kit/output/client/_app/immutable/nodes/0.DKVl8j_A.js         32.22 kB │ gzip:  8.25 kB
.svelte-kit/output/client/_app/immutable/chunks/CR4q2VjM.js          36.83 kB │ gzip: 10.74 kB
.svelte-kit/output/client/_app/immutable/chunks/CHu3L8c3.js          42.17 kB │ gzip: 13.91 kB
✓ built in 1.40s

> webtomata@0.1.0 size /home/Aldebaran64/webtomata
> tsx tools/check-size-budget.ts

Size Budget Check:
  WASM: 206.1 KB (limit: 250 KB) [gzip] - PASS
  Initial JS: 79.3 KB (limit: 170 KB) [gzip] - PASS
All size budgets PASSED.
```

### 3.6 Playwright E2E Verification (Area Specs)
Command 1: `grammar-flow.spec.ts` and `grammar-open-cnf.spec.ts` repeated 5 times across desktop and phone:
```bash
wsl.exe -d Ubuntu --cd ~/webtomata -e bash -lc 'export PATH="$HOME/tools/node/bin:$PATH" && pnpm --filter web exec playwright test --project=desktop --project=phone e2e/grammar-flow.spec.ts e2e/grammar-open-cnf.spec.ts --repeat-each=5'
```
Output:
```text
Running 110 tests using 6 workers
  50 skipped
  60 passed (27.2s)
```

Command 2: `grammar-phone.spec.ts` and `grammar-cyk-limit.spec.ts` across desktop and phone:
```bash
wsl.exe -d Ubuntu --cd ~/webtomata -e bash -lc 'export PATH="$HOME/tools/node/bin:$PATH" && pnpm --filter web exec playwright test --project=desktop --project=phone e2e/grammar-phone.spec.ts e2e/grammar-cyk-limit.spec.ts'
```
Output:
```text
Running 20 tests using 6 workers
  10 skipped
  10 passed (6.3s)
```

### 3.7 Zero Hardcoded Indonesian Sentences in Engine
Command:
```bash
wsl.exe -d Ubuntu --cd ~/webtomata -e bash -lc 'export PATH="$HOME/tools/node/bin:$PATH" && node -e '\''
const fs = require("fs");
const lines = fs.readFileSync("crates/engine-core/src/grammar/cnf.rs", "utf-8").split("\n");
let inTests = false;
let violations = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes("mod tests {")) inTests = true;
  if (!inTests) {
    if (line.includes("Hapus") || line.includes("Ganti") || line.includes("Tambah") || line.includes("Buat")) {
      violations.push(`${i+1}: ${line}`);
    }
  }
}
console.log("Violations found:", violations.length);
if (violations.length > 0) console.log(violations.join("\n"));
'\'''
```
Output:
```text
Violations found: 0
```

---

## 4. Glossary Additions
The following terms were added to `docs/glossary.md` marked `TODO(review)`:
- `aturan tak terjangkau`: unreachable rules (Phase 1)
- `aturan tak produktif`: non-productive rules (Phase 2)

---

## 5. Scope & Out-of-Scope Summary
- **In scope**: Replaced old 6 phases with course homework order; replaced Indonesian strings with message keys; updated UI, i18n, presets, tests, and documentation.
- **Out of scope**: No changes to CYK algorithm; no changes to FSM engine or editor; no dependency changes.
- **Notes for future tasks**: Idempotence test in `grammar-text.wasm.test.ts` was clarified: re-running CNF conversion on a grammar that already underwent CNF conversion can further prune variables that became unreachable after unit elimination (since homework order does not append an extra unreachable pass at the end).
