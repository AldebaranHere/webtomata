// The file chosen in "Mesin saya" (`.jff` or JSON): the whole opening, for a machine and for a PDA.
// It is a lazy module, so the page keeps one hook and its first load stays small. The file is told by
// its content: a PDA file becomes a new PDA record and the PDA mode, and anything else goes through
// the FSM reader exactly as before. A file that fails writes nothing and says why in the list, which
// stays open; a file that opens closes the list and clears an older failure.
import type { MachineDocument } from '../editor/document.ts';
import { engine } from '../engine/client.ts';
import { id as idMessages } from '../i18n/id.ts';
import type { MessageKey } from '../i18n/id.ts';
import type { Problem } from '../storage/library.ts';
import { createPdaMachine } from '../storage/pda-work.ts';
import type { MachineStore } from '../storage/store.ts';
import type { WorkstationMode } from '../workstation-mode.ts';
import { openFile } from './open-file.ts';
import type { ImportFile } from './open-file.ts';
import { isPdaFile, openPdaFile } from './pda-files.ts';

/** A message that the page shows, already a key and its parameters. */
export interface Notice {
	key: MessageKey;
	params: Record<string, string | number>;
}

/**
 * What the opener needs from the page: the library (its store, its message and its list), the mode
 * and how to switch it, the page's notice and its notes, the PDA open request, and the untitled word.
 */
export interface OpenFromFileContext {
	library: {
		readonly store: MachineStore | null;
		problem: Problem | null;
		hide: () => void;
		openDocument: (doc: MachineDocument) => Promise<Problem | null>;
	};
	mode: () => WorkstationMode;
	selectMode: (mode: WorkstationMode) => Promise<void>;
	notice: (note: Notice | null) => void;
	notes: (notes: Notice[]) => void;
	requestPda: (id: string) => void;
	untitled: string;
}

const known = (key: string) => Object.hasOwn(idMessages, key);

/** A key that `known` found in the shared dictionary, as the type `t` takes. Safe by that check. */
const asMessageKey = (key: string): MessageKey => key as MessageKey;

/** Why a file was refused: its own words when the shared dictionary has them, else the calm "cannot". */
function problemOf(error: { key: string; params: Record<string, string | number> }): Problem {
	return known(error.key)
		? { key: error.key, params: error.params }
		: { key: 'import.unreadable', params: {} };
}

async function openFsm(file: ImportFile, context: OpenFromFileContext): Promise<void> {
	const result = await openFile(file, engine);
	if (!result.ok) {
		context.library.problem = problemOf(result.error);
		return;
	}
	const { doc, notes } = result.value;
	const problem = await context.library.openDocument(doc);
	if (problem) return;
	context.notes(
		notes
			.filter((note) => known(note.key))
			.map((note) => ({ key: asMessageKey(note.key), params: note.params }))
	);
	if (context.mode() === 'pda') await context.selectMode('fsm');
	context.notice({ key: 'import.opened', params: { title: doc.title || context.untitled } });
}

async function openPda(file: ImportFile, context: OpenFromFileContext): Promise<void> {
	const result = await openPdaFile(file, engine);
	if (!result.ok) {
		context.library.problem = problemOf(result.error);
		return;
	}
	const doc = result.value;
	const store = context.library.store;
	if (!store) {
		context.library.problem = { key: 'storage.failed', params: {} };
		return;
	}
	let id: string;
	try {
		const record = await createPdaMachine(store, doc);
		id = record.id;
	} catch {
		context.library.problem = { key: 'storage.failed', params: {} };
		return;
	}
	// The record is written: the list closes and an older failure goes away, as opening an FSM does.
	context.library.hide();
	context.library.problem = null;
	if (context.mode() !== 'pda') await context.selectMode('pda');
	context.requestPda(id);
	context.notice({ key: 'import.opened', params: { title: doc.title || context.untitled } });
}

/** Opens the chosen file: a PDA file in the PDA mode as a new record, anything else as an FSM file. */
export async function openFromFile(file: ImportFile, context: OpenFromFileContext): Promise<void> {
	if (await isPdaFile(file)) return openPda(file, context);
	return openFsm(file, context);
}
