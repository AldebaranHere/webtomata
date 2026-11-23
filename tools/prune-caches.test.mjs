// Run with `node --test "tools/prune-caches.test.mjs"` or `pnpm test:tools`.
// Tests the pure cache-pruning selector and the CLI with a fake `gh` binary on PATH.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cacheFamily, pickCachesToDelete } from './prune-caches.mjs';

const SCRIPT_PATH = new URL('./prune-caches.mjs', import.meta.url).pathname;
const MB = 1_000_000;

/**
 * Builds the 2026-11-24 fixture from docs/agent/PLAN.md (T-088):
 * 34 caches on refs/heads/staging + 3 extra cases (refs/heads/main, refs/pull/9/merge, unknown prefix).
 */
function buildRealFixture() {
	let nextId = 1000;
	let minuteOffset = 0;
	const ts = (minutesAgo) =>
		new Date(Date.UTC(2026, 10, 24, 12, 0, 0) - minutesAgo * 60_000).toISOString();

	const make = (key, mb, ref = 'refs/heads/staging', minutesAgo = null) => {
		const id = nextId++;
		const createdAt = ts(minutesAgo ?? minuteOffset++);
		return {
			id,
			key,
			ref,
			sizeInBytes: mb * MB,
			createdAt,
			lastAccessedAt: createdAt,
		};
	};

	const caches = [];
	const expectedDeletedKeys = [];
	const expectedKeptStagingKeys = [];

	// 12 real CodeQL overlay caches (72 to 77 MB, newest first in order given): keep 2 (119557, 313f), delete 10.
	const codeqlSuffixes = [
		'119557cf5ff98dab5c1549607ba4542acf0322d9-45179344356-1',
		'313f703a75be8dcb1aaff4954bee0268217b1c60-45208759975-1',
		'540d009c208e431d0865fc915cab0f69e7085286-45039265733-1',
		'6bc6c64b20644a8a1f08114b4019f463cfd0d53a-45160655487-1',
		'b56b51ebd7b5d233339c2735a5eb49ceed050f2f-45044025445-1',
		'bd9e47ae5aa37ff7e9c83fc2bb498e8100af389f-45037256549-1',
		'be8fbd4b4ee490a8f5456d46e4228c7e9c2c92e3-45190839134-1',
		'c1d3ca36e8f07ba05006c7db2131fd2851904ccc-45130250448-1',
		'c8d9172f8183d9d8f88072ac8023f2ada7b1628b-45145064545-1',
		'd3372c747795a786f98303f1f546ca8806d1b721-45076256533-1',
		'e67095009e471d240960796f165aabdb9cfea54a-45099205955-1',
		'ed00b276593c159452e9c3d7bda1aedfdb600257-45151347064-1',
	];
	const codeqlSizes = [77, 77, 77, 76, 76, 76, 75, 75, 75, 74, 73, 72];
	const codeqlPrefix = 'codeql-overlay-base-database-1-673738e94a8102ad-javascript-2.27.5';
	for (let i = 0; i < codeqlSuffixes.length; i++) {
		const key = `${codeqlPrefix}-${codeqlSuffixes[i]}`;
		caches.push(make(key, codeqlSizes[i], 'refs/heads/staging', i * 10));
		if (i < 2) expectedKeptStagingKeys.push(key);
		else expectedDeletedKeys.push(key);
	}

	// 15 Rust caches in 5 families (3 generations each, newest first): keep 5, delete 10.
	const rustFamilies = [
		['rust', [202, 186, 185]],
		['checks', [194, 185, 185]],
		['e2e', [130, 121, 121]],
		['cross-browser', [130, 121, 121]],
		['lighthouse', [130, 121, 121]],
	];
	const rustHashes = ['622e96a1-b8cbf015', '622e96a1-3ef20095', '622e96a1-3fcf3014'];
	for (const [name, sizes] of rustFamilies) {
		for (let i = 0; i < sizes.length; i++) {
			const key = `v0-rust-${name}-Linux-x64-${rustHashes[i]}`;
			caches.push(make(key, sizes[i], 'refs/heads/staging', 200 + i * 30));
			if (i === 0) expectedKeptStagingKeys.push(key);
			else expectedDeletedKeys.push(key);
		}
	}

	// 2 node-cache (145 MB each): keep 1, delete 1.
	const pnpmNew = `node-cache-Linux-x64-pnpm-${'a'.repeat(64)}`;
	const pnpmOld = `node-cache-Linux-x64-pnpm-${'b'.repeat(64)}`;
	caches.push(make(pnpmNew, 145, 'refs/heads/staging', 300));
	caches.push(make(pnpmOld, 145, 'refs/heads/staging', 360));
	expectedKeptStagingKeys.push(pnpmNew);
	expectedDeletedKeys.push(pnpmOld);

	// 2 playwright-firefox (109 MB each) and 2 playwright-webkit (98 MB each): keep 1 each, delete 2.
	const ffNew = `playwright-Linux-firefox-${'c'.repeat(64)}`;
	const ffOld = `playwright-Linux-firefox-${'d'.repeat(64)}`;
	caches.push(make(ffNew, 109, 'refs/heads/staging', 400));
	caches.push(make(ffOld, 109, 'refs/heads/staging', 460));
	expectedKeptStagingKeys.push(ffNew);
	expectedDeletedKeys.push(ffOld);

	const wkNew = `playwright-Linux-webkit-${'e'.repeat(64)}`;
	const wkOld = `playwright-Linux-webkit-${'f'.repeat(64)}`;
	caches.push(make(wkNew, 98, 'refs/heads/staging', 410));
	caches.push(make(wkOld, 98, 'refs/heads/staging', 470));
	expectedKeptStagingKeys.push(wkNew);
	expectedDeletedKeys.push(wkOld);

	// 1 v0-rust-fuzz (56 MB) and 1 v0-rust-cargo-audit (32 MB): one per family, kept.
	const fuzzKey = 'v0-rust-fuzz-Linux-x64-12345678-9abcdef0';
	const auditKey = 'v0-rust-cargo-audit-Linux-x64-12345678-fedcba98';
	caches.push(make(fuzzKey, 56, 'refs/heads/staging', 500));
	caches.push(make(auditKey, 32, 'refs/heads/staging', 510));
	expectedKeptStagingKeys.push(fuzzKey, auditKey);

	// 3 extra cases:
	// (a) refs/heads/main cache with a key of an existing family (older than staging's newest, must be kept).
	const mainKey = 'v0-rust-rust-Linux-x64-622e96a1-11111111';
	caches.push(make(mainKey, 200, 'refs/heads/main', 600));

	// (b) refs/pull/9/merge cache (left alone).
	const prKey = `node-cache-Linux-x64-pnpm-${'9'.repeat(64)}`;
	caches.push(make(prKey, 145, 'refs/pull/9/merge', 700));

	// (c) unknown prefix cache (left alone).
	const otherKey = 'other-1234abcd-9f8e7d6c';
	caches.push(make(otherKey, 50, 'refs/heads/staging', 800));

	return {
		caches,
		expectedDeletedKeys,
		expectedKeptStagingKeys,
		mainKey,
		prKey,
		otherKey,
	};
}

/**
 * Creates a fake `gh` executable in a temporary directory.
 * Logs every invocation to `logFile` and returns `fixtureCaches` for `gh cache list`.
 */
function createFakeGh(fixtureCaches, { failDeleteId = null } = {}) {
	const dir = mkdtempSync(join(tmpdir(), 'prune-caches-test-'));
	const logFile = join(dir, 'gh-calls.log');
	const dataFile = join(dir, 'caches.json');
	const summaryFile = join(dir, 'summary.md');
	const ghPath = join(dir, 'gh');

	writeFileSync(dataFile, JSON.stringify(fixtureCaches), 'utf8');
	writeFileSync(logFile, '', 'utf8');
	writeFileSync(summaryFile, '', 'utf8');

	const script = `#!/usr/bin/env node
import { appendFileSync, readFileSync } from 'node:fs';
const args = process.argv.slice(2);
appendFileSync(${JSON.stringify(logFile)}, JSON.stringify(args) + '\\n', 'utf8');
if (args[0] === 'cache' && args[1] === 'list') {
	process.stdout.write(readFileSync(${JSON.stringify(dataFile)}, 'utf8'));
	process.exit(0);
}
if (args[0] === 'cache' && args[1] === 'delete') {
	const id = Number(args[2]);
	if (${JSON.stringify(failDeleteId)} !== null && id === ${JSON.stringify(failDeleteId)}) {
		process.stderr.write('simulated delete failure for ' + id + '\\n');
		process.exit(1);
	}
	process.exit(0);
}
process.stderr.write('unexpected gh command: ' + args.join(' ') + '\\n');
process.exit(2);
`;
	writeFileSync(ghPath, script, 'utf8');
	chmodSync(ghPath, 0o755);

	return { dir, logFile, summaryFile };
}

test('AC1: real 2026-11-24 fixture deletes 23 (10 CodeQL + 13 others), keeps 12 staging + 1 main, leaves 2 alone, frees ~2.57 GB', () => {
	const { caches, expectedDeletedKeys, expectedKeptStagingKeys, mainKey, prKey, otherKey } =
		buildRealFixture();

	const result = pickCachesToDelete(caches);

	assert.equal(result.toDelete.length, 23);
	assert.deepEqual(
		result.toDelete.map((c) => c.key).sort(),
		[...expectedDeletedKeys].sort()
	);

	// 12 staging caches kept + 1 main cache kept = 13 kept
	assert.equal(result.kept.length, 13);
	const keptStaging = result.kept.filter((c) => c.ref === 'refs/heads/staging');
	assert.equal(keptStaging.length, 12);
	assert.deepEqual(
		keptStaging.map((c) => c.key).sort(),
		[...expectedKeptStagingKeys].sort()
	);
	assert.ok(
		result.kept.some((c) => c.ref === 'refs/heads/main' && c.key === mainKey),
		'refs/heads/main cache must be kept despite newer staging cache'
	);

	// 2 left alone: refs/pull/9/merge and unknown prefix
	assert.equal(result.leftAlone.length, 2);
	assert.deepEqual(
		result.leftAlone.map((c) => c.key).sort(),
		[prKey, otherKey].sort()
	);

	// Megabytes freed: 749 (10 CodeQL) + 1467 (10 Rust) + 145 (pnpm) + 207 (Playwright) = 2568 MB
	const freedMb = result.freedBytes / MB;
	assert.equal(freedMb, 2568);
	assert.equal(result.capped, false);
});

test('AC2: cacheFamily parses every real key shape', () => {
	assert.equal(
		cacheFamily('v0-rust-checks-Linux-x64-622e96a1-b8cbf015'),
		'v0-rust-checks-Linux-x64'
	);
	assert.equal(
		cacheFamily('v0-rust-checks-Linux-x64-622e96a1-3ef20095'),
		'v0-rust-checks-Linux-x64'
	);
	assert.equal(
		cacheFamily('v0-rust-checks-Linux-x64-622e96a1-3fcf3014'),
		'v0-rust-checks-Linux-x64'
	);
	assert.equal(
		cacheFamily(`node-cache-Linux-x64-pnpm-${'a1b2c3d4'.repeat(8)}`),
		'node-cache-Linux-x64-pnpm'
	);
	assert.equal(
		cacheFamily(`playwright-Linux-firefox-${'01234567'.repeat(8)}`),
		'playwright-Linux-firefox'
	);
	assert.equal(
		cacheFamily(`playwright-Linux-webkit-${'89abcdef'.repeat(8)}`),
		'playwright-Linux-webkit'
	);
	assert.equal(
		cacheFamily(
			'codeql-overlay-base-database-1-673738e94a8102ad-javascript-2.27.5-119557cf5ff98dab5c1549607ba4542acf0322d9-45179344356-1'
		),
		'codeql-overlay-base-database-1-673738e94a8102ad-javascript-2.27.5'
	);
	assert.equal(
		cacheFamily('v0-rust-cargo-audit-Linux-x64-12345678-fedcba98'),
		'v0-rust-cargo-audit-Linux-x64'
	);
});

test('AC2: per-ref grouping never deletes main cache because of newer staging cache', () => {
	const caches = [
		{
			id: 1,
			key: 'v0-rust-rust-Linux-x64-aaaaaaaa-bbbbbbbb',
			ref: 'refs/heads/main',
			sizeInBytes: 100,
			createdAt: '2026-11-20T00:00:00Z',
			lastAccessedAt: '2026-11-20T00:00:00Z',
		},
		{
			id: 2,
			key: 'v0-rust-rust-Linux-x64-aaaaaaaa-cccccccc',
			ref: 'refs/heads/staging',
			sizeInBytes: 100,
			createdAt: '2026-11-24T00:00:00Z',
			lastAccessedAt: '2026-11-24T00:00:00Z',
		},
	];
	const result = pickCachesToDelete(caches);
	assert.deepEqual(result.toDelete, []);
	assert.equal(result.kept.length, 2);
});

test('AC2: keep-newest-1 for normal families and keep-newest-2 for CodeQL overlay', () => {
	const normal = [1, 2, 3].map((n) => ({
		id: n,
		key: `v0-rust-e2e-Linux-x64-${n.toString(16).padStart(8, '0')}`,
		ref: 'refs/heads/staging',
		sizeInBytes: 100,
		createdAt: `2026-11-2${n}T00:00:00Z`,
		lastAccessedAt: `2026-11-2${n}T00:00:00Z`,
	}));
	const normalRes = pickCachesToDelete(normal);
	assert.deepEqual(
		normalRes.kept.map((c) => c.id),
		[3]
	);
	assert.deepEqual(
		normalRes.toDelete.map((c) => c.id),
		[1, 2]
	);

	const codeql = [1, 2, 3, 4].map((n) => ({
		id: 10 + n,
		key: `codeql-overlay-base-database-1-673738e94a8102ad-javascript-2.27.5-${n.toString(16).padStart(40, '0')}-4517934435${n}-1`,
		ref: 'refs/heads/staging',
		sizeInBytes: 100,
		createdAt: `2026-11-2${n}T00:00:00Z`,
		lastAccessedAt: `2026-11-2${n}T00:00:00Z`,
	}));
	const codeqlRes = pickCachesToDelete(codeql);
	assert.deepEqual(
		codeqlRes.kept.map((c) => c.id).sort(),
		[13, 14]
	);
	assert.deepEqual(
		codeqlRes.toDelete.map((c) => c.id),
		[11, 12]
	);
});

test('AC2: unknown prefix and refs/pull/* caches are left alone even when multiple exist', () => {
	const caches = [
		{
			id: 1,
			key: 'other-1234abcd-11111111',
			ref: 'refs/heads/staging',
			sizeInBytes: 100,
			createdAt: '2026-11-20T00:00:00Z',
			lastAccessedAt: '2026-11-20T00:00:00Z',
		},
		{
			id: 2,
			key: 'other-1234abcd-22222222',
			ref: 'refs/heads/staging',
			sizeInBytes: 100,
			createdAt: '2026-11-24T00:00:00Z',
			lastAccessedAt: '2026-11-24T00:00:00Z',
		},
		{
			id: 3,
			key: 'v0-rust-rust-Linux-x64-aaaaaaaa-11111111',
			ref: 'refs/pull/42/merge',
			sizeInBytes: 100,
			createdAt: '2026-11-20T00:00:00Z',
			lastAccessedAt: '2026-11-20T00:00:00Z',
		},
		{
			id: 4,
			key: 'v0-rust-rust-Linux-x64-aaaaaaaa-22222222',
			ref: 'refs/pull/42/merge',
			sizeInBytes: 100,
			createdAt: '2026-11-24T00:00:00Z',
			lastAccessedAt: '2026-11-24T00:00:00Z',
		},
	];
	const result = pickCachesToDelete(caches);
	assert.deepEqual(result.toDelete, []);
	assert.deepEqual(result.kept, []);
	assert.equal(result.leftAlone.length, 4);
});

test('AC2: cap of 50 chooses oldest 50 and reports capped; boundaries 49, 50, 51, 60', () => {
	const makeNDeletable = (deletableCount) => {
		const total = deletableCount + 1; // +1 newest kept
		return Array.from({ length: total }, (_, i) => ({
			id: i + 1,
			key: `v0-rust-checks-Linux-x64-${(i + 1).toString(16).padStart(8, '0')}`,
			ref: 'refs/heads/staging',
			sizeInBytes: 10 * MB,
			createdAt: new Date(Date.UTC(2026, 10, 1, 0, i, 0)).toISOString(),
			lastAccessedAt: new Date(Date.UTC(2026, 10, 1, 0, i, 0)).toISOString(),
		}));
	};

	const at49 = pickCachesToDelete(makeNDeletable(49));
	assert.equal(at49.toDelete.length, 49);
	assert.equal(at49.capped, false);

	const at50 = pickCachesToDelete(makeNDeletable(50));
	assert.equal(at50.toDelete.length, 50);
	assert.equal(at50.capped, false);

	const at51 = pickCachesToDelete(makeNDeletable(51));
	assert.equal(at51.toDelete.length, 50);
	assert.equal(at51.capped, true);
	assert.equal(at51.toDelete[0].id, 1);
	assert.equal(at51.toDelete[49].id, 50);

	const at60 = pickCachesToDelete(makeNDeletable(60));
	assert.equal(at60.toDelete.length, 50);
	assert.equal(at60.capped, true);
	assert.equal(at60.totalDeletable, 60);
	assert.deepEqual(
		at60.toDelete.map((c) => c.id),
		Array.from({ length: 50 }, (_, i) => i + 1)
	);
});

test('AC2: empty list, single cache per family, and deterministic tie-break (higher id wins)', () => {
	const empty = pickCachesToDelete([]);
	assert.deepEqual(empty.toDelete, []);
	assert.deepEqual(empty.kept, []);
	assert.deepEqual(empty.leftAlone, []);
	assert.equal(empty.freedBytes, 0);
	assert.equal(empty.capped, false);

	const single = pickCachesToDelete([
		{
			id: 7,
			key: 'playwright-Linux-firefox-12345678',
			ref: 'refs/heads/staging',
			sizeInBytes: 100,
			createdAt: '2026-11-24T00:00:00Z',
			lastAccessedAt: '2026-11-24T00:00:00Z',
		},
	]);
	assert.deepEqual(single.toDelete, []);
	assert.deepEqual(
		single.kept.map((c) => c.id),
		[7]
	);

	// Same createdAt: higher id wins regardless of input order.
	const sameTs = [
		{
			id: 10,
			key: 'v0-rust-rust-Linux-x64-aaaaaaaa',
			ref: 'refs/heads/staging',
			sizeInBytes: 100,
			createdAt: '2026-11-24T12:00:00Z',
			lastAccessedAt: '2026-11-24T12:00:00Z',
		},
		{
			id: 25,
			key: 'v0-rust-rust-Linux-x64-bbbbbbbb',
			ref: 'refs/heads/staging',
			sizeInBytes: 100,
			createdAt: '2026-11-24T12:00:00Z',
			lastAccessedAt: '2026-11-24T12:00:00Z',
		},
	];
	const resForward = pickCachesToDelete(sameTs);
	const resReverse = pickCachesToDelete([...sameTs].reverse());
	assert.deepEqual(
		resForward.kept.map((c) => c.id),
		[25]
	);
	assert.deepEqual(
		resForward.toDelete.map((c) => c.id),
		[10]
	);
	assert.deepEqual(
		resReverse.kept.map((c) => c.id),
		[25]
	);
	assert.deepEqual(
		resReverse.toDelete.map((c) => c.id),
		[10]
	);
});

test('AC3: CLI dry-run prints table, writes GITHUB_STEP_SUMMARY, and calls gh cache delete zero times', () => {
	const { caches } = buildRealFixture();
	const { dir, logFile, summaryFile } = createFakeGh(caches);
	try {
		const stdout = execFileSync(process.execPath, [SCRIPT_PATH, '--dry-run'], {
			encoding: 'utf8',
			env: {
				...process.env,
				PATH: `${dir}:${process.env.PATH ?? ''}`,
				GITHUB_STEP_SUMMARY: summaryFile,
			},
		});
		const calls = readFileSync(logFile, 'utf8')
			.trim()
			.split('\n')
			.filter(Boolean)
			.map((line) => JSON.parse(line));

		const listCalls = calls.filter((a) => a[0] === 'cache' && a[1] === 'list');
		const deleteCalls = calls.filter((a) => a[0] === 'cache' && a[1] === 'delete');
		assert.equal(listCalls.length, 1);
		assert.equal(deleteCalls.length, 0, 'dry run must never call gh cache delete');

		assert.match(stdout, /dry run/i);
		assert.match(stdout, /v0-rust-checks-Linux-x64/);
		const summary = readFileSync(summaryFile, 'utf8');
		assert.match(summary, /v0-rust-checks-Linux-x64/);
		assert.match(summary, /Total before/i);
		assert.match(summary, /Total after/i);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('AC3: CLI live mode deletes every chosen id once, and exits non-zero after trying all if one fails', () => {
	const caches = [1, 2, 3, 4].map((n) => ({
		id: 100 + n,
		key: `v0-rust-checks-Linux-x64-${n.toString(16).padStart(8, '0')}`,
		ref: 'refs/heads/staging',
		sizeInBytes: 50 * MB,
		createdAt: `2026-11-2${n}T00:00:00Z`,
		lastAccessedAt: `2026-11-2${n}T00:00:00Z`,
	}));

	// Happy path: deletes 101, 102, 103 (keeps 104).
	const ok = createFakeGh(caches);
	try {
		execFileSync(process.execPath, [SCRIPT_PATH], {
			encoding: 'utf8',
			env: {
				...process.env,
				PATH: `${ok.dir}:${process.env.PATH ?? ''}`,
			},
		});
		const calls = readFileSync(ok.logFile, 'utf8')
			.trim()
			.split('\n')
			.filter(Boolean)
			.map((line) => JSON.parse(line));
		const deletedIds = calls
			.filter((a) => a[0] === 'cache' && a[1] === 'delete')
			.map((a) => Number(a[2]));
		assert.deepEqual(deletedIds, [101, 102, 103]);
	} finally {
		rmSync(ok.dir, { recursive: true, force: true });
	}

	// Failure path: deleting 102 fails, but 101 and 103 are still tried, and CLI exits non-zero.
	const failing = createFakeGh(caches, { failDeleteId: 102 });
	try {
		let exitCode = 0;
		let stderr = '';
		try {
			execFileSync(process.execPath, [SCRIPT_PATH], {
				encoding: 'utf8',
				stdio: ['ignore', 'pipe', 'pipe'],
				env: {
					...process.env,
					PATH: `${failing.dir}:${process.env.PATH ?? ''}`,
				},
			});
		} catch (err) {
			exitCode = err.status ?? 1;
			stderr = err.stderr ?? '';
		}
		assert.notEqual(exitCode, 0, 'CLI must exit non-zero when a deletion fails');
		assert.match(stderr, /Failed to delete cache 102/);

		const calls = readFileSync(failing.logFile, 'utf8')
			.trim()
			.split('\n')
			.filter(Boolean)
			.map((line) => JSON.parse(line));
		const deletedIds = calls
			.filter((a) => a[0] === 'cache' && a[1] === 'delete')
			.map((a) => Number(a[2]));
		assert.deepEqual(deletedIds, [101, 102, 103], 'all chosen ids must be tried before exiting');
	} finally {
		rmSync(failing.dir, { recursive: true, force: true });
	}
});
