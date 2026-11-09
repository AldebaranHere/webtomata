import { describe, expect, it } from 'vitest';
import { endsWith01 } from '../editor/diagram/samples.ts';
import { LIMITS } from '../editor/document.ts';
import { anbnSample, wwrSample } from '../editor/pda-samples.ts';
import { listEntries } from './library.ts';
import { createMachine } from './machines.ts';
import { createMemoryStore } from './memory.ts';
import { createPdaMachine, duplicatePdaMachine, renamePdaStored } from './pda-work.ts';
import type { SavedPdaMachine } from './store.ts';

describe('pda-library: listEntries (F1, F2, F6)', () => {
	it('F1: lists FSM and PDA records together, sorted by openedAt desc, with type and kind chip', async () => {
		const store = createMemoryStore();
		// FSM opened at 100
		const fsm = await createMachine(store, endsWith01(), () => 100);
		// PDA wwR (NDPDA) opened at 200
		const pda1 = await createPdaMachine(store, wwrSample(), () => 200);
		// PDA anbn (DPDA) opened at 150
		const pda2 = await createPdaMachine(store, anbnSample(), () => 150);
		// Question record that must be excluded
		await store.put({
			...fsm,
			id: 'soal:q1',
			openedAt: 300
		});

		const entries = await listEntries(store);
		expect(entries).toHaveLength(3);
		expect(entries.map((e) => e.id)).toEqual([pda1.id, pda2.id, fsm.id]);

		expect(entries[0]).toMatchObject({
			id: pda1.id,
			type: 'pda',
			kind: 'ndpda',
			readable: true,
			openedAt: 200
		});
		expect(entries[1]).toMatchObject({
			id: pda2.id,
			type: 'pda',
			kind: 'dpda',
			readable: true,
			openedAt: 150
		});
		expect(entries[2]).toMatchObject({
			id: fsm.id,
			type: 'fsm',
			kind: 'dfsm',
			readable: true,
			openedAt: 100
		});
	});

	it('F2: returns identical entries for an FSM-only store as before', async () => {
		const store = createMemoryStore();
		const fsm1 = await createMachine(store, endsWith01(), () => 50);
		const fsm2 = await createMachine(store, endsWith01(), () => 100);

		const entries = await listEntries(store);
		expect(entries).toHaveLength(2);
		expect(entries[0]!.id).toBe(fsm2.id);
		expect(entries[1]!.id).toBe(fsm1.id);
		expect(entries[0]!.kind).toBe('dfsm');
		expect(entries[0]!.readable).toBe(true);
	});

	it('F6: shows corrupt PDA record as unreadable, keeps doc text intact across actions', async () => {
		const store = createMemoryStore();
		const pda = await createPdaMachine(store, wwrSample(), () => 100);
		const badDocText = '{"schemaVersion":1,"invalid';
		const bad: SavedPdaMachine = {
			id: 'bad-pda',
			recordVersion: 1,
			type: 'pda',
			kind: 'ndpda',
			title: 'PDA Rusak',
			createdAt: 200,
			updatedAt: 200,
			openedAt: 200,
			doc: badDocText
		};
		await store.put(bad);

		const entries = await listEntries(store);
		expect(entries).toHaveLength(2);
		const corruptEntry = entries.find((e) => e.id === 'bad-pda');
		expect(corruptEntry).toBeDefined();
		expect(corruptEntry).toMatchObject({
			id: 'bad-pda',
			type: 'pda',
			kind: 'ndpda',
			title: 'PDA Rusak',
			readable: false,
			reason: 'corrupt'
		});

		// Action on another row does not change or erase the bad record
		await renamePdaStored(store, pda.id, 'Baru');
		const storedBad = await store.get('bad-pda');
		expect(storedBad).toBeDefined();
		expect(storedBad!.doc).toBe(badDocText);
	});
});

describe('pda-library: duplicatePdaMachine and renamePdaStored (F4)', () => {
	it('duplicates a PDA with "(salinan)" suffix, openedAt - 1, and type "pda"', async () => {
		const store = createMemoryStore();
		const original = await createPdaMachine(store, anbnSample(), () => 500);

		const copy = await duplicatePdaMachine(store, original.id, () => 600);
		expect(copy).toBeDefined();
		expect(copy!.id).not.toBe(original.id);
		expect(copy!.type).toBe('pda');
		expect(copy!.kind).toBe('dpda');
		expect(copy!.title).toBe(`${anbnSample().title} (salinan)`);
		expect(copy!.openedAt).toBe(original.openedAt - 1);
		expect(copy!.createdAt).toBe(600);
		expect(copy!.updatedAt).toBe(600);

		// Original record is untouched
		const fetchedOriginal = await store.get(original.id);
		expect(fetchedOriginal).toEqual(original);

		// Sorted order puts copy right under original
		const entries = await listEntries(store);
		expect(entries.map((e) => e.id)).toEqual([original.id, copy!.id]);
	});

	it('truncates title before "(salinan)" if close to limit', async () => {
		const store = createMemoryStore();
		const longTitle = 'P'.repeat(LIMITS.titleChars);
		const doc = { ...anbnSample(), title: longTitle };
		const original = await createPdaMachine(store, doc, () => 500);

		const copy = await duplicatePdaMachine(store, original.id, () => 600);
		expect(copy).toBeDefined();
		expect(copy!.title.length).toBeLessThanOrEqual(LIMITS.titleChars);
		expect(copy!.title.endsWith(' (salinan)')).toBe(true);
	});

	it('duplicate returns undefined if record does not exist or is unreadable', async () => {
		const store = createMemoryStore();
		expect(await duplicatePdaMachine(store, 'missing', () => 600)).toBeUndefined();

		const corrupt: SavedPdaMachine = {
			id: 'bad',
			recordVersion: 1,
			type: 'pda',
			kind: 'ndpda',
			title: 'Bad',
			createdAt: 100,
			updatedAt: 100,
			openedAt: 100,
			doc: '{not json'
		};
		await store.put(corrupt);
		expect(await duplicatePdaMachine(store, 'bad', () => 600)).toBeUndefined();
	});

	it('renames a stored PDA machine title and updates document doc text', async () => {
		const store = createMemoryStore();
		const pda = await createPdaMachine(store, wwrSample(), () => 100);

		const problem = await renamePdaStored(store, pda.id, 'Nama Baru', () => 300);
		expect(problem).toBeNull();

		const updated = (await store.get(pda.id)) as SavedPdaMachine;
		expect(updated.title).toBe('Nama Baru');
		expect(updated.updatedAt).toBe(300);

		const entries = await listEntries(store);
		expect(entries[0]!.title).toBe('Nama Baru');
	});

	it('refuses invalid title when renaming stored PDA', async () => {
		const store = createMemoryStore();
		const pda = await createPdaMachine(store, wwrSample(), () => 100);

		const tooLong = 'A'.repeat(LIMITS.titleChars + 1);
		const problem = await renamePdaStored(store, pda.id, tooLong, () => 300);
		expect(problem).not.toBeNull();
		expect(problem!.key).toBe('document.invalid_title');
		expect(problem!.params).toMatchObject({ reason: 'too_long' });

		const unchanged = await store.get(pda.id);
		expect(unchanged!.title).toBe(wwrSample().title);
	});

	it('rename returns library.missing if id does not exist', async () => {
		const store = createMemoryStore();
		const problem = await renamePdaStored(store, 'nonexistent', 'Title');
		expect(problem).toEqual({ key: 'library.missing', params: {} });
	});
});
