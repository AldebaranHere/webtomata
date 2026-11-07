# Task T-053 Report — PDA editor, part 4 of 8: the canvas works for two kinds of document

- **Task:** T-053
- **Branch:** `task/T-053-canvas-two-documents`
- **Status:** done
- **Implementation Commits:**
  - Status start: `e2496bb` (`docs(agent): mark T-053 in-progress`)
  - Generic canvas and label slot: `dcb786b` (`feat(editor): generic canvas and label slot for two document kinds`)
  - Fix round (one path, null check, Delete tool): (current HEAD)

---

## 1. Hand Derivations (Fixtures F1 and F2)

### F1: The Overflow Target
For a label box $\{ x: 102.8, y: -60, \text{width}: 94.4, \text{height}: 56 \}$ with 3 lines and `overflow: true`:
- The line pitch constants in `diagram/geometry.ts` are `LABEL_HEIGHT = 20`, `LINE_PITCH = 18`.
- The vertical center of line $i$ is calculated by:
  $$\text{labelLineY}(box, i) = \text{round}(box.y + \text{LABEL\_HEIGHT} / 2 + \text{LINE\_PITCH} \times i)$$
- For line index 2 (the 3rd line):
  $$\text{labelLineY}(box, 2) = -60 + 10 + 18 \times 2 = -60 + 46 = -14$$
- The overflow touch target is 44 px high, centered vertically on the last line center:
  $$y = \text{round}(\text{lastCenterY} - 22) = -14 - 22 = -36$$
  $$x = box.x = 102.8$$
  $$\text{width} = box.width = 94.4$$
  $$\text{height} = 44$$
  Target Box: $\{ x: 102.8, y: -36, \text{width}: 94.4, \text{height}: 44 \}$.

For a label box with 2 lines, height 38, $y = 0$, and `overflow: true`:
- Line index 1 (the 2nd line):
  $$\text{labelLineY}(box, 1) = 0 + 10 + 18 = 28$$
- Overflow target:
  $$y = 28 - 22 = 6$$
  $$x = box.x$$
  $$\text{height} = 44$$
  Target Box: $\{ x: box.x, y: 6, \text{width}: box.width, \text{height}: 44 \}$.

For a label without overflow (`overflow: undefined` or `false`):
- `overflowTarget(label)` returns `null`.

For a label narrower than 44 px (e.g. 1-character box $\{ x: 100, y: 0, \text{width}: 20, \text{height}: 20 \}$):
- If `overflow: true`, target width is $box.width = 20$, height is 44.
- In practice, FSM labels never have `overflow: true`, so `overflowTarget` is always `null` for FSM labels.

### F2: `pdaDiagram` Overflow Flag
- Edge with 3 transitions ($\le 3$): exactly 3 lines (`[l0, l1, l2]`), no truncation, and `overflow` is **omitted** (`'overflow' in edge` is `false`).
- Edge with 4 transitions ($> 3$): 3 lines (`[l0, l1, "+ 2 lagi"]`), `overflow: true`.
- Edge with 70 transitions ($> 3$): 3 lines (`[l0, l1, "+ 68 lagi"]`), `overflow: true`.
- Through `diagramGeometry`, `LabelShape` receives `overflow: true` if and only if `edge.overflow === true`. For FSM documents via `fsmDiagram`, `overflow` is completely omitted from all labels, preserving identity against baseline `fsm-shapes.json`.

---

## 2. Four Key Protocol Points

1. **DiagramDrawing Event Architecture, One Path, and E2E Coverage for T-055:**
   - *Why both paths existed and only one remains:* DiagramDrawing initially included an inline `onclick` on `.hit-overflow` alongside `EditorCanvas` pointer-up handling, masked by a 250 ms debounce timer. WebTomata's architecture designates `DiagramDrawing` as a passive SVG renderer while `EditorCanvas` coordinates pointer and tool gestures; the duplicate click handler, timer debounce, and `onmore` prop on `DiagramDrawing` were eliminated, preserving solely the canvas pointer path.
   - *Reachability & T-055 E2E requirements:* Because no PDA screen or route exists yet (T-054/T-055), no current test reaches the `onmore` trigger. T-055's e2e suite must explicitly cover:
     1. A press on "+ n lagi" selects the edge and calls `onmore` exactly once (opening the Tabel tab).
     2. A press elsewhere on the multi-line label selects the edge without triggering `onmore`.
     3. When the Delete tool is active, a press on "+ n lagi" deletes the edge rather than invoking `onmore`.
2. **Type Test via Vitest:**
   - Vitest runs without Svelte component compilation in Node, so `EditorCanvas.svelte` is imported via `import type EditorCanvas from './EditorCanvas.svelte'` and `import type { EditorCanvasProps } from './EditorCanvas.svelte'`.
   - The test file `src/lib/editor/EditorCanvas.type.test.ts` contains a runtime `describe` and `it` block validating that both FSM (`EditorCanvasProps<MachineDocument, Command>`) and PDA (`EditorCanvasProps<PdaDocument, PdaCommand>`) satisfy the prop constraints without errors.
3. **Drag Preview without Casts:**
   - Rather than spreading `{ ...view.doc, states: ... }` (which does not type as generic `D` without a forbidden cast), the canvas calls `diagram(view.doc)` once to produce `baseInput: DiagramInput`.
   - It then maps the preview states directly onto `baseInput.states`:
     ```ts
     const shown = $derived.by(() => {
       const input = diagram(view.doc);
       if (!view.drag) return input;
       const { places } = view.drag;
       return {
         ...input,
         states: input.states.map((s) => places.get(s.id) ?? s)
       };
     });
     ```
   - `shown.states` is also cleanly passed to `linkLine(...)`. This requires zero type assertions or casts.
4. **Quick Loop Paths:**
   - Ran `pnpm --filter web exec vitest run src/lib/editor/diagram/geometry.test.ts` and `src/lib/editor/diagram/pda-diagram.test.ts` relative to `web/`.

---

## 3. Deliberate Breaks (AC6)

### Break 1: `overflowTarget` Height 40 px instead of 44 px
- **Modification:** Changed `const TARGET_H = 44` to `40` (and `y: round(lastCenterY - 20)`) in `geometry.ts`.
- **Command:** `pnpm --filter web exec vitest run src/lib/editor/diagram/geometry.test.ts`
- **Output:**
```
 FAIL  src/lib/editor/diagram/geometry.test.ts > multi-line labels and DiagramInput (T-039) > overflowTarget and overflow (T-053) > F1: calculates overflow target 44px high centered on the last line
AssertionError: expected { x: 102.8, y: -34, width: 94.4, …(1) } to deeply equal { x: 102.8, y: -36, width: 94.4, …(1) }

- Expected
+ Received

  {
-   "height": 44,
+   "height": 40,
    "width": 94.4,
    "x": 102.8,
-   "y": -36,
+   "y": -34,
  }
```
- **Restoration:** Restored `TARGET_H = 44` and `round(lastCenterY - 22)`. Verified pass.

### Break 2: `overflowTarget` Centered on Label Box Center
- **Modification:** Changed `lastCenterY = labelLineY(...)` to `centerY = label.box.y + label.box.height / 2` in `geometry.ts`.
- **Command:** `pnpm --filter web exec vitest run src/lib/editor/diagram/geometry.test.ts`
- **Output:**
```
 FAIL  src/lib/editor/diagram/geometry.test.ts > multi-line labels and DiagramInput (T-039) > overflowTarget and overflow (T-053) > F1: calculates overflow target 44px high centered on the last line
AssertionError: expected { x: 102.8, y: -54, width: 94.4, …(1) } to deeply equal { x: 102.8, y: -36, width: 94.4, …(1) }

- Expected
+ Received

  {
    "height": 44,
    "width": 94.4,
    "x": 102.8,
-   "y": -36,
+   "y": -54,
  }
```
- **Restoration:** Restored `lastCenterY = labelLineY(label.box, label.lines.length - 1)`. Verified pass.

### Break 3: `pdaDiagram` Sets `overflow: true` on $\ge 3$ Transitions
- **Modification:** Changed `allLines.length > MAX_EDGE_LINES` to `allLines.length >= MAX_EDGE_LINES` in `pda-diagram.ts`.
- **Command:** `pnpm --filter web exec vitest run src/lib/editor/diagram/pda-diagram.test.ts`
- **Output:**
```
 FAIL  src/lib/editor/diagram/pda-diagram.test.ts > PDA diagram adapter (T-039) > F2: pdaDiagram sets overflow: true only when transitions exceed 3
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ src/lib/editor/diagram/pda-diagram.test.ts:337:31
    335|   const edge3 = diag3.edges[0]!;
    336|   expect(edge3.lines).toHaveLength(3);
    337|   expect('overflow' in edge3).toBe(false);
```
- **Restoration:** Restored `allLines.length > MAX_EDGE_LINES`. Verified pass.

### Break 4: `overflowTarget` Returns Target for Label Without Overflow
- **Modification:** Removed `if (!label.overflow) return null;` in `geometry.ts`.
- **Command:** `pnpm --filter web exec vitest run src/lib/editor/diagram/geometry.test.ts`
- **Output:**
```
 FAIL  src/lib/editor/diagram/geometry.test.ts > multi-line labels and DiagramInput (T-039) > overflowTarget and overflow (T-053) > F1: calculates overflow target 44px high centered on the last line
AssertionError: expected { x: 100, y: 6, width: 90, height: 44 } to be null

- Expected:
null

+ Received:
{
  "height": 44,
  "width": 90,
  "x": 100,
  "y": 6,
}
```
- **Restoration:** Restored `if (!label.overflow || label.lines.length === 0) return null;`. Verified pass.

### Break 5: FSM Label Emits `overflow: false` instead of Omission
- **Modification:** Changed `...(overflow ? { overflow: true } : {})` to `overflow: overflow ?? false` in `geometry.ts`.
- **Command:** `pnpm --filter web exec vitest run src/lib/editor/diagram/geometry.test.ts`
- **Output:**
```
 FAIL  src/lib/editor/diagram/geometry.test.ts > multi-line labels and DiagramInput (T-039) > overflowTarget and overflow (T-053) > F1/F3: diagramGeometry propagates overflow to LabelShape, omitted for FSM
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ src/lib/editor/diagram/geometry.test.ts:957:35
    955|    const fsmShapes = edgeGeometry(endsWith01());
    956|    for (const e of fsmShapes.edges) {
    957|     expect('overflow' in e.label).toBe(false);
```
- **Restoration:** Restored `...(overflow ? { overflow: true } : {})`. Verified pass.

### Break 6: `FsmLabelBox.svelte` Component Break
- **Modification:** Set `const initial = 'broken';` in `FsmLabelBox.svelte`, built with `pnpm --filter web build`, and executed Playwright.
- **Command:** `pnpm --filter web exec playwright test e2e/editor-transitions.spec.ts --project=desktop`
- **Output:**
```
  1) [desktop] › e2e/editor-transitions.spec.ts:43:1 › two taps or clicks: source, then target, then the symbols 

    Error: expect(locator).toHaveValue(expected) failed

    Locator:  getByRole('textbox', { name: 'Simbol transisi' })
    Expected: ""
    Received: "broken"
    Timeout:  5000ms

  2) [desktop] › e2e/editor-transitions.spec.ts:178:1 › an edge that exists opens its box with the symbols it has; an empty text removes it 

    Error: expect(locator).toHaveValue(expected) failed

    Locator:  getByRole('textbox', { name: 'Simbol transisi' })
    Expected: "0"
    Received: "broken"
    Timeout:  5000ms
```
- **Catching Spec:** `e2e/editor-transitions.spec.ts` caught the break immediately at lines 52 and 186.
- **Restoration:** Restored `const initial = $derived(labelOf(doc, slotData.from, slotData.to));` and rebuilt. All 22 tests passed.

---

## 4. Deepening Pass (AGENTS.md & Definition of Done)

1. **New Exports & Interface Members:**
   - `export interface LabelSlot`: exported from `EditorCanvas.svelte` for consumers providing the `label` snippet (`{ x: number; y: number; from: number; to: number }`). Seam is necessary and minimal.
   - `export interface EditorCanvasProps<D, C>`: exported from `EditorCanvas.svelte` so consumers and type tests can strongly type generic canvas props.
   - `export function overflowTarget(label: LabelShape): Box | null`: exported pure geometry helper from `geometry.ts`. Tested by F1.
   - `DiagramEdgeInput.overflow?: true` & `LabelShape.overflow?: true`: optional discriminator fields in `geometry.ts`.
   - `FsmLabelBox.svelte`: new component encapsulating FSM label editing (`LabelField`, `labelProblem`, commit/cancel/leave handlers).
   - `ContextMenu.svelte`: added optional prop `labels?: Partial<Record<MenuAction, MessageKey>>`.
   - `EditorCanvas.svelte`: `generics="D extends StatesDocument, C"`, props: `diagram`, `label`, `onmore`, `menuLabels`.
   - `DiagramDrawing.svelte`: no new props or handlers; renders passive `<rect class="hit-overflow" ... />`.
2. **Duplicate Logic:** None. The single pointer event path is managed in `EditorCanvas.svelte` via SVG event delegation and class inspection (`event.target instanceof Element && event.target.closest('.hit-overflow') !== null`), with zero debounce timers.
3. **Casts Added:** **0** (zero `any`, zero `@ts-ignore`, zero `as unknown as`; safe `instanceof Element` replaces any cast).

---

## 5. Verification Commands and Outputs

### A. Static Quality Gate
`pnpm format:check && pnpm check && pnpm lint && pnpm check:strings && pnpm check:tokens`
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
ok   64 components have no hard-coded text
$ node tools/check-tokens-usage.mjs
ok   66 files use no raw colors
```

### B. Unit & Type Tests
`pnpm test:web`
```
 Test Files  102 passed (102)
      Tests  1252 passed | 2 skipped (1254)
   Start at  22:21:38
   Duration  10.69s (tests 73%, transform 19%, import 8%)
```
`pnpm --filter web exec vitest run src/lib/editor/EditorCanvas.type.test.ts`
```
 ✓ src/lib/editor/EditorCanvas.type.test.ts (1 test) 4ms
 Test Files  1 passed (1)
      Tests  1 passed (1)
```

### C. Import Decoupling Verification (AC4)
Checking that `EditorCanvas.svelte` no longer imports `LabelField`, `labelOf`, `MachineDocument`, or FSM `Editor`:
- `grep LabelField web/src/lib/editor/EditorCanvas.svelte || echo none` -> `none`
- `grep labelOf web/src/lib/editor/EditorCanvas.svelte || echo none` -> `none`
- `grep MachineDocument web/src/lib/editor/EditorCanvas.svelte || echo none` -> `none`
- `grep "Editor," web/src/lib/editor/EditorCanvas.svelte || echo none` -> `none`

### D. Production Build & Size Check (AC7)
`pnpm build && pnpm size`
```
ok   initial JS index.html: 81.4 KB gzip (limit 170 KB)
ok   initial JS panduan/berakhiran-x.html: 86.7 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 80.4 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 120.6 KB gzip (limit 170 KB)
ok   initial JS soal/berakhiran-10.html: 120.2 KB gzip (limit 170 KB)
ok   initial JS soal/jumlah-a-genap.html: 120.2 KB gzip (limit 170 KB)
ok   initial JS soal/mengandung-101.html: 120.2 KB gzip (limit 170 KB)
ok   initial JS soal.html: 81.9 KB gzip (limit 170 KB)
ok   initial JS tentang.html: 79.8 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-VlyrwV86.wasm: 237.0 KB gzip (limit 250 KB)
```
- Bundle size change for `sandbox.html`: 120.6 KB gzip (unchanged from pre-task baseline, well under 170 KB limit; delta 0.0 KB).

### E. Playwright E2E Area Specs (AC5)
1. `pnpm --filter web exec playwright test e2e/editor-transitions.spec.ts --project=desktop --project=phone`:
   - **22 passed, 6 skipped** (desktop: 10 passed, 4 skipped; phone: 12 passed, 2 skipped).
2. `pnpm --filter web exec playwright test e2e/editor-edges.spec.ts --project=desktop --project=phone`:
   - **14 passed, 14 skipped** (desktop: 11 passed, 3 skipped; phone: 3 passed, 11 skipped).
3. `pnpm --filter web exec playwright test e2e/editor-flows.spec.ts e2e/diagram.spec.ts --project=desktop --project=phone`:
   - **9 passed, 3 skipped** (desktop: 4 passed, 2 skipped; phone: 5 passed, 1 skipped). Includes clean axe accessibility checks on 4-state DFSM build flows.
