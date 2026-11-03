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
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    steps:
      - uses: ${PIN}
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
  deploy:
    needs: build
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    steps:
      - uses: ${PIN}
      - run: pnpm install --frozen-lockfile --ignore-scripts
      - name: Deploy
        env:
          CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: pnpm --filter web exec wrangler deploy
  verify:
    needs: deploy
    runs-on: ubuntu-24.04
    timeout-minutes: 15
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
	const bad = good.replace(
		'node tools/smoke.mjs "$URL"',
		'node tools/smoke.mjs "${{ secrets.X }}"'
	);
	assert.equal(check(bad).length, 1);
});

test('a secret in another workflow file is a problem, even in a job named deploy', () => {
	const problems = check(good, 'release.yml');
	assert.equal(problems.length, 1);
	assert.match(problems[0], /release\.yml/);
});

test('the word secrets in a comment is not a problem', () => {
	const text = good.replace(
		'jobs:',
		'# The key is in secrets.CLOUDFLARE_API_TOKEN, only in deploy.\njobs:'
	);
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
	for (const command of [
		'pnpm build',
		'pnpm --filter web build',
		'cargo build',
		'wasm-pack build',
		'pnpm lint'
	]) {
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

// The jobs of `good` end like this: the header, `runs-on`, then the timeout.
const noTimeout = (job) => {
	const lines = good.split('\n');
	const at = lines.indexOf(`  ${job}:`);
	const timeout = lines.indexOf('    timeout-minutes: 15', at);
	return lines.filter((_, i) => i !== timeout).join('\n');
};

test('a job without timeout-minutes is a problem: a stalled step must not run for six hours', () => {
	const problems = check(noTimeout('verify'));
	assert.equal(problems.length, 1);
	assert.match(problems[0], /job verify/);
	assert.match(problems[0], /timeout-minutes/);
});

test('a timeout of one job does not cover the next job', () => {
	const problems = check(noTimeout('deploy'));
	assert.equal(problems.length, 1);
	assert.match(problems[0], /job deploy/);
});

test('a timeout that is not a number is a problem', () => {
	const bad = good.replace('timeout-minutes: 15', 'timeout-minutes: soon');
	assert.ok(check(bad).length >= 1);
});

test('a timeout of more than 30 minutes is a problem: CI must not hang for long', () => {
	const bad = good.replace('timeout-minutes: 15', 'timeout-minutes: 60');
	assert.ok(check(bad).some((p) => /30/.test(p)));
});

// The ruleset requires the checks `rust` and `web`. `web` is a gate: it waits for every other job of
// ci.yml and is green only if all of them are. A skipped required check counts as passed, so the
// gate must run when a job before it failed (`if: always()`).
// A fast path for docs-only PRs uses a scope job, skips heavy jobs when docs_only is true, and
// checks out in the gate.
const ci = `
name: CI
on:
  pull_request:
jobs:
  scope:
    runs-on: ubuntu-24.04
    timeout-minutes: 5
    steps:
      - uses: ${PIN}
  rust:
    needs: scope
    if: needs.scope.outputs.docs_only != 'true'
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    steps:
      - uses: ${PIN}
  checks:
    needs: scope
    if: needs.scope.outputs.docs_only != 'true'
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    steps:
      - uses: ${PIN}
  e2e:
    needs: scope
    if: needs.scope.outputs.docs_only != 'true'
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    steps:
      - uses: ${PIN}
  lighthouse:
    needs: scope
    if: needs.scope.outputs.docs_only != 'true'
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    steps:
      - uses: ${PIN}
  cross-browser:
    needs: scope
    if: needs.scope.outputs.docs_only != 'true'
    runs-on: ubuntu-24.04
    timeout-minutes: 25
    steps:
      - uses: ${PIN}
  web:
    if: always()
    needs: [scope, checks, e2e, lighthouse, cross-browser]
    runs-on: ubuntu-24.04
    timeout-minutes: 5
    steps:
      - run: echo gate
`;

const checkCi = (text) => checkWorkflows([{ name: 'ci.yml', text }]);

test('a gate job web that waits for every other job, and runs always, has no problems', () => {
	assert.deepEqual(checkCi(ci), []);
});

test('a job that the gate does not wait for is a problem, so that a new job cannot be left out', () => {
	const bad = ci.replace('needs: [scope, checks, e2e, lighthouse, cross-browser]', 'needs: [scope, checks, lighthouse, cross-browser]');
	const problems = checkCi(bad);
	assert.equal(problems.length, 1);
	assert.match(problems[0], /web/);
	assert.match(problems[0], /e2e/);
});

test('the job rust does not have to be in the needs of the gate: it is required by itself', () => {
	assert.ok(!checkCi(ci.replace('needs: [scope, checks, e2e, lighthouse, cross-browser]', 'needs: [scope, checks, e2e, lighthouse, cross-browser, rust]')).length);
});

test('a gate without if: always() is a problem: a skipped required check counts as passed', () => {
	const problems = checkCi(ci.replace('    if: always()\n', ''));
	assert.equal(problems.length, 1);
	assert.match(problems[0], /always\(\)/);
});

test('a ci.yml without the gate job web is a problem', () => {
	const bad = ci.replace(/ {2}web:[\s\S]*$/, '');
	const problems = checkCi(bad);
	assert.equal(problems.length, 1);
	assert.match(problems[0], /web/);
});

test('a ci.yml without the scope job is a problem', () => {
	const bad = ci.replace(/ {2}scope:[\s\S]*? {2}rust:/, '  rust:');
	const problems = checkCi(bad);
	assert.ok(problems.some((p) => /scope.*missing/.test(p)));
});

test('a heavy job without needs: scope is a problem', () => {
	const bad = ci.replace('    needs: scope\n    if: needs.scope.outputs.docs_only != \'true\'\n    runs-on: ubuntu-24.04\n    timeout-minutes: 20', '    if: needs.scope.outputs.docs_only != \'true\'\n    runs-on: ubuntu-24.04\n    timeout-minutes: 20');
	const problems = checkCi(bad);
	assert.ok(problems.some((p) => /heavy job must wait for scope/.test(p)));
});

test('a heavy job without if: needs.scope.outputs.docs_only != \'true\' is a problem', () => {
	const bad = ci.replace('    if: needs.scope.outputs.docs_only != \'true\'\n', '');
	const problems = checkCi(bad);
	assert.ok(problems.some((p) => /heavy job must have "if: needs\.scope\.outputs\.docs_only != 'true'"/.test(p)));
});

const docsIgnoreList = `
      - 'docs/**'
      - 'design/**'
      - '.antigravity/**'
      - 'README.md'
      - 'CONTRIBUTING.md'
      - 'SECURITY.md'
      - 'AGENTS.md'
      - 'CLAUDE.md'
      - 'LICENSE'
`;

test('codeql.yml and deploy.yml with valid paths-ignore have no problems', () => {
	const codeql = `
name: CodeQL
on:
  pull_request:
    branches: [main, staging]
    paths-ignore:${docsIgnoreList}
jobs:
  analyze:
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    steps:
      - uses: ${PIN}
`;
	assert.deepEqual(checkWorkflows([{ name: 'codeql.yml', text: codeql }]), []);
});

test('codeql.yml or deploy.yml without paths-ignore is a problem', () => {
	const badCodeql = `
name: CodeQL
on:
  pull_request:
    branches: [main, staging]
jobs:
  analyze:
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    steps:
      - uses: ${PIN}
`;
	const problems = checkWorkflows([{ name: 'codeql.yml', text: badCodeql }]);
	assert.ok(problems.some((p) => /paths-ignore equal to the allowlist/.test(p)));
});

test('codeql.yml with differing paths-ignore is a problem', () => {
	const badCodeql = `
name: CodeQL
on:
  pull_request:
    branches: [main, staging]
    paths-ignore:
      - 'docs/**'
jobs:
  analyze:
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    steps:
      - uses: ${PIN}
`;
	const problems = checkWorkflows([{ name: 'codeql.yml', text: badCodeql }]);
	assert.ok(problems.some((p) => /must match the docs-only allowlist exactly/.test(p)));
});

test('audit.yml with positive paths list and no allowlisted entry has no problems', () => {
	const audit = `
name: Audit
on:
  pull_request:
    paths:
      - "Cargo.lock"
      - "pnpm-lock.yaml"
jobs:
  audit:
    runs-on: ubuntu-24.04
    timeout-minutes: 10
    steps:
      - uses: ${PIN}
`;
	assert.deepEqual(checkWorkflows([{ name: 'audit.yml', text: audit }]), []);
});

test('audit.yml or fuzz.yml with allowlisted entry in paths is a problem', () => {
	const badAudit = `
name: Audit
on:
  pull_request:
    paths:
      - "Cargo.lock"
      - "docs/**"
jobs:
  audit:
    runs-on: ubuntu-24.04
    timeout-minutes: 10
    steps:
      - uses: ${PIN}
`;
	const problems = checkWorkflows([{ name: 'audit.yml', text: badAudit }]);
	assert.ok(problems.some((p) => /must not include allowlisted docs path "docs\/\*\*"/.test(p)));
});

test('the gate is only asked of ci.yml', () => {
	assert.deepEqual(check(good), []);
});

// Write rights: only the workflow that cleans the caches may write to the Actions of the repository,
// and no workflow may write to the contents (nothing in CI needs to push or tag).
const small = `
name: X
on:
  pull_request:
jobs:
  cleanup:
    runs-on: ubuntu-24.04
    timeout-minutes: 5
    steps:
      - run: echo ok
`;
const withPermission = (line) => small.replace('jobs:', `permissions:\n  ${line}\njobs:`);

test('actions: write is a problem in any workflow but cleanup-caches.yml', () => {
	const problems = check(withPermission('actions: write'), 'release.yml');
	assert.equal(problems.length, 1);
	assert.match(problems[0], /actions: write/);
	assert.match(problems[0], /cleanup-caches\.yml/);
});

test('actions: write is allowed in cleanup-caches.yml', () => {
	assert.deepEqual(check(withPermission('actions: write'), 'cleanup-caches.yml'), []);
});

test('contents: write is a problem everywhere', () => {
	for (const name of ['deploy.yml', 'cleanup-caches.yml', 'release.yml']) {
		const problems = check(withPermission('contents: write'), name);
		assert.ok(
			problems.some((p) => /contents: write/.test(p)),
			name
		);
	}
});

// The runner image is pinned: `ubuntu-latest` moves to a new Ubuntu on a date that GitHub chooses
// (to Ubuntu 26 from October 2026), and the system libraries of the browsers may not exist there.
test('a runner with a -latest label is a problem: the runner image is pinned', () => {
	const problems = check(small.replace('ubuntu-24.04', 'ubuntu-latest'), 'release.yml');
	assert.equal(problems.length, 1);
	assert.match(problems[0], /ubuntu-latest/);
	assert.match(problems[0], /ubuntu-24\.04/);
});

test('a pinned runner is not a problem', () => {
	assert.deepEqual(check(small, 'release.yml'), []);
});

test('read rights are not a problem', () => {
	assert.deepEqual(check(withPermission('contents: read'), 'release.yml'), []);
});
