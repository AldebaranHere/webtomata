// Fails if a page's initial JS or a .wasm file exceeds the gzip budgets in budgets.mjs.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { LAYOUT_LIBRARY_MARKER, SIZE_KB_GZIP } from './budgets.mjs';

function walk(dir) {
	return readdirSync(dir).flatMap((name) => {
		const p = join(dir, name);
		return statSync(p).isDirectory() ? walk(p) : [p];
	});
}

const gzKb = (file) => gzipSync(readFileSync(file)).length / 1024;

export function checkSize(dir = 'web/build', { limits = SIZE_KB_GZIP, print = console.log } = {}) {
	const buildDir = resolve(dir);
	const files = walk(buildDir);
	let failed = false;

	function report(label, kb, limit) {
		const ok = kb <= limit;
		failed ||= !ok;
		print(`${ok ? 'ok  ' : 'FAIL'} ${label}: ${kb.toFixed(1)} KB gzip (limit ${limit} KB)`);
	}

	for (const html of files.filter((f) => f.endsWith('.html'))) {
		const text = readFileSync(html, 'utf8');
		const refs = [...text.matchAll(/(?:href|src)="([^"]+\.js)"/g)].map((m) => m[1]);
		const js = new Set(refs.map((r) => resolve(dirname(html), r)));
		const kb = [...js].reduce((sum, f) => sum + gzKb(f), 0);
		report(`initial JS ${relative(buildDir, html)}`, kb, limits.initialJsPerRoute);
		// The layout library is loaded when auto layout is used (a worker), never with the page.
		const early = [...js].filter((f) => readFileSync(f, 'utf8').includes(LAYOUT_LIBRARY_MARKER));
		if (early.length > 0) {
			failed = true;
			print(
				`FAIL ${relative(buildDir, html)}: the layout library is in the first load (${early.map((f) => relative(buildDir, f)).join(', ')})`
			);
		}
	}

	const layoutWorkers = files.filter((f) =>
		/\/workers\/layout\.worker-[^/]+\.js$/.test(f.split('\\').join('/'))
	);
	if (layoutWorkers.length === 0) {
		failed = true;
		print('FAIL the layout worker is not in the build');
	}
	for (const file of layoutWorkers) {
		report(`layout worker ${relative(buildDir, file)}`, gzKb(file), limits.layoutWorker);
	}

	for (const wasm of files.filter((f) => f.endsWith('.wasm'))) {
		report(`wasm ${relative(buildDir, wasm)}`, gzKb(wasm), limits.wasm);
	}

	return { failed };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const { failed } = checkSize(process.argv[2] ?? 'web/build');
	if (failed) process.exit(1);
}
