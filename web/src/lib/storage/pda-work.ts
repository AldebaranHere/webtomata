// Opening and making saved pushdown automata (PDA) on the device.
// A PDA record lives in the same store as FSM machines ('machines' in IndexedDB),
// but is marked with `type: 'pda'`.
import { LIMITS } from '../editor/document.ts';
import {
	createPdaDocument,
	parsePdaDocument,
	serializePdaDocument
} from '../editor/pda-document.ts';
import type { PdaDocument } from '../editor/pda-document.ts';
import type { DocumentCodec } from './autosave.ts';
import { isPdaRecord, newId } from './store.ts';
import type { MachineStore, SavedPdaMachine } from './store.ts';

export const CURRENT_PDA_VERSION = 1;

/** Why a PDA document could not be read. */
export type Unreadable = 'corrupt' | 'newer' | 'unsupported';

export type PdaReadResult = { ok: true; doc: PdaDocument } | { ok: false; reason: Unreadable };

export interface SkippedPda {
	id: string;
	title: string;
	reason: Unreadable;
}

export interface OpenedPda {
	record: SavedPdaMachine;
	doc: PdaDocument;
	/** The PDA machines that could not be read. Kept untouched in the store. */
	skipped: SkippedPda[];
}

/** The codec for autosaving PDA documents in the shared autosave queue. */
export const pdaDocumentCodec: DocumentCodec<PdaDocument, SavedPdaMachine> = {
	serialize: serializePdaDocument,
	apply(record, doc) {
		record.title = doc.title;
		record.kind = doc.kind;
	}
};

/** Reads the text of a saved PDA document. It never throws. */
export function readStoredPda(text: string): PdaReadResult {
	const corrupt: PdaReadResult = { ok: false, reason: 'corrupt' };
	// The text is at least as many bytes as it has units, so this cannot refuse a good document (mirrors migrate.ts).
	if (typeof text !== 'string' || text.length > LIMITS.documentBytes) return corrupt;

	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return corrupt;
	}

	if (typeof value !== 'object' || value === null || Array.isArray(value)) return corrupt;
	if (!('schemaVersion' in value)) return corrupt;

	const version = value.schemaVersion;
	if (typeof version !== 'number' || !Number.isInteger(version)) return corrupt;
	if (version > CURRENT_PDA_VERSION) return { ok: false, reason: 'newer' };
	if (version < CURRENT_PDA_VERSION) return { ok: false, reason: 'unsupported' };

	const parsed = parsePdaDocument(value);
	if (!parsed.ok) return corrupt;
	return { ok: true, doc: parsed.value };
}

/** Saves a PDA document as a new record in the store. */
export async function createPdaMachine(
	store: MachineStore,
	doc: PdaDocument,
	now: () => number = Date.now
): Promise<SavedPdaMachine> {
	const time = now();
	const record: SavedPdaMachine = {
		id: newId(),
		recordVersion: 1,
		type: 'pda',
		title: doc.title,
		kind: doc.kind,
		createdAt: time,
		updatedAt: time,
		openedAt: time,
		doc: serializePdaDocument(doc)
	};
	await store.put(record);
	return record;
}

/**
 * The document of a record that was just written. The text is one this module serialized, so it can
 * be read; a failure here is a bug, not a bad record of the device.
 */
function readWritten(record: SavedPdaMachine): PdaDocument {
	const read = readStoredPda(record.doc);
	if (!read.ok) throw new Error('placePdaExample: the document just written is unreadable');
	return read.doc;
}

/**
 * Opens an example from the first-run card: in the place of the current PDA when that record is
 * empty and untouched (title `''`, no state, no symbol in either alphabet, read from the store),
 * otherwise as a PDA of its own, as `placeExample` does for an FSM (`storage/machines.ts`). The
 * document comes back from the store, so the editor edits a copy and never the sample; a write that
 * is refused rejects and leaves the current record exactly as it was. It makes or finds the record
 * only through `createPdaMachine` and `store.put`.
 */
export async function placePdaExample(
	store: MachineStore,
	openId: string | undefined,
	doc: PdaDocument,
	now: () => number = Date.now
): Promise<{ record: SavedPdaMachine; doc: PdaDocument; replaced: boolean }> {
	const current = openId === undefined ? undefined : await store.get(openId);
	if (current && isPdaRecord(current) && current.title === '') {
		const read = readStoredPda(current.doc);
		if (
			read.ok &&
			read.doc.states.length === 0 &&
			read.doc.inputAlphabet.length === 0 &&
			read.doc.stackAlphabet.length === 0
		) {
			const time = now();
			const record: SavedPdaMachine = {
				...current,
				title: doc.title,
				kind: doc.kind,
				updatedAt: time,
				openedAt: time,
				doc: serializePdaDocument(doc)
			};
			await store.put(record);
			return { record, doc: readWritten(record), replaced: true };
		}
	}
	const record = await createPdaMachine(store, doc, now);
	return { record, doc: readWritten(record), replaced: false };
}

/**
 * The PDA machine that was opened last. A record that cannot be read is skipped and kept as it is.
 * When none can be read or none exists, an empty NDPDA (createPdaDocument()) is saved as a new record.
 * A store put failure never stops opening; an error of store.list() propagates.
 */
export async function openLatestPda(
	store: MachineStore,
	now: () => number = Date.now
): Promise<OpenedPda> {
	const records = (await store.list())
		.filter(isPdaRecord)
		.sort((a, b) => b.openedAt - a.openedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

	const skipped: SkippedPda[] = [];
	for (const record of records) {
		const read = readStoredPda(record.doc);
		if (!read.ok) {
			skipped.push({ id: record.id, title: record.title, reason: read.reason });
			continue;
		}
		const opened: SavedPdaMachine = { ...record, openedAt: now() };
		try {
			await store.put(opened);
		} catch {
			// A refused write does not stop it from opening.
		}
		return { record: opened, doc: read.doc, skipped };
	}

	const emptyDoc = createPdaDocument();
	const time = now();
	const fallbackRecord: SavedPdaMachine = {
		id: newId(),
		recordVersion: 1,
		type: 'pda',
		title: emptyDoc.title,
		kind: emptyDoc.kind,
		createdAt: time,
		updatedAt: time,
		openedAt: time,
		doc: serializePdaDocument(emptyDoc)
	};
	try {
		await store.put(fallbackRecord);
	} catch {
		// A refused fallback write does not stop it from opening.
	}
	return { record: fallbackRecord, doc: emptyDoc, skipped };
}
