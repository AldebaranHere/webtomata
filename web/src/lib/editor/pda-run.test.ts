// The view model of the Simulasi tab of the PDA editor (T-038a): the stack cells, the used edge,
// the verdict of a run, the window of the computation list, and the runner that plays one trace.
// No DOM and no framework, against a fake engine; `pda-run.wasm.test.ts` runs the same model on
// the real engine and the task's own fixtures.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EngineResult, Message, PdaSimulationReport } from '../engine/types.ts';
import type { StopReason } from '../engine/types.ts';
import { anbnSample } from './pda-samples.ts';
import type { PdaDocument } from './pda-document.ts';
import {
	createPdaRunner,
	pdaAnnouncement,
	pdaRefusalText,
	pdaVerdictText,
	shownRows,
	stackCells
} from './pda-run.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const step = (
	position: number,
	symbol: number | null,
	transition: number | null,
	state: number,
	stack: number[],
	key = 'pda.sim.move',
	params: Record<string, number | string> = {}
) => ({
	position,
	symbol,
	transition,
	state,
	stack,
	message: { key, params } as Message
});

/** The trace of F-DPDA on `aabb`: 5 steps, the stack empty at the end (measured with the engine). */
const aabbTrace = () => [
	step(0, null, null, 0, [], 'pda.sim.start'),
	step(1, 0, 0, 0, [0]),
	step(2, 0, 0, 0, [0, 0]),
	step(3, 1, 1, 1, [0]),
	step(4, 1, 2, 1, [], 'pda.sim.accepted')
];

/** A rejected run: the last configuration still has one symbol on the stack. */
const aabTrace = () => [
	step(0, null, null, 0, [], 'pda.sim.start'),
	step(1, 0, 0, 0, [0]),
	step(2, 0, 0, 0, [0, 0]),
	step(3, 1, 1, 1, [0], 'pda.sim.stack_not_empty', { depth: 1 })
];

function report(
	ancestors: { trace: ReturnType<typeof step>[] },
	input: string[],
	result: { kind: 'finished'; accepted: boolean } | { kind: 'stopped'; reason: StopReason },
	peak = 1,
	explored = ancestors.trace.length
): EngineResult<PdaSimulationReport> {
	const base = { peakConfigurations: peak, explored };
	if (result.kind === 'finished') {
		return {
			ok: true,
			value: {
				input,
				simulation: {
					result: 'finished',
					accepted: result.accepted,
					trace: ancestors.trace,
					...base
				}
			}
		};
	}
	return {
		ok: true,
		value: {
			input,
			simulation: {
				result: 'stopped',
				reason: result.reason,
				partialTrace: ancestors.trace,
				...base
			}
		}
	};
}

const doc: PdaDocument = anbnSample();

/** A fake engine: `aabb` is accepted, `aab` is rejected, `loop` is stopped, `?` is refused. */
function fake() {
	return vi.fn(
		async (_doc: PdaDocument, input: string): Promise<EngineResult<PdaSimulationReport>> => {
			if (input === 'aabb')
				return report(
					{ trace: aabbTrace() },
					['a', 'a', 'b', 'b'],
					{ kind: 'finished', accepted: true },
					1,
					5
				);
			if (input === 'aab')
				return report(
					{ trace: aabTrace() },
					['a', 'a', 'b'],
					{ kind: 'finished', accepted: false },
					1,
					4
				);
			if (input === 'loop') {
				return report(
					{ trace: [step(0, null, null, 0, [], 'pda.sim.start')] },
					['a'],
					{ kind: 'stopped', reason: 'max_stack' },
					7,
					9
				);
			}
			if (input === 'weird') {
				return report(
					{ trace: [step(0, null, null, 0, [], 'pda.sim.start')] },
					['a'],
					{ kind: 'stopped', reason: 'max_states' },
					7,
					9
				);
			}
			return {
				ok: false,
				error: { key: 'input.unknown_symbol', params: { symbol: 'c', position: 0 } }
			};
		}
	);
}

describe('the stack column shows at most 8 cells, top first', () => {
	it('an empty stack has no cell', () => {
		expect(stackCells([])).toEqual({ cells: [], more: 0 });
		expect(stackCells(['A'])).toEqual({ cells: ['A'], more: 0 });
	});

	it('7 and 8 cells are shown whole, and 9 shows 7 and the count of the rest', () => {
		const seven = ['A', 'A', 'A', 'A', 'A', 'A', 'A'];
		expect(stackCells(seven)).toEqual({ cells: seven, more: 0 });
		const eight = [...seven, 'B'];
		expect(stackCells(eight)).toEqual({ cells: eight, more: 0 });
		const nine = [...seven, 'B', 'B'];
		expect(stackCells(nine)).toEqual({ cells: seven, more: 2 });
	});

	it('12 symbols show 7 cells and "5 more"', () => {
		const twelve = ['A', 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'A'];
		expect(stackCells(twelve)).toEqual({ cells: twelve.slice(0, 7), more: 5 });
	});

	it('a symbol of several characters is one cell', () => {
		expect(stackCells(['Z0', 'A'])).toEqual({ cells: ['Z0', 'A'], more: 0 });
	});
});

describe('the window of the computation list', () => {
	it('shows the last 50 rows, and counts the ones before them', () => {
		const rows = Array.from({ length: 49 }, (_, i) => i);
		expect(shownRows(rows)).toEqual({ shown: rows, hidden: 0 });
		expect(shownRows([...rows, 49])).toEqual({ shown: [...rows, 49], hidden: 0 });
		const fiftyTwo = [...rows, 49, 50, 51];
		expect(shownRows(fiftyTwo)).toEqual({ shown: fiftyTwo.slice(2), hidden: 2 });
	});
});

describe('a run of one string', () => {
	it('starts on the start configuration, with the peak already known', async () => {
		const runner = createPdaRunner({ simulate: fake() });
		expect(runner.status()).toBe('idle');
		const done = runner.start(doc, 'aabb');
		expect(runner.status()).toBe('working');
		await done;
		const view = runner.view()!;
		expect(runner.status()).toBe('ready');
		expect(view).toMatchObject({
			index: 0,
			position: 0,
			total: 5,
			state: 0,
			stateName: 'q0',
			stack: [],
			stackText: 'ε',
			top: 'ε',
			verdict: undefined,
			peak: 1,
			explored: 5,
			atStart: true,
			atEnd: false,
			playing: false
		});
		expect(view.input).toEqual(['a', 'a', 'b', 'b']);
		expect(view.rows).toHaveLength(1);
		expect(view.rows[0]).toEqual({ index: 0, label: undefined, state: 'q0', stackText: 'ε' });
	});

	it('walks the trace, and the used edge is the step’s transition in the document', async () => {
		const runner = createPdaRunner({ simulate: fake() });
		await runner.start(doc, 'aabb');

		runner.step();
		expect(runner.view()).toMatchObject({
			index: 1,
			position: 1,
			stateName: 'q0',
			stackText: 'A',
			used: { from: 0, to: 0 }
		});
		expect(runner.view()!.rows[1]).toEqual({
			index: 1,
			label: 'a / ε / A',
			state: 'q0',
			stackText: 'A'
		});

		runner.step();
		expect(runner.view()!.stackText).toBe('AA');

		runner.step();
		expect(runner.view()).toMatchObject({
			index: 3,
			position: 3,
			stateName: 'q1',
			stackText: 'A',
			used: { from: 0, to: 1 }
		});
		expect(runner.view()!.rows[3]!.label).toBe('b / A / ε');

		runner.step();
		const end = runner.view()!;
		expect(end).toMatchObject({
			index: 4,
			atEnd: true,
			stackText: 'ε',
			verdict: { kind: 'accepted' }
		});
		expect(end.rows[4]).toEqual({ index: 4, label: 'b / A / ε', state: 'q1', stackText: 'ε' });
	});

	it('goes back and to the start, and the verdict waits for the last step', async () => {
		const runner = createPdaRunner({ simulate: fake() });
		await runner.start(doc, 'aabb');
		runner.goTo(4);
		expect(runner.view()!.verdict).toEqual({ kind: 'accepted' });
		runner.back();
		expect(runner.view()).toMatchObject({ index: 3, atEnd: false, verdict: undefined });
		runner.toStart();
		expect(runner.view()).toMatchObject({ index: 0, atStart: true });
		runner.goTo(2);
		expect(runner.view()!.index).toBe(2);
		runner.step();
		expect(runner.view()!.index).toBe(3);
	});

	it('a rejected run carries the engine’s own sentence and the furthest line', async () => {
		const runner = createPdaRunner({ simulate: fake() });
		await runner.start(doc, 'aab');
		runner.goTo(3);
		const view = runner.view()!;
		expect(view.verdict).toEqual({ kind: 'rejected' });
		expect(pdaVerdictText(view)).toEqual({
			title: { key: 'run.rejected', params: {} },
			detail: { key: 'pda.sim.stack_not_empty', params: { depth: 1 } },
			shown: { key: 'pda_sim.shown_furthest', params: {} }
		});
	});

	it('an accepted run says that it shows the accepting computation', async () => {
		const runner = createPdaRunner({ simulate: fake() });
		await runner.start(doc, 'aabb');
		runner.goTo(4);
		expect(pdaVerdictText(runner.view()!)).toEqual({
			title: { key: 'run.accepted', params: {} },
			shown: { key: 'pda_sim.shown_accepted', params: {} }
		});
	});

	it('a stopped run shows its neutral box and its numbers at once, on the first step', async () => {
		const runner = createPdaRunner({ simulate: fake() });
		await runner.start(doc, 'loop');
		const view = runner.view()!;
		expect(view.index).toBe(0);
		expect(view.verdict).toEqual({ kind: 'stopped', reason: 'max_stack' });
		expect(view.peak).toBe(7);
		expect(view.explored).toBe(9);
		expect(pdaVerdictText(view)).toEqual({
			detail: { key: 'pda_sim.stopped_max_stack', params: {} }
		});
	});

	it('a stopped run with a reason that cannot occur today has a calm fallback', async () => {
		const runner = createPdaRunner({ simulate: fake() });
		await runner.start(doc, 'weird');
		expect(pdaVerdictText(runner.view()!)).toEqual({
			detail: { key: 'pda_sim.stopped_other', params: {} }
		});
	});

	it('a string that cannot be run says why, in the FSM’s words', async () => {
		const runner = createPdaRunner({ simulate: fake() });
		await runner.start(doc, 'c');
		expect(runner.status()).toBe('refused');
		expect(pdaRefusalText(runner.refusal())).toEqual({
			key: 'input.unknown_symbol',
			params: { symbol: 'c', position: 1 }
		});
		expect(pdaRefusalText({ key: 'pda.sim.no_start_state', params: {} })).toEqual({
			key: 'pda.sim.no_start_state',
			params: {}
		});
		expect(pdaRefusalText({ key: 'machine.invalid_structure', params: {} })).toEqual({
			key: 'sim.refused_other',
			params: {}
		});
	});

	it('announces the step, the stack and its top', async () => {
		const runner = createPdaRunner({ simulate: fake() });
		await runner.start(doc, 'aabb');
		runner.step();
		runner.step();
		expect(pdaAnnouncement(runner.view())).toEqual({
			key: 'pda_sim.step_announce',
			params: { position: 3, total: 5, state: 'q0', stack: 'AA', top: 'A' }
		});
	});

	it('plays by itself and pauses', async () => {
		const runner = createPdaRunner({ simulate: fake(), stepMs: 700 });
		await runner.start(doc, 'aabb');
		runner.play();
		expect(runner.view()!.playing).toBe(true);
		await vi.advanceTimersByTimeAsync(700);
		expect(runner.view()!.index).toBe(1);
		runner.pause();
		expect(runner.view()!.playing).toBe(false);
		await vi.advanceTimersByTimeAsync(3000);
		expect(runner.view()!.index).toBe(1);
	});

	it('never shows an answer for an older call', async () => {
		let finishFirst!: (value: EngineResult<PdaSimulationReport>) => void;
		const slow = vi.fn(
			(_doc: PdaDocument, input: string): Promise<EngineResult<PdaSimulationReport>> =>
				input === 'aabb'
					? new Promise((resolve) => (finishFirst = resolve))
					: Promise.resolve(
							report({ trace: aabTrace() }, ['a', 'a', 'b'], { kind: 'finished', accepted: false })
						)
		);
		const runner = createPdaRunner({ simulate: slow });
		const first = runner.start(doc, 'aabb');
		await runner.start(doc, 'aab');
		finishFirst(
			report({ trace: aabbTrace() }, ['a', 'a', 'b', 'b'], { kind: 'finished', accepted: true })
		);
		await first;
		expect(runner.view()!.index).toBe(0);
		expect(runner.view()!.total).toBe(4);
	});

	it('clear forgets the run', async () => {
		const runner = createPdaRunner({ simulate: fake() });
		await runner.start(doc, 'aabb');
		runner.clear();
		expect(runner.status()).toBe('idle');
		expect(runner.view()).toBeUndefined();
	});
});
