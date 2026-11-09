import { describe, expect, it } from 'vitest';
import { applyPdaCommand } from '../editor/pda-commands.ts';
import { createPdaDocument, serializePdaDocument } from '../editor/pda-document.ts';
import type { PdaDocument } from '../editor/pda-document.ts';
import { anbnSample } from '../editor/pda-samples.ts';
import { createMemoryStore } from './memory.ts';
import { createPdaMachine, placePdaExample } from './pda-work.ts';
import { createRefusingStore } from './test-support.ts';

// Opening an example from the PDA first-run card (docs/agent/PLAN.md, T-073, F7): an empty, untouched
// PDA record is rewritten in place and never left behind for "Mesin saya"; anything else is left
// alone and the example gets a record of its own. The document comes back from the store, so the
// editor edits a copy and never the sample. This mirrors `storage/example.test.ts` for the FSM.

const sample = () => anbnSample();

async function emptyPda() {
	const store = createMemoryStore();
	const record = await createPdaMachine(store, createPdaDocument(), () => 100);
	return { store, record };
}

const edit = (doc: PdaDocument, command: Parameters<typeof applyPdaCommand>[1]): PdaDocument => {
	const result = applyPdaCommand(doc, command);
	if (!result.ok) throw new Error(result.error.key);
	return result.doc;
};

describe('placing a PDA example', () => {
	it('rewrites an empty untouched record in place: same id and creation time, the content of the sample', async () => {
		const { store, record } = await emptyPda();
		const placed = await placePdaExample(store, record.id, sample(), () => 500);
		expect(placed.replaced).toBe(true);
		expect(placed.record).toMatchObject({
			id: record.id,
			type: 'pda',
			createdAt: 100,
			updatedAt: 500,
			openedAt: 500,
			title: 'aⁿbⁿ (n ≥ 1)',
			kind: 'dpda'
		});
		expect(await store.list()).toHaveLength(1);
		expect(await store.get(record.id)).toEqual(placed.record);
	});

	it('returns a copy: changing the document that came back does not change the sample', async () => {
		const { store, record } = await emptyPda();
		const input = sample();
		const placed = await placePdaExample(store, record.id, input, () => 500);
		expect(placed.doc).not.toBe(input);
		const edited = edit(placed.doc, { type: 'removeState', id: placed.doc.states[0]!.id });
		expect(edited.states).toHaveLength(1);
		expect(input.states).toHaveLength(2);
	});

	it('leaves a PDA that has a state alone, and makes a new record', async () => {
		const store = createMemoryStore();
		const work = edit(createPdaDocument(), { type: 'addState', x: 10, y: 10 });
		const record = await createPdaMachine(store, work, () => 100);
		const before = await store.get(record.id);
		const placed = await placePdaExample(store, record.id, sample(), () => 500);
		expect(placed.replaced).toBe(false);
		expect(placed.record.id).not.toBe(record.id);
		expect(placed.record.createdAt).toBe(500);
		expect(await store.get(record.id)).toEqual(before);
		expect(await store.list()).toHaveLength(2);
	});

	it('leaves an empty PDA with a title, or with a symbol in either alphabet, alone', async () => {
		const documents = [
			edit(createPdaDocument(), { type: 'setTitle', title: 'Punyaku' }),
			edit(createPdaDocument(), { type: 'addInputSymbol', symbol: 'a' }),
			edit(createPdaDocument(), { type: 'addStackSymbol', symbol: 'A' })
		];
		for (const doc of documents) {
			const { store, record } = await emptyPda();
			await store.put({
				...record,
				title: doc.title,
				kind: doc.kind,
				doc: serializePdaDocument(doc)
			});
			const before = await store.get(record.id);
			const placed = await placePdaExample(store, record.id, sample(), () => 500);
			expect(
				placed.replaced,
				doc.title || doc.inputAlphabet.join() || doc.stackAlphabet.join()
			).toBe(false);
			expect(await store.get(record.id)).toEqual(before);
			expect(await store.list()).toHaveLength(2);
		}
	});

	it('makes a new record when there is no open id, or it is gone', async () => {
		const store = createMemoryStore();
		const first = await placePdaExample(store, undefined, sample(), () => 1);
		const second = await placePdaExample(store, 'missing', sample(), () => 2);
		expect([first.replaced, second.replaced]).toEqual([false, false]);
		expect(first.record.id).not.toBe(second.record.id);
		expect(await store.list()).toHaveLength(2);
	});

	it('says so when the store refuses the write, and leaves the empty record as it was', async () => {
		const { store, record } = await emptyPda();
		const before = await store.get(record.id);
		const full = createRefusingStore(store, { put: true });
		await expect(placePdaExample(full, record.id, sample(), () => 500)).rejects.toThrow();
		expect(await store.get(record.id)).toEqual(before);
		expect(await store.list()).toHaveLength(1);
	});
});
