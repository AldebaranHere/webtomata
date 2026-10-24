// The contract of a store. The same tests run against the real IndexedDB in the browser tests
// (e2e/cross/storage.spec.ts); here they run against the in-memory store that the unit tests use.
import { describe, expect, it } from 'vitest';
import { createMemoryStore } from './memory.ts';
import type { SavedMachine } from './store.ts';

const rec = (id: string, title = 'T'): SavedMachine => ({
	id,
	recordVersion: 1,
	title,
	kind: 'dfsm',
	createdAt: 1,
	updatedAt: 2,
	openedAt: 3,
	doc: '{}'
});

describe('the memory store', () => {
	it('is empty at first, and keeps what is put', async () => {
		const store = createMemoryStore();
		expect(await store.list()).toEqual([]);
		await store.put(rec('a'));
		expect(await store.get('a')).toEqual(rec('a'));
		expect(await store.get('zzz')).toBeUndefined();
	});

	it('put with an id that exists replaces the record', async () => {
		const store = createMemoryStore();
		await store.put(rec('a', 'one'));
		await store.put(rec('a', 'two'));
		expect((await store.list()).map((r) => r.title)).toEqual(['two']);
	});

	it('gives copies: a change to what was read does not change the store', async () => {
		const store = createMemoryStore();
		await store.put(rec('a'));
		const read = (await store.get('a'))!;
		read.title = 'changed';
		expect((await store.get('a'))!.title).toBe('T');
	});

	it('delete removes one record, and a record that is not there is not an error', async () => {
		const store = createMemoryStore();
		await store.put(rec('a'));
		await store.put(rec('b'));
		await store.delete('a');
		await store.delete('zzz');
		expect((await store.list()).map((r) => r.id)).toEqual(['b']);
	});

	it('lists in the order of the ids, so that the result is the same every time', async () => {
		const store = createMemoryStore();
		for (const id of ['c', 'a', 'b']) await store.put(rec(id));
		expect((await store.list()).map((r) => r.id)).toEqual(['a', 'b', 'c']);
	});
});
