// Run with `node --test "tools/*.test.mjs"`. These tests check the guard rails for the workflows:
// the Cloudflare key stays in the one job that deploys, every action is pinned to a full commit,
// and the deploy job runs no build code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { checkWorkflows } from './check-workflows.mjs';

const PIN = 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1';

const good = `
name: Deploy
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: ${PIN}
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: ${PIN}
      - run: pnpm install --frozen-lockfile --ignore-scripts
      - name: Deploy
        env:
          CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: pnpm --filter web exec wrangler deploy
  verify:
    needs: deploy
    runs-on: ubuntu-latest
    steps:
      - uses: ${PIN}
      - run: node tools/smoke.mjs "$URL"
`;

const check = (text, name = 'deploy.yml') => checkWorkflows([{ name, text }]);

test('a workflow that follows the rules has no problems', () => {
	assert.deepEqual(check(good), []);
});

test('a secret in the build job is a problem', () => {
	const bad = good.replace(
		'      - run: pnpm build',
		'      - run: pnpm build\n        env:\n          X: ${{ secrets.CLOUDFLARE_API_TOKEN }}'
	);
	const problems = check(bad);
	assert.equal(problems.length, 1);
	assert.match(problems[0], /secrets/);
	assert.match(problems[0], /build/);
});

test('a secret in the verify job is a problem', () => {
	const bad = good.replace('node tools/smoke.mjs "$URL"', 'node tools/smoke.mjs "${{ secrets.X }}"');
	assert.equal(check(bad).length, 1);
});

test('a secret in another workflow file is a problem, even in a job named deploy', () => {
	const problems = check(good, 'ci.yml');
	assert.equal(problems.length, 1);
	assert.match(problems[0], /ci\.yml/);
});

test('the word secrets in a comment is not a problem', () => {
	const text = good.replace('jobs:', '# The key is in secrets.CLOUDFLARE_API_TOKEN, only in deploy.\njobs:');
	assert.deepEqual(check(text), []);
});

test('an action that is not pinned to a full commit is a problem', () => {
	for (const unpinned of [
		'actions/checkout@v4',
		'actions/checkout@main',
		'actions/checkout@3d3c42e',
		'actions/checkout'
	]) {
		const problems = check(good.replace(PIN, unpinned));
		assert.ok(problems.length >= 1, unpinned);
		assert.match(problems[0], /pinned/);
	}
});

test('a local action is allowed without a pin', () => {
	assert.deepEqual(check(good.replace(PIN, './.github/actions/local')), []);
});

test('pull_request_target is a problem', () => {
	const bad = good.replace('on:\n  push:\n    branches: [main]', 'on:\n  pull_request_target:');
	const problems = check(bad);
	assert.equal(problems.length, 1);
	assert.match(problems[0], /pull_request_target/);
});

test('the deploy job must install without running scripts', () => {
	const bad = good.replace(
		'pnpm install --frozen-lockfile --ignore-scripts',
		'pnpm install --frozen-lockfile'
	);
	const problems = check(bad);
	assert.equal(problems.length, 1);
	assert.match(problems[0], /ignore-scripts/);
});

test('the deploy job runs no build code', () => {
	for (const command of ['pnpm build', 'pnpm --filter web build', 'cargo build', 'wasm-pack build', 'pnpm lint']) {
		const bad = good.replace(
			'      - name: Deploy',
			`      - run: ${command}\n      - name: Deploy`
		);
		const problems = check(bad);
		assert.equal(problems.length, 1, command);
		assert.match(problems[0], /deploy job/);
	}
});

test('every problem is listed, with the file and the job', () => {
	const bad = good
		.replace(PIN, 'actions/checkout@v4')
		.replace('node tools/smoke.mjs "$URL"', 'echo ${{ secrets.X }}');
	const problems = check(bad);
	assert.ok(problems.some((p) => /pinned/.test(p) && p.includes('deploy.yml')));
	assert.ok(problems.some((p) => /secrets/.test(p) && p.includes('verify')));
});

test('the real workflows of this repository follow the rules', () => {
	const dir = new URL('../.github/workflows/', import.meta.url);
	const files = readdirSync(dir)
		.filter((name) => name.endsWith('.yml'))
		.map((name) => ({ name, text: readFileSync(new URL(name, dir), 'utf8') }));
	assert.ok(files.length >= 3);
	assert.deepEqual(checkWorkflows(files), []);
});
