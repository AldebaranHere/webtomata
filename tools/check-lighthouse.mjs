// Runs Lighthouse (mobile preset) 3 times per route on the production build and
// fails if a median score or metric misses the budgets in budgets.mjs.
import lighthouse from 'lighthouse';
import { launchChrome } from './chrome.mjs';
import { METRICS, ROUTES } from './budgets.mjs';
import { serveBuild } from './serve-build.mjs';

const RUNS = 3;
const { origin, close: closeServer } = await serveBuild(process.argv[2] ?? 'web/build');

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const chrome = await launchChrome();
let failed = false;

try {
	for (const route of ROUTES) {
		const runs = [];
		for (let i = 0; i < RUNS; i++) {
			const { lhr } = await lighthouse(origin + route.path, {
				port: chrome.port,
				output: 'json',
				logLevel: 'error'
			});
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
