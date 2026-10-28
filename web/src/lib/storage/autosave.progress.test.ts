// The progress of a question is saved in the same record as its machine, through the same queue (Q5): a save of
// the machine keeps it, and a save of the progress keeps the machine.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyCommand } from '../editor/commands.ts';
import { endsWith01 } from '../editor/diagram/samples.ts';
import { serializeDocument } from '../editor/document.ts';
import type { MachineDocument } from '../editor/document.ts';
import { createAutosave } from './autosave.ts';
import { createMemoryStore } from './memory.ts';
import type { Progress } from './progress.ts';
import type { MachineStore, SavedMachine } from './store.ts';

const base = (doc: MachineDocument): SavedMachine => ({
	id: 'soal:q',
	recordVersion: 1,
	title: doc.title,
	kind: doc.kind,
	createdAt: 1,
	updatedAt: 1,
	openedAt: 1,
	doc: serializeDocument(doc)
});

const retitled = (doc: MachineDocument, title: string): MachineDocument => {
	const result = applyCommand(doc, { type: 'setTitle', title });
	if (!result.ok) throw new Error(result.error.key);
	return result.doc;
};

const solved: Progress = { checks: 1, solved: true, solvedAt: 5, checkedAt: 5 };

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(1_000_000);
});
afterEach(() => vi.useRealTimers());

describe('autosave of the progress', () => {
	it('saves the progress after the delay, and the machine stays as it was', async () => {
		const store = createMemoryStore();
		const first = endsWith01();
		await store.put(base(first));
		const save = createAutosave({ store, base: base(first), delayMs: 800 });
		save.scheduleProgress(solved);
		expect(save.status()).toBe('unsaved');
		await vi.advanceTimersByTimeAsync(799);
		expect((await store.get('soal:q'))!.progress).toBeUndefined();
		await vi.advanceTimersByTimeAsync(2);
		const saved = (await store.get('soal:q'))!;
		expect(saved.progress).toEqual(solved);
		expect(saved.doc).toBe(serializeDocument(first));
		expect(save.status()).toBe('saved');
	});

	it('is kept by the next save of the machine', async () => {
		const store = createMemoryStore();
		const first = endsWith01();
		await store.put(base(first));
		const save = createAutosave({ store, base: base(first), delayMs: 100 });
		save.scheduleProgress(solved);
		await save.flush();
		save.schedule(retitled(first, 'Baru'));
		await save.flush();
		const saved = (await store.get('soal:q'))!;
		expect(saved.title).toBe('Baru');
		expect(saved.progress).toEqual(solved);
	});

	it('is saved together with a machine that is waiting, in one write', async () => {
		const store = createMemoryStore();
		const first = endsWith01();
		await store.put(base(first));
		let writes = 0;
		const counting: MachineStore = {
			...store,
			put: async (r) => {
				writes++;
				await store.put(r);
			}
		};
		const save = createAutosave({ store: counting, base: base(first), delayMs: 100 });
		save.schedule(retitled(first, 'Baru'));
		save.scheduleProgress(solved);
		await vi.advanceTimersByTimeAsync(150);
		expect(writes).toBe(1);
		const saved = (await store.get('soal:q'))!;
		expect(saved.title).toBe('Baru');
		expect(saved.progress).toEqual(solved);
	});

	it('writes the last of several progress values', async () => {
		const store = createMemoryStore();
		const first = endsWith01();
		await store.put(base(first));
		const save = createAutosave({ store, base: base(first), delayMs: 100 });
		save.scheduleProgress({ checks: 1, solved: false, checkedAt: 1 });
		save.scheduleProgress(solved);
		await save.flush();
		expect((await store.get('soal:q'))!.progress).toEqual(solved);
	});

	it('is not written again when nothing changed', async () => {
		const store = createMemoryStore();
		const first = endsWith01();
		await store.put({ ...base(first), progress: solved });
		let writes = 0;
		const counting: MachineStore = {
			...store,
			put: async (r) => {
				writes++;
				await store.put(r);
			}
		};
		const save = createAutosave({
			store: counting,
			base: { ...base(first), progress: solved },
			delayMs: 100
		});
		save.scheduleProgress({ ...solved });
		await save.flush();
		expect(writes).toBe(0);
		expect(save.status()).toBe('saved');
	});

	it('says that it failed when the store refuses, and tries again at the next flush', async () => {
		const store = createMemoryStore();
		const first = endsWith01();
		await store.put(base(first));
		let refuse = true;
		const flaky: MachineStore = {
			...store,
			put: async (r) => {
				if (refuse) throw new Error('quota');
				await store.put(r);
			}
		};
		const save = createAutosave({ store: flaky, base: base(first), delayMs: 100 });
		save.scheduleProgress(solved);
		await vi.advanceTimersByTimeAsync(150);
		expect(save.status()).toBe('failed');
		refuse = false;
		await save.flush();
		expect(save.status()).toBe('saved');
		expect((await store.get('soal:q'))!.progress).toEqual(solved);
	});

	it('does nothing after it is disposed', async () => {
		const store = createMemoryStore();
		const first = endsWith01();
		await store.put(base(first));
		const save = createAutosave({ store, base: base(first), delayMs: 100 });
		save.dispose();
		save.scheduleProgress(solved);
		await vi.advanceTimersByTimeAsync(500);
		expect((await store.get('soal:q'))!.progress).toBeUndefined();
	});

	it('removes a bad progress field that was in the record when the machine is saved', async () => {
		const store = createMemoryStore();
		const first = endsWith01();
		const bad = { ...base(first), progress: 'garbage' } as unknown as SavedMachine;
		await store.put(bad);
		const save = createAutosave({ store, base: bad, delayMs: 100 });
		save.schedule(retitled(first, 'Baru'));
		await save.flush();
		expect('progress' in (await store.get('soal:q'))!).toBe(false);
	});
});
