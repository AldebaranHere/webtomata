# Report: T-031 PDA simulation: breadth-first, stack trace, peak configurations

## 1. Hand Derivations

The user required hand derivations recorded in `REPORT.md` before any test runs for:
1. **Machine M1** ($a^n b^n, n \ge 0$) on $\varepsilon$, $ab$, $aabb$, $a$, $aab$, $b$, and $abb$.
2. **Machine M2** ($w w^R$ over $\{a, b\}$) on $aa$ and $ab$, level by level, with peak numbers.
3. **Loop machines**:
   - The no-change loop: $(0, \varepsilon, [] \to [], 0)$ with no accepting state on input $\varepsilon$.
   - The stack-growing loop: $(0, \varepsilon, [] \to [x], 0)$ on input $\varepsilon$ under each of the three budgets (`maxStack: 5`, `maxSteps: 3`, `maxConfigurations: 3`).

All derivations below are performed strictly from the semantics in the task and Slide12, then compared with the planner's numbers.

---

### Machine Definitions and Canonical Transition Order

#### Machine M1 (DPDA for $a^n b^n$)
- Input alphabet: $\Sigma = \{a, b\}$
- Stack alphabet: $\Gamma = \{a\}$
- States: $\{0, 1\}$
- Start state: $0$
- Accepting states: $\{0, 1\}$
- Sorted canonical transitions:
  - Index 0: `(0, a, [] → [a], 0)`
  - Index 1: `(0, b, [a] → [], 1)`
  - Index 2: `(1, b, [a] → [], 1)`

#### Machine M2 (NDPDA for $w w^R$)
- Input alphabet: $\Sigma = \{a, b\}$
- Stack alphabet: $\Gamma = \{a, b\}$
- States: $\{0, 1\}$
- Start state: $0$
- Accepting states: $\{1\}$
- Sorted canonical transitions:
  - Index 0: `(0, ε, [] → [], 1)`
  - Index 1: `(0, a, [] → [a], 0)`
  - Index 2: `(0, b, [] → [b], 0)`
  - Index 3: `(1, a, [a] → [], 1)`
  - Index 4: `(1, b, [b] → [], 1)`

---

### Machine M1 Derivations

Semantics check: A configuration is $(q, i, s)$, where $i$ is consumed input count, $s$ is stack (top first). Acceptance requires $q \in F \land i = |w| \land s = []$.

1. **Input $\varepsilon$ ($|w| = 0$):**
   - Level 0: `[(0, 0, [])]`.
   - Acceptance check: $0 \in \{0, 1\}$, $i = 0 = 0$, $s = []$ (empty).
   - **Result**: `Finished { accepted: true }`.
   - Trace (1 step):
     - Step 0: `position: 0, symbol: None, transition: None, state: 0, stack: [], message: pda.sim.accepted`.
   - Level sizes: `[1]`. `peak_configurations`: 1.
   - Planner comparison: Matches planner (`ε accepted`, `peak_configurations = 1`).

2. **Input $ab$ ($|w| = 2$):**
   - Level 0: `[(0, 0, [])]`. Not accepted ($i = 0 \ne 2$).
     - Transition Index 0 (`a`-push): applies ($w[0] = a$). Yields `(0, 1, [a])`.
   - Level 1: `[(0, 1, [a])]`. Not accepted ($i = 1 \ne 2$).
     - Transition Index 1 (`b`-pop): applies ($w[1] = b$, top is $a$). Yields `(1, 2, [])`.
   - Level 2: `[(1, 2, [])]`.
     - Acceptance check: $1 \in \{0, 1\}$, $i = 2 = 2$, $s = []$.
   - **Result**: `Finished { accepted: true }`.
   - Trace (3 steps):
     - Step 0: `(0, 0, [])`, sym: None, trans: None, msg: `pda.sim.start`
     - Step 1: `(0, 1, [a])`, sym: Some("a"), trans: 0, msg: `pda.sim.move`
     - Step 2: `(1, 2, [])`, sym: Some("b"), trans: 1, msg: `pda.sim.accepted`
   - Level sizes: `[1, 1, 1]`. `peak_configurations`: 1.
   - Planner comparison: Matches planner (`ab accepted`, `peak_configurations = 1`).

3. **Input $aabb$ ($|w| = 4$):**
   - Level 0: `[(0, 0, [])]`
   - Level 1: `[(0, 1, [a])]` (via Index 0)
   - Level 2: `[(0, 2, [a, a])]` (via Index 0)
   - Level 3: `[(1, 3, [a])]` (via Index 1)
   - Level 4: `[(1, 4, [])]` (via Index 2) -> Accepted ($1 \in F, i = 4 = 4, s = []$).
   - **Result**: `Finished { accepted: true }`.
   - Trace (5 steps). Level sizes: `[1, 1, 1, 1, 1]`. `peak_configurations`: 1.
   - Planner comparison: Matches planner (`aabb accepted`, `peak_configurations = 1`).

4. **Input $a$ ($|w| = 1$):**
   - Level 0: `[(0, 0, [])]`
   - Level 1: `[(0, 1, [a])]` (via Index 0)
   - From `(0, 1, [a])`: $i = 1 = |w|$, no transitions can fire. Level 2 is empty.
   - **Result**: `Finished { accepted: false }`.
   - Final configuration evaluation:
     - Only final config: `(0, 1, [a])`.
     - Condition 1 (input used up): True ($i = 1 = 1$).
     - Condition 2 (accepting state): True ($0 \in F$).
     - Condition 3 (stack empty): False ($s = [a]$, depth 1).
     - Score: 2 conditions met.
     - Failure message priority:
       1. `input_left`: false ($i = 1$)
       2. `not_accepting_state`: false ($0 \in F$)
       3. `stack_not_empty`: true! $\implies$ `pda.sim.stack_not_empty { depth: 1 }`.
   - Trace (2 steps): ends at `(0, 1, [a])` with `pda.sim.stack_not_empty { depth: 1 }`.
   - `peak_configurations`: 1.
   - Planner comparison: Matches planner (`a rejected, last message stack_not_empty (depth 1)`).

5. **Input $aab$ ($|w| = 3$):**
   - Level 0: `[(0, 0, [])]`
   - Level 1: `[(0, 1, [a])]` (via Index 0)
   - Level 2: `[(0, 2, [a, a])]` (via Index 0)
   - Level 3: `[(1, 3, [a])]` (via Index 1)
   - From `(1, 3, [a])`: $i = 3 = |w|$, no moves. Level 4 is empty.
   - **Result**: `Finished { accepted: false }`.
   - Final config: `(1, 3, [a])`.
     - Input used up: True ($i = 3 = 3$).
     - Accepting state: True ($1 \in F$).
     - Stack empty: False ($s = [a]$, depth 1).
     - Failure message: `pda.sim.stack_not_empty { depth: 1 }`.
   - Trace (4 steps). `peak_configurations`: 1.
   - Planner comparison: Matches planner (`aab rejected, stack_not_empty (state 1, stack [a])`).

6. **Input $b$ ($|w| = 1$):**
   - Level 0: `[(0, 0, [])]`.
     - Index 0 reads $a \ne b$.
     - Index 1 reads $b$, but pops $[a]$ while stack is $[]$ (not prefix).
     - Index 2 from state 1.
     - Level 1 is empty.
   - **Result**: `Finished { accepted: false }`.
   - Final config: `(0, 0, [])`.
     - Input used up: False ($i = 0 < 1$, left: 1).
     - Accepting state: True ($0 \in F$).
     - Stack empty: True ($s = []$).
     - Score: 2 conditions met.
     - Failure message: priority 1 is `input_left` $\implies$ `pda.sim.input_left { left: 1 }`.
   - Trace (1 step): `(0, 0, [])` with `pda.sim.input_left { left: 1 }`.
   - `peak_configurations`: 1.
   - Planner comparison: Matches planner (`b rejected, input_left (left 1; nothing can fire on the first configuration)`).

7. **Input $abb$ ($|w| = 3$):**
   - Level 0: `[(0, 0, [])]`
   - Level 1: `[(0, 1, [a])]` (via Index 0)
   - Level 2: `[(1, 2, [])]` (via Index 1)
   - From `(1, 2, [])`: next symbol is $w[2] = b$. Transition Index 2 pops $[a]$, but stack is empty! No moves. Level 3 is empty.
   - **Result**: `Finished { accepted: false }`.
   - Final config: `(1, 2, [])`.
     - Input used up: False ($i = 2 < 3$, left: 1).
     - Accepting state: True ($1 \in F$).
     - Stack empty: True ($s = []$).
     - Score: 2 conditions met.
     - Failure message: `pda.sim.input_left { left: 1 }`.
   - Trace (3 steps): ends at `(1, 2, [])` with `pda.sim.input_left { left: 1 }`.
   - `peak_configurations`: 1.
   - Planner comparison: Matches planner (`abb rejected, input_left (left 1: the best configuration is (1, 2, []))`).

---

### Machine M2 Derivations (Level by Level)

1. **Input $aa$ ($|w| = 2$):**
   - **Level 0**: `[(0, 0, [])]`. Size = 1.
     - State 0 not accepting ($0 \notin \{1\}$).
     - Expansions from `(0, 0, [])` (transitions in sorted order):
       - Index 0: `(0, ε, [] → [], 1)` applies $\implies$ `(1, 0, [])`.
       - Index 1: `(0, a, [] → [a], 0)` applies ($w[0] = a$) $\implies$ `(0, 1, [a])`.
       - Index 2: `(0, b, ...)` does not match $a$.
   - **Level 1**: `[(1, 0, []), (0, 1, [a])]`. Size = 2.
     - Check acceptance: `(1, 0, [])` has $i = 0 \ne 2$; `(0, 1, [a])` has $0 \notin F$. Neither accepted.
     - Expansions:
       - From `(1, 0, [])`: state 1 transitions require pop $[a]$ or $[b]$, stack is empty $\implies$ no moves.
       - From `(0, 1, [a])`:
         - Index 0: `(0, ε, [] → [], 1)` applies $\implies$ `(1, 1, [a])`.
         - Index 1: `(0, a, [] → [a], 0)` applies ($w[1] = a$) $\implies$ `(0, 2, [a, a])`.
   - **Level 2**: `[(1, 1, [a]), (0, 2, [a, a])]`. Size = 2.
     - Check acceptance: `(1, 1, [a])` has $i = 1 \ne 2$; `(0, 2, [a, a])` has $0 \notin F$. Neither accepted.
     - Expansions:
       - From `(1, 1, [a])`:
         - Index 3: `(1, a, [a] → [], 1)` applies ($w[1] = a$, pop $[a]$ matches) $\implies$ `(1, 2, [])`.
       - From `(0, 2, [a, a])`:
         - Index 0: `(0, ε, [] → [], 1)` applies $\implies$ `(1, 2, [a, a])`.
   - **Level 3**:
     - Evaluates `(1, 2, [])`:
       - State $1 \in F$, $i = 2 = |w|$, stack is empty $[]$!
       - **Accepted!**
   - **Peak configurations**:
     - Level 0: 1, Level 1: 2, Level 2: 2, Level 3: 2 (or 1 if stopped at first accept). Peak = 2.
   - **Trace**:
     - Follow parent pointers back from `(1, 2, [])`:
       - Step 0: `(0, 0, [])`, sym: None, trans: None, state: 0, stack: `[]`, msg: `pda.sim.start`
       - Step 1: `(0, 1, [a])`, sym: Some("a"), trans: 1, state: 0, stack: `[a]`, msg: `pda.sim.move`
       - Step 2: `(1, 1, [a])`, sym: None, trans: 0, state: 1, stack: `[a]`, msg: `pda.sim.move`
       - Step 3: `(1, 2, [])`, sym: Some("a"), trans: 3, state: 1, stack: `[]`, msg: `pda.sim.accepted`
     - Total 4 steps. Transitions used: $a$-push (Index 1), $\varepsilon$ (Index 0), $a$-pop (Index 3).
   - Planner comparison: Matches planner (`level 0 {(0,0,[])}; level 1 {(0,1,[a]), (1,0,[])}; level 2 {(0,2,[a,a]), (1,1,[a])}; level 3 reaches (1,2,[]) accepted; peak_configurations = 2; trace 4 steps`).

2. **Input $ab$ ($|w| = 2$):**
   - **Level 0**: `[(0, 0, [])]`. Size = 1.
     - Transitions fire: Index 0 ($\varepsilon \to 1$), Index 1 ($a \to 0$).
   - **Level 1**: `[(1, 0, []), (0, 1, [a])]`. Size = 2.
     - From `(1, 0, [])`: stack empty $\implies$ 0 moves.
     - From `(0, 1, [a])`:
       - Index 0 ($\varepsilon \to 1$): `(1, 1, [a])`.
       - Index 2 ($b \to 0$, $w[1] = b$): `(0, 2, [b, a])` (pushing $b$ onto $[a]$ leaves $b$ on top).
   - **Level 2**: `[(1, 1, [a]), (0, 2, [b, a])]`. Size = 2.
     - From `(1, 1, [a])`: next symbol $w[1] = b$, but Index 4 requires pop $[b]$ while top is $a$ $\implies$ 0 moves.
     - From `(0, 2, [b, a])`: $i = 2 = |w|$, so input transitions cannot fire. Index 0 ($\varepsilon \to 1$) fires $\implies$ `(1, 2, [b, a])`.
   - **Level 3**: `[(1, 2, [b, a])]`. Size = 1.
     - From `(1, 2, [b, a])`: $i = 2 = |w|$, state 1 has no $\varepsilon$-transitions $\implies$ 0 moves.
   - **Level 4**: Empty `[]`.
   - **Result**: `Finished { accepted: false }`.
   - **Best final configuration selection**:
     - Final configurations (no outgoing moves leading to new configs):
       - $C_A = (1, 0, [])$: $i = 0 < 2$ (False), $1 \in F$ (True), stack empty (True). Score = 2. Position = 0.
       - $C_B = (1, 1, [a])$: $i = 1 < 2$ (False), $1 \in F$ (True), stack empty (False). Score = 1. Position = 1.
       - $C_C = (1, 2, [b, a])$: $i = 2 = 2$ (True), $1 \in F$ (True), stack empty (False). Score = 2. Position = 2.
     - Ranking: $C_A$ and $C_C$ both have score 2. Tie-break by position: $C_C$ has position 2 > position 0 of $C_A$.
     - Winner: $C_C = (1, 2, [b, a])$.
     - Failure message priority:
       1. `input_left`: false ($i = 2 = |w|$)
       2. `not_accepting_state`: false ($1 \in F$)
       3. `stack_not_empty`: true! Depth = 2 $\implies$ `pda.sim.stack_not_empty { depth: 2 }`.
   - **Levels hold sizes**: `[1, 2, 2, 1]`. `peak_configurations`: 2.
   - Trace ends at `(1, 2, [b, a])` with message `pda.sim.stack_not_empty { depth: 2 }`.
   - Planner comparison: Matches planner (`levels hold 1, 2, 2, 1; peak_configurations = 2; trace ends at (1,2,[b,a]) with stack_not_empty { depth: 2 }`).

---

### Loop Machine Derivations

#### 1. No-change Loop
- Machine: State 0, start 0, accepting: `[]` (none).
- Transitions: `(0, ε, [] → [], 0)`.
- Input: $\varepsilon$.
- Trace:
  - Level 0: `[(0, 0, [])]`. Not accepting.
  - Successors of `(0, 0, [])`: transition Index 0 yields `(0, 0, [])`.
  - Repeat check: `(0, 0, [])` was already seen at Level 0 $\implies$ dropped!
  - Level 1 is empty `[]`.
- **Result**: `Finished { accepted: false }`.
- Trace: 1 step: `(0, 0, [])` with `pda.sim.not_accepting_state`.
- Planner comparison: Matches planner (`finishes, rejected, one step (the repeat is dropped)`).

#### 2. Stack-growing Loop
- Machine: State 0, start 0, accepting: `[]` (none).
- Transitions: `(0, ε, [] → [x], 0)`.
- Input: $\varepsilon$.
- Configurations:
  - Config 1: `(0, 0, [])` (Level 0, stack depth 0)
  - Config 2: `(0, 0, [x])` (Level 1, stack depth 1)
  - Config 3: `(0, 0, [x, x])` (Level 2, stack depth 2)
  - Config 4: `(0, 0, [x, x, x])` (Level 3, stack depth 3)
  - Config 5: `(0, 0, [x, x, x, x])` (Level 4, stack depth 4)
  - Config 6: `(0, 0, [x, x, x, x, x])` (Level 5, stack depth 5)
  - Config 7: `(0, 0, [x, x, x, x, x, x])` (depth 6)
- Budget tests:
  - **`maxStack: 5`**:
    - Reaching or attempting to create depth 6 exceeds `maxStack = 5`.
    - **Result**: `Stopped { reason: StopReason::MaxStack }`.
    - `partial_trace` non-empty (path up to depth 5).
  - **`maxSteps: 3`**:
    - Limits BFS levels to 3 (levels 0, 1, 2, 3).
    - **Result**: `Stopped { reason: StopReason::MaxSteps }`.
    - `partial_trace` non-empty.
  - **`maxConfigurations: 3`**:
    - After creating 3 configurations, 4th configuration exceeds `maxConfigurations = 3`.
    - **Result**: `Stopped { reason: StopReason::MaxConfigurations }`.
    - `partial_trace` non-empty.
- Planner comparison: Matches planner (`with maxStack: 5 -> Stopped(MaxStack); maxSteps: 3 -> Stopped(MaxSteps); maxConfigurations: 3 -> Stopped(MaxConfigurations); each has non-empty partialTrace`).

---

### Proptest Specifications & Deliberate Breaks

As required by Rule 5 and Rule 6, every property test has a stated deliberate break:
1. **Property Test 1 (M1 correctness oracle)**:
   - Property: For random $w \in \{a, b\}^*$ up to length 10, M1 accepts iff $w = a^n b^n$ for some $n \ge 0$.
   - Deliberate break: Ignore stack check in acceptance (accept at accepting state regardless of stack) $\implies$ accepts strings like $a$ or $aab$, causing the property test to fail.
2. **Property Test 2 (M2 correctness oracle)**:
   - Property: For random $w \in \{a, b\}^*$ up to length 10, M2 accepts iff $w = w^R$ and $|w|$ is even.
   - Deliberate break: Treat `pop = []` as "stack empty" $\implies$ transitions on M2 fail to push onto empty stack, causing legitimate even palindromes to reject.
3. **Property Test 3 (Trace validity on random inputs)**:
   - Property: For every generated trace, step 0 is start configuration $(start, 0, [])$; every subsequent step $(C_{k-1} \to C_k)$ legally applies the transition indicated by `step.transition`; and if accepted, the final step satisfies $q \in F \land i = |w| \land s = []$.
   - Deliberate break: Omit incrementing `position` on input consumption $\implies$ step invariant check fails.
4. **Property Test 4 (Determinism of BFS output)**:
   - Property: Running simulation on the same machine and input always produces the exact same trace and metrics.
   - Deliberate break: Use non-deterministic queue/set ordering (e.g. iterating a `HashSet` directly) $\implies$ run-to-run comparison fails.


---

## 2. Deliberate Breaks (AC4 & Determinism)

Each of the required deliberate breaks was tested by temporarily altering the engine code, running the test, capturing the actual failure, and then restoring the code to clean passing state.

### Break 1: Treat `pop = []` as "stack empty"
- **Code modification**: In `crates/engine-core/src/pda_simulate.rs`, require `node_config.stack.is_empty()` when `t.pop.is_empty()`.
- **Expected failure**: On machine M2 ($ww^R$) on input `aa`, transition `(0, ε, [] → [], 1)` cannot fire because the stack has `[a]`, causing input `aa` to fail acceptance.
- **Actual terminal output**:
```text
   Compiling engine-core v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-core)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 3.47s
     Running tests/pda_simulate.rs (target/debug/deps/pda_simulate-a7b2abc4378d84bb)

running 1 test
test test_m2_aa ... FAILED

failures:

---- test_m2_aa stdout ----

thread 'test_m2_aa' (599633) panicked at crates/engine-core/tests/pda_simulate.rs:223:13:
assertion failed: accepted
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace

failures:
    test_m2_aa

test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 17 filtered out; finished in 0.00s

error: test failed, to rerun pass `-p engine-core --test pda_simulate`
```
- **Restoration**: Code restored. `test_m2_aa` passes.

### Break 2: Drop repeated-configuration check
- **Code modification**: In `crates/engine-core/src/pda_simulate.rs`, ignore `seen.insert` and always insert into `next_level`.
- **Expected failure**: The no-change loop machine `(0, ε, [] → [], 0)` does not end on input $\varepsilon$, spinning until `max_steps` is exhausted and returning `Stopped(MaxSteps)` with 10,001 explored configs instead of `Finished { accepted: false, trace.len(): 1 }`.
- **Actual terminal output**:
```text
   Compiling engine-core v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-core)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 1.27s
     Running tests/pda_simulate.rs (target/debug/deps/pda_simulate-a7b2abc4378d84bb)

running 1 test
test test_no_change_loop ... FAILED

failures:

---- test_no_change_loop stdout ----

thread 'test_no_change_loop' (600389) panicked at crates/engine-core/tests/pda_simulate.rs:297:14:
Expected Finished, got Stopped { reason: MaxSteps, partial_trace: [PdaStep { position: 0, symbol: None, transition: None, state: StateId(0), stack: [], message: Message { key: "pda.sim.start", params: {} } }], peak_configurations: 1, explored: 10001 }
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace

failures:
    test_no_change_loop

test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 17 filtered out; finished in 0.01s

error: test failed, to rerun pass `-p engine-core --test pda_simulate`
```
- **Restoration**: Code restored. `test_no_change_loop` passes.

### Break 3: Count peak configurations before dropping repeats
- **Code modification**: In `crates/engine-core/src/pda_simulate.rs`, increment a raw candidate counter before `seen.insert(...)` and update `peak = peak.max(raw_count)`.
- **Expected failure**: In `test_peak_after_dropping_repeats`, 3 states produce the same 2 unique configurations. Peak before dropping repeats is 6; peak after dropping repeats is 3.
- **Actual terminal output**:
```text
   Compiling engine-core v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-core)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 1.31s
     Running tests/pda_simulate.rs (target/debug/deps/pda_simulate-a7b2abc4378d84bb)

running 1 test
test test_peak_after_dropping_repeats ... FAILED

failures:

---- test_peak_after_dropping_repeats stdout ----

thread 'test_peak_after_dropping_repeats' (601240) panicked at crates/engine-core/tests/pda_simulate.rs:510:13:
assertion `left == right` failed
  left: 6
 right: 3
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace

failures:
    test_peak_after_dropping_repeats

test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 17 filtered out; finished in 0.00s

error: test failed, to rerun pass `-p engine-core --test pda_simulate`
```
- **Restoration**: Code restored. `test_peak_after_dropping_repeats` passes.

### Break 4: Acceptance at first accepting state regardless of the stack
- **Code modification**: In `crates/engine-core/src/pda_simulate.rs`, remove `&& c.stack.is_empty()` from the acceptance predicate.
- **Expected failure**: Machine M1 on input `a` reaches state 0 with stack `[a]` after exhausting input. If stack is ignored, input `a` is wrongly accepted.
- **Actual terminal output**:
```text
   Compiling engine-core v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-core)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 1.26s
     Running tests/pda_simulate.rs (target/debug/deps/pda_simulate-a7b2abc4378d84bb)

running 5 tests
test test_m1_ab ... ok
test test_m1_a ... FAILED
test test_m1_abb ... ok
test test_m1_aabb ... ok
test test_m1_aab ... FAILED

failures:

---- test_m1_a stdout ----

thread 'test_m1_a' (602002) panicked at crates/engine-core/tests/pda_simulate.rs:110:13:
assertion failed: !accepted
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace

---- test_m1_aab stdout ----

thread 'test_m1_aab' (602003) panicked at crates/engine-core/tests/pda_simulate.rs:138:13:
assertion failed: !accepted

failures:
    test_m1_a
    test_m1_aab

test result: FAILED. 3 passed; 2 failed; 0 ignored; 0 measured; 13 filtered out; finished in 0.00s

error: test failed, to rerun pass `-p engine-core --test pda_simulate`
```
- **Restoration**: Code restored. All tests pass.

### Break 5: Transition iteration order altered within a level (Determinism test)
- **Code modification**: In `crates/engine-core/src/pda_simulate.rs`, iterate `pda.transitions.iter().enumerate().rev()`.
- **Expected failure**: In `test_level_order_determinism`, two competing transitions lead to accepting states 1 and 2. Reversing order picks state 2 (transition index 1) instead of canonical state 1 (transition index 0).
- **Actual terminal output**:
```text
   Compiling engine-core v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-core)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 1.53s
     Running tests/pda_simulate.rs (target/debug/deps/pda_simulate-a7b2abc4378d84bb)

running 1 test
test test_level_order_determinism ... FAILED

failures:

---- test_level_order_determinism stdout ----

thread 'test_level_order_determinism' (603527) panicked at crates/engine-core/tests/pda_simulate.rs:647:13:
assertion `left == right` failed
  left: 2
 right: 1
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace

failures:
    test_level_order_determinism

test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 18 filtered out; finished in 0.00s

error: test failed, to rerun pass `-p engine-core --test pda_simulate`
```
- **Restoration**: Code restored. `test_level_order_determinism` passes.

---

## 3. Worst-Case Memory Measurement (Rule 4)

- **Default budget values**:
  - `max_steps`: 10,000 levels
  - `max_configurations`: 20,000 configurations
  - `max_stack`: 500 symbols
- **Worst-case benchmark construction**:
  A PDA with 486 states: a chain of 485 states each pushing stack symbol `x` on $\varepsilon$, reaching state 485 with a stack of 485 symbols. At state 485, two branching transitions push `x` and `y` on $\varepsilon$. The stack length grows up to 500, producing $2^{15} = 32,768$ configurations at stack depths $485 \le |s| \le 500$. The simulation halts when total configurations explored reaches `max_configurations = 20,000`.
- **Measurement (`test_worst_case_budget_memory`)**:
  - `explored`: 20,000
  - `peak_configurations`: 8,192
  - `StopReason`: `MaxConfigurations`
  - Resident memory before simulation: 5.31 MB
  - Resident memory after simulation: 43.09 MB
  - **Memory delta (RSS diff)**: **37.78 MB**
  - **Evaluation**: 37.78 MB is well below the 50 MB threshold. The default budget guarantees safe execution without risk of out-of-memory crashes.

---

## 4. Verification Output

### Command 1: Rust Format Check, Clippy, and Tests
```text
$ cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
    Checking engine-core v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-core)
    Checking engine-wasm v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-wasm)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.66s
    Finished `test` profile [unoptimized + debuginfo] target(s) in 16.31s
     Running unittests src/lib.rs (target/debug/deps/engine_core-670a3d94c89462ba): 1 passed
     Running tests/api.rs: 29 passed
     Running tests/boundaries.rs: 20 passed
     Running tests/determinize.rs: 11 passed
     Running tests/enumerate.rs: 18 passed
     Running tests/equivalence.rs: 13 passed
     Running tests/fsm_regex.rs: 11 passed
     Running tests/grammar.rs: 51 passed
     Running tests/jff.rs: 15 passed
     Running tests/json.rs: 17 passed
     Running tests/minimize.rs: 9 passed
     Running tests/nondeterminism.rs: 5 passed
     Running tests/operations.rs: 11 passed
     Running tests/pda_json.rs: 6 passed
     Running tests/pda_simulate.rs: 19 passed
     Running tests/pda_validate.rs: 10 passed
     Running tests/regex.rs: 13 passed
     Running tests/regex_fsm.rs: 10 passed
     Running tests/regex_machine.rs: 8 passed
     Running tests/regex_simplify.rs: 31 passed
     Running tests/simulate.rs: 17 passed
     Running tests/trap_state.rs: 9 passed
     Running tests/validate.rs: 12 passed
     Running tests/xor.rs: 17 passed
     Running unittests src/lib.rs (engine_wasm): 9 passed
test result: ok. All tests passed.
```

### Command 2: WASM Build & TypeScript Declarations Generation
```text
$ pnpm build:wasm
[INFO]: 🎯  Checking for the Wasm target...
[INFO]: 🌀  Compiling to Wasm...
    Finished `release` profile [optimized] target(s) in 10.57s
[INFO]: ⬇️  Installing wasm-bindgen...
[INFO]: Optimizing wasm binaries with `wasm-opt`...
[INFO]: ✨   Done in 35.85s
[INFO]: 📦   Your wasm pkg is ready to publish at web/src/lib/engine/wasm.
$ cargo test -p engine-core --features ts --test ts_export
test the_types_match_the_json ... ok
test result: ok. 1 passed; 0 failed
```

### Command 3: Frontend Quality Gates
```text
$ pnpm check && pnpm lint && pnpm format:check && pnpm check:strings && pnpm check:tokens
$ pnpm --filter web check
$ svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings
svelte-check found 0 errors and 0 warnings
$ pnpm --filter web lint
$ eslint .
$ pnpm --filter web format:check && cargo fmt --check
$ prettier --check .
All matched files use Prettier code style!
$ node tools/check-strings.mjs
ok   63 components have no hard-coded text
$ node tools/check-tokens-usage.mjs
ok   65 files use no raw colors
```

### Command 4: Web Vitest Suite
```text
$ pnpm --filter web exec vitest run
 Test Files  92 passed (92)
      Tests  1179 passed | 2 skipped (1181)
   Duration  5.37s
```

### Command 5: Production Build & Bundle Size
```text
$ pnpm build && pnpm size
✓ built in 1.65s
Wrote site to "build"
✔ done
$ node tools/check-size.mjs
ok   initial JS index.html: 79.7 KB gzip (limit 170 KB)
ok   initial JS panduan/berakhiran-x.html: 84.6 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 78.9 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 118.0 KB gzip (limit 170 KB)
ok   initial JS soal/berakhiran-10.html: 117.6 KB gzip (limit 170 KB)
ok   initial JS soal/jumlah-a-genap.html: 117.6 KB gzip (limit 170 KB)
ok   initial JS soal/mengandung-101.html: 117.6 KB gzip (limit 170 KB)
ok   initial JS soal.html: 80.3 KB gzip (limit 170 KB)
ok   initial JS tentang.html: 78.2 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-C8jNeVC0.wasm: 220.9 KB gzip (limit 250 KB)
```
- **Size Comparison**:
  - WASM binary: 217.7 KB gzip (before) $\to$ **220.9 KB gzip** (after) (budget: 250 KB).
  - Largest initial JS page (`sandbox.html`): 117.7 KB gzip (before) $\to$ **118.0 KB gzip** (after) (budget: 170 KB).
