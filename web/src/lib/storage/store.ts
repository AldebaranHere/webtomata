// What is saved on the device: one record for each machine. The record holds the document as the
// text that `serializeDocument` makes, so it is checked again, with every rule, when it is read.
// The list can be shown without reading any document: the title, the kind and the dates are
// copies in the record. See docs/decisions/0023-saved-machines.md.
import type { Kind } from '../editor/document.ts';

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
