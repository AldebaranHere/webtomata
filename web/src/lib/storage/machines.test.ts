import { describe, expect, it } from 'vitest';
import { endsWith01 } from '../editor/diagram/samples.ts';
import { serializeDocument } from '../editor/document.ts';
import type { MachineDocument } from '../editor/document.ts';
import { createMachine, openLatest } from './machines.ts';
import { createMemoryStore } from './memory.ts';
import type { SavedMachine } from './store.ts';

const sample = () => ({ doc: endsWith01() });

const saved = (
	id: string,
	doc: MachineDocument,
	openedAt: number,
	text?: string
): SavedMachine => ({
	id,
	recordVersion: 1,
	title: doc.title,
	kind: doc.kind,
	createdAt: 1,
	updatedAt: openedAt,
	openedAt,
	doc: text ?? serializeDocument(doc)
});

describe('openLatest', () => {
	it('with nothing saved, saves the sample as the first machine and opens it', async () => {
		const store = createMemoryStore();
		const opened = await openLatest(store, sample, () => 500);
		expect(opened.skipped).toEqual([]);
		expect(opened.doc.title).toBe('Berakhiran 01');
		const all = await store.list();
		expect(all).toHaveLength(1);
		expect(all[0]).toMatchObject({ id: opened.record.id, createdAt: 500, openedAt: 500 });
	});

	it('opens the machine that was opened last, and marks it as opened now', async () => {
		const store = createMemoryStore();
		const a = endsWith01();
		await store.put(saved('a', a, 100));
		await store.put(saved('b', { ...a, title: 'B' }, 300));
		await store.put(saved('c', { ...a, title: 'C' }, 200));
		const opened = await openLatest(store, sample, () => 900);
		expect(opened.record.id).toBe('b');
		expect(opened.doc.title).toBe('B');
		expect((await store.get('b'))!.openedAt).toBe(900);
		expect((await store.get('a'))!.openedAt).toBe(100);
	});

	it('skips a machine that cannot be read, opens the next one, and keeps the bad one untouched', async () => {
		const store = createMemoryStore();
		const a = endsWith01();
		await store.put(saved('good', a, 100));
		await store.put(saved('bad', { ...a, title: 'Rusak' }, 300, '{"broken'));
		const opened = await openLatest(store, sample, () => 900);
		expect(opened.record.id).toBe('good');
		expect(opened.skipped).toEqual([{ id: 'bad', title: 'Rusak', reason: 'corrupt' }]);
		expect(await store.get('bad')).toEqual(saved('bad', { ...a, title: 'Rusak' }, 300, '{"broken'));
	});

	it('a machine of a newer version is skipped as newer, and kept', async () => {
		const store = createMemoryStore();
		const a = endsWith01();
		const future = JSON.stringify({ ...JSON.parse(serializeDocument(a)), schemaVersion: 2 });
		await store.put(saved('future', a, 300, future));
		const opened = await openLatest(store, sample, () => 900);
		expect(opened.skipped).toEqual([{ id: 'future', title: a.title, reason: 'newer' }]);
		expect(opened.record.id).not.toBe('future');
		expect((await store.get('future'))!.doc).toBe(future);
		expect(await store.list()).toHaveLength(2);
	});

	it('when every machine is unreadable, a new one is made, and none is deleted', async () => {
		const store = createMemoryStore();
		const a = endsWith01();
		await store.put(saved('x', a, 100, 'nope'));
		await store.put(saved('y', a, 200, '{}'));
		const opened = await openLatest(store, sample, () => 900);
		expect(opened.skipped.map((s) => s.id).sort()).toEqual(['x', 'y']);
		expect((await store.list()).map((r) => r.id).sort()).toEqual(
			['x', 'y', opened.record.id].sort()
		);
	});

	it('still opens a machine if marking it as opened fails', async () => {
		const memory = createMemoryStore();
		await memory.put(saved('a', endsWith01(), 100));
		const store = {
			...memory,
			put: async () => {
				throw new Error('denied');
			}
		};
		const opened = await openLatest(store, sample, () => 900);
		expect(opened.record.id).toBe('a');
	});

	it('is the same for the same store (the order of equal times is by id)', async () => {
		const store = createMemoryStore();
		const a = endsWith01();
		await store.put(saved('b', a, 100));
		await store.put(saved('a', a, 100));
		expect((await openLatest(store, sample, () => 900)).record.id).toBe('a');
	});
});

describe('createMachine', () => {
	it('saves a document under a new id, with its dates', async () => {
		const store = createMemoryStore();
		const record = await createMachine(store, endsWith01(), () => 42);
		expect(record).toMatchObject({ recordVersion: 1, createdAt: 42, updatedAt: 42, openedAt: 42 });
		expect(record.id).toMatch(/\S{8,}/);
		expect(await store.get(record.id)).toEqual(record);
	});
});
