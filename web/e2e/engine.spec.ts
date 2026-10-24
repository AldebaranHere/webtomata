// The engine in the real browser: the page stays responsive while the engine works, and a failed
// engine shows a notice that the user can use to try again.
import { expect, expectNoAxeViolations, test } from './fixtures.ts';

// How long the main thread is blocked: the biggest gap between two ticks of a timer. The page
// gets startGapWatch(), which returns a function that stops the watch and gives the gap.
type GapWatch = { startGapWatch?: () => () => number };

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		(window as unknown as GapWatch).startGapWatch = () => {
			let last = performance.now();
			let biggestGap = 0;
			const timer = setInterval(() => {
				const now = performance.now();
				biggestGap = Math.max(biggestGap, now - last);
				last = now;
			}, 10);
			return () => {
				clearInterval(timer);
				return biggestGap;
			};
		};
	});
});

const VERSION = /^\d+\.\d+\.\d+/;

test('the gap watch sees a main thread that is blocked (so that the next test can fail)', async ({
	page
}) => {
	await page.goto('/');
	const gap = await page.evaluate(async () => {
		const stop = (window as unknown as GapWatch).startGapWatch!();
		await new Promise((done) => setTimeout(done, 50));
		const end = performance.now() + 500;
		while (performance.now() < end) {
			// Busy: the main thread does nothing else for half a second.
		}
		await new Promise((done) => setTimeout(done, 50));
		return stop();
	});
	expect(gap).toBeGreaterThan(400);
});

test('the page stays responsive while the engine works on a heavy call', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('.version code')).toHaveText(VERSION);
	// The worker of the app, started by the version call. We start a second one from the same
	// file and give it a big job, so that the real WASM code runs for a while.
	const workerUrl = page.workers()[0]?.url();
	expect(workerUrl, 'the app has started its worker').toBeTruthy();

	const run = await page.evaluate(async (url) => {
		// A chain of 2,000 states (the most that the engine accepts), already minimal: about 2,000
		// rounds of splitting. This is the slowest case that we know.
		const n = 2000;
		const transitions = [];
		for (let i = 0; i < n; i++) {
			transitions.push({ from: i, on: 'a', to: Math.min(i + 1, n - 1) });
			transitions.push({ from: i, on: 'b', to: i });
		}
		const machine = {
			schemaVersion: 1,
			kind: 'dfsm',
			alphabet: ['a', 'b'],
			states: Array.from({ length: n }, (_, i) => i),
			start: 0,
			accepting: [n - 1],
			transitions
		};

		const stopWatch = (window as unknown as GapWatch).startGapWatch!();

		const worker = new Worker(url, { type: 'module' });
		const started = performance.now();
		const answer = await new Promise<{ result: { ok: boolean; value: { result: string } } }>(
			(done) => {
				worker.onmessage = (event) => done(event.data);
				worker.postMessage({
					id: 1,
					method: 'minimize',
					args: [machine, { maxSteps: 10_000_000 }]
				});
			}
		);
		const tookMs = performance.now() - started;
		const biggestGap = stopWatch();
		worker.terminate();
		return {
			ok: answer.result.ok,
			finished: answer.result.value.result,
			tookMs,
			biggestGap
		};
	}, workerUrl!);

	expect(run.ok).toBe(true);
	expect(run.finished).toBe('finished');
	// The job must be long enough to mean something: on the main thread it would block for this
	// long. The page must have been free for all but a short time.
	expect(run.tookMs, 'the job took a while').toBeGreaterThan(600);
	expect(run.biggestGap, 'the main thread was never blocked for long').toBeLessThan(250);
});

test.describe('an engine that cannot start', () => {
	// The WASM file is blocked on purpose, so the browser reports a failed request and an error.
	test.use({ allowedProblem: /\.wasm|Failed to load resource/ });

	test('shows a notice, and "Coba lagi" starts it again', async ({ page }) => {
		let blocked = true;
		await page.route('**/*.wasm', (route) => (blocked ? route.abort() : route.continue()));
		await page.goto('/');

		const notice = page.getByRole('status').filter({ hasText: 'Engine berhenti.' });
		await expect(notice).toBeVisible();
		await expect(notice).toContainText('Terjadi masalah saat menjalankan perhitungan. Coba lagi.');
		await expect(page.locator('.version code')).toHaveText('');
		await expectNoAxeViolations(page);

		blocked = false;
		await notice.getByRole('button', { name: 'Coba lagi' }).click();
		await expect(page.locator('.version code')).toHaveText(VERSION);
		await expect(notice).toBeHidden();
	});

	test('shows the notice in English too', async ({ page }) => {
		await page.route('**/*.wasm', (route) => route.abort());
		await page.addInitScript(() => localStorage.setItem('webtomata.lang', 'en'));
		await page.goto('/');
		const notice = page.getByRole('status').filter({ hasText: 'The engine stopped.' });
		await expect(notice).toBeVisible();
		await expect(notice.getByRole('button', { name: 'Try again' })).toBeVisible();
	});
});
