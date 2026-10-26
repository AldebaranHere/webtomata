// Run with `node --test "tools/*.test.mjs"`. withTimeout and retrying keep a check that hangs (a
// Lighthouse run whose Chrome stopped answering) from holding a CI job for minutes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retrying, withTimeout } from './with-timeout.mjs';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('a promise that is fast enough gives its value', async () => {
	assert.equal(
		await withTimeout(
			sleep(5).then(() => 'done'),
			500,
			'the run'
		),
		'done'
	);
});

test('a promise that is too slow fails with the name and the time', async () => {
	await assert.rejects(withTimeout(sleep(500), 20, 'the Lighthouse run'), {
		name: 'TimeoutError',
		message: /the Lighthouse run took more than 20 ms/
	});
});

test('the error of a promise that is fast enough is its own error', async () => {
	await assert.rejects(
		withTimeout(Promise.reject(new Error('protocol error')), 500, 'the run'),
		/protocol error/
	);
});

test('a promise that was given up and fails later does not crash the process', async () => {
	let late;
	const slow = new Promise((_, reject) => (late = reject));
	await assert.rejects(withTimeout(slow, 10, 'the run'), { name: 'TimeoutError' });
	// Chrome is killed after the timeout, and then the abandoned call fails: nobody waits for it.
	late(new Error('connection closed'));
	await sleep(20);
});

test('the timer is cleared, so a fast promise does not keep the process open', async () => {
	await withTimeout(Promise.resolve(1), 60_000, 'the run');
	// If the timer were left, the test runner would wait for 60 seconds.
});

test('retrying gives the value of the first try that works, without a second try', async () => {
	let calls = 0;
	const value = await retrying(async () => {
		calls++;
		return 'ok';
	});
	assert.equal(value, 'ok');
	assert.equal(calls, 1);
});

test('retrying tries again after a failure, and says what failed and which try it was', async () => {
	const seen = [];
	const value = await retrying(
		async (attempt) => {
			if (attempt === 1) throw new Error('hung');
			return `try ${attempt}`;
		},
		{ onFail: async (error, attempt) => seen.push(`${attempt}: ${error.message}`) }
	);
	assert.equal(value, 'try 2');
	assert.deepEqual(seen, ['1: hung']);
});

test('retrying gives up after the last try, with the last error', async () => {
	let calls = 0;
	await assert.rejects(
		retrying(
			async () => {
				calls++;
				throw new Error(`failure ${calls}`);
			},
			{ tries: 3 }
		),
		/failure 3/
	);
	assert.equal(calls, 3);
});

test('retrying does not run onFail after the last try', async () => {
	let fails = 0;
	await assert.rejects(
		retrying(
			async () => {
				throw new Error('x');
			},
			{ tries: 2, onFail: async () => fails++ }
		)
	);
	assert.equal(fails, 1);
});
