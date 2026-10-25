import { describe, expect, it } from 'vitest';
import { applyCommand } from '../editor/commands.ts';
import { createDocument, serializeDocument } from '../editor/document.ts';
import { buildExample, EXAMPLES } from '../examples/examples.ts';
import { createMachine, placeExample } from './machines.ts';
import { createMemoryStore } from './memory.ts';
import type { MachineStore } from './store.ts';

// Opening an example from the first-run card: an empty machine that the student has not touched
// becomes the example, in place (so that "Mesin saya" has no empty machine left behind), and
// anything else is never overwritten: the example gets a machine of its own.

const example = () => buildExample(EXAMPLES[0]!, 'id');

async function emptyMachine() {
	const store = createMemoryStore();
	const record = await createMachine(store, createDocument(), () => 100);
	return { store, record };
}

describe('placing an example', () => {
	it('replaces an empty machine in place: same id and creation time, the content of the example', async () => {
		const { store, record } = await emptyMachine();
		const placed = await placeExample(store, record.id, example(), () => 500);
		expect(placed.replaced).toBe(true);
		expect(placed.record).toMatchObject({
			id: record.id,
			createdAt: 100,
			updatedAt: 500,
			openedAt: 500,
			title: 'Berakhiran 01',
			kind: 'dfsm',
			titles: { id: 'Berakhiran 01', en: 'Ending in 01' }
		});
		expect(placed.record.tests).toEqual(example().tests);
		expect(placed.record.doc).toBe(serializeDocument(example().doc));
		expect(await store.list()).toHaveLength(1);
		expect(await store.get(record.id)).toEqual(placed.record);
	});

	it('does not touch a machine that has a state: the example gets a new one', async () => {
		const store = createMemoryStore();
		const added = applyCommand(createDocument(), { type: 'addState', x: 10, y: 10 });
		if (!added.ok) throw new Error('state');
		const work = await createMachine(store, added.doc, () => 100);
		const before = await store.get(work.id);
		const placed = await placeExample(store, work.id, example(), () => 500);
		expect(placed.replaced).toBe(false);
		expect(placed.record.id).not.toBe(work.id);
		expect(await store.get(work.id)).toEqual(before);
		expect(await store.list()).toHaveLength(2);
	});

	it('does not touch an empty machine that has test strings or a title', async () => {
		for (const patch of [{ tests: ['01'] }, { title: 'Punyaku' }]) {
			const { store, record } = await emptyMachine();
			await store.put({ ...record, ...patch });
			const before = await store.get(record.id);
			const placed = await placeExample(store, record.id, example(), () => 500);
			expect(placed.replaced).toBe(false);
			expect(await store.get(record.id)).toEqual(before);
		}
	});

	it('does not touch a machine that cannot be read', async () => {
		const { store, record } = await emptyMachine();
		await store.put({ ...record, doc: '{"broken' });
		const placed = await placeExample(store, record.id, example(), () => 500);
		expect(placed.replaced).toBe(false);
		expect((await store.get(record.id))!.doc).toBe('{"broken');
	});

	it('makes a new machine when there is no open machine, or it is gone', async () => {
		const store = createMemoryStore();
		const first = await placeExample(store, undefined, example(), () => 1);
		const second = await placeExample(store, 'missing', example(), () => 2);
		expect([first.replaced, second.replaced]).toEqual([false, false]);
		expect(await store.list()).toHaveLength(2);
		expect(first.record.tests).toEqual(example().tests);
	});

	it('says so when the store refuses the write, and leaves the empty machine as it was', async () => {
		const { store, record } = await emptyMachine();
		const before = await store.get(record.id);
		const full: MachineStore = {
			...store,
			put: async () => {
				throw new Error('QuotaExceededError');
			}
		};
		await expect(placeExample(full, record.id, example(), () => 500)).rejects.toThrow();
		expect(await store.get(record.id)).toEqual(before);
	});
});
