// Run with `node --test tools/`. These tests check the part of the smoke test that decides
// whether what Chrome reported is a pass or a fail.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judge } from './smoke-judge.mjs';

const clean = {
	version: '0.0.0',
	consoleErrors: [],
	exceptions: [],
	failedRequests: [],
	badResponses: []
};

test('a page that shows the engine version and reports nothing passes', () => {
	assert.deepEqual(judge(clean), []);
});

test('a version that never appeared fails', () => {
	for (const version of ['', undefined, null, 'loading', 'v1']) {
		const problems = judge({ ...clean, version });
		assert.equal(problems.length, 1, String(version));
		assert.match(problems[0], /engine version/);
	}
});

test('a version with three numbers passes, with a suffix too', () => {
	assert.deepEqual(judge({ ...clean, version: '12.3.4' }), []);
	assert.deepEqual(judge({ ...clean, version: '1.0.0-beta.1' }), []);
});

test('a console error, an exception, a failed request and a bad response each fail', () => {
	const cases = {
		consoleErrors: ['Refused to load the script because it violates the CSP'],
		exceptions: ['TypeError: x is not a function'],
		failedRequests: [{ url: 'http://a/b.wasm', reason: 'net::ERR_BLOCKED_BY_CSP' }],
		badResponses: [{ url: 'http://a/missing.js', status: 404 }]
	};
	for (const [field, value] of Object.entries(cases)) {
		const problems = judge({ ...clean, [field]: value });
		assert.equal(problems.length, 1, field);
	}
});

test('every problem is listed, with what it was', () => {
	const problems = judge({
		version: '',
		consoleErrors: ['one', 'two'],
		exceptions: ['boom'],
		failedRequests: [{ url: 'http://a/x', reason: 'net::ERR_FAILED' }],
		badResponses: [{ url: 'http://a/y', status: 500 }]
	});
	assert.equal(problems.length, 6);
	assert.ok(problems.some((p) => p.includes('one')));
	assert.ok(problems.some((p) => p.includes('two')));
	assert.ok(problems.some((p) => p.includes('boom')));
	assert.ok(problems.some((p) => p.includes('net::ERR_FAILED') && p.includes('http://a/x')));
	assert.ok(problems.some((p) => p.includes('500') && p.includes('http://a/y')));
});

test('a request that the page itself canceled is not a failure', () => {
	const problems = judge({
		...clean,
		failedRequests: [{ url: 'http://a/x', reason: 'net::ERR_ABORTED', canceled: true }]
	});
	assert.deepEqual(problems, []);
});
