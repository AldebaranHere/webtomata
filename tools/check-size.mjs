// Fails if a page's initial JS or a .wasm file exceeds the gzip budgets in budgets.mjs.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { SIZE_KB_GZIP } from './budgets.mjs';

const buildDir = resolve(process.argv[2] ?? 'web/build');

function walk(dir) {
	return readdirSync(dir).flatMap((name) => {
		const p = join(dir, name);
		return statSync(p).isDirectory() ? walk(p) : [p];
	});
}

const gzKb = (file) => gzipSync(readFileSync(file)).length / 1024;
const files = walk(buildDir);
let failed = false;

function report(label, kb, limit) {
	const ok = kb <= limit;
	failed ||= !ok;
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}: ${kb.toFixed(1)} KB gzip (limit ${limit} KB)`);
}

for (const html of files.filter((f) => f.endsWith('.html'))) {
	const text = readFileSync(html, 'utf8');
	const refs = [...text.matchAll(/(?:href|src)="([^"]+\.js)"/g)].map((m) => m[1]);
	const js = new Set(refs.map((r) => resolve(dirname(html), r)));
	const kb = [...js].reduce((sum, f) => sum + gzKb(f), 0);
	report(`initial JS ${relative(buildDir, html)}`, kb, SIZE_KB_GZIP.initialJsPerRoute);
}

for (const wasm of files.filter((f) => f.endsWith('.wasm'))) {
	report(`wasm ${relative(buildDir, wasm)}`, gzKb(wasm), SIZE_KB_GZIP.wasm);
}

if (failed) process.exit(1);
