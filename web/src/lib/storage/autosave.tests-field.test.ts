import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyCommand } from '../editor/commands.ts';
import { endsWith01 } from '../editor/diagram/samples.ts';
import { serializeDocument } from '../editor/document.ts';
import type { MachineDocument } from '../editor/document.ts';
import { random } from '../editor/testing.ts';
import { createAutosave } from './autosave.ts';
import { createMemoryStore } from './memory.ts';
import type { MachineStore, SavedMachine } from './store.ts';

// The test strings of a machine (S6-3) are a field of its record. They are saved by the same
// autosave, in the same queue as the document, so that neither can overwrite the other.

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

async function open(extra: Partial<SavedMachine> = {}) {
	const store = createMemoryStore();
	const first = endsWith01();
	const base = { ...record(first), ...extra };
	await store.put(base);
	return { store, first, base };
}

const counting = (store: MachineStore) => {
	const seen = { writes: 0 };
	const wrapped: MachineStore = {
		...store,
		put: async (r) => {
			seen.writes++;
			await store.put(r);
		}
	};
	return { seen, wrapped };
};

describe('the test strings of the machine', () => {
	it('are saved in the record, with the delay, and the document is not touched', async () => {
		const { store, first, base } = await open();
		const save = createAutosave({ store, base, delayMs: 800 });
		save.scheduleTests(['01', '110']);
		expect(save.status()).toBe('unsaved');
		await vi.advanceTimersByTimeAsync(799);
		expect((await store.get('m1'))!.tests).toBeUndefined();
		await vi.advanceTimersByTimeAsync(2);
		const saved = (await store.get('m1'))!;
		expect(saved.tests).toEqual(['01', '110']);
		expect(saved.doc).toBe(serializeDocument(first));
		expect(saved.title).toBe(first.title);
		expect(save.status()).toBe('saved');
	});

	it('go with a change of the document in one write', async () => {
		const { store, first, base } = await open();
		const { seen, wrapped } = counting(store);
		const save = createAutosave({ store: wrapped, base, delayMs: 100 });
		save.schedule(edit(first, 'A'));
		save.scheduleTests(['0']);
		await vi.advanceTimersByTimeAsync(200);
		expect(seen.writes).toBe(1);
		expect(await store.get('m1')).toMatchObject({ title: 'A', tests: ['0'] });
	});

	it('are kept when only the document changes', async () => {
		const { store, first, base } = await open({ tests: ['01'] });
		const save = createAutosave({ store, base, delayMs: 10 });
		save.schedule(edit(first, 'B'));
		await save.flush();
		expect(await store.get('m1')).toMatchObject({ title: 'B', tests: ['01'] });
	});

	it('leave no field when the list is empty', async () => {
		const { store, base } = await open({ tests: ['01'] });
		const save = createAutosave({ store, base, delayMs: 10 });
		save.scheduleTests([]);
		await save.flush();
		expect(Object.hasOwn((await store.get('m1'))!, 'tests')).toBe(false);
	});

	it('are not written again when the list is the same', async () => {
		const { store, base } = await open({ tests: ['01'] });
		const { seen, wrapped } = counting(store);
		const save = createAutosave({ store: wrapped, base, delayMs: 10 });
		save.scheduleTests(['01']);
		await save.flush();
		expect(seen.writes).toBe(0);
		expect(save.status()).toBe('saved');
	});

	it('are cleaned when the record had a bad field', async () => {
		const { store, first, base } = await open({ tests: 'oops' as unknown as string[] });
		const save = createAutosave({ store, base, delayMs: 10 });
		save.schedule(edit(first, 'C'));
		await save.flush();
		expect(Object.hasOwn((await store.get('m1'))!, 'tests')).toBe(false);
	});

	it('keep the titles of the content when only the strings change', async () => {
		const titles = { id: 'Berakhiran 01', en: 'Ending in 01' };
		const { store, base } = await open({ title: titles.id, titles });
		const save = createAutosave({ store, base, delayMs: 10 });
		save.scheduleTests(['1']);
		await save.flush();
		expect(await store.get('m1')).toMatchObject({ titles, tests: ['1'] });
	});

	it('a failed write keeps them, and flush tries again', async () => {
		const { store, base } = await open();
		let failing = true;
		const flaky: MachineStore = {
			...store,
			put: async (r) => {
				if (failing) throw new Error('QuotaExceededError');
				await store.put(r);
			}
		};
		const save = createAutosave({ store: flaky, base, delayMs: 10 });
		save.scheduleTests(['01']);
		await save.flush();
		expect(save.status()).toBe('failed');
		failing = false;
		await save.flush();
		expect(save.status()).toBe('saved');
		expect((await store.get('m1'))!.tests).toEqual(['01']);
	});

	it('property: any order of changes of the document and of the strings ends with both of the last', async () => {
		for (let seed = 1; seed <= 40; seed++) {
			const rng = random(seed);
			const { store, first, base } = await open();
			const slow: MachineStore = {
				...store,
				put: async (r) => {
					if (rng.chance(0.5)) await new Promise((done) => setTimeout(done, rng.int(50)));
					await store.put(r);
				}
			};
			const save = createAutosave({ store: slow, base, delayMs: 20 });
			let title = first.title;
			let tests: string[] = [];
			for (let step = 0; step < 12; step++) {
				if (rng.chance(0.5)) {
					title = `T${seed}-${step}`;
					save.schedule(edit(first, title));
				} else {
					tests = Array.from({ length: rng.int(4) }, () => String(rng.int(100)));
					save.scheduleTests(tests);
				}
				if (rng.chance(0.4)) await vi.advanceTimersByTimeAsync(rng.int(60));
			}
			await vi.advanceTimersByTimeAsync(500);
			await save.flush();
			const saved = (await store.get('m1'))!;
			expect(saved.title, `seed ${seed}`).toBe(title);
			expect(saved.tests ?? [], `seed ${seed}`).toEqual(tests);
			expect(save.status(), `seed ${seed}`).toBe('saved');
		}
	});
});
