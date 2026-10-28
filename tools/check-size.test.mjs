// Run with `node --test "tools/*.test.mjs"`. Tests for the size and lazy-layout budgets in
// tools/check-size.mjs (CLAUDE.md, section 7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LAYOUT_LIBRARY_MARKER } from './budgets.mjs';
import { checkSize } from './check-size.mjs';

function withBuild(setup, limits = { initialJsPerRoute: 10, wasm: 20, layoutWorker: 10 }) {
	const dir = mkdtempSync(join(tmpdir(), 'webtomata-size-'));
	try {
		mkdirSync(join(dir, '_app', 'immutable', 'workers'), { recursive: true });
		writeFileSync(join(dir, 'index.html'), '<!doctype html><script src="./_app/app.js"></script>');
		writeFileSync(join(dir, '_app', 'app.js'), 'console.log("small");');
		writeFileSync(
			join(dir, '_app', 'immutable', 'workers', 'layout.worker-abc123.js'),
			`console.log("${LAYOUT_LIBRARY_MARKER}");`
		);
		writeFileSync(join(dir, '_app', 'engine.wasm'), 'small-wasm');
		setup(dir);
		const lines = [];
		const result = checkSize(dir, {
			limits,
			print: (line) => lines.push(line)
		});
		return { ...result, lines };
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

test('a build within all budgets and with dagre isolated in the layout worker passes', () => {
	const { failed, lines } = withBuild(() => {});
	assert.equal(failed, false);
	assert.ok(lines.every((l) => l.startsWith('ok  ')));
});

test('fails when a route exceeds the initial JS gzip budget', () => {
	const { failed, lines } = withBuild(() => {}, {
		initialJsPerRoute: 0.001,
		wasm: 20,
		layoutWorker: 10
	});
	assert.equal(failed, true);
	assert.ok(lines.some((l) => l.startsWith('FAIL initial JS index.html')));
});

test('fails when the layout library marker appears in initial page JS', () => {
	const { failed, lines } = withBuild((dir) => {
		writeFileSync(join(dir, '_app', 'app.js'), `const x = "${LAYOUT_LIBRARY_MARKER}";`);
	});
	assert.equal(failed, true);
	assert.ok(lines.some((l) => l.includes('the layout library is in the first load')));
});

test('fails when the layout worker is missing from the build', () => {
	const { failed, lines } = withBuild((dir) => {
		rmSync(join(dir, '_app', 'immutable', 'workers'), {
			recursive: true,
			force: true
		});
	});
	assert.equal(failed, true);
	assert.ok(lines.some((l) => l.includes('the layout worker is not in the build')));
});

test('fails when the layout worker or .wasm file exceeds its gzip budget', () => {
	const workerFail = withBuild(() => {}, {
		initialJsPerRoute: 10,
		wasm: 20,
		layoutWorker: 0.001
	});
	assert.equal(workerFail.failed, true);
	assert.ok(workerFail.lines.some((l) => l.startsWith('FAIL layout worker')));

	const wasmFail = withBuild(() => {}, {
		initialJsPerRoute: 10,
		wasm: 0.001,
		layoutWorker: 10
	});
	assert.equal(wasmFail.failed, true);
	assert.ok(wasmFail.lines.some((l) => l.startsWith('FAIL wasm')));
});
