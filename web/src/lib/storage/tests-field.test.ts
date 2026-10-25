import { describe, expect, it } from 'vitest';
import { endsWith01 } from '../editor/diagram/samples.ts';
import { duplicateMachine, listEntries, renameStored } from './library.ts';
import { createMachine, openLatest } from './machines.ts';
import { createMemoryStore } from './memory.ts';
import type { SavedMachine } from './store.ts';

// Every place that makes a record from another one must keep the test strings (S6-3): a list that
// vanishes without a word is the worst way to lose work.

async function withTests(tests: unknown) {
	const store = createMemoryStore();
	const made = await createMachine(store, endsWith01(), () => 100);
	const record = { ...made, tests } as SavedMachine;
	await store.put(record);
	return { store, record };
}

describe('the test strings in the record', () => {
	it('a new machine has none', async () => {
		const store = createMemoryStore();
		const record = await createMachine(store, endsWith01(), () => 1);
		expect(Object.hasOwn(record, 'tests')).toBe(false);
	});

	it('are copied by a duplicate, and the copy is its own list', async () => {
		const { store, record } = await withTests(['01', '110']);
		const copy = await duplicateMachine(store, record.id, () => 5);
		expect(copy?.tests).toEqual(['01', '110']);
		expect((await store.get(copy!.id))!.tests).toEqual(['01', '110']);
		expect(copy!.tests).not.toBe(record.tests);
	});

	it('are kept by a duplicate of a machine that has none', async () => {
		const { store, record } = await withTests(undefined);
		const copy = await duplicateMachine(store, record.id, () => 5);
		expect(Object.hasOwn(copy!, 'tests')).toBe(false);
	});

	it('are cleaned in a duplicate when the saved field was bad', async () => {
		const { store, record } = await withTests('oops');
		const copy = await duplicateMachine(store, record.id, () => 5);
		expect(Object.hasOwn(copy!, 'tests')).toBe(false);
	});

	it('are kept by a rename of a machine that is not open', async () => {
		const { store, record } = await withTests(['0']);
		expect(await renameStored(store, record.id, 'Baru', () => 9)).toBeNull();
		expect((await store.get(record.id))!.tests).toEqual(['0']);
	});

	it('are kept when the machine is opened, and the open does not change them', async () => {
		const { store } = await withTests(['1', '']);
		const opened = await openLatest(
			store,
			() => ({ doc: endsWith01() }),
			() => 7
		);
		expect(opened.record.tests).toEqual(['1', '']);
	});

	it('a machine with a bad field is still in the list and still opens', async () => {
		const { store, record } = await withTests({ nope: true });
		const entries = await listEntries(store);
		expect(entries).toHaveLength(1);
		expect(entries[0]!.readable).toBe(true);
		const opened = await openLatest(
			store,
			() => ({ doc: endsWith01() }),
			() => 7
		);
		expect(opened.record.id).toBe(record.id);
		// Reading is not writing: the store still holds what it held.
		expect((await store.get(record.id))!.tests).toEqual({ nope: true });
	});
});
