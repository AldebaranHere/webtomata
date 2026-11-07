import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIMITS } from '../editor/document.ts';
import { applyPdaCommand } from '../editor/pda-commands.ts';
import { MAX_PDA_STRING, serializePdaDocument } from '../editor/pda-document.ts';
import type { PdaDocument } from '../editor/pda-document.ts';
import { anbnSample, wwrSample } from '../editor/pda-samples.ts';
import { endsWith01 } from '../editor/diagram/samples.ts';
import { serializeDocument } from '../editor/document.ts';
import { createAutosave } from './autosave.ts';
import { listEntries } from './library.ts';
import { openLatest } from './machines.ts';
import { createMemoryStore } from './memory.ts';
import { createPdaMachine, openLatestPda, pdaDocumentCodec, readStoredPda } from './pda-work.ts';
import type { MachineStore, SavedFsmMachine, SavedPdaMachine } from './store.ts';
import { createRefusingStore, getPdaRecord } from './test-support.ts';

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

describe('F1 — PDA record creation and autosave with PDA codec', () => {
	it('creates a PDA record with exact field types and saves updates via autosave', async () => {
		const store = createMemoryStore();
		const baseDoc = wwrSample(); // kind: 'ndpda'
		const record = await createPdaMachine(store, baseDoc, () => 1000);

		// Record field assertions
		expect(record.id).toMatch(/\S{8,}/);
		expect(record.recordVersion).toBe(1);
		expect(record.type).toBe('pda');
		expect(record.title).toBe('wwᴿ (palindrom panjang genap)');
		expect(record.kind).toBe('ndpda');
		expect(record.createdAt).toBe(1000);
		expect(record.updatedAt).toBe(1000);
		expect(record.openedAt).toBe(1000);
		expect(record.doc).toBe(serializePdaDocument(baseDoc));
		expect(record.titles).toBeUndefined();
		expect(record.tests).toBeUndefined();
		expect(record.progress).toBeUndefined();
		expect('titles' in record).toBe(false);
		expect('tests' in record).toBe(false);
		expect('progress' in record).toBe(false);

		// Autosave with PDA codec at now = 2000 on doc2 (setKind dpda + new title)
		const resKind = applyPdaCommand(baseDoc, { type: 'setKind', kind: 'dpda' });
		if (!resKind.ok) throw new Error(resKind.error.key);
		const doc2 = editPda(resKind.doc, 'wwR mod');

		const save = createAutosave({
			store,
			base: record,
			codec: pdaDocumentCodec,
			delayMs: 10,
			now: () => 2000
		});

		save.schedule(doc2);
		await save.flush();

		const updated = await getPdaRecord(store, record.id);
		expect(updated.id).toBe(record.id);
		expect(updated.type).toBe('pda');
		expect(updated.createdAt).toBe(1000);
		expect(updated.openedAt).toBe(1000);
		expect(updated.updatedAt).toBe(2000);
		expect(updated.title).toBe('wwR mod');
		expect(updated.kind).toBe('dpda');
		expect(JSON.parse(updated.doc).title).toBe('wwR mod');
		expect('titles' in updated).toBe(false);
		expect('tests' in updated).toBe(false);
		expect('progress' in updated).toBe(false);
		expect(JSON.parse(updated.doc).kind).toBe('dpda');
	});
});

describe('F2 — Records keep to their own kind', () => {
	it('isolates FSM, question, and PDA records across openLatest, listEntries, and openLatestPda', async () => {
		const store = createMemoryStore();

		// A at 5000 (FSM)
		const fsmA: SavedFsmMachine = {
			id: 'A',
			recordVersion: 1,
			title: 'Mesin A',
			kind: 'dfsm',
			createdAt: 1000,
			updatedAt: 5000,
			openedAt: 5000,
			doc: serializeDocument(endsWith01())
		};
		await store.put(fsmA);

		// soal:x at 6000 (Question)
		const soalX: SavedFsmMachine = {
			id: 'soal:x',
			recordVersion: 1,
			title: 'Soal X',
			kind: 'dfsm',
			createdAt: 1000,
			updatedAt: 6000,
			openedAt: 6000,
			doc: serializeDocument(endsWith01())
		};
		await store.put(soalX);

		// P1 at 2000 (PDA, created at 4000)
		const pda1 = await createPdaMachine(store, anbnSample('PDA 1'), () => 4000);
		await store.delete(pda1.id);
		await store.put({ ...pda1, id: 'P1', createdAt: 4000, openedAt: 2000, updatedAt: 2000 });

		// P2 at 7000 (PDA, HIGHEST openedAt on the store, keeping A at 5000 below it)
		const pda2 = await createPdaMachine(store, wwrSample('PDA 2'), () => 1000);
		await store.delete(pda2.id);
		const pda2Record: SavedPdaMachine = {
			...pda2,
			id: 'P2',
			createdAt: 1000,
			openedAt: 7000,
			updatedAt: 7000
		};
		await store.put(pda2Record);

		const beforeP1 = await store.get('P1');
		const beforeA = await store.get('A');
		const beforeSoal = await store.get('soal:x');

		// openLatestPda returns P2 and updates openedAt to now() = 9000
		const openedPda = await openLatestPda(store, () => 9000);
		expect(openedPda.record.id).toBe('P2');
		expect(openedPda.doc.title).toBe('PDA 2');
		expect(openedPda.skipped).toEqual([]);

		const afterP2 = await getPdaRecord(store, 'P2');
		expect(afterP2.openedAt).toBe(9000);
		expect(afterP2.updatedAt).toBe(pda2Record.updatedAt);
		expect(afterP2.createdAt).toBe(pda2Record.createdAt);
		expect(afterP2.title).toBe(pda2Record.title);
		expect(afterP2.doc).toBe(pda2Record.doc);

		// The other three are byte-identical
		expect(await store.get('P1')).toEqual(beforeP1);
		expect(await store.get('A')).toEqual(beforeA);
		expect(await store.get('soal:x')).toEqual(beforeSoal);

		// On the same store: openLatest returns A (P2 has higher openedAt but is a PDA), skipped is []
		const openedFsm = await openLatest(
			store,
			() => ({ doc: endsWith01() }),
			() => 9500
		);
		expect(openedFsm.record.id).toBe('A');
		expect(openedFsm.skipped).toEqual([]);

		const entries = await listEntries(store);
		expect(entries.map((e) => e.id)).toEqual(['A']);
	});
});

describe('F3 — Unreadable records and readStoredPda text cases', () => {
	it('(i) skips unreadable corrupt records and stops at first good record without reading further', async () => {
		const store = createMemoryStore();

		const p1: SavedPdaMachine = {
			id: 'P1',
			recordVersion: 1,
			type: 'pda',
			title: 'P1 Corrupt',
			kind: 'dpda',
			createdAt: 1000,
			updatedAt: 9000,
			openedAt: 9000,
			doc: '{"broken'
		};
		const p2: SavedPdaMachine = {
			id: 'P2',
			recordVersion: 1,
			type: 'pda',
			title: 'P2 Good',
			kind: 'dpda',
			createdAt: 1000,
			updatedAt: 8000,
			openedAt: 8000,
			doc: serializePdaDocument(anbnSample('P2 Good'))
		};
		const p3Doc = JSON.stringify({
			...JSON.parse(serializePdaDocument(anbnSample())),
			schemaVersion: 2
		});
		const p3: SavedPdaMachine = {
			id: 'P3',
			recordVersion: 1,
			type: 'pda',
			title: 'P3 Newer',
			kind: 'dpda',
			createdAt: 1000,
			updatedAt: 7000,
			openedAt: 7000,
			doc: p3Doc
		};

		await store.put(p1);
		await store.put(p2);
		await store.put(p3);

		const opened = await openLatestPda(store, () => 10_000);
		expect(opened.record.id).toBe('P2');
		expect(opened.skipped).toEqual([{ id: 'P1', title: 'P1 Corrupt', reason: 'corrupt' }]);
	});

	it('(ii) when only unreadable records exist, saves empty NDPDA, lists skipped in order, and leaves store with 4 records', async () => {
		const store = createMemoryStore();

		const p1: SavedPdaMachine = {
			id: 'P1',
			recordVersion: 1,
			type: 'pda',
			title: 'P1 Corrupt',
			kind: 'dpda',
			createdAt: 1000,
			updatedAt: 9000,
			openedAt: 9000,
			doc: '{"broken'
		};
		const p3: SavedPdaMachine = {
			id: 'P3',
			recordVersion: 1,
			type: 'pda',
			title: 'P3 Newer',
			kind: 'dpda',
			createdAt: 1000,
			updatedAt: 7000,
			openedAt: 7000,
			doc: JSON.stringify({ ...JSON.parse(serializePdaDocument(anbnSample())), schemaVersion: 2 })
		};
		const p4: SavedPdaMachine = {
			id: 'P4',
			recordVersion: 1,
			type: 'pda',
			title: 'P4 Unsupported',
			kind: 'dpda',
			createdAt: 1000,
			updatedAt: 6000,
			openedAt: 6000,
			doc: JSON.stringify({ ...JSON.parse(serializePdaDocument(anbnSample())), schemaVersion: 0 })
		};

		await store.put(p1);
		await store.put(p3);
		await store.put(p4);

		const beforeP1 = await store.get('P1');
		const beforeP3 = await store.get('P3');
		const beforeP4 = await store.get('P4');

		const opened = await openLatestPda(store, () => 10_000);
		expect(opened.doc.title).toBe('');
		expect(opened.doc.kind).toBe('ndpda');
		expect(opened.record.id).not.toBe('P1');
		expect(opened.record.id).not.toBe('P3');
		expect(opened.record.id).not.toBe('P4');

		expect(opened.skipped).toEqual([
			{ id: 'P1', title: 'P1 Corrupt', reason: 'corrupt' },
			{ id: 'P3', title: 'P3 Newer', reason: 'newer' },
			{ id: 'P4', title: 'P4 Unsupported', reason: 'unsupported' }
		]);

		expect(await store.get('P1')).toEqual(beforeP1);
		expect(await store.get('P3')).toEqual(beforeP3);
		expect(await store.get('P4')).toEqual(beforeP4);

		const all = await store.list();
		expect(all).toHaveLength(4);
	});

	it('readStoredPda returns corrupt for invalid text cases', () => {
		expect(readStoredPda('')).toEqual({ ok: false, reason: 'corrupt' });
		expect(readStoredPda('null')).toEqual({ ok: false, reason: 'corrupt' });
		expect(readStoredPda('[]')).toEqual({ ok: false, reason: 'corrupt' });
		expect(readStoredPda('{}')).toEqual({ ok: false, reason: 'corrupt' });
		expect(readStoredPda('{"schemaVersion":1.5}')).toEqual({ ok: false, reason: 'corrupt' });

		// Transition naming a missing state
		const doc = anbnSample();
		const brokenTrans = {
			...JSON.parse(serializePdaDocument(doc)),
			transitions: [{ from: 999, read: 'a', pop: [], push: ['A'], to: 0 }]
		};
		expect(readStoredPda(JSON.stringify(brokenTrans))).toEqual({ ok: false, reason: 'corrupt' });
	});
});

describe('F4 — Failure injection', () => {
	it('(a) failure during autosave sets failed; flush() retries docA, schedule(docB) writes docB never docA', async () => {
		const memory = createMemoryStore();
		const baseDoc = anbnSample('Initial');
		const record = await createPdaMachine(memory, baseDoc, () => 1000);

		let refuse = true;
		const flaky = createRefusingStore(memory, { put: () => refuse });

		const save = createAutosave({
			store: flaky,
			base: record,
			codec: pdaDocumentCodec,
			delayMs: 10,
			now: () => 2000
		});

		const docA = editPda(baseDoc, 'Doc A');
		save.schedule(docA);
		await save.flush();
		expect(save.status()).toBe('failed');
		expect((await memory.get(record.id))?.title).toBe('Initial');

		// flush() again with no new schedule writes docA ('saved')
		refuse = false;
		await save.flush();
		expect(save.status()).toBe('saved');
		expect((await memory.get(record.id))?.title).toBe('Doc A');

		// Now test schedule(docB) after a failure writes docB, never docA
		refuse = true;
		const docB1 = editPda(baseDoc, 'Doc B1');
		save.schedule(docB1);
		await save.flush();
		expect(save.status()).toBe('failed');

		const docB2 = editPda(baseDoc, 'Doc B2');
		save.schedule(docB2);
		refuse = false;
		await save.flush();
		expect(save.status()).toBe('saved');
		expect((await memory.get(record.id))?.title).toBe('Doc B2');
	});

	it('(b) openLatestPda on store whose put always throws still opens, and subsequent save reports failed', async () => {
		const memory = createMemoryStore();
		const doc = anbnSample('Existing');
		const baseRecord = await createPdaMachine(memory, doc, () => 1000);

		const flaky = createRefusingStore(memory, { put: true });

		// Updating openedAt fails, but machine opens
		const opened = await openLatestPda(flaky, () => 2000);
		expect(opened.record.id).toBe(baseRecord.id);
		expect(opened.doc.title).toBe('Existing');

		// Subsequent schedule and flush reports failed
		const save = createAutosave({
			store: flaky,
			base: opened.record,
			codec: pdaDocumentCodec,
			delayMs: 10,
			now: () => 3000
		});
		save.schedule(editPda(doc, 'Changed'));
		await save.flush();
		expect(save.status()).toBe('failed');

		// Also: saving fallback empty NDPDA when store put always throws still opens
		const emptyMemory = createMemoryStore();
		const emptyFlaky = createRefusingStore(emptyMemory, { put: true });
		const fallbackOpened = await openLatestPda(emptyFlaky, () => 4000);
		expect(fallbackOpened.doc.title).toBe('');
		expect(fallbackOpened.doc.kind).toBe('ndpda');
		expect(fallbackOpened.record.id).toMatch(/\S{8,}/);
	});

	it('(c) store whose list() throws propagates error from openLatestPda', async () => {
		const memory = createMemoryStore();
		const failing = createRefusingStore(memory, { list: true });
		await expect(openLatestPda(failing)).rejects.toThrow('StoreListError');
	});
});

describe('F5 — Burst and write serialization', () => {
	it('burst of 50 schedule calls with 10 ms delay gives at most 2 writes and last stored is 50th', async () => {
		const memory = createMemoryStore();
		const baseDoc = anbnSample('Init');
		const record = await createPdaMachine(memory, baseDoc, () => 1000);

		let writes = 0;
		const countingStore: MachineStore = {
			...memory,
			put: async (r) => {
				writes++;
				await memory.put(r);
			}
		};

		const save = createAutosave({
			store: countingStore,
			base: record,
			codec: pdaDocumentCodec,
			delayMs: 10,
			now: () => 2000
		});

		for (let i = 1; i <= 50; i++) {
			save.schedule(editPda(baseDoc, `Step ${i}`));
			if (i === 1) await vi.advanceTimersByTimeAsync(15); // Trigger at most 1 in-flight
		}
		await vi.advanceTimersByTimeAsync(50);
		await save.flush();

		expect(writes).toBeLessThanOrEqual(2);
		const saved = await getPdaRecord(memory, record.id);
		expect(saved.title).toBe('Step 50');
	});

	it('slow first put followed by immediate second put runs writes one after another', async () => {
		const memory = createMemoryStore();
		const baseDoc = anbnSample('Init');
		const record = await createPdaMachine(memory, baseDoc, () => 1000);

		const events: string[] = [];
		const orderStore: MachineStore = {
			...memory,
			put: async (r) => {
				if (r.title === 'Slow') {
					events.push('start-slow');
					await new Promise((resolve) => setTimeout(resolve, 50));
					events.push('end-slow');
				} else {
					events.push(`put-${r.title}`);
				}
				await memory.put(r);
			}
		};

		const save = createAutosave({
			store: orderStore,
			base: record,
			codec: pdaDocumentCodec,
			delayMs: 10,
			now: () => 2000
		});

		save.schedule(editPda(baseDoc, 'Slow'));
		await vi.advanceTimersByTimeAsync(15);
		save.schedule(editPda(baseDoc, 'Fast'));
		await vi.advanceTimersByTimeAsync(100);
		await save.flush();

		expect(events).toEqual(['start-slow', 'end-slow', 'put-Fast']);
		const saved = await getPdaRecord(memory, record.id);
		expect(saved.title).toBe('Fast');
	});
});

describe('F6 — Size and boundary triples', () => {
	it('documentBytes boundary: LIMITS.documentBytes - 1, at limit, and + 1', () => {
		const baseDoc = anbnSample();
		const json = serializePdaDocument(baseDoc);
		expect(json.length).toBeLessThan(LIMITS.documentBytes);

		const padTo = (targetLen: number) => {
			const spacesNeeded = targetLen - json.length;
			return json + ' '.repeat(spacesNeeded);
		};

		const textBelow = padTo(LIMITS.documentBytes - 1);
		const textAt = padTo(LIMITS.documentBytes);
		const textAbove = padTo(LIMITS.documentBytes + 1);

		expect(readStoredPda(textBelow).ok).toBe(true);
		expect(readStoredPda(textAt).ok).toBe(true);
		expect(readStoredPda(textAbove)).toEqual({ ok: false, reason: 'corrupt' });
	});

	it('LIMITS.nameChars (32) boundary: 31, 32, 33', () => {
		const makeWithStateName = (name: string) => {
			const parsed = JSON.parse(serializePdaDocument(anbnSample()));
			parsed.states[0].name = name;
			return JSON.stringify(parsed);
		};

		expect(readStoredPda(makeWithStateName('q'.repeat(LIMITS.nameChars - 1))).ok).toBe(true);
		expect(readStoredPda(makeWithStateName('q'.repeat(LIMITS.nameChars))).ok).toBe(true);
		expect(readStoredPda(makeWithStateName('q'.repeat(LIMITS.nameChars + 1)))).toEqual({
			ok: false,
			reason: 'corrupt'
		});
	});

	it('LIMITS.titleChars (100) boundary: 99, 100, 101', () => {
		const makeWithTitle = (title: string) => {
			const parsed = JSON.parse(serializePdaDocument(anbnSample()));
			parsed.title = title;
			return JSON.stringify(parsed);
		};

		expect(readStoredPda(makeWithTitle('t'.repeat(LIMITS.titleChars - 1))).ok).toBe(true);
		expect(readStoredPda(makeWithTitle('t'.repeat(LIMITS.titleChars))).ok).toBe(true);
		expect(readStoredPda(makeWithTitle('t'.repeat(LIMITS.titleChars + 1)))).toEqual({
			ok: false,
			reason: 'corrupt'
		});
	});

	it('MAX_PDA_STRING (64) boundary: 63, 64, 65', () => {
		const makeWithPushLen = (len: number) => {
			const parsed = JSON.parse(serializePdaDocument(anbnSample()));
			parsed.transitions[0].push = Array.from({ length: len }, () => 'A');
			return JSON.stringify(parsed);
		};

		expect(readStoredPda(makeWithPushLen(MAX_PDA_STRING - 1)).ok).toBe(true);
		expect(readStoredPda(makeWithPushLen(MAX_PDA_STRING)).ok).toBe(true);
		expect(readStoredPda(makeWithPushLen(MAX_PDA_STRING + 1))).toEqual({
			ok: false,
			reason: 'corrupt'
		});
	});
});
