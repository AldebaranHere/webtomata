// Saving the open machine after each change, a little later, and never out of order. No DOM and no
// framework: the editor calls `schedule` with each new document and shows `status`.
import { serializeDocument } from '../editor/document.ts';
import type { MachineDocument } from '../editor/document.ts';
import { readTests, sameList } from '../editor/test-list.ts';
import type { MachineStore, SavedMachine } from './store.ts';

/**
 * saved: what is on the screen is in the store. unsaved: a change is waiting. saving: a write is
 * under way. failed: the last write was refused (the work is still on the screen; a later change or
 * `flush` tries again).
 */
export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'failed';

export interface Autosave {
	status(): SaveStatus;
	subscribe(listener: () => void): () => void;
	/** A new document to save, after the delay. A burst of calls makes one write. */
	schedule(doc: MachineDocument): void;
	/** A new list of test strings: saved in the same record, in the same queue, with the same delay. */
	scheduleTests(tests: readonly string[]): void;
	/** Saves now, and resolves when the store has answered. Also tries again after a failure. */
	flush(): Promise<void>;
	/** Stops: a write that has not started is not made. */
	dispose(): void;
}

export function createAutosave(options: {
	store: MachineStore;
	/** The record as it was opened; its id and dates are kept. */
	base: SavedMachine;
	delayMs?: number;
	now?: () => number;
}): Autosave {
	const { store, delayMs = 800, now = Date.now } = options;
	let base = options.base;
	// The titles that came with the machine are kept apart from the record, so that an undo of a
	// rename gives them back.
	const titles = options.base.titles;
	let lastText = base.doc;
	let status: SaveStatus = 'saved';
	/** The newest document that is not saved yet. It stays after a failure, so that flush can try again. */
	let latest: MachineDocument | null = null;
	/** The newest list of test strings that is not saved yet. */
	let latestTests: string[] | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let running: Promise<void> | null = null;
	let disposed = false;
	const listeners = new Set<() => void>();

	const set = (next: SaveStatus) => {
		if (next === status) return;
		status = next;
		for (const listener of [...listeners]) listener();
	};

	// One write at a time, in order. A document that arrives during a write is written after it.
	async function loop() {
		while ((latest !== null || latestTests !== null) && !disposed) {
			const doc = latest;
			const tests = latestTests;
			const text = doc ? serializeDocument(doc) : lastText;
			if (text === lastText && (tests === null || sameList(tests, readTests(base.tests)))) {
				latest = null;
				latestTests = null;
				break;
			}
			set('saving');
			try {
				const record: SavedMachine = { ...base, updatedAt: now(), doc: text };
				if (doc) {
					record.title = doc.title;
					record.kind = doc.kind;
					// The titles stay only while the title of the document is one of them.
					if (titles && (doc.title === titles.id || doc.title === titles.en))
						record.titles = titles;
					else delete record.titles;
				}
				// An empty list leaves no field. A field that was bad is cleaned by any write.
				const list = tests ?? readTests(base.tests);
				if (list.length > 0) record.tests = list;
				else delete record.tests;
				await store.put(record);
				base = record;
				lastText = text;
				if (latest === doc) latest = null;
				if (latestTests === tests) latestTests = null;
			} catch {
				set('failed');
				return;
			}
		}
		set(latest === null && latestTests === null ? 'saved' : 'unsaved');
	}

	function run(): Promise<void> {
		if (!running) running = loop().finally(() => (running = null));
		return running;
	}

	return {
		status: () => status,
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		schedule(doc) {
			if (disposed) return;
			latest = doc;
			set('unsaved');
			clearTimeout(timer);
			timer = setTimeout(() => void run(), delayMs);
		},
		scheduleTests(tests) {
			if (disposed) return;
			latestTests = [...tests];
			set('unsaved');
			clearTimeout(timer);
			timer = setTimeout(() => void run(), delayMs);
		},
		async flush() {
			clearTimeout(timer);
			await run();
		},
		dispose() {
			disposed = true;
			clearTimeout(timer);
			listeners.clear();
		}
	};
}
