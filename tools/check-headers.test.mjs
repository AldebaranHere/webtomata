// Run with `node --test "tools/*.test.mjs"`. Tests for the security header and CSP verifier
// in tools/check-headers.mjs (CLAUDE.md, section 8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateHeaders } from './check-headers.mjs';

const goodHeaders = {
	'x-content-type-options': 'nosniff',
	'referrer-policy': 'no-referrer',
	'permissions-policy':
		'accelerometer=(), camera=(), geolocation=(), microphone=(), payment=(), usb=()',
	'cross-origin-opener-policy': 'same-origin',
	'content-security-policy': "frame-ancestors 'none';"
};

const goodMetaCsp =
	"default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'sha256-abc123='; style-src 'self'; style-src-attr 'unsafe-hashes' 'sha256-def456='; img-src 'self' data: blob:; worker-src 'self'";

const makeHtml = (metaCsp = goodMetaCsp) =>
	`<!doctype html><head><meta http-equiv="content-security-policy" content="${metaCsp}"></head>`;

const getFrom = (map) => (name) => map[name.toLowerCase()] ?? '';

test('a response with all required security headers and strict CSP passes', () => {
	const { failed, checks } = evaluateHeaders(getFrom(goodHeaders), makeHtml());
	assert.equal(failed, false);
	assert.equal(checks.length, 10);
	assert.ok(checks.every(([, ok]) => ok));
});

test('each missing or weakened security header fails its check', () => {
	for (const header of [
		'x-content-type-options',
		'referrer-policy',
		'permissions-policy',
		'cross-origin-opener-policy',
		'content-security-policy'
	]) {
		const broken = { ...goodHeaders, [header]: '' };
		const { failed } = evaluateHeaders(getFrom(broken), makeHtml());
		assert.equal(failed, true, header);
	}
});

test('unsafe-inline or unsafe-eval in CSP header or meta CSP fails', () => {
	for (const bad of ["script-src 'self' 'unsafe-inline'", "script-src 'self' 'unsafe-eval'"]) {
		const { failed } = evaluateHeaders(getFrom(goodHeaders), makeHtml(`${goodMetaCsp}; ${bad}`));
		assert.equal(failed, true, bad);
	}
});

test('missing wasm-unsafe-eval, script sha256, style-src-attr single hash, or default-src self fails', () => {
	const withoutWasm = goodMetaCsp.replace("'wasm-unsafe-eval' ", '');
	assert.equal(evaluateHeaders(getFrom(goodHeaders), makeHtml(withoutWasm)).failed, true);

	const withoutScriptHash = goodMetaCsp.replace("'sha256-abc123='", '');
	assert.equal(evaluateHeaders(getFrom(goodHeaders), makeHtml(withoutScriptHash)).failed, true);

	const twoStyleHashes = goodMetaCsp.replace(
		"style-src-attr 'unsafe-hashes' 'sha256-def456='",
		"style-src-attr 'unsafe-hashes' 'sha256-def456=' 'sha256-other='"
	);
	assert.equal(evaluateHeaders(getFrom(goodHeaders), makeHtml(twoStyleHashes)).failed, true);

	const wrongDefault = goodMetaCsp.replace("default-src 'self'", 'default-src *');
	assert.equal(evaluateHeaders(getFrom(goodHeaders), makeHtml(wrongDefault)).failed, true);
});

test('web/static/_headers defines the four response headers and frame-ancestors none', () => {
	const raw = readFileSync(new URL('../web/static/_headers', import.meta.url), 'utf8');
	const map = {};
	for (const line of raw.split(/\r?\n/)) {
		const match = line.match(/^\s+([A-Za-z-]+):\s*(.+)$/);
		if (match) map[match[1].toLowerCase()] = match[2].trim();
	}
	const { failed } = evaluateHeaders(getFrom(map), makeHtml());
	assert.equal(failed, false);
});
