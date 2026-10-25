import { describe, expect, it } from 'vitest';
import { checkDocument } from '../editor/document.ts';
import { TEST_LIMITS } from '../editor/test-list.ts';
import { EXAMPLES, buildExample, parseExample } from './examples.ts';

const good = {
	schemaVersion: 1,
	id: 'dua-state',
	order: 9,
	title: { id: 'Dua', en: 'Two' },
	description: { id: 'Dua state.', en: 'Two states.' },
	kind: 'dfsm',
	alphabet: ['a'],
	states: [
		{ name: 'q0', x: 100, y: 100 },
		{ name: 'q1', x: 300, y: 100 }
	],
	start: 'q0',
	accepting: ['q1'],
	transitions: [
		{ from: 'q0', on: 'a', to: 'q1' },
		{ from: 'q1', on: 'a', to: 'q1' }
	],
	accept: ['a'],
	reject: ['']
};

describe('an example file', () => {
	it('is read', () => {
		expect(parseExample(good)).toEqual({ ok: true, value: good });
	});

	it('is refused, with the place, when a field is wrong', () => {
		const refused = (patch: object) => {
			const result = parseExample({ ...good, ...patch });
			expect(result.ok).toBe(false);
			return result.ok ? '' : result.error;
		};
		expect(refused({ schemaVersion: 2 })).toContain('schemaVersion');
		expect(refused({ id: 'Not A Slug' })).toContain('id');
		expect(refused({ title: { id: 'Dua' } })).toContain('title');
		expect(refused({ description: { id: 'x', en: 3 } })).toContain('description');
		expect(refused({ kind: 'pda' })).toContain('kind');
		expect(refused({ alphabet: 'ab' })).toContain('alphabet');
		expect(refused({ states: [] })).toContain('states');
		expect(refused({ start: 'zzz' })).toContain('start');
		expect(refused({ accepting: ['zzz'] })).toContain('accepting');
		expect(refused({ transitions: [{ from: 'q0', on: 'b', to: 'q1' }] })).toContain('transitions');
		expect(refused({ transitions: [{ from: 'q0', on: 'a' }] })).toContain('transitions');
		expect(refused({ accept: [] })).toContain('accept');
		expect(refused({ reject: [1] })).toContain('reject');
		expect(refused({ order: 'first' })).toContain('order');
	});

	it('is refused when it is not an object, or has a field that we do not know', () => {
		expect(parseExample(null).ok).toBe(false);
		expect(parseExample([]).ok).toBe(false);
		expect(parseExample({ ...good, extra: true }).ok).toBe(false);
	});
});

describe('building an example', () => {
	it('gives the document with the title of the language, and the titles of both', () => {
		const parsed = parseExample(good);
		if (!parsed.ok) throw new Error(parsed.error);
		const english = buildExample(parsed.value, 'en');
		expect(english.doc.title).toBe('Two');
		expect(english.titles).toEqual({ id: 'Dua', en: 'Two' });
		expect(buildExample(parsed.value, 'id').doc.title).toBe('Dua');
		expect(english.doc.states.map((s) => s.name)).toEqual(['q0', 'q1']);
		expect(english.doc.start).toBe(0);
		expect(english.doc.accepting).toEqual([1]);
		expect(checkDocument(english.doc)).toEqual([]);
	});

	it('gives the test strings: the two lists taken in turn, the accepted one first', () => {
		const parsed = parseExample({
			...good,
			accept: ['a', 'aa', 'aaa'],
			reject: ['', 'b']
		});
		if (!parsed.ok) throw new Error(parsed.error);
		expect(buildExample(parsed.value, 'id').tests).toEqual(['a', '', 'aa', 'b', 'aaa']);
	});

	it('never gives more test strings than the list can hold, and no repeat', () => {
		const many = Array.from({ length: 80 }, (_, i) => 'a'.repeat(i + 1));
		const parsed = parseExample({ ...good, accept: many, reject: [''] });
		if (!parsed.ok) throw new Error(parsed.error);
		const { tests } = buildExample(parsed.value, 'id');
		expect(tests.length).toBeLessThanOrEqual(TEST_LIMITS.count);
		expect(new Set(tests).size).toBe(tests.length);
	});
});

describe('the examples that we ship', () => {
	it('are there, in order, with an id that is their file name', () => {
		expect(EXAMPLES.map((e) => e.id)).toEqual([
			'berakhiran-01',
			'jumlah-a-genap',
			'pilihan-epsilon'
		]);
	});

	it('every one builds a document that follows every rule, in both languages', () => {
		for (const example of EXAMPLES) {
			for (const locale of ['id', 'en'] as const) {
				const { doc } = buildExample(example, locale);
				expect(checkDocument(doc), `${example.id} ${locale}`).toEqual([]);
				expect(doc.kind).toBe(example.kind);
			}
		}
	});

	it('the first one is the machine that the sandbox used to open on the first visit', () => {
		const first = buildExample(EXAMPLES[0]!, 'id').doc;
		expect(first.title).toBe('Berakhiran 01');
		expect(first.states.map((s) => s.name)).toEqual(['q0', 'q1', 'q2']);
	});
});
