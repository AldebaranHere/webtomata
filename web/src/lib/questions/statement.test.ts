import { describe, expect, it } from 'vitest';
import { chipsOf, paragraphsOf } from './statement.ts';
import type { Question } from './types.ts';

describe('paragraphsOf', () => {
	it('splits at a blank line', () => {
		expect(paragraphsOf('Satu.\n\nDua.')).toEqual([
			[{ kind: 'text', text: 'Satu.' }],
			[{ kind: 'text', text: 'Dua.' }]
		]);
	});

	it('makes `backticks` code, and keeps the rest as text', () => {
		expect(paragraphsOf('Alfabet `Σ = {0, 1}` dan string `10`.')).toEqual([
			[
				{ kind: 'text', text: 'Alfabet ' },
				{ kind: 'code', text: 'Σ = {0, 1}' },
				{ kind: 'text', text: ' dan string ' },
				{ kind: 'code', text: '10' },
				{ kind: 'text', text: '.' }
			]
		]);
	});

	it('does not read HTML: angle brackets stay text', () => {
		const [paragraph] = paragraphsOf('<script>alert(1)</script> `<b>`');
		expect(paragraph).toEqual([
			{ kind: 'text', text: '<script>alert(1)</script> ' },
			{ kind: 'code', text: '<b>' }
		]);
	});

	it('keeps a backtick that has no pair as text', () => {
		expect(paragraphsOf('a ` b')).toEqual([[{ kind: 'text', text: 'a ` b' }]]);
		expect(paragraphsOf('`a` `b')).toEqual([
			[
				{ kind: 'code', text: 'a' },
				{ kind: 'text', text: ' `b' }
			]
		]);
	});

	it('takes more than one blank line, trailing spaces and Windows line ends as one break', () => {
		expect(paragraphsOf('A\r\n\r\n\r\n   \r\nB  \n')).toEqual([
			[{ kind: 'text', text: 'A' }],
			[{ kind: 'text', text: 'B' }]
		]);
	});

	it('joins the lines of one paragraph with a space', () => {
		expect(paragraphsOf('Satu\ndua')).toEqual([[{ kind: 'text', text: 'Satu dua' }]]);
	});

	it('is empty for an empty text', () => {
		expect(paragraphsOf('')).toEqual([]);
		expect(paragraphsOf('  \n\n ')).toEqual([]);
	});

	it('leaves an empty pair of backticks as text', () => {
		expect(paragraphsOf('a `` b')).toEqual([[{ kind: 'text', text: 'a `` b' }]]);
	});
});

const base: Pick<Question, 'type' | 'constraints' | 'references'> = { type: 'build-dfsm' };

describe('chipsOf', () => {
	it('names the type of the answer', () => {
		expect(chipsOf({ ...base }).map((c) => c.key)).toEqual(['soal.chip.dfsm']);
		expect(chipsOf({ type: 'build-ndfsm' }).map((c) => c.key)).toEqual(['soal.chip.ndfsm']);
		expect(chipsOf({ type: 'write-regex' }).map((c) => c.key)).toEqual(['soal.chip.regex']);
	});

	it('adds the constraints that the question has', () => {
		expect(chipsOf({ ...base, constraints: { maxStates: 4, minimal: true } })).toEqual([
			{ key: 'soal.chip.dfsm', params: {} },
			{ key: 'soal.chip.max_states', params: { count: 4 } },
			{ key: 'soal.chip.minimal', params: {} }
		]);
		expect(chipsOf({ type: 'build-ndfsm', constraints: { allowEpsilon: false } })).toEqual([
			{ key: 'soal.chip.ndfsm', params: {} },
			{ key: 'soal.chip.no_epsilon', params: {} }
		]);
	});

	it('says nothing about a constraint that is at its default', () => {
		expect(chipsOf({ ...base, constraints: { complete: true, minimal: false } })).toHaveLength(1);
		expect(chipsOf({ type: 'build-ndfsm', constraints: { allowEpsilon: true } })).toHaveLength(1);
		expect(chipsOf({ ...base, constraints: { complete: false } }).map((c) => c.key)).toEqual([
			'soal.chip.dfsm',
			'soal.chip.incomplete'
		]);
	});

	it('writes the textbook sections as one chip', () => {
		const chips = chipsOf({ ...base, references: { rich: ['5.2', '5.3'], sipser: ['1.1'] } });
		expect(chips.at(-1)).toEqual({
			key: 'soal.chip.references',
			params: { text: 'Rich 5.2, 5.3 · Sipser 1.1' }
		});
		expect(chipsOf({ ...base, references: { sipser: ['1.2'] } }).at(-1)!.params).toEqual({
			text: 'Sipser 1.2'
		});
		expect(chipsOf({ ...base, references: {} })).toHaveLength(1);
		expect(chipsOf({ ...base, references: { rich: [] } })).toHaveLength(1);
	});
});
