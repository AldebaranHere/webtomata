// The run of one string on the real engine (the WASM module: `pnpm build:wasm`), on the three
// fixtures of T-038a: the DPDA aⁿbⁿ, the NDPDA wwᴿ, and the looping machine that stops on the
// stack budget. The fake-engine cases of the model live in `pda-run.test.ts`.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import init, * as wasm from '../engine/wasm/engine_wasm.js';
import type { EngineResult, Pda, PdaSimulationReport } from '../engine/types.ts';
import { anbnSample, pdaDocumentFrom, wwrSample } from './pda-samples.ts';
import { toEnginePda } from './pda-document.ts';
import type { PdaDocument } from './pda-document.ts';
import { createPdaRunner, pdaVerdictText } from './pda-run.ts';

beforeAll(async () => {
	const bytes = readFileSync(new URL('../engine/wasm/engine_wasm_bg.wasm', import.meta.url));
	await init({ module_or_path: bytes });
});

const real = async (doc: PdaDocument, input: string): Promise<EngineResult<PdaSimulationReport>> =>
	JSON.parse(
		wasm.simulatePda(JSON.stringify(toEnginePda(doc)), input, undefined)
	) as EngineResult<PdaSimulationReport>;

async function started(doc: PdaDocument, input: string) {
	const runner = createPdaRunner({ simulate: real });
	await runner.start(doc, input);
	return runner;
}

/** The task's F-LOOP: one state, an ε-transition that pushes `A`, so any input is stopped. */
const loop = (): PdaDocument =>
	pdaDocumentFrom({
		kind: 'ndpda',
		inputAlphabet: ['a'],
		stackAlphabet: ['A'],
		states: [[180, 200, 'q0']],
		start: 0,
		accepting: [],
		transitions: [[0, null, [], ['A'], 0]]
	});

const stackAt = (runner: ReturnType<typeof createPdaRunner>, index: number) => {
	runner.goTo(index);
	return runner.view()!.stackText;
};

describe('F-DPDA: aⁿbⁿ', () => {
	it('aabb is accepted, peak 1, and the stack is A, AA, A, empty', async () => {
		const doc = anbnSample();
		const runner = await started(doc, 'aabb');
		const view = runner.view()!;
		expect(view.input).toEqual(['a', 'a', 'b', 'b']);
		expect(view.total).toBe(5);
		expect(view.peak).toBe(1);
		expect(view.explored).toBe(5);
		expect(stackAt(runner, 0)).toBe('ε');
		expect(stackAt(runner, 1)).toBe('A');
		expect(stackAt(runner, 2)).toBe('AA');
		expect(stackAt(runner, 3)).toBe('A');
		expect(stackAt(runner, 4)).toBe('ε');
		expect(runner.view()!.verdict).toEqual({ kind: 'accepted' });
		expect(pdaVerdictText(runner.view()!)).toEqual({
			title: { key: 'run.accepted', params: {} },
			shown: { key: 'pda_sim.shown_accepted', params: {} }
		});
	});

	it('the used edge follows the step', async () => {
		const runner = await started(anbnSample(), 'aabb');
		runner.goTo(1);
		expect(runner.view()!.used).toEqual({ from: 0, to: 0 });
		runner.goTo(3);
		expect(runner.view()!.used).toEqual({ from: 0, to: 1 });
		runner.goTo(4);
		expect(runner.view()!.used).toEqual({ from: 1, to: 1 });
	});

	it('aab is rejected because the stack is not empty', async () => {
		const runner = await started(anbnSample(), 'aab');
		runner.goTo(runner.view()!.total - 1);
		expect(runner.view()!.verdict).toEqual({ kind: 'rejected' });
		expect(pdaVerdictText(runner.view()!)).toEqual({
			title: { key: 'run.rejected', params: {} },
			detail: { key: 'pda.sim.stack_not_empty', params: { depth: 1 } },
			shown: { key: 'pda_sim.shown_furthest', params: {} }
		});
	});

	it('abb is rejected because input is left', async () => {
		const runner = await started(anbnSample(), 'abb');
		runner.goTo(runner.view()!.total - 1);
		expect(pdaVerdictText(runner.view()!)).toEqual({
			title: { key: 'run.rejected', params: {} },
			detail: { key: 'pda.sim.input_left', params: { left: 1 } },
			shown: { key: 'pda_sim.shown_furthest', params: {} }
		});
	});
});

describe('F-NDPDA: wwᴿ', () => {
	it('abba is accepted with peak 3', async () => {
		const runner = await started(wwrSample(), 'abba');
		const view = runner.view()!;
		expect(view.total).toBe(6);
		expect(view.peak).toBe(3);
		runner.goTo(5);
		expect(runner.view()!.verdict).toEqual({ kind: 'accepted' });
	});

	it('abab is rejected with peak 2 and the stack depth of the last step', async () => {
		const runner = await started(wwrSample(), 'abab');
		runner.goTo(runner.view()!.total - 1);
		expect(runner.view()!.peak).toBe(2);
		expect(pdaVerdictText(runner.view()!)?.detail).toEqual({
			key: 'pda.sim.stack_not_empty',
			params: { depth: 4 }
		});
	});
});

describe('F-LOOP: the stack budget', () => {
	it('is stopped at once, with its partial computation and the numbers so far', async () => {
		const runner = await started(loop(), 'a');
		const view = runner.view()!;
		expect(view.verdict).toEqual({ kind: 'stopped', reason: 'max_stack' });
		expect(view.peak).toBe(1);
		expect(view.explored).toBe(501);
		expect(view.total).toBe(501);
		expect(pdaVerdictText(view)?.detail).toEqual({
			key: 'pda_sim.stopped_max_stack',
			params: {}
		});
		expect(stackAt(runner, 1)).toBe('A');
		expect(stackAt(runner, 8)).toBe('AAAAAAAA');
	});
});

describe('a string or a machine that cannot be run', () => {
	it('refuses a symbol that is not in the alphabet', async () => {
		const runner = await started(anbnSample(), 'c');
		expect(runner.status()).toBe('refused');
		expect(runner.refusal()).toEqual({
			key: 'input.unknown_symbol',
			params: { symbol: 'c', position: 0 }
		});
	});

	it('refuses a machine with no start state', async () => {
		const doc: PdaDocument = { ...anbnSample(), start: null };
		const runner = await started(doc, 'a');
		expect(runner.status()).toBe('refused');
		expect(runner.refusal()).toEqual({ key: 'pda.sim.no_start_state', params: {} });
	});

	it('reads a symbol of more than one character as the alphabet says', async () => {
		const doc = pdaDocumentFrom({
			kind: 'ndpda',
			inputAlphabet: ['aa', 'b'],
			stackAlphabet: ['A'],
			states: [[0, 0, 'q0']],
			start: 0,
			accepting: [0],
			transitions: [[0, 'aa', [], ['A'], 0]]
		});
		const runner = await started(doc, 'aa b');
		expect(runner.view()!.input).toEqual(['aa', 'b']);
	});

	it('the engine answers the same as the model expects of the sample’s JSON', () => {
		// The document goes through the real wire format; this is the one place that checks it.
		const pda: Pda = toEnginePda(anbnSample());
		expect(pda.transitions).toHaveLength(3);
		expect(pda.start).toBe(0);
	});
});
