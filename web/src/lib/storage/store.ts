// What is saved on the device: one record for each machine. The record holds the document as the
// text that `serializeDocument` makes, so it is checked again, with every rule, when it is read.
// The list can be shown without reading any document: the title, the kind and the dates are
// copies in the record. See docs/decisions/0023-saved-machines.md.
import type { Kind } from '../editor/document.ts';
import type { Progress } from './progress.ts';

/** The title of a machine that comes from our own content, in both languages. */
export interface Titles {
	id: string;
	en: string;
}

export interface SavedMachine {
	id: string;
	/** The shape of this record (not of the document, which has its own `schemaVersion`). */
	recordVersion: 1;
	title: string;
	kind: Kind;
	createdAt: number;
	updatedAt: number;
	/** When the machine was last opened: the Sandbox opens the one with the biggest value. */
	openedAt: number;
	doc: string;
	/**
	 * Set for a machine that comes from our content (the sample, an example). While the title of the
	 * document is one of these, the page shows the one of its language. A title that the user
	 * chooses is the user’s, and the record does not keep this any more.
	 */
	titles?: Titles;
	/**
	 * The strings that the student tests the machine with (S6-3), in the order they were added. It
	 * is a field of the record, not of the document: it is not in the undo history and not in a
	 * file. Anything may have written it, so it is read with `readTests`.
	 */
	tests?: string[];
	/**
	 * Only on the record of a question (`soal:<id>`): how the student is doing on it (Q5). Anything may have
	 * written it, so it is read with `readProgress`. Like `tests`, it is a field of the record and not of the
	 * document.
	 */
	progress?: Progress;
}

/** The place where the records are kept. A write is whole or it is not made. */
export interface MachineStore {
	/** Every record, in the order of the ids. */
	list(): Promise<SavedMachine[]>;
	get(id: string): Promise<SavedMachine | undefined>;
	/** Adds the record, or replaces the one with the same id. */
	put(record: SavedMachine): Promise<void>;
	/** A record that is not there is not an error. */
	delete(id: string): Promise<void>;
}

/** A new id for a machine. */
export function newId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	// An older browser, or a page that is not secure: random enough to not meet another id.
	const part = () =>
		Math.floor(Math.random() * 0x100000000)
			.toString(16)
			.padStart(8, '0');
	return `${part()}-${part()}-${part()}`;
}
