import { describe, expect, it } from 'vitest';
import type { Compiled, ConversionStep, EngineResult, Machine } from '../engine/types.ts';
import { compileText } from './conversion-text.ts';
import {
	alphabetOf,
	compileFrameAt,
	compileResult,
	insertAt,
	runRegexToFsm,
	textRefusal
} from './regex-compile.ts';
import type { CompileEngine, CompileRun } from './regex-compile.ts';

describe('alphabetOf', () => {
	it('takes each character that is not an operator or a space, once, in order', () => {
		expect(alphabetOf('(a∪b)*abb')).toEqual(['a', 'b']);
		expect(alphabetOf('b a  ∪ a+')).toEqual(['a', 'b']);
		expect(alphabetOf('ε∪∅')).toEqual([]);
		expect(alphabetOf('1∪0')).toEqual(['0', '1']);
	});

	it('keeps a character outside the first plane as one symbol', () => {
		expect(alphabetOf('😀a')).toEqual(['a', '😀']);
	});
});

describe('textRefusal', () => {
	it('refuses an empty text and a text that is too long, and nothing else', () => {
		expect(textRefusal('   ')?.key).toBe('regex.empty');
		expect(textRefusal('a'.repeat(1001))).toMatchObject({
			key: 'regex.too_long',
			params: { limit: 1000 }
		});
		expect(textRefusal('a'.repeat(1000))).toBeNull();
		expect(textRefusal('(a')).toBeNull();
	});
});

// The engine's steps for "ab": the fragments of a, b, and the concatenation (it makes no state).
const fsm: Machine = {
	schemaVersion: 1,
	kind: 'ndfsm',
	alphabet: ['a', 'b'],
	states: [0, 1, 2, 3],
	start: 0,
	accepting: [3],
	transitions: [
		{ from: 0, on: 'a', to: 1 },
		{ from: 2, on: 'b', to: 3 },
		{ from: 1, on: null, to: 2 }
	]
};
const fragment = (
	key: string,
	expression: string,
	change: {
		start: number;
		accepting: number[];
		states: number[];
		transitions: Machine['transitions'];
	},
	params = {}
): ConversionStep => ({
	message: { key, params: { expression, ...params } },
	change: {
		kind: 'fragment',
		expression,
		start: change.start,
		accepting: change.accepting,
		states: change.states,
		transitions: change.transitions.map((t) => ({
			from: t.from,
			on: t.on === null ? null : fsm.alphabet.indexOf(t.on),
			to: t.to
		}))
	}
});
const trace: ConversionStep[] = [
	fragment(
		'regex.symbol',
		'a',
		{ start: 0, accepting: [1], states: [0, 1], transitions: [{ from: 0, on: 'a', to: 1 }] },
		{ symbol: 'a' }
	),
	fragment(
		'regex.symbol',
		'b',
		{ start: 2, accepting: [3], states: [2, 3], transitions: [{ from: 2, on: 'b', to: 3 }] },
		{ symbol: 'b' }
	),
	fragment('regex.concat', 'ab', {
		start: 0,
		accepting: [3],
		states: [],
		transitions: [{ from: 1, on: null, to: 2 }]
	})
];
const run: CompileRun = { text: 'ab', alphabet: ['a', 'b'], final: fsm, trace, places: null };

describe('compileFrameAt', () => {
	it('builds the machine part by part', () => {
		const first = compileFrameAt(run, 0);
		expect(first.machine.states).toEqual([0, 1]);
		expect(first.machine.transitions).toEqual([{ from: 0, on: 'a', to: 1 }]);
		expect(first.lit).toEqual([0, 1]);
		const second = compileFrameAt(run, 1);
		expect(second.machine.states).toEqual([0, 1, 2, 3]);
		// The start and the accepting states are those of the part of this step.
		expect(second.machine.start).toBe(2);
		expect(second.machine.accepting).toEqual([3]);
	});

	it('lights the states that a concatenation joins, though it makes none', () => {
		const frame = compileFrameAt(run, 2);
		expect(frame.lit).toEqual([1, 2]);
		expect(frame.machine.transitions).toContainEqual({ from: 1, on: null, to: 2 });
	});

	it('ends at the machine of the engine, and clamps the index', () => {
		const last = compileFrameAt(run, 99).machine;
		expect({ ...last, transitions: [...last.transitions].sort((a, b) => a.from - b.from) }).toEqual(
			{
				...fsm,
				transitions: [...fsm.transitions].sort((a, b) => a.from - b.from)
			}
		);
		expect(compileFrameAt(run, -4).step).toBe(trace[0]);
	});

	it('draws the states in the places of the result', () => {
		const placed = {
			...run,
			places: [
				{ id: 0, x: 10, y: 20 },
				{ id: 1, x: 30, y: 40 },
				{ id: 2, x: 50, y: 60 },
				{ id: 3, x: 70, y: 80 }
			]
		};
		const doc = compileFrameAt(placed, 0).doc;
		expect(doc.states.map((s) => [s.name, s.x, s.y])).toEqual([
			['q0', 10, 20],
			['q1', 30, 40]
		]);
	});
});

describe('compileResult and compileText', () => {
	it('makes the document of the finished machine, named q0, q1, ...', () => {
		const doc = compileResult(run, 'ab');
		expect(doc.title).toBe('ab');
		expect(doc.states.map((s) => s.name)).toEqual(['q0', 'q1', 'q2', 'q3']);
		expect(doc.kind).toBe('ndfsm');
	});

	it('names the states of a part in the sentence', () => {
		expect(compileText(trace[0]!)).toEqual({
			key: 'regex.symbol',
			params: { expression: 'a', symbol: 'a', states: 'q0, q1', start: 'q0' }
		});
		expect(compileText(trace[2]!).key).toBe('regex.concat');
		const unknown = { ...trace[0]!, message: { key: 'regex.nothing', params: {} } };
		expect(compileText(unknown).key).toBe('convert.failed');
	});
});

describe('runRegexToFsm', () => {
	const asked: [string, string[]][] = [];
	const engineOf = (answer: EngineResult<Compiled>): CompileEngine => ({
		regexToFsm: async (text, alphabet) => {
			asked.push([text, alphabet]);
			return answer;
		}
	});
	const ok: EngineResult<Compiled> = { ok: true, value: { result: 'finished', fsm, trace } };

	it('sends the text with the alphabet that it has, and lays out the machine once', async () => {
		asked.length = 0;
		let layouts = 0;
		const outcome = await runRegexToFsm(engineOf(ok), 'ab', async (draft) => {
			layouts += 1;
			return draft.states.map((s, i) => ({ id: s.id, x: i * 10, y: 0 }));
		});
		expect(asked).toEqual([['ab', ['a', 'b']]]);
		expect(layouts).toBe(1);
		expect(outcome).toMatchObject({ kind: 'finished', run: { text: 'ab' } });
		if (outcome.kind === 'finished') expect(outcome.run.places).toHaveLength(4);
	});

	it('does not call the engine for an empty text', async () => {
		asked.length = 0;
		expect(await runRegexToFsm(engineOf(ok), '  ')).toMatchObject({
			kind: 'refused',
			key: 'regex.empty'
		});
		expect(asked).toEqual([]);
	});

	it('counts the position of a parse error from 1, except at the end', async () => {
		const error = (key: string, position: number): EngineResult<Compiled> => ({
			ok: false,
			error: { key, params: { position, found: ')' } }
		});
		expect(await runRegexToFsm(engineOf(error('regex.unexpected', 2)), 'a∪)')).toEqual({
			kind: 'refused',
			key: 'regex.unexpected',
			params: { position: 3, found: ')' }
		});
		expect(await runRegexToFsm(engineOf(error('regex.unexpected_end', 3)), 'a∪')).toMatchObject({
			params: { position: 3 }
		});
	});

	it('says a calm sentence for an error that it does not know, and for a stop', async () => {
		const other: EngineResult<Compiled> = {
			ok: false,
			error: { key: 'api.invalid_alphabet', params: {} }
		};
		expect(await runRegexToFsm(engineOf(other), 'a')).toMatchObject({
			kind: 'refused',
			key: 'convert.failed'
		});
		const stopped: EngineResult<Compiled> = {
			ok: true,
			value: { result: 'stopped', reason: 'max_states', partialTrace: [] }
		};
		expect(await runRegexToFsm(engineOf(stopped), 'a')).toEqual({
			kind: 'stopped',
			key: 'convert.stopped_states'
		});
	});
});

describe('insertAt', () => {
	it('puts the piece at the caret, or in place of the selection, and moves the caret after it', () => {
		expect(insertAt('ab', 1, 1, '∪')).toEqual({ text: 'a∪b', caret: 2 });
		expect(insertAt('abc', 1, 2, 'ε')).toEqual({ text: 'aεc', caret: 2 });
		expect(insertAt('', 0, 0, '(')).toEqual({ text: '(', caret: 1 });
	});

	it('takes a selection that was made backwards, and positions outside the text', () => {
		expect(insertAt('abc', 2, 1, '*')).toEqual({ text: 'a*c', caret: 2 });
		expect(insertAt('ab', 9, 9, '+')).toEqual({ text: 'ab+', caret: 3 });
		expect(insertAt('ab', -3, -1, '+')).toEqual({ text: '+ab', caret: 1 });
	});
});
