# Task T-051 Report — PDA editor, part 9 of 12: the panel: tabs, kind switch, checks (read-only table and definition)

- **Task:** T-051
- **Branch:** `task/T-051-pda-panel`
- **Status:** done
- **Implementation Commits:**
  - `docs(agent): start task T-051 (set status in-progress)`
  - `refactor(editor): make checker and kind switch generic for PDA and FSM`
  - `feat(pda): add PDA checks, transition table, and formal definition models`
  - `feat(pda): add PdaTableView and PdaDefinitionView components`
  - `feat(pda): add PDA side panel with kind switch, checks, and onmore interaction`
  - `test(pda): add comprehensive e2e specs for PDA panel (E1 to E8)`
  - `docs(decisions): add ADR 0049 for PDA side panel architecture`
  - `docs(glossary): add Indonesian terms for PDA panel`
  - `docs(agent): mark T-051 as done`
- **PR:** To `staging` from `task/T-051-pda-panel`

---

## 1. Hand Derivations of Fixtures F1 to F4 (Derived Prior to Coding)

### Fixture F1: `pdaTableOf(F)`
- **Machine F** (`kind: 'dpda'`):
  - Input alphabet $\Sigma = \{a, b\}$, stack alphabet $\Gamma = \{A\}$.
  - States: $q_0$ (id 0, start), $q_1$ (id 1, accepting).
  - Transitions in canonical order:
    1. $(q_0, a, \varepsilon \to A, q_0)$
    2. $(q_0, b, A \to \varepsilon, q_1)$
    3. $(q_1, b, A \to \varepsilon, q_1)$
  - Output rows:
    - Row 1: `q0 | a | ε | A | q0`
    - Row 2: `q0 | b | A | ε | q1`
    - Row 3: `q1 | b | A | ε | q1`
  - Adding stack symbol $Z_0$ and transition $(q_1, \varepsilon, Z_0 \to A Z_0, q_1)$:
    - In canonical transition ordering (`comparePdaTransitions`), $\varepsilon$-read transitions sort before character reads (`null < 'b'`).
    - The new row is placed first among $q_1$'s transitions: `q1 | ε | Z0 | A Z0 | q1`.
    - Because $Z_0$ is a multi-character symbol name, push symbols are formatted with spaces: `A Z0`.

### Fixture F2: `pdaDefinitionText(F)`
- Formal 6-tuple: $M = (K, \Sigma, \Gamma, \Delta, s, A)$
  - $K = \{q_0, q_1\}$
  - $\Sigma = \{a, b\}$
  - $\Gamma = \{A\}$
  - $s = q_0$
  - $A = \{q_1\}$
  - $\Delta$:
    - `((q0, a, ε), (q0, A))`
    - `((q0, b, A), (q1, ε))`
    - `((q1, b, A), (q1, ε))`
- If start state is missing, $s = \text{–}$. Empty sets display as $\{\}$.
- Hint: `pda_editor.definition_hint` ("Kiri = puncak stack. ε pada pop: tidak memeriksa stack.").

### Fixture F3: Engine Checks for Machine F (DPDA)
- Validated against the real WASM engine `engine.validatePda`:
  - Result: `ok: true, value: []` (0 issues).
  - Panel displays calm state "lengkap" (reusing `check.all_clear`).

### Fixture F4: Engine Checks for Machine G (DPDA vs NDPDA)
- **Machine G** = Machine F with transition $(q_0, \varepsilon, \varepsilon \to \varepsilon, q_1)$ added:
  - Canonical sort order: $\varepsilon$-read sorts first, becoming Row 1 (index 0). Rows of F become Rows 2, 3, 4.
  - On DPDA:
    - Row 1 $(q_0, \varepsilon, \varepsilon \to \varepsilon, q_1)$ competes with Row 2 $(q_0, a, \varepsilon \to A, q_0)$ (index 0 and 1).
    - Row 1 $(q_0, \varepsilon, \varepsilon \to \varepsilon, q_1)$ competes with Row 3 $(q_0, b, A \to \varepsilon, q_1)$ (index 0 and 2).
    - Engine returns 2 error issues for `pda.competing_transitions`.
    - `pdaCheckItems` maps engine indices (0-based) to 1-based table row numbers: `first: 1, second: 2` and `first: 1, second: 3`. State $q_0$ is mapped from param `from` into `state` and added to `states: [0]`, marking $q_0$ with problem flag on the diagram.
  - On NDPDA:
    - Engine returns 0 issues (`ok: true, value: []`). Competing transitions are permitted in NDPDA.

---

## 2. Deliberate Breaks (AC5)

Every deliberate break was executed on the final codebase, observed failing with exact error output and line numbers captured, and then restored.

### Break 1: Pass `tabs=['simulation','table','definition']` to the PDA panel
- **File:** `web/src/lib/editor/PdaEditor.svelte:109`
- **Modification:** Changed `const tabs: readonly PanelTab[] = ['table', 'definition'];` to `const tabs: readonly PanelTab[] = ['simulation', 'table', 'definition'];`.
- **Intended Failure:** E1 (`e2e/pda-panel.spec.ts`) asserts no Simulasi tab exists on PDA panel.
- **Observed Output:**
```
  1) [desktop] › e2e/pda-panel.spec.ts:65:2 › E1: Panel tabs and layout › desktop: exactly two tabs (Tabel, Definisi), Tabel open by default, remembers valid tab

    Error: expect(locator).toHaveCount(expected) failed

    Locator:  getByRole('complementary', { name: 'Panel' }).getByRole('tab', { name: 'Simulasi' })
    Expected: 0
    Received: 1
    Timeout:  5000ms

      78 | 		// PDA panel has exactly two tabs: Tabel and Definisi
      79 | 		await expect(side.getByRole('tab')).toHaveCount(2);
    > 80 | 		await expect(panel(page).getByRole('tab', { name: 'Simulasi' })).toHaveCount(0);
         | 		                                                                 ^
      81 | 		await expect(panel(page).getByRole('tab', { name: 'Konversi' })).toHaveCount(0);
        at /home/Aldebaran64/webtomata/web/e2e/pda-panel.spec.ts:80:68
```
- **Status:** Verified and restored.

---

### Break 2: Make `pdaTableOf` sort by insertion order instead of `doc.transitions`
- **File:** `web/src/lib/editor/pda-table.ts:25`
- **Modification:** Changed `doc.transitions.map(...)` to `[...doc.transitions].reverse().map(...)`.
- **Intended Failure:** F1 unit test (`pda-table.test.ts`) asserts canonical transition order (Row 1 $\varepsilon$ read first).
- **Observed Output:**
```
 FAIL  src/lib/editor/pda-table.test.ts > PDA table model > F1: returns rows in canonical engine order with formatted stack symbols
AssertionError: expected [ { index: 0, from: 1, …(6) }, …(3) ] to deeply equal [ { index: 0, from: 1, …(6) }, …(3) ]

- Expected
+ Received

  [
    {
      "from": 1,
      "fromName": "q1",
      "index": 0,
-     "pop": "Z0",
-     "push": "A Z0",
-     "read": "ε",
+     "pop": "A",
+     "push": "ε",
+     "read": "b",
      "to": 1,
      "toName": "q1",
    },
...
 ❯ src/lib/editor/pda-table.test.ts:55:22
```
- **Status:** Verified and restored.

---

### Break 3: Treat `first` and `second` as state IDs in `pdaCheckItems`
- **File:** `web/src/lib/editor/pda-checks.ts:28-29`
- **Modification:** Added `'first'` and `'second'` to the state ID condition in `pdaCheckItems`:
  ```typescript
  if (
      (name === 'from' || name === 'state' || name === 'first' || name === 'second') &&
      typeof value === 'number'
  )
  ```
- **Intended Failure:** F4 unit test (`pda-checks.test.ts`) asserts `first` and `second` remain 1-based table row numbers (1, 2) rather than resolving to state names ("q0", "q1").
- **Observed Output:**
```
 FAIL  src/lib/editor/pda-checks.test.ts > pdaCheckItems > F4: G as DPDA produces 2 competing_transitions error items with 1-based row numbers 1, 2 and 1, 3
AssertionError: expected [ { severity: 'error', …(3) }, …(1) ] to deeply equal [ { severity: 'error', …(3) }, …(1) ]

- Expected
+ Received

  [
    {
      "key": "pda_check.competing_transitions",
      "params": {
-       "first": 1,
-       "second": 2,
-       "state": "q0",
+       "state": "q1",
      },
      "severity": "error",
      "states": [
+       0,
        0,
+       1,
      ],
    },
    {
      "key": "pda_check.competing_transitions",
      "params": {
-       "first": 1,
-       "second": 3,
-       "state": "q0",
+       "state": "2",
      },
      "severity": "error",
      "states": [
+       0,
        0,
      ],
    },
  ]

 ❯ src/lib/editor/pda-checks.test.ts:97:17
```
- **Status:** Verified and restored.

---

### Break 4: Do not clear `marked` when document changes
- **File:** `web/src/lib/editor/PdaEditor.svelte:58-60`
- **Modification:** Omitted `marked = new Set(); markedEdge = null;` when `nextState.doc !== lastDoc`.
- **Intended Failure:** E5 (`e2e/pda-panel.spec.ts`) verifies that changing the document (switching kind) while an edge is selected clears row marks.
- **Observed Output:**
```
  1) [desktop] › e2e/pda-panel.spec.ts:363:2 › E5: + n lagi interaction › Pilih tool opens table and marks edge rows; Hapus tool deletes without opening panel

    Error: expect(locator).toHaveCount(expected) failed

    Locator:  getByRole('complementary', { name: 'Panel' }).locator('tbody tr[aria-current="true"]')
    Expected: 0
    Received: 4
    Timeout:  5000ms

      417 | 		// Changing document (e.g. kind switch) clears the marks even when edge remains selected
      418 | 		await page.getByRole('radio', { name: 'DPDA', exact: true }).click();
    > 419 | 		await expect(markedRows).toHaveCount(0);
          | 		                         ^
      420 | 		await page.getByRole('radio', { name: 'NDPDA', exact: true }).click();
        at /home/Aldebaran64/webtomata/web/e2e/pda-panel.spec.ts:419:28
```
- **Status:** Verified and restored.

---

### Break 5: Make Hapus call `onmore`
- **File:** `web/src/lib/editor/EditorCanvas.svelte:594`
- **Modification:** Added `if (done.overflow) triggerMore(done.edge.from, done.edge.to);` inside `if (view.tool === 'delete')`.
- **Intended Failure:** E5 (`e2e/pda-panel.spec.ts`) asserts that clicking `+ n lagi` with Hapus tool deletes edge without opening Tabel tab.
- **Observed Output:**
```
  1) [desktop] › e2e/pda-panel.spec.ts:363:2 › E5: + n lagi interaction › Pilih tool opens table and marks edge rows; Hapus tool deletes without opening panel

    Error: expect(locator).toHaveAttribute(expected) failed

    Locator:  getByRole('complementary', { name: 'Panel' }).getByRole('tab', { name: 'Tabel' })
    Expected: "false"
    Received: "true"
    Timeout:  5000ms

      437 | 		// Toast offers Urungkan
      438 | 		await expect(page.getByRole('status')).toContainText('dihapus');
    > 439 | 		await expect(tab(page, 'Tabel')).toHaveAttribute('aria-selected', 'false');
          | 		                                 ^
        at /home/Aldebaran64/webtomata/web/e2e/pda-panel.spec.ts:439:36
```
- **Status:** Verified and restored.

---

### Break 6: Send `setKind` as two commands instead of one
- **File:** `web/src/lib/editor/PdaEditor.svelte:123`
- **Modification:** Dispatched two consecutive commands on kind switch: `editor.apply({ type: 'setKind', kind }); editor.apply({ type: 'setTitle', title: snapshot.doc.title + '!' });`.
- **Intended Failure:** E2 (`e2e/pda-panel.spec.ts`) asserts single undo restores previous kind NDPDA.
- **Observed Output:**
```
  1) [desktop] › e2e/pda-panel.spec.ts:143:2 › E2: Kind switch DPDA | NDPDA › default NDPDA, DPDA is one undo step, arrow keys work, G shows competing errors

    Error: expect(locator).toBeChecked() failed

    Locator:  getByRole('complementary', { name: 'Panel' }).getByRole('radio', { name: 'NDPDA', exact: true })
    Expected: checked
    Received: unchecked
    Timeout:  5000ms

      162 | 		const undoBtn = page.getByRole('button', { name: /Urungkan/i });
      163 | 		await undoBtn.click();
    > 164 | 		await expect(ndpda).toBeChecked();
          | 		                    ^
        at /home/Aldebaran64/webtomata/web/e2e/pda-panel.spec.ts:164:23
```
- **Status:** Verified and restored.

---

### Break 7: Leave the `flags` prop out of `<EditorCanvas>`
- **File:** `web/src/lib/editor/PdaEditor.svelte:240`
- **Modification:** Omitted `{flags}` from `<EditorCanvas ...>`.
- **Intended Failure:** E2 asserts state $q_0$ has problem flag on diagram when competing transitions exist.
- **Observed Output:**
```
  1) [desktop] › e2e/pda-panel.spec.ts:143:2 › E2: Kind switch DPDA | NDPDA › default NDPDA, DPDA is one undo step, arrow keys work, G shows competing errors

    Error: expect(locator).toHaveCount(expected) failed

    Locator:  locator('svg.world g.flag')
    Expected: 1
    Received: 0
    Timeout:  5000ms

      210 | 		await expect(side.getByText(/transisi baris 1 dan 2 dari q0 bersaing/i)).toBeVisible();
      211 | 		await expect(side.getByText(/transisi baris 1 dan 3 dari q0 bersaing/i)).toBeVisible();
    > 212 | 		await expect(page.locator('svg.world g.flag')).toHaveCount(1);
          | 		                                               ^
        at /home/Aldebaran64/webtomata/web/e2e/pda-panel.spec.ts:212:50
```
- **Status:** Verified and restored.

---

### Break 8: Call the engine before the first draw
- **File:** `web/src/lib/editor/PdaEditor.svelte:84`
- **Modification:** Added `if (typeof window !== 'undefined') void engine.validatePda(toEnginePda(snapshot.doc));` directly in the top-level `<script>` block outside `$effect`.
- **Intended Failure:** E8 (`e2e/pda-panel.spec.ts`) asserts the engine worker is never requested before the first draw (`.editor[data-ready]`).
- **Observed Output:**
```
  1) [desktop] › e2e/pda-panel.spec.ts:528:2 › E8: Timing of engine worker request › the engine worker is requested after the first draw, not before

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: false
    Received: true

      545 | 		firstDrawn = true;
      546 |
    > 547 | 		expect(workerRequestedBeforeDraw).toBe(false);
          | 		                                  ^
        at /home/Aldebaran64/webtomata/web/e2e/pda-panel.spec.ts:547:37
```
- **Status:** Verified and restored.

---

### Break K2: Phone `+ n lagi` must show the panel
- **File:** `web/src/lib/editor/PdaEditor.svelte:142`
- **Modification:** Omitted `sidePanel?.show();` from `handleMore`.
- **Intended Failure:** E5 phone test (`e2e/pda-panel.spec.ts:470`) verifies that tapping `+ n lagi` on phone when the bottom panel is hidden causes `sidePanel?.show()` to un-hide the panel, open the Tabel tab, and mark the rows.
- **Observed Output:**
```
  1) [phone] › e2e/pda-panel.spec.ts:470:2 › E5: + n lagi interaction › phone: tap + n lagi in Pilih shows hidden panel, opens Tabel tab, and marks rows

    Error: Timed out 5000ms waiting for expect(locator).toBeVisible()

    Locator: getByRole('complementary', { name: 'Panel' }).getByRole('button', { name: 'Sembunyikan panel' })
    Expected: visible
    Received: <element(s) not found>

      512 | 		// The panel is shown (hidden = false), Tabel tab is open, and all 4 rows are marked
      513 | 		await expect(side.getByRole('button', { name: 'Sembunyikan panel' })).toBeVisible();
    > 514 | 		await expect(side.locator('.content')).toBeVisible();
          | 		                                       ^
        at /home/Aldebaran64/webtomata/web/e2e/pda-panel.spec.ts:514:41
```
- **Status:** Verified and restored.

---

### Break K3: Another selection must clear the marks
- **File:** `web/src/lib/editor/PdaEditor.svelte:66`
- **Modification A (state selection):** Replaced `nextState.selection.length > 0 || differentEdge` with `false || differentEdge`.
- **Intended Failure A:** E5 desktop test (`e2e/pda-panel.spec.ts:420`) asserts that selecting a state after `+ n lagi` clears `aria-current` marked rows.
- **Observed Output A:**
```
  1) [desktop] › e2e/pda-panel.spec.ts:363:2 › E5: + n lagi interaction › Pilih tool opens table and marks edge rows; Hapus tool deletes without opening panel

    Error: expect(locator).toHaveCount(expected) failed

    Locator:  getByRole('complementary', { name: 'Panel' }).locator('tbody tr[aria-current="true"]')
    Expected: 0
    Received: 4
    Timeout:  5000ms

      420 | 		// Selecting a state clears the marks (Break K3)
      421 | 		await stateBtn(page, 'q0').click();
    > 422 | 		await expect(panel(page).locator('tbody tr[aria-current="true"]')).toHaveCount(0);
          | 		                                                                   ^
      423 |
      424 | 		// Mark rows again
        at /home/Aldebaran64/webtomata/web/e2e/pda-panel.spec.ts:422:70
```
- **Modification B (different edge selection):** Replaced `nextState.selection.length > 0 || differentEdge` with `nextState.selection.length > 0 || false`.
- **Intended Failure B:** E5 desktop test (`e2e/pda-panel.spec.ts:428`) asserts that clicking a different edge (`g[data-edge="1>1"] .hit-label`) clears `aria-current` marked rows.
- **Observed Output B:**
```
  1) [desktop] › e2e/pda-panel.spec.ts:363:2 › E5: + n lagi interaction › Pilih tool opens table and marks edge rows; Hapus tool deletes without opening panel

    Error: expect(locator).toHaveCount(expected) failed

    Locator:  getByRole('complementary', { name: 'Panel' }).locator('tbody tr[aria-current="true"]')
    Expected: 0
    Received: 4
    Timeout:  5000ms

      428 | 		// Selecting a different edge clears the marks (Break K3)
      429 | 		await page.locator('g[data-edge="1>1"] .hit-label').click();
    > 430 | 		await expect(panel(page).locator('tbody tr[aria-current="true"]')).toHaveCount(0);
          | 		                                                                   ^
      431 |
      432 | 		// Mark rows again
        at /home/Aldebaran64/webtomata/web/e2e/pda-panel.spec.ts:430:70
```
- **Status:** Verified and restored.

---

## 3. Deepening Pass

1. **New Public Exports & Public Interface Additions**:
   - `web/src/lib/editor/pda-table.ts`:
     - `export interface PdaTableRow`: 8 fields (`index`, `from`, `fromName`, `read`, `pop`, `push`, `to`, `toName`).
     - `export interface PdaTableModel`: `{ rows: readonly PdaTableRow[] }`.
     - `export function pdaTableOf(doc: PdaDocument): PdaTableModel`: pure function mapping document transitions in engine sort order to table rows.
   - `web/src/lib/editor/pda-definition.ts`:
     - `export interface PdaDefinitionModel`: formal 6-tuple sets and delta lines.
     - `export function pdaDefinitionOf(doc: PdaDocument): PdaDefinitionModel`
     - `export function pdaDefinitionText(doc: PdaDocument): string`: textual formal representation for tests and serialization.
   - `web/src/lib/editor/pda-checks.ts`:
     - `export function pdaCheckItems(issues: readonly Issue[], doc: PdaDocument): readonly CheckItem[]`: maps Rust engine issues to UI check items, handling 1-based row indices for `first` and `second`.
   - `web/src/lib/editor/checker.ts`:
     - `export interface CheckerOptions<D>`: generalized validator for arbitrary document types `D`.
     - `export function createChecker<D>(options: CheckerOptions<D>): Checker<D>`
   - `web/src/lib/editor/KindSwitch.svelte`:
     - `export interface KindOption<K>`: generalized option structure for radio group.
   - `web/src/lib/editor/SidePanel.svelte`:
     - `export function show(): void`: imperative trigger to make bottom sheet visible on mobile.
     - Snippets `simulation` and `conversion` made optional (`Snippet | undefined`).

2. **Reused Logic & Zero Duplication**:
   - `pda-table.ts` and `pda-definition.ts` reuse `formatStackSeq` and `stackSeparator` directly from `diagram/pda-diagram.ts`. No duplicate stack symbol formatting was created.
   - `checker.ts` and `KindSwitch.svelte` are shared across FSM and PDA with zero regression to FSM behavior.

3. **Duplication between `Editor.svelte` and `PdaEditor.svelte`**:
   - Autosave logic is unified in `useAutosaveBinding`.
   - Checker orchestration follows the exact same reactive pattern (`createChecker`, `$effect`, `read`, `schedule`, `dispose`).
   - Differences retained: `Editor.svelte` hosts FSM tools, tests, and run modes; `PdaEditor.svelte` hosts PDA label forms, sheet overlay replacement, and PDA table/definition views.

4. **Cast Count**:
   - `0` casts (`any`, `@ts-ignore`, `as unknown as`). All types are strictly checked.

5. **Size Numbers Before & After**:
   - Initial JS `sandbox.html`: **124.8 KB gzip** before (`staging`) -> **125.5 KB gzip** after (`task/T-051-pda-panel`) (+0.7 KB raw, limit 170 KB, within budget).
   - PDA editor chunk:
     - Before on `staging`: **14.47 kB raw (5.37 kB gzip)** (chunk `ChakwWL3.js`)
     - After on `task/T-051-pda-panel`: **18.19 kB raw (6.70 kB gzip)** (chunk `BBg0E02t.js`)
     - Net increase: +3.72 kB raw (+1.33 kB gzip) for the full panel implementation (tabs, kind switch, checker wiring, table view import, definition view import, and selection sync).
   - Lazy on-demand chunks (loaded only when their respective panel tab opens):
     - `PdaTableView`: 2.47 kB raw (1.07 kB gzip)
     - `PdaDefinitionView`: 2.46 kB raw (1.16 kB gzip)
   - Engine WASM binary: **237.0 KB gzip** (budget 250 KB, unchanged).

6. **Line-by-Line Spec Edits Documentation & Relocated Checks**:
   - `web/e2e/cross/pda-storage.spec.ts`:
     - Line 8: Added import of `engineSettled` from `../fixtures.ts`.
     - Lines 83–86 (S3): Replaced `expect(wasmRequested).toBe(false)` with `await engineSettled(page)`.
       *Reason:* In T-057 (ADR 0048), S3 checked that the WASM engine was not loaded when visiting PDA mode because PDA had no checker. T-051 (ADR 0049) supersedes this: PDA mode now runs `validatePda` via the engine worker to validate automata and detect competing transitions. The timing constraint (that the engine worker is never requested *before* the first draw) was preserved and relocated to test E8 (`web/e2e/pda-panel.spec.ts:601-625`, verified by deliberate Break 8). S3 now calls `await engineSettled(page)` to allow async checks to cleanly finish without lingering unhandled worker messages.
     - Lines 110, 125, 128 (S4) & Lines 151, 164, 193 (S5): Adjusted mobile tap $y$-coordinates from $y = 350$ / $450$ to $y = 120$ / $150$.
       *Reason:* On mobile phones (e.g. Pixel 7 / iPhone 13, viewport height $\approx$ 667–892 px), adding the bottom side panel occupying 40% of the screen height reduced the visible canvas height from 611 px down to 319 px. Tapping at $y = 350$ or $450$ previously landed on the bottom panel area rather than the canvas SVG stage. Placing test states in the upper third of the canvas ($y = 120$–$150$) ensures taps reliably target the interactive canvas across phone screens.
   - `web/e2e/pda-editor.spec.ts`:
     - Lines 585, 595 (E8): Adjusted tap $y$-coordinates for mobile bottom sheet test to upper canvas ($y = 120$–$150$) for the exact same physical reason (bottom panel takes 40% height on phone viewport).

---

## 4. Verification Command Outputs

### Quality Checks Gate
```
$ pnpm format:check && pnpm check && pnpm lint && pnpm check:strings && pnpm check:tokens
$ pnpm --filter web format:check && cargo fmt --check
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!
$ pnpm --filter web check
$ svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings
Loading svelte-check in workspace: /home/Aldebaran64/webtomata/web
Getting Svelte diagnostics...

svelte-check found 0 errors and 0 warnings
$ pnpm --filter web lint
$ eslint .
$ node tools/check-strings.mjs
ok   71 components have no hard-coded text
$ node tools/check-tokens-usage.mjs
ok   73 files use no raw colors
```

### Unit Tests
```
$ pnpm --filter web exec vitest run
 Test Files  111 passed (111)
      Tests  1311 passed | 2 skipped (1313)
   Start at  23:09:22
   Duration  11.79s (tests 73%, transform 20%, import 7%)
```

### Build & Size
```
$ pnpm build && pnpm size
ok   initial JS index.html: 82.3 KB gzip (limit 170 KB)
ok   initial JS panduan/berakhiran-x.html: 89.4 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 83.1 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 125.5 KB gzip (limit 170 KB)
ok   initial JS soal/berakhiran-10.html: 125.0 KB gzip (limit 170 KB)
ok   initial JS soal/jumlah-a-genap.html: 125.0 KB gzip (limit 170 KB)
ok   initial JS soal/mengandung-101.html: 125.0 KB gzip (limit 170 KB)
ok   initial JS soal.html: 84.6 KB gzip (limit 170 KB)
ok   initial JS tentang.html: 82.4 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-VlyrwV86.wasm: 237.0 KB gzip (limit 250 KB)
```

### E2E Desktop Suite
`playwright test pda-panel pda-editor pda-storage --project=desktop`
```
  4 skipped
  22 passed (25.1s)
```

### E2E Phone Suite
`playwright test pda-panel pda-editor pda-storage --project=phone`
```
  9 skipped
  17 passed (19.5s)
```

### E2E WebKit Phone Suite
`playwright test e2e/cross/pda-storage.spec.ts --project=webkit-phone`
```
  6 passed (8.9s)
```

### Git Diff Stat
```
$ git diff --stat origin/staging
 docs/agent/PLAN.md                          |   2 +-
 docs/agent/REPORT.md                        | 771 +++++++++++++++++-----------
 docs/decisions/0049-pda-panel.md            |  39 ++
 docs/glossary.md                            |   3 +
 web/e2e/cross/pda-storage.spec.ts           |  16 +-
 web/e2e/pda-editor.spec.ts                  |   8 +-
 web/e2e/pda-panel.spec.ts                   | 625 ++++++++++++++++++++++
 web/src/lib/editor/Editor.svelte            |   7 +-
 web/src/lib/editor/KindSwitch.svelte        |  60 ++-
 web/src/lib/editor/PdaDefinitionView.svelte | 108 ++++
 web/src/lib/editor/PdaEditor.svelte         | 155 +++++-
 web/src/lib/editor/PdaTableView.svelte      | 128 +++++
 web/src/lib/editor/SidePanel.svelte         |  39 +-
 web/src/lib/editor/checker.ts               |  30 +-
 web/src/lib/editor/pda-checks.test.ts       | 153 ++++++
 web/src/lib/editor/pda-checks.ts            |  51 ++
 web/src/lib/editor/pda-definition.test.ts   |  96 ++++
 web/src/lib/editor/pda-definition.ts        |  51 ++
 web/src/lib/editor/pda-table.test.ts        | 131 +++++
 web/src/lib/editor/pda-table.ts             |  37 ++
 web/src/lib/i18n/en.ts                      |  18 +-
 web/src/lib/i18n/id.ts                      |  17 +-
 22 files changed, 2187 insertions(+), 358 deletions(-)
```
Zero files changed in `crates/`.
