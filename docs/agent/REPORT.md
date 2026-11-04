# Report — T-010

> Written by the worker at the end of the session. One file per task; overwrite each session.

## Task
- id: T-010
- title: End-to-end tests for the grammar workstation flow
- branch: `task/T-010-grammar-flow-e2e`
- commits: `dd78d68..ccafc05`
- pull request: https://github.com/AldebaranHere/webtomata/pull/142
- status: done

## What changed
- `web/e2e/grammar-flow.spec.ts`:
  - New comprehensive end-to-end test suite for the grammar workstation flow:
    - **Matrix editing (desktop 1280x800):** creates a new grammar from empty state; types LHS `S`, enters RHS alternative `A B`, presses space to create a second alternative box with focus; types `a`, presses `|` to create a third alternative box; presses `Backspace` on an empty box, removing it and focusing the previous alternative; opens the symbol bar and inserts `ε` at cursor; blur pruning: empty alternative is pruned when focus leaves the row; `+ Tambah Baris` adds a row and focuses it; context menu right-click deletes a row; error banner (`role="alert"`) appears when a non-terminal has no production rules, and disappears when valid.
    - **Matrix editing (phone 390x844):** navigates to Editor tab via bottom tab strip; taps cell to reveal symbol bar; inserts `ε` via symbol bar; separates alternatives using space and `|`; backspace on empty alternative removes cell and focuses previous; deletes row using the touch delete button (`.btn-delete-row` from T-024) without confirmation prompt.
    - **Six CNF phases walkthrough & hand derivation:** steps through phases 1 to 6 using "Selanjutnya"; steps back using "Sebelumnya"; jumps directly between phases using numbered pills 1-6; checks counter ("1 / 6" to "6 / 6"), phase titles in Indonesian, added/removed rule chips (exact text and counts), and remaining rule counts after each phase; verifies valid CNF after Phase 6 against the hand derivation based on Rich's method.
    - **CYK tester:** verifies accepted string `ab` (verdict "Diterima"), empty string `ε` (verdict "String Kosong Diterima"), rejected string `a` (verdict "Ditolak"); verifies clicking example chips fills the input field; verifies top pyramid cell `.cyk-cell.top-accepting` is highlighted only for accepted strings and contains `S`.
    - **English interface:** switches locale to `en`; verifies tab labels ("Library", "Editor", "CNF Conversion", "CYK Tester"); verifies stepper buttons ("Previous step", "Next step"); verifies CYK verdict texts ("Accepted", "Empty string", "Rejected").
    - **axe accessibility checks:** desktop at 1280x800 (Library tab, Editor tab with error banner, Editor tab with expanded legend, CNF Stepper middle phase 3, and CYK tester with both accepted and rejected verdicts); phone at 390x844 (all tabs: Pustaka, Editor with error and legend, CNF phase 3, CYK tester).
- `web/src/lib/grammar/GrammarCykTester.svelte`:
  - Fixed accessibility issues exposed by tests:
    - Promoted `<h4 class="table-title">` to `<h2 class="table-title">` to maintain strict heading level hierarchy (`h1` -> `h2`).
    - Removed `opacity: 0.9;` on `.verdict-sub` to pass WCAG 2.2 AA contrast ratio (previously 4.39:1 on `#6b7280`, now passes with 5.9:1 on `#4b5563`).

---

## Hand Derivation of the 6-Phase Grammar (AC2)

Grammar chosen to exercise every phase:
```
S -> a S b | A | U
A -> B
B -> b B | λ
U -> U c
```
Language: $L(G) = \{ a^n b^m \mid n \ge 0, m \ge n \} = \{ a^n b^{n+k} \mid n \ge 0, k \ge 0 \}$.
The empty string $\lambda \in L(G)$ (for $n=0, k=0$).
Has: start on RHS ($S \to a S b$), nullable variable ($B \to \lambda$), unit rules ($A \to B, S \to A$), useless variable ($U$), mixed rules ($S \to a S b, B \to b B$), and long rules ($S \to a S b$).

### Phase 1: Tambah Simbol Awal Baru ($S_0 \to S$)
Start symbol $S$ appears on the RHS of $S \to a S b$. Add new start symbol $S_0$.
- Removed: none
- Added (1): $S_0 \to S$
- Remaining rules: 8
  - $S_0 \to S$
  - $S \to a S b \mid A \mid U$
  - $A \to B$
  - $B \to b B \mid \lambda$
  - $U \to U c$

### Phase 2: Eliminasi Aturan $\varepsilon$ (Nullable)
Nullable set computation:
- $B \to \lambda \implies B \in \text{Nullable}$
- $A \to B \implies A \in \text{Nullable}$
- $S \to A \implies S \in \text{Nullable}$
- $S_0 \to S \implies S_0 \in \text{Nullable}$
- $U$ is not nullable.

Expand nullable variables:
- $S \to a S b \implies S \to a b$
- $B \to b B \implies B \to b$
- $S_0 \to S \implies S_0 \to \lambda$ (preserved at new start symbol $S_0$ since $\lambda \in L$)
- Removed (1): $B \to \lambda$
- Added (3): $S_0 \to \lambda$, $B \to b$, $S \to a b$
- Remaining rules: 10
  - $S_0 \to \lambda \mid S$
  - $S \to a S b \mid a b \mid A \mid U$
  - $A \to B$
  - $B \to b B \mid b$
  - $U \to U c$

### Phase 3: Eliminasi Aturan Unit ($A \to B$)
Unit rules to eliminate: $S_0 \to S$, $A \to B$, $S \to A$, $S \to U$.
Unit chains and inherited non-unit productions:
- $(A, B) \implies A \to b B \mid b$
- $(S, A) \implies S \to b B \mid b$
- $(S, U) \implies S \to U c$
- $(S_0, S) \implies S_0 \to a S b \mid a b \mid b B \mid b \mid U c$
- Removed (4): $S_0 \to S$, $A \to B$, $S \to A$, $S \to U$
- Added (10): $A \to b$, $A \to b B$, $S \to b$, $S \to b B$, $S \to U c$, $S_0 \to a b$, $S_0 \to a S b$, $S_0 \to b$, $S_0 \to b B$, $S_0 \to U c$
- Remaining rules: 16
  - $S_0 \to \lambda \mid a b \mid a S b \mid b \mid b B \mid U c$
  - $S \to a b \mid a S b \mid b \mid b B \mid U c$
  - $A \to b \mid b B$
  - $B \to b \mid b B$
  - $U \to U c$

### Phase 4: Eliminasi Simbol Tidak Berguna (Useless)
- Step 4a (Generating / Productive):
  - Base: $B \to b$, $A \to b$, $S \to a b$, $S_0 \to a b \implies \{S_0, S, A, B\}$ are generating.
  - $U \to U c$: $U$ only ever produces sentential forms with $U$; it never generates terminal strings. Thus $U$ is unproductive.
  - Eliminate $U$ and all rules mentioning $U$: $U \to U c$, $S_0 \to U c$, $S \to U c$.
- Step 4b (Reachable):
  - Starting from $S_0$: productions are $S_0 \to \lambda \mid a b \mid a S b \mid b \mid b B$.
  - Reachable variables: $\{S_0, S, B\}$.
  - $A$ is never reached from $S_0$. Thus $A$ is unreachable.
  - Eliminate unreachable $A$ and its rules: $A \to b$, $A \to b B$.
- Removed (5): $U \to U c$, $S_0 \to U c$, $S \to U c$, $A \to b$, $A \to b B$
- Added: none
- Remaining rules: 11
  - $S_0 \to \lambda \mid a b \mid a S b \mid b \mid b B$
  - $S \to a b \mid a S b \mid b \mid b B$
  - $B \to b \mid b B$

### Phase 5: Penggantian Terminal dalam Aturan Campuran
Rules of length $\ge 2$ containing terminals:
- $S_0 \to a b, a S b, b B$
- $S \to a b, a S b, b B$
- $B \to b B$
Terminals $a$ and $b$ are isolated with helper variables $T_a \to a$ and $T_b \to b$.
- Removed (7): $B \to b B$, $S \to a b$, $S \to a S b$, $S \to b B$, $S_0 \to a b$, $S_0 \to a S b$, $S_0 \to b B$
- Added (9): $T_a \to a$, $T_b \to b$, $B \to T_b B$, $S \to T_a T_b$, $S \to T_a S T_b$, $S \to T_b B$, $S_0 \to T_a T_b$, $S_0 \to T_a S T_b$, $S_0 \to T_b B$
- Remaining rules: 13
  - $S_0 \to \lambda \mid b \mid T_a T_b \mid T_a S T_b \mid T_b B$
  - $S \to b \mid T_a T_b \mid T_a S T_b \mid T_b B$
  - $B \to b \mid T_b B$
  - $T_a \to a$
  - $T_b \to b$

### Phase 6: Binarisasi Aturan Panjang (Panjang $\ge 3$)
Rules of length $\ge 3$:
- $S_0 \to T_a S T_b$ (length 3)
- $S \to T_a S T_b$ (length 3)
Using the course method (Rich / Fasilkom slides without helper sharing by default, T-014):
- $S_0 \to T_a X$, where $X \to S T_b$
- $S \to T_a X_1$, where $X_1 \to S T_b$
- Removed (2): $S_0 \to T_a S T_b$, $S \to T_a S T_b$
- Added (4): $S_0 \to T_a X$, $X \to S T_b$, $S \to T_a X_1$, $X_1 \to S T_b$
- Remaining rules: 15
  - $B \to b \mid T_b B$
  - $S \to b \mid T_a T_b \mid T_b B \mid T_a X_1$
  - $S_0 \to \lambda \mid b \mid T_a T_b \mid T_b B \mid T_a X$
  - $T_a \to a$
  - $T_b \to b$
  - $X \to S T_b$
  - $X_1 \to S T_b$

Every rule in the final grammar is either $A \to B C$ or $A \to a$, with $S_0 \to \lambda$ permitted as the only nullable rule because $S_0$ does not appear on any RHS. The grammar is in valid Chomsky Normal Form.

---

## Deliberate Breaks (AC5)

### Break 1: In `GrammarWorkstation.svelte`, bypass `Backspace` handler on empty alternative
Bypassed `handleAltKeydown` when key is `Backspace` and cell is empty.
```
  1) [desktop] › e2e/grammar-flow.spec.ts:26:2 › grammar workstation matrix editing (desktop 1280x800) › desktop matrix editing: new grammar, space/pipe alts, backspace, symbol bar, prune on blur, add/delete row, error banner 

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 3
    Received: 4

      64 | 		// Backspace on empty 4th alternative removes it and focuses 3rd
      65 | 		await page.keyboard.press('Backspace');
    > 66 | 		expect(await getAltInputs().count()).toBe(3);
         | 		                                     ^
      67 | 		await expect(getAltInputs().nth(2)).toBeFocused();
```
Restored: `handleAltKeydown` backspace handling.

### Break 2: In `GrammarCnfStepper.svelte`, make "Selanjutnya" skip one phase
Changed `goToStep(currentStepIdx + 1)` to `goToStep(currentStepIdx + 2)`.
```
  1) [desktop] › e2e/grammar-flow.spec.ts:212:2 › six CNF phases walkthrough & hand derivation (desktop) › walk through phases 1 to 6 with Selanjutnya, back with Sebelumnya, and jump with pills 

    Error: expect(locator).toHaveText(expected) failed

    Locator:  locator('#grammar-pane-cnf').locator('.step-counter')
    Expected: "2 / 6"
    Received: "3 / 6"
    Timeout:  5000ms

    Call log:
      - Expect "toHaveText" locator('#grammar-pane-cnf').locator('.step-counter') with timeout 5000ms
      - waiting for locator('#grammar-pane-cnf').locator('.step-counter')
        14 × locator resolved to <span class="step-counter svelte-xlr01w">3 / 6</span>
           - unexpected value "3 / 6"

      244 | 		// === Phase 2: Eliminasi Aturan ε (Nullable) ===
      245 | 		await nextBtn.click();
    > 246 | 		await expect(stepCounter).toHaveText('2 / 6');
          | 		                          ^
```
Restored: `goToStep(currentStepIdx + 1)`.

### Break 3: In `GrammarCykTester.svelte`, invert `isTopAccepting` highlight condition
Changed `cell.includes(grammar.start)` to `!cell.includes(grammar.start)`.
```
  1) [desktop] › e2e/grammar-flow.spec.ts:354:2 › CYK tester & English locale (desktop) › CYK testing: accepted string, empty string, rejected string, example chips, top pyramid cell highlight 

    Error: expect(locator).toBeVisible() failed

    Locator: locator('#grammar-pane-cyk').locator('.cyk-cell.top-accepting')
    Expected: visible
    Timeout: 5000ms
    Error: element(s) not found

      381 | 		// Top cell of the CYK table pyramid is highlighted exactly when string is accepted
      382 | 		const topAcceptingCell = cykPane.locator('.cyk-cell.top-accepting');
    > 383 | 		await expect(topAcceptingCell).toBeVisible();
          | 		                               ^
```
Restored: `cell.includes(grammar.start)`.

---

## Verification Outputs

### 1. Static Checks
`pnpm check && pnpm lint && pnpm format:check && pnpm check:strings`
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
```

### 2. Build
`pnpm build`
```
$ pnpm build:wasm && pnpm --filter web build
[INFO]: 📦   Your wasm pkg is ready to publish at web/src/lib/engine/wasm.
running 1 test
test the_types_match_the_json ... ok
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.04s
$ vite build
vite v8.3.4 building ssr environment for production...
✓ built in 1.63s
Prerendering
> Using @sveltejs/adapter-static
Wrote site to "build"
✔ done
```

### 3. Repeated Flow E2E Tests (AC4: 5x repeats on desktop and phone)
`pnpm --filter web exec playwright test --project=desktop --project=phone e2e/grammar-flow.spec.ts --repeat-each=5`
```
Running 70 tests using 6 workers
  35 skipped
  35 passed (1.3m)
```

### 4. Area E2E Tests
`pnpm --filter web exec playwright test --project=desktop --project=phone e2e/grammar-phone.spec.ts e2e/grammar-open-cnf.spec.ts e2e/grammar-cyk-limit.spec.ts`
```
Running 26 tests using 6 workers
  13 skipped
  13 passed (26.4s)
```

### 5. WebKit Cross-Browser Test
`pnpm --filter web exec playwright test --project=webkit-phone e2e/cross/workstation-phone.spec.ts`
```
Running 3 tests using 3 workers
  ✓  1 [webkit-phone] › e2e/cross/workstation-phone.spec.ts:116:1 › cross-browser grammar rule rows on webkit-phone and firefox (AC6) (3.3s)
  ✓  3 [webkit-phone] › e2e/cross/workstation-phone.spec.ts:79:1 › language phone layout on WebKit phone: tab navigation and axe (5.9s)
  ✓  2 [webkit-phone] › e2e/cross/workstation-phone.spec.ts:32:1 › grammar phone layout on WebKit phone: tab navigation, shortcut, and axe (6.0s)

  3 passed (7.4s)
```

---

## Findings & Proposed Improvements

- **Proposed item T-029 in PLAN.md:**
  In `GrammarCykTester.svelte`, `grammarText` derives CNF rule strings by concatenating RHS symbols without spaces: `${rule.lhs} -> ${rule.rhs.join('')}`. When multi-letter helper variables like `T_a` are produced by CNF conversion, this creates strings such as `T_aT_b`, which `GrammarParser` reads as a single variable token named `T_aT_b` rather than two separate variables $T_a$ and $T_b$. This triggers a non-CNF error in CYK parsing. For testing CYK, a grammar with single-character variables was used (`S -> A B | λ`, `A -> a`, `B -> b`), which runs cleanly without token ambiguity. Separating symbols with spaces (`${rule.rhs.join(' ')}`) or passing parsed `Grammar` directly into the CYK parser would resolve this for arbitrary variable names.
