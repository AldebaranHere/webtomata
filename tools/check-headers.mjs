// Usage: node tools/check-headers.mjs <url>
// Fails if the response lacks a security header or the CSP allows inline/eval code.
import { pathToFileURL } from 'node:url';

export function evaluateHeaders(getHeader, html = '') {
	const h = (name) => getHeader(name) ?? '';
	const csp = h('content-security-policy');
	const metaCsp = html.match(/http-equiv="content-security-policy" content="([^"]*)"/i)?.[1] ?? '';

	const checks = [
		['X-Content-Type-Options: nosniff', h('x-content-type-options') === 'nosniff'],
		['Referrer-Policy: no-referrer', h('referrer-policy') === 'no-referrer'],
		['Permissions-Policy present', h('permissions-policy') !== ''],
		['Cross-Origin-Opener-Policy: same-origin', h('cross-origin-opener-policy') === 'same-origin'],
		['CSP header has frame-ancestors none', /frame-ancestors 'none'/.test(csp)],
		['CSP meta allows wasm-unsafe-eval', /script-src[^;]*'wasm-unsafe-eval'/.test(metaCsp)],
		['CSP meta script-src has a sha256 hash', /script-src[^;]*'sha256-/.test(metaCsp)],
		["CSP has no 'unsafe-inline' or 'unsafe-eval'", !/'unsafe-(inline|eval)'/.test(csp + metaCsp)],
		[
			'CSP style-src-attr is limited to one hash',
			/style-src-attr 'unsafe-hashes' 'sha256-[^']+';/.test(metaCsp + ';')
		],
		["CSP meta default-src is 'self'", /default-src 'self'/.test(metaCsp)]
	];

	const failed = checks.some(([, ok]) => !ok);
	return { failed, checks };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const url = process.argv[2];
	if (!url) {
		console.error('usage: node tools/check-headers.mjs <url>');
		process.exit(2);
	}

	const res = await fetch(url);
	const html = res.headers.get('content-type')?.includes('text/html') ? await res.text() : '';
	const { failed, checks } = evaluateHeaders((name) => res.headers.get(name), html);

	for (const [name, ok] of checks) {
		console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
	}
	process.exit(failed ? 1 : 0);
}
