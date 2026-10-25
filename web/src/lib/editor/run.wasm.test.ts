// The run of one string, against the real engine (the WASM module: `pnpm build:wasm`), with a fake
// engine for the answers that the real one does not give on demand (a late answer, a crash).
import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EngineCrashed } from '../engine/client.ts';
import init, * as wasm from '../engine/wasm/engine_wasm.js';
import type { EngineResult, SimulationReport } from '../engine/types.ts';
import type { MachineDocument } from './document.ts';
import { toMachine } from './document.ts';
import { documentFrom, endsWith01 } from './diagram/samples.ts';
import { createRunner } from './run.ts';
import type { Runner } from './run.ts';
import { random } from './testing.ts';

beforeAll(async () => {
	const bytes = readFileSync(new URL('../engine/wasm/engine_wasm_bg.wasm', import.meta.url));
	await init({ module_or_path: bytes });
});
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const real = async (
	doc: MachineDocument,
	input: string,
	budget?: object
): Promise<EngineResult<SimulationReport>> =>
	JSON.parse(
		wasm.simulate(
			JSON.stringify(toMachine(doc)),
			input,
			budget === undefined ? undefined : JSON.stringify(budget)
		)
	);

async function started(
	doc: MachineDocument,
	input: string,
	runner = createRunner({ simulate: real })
) {
	await runner.start(doc, input);
	return runner;
}
const view = (runner: Runner) => runner.view()!;

// An NDFSM with ε: q0 -a-> q1, q0 -a-> q2, q1 -ε-> q3, q2 -b-> q2, q3 accepts.
const ndfsm = () =>
	documentFrom({
		alphabet: ['a', 'b'],
		states: [
			[100, 100, 'q0'],
			[300, 50, 'q1'],
			[300, 150, 'q2'],
			[500, 50, 'q3']
		],
		start: 0,
		accepting: [3],
		transitions: [
			[0, 'a', 1],
			[0, 'a', 2],
			[1, null, 3],
			[2, 'b', 2]
		]
	});

describe('a run', () => {
	it('starts at the first step: the start state is active, nothing was read, there is no verdict yet', async () => {
		const runner = createRunner({ simulate: real });
		expect(runner.status()).toBe('idle');
		const done = runner.start(endsWith01(), '0101');
		expect(runner.status()).toBe('working');
		await done;
		expect(runner.status()).toBe('ready');
		expect(view(runner)).toMatchObject({
			index: 0,
			position: 0,
			input: ['0', '1', '0', '1'],
			active: [0],
			rows: [],
			verdict: undefined,
			atStart: true,
			atEnd: false,
			playing: false
		});
	});

	it('steps forward and back inside its bounds, and gives the verdict at the last step', async () => {
		const runner = await started(endsWith01(), '01');
		runner.back();
		expect(view(runner).index).toBe(0);
		runner.step();
		expect(view(runner)).toMatchObject({ index: 1, position: 1, active: [1], verdict: undefined });
		runner.step();
		expect(view(runner)).toMatchObject({ index: 2, active: [2], atEnd: true });
		expect(view(runner).verdict).toEqual({ kind: 'accepted' });
		runner.step();
		expect(view(runner).index).toBe(2);
		runner.back();
		expect(view(runner)).toMatchObject({ index: 1, verdict: undefined });
		runner.toStart();
		expect(view(runner).index).toBe(0);
	});

	it('rejects, with the verdict only at the end', async () => {
		const runner = await started(endsWith01(), '0');
		runner.step();
		expect(view(runner).verdict).toEqual({ kind: 'rejected' });
	});

	it('lists the computation as the names of the states, up to the current step', async () => {
		const runner = await started(endsWith01(), '010');
		runner.step();
		runner.step();
		expect(view(runner).rows).toEqual([
			{ position: 1, from: ['q0'], symbol: '0', to: ['q1'] },
			{ position: 2, from: ['q1'], symbol: '1', to: ['q2'] }
		]);
		runner.step();
		expect(view(runner).rows).toHaveLength(3);
		runner.back();
		expect(view(runner).rows).toHaveLength(2);
	});

	it('ends early, as a rejection, when no state is active (a DFSM without that transition)', async () => {
		const doc = documentFrom({
			alphabet: ['a', 'b'],
			states: [
				[100, 100, 'q0'],
				[300, 100, 'q1']
			],
			start: 0,
			accepting: [1],
			transitions: [[0, 'a', 1]]
		});
		const runner = await started(doc, 'abab');
		// The engine stops the trace at the first empty set: the input chips stay whole.
		expect(view(runner).input).toEqual(['a', 'b', 'a', 'b']);
		runner.step();
		runner.step();
		expect(view(runner)).toMatchObject({ index: 2, position: 2, active: [], atEnd: true });
		expect(view(runner).verdict).toEqual({ kind: 'rejected' });
		expect(view(runner).rows[1]).toEqual({ position: 2, from: ['q1'], symbol: 'b', to: [] });
	});

	it('shows every active state of an NDFSM, with the ε closure', async () => {
		const runner = await started(ndfsm(), 'ab');
		expect(view(runner).active).toEqual([0]);
		runner.step();
		expect(view(runner).active).toEqual([1, 2, 3]);
		expect(view(runner).rows[0]).toEqual({
			position: 1,
			from: ['q0'],
			symbol: 'a',
			to: ['q1', 'q2', 'q3']
		});
		runner.step();
		expect(view(runner).active).toEqual([2]);
		expect(view(runner).verdict).toEqual({ kind: 'rejected' });
	});

	it('takes an empty string: the run is one step', async () => {
		const runner = await started(endsWith01(), '');
		expect(view(runner)).toMatchObject({ input: [], atStart: true, atEnd: true });
		expect(view(runner).verdict).toEqual({ kind: 'rejected' });
	});

	it('says when the budget stopped the run, at the last step that was kept', async () => {
		const runner = createRunner({ simulate: (doc, input) => real(doc, input, { maxSteps: 2 }) });
		await started(endsWith01(), '0101', runner);
		runner.step();
		runner.step();
		expect(view(runner)).toMatchObject({ index: 2, atEnd: true });
		expect(view(runner).verdict).toEqual({ kind: 'stopped', reason: 'max_steps' });
	});

	it('reads a string of longer symbols', async () => {
		const doc = documentFrom({
			alphabet: ['num', 'plus'],
			states: [
				[100, 100, 'q0'],
				[300, 100, 'q1']
			],
			start: 0,
			accepting: [1],
			transitions: [
				[0, 'num', 1],
				[1, 'plus', 0]
			]
		});
		const runner = await started(doc, 'num plus num');
		expect(view(runner).input).toEqual(['num', 'plus', 'num']);
	});
});

describe('the edges that were taken', () => {
	it('is the edge of the symbol that was read, and nothing at the first step', async () => {
		const runner = await started(endsWith01(), '01');
		expect(view(runner).taken).toEqual([]);
		runner.step();
		expect(view(runner).taken).toEqual([{ from: 0, to: 1 }]);
		runner.step();
		expect(view(runner).taken).toEqual([{ from: 1, to: 2 }]);
	});

	it('is a self loop, once, even when two symbols give it', async () => {
		const doc = documentFrom({
			alphabet: ['a', 'b'],
			states: [[100, 100, 'q0']],
			start: 0,
			transitions: [
				[0, 'a', 0],
				[0, 'b', 0]
			]
		});
		const runner = await started(doc, 'a');
		runner.step();
		expect(view(runner).taken).toEqual([{ from: 0, to: 0 }]);
	});

	it('has the ε edges that led to the active states, and the edges of every branch', async () => {
		const runner = await started(ndfsm(), 'a');
		runner.step();
		expect(view(runner).taken).toEqual([
			{ from: 0, to: 1 },
			{ from: 0, to: 2 },
			{ from: 1, to: 3 }
		]);
	});

	it('has the ε edges at the first step too', async () => {
		const doc = documentFrom({
			alphabet: ['a'],
			states: [
				[100, 100, 'q0'],
				[300, 100, 'q1']
			],
			start: 0,
			transitions: [[0, null, 1]]
		});
		const runner = await started(doc, 'a');
		expect(view(runner).active).toEqual([0, 1]);
		expect(view(runner).taken).toEqual([{ from: 0, to: 1 }]);
	});

	it('property: every active state is reached by a taken edge, and every taken edge ends in an active state', async () => {
		const rng = random(7);
		for (let round = 0; round < 60; round++) {
			const count = 1 + rng.int(5);
			const doc = documentFrom({
				alphabet: ['a', 'b'],
				states: Array.from({ length: count }, (_, i) => [100 + 80 * i, 100] as [number, number]),
				start: 0,
				accepting: [rng.int(count)],
				transitions: [
					...new Map(
						Array.from({ length: rng.int(10) }, () => {
							const t: [number, string | null, number] = [
								rng.int(count),
								rng.chance(0.25) ? null : rng.pick(['a', 'b']),
								rng.int(count)
							];
							return [t.join('|'), t] as const;
						})
					).values()
				]
			});
			const runner = await started(
				doc,
				Array.from({ length: rng.int(6) }, () => rng.pick(['a', 'b'])).join('')
			);
			for (;;) {
				const { active, taken, index, atEnd } = view(runner);
				const ends = new Set(taken.map((e) => e.to));
				for (const state of active) {
					if (index > 0 || state !== 0) expect(ends.has(state), `round ${round}`).toBe(true);
				}
				for (const edge of taken) expect(active, `round ${round}`).toContain(edge.to);
				if (atEnd) break;
				runner.step();
			}
		}
	});
});

describe('playing', () => {
	it('moves one step every 700 ms and stops at the end', async () => {
		const runner = await started(endsWith01(), '01');
		runner.play();
		expect(view(runner).playing).toBe(true);
		await vi.advanceTimersByTimeAsync(699);
		expect(view(runner).index).toBe(0);
		await vi.advanceTimersByTimeAsync(1);
		expect(view(runner).index).toBe(1);
		await vi.advanceTimersByTimeAsync(700);
		expect(view(runner)).toMatchObject({ index: 2, playing: false });
		await vi.advanceTimersByTimeAsync(5000);
		expect(view(runner).index).toBe(2);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('pauses, and goes on from the same step', async () => {
		const runner = await started(endsWith01(), '010');
		runner.play();
		await vi.advanceTimersByTimeAsync(700);
		runner.pause();
		expect(view(runner)).toMatchObject({ index: 1, playing: false });
		await vi.advanceTimersByTimeAsync(5000);
		expect(view(runner).index).toBe(1);
		runner.play();
		await vi.advanceTimersByTimeAsync(700);
		expect(view(runner).index).toBe(2);
	});

	it('starts again from the first step when it is played at the end', async () => {
		const runner = await started(endsWith01(), '0');
		runner.step();
		runner.play();
		expect(view(runner)).toMatchObject({ index: 0, playing: true });
	});

	it('pauses when the user steps or goes back', async () => {
		const runner = await started(endsWith01(), '0101');
		runner.play();
		runner.step();
		expect(view(runner).playing).toBe(false);
		runner.play();
		runner.back();
		expect(view(runner).playing).toBe(false);
		runner.play();
		runner.toStart();
		expect(view(runner).playing).toBe(false);
		expect(vi.getTimerCount()).toBe(0);
	});
});

describe('what the user sees when it cannot run', () => {
	it('refuses a symbol that is not in the alphabet, with the symbol and the place', async () => {
		const runner = await started(endsWith01(), '012');
		expect(runner.status()).toBe('refused');
		expect(runner.refusal()).toMatchObject({
			key: 'input.unknown_symbol',
			params: { symbol: '2', position: 2 }
		});
		expect(runner.view()).toBeUndefined();
	});

	it('refuses a machine without a start state', async () => {
		const doc = documentFrom({ alphabet: ['a'], states: [[100, 100]] });
		const runner = await started(doc, 'a');
		expect(runner.status()).toBe('refused');
		expect(runner.refusal()?.key).toBe('sim.no_start_state');
	});

	it('says that the engine failed, with a way to try again, and a new run clears it', async () => {
		let crash = true;
		const runner = createRunner({
			simulate: (doc, input) => (crash ? Promise.reject(new EngineCrashed()) : real(doc, input))
		});
		await runner.start(endsWith01(), '01');
		expect(runner.status()).toBe('failed');
		expect(runner.problem()).toBeDefined();
		crash = false;
		await runner.start(endsWith01(), '01');
		expect(runner.status()).toBe('ready');
		expect(runner.problem()).toBeUndefined();
	});

	it('does not show a problem for a call that the app canceled itself', async () => {
		const { EngineCancelled } = await import('../engine/client.ts');
		const runner = createRunner({ simulate: () => Promise.reject(new EngineCancelled()) });
		await runner.start(endsWith01(), '01');
		expect(runner.status()).toBe('idle');
	});
});

describe('a run that is old', () => {
	it('ignores the answer of an earlier call when a newer call was made', async () => {
		const answers: ((value: EngineResult<SimulationReport>) => void)[] = [];
		const runner = createRunner({
			simulate: () => new Promise((resolve) => answers.push(resolve))
		});
		const first = runner.start(endsWith01(), '0');
		const second = runner.start(endsWith01(), '01');
		answers[1]!(await real(endsWith01(), '01'));
		await second;
		answers[0]!(await real(endsWith01(), '0'));
		await first;
		expect(view(runner).input).toEqual(['0', '1']);
	});

	it('ignores an answer that arrives after the run was cleared', async () => {
		let answer!: (value: EngineResult<SimulationReport>) => void;
		const runner = createRunner({ simulate: () => new Promise((resolve) => (answer = resolve)) });
		const pending = runner.start(endsWith01(), '0');
		runner.clear();
		answer(await real(endsWith01(), '0'));
		await pending;
		expect(runner.status()).toBe('idle');
		expect(runner.view()).toBeUndefined();
	});

	it('clear stops the timer, forgets the run, and tells the listeners', async () => {
		const runner = await started(endsWith01(), '0101');
		const listener = vi.fn();
		runner.subscribe(listener);
		runner.play();
		listener.mockClear();
		runner.clear();
		expect(runner.status()).toBe('idle');
		expect(runner.view()).toBeUndefined();
		expect(listener).toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('clear tells nobody when there is nothing to clear', () => {
		const runner = createRunner({ simulate: real });
		const listener = vi.fn();
		runner.subscribe(listener);
		runner.clear();
		expect(listener).not.toHaveBeenCalled();
	});

	it('dispose stops the timer and the listeners', async () => {
		const runner = await started(endsWith01(), '0101');
		const listener = vi.fn();
		runner.subscribe(listener);
		runner.play();
		listener.mockClear();
		runner.dispose();
		await vi.advanceTimersByTimeAsync(5000);
		expect(listener).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});
});

describe('what is said at each step', () => {
	it('names the step with a message key and the names of the states', async () => {
		const runner = await started(ndfsm(), 'a');
		expect(runner.announcement()).toEqual({ key: 'sim.start', params: { states: 'q0' } });
		runner.step();
		expect(runner.announcement()).toEqual({
			key: 'sim.read',
			params: { symbol: 'a', position: 1, total: 1, states: 'q1, q2, q3' }
		});
	});

	it('uses the key for no active state', async () => {
		const doc = documentFrom({
			alphabet: ['a'],
			states: [[100, 100, 'q0']],
			start: 0
		});
		const runner = await started(doc, 'a');
		runner.step();
		expect(runner.announcement()?.key).toBe('sim.no_states');
	});
});
