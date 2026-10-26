import { describe, expect, it } from 'vitest';
import type { ConversionStep, EngineResult, RegexOutcome } from '../engine/types.ts';
import { regexText } from './conversion-text.ts';
import { documentFrom } from './diagram/samples.ts';
import {
	RAISED_NODES,
	regexFrameAt,
	regexNamesOf,
	regexRefusalOf,
	runFsmToRegex
} from './regex-conversion.ts';
import type { RegexEngine, RegexRun } from './regex-conversion.ts';

// q0 -a-> p, p -b-> q0; q0 starts, p accepts.
const doc = documentFrom({
	alphabet: ['a', 'b'],
	states: [
		[100, 100, 'q0'],
		[300, 100, 'p']
	],
	start: 0,
	accepting: [1],
	transitions: [
		[0, 'a', 1],
		[1, 'b', 0]
	]
});

const step = (key: string, change: ConversionStep['change'], params = {}): ConversionStep => ({
	message: { key, params },
	change
});

// What the engine says for this machine: a new start (2) and accepting (3) state, the table, a rip of 1.
const trace: ConversionStep[] = [
	step('fsm_to_regex.new_start', { kind: 'start', state: 2 }, { state: 2 }),
	step('fsm_to_regex.new_accepting', { kind: 'accepting', state: 3 }, { state: 3 }),
	step('fsm_to_regex.table', {
		kind: 'labels',
		labels: [
			{ from: 0, to: 1, expression: 'a' },
			{ from: 1, to: 0, expression: 'b' },
			{ from: 1, to: 3, expression: 'ε' },
			{ from: 2, to: 0, expression: 'ε' }
		]
	}),
	step(
		'fsm_to_regex.rip',
		{
			kind: 'rip',
			state: 1,
			updates: [
				{ from: 0, to: 0, expression: 'ab' },
				{ from: 0, to: 3, expression: 'a' }
			]
		},
		{ state: 1 }
	),
	step(
		'fsm_to_regex.result',
		{ kind: 'expression', expression: '(ab)*a' },
		{ expression: '(ab)*a' }
	)
];
const run: RegexRun = { op: 'fsm_to_regex', source: doc, regex: '(ab)*a', trace };
const names = regexNamesOf(run, 's', 'f');

describe('regexRefusalOf', () => {
	it('needs a state and a start state', () => {
		expect(regexRefusalOf(documentFrom({ states: [] }))?.key).toBe('convert.reason_empty');
		expect(regexRefusalOf(documentFrom({ states: [[0, 0]] }))?.key).toBe('convert.reason_no_start');
		expect(regexRefusalOf(doc)).toBeNull();
	});
});

describe('regexNamesOf', () => {
	it('names the new states s and f, and avoids a name that is taken', () => {
		expect(names.get(2)).toBe('s');
		expect(names.get(3)).toBe('f');
		expect(names.get(0)).toBe('q0');
		const taken = {
			...run,
			source: documentFrom({
				states: [
					[0, 0, 's'],
					[9, 9, 'f']
				]
			})
		};
		const other = regexNamesOf(taken, 's', 'f');
		expect(other.get(2)).toBe('s_2');
		expect(other.get(3)).toBe('f_2');
	});
});

describe('regexFrameAt', () => {
	it('has no table before the labels step', () => {
		expect(regexFrameAt(run, names, 0).table).toEqual([]);
		expect(regexFrameAt(run, names, 1).table).toEqual([]);
	});

	it('shows the table at the labels step, with names', () => {
		const frame = regexFrameAt(run, names, 2);
		expect(frame.table).toEqual([
			{ from: 'q0', to: 'p', expression: 'a' },
			{ from: 'p', to: 'q0', expression: 'b' },
			{ from: 'p', to: 'f', expression: 'ε' },
			{ from: 's', to: 'q0', expression: 'ε' }
		]);
		expect(frame.hot).toEqual([]);
	});

	it('removes the state at a rip, applies the updates, and marks the changed rows', () => {
		const frame = regexFrameAt(run, names, 3);
		expect(frame.table).toEqual([
			{ from: 'q0', to: 'q0', expression: 'ab' },
			{ from: 'q0', to: 'f', expression: 'a' },
			{ from: 's', to: 'q0', expression: 'ε' }
		]);
		expect(frame.hot).toEqual([0, 1]);
		expect(frame.lit).toEqual([1]);
	});

	it('does not light a new state, and clamps the index', () => {
		expect(regexFrameAt(run, names, 0).lit).toEqual([]);
		expect(regexFrameAt(run, names, 99).step.change.kind).toBe('expression');
		expect(regexFrameAt(run, names, -3).step.change.kind).toBe('start');
	});
});

describe('regexText', () => {
	it('names the state of a step and keeps the expression', () => {
		expect(regexText(names, trace[3]!)).toEqual({
			key: 'fsm_to_regex.rip',
			params: { state: 'p' }
		});
		expect(regexText(names, trace[0]!).params).toEqual({ state: 's' });
		expect(regexText(names, trace[4]!).params).toEqual({ expression: '(ab)*a' });
	});

	it('does not show a key that it does not know', () => {
		const unknown = step('fsm_to_regex.nothing', { kind: 'expression', expression: '' });
		expect(regexText(names, unknown).key).toBe('convert.failed');
	});
});

describe('runFsmToRegex', () => {
	const asked: unknown[] = [];
	const engineOf = (answer: EngineResult<RegexOutcome>): RegexEngine => ({
		fsmToRegex: async (_machine, budget) => {
			asked.push(budget);
			return answer;
		}
	});
	const finishedAnswer: EngineResult<RegexOutcome> = {
		ok: true,
		value: { result: 'finished', regex: '(ab)*a', trace }
	};

	it('finishes with the expression and the trace', async () => {
		const outcome = await runFsmToRegex(engineOf(finishedAnswer), doc);
		expect(outcome).toMatchObject({ kind: 'finished', run: { regex: '(ab)*a', source: doc } });
	});

	it('refuses a machine without a start state, without asking the engine', async () => {
		asked.length = 0;
		const none = documentFrom({ states: [[0, 0]] });
		const outcome = await runFsmToRegex(engineOf(finishedAnswer), none);
		expect(outcome).toMatchObject({ kind: 'refused', key: 'convert.reason_no_start' });
		expect(asked).toEqual([]);
	});

	it('offers the bigger budget once when the labels get too big', async () => {
		const stopped: EngineResult<RegexOutcome> = {
			ok: true,
			value: { result: 'stopped', reason: 'max_nodes', partialTrace: [] }
		};
		asked.length = 0;
		expect(await runFsmToRegex(engineOf(stopped), doc)).toEqual({
			kind: 'stopped',
			key: 'convert.stopped_nodes',
			raise: true
		});
		expect(await runFsmToRegex(engineOf(stopped), doc, true)).toMatchObject({ raise: false });
		expect(asked).toEqual([{}, { maxNodes: RAISED_NODES }]);
	});

	it('does not offer more room when the steps ran out', async () => {
		const stopped: EngineResult<RegexOutcome> = {
			ok: true,
			value: { result: 'stopped', reason: 'max_steps', partialTrace: [] }
		};
		expect(await runFsmToRegex(engineOf(stopped), doc)).toEqual({
			kind: 'stopped',
			key: 'convert.stopped_steps',
			raise: false
		});
	});

	it('says that the machine is not valid when the engine says so', async () => {
		const bad: EngineResult<RegexOutcome> = {
			ok: false,
			error: { key: 'machine.invalid_machine', params: {} }
		};
		expect(await runFsmToRegex(engineOf(bad), doc)).toMatchObject({
			kind: 'refused',
			key: 'convert.invalid_machine'
		});
	});
});
