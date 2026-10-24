import { describe, expect, it } from 'vitest';
import { EngineCancelled, EngineCrashed, WEB_BUDGETS, createEngine } from './client.ts';
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

function setup() {
	const workers: FakeWorker[] = [];
	const engine = createEngine(() => {
		const worker = new FakeWorker();
		workers.push(worker);
		return worker;
	});
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
