// Opening and making saved machines: what the Sandbox does when the page opens.
import { serializeDocument } from '../editor/document.ts';
import type { MachineDocument } from '../editor/document.ts';
import { readStoredDocument } from './migrate.ts';
import type { Unreadable } from './migrate.ts';
import { newId } from './store.ts';
import type { MachineStore, SavedMachine, Titles } from './store.ts';

/** What the Sandbox opens when nothing is saved: a document, and its titles if it is from our content. */
export interface Sample {
	doc: MachineDocument;
	titles?: Titles;
}

export interface Skipped {
	id: string;
	title: string;
	reason: Unreadable;
}

export interface Opened {
	record: SavedMachine;
	doc: MachineDocument;
	/** The machines that could not be read. They are still in the store, untouched. */
	skipped: Skipped[];
}

/** Saves a document as a new machine. */
export async function createMachine(
	store: MachineStore,
	doc: MachineDocument,
	now: () => number = Date.now,
	titles?: Titles
): Promise<SavedMachine> {
	const time = now();
	const record: SavedMachine = {
		id: newId(),
		recordVersion: 1,
		title: doc.title,
		kind: doc.kind,
		createdAt: time,
		updatedAt: time,
		openedAt: time,
		doc: serializeDocument(doc),
		...(titles ? { titles } : {})
	};
	await store.put(record);
	return record;
}

/**
 * The machine that was opened last. A machine that cannot be read is skipped and kept as it is;
 * when none can be read (or none is saved), `makeSample` gives a document that is saved as a new
 * machine. Nothing is ever deleted here.
 */
export async function openLatest(
	store: MachineStore,
	makeSample: () => Sample,
	now: () => number = Date.now
): Promise<Opened> {
	const records = (await store.list()).sort(
		(a, b) => b.openedAt - a.openedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
	);
	const skipped: Skipped[] = [];
	for (const record of records) {
		const read = readStoredDocument(record.doc);
		if (!read.ok) {
			skipped.push({ id: record.id, title: record.title, reason: read.reason });
			continue;
		}
		const opened = { ...record, openedAt: now() };
		try {
			await store.put(opened);
		} catch {
			// The machine opens all the same; the next save will tell if the store does not work.
		}
		return { record: opened, doc: read.doc, skipped };
	}
	const sample = makeSample();
	return {
		record: await createMachine(store, sample.doc, now, sample.titles),
		doc: sample.doc,
		skipped
	};
}
