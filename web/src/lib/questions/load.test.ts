import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, createSchemaValidator, parseQuestionFile } from './load.ts';
import type { SchemaValidator } from './load.ts';
import { BASE } from './testing.ts';

const SCHEMA_URL = new URL('../../../../content/questions/schema.json', import.meta.url);

/** The base question with one text replaced, so that each test shows the one thing it changes. */
const edit = (from: string, to: string) => {
	if (!BASE.includes(from)) throw new Error(`the base has no "${from}"`);
	return BASE.replace(from, to);
};

let validate: SchemaValidator;
beforeAll(() => {
	validate = createSchemaValidator(JSON.parse(readFileSync(SCHEMA_URL, 'utf8')));
});

const found = (text: string) => parseQuestionFile(text, validate);
const messages = (text: string) => found(text).problems.map((p) => `${p.path}: ${p.message}`);
/** The one problem of a text that has exactly one. */
const only = (text: string) => {
	const { problems } = found(text);
	expect(problems.map((p) => `${p.path}: ${p.message}`)).toHaveLength(1);
	return problems[0]!;
};

describe('a question file that is right', () => {
	it('gives the question and no problem', () => {
		const { question, problems } = found(BASE);
		expect(problems).toEqual([]);
		expect(question?.id).toBe('berakhiran-10');
		expect(question?.type).toBe('build-dfsm');
	});

	it('reads everything as text, so that digits keep their zeros', () => {
		const { question } = found(BASE);
		expect(question?.alphabet).toEqual(['0', '1']);
		expect(question?.examples.accept).toEqual(['10', '0110']);
		expect(question?.examples.reject).toEqual(['', '01']);
	});

	it('reads numbers and true or false where the schema asks for them', () => {
		const text = edit(
			'pattern: berakhiran-x\n',
			'pattern: berakhiran-x\nconstraints:\n  maxStates: 4\n  complete: true\n  minimal: false\n'
		);
		const { question, problems } = found(text);
		expect(problems).toEqual([]);
		expect(question?.difficulty).toBe(1);
		expect(question?.week).toBe(1);
		expect(question?.schemaVersion).toBe(1);
		expect(question?.constraints).toEqual({ maxStates: 4, complete: true, minimal: false });
	});

	it('keeps words that YAML would read as other things (yes, no, null, ~) as text', () => {
		const { question } = found(
			edit('alphabet: [0, 1]', 'alphabet: [yes, no, null, "~"]').replace(/q0 0 q0/, 'q0 yes q0')
		);
		expect(question?.alphabet).toEqual(['yes', 'no', 'null', '~']);
	});

	it('is a regular expression for write-regex', () => {
		const text = BASE.replace('type: build-dfsm', 'type: write-regex').replace(
			/solution:[\s\S]*$/,
			'solution: (0∪1)*10\n'
		);
		const { question, problems } = found(text);
		expect(problems).toEqual([]);
		expect(question?.solution).toBe('(0∪1)*10');
	});
});

describe('a question file with a problem in its fields', () => {
	it('names a field that is missing, at the line of the group it belongs to', () => {
		const text = BASE.replace('week: 1\n', '');
		const problem = only(text);
		expect(problem).toMatchObject({ path: 'week', message: 'is required', line: 1 });
	});

	it('names a field that does not exist (a typo), at the line of the field', () => {
		const problem = only(edit('week: 1\n', 'week: 1\ndificulty: 2\n'));
		expect(problem).toMatchObject({ path: 'dificulty', message: 'is not a known field' });
		expect(problem.line).toBe(12);
	});

	it('says what type a value must have, at its line', () => {
		const problem = only(edit('week: 1', 'week: soon'));
		expect(problem).toMatchObject({ path: 'week', message: 'must be a whole number' });
		expect(problem.line).toBe(11);
	});

	it('says which values are allowed', () => {
		const problem = only(edit('type: build-dfsm', 'type: build-dfa'));
		expect(problem.path).toBe('type');
		expect(problem.message).toBe('must be one of build-dfsm, build-ndfsm, write-regex');
	});

	it('refuses another version of the format', () => {
		expect(only(edit('schemaVersion: 1', 'schemaVersion: 2'))).toMatchObject({
			path: 'schemaVersion',
			message: 'must be 1 (this is the only version of the format that exists)'
		});
	});

	it('explains the format of an id', () => {
		const problem = only(edit('id: berakhiran-10', 'id: Berakhiran_10'));
		expect(problem.path).toBe('id');
		expect(problem.message).toContain('lowercase letters, digits and single hyphens');
	});

	it('refuses a symbol with a comma, a space, ε, or the word eps', () => {
		for (const symbol of ['"a,b"', '"a b"', 'ε', 'eps']) {
			const problems = found(edit('alphabet: [0, 1]', `alphabet: [0, ${symbol}]`)).problems;
			expect(
				problems.some((p) => p.path === 'alphabet[1]'),
				symbol
			).toBe(true);
		}
	});

	it('refuses the same symbol twice', () => {
		expect(messages(edit('alphabet: [0, 1]', 'alphabet: [0, 0]'))).toContain(
			'alphabet: has the same item twice'
		);
	});

	it('needs at least two examples to accept and two to reject', () => {
		const text = edit('accept: [10, 0110]', 'accept: [10]');
		expect(only(text)).toMatchObject({
			path: 'examples.accept',
			message: 'needs at least 2 items'
		});
	});

	it('needs the title in both languages', () => {
		const problem = only(edit('  en: Strings that end with 10\n', ''));
		expect(problem).toMatchObject({ path: 'title.en', message: 'is required' });
	});

	it('refuses a title that is too long', () => {
		const problem = only(edit('id: String yang diakhiri 10', `id: ${'x'.repeat(121)}`));
		expect(problem).toMatchObject({ path: 'title.id' });
		expect(problem.message).toBe('is too long (at most 120 characters)');
	});

	it('refuses a section number that is not a number', () => {
		const text = edit(
			'pattern: berakhiran-x\n',
			'pattern: berakhiran-x\nreferences:\n  rich: [five]\n'
		);
		expect(only(text).message).toContain('section number');
	});
});

describe('constraints', () => {
	const withConstraints = (type: string, lines: string) =>
		BASE.replace('type: build-dfsm', `type: ${type}`).replace(
			'pattern: berakhiran-x\n',
			`pattern: berakhiran-x\nconstraints:\n${lines}`
		);

	it('allow maxStates, complete and minimal for a DFSM', () => {
		expect(
			found(withConstraints('build-dfsm', '  maxStates: 4\n  complete: true\n  minimal: true\n'))
				.problems
		).toEqual([]);
	});

	it('refuse allowEpsilon for a DFSM', () => {
		const problem = only(withConstraints('build-dfsm', '  allowEpsilon: false\n'));
		expect(problem).toMatchObject({
			path: 'constraints.allowEpsilon',
			message: 'does not apply to this type of question'
		});
	});

	it('refuse complete and minimal for an NDFSM', () => {
		const paths = found(
			withConstraints('build-ndfsm', '  complete: true\n  minimal: true\n')
		).problems.map((p) => p.path);
		expect(paths).toContain('constraints.complete');
		expect(paths).toContain('constraints.minimal');
	});

	it('refuse every constraint for a regular expression', () => {
		const text = withConstraints('write-regex', '  maxStates: 4\n').replace(
			/solution:[\s\S]*$/,
			'solution: 0*\n'
		);
		expect(only(text)).toMatchObject({
			path: 'constraints.maxStates',
			message: 'is not a known field'
		});
	});

	it('need complete for minimal: the minimal DFSM is counted with its dead state', () => {
		const problem = only(withConstraints('build-dfsm', '  minimal: true\n  complete: false\n'));
		expect(problem).toMatchObject({
			path: 'constraints.complete',
			message: 'minimal needs complete: true'
		});
	});

	it('limit maxStates to 1 to 100', () => {
		expect(only(withConstraints('build-dfsm', '  maxStates: 0\n')).message).toBe(
			'must be at least 1'
		);
		expect(only(withConstraints('build-dfsm', '  maxStates: 101\n')).message).toBe(
			'must be at most 100'
		);
	});
});

describe('the solution', () => {
	it('must be text for a regular expression, and a set of fields for a machine', () => {
		const regexWithMachine = BASE.replace('type: build-dfsm', 'type: write-regex');
		expect(messages(regexWithMachine)).toContain('solution: must be text');
		const machineWithText = BASE.replace(/solution:[\s\S]*$/, 'solution: (0∪1)*10\n');
		expect(messages(machineWithText)).toContain('solution: must be a set of fields (key: value)');
	});

	it('needs start, accepting and transitions', () => {
		const text = BASE.replace('  start: q0\n', '');
		expect(only(text)).toMatchObject({ path: 'solution.start', message: 'is required' });
	});

	it('refuses a state name with a space or a comma', () => {
		const text = BASE.replace('start: q0', 'start: "q 0"');
		expect(only(text).message).toContain('state name');
	});
});

describe('a question file that is not read as it is', () => {
	it('reports a mistake in the YAML at its line', () => {
		const { question, problems } = found(BASE.replace('alphabet: [0, 1]', 'alphabet: [0, 1'));
		expect(question).toBeUndefined();
		expect(problems.length).toBeGreaterThan(0);
		expect(problems[0]!.path).toBe('(file)');
		expect(problems[0]!.line).toBeGreaterThan(0);
	});

	it('refuses a key that is written twice', () => {
		const { problems } = found(BASE + 'week: 2\n');
		expect(problems.some((p) => /unique/i.test(p.message))).toBe(true);
	});

	it('refuses anchors and aliases, which can be used to blow a file up', () => {
		const bomb =
			'a: &a [x, x, x, x, x, x, x, x, x]\nb: &b [*a, *a, *a, *a, *a, *a, *a, *a, *a]\nc: &c [*b, *b, *b, *b, *b, *b, *b, *b, *b]\n';
		const started = performance.now();
		const { problems } = found(bomb);
		expect(performance.now() - started).toBeLessThan(500);
		expect(problems[0]!.message).toContain('anchors and aliases');
	});

	it('refuses a tag (!!binary and the like)', () => {
		const { problems } = found(BASE.replace('week: 1', 'week: !!binary 1'));
		expect(problems.length).toBeGreaterThan(0);
	});

	it('refuses a file that is not a set of fields', () => {
		expect(messages('- a\n- b\n')).toEqual([
			'(file): the file must be a set of fields (key: value)'
		]);
		expect(messages('')).toEqual(['(file): the file must be a set of fields (key: value)']);
	});

	it('refuses a file of more than 64 KB, without reading it', () => {
		const big = BASE + '#'.repeat(MAX_FILE_BYTES);
		expect(messages(big)).toEqual([`(file): the file is bigger than ${MAX_FILE_BYTES / 1024} KB`]);
	});
});
