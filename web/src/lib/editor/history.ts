// Undo and redo. The history keeps the document as it was before each step, so that undo gives
// back exactly that document (the same object), whatever the command was. A document is never
// changed in place, and most of its parts are shared between versions, so this is cheap.
//
// One gesture is one step. A drag makes dozens of `moveState` commands; they carry the same
// `coalesce` key, and the history merges them into one step. `seal()` ends the group (the UI calls
// it when the pointer is released); undo and redo end it too. The history never reads a clock.
import { applyCommand } from './commands.ts';
import type { ApplyResult, Command } from './commands.ts';
import { documentsEqual } from './document.ts';
import type { MachineDocument } from './document.ts';
import { applyPdaCommand } from './pda-commands.ts';
import type { PdaApplyResult, PdaCommand } from './pda-commands.ts';
import { pdaDocumentsEqual } from './pda-document.ts';
import type { PdaDocument } from './pda-document.ts';
import type { Message } from '../engine/types.ts';

interface Step<D> {
	readonly before: D;
	after: D;
	readonly key: string | undefined;
}

type GenericApplyResult<D> = { ok: true; doc: D } | { ok: false; error: Message };

export interface GenericHistory<D, C> {
	/** The document now. */
	readonly doc: D;
	readonly canUndo: boolean;
	readonly canRedo: boolean;
	/**
	 * Applies a command. A refused command gives the error and changes nothing. A command that
	 * changes nothing is not a step. `coalesce` is the key of the gesture the command belongs to.
	 */
	execute(command: C, options?: { coalesce?: string }): GenericApplyResult<D>;
	undo(): boolean;
	redo(): boolean;
	/** Ends the current group of commands with the same key. */
	seal(): void;
	/** Calls the listener with the new document after each change. Returns a function that stops it. */
	subscribe(listener: (doc: D) => void): () => void;
}

export type History = GenericHistory<MachineDocument, Command>;
export type PdaHistory = GenericHistory<PdaDocument, PdaCommand>;

export const DEFAULT_DEPTH = 200;

function createGenericHistory<D, C>(
	initial: D,
	{
		apply,
		equal,
		limit: rawLimit
	}: {
		apply: (doc: D, command: C) => GenericApplyResult<D>;
		equal: (a: D, b: D) => boolean;
		limit?: number;
	}
): GenericHistory<D, C> {
	const limit = Math.max(1, rawLimit ?? DEFAULT_DEPTH);
	const past: Step<D>[] = [];
	const future: Step<D>[] = [];
	const listeners = new Set<(doc: D) => void>();
	let present = initial;
	let sealed = false;

	const notify = () => {
		for (const listener of [...listeners]) {
			try {
				listener(present);
			} catch {
				// A listener that fails must not break the history.
			}
		}
	};

	return {
		get doc() {
			return present;
		},
		get canUndo() {
			return past.length > 0;
		},
		get canRedo() {
			return future.length > 0;
		},

		execute(command, { coalesce } = {}) {
			const result = apply(present, command);
			if (!result.ok || result.doc === present) return result;

			const top = past[past.length - 1];
			if (coalesce !== undefined && !sealed && top !== undefined && top.key === coalesce) {
				top.after = result.doc;
				// A gesture that ends where it began is not a step.
				if (equal(top.before, top.after)) past.pop();
			} else {
				past.push({ before: present, after: result.doc, key: coalesce });
				if (past.length > limit) past.shift();
			}
			future.length = 0;
			present = result.doc;
			sealed = false;
			notify();
			return result;
		},

		undo() {
			const step = past.pop();
			if (step === undefined) return false;
			future.push(step);
			present = step.before;
			sealed = true;
			notify();
			return true;
		},

		redo() {
			const step = future.pop();
			if (step === undefined) return false;
			past.push(step);
			present = step.after;
			sealed = true;
			notify();
			return true;
		},

		seal() {
			sealed = true;
		},

		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		}
	};
}

export function createHistory(initial: MachineDocument, options: { limit?: number } = {}): History {
	return createGenericHistory<MachineDocument, Command>(initial, {
		apply: applyCommand as (doc: MachineDocument, command: Command) => ApplyResult,
		equal: documentsEqual,
		limit: options.limit
	});
}

export function createPdaHistory(
	initial: PdaDocument,
	options: { limit?: number } = {}
): PdaHistory {
	return createGenericHistory<PdaDocument, PdaCommand>(initial, {
		apply: applyPdaCommand as (doc: PdaDocument, command: PdaCommand) => PdaApplyResult,
		equal: pdaDocumentsEqual,
		limit: options.limit
	});
}
