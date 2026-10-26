import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	LayoutCancelled,
	LayoutFailed,
	LayoutTimeout,
	createLayoutClient
} from './layout-client.ts';
import type { LayoutReply, LayoutWorkerLike } from './layout-client.ts';
import type { LayoutGraph } from './layout.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const graph: LayoutGraph = { nodes: [0, 1], edges: [{ from: 0, to: 1 }], start: 0 };

class FakeWorker implements LayoutWorkerLike {
	onmessage: ((event: { data: LayoutReply }) => void) | null = null;
	onerror: (() => void) | null = null;
	posted: { id: number; graph: LayoutGraph }[] = [];
	terminated = false;
	postMessage(message: unknown) {
		this.posted.push(message as { id: number; graph: LayoutGraph });
	}
	terminate() {
		this.terminated = true;
	}
	reply(data: LayoutReply) {
		this.onmessage?.({ data });
	}
}

function setup(timeoutMs = 5000) {
	const workers: FakeWorker[] = [];
	const client = createLayoutClient(() => {
		const worker = new FakeWorker();
		workers.push(worker);
		return worker;
	}, timeoutMs);
	return { client, workers };
}

describe('the layout client', () => {
	it('starts the worker on the first call, sends the graph, and gives the places back', async () => {
		const { client, workers } = setup();
		expect(workers).toHaveLength(0);
		const pending = client.run(graph);
		expect(workers).toHaveLength(1);
		const [sent] = workers[0]!.posted;
		expect(sent!.graph).toEqual(graph);
		workers[0]!.reply({ id: sent!.id, positions: [{ id: 0, x: 1, y: 2 }] });
		await expect(pending).resolves.toEqual([{ id: 0, x: 1, y: 2 }]);
	});

	it('keeps the worker for the next call', async () => {
		const { client, workers } = setup();
		const first = client.run(graph);
		workers[0]!.reply({ id: workers[0]!.posted[0]!.id, positions: [] });
		await first;
		const second = client.run(graph);
		expect(workers).toHaveLength(1);
		workers[0]!.reply({ id: workers[0]!.posted[1]!.id, positions: [] });
		await second;
	});

	it('a call that takes too long fails, the worker is ended, and the next call has a new one', async () => {
		const { client, workers } = setup(5000);
		const slow = client.run(graph);
		const caught = slow.catch((e) => e);
		await vi.advanceTimersByTimeAsync(5001);
		expect(await caught).toBeInstanceOf(LayoutTimeout);
		expect(workers[0]!.terminated).toBe(true);
		void client.run(graph).catch(() => {});
		expect(workers).toHaveLength(2);
		client.cancel();
	});

	it('an answer with an error, or an error of the worker, is a failure that the page can show', async () => {
		const { client, workers } = setup();
		const bad = client.run(graph);
		const caught = bad.catch((e) => e);
		workers[0]!.reply({ id: workers[0]!.posted[0]!.id, error: 'failed' });
		expect(await caught).toBeInstanceOf(LayoutFailed);

		const crash = client.run(graph);
		const caught2 = crash.catch((e) => e);
		workers[0]!.onerror?.();
		expect(await caught2).toBeInstanceOf(LayoutFailed);
		expect(workers[0]!.terminated).toBe(true);
	});

	it('a browser that cannot start the worker is a failure, not a crash', async () => {
		const client = createLayoutClient(() => {
			throw new Error('no workers');
		});
		await expect(client.run(graph)).rejects.toBeInstanceOf(LayoutFailed);
	});

	it('cancel ends the call that is waiting, and a late answer is ignored', async () => {
		const { client, workers } = setup();
		const pending = client.run(graph);
		const caught = pending.catch((e) => e);
		const id = workers[0]!.posted[0]!.id;
		client.cancel();
		expect(await caught).toBeInstanceOf(LayoutCancelled);
		// The worker is ended, so an old answer cannot reach a new call.
		expect(workers[0]!.terminated).toBe(true);
		workers[0]!.reply({ id, positions: [] });
	});

	it('a new call cancels the one that is waiting', async () => {
		const { client, workers } = setup();
		const first = client.run(graph);
		const caught = first.catch((e) => e);
		const second = client.run(graph);
		expect(await caught).toBeInstanceOf(LayoutCancelled);
		const worker = workers[workers.length - 1]!;
		worker.reply({
			id: worker.posted[worker.posted.length - 1]!.id,
			positions: [{ id: 1, x: 0, y: 0 }]
		});
		await expect(second).resolves.toEqual([{ id: 1, x: 0, y: 0 }]);
	});

	it('an answer for an older call is not the answer of the new one', async () => {
		const { client, workers } = setup();
		const first = client.run(graph);
		void first.catch(() => {});
		const second = client.run(graph);
		const worker = workers[workers.length - 1]!;
		const [a, b] = [worker.posted[0], worker.posted[worker.posted.length - 1]];
		if (a && a !== b) worker.reply({ id: a.id, positions: [{ id: 9, x: 9, y: 9 }] });
		worker.reply({ id: b!.id, positions: [{ id: 1, x: 1, y: 1 }] });
		await expect(second).resolves.toEqual([{ id: 1, x: 1, y: 1 }]);
	});

	it('leaves no timer behind when it is done', async () => {
		const { client, workers } = setup();
		const pending = client.run(graph);
		workers[0]!.reply({ id: workers[0]!.posted[0]!.id, positions: [] });
		await pending;
		expect(vi.getTimerCount()).toBe(0);
	});
});
