// Saving the open machine after each change, a little later, and never out of order. No DOM and no
// framework: the editor calls `schedule` with each new document and shows `status`.
import { serializeDocument } from '../editor/document.ts';
import type { MachineDocument } from '../editor/document.ts';
import type { PdaDocument } from '../editor/pda-document.ts';
import { readTests, sameList } from '../editor/test-list.ts';
import { readProgress, sameProgress } from './progress.ts';
import type { Progress } from './progress.ts';
import { isPdaRecord } from './store.ts';
import type {
	AnySavedMachine,
	MachineStore,
	SavedFsmMachine,
	SavedPdaMachine,
	Titles
} from './store.ts';

/**
 * saved: what is on the screen is in the store. unsaved: a change is waiting. saving: a write is
 * under way. failed: the last write was refused (the work is still on the screen; a later change or
 * `flush` tries again).
 */
export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'failed';

export interface DocumentCodec<D, R extends AnySavedMachine> {
	serialize(doc: D): string;
	apply(record: R, doc: D): void;
}

export const fsmDocumentCodec: DocumentCodec<MachineDocument, SavedFsmMachine> = {
	serialize: serializeDocument,
	apply(record, doc) {
		record.title = doc.title;
		record.kind = doc.kind;
	}
};

export interface BaseAutosave<D> {
	status(): SaveStatus;
	subscribe(listener: () => void): () => void;
	/** A new document to save, after the delay. A burst of calls makes one write. */
	schedule(doc: D): void;
	/** Saves now, and resolves when the store has answered. Also tries again after a failure. */
	flush(): Promise<void>;
	/** Stops: a write that has not started is not made. */
	dispose(): void;
}

export interface FsmAutosave extends BaseAutosave<MachineDocument> {
	/** A new list of test strings: saved in the same record, in the same queue, with the same delay. */
	scheduleTests(tests: readonly string[]): void;
	/** The progress of the student on a question (Q5): saved in the same record, in the same queue, with the same delay. */
	scheduleProgress(progress: Progress): void;
}

export type PdaAutosave = BaseAutosave<PdaDocument>;

export type Autosave = FsmAutosave;

export interface FsmAutosaveOptions {
	store: MachineStore;
	base: SavedFsmMachine;
	codec?: DocumentCodec<MachineDocument, SavedFsmMachine>;
	delayMs?: number;
	now?: () => number;
}

export interface PdaAutosaveOptions {
	store: MachineStore;
	base: SavedPdaMachine;
	codec: DocumentCodec<PdaDocument, SavedPdaMachine>;
	delayMs?: number;
	now?: () => number;
}

function isPdaOptions(
	options: FsmAutosaveOptions | PdaAutosaveOptions
): options is PdaAutosaveOptions {
	return isPdaRecord(options.base);
}

interface CoreAutosave<D> extends BaseAutosave<D> {
	scheduleTests(tests: readonly string[]): void;
	scheduleProgress(progress: Progress): void;
}

function createAutosaveCore<D extends { readonly title: string }, R extends AnySavedMachine>(
	store: MachineStore,
	initialBase: R,
	codec: DocumentCodec<D, R>,
	delayMs: number,
	now: () => number,
	titles?: Titles
): CoreAutosave<D> {
	let base = initialBase;
	let lastText = base.doc;
	let status: SaveStatus = 'saved';
	/** The newest document that is not saved yet. It stays after a failure, so that flush can try again. */
	let latest: D | null = null;
	/** The newest list of test strings that is not saved yet. */
	let latestTests: string[] | null = null;
	/** The newest progress that is not saved yet. */
	let latestProgress: Progress | null = null;
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
		while ((latest !== null || latestTests !== null || latestProgress !== null) && !disposed) {
			const doc = latest;
			const tests = latestTests;
			const progress = latestProgress;
			const text = doc ? codec.serialize(doc) : lastText;
			if (
				text === lastText &&
				(tests === null || sameList(tests, readTests(base.tests))) &&
				(progress === null || sameProgress(progress, readProgress(base.progress)))
			) {
				latest = null;
				latestTests = null;
				latestProgress = null;
				break;
			}
			set('saving');
			try {
				const record: R = { ...base, updatedAt: now(), doc: text };
				if (doc) codec.apply(record, doc);
				if (!isPdaRecord(record)) {
					if (doc) {
						// The titles stay only while the title of the document is one of them.
						if (titles && (doc.title === titles.id || doc.title === titles.en)) {
							record.titles = titles;
						} else {
							delete record.titles;
						}
					}
					// An empty list leaves no field. A field that was bad is cleaned by any write.
					const list = tests ?? readTests(base.tests);
					if (list.length > 0) record.tests = list;
					else delete record.tests;
					// The same for the progress (only a question has one).
					const kept = progress ?? readProgress(base.progress);
					if (kept) record.progress = kept;
					else delete record.progress;
				}
				await store.put(record);
				base = record;
				lastText = text;
				if (latest === doc) latest = null;
				if (latestTests === tests) latestTests = null;
				if (latestProgress === progress) latestProgress = null;
			} catch {
				set('failed');
				return;
			}
		}
		set(latest === null && latestTests === null && latestProgress === null ? 'saved' : 'unsaved');
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
		scheduleProgress(progress) {
			if (disposed) return;
			latestProgress = { ...progress };
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

export function createAutosave(options: FsmAutosaveOptions): FsmAutosave;
export function createAutosave(options: PdaAutosaveOptions): PdaAutosave;
export function createAutosave(
	options: FsmAutosaveOptions | PdaAutosaveOptions
): FsmAutosave | PdaAutosave {
	const { store, delayMs = 800, now = Date.now } = options;
	if (isPdaOptions(options)) {
		const core = createAutosaveCore(store, options.base, options.codec, delayMs, now);
		const pdaAutosave: PdaAutosave = {
			status: () => core.status(),
			subscribe: (l) => core.subscribe(l),
			schedule: (doc) => core.schedule(doc),
			flush: () => core.flush(),
			dispose: () => core.dispose()
		};
		return pdaAutosave;
	}
	const titles = options.base.titles;
	return createAutosaveCore(
		store,
		options.base,
		options.codec ?? fsmDocumentCodec,
		delayMs,
		now,
		titles
	);
}
