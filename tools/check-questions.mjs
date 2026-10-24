// Checks the question files in content/questions (tasks Q1 and Q2).
//
//   node tools/check-questions.mjs [folder] [--schema-only] [--report]
//
// For each *.yaml file (a name that starts with _ is a template and is skipped) it checks the shape
// against content/questions/schema.json, that the name of the file is the id of the question, and
// then, with the engine, that the solution is valid, meets the constraints of the question and
// agrees with its examples. --schema-only skips the engine (it works without Rust or WASM).
// --report also prints the first strings that each solution accepts, so that a reviewer can read
// them and compare them with the statement.
//
// The logic is in web/src/lib/questions (TypeScript, which the site will reuse). Node runs those
// files directly, which is why they use erasable syntax and relative imports only.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createSyncEngine } from '../web/src/lib/engine/handlers.ts';
import { acceptedStrings, checkQuestion } from '../web/src/lib/questions/check.ts';
import {
	MAX_FILE_BYTES,
	createSchemaValidator,
	parseQuestionFile
} from '../web/src/lib/questions/load.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DEFAULT_DIR = join(ROOT, 'content/questions');
const DEFAULT_WASM = join(ROOT, 'web/src/lib/engine/wasm');

/** Loads the WASM engine and gives it as plain calls. Throws a clear error if it is not built. */
async function loadEngine(wasmDir) {
	const glue = join(wasmDir, 'engine_wasm.js');
	if (!existsSync(glue)) {
		throw new Error(
			'The WASM package is missing, so the engine checks cannot run. Run `pnpm build:wasm` ' +
				'(on Windows, in WSL), or use --schema-only to check only the shape of the files.'
		);
	}
	const wasm = await import(pathToFileURL(glue).href);
	await wasm.default({ module_or_path: readFileSync(join(wasmDir, 'engine_wasm_bg.wasm')) });
	return createSyncEngine(wasm);
}

/**
 * Checks every question in `dir`. Prints with `print`. Returns `{ files, problems }`; there is no
 * problem when all is well.
 */
export async function checkQuestions({
	dir = DEFAULT_DIR,
	schemaPath = join(ROOT, 'content/questions/schema.json'),
	wasmDir = DEFAULT_WASM,
	schemaOnly = false,
	report = false,
	print = console.log
} = {}) {
	const validate = createSchemaValidator(JSON.parse(readFileSync(schemaPath, 'utf8')));
	const engine = schemaOnly ? undefined : await loadEngine(wasmDir);
	const shown = (name) => relative(ROOT, join(dir, name)).replaceAll('\\', '/');

	const names = readdirSync(dir)
		.filter((name) => /\.ya?ml$/.test(name) && !name.startsWith('_'))
		.sort();

	let problems = 0;
	let broken = 0;
	for (const name of names) {
		const found = [];
		const path = join(dir, name);
		let question;
		if (statSync(path).size > MAX_FILE_BYTES) {
			found.push({
				path: '(file)',
				message: `the file is bigger than ${MAX_FILE_BYTES / 1024} KB`
			});
		} else {
			const parsed = parseQuestionFile(readFileSync(path, 'utf8'), validate);
			found.push(...parsed.problems);
			question = parsed.question;
		}
		if (question && question.id !== basename(name).replace(/\.ya?ml$/, '')) {
			found.push({
				path: 'id',
				message: `the id "${question.id}" must be the name of the file (${basename(name).replace(/\.ya?ml$/, '')})`
			});
		}
		if (question && engine) found.push(...checkQuestion(question, engine));

		for (const p of found) {
			const where = p.line === undefined ? shown(name) : `${shown(name)}:${p.line}`;
			print(`FAIL ${where}: ${p.path === '(file)' ? '' : `${p.path}: `}${p.message}`);
		}
		problems += found.length;
		if (found.length > 0) broken++;
		if (report && engine && question && found.length === 0) {
			const { accepted } = acceptedStrings(question, engine, { maxLength: 4, cap: 150, limit: 25 });
			print(
				`     ${question.id} accepts, shortest first: ${accepted.join(', ') || '(none up to length 4)'}`
			);
		}
	}

	const where = relative(ROOT, dir).replaceAll('\\', '/') || '.';
	if (problems > 0) {
		print(`${problems} problem(s) in ${broken} of ${names.length} question file(s).`);
	} else {
		print(`ok   ${names.length} question(s) in ${where}${schemaOnly ? ' (shape only)' : ''}`);
	}
	return { files: names.length, problems };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const args = process.argv.slice(2);
	const flags = new Set(args.filter((a) => a.startsWith('--')));
	const folder = args.find((a) => !a.startsWith('--'));
	try {
		const { problems } = await checkQuestions({
			dir: folder ?? DEFAULT_DIR,
			schemaOnly: flags.has('--schema-only'),
			report: flags.has('--report')
		});
		process.exit(problems > 0 ? 1 : 0);
	} catch (error) {
		console.error(`FAIL ${error.message}`);
		process.exit(1);
	}
}
