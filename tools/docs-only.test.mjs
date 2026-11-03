import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDocsOnly, isAllowedPath, ALLOWLIST_DIRS, ALLOWLIST_ROOT_FILES, WORKFLOW_PATHS_IGNORE } from './docs-only.mjs';

test('isAllowedPath: allowed root files', () => {
	for (const file of ALLOWLIST_ROOT_FILES) {
		assert.equal(isAllowedPath(file), true, `expected ${file} to be allowed`);
	}
});

test('isAllowedPath: allowed directories', () => {
	assert.equal(isAllowedPath('docs/architecture.md'), true);
	assert.equal(isAllowedPath('docs/decisions/0001-init.md'), true);
	assert.equal(isAllowedPath('design/tokens.json'), true);
	assert.equal(isAllowedPath('design/screens/overview.md'), true);
	assert.equal(isAllowedPath('.antigravity/rules.md'), true);
});

test('isAllowedPath: forbidden paths explicitly required by AC1', () => {
	const forbidden = [
		'content/guides/x.md',
		'web/src/README.md',
		'.github/ISSUE_TEMPLATE/x.md',
		'tools/x.mjs',
		'docsx/a.md',
		'docs/../web/src/a.ts',
		'./docs/a.md',
		'README.md.js',
		'docs/has newline\n.md',
		'docs/has space.md',
		'docs/zero\u200Bwidth.md',
		'docs/café.md',
		'docs/тест.md',
		'docs/file%20name.md',
		'README.md%00',
		'',
	];

	for (const path of forbidden) {
		assert.equal(isAllowedPath(path), false, `expected "${path}" to be forbidden`);
	}
});

test('isDocsOnly: only allowed paths returns true', () => {
	assert.equal(isDocsOnly(['docs/a.md', 'README.md']), true);
	assert.equal(isDocsOnly(['design/tokens.json', 'AGENTS.md', '.antigravity/rules.md']), true);
});

test('isDocsOnly: one path outside the list returns false', () => {
	assert.equal(isDocsOnly(['docs/a.md', 'web/src/a.ts']), false);
	assert.equal(isDocsOnly(['README.md', 'tools/ci-gate.mjs']), false);
});

test('isDocsOnly: empty list returns false', () => {
	assert.equal(isDocsOnly([]), false);
});

test('isDocsOnly: empty path or invalid path in list returns false', () => {
	assert.equal(isDocsOnly(['docs/a.md', '']), false);
	assert.equal(isDocsOnly(['docs/a.md', 'content/guides/x.md']), false);
});

test('WORKFLOW_PATHS_IGNORE matches allowlist exactly', () => {
	const expected = [
		'docs/**',
		'design/**',
		'.antigravity/**',
		...ALLOWLIST_ROOT_FILES,
	];
	assert.deepEqual(WORKFLOW_PATHS_IGNORE, expected);
});

test('CLI: pipes NUL-separated input and outputs true/false', async () => {
	const { execFileSync } = await import('node:child_process');
	const scriptPath = new URL('./docs-only.mjs', import.meta.url).pathname;

	const outTrue = execFileSync(process.execPath, [scriptPath], {
		input: Buffer.from('docs/a.md\0README.md\0', 'utf8'),
		encoding: 'utf8',
	});
	assert.equal(outTrue, 'true\n');

	const outFalse = execFileSync(process.execPath, [scriptPath], {
		input: Buffer.from('docs/a.md\0web/src/a.ts\0', 'utf8'),
		encoding: 'utf8',
	});
	assert.equal(outFalse, 'false\n');
});

test('rename detection bypass test: git diff --no-renames rejects moved code file', async () => {
	const { execFileSync } = await import('node:child_process');
	const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
	const { tmpdir } = await import('node:os');
	const { join } = await import('node:path');
	const scriptPath = new URL('./docs-only.mjs', import.meta.url).pathname;

	const testRepo = mkdtempSync(join(tmpdir(), 'git-rename-test-'));
	try {
		const git = (...args) =>
			execFileSync('git', args, {
				cwd: testRepo,
				encoding: 'utf8',
				env: {
					...process.env,
					GIT_CONFIG_NOSYSTEM: '1',
					GIT_AUTHOR_NAME: 'Test',
					GIT_AUTHOR_EMAIL: 'test@example.com',
					GIT_COMMITTER_NAME: 'Test',
					GIT_COMMITTER_EMAIL: 'test@example.com',
				},
			});

		git('init', '-b', 'main');
		git('config', 'user.name', 'Test');
		git('config', 'user.email', 'test@example.com');

		mkdirSync(join(testRepo, 'web', 'src'), { recursive: true });
		writeFileSync(join(testRepo, 'web', 'src', 'a.ts'), 'export const x = 1;\n');
		git('add', 'web/src/a.ts');
		git('commit', '-m', 'commit code file');

		// Move web/src/a.ts to docs/a.md
		mkdirSync(join(testRepo, 'docs'), { recursive: true });
		git('mv', 'web/src/a.ts', 'docs/a.md');
		git('commit', '-m', 'rename code file into docs');

		// With default rename detection, git diff lists only destination docs/a.md
		const defaultDiff = execFileSync('git', ['diff', '--name-only', '-z', 'HEAD~1', 'HEAD'], {
			cwd: testRepo,
		});
		const bypassResult = execFileSync(process.execPath, [scriptPath], {
			input: defaultDiff,
			encoding: 'utf8',
		});
		assert.equal(
			bypassResult,
			'true\n',
			'reproduced bypass where default diff classifies rename as docs-only'
		);

		// With --no-renames, git diff lists both deleted web/src/a.ts and created docs/a.md
		const safeDiff = execFileSync(
			'git',
			['diff', '--no-renames', '--name-only', '-z', 'HEAD~1', 'HEAD'],
			{
				cwd: testRepo,
			}
		);
		const safeResult = execFileSync(process.execPath, [scriptPath], {
			input: safeDiff,
			encoding: 'utf8',
		});
		assert.equal(safeResult, 'false\n', 'expected --no-renames diff to be rejected as not docs-only');
	} finally {
		rmSync(testRepo, { recursive: true, force: true });
	}
});


