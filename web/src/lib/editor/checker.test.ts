import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EngineCrashed } from '../engine/client.ts';
import type { EngineResult, Issue } from '../engine/types.ts';
import type { MachineDocument } from './document.ts';
import { createChecker } from './checker.ts';
import { documentFrom } from './diagram/samples.ts';

const doc = (title: string) =>
	documentFrom({
		title,
		alphabet: ['a'],
		states: [
			[100, 100, 'q0'],
			[300, 100, 'q1']
		],
		start: 0
	});

const missing = (state: number): Issue => ({
	severity: 'error',
	message: { key: 'dfsm.missing_transition', params: { state, symbol: 'a' } }
});
const ok = (value: Issue[]): EngineResult<Issue[]> => ({ ok: true, value });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('the checker', () => {
	it('waits for the delay, asks the engine once for a burst of changes, and keeps the last answer', async () => {
		const validate = vi.fn(async (doc: MachineDocument) =>
			doc.title ? ok([missing(1)]) : ok([missing(1)])
		);
		const checker = createChecker({ validate, delayMs: 200 });
		expect(checker.status()).toBe('idle');
		for (const title of ['A', 'B', 'C']) {
			checker.schedule(doc(title));
			await vi.advanceTimersByTimeAsync(100);
		}
		expect(validate).not.toHaveBeenCalled();
		expect(checker.status()).toBe('checking');
		await vi.advanceTimersByTimeAsync(300);
		expect(validate).toHaveBeenCalledTimes(1);
		expect(validate.mock.calls[0]![0].title).toBe('C');
		expect(checker.status()).toBe('ready');
		expect(checker.items()).toEqual([
			{
				severity: 'error',
				key: 'check.missing_transition',
				params: { state: 'q1', symbol: 'a' },
				states: [1]
			}
		]);
	});

	it('an answer that comes late for an older document is thrown away', async () => {
		let release: (value: EngineResult<Issue[]>) => void = () => {};
		const validate = vi
			.fn()
			.mockImplementationOnce(() => new Promise<EngineResult<Issue[]>>((done) => (release = done)))
			.mockImplementationOnce(async () => ok([]));
		const checker = createChecker({ validate, delayMs: 10 });
		checker.schedule(doc('old'));
		await vi.advanceTimersByTimeAsync(20);
		checker.schedule(doc('new'));
		await vi.advanceTimersByTimeAsync(20);
		expect(checker.items()).toEqual([]);
		release(ok([missing(0)]));
		await vi.advanceTimersByTimeAsync(0);
		expect(checker.items()).toEqual([]);
		expect(checker.status()).toBe('ready');
	});

	it('a crash of the engine is a failed check with a problem to show, and retry asks again', async () => {
		let crash = true;
		const validate = vi.fn(async () => {
			if (crash) throw new EngineCrashed();
			return ok([]);
		});
		const checker = createChecker({ validate, delayMs: 10 });
		checker.schedule(doc('x'));
		await vi.advanceTimersByTimeAsync(20);
		expect(checker.status()).toBe('failed');
		expect(checker.problem()).toMatchObject({ title: 'engine.crashed.title' });
		expect(checker.items()).toEqual([]);
		crash = false;
		checker.retry();
		await vi.advanceTimersByTimeAsync(20);
		expect(checker.status()).toBe('ready');
		expect(checker.problem()).toBeUndefined();
	});

	it('an answer that is not ok is a failed check too, never a crash of the page', async () => {
		const validate = vi.fn(async (): Promise<EngineResult<Issue[]>> => ({
			ok: false,
			error: { key: 'machine.invalid_structure', params: {} }
		}));
		const checker = createChecker({ validate, delayMs: 10 });
		checker.schedule(doc('x'));
		await vi.advanceTimersByTimeAsync(20);
		expect(checker.status()).toBe('failed');
	});

	it('tells its listeners about each change, and stops when they leave', async () => {
		const checker = createChecker({ validate: async () => ok([]), delayMs: 10 });
		let calls = 0;
		const stop = checker.subscribe(() => calls++);
		checker.schedule(doc('x'));
		await vi.advanceTimersByTimeAsync(20);
		expect(calls).toBeGreaterThanOrEqual(2);
		const seen = calls;
		stop();
		checker.schedule(doc('y'));
		expect(calls).toBe(seen);
	});

	it('dispose cancels a check that has not started, and ignores what comes after', async () => {
		const validate = vi.fn(async () => ok([]));
		const checker = createChecker({ validate, delayMs: 100 });
		checker.schedule(doc('x'));
		checker.dispose();
		await vi.advanceTimersByTimeAsync(500);
		expect(validate).not.toHaveBeenCalled();
		checker.schedule(doc('y'));
		await vi.advanceTimersByTimeAsync(500);
		expect(validate).not.toHaveBeenCalled();
	});
});
