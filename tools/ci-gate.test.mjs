import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCiGate } from './ci-gate.mjs';

const successfulHeavy = {
	checks: { result: 'success' },
	e2e: { result: 'success' },
	lighthouse: { result: 'success' },
	'cross-browser': { result: 'success' },
};

const skippedHeavy = {
	checks: { result: 'skipped' },
	e2e: { result: 'skipped' },
	lighthouse: { result: 'skipped' },
	'cross-browser': { result: 'skipped' },
};

test('ci-gate: docs_only is true and heavy jobs are skipped -> ok', () => {
	const res = evaluateCiGate({
		docsOnly: 'true',
		needs: {
			scope: { result: 'success' },
			...skippedHeavy,
		},
	});
	assert.equal(res.ok, true);
});

test('ci-gate: docs_only is true and heavy jobs are success -> ok', () => {
	const res = evaluateCiGate({
		docsOnly: 'true',
		needs: {
			scope: { result: 'success' },
			...successfulHeavy,
		},
	});
	assert.equal(res.ok, true);
});

test('ci-gate: docs_only is false and all heavy jobs are success -> ok', () => {
	const res = evaluateCiGate({
		docsOnly: 'false',
		needs: {
			scope: { result: 'success' },
			...successfulHeavy,
		},
	});
	assert.equal(res.ok, true);
});

test('ci-gate: docs_only is false and a heavy job is skipped -> fail', () => {
	const res = evaluateCiGate({
		docsOnly: 'false',
		needs: {
			scope: { result: 'success' },
			checks: { result: 'success' },
			e2e: { result: 'skipped' },
			lighthouse: { result: 'success' },
			'cross-browser': { result: 'success' },
		},
	});
	assert.equal(res.ok, false);
	assert.match(res.reason, /skipped/);
});

test('ci-gate: scope job is not success -> fail', () => {
	for (const badResult of ['failure', 'cancelled', 'skipped']) {
		const res = evaluateCiGate({
			docsOnly: 'true',
			needs: {
				scope: { result: badResult },
				...skippedHeavy,
			},
		});
		assert.equal(res.ok, false, `expected scope result ${badResult} to fail`);
		assert.match(res.reason, /scope/i);
	}
});

test('ci-gate: any job failed or was cancelled -> fail', () => {
	for (const badResult of ['failure', 'cancelled']) {
		const resDocs = evaluateCiGate({
			docsOnly: 'true',
			needs: {
				scope: { result: 'success' },
				checks: { result: badResult },
				e2e: { result: 'skipped' },
				lighthouse: { result: 'skipped' },
				'cross-browser': { result: 'skipped' },
			},
		});
		assert.equal(resDocs.ok, false);

		const resCode = evaluateCiGate({
			docsOnly: 'false',
			needs: {
				scope: { result: 'success' },
				checks: { result: 'success' },
				e2e: { result: badResult },
				lighthouse: { result: 'success' },
				'cross-browser': { result: 'success' },
			},
		});
		assert.equal(resCode.ok, false);
	}
});

test('ci-gate: missing or odd input -> fail', () => {
	assert.equal(evaluateCiGate(null).ok, false);
	assert.equal(evaluateCiGate({}).ok, false);
	assert.equal(evaluateCiGate({ docsOnly: 'true', needs: {} }).ok, false);
	assert.equal(evaluateCiGate({ docsOnly: 'true', needs: null }).ok, false);
	assert.equal(
		evaluateCiGate({
			docsOnly: 'true',
			needs: { scope: { result: 'success' } }, // no heavy jobs
		}).ok,
		false
	);
	assert.equal(
		evaluateCiGate({
			docsOnly: 'false',
			needs: {
				scope: { result: 'success' },
				checks: { result: 'unknown_status' },
			},
		}).ok,
		false
	);
});

test('CLI: exits 0 on valid inputs and 1 on failure', async () => {
	const { execFileSync } = await import('node:child_process');
	const scriptPath = new URL('./ci-gate.mjs', import.meta.url).pathname;

	// Case 1: docs_only true, skipped heavy -> exit 0
	const validNeeds = JSON.stringify({
		scope: { result: 'success' },
		...skippedHeavy,
	});
	const out0 = execFileSync(
		process.execPath,
		[scriptPath, '--docs-only', 'true', '--needs-json', validNeeds],
		{ encoding: 'utf8' }
	);
	assert.match(out0, /OK/);

	// Case 2: docs_only false, skipped heavy -> exit 1
	assert.throws(
		() => {
			execFileSync(
				process.execPath,
				[scriptPath, '--docs-only', 'false', '--needs-json', validNeeds],
				{ encoding: 'utf8', stdio: 'pipe' }
			);
		},
		(err) => err.status === 1
	);
});

