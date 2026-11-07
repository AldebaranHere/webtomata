# Task T-049 Report — PDA editor, part 3 of 8: the interaction core works for two kinds of document

- **Task:** T-049
- **Branch:** `task/T-049-editor-core`
- **Status:** done
- **Implementation Commits:**
  - Status start: `2818a8d` (`docs(agent): start T-049`)
  - Generic core and commitEdge: `0b031e4` (`refactor(editor): generic interaction core and commitEdge`)
  - PDA editor and full test suite: (current HEAD)

---

## 1. Hand Derivations (Fixtures F1 to F4 on `wwrSample()`)

`wwrSample()` has states `q0` (id 0, start) at `(180, 200)` and `q1` (id 1, accepting) at `(440, 200)`.
Input alphabet: `["a", "b"]`. Stack alphabet: `["A", "B"]` (all 1-char symbols, so stack separator is empty string `""`).
Transitions in canonical engine order:
- T0: `q0` reads `ε`, pops `ε`, pushes `ε` to `q1` (`from: 0, read: null, pop: [], push: [], to: 1`)
- T1: `q0` reads `a`, pops `ε`, pushes `A` to `q0` (`from: 0, read: "a", pop: [], push: ["A"], to: 0`)
- T2: `q0` reads `b`, pops `ε`, pushes `B` to `q0` (`from: 0, read: "b", pop: [], push: ["B"], to: 0`)
- T3: `q1` reads `a`, pops `A`, pushes `ε` to `q1` (`from: 1, read: "a", pop: ["A"], push: [], to: 1`)
- T4: `q1` reads `b`, pops `B`, pushes `ε` to `q1` (`from: 1, read: "b", pop: ["B"], push: [], to: 1`)

### F1: Edges
- `selectEdge(0, 1)`:
  - Selected edge: `{ from: 0, to: 1 }`.
  - State selection: `[]`.
  - Screen reader text: `transitionLabel(T0) = "ε / ε / ε"`.
  - Announcement: `editor.edge_selected { from: "q0", to: "q1", symbols: "ε / ε / ε" }`.
- `selectEdge(0, 0)`:
  - Edge transitions: T1 and T2 in order.
  - Formatted lines: `a / ε / A` and `b / ε / B`.
  - Joined by `; `: `"a / ε / A; b / ε / B"`.
  - Announcement: `editor.edge_selected { from: "q0", to: "q0", symbols: "a / ε / A; b / ε / B" }`.
- `selectEdge(1, 0)`:
  - No transition from 1 to 0 exists; `selectEdge` returns early without modifying state.
- `deleteEdge(0, 0)`:
  - Both T1 and T2 are removed in **one** undo step.
  - Transitions remaining: 3 (`T0`, `T3`, `T4`).
  - Announcement & toast: `editor.edge_removed { from: "q0", to: "q0" }`.
  - Selection: `[]`. Focus: id `0`.
  - `undo()`: gives back document reference strictly `===` initial `doc`.
- `deleteEdge(0, 1)`:
  - Removes T0, leaving 4 transitions (`T1`, `T2`, `T3`, `T4`).

### F2: Deleting a State
- `deleteStates([1])`:
  - Remaining states: `[q0]`.
  - `start`: 0.
  - `accepting`: `[]` (since state 1 was the only accepting state).
  - Transitions touching state 1 are removed: T0 (`0 -> 1`), T3 (`1 -> 1`), T4 (`1 -> 1`).
  - Transitions remaining: 2 (T1: `q0 a/ε/A q0`, T2: `q0 b/ε/B q0`).
  - History: exactly 1 undo step.
  - `undo()`: gives back document reference strictly `===` initial `doc`.
  - If edge `(1, 1)` is selected prior to `deleteStates([1])`, `state.edge` becomes `null` (since all its transitions are removed and its state is removed).

### F3: Transition Link and commitEdge
- `startLink(0)`, `finishLink(1)`:
  - Sets `state.labeling = { from: 0, to: 1, ask: null }`.
- `commitEdge([addTransition 0, read: "a", pop: ["A"], push: [], to: 1])`:
  - Returns `null`.
  - `state.labeling` becomes `null`.
  - `canUndo` becomes `true`.
  - Ordering of transitions in document:
    - `T0`: `(0, null, [], [], 1)` — read `null` sorts first.
    - `T1`: `(0, "a", [], ["A"], 0)` — read `"a"`, pop `[]` sorts before pop `["A"]`.
    - **new**: `(0, "a", ["A"], [], 1)` — read `"a"`, pop `["A"]` sorts after `[]`, and before read `"b"`.
    - `T2`: `(0, "b", [], ["B"], 0)`.
    - `T3`: `(1, "a", ["A"], [], 1)`.
    - `T4`: `(1, "b", ["B"], [], 1)`.
    - Exact resulting transition array: `[T0, T1, new, T2, T3, T4]` (6 transitions).
  - Announcement: `editor.edge_changed { from: "q0", to: "q1", symbols: "ε / ε / ε; a / A / ε" }`.
- `commitEdge([])`:
  - Returns `null`, closes the labeling box, and does **not** push a step to history (`canUndo` unchanged).
- `commitEdge([addTransition with read: "z"])`:
  - Returns refusal `{ key: "pda_document.unknown_symbol", params: { symbol: "z" } }`.
  - `state.labeling` remains `{ from: 0, to: 1, ask: null }`.
  - Document remains strictly identical object reference (`===`).
  - Announcement is the refusal message.
- `commitEdge` of commands removing all transitions of `(0, 1)`:
  - After removing T0 and the new transition, the pair has 0 transitions.
  - Announcement: `editor.edge_removed { from: "q0", to: "q1" }`.

### F4: Drag
- `beginDrag(0, p)` at `p = (180, 200)`: sets `state.dragging = true`, document unchanged.
- `dragTo(p + (40, 10))` repeated: updates `state.preview.get(0) = (220, 210)`. Document untouched.
- `endDrag()`: applies `moveState` in **one** undo step. `state.doc.states[0]` position is `(220, 210)`.
- `undo()`: gives back document reference strictly `===` initial `doc`.
- `cancelDrag()`: restores `dragging = false`, `preview = null`, document and history unchanged.

---

## 2. Shared Core Architecture & Tail Consolidation (AC4)

### 2.1 Typing of the Generic Core
`createEditorCore<D extends StatesDocument, C>(initial: D, kind: EditorKind<D, C>)`:
- History typed with `CoreCommand<C> = StateCommand | C | { type: 'batch'; commands: CoreCommand<C>[] }`.
- Method bivariance allows `kind.createHistory` to be consumed cleanly without intrusive casts across the codebase.
- `EditorKind` has exactly four members:
  1. `createHistory(initial: D): GenericHistory<D, C>`
  2. `equal(a: D, b: D): boolean`
  3. `edgeText(doc: D, from: number, to: number): string`
  4. `removeEdge(doc: D, from: number, to: number): C[]`

### 2.2 FSM `commitLabel` Calls `commitEdge`
In `web/src/lib/editor/interaction/editor.ts`:
- FSM-specific label parsing, `splitNeeded` check, and `labelCommands` calculation remain in `createEditor(initial: MachineDocument)`.
- The execution tail (sending batch/single command, handling refusal, closing label box, and announcing `editor.edge_removed` vs `editor.edge_changed`) lives solely inside `commitEdge` in `createEditorCore`:
```ts
// editor.ts lines 473-503:
function commitEdge(commands: readonly C[]): Refusal | null {
	const open = state.labeling;
	if (!open) return null;
	if (commands.length === 0) {
		closeLabel();
		return null;
	}
	const result = history.execute(
		commands.length === 1 ? commands[0]! : { type: 'batch', commands: commands as CoreCommand<C>[] }
	);
	if (!result.ok) {
		const problem = refusal(result.error);
		set({ labeling: { ...open, ask: null }, announcement: say(problem.key, problem.params) });
		return problem;
	}
	const from = nameOf(open.from);
	const to = nameOf(open.to);
	const hasTransitionsLeft = history.doc.transitions.some(
		(t) => t.from === open.from && t.to === open.to
	);
	closeLabel({
		announcement: !hasTransitionsLeft
			? say('editor.edge_removed', { from, to })
			: say('editor.edge_changed', {
					from,
					to,
					symbols: kind.edgeText(history.doc, open.from, open.to)
				})
	});
	return null;
}

// In createEditor (lines 722-740):
commitLabel(text, split) {
	const open = core.getState().labeling;
	if (!open) return null;
	let parts = parseLabel(text);
	if (split === 'split') {
		parts = splitParts(parts);
	} else if (split === undefined) {
		const long = splitNeeded(core.getState().doc, parts);
		if (long !== null) {
			core.setLabelingAsk(open, long);
			return { ask: long };
		}
	}
	const commands = labelCommands(core.getState().doc, open.from, open.to, parts);
	return core.commitEdge(commands);
}
```

The condition `!hasTransitionsLeft` perfectly matches `parts.length === 0` in FSM logic because `labelCommands` removes all transitions when `parts` is empty, leaving 0 transitions. All 113 existing FSM editor tests passed without any modifications.

---

## 3. Deliberate Breaks (AC5)

All 9 deliberate breaks were applied, observed to fail the designated test, and restored.

1. **Break 1: Let `deleteEdge` of a PDA remove only the first transition of the pair.**
   - Code modification: in `pda-editor.ts`, returned only `[first]` in `removeEdge`.
   - Failure: `src/lib/editor/interaction/pda-editor.test.ts` > F1:
     `AssertionError: expected [ Array(4) ] to have a length of 3 but got 4`
   - Restored: returned all matching transitions.

2. **Break 2: Let `commitEdge` leave the box open after a success.**
   - Code modification: in `closeLabel()`, omitted resetting `labeling: null`.
   - Failure: `src/lib/editor/interaction/pda-editor.test.ts` > F3:
     `AssertionError: expected { from: +0, to: 1, ask: null } to be null`
   - Restored: `labeling: null` retained.

3. **Break 3: Announce `edge_changed` when the pair is empty.**
   - Code modification: in `commitEdge`, always announced `edge_changed`.
   - Failure: `src/lib/editor/interaction/pda-editor.test.ts` > F3:
     `AssertionError: expected { key: 'editor.edge_changed', … } to match object { key: 'editor.edge_removed', … }`
   - Restored: conditional check `!hasTransitionsLeft ? edge_removed : edge_changed`.

4. **Break 4: Build the symbols of `edge_selected` with `, ` instead of `; `.**
   - Code modification: in `pdaEdgeText`, joined with `', '`.
   - Failure: `src/lib/editor/interaction/pda-editor.test.ts` > F1:
     `expected "a / ε / A, b / ε / B" to match "a / ε / A; b / ε / B"`
   - Restored: joined with `'; '`.

5. **Break 5: Compute `dirty` with `!==` instead of `kind.equal`.**
   - Code modification: in `commit()`, set `dirty: initial !== doc`.
   - Failure: `src/lib/editor/interaction/pda-editor.test.ts` > F5:
     `AssertionError: expected true to be false` (when setting title back to initial value).
   - Restored: `dirty: !kind.equal(initial, doc)`.

6. **Break 6: Make `createPdaEditor` use the FSM history.**
   - Code modification: in `pda-editor.ts`, passed `createHistory` from `history.ts`.
   - Failure: Caught at compile time by TypeScript / `pnpm check`:
     `Error: Type '(initial: MachineDocument, options?: ...) => History' is not assignable to type '(initial: PdaDocument) => GenericHistory<PdaDocument, PdaCommand>'. Property 'alphabet' is missing in type 'PdaDocument' but required in type 'MachineDocument'.`
   - Restored: `createPdaHistory`.

7. **Break 7: Let `removeState` leave the selected edge.**
   - Code modification: in `commit()`, disabled both the selection-clears-edge rule and the `live(state.edge)` check.
   - Failure: `src/lib/editor/interaction/pda-editor.test.ts` > F2:
     `AssertionError: expected { from: 1, to: 1 } to be null`
   - Restored: both clearing rules active in `commit()`.

8. **Break 8: Let a refused `commitEdge` close the box.**
   - Code modification: on `!result.ok`, called `closeLabel()`.
   - Failure: `src/lib/editor/interaction/pda-editor.test.ts` > F3:
     `AssertionError: expected null to deeply equal { from: 0, to: 1, ask: null }`
   - Restored: keeps box open on refusal.

9. **Break 9: Make `pdaEdgeText` sort the transitions by label.**
   - Code modification: in `pdaEdgeText`, added `.sort()`.
   - Failure: `src/lib/editor/interaction/pda-editor.test.ts` > F3:
     `expected "a / A / ε; ε / ε / ε" to match "ε / ε / ε; a / A / ε"`
   - Restored: preserving `doc.transitions` order.

---

## 4. Verification Output

### 4.1 Guard Rails
```
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
ok   63 components have no hard-coded text

$ node tools/check-tokens-usage.mjs
ok   65 files use no raw colors
```

### 4.2 Unit Tests (`vitest run`)
```
 RUN  v5.0.3 /home/Aldebaran64/webtomata/web

 Test Files  101 passed (101)
      Tests  1247 passed | 2 skipped (1249)
   Start at  20:39:38
   Duration  7.90s (tests 73%, transform 19%, import 8%)
```
All interaction suites passed:
- `document-view.test.ts` (3 tests)
- `editor.commit-edge.test.ts` (7 tests)
- `pda-editor.test.ts` (5 tests)
- `pda-editor.property.test.ts` (3 runs with seed offsets 0, 10_000, 20_000, 300 sequences each)
- `editor.test.ts`, `editor.apply.test.ts`, `editor.edges.test.ts`, `editor.link.test.ts`, `editor.states.test.ts`, `editor.property.test.ts` (all passed unedited).

### 4.3 Bundle Size (AC6)

Before (baseline on `staging`):
```
ok   initial JS index.html: 81.4 KB gzip (limit 170 KB)
ok   initial JS panduan/berakhiran-x.html: 86.5 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 80.4 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 119.9 KB gzip (limit 170 KB)
ok   initial JS soal/berakhiran-10.html: 119.5 KB gzip (limit 170 KB)
ok   initial JS soal/jumlah-a-genap.html: 119.5 KB gzip (limit 170 KB)
ok   initial JS soal/mengandung-101.html: 119.5 KB gzip (limit 170 KB)
ok   initial JS soal.html: 81.9 KB gzip (limit 170 KB)
ok   initial JS tentang.html: 79.8 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-VlyrwV86.wasm: 237.0 KB gzip (limit 250 KB)
```

After (with generic core and `pdaEdgeText`):
```
ok   initial JS index.html: 81.4 KB gzip (limit 170 KB)
ok   initial JS panduan/berakhiran-x.html: 86.5 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 80.4 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 120.0 KB gzip (limit 170 KB)  [+0.1 KB gzip]
ok   initial JS soal/berakhiran-10.html: 119.6 KB gzip (limit 170 KB) [+0.1 KB gzip]
ok   initial JS soal/jumlah-a-genap.html: 119.6 KB gzip (limit 170 KB) [+0.1 KB gzip]
ok   initial JS soal/mengandung-101.html: 119.6 KB gzip (limit 170 KB) [+0.1 KB gzip]
ok   initial JS soal.html: 81.9 KB gzip (limit 170 KB)
ok   initial JS tentang.html: 79.8 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-VlyrwV86.wasm: 237.0 KB gzip (limit 250 KB)
```
Growth on sandbox and soal routes is at most +0.1 KB gzip (well below the 1.0 KB gzip budget), and all routes stay well under 170 KB.

### 4.4 End-to-End Tests (AC7)
Command:
```
pnpm --filter web exec playwright test web/e2e/editor-bar-phone.spec.ts web/e2e/editor-checks.spec.ts web/e2e/editor-compare.spec.ts web/e2e/editor-convert.spec.ts web/e2e/editor-edges.spec.ts web/e2e/editor-flows.spec.ts web/e2e/editor-layout.spec.ts web/e2e/editor-panel-height.spec.ts web/e2e/editor-panel-tabs.spec.ts web/e2e/editor-panel.spec.ts web/e2e/editor-run.spec.ts web/e2e/editor-states.spec.ts web/e2e/editor-table.spec.ts web/e2e/editor-tests.spec.ts web/e2e/editor-tooltips.spec.ts web/e2e/editor-transitions.spec.ts web/e2e/editor-view.spec.ts web/e2e/editor.spec.ts --project=desktop --project=phone
```
Result:
```
Running 324 tests using 6 workers
  86 skipped
  238 passed (3.2m)
```
All editor e2e tests passed on both desktop and mobile phone projects.

---

## 5. Review Fixes Round (PR #169 Follow-up)

### 5.1 Elimination of Casts (Zero Casts)
By making the recursive batch commands array `readonly` in `CoreCommand<C>`:
```ts
export type CoreCommand<C> = StateCommand | C | { type: 'batch'; commands: readonly CoreCommand<C>[] };
```
TypeScript's array covariance rules allow `GenericHistory<D, C>` to be assigned directly to `GenericHistory<D, CoreCommand<C>>` through method bivariance with **zero casts**:
```ts
const history: GenericHistory<D, CoreCommand<C>> = kind.createHistory(initial);
```
In addition, `moveStatesCommands` directly returns `StateCommand | { type: 'batch'; commands: readonly CoreCommand<C>[] }` without any cast.
- `as unknown as GenericHistory<...>` in `editor.ts`: removed.
- `as unknown as C[]` in `document-view.ts`: removed.
- Two `as CoreCommand<C>[]` casts in `editor.ts`: removed.
- **Total casts remaining in `document-view.ts`, `editor.ts`, and `pda-editor.ts`**: **0**.

### 5.2 Test Gap for `commitEdge([])` (Break & Restoration)
Added explicit assertions to both FSM (`editor.commit-edge.test.ts`) and PDA (`pda-editor.test.ts`, F3) that calling `commitEdge([])` closes the label box, records no history step, and leaves the announcement and its `seq` strictly unchanged (`expect(s.announcement).toBe(annBefore)` and `expect(s.announcement?.seq).toBe(annBefore.seq)`).

**Deliberate Break:**
In `editor.ts` `commitEdge`, changed the empty commands branch to announce something:
```ts
if (commands.length === 0) {
	closeLabel({ announcement: say('editor.undone') });
	return null;
}
```
**Failure output:**
```
FAIL  src/lib/editor/interaction/editor.commit-edge.test.ts > commitEdge > with no commands closes the box, makes no step, and leaves announcement unchanged
AssertionError: expected { key: 'editor.undone' } to be { key: 'editor.hint_pick_target' } // Object.is equality

FAIL  src/lib/editor/interaction/pda-editor.test.ts > PDA editor fixtures (T-049) > F3: commitEdge on PDA
AssertionError: expected { key: 'editor.undone' } to be { key: 'editor.hint_pick_target' } // Object.is equality

Test Files  2 failed (2)
Tests  2 failed | 10 passed (12)
```
**Restoration:**
Restored back to `closeLabel()` with no announcement patch. All 16 tests in both suites pass cleanly.

### 5.3 Plugged `setLabelingAsk` Runtime Leak
`createEditor` and `createPdaEditor` now omit `setLabelingAsk` when constructing their returned objects:
- In `editor.ts`: `const { setLabelingAsk, ...core } = createEditorCore(initial, fsmKind);` and spreads `...core`.
- In `pda-editor.ts`: `const { setLabelingAsk: _, ...core } = createEditorCore(initial, pdaKind); void _; return core;`.
- In `document-view.test.ts`: Added test verifying that neither `createEditor(fsm)` nor `createPdaEditor(pda)` contains `setLabelingAsk` in `Object.keys()` or as `'setLabelingAsk' in editor`.

### 5.4 Full Verification Rerun
- `pnpm format:check`:
```
$ pnpm --filter web format:check && cargo fmt --check
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!
```
- `pnpm check`:
```
$ pnpm --filter web check
$ svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings
Loading svelte-check in workspace: /home/Aldebaran64/webtomata/web
Getting Svelte diagnostics...
svelte-check found 0 errors and 0 warnings
```
- `pnpm lint`:
```
$ pnpm --filter web lint
$ eslint .
(0 errors, 0 warnings)
```
- `pnpm check:strings && pnpm check:tokens`:
```
ok   63 components have no hard-coded text
ok   65 files use no raw colors
```
- Full Vitest test suite (`pnpm --filter web exec vitest run`):
```
Test Files  101 passed (101)
     Tests  1248 passed | 2 skipped (1250)
  Duration  8.41s
```
- Playwright editor specs (`--project=desktop --project=phone`):
```
Running 324 tests using 6 workers
  86 skipped
  238 passed (4.0m)
```
