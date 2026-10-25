import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyCommand } from '../editor/commands.ts';
import { endsWith01 } from '../editor/diagram/samples.ts';
import { serializeDocument } from '../editor/document.ts';
import type { MachineDocument } from '../editor/document.ts';
import {
	createPendingDeletes,
	deleteStored,
	duplicateMachine,
	listEntries,
	relativeTime,
	renameStored
} from './library.ts';
import { createMachine } from './machines.ts';
import { createMemoryStore } from './memory.ts';
import type { SavedMachine } from './store.ts';

const titled = (doc: MachineDocument, title: string): MachineDocument => {
	const result = applyCommand(doc, { type: 'setTitle', title });
	if (!result.ok) throw new Error(result.error.key);
	return result.doc;
};

async function withMachines() {
	const store = createMemoryStore();
	const a = await createMachine(store, titled(endsWith01(), 'A'), () => 100);
	const b = await createMachine(store, titled(endsWith01(), 'B'), () => 300);
	const c = await createMachine(store, titled(endsWith01(), 'C'), () => 200);
	return { store, a, b, c };
}

describe('listEntries', () => {
	it('lists the machines, the one opened last first, with what a row needs', async () => {
		const { store, a, b, c } = await withMachines();
		const entries = await listEntries(store);
		expect(entries.map((e) => e.id)).toEqual([b.id, c.id, a.id]);
		expect(entries[0]).toMatchObject({
			title: 'B',
			kind: 'dfsm',
			readable: true,
			updatedAt: 300,
			openedAt: 300
		});
	});

	it('shows a machine that cannot be read as unreadable, with the reason, and keeps it', async () => {
		const { store, a } = await withMachines();
		const bad: SavedMachine = { ...a, id: 'bad', title: 'Rusak', openedAt: 9999, doc: '{"x' };
		await store.put(bad);
		const entries = await listEntries(store);
		expect(entries[0]).toMatchObject({
			id: 'bad',
			title: 'Rusak',
			readable: false,
			reason: 'corrupt'
		});
		expect(await store.get('bad')).toEqual(bad);
	});
});

describe('duplicateMachine', () => {
	it('makes a copy with a new id and the title "… (salinan)", right under the original in the list', async () => {
		const { store, b } = await withMachines();
		const copy = await duplicateMachine(store, b.id, () => 1000);
		expect(copy).toBeDefined();
		expect(copy!.id).not.toBe(b.id);
		expect(copy!.title).toBe('B (salinan)');
		expect(JSON.parse(copy!.doc).title).toBe('B (salinan)');
		expect(copy).toMatchObject({ createdAt: 1000, updatedAt: 1000, openedAt: b.openedAt - 1 });
		// The original is not changed.
		expect(await store.get(b.id)).toEqual(b);
		const order = (await listEntries(store)).map((e) => e.id);
		expect(order.indexOf(copy!.id)).toBe(order.indexOf(b.id) + 1);
	});

	it('keeps the title inside the limit of the document', async () => {
		const store = createMemoryStore();
		const long = await createMachine(store, titled(endsWith01(), 'x'.repeat(100)), () => 1);
		const copy = await duplicateMachine(store, long.id, () => 2);
		expect(copy!.title.length).toBeLessThanOrEqual(100);
		expect(copy!.title.endsWith('(salinan)')).toBe(true);
	});

	it('does nothing for a machine that is gone or cannot be read', async () => {
		const { store, a } = await withMachines();
		await store.put({ ...a, id: 'bad', doc: 'nope' });
		expect(await duplicateMachine(store, 'zzz', () => 1)).toBeUndefined();
		expect(await duplicateMachine(store, 'bad', () => 1)).toBeUndefined();
		expect(await store.list()).toHaveLength(4);
	});
});

describe('renameStored', () => {
	it('changes the title in the record and in the document, and the time of the change', async () => {
		const { store, b } = await withMachines();
		expect(await renameStored(store, b.id, 'Baru', () => 5000)).toBeNull();
		const saved = (await store.get(b.id))!;
		expect(saved.title).toBe('Baru');
		expect(JSON.parse(saved.doc).title).toBe('Baru');
		expect(saved.updatedAt).toBe(5000);
		expect(saved.openedAt).toBe(b.openedAt);
	});

	it('refuses a title that the document refuses, and changes nothing', async () => {
		const { store, b } = await withMachines();
		const problem = await renameStored(store, b.id, 'x'.repeat(101), () => 5000);
		expect(problem).toMatchObject({ key: 'document.invalid_title' });
		expect(await store.get(b.id)).toEqual(b);
	});

	it('does not touch a machine that cannot be read', async () => {
		const { store, a } = await withMachines();
		const bad = { ...a, id: 'bad', doc: 'nope' };
		await store.put(bad);
		expect(await renameStored(store, 'bad', 'Baru', () => 1)).toMatchObject({
			key: 'library.unreadable'
		});
		expect(await store.get('bad')).toEqual(bad);
	});
});

describe('deleteStored', () => {
	it('removes one machine and only that one', async () => {
		const { store, a, b, c } = await withMachines();
		await deleteStored(store, c.id);
		expect((await store.list()).map((r) => r.id).sort()).toEqual([a.id, b.id].sort());
	});
});

describe('pending deletes (delete with Urungkan)', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => vi.useRealTimers());

	it('hides the machine at once and removes it for good after 6 seconds', async () => {
		const { store, b } = await withMachines();
		let changes = 0;
		const pending = createPendingDeletes({ store, onChange: () => changes++ });
		pending.begin(b.id);
		expect(pending.isPending(b.id)).toBe(true);
		await vi.advanceTimersByTimeAsync(5999);
		expect(await store.get(b.id)).toBeDefined();
		await vi.advanceTimersByTimeAsync(2);
		expect(await store.get(b.id)).toBeUndefined();
		expect(pending.isPending(b.id)).toBe(false);
		expect(changes).toBeGreaterThanOrEqual(2);
	});

	it('undo within the time keeps the machine, untouched', async () => {
		const { store, b } = await withMachines();
		const pending = createPendingDeletes({ store, onChange: () => {} });
		pending.begin(b.id);
		await vi.advanceTimersByTimeAsync(3000);
		pending.undo(b.id);
		expect(pending.isPending(b.id)).toBe(false);
		await vi.advanceTimersByTimeAsync(10_000);
		expect(await store.get(b.id)).toEqual(b);
	});

	it('several machines can wait at once, each with its own time', async () => {
		const { store, a, b } = await withMachines();
		const pending = createPendingDeletes({ store, onChange: () => {} });
		pending.begin(a.id);
		await vi.advanceTimersByTimeAsync(4000);
		pending.begin(b.id);
		await vi.advanceTimersByTimeAsync(2500);
		expect(await store.get(a.id)).toBeUndefined();
		expect(await store.get(b.id)).toBeDefined();
		expect(pending.ids()).toEqual([b.id]);
	});

	it('a machine that cannot be removed comes back to the list', async () => {
		const { store, b } = await withMachines();
		const broken = {
			...store,
			delete: async () => {
				throw new Error('denied');
			}
		};
		const pending = createPendingDeletes({ store: broken, onChange: () => {} });
		pending.begin(b.id);
		await vi.advanceTimersByTimeAsync(7000);
		expect(pending.isPending(b.id)).toBe(false);
		expect(await store.get(b.id)).toBeDefined();
	});

	it('closing the page does not delete: nothing is removed unless the time ends', async () => {
		const { store, b } = await withMachines();
		const pending = createPendingDeletes({ store, onChange: () => {} });
		pending.begin(b.id);
		pending.dispose();
		await vi.advanceTimersByTimeAsync(20_000);
		expect(await store.get(b.id)).toEqual(b);
	});
});

describe('relativeTime', () => {
	const now = 1_000_000_000;
	const minute = 60_000;
	it('says how long ago, in the biggest whole unit', () => {
		expect(relativeTime(now - 20_000, now)).toEqual({ key: 'library.when_now', n: 0 });
		expect(relativeTime(now - 2 * minute, now)).toEqual({ key: 'library.when_minutes', n: 2 });
		expect(relativeTime(now - 59 * minute, now)).toEqual({ key: 'library.when_minutes', n: 59 });
		expect(relativeTime(now - 90 * minute, now)).toEqual({ key: 'library.when_hours', n: 1 });
		expect(relativeTime(now - 5 * 60 * minute, now)).toEqual({ key: 'library.when_hours', n: 5 });
		expect(relativeTime(now - 30 * 60 * minute, now)).toEqual({
			key: 'library.when_yesterday',
			n: 1
		});
		expect(relativeTime(now - 3 * 24 * 60 * minute, now)).toEqual({
			key: 'library.when_days',
			n: 3
		});
		expect(relativeTime(now - 40 * 24 * 60 * minute, now)).toEqual({
			key: 'library.when_long',
			n: 40
		});
	});

	it('a time in the future (a clock that was set back) is "just now"', () => {
		expect(relativeTime(now + 5 * minute, now)).toEqual({ key: 'library.when_now', n: 0 });
	});

	it('uses only what is given, so that the same input gives the same text', () => {
		expect(serializeDocument(endsWith01())).toBe(serializeDocument(endsWith01()));
		expect(relativeTime(0, 5 * minute)).toEqual(relativeTime(0, 5 * minute));
	});
});
