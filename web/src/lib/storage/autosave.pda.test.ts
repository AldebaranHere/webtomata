import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { endsWith01 } from '../editor/diagram/samples.ts';
import { applyPdaCommand } from '../editor/pda-commands.ts';
import type { PdaDocument } from '../editor/pda-document.ts';
import { anbnSample } from '../editor/pda-samples.ts';
import { createAutosave } from './autosave.ts';
import { createMachine } from './machines.ts';
import { createMemoryStore } from './memory.ts';
import { createPdaMachine, pdaDocumentCodec } from './pda-work.ts';
import { getPdaRecord } from './test-support.ts';

const editPda = (doc: PdaDocument, title: string): PdaDocument => {
	const res = applyPdaCommand(doc, { type: 'setTitle', title });
	if (!res.ok) throw new Error(res.error.key);
	return res.doc;
};

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(1_000_000);
});
afterEach(() => {
	vi.useRealTimers();
});

describe('PDA autosave behavior and lifecycle', () => {
	it('starts as saved, schedule sets unsaved, flush saves document', async () => {
		const store = createMemoryStore();
		const doc = anbnSample('PDA Test');
		const record = await createPdaMachine(store, doc, () => 1000);

		const save = createAutosave({
			store,
			base: record,
			codec: pdaDocumentCodec,
			delayMs: 800
		});

		expect(save.status()).toBe('saved');
		const edited = editPda(doc, 'Updated');
		save.schedule(edited);
		expect(save.status()).toBe('unsaved');

		await vi.advanceTimersByTimeAsync(799);
		expect((await getPdaRecord(store, record.id)).title).toBe('PDA Test');

		await vi.advanceTimersByTimeAsync(2);
		expect(save.status()).toBe('saved');
		expect((await getPdaRecord(store, record.id)).title).toBe('Updated');
	});

	it('subscribers are notified of status changes, unsubscribe stops updates', async () => {
		const store = createMemoryStore();
		const doc = anbnSample('Sub Test');
		const record = await createPdaMachine(store, doc, () => 1000);

		const save = createAutosave({
			store,
			base: record,
			codec: pdaDocumentCodec,
			delayMs: 10
		});

		const seen: string[] = [];
		const stop = save.subscribe(() => seen.push(save.status()));

		save.schedule(editPda(doc, 'Step 1'));
		await save.flush();
		expect(seen).toEqual(['unsaved', 'saving', 'saved']);

		stop();
		save.schedule(editPda(doc, 'Step 2'));
		await save.flush();
		expect(seen).toHaveLength(3);
	});

	it('disposal cancels pending debounced writes', async () => {
		const store = createMemoryStore();
		const doc = anbnSample('Dispose Test');
		const record = await createPdaMachine(store, doc, () => 1000);

		const save = createAutosave({
			store,
			base: record,
			codec: pdaDocumentCodec,
			delayMs: 800
		});

		save.schedule(editPda(doc, 'Never Written'));
		save.dispose();

		await vi.advanceTimersByTimeAsync(2000);
		expect((await getPdaRecord(store, record.id)).title).toBe('Dispose Test');
	});

	it('PDA autosave object omits scheduleTests and scheduleProgress at runtime, FSM has both', async () => {
		const store = createMemoryStore();
		const pdaDoc = anbnSample('PDA Object');
		const pdaRecord = await createPdaMachine(store, pdaDoc, () => 1000);

		const pdaSave = createAutosave({
			store,
			base: pdaRecord,
			codec: pdaDocumentCodec
		});

		expect('scheduleTests' in pdaSave).toBe(false);
		expect('scheduleProgress' in pdaSave).toBe(false);

		const fsmRecord = await createMachine(store, endsWith01('FSM Object'), () => 1000);
		const fsmSave = createAutosave({
			store,
			base: fsmRecord
		});

		expect('scheduleTests' in fsmSave).toBe(true);
		expect('scheduleProgress' in fsmSave).toBe(true);
	});
});
