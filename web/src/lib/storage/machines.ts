// Opening and making saved machines: what the Sandbox does when the page opens.
import { serializeDocument } from '../editor/document.ts';
import type { MachineDocument } from '../editor/document.ts';
import { readTests } from '../editor/test-list.ts';
import { readStoredDocument } from './migrate.ts';
import type { Unreadable } from './migrate.ts';
import { isQuestionRecord } from './question-work.ts';
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
	titles?: Titles,
	tests: readonly string[] = []
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
		...(titles ? { titles } : {}),
		...(tests.length > 0 ? { tests: [...tests] } : {})
	};
	await store.put(record);
	return record;
}

/** An example from our content, ready to be a machine: the document, its titles and its test strings. */
export interface Placeable {
	doc: MachineDocument;
	titles: Titles;
	tests: readonly string[];
}

/**
 * Puts an example in the place of the machine that is open, when that machine is empty and the
 * student has not touched it (no state, no test string, no title): the same record is rewritten,
 * so that "Mesin saya" has no empty machine left behind. In every other case (also a machine that
 * cannot be read, or one that is gone) the example becomes a new machine, and nothing that exists
 * is changed. If the store refuses the write, this throws and the record is as it was.
 */
export async function placeExample(
	store: MachineStore,
	openId: string | undefined,
	example: Placeable,
	now: () => number = Date.now
): Promise<{ record: SavedMachine; replaced: boolean }> {
	const current = openId === undefined ? undefined : await store.get(openId);
	if (current && current.title === '' && readTests(current.tests).length === 0) {
		const read = readStoredDocument(current.doc);
		if (read.ok && read.doc.states.length === 0) {
			const time = now();
			const record: SavedMachine = {
				...current,
				title: example.doc.title,
				kind: example.doc.kind,
				updatedAt: time,
				openedAt: time,
				doc: serializeDocument(example.doc),
				titles: example.titles
			};
			if (example.tests.length > 0) record.tests = [...example.tests];
			else delete record.tests;
			await store.put(record);
			return { record, replaced: true };
		}
	}
	const record = await createMachine(store, example.doc, now, example.titles, example.tests);
	return { record, replaced: false };
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
	// The machines of the questions are not machines of the Sandbox (question-work.ts).
	const records = (await store.list())
		.filter((r) => !isQuestionRecord(r.id))
		.sort((a, b) => b.openedAt - a.openedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
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
