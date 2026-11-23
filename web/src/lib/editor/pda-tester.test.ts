// The test strings of a PDA: run in the engine, a little after each change of the machine, and
// never with an answer for an older machine. The FSM's tester is `tester.ts`; this is the PDA's
// copy, because the machine and the outcome are different types (T-038a, decision 4).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EngineCrashed } from '../engine/client.ts';
import type { EngineResult, PdaStringOutcome } from '../engine/types.ts';
import { anbnSample } from './pda-samples.ts';
import type { PdaDocument } from './pda-document.ts';
import { createPdaTester } from './pda-tester.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const doc = anbnSample();
const retitled = (title: string): PdaDocument => ({ ...doc, title });

/** A fake engine: `aabb` is accepted, everything else is rejected with peak 1. */
function fake() {
	const calls: string[][] = [];
	const run = vi.fn(
		async (_doc: PdaDocument, inputs: string[]): Promise<EngineResult<PdaStringOutcome[]>> => {
			calls.push(inputs);
			return {
				ok: true,
				value: inputs.map((input) =>
					input === 'aabb'
						? { result: 'accepted' as const, input, peak: 1 }
						: { result: 'rejected' as const, input, peak: 1 }
				)
			};
		}
	);
	return { run, calls };
}

describe('the PDA tester', () => {
	it('waits for the delay, asks once for a burst of changes, and shows the answers', async () => {
		const { run, calls } = fake();
		const tester = createPdaTester({ run, delayMs: 300 });
		expect(tester.status()).toBe('idle');
		tester.schedule(doc, ['aabb', 'ab']);
		await vi.advanceTimersByTimeAsync(100);
		tester.schedule(retitled('Lain'), ['aabb', 'ab']);
		await vi.advanceTimersByTimeAsync(299);
		expect(run).not.toHaveBeenCalled();
		expect(tester.status()).toBe('checking');
		await vi.advanceTimersByTimeAsync(2);
		expect(calls).toEqual([['aabb', 'ab']]);
		expect(tester.status()).toBe('ready');
		expect(tester.outcome('aabb')).toEqual({ result: 'accepted', input: 'aabb', peak: 1 });
		expect(tester.outcome('ab')).toEqual({ result: 'rejected', input: 'ab', peak: 1 });
		expect(tester.outcome('zzz')).toBeUndefined();
	});

	it('asks at once for a new string of the same machine', async () => {
		const { run, calls } = fake();
		const tester = createPdaTester({ run, delayMs: 300 });
		tester.schedule(doc, ['aabb']);
		await vi.advanceTimersByTimeAsync(300);
		expect(calls).toEqual([['aabb']]);
		tester.schedule(doc, ['aabb', 'ab']);
		await vi.advanceTimersByTimeAsync(0);
		expect(calls).toEqual([['aabb'], ['ab']]);
		expect(tester.outcome('aabb')).toEqual({ result: 'accepted', input: 'aabb', peak: 1 });
	});

	it('asks nothing more for the same document', async () => {
		const { run, calls } = fake();
		const tester = createPdaTester({ run, delayMs: 300 });
		tester.schedule(doc, ['aabb']);
		await vi.advanceTimersByTimeAsync(300);
		expect(calls).toHaveLength(1);
		tester.schedule(doc, ['aabb']);
		await vi.advanceTimersByTimeAsync(0);
		expect(calls).toHaveLength(1);
		expect(tester.status()).toBe('ready');
	});

	it('forgets every answer when the machine changed, and asks again after the delay', async () => {
		const { run, calls } = fake();
		const tester = createPdaTester({ run, delayMs: 300 });
		tester.schedule(doc, ['aabb', 'ab']);
		await vi.advanceTimersByTimeAsync(300);
		expect(tester.outcome('aabb')).toBeDefined();

		// A real change forgets them at once: no answer may survive the machine it was for.
		tester.schedule(retitled('Lain'), ['aabb', 'ab']);
		expect(tester.outcome('aabb')).toBeUndefined();
		expect(tester.status()).toBe('checking');
		await vi.advanceTimersByTimeAsync(300);
		expect(calls).toHaveLength(2);
		expect(tester.outcome('aabb')).toEqual({ result: 'accepted', input: 'aabb', peak: 1 });
	});

	it('never shows an answer for an older machine', async () => {
		let finishFirst!: (value: EngineResult<PdaStringOutcome[]>) => void;
		const run = vi.fn(
			(_doc: PdaDocument, inputs: string[]): Promise<EngineResult<PdaStringOutcome[]>> =>
				inputs[0] === 'first'
					? new Promise((resolve) => (finishFirst = resolve))
					: Promise.resolve({
							ok: true,
							value: inputs.map((input) => ({ result: 'accepted', input, peak: 2 }))
						})
		);
		const tester = createPdaTester({ run, delayMs: 300 });
		tester.schedule(doc, ['first']);
		await vi.advanceTimersByTimeAsync(300);
		tester.schedule(retitled('Lain'), ['second']);
		await vi.advanceTimersByTimeAsync(300);
		finishFirst({ ok: true, value: [{ result: 'rejected', input: 'first', peak: 9 }] });
		await vi.advanceTimersByTimeAsync(0);
		expect(tester.outcome('first')).toBeUndefined();
		expect(tester.outcome('second')).toEqual({ result: 'accepted', input: 'second', peak: 2 });
	});

	it('keeps a refused string with its own reason', async () => {
		const error = { key: 'input.unknown_symbol', params: { symbol: 'c', position: 0 } };
		const refused = vi.fn(
			async (_doc: PdaDocument, inputs: string[]): Promise<EngineResult<PdaStringOutcome[]>> => ({
				ok: true,
				value: inputs.map((input) => ({ result: 'refused' as const, input, error }))
			})
		);
		const tester = createPdaTester({ run: refused, delayMs: 0 });
		tester.schedule(doc, ['c']);
		await vi.advanceTimersByTimeAsync(0);
		expect(tester.outcome('c')).toEqual({ result: 'refused', input: 'c', error });
	});

	it('a failure is a problem with a retry, and the retry asks again', async () => {
		const run = vi
			.fn()
			.mockRejectedValueOnce(new EngineCrashed())
			.mockResolvedValueOnce({
				ok: true,
				value: [{ result: 'accepted', input: 'aabb', peak: 1 }]
			});
		const tester = createPdaTester({ run, delayMs: 0 });
		tester.schedule(doc, ['aabb']);
		await vi.advanceTimersByTimeAsync(0);
		expect(tester.status()).toBe('failed');
		expect(tester.problem()).toBeDefined();
		tester.retry();
		expect(tester.status()).toBe('checking');
		await vi.advanceTimersByTimeAsync(0);
		expect(tester.status()).toBe('ready');
		expect(tester.outcome('aabb')).toEqual({ result: 'accepted', input: 'aabb', peak: 1 });
	});

	it('stops asking after dispose', async () => {
		const { run, calls } = fake();
		const tester = createPdaTester({ run, delayMs: 0 });
		tester.schedule(doc, ['aabb']);
		tester.dispose();
		await vi.advanceTimersByTimeAsync(0);
		expect(calls).toHaveLength(0);
	});
});
