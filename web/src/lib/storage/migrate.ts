// Reading a saved document, and moving an old one up to the version of this program. A document
// that cannot be read is never changed or deleted by this code: the caller keeps the record as it
// is and says so (docs/decisions/0023-saved-machines.md).
import { LIMITS, parseDocument } from '../editor/document.ts';
import type { MachineDocument } from '../editor/document.ts';

/** The `schemaVersion` of the documents that this program writes. */
export const CURRENT_VERSION = 1;

/** Moves a document from one version to the next. The result has the next `schemaVersion`. */
export type Migration = (value: Record<string, unknown>) => Record<string, unknown>;

/**
 * The migrations, by the version they start from. There is none yet: version 1 is the first. The
 * first change of the format adds `1: ...` here, with a test, and a file saved today is then read.
 */
export const MIGRATIONS: Record<number, Migration> = {};

/** Why a document could not be read: it is damaged, it is newer than this program, or it is older and has no migration. */
export type Unreadable = 'corrupt' | 'newer' | 'unsupported';
export type ReadResult = { ok: true; doc: MachineDocument } | { ok: false; reason: Unreadable };

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/** Reads the text of a saved document. It never throws. */
export function readStoredDocument(
	text: string,
	migrations: Record<number, Migration> = MIGRATIONS
): ReadResult {
	const corrupt: ReadResult = { ok: false, reason: 'corrupt' };
	// The text is at least as many bytes as it has units, so this cannot refuse a good document.
	if (typeof text !== 'string' || text.length > LIMITS.documentBytes) return corrupt;
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return corrupt;
	}
	if (!isObject(value)) return corrupt;
	const first = value.schemaVersion;
	if (typeof first !== 'number' || !Number.isInteger(first) || first < 0) return corrupt;
	let version: number = first;
	if (version > CURRENT_VERSION) return { ok: false, reason: 'newer' };

	let current: Record<string, unknown> = value;
	while (version < CURRENT_VERSION) {
		const migrate = migrations[version];
		if (!migrate) return { ok: false, reason: 'unsupported' };
		try {
			current = migrate(current);
		} catch {
			return corrupt;
		}
		const next = current.schemaVersion;
		// A migration must move the version up, or this loop would not end.
		if (typeof next !== 'number' || !Number.isInteger(next) || next <= version) return corrupt;
		version = next;
	}

	const parsed = parseDocument(current);
	return parsed.ok ? { ok: true, doc: parsed.value } : corrupt;
}
