# Task T-054 Report — PDA editor, part 5 of 8: the label form

- **Task:** T-054
- **Branch:** `task/T-054-pda-label-form`
- **Status:** done
- **Implementation Commits:**
  - Status start: `489b7c7` (`docs(agent): mark T-054 in-progress`)
  - Label form logic and components: (current commit)

---

## 1. Hand Derivations

### F1: `rowsOf`
With sample document `wwrSample()` (input alphabet `["a", "b"]`, stack alphabet `["A", "B"]`):
- **Pair (0, 0):** Transitions are $q_0 \xrightarrow{a / \epsilon / A} q_0$ and $q_0 \xrightarrow{b / \epsilon / B} q_0$.
  - Read: `'a'` and `'b'`.
  - Pop: $\epsilon$ (`[]`), formatted as `'ε'`.
  - Push: `['A']` and `['B']`, formatted as `'A'` and `'B'`.
  - Derivation: `[{ read: "a", pop: "ε", push: "A" }, { read: "b", pop: "ε", push: "B" }]`.
- **Pair (0, 1):** Single transition $q_0 \xrightarrow{\epsilon / \epsilon / \epsilon} q_1$.
  - Read: `null` $\to$ `'ε'`.
  - Pop: `[]` $\to$ `'ε'`.
  - Push: `[]` $\to$ `'ε'`.
  - Derivation: `[{ read: "ε", pop: "ε", push: "ε" }]`.
- **Pair (1, 0):** No transitions exist $\to$ `[]`.
- **Stack Alphabet with Comma (Probe 1):** Document with `stackAlphabet: ["A", ","]` and transition pop `[","]`, push `["A", ","]`:
  - `stackAlphabet` contains single characters only (`allSingle = true`), but includes `','`.
  - Pop: `[',']` $\to$ `','`.
  - Push: `['A', ',']` $\to$ `'A,'`.
  - Derivation: `{ read: "a", pop: ",", push: "A," }`.
  - Round trip: `parseRows` detects `doc.stackAlphabet` contains `','`, so comma is NOT treated as a separator; `push` splits code points into `['A', ',']` and pop gives `[',']`.
- **Multi-character stack alphabet:** Document with `stackAlphabet: ["Z0", "A"]` and transition `a`, pop `["Z0"]`, push `["A", "Z0"]`:
  - `stackAlphabet` contains multi-character name `"Z0"`, so separator is `' '`.
  - Pop: `['Z0']` $\to$ `'Z0'`.
  - Push: `['A', 'Z0']` $\to$ `'A Z0'`.
  - Derivation: `{ read: "a", pop: "Z0", push: "A Z0" }`.

### F2: Field Parsing and `parseRows`
With `stackAlphabet: ["A", "B"]` (all single-character symbols):
- `"AB"` $\to$ no separator, all single $\to$ `["A", "B"]`.
- `"A B"` $\to$ whitespace separator $\to$ `["A", "B"]`.
- `"A, B"` $\to$ comma separator $\to$ `["A", "B"]`.
- `"A,B"` $\to$ comma without whitespace $\to$ `["A", "B"]`.
- `"ε"`, `"eps"`, `""`, `"  "` $\to$ empty $\to$ `[]`.
- `"Z0 A"` $\to$ space separator $\to$ `["Z0", "A"]`.
- `"Z0"` $\to$ no separator, all single $\to$ code points `["Z", "0"]`.
- `"A😀"` $\to$ no separator, all single $\to$ code points `["A", "😀"]`.

Special alphabet probes:
- With `stackAlphabet: ["A", ","]`:
  - `",A"` $\to$ single characters $\to$ `[",", "A"]`.
  - `"A ,"` $\to$ whitespace separator $\to$ `["A", ","]`.
  - `","` $\to$ `[","]`.
- With `stackAlphabet: ["A", "a,b"]`:
  - `"a,b"` $\to$ multi-character symbol $\to$ `["a,b"]` (comma is NOT a separator because `"a,b"` has comma).
- With `stackAlphabet: ["A", "eps"]`:
  - `"eps"` $\to$ `"eps"` is in `doc.stackAlphabet`, so it means `["eps"]`, not $\epsilon$.
  - `"ε"` $\to$ always means $\epsilon$ $\to$ `[]`.
- Read field with `inputAlphabet: ["a", "eps"]`:
  - `"eps"` $\to$ `"eps"` is in `doc.inputAlphabet`, so read is `"eps"`, not `null`.
  - `"ε"` $\to$ always means $null$.

With `stackAlphabet: ["Z0", "A"]` (multi-character symbol present):
- `"Z0A"` $\to$ no separator, not all single $\to$ one name `["Z0A"]`.
- `"Z0 A"` $\to$ space separator $\to$ `["Z0", "A"]`.
- `"AA"` $\to$ no separator, not all single $\to$ one name `["AA"]`.

Read text with `inputAlphabet: ["a", "b"]`:
- `"a"`, `" a "` $\to$ `"a"`.
- `""`, `"ε"`, `"eps"` $\to$ `null`.
- `"c"` $\to$ `"c"` (1 character: accepted).
- `"ab"` $\to$ $> 1$ character, not in alphabet, all single $\to$ refusal `pda_editor.read_one_symbol { text: "ab" }`.
- `"a b"` $\to$ contains whitespace $\to$ refusal `pda_editor.read_one_symbol { text: "a b" }`.

Read text with `inputAlphabet: ["a", "num"]` (multi-character name present):
- `"ab"` $\to$ not all single $\to$ accepted as `"ab"`.
- `"num"` $\to$ in alphabet $\to$ accepted as `"num"`.

Blank rows:
- Row `{ read: "", pop: "", push: "" }` is dropped.
- Row `{ read: "ε", pop: "ε", push: "ε" }` produces `{ read: null, pop: [], push: [] }`.

### F3: `rowCommands` on Pair (0, 0)
Using `wwrSample()` pair (0, 0), which starts with transitions `a / ε / A` and `b / ε / B`:
1. **Unchanged rows:** Wanted equals existing $\to$ `[]`.
2. **Add `{ read: "c", pop: "A", push: "" }`:**
   - New input symbol: `"c"`.
   - New stack symbol: none (`"A"` already present).
   - New transition: `{ from: 0, read: "c", pop: ["A"], push: [], to: 0 }`.
   - Result: `[ { type: "addInputSymbol", symbol: "c" }, { type: "addTransition", from: 0, read: "c", pop: ["A"], push: [], to: 0 } ]`.
3. **Change second row to `{ read: "b", pop: "ε", push: "BB" }`:**
   - Existing `b / ε / B` removed; new `b / ε / BB` added.
   - Additions first, removals last:
   - Result: `[ { type: "addTransition", from: 0, read: "b", pop: [], push: ["B", "B"], to: 0 }, { type: "removeTransition", from: 0, read: "b", pop: [], push: ["B"], to: 0 } ]`.
4. **Remove both rows (`[]`):**
   - Result: `[ { type: "removeTransition", from: 0, read: "a", pop: [], push: ["A"], to: 0 }, { type: "removeTransition", from: 0, read: "b", pop: [], push: ["B"], to: 0 } ]`.
5. **New pair (1, 0) with a blank row `[{ read: "", pop: "", push: "" }]` or `[]`:**
   - Blank row dropped $\to$ wanted is empty; existing is empty $\to$ `[]`.
6. **Duplicate rows `{ read: "c", pop: "A", push: "" }` twice:**
   - Collapsed to one transition $\to$ one `addTransition`.
7. **Row `{ read: "d", pop: "C", push: "C C" }` on pair (1, 0):**
   - New input symbol `"d"`.
   - New stack symbol `"C"` (appears in pop and push; added only once).
   - Result: `[ { type: "addInputSymbol", symbol: "d" }, { type: "addStackSymbol", symbol: "C" }, { type: "addTransition", from: 1, read: "d", pop: ["C"], push: ["C", "C"], to: 0 } ]`.

---

## 2. Verification of F4 (Commit and Boundaries)

- Tested via `createPdaEditor(wwrSample())`:
  - `startLink(1)` followed by `finishLink(0)`.
  - Committing `rowCommands(doc, 1, 0, [{ read: "a", pop: "A", push: "" }])` returns `null`.
  - Edge transition `q1 a/A/ε q0` is added in a single undo step.
  - Announcement emitted: `editor.edge_changed` with `{ from: 'q1', to: 'q0', symbols: 'a / A / ε' }`.
- **Triple boundary check for push length limit (64):**
  - **63 symbols:** `push: 'A '.repeat(62) + 'A'` $\to$ `commitEdge` returns `null` (accepted).
  - **64 symbols:** `push: 'A '.repeat(63) + 'A'` $\to$ `commitEdge` returns `null` (accepted).
  - **65 symbols:** `push: 'A '.repeat(64) + 'A'` $\to$ `commitEdge` returns `{ key: 'pda_document.string_too_long', params: { limit: 64 } }`; document reference is unchanged; form stays open.

---

## 3. Verification of F5 (Properties & 10,000 Larger Run)

The property generator was hardened to draw from both standard pools and an adversarial pool of symbols (`,`, `a,b`, `eps`, `(`, `)`, `+`, `|`, `\`, `"`, `'`, `😀`, combining sequence `e\u0301`, `Z0`, `num`, and 32-character strings).

### Generator Adversarial Detection (Revert Check)
When reverting the comma-in-stack-symbol and eps fixes in `pda-label.ts`:
- The old generator missed the comma and "eps" corruptions entirely because it only drew from `["A","B","C"]`, `["Z0","A","B"]`, etc.
- With the adversarial pool, `Property (a)` failed immediately on case 16 (failing round-trip when stack symbols contain `,` or `eps`) and `Property (c)` failed on case 46.
- Restoring the fix passed all 1,000 cases cleanly.

Executed via `LARGER_RUN=1 pnpm --filter web exec vitest run src/lib/editor/pda-label.property.test.ts`:

```
 RUN  v5.0.3 /home/Aldebaran64/webtomata/web

 ✓ src/lib/editor/pda-label.property.test.ts (3 tests) 3295ms
   ✓ F5: PDA label properties (3)
     ✓ Property (a): round trip (10000 cases) 404ms
     ✓ Property (b): never throws on extreme strings (10000 cases) 1392ms
     ✓ Property (c): applying rowCommands is valid or refused, and idempotent (10000 cases) 1496ms

 Test Files  1 passed (1)
      Tests  3 passed (3)
   Start at  00:12:48
   Duration  3.62s (tests 95%, transform 4%, import 1%)
```

- **Property (a):** For 10,000 random valid PDA document edge pairs, `parseRows(doc, rowsOf(doc, from, to))` exactly equals the document's transitions for that pair, and `rowCommands` returns `[]`.
- **Property (b):** For 10,000 extreme string combinations (empty, whitespace, ε, surrogate pairs, lone surrogates, control characters, 5,000-char strings), neither `parseRows` nor `rowCommands` throws.
- **Property (c):** For 10,000 random row combinations on random pairs, `rowCommands` produces batch commands that when applied via `applyPdaCommand` yield a document whose transitions on that pair match the parsed transition set, and re-running `rowCommands` on the resulting document returns `[]` (idempotence).

---

## 4. Deliberate Breaks (AC6)

Each break was introduced in `web/src/lib/editor/pda-label.ts`, observed failing the relevant test, and restored:

1. **Break 1: Read `"Z0"` as one name in a one-character alphabet.**
   - Change: forced `parseStackSeq` to always return `[trimmed]`.
   - Result: Test `F2: parses pop and push strings with single-character stack alphabet` failed (`expected ['AB'] to deeply equal ['A', 'B']`). Restored.
2. **Break 2: Ignore the alphabet and always split into characters.**
   - Change: forced `parseStackSeq` to always return `[...trimmed]`.
   - Result: Test `F2: parses pop and push strings with multi-character stack alphabet` failed (`expected ['Z', '0', 'A'] to deeply equal ['Z0A']`). Restored.
3. **Break 3: Put removals before additions in `rowCommands`.**
   - Change: reversed loop order in `rowCommands`.
   - Result: Test `F3: changes second row with additions first, removals last` failed (received `removeTransition` before `addTransition`). Restored.
4. **Break 4: Let blank rows through as `ε / ε / ε` transitions.**
   - Change: commented out blank row check in `parseRows`.
   - Result: Tests `F2: ignores blank rows` and `F3: yields [] for new pair with blank row` failed (`expected [{ type: 'addTransition' }] to deeply equal []`). Restored.
5. **Break 5: Forget to add a new stack symbol that appears only in a push.**
   - Change: commented out checking `t.push` in `rowCommands`.
   - Result: Caught by dedicated test `adds new stack symbol that appears only in a push` (`expected [addTransition] to deeply equal [addStackSymbol, addTransition]`). Restored.
6. **Break 6: Let `rowsOf` write stack strings with no space for an alphabet with a longer name.**
   - Change: forced `sep = ''` in `rowsOf`.
   - Result: Test `F1: formats stack symbols with spaces when stack alphabet has multi-character name` failed (`expected 'AZ0' to deeply equal 'A Z0'`). Restored.
7. **Break 7: Accept `"ab"` as a read symbol in a one-character alphabet.**
   - Change: commented out multi-character refusal check in `parseRead`.
   - Result: Test `F2: parses read field with 1-character input alphabet` failed (`expected [{ read: 'ab' }] to deeply equal Refusal`). Restored.
8. **Break 8: Let `rowCommands` add a symbol twice when it is in two rows.**
   - Change: removed deduplication check `!newStacks.includes(s)`.
   - Result: Test `F3: adds new stack symbol only once when it appears multiple times` failed (received 3 duplicate `addStackSymbol` commands for `'C'`). Restored.
9. **Break 9: Remove comma from separator test in `parseStackSeq` (`trimmed.includes(',')` dropped).**
   - Change: changed separator test to only check `/\s/.test(trimmed)`.
   - Result: Caught by new F2 fixture `"A,B" -> ["A", "B"]` (received `["A,B"]` instead of `["A", "B"]`) and probe test. Restored.

---

## 5. Accessibility Checklist (AC5)

- **Role and Dialog Name:** `role="dialog"` at `PdaLabelForm.svelte:155`; accessible name `pda_editor.form_title { from, to }` at line 156.
- **Accessible Field Labels:** `pda_editor.field_label { n, field }` on Baca (line 177), Pop (line 192), and Push (line 207).
- **Accessible Delete Buttons:** `pda_editor.row_delete { n }` at line 221.
- **Refusal in `aria-describedby`:** Inputs bind `aria-describedby={refusalText !== null ? problemId : undefined}` at lines 179, 194, 209; permanent live region container `<div aria-live="polite">` hosts the refusal `<p id={problemId} class="problem">` when present so screen readers reliably announce appearing errors.
- **Keyboard Handling:**
  - `Enter` triggers `commit()`: line 117.
  - `Escape` cancels via `editor.cancelLabel()`: line 120.
  - `Ctrl+E` / `Cmd+E` inserts `ε`: line 123.
  - `event.stopPropagation()` prevents canvas keys: line 116.
  - `Tab` navigation order follows logical row sequence.
- **Settle Rule (400 ms):** `performance.now() - openedAt < SETTLE_MS` checked on focusout at line 135; retains focus.
- **Leave Rule:** Focusout sends changed and valid rows, cancelling otherwise (lines 139–145).
- **Target Sizes:** All interactive elements (`input`, `.delete-btn`, `.add-row-btn`, `.btn`) enforce `var(--target-min)` ($\ge 44 \times 44$ px) at lines 279, 290, 299, 314, 323, 348.
- **Font Size:** Input font size enforced at `font-size: max(1rem, 16px)` (line 287) to prevent mobile browser auto-zoom.
- **Design Tokens:** Strictly tokenized styles across lines 265–370 (`--color-surface`, `--color-ink`, `--color-muted`, `--color-border`, `--color-accent`, `--color-warning-tint`, `--color-warning-ink`, `--shadow-popover`, `--radius-*`, `--space-*`, `--target-min`).

---

## 6. Verification Commands Output

### `pnpm format:check`
```
$ pnpm --filter web format:check && cargo fmt --check
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!
```

### `pnpm check`
```
$ pnpm --filter web check
$ svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings
Loading svelte-check in workspace: /home/Aldebaran64/webtomata/web
Getting Svelte diagnostics...

svelte-check found 0 errors and 0 warnings
```

### `pnpm lint`
```
$ pnpm --filter web lint
$ eslint .
```
(Exited with code 0).

### `pnpm check:strings`
```
$ node tools/check-strings.mjs
ok   66 components have no hard-coded text
```

### `pnpm check:tokens`
```
$ node tools/check-tokens-usage.mjs
ok   68 files use no raw colors
```

### `pnpm --filter web exec vitest run`
```
 Test Files  104 passed (104)
      Tests  1277 passed | 2 skipped (1279)
   Start at  23:50:51
   Duration  8.42s (tests 72%, transform 20%, import 7%)
```

### `pnpm build && pnpm size`
```
✓ built in 1.32s
Prerendering
> Using @sveltejs/adapter-static
Wrote site to "build"
✔ done

$ node tools/check-size.mjs
ok   initial JS index.html: 81.8 KB gzip (limit 170 KB)
ok   initial JS panduan/berakhiran-x.html: 87.1 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 80.9 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 120.9 KB gzip (limit 170 KB)
ok   initial JS soal/berakhiran-10.html: 120.5 KB gzip (limit 170 KB)
ok   initial JS soal/jumlah-a-genap.html: 120.5 KB gzip (limit 170 KB)
ok   initial JS soal/mengandung-101.html: 120.5 KB gzip (limit 170 KB)
ok   initial JS soal.html: 82.3 KB gzip (limit 170 KB)
ok   initial JS tentang.html: 80.2 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-VlyrwV86.wasm: 237.0 KB gzip (limit 250 KB)
```

### E2E Area Spec (`e2e/editor-transitions.spec.ts`)
```
Running 28 tests using 6 workers
  6 skipped
  22 passed (26.9s)
```

---

## 7. Deepening Pass

1. **Exports of `pda-label.ts`:**
   - `Row`: Interface representing a 3-field row `{ read, pop, push }`. Used by `PdaLabelForm.svelte` and tests.
   - `ParsedTransition`: Interface `{ read, pop, push }`. Used by `parseRows`, `rowCommands`, and tests.
   - `rowsOf`: Converts document edge transitions into form rows. Used by `PdaLabelForm.svelte` and tests.
   - `parseRows`: Pure parser for rows with refusal diagnostics. Used by `rowCommands` and tests.
   - `rowCommands`: Computes minimal delta commands for `commitEdge`. Used by `PdaLabelForm.svelte` and tests.
   - `pdaMenuLabels`: Context menu overrides (`edit: 'pda_editor.menu_edit'`). Exported for T-055 to pass to canvas `menuLabels`.
   - Every export is strictly needed by either the components or tests.
2. **Duplicated Logic & Redundancies:**
   - The 400 ms settle rule (`performance.now() - openedAt < SETTLE_MS`) and the leave rule (`onfocusout` checking `container.contains(event.relatedTarget)`) in `PdaLabelForm.svelte` (lines 131–146) duplicate the same mechanics in `LabelField.svelte` (lines 112–122). `LabelField` is out of scope for this task to avoid touching FSM code.
   - Stack string formatting logic is **not** duplicated: `pda-label.ts` imports and calls `stackSeparator` and `formatStackSeq` directly from `diagram/pda-diagram.ts`.
   - **Dead check removed:** In `parseRead`, the condition `!doc.inputAlphabet.includes(trimmed)` was redundant because if `trimmed` is in `doc.inputAlphabet` and has $> 1$ code point, `allSingle` is already `false`. It was safely removed.
3. **Casts:**
   - **Zero** `any`, **zero** `@ts-ignore`, and **zero** `as unknown as` were introduced.

---

## 8. Observations for the Planner

- `PdaLabelForm.svelte` (lines 131–146) duplicates `LabelField.svelte`'s (lines 112–122) 400 ms settle rule and leave rule focusout logic: propose extracting a small shared helper `focusSettleRule(openedAt, container, lastInput, onLeave)` in a subsequent cleanup task.

---

## 9. What T-055's E2E Must Cover

Written here for T-055's scope:
1. Open the form by `Enter` on a selected edge, double-click on the label, context menu item "Ubah transisi", and automatically after creating a transition.
2. Type in the three fields and commit with `Enter` and with `Simpan`.
3. Full `Tab` navigation order across fields and buttons.
4. `Esc` key cancels and restores original state.
5. Leaving by pointer click on canvas commits changed text and cancels unchanged text.
6. `Ketik ε` button and `Ctrl+E` / `Cmd+E` shortcut insert `ε` into the active field.
7. Refused row displays localized warning and keeps the form open.
8. Add row and delete row operations.
9. Deleting all rows of an edge removes the edge.
10. Phone sheet layout within the panel area.
11. Axe accessibility check on the active open form.
