// Runs Lighthouse (mobile preset) 3 times per route on the production build and
// fails if a median score or metric misses the budgets in budgets.mjs.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { createGzip } from 'node:zlib';
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import { METRICS, ROUTES } from './budgets.mjs';

const RUNS = 3;
const buildDir = resolve(process.argv[2] ?? 'web/build');
const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.wasm': 'application/wasm',
	'.svg': 'image/svg+xml',
	'.txt': 'text/plain'
};

// Static server for the build, gzipping like the real host does.
const server = createServer((req, res) => {
	let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
	let file = join(buildDir, path);
	if (!file.startsWith(buildDir)) return res.writeHead(403).end();
	if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
	if (!existsSync(file)) return res.writeHead(404).end();
	const type = TYPES[extname(file)] ?? 'application/octet-stream';
	res.writeHead(200, { 'content-type': type, 'content-encoding': 'gzip' });
	createReadStream(file).pipe(createGzip()).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const origin = `http://127.0.0.1:${server.address().port}`;

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
// Chrome sometimes does not open its debugging port on a busy CI runner (it timed out once on
// a green commit). --disable-dev-shm-usage avoids the small /dev/shm of runners. Try a few
// times; a real score failure below still fails the check.
async function launchChrome() {
	const flags = ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'];
	for (let attempt = 1; ; attempt++) {
		try {
			return await launch({ chromeFlags: flags });
		} catch (error) {
			if (attempt === 3) throw error;
			console.log(`Chrome did not start (attempt ${attempt} of 3): ${error.message}`);
		}
	}
}
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
	server.close();
}

if (failed) process.exit(1);
