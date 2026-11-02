# Report — T-018

> Written by the worker at the end of the session. One file per task; overwrite each session.

## Task
- id: T-018
- title: Start state marker: a large hollow triangle, like JFLAP
- branch: `task/T-018-start-marker-triangle`
- commit: `987b2e8`
- pull request: https://github.com/AldebaranHere/webtomata/pull/120 (to be opened)
- CI run: (pending PR creation)

## What changed
- `web/src/lib/editor/diagram/geometry.ts`:
  - Replaced `START_LENGTH = 40` with `START_LENGTH = 28` and added `START_WIDTH = 36`.
  - Updated start marker geometry in `edgeGeometry`: the marker shape is now an isosceles triangle with its tip (`head`) on the rim at distance `RADIUS` (32) from the state center, base center (`tail`) at distance `RADIUS + 28` (60) along the direction vector `along`, and base corners `c1`, `c2` located $\pm 18$ units perpendicular to the axis along `normal` (`{ x: -along.y, y: along.x }`).
  - `start.path` is formatted as a closed triangle path: `M tip L corner1 L corner2 Z`.
  - `start.tail` remains the midpoint of the base, and `placeLabel` places the label beyond the base along `along`.
  - Updated `bounds` calculation to include all three vertices (`head`, `c1`, `c2`) and the start label bounding box.
- `web/src/lib/editor/diagram/DiagramDrawing.svelte`:
  - Replaced `<path class="line" d={shapes.start.path} marker-end="url(#{arrow})" />` with `<path class="start" d={shapes.start.path} />` (no arrowhead marker).
  - Added CSS rule for `.start` with `fill: var(--color-surface)`, `stroke: var(--color-neutral-ink)`, `stroke-width: 1.5`, and `stroke-linejoin: round`.
- `web/src/lib/share/image.ts`:
  - Replaced arrowhead-marked line for `shapes.start` with a closed shape path: `<path class="start" d="${shapes.start.path}" fill="${WHITE}" stroke="${LINE}" stroke-width="1.5" stroke-linejoin="round"/>` (no `marker-end`).
- `web/src/lib/editor/diagram/geometry.test.ts`:
  - Added unit test for AC1 verifying the exact coordinates at 180°: tip at (168, 200), base center at (140, 200), base corners at (140, 182) and (140, 218), and label placement.
  - Added unit test for AC2 looping over all 24 candidate angles (-165° to 180° in 15° steps) ensuring tip on rim, base center at `RADIUS + 28`, 36 base width symmetric about axis, and label box touching neither the triangle (grown by 2) nor the state circle.
  - Updated the bounds unit test to assert that all three triangle vertices are inside `shapes.bounds`.
- `web/src/lib/share/image.test.ts`:
  - Updated SVG assertion to verify `<path class="start">` has fill `#ffffff`, stroke `#3b414c`, stroke-width `1.5`, round joins, closed path (`d="M ... Z"`), and no `marker-end`.
- `web/e2e/diagram.spec.ts`:
  - Updated edge count from 7 (6 edges + 1 arrow) to 6 edges (`path.line`) and 1 start marker (`path.start`).
- `~/.profile` (WSL environment):
  - Added `export CHROME_PATH="$HOME/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome"` so Playwright tests reliably find the installed Chromium browser without requiring `/opt/google/chrome/chrome`.

---

## Non-goals check: search for "arrow" / "panah"
Searched `web/src/lib/i18n/id.ts`, `web/src/lib/i18n/en.ts`, `web/src/lib/editor/tour.ts`, and `content/` for any occurrences of "arrow" or "panah" referencing the start state marker:
- No user-facing message, tour step, or guide text refers to the start marker as an arrow ("panah" appears only for table keyboard navigation `table.hint_move` and grammar production arrow `grammar.matrix_col_arrow`; the start state is uniformly referred to as "mulai" / "start").

---

## Acceptance Criteria Verification

- **AC1 (coordinates at 180°)**: Verified in `geometry.test.ts`. With start state at (200, 200), tip is at (168, 200) (distance 32 on left), base center at (140, 200) (distance 60 from center, 28 from tip), corners at (140, 182) and (140, 218) (perpendicular to axis, 36 wide). Path is `M 168 200 L 140 182 L 140 218 Z`.
- **AC2 (all 24 candidate angles)**: Verified in `geometry.test.ts` across all 24 angles. Tip distance to center is 32, base center distance to center is 60, base width is 36, corners are equidistant from tip, label box does not touch state circle, and minimum distance from label box to triangle edges is $> 2$.
- **AC3 (marker styling & no marker-end)**: In `DiagramDrawing.svelte`, marker is `<path class="start">` with fill `var(--color-surface)`, stroke `var(--color-neutral-ink)`, stroke-width `1.5`, round joins, and no `marker-end`. Accepting start state inner circle (`circle.inner`) is unaffected.
- **AC4 (bounds include 3 vertices and label box)**: In `geometry.ts`, `boxes` includes `start.head` (tip), both base corners `c1` and `c2`, and `start.label.box`. Verified in unit tests.
- **AC5 (SVG and PNG export)**: In `image.ts`, start marker is drawn with fill `WHITE`, stroke `LINE`, stroke-width `1.5`, `stroke-linejoin="round"`, and no `marker-end`. Verified in `image.test.ts`.
- **AC6 (guard rails pass without changes)**: `pnpm check:tokens`, `pnpm check:contrast`, and `pnpm check:strings` pass with 0 errors.
- **AC7 (e2e test with start state and axe)**: `web/e2e/diagram.spec.ts` passes on desktop and phone projects with axe check reporting 0 violations. Repeated 5 times cleanly (35 passed, 5 phone-only tests skipped on desktop).
- **AC8 (deliberate break)**: Moved tip 8 off the rim by setting `head = add(startState, along, RADIUS + 8)`. AC1 failed with:
  ```
  FAIL src/lib/editor/diagram/geometry.test.ts > the start marker triangle > AC1: tip on rim at 180°, base 28 further out, 36 wide, perpendicular to axis
  AssertionError: expected { x: 160, y: 200 } to deeply equal { x: 168, y: 200 }
  ```
  and AC2 failed with:
  ```
  FAIL src/lib/editor/diagram/geometry.test.ts > the start marker triangle > AC2: loops over the 24 candidate angles
  AssertionError: expected 40.00215119215464 to be close to 32, received difference is 8.002151192154642, but expected 0.05
  ```
  Code was then restored and verified green.

---

## Verification Outputs

### 1. `pnpm --filter web exec vitest run src/lib/editor/diagram/geometry.test.ts src/lib/share/image.test.ts`
```
 RUN  v5.0.3 /home/Aldebaran64/webtomata/web

 ✓ src/lib/share/image.test.ts (10 tests) 26ms
 ✓ src/lib/editor/diagram/geometry.test.ts (38 tests) 320ms

 Test Files  2 passed (2)
      Tests  48 passed (48)
   Start at  02:06:57
   Duration  617ms (tests 50%, transform 40%, import 8%, worker 1%)
```

### 2. `pnpm check`
```
$ pnpm --filter web check
$ svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings
Loading svelte-check in workspace: /home/Aldebaran64/webtomata/web
Getting Svelte diagnostics...

svelte-check found 0 errors and 0 warnings
```

### 3. `pnpm lint`
```
$ pnpm --filter web lint
$ eslint .
```
(Exited 0 with no errors).

### 4. `pnpm format:check`
```
$ pnpm --filter web format:check && cargo fmt --check
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!
```

### 5. `pnpm check:tokens`
```
$ node tools/check-tokens-usage.mjs
ok   64 files use no raw colors
```

### 6. `pnpm check:contrast`
```
$ node tools/check-contrast.mjs
ok   16.57 (need 4.5)  Ink on ground
ok   17.76 (need 4.5)  Ink on surface
ok   15.55 (need 4.5)  Ink on neutral tint
ok   6.13 (need 4.5)  Muted on surface
ok   5.72 (need 4.5)  Muted on ground
ok   5.37 (need 4.5)  Muted on neutral tint
ok   8.99 (need 4.5)  Neutral ink on neutral tint (chips)
ok   10.26 (need 4.5)  Neutral ink on surface
ok   9.57 (need 4.5)  Neutral ink on ground
ok   5.90 (need 4.5)  On accent on accent (primary button)
ok   17.76 (need 4.5)  On ink on ink (selected tab)
ok   5.90 (need 4.5)  Accent on surface (link)
ok   5.51 (need 4.5)  Accent on ground (link)
ok   8.13 (need 4.5)  Accent ink on accent tint (active state)
ok   9.29 (need 4.5)  Accent ink on surface
ok   5.32 (need 4.5)  Success on surface
ok   4.67 (need 4.5)  Success on success tint (badge)
ok   7.02 (need 4.5)  Success ink on success tint
ok   8.40 (need 4.5)  Warning ink on warning tint
ok   9.16 (need 4.5)  Warning ink on surface
ok   8.55 (need 4.5)  Warning ink on ground
ok   9.57 (need 3)  Diagram stroke on ground
ok   8.98 (need 3)  Diagram stroke on accent tint
ok   5.51 (need 3)  Accent on ground (active state, focus ring)
ok   5.90 (need 3)  Accent on surface (focus ring)
ok   5.17 (need 3)  Accent on accent tint (active state edge)
ok   3.72 (need 3)  Warning on ground (wrong part of an answer)
ok   3.99 (need 3)  Warning on surface
ok   3.66 (need 3)  Warning on warning tint (label edge)
ok   4.96 (need 3)  Success on ground (valid, saved)
ok   4.27 (need 3)  Border strong on surface (input edge)
ok   3.98 (need 3)  Border strong on ground (input edge)
```

### 7. `pnpm check:strings`
```
$ node tools/check-strings.mjs
ok   62 components have no hard-coded text
```

### 8. `pnpm build`
```
$ pnpm build:wasm && pnpm --filter web build
...
[INFO]: ✨   Done in 19.57s
[INFO]: 📦   Your wasm pkg is ready to publish at web/src/lib/engine/wasm.
...
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
...
> Using @sveltejs/adapter-static
Wrote site to "build"
✔ done
```

### 9. `pnpm size`
```
$ node tools/check-size.mjs
ok   initial JS index.html: 78.2 KB gzip (limit 170 KB)
ok   initial JS panduan/berakhiran-x.html: 83.1 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 77.4 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 116.5 KB gzip (limit 170 KB)
ok   initial JS soal/berakhiran-10.html: 116.1 KB gzip (limit 170 KB)
ok   initial JS soal/jumlah-a-genap.html: 116.1 KB gzip (limit 170 KB)
ok   initial JS soal/mengandung-101.html: 116.1 KB gzip (limit 170 KB)
ok   initial JS soal.html: 78.8 KB gzip (limit 170 KB)
ok   initial JS tentang.html: 76.7 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-qpglZrwP.wasm: 206.2 KB gzip (limit 250 KB)
```

### 10. `pnpm --filter web exec playwright test --project=desktop --project=phone web/e2e/diagram.spec.ts --repeat-each=5`
```
Running 40 tests using 6 workers

  -   5 [desktop] › e2e/diagram.spec.ts:71:1 › the diagram fits a phone screen without a sideways scroll of the page
  ✓   2 [desktop] › e2e/diagram.spec.ts:26:1 › the labels do not overlap each other or a state, as drawn by the browser (5.1s)
  ✓   4 [desktop] › e2e/diagram.spec.ts:26:1 › the labels do not overlap each other or a state, as drawn by the browser (5.3s)
  ✓   6 [desktop] › e2e/diagram.spec.ts:64:1 › the diagram follows the language: the description and the start label (4.9s)
  ✓   7 [desktop] › e2e/diagram.spec.ts:64:1 › the diagram follows the language: the description and the start label (3.6s)
  -   9 [desktop] › e2e/diagram.spec.ts:71:1 › the diagram fits a phone screen without a sideways scroll of the page
  ✓   1 [desktop] › e2e/diagram.spec.ts:6:1 › the Sandbox draws the sample machine (10.4s)
  ✓   3 [desktop] › e2e/diagram.spec.ts:6:1 › the Sandbox draws the sample machine (11.1s)
  ✓  10 [desktop] › e2e/diagram.spec.ts:26:1 › the labels do not overlap each other or a state, as drawn by the browser (3.6s)
  -  12 [desktop] › e2e/diagram.spec.ts:71:1 › the diagram fits a phone screen without a sideways scroll of the page
  ✓  11 [desktop] › e2e/diagram.spec.ts:64:1 › the diagram follows the language: the description and the start label (3.6s)
  -  15 [desktop] › e2e/diagram.spec.ts:71:1 › the diagram fits a phone screen without a sideways scroll of the page
  ✓   8 [desktop] › e2e/diagram.spec.ts:6:1 › the Sandbox draws the sample machine (9.1s)
  ✓  14 [desktop] › e2e/diagram.spec.ts:26:1 › the labels do not overlap each other or a state, as drawn by the browser (3.0s)
  ✓  16 [desktop] › e2e/diagram.spec.ts:64:1 › the diagram follows the language: the description and the start label (2.5s)
  -  20 [desktop] › e2e/diagram.spec.ts:71:1 › the diagram fits a phone screen without a sideways scroll of the page
  ✓  13 [desktop] › e2e/diagram.spec.ts:6:1 › the Sandbox draws the sample machine (7.7s)
  ✓  18 [desktop] › e2e/diagram.spec.ts:26:1 › the labels do not overlap each other or a state, as drawn by the browser (3.1s)
  ✓  19 [desktop] › e2e/diagram.spec.ts:64:1 › the diagram follows the language: the description and the start label (3.0s)
  ✓  22 [phone] › e2e/diagram.spec.ts:26:1 › the labels do not overlap each other or a state, as drawn by the browser (2.9s)
  ✓  17 [desktop] › e2e/diagram.spec.ts:6:1 › the Sandbox draws the sample machine (7.3s)
  ✓  25 [phone] › e2e/diagram.spec.ts:71:1 › the diagram fits a phone screen without a sideways scroll of the page (1.4s)
  ✓  23 [phone] › e2e/diagram.spec.ts:64:1 › the diagram follows the language: the description and the start label (3.1s)
  ✓  21 [phone] › e2e/diagram.spec.ts:6:1 › the Sandbox draws the sample machine (6.3s)
  ✓  28 [phone] › e2e/diagram.spec.ts:71:1 › the diagram fits a phone screen without a sideways scroll of the page (1.4s)
  ✓  26 [phone] › e2e/diagram.spec.ts:26:1 › the labels do not overlap each other or a state, as drawn by the browser (2.8s)
  ✓  27 [phone] › e2e/diagram.spec.ts:64:1 › the diagram follows the language: the description and the start label (2.9s)
  ✓  24 [phone] › e2e/diagram.spec.ts:6:1 › the Sandbox draws the sample machine (6.5s)
  ✓  30 [phone] › e2e/diagram.spec.ts:26:1 › the labels do not overlap each other or a state, as drawn by the browser (2.6s)
  ✓  32 [phone] › e2e/diagram.spec.ts:71:1 › the diagram fits a phone screen without a sideways scroll of the page (1.7s)
  ✓  31 [phone] › e2e/diagram.spec.ts:64:1 › the diagram follows the language: the description and the start label (3.5s)
  ✓  29 [phone] › e2e/diagram.spec.ts:6:1 › the Sandbox draws the sample machine (7.6s)
  ✓  34 [phone] › e2e/diagram.spec.ts:26:1 › the labels do not overlap each other or a state, as drawn by the browser (3.5s)
  ✓  36 [phone] › e2e/diagram.spec.ts:71:1 › the diagram fits a phone screen without a sideways scroll of the page (1.1s)
  ✓  35 [phone] › e2e/diagram.spec.ts:64:1 › the diagram follows the language: the description and the start label (3.2s)
  ✓  33 [phone] › e2e/diagram.spec.ts:6:1 › the Sandbox draws the sample machine (7.5s)
  ✓  38 [phone] › e2e/diagram.spec.ts:26:1 › the labels do not overlap each other or a state, as drawn by the browser (2.3s)
  ✓  40 [phone] › e2e/diagram.spec.ts:71:1 › the diagram fits a phone screen without a sideways scroll of the page (769ms)
  ✓  39 [phone] › e2e/diagram.spec.ts:64:1 › the diagram follows the language: the description and the start label (1.9s)
  ✓  37 [phone] › e2e/diagram.spec.ts:6:1 › the Sandbox draws the sample machine (4.3s)

  5 skipped
  35 passed (43.7s)
```

### 11. `pnpm test:e2e`
```
$ pnpm --filter web test:e2e
$ playwright test --project=desktop --project=phone

Running 824 tests using 6 workers
...
  121 skipped
  703 passed (9.4m)
```
