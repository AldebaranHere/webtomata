// The whole path in the worker, with the real WASM module: typed call → text → WASM → JSON.
// It needs the WASM package (`pnpm build:wasm`), and is the only test that imports it.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import init, * as wasm from './wasm/engine_wasm.js';
import { createHandlers, run } from './handlers.ts';
import type { Handlers } from './handlers.ts';
import type { Machine } from './types.ts';

const even: Machine = {
	schemaVersion: 1,
	kind: 'dfsm',
	alphabet: ['a', 'b'],
	states: [0, 1],
	start: 0,
	accepting: [0],
	transitions: [
		{ from: 0, on: 'a', to: 1 },
		{ from: 0, on: 'b', to: 1 },
		{ from: 1, on: 'a', to: 0 },
		{ from: 1, on: 'b', to: 0 }
	]
};
const aStar: Machine = {
	...even,
	transitions: [
		{ from: 0, on: 'a', to: 0 },
		{ from: 0, on: 'b', to: 1 },
		{ from: 1, on: 'a', to: 1 },
		{ from: 1, on: 'b', to: 1 }
	]
};

let handlers: Handlers;

beforeAll(async () => {
	const bytes = readFileSync(new URL('./wasm/engine_wasm_bg.wasm', import.meta.url));
	await init({ module_or_path: bytes });
	handlers = createHandlers(wasm);
});

const call = (method: string, ...args: unknown[]) => run(handlers, method, args);

describe('every method reaches the engine', () => {
	it('answers the version', () => {
		expect(call('version')).toEqual({ ok: true, value: expect.stringMatching(/^\d+\.\d+\.\d+/) });
	});

	it('loads, validates and checks a machine', () => {
		expect(call('loadMachine', JSON.stringify(even))).toEqual({ ok: true, value: even });
		expect(call('validate', even)).toEqual({ ok: true, value: [] });
		expect(call('nondeterministicStates', even)).toEqual({ ok: true, value: [] });
		const partial = { ...even, transitions: [{ from: 0, on: 'a', to: 1 }] };
		expect(call('addTrapState', partial)).toMatchObject({
			ok: true,
			value: { fsm: { states: [0, 1, 2] } }
		});
	});

	it('simulates, with the input as names and a budget', () => {
		expect(call('simulate', even, 'ab')).toMatchObject({
			ok: true,
			value: { input: ['a', 'b'], simulation: { result: 'finished', accepted: true } }
		});
		expect(call('simulate', even, 'abab', { maxSteps: 2 })).toMatchObject({
			value: { simulation: { result: 'stopped', reason: 'max_steps' } }
		});
		expect(call('simulate', even, 'abc')).toMatchObject({
			ok: false,
			error: { key: 'input.unknown_symbol' }
		});
	});

	it('simulates many strings in one call, one outcome for each', () => {
		const answer = call('simulateMany', even, ['', 'ab', 'a', 'abc', 'abab'], { maxSteps: 2 });
		expect(answer).toMatchObject({ ok: true });
		expect((answer as { value: unknown }).value).toEqual([
			{ input: '', result: 'accepted' },
			{ input: 'ab', result: 'accepted' },
			{ input: 'a', result: 'rejected' },
			{
				input: 'abc',
				result: 'refused',
				error: { key: 'input.unknown_symbol', params: { symbol: 'c', position: 2 } }
			},
			{ input: 'abab', result: 'stopped', reason: 'max_steps' }
		]);
	});

	it('says for each string when the machine has no start state', () => {
		const answer = call('simulateMany', { ...even, start: null }, ['a', 'b']);
		expect((answer as { value: { result: string; error: { key: string } }[] }).value).toMatchObject(
			[
				{ result: 'refused', error: { key: 'sim.no_start_state' } },
				{ result: 'refused', error: { key: 'sim.no_start_state' } }
			]
		);
	});

	it('gives an empty list for no strings', () => {
		expect(call('simulateMany', even, [])).toEqual({ ok: true, value: [] });
	});

	it('fails as a whole when the budget is not a budget', () => {
		expect(call('simulateMany', even, ['a'], { nonsense: 1 })).toMatchObject({ ok: false });
	});

	it('converts and compares', () => {
		expect(call('determinize', even)).toMatchObject({ ok: true, value: { result: 'finished' } });
		expect(call('minimize', even)).toMatchObject({ ok: true, value: { result: 'finished' } });
		expect(call('equivalent', even, aStar)).toMatchObject({
			ok: true,
			value: { equivalence: { result: 'different' }, witness: ['a'] }
		});
		expect(call('equivalent', even, even)).toMatchObject({
			value: { equivalence: { result: 'equivalent' }, witness: null }
		});
	});

	it('works with regular expressions', () => {
		expect(call('regexToFsm', 'a*b', ['a', 'b'])).toMatchObject({
			ok: true,
			value: { result: 'finished' }
		});
		expect(call('fsmToRegex', even)).toMatchObject({ ok: true, value: { result: 'finished' } });
		expect(call('simplify', 'a*∪aa', ['a', 'b'])).toMatchObject({
			ok: true,
			value: { result: 'finished', regex: 'a*' }
		});
		expect(call('simplifyViaMachine', 'a*∪aa', ['a', 'b'])).toMatchObject({
			ok: true,
			value: { result: 'finished', regex: 'a*' }
		});
		expect(call('regexToFsm', 'a*c', ['a', 'b'])).toMatchObject({
			ok: false,
			error: { key: 'regex.unknown_symbol' }
		});
	});

	it('does closure operations', () => {
		expect(call('complement', aStar)).toMatchObject({ ok: true });
		expect(call('union', even, aStar)).toMatchObject({ ok: true });
		expect(call('intersection', even, aStar)).toMatchObject({
			ok: true,
			value: { result: 'finished' }
		});
		expect(call('xor', even, aStar)).toMatchObject({ ok: true, value: { result: 'finished' } });
		expect(call('xor', even, aStar, { maxStates: 1 })).toMatchObject({
			ok: true,
			value: { result: 'stopped', reason: 'max_states' }
		});
	});

	it('imports and exports a JFLAP file', () => {
		const exported = call('exportJff', even, []);
		expect(exported).toMatchObject({ ok: true });
		const xml = (exported as { value: string }).value;
		expect(call('importJff', xml)).toMatchObject({ ok: true, value: { fsm: even } });
	});
});

describe('a call that the engine cannot answer', () => {
	it('throws, so that the worker reports a crash', () => {
		expect(() => call('doesNotExist')).toThrow('unknown engine method');
		expect(() => call('toString')).toThrow('unknown engine method');
		// Not an array of arguments the handler can use: the WASM layer gets a wrong type.
		expect(() => call('loadMachine', 42)).toThrow();
	});
});
