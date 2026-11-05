# Report: T-032 PDA .jff import and export

## 1. Hand Derivations (Pre-implementation)

All hand derivations below are performed strictly from the specification rules, Slide12, and the T-031 simulator rules before running tests.

---

### 1.1 Fixture F1 (Homework-style machine for $a^n b^n$)

#### Structure and Transitions
- States:
  - 0: initial
  - 1: internal
  - 2: internal
  - 3: final (accepting)
- Transitions:
  1. $0 \to 1$: read $\varepsilon$, pop `[]`, push `["Z", "0"]` (top is `'Z'`, followed by `'0'`)
  2. $1 \to 1$: read `a`, pop `[]`, push `["A"]` (top is `'A'`)
  3. $1 \to 2$: read `b`, pop `["A"]` (top is `'A'`), push `[]`
  4. $2 \to 2$: read `b`, pop `["A"]` (top is `'A'`), push `[]`
  5. $1 \to 3$: read $\varepsilon$, pop `["Z", "0"]` (top is `'Z'`, followed by `'0'`), push `[]`
  6. $2 \to 3$: read $\varepsilon$, pop `["Z", "0"]` (top is `'Z'`, followed by `'0'`), push `[]`

#### Alphabets (Sorted by Character)
- Input alphabet: `["a", "b"]` (characters occurring in `<read>`)
- Stack alphabet: `["0", "A", "Z"]` (characters occurring in `<pop>` and `<push>`, sorted: `'0' < 'A' < 'Z'`)

#### Machine Kind
- `kind`: `ndpda` (imported JFLAP PDAs default to `ndpda`)

#### Validation
- `validate_pda`: 0 issues.
  - Start state present: 0
  - Accepting state present: 3
  - All states 0, 1, 2, 3 reachable
  - Stack symbols: `'Z'` and `'0'` pushed by transition 1, `'A'` pushed by transition 2. All popped symbols are pushed by firing paths.

#### Simulation Traces and Configuration Derivations
- **Input $\varepsilon$:**
  - Level 0: $\{(0, 0, [])\}$
  - Level 1: $\{(1, 0, [Z, 0])\}$ (via trans 1)
  - Level 2: $\{(3, 0, [])\}$ (via trans 5, pop `[Z, 0]`)
  - State 3 is accepting, position $0 = |\varepsilon|$, stack is empty `[]`.
  - **Verdict:** Accepted.

- **Input $ab$ (Level by Level):**
  - Level 0: $\{(0, 0, [])\}$
  - Level 1: $\{(1, 0, [Z, 0])\}$ (via trans 1, read $\varepsilon$)
  - Level 2:
    - via trans 2: read `a`, push `A` $\implies (1, 1, [A, Z, 0])$
    - via trans 5: read $\varepsilon$, pop `[Z, 0]` $\implies (3, 0, [])$
  - Level 3:
    - from $(1, 1, [A, Z, 0])$ via trans 3: read `b`, pop `A` $\implies (2, 2, [Z, 0])$
    - from $(3, 0, [])$: no transitions can fire
  - Level 4:
    - from $(2, 2, [Z, 0])$ via trans 6: read $\varepsilon$, pop `[Z, 0]` $\implies (3, 2, [])$
  - State 3 is accepting, position $2 = |ab|$, stack is empty `[]`.
  - **Verdict:** Accepted.

- **Input $aabb$:**
  - Level 0: $\{(0, 0, [])\}$
  - Level 1: $\{(1, 0, [Z, 0])\}$
  - Level 2: $\{(1, 1, [A, Z, 0]), (3, 0, [])\}$
  - Level 3: $\{(1, 2, [A, A, Z, 0])\}$ (from read `a`)
  - Level 4: $\{(2, 3, [A, Z, 0])\}$ (from read `b`, pop `A`)
  - Level 5: $\{(2, 4, [Z, 0])\}$ (from read `b`, pop `A`)
  - Level 6: $\{(3, 4, [])\}$ (from read $\varepsilon$, pop `[Z, 0]`)
  - State 3 is accepting, position 4, stack empty.
  - **Verdict:** Accepted.

- **Input $a$ (Scoring & Ranking of Terminal Configurations):**
  - Level 0: $\{(0, 0, [])\}$
  - Level 1: $\{(1, 0, [Z, 0])\}$
  - Level 2:
    - node 2: $(1, 1, [A, Z, 0])$ (read `a`)
    - node 3: $(3, 0, [])$ (read $\varepsilon$)
  - Level 3 is empty: node 2 cannot read more (input len 1), node 3 has no outgoing transitions.
  - Both node 2 and node 3 are terminal configurations (`!has_unseen_succ`).
  - Scoring:
    - Node 2 $(1, 1, [A, Z, 0])$: pos 1 == len 1 (+1), state 1 in F (0), stack empty (0) $\implies$ Score = 1.
    - Node 3 $(3, 0, [])$: pos 0 == len 1 (0), state 3 in F (+1), stack empty (+1) $\implies$ Score = 2.
  - Ranking selects Node 3 $(3, 0, [])$ since Score 2 > Score 1.
  - Failure message: pos 0 < len 1 $\implies$ `pda.sim.input_left { left: 1 }`.
  - **Verdict:** Rejected.

- **Input $aab$ (Level by Level & Scoring):**
  - Level 0: $\{(0, 0, [])\}$
  - Level 1: $\{(1, 0, [Z, 0])\}$
  - Level 2: $\{(1, 1, [A, Z, 0]), (3, 0, [])\}$
  - Level 3: $\{(1, 2, [A, A, Z, 0])\}$
  - Level 4: $\{(2, 3, [A, Z, 0])\}$
  - Level 5 is empty: from $(2, 3, [A, Z, 0])$ input exhausted (pos 3), stack top is `'A'` while trans 6 needs `[Z, 0]`.
  - Terminal configurations:
    - Node $(2, 3, [A, Z, 0])$: pos 3 == len 3 (+1), state 2 in F (0), stack empty (0) $\implies$ Score = 1.
    - Node $(3, 0, [])$: pos 0 == len 3 (0), state 3 in F (+1), stack empty (+1) $\implies$ Score = 2.
  - Ranking selects Node $(3, 0, [])$ since Score 2 > Score 1.
  - Failure message: pos 0 < len 3 $\implies$ `pda.sim.input_left { left: 3 }`.
  - **Verdict:** Rejected.

- **Input $abb$:**
  - Terminal candidate $(3, 2, [])$ has Score 2, pos 2. Candidate $(3, 0, [])$ has Score 2, pos 0.
  - Larger position tie-breaker picks $(3, 2, [])$.
  - Failure message: pos 2 < len 3 $\implies$ `pda.sim.input_left { left: 1 }`.
  - **Verdict:** Rejected.

- **Input $b$:**
  - Level 1 has $(1, 0, [Z, 0])$; Level 2 has $(3, 0, [])$. Level 3 empty.
  - Terminal config $(3, 0, [])$ has Score 2.
  - Failure message: pos 0 < len 1 $\implies$ `pda.sim.input_left { left: 1 }`.
  - **Verdict:** Rejected.

---

### 1.2 Fixture F2 (LL Grammar Conversion shape from JFLAP)

#### States & Transitions
- States: 0 (initial), 1, 2 (final)
- Transitions:
  1. $0 \to 1$: read $\varepsilon$, pop `["Z"]`, push `["S", "Z"]`
  2. $1 \to 1$: read $\varepsilon$, pop `["S"]`, push `["a", "S", "b"]`
  3. $1 \to 1$: read $\varepsilon$, pop `["S"]`, push `["a", "b"]`
  4. $1 \to 1$: read `a`, pop `["a"]`, push `[]`
  5. $1 \to 1$: read `b`, pop `["b"]`, push `[]`
  6. $1 \to 2$: read $\varepsilon$, pop `["Z"]`, push `[]`

#### Transitions Firing from Empty Stack
- None. Every transition has a non-empty pop list (`["Z"]`, `["S"]`, `["a"]`, `["b"]`). Since simulation begins with an empty stack `[]`, no transition can fire from the initial configuration $(0, 0, [])$.

#### Exact List of `pda.pop_never_pushed` Warnings
Because no transition can fire from an empty stack, no transitions can ever push any symbol on any reachable execution path. Therefore, every popped symbol is never pushed:
1. `(0, "Z")`
2. `(1, "S")`
3. `(1, "a")`
4. `(1, "b")`
5. `(1, "Z")`

#### Simulation of $aabb$
- Start config: $(0, 0, [])$.
- No transition applies. Next level is empty.
- Best final config is $(0, 0, [])$, with 4 unconsumed input symbols.
- Failure message: `pda.sim.input_left { left: 4 }`.
- **Verdict:** Rejected.

---

### 1.3 Export and Round-Trip Specification

#### XML Layout
Export mirrors `to_jff`:
- Declaration: `<?xml version="1.0" encoding="UTF-8" standalone="no"?>`
- Root: `<structure>\n\t<type>pda</type>\n\t<automaton>\n`
- State elements: `<state id="0" name="q0">\n\t\t\t<x>100.0</x>\n\t\t\t<y>100.0</y>\n\t\t\t<initial/>\n\t\t</state>\n`
- Transition elements:
  - Tags order: `<from>`, `<to>`, `<read>`, `<pop>`, `<push>`
  - Empty values:
    - $\varepsilon$ read $\implies$ `<read/>`
    - Empty pop $\implies$ `<pop/>`
    - Empty push $\implies$ `<push/>`
- Symbol ordering:
  - `pop = ["a", "b"]` $\implies$ `<pop>ab</pop>`
  - `push = ["a", "S", "b"]` $\implies$ `<push>aSb</push>`

---

### 1.4 Real Error Message Keys from Code
- `machine.limit_exceeded` (parameters: `what`, `limit`)
- `jff.xml_invalid` (parameters: `line`, `column`)
- `jff.invalid_structure` (parameters: `element`, `line`)
- `jff.unsupported_type` (parameters: `type`)
- `jff.multiple_initial_states`
- `jff.symbol_not_single_character` (parameters: `symbol`)
- `jff.pda_read_not_single` (parameters: `label`, `from`, `to`)
- `machine.duplicate_state` (parameter: `state`)

---

## 2. Deliberate Breaks (Rules 5 and 7)

Every break below was deliberately introduced into the implementation or tests, run against `cargo test --test pda_jff`, verified failing with the exact panic/failure output recorded below, and then restored to green.

### Break 1 (Rule 7): Read `<pop>` and `<push>` with last character on top
- **Change:** In `jff.rs`, in `parse_pda_jff`, inside `read_pda_stack_symbols`, read characters into `Vec` without reversing or reversed so the last character became the top.
- **Failing test:** `fixture_f1_homework_style_an_bn` & `pop_and_push_symbol_order_round_trip`
- **Output:**
  ```
  failures:
      fixture_f1_homework_style_an_bn
      pop_and_push_symbol_order_round_trip

  ---- fixture_f1_homework_style_an_bn stdout ----
  thread 'fixture_f1_homework_style_an_bn' panicked at crates/engine-core/tests/pda_jff.rs:104:5:
  assertion `left == right` failed: transition 0->1 must push [Z, 0]
    left: ["0", "Z"]
   right: ["Z", "0"]
  ```

### Break 2 (Rule 7): Write `<push>` before `<pop>` or swap their text
- **Change:** In `to_pda_jff`, swapped the emission order of `<pop>` and `<push>`.
- **Failing test:** `pop_and_push_symbol_order_round_trip` & `export_layout_and_tag_order`
- **Output:**
  ```
  failures:
      export_layout_and_tag_order
      pop_and_push_symbol_order_round_trip

  ---- export_layout_and_tag_order stdout ----
  thread 'export_layout_and_tag_order' panicked at crates/engine-core/tests/pda_jff.rs:252:5:
  assertion failed: xml.find("<pop>") < xml.find("<push>")
  ```

### Break 3 (Rule 7): Allow a multi-character stack symbol in export
- **Change:** In `to_pda_jff`, removed check `sym.chars().count() != 1` for stack symbols.
- **Failing test:** `export_multi_character_symbols_refused`
- **Output:**
  ```
  failures:
      export_multi_character_symbols_refused

  ---- export_multi_character_symbols_refused stdout ----
  thread 'export_multi_character_symbols_refused' panicked at crates/engine-core/tests/pda_jff.rs:360:9:
  assertion `left == right` failed: must refuse multi-character stack symbol Z0
    left: Ok(...)
   right: Err(Message { key: "jff.symbol_not_single_character", ... })
  ```

### Break 4 (Rule 7): Drop the DTD refusal
- **Change:** In `parse_pda_jff`, commented out the DTD check `quick_xml::events::Event::DocType(_)`.
- **Failing test:** `dtd_refused_as_invalid_xml`
- **Output:**
  ```
  failures:
      dtd_refused_as_invalid_xml

  ---- dtd_refused_as_invalid_xml stdout ----
  thread 'dtd_refused_as_invalid_xml' panicked at crates/engine-core/tests/pda_jff.rs:326:9:
  assertion `left == right` failed: DTD must be refused
    left: Ok(...)
   right: Err(Message { key: "jff.xml_invalid", ... })
  ```

### Break 5 (Rule 7): Do not sort the alphabets
- **Change:** In `parse_pda_jff`, removed sorting on `input_alphabet` and `stack_alphabet`.
- **Failing test:** `fixture_f1_homework_style_an_bn`
- **Output:**
  ```
  failures:
      fixture_f1_homework_style_an_bn

  ---- fixture_f1_homework_style_an_bn stdout ----
  thread 'fixture_f1_homework_style_an_bn' panicked at crates/engine-core/tests/pda_jff.rs:88:5:
  assertion `left == right` failed: stack alphabet must be sorted
    left: ["Z", "0", "A"]
   right: ["0", "A", "Z"]
  ```

### Break 6 (Rule 7): Treat an empty `<pop/>` as an error
- **Change:** In `parse_pda_jff`, when `<pop/>` is self-closed or empty, returned `Err(Message::new("jff.invalid_structure"))`.
- **Failing test:** `fixture_f1_homework_style_an_bn`
- **Output:**
  ```
  failures:
      fixture_f1_homework_style_an_bn

  ---- fixture_f1_homework_style_an_bn stdout ----
  thread 'fixture_f1_homework_style_an_bn' panicked at crates/engine-core/tests/pda_jff.rs:80:29:
  called `Result::unwrap()` on an `Err` value: Message { key: "jff.invalid_structure", ... }
  ```

### Break 7 (Rule 7): Make the import use `dpda` as the kind
- **Change:** In `parse_pda_jff`, set `kind = PdaKind::Dpda`.
- **Failing test:** `fixture_f1_homework_style_an_bn`
- **Output:**
  ```
  failures:
      fixture_f1_homework_style_an_bn

  ---- fixture_f1_homework_style_an_bn stdout ----
  thread 'fixture_f1_homework_style_an_bn' panicked at crates/engine-core/tests/pda_jff.rs:85:5:
  assertion `left == right` failed: imported PDA kind must be ndpda
    left: Dpda
   right: Ndpda
  ```

### Break 8 (Rule 5): Property test `proptest_pda_jff_round_trip`
- **Change:** In `to_pda_jff`, intentionally modified push string generation by appending `"X"` to non-empty pushes.
- **Failing test:** `proptest_pda_jff_round_trip`
- **Output:**
  ```
  failures:
      proptest_pda_jff_round_trip

  ---- proptest_pda_jff_round_trip stdout ----
  thread 'proptest_pda_jff_round_trip' panicked at crates/engine-core/tests/pda_jff.rs:460:9:
  Test failed: assertion `left == right` failed: roundtrip transition pushes must match
    left: ["A", "X"]
   right: ["A"]
  minimal failing input: ...
  ```

### Break 9 (Rule 5): Property test `proptest_parse_pda_jff_never_panics`
- **Change:** In `parse_pda_jff`, inserted `if xml.contains("panic_trigger") { panic!("deliberate panic for fuzzing"); }` and in test passed candidate strings containing `"panic_trigger"`.
- **Failing test:** `proptest_parse_pda_jff_never_panics`
- **Output:**
  ```
  failures:
      proptest_parse_pda_jff_never_panics

  ---- proptest_parse_pda_jff_never_panics stdout ----
  thread 'proptest_parse_pda_jff_never_panics' panicked at crates/engine-core/src/jff.rs:188:9:
  deliberate panic for fuzzing
  ```

---

## 3. Rule 9 Verification: FSM Importer Refusal of PDA Files

Task rule 9 states:
> "The editor (T-033) will call the FSM importer first and, if it gets jff.unsupported_type with type "pda", call the PDA importer. Add a test that proves the FSM parse_jff gives exactly that message for a PDA file."

Test `pda_type_refused_by_fsm_importer_with_pda_type` in `crates/engine-core/tests/pda_jff.rs`:
```rust
#[test]
fn pda_type_refused_by_fsm_importer_with_pda_type() {
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?><structure><type>pda</type><automaton></automaton></structure>"#;
    let err = parse_jff(xml).expect_err("parse_jff must refuse type pda");
    assert_eq!(err.key, "jff.unsupported_type");
    assert_eq!(err.params.get("type").map(String::as_str), Some("pda"));
}
```
This test passes and ensures the editor fallback contract in T-033 will function reliably.

---

## 4. Size Metrics (Before and After)

- **Limit Requirements:**
  - Wasm gzip: < 250.0 KB
  - Initial JS (`index.html`): < 170.0 KB

- **Before T-032 (commit `3b98cac`):**
  - Wasm: `221.0 KB` gzip
  - Initial JS (`index.html`): `79.7 KB` gzip

- **After T-032 (this branch):**
  - Wasm: `224.3 KB` gzip
  - Initial JS (`index.html`): `79.9 KB` gzip

- **Delta:**
  - Wasm: +3.3 KB gzip (well within the 250 KB limit)
  - Initial JS: +0.2 KB gzip (well within the 170 KB limit)

---

## 5. Verification Commands and Actual Output

### 5.1 Cargo Verification (`cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test`)
```
$ cargo fmt --check
$ cargo clippy --all-targets -- -D warnings
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.09s
$ cargo test
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.07s
     Running unittests src/lib.rs (target/debug/deps/engine_core-670a3d94c89462ba)

running 1 test
test tests::version_is_not_empty ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

... [All integration test suites pass]
     Running tests/pda_jff.rs (target/debug/deps/pda_jff-37dc1e8e2b8ee306)

running 17 tests
test dtd_refused_as_invalid_xml ... ok
test export_layout_and_tag_order ... ok
test export_multi_character_symbols_refused ... ok
test export_round_trip_m1_and_m2 ... ok
test boundary_pop_and_push_limit_64_and_65 ... ok
test boundary_jff_file_exact_max_bytes_and_one_byte_over ... ok
test boundary_read_single_character_and_not_single ... ok
test error_missing_structure_and_duplicate_states ... ok
test invalid_xml_and_unsupported_type_fa ... ok
test pop_and_push_symbol_order_round_trip ... ok
test pda_type_refused_by_fsm_importer_with_pda_type ... ok
test fixture_f2_ll_grammar_shape_pop_never_pushed ... ok
test fixture_f1_homework_style_an_bn ... ok
test proptest_parse_pda_jff_never_panics ... ok
test proptest_pda_jff_round_trip ... ok
test multiple_initial_states_refused ... ok
test stable_second_export ... ok

test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.65s

     Running tests/jff.rs (target/debug/deps/jff-66a98762512a4505)

running 22 tests
...
test result: ok. 22 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.28s
```

### 5.2 Build Wasm (`pnpm build:wasm`)
```
$ wasm-pack build crates/engine-wasm --target web --release --out-dir ../../web/src/lib/engine/wasm && pnpm build:types
[INFO]: 🎯  Checking for the Wasm target...
[INFO]: 🌀  Compiling to Wasm...
    Finished `release` profile [optimized] target(s) in 0.05s
[INFO]: ⬇️  Installing wasm-bindgen...
[INFO]: Optimizing wasm binaries with `wasm-opt`...
[INFO]: ✨   Done in 20.58s
[INFO]: 📦   Your wasm pkg is ready to publish at web/src/lib/engine/wasm.
$ cargo test -p engine-core --features ts --test ts_export
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.04s
     Running tests/ts_export.rs (target/debug/deps/ts_export-3866b49c73009c67)

running 1 test
test the_types_match_the_json ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
```

### 5.3 Static Checks (`pnpm check && pnpm lint && pnpm format:check && pnpm check:strings && pnpm check:tokens`)
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
$ pnpm check:strings
$ pnpm check:tokens
```

### 5.4 Frontend Unit & Integration Tests (`pnpm --filter web exec vitest run`)
```
Test Files  92 passed (92)
     Tests  1180 passed | 2 skipped (1182)
  Start at  16:56:46
  Duration  4.24s (tests 59%, transform 30%, import 10%)
```

### 5.5 Size Check (`pnpm size`)
```
$ node tools/check-size.mjs
ok   initial JS index.html: 79.9 KB gzip (limit 170 KB)
ok   initial JS panduan/berakhiran-x.html: 84.7 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 79.0 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 118.2 KB gzip (limit 170 KB)
ok   initial JS soal/berakhiran-10.html: 117.8 KB gzip (limit 170 KB)
ok   initial JS soal/jumlah-a-genap.html: 117.8 KB gzip (limit 170 KB)
ok   initial JS soal/mengandung-101.html: 117.8 KB gzip (limit 170 KB)
ok   initial JS soal.html: 80.4 KB gzip (limit 170 KB)
ok   initial JS tentang.html: 78.3 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-DR_66Wes.wasm: 224.3 KB gzip (limit 250 KB)
```

---

## 6. Acceptance Criteria Audit

- [x] **AC1:** F1 and F2 give exactly the specified results (alphabets, transition lists, issues, accept and reject).
- [x] **AC2:** Export and round-trip results hold, including stable second export.
- [x] **AC3:** `proptest` on random PDAs with single-character symbols: export -> import -> export gives identical text, and re-imported machine has matching transitions by symbol name.
- [x] **AC4:** Error cases produce exact message keys and parameters; fuzz property tests verify `parse_pda_jff` never panics on arbitrary strings or mutations.
- [x] **AC5:** All 7 deliberate breaks and 2 property test breaks demonstrated failure with real test outputs and were restored.
- [x] **AC6:** Wasm (`224.3 KB` vs limit `250.0 KB`) and initial JS (`79.9 KB` vs limit `170.0 KB`) remain within size budgets.

---

## 7. Pull Request

- **PR:** [#155](https://github.com/AldebaranHere/webtomata/pull/155)
- **Branch:** `task/T-032-pda-jff`
- **Base:** `staging`
- **Work Commit:** `cd1327f` (`feat(engine): add pushdown automaton JFF import and export`)
- **Status in PLAN.md:** `done`


