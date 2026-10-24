import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkQuestions } from './check-questions.mjs';
import { BASE } from '../web/src/lib/questions/testing.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// The checks with the engine need the WASM package (`pnpm build:wasm`).
const HAS_WASM = existsSync(join(ROOT, 'web/src/lib/engine/wasm/engine_wasm.js'));

let dir;
before(() => {
	dir = mkdtempSync(join(tmpdir(), 'questions-'));
});
after(() => rmSync(dir, { recursive: true, force: true }));

/** A folder with these files; returns what was printed and the result. */
async function run(files, options = {}) {
	const folder = mkdtempSync(join(dir, 'case-'));
	for (const [name, text] of Object.entries(files)) writeFileSync(join(folder, name), text);
	const printed = [];
	const result = await checkQuestions({
		dir: folder,
		print: (line) => printed.push(line),
		...options
	});
	return { printed, ...result };
}

describe('the shape of the files (--schema-only, no engine)', () => {
	const options = { schemaOnly: true };

	test('an empty folder is fine', async () => {
		const { printed, problems } = await run({}, options);
		assert.equal(problems, 0);
		assert.match(printed.at(-1), /^ok {3}0 question\(s\)/);
	});

	test('a good file passes, and files that are not questions are skipped', async () => {
		const { problems, files } = await run(
			{
				'berakhiran-10.yaml': BASE,
				'_template.yaml': 'not: a question',
				'README.md': '# x',
				'schema.json': '{}'
			},
			options
		);
		assert.equal(files, 1);
		assert.equal(problems, 0);
	});

	test('a field with a problem is named, with its file and line', async () => {
		const { printed, problems } = await run(
			{ 'berakhiran-10.yaml': BASE.replace('week: 1', 'week: soon') },
			options
		);
		assert.equal(problems, 1);
		assert.match(
			printed[0],
			/^FAIL content|^FAIL .*berakhiran-10\.yaml:10: week: must be a whole number$/
		);
		assert.match(printed.at(-1), /^1 problem\(s\) in 1 of 1 question file\(s\)\.$/);
	});

	test('a mistake in the YAML is reported at its line', async () => {
		const { printed } = await run(
			{ 'berakhiran-10.yaml': BASE.replace('alphabet: [0, 1]', 'alphabet: [0, 1') },
			options
		);
		assert.match(printed[0], /berakhiran-10\.yaml:\d+: /);
	});

	test('the id must be the name of the file', async () => {
		const { printed, problems } = await run({ 'other-name.yaml': BASE }, options);
		assert.equal(problems, 1);
		assert.match(
			printed[0],
			/id: the id "berakhiran-10" must be the name of the file \(other-name\)/
		);
	});

	test('a file of more than 64 KB is not read', async () => {
		const { printed } = await run({ 'berakhiran-10.yaml': BASE + '#'.repeat(70 * 1024) }, options);
		assert.match(printed[0], /the file is bigger than 64 KB/);
	});

	test('every file is reported, not only the first with a problem', async () => {
		const { problems, printed } = await run(
			{
				'berakhiran-10.yaml': BASE.replace('week: 1', 'week: soon'),
				'berakhiran-11.yaml': BASE.replace('id: berakhiran-10', 'id: berakhiran-11').replace(
					'difficulty: 1',
					'difficulty: 9'
				)
			},
			options
		);
		assert.equal(problems, 2);
		assert.match(printed.at(-1), /2 problem\(s\) in 2 of 2/);
	});
});

describe(
	'the checks with the engine',
	{ skip: !HAS_WASM && 'the WASM package is not built' },
	() => {
		test('a sound question passes', async () => {
			const { problems, printed } = await run({ 'berakhiran-10.yaml': BASE });
			assert.equal(problems, 0);
			assert.match(printed.at(-1), /^ok {3}1 question\(s\)/);
		});

		test('an example that the solution gets wrong is a problem', async () => {
			const { printed, problems } = await run({
				'berakhiran-10.yaml': BASE.replace('accept: [10, 0110]', 'accept: [10, 11]')
			});
			assert.equal(problems, 1);
			assert.match(
				printed[0],
				/examples\.accept\[1\]: "11" is rejected by the solution, but the question says it must be accepted/
			);
		});

		test('a solution with a missing transition is a problem, by the name of the state', async () => {
			const { printed } = await run({ 'berakhiran-10.yaml': BASE.replace('    - q1 0 q2\n', '') });
			assert.match(printed[0], /solution: the state q1 has no transition on 0/);
		});

		test('--report lists the first strings that the solution accepts', async () => {
			const { printed } = await run({ 'berakhiran-10.yaml': BASE }, { report: true });
			assert.match(printed[0], /berakhiran-10 accepts, shortest first: 10, 010, 110, 0010, 0110/);
		});

		test('the engine is needed, and the error says how to get it', async () => {
			await assert.rejects(
				run({ 'berakhiran-10.yaml': BASE }, { wasmDir: join(dir, 'no-wasm') }),
				/pnpm build:wasm.*--schema-only/s
			);
		});
	}
);

describe('the command', () => {
	const cli = (folder, ...flags) =>
		spawnSync(
			process.execPath,
			[join(ROOT, 'tools/check-questions.mjs'), folder, '--schema-only', ...flags],
			{
				encoding: 'utf8'
			}
		);

	test('exits 0 for good files and 1 for a broken one, as CI needs', () => {
		const good = mkdtempSync(join(dir, 'cli-good-'));
		writeFileSync(join(good, 'berakhiran-10.yaml'), BASE);
		const ok = cli(good);
		assert.equal(ok.status, 0, ok.stderr);
		assert.match(ok.stdout, /^ok {3}1 question\(s\)/m);

		const bad = mkdtempSync(join(dir, 'cli-bad-'));
		writeFileSync(join(bad, 'berakhiran-10.yaml'), BASE.replace('week: 1', 'week: soon'));
		const failed = cli(bad);
		assert.equal(failed.status, 1);
		assert.match(failed.stdout, /FAIL .*berakhiran-10\.yaml:10: week: must be a whole number/);
	});

	test('runs the TypeScript of the site directly, with no warning or crash', () => {
		const good = mkdtempSync(join(dir, 'cli-ts-'));
		const result = cli(good);
		assert.equal(result.status, 0, result.stderr);
		assert.doesNotMatch(result.stderr, /Error|Cannot find/);
	});
});
