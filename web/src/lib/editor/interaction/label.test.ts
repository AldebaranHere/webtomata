import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands.ts';
import { build } from '../diagram/testing.ts';
import { labelCommands, labelOf, parseLabel, splitNeeded, splitParts } from './label.ts';

const doc = () =>
	build({
		alphabet: ['a', 'b'],
		states: [
			[200, 200, 'q0'],
			[400, 200, 'q1']
		],
		start: 0,
		transitions: [
			[0, 'a', 1],
			[0, 'b', 1],
			[0, null, 1]
		]
	});

describe('parseLabel', () => {
	it('splits on commas and spaces and drops empty parts', () => {
		expect(parseLabel('a, b')).toEqual(['a', 'b']);
		expect(parseLabel('a b,,  c ')).toEqual(['a', 'b', 'c']);
		expect(parseLabel('  ,  ')).toEqual([]);
		expect(parseLabel('')).toEqual([]);
	});

	it('counts a symbol that is typed twice once, in the order of the first', () => {
		expect(parseLabel('b a b a')).toEqual(['b', 'a']);
	});

	it('eps and ε are the empty string (null), and only eps', () => {
		expect(parseLabel('eps, a')).toEqual([null, 'a']);
		expect(parseLabel('ε,ε')).toEqual([null]);
		expect(parseLabel('epsilon')).toEqual(['epsilon']);
	});

	it('keeps a long symbol as one symbol', () => {
		expect(parseLabel('num, id')).toEqual(['num', 'id']);
	});
});

describe('labelOf', () => {
	it('shows the symbols of an edge in the order of the alphabet, ε last, and "" for no edge', () => {
		expect(labelOf(doc(), 0, 1)).toBe('a, b, ε');
		expect(labelOf(doc(), 1, 0)).toBe('');
	});
});

describe('splitNeeded', () => {
	it('asks about a long part when every symbol of the alphabet has one character', () => {
		expect(splitNeeded(doc(), parseLabel('ab'))).toBe('ab');
		expect(splitNeeded(doc(), parseLabel('a, ab, cd'))).toBe('ab');
	});

	it('does not ask for a part that is already a symbol, for a one-character part, or for ε', () => {
		expect(splitNeeded(doc(), parseLabel('a, b, eps, c'))).toBeNull();
		const long = build({ alphabet: ['a', 'num'], states: [[200, 200, 'q0']] });
		expect(splitNeeded(long, parseLabel('num'))).toBeNull();
		expect(splitNeeded(long, parseLabel('xy'))).toBeNull(); // the alphabet already has a long symbol
	});

	it('counts a character as one, also an emoji', () => {
		expect(splitNeeded(doc(), ['😀'])).toBeNull();
		expect(splitNeeded(doc(), ['😀😀'])).toBe('😀😀');
	});
});

describe('splitParts', () => {
	it('turns every long part into its characters and keeps ε', () => {
		expect(splitParts(['ab', null, 'c', 'ba'])).toEqual(['a', 'b', null, 'c']);
		expect(splitParts(['😀😀'])).toEqual(['😀']);
	});
});

describe('labelCommands', () => {
	const run = (d: ReturnType<typeof doc>, text: string, from = 0, to = 1) => {
		const commands = labelCommands(d, from, to, parseLabel(text));
		const result = applyCommand(d, { type: 'batch', commands });
		if (!result.ok) throw new Error(result.error.key);
		return { commands, doc: result.doc };
	};

	it('adds new symbols to the alphabet and a transition for each new symbol', () => {
		const empty = build({
			alphabet: ['a'],
			states: [
				[200, 200, 'q0'],
				[400, 200, 'q1']
			]
		});
		const { commands, doc: after } = run(empty, 'a, c');
		expect(commands).toEqual([
			{ type: 'addSymbol', symbol: 'c' },
			{ type: 'addTransition', from: 0, on: 'a', to: 1 },
			{ type: 'addTransition', from: 0, on: 'c', to: 1 }
		]);
		expect(after.alphabet).toEqual(['a', 'c']);
		expect(labelOf(after, 0, 1)).toBe('a, c');
	});

	it('removes the symbols that are gone, and changes nothing that stays', () => {
		const { commands, doc: after } = run(doc(), 'a');
		expect(commands).toEqual([
			{ type: 'removeTransition', from: 0, on: null, to: 1 },
			{ type: 'removeTransition', from: 0, on: 'b', to: 1 }
		]);
		expect(labelOf(after, 0, 1)).toBe('a');
	});

	it('an empty text removes the edge', () => {
		const { doc: after } = run(doc(), '');
		expect(labelOf(after, 0, 1)).toBe('');
	});

	it('ε is a transition on null and never a symbol of the alphabet', () => {
		const empty = build({
			alphabet: ['a'],
			states: [
				[200, 200, 'q0'],
				[400, 200, 'q1']
			]
		});
		const { commands } = run(empty, 'eps');
		expect(commands).toEqual([{ type: 'addTransition', from: 0, on: null, to: 1 }]);
	});

	it('does not touch other edges', () => {
		const { doc: after } = run(doc(), 'a', 1, 1);
		expect(labelOf(after, 0, 1)).toBe('a, b, ε');
		expect(labelOf(after, 1, 1)).toBe('a');
	});
});
