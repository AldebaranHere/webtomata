import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	EngineCancelled,
	EngineCrashed,
	EngineTimeout,
	WEB_BUDGETS,
	WEB_TIMEOUTS,
	createEngine
} from './client.ts';
import type { WorkerLike } from './client.ts';
import { METHODS } from './protocol.ts';
import type { CallMessage, ReplyMessage } from './protocol.ts';
import type { Machine } from './types.ts';

/** A worker that does nothing until the test makes it answer. */
class FakeWorker implements WorkerLike {
	posted: CallMessage[] = [];
	terminated = false;
	failToSend: Error | undefined;
	onmessage: WorkerLike['onmessage'] = null;
	onerror: WorkerLike['onerror'] = null;
	onmessageerror: WorkerLike['onmessageerror'] = null;

	postMessage(message: CallMessage): void {
		if (this.failToSend) throw this.failToSend;
		this.posted.push(message);
	}
	terminate(): void {
		this.terminated = true;
	}
	/** The worker answers (even after `terminate`, to test late answers). */
	reply(message: ReplyMessage): void {
		this.onmessage?.({ data: message } as MessageEvent<ReplyMessage>);
	}
	fail(): void {
		this.onerror?.({ message: 'boom' } as ErrorEvent);
	}
}

function setup(timeouts?: Partial<typeof WEB_TIMEOUTS>) {
	const workers: FakeWorker[] = [];
	const engine = createEngine(
		() => {
			const worker = new FakeWorker();
			workers.push(worker);
			return worker;
		},
		WEB_BUDGETS,
		timeouts
	);
	return { engine, workers };
}

const machine = { schemaVersion: 1 } as Machine;
const worked = (value: unknown) => ({ ok: true as const, value });

describe('a call', () => {
	it('starts the worker on the first call and not before', async () => {
		const { engine, workers } = setup();
		expect(workers).toHaveLength(0);
		const answer = engine.version();
		expect(workers).toHaveLength(1);
		workers[0]!.reply({ id: 1, result: worked('0.0.0') });
		expect(await answer).toEqual({ ok: true, value: '0.0.0' });
		void engine.version();
		expect(workers).toHaveLength(1);
	});

	it('sends the method and the arguments', () => {
		const { engine, workers } = setup();
		void engine.regexToFsm('a*b', ['a', 'b']);
		expect(workers[0]!.posted[0]).toMatchObject({
			method: 'regexToFsm',
			args: ['a*b', ['a', 'b'], { maxStates: 500 }]
		});
	});

	it('matches answers to calls by id, in any order', async () => {
		const { engine, workers } = setup();
		const first = engine.validate(machine);
		const second = engine.complement(machine);
		const [a, b] = workers[0]!.posted;
		workers[0]!.reply({ id: b!.id, result: worked('second') });
		workers[0]!.reply({ id: a!.id, result: worked('first') });
		expect(await first).toEqual(worked('first'));
		expect(await second).toEqual(worked('second'));
	});

	it('passes an error answer on as data and does not throw', async () => {
		const { engine, workers } = setup();
		const answer = engine.loadMachine('{');
		const error = { key: 'machine.json_invalid', params: {} };
		workers[0]!.reply({ id: 1, result: { ok: false, error } });
		expect(await answer).toEqual({ ok: false, error });
	});

	it('rejects only the call whose arguments cannot be sent', async () => {
		const { engine, workers } = setup();
		void engine.version();
		workers[0]!.failToSend = new Error('DataCloneError');
		await expect(engine.validate(machine)).rejects.toThrow('DataCloneError');
		expect(workers[0]!.terminated).toBe(false);
	});
});

describe('the web budgets', () => {
	it('are added when the call has no budget', () => {
		const { engine, workers } = setup();
		void engine.simulate(machine, 'ab');
		void engine.determinize(machine);
		void engine.equivalent(machine, machine);
		const [simulate, determinize, equivalent] = workers[0]!.posted;
		expect(simulate!.args[2]).toEqual(WEB_BUDGETS.simulate);
		expect(determinize!.args[1]).toEqual(WEB_BUDGETS.determinize);
		expect(equivalent!.args[2]).toEqual(WEB_BUDGETS.equivalent);
	});

	it('give way to the fields of the call, field by field', () => {
		const { engine, workers } = setup();
		void engine.simplify('a', ['a'], { maxChecks: 7 });
		expect(workers[0]!.posted[0]!.args[2]).toEqual({ maxChecks: 7, maxSteps: 5_000 });
	});

	it('are not added to a method that has no budget', () => {
		const { engine, workers } = setup();
		void engine.complement(machine);
		expect(workers[0]!.posted[0]!.args).toEqual([machine]);
	});

	it('are smaller than the engine defaults', () => {
		// The defaults of the engine: simulate 100,000 steps, determinize 2,000 states,
		// equivalent 100,000 pairs, simplify 5,000 checks and 10,000 steps.
		expect(WEB_BUDGETS.simulate.maxSteps).toBeLessThan(100_000);
		expect(WEB_BUDGETS.determinize.maxStates).toBeLessThan(2_000);
		expect(WEB_BUDGETS.equivalent.maxPairs).toBeLessThan(100_000);
		expect(WEB_BUDGETS.simplify.maxChecks).toBeLessThan(5_000);
	});
});

describe('a worker that fails', () => {
	it('fails every waiting call with EngineCrashed and is not used again', async () => {
		const { engine, workers } = setup();
		const first = engine.validate(machine);
		const second = engine.simulate(machine, 'a');
		workers[0]!.reply({ id: 1, crashed: true });
		await expect(first).rejects.toBeInstanceOf(EngineCrashed);
		await expect(second).rejects.toBeInstanceOf(EngineCrashed);
		expect(workers[0]!.terminated).toBe(true);
	});

	it('is replaced by a new worker on the next call', async () => {
		const { engine, workers } = setup();
		const lost = engine.version();
		workers[0]!.reply({ id: 1, crashed: true });
		await expect(lost).rejects.toBeInstanceOf(EngineCrashed);

		const again = engine.version();
		expect(workers).toHaveLength(2);
		workers[1]!.reply({ id: 2, result: worked('0.0.0') });
		expect(await again).toEqual(worked('0.0.0'));
	});

	it('counts an error event of the worker as a crash', async () => {
		const { engine, workers } = setup();
		const answer = engine.version();
		workers[0]!.fail();
		await expect(answer).rejects.toBeInstanceOf(EngineCrashed);
		expect(workers[0]!.terminated).toBe(true);
	});

	it('does not let a late answer of the old worker reach a new call', async () => {
		const { engine, workers } = setup();
		const lost = engine.version();
		workers[0]!.fail();
		await expect(lost).rejects.toBeInstanceOf(EngineCrashed);

		const again = engine.version(); // id 2, on a new worker
		// The old worker answers late, with the id of the new call.
		workers[0]!.reply({ id: 2, result: worked('wrong') });
		workers[1]!.reply({ id: 2, result: worked('right') });
		expect(await again).toEqual(worked('right'));
	});
});

describe('cancel', () => {
	it('fails the waiting calls with EngineCancelled and ends the worker', async () => {
		const { engine, workers } = setup();
		const first = engine.determinize(machine);
		const second = engine.minimize(machine);
		engine.cancel();
		await expect(first).rejects.toBeInstanceOf(EngineCancelled);
		await expect(second).rejects.toBeInstanceOf(EngineCancelled);
		expect(workers[0]!.terminated).toBe(true);
	});

	it('does nothing when no call is waiting and no worker has started', () => {
		const { engine, workers } = setup();
		engine.cancel();
		expect(workers).toHaveLength(0);
	});

	it('lets the next call run on a new worker', async () => {
		const { engine, workers } = setup();
		const canceled = engine.version();
		engine.cancel();
		await expect(canceled).rejects.toBeInstanceOf(EngineCancelled);

		const next = engine.version();
		expect(workers).toHaveLength(2);
		// A late answer of the canceled call does not resolve anything.
		workers[0]!.reply({ id: 1, result: worked('late') });
		workers[1]!.reply({ id: 2, result: worked('0.0.0') });
		expect(await next).toEqual(worked('0.0.0'));
	});
});

describe('the client', () => {
	it('has a method for every method of the API', () => {
		const { engine } = setup();
		for (const method of METHODS) expect(typeof engine[method]).toBe('function');
		expect(typeof engine.cancel).toBe('function');
	});
});

describe('a call that is not answered in time', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	/** The outcome of a promise as a value, so that a rejection is not left unhandled. */
	const outcome = (promise: Promise<unknown>) =>
		promise.then(
			(value) => ({ value }),
			(error: unknown) => ({ error })
		);

	/** Starts the first worker and lets it answer, so that it counts as started. */
	async function started(ctx: ReturnType<typeof setup>) {
		const first = ctx.engine.version();
		ctx.workers[0]!.reply({ id: 1, result: worked('0.0.0') });
		await first;
	}

	it('has a limit of 10 seconds for a call and 30 for the start of the worker', () => {
		expect(WEB_TIMEOUTS).toEqual({ callMs: 10_000, startMs: 30_000 });
	});

	it('fails with EngineTimeout at the limit and ends the worker', async () => {
		const ctx = setup();
		await started(ctx);
		const slow = outcome(ctx.engine.simulate(machine, 'a'));
		vi.advanceTimersByTime(9_999);
		expect(ctx.workers[0]!.terminated).toBe(false);
		vi.advanceTimersByTime(1);
		const result = await slow;
		expect(result).toMatchObject({ error: expect.any(EngineTimeout) });
		expect((result as { error: EngineTimeout }).error.timeoutMs).toBe(10_000);
		expect(ctx.workers[0]!.terminated).toBe(true);
	});

	it('lets the next call run on a new worker', async () => {
		const ctx = setup();
		await started(ctx);
		const slow = outcome(ctx.engine.simulate(machine, 'a'));
		vi.advanceTimersByTime(10_000);
		await slow;
		const next = ctx.engine.version();
		expect(ctx.workers).toHaveLength(2);
		ctx.workers[1]!.reply({ id: 3, result: worked('0.0.0') });
		expect(await next).toEqual(worked('0.0.0'));
	});

	it('does not time out a call that was answered', async () => {
		const ctx = setup();
		await started(ctx);
		const quick = ctx.engine.validate(machine);
		ctx.workers[0]!.reply({ id: 2, result: worked([]) });
		await quick;
		// The clock of an answered call is stopped, not just ignored.
		expect(vi.getTimerCount()).toBe(0);
		vi.advanceTimersByTime(120_000);
		expect(ctx.workers[0]!.terminated).toBe(false);
		expect(ctx.workers).toHaveLength(1);
	});

	it('gives a call before the first answer 30 seconds, for loading the WASM file', async () => {
		const ctx = setup();
		const first = outcome(ctx.engine.version());
		vi.advanceTimersByTime(29_999);
		expect(ctx.workers[0]!.terminated).toBe(false);
		vi.advanceTimersByTime(1);
		const result = await first;
		expect((result as { error: EngineTimeout }).error).toBeInstanceOf(EngineTimeout);
		expect((result as { error: EngineTimeout }).error.timeoutMs).toBe(30_000);
	});

	it('uses the short limit for a call sent after the first answer', async () => {
		const ctx = setup();
		const first = ctx.engine.version(); // id 1, sent before any answer
		const early = outcome(ctx.engine.validate(machine)); // id 2, sent before any answer too
		ctx.workers[0]!.reply({ id: 1, result: worked('0.0.0') });
		await first;
		const late = outcome(ctx.engine.complement(machine)); // id 3, after the first answer
		vi.advanceTimersByTime(10_000);
		expect(await late).toMatchObject({ error: expect.any(EngineTimeout) });
		// The worker was ended, so the early call is sent again, with a new start allowance.
		expect(ctx.workers).toHaveLength(2);
		ctx.workers[1]!.reply({ id: 2, result: worked([]) });
		expect(await early).toEqual({ value: worked([]) });
	});

	it('sends the other waiting calls again to the new worker, and they finish', async () => {
		const ctx = setup();
		await started(ctx);
		const stuck = outcome(ctx.engine.simulate(machine, 'a')); // id 2
		vi.advanceTimersByTime(5_000);
		const innocent = outcome(ctx.engine.validate(machine)); // id 3, sent 5 s later
		vi.advanceTimersByTime(5_000);
		expect(await stuck).toMatchObject({ error: expect.any(EngineTimeout) });
		expect(ctx.workers).toHaveLength(2);
		expect(ctx.workers[1]!.posted).toEqual([ctx.workers[0]!.posted[2]]);
		ctx.workers[1]!.reply({ id: 3, result: worked(['fine']) });
		expect(await innocent).toEqual({ value: worked(['fine']) });
	});

	it('times out a call that was sent again and hangs again, by itself', async () => {
		const ctx = setup();
		await started(ctx);
		const stuck = outcome(ctx.engine.simulate(machine, 'a')); // id 2
		const alsoStuck = outcome(ctx.engine.validate(machine)); // id 3
		vi.advanceTimersByTime(10_000);
		expect(await stuck).toMatchObject({ error: expect.any(EngineTimeout) });
		// id 3 has a new clock on the new worker, which has not answered yet: 30 seconds.
		vi.advanceTimersByTime(29_999);
		expect(ctx.workers[1]!.terminated).toBe(false);
		vi.advanceTimersByTime(1);
		expect(await alsoStuck).toMatchObject({ error: expect.any(EngineTimeout) });
		expect(ctx.workers[1]!.terminated).toBe(true);
		expect(ctx.workers).toHaveLength(2); // a worker starts again only on the next call
	});

	it('ignores a late answer of the worker that was ended', async () => {
		const ctx = setup();
		await started(ctx);
		const stuck = outcome(ctx.engine.simulate(machine, 'a')); // id 2
		vi.advanceTimersByTime(10_000);
		await stuck;
		const next = ctx.engine.version(); // id 3, new worker
		ctx.workers[0]!.reply({ id: 3, result: worked('wrong') });
		ctx.workers[1]!.reply({ id: 3, result: worked('right') });
		expect(await next).toEqual(worked('right'));
	});

	it('stops the timers when the calls are canceled', async () => {
		const ctx = setup();
		await started(ctx);
		const canceled = outcome(ctx.engine.simulate(machine, 'a'));
		ctx.engine.cancel();
		expect(await canceled).toMatchObject({ error: expect.any(EngineCancelled) });
		vi.advanceTimersByTime(120_000);
		expect(ctx.workers).toHaveLength(1);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('stops the timers when the worker crashes', async () => {
		const ctx = setup();
		await started(ctx);
		const lost = outcome(ctx.engine.simulate(machine, 'a'));
		ctx.workers[0]!.fail();
		expect(await lost).toMatchObject({ error: expect.any(EngineCrashed) });
		expect(vi.getTimerCount()).toBe(0);
	});

	it('takes other limits as an option, and falls back to the defaults for a bad value', async () => {
		const custom = setup({ callMs: 50, startMs: 100 });
		await started(custom);
		const quick = outcome(custom.engine.simulate(machine, 'a'));
		vi.advanceTimersByTime(50);
		expect(await quick).toMatchObject({ error: expect.any(EngineTimeout) });

		const bad = setup({ callMs: -1, startMs: Number.NaN });
		await started(bad);
		const slow = outcome(bad.engine.simulate(machine, 'a'));
		vi.advanceTimersByTime(9_999);
		expect(bad.workers[0]!.terminated).toBe(false);
		vi.advanceTimersByTime(1);
		expect(await slow).toMatchObject({ error: expect.any(EngineTimeout) });
	});
});
