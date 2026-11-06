# Task T-039 Report — PDA editor, part 2 of 5: the diagram shows a PDA

- **Task:** T-039
- **Branch:** `task/T-039-pda-diagram`
- **Status:** done
- **Implementation Commit:** `0df683e` (preceded by status commit `577d4a8`, F7 baseline commit `8fbbe72`, and tests commit `ab6d539`)

---

## 1. Hand Derivations (F1–F7) and AC6 / F6 Notes

### 1.1 Multi-line Label Box Formulas (`geometry.ts`)

- Constants:
  - `LABEL_CHAR_WIDTH = 9.6`
  - `LABEL_PADDING = 8`
  - `LABEL_HEIGHT = 20`
  - `LINE_PITCH = 18`
  - `LABEL_GAP = 4`
- For `n = Math.max(1, lines.length)` lines where the longest line has `maxChars = max([...line].length)` Unicode code points:
  - $\text{width} = \text{maxChars} \times 9.6 + 8$
  - $\text{height} = 20 + 18 \times (n - 1)$
    - 1 line: $\text{height} = 20$
    - 2 lines: $\text{height} = 38$
    - 3 lines: $\text{height} = 56$
- Outward placement from anchor point $A$ along unit normal $\vec{n}$:
  - $\text{reach}(\vec{n}, \text{size}) = \frac{|\vec{n}_x| \cdot \text{width} + |\vec{n}_y| \cdot \text{height}}{2}$
  - $\text{center} = A + (\text{LABEL\_GAP} + \text{reach}(\vec{n}, \text{size})) \vec{n}$
  - Because $\text{reach}(\vec{n}, \text{size})$ scales with `size.width` and `size.height`, the side of the box nearest the edge or loop stays at distance `LABEL_GAP = 4 px` from $A$, and the box grows outward away from the line or loop.
- Line vertical centers (`labelLineY(box, i)` for $i \in \{0, \dots, n - 1\}$):
  - $y_i = \text{round}(\text{box.y} + 10 + 18 \times i)$

### 1.2 Fixture F1: Straight Edge with Three Lines

- **Input:** Two states `q0` at `(0, 0)` and `q1` at `(300, 0)`. One edge `0 → 1` with `lines: ['ε / ε / ε', 'a / ε / A', 'b / ε / B']`.
- **Geometry derivation:**
  1. State circle radius `RADIUS = 32`. The straight edge goes from rim `(32, 0)` to rim `(268, 0)`, with midpoint anchor $A = (150, 0)$.
  2. Direction of travel is $\vec{u} = (1, 0)$, so the left normal is $\vec{n} = (-\vec{u}_y, \vec{u}_x) = (0, -1)$ (upward in SVG coordinates).
  3. Each of the 3 lines has 9 Unicode code points (`[...line].length === 9`):
     - $\text{width} = 9 \times 9.6 + 8 = 94.4$
     - $\text{height} = 20 + 18 \times (3 - 1) = 56$
  4. $\text{reach}((0, -1), \{ \text{width}: 94.4, \text{height}: 56 \}) = 56 / 2 = 28$.
  5. $\text{center} = (150, 0) + (4 + 28) \times (0, -1) = (150, -32)$.
  6. $\text{box} = \{ x: 150 - 94.4 / 2,\ y: -32 - 56 / 2,\ \text{width}: 94.4,\ \text{height}: 56 \} = \{ x: 102.8,\ y: -60,\ \text{width}: 94.4,\ \text{height}: 56 \}$.
  7. Bottom edge of box: $y + \text{height} = -60 + 56 = -4$, which is `4 px` (`LABEL_GAP`) above the edge line $y = 0$.
  8. Line centers (`labelLineY(box, i) = -60 + 10 + 18 * i`):
     - $i = 0 \implies y_0 = -50$
     - $i = 1 \implies y_1 = -32$
     - $i = 2 \implies y_2 = -14$

### 1.3 Fixture F2: Self-Loop with Three Lines (and Apex Confirmation)

- **Apex confirmation from existing `geometry.test.ts` and `edgeGeometry`:**
  - In `web/src/lib/editor/diagram/geometry.test.ts` line 207 (`describe('a self-loop', ...)`), a state at `(200, 200)` with a default top self-loop (`angle = -90`) has `const top = Math.min(...edge.points.map((p) => p.y)); near(top, 200 - RADIUS - 40, 0)` ($200 - 32 - 40 = 128$).
  - In `makeLoop` (`geometry.ts`), at `angle = -90`, $\vec{u} = (0, -1)$ and the cubic Bezier control points reach 52 px beyond the rim so the midpoint (`points[SAMPLES / 2]` at $t = 0.5$) reaches $0.75 \times 52 + 0.25 \times 4 = 40\text{ px}$ beyond the rim (`y = cy - 32 - 40`).
  - Evaluating `edgeGeometry` on a state at `(200, 300)` with a self-loop gives `Math.min(...oneLineLoop.points.map((p) => p.y)) === 228` ($300 - 32 - 40 = 228$). The code and the hand formula agree: the loop apex is at `(200, 228)`.
- **Geometry derivation for F2 (state at `(200, 300)`, 3 lines of 9 chars):**
  1. Anchor $A = (200, 228)$, outward normal $\vec{n} = (0, -1)$.
  2. $\text{width} = 94.4$, $\text{height} = 56$, $\text{reach}((0, -1), \text{size}) = 28$.
  3. $\text{center} = (200, 228 - (4 + 28)) = (200, 196)$.
  4. $\text{box} = \{ x: 200 - 47.2,\ y: 196 - 28,\ \text{width}: 94.4,\ \text{height}: 56 \} = \{ x: 152.8,\ y: 168,\ \text{width}: 94.4,\ \text{height}: 56 \}$.
  5. Bottom of box: $y + \text{height} = 168 + 56 = 224 = 228 - 4$ (`LABEL_GAP = 4 px` above the loop apex `228`).
  6. Line centers (`168 + 10 + 18 * i`): `178`, `196`, `214`.

### 1.4 Fixture F3: The Three Samples Through `pdaDiagram`

With `more = (n) => "+ " + n + " lagi"`:
1. **`wwrSample()` ($w w^R$):**
   - `0>0`: `lines: ['a / ε / A', 'b / ε / B']`, `text: 'a / ε / A; b / ε / B'`
   - `0>1`: `lines: ['ε / ε / ε']`, `text: 'ε / ε / ε'`
   - `1>1`: `lines: ['a / A / ε', 'b / B / ε']`, `text: 'a / A / ε; b / B / ε'`
2. **`wcwrSample()` ($w c w^R$):**
   - `0>0`: `lines: ['a / ε / A', 'b / ε / B']`, `text: 'a / ε / A; b / ε / B'`
   - `0>1`: `lines: ['c / ε / ε']`, `text: 'c / ε / ε'`
   - `1>1`: `lines: ['a / A / ε', 'b / B / ε']`, `text: 'a / A / ε; b / B / ε'`
3. **`anbnSample()` ($a^n b^n$):**
   - `0>0`: `lines: ['a / ε / A']`, `text: 'a / ε / A'`
   - `0>1`: `lines: ['b / A / ε']`, `text: 'b / A / ε'`
   - `1>1`: `lines: ['b / A / ε']`, `text: 'b / A / ε'`

### 1.5 Fixtures F4 and F5

- **F4 (more than 3 transitions on an edge):**
  - 3 transitions: 3 transition lines (`lines.length === 3`).
  - 4 transitions: first 2 transition lines + `'+ 2 lagi'`.
  - 5 transitions: first 2 transition lines + `'+ 3 lagi'`.
  - 70 transitions: first 2 transition lines + `'+ 68 lagi'` (`'+ 68 more'` in English via `pda_editor.edge_more`).
  - In all cases, `edge.text` holds all transitions in `doc.transitions` order joined by `'; '`.
- **F5 (stack alphabet spacing rule):**
  - `stackAlphabet: ['A', 'B']` (all 1 code point): `a / A / BA` and `ε / ε / ε`.
  - `stackAlphabet: ['Z0', 'A']` (`'Z0'` has 2 code points): `a / Z0 / A Z0` AND in the same document `pop: ['A'], push: ['A', 'A']` formats as `a / A / A A`.
  - `stackAlphabet: ['😀', 'A']` (`'😀'` is a surrogate pair, 2 UTF-16 code units but 1 Unicode code point `[...'😀'].length === 1`): `a / 😀 / A😀` (no space).

### 1.6 Fixture F6: Property Across 300 Seeded Random PDA Documents on a Grid

- **Starting spacing check (`240 px`):**
  - At `SPACING = 240`, seeds `48, 57, 98, 125, 206` fail because of label-to-label overlap between adjacent grid columns (or self-loops next to curved edges).
  - **Root cause on seed 48:** Column `x = 0` (`x = 100`) and column `x = 1` (`x = 100 + SPACING`) both have opposite-pair vertical edges between rows `y = 0` and `y = 1`. The inner curve of column `0` bulges east by `CURVE_OFFSET = 24 px` and places its label `LABEL_GAP = 4 px` further east (`x = 128`), with a 2-symbol pop and 2-symbol push line (`11` chars, e.g. `a / BB / BB`, `width = 11 * 9.6 + 8 = 113.6 px`), reaching `x = 128 + 113.6 = 241.6`. Meanwhile, the inner curve of column `1` bulges west by `24 px` and places its `10`-char label (`width = 10 * 9.6 + 8 = 104 px`) `4 px` further west (`right = 100 + SPACING - 28`, `left = 100 + SPACING - 132`). They overlap whenever `128 + 113.6 > 100 + SPACING - 132`, i.e., $\text{SPACING} < 28 + 113.6 + 104 + 28 = 273.6\text{ px}$.
  - **Minimum grid spacing:** `SPACING = 274` (`274 > 273.6`) is the smallest integer grid spacing at which all 300 seeds pass with zero label-label overlaps, zero label-state circle overlaps, all labels and states inside `bounds`, and identical output when transitions are added in reversed order. Recorded in `pda-diagram.test.ts` for `T-040`.

### 1.7 Fixture F7: FSM Baseline Recorded Before Code Changes

- In commit `8fbbe72` (before any edit to `geometry.ts`), we recorded `web/src/lib/editor/diagram/__fixtures__/fsm-shapes.json` containing the full `edgeGeometry(endsWith01())` JSON and the SHA-256 hashes of `JSON.stringify(edgeGeometry(doc))` for the 300 seeded random FSM documents of `geometry.test.ts` (full JSON for 300 machines was ~796 KB; the fixture with `endsWith01` + 300 SHA-256 hashes is ~32 KB).
- In `geometry.test.ts`, F7 verifies that every label has `lines: [label.text]` and that after stripping `lines` from `LabelShape`, `edgeGeometry(endsWith01())` and all 300 random FSMs match `fsm-shapes.json` byte-for-byte.

### 1.8 Note on AC6 Testing Setup

- `vitest` in `web/` runs without a `vitest.config.ts` / `@sveltejs/vite-plugin-svelte` transform, so importing `.svelte` components in unit tests fails at parse time. Per AC6 and Reminder 4 ("if it has none, test the pure function that makes the line positions and say so (do not add a dependency)"), we exported `labelLineY(box: Box, index: number): number` from `geometry.ts`, called `labelLineY(edge.label.box, i)` in `DiagramDrawing.svelte`, and tested `labelLineY` on one-line FSM, one-line PDA, and three-line PDA (F1) labels in `geometry.test.ts`. And in `DiagramDrawing.svelte`, `edge.label.lines.length <= 1` keeps the exact single `<text>` node (no `<tspan>`), verified both by unit tests and by the existing Playwright diagram and image-export e2e specs.

---

## 2. Deliberate Breaks (AC7)

Each of the 8 deliberate breaks specified in AC7 was applied one at a time, verified to fail the target test, and then restored:

### Break 1: Ignore the number of lines in the box height (`height: LABEL_HEIGHT`) → F1 fails

```text
 FAIL  src/lib/editor/diagram/geometry.test.ts > multi-line labels and DiagramInput (T-039) > F1: straight edge with three lines has box 94.4 × 56 at (102.8, -60) and line centers -50, -32, -14
AssertionError: expected { x: 150, y: -14 } to deeply equal { x: 150, y: -32 }

- Expected
+ Received

  {
    "x": 150,
-   "y": -32,
+   "y": -14,
  }
```

### Break 2: Put the lines in alphabet order (`[...allLines].sort()`) instead of `doc.transitions` order → F3 fails

```text
 FAIL  src/lib/editor/diagram/pda-diagram.test.ts > PDA diagram adapter (T-039) > F3: produces exact edges and lines in order for wwᴿ, wcwᴿ and aⁿbⁿ
AssertionError: expected [ 'a / ε / A', 'b / ε / A' ] to deeply equal [ 'b / ε / A', 'a / ε / A' ]

- Expected
+ Received

  [
-   "b / ε / A",
    "a / ε / A",
+   "b / ε / A",
  ]
```

### Break 3: Show three transitions plus `+ n lagi` instead of two → F4 fails

```text
 FAIL  src/lib/editor/diagram/pda-diagram.test.ts > PDA diagram adapter (T-039) > F4: truncates to 2 transitions + "+ n lagi" when an edge has > 3 transitions while keeping full text
AssertionError: expected [ 'a / ε / ε', 'a / ε / A', …(2) ] to deeply equal [ Array(3) ]

- Expected
+ Received

  [
    "a / ε / ε",
    "a / ε / A",
-   "+ 2 lagi",
+   "a / ε / AA",
+   "+ 1 lagi",
  ]
```

### Break 4: Decide stack spacing per transition (`stackSeparator([...transition.pop, ...transition.push])`) instead of `doc.stackAlphabet` → F5 fails

```text
 FAIL  src/lib/editor/diagram/pda-diagram.test.ts > PDA diagram adapter (T-039) > F5: formats stack strings according to the whole document stackAlphabet (code points)
AssertionError: expected 'a / A / AA' to be 'a / A / A A' // Object.is equality

Expected: "a / A / A A"
Received: "a / A / AA"
```

### Break 5: Sort edges by `to` first (`a.to - b.to || a.from - b.from`) → F3 fails

```text
 FAIL  src/lib/editor/diagram/pda-diagram.test.ts > PDA diagram adapter (T-039) > F3: produces exact edges and lines in order for wwᴿ, wcwᴿ and aⁿbⁿ
AssertionError: expected [ '1>0', '0>1' ] to deeply equal [ '0>1', '1>0' ]

- Expected
+ Received

  [
-   "0>1",
    "1>0",
+   "0>1",
  ]
```

### Break 6: Build `text` from the visible `lines` only (`lines.join('; ')`) → F4 fails

```text
 FAIL  src/lib/editor/diagram/pda-diagram.test.ts > PDA diagram adapter (T-039) > F4: truncates to 2 transitions + "+ n lagi" when an edge has > 3 transitions while keeping full text
AssertionError: expected 'a / ε / ε; a / ε / A; + 2 lagi' to be 'a / ε / ε; a / ε / A; a / ε / AA; a /…' // Object.is equality

Expected: "a / ε / ε; a / ε / A; a / ε / AA; a / ε / AAA"
Received: "a / ε / ε; a / ε / A; + 2 lagi"
```

### Break 7: Let the label grow toward the line instead of away from it (`LABEL_GAP - reach(normal, size)`) → F1 and F2 fail

```text
 FAIL  src/lib/editor/diagram/geometry.test.ts > multi-line labels and DiagramInput (T-039) > F1: straight edge with three lines has box 94.4 × 56 at (102.8, -60) and line centers -50, -32, -14
AssertionError: expected { x: 150, y: 24 } to deeply equal { x: 150, y: -32 }

 FAIL  src/lib/editor/diagram/geometry.test.ts > multi-line labels and DiagramInput (T-039) > F2: loop with three lines at (200, 300) grows upward with bottom 4 px above loop apex (228)
AssertionError: expected 224 to be 168 // Object.is equality
```

### Break 8: Drop `lines` in `fsmDiagram` (`lines: []`) → F7 fails

```text
 FAIL  src/lib/editor/diagram/geometry.test.ts > multi-line labels and DiagramInput (T-039) > F7: edgeGeometry for endsWith01 and 300 random FSMs matches the recorded baseline apart from lines
AssertionError: expected [] to deeply equal [ '1' ]

- Expected
+ Received

- [
-   "1",
- ]
+ []
```

---

## 3. Bundle Size Before and After (AC8)

### Before (`staging` at `4ab12f3` / `577d4a8`)

```text
$ node tools/check-size.mjs
ok   initial JS index.html: 81.3 KB gzip (limit 170 KB)
ok   initial JS panduan/berakhiran-x.html: 86.2 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 80.4 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 119.7 KB gzip (limit 170 KB)
ok   initial JS soal/berakhiran-10.html: 119.3 KB gzip (limit 170 KB)
ok   initial JS soal/jumlah-a-genap.html: 119.3 KB gzip (limit 170 KB)
ok   initial JS soal/mengandung-101.html: 119.3 KB gzip (limit 170 KB)
ok   initial JS soal.html: 81.9 KB gzip (limit 170 KB)
ok   initial JS tentang.html: 79.7 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-VlyrwV86.wasm: 237.0 KB gzip (limit 250 KB)
```

### After (`0df683e`)

```text
$ node tools/check-size.mjs
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

---

## 4. Verification Outputs

### 4.1 `pnpm format:check && pnpm check && pnpm lint && pnpm check:strings && pnpm check:tokens`

```text
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

### 4.2 `pnpm --filter web exec vitest run`

```text
 RUN  v5.0.3 /home/Aldebaran64/webtomata/web

 ✓ src/lib/editor/compare.wasm.test.ts (6 tests) 663ms
 ✓ src/lib/editor/interaction/editor.test.ts (41 tests) 758ms
 ✓ src/lib/share/link.test.ts (15 tests) 1238ms
 ✓ src/lib/editor/diagram/geometry.test.ts (42 tests) 1240ms
   ✓ the whole drawing (7)
     ✓ draws 200 states and 421 edges between neighbors quickly (9 ms measured) 28ms
     ✓ draws the worst case, 600 random edges across 200 states, in well under a second (96 ms measured) 433ms
 ✓ src/lib/editor/pda-document.wasm.test.ts (5 tests) 1334ms
 ✓ src/lib/editor/history.property.test.ts (7 tests) 1549ms
 ✓ src/lib/editor/pda-commands.test.ts (12 tests) 429ms
 ✓ src/lib/editor/pda-document.test.ts (15 tests) 477ms
 ✓ src/lib/editor/commands.test.ts (26 tests) 183ms
 ✓ src/lib/editor/pda-history.property.test.ts (5 tests) 1860ms
 ✓ src/lib/questions/check.wasm.test.ts (27 tests) 443ms
 ✓ src/lib/questions/load.test.ts (32 tests) 350ms
 ✓ src/lib/editor/conversion.wasm.test.ts (49 tests) 488ms
 ✓ src/lib/editor/regex-conversion.wasm.test.ts (4 tests) 198ms
 ✓ src/lib/editor/document.wasm.test.ts (10 tests) 2269ms
 ✓ src/lib/share/files.wasm.test.ts (6 tests | 1 skipped) 154ms
 ✓ src/lib/i18n/i18n.test.ts (14 tests) 64ms
 ✓ src/lib/editor/run.wasm.test.ts (29 tests) 188ms
 ✓ src/lib/editor/document.test.ts (32 tests) 212ms
 ✓ src/lib/editor/regex-simplify.wasm.test.ts (6 tests) 203ms
 ✓ src/lib/editor/regex-compile.wasm.test.ts (5 tests) 112ms
 ✓ src/lib/questions/question.test.ts (4 tests) 25ms
 ✓ src/lib/engine/handlers.test.ts (20 tests) 120ms
 ✓ src/lib/lint.test.ts (2 tests) 2718ms
 ✓ src/lib/grammar/grammar-text.wasm.test.ts (31 tests) 172ms
 ✓ src/lib/editor/table.test.ts (22 tests) 75ms
 ✓ src/lib/questions/grade.wasm.test.ts (13 tests) 598ms
 ✓ src/lib/editor/diagram/pda-diagram.test.ts (4 tests) 621ms
   ✓ PDA diagram adapter (T-039) (4)
     ✓ F6: 300 random PDA documents on a grid have no overlapping labels, no label on a state, all labels inside bounds, and deterministic output 606ms
 ✓ src/lib/questions/summaries.test.ts (10 tests) 88ms
 ✓ src/lib/editor/history.test.ts (20 tests) 18ms
 ✓ src/lib/editor/interaction/editor.link.test.ts (19 tests) 15ms
 ✓ src/lib/share/image.test.ts (10 tests) 25ms
 ✓ src/lib/engine/client.test.ts (30 tests) 62ms
 ✓ src/lib/storage/autosave.tests-field.test.ts (9 tests) 38ms
 ✓ src/lib/share/open-file.wasm.test.ts (8 tests | 1 skipped) 74ms
 ✓ src/lib/storage/library.test.ts (21 tests) 36ms
 ✓ src/lib/editor/interaction/editor.states.test.ts (17 tests) 18ms
 ✓ src/lib/questions/answer.test.ts (7 tests) 19ms
 ✓ src/lib/storage/machines.test.ts (8 tests) 11ms
 ✓ src/lib/guides/load.test.ts (10 tests) 48ms
 ✓ src/lib/editor/interaction/keys.test.ts (49 tests) 17ms
 ✓ src/lib/storage/autosave.test.ts (12 tests) 17ms
 ✓ src/lib/editor/tester.test.ts (11 tests) 33ms
 ✓ src/lib/questions/machine.test.ts (13 tests) 8ms
 ✓ src/lib/storage/question-work.test.ts (13 tests) 21ms
 ✓ src/lib/examples/examples.wasm.test.ts (6 tests) 5ms
 ✓ src/lib/editor/interaction/camera.test.ts (25 tests) 22ms
 ✓ src/lib/share/open-file.test.ts (13 tests) 10ms
 ✓ src/lib/storage/progress.test.ts (13 tests) 5ms
 ✓ src/lib/storage/tests-field.test.ts (7 tests) 8ms
 ✓ src/lib/share/local-jff.test.ts (6 tests) 6ms
 ✓ src/lib/questions/grade.test.ts (20 tests) 22ms
 ✓ src/lib/editor/layout-client.test.ts (9 tests) 24ms
 ✓ src/lib/editor/regex-conversion.test.ts (13 tests) 9ms
 ✓ src/lib/examples/examples.test.ts (9 tests) 11ms
 ✓ src/lib/storage/autosave.progress.test.ts (8 tests) 15ms
 ✓ src/lib/editor/test-list.test.ts (13 tests) 8ms
 ✓ src/lib/editor/interaction/label.test.ts (14 tests) 10ms
 ✓ src/lib/share/files.test.ts (11 tests) 12ms
 ✓ src/lib/questions/list.test.ts (14 tests) 11ms
 ✓ src/lib/storage/example.test.ts (6 tests) 14ms
 ✓ src/lib/editor/regex-compile.test.ts (15 tests) 9ms
 ✓ src/lib/storage/migrate.test.ts (9 tests) 13ms
 ✓ src/lib/editor/interaction/editor.edges.test.ts (15 tests) 14ms
 ✓ src/lib/editor/interaction/canvas.test.ts (12 tests) 5ms
 ✓ src/lib/questions/feedback-text.test.ts (14 tests) 12ms
 ✓ src/lib/editor/tour.test.ts (8 tests) 9ms
 ✓ src/lib/grammar/presets.test.ts (4 tests) 4ms
 ✓ src/lib/editor/checker.test.ts (6 tests) 8ms
 ✓ src/lib/editor/compare.test.ts (11 tests) 7ms
 ✓ src/lib/editor/regex-simplify.test.ts (12 tests) 8ms
 ✓ src/lib/editor/panel-height.test.ts (12 tests) 8ms
 ✓ src/lib/editor/conversion-text.test.ts (4 tests) 3ms
 ✓ src/lib/language/language-math.test.ts (5 tests) 5ms
 ✓ src/lib/editor/run-text.test.ts (7 tests) 4ms
 ✓ src/lib/grammar/grammar-text.test.ts (19 tests) 9ms
 ✓ src/lib/editor/panel-tab.test.ts (8 tests) 3ms
 ✓ src/lib/questions/statement.test.ts (12 tests) 7ms
 ✓ src/lib/editor/checks.test.ts (7 tests) 6ms
 ✓ src/lib/questions/feedback-view.test.ts (6 tests) 4ms
 ✓ src/lib/editor/layout.test.ts (16 tests) 3262ms
 ✓ src/lib/editor/panel-width.test.ts (13 tests) 7ms
 ✓ src/lib/language/presets.test.ts (2 tests) 5ms
 ✓ src/lib/editor/interaction/editor.apply.test.ts (7 tests) 8ms
 ✓ src/lib/engine/problem.test.ts (5 tests) 3ms
 ✓ src/lib/storage/memory.test.ts (5 tests) 3ms
 ✓ src/lib/editor/regex-math.test.ts (8 tests) 6ms
 ✓ src/lib/guides/list.test.ts (3 tests) 5ms
 ✓ src/lib/editor/interaction/selection.test.ts (11 tests) 9ms
 ✓ src/lib/editor/table-grid.test.ts (4 tests) 3ms
 ✓ src/lib/editor/interaction/placement.test.ts (7 tests) 3ms
 ✓ src/lib/editor/interaction/menu.test.ts (4 tests) 2ms
 ✓ src/lib/questions/statement-fold.test.ts (4 tests) 2ms
 ✓ src/lib/editor/definition.test.ts (10 tests) 5ms
 ✓ src/lib/storage/titles.test.ts (3 tests) 1ms
 ✓ src/lib/seo.test.ts (1 test) 2ms
 ✓ src/lib/editor/interaction/editor.property.test.ts (4 tests) 3328ms

 Test Files  97 passed (97)
      Tests  1229 passed | 2 skipped (1231)
   Start at  23:02:31
   Duration  4.21s
```

### 4.3 Playwright Diagram Specs (AC9: `e2e/diagram.spec.ts`, `e2e/editor-edges.spec.ts`, `e2e/editor-transitions.spec.ts`, `e2e/editor-view.spec.ts`, `e2e/image-export.spec.ts` on `desktop` and `phone`)

```text
$ pnpm --filter web exec playwright test e2e/diagram.spec.ts e2e/editor-edges.spec.ts e2e/editor-transitions.spec.ts e2e/editor-view.spec.ts e2e/image-export.spec.ts --project=desktop --project=phone

Running 110 tests using 6 workers
  ...
  38 skipped
  72 passed (1.3m)
```

### 4.4 What Was Not Run

- Physical phone testing and live deployment checks (owner-only).
- Full Playwright cross-browser suite (`pnpm test:e2e`, `pnpm test:e2e:cross`); ran the 5 diagram/edge/label specs on `desktop` and `phone` per AC9 and AGENTS.md verification tiers.
