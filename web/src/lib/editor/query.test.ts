// The one scheduled query behind the checks and the determinism badge (T-071): the debounce, the
// sequence number, the emptying option, the error rule and `dispose`, tested once. The two wrappers
// keep their own tests; this file is where a race that would show an answer for an older document
// must be caught.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EngineCancelled, EngineCrashed } from '../engine/client.ts';
import type { Competition, EngineResult, Issue } from '../engine/types.ts';
import { createChecker } from './checker.ts';
import { documentFrom } from './diagram/samples.ts';
import { createDeterminism } from './pda-determinism.ts';
import { anbnSample } from './pda-samples.ts';
import { createQuery } from './query.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** A stand-in document; the query only carries it. */
type Doc = { name: string };
/** A stand-in answer; the query only maps it. */
type Answer = number[];

const ok = (value: Answer): EngineResult<Answer> => ({ ok: true, value });

function deferred<T = Answer>(): {
	promise: Promise<EngineResult<T>>;
	resolve: (answer: EngineResult<T>) => void;
} {
	let resolve: (answer: EngineResult<T>) => void = () => undefined;
	const promise = new Promise<EngineResult<T>>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

/** A two-state machine document, for the checks. */
const machine = (title: string) =>
	documentFrom({
		title,
		alphabet: ['a'],
		states: [
			[100, 100, 'q0'],
			[300, 100, 'q1']
		],
		start: 0
	});

/** Lets the promises of an answer settle (each `await` of the ask is one microtask turn). */
async function settle(): Promise<void> {
	for (let i = 0; i < 8; i++) await Promise.resolve();
}

/** The query as the checker configures it: the value is kept, and a failure keeps a problem. */
function make(
	ask: (doc: Doc) => Promise<EngineResult<Answer>>,
	extra: { emptyAtSchedule?: boolean; keepsProblem?: boolean; delayMs?: number } = {}
) {
	return createQuery<Doc, Answer, Answer>({
		ask,
		toValue: (answer) => answer,
		empty: () => [],
		delayMs: 200,
		...extra
	});
}

/** The query as the determinism badge configures it: the value is emptied at `schedule`. */
function makeEmptying(
	ask: (doc: Doc) => Promise<EngineResult<Answer>>,
	extra: { keepsProblem?: boolean; delayMs?: number } = {}
) {
	return make(ask, { emptyAtSchedule: true, ...extra });
}

const newestDoc = (ask: { mock: { calls: unknown[][] } }, call = 0) => ask.mock.calls[call]![0];

describe('the scheduled query: one request for a change, after the delay', () => {
	it('is idle before the first change, and asks once after the delay, for the last document', async () => {
		const ask = vi.fn(async (doc: Doc) => ok([doc.name.length]));
		const query = make(ask);
		expect(query.status()).toBe('idle');
		expect(query.value()).toEqual([]);

		for (const name of ['a', 'bb', 'ccc']) {
			query.schedule({ name });
			await vi.advanceTimersByTimeAsync(100);
		}
		expect(ask).not.toHaveBeenCalled();
		expect(query.status()).toBe('checking');

		await vi.advanceTimersByTimeAsync(99);
		expect(ask).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		await settle();
		expect(ask).toHaveBeenCalledTimes(1);
		expect(newestDoc(ask)).toEqual({ name: 'ccc' });
		expect(query.status()).toBe('ready');
		expect(query.value()).toEqual([3]);
	});

	it('turns the answer into the shown value with the document it was asked about', async () => {
		const query = createQuery<Doc, Answer, string>({
			ask: async (doc) => ok([doc.name.length]),
			toValue: (answer, doc) => `${doc.name}:${answer.join(',')}`,
			empty: () => '',
			delayMs: 200
		});
		query.schedule({ name: 'abc' });
		await vi.advanceTimersByTimeAsync(200);
		await settle();
		expect(query.value()).toBe('abc:3');
	});

	it('tells its listeners about the schedule and the answer, and stops when they leave', async () => {
		const ask = vi.fn(async () => ok([1]));
		const query = make(ask);
		const listener = vi.fn();
		const stop = query.subscribe(listener);
		query.schedule({ name: 'x' });
		expect(listener).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(200);
		await settle();
		expect(listener).toHaveBeenCalledTimes(2);
		stop();
		query.schedule({ name: 'y' });
		await vi.advanceTimersByTimeAsync(200);
		await settle();
		expect(listener).toHaveBeenCalledTimes(2);
	});
});

describe('the emptying option', () => {
	it('with emptyAtSchedule off, the shown value survives a schedule until the new answer arrives', async () => {
		// This is guard B4: the checker must keep its old items while the new answer is on its way.
		const second = deferred();
		const ask = vi
			.fn()
			.mockResolvedValueOnce(ok([1]))
			.mockImplementationOnce(() => second.promise);
		const query = make(ask);

		query.schedule({ name: 'old' });
		await vi.advanceTimersByTimeAsync(200);
		await settle();
		expect(query.value()).toEqual([1]);

		query.schedule({ name: 'new' });
		expect(query.value()).toEqual([1]);
		expect(query.status()).toBe('checking');
		// Still the old value while the question is asked.
		await vi.advanceTimersByTimeAsync(200);
		expect(query.value()).toEqual([1]);

		second.resolve(ok([2]));
		await settle();
		expect(query.value()).toEqual([2]);
		expect(query.status()).toBe('ready');
	});

	it('with emptyAtSchedule on, the shown value is gone the moment a new document is scheduled', async () => {
		const second = deferred();
		const ask = vi
			.fn()
			.mockResolvedValueOnce(ok([1]))
			.mockImplementationOnce(() => second.promise);
		const query = makeEmptying(ask);

		query.schedule({ name: 'old' });
		await vi.advanceTimersByTimeAsync(200);
		await settle();
		expect(query.value()).toEqual([1]);

		query.schedule({ name: 'new' });
		expect(query.value()).toEqual([]);
		expect(query.status()).toBe('checking');
		// The question is asked after the debounce, and its answer is resolved by hand.
		await vi.advanceTimersByTimeAsync(200);
		second.resolve(ok([2]));
		await settle();
		expect(query.value()).toEqual([2]);
	});

	it('a failed answer empties the value in both settings', async () => {
		const failed: EngineResult<Answer> = {
			ok: false,
			error: { key: 'api.invalid_budget', params: {} }
		};
		for (const emptying of [false, true]) {
			const ask = vi
				.fn()
				.mockResolvedValueOnce(ok([1]))
				.mockResolvedValueOnce(failed);
			const query = emptying ? makeEmptying(ask) : make(ask);
			query.schedule({ name: 'old' });
			await vi.advanceTimersByTimeAsync(200);
			await settle();
			expect(query.value()).toEqual([1]);

			query.schedule({ name: 'new' });
			await vi.advanceTimersByTimeAsync(200);
			await settle();
			expect(query.status()).toBe('failed');
			expect(query.value()).toEqual([]);
			expect(query.problem()).toBeDefined();
			query.dispose();
		}
	});
});

describe('the races: an answer is only for the newest document', () => {
	it('an answer that comes late for an older document is thrown away', async () => {
		const first = deferred();
		const second = deferred();
		const ask = vi
			.fn()
			.mockImplementationOnce(() => first.promise)
			.mockImplementationOnce(() => second.promise);
		const query = make(ask);

		query.schedule({ name: 'old' });
		await vi.advanceTimersByTimeAsync(200);
		expect(ask).toHaveBeenCalledTimes(1);

		query.schedule({ name: 'new' });
		await vi.advanceTimersByTimeAsync(200);
		expect(ask).toHaveBeenCalledTimes(2);

		// The answer of the newest question comes back first.
		second.resolve(ok([2]));
		await settle();
		expect(query.status()).toBe('ready');
		expect(query.value()).toEqual([2]);

		// The answer of the older one comes back last: nothing changes.
		first.resolve(ok([9]));
		await settle();
		expect(query.value()).toEqual([2]);
		expect(query.status()).toBe('ready');
	});

	it('an answer on its way is dropped when a new document is scheduled', async () => {
		const first = deferred();
		const ask = vi
			.fn()
			.mockImplementationOnce(() => first.promise)
			.mockResolvedValueOnce(ok([2]));
		const query = make(ask);

		query.schedule({ name: 'old' });
		await vi.advanceTimersByTimeAsync(200);
		query.schedule({ name: 'new' });
		// The answer of the old document arrives before the debounce of the new one.
		first.resolve(ok([9]));
		await settle();
		expect(query.value()).toEqual([]);
		expect(query.status()).toBe('checking');

		await vi.advanceTimersByTimeAsync(200);
		await settle();
		expect(query.value()).toEqual([2]);
		expect(query.status()).toBe('ready');
	});
});

describe('a failure', () => {
	it('a refused answer is failed, with a problem and the value emptied', async () => {
		const ask = vi.fn(async (): Promise<EngineResult<Answer>> => ({
			ok: false,
			error: { key: 'machine.invalid_structure', params: {} }
		}));
		const query = make(ask);
		query.schedule({ name: 'x' });
		await vi.advanceTimersByTimeAsync(200);
		await settle();
		expect(query.status()).toBe('failed');
		expect(query.value()).toEqual([]);
		expect(query.problem()).toMatchObject({ title: 'engine.crashed.title' });
	});

	it('a thrown error is failed with a problem, and a later answer clears it', async () => {
		let crash = true;
		const ask = vi.fn(async (): Promise<EngineResult<Answer>> => {
			if (crash) throw new EngineCrashed();
			return ok([1]);
		});
		const query = make(ask);
		query.schedule({ name: 'x' });
		await vi.advanceTimersByTimeAsync(200);
		await settle();
		expect(query.status()).toBe('failed');
		expect(query.problem()).toMatchObject({ title: 'engine.crashed.title' });

		crash = false;
		query.retry();
		await settle();
		expect(query.status()).toBe('ready');
		expect(query.problem()).toBeUndefined();
		expect(query.value()).toEqual([1]);
	});

	it('a call that the app canceled goes back to idle, with no problem', async () => {
		const ask = vi.fn(async (): Promise<EngineResult<Answer>> => {
			throw new EngineCancelled();
		});
		const query = make(ask);
		query.schedule({ name: 'x' });
		await vi.advanceTimersByTimeAsync(200);
		await settle();
		expect(query.status()).toBe('idle');
		expect(query.problem()).toBeUndefined();
		expect(query.value()).toEqual([]);
	});

	it('without keepsProblem, a canceled call is failed, as the determinism query asks', async () => {
		const ask = vi.fn(async (): Promise<EngineResult<Answer>> => {
			throw new EngineCancelled();
		});
		const query = makeEmptying(ask, { keepsProblem: false });
		query.schedule({ name: 'x' });
		await vi.advanceTimersByTimeAsync(200);
		await settle();
		expect(query.status()).toBe('failed');
		expect(query.problem()).toBeUndefined();
		expect(query.value()).toEqual([]);
	});
});

describe('retry and dispose', () => {
	it('retry asks again at once for the newest document, with no wait', async () => {
		const ask = vi.fn(async () => ok([1]));
		const query = make(ask);
		query.schedule({ name: 'x' });
		await vi.advanceTimersByTimeAsync(200);
		await settle();
		expect(ask).toHaveBeenCalledTimes(1);
		expect(query.status()).toBe('ready');

		query.retry();
		expect(query.status()).toBe('checking');
		expect(ask).toHaveBeenCalledTimes(2);
		expect(newestDoc(ask, 1)).toEqual({ name: 'x' });
		await settle();
		expect(query.status()).toBe('ready');
	});

	it('retry does nothing before the first document and after dispose', async () => {
		const ask = vi.fn(async () => ok([1]));
		const query = make(ask);
		query.retry();
		expect(ask).not.toHaveBeenCalled();
		query.schedule({ name: 'x' });
		query.dispose();
		query.retry();
		await vi.advanceTimersByTimeAsync(1000);
		expect(ask).not.toHaveBeenCalled();
	});

	it('dispose cancels the waiting request, the listeners and the documents after it', async () => {
		const ask = vi.fn(async () => ok([1]));
		const query = make(ask);
		const listener = vi.fn();
		query.subscribe(listener);
		query.schedule({ name: 'x' });
		listener.mockClear();
		query.dispose();
		await vi.advanceTimersByTimeAsync(1000);
		expect(ask).not.toHaveBeenCalled();
		expect(listener).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
		query.schedule({ name: 'y' });
		await vi.advanceTimersByTimeAsync(1000);
		expect(ask).not.toHaveBeenCalled();
	});

	it('an answer that comes back after dispose changes nothing, and dispose is not a status', async () => {
		const pending = deferred();
		const ask = vi.fn(() => pending.promise);
		const query = makeEmptying(ask);
		query.schedule({ name: 'x' });
		await vi.advanceTimersByTimeAsync(200);
		expect(query.status()).toBe('checking');

		query.dispose();
		pending.resolve(ok([7]));
		await settle();
		expect(query.value()).toEqual([]);
		expect(query.status()).toBe('checking');
	});
});

describe('the two callers configure the query as each of them needs it (B3, B4)', () => {
	it('B4: the checker keeps its old items while the new answer is on its way', async () => {
		const second = deferred<Issue[]>();
		const issue: Issue = {
			severity: 'error',
			message: { key: 'dfsm.missing_transition', params: { state: 1, symbol: 'a' } }
		};
		const validate = vi
			.fn()
			.mockResolvedValueOnce({ ok: true, value: [issue] })
			.mockImplementationOnce(() => second.promise);
		const checker = createChecker({ validate, delayMs: 200 });

		checker.schedule(machine('A'));
		await vi.advanceTimersByTimeAsync(200);
		await settle();
		expect(checker.items()).toHaveLength(1);

		checker.schedule(machine('B'));
		// B4: an emptying checker would show nothing here, and the list would blink on every edit.
		expect(checker.items()).toHaveLength(1);
		expect(checker.status()).toBe('checking');
		// The question is asked after the debounce, and its answer is resolved by hand.
		await vi.advanceTimersByTimeAsync(200);
		second.resolve({ ok: true, value: [] });
		await settle();
		expect(checker.items()).toHaveLength(0);
	});

	it('B3: the determinism badge empties its pairs the moment a new document is scheduled', async () => {
		const second = deferred<Competition[]>();
		const pair: Competition = { from: 0, first: 0, second: 1 };
		const query = vi
			.fn()
			.mockResolvedValueOnce({ ok: true, value: [pair] })
			.mockImplementationOnce(() => second.promise);
		const determinism = createDeterminism({ query, delayMs: 200 });

		determinism.schedule(anbnSample());
		await vi.advanceTimersByTimeAsync(200);
		await settle();
		expect(determinism.pairs()).toEqual([pair]);

		determinism.schedule(anbnSample());
		// B3: a badge must never show the pairs of the document before this one.
		expect(determinism.pairs()).toEqual([]);
		expect(determinism.status()).toBe('checking');
		await vi.advanceTimersByTimeAsync(200);
		second.resolve({ ok: true, value: [] });
		await settle();
		expect(determinism.pairs()).toEqual([]);
		expect(determinism.status()).toBe('ready');
	});
});
