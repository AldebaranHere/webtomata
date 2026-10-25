import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyCommand } from '../editor/commands.ts';
import { endsWith01 } from '../editor/diagram/samples.ts';
import { serializeDocument } from '../editor/document.ts';
import type { MachineDocument } from '../editor/document.ts';
import { createAutosave } from './autosave.ts';
import { createMemoryStore } from './memory.ts';
import type { MachineStore, SavedMachine } from './store.ts';

const edit = (doc: MachineDocument, title: string): MachineDocument => {
	const result = applyCommand(doc, { type: 'setTitle', title });
	if (!result.ok) throw new Error(result.error.key);
	return result.doc;
};

const record = (doc: MachineDocument): SavedMachine => ({
	id: 'm1',
	recordVersion: 1,
	title: doc.title,
	kind: doc.kind,
	createdAt: 1,
	updatedAt: 1,
	openedAt: 1,
	doc: serializeDocument(doc)
});

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(1_000_000);
});
afterEach(() => vi.useRealTimers());

describe('autosave', () => {
	it('starts as saved, and a change makes it unsaved until the delay has passed', async () => {
		const store = createMemoryStore();
		const first = endsWith01();
		await store.put(record(first));
		const save = createAutosave({ store, base: record(first), delayMs: 800 });
		expect(save.status()).toBe('saved');
		save.schedule(edit(first, 'A'));
		expect(save.status()).toBe('unsaved');
		await vi.advanceTimersByTimeAsync(799);
		expect((await store.get('m1'))!.title).toBe(first.title);
		await vi.advanceTimersByTimeAsync(2);
		expect((await store.get('m1'))!.title).toBe('A');
		expect(save.status()).toBe('saved');
	});

	it('a burst of changes is one write, with the last document', async () => {
		const store = createMemoryStore();
		const first = endsWith01();
		await store.put(record(first));
		let writes = 0;
		const counting: MachineStore = {
			...store,
			put: async (r) => {
				writes++;
				await store.put(r);
			}
		};
		const save = createAutosave({ store: counting, base: record(first), delayMs: 800 });
		for (const title of ['A', 'AB', 'ABC']) {
			save.schedule(edit(first, title));
			await vi.advanceTimersByTimeAsync(300);
		}
		await vi.advanceTimersByTimeAsync(800);
		expect(writes).toBe(1);
		expect((await store.get('m1'))!.title).toBe('ABC');
	});

	it('flush writes at once, and waits for the write', async () => {
		const store = createMemoryStore();
		const first = endsWith01();
		await store.put(record(first));
		const save = createAutosave({ store, base: record(first), delayMs: 800 });
		save.schedule(edit(first, 'Now'));
		await save.flush();
		expect((await store.get('m1'))!.title).toBe('Now');
		expect(save.status()).toBe('saved');
	});

	it('the record keeps its id and dates, takes the title and kind of the document, and a new time', async () => {
		const store = createMemoryStore();
		const first = endsWith01();
		await store.put(record(first));
		const save = createAutosave({ store, base: record(first), delayMs: 10 });
		save.schedule(edit(first, 'Baru'));
		await save.flush();
		const saved = (await store.get('m1'))!;
		expect(saved).toMatchObject({
			id: 'm1',
			title: 'Baru',
			kind: 'dfsm',
			createdAt: 1,
			openedAt: 1,
			updatedAt: 1_000_000
		});
		expect(JSON.parse(saved.doc).title).toBe('Baru');
	});

	it('a document that is the same as the saved one is not written again', async () => {
		const store = createMemoryStore();
		const first = endsWith01();
		await store.put(record(first));
		let writes = 0;
		const counting: MachineStore = {
			...store,
			put: async (r) => {
				writes++;
				await store.put(r);
			}
		};
		const save = createAutosave({ store: counting, base: record(first), delayMs: 10 });
		save.schedule(first);
		await save.flush();
		expect(writes).toBe(0);
		expect(save.status()).toBe('saved');
	});

	it('a failed write is reported, the work is kept, and the next change tries again', async () => {
		const store = createMemoryStore();
		const first = endsWith01();
		await store.put(record(first));
		let failing = true;
		const flaky: MachineStore = {
			...store,
			put: async (r) => {
				if (failing) throw new Error('quota');
				await store.put(r);
			}
		};
		const save = createAutosave({ store: flaky, base: record(first), delayMs: 10 });
		save.schedule(edit(first, 'A'));
		await save.flush();
		expect(save.status()).toBe('failed');
		expect((await store.get('m1'))!.title).toBe(first.title);

		failing = false;
		save.schedule(edit(first, 'B'));
		await save.flush();
		expect(save.status()).toBe('saved');
		expect((await store.get('m1'))!.title).toBe('B');
	});

	it('flush tries again after a failure even without a new change', async () => {
		const store = createMemoryStore();
		const first = endsWith01();
		await store.put(record(first));
		let failing = true;
		const flaky: MachineStore = {
			...store,
			put: async (r) => {
				if (failing) throw new Error('quota');
				await store.put(r);
			}
		};
		const save = createAutosave({ store: flaky, base: record(first), delayMs: 10 });
		save.schedule(edit(first, 'A'));
		await save.flush();
		failing = false;
		await save.flush();
		expect(save.status()).toBe('saved');
		expect((await store.get('m1'))!.title).toBe('A');
	});

	it('writes never go out of order: a slow write cannot overwrite a later one', async () => {
		const store = createMemoryStore();
		const first = endsWith01();
		await store.put(record(first));
		const slow: MachineStore = {
			...store,
			put: async (r) => {
				if (r.title === 'Slow') await new Promise((done) => setTimeout(done, 500));
				await store.put(r);
			}
		};
		const save = createAutosave({ store: slow, base: record(first), delayMs: 10 });
		save.schedule(edit(first, 'Slow'));
		await vi.advanceTimersByTimeAsync(20);
		save.schedule(edit(first, 'Fast'));
		await vi.advanceTimersByTimeAsync(2000);
		await save.flush();
		expect((await store.get('m1'))!.title).toBe('Fast');
	});

	it('tells its listeners about every change of status, and stops when they leave', async () => {
		const store = createMemoryStore();
		const first = endsWith01();
		await store.put(record(first));
		const save = createAutosave({ store, base: record(first), delayMs: 10 });
		const seen: string[] = [];
		const stop = save.subscribe(() => seen.push(save.status()));
		save.schedule(edit(first, 'A'));
		await save.flush();
		expect(seen).toEqual(['unsaved', 'saving', 'saved']);
		stop();
		save.schedule(edit(first, 'B'));
		expect(seen).toHaveLength(3);
	});

	it('dispose cancels a write that has not started', async () => {
		const store = createMemoryStore();
		const first = endsWith01();
		await store.put(record(first));
		const save = createAutosave({ store, base: record(first), delayMs: 800 });
		save.schedule(edit(first, 'Never'));
		save.dispose();
		await vi.advanceTimersByTimeAsync(2000);
		expect((await store.get('m1'))!.title).toBe(first.title);
	});
});

describe('titles that come with the content', () => {
	const titles = { id: 'Berakhiran 01', en: 'Ending in 01' };

	it('are kept while the title of the document is one of them, and dropped when the user chooses another', async () => {
		const store = createMemoryStore();
		const first = edit(endsWith01(), 'Berakhiran 01');
		const base = { ...record(first), titles };
		await store.put(base);
		const save = createAutosave({ store, base, delayMs: 10 });
		save.schedule(edit(first, 'Genap a'));
		await save.flush();
		expect((await store.get('m1'))!.titles).toBeUndefined();
		// The user goes back to the first title with undo: the titles come back.
		save.schedule(first);
		await save.flush();
		expect((await store.get('m1'))!.titles).toEqual(titles);
	});

	it('are kept when other things change', async () => {
		const store = createMemoryStore();
		const first = edit(endsWith01(), 'Ending in 01');
		const base = { ...record(first), titles };
		await store.put(base);
		const save = createAutosave({ store, base, delayMs: 10 });
		const moved = applyCommand(first, { type: 'moveState', id: 0, x: 111, y: 222 });
		if (!moved.ok) throw new Error('move');
		save.schedule(moved.doc);
		await save.flush();
		expect((await store.get('m1'))!.titles).toEqual(titles);
	});
});
