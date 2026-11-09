# Task T-069 Report — No wall-clock bound in a unit test

Branch: `task/T-069-no-wall-clock-bounds`, cut from `staging` at `eafd82c` (merge of PR 197).

Commits:

- `ff64295` `test(editor): replace wall-clock assertions with thread CPU scaling ratios (T-069)` — the test replacements, the `scalingRatio` helper in `testing.ts`, and `PLAN.md` set to `in-progress`.
- The second commit records this report, sets Task T-069 to `done` in `docs/agent/PLAN.md`.

**Status: ready to merge.** All acceptance criteria (AC1–AC5) are verified with real command output pasted below. Deliberate breaks B1, B2, and B3 were re-run on the final code.

---

## 1. What changed

Four unit tests that previously asserted absolute wall-clock durations (`< 100` ms, `< 1000` ms, `< 500` ms) were replaced with scaling ratio assertions or structural refusal checks so that they never fail on busy machines or under CPU contention:

1. **`web/src/lib/editor/diagram/geometry.test.ts` (Neighbors):**
   - Renamed from `"draws 200 states and 421 edges between neighbors quickly (9 ms measured)"` to `"draws states and edges between neighbors with near-linear scaling"`.
   - Replaced wall-clock `performance.now() - started < 100` with `scalingRatio` between $n=50$ ($E \approx 100$) and $4n=200$ ($E \approx 420$).
   - `smallRepeats: 8, largeRepeats: 1, samples: 5`. Bound: `< 12` (quiet median 3.80, loaded median 3.89, loaded max 5.38; bound 12 gives >2x headroom while catching quadratic accidents). Timeout: 15 s.
2. **`web/src/lib/editor/diagram/geometry.test.ts` (Worst Case):**
   - Renamed from `"draws the worst case, 600 random edges across 200 states, in well under a second (96 ms measured)"` to `"draws the worst case of random edges across states with bounded scaling"`.
   - Replaced wall-clock `took < 1000` with `scalingRatio` between $n=50$ ($E=150$) and $4n=200$ ($E=600$).
   - `smallRepeats: 2, largeRepeats: 1, samples: 5`. Bound: `< 12` (quiet median 7.81, max 9.28; loaded median 7.60, max 9.44; bound 12 provides >25% margin over loaded max 9.44 while failing accidental loops). Timeout: 15 s.
3. **`web/src/lib/editor/history.property.test.ts` (Speed):**
   - Renamed from `"moves a state of a document with 2,000 states 300 times in well under a second"` to `"moves states with near-linear scaling in document size"`.
   - Replaced wall-clock `milliseconds < 1000` with `scalingRatio` between $n=500$ states and $4n=2000$ states (200 moveState operations).
   - `smallRepeats: 3, largeRepeats: 1, samples: 5`. Bound: `< 10` (quiet median 4.00, loaded median 3.82, loaded max 5.16; bound 10 provides ~2x margin over loaded max while catching quadratic moves). Timeout: 15 s.
4. **`web/src/lib/questions/load.test.ts` (Alias Bomb):**
   - Replaced wall-clock `performance.now() - started < 500` with a 9-level bomb of 9 aliases ($9^9 \approx 3.87 \times 10^8$ items if expanded).
   - Asserts that `question` is undefined, `problems.length > 0`, `problems[0]!.path === '(file)'`, and `problems[0]!.message.toContain('anchors and aliases')`.
   - The YAML loader refuses at the first anchor during CST traversal and never expands, making a clock check unnecessary; explicit 15 s timeout acts as backstop.
5. **`web/src/lib/editor/testing.ts` (Scaling Ratio Helper):**
   - Added pure test helper `scalingRatio(small, large, options)` and interface `ScalingRatioOptions`.
   - Uses thread CPU time (`process.threadCpuUsage()`, user + system, floored at 50 µs = 0.05 ms).
   - One warm-up call of each size to eliminate JIT/first-use costs.
   - Interleaved sampling (`small, large, small, large, ...`, best of 5 samples for each size).

Files touched: `web/src/lib/editor/testing.ts`, `web/src/lib/editor/diagram/geometry.test.ts`, `web/src/lib/editor/history.property.test.ts`, `web/src/lib/questions/load.test.ts`, `docs/agent/PLAN.md`.
**Zero production code files modified.**

---

## 2. Planner approvals during the task

On 2026-11-09, the planner approved the following refinements:
1. **Thread CPU time instead of wall-clock time:** Thread CPU time (`process.threadCpuUsage()`, user + system in microseconds) is used rather than `performance.now()` in `scalingRatio`. Wall clock inflates dramatically under CPU saturation (observed up to 8x), whereas thread CPU usage measures only the CPU time consumed by the active Vitest worker thread, keeping ratio measurements stable across quiet and loaded environments.
2. **Sampling protocol:**
   - One warm-up execution of each workload size before sampling begins.
   - Interleaved samples (`small, large, small, large, ...`, 5 samples of each size, taking the minimum/best CPU time).
   - Small repeat counts to ensure small sample CPU time is at least ~10–36 ms (`smallRepeats: 8` for Neighbors, `smallRepeats: 2` for Worst Case, `smallRepeats: 3` for History).
3. **Bounds:**
   - Neighbors: bound `< 12`
   - History: bound `< 10`
   - Worst Case: bound `< 12` (rule: above 40 honest runs max of 9.44 with >25% margin, below accident min 16.63 with >1.5x margin; kept at 12 as honest loaded ratios are all $< 12$).
4. **Helper location:** Placed in `web/src/lib/editor/testing.ts` after verifying with `grep -rn "editor/testing" web/src | grep -v "\.test\."` that no production code imports `testing.ts`.

---

## 3. AC1 — Reproduction of wall-clock failure under load

Before any code changes, the four existing tests were measured 5 times quiet, and 5 times under the load of `nproc` (12) copies of `yes > /dev/null`:

### Quiet Runs (5 runs)
- **Geometry (Neighbors, < 100 ms):** 11.08 ms, 11.23 ms, 11.39 ms, 11.75 ms, 11.16 ms (all passed)
- **Geometry (Worst Case, < 1000 ms):** 113.88 ms, 112.59 ms, 113.23 ms, 113.62 ms, 113.92 ms (all passed)
- **History (Move 2000 states, < 1000 ms):** 16.70 ms, 15.65 ms, 15.93 ms, 16.59 ms, 15.66 ms (all passed)
- **Questions (Alias bomb, < 500 ms):** 0.16 ms, 0.13 ms, 0.14 ms, 0.14 ms, 0.13 ms (all passed)

### Loaded Runs (12 `yes` background processes)
- **Geometry (Neighbors, < 100 ms):** 69.41 ms, **467.88 ms (FAILED)**, **104.29 ms (FAILED)**, 55.48 ms, 90.07 ms (Failed 2 of 5 runs!)
- **Geometry (Worst Case, < 1000 ms):** 765.23 ms, 520.15 ms, 563.88 ms, 621.57 ms, 694.01 ms (ballooned ~6.7x from 113 ms)
- **History (Move 2000 states, < 1000 ms):** 114.28 ms, 116.66 ms, 115.62 ms, 98.71 ms, 113.08 ms (ballooned ~7.3x from 15.6 ms)
- **Questions (Alias bomb, < 500 ms):** 1.13 ms, 0.98 ms, 1.25 ms, 1.09 ms, 0.94 ms (ballooned ~8x from 0.13 ms)

Under 12-core saturation, wall-clock times ballooned up to 8x and caused Test 1 (Neighbors) to fail twice. All background `yes` processes were cleanly terminated (`pgrep yes` printed nothing).

---

## 4. AC2 — Five consecutive whole-suite runs under load (all green)

After replacing the tests with thread CPU scaling ratios and the structural alias bomb check, the entire test suite (113 test files, 1336 tests) was executed 5 consecutive times under the load of 12 background `yes` processes. All 5 runs were completely green:

```
Run 1:
Uptime: 16:41:48 up 8:36, 0 users, load average: 10.96, 7.82, 4.39
Ratios measured: [Neighbors: 3.966] [History: 4.082] [Worst Case: 7.420]
Test Files: 113 passed (113)
Tests:      1336 passed | 2 skipped (1338)
Duration:   103.73s

Run 2:
Uptime: 16:43:35 up 8:37, 0 users, load average: 11.87, 8.78, 5.01
Ratios measured: [Neighbors: 3.731] [History: 4.195] [Worst Case: 7.234]
Test Files: 113 passed (113)
Tests:      1336 passed | 2 skipped (1338)
Duration:   103.20s

Run 3:
Uptime: 16:45:21 up 8:39, 0 users, load average: 11.95, 9.49, 5.61
Ratios measured: [Neighbors: 3.842] [History: 3.990] [Worst Case: 7.550]
Test Files: 113 passed (113)
Tests:      1336 passed | 2 skipped (1338)
Duration:   103.45s

Run 4:
Uptime: 16:47:08 up 8:41, 0 users, load average: 11.98, 10.05, 6.17
Ratios measured: [Neighbors: 4.015] [History: 4.112] [Worst Case: 7.398]
Test Files: 113 passed (113)
Tests:      1336 passed | 2 skipped (1338)
Duration:   102.89s

Run 5:
Uptime: 16:48:54 up 8:43, 0 users, load average: 11.99, 10.51, 6.70
Ratios measured: [Neighbors: 3.350] [History: 3.689] [Worst Case: 7.407]
Test Files: 113 passed (113)
Tests:      1336 passed | 2 skipped (1338)
Duration:   101.95s
```

All 5 runs passed with zero failures. Cleanup of `yes` processes verified: `pgrep yes` printed nothing.

---

## 5. AC3 — Ratio measurements and calibration

### Comparison of 20 Quiet Runs vs 20 Loaded Runs (Thread CPU time)

| Test | Quiet Min | Quiet Median | Quiet Max | Loaded Min | Loaded Median | Loaded Max | Bound |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Neighbors ($n=50 \to 200$)** | 3.424 | 3.801 | 5.187 | 3.336 | 3.894 | 5.378 | **12** |
| **History ($n=500 \to 2000$)** | 3.585 | 4.004 | 4.931 | 3.454 | 3.821 | 5.158 | **10** |
| **Worst Case ($n=50 \to 200$)** | 6.953 | 7.811 | 9.277 | 6.963 | 7.599 | 9.439 | **12** |

### The 20 Loaded Ratios for Worst Case:
`[7.621, 7.567, 7.339, 7.747, 7.631, 7.185, 7.531, 7.214, 7.702, 7.643, 8.441, 7.544, 7.411, 7.251, 9.439, 8.210, 6.963, 7.698, 7.164, 7.712]`

### Step 3: Worst Case Accident Ratios (10 quiet, 10 loaded)
Accident tested: every edge scans all states unconditionally with an inner comparison loop over states.
- **Quiet Accident Ratios (10 runs):**
  `[17.100, 14.721, 18.818, 16.398, 18.693, 21.884, 16.915, 18.823, 19.204, 19.280]`
  - Min: 14.721, Median: 18.759, Max: 21.884
- **Loaded Accident Ratios (10 runs under 12 `yes`):**
  `[18.730, 18.862, 16.629, 20.121, 17.020, 17.674, 17.802, 17.870, 19.362, 18.153]`
  - Min: 16.629, Median: 17.986, Max: 20.121

**Bound Justification:**
- **Honest Max across all 40 runs:** 9.439.
- Bound 12 provides $>25\%$ headroom over 9.439 ($9.439 \times 1.25 = 11.799 < 12$).
- Under accident, loaded min ratio is 16.629, median ~18.0.
- Per planner instruction: *"If after (1) the honest loaded ratios of Worst Case are all under 12, keep the bound at 12."* All 20 loaded runs were strictly $< 12$ (max 9.439), so bound 12 was kept. The Worst Case margin is thin (about 1.27x above the honest maximum and 1.2x below the accident minimum) and CI on another CPU is its first outside test.

---

## 6. AC4 — Deliberate breaks on final code

Each deliberate break was applied to the final code, proven to fail the corresponding test, and restored.

### Break B1: Geometry accident (unconditional state check per edge)

```diff
diff --git a/web/src/lib/editor/diagram/geometry.ts b/web/src/lib/editor/diagram/geometry.ts
index d6332a7..04e3c75 100644
--- a/web/src/lib/editor/diagram/geometry.ts
+++ b/web/src/lib/editor/diagram/geometry.ts
@@ -538,8 +538,10 @@ export function diagramGeometry(input: DiagramInput, options: DiagramOptions = {
 
 	// 2. An edge that passes close to a state (not its own) is busy at that angle for the state.
 	for (const edge of edges) {
-		const [x0, y0, x1, y1] = pointsBox(edge.points, NEAR);
-		for (const s of index(x0, y0, x1, y1)) {
+		for (const s of states) {
+			for (const o of states) {
+				if (s.x === o.x && s.y === o.y && s.id !== o.id) break;
+			}
 			if (s.id === edge.from || s.id === edge.to) continue;
 			const { distance, at } = nearestOnLine(s, edge.points);
 			if (distance < NEAR) makeBusy(s.id, angleOf(s, at));
```

**Failure output:**
```
 FAIL  src/lib/editor/diagram/geometry.test.ts > the whole drawing > draws states and edges between neighbors with near-linear scaling
AssertionError: expected 28.367666527972162 to be less than 12
 ❯ src/lib/editor/diagram/geometry.test.ts:579:17
    577|   // Linear scaling is ~4. Quiet median 3.80, loaded median 3.89, load…
    578|   // provides headroom under load while failing a quadratic accident (…
    579|   expect(ratio).toBeLessThan(12);
       |                 ^
    580|  }, 15_000);

 FAIL  src/lib/editor/diagram/geometry.test.ts > the whole drawing > draws the worst case of random edges across states with bounded scaling
AssertionError: expected 16.68400763771301 to be less than 12
 ❯ src/lib/editor/diagram/geometry.test.ts:619:18
    617|    // loaded median 7.60, max 9.44). Bound 12 gives >25% margin over t…
    618|    // while failing an accidental extra nested loop (ratio > 18).
    619|    expect(ratio).toBeLessThan(12);
       |                  ^
    620|   },
    621|   15_000
```
Ratio measured: 28.37 on Neighbors and 16.68 on Worst Case (both failed bound 12). Restored cleanly.

---

### Break B2: History accident (accidental $O(N^2)$ state search on move)

```diff
diff --git a/web/src/lib/editor/history.ts b/web/src/lib/editor/history.ts
index 7d3717a..9d750c3 100644
--- a/web/src/lib/editor/history.ts
+++ b/web/src/lib/editor/history.ts
@@ -87,6 +87,8 @@ function createGenericHistory<D, C>(
 		},
 
 		execute(command, { coalesce } = {}) {
+			const s = [...((present as any).states ?? [])];
+			for (const a of s) { for (const b of s) { if (a.id !== b.id && a.name === b.name) break; } }
 			const result = apply(present, command);
 			if (!result.ok || result.doc === present) return result;
```

**Failure output:**
```
 FAIL  src/lib/editor/history.property.test.ts > speed > moves states with near-linear scaling in document size
AssertionError: expected 15.506571897992714 to be less than 10
 ❯ src/lib/editor/history.property.test.ts:189:17
    187|   // Linear move cost in state count is ~4 (quiet median 4.00, max 4.9…
    188|   // Bound 10 provides ~2x headroom over quiet/loaded max while failin…
    189|   expect(ratio).toBeLessThan(10);
       |                 ^
    190|  }, 15_000);
```
Ratio measured: 15.51 (failed bound 10). Restored cleanly.

---

### Break B3: Alias bomb removal with memory cap (`NODE_OPTIONS=--max-old-space-size=512`)

```diff
diff --git a/web/src/lib/questions/load.ts b/web/src/lib/questions/load.ts
index 78fceb6..452569f 100644
--- a/web/src/lib/questions/load.ts
+++ b/web/src/lib/questions/load.ts
@@ -203,6 +203,7 @@ export function parseQuestionFile(text: string, validate: SchemaValidator): Pars
 	if (problems.length > 0) return { problems };
 
 	// Aliases can multiply a small file into a huge one, and nobody needs them in a question.
+	/*
 	let aliased = false;
 	visit(doc, {
 		Alias: () => {
@@ -226,20 +227,10 @@ export function parseQuestionFile(text: string, validate: SchemaValidator): Pars
 			]
 		};
 	}
+	*/
 
 	let data: unknown;
-	try {
-		data = doc.toJS();
-	} catch {
-		return {
-			problems: [
-				{
-					path: FILE,
-					message: 'anchors and aliases (&name, *name) are not allowed in a question file'
-				}
-			]
-		};
-	}
+	data = (doc as any).toJS({ maxAliasCount: -1 });
 	if (typeof data !== 'object' || data === null || Array.isArray(data)) {
 		return { problems: [{ path: FILE, message: WHOLE_FILE_MUST }] };
 	}
```

**Failure output:**
```
 FAIL  src/lib/questions/load.test.ts > a question file that is not read as it is > refuses anchors and aliases, which can be used to blow a file up
AssertionError: expected 'schemaVersion' to be '(file)' // Object.is equality

Expected: "(file)"
Received: "schemaVersion"

 ❯ src/lib/questions/load.test.ts:263:30
    261|    expect(question).toBeUndefined();
    262|    expect(problems.length).toBeGreaterThan(0);
    263|    expect(problems[0]!.path).toBe('(file)');
       |                              ^
    264|    expect(problems[0]!.message).toContain('anchors and aliases');
    265|   },
```
With the refusal removed, the file proceeded to schema validation instead of being rejected as an alias bomb; `problems[0].path` was `'schemaVersion'` rather than `'(file)'`, failing the structural assertion.
Worker cleanup verified: `pgrep -fa vitest` and `pgrep node` showed no leftover worker processes. Restored cleanly.

---

## 7. AC5 — Full verification suite output

### Verification command:
```
pnpm --filter web exec vitest run src/lib/editor/diagram/geometry.test.ts src/lib/editor/history.property.test.ts src/lib/questions/load.test.ts
```
**Output:**
```
 RUN  v5.0.3 /home/Aldebaran64/webtomata/web

 ✓ src/lib/questions/load.test.ts (32 tests) 167ms
 ✓ src/lib/editor/history.property.test.ts (7 tests) 677ms
 ✓ src/lib/editor/diagram/geometry.test.ts (44 tests) 1620ms
   ✓ the whole drawing (7)
     ✓ draws the worst case of random edges across states with bounded scaling 1244ms

 Test Files  3 passed (3)
      Tests  83 passed (83)
   Start at  17:00:43
   Duration  2.06s (tests 78%, transform 16%, import 5%, worker 1%)
```

### Full unit test gate (`pnpm --filter web test`):
```
 Test Files  113 passed (113)
      Tests  1336 passed | 2 skipped (1338)
   Start at  17:03:59
   Duration  12.16s (tests 75%, transform 18%, import 7%)
```

### Format, types, lint, guard rails:
- `pnpm format:check`: `All matched files use Prettier code style!`
- `pnpm check`: `svelte-check found 0 errors and 0 warnings`
- `pnpm lint && pnpm lint:rust`: `eslint .` clean; `cargo fmt --check && cargo clippy --all-targets -- -D warnings` clean.
- `pnpm check:strings && pnpm check:tokens`:
  - `ok   74 components have no hard-coded text`
  - `ok   76 files use no raw colors`
- `pnpm build && pnpm size`:
  - `initial JS index.html: 81.5 KB gzip (limit 170 KB)`
  - `sandbox.html: 124.7 KB gzip (limit 170 KB)`
  - `soal/*.html: 124.1 KB gzip (limit 170 KB)`
  - `wasm engine: 237.0 KB gzip (limit 250 KB)`
  - All bundle sizes within limits.
- E2E area spec (`pnpm --filter web exec playwright test e2e/diagram.spec.ts --project=desktop`):
  - `3 passed, 1 skipped (7.2s)`

---

## 8. Deepening pass

1. **Exports audit:**
   - `scalingRatio`: pure helper exported from `web/src/lib/editor/testing.ts`.
   - `ScalingRatioOptions`: interface for optional repeat counts and sample count.
   - Verified that `web/src/lib/editor/testing.ts` is imported only by test files (`*.test.ts`); no production code imports it.
2. **Casts count:**
   - Exactly zero casts (`any`, `@ts-ignore`, `as unknown as`) added in the production and test changes.
3. **Boundaries and limits:**
   - Floor of 50 µs ($0.05$ ms) enforced in `measureCpuUs` via `Math.max(50, ...)` to guard against division-by-zero or clock resolution jitter on near-zero workloads.
   - Worst Case scaling bound 12 tested against honest 40-run max (9.44) and accident loaded min (16.63).
   - Neighbors scaling bound 12 tested against honest 40-run max (5.38) and accident ratio (28.37).
   - History scaling bound 10 tested against honest 40-run max (5.16) and accident ratio (15.51).

---

## 9. Git diff --stat

```
 docs/agent/PLAN.md                          |   2 +-
 web/src/lib/editor/diagram/geometry.test.ts | 104 +++++++++++++++++++---------
 web/src/lib/editor/history.property.test.ts |  61 +++++++++++-----
 web/src/lib/editor/testing.ts               |  54 +++++++++++++++
 web/src/lib/questions/load.test.ts          |  19 +++--
 5 files changed, 176 insertions(+), 64 deletions(-)
```
Zero production code files modified.
