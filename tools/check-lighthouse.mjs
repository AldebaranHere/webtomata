// Runs Lighthouse (mobile preset) 3 times per route on the production build and
// fails if a median score or metric misses the budgets in budgets.mjs.
import lighthouse from 'lighthouse';
import { launchChrome } from './chrome.mjs';
import { retrying, withTimeout } from './with-timeout.mjs';
import { METRICS, ROUTES } from './budgets.mjs';
import { serveBuild } from './serve-build.mjs';

const RUNS = 3;
/** A run takes 8 to 12 seconds. One that takes a minute is hung: Chrome stopped answering. */
// (The variable is for trying the retry by hand: LIGHTHOUSE_RUN_TIMEOUT_MS=1 makes every run time out.)
const RUN_TIMEOUT_MS = Number(process.env.LIGHTHOUSE_RUN_TIMEOUT_MS ?? 60_000);
const { origin, close: closeServer } = await serveBuild(process.argv[2] ?? 'web/build');

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
let chrome = await launchChrome();
let failed = false;

// One Lighthouse run. A run that hangs or fails (not a low score, which is a result) is tried once
// more with a fresh Chrome: a hung run held a CI job for 14 minutes before this (run 40344527053).
const measure = (url) =>
	retrying(
		() =>
			withTimeout(
				lighthouse(url, { port: chrome.port, output: 'json', logLevel: 'error' }),
				RUN_TIMEOUT_MS,
				`the Lighthouse run of ${url}`
			),
		{
			onFail: async (error) => {
				console.log(`${error.message}; starting a new Chrome and trying once more.`);
				try {
					await chrome.kill();
				} catch {
					// It is gone already.
				}
				chrome = await launchChrome();
			}
		}
	);

try {
	for (const route of ROUTES) {
		const runs = [];
		for (let i = 0; i < RUNS; i++) {
			const { lhr } = await measure(origin + route.path);
			runs.push(lhr);
		}
		const check = (name, value, ok, shown) => {
			failed ||= !ok;
			console.log(`${ok ? 'ok  ' : 'FAIL'} ${route.path} ${name}: ${shown ?? value}`);
		};
		for (const [cat, min] of Object.entries(route.scores)) {
			const score = Math.round(median(runs.map((r) => r.categories[cat].score)) * 100);
			check(cat, score, score >= min, `${score} (min ${min})`);
		}
		const m = (id) => median(runs.map((r) => r.audits[id].numericValue));
		const lcp = m('largest-contentful-paint');
		const cls = m('cumulative-layout-shift');
		const tbt = m('total-blocking-time');
		check('LCP', lcp, lcp <= METRICS.lcpMs, `${Math.round(lcp)} ms (max ${METRICS.lcpMs})`);
		check('CLS', cls, cls <= METRICS.cls, `${cls.toFixed(3)} (max ${METRICS.cls})`);
		check('TBT', tbt, tbt <= METRICS.tbtMs, `${Math.round(tbt)} ms (max ${METRICS.tbtMs})`);
	}
} finally {
	await chrome.kill();
	closeServer();
}

if (failed) process.exit(1);
