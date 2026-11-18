# T-079 — The five `clippy::needless_range_loop` lints of clippy 1.100.0

Branch `task/T-079-clippy-range-loops`, cut from `origin/staging` at `1271d15`. Status: `done`.

PR 217 (T-076) had one red check: the `rust` job, `cargo clippy --all-targets -- -D warnings`, because the
channel `stable` on the runner is clippy 1.100.0 and this code was written under 1.99.1. The job showed two
lints; fixing the lib let the same job reach a test file with three more. All five are mechanical rewrites:
no behaviour, order, value or public API changed, no `#[allow]`, no lint configuration change, and
`rust-toolchain.toml` is untouched.

**The toolchain, in one sentence.** `rust-toolchain.toml` sets `channel = "stable"` (no version), and the CI
step `rustup show active-toolchain || rustup toolchain install` syncs whatever stable is current — 1.100.0 at
the run of PR 217 (`clippy 0.1.100 (0ef1bc3860 2026-11-09)`), while the local stable was 1.99.1, which is
why the lint was invisible here until 1.100.0 was installed for this proof.

## 1. The two lints of the `rust` job, and their fix

`cargo +1.100.0 clippy --all-targets -- -D warnings`, **before** (the two errors the job showed, and
nothing else in the lib):

```
error: the loop variable `j` is used to index `pda.transitions`
   --> crates/engine-core/src/pda.rs:323:18
323 |         for j in (i + 1)..n {
note: for this index operation
324 |             let t2 = &pda.transitions[j];

error: the loop variable `i` is only used to index `t.pop`
   --> crates/engine-core/src/pda_rnf.rs:160:22
160 |             for i in 0..(n - 1) {
note: for this index operation
181 |                     pop: vec![t.pop[i]],

error: could not compile `engine-core` (lib) due to 2 previous errors
```

**Loop 1 — `crates/engine-core/src/pda.rs`, `determinism`.** The outer `i` stays a counter: it is used for
its value (`first: i`), not only to index. The inner loop walks the same vector it indexed.

```diff
     for i in 0..n {
         let t1 = &pda.transitions[i];
-        for j in (i + 1)..n {
-            let t2 = &pda.transitions[j];
+        for (j, t2) in pda.transitions.iter().enumerate().skip(i + 1) {
             if t1.from != t2.from {
                 break;
```

`j` takes `i + 1, i + 2, …, n - 1` in that order, so `second: j` and the order of `competitions` are the
same, and the `break` on a different `from` still ends the inner loop at the first such pair. Both borrows
are shared, so `t1` and the iterator coexist.

**Loop 2 — `crates/engine-core/src/pda_rnf.rs`, `pda_to_rnf`, the multi-pop split (Step 4).** `i` existed
only to read `t.pop[i]`; `n` stays in use (`with_capacity(n)`, `t.pop[n - 1]`, `pops: n as u32`).

```diff
             let mut prev_state = t.from;
-            for i in 0..(n - 1) {
+            for &pop_symbol in t.pop.iter().take(n - 1) {
                 let v_id = next_v_id;
                 …
                 let trans = PdaTransition {
                     from: prev_state,
                     read: None,
-                    pop: vec![t.pop[i]],
+                    pop: vec![pop_symbol],
                     push: Vec::new(),
                     to: v_state,
                 };
```

`take(n - 1)` gives the same symbols in the same order as `0..(n - 1)`; `SymbolId` is `Copy`
(`crates/engine-core/src/fsm.rs:20`), so `&pop_symbol` copies. The new states, `next_v_id`, `v_counter`,
the `MAX_STATES` check and the emitted wires are untouched.

## 2. The three lints in `crates/engine-core/tests/pda_cfg.rs` (the one allowed test edit)

With the lib fixed, `--all-targets` reached the tests and stopped:

```
error: the loop variable `idx` is only used to index `res.steps`
   --> crates/engine-core/tests/pda_cfg.rs:336:16   (for idx in 2..8;   index at 344)
error: the loop variable `idx` is only used to index `res.steps`
   --> crates/engine-core/tests/pda_cfg.rs:361:16   (for idx in 8..11;  index at 369)
error: the loop variable `idx` is only used to index `res.steps`
   --> crates/engine-core/tests/pda_cfg.rs:405:16   (for idx in 12..14; index at 412)
error: could not compile `engine-core` (test "pda_cfg") due to 3 previous errors
```

No assertion or comment in the three loops mentions `idx`, so no `.enumerate()` is needed: each loop
becomes a walk over the slice it indexed, `take(b).skip(a)` for the range `a..b`.

```diff
     // Steps 2..8: six 0->0 double pushes (each 9 rules).
-    for idx in 2..8 {
+    for step in res.steps.iter().take(8).skip(2) {
         assert_eq!(
-            res.steps[idx].message,
+            step.message,
             Message::new("pda_cfg.push")
                 .with("from", 0u32)
                 .with("to", 0u32)
                 .with("pushes", 2usize)
         );
-        assert_eq!(res.steps[idx].added.len(), 9);
+        assert_eq!(step.added.len(), 9);
     }
```

```diff
     // Steps 8..11: three 0->1 single pushes reading c (each 3 rules).
-    for idx in 8..11 {
+    for step in res.steps.iter().take(11).skip(8) {
         assert_eq!(
-            res.steps[idx].message,
+            step.message,
             Message::new("pda_cfg.push")
                 .with("from", 0u32)
                 .with("to", 1u32)
                 .with("pushes", 1usize)
         );
-        assert_eq!(res.steps[idx].added.len(), 3);
+        assert_eq!(step.added.len(), 3);
     }
```

```diff
     // Steps 12..14: 1->1 reading a and b (push_none).
-    for idx in 12..14 {
+    for step in res.steps.iter().take(14).skip(12) {
         assert_eq!(
-            res.steps[idx].message,
+            step.message,
             Message::new("pda_cfg.push_none")
                 .with("from", 1u32)
                 .with("to", 1u32)
         );
-        assert_eq!(res.steps[idx].added.len(), 3);
+        assert_eq!(step.added.len(), 3);
     }
```

**The number of assertions that run is the same: 6 assertion statements, 22 assertion executions before and
after** (loop 1 runs 6 times, loop 2 three times, loop 3 twice — `6×2 + 3×2 + 2×2 = 22`).

## 3. Verification

**Clippy 1.100.0, `--all-targets`, after the five rewrites — clean:**

```
$ cargo +1.100.0 clippy --all-targets -- -D warnings
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.06s      (exit 0)
```

Because that was a cached run, the changed test target was forced once more:

```
$ touch crates/engine-core/tests/pda_cfg.rs && cargo +1.100.0 clippy --test pda_cfg -- -D warnings
    Checking engine-core v0.0.0 (…/crates/engine-core)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.17s      (exit 0)
```

No fourth lint appeared in any other target; five loops in total, under the ceiling of ten.

**The rest of the gate:**

```
$ cargo test
    test result: ok. …  (35 test binaries)   passed: 478   failed: 0      (exit 0)

$ pnpm build:wasm && pnpm test:wasm
    test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out

$ pnpm --filter web exec vitest run src/lib/editor/pda-determinism.wasm.test.ts
 Test Files  1 passed (1)
      Tests  5 passed (5)

$ cargo +1.100.0 fmt --check
    (clean)

$ cargo clippy --all-targets -- -D warnings          # the old 1.99.1 toolchain
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 2.27s      (exit 0)

$ pnpm lint:rust
$ cargo fmt --check && cargo clippy --all-targets -- -D warnings
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.09s
```

**Why behaviour is unchanged.** The two functions are pinned by existing tests that pass unedited:
`crates/engine-core/tests/pda_validate.rs:33-96` asserts the exact `Competition` list from `determinism`,
including `first`/`second` and the order; `crates/engine-core/tests/pda_rnf.rs` asserts the exact
`RnfStep` order, e.g. "Transitions in split: 0->4 (eps, pop X), 4->5 (eps, pop Y), 5->1 (read a, pop Z,
push W)"; and the three rewritten test loops assert the same steps, messages and rule counts as before.

## 4. What was not run, and what was not changed

- Not run: the e2e suite, Lighthouse, the web build and the sizes. This change touches no web code and no
  size; the CI runs them.
- Not changed: no dependency, no lint rule or configuration, no `#[allow]`, no `rust-toolchain.toml`. The
  1.100.0 toolchain was installed only to reproduce and prove the fix, as the owner approved.
- The pin question (`stable` versus a version) is the owner's and is not decided here.
