import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadQuestions, loadSummaries, pageOf, summaryOf } from './summaries.ts';
import { createSchemaValidator } from './load.ts';

const schema = JSON.parse(
	readFileSync(new URL('../../../../content/questions/schema.json', import.meta.url), 'utf8')
);
const validate = createSchemaValidator(schema);
const template = readFileSync(
	new URL('../../../../content/questions/_template.yaml', import.meta.url),
	'utf8'
);
/** A good question file with another id. */
const file = (id: string, week = 1) =>
	template.replace('id: nama-soal', `id: ${id}`).replace('week: 1', `week: ${week}`);

describe('loadSummaries', () => {
	it('reads the files that are questions, with only what the list needs', () => {
		const result = loadSummaries(
			{ '/q/ends-with-1.yaml': file('ends-with-1'), '/q/other.yaml': file('other', 3) },
			validate
		);
		expect(result.map((r) => r.id)).toEqual(['ends-with-1', 'other']);
		expect(result[0]).toEqual({
			id: 'ends-with-1',
			title: { id: 'Berakhiran 1', en: 'Ends with 1' },
			type: 'build-dfsm',
			difficulty: 1,
			week: 1,
			pattern: 'berakhiran-x'
		});
		expect(result[1]!.week).toBe(3);
		// The statement and the solution do not go to the list.
		expect(Object.keys(result[0]!).sort()).toEqual(
			['difficulty', 'id', 'pattern', 'title', 'type', 'week'].sort()
		);
	});

	it('skips a file whose name starts with an underscore (a template)', () => {
		expect(loadSummaries({ '/q/_template.yaml': template }, validate)).toEqual([]);
	});

	it('refuses a file that does not follow the schema, and names the file, the field and the line', () => {
		const broken = file('x').replace('difficulty: 1', 'difficulty: 9');
		expect(() => loadSummaries({ '/q/x.yaml': broken }, validate)).toThrowError(
			/x\.yaml.*difficulty/s
		);
	});

	it('refuses an id that is not the name of the file', () => {
		expect(() => loadSummaries({ '/q/one.yaml': file('two') }, validate)).toThrowError(
			/the id "two" must be the name of the file \(one\)/
		);
	});

	it('refuses two files with the same id, which cannot happen with the rule above, even by .yml and .yaml', () => {
		expect(() =>
			loadSummaries({ '/q/same.yaml': file('same'), '/other/same.yml': file('same') }, validate)
		).toThrowError(/same/);
	});

	it('reports every broken file in one error, not only the first', () => {
		const a = file('a').replace('week: 1', 'week: 99');
		const b = file('b').replace('difficulty: 1', 'difficulty: 0');
		let message = '';
		try {
			loadSummaries({ '/q/a.yaml': a, '/q/b.yaml': b }, validate);
		} catch (error) {
			message = (error as Error).message;
		}
		expect(message).toContain('a.yaml');
		expect(message).toContain('b.yaml');
	});

	it('is in the same order for the same files, whatever the order of the keys', () => {
		const files = { '/q/b.yaml': file('b'), '/q/a.yaml': file('a') };
		const reverse = { '/q/a.yaml': file('a'), '/q/b.yaml': file('b') };
		expect(loadSummaries(files, validate)).toEqual(loadSummaries(reverse, validate));
	});
});

describe('summaryOf', () => {
	it('copies the six fields of the list', () => {
		const parsed = {
			id: 'q',
			title: { id: 'T', en: 'T' },
			type: 'write-regex',
			difficulty: 2,
			week: 4,
			pattern: 'p',
			statement: { id: 'x' },
			solution: '(0∪1)*'
		};
		expect(summaryOf(parsed as never)).toEqual({
			id: 'q',
			title: { id: 'T', en: 'T' },
			type: 'write-regex',
			difficulty: 2,
			week: 4,
			pattern: 'p'
		});
	});
});

describe('loadQuestions and pageOf', () => {
	it('gives the whole questions, in the order of the file names, with the same checks', () => {
		const questions = loadQuestions(
			{ '/q/b.yaml': file('b'), '/q/a.yaml': file('a'), '/q/_template.yaml': template },
			validate
		);
		expect(questions.map((q) => q.id)).toEqual(['a', 'b']);
		expect(() => loadQuestions({ '/q/x.yaml': file('y') }, validate)).toThrowError(
			/must be the name/
		);
	});

	it('gives a page only what the page of a question shows: not the solution or the examples', () => {
		const [question] = loadQuestions({ '/q/x.yaml': file('x') }, validate);
		const page = pageOf(question!, { n: 2, total: 3 });
		expect(Object.keys(page).sort()).toEqual(
			[
				'alphabet',
				'constraints',
				'difficulty',
				'hints',
				'id',
				'pattern',
				'position',
				'references',
				'statement',
				'title',
				'type',
				'week'
			].sort()
		);
		expect(page.position).toEqual({ n: 2, total: 3 });
		expect(page.statement.id).toContain('Σ = {0, 1}');
		expect(JSON.stringify(page)).not.toContain('q0 0 q0');
		expect(JSON.stringify(page)).not.toContain('examples');
		expect(page.hints?.[0]?.id).toContain('Cukup ingat');
	});
});
