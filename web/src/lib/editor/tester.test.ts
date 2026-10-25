import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EngineCancelled, EngineCrashed } from '../engine/client.ts';
import type { StringOutcome } from '../engine/protocol.ts';
import type { EngineResult } from '../engine/types.ts';
import { applyCommand } from './commands.ts';
import { endsWith01 } from './diagram/samples.ts';
import type { MachineDocument } from './document.ts';
import { createTester } from './tester.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const doc = endsWith01();
const other = (() => {
	const result = applyCommand(doc, { type: 'setTitle', title: 'Lain' });
	if (!result.ok) throw new Error('title');
	return result.doc;
})();
const moved = (() => {
	const result = applyCommand(doc, { type: 'moveState', id: 0, x: 5, y: 5 });
	if (!result.ok) throw new Error('move');
	return result.doc;
})();

/** A fake engine: accepts the strings that end with "01". */
function fake() {
	const calls: string[][] = [];
	const run = vi.fn(
		async (_doc: MachineDocument, inputs: string[]): Promise<EngineResult<StringOutcome[]>> => {
			calls.push(inputs);
			return {
				ok: true,
				value: inputs.map((input) => ({
					input,
					result: input.endsWith('01') ? ('accepted' as const) : ('rejected' as const)
				}))
			};
		}
	);
	return { run, calls };
}

describe('the tester', () => {
	it('waits for the delay, asks once for a burst of changes, and shows the answers', async () => {
		const { run, calls } = fake();
		const tester = createTester({ run, delayMs: 300 });
		expect(tester.status()).toBe('idle');
		tester.schedule(doc, ['01', '10']);
		await vi.advanceTimersByTimeAsync(100);
		tester.schedule(other, ['01', '10']);
		await vi.advanceTimersByTimeAsync(299);
		expect(run).not.toHaveBeenCalled();
		expect(tester.status()).toBe('checking');
		await vi.advanceTimersByTimeAsync(2);
		expect(calls).toEqual([['01', '10']]);
		expect(tester.status()).toBe('ready');
		expect(tester.outcome('01')).toEqual({ input: '01', result: 'accepted' });
		expect(tester.outcome('10')).toEqual({ input: '10', result: 'rejected' });
		expect(tester.outcome('zzz')).toBeUndefined();
	});

	it('asks at once, and only for the new string, when a string is added', async () => {
		const { run, calls } = fake();
		const tester = createTester({ run, delayMs: 300 });
		tester.schedule(doc, ['01']);
		await vi.advanceTimersByTimeAsync(400);
		tester.schedule(doc, ['01', '1']);
		await vi.advanceTimersByTimeAsync(0);
		expect(calls).toEqual([['01'], ['1']]);
		// The old answer stays on screen while the new one is asked.
		expect(tester.outcome('01')?.result).toBe('accepted');
		expect(tester.outcome('1')?.result).toBe('rejected');
		expect(tester.status()).toBe('ready');
	});

	it('does not ask when a string is removed', async () => {
		const { run } = fake();
		const tester = createTester({ run, delayMs: 10 });
		tester.schedule(doc, ['01', '1']);
		await vi.advanceTimersByTimeAsync(20);
		run.mockClear();
		tester.schedule(doc, ['1']);
		await vi.advanceTimersByTimeAsync(500);
		expect(run).not.toHaveBeenCalled();
		expect(tester.status()).toBe('ready');
	});

	it('forgets every answer at once when the machine changes, and asks again after the delay', async () => {
		const { run, calls } = fake();
		const tester = createTester({ run, delayMs: 300 });
		tester.schedule(doc, ['01']);
		await vi.advanceTimersByTimeAsync(400);
		tester.schedule(moved, ['01']);
		expect(tester.outcome('01')).toBeUndefined();
		expect(tester.status()).toBe('checking');
		await vi.advanceTimersByTimeAsync(301);
		expect(calls).toEqual([['01'], ['01']]);
		expect(tester.outcome('01')?.result).toBe('accepted');
	});

	it('keeps the answers when the machine is the same in content (a new object)', async () => {
		const { run } = fake();
		const tester = createTester({ run, delayMs: 10 });
		tester.schedule(doc, ['01']);
		await vi.advanceTimersByTimeAsync(20);
		run.mockClear();
		tester.schedule(endsWith01(), ['01']);
		expect(tester.outcome('01')?.result).toBe('accepted');
		await vi.advanceTimersByTimeAsync(500);
		expect(run).not.toHaveBeenCalled();
	});

	it('never shows an answer for an older machine', async () => {
		const answers: ((value: EngineResult<StringOutcome[]>) => void)[] = [];
		const run = vi.fn(
			() => new Promise<EngineResult<StringOutcome[]>>((resolve) => answers.push(resolve))
		);
		const tester = createTester({ run, delayMs: 10 });
		tester.schedule(doc, ['01']);
		await vi.advanceTimersByTimeAsync(20);
		tester.schedule(moved, ['01']);
		// The answer of the first call arrives late.
		answers[0]!({ ok: true, value: [{ input: '01', result: 'rejected' }] });
		await vi.advanceTimersByTimeAsync(0);
		expect(tester.outcome('01')).toBeUndefined();
		await vi.advanceTimersByTimeAsync(20);
		answers[1]!({ ok: true, value: [{ input: '01', result: 'accepted' }] });
		await vi.advanceTimersByTimeAsync(0);
		expect(tester.outcome('01')?.result).toBe('accepted');
		expect(tester.status()).toBe('ready');
	});

	it('is ready, and does not ask, with no string', async () => {
		const { run } = fake();
		const tester = createTester({ run });
		tester.schedule(doc, []);
		await vi.advanceTimersByTimeAsync(1000);
		expect(run).not.toHaveBeenCalled();
		expect(tester.status()).toBe('ready');
	});

	it('says that the engine failed, with a way to try again', async () => {
		let crash = true;
		const run = vi.fn(async (_doc: MachineDocument, inputs: string[]) => {
			if (crash) throw new EngineCrashed();
			return {
				ok: true as const,
				value: inputs.map((input) => ({ input, result: 'accepted' as const }))
			};
		});
		const tester = createTester({ run, delayMs: 10 });
		tester.schedule(doc, ['01']);
		await vi.advanceTimersByTimeAsync(20);
		expect(tester.status()).toBe('failed');
		expect(tester.problem()).toBeDefined();
		expect(tester.outcome('01')).toBeUndefined();
		crash = false;
		tester.retry();
		await vi.advanceTimersByTimeAsync(0);
		expect(tester.status()).toBe('ready');
		expect(tester.problem()).toBeUndefined();
		expect(tester.outcome('01')?.result).toBe('accepted');
	});

	it('says that it failed when the engine refuses the whole call', async () => {
		const run = vi.fn(async (): Promise<EngineResult<StringOutcome[]>> => ({
			ok: false,
			error: { key: 'api.invalid_budget', params: {} }
		}));
		const tester = createTester({ run, delayMs: 10 });
		tester.schedule(doc, ['01']);
		await vi.advanceTimersByTimeAsync(20);
		expect(tester.status()).toBe('failed');
	});

	it('goes back to waiting, with no notice, when the app canceled the call', async () => {
		const run = vi.fn(async (): Promise<EngineResult<StringOutcome[]>> => {
			throw new EngineCancelled();
		});
		const tester = createTester({ run, delayMs: 10 });
		tester.schedule(doc, ['01']);
		await vi.advanceTimersByTimeAsync(20);
		expect(tester.status()).toBe('idle');
		expect(tester.problem()).toBeUndefined();
	});

	it('tells the listeners, and dispose stops the timer and the listeners', async () => {
		const { run } = fake();
		const tester = createTester({ run, delayMs: 100 });
		const listener = vi.fn();
		tester.subscribe(listener);
		tester.schedule(doc, ['01']);
		expect(listener).toHaveBeenCalled();
		listener.mockClear();
		tester.dispose();
		await vi.advanceTimersByTimeAsync(500);
		expect(run).not.toHaveBeenCalled();
		expect(listener).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});
});
