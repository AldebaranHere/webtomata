# Report: T-015 Toggle "versi panjang / versi ringkas" in the CNF stepper

## 1. Hand Derivations

The user required hand derivations recorded in `REPORT.md` before any test runs for:
1. **Grammar R1**: $S \to x B y \mid z B y \mid z B \mid x$ with $B \to x$.
2. **Grammar R2**: $S \to a C$ with $C \to c \mid a$ (must not reuse $C$).
3. **Grammar R3a**: The T-010 flow grammar (`SIX_PHASE_GRAMMAR`: $S \to a S b \mid A \mid U$, $A \to B$, $B \to b B \mid \lambda$, $U \to U c$).
4. **Grammar R3b**: A grammar with truly identical traces: $S \to a S b \mid c$ ($L(R3b) = \{a^n c b^n \mid n \ge 0\}$).

---

### Grammar R1
- **Alphabet**: $\{x, y, z\}$
- **Variables**: $\{S, B\}$
- **Start**: $S$
- **Rules**:
  - $S \to x B y \mid z B y \mid z B \mid x$
  - $B \to x$
- **Language**:
  - $S \to x \implies x$
  - $S \to z B \implies z x$
  - $S \to x B y \implies x x y$
  - $S \to z B y \implies z x y$
  - $L(R1) = \{x, xxy, zxy, zx\}$

#### Phase 1: Unreachable Rules (`grammar.cnf.phase_unreachable`)
- Reachable from $S$: $\{S, B\}$.
- Removed: 0 rules.
- Added: 0 rules.
- Rules remaining: 5.
- `note_key`: `None`.

#### Phase 2: Non-productive Rules (`grammar.cnf.phase_nonproductive`)
- Productive: $B \to x$ ($B$), $S \to x$ ($S$).
- Unreachable after pruning: none.
- Removed: 0 rules.
- Added: 0 rules.
- Rules remaining: 5.
- `note_key`: `None`.

#### Phase 3: $\varepsilon$-Rules (`grammar.cnf.phase_epsilon`)
- Nullable variables: none.
- Start symbol nullable? No $\implies S_0$ is not added.
- Removed: 0 rules.
- Added: 0 rules.
- Rules remaining: 5.
- `note_key`: `None`.

#### Phase 4: Unit Rules (`grammar.cnf.phase_unit`)
- Unit rules: none.
- Removed: 0 rules.
- Added: 0 rules.
- Rules remaining: 5.
- `note_key`: `None`.

#### Phase 5: Mixed Rules (`grammar.cnf.phase_mixed`)
Rules entering Phase 5 (5 rules):
- $S \to x B y$ (length 3, terminals $x, y$)
- $S \to z B y$ (length 3, terminals $z, y$)
- $S \to z B$ (length 2, terminal $z$)
- $S \to x$ (length 1, single terminal)
- $B \to x$ (length 1, single terminal)

##### Versi Panjang (`short_version = false`)
- Generates fresh variables $T_x \to x$, $T_y \to y$, $T_z \to z$.
- Removed (3 rules): $S \to x B y$, $S \to z B y$, $S \to z B$.
- Added (6 rules): $S \to T_x B T_y$, $S \to T_z B T_y$, $S \to T_z B$, $T_x \to x$, $T_y \to y$, $T_z \to z$.
- Total rules after Phase 5: $5 - 3 + 6 = 8$ rules:
  - $S \to T_x B T_y \mid T_z B T_y \mid T_z B \mid x$
  - $B \to x$
  - $T_x \to x$
  - $T_y \to y$
  - $T_z \to z$
- `note_key`: `None`.

##### Versi Ringkas (`short_version = true`)
- Variable reuse candidate check:
  - $B$: only rule is $B \to x$. Qualifies for terminal $x$!
  - $S$: has 4 rules. Does not qualify.
- Terminal $x$ reuses $B$ ($B \to x$). No $T_x$ is created.
- Terminal $y$: no existing variable qualifies $\implies T_y \to y$.
- Terminal $z$: no existing variable qualifies $\implies T_z \to z$.
- Rewritten rules:
  - $S \to x B y \implies S \to B B T_y$
  - $S \to z B y \implies S \to T_z B T_y$
  - $S \to z B \implies S \to T_z B$
- Removed (3 rules): $S \to x B y$, $S \to z B y$, $S \to z B$.
- Added (5 rules): $S \to B B T_y$, $S \to T_z B T_y$, $S \to T_z B$, $T_y \to y$, $T_z \to z$.
- Total rules after Phase 5: $5 - 3 + 5 = 7$ rules:
  - $S \to B B T_y \mid T_z B T_y \mid T_z B \mid x$
  - $B \to x$
  - $T_y \to y$
  - $T_z \to z$
- `note_key`: At least one terminal reused an existing variable ($x$ reused $B$) $\implies$ `Some("grammar.cnf.phase_mixed.note_short")`.

#### Phase 6: Long Rules (`grammar.cnf.phase_long`)

##### Versi Panjang (`short_version = false`)
- Rules of length $\ge 3$: $S \to T_x B T_y$ and $S \to T_z B T_y$.
- Without helper sharing:
  - $S \to T_x B T_y \implies S \to T_x X_1, X_1 \to B T_y$
  - $S \to T_z B T_y \implies S \to T_z X_2, X_2 \to B T_y$
- Removed (2 rules): $S \to T_x B T_y$, $S \to T_z B T_y$.
- Added (4 rules): $S \to T_x X_1$, $S \to T_z X_2$, $X_1 \to B T_y$, $X_2 \to B T_y$.
- Total rules after Phase 6: $8 - 2 + 4 = 10$ rules.
- `note_key`: `None`.
- Language: CYK accepts $\{x, xxy, zxy, zx\}$.

##### Versi Ringkas (`short_version = true`)
- Rules of length $\ge 3$: $S \to B B T_y$ and $S \to T_z B T_y$.
- Both share the tail pair $(B, T_y)$.
- With helper sharing:
  - Pair $(B, T_y)$ cached as helper $X \to B T_y$.
  - $S \to B B T_y \implies S \to B X$
  - $S \to T_z B T_y \implies S \to T_z X$
- Removed (2 rules): $S \to B B T_y$, $S \to T_z B T_y$.
- Added (3 rules): $S \to B X$, $S \to T_z X$, $X \to B T_y$.
- Total rules after Phase 6: $7 - 2 + 3 = 8$ rules.
- `note_key`: At least one helper was shared ($X$ used by both $S \to B X$ and $S \to T_z X$) $\implies$ `Some("grammar.cnf.phase_long.note_short")`.
- Language: CYK accepts $\{x, xxy, zxy, zx\}$.

---

### Grammar R2 (Must not reuse)
- **Alphabet**: $\{a, c\}$
- **Variables**: $\{S, C\}$
- **Start**: $S$
- **Rules**:
  - $S \to a C$
  - $C \to c \mid a$
- **Language**: $\{ac, aa\}$.

#### Phases 1 to 4:
- Phase 1: All reachable $\{S, C\}$. Removed: 0, Added: 0. Rules: 3.
- Phase 2: All productive. Removed: 0, Added: 0. Rules: 3.
- Phase 3: No $\varepsilon$ rules. Removed: 0, Added: 0. Rules: 3. `note_key`: `None`.
- Phase 4: No unit rules. Removed: 0, Added: 0. Rules: 3.

#### Phase 5: Mixed Rules (`grammar.cnf.phase_mixed`)
- Mixed rule: $S \to a C$ (length 2, terminal $a$).
- Terminal rules: $C \to c$, $C \to a$.
- Check reuse for terminal $a$:
  - $C$ has two rules in the grammar ($C \to c$ and $C \to a$).
  - A variable is only reusable if its **sole rule in the grammar** is $V \to a$.
  - Reusing $C$ for $a$ would turn $S \to a C$ into $S \to C C$, which would generate $\{cc, ca, ac, aa\}$, altering the language.
  - Thus, $C$ must NOT be reused.
- Both Versi Panjang and Versi Ringkas:
  - Create new helper $T_a \to a$.
  - $S \to a C \implies S \to T_a C$.
  - Removed (1 rule): $S \to a C$.
  - Added (2 rules): $S \to T_a C$, $T_a \to a$.
  - Total rules after Phase 5: $3 - 1 + 2 = 4$ rules ($S \to T_a C$, $C \to c$, $C \to a$, $T_a \to a$).
  - `note_key`: `None` in both versions (no terminal reused an existing variable).

#### Phase 6: Long Rules (`grammar.cnf.phase_long`)
- No rules with length $\ge 3$.
- Both Versi Panjang and Versi Ringkas:
  - Removed: 0.
  - Added: 0.
  - Total rules after Phase 6: 4 rules.
  - `note_key`: `None`.
- Final grammar accepts $\{ac, aa\}$.

---

### Grammar R3a: The T-010 Flow Grammar (`SIX_PHASE_GRAMMAR`)
- **Rules**:
  - $S \to a S b \mid A \mid U$
  - $A \to B$
  - $B \to b B \mid \lambda$
  - $U \to U c$

#### Phases 1 to 5:
Identical in both versions:
- **Phase 1: Unreachable**: None removed. (7 rules).
- **Phase 2: Non-productive**: $U$ non-productive. Removed: $S \to U$, $U \to U c$ (2 rules). Added: 0. (5 rules).
- **Phase 3: $\varepsilon$-Rules**: $B \to \lambda$ removed. Since $S \Rightarrow^* \lambda$, start symbol is nullable $\implies S_0 \to S \mid \lambda$ added. $B \to b$ and $S \to a b$ added. Removed: 1 rule, Added: 4 rules. (8 rules). `note_key`: `Some("grammar.cnf.phase_epsilon.note")`.
- **Phase 4: Unit Rules**: Unit rules $S_0 \to S$, $A \to B$, $S \to A$ removed. Removed: 3 rules, Added: 8 rules. (13 rules).
- **Phase 5: Mixed Rules**:
  - Variables entering Phase 5: $S_0, S, A, B$.
  - None has only a single production $V \to c$.
  - In both Versi Panjang and Versi Ringkas:
    - No existing variable qualifies for reuse.
    - $T_a \to a$ and $T_b \to b$ created.
    - Removed: 8 rules.
    - Added: 10 rules.
    - Total rules after Phase 5: 15 rules.
    - `note_key`: `None`.

#### Phase 6: Long Rules
Rules of length $\ge 3$ entering Phase 6:
- $S_0 \to T_a S T_b$ (length 3)
- $S \to T_a S T_b$ (length 3)

##### Versi Panjang (`short_version = false`):
- Each rule gets a fresh helper:
  - $S_0 \to T_a S T_b \implies S_0 \to T_a X$, $X \to S T_b$
  - $S \to T_a S T_b \implies S \to T_a X_1$, $X_1 \to S T_b$
- Removed (2 rules): $S_0 \to T_a S T_b$, $S \to T_a S T_b$.
- Added (4 rules): $S_0 \to T_a X$, $S \to T_a X_1$, $X \to S T_b$, $X_1 \to S T_b$.
- Total rules after Phase 6: $15 - 2 + 4 = 17$ rules.
- `note_key`: `None`.

##### Versi Ringkas (`short_version = true`):
- Both rules share the identical tail pair $(S, T_b)$!
- Cache pair $(S, T_b) \to X$:
  - $S_0 \to T_a S T_b \implies S_0 \to T_a X$
  - $S \to T_a S T_b \implies S \to T_a X$
  - Helper rule $X \to S T_b$ is added once!
- Removed (2 rules): $S_0 \to T_a S T_b$, $S \to T_a S T_b$.
- Added (3 rules): $S_0 \to T_a X$, $S \to T_a X$, $X \to S T_b$.
- Total rules after Phase 6: $15 - 2 + 3 = 16$ rules.
- `note_key`: `Some("grammar.cnf.phase_long.note_short")` because helper $X$ is shared between two rules.
- Both final grammars accept the same language (CYK oracle up to length 8 over $\{a,b,c\}$).

---

### Grammar R3b: Truly Identical Traces
- **Rules**:
  - $S \to a S b \mid c$
- **Language**: $\{a^n c b^n \mid n \ge 0\}$
- $S$ has two rules, so no existing variable qualifies to be reused for $a, b, c$.
- Only one long rule ($S \to a S b$) exists, so there is no twin rule to share with.

#### Hand Derivation for R3b (both versions identical across all six phases):
- **Phase 1: Unreachable**: Reachable $\{S\}$. Removed: 0, Added: 0. Rules: 2 ($S \to a S b \mid c$). `note_key`: `None`.
- **Phase 2: Non-productive**: $S$ productive ($S \to c$). Removed: 0, Added: 0. Rules: 2. `note_key`: `None`.
- **Phase 3: $\varepsilon$-Rules**: No $\varepsilon$ rules. $S$ not nullable. Removed: 0, Added: 0. Rules: 2. `note_key`: `None`.
- **Phase 4: Unit Rules**: No unit rules. Removed: 0, Added: 0. Rules: 2. `note_key`: `None`.
- **Phase 5: Mixed Rules**:
  - $S$ has two rules, so it cannot be reused.
  - $T_a \to a$ and $T_b \to b$ created. ($c$ is length 1, no helper needed).
  - $S \to a S b \implies S \to T_a S T_b$.
  - Removed (1 rule): $S \to a S b$.
  - Added (3 rules): $S \to T_a S T_b$, $T_a \to a$, $T_b \to b$.
  - Total rules after Phase 5: $2 - 1 + 3 = 4$ rules ($S \to T_a S T_b \mid c$, $T_a \to a$, $T_b \to b$).
  - `note_key`: `None` in both versions.
- **Phase 6: Long Rules**:
  - Single rule with length $\ge 3$: $S \to T_a S T_b$.
  - No twin rule exists to share helpers.
  - $S \to T_a S T_b \implies S \to T_a X$, $X \to S T_b$.
  - Removed (1 rule): $S \to T_a S T_b$.
  - Added (2 rules): $S \to T_a X$, $X \to S T_b$.
  - Total rules after Phase 6: $4 - 1 + 2 = 5$ rules ($S \to T_a X \mid c$, $X \to S T_b$, $T_a \to a$, $T_b \to b$).
  - `note_key`: `None` in both versions.
- Both versions give the exact same six phases and no notes.
- Both accept $a^n c b^n$ (CYK oracle up to length 8 over $\{a, b, c\}$).

---

## 2. Deliberate Breaks (AC6)

Each deliberate break was introduced one at a time, verified to fail with exact failure output, and immediately restored.

### Break 1: Reuse a variable with more than one rule (R2 fails)
- **Change**: In `crates/engine-core/src/grammar/cnf.rs`, bypassed the `head_counts.get(&r.head) == Some(&1)` check, allowing variables with multiple rules (like $C \to c \mid a$) to qualify for terminal reuse in Phase 5.
- **Command**: `cargo test -p engine-core --test grammar test_hand_derivation_r2`
- **Output**:
```
   Compiling engine-core v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-core)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 1.68s
     Running tests/grammar.rs (target/debug/deps/grammar-55e09d754fbe5e9c)

running 1 test
test test_hand_derivation_r2_must_not_reuse ... FAILED

failures:

---- test_hand_derivation_r2_must_not_reuse stdout ----

thread 'test_hand_derivation_r2_must_not_reuse' (456460) panicked at crates/engine-core/tests/grammar.rs:953:9:
assertion `left == right` failed
  left: 1
 right: 2
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace

failures:
    test_hand_derivation_r2_must_not_reuse

test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 28 filtered out; finished in 0.00s

error: test failed, to rerun pass `-p engine-core --test grammar`
```
- **Restoration**: Restored single-production qualification check `head_counts.get(&r.head) == Some(&1)`. Test passes (`ok`).

---

### Break 2: Never share in phase 6 (R1 short counts fail)
- **Change**: In `crates/engine-core/src/grammar/cnf.rs`, forced `short_version: false` when calling `phase6_binarize_long`.
- **Command**: `cargo test -p engine-core --test grammar test_hand_derivation_r1`
- **Output**:
```
   Compiling engine-core v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-core)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 1.12s
     Running tests/grammar.rs (target/debug/deps/grammar-55e09d754fbe5e9c)

running 1 test
test test_hand_derivation_r1_version_toggle ... FAILED

failures:

---- test_hand_derivation_r1_version_toggle stdout ----

thread 'test_hand_derivation_r1_version_toggle' (457241) panicked at crates/engine-core/tests/grammar.rs:930:5:
assertion `left == right` failed
  left: 4
 right: 3
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace

failures:
    test_hand_derivation_r1_version_toggle

test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 28 filtered out; finished in 0.02s

error: test failed, to rerun pass `-p engine-core --test grammar`
```
- **Restoration**: Passed `short_version` to `phase6_binarize_long`. Test passes (`ok`).

---

### Break 3: Do not forward the flag from GrammarWorkstation (toggle test fails)
- **Change**: In `web/src/lib/grammar/GrammarWorkstation.svelte`, hardcoded `engine.transformToCnf(grammarText, false)`.
- **Command**: `pnpm --filter web exec playwright test --project=desktop e2e/grammar-cnf-version.spec.ts -g "toggling between versions"`
- **Output**:
```
  ✘  1 [desktop] › e2e/grammar-cnf-version.spec.ts:37:2 › CNF version toggle (AC3, AC4, AC5) › toggling between long and short version on R1 preserves step and updates rule counts and notes (AC3) (6.2s)

  1) [desktop] › e2e/grammar-cnf-version.spec.ts:37:2 › CNF version toggle (AC3, AC4, AC5) › toggling between long and short version on R1 preserves step and updates rule counts and notes (AC3) 

    Error: expect(locator).toHaveText(expected) failed

    Locator:  locator('#grammar-pane-cnf').locator('.rule-count')
    Expected: "7 aturan"
    Received: "8 aturan"
    Timeout:  5000ms

    Call log:
      - Expect "toHaveText" locator('#grammar-pane-cnf').locator('.rule-count') with timeout 5000ms
      - waiting for locator('#grammar-pane-cnf').locator('.rule-count')
        14 × locator resolved to <span class="rule-count svelte-xlr01w">8 aturan</span>
           - unexpected value "8 aturan"

      71 | 		await nextBtn.click();
      72 | 		await expect(cnfPane.locator('.step-counter')).toHaveText('5 / 6');
    > 73 | 		await expect(cnfPane.locator('.rule-count')).toHaveText('7 aturan');
         | 		                                             ^
      74 | 		const stepNote = cnfPane.locator('.step-note');
      75 | 		await expect(stepNote).toBeVisible();
      76 | 		await expect(stepNote).toContainText('Versi ringkas: terminal yang sudah punya variabel');
```
- **Restoration**: Restored `cnfVersion === 'short'` flag forwarding in `GrammarWorkstation.svelte`. Test passes (`ok`).

---

### Break 4: Remove one new key from en.ts (a test or check:strings fails)
- **Change**: Removed `'grammar.cnf.version.aria'` from `web/src/lib/i18n/en.ts`.
- **Command**: `pnpm check`
- **Output**:
```
$ svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings
Loading svelte-check in workspace: /home/Aldebaran64/webtomata/web
Getting Svelte diagnostics...

/home/Aldebaran64/webtomata/web/src/lib/i18n/en.ts:4:14
Error: Property '"grammar.cnf.version.aria"' is missing in type '{ 'app.name': string; 'app.tagline': string; 'app.privacy': string; 'nav.skip': string; 'nav.label': string; 'nav.menu': string; 'nav.sandbox': string; 'nav.soal': string; 'nav.panduan': string; 'nav.tentang': string; ... 848 more ...; 'workstation.tabs_language_aria': string; }' but required in type 'Record<"app.name" | "app.tagline" | "app.privacy" | "nav.skip" | "nav.label" | "nav.menu" | "nav.sandbox" | "nav.soal" | "nav.panduan" | "nav.tentang" | "lang.label" | "lang.id" | ... 847 more ... | "workstation.tabs_language_aria", string>'. 

export const en: Record<MessageKey, string> = {
	'app.name': 'WebTomata',

====================================
svelte-check found 1 error and 0 warnings in 1 file
[ELIFECYCLE] Command failed with exit code 1.
```
Additionally, `pnpm --filter web exec vitest run src/lib/i18n` failed:
```
 FAIL  src/lib/i18n/i18n.test.ts > the messages > have the same keys in Indonesian and English
AssertionError: expected [ 'app.name', 'app.privacy', …(857) ] to deeply equal [ 'app.name', 'app.privacy', …(858) ]
- Expected: "grammar.cnf.version.aria"
```
- **Restoration**: Restored `'grammar.cnf.version.aria'` in `en.ts`. Both `pnpm check` and `vitest run src/lib/i18n` pass (`ok`).

---

## 3. Verification Output

### 1. `cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test`
```
    Checking engine-core v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-core)
    Checking engine-wasm v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-wasm)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.44s
   Compiling engine-core v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-core)
   Compiling engine-wasm v0.0.0 (/home/Aldebaran64/webtomata/crates/engine-wasm)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 8.68s
...
test result: ok. 29 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.19s (api.rs)
test result: ok. 20 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.11s (boundaries.rs)
test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.19s (determinize.rs)
test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.83s (differential.rs)
test result: ok. 29 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 18.41s (grammar.rs)
test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.08s (simulate.rs)
test result: ok. 9 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.20s (trap_state.rs)
test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s (validate.rs)
test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.52s (xor.rs)
test result: ok. 9 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s (engine-wasm)
```

### 2. `pnpm build:wasm`
```
$ wasm-pack build crates/engine-wasm --target web --release --out-dir ../../web/src/lib/engine/wasm && pnpm build:types
[INFO]: 🎯  Checking for the Wasm target...
[INFO]: 🌀  Compiling to Wasm...
    Finished `release` profile [optimized] target(s) in 0.03s
[INFO]: ⬇️  Installing wasm-bindgen...
[INFO]: Optimizing wasm binaries with `wasm-opt`...
[INFO]: ✨   Done in 17.98s
[INFO]: 📦   Your wasm pkg is ready to publish at web/src/lib/engine/wasm.
$ cargo test -p engine-core --features ts --test ts_export
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.05s
     Running tests/ts_export.rs (target/debug/deps/ts_export-3866b49c73009c67)

running 1 test
test the_types_match_the_json ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
```

### 3. `pnpm check && pnpm lint && pnpm format:check && pnpm check:strings && pnpm check:tokens`
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

### 4. `pnpm --filter web exec vitest run`
```
 Test Files  92 passed (92)
      Tests  1178 passed | 2 skipped (1180)
   Start at  10:30:17
   Duration  4.17s (tests 63%, transform 26%, import 10%)
```

### 5. `pnpm build && pnpm size`
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
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-Jo-KDNkx.wasm: 209.3 KB gzip (limit 250 KB)
```

### 6. `pnpm --filter web exec playwright test --project=desktop --project=phone e2e/grammar-cnf-version.spec.ts --repeat-each=10`
```
Running 120 tests using 6 workers
...
  120 passed (2.3m)
```
All 120 tests passed cleanly across desktop and phone with 10 repetitions each.

### 7. Area E2E Tests:
`pnpm --filter web exec playwright test --project=desktop --project=phone e2e/grammar-flow.spec.ts e2e/grammar-open-cnf.spec.ts e2e/grammar-phone.spec.ts e2e/grammar-cyk-limit.spec.ts`
```
Running 42 tests using 6 workers
...
  20 skipped
  22 passed (46.1s)
```

### 8. Cross-browser E2E Tests:
`pnpm --filter web exec playwright test --project=webkit-phone e2e/cross/workstation-phone.spec.ts`
```
Running 4 tests using 4 workers

  ✓  3 [webkit-phone] › e2e/cross/workstation-phone.spec.ts:140:1 › cross-browser grammar CNF version toggle on webkit-phone and firefox (T-015) (3.0s)
  ✓  2 [webkit-phone] › e2e/cross/workstation-phone.spec.ts:116:1 › cross-browser grammar rule rows on webkit-phone and firefox (AC6) (4.0s)
  ✓  4 [webkit-phone] › e2e/cross/workstation-phone.spec.ts:79:1 › language phone layout on WebKit phone: tab navigation and axe (6.1s)
  ✓  1 [webkit-phone] › e2e/cross/workstation-phone.spec.ts:32:1 › grammar phone layout on WebKit phone: tab navigation, shortcut, and axe (6.2s)

  4 passed (8.0s)
```

---

## 4. What Was Not Run Locally and Why

- **Firefox cross-browser test (`--project=firefox`)**: As stated in `AGENTS.md` ("Firefox does not start on the owner's laptop; the Firefox tests run only in CI"), the Firefox browser binary is not installed in the local WSL environment (`/home/Aldebaran64/.cache/ms-playwright/firefox-1555/firefox/firefox` does not exist). The cross-browser test passed completely on WebKit phone (`--project=webkit-phone`), and Firefox testing runs in the CI matrix.
- **Full test suite (`pnpm test:e2e`, `pnpm test:e2e:cross`)**: Following `AGENTS.md` verification tiers, the area specs were run locally (`grammar-cnf-version.spec.ts` repeated 10x, `grammar-flow.spec.ts`, `grammar-open-cnf.spec.ts`, `grammar-phone.spec.ts`, `grammar-cyk-limit.spec.ts`, and `cross/workstation-phone.spec.ts`). Full suite verification is run in CI across 4 parallel shards.

---

## 5. Summary & Acceptance Criteria Checklist

- [x] **AC1**: R1, R2, R3a, R3b match derivations in both versions (rule counts, removed/added, notes), and CYK equivalence language oracle passes for each final grammar.
- [x] **AC2**: `proptest` (`cnf_proptest_short_version_equiv_and_leq_rules`) proves that short final grammar is in CNF, CYK equivalent to long final grammar, and has $\le$ rules than the long version.
- [x] **AC3**: Stepper toggle defaults to "Versi panjang"; choosing "Versi ringkas" on Phase 4 preserves Phase 4 and updates rule counts and notes in Phases 5 and 6; toggling back restores long counts; roving tabindex (ArrowLeft/Right/Up/Down, Space, Enter) works; choice is persisted in localStorage (`webtomata.grammar.cnf_version`); invalid value defaults to long; fully translated in `id` and `en`.
- [x] **AC4**: Touch targets are $\ge 44 \times 44$ px on desktop and phone; full width on mobile column; axe reports 0 violations; no horizontal scroll at 375 px viewport.
- [x] **AC5**: Toggling twice quickly ends on the version of the second click.
- [x] **AC6**: All 4 deliberate breaks demonstrated failing and restored.
- [x] **AC7**: Size budget verified (`initial JS: 117.7 KB < 170 KB`, `wasm: 209.3 KB < 250 KB`).

