import { describe, expect, it } from 'vitest';
import { documentFrom } from './diagram/samples.ts';
import { message } from './document.ts';
import type { Compiled, EngineResult, EquivalenceReport, Machine } from '../engine/types.ts';
import { runCompare, wrongString } from './compare.ts';
import type { CompareEngine } from './compare.ts';

const machine = documentFrom({
	alphabet: ['a', 'b'],
	states: [
		[0, 0],
		[100, 0]
	],
	start: 0,
	accepting: [1],
	transitions: [
		[0, 'a', 1],
		[0, 'b', 0],
		[1, 'a', 1],
		[1, 'b', 0]
	]
});

const compiled: Machine = {
	schemaVersion: 1,
	kind: 'ndfsm',
	alphabet: ['a', 'b'],
	states: [0],
	start: 0,
	accepting: [0],
	transitions: []
};

/** The engine for the page: answers with what the test gives, and remembers what it was asked. */
function engineWith(options: {
	compile?: EngineResult<Compiled>;
	report?: EngineResult<EquivalenceReport>;
}) {
	const asked: { alphabet?: string[]; candidate?: Machine; reference?: Machine } = {};
	const engine: CompareEngine = {
		regexToFsm: async (_text, alphabet) => {
			asked.alphabet = alphabet;
			return (
				options.compile ?? { ok: true, value: { result: 'finished', fsm: compiled, trace: [] } }
			);
		},
		equivalent: async (candidate, reference) => {
			asked.candidate = candidate;
			asked.reference = reference;
			return (
				options.report ?? {
					ok: true,
					value: {
						equivalence: { result: 'equivalent', pairs: 3 },
						witness: null,
						acceptedButShouldReject: [],
						rejectedButShouldAccept: []
					}
				}
			);
		}
	};
	return { engine, asked };
}

const different = (
	over: Partial<EquivalenceReport>,
	candidateAccepts = false
): EngineResult<EquivalenceReport> => ({
	ok: true,
	value: {
		equivalence: {
			result: 'different',
			witness: { string: [], candidateAccepts },
			acceptedButShouldReject: [],
			rejectedButShouldAccept: [],
			listsTruncated: false,
			trace: []
		},
		witness: [],
		acceptedButShouldReject: [],
		rejectedButShouldAccept: [],
		...over
	}
});

describe('wrongString', () => {
	it('writes a string of one-character symbols without a space, and ε for the empty string', () => {
		expect(wrongString(['a', 'b'], ['a', 'b'])).toEqual({ text: 'ab', input: 'ab' });
		expect(wrongString(['a', 'b'], [])).toEqual({ text: 'ε', input: '' });
	});

	it('separates symbols of several characters, as the engine reads them', () => {
		expect(wrongString(['num', 'plus'], ['num', 'plus', 'num'])).toEqual({
			text: 'num plus num',
			input: 'num plus num'
		});
	});
});

describe('runCompare', () => {
	it('is equivalent when the engine says so, with no lists', async () => {
		const { engine } = engineWith({});
		const outcome = await runCompare(engine, machine, '(a∪b)*a');
		expect(outcome).toMatchObject({ kind: 'finished', run: { verdict: 'equivalent' } });
		if (outcome.kind !== 'finished') return;
		expect(outcome.run.witness).toBeNull();
		expect(outcome.run.accepted).toEqual([]);
		expect(outcome.run.rejected).toEqual([]);
	});

	it('compiles the expression over the alphabet of the machine, and the machine is the candidate', async () => {
		const { engine, asked } = engineWith({});
		await runCompare(engine, machine, '(a∪b)*a');
		expect(asked.alphabet).toEqual(['a', 'b']);
		expect(asked.candidate?.start).toBe(0);
		expect(asked.candidate?.accepting).toEqual([1]);
		expect(asked.reference).toEqual(compiled);
	});

	it('gives the witness, and the two lists with the right names', async () => {
		const { engine } = engineWith({
			report: different({
				witness: ['a'],
				acceptedButShouldReject: [['a', 'b'], []],
				rejectedButShouldAccept: [['a'], ['b', 'b']]
			})
		});
		const outcome = await runCompare(engine, machine, 'a*');
		expect(outcome.kind).toBe('finished');
		if (outcome.kind !== 'finished') return;
		const { run } = outcome;
		expect(run.verdict).toBe('different');
		expect(run.witness).toEqual({ text: 'a', input: 'a' });
		expect(run.accepted.map((w) => w.text)).toEqual(['ab', 'ε']);
		expect(run.rejected.map((w) => w.text)).toEqual(['a', 'bb']);
		expect(run.source).toBe(machine);
		expect(run.text).toBe('a*');
	});

	it('says when the lists were cut', async () => {
		const report = different({});
		if (report.ok && report.value.equivalence.result === 'different') {
			report.value.equivalence.listsTruncated = true;
		}
		const { engine } = engineWith({ report });
		const outcome = await runCompare(engine, machine, 'a*');
		expect(outcome.kind === 'finished' && outcome.run.truncated).toBe(true);
	});

	it('refuses a symbol of the expression that is not in the alphabet, and names it, without calling the engine', async () => {
		const { engine, asked } = engineWith({});
		const outcome = await runCompare(engine, machine, '(a∪c)*d');
		expect(outcome).toEqual({
			kind: 'refused',
			key: 'compare.symbol_missing',
			params: { symbols: 'c, d' }
		});
		expect(asked.alphabet).toBeUndefined();
	});

	it('refuses a machine with no start state, and an empty expression', async () => {
		const { engine } = engineWith({});
		const noStart = documentFrom({ alphabet: ['a'], states: [[0, 0]] });
		expect(await runCompare(engine, noStart, 'a')).toMatchObject({
			kind: 'refused',
			key: 'convert.reason_no_start'
		});
		expect(await runCompare(engine, machine, '   ')).toMatchObject({
			kind: 'refused',
			key: 'regex.empty'
		});
	});

	it('passes on a mistake in the expression with its position counted from 1', async () => {
		const { engine } = engineWith({
			compile: { ok: false, error: message('regex.unbalanced_parenthesis', { position: 0 }) }
		});
		const outcome = await runCompare(engine, machine, '(a');
		expect(outcome).toEqual({
			kind: 'refused',
			key: 'regex.unbalanced_parenthesis',
			params: { position: 1 }
		});
	});

	it('is a calm "cannot run" for any other error of the engine', async () => {
		const { engine } = engineWith({
			report: { ok: false, error: message('equivalent.alphabet_mismatch') }
		});
		expect(await runCompare(engine, machine, 'a')).toMatchObject({
			kind: 'refused',
			key: 'convert.failed'
		});
	});

	it('stops when the engine stops, at the step of the expression or of the comparison', async () => {
		const compileStop = engineWith({
			compile: {
				ok: true,
				value: { result: 'stopped', reason: 'max_states', partialTrace: [] }
			}
		});
		expect(await runCompare(compileStop.engine, machine, 'a')).toEqual({
			kind: 'stopped',
			key: 'convert.stopped_states'
		});
		const compareStop = engineWith({
			report: {
				ok: true,
				value: {
					equivalence: { result: 'stopped', reason: 'max_steps' },
					witness: null,
					acceptedButShouldReject: [],
					rejectedButShouldAccept: []
				}
			}
		});
		expect(await runCompare(compareStop.engine, machine, 'a')).toEqual({
			kind: 'stopped',
			key: 'convert.stopped_steps'
		});
	});
});
