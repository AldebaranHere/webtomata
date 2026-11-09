# Task T-072 Report — Find the test that leaves an engine call open (the unhandled `EngineTimeout`)

Branch: `task/T-072-open-engine-call`, cut from `staging` at `78809ba` (PR 201).

Commits:
- `3a1d560` `docs(agent): start task T-072` (sets status to `in-progress` in `docs/agent/PLAN.md`).
- Second commit: `test(engine): fix leaking unawaited engine calls and add guard (T-072)` — the test fixes in `web/src/lib/engine/client.test.ts`, the immediate unsettled call guard in `client.test.ts`, `docs/agent/PLAN.md` set to `done`, and this report.

**Status: ready to merge.** All acceptance criteria (AC1–AC6) are verified with real command output pasted below. Zero production code files modified (`client.ts` completely clean).

---

## 1. AC1 — Name the leak with evidence

### Findings
The unhandled `EngineTimeout` rejections did **not** originate from `src/lib/editor/interaction/pda-editor.property.test.ts`. Because `web/vitest.config.ts` sets `isolate: false`, test files within each Vitest worker share the Node event loop and process state. When an unawaited engine call is initiated against a `FakeWorker` that never replies, a real Node `setTimeout` timer for `callMs` (10,000 ms) remains active on Node's event loop. When that 10-second timer fires, `timeOut()` in `client.ts` rejects the pending promise. If nobody catches that promise, Node emits an `unhandledRejection`, which Vitest captures and attributes to whichever test file happens to be currently running (such as `pda-editor.property.test.ts`).

### Leaking file and call locations
A temporary probe was added to `client.ts` that recorded `new Error().stack` on every `call()` and printed the stack when `timeOut()` fired. Running the suite with `PROBE_TIMEOUT_MS=1000` revealed **7 leaking unreplied/unawaited engine calls, all located in `web/src/lib/engine/client.test.ts`**:

1. **`client.test.ts:65`** — `void engine.version();`
   - *Suite:* `describe('a call') > it('makes a worker on the first call, reuses it on the second')`
   - *Why it leaked:* The test called `version()` twice to test worker reuse. The first call was answered with `workers[0]!.reply({ id: 1, ... })`, setting `answered = true`. The second call was dispatched with `void engine.version()`, but the test never replied to call `id: 2` and never awaited it. Because `answered` was true, `callMs` (10,000 ms) was assigned. When test runs exceeded 10 seconds, this timer expired during later test files.
2. **`client.test.ts:71`** — `void engine.regexToFsm('a*b', ['a', 'b']);`
   - *Suite:* `it('sends the method and the arguments')`
   - *Why it leaked:* Dispatched `regexToFsm` and asserted `workers[0]!.posted[0]`, but never replied to call 1 and never awaited the returned promise.
3. **`client.test.ts:99`** — `void engine.version();`
   - *Suite:* `it('rejects only the call whose arguments cannot be sent')`
   - *Why it leaked:* Dispatched `version()`, then simulated a `failToSend` error on a subsequent `validate()` call, but left call 1 open without reply or await.
4. **`client.test.ts:109`** — `void engine.simulate(...)`, `void engine.determinize(...)`, `void engine.equivalent(...)`, and **line 118** `void engine.simulateMany(...)`
   - *Suite:* `describe('the web budgets') > it('are added when the call has no budget')`
   - *Why it leaked:* 4 calls were dispatched to inspect arguments posted to the worker, but none received replies and none were awaited.
5. **`client.test.ts:122`** — `void engine.simplify('a', ['a'], { maxChecks: 7 });`
   - *Suite:* `it('give way to the fields of the call, field by field')`
   - *Why it leaked:* Dispatched `simplify`, checked posted args, never replied or awaited.
6. **`client.test.ts:128`** — `void engine.simplifyViaMachine('a', ['a']);`
   - *Suite:* `it('are added to the call that goes through the machine')`
   - *Why it leaked:* Dispatched `simplifyViaMachine`, checked posted args, never replied or awaited.
7. **`client.test.ts:134`** — `void engine.complement(machine);`
   - *Suite:* `it('are not added to a method that has no budget')`
   - *Why it leaked:* Dispatched `complement`, checked posted args, never replied or awaited.

### Probe stack trace (pasted from test run)
```
Error: Engine call leak probe
    at call (/home/Aldebaran64/webtomata/web/src/lib/engine/client.ts:133:14)
    at Object.version (/home/Aldebaran64/webtomata/web/src/lib/engine/client.ts:220:13)
    at /home/Aldebaran64/webtomata/web/src/lib/engine/client.test.ts:65:15
    at file:///home/Aldebaran64/webtomata/web/node_modules/.pnpm/@vitest+runner@3.0.5/node_modules/@vitest/runner/dist/index.js:528:22
    at runTest (file:///home/Aldebaran64/webtomata/web/node_modules/.pnpm/@vitest+runner@3.0.5/node_modules/@vitest/runner/dist/index.js:1050:11)
```

---

## 2. AC2 — Reproduce it every time before the fix, 0 times after

Using `PROBE_TIMEOUT_MS=1000` (lowered call timeout so leaks fire deterministically within 1 second):

### Before fix (3 runs out of 3 failed with unhandled rejections)
- **Run 1:**
  ```
  Test Files  115 passed (115)
       Tests  1363 passed | 2 skipped (1365)
      Errors  7 errors
    Duration  10.12s
  ```
- **Run 2:**
  ```
  Test Files  115 passed (115)
       Tests  1363 passed | 2 skipped (1365)
      Errors  8 errors
    Duration  14.11s
  ```
- **Run 3:**
  ```
  Test Files  115 passed (115)
       Tests  1363 passed | 2 skipped (1365)
      Errors  7 errors
    Duration  10.99s
  ```

### After fix (3 runs out of 3 passed with 0 errors)
- **Run 1:**
  ```
  Test Files  115 passed (115)
       Tests  1363 passed | 2 skipped (1365)
      Errors  0
    Duration  10.13s
  ```
- **Run 2:**
  ```
  Test Files  115 passed (115)
       Tests  1363 passed | 2 skipped (1365)
      Errors  0
    Duration  8.98s
  ```
- **Run 3:**
  ```
  Test Files  115 passed (115)
       Tests  1363 passed | 2 skipped (1365)
      Errors  0
    Duration  9.20s
  ```

All temporary probe code was completely removed from `web/src/lib/engine/client.ts`.

---

## 3. AC3 — The fix is in the test

In `web/src/lib/engine/client.test.ts`, all 7 leaking calls are replied to by the `FakeWorker` and their returned promises are awaited. No existing assertions were removed or weakened:

```diff
@@ -62,17 +106,21 @@ describe('a call', () => {
 		expect(workers).toHaveLength(1);
 		workers[0]!.reply({ id: 1, result: worked('0.0.0') });
 		expect(await answer).toEqual({ ok: true, value: '0.0.0' });
-		void engine.version();
+		const second = engine.version();
 		expect(workers).toHaveLength(1);
+		workers[0]!.reply({ id: 2, result: worked('0.0.0') });
+		await second;
 	});
 
-	it('sends the method and the arguments', () => {
+	it('sends the method and the arguments', async () => {
 		const { engine, workers } = setup();
-		void engine.regexToFsm('a*b', ['a', 'b']);
+		const call = engine.regexToFsm('a*b', ['a', 'b']);
 		expect(workers[0]!.posted[0]).toMatchObject({
 			method: 'regexToFsm',
 			args: ['a*b', ['a', 'b'], { maxStates: 500 }]
 		});
+		workers[0]!.reply({ id: 1, result: worked(machine) });
+		await call;
 	});
@@ -96,7 +144,9 @@ describe('a call', () => {
 
 	it('rejects only the call whose arguments cannot be sent', async () => {
 		const { engine, workers } = setup();
-		void engine.version();
+		const first = engine.version();
+		workers[0]!.reply({ id: 1, result: worked('0.0.0') });
+		await first;
 		workers[0]!.failToSend = new Error('DataCloneError');
 		await expect(engine.validate(machine)).rejects.toThrow('DataCloneError');
 		expect(workers[0]!.terminated).toBe(false);
@@ -104,35 +154,46 @@ describe('a call', () => {
 describe('the web budgets', () => {
-	it('are added when the call has no budget', () => {
+	it('are added when the call has no budget', async () => {
 		const { engine, workers } = setup();
-		void engine.simulate(machine, 'ab');
-		void engine.determinize(machine);
-		void engine.equivalent(machine, machine);
+		const sim = engine.simulate(machine, 'ab');
+		const det = engine.determinize(machine);
+		const eq = engine.equivalent(machine, machine);
 		const [simulate, determinize, equivalent] = workers[0]!.posted;
 		expect(simulate!.args[2]).toEqual(WEB_BUDGETS.simulate);
 		expect(determinize!.args[1]).toEqual(WEB_BUDGETS.determinize);
 		expect(equivalent!.args[2]).toEqual(WEB_BUDGETS.equivalent);
-		void engine.simulateMany(machine, ['a']);
+		const sm = engine.simulateMany(machine, ['a']);
 		expect(workers[0]!.posted[3]!.args[2]).toEqual(WEB_BUDGETS.simulateMany);
+		workers[0]!.reply({ id: 1, result: worked(null) });
+		workers[0]!.reply({ id: 2, result: worked(null) });
+		workers[0]!.reply({ id: 3, result: worked(null) });
+		workers[0]!.reply({ id: 4, result: worked(null) });
+		await Promise.all([sim, det, eq, sm]);
 	});
 
-	it('give way to the fields of the call, field by field', () => {
+	it('give way to the fields of the call, field by field', async () => {
 		const { engine, workers } = setup();
-		void engine.simplify('a', ['a'], { maxChecks: 7 });
+		const call = engine.simplify('a', ['a'], { maxChecks: 7 });
 		expect(workers[0]!.posted[0]!.args[2]).toEqual({ maxChecks: 7, maxSteps: 5_000 });
+		workers[0]!.reply({ id: 1, result: worked(null) });
+		await call;
 	});
 
-	it('are added to the call that goes through the machine', () => {
+	it('are added to the call that goes through the machine', async () => {
 		const { engine, workers } = setup();
-		void engine.simplifyViaMachine('a', ['a']);
+		const call = engine.simplifyViaMachine('a', ['a']);
 		expect(workers[0]!.posted[0]!.args[2]).toEqual(WEB_BUDGETS.simplifyViaMachine);
+		workers[0]!.reply({ id: 1, result: worked(null) });
+		await call;
 	});
 
-	it('are not added to a method that has no budget', () => {
+	it('are not added to a method that has no budget', async () => {
 		const { engine, workers } = setup();
-		void engine.complement(machine);
+		const call = engine.complement(machine);
 		expect(workers[0]!.posted[0]!.args).toEqual([machine]);
+		workers[0]!.reply({ id: 1, result: worked(null) });
+		await call;
 	});
```

---

## 4. AC4 — Immediate guard in `client.test.ts` and deliberate break

The guard wraps the engine methods returned in `setup()` to track returned promises in a pending map. Settlement (fulfillment or rejection) unregisters the promise. An `afterEach` hook verifies that every call promise has settled; if any call is still pending when the test finishes, it immediately fails *that test* by name and outputs the call method and exact call site stack:

```ts
interface PendingCall {
	method: string;
	args: unknown[];
	stack: string;
}

const activeEngines: Array<{
	pending: Map<Promise<unknown>, PendingCall>;
}> = [];

afterEach(async () => {
	await Promise.resolve();
	const leaks: PendingCall[] = [];
	for (const { pending } of activeEngines) {
		for (const call of pending.values()) {
			leaks.push(call);
		}
	}
	activeEngines.length = 0;
	if (leaks.length > 0) {
		const descriptions = leaks.map((c) => `  - ${c.method} called at:\n${c.stack}`).join('\n');
		throw new Error(`Test ended with ${leaks.length} unsettled engine call(s):\n${descriptions}`);
	}
});
```

### Deliberate break verification
A deliberate break was added to `it('sends the method and the arguments')`:
```diff
+       void engine.version();
```

Output when running `pnpm --filter web exec vitest run src/lib/engine/client.test.ts`:
```
FAIL src/lib/engine/client.test.ts > a call > sends the method and the arguments
Error: Test ended with 1 unsettled engine call(s):
  - version called at:
Error:
    at /home/Aldebaran64/webtomata/web/src/lib/engine/client.test.ts:128:15
    at file:///home/Aldebaran64/webtomata/web/node_modules/.pnpm/@vitest+runner@3.0.5/node_modules/@vitest/runner/dist/index.js:528:22
    at runTest (file:///home/Aldebaran64/webtomata/web/node_modules/.pnpm/@vitest+runner@3.0.5/node_modules/@vitest/runner/dist/index.js:1050:11)
```

The test failed immediately at test end, precisely naming the method and file:line (`client.test.ts:128:15`). The break was restored and all 30 tests in `client.test.ts` passed.

---

## 5. AC5 — Quiet and loaded whole-suite verification

### 5 quiet runs in a row (clean code, normal conditions)
- **Run 1:**
  `uptime`: `20:13:29 up  7:22,  1 user,  load average: 0.42, 0.95, 0.56`
  `Test Files  115 passed (115)` | `Tests  1363 passed | 2 skipped (1365)` | `Duration  9.88s`
- **Run 2:**
  `uptime`: `20:13:40 up  7:22,  1 user,  load average: 1.25, 1.12, 0.62`
  `Test Files  115 passed (115)` | `Tests  1363 passed | 2 skipped (1365)` | `Duration  10.30s`
- **Run 3:**
  `uptime`: `20:13:51 up  7:22,  1 user,  load average: 2.46, 1.39, 0.72`
  `Test Files  115 passed (115)` | `Tests  1363 passed | 2 skipped (1365)` | `Duration  10.46s`
- **Run 4:**
  `uptime`: `20:14:02 up  7:22,  1 user,  load average: 3.81, 1.72, 0.83`
  `Test Files  115 passed (115)` | `Tests  1363 passed | 2 skipped (1365)` | `Duration  10.63s`
- **Run 5:**
  `uptime`: `20:14:13 up  7:23,  1 user,  load average: 4.95, 2.04, 0.95`
  `Test Files  115 passed (115)` | `Tests  1363 passed | 2 skipped (1365)` | `Duration  9.70s`

### 3 loaded runs under 12 background processes
- **Loaded Run 1:**
  `uptime`: `20:29:01 up  7:37,  1 user,  load average: 1.28, 0.73, 1.04`
  `Test Files  115 passed (115)` | `Tests  1363 passed | 2 skipped (1365)` | `Duration  24.01s`
- **Loaded Run 2:**
  `uptime`: `20:29:26 up  7:38,  1 user,  load average: 7.01, 2.17, 1.51`
  `Test Files  115 passed (115)` | `Tests  1363 passed | 2 skipped (1365)` | `Duration  18.39s`
- **Loaded Run 3:**
  `uptime`: `20:29:46 up  7:38,  1 user,  load average: 10.38, 3.29, 1.90`
  `Test Files  115 passed (115)` | `Tests  1363 passed | 2 skipped (1365)` | `Duration  24.69s`

### Process cleanup verification
`pkill -9 yes 2>/dev/null || true`
`pgrep yes`: exit code 1 (no processes running).

---

## 6. AC6 — Quality gates & git diff check

Command output from quality gate script:
- `pnpm format:check`: `All matched files use Prettier code style!`
- `pnpm check`: `svelte-check found 0 errors and 0 warnings`
- `pnpm lint`: `eslint .` clean (0 errors, 0 warnings)
- `pnpm check:strings`: `ok   75 components have no hard-coded text`
- `pnpm check:tokens`: `ok   77 files use no raw colors`
- `pnpm build`: build completed in 1.46s
- `pnpm size`:
  - `initial JS index.html: 81.5 KB gzip (limit 170 KB)`
  - `initial JS panduan/berakhiran-x.html: 88.5 KB gzip (limit 170 KB)`
  - `initial JS panduan.html: 82.3 KB gzip (limit 170 KB)`
  - `initial JS sandbox.html: 124.7 KB gzip (limit 170 KB)`
  - `initial JS soal/berakhiran-10.html: 124.1 KB gzip (limit 170 KB)`
  - `initial JS soal/jumlah-a-genap.html: 124.1 KB gzip (limit 170 KB)`
  - `initial JS soal/mengandung-101.html: 124.1 KB gzip (limit 170 KB)`
  - `initial JS soal.html: 83.7 KB gzip (limit 170 KB)`
  - `initial JS tentang.html: 81.6 KB gzip (limit 170 KB)`
  - `layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)`
  - `wasm _app/immutable/workers/assets/engine_wasm_bg-VlyrwV86.wasm: 237.0 KB gzip (limit 250 KB)`

---

## 7. Deepening Pass

1. **Exports and Public Interface Audit:**
   - Zero new exports added to any module.
   - Zero modifications to public APIs or interfaces.
   - `web/src/lib/engine/client.ts` is 100% untouched, ensuring zero growth in bundle size or runtime logic.
2. **Type Safety & Casts:**
   - Zero casts added in production code.
   - Guard in `client.test.ts` only type-casts test mocks (`raw[method] as (...args: unknown[]) => Promise<unknown>`) within test scope.
3. **Duplicate logic:**
   - None. All engine calls are resolved using standard existing test helpers (`workers[0]!.reply({ id, result: worked(...) })`).
