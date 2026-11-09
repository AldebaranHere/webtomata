import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isDocsOnly, isAllowedPath, ALLOWLIST_DIRS, ALLOWLIST_ROOT_FILES, WORKFLOW_PATHS_IGNORE } from './docs-only.mjs';

const SCRIPT_PATH = new URL('./docs-only.mjs', import.meta.url).pathname;

/**
 * The git variables that a hook exports to the commands it runs (a pre-push hook gets GIT_DIR of the
 * repository that is being pushed). A fixture repository must not inherit them: with GIT_DIR set, its
 * commits land in the real repository, and its `git config` rewrites the real configuration.
 */
const HOOK_GIT_VARS = [
	'GIT_DIR',
	'GIT_WORK_TREE',
	'GIT_INDEX_FILE',
	'GIT_OBJECT_DIRECTORY',
	'GIT_ALTERNATE_OBJECT_DIRECTORIES',
	'GIT_COMMON_DIR',
	'GIT_NAMESPACE',
	'GIT_PREFIX'
];

/** The environment of a fixture's git commands: a fixed identity, and no variable of another repository. */
function fixtureEnv(extra = {}) {
	const env = {
		...process.env,
		GIT_CONFIG_NOSYSTEM: '1',
		GIT_AUTHOR_NAME: 'Test',
		GIT_AUTHOR_EMAIL: 'test@example.com',
		GIT_COMMITTER_NAME: 'Test',
		GIT_COMMITTER_EMAIL: 'test@example.com',
		...extra
	};
	for (const name of HOOK_GIT_VARS) delete env[name];
	return env;
}

/** Runs git in `repo` with the fixture's environment. */
const gitIn =
	(repo, extra = {}) =>
	(...args) =>
		execFileSync('git', args, { cwd: repo, encoding: 'utf8', env: fixtureEnv(extra) });

/**
 * A repository whose only difference between HEAD~1 and HEAD is a code file renamed into `docs/`.
 * Returns the directory and a `git` that runs in it.
 */
function renameFixture(extra = {}) {
	const repo = mkdtempSync(join(tmpdir(), 'git-rename-test-'));
	const git = gitIn(repo, extra);
	git('init', '-b', 'main');
	git('config', 'user.name', 'Test');
	git('config', 'user.email', 'test@example.com');
	mkdirSync(join(repo, 'web', 'src'), { recursive: true });
	writeFileSync(join(repo, 'web', 'src', 'a.ts'), 'export const x = 1;\n');
	git('add', 'web/src/a.ts');
	git('commit', '-m', 'commit code file');
	mkdirSync(join(repo, 'docs'), { recursive: true });
	git('mv', 'web/src/a.ts', 'docs/a.md');
	git('commit', '-m', 'rename code file into docs');
	return { repo, git };
}

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

test('CLI: pipes NUL-separated input and outputs true/false', () => {
	const outTrue = execFileSync(process.execPath, [SCRIPT_PATH], {
		input: Buffer.from('docs/a.md\0README.md\0', 'utf8'),
		encoding: 'utf8',
	});
	assert.equal(outTrue, 'true\n');

	const outFalse = execFileSync(process.execPath, [SCRIPT_PATH], {
		input: Buffer.from('docs/a.md\0web/src/a.ts\0', 'utf8'),
		encoding: 'utf8',
	});
	assert.equal(outFalse, 'false\n');
});

test('rename detection bypass test: git diff --no-renames rejects moved code file', () => {
	const { repo: testRepo, git } = renameFixture();
	try {
		// With default rename detection, git diff lists only destination docs/a.md
		const defaultDiff = execFileSync('git', ['diff', '--name-only', '-z', 'HEAD~1', 'HEAD'], {
			cwd: testRepo,
			env: fixtureEnv()
		});
		const bypassResult = execFileSync(process.execPath, [SCRIPT_PATH], {
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
				env: fixtureEnv()
			}
		);
		const safeResult = execFileSync(process.execPath, [SCRIPT_PATH], {
			input: safeDiff,
			encoding: 'utf8',
		});
		assert.equal(safeResult, 'false\n', 'expected --no-renames diff to be rejected as not docs-only');
	} finally {
		rmSync(testRepo, { recursive: true, force: true });
	}
});



test('fixtureEnv: carries no git variable of another repository', () => {
	// The unit of the fix: whatever the hook exports, the fixture's environment is clean.
	const saved = HOOK_GIT_VARS.map((name) => [name, process.env[name]]);
	try {
		for (const name of HOOK_GIT_VARS) process.env[name] = '/somewhere/else/.git';
		const leaked = HOOK_GIT_VARS.filter((name) => fixtureEnv()[name] !== undefined);
		assert.deepEqual(leaked, [], 'the fixture inherits a git variable of another repository');
	} finally {
		for (const [name, value] of saved) {
			if (value === undefined) delete process.env[name];
			else process.env[name] = value;
		}
	}
});

test('a fixture never commits into the repository that GIT_DIR names (a hook exports it)', () => {
	// A pre-push hook runs the tests with GIT_DIR of the repository that is being pushed, so the
	// fixture must not inherit it: with it, "commit code file" landed on a real branch and its
	// `git config user.name Test` rewrote the real configuration (found in T-061). A decoy
	// repository stands in for the real one here, so that this test can never touch it.
	const decoy = mkdtempSync(join(tmpdir(), 'git-rename-decoy-'));
	const decoyGit = gitIn(decoy);
	const fixtureDirs = [];
	try {
		decoyGit('init', '-b', 'main');
		decoyGit('config', 'user.name', 'Test');
		decoyGit('config', 'user.email', 'test@example.com');
		writeFileSync(join(decoy, 'README.md'), 'decoy\n');
		decoyGit('add', 'README.md');
		decoyGit('commit', '-m', 'decoy commit');
		const before = decoyGit('log', '--format=%H %s');

		// The environment that a hook gives the tests: it names the decoy, not a temporary repository.
		const saved = HOOK_GIT_VARS.map((name) => [name, process.env[name]]);
		for (const [name] of saved) delete process.env[name];
		process.env.GIT_DIR = join(decoy, '.git');
		let fixture;
		try {
			fixture = renameFixture();
			fixtureDirs.push(fixture.repo);
		} finally {
			for (const [name, value] of saved) {
				if (value === undefined) delete process.env[name];
				else process.env[name] = value;
			}
		}

		// The point of the test: the repository that GIT_DIR names has not moved.
		assert.equal(
			decoyGit('log', '--format=%H %s'),
			before,
			'the fixture committed into the repository that GIT_DIR names'
		);
		// And the fixture really did its work in its own repository.
		assert.equal(
			fixture.git('log', '--format=%s').trim().split('\n').length,
			2,
			'the fixture repository has its two commits'
		);
	} finally {
		for (const dir of fixtureDirs) rmSync(dir, { recursive: true, force: true });
		rmSync(decoy, { recursive: true, force: true });
	}
});
