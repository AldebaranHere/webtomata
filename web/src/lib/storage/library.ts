// What the list "Mesin saya" does to the saved machines, with no DOM and no framework: list them,
// duplicate, rename, delete (with a time to undo), and say how long ago. The machine that is open
// is not changed here (its title goes through the editor, so that undo works).
import { applyCommand } from '../editor/commands.ts';
import { LIMITS, serializeDocument } from '../editor/document.ts';
import type { Kind } from '../editor/document.ts';
import { readStoredDocument } from './migrate.ts';
import type { Unreadable } from './migrate.ts';
import { newId } from './store.ts';
import type { MachineStore, SavedMachine } from './store.ts';

/** What a row of the list needs. */
export interface Entry {
	id: string;
	title: string;
	kind: Kind;
	updatedAt: number;
	openedAt: number;
	readable: boolean;
	/** Why a machine cannot be opened (it is kept as it is). */
	reason?: Unreadable;
}

/** A message of the list, as a key with parameters. */
export interface Problem {
	key: string;
	params: Record<string, string | number>;
}

/** The machines, the one opened last first. A machine that cannot be read is in the list, marked. */
export async function listEntries(store: MachineStore): Promise<Entry[]> {
	const records = await store.list();
	return records
		.map((record): Entry => {
			const read = readStoredDocument(record.doc);
			return {
				id: record.id,
				title: record.title,
				kind: record.kind,
				updatedAt: record.updatedAt,
				openedAt: record.openedAt,
				readable: read.ok,
				...(read.ok ? {} : { reason: read.reason })
			};
		})
		.sort((a, b) => b.openedAt - a.openedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

const SUFFIX = ' (salinan)';

/**
 * A copy under a new id, with the title "… (salinan)". It is not opened: in the list it sits right
 * under the original. Nothing is made for a machine that is gone or cannot be read.
 */
export async function duplicateMachine(
	store: MachineStore,
	id: string,
	now: () => number = Date.now
): Promise<SavedMachine | undefined> {
	const source = await store.get(id);
	if (!source) return undefined;
	const read = readStoredDocument(source.doc);
	if (!read.ok) return undefined;
	const room = LIMITS.titleChars - [...SUFFIX].length;
	const title = [...read.doc.title].slice(0, room).join('') + SUFFIX;
	const titled = applyCommand(read.doc, { type: 'setTitle', title });
	if (!titled.ok) return undefined;
	const time = now();
	const record: SavedMachine = {
		id: newId(),
		recordVersion: 1,
		title,
		kind: titled.doc.kind,
		createdAt: time,
		updatedAt: time,
		openedAt: source.openedAt - 1,
		doc: serializeDocument(titled.doc)
	};
	await store.put(record);
	return record;
}

/** Changes the title of a machine that is not open. Returns why it was refused, or null. */
export async function renameStored(
	store: MachineStore,
	id: string,
	title: string,
	now: () => number = Date.now
): Promise<Problem | null> {
	const source = await store.get(id);
	if (!source) return { key: 'library.missing', params: {} };
	const read = readStoredDocument(source.doc);
	if (!read.ok) return { key: 'library.unreadable', params: {} };
	const result = applyCommand(read.doc, { type: 'setTitle', title });
	if (!result.ok)
		return { key: result.error.key, params: result.error.params as Problem['params'] };
	await store.put({ ...source, title, updatedAt: now(), doc: serializeDocument(result.doc) });
	return null;
}

export async function deleteStored(store: MachineStore, id: string): Promise<void> {
	await store.delete(id);
}

export interface PendingDeletes {
	/** The machine leaves the list now, and is removed for good when the time ends. */
	begin(id: string): void;
	undo(id: string): void;
	isPending(id: string): boolean;
	ids(): string[];
	/** Stops every timer. A machine that is waiting is kept: nothing is removed unless its time ends. */
	dispose(): void;
}

/**
 * Delete with a time to undo. Closing the page inside the time keeps the machine, which is the safe
 * direction: it is never removed unless the time ends.
 */
export function createPendingDeletes(options: {
	store: MachineStore;
	delayMs?: number;
	onChange: () => void;
}): PendingDeletes {
	const { store, delayMs = 6000, onChange } = options;
	const timers = new Map<string, ReturnType<typeof setTimeout>>();
	let disposed = false;

	return {
		begin(id) {
			if (disposed || timers.has(id)) return;
			timers.set(
				id,
				setTimeout(async () => {
					try {
						await store.delete(id);
					} catch {
						// It could not be removed: it comes back to the list.
					}
					timers.delete(id);
					onChange();
				}, delayMs)
			);
			onChange();
		},
		undo(id) {
			const timer = timers.get(id);
			if (timer === undefined) return;
			clearTimeout(timer);
			timers.delete(id);
			onChange();
		},
		isPending: (id) => timers.has(id),
		ids: () => [...timers.keys()],
		dispose() {
			disposed = true;
			for (const timer of timers.values()) clearTimeout(timer);
			timers.clear();
		}
	};
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How long ago, as a message key and a number, in the biggest whole unit. */
export function relativeTime(then: number, now: number): { key: string; n: number } {
	const gap = now - then;
	if (gap < MINUTE) return { key: 'library.when_now', n: 0 };
	if (gap < HOUR) return { key: 'library.when_minutes', n: Math.floor(gap / MINUTE) };
	if (gap < DAY) return { key: 'library.when_hours', n: Math.floor(gap / HOUR) };
	const days = Math.floor(gap / DAY);
	if (days === 1) return { key: 'library.when_yesterday', n: 1 };
	if (days < 30) return { key: 'library.when_days', n: days };
	return { key: 'library.when_long', n: days };
}
