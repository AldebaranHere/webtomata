// Structural types and kind definition for the editor interaction core.
// The core (`createEditorCore`) does not know whether it is editing a finite state machine
// (`MachineDocument`) or a pushdown automaton (`PdaDocument`). It only assumes that states have
// coordinates, names, start/accepting flags, and transitions connecting pairs of states.
import type { StateEntry } from '../document.ts';
import type { GenericHistory } from '../history.ts';
import type { Point } from './canvas.ts';

/**
 * The minimal document shape needed by the interaction core, selection, menu and placement.
 * Both `MachineDocument` and `PdaDocument` satisfy this structurally.
 */
export interface StatesDocument {
	readonly states: readonly StateEntry[];
	readonly start: number | null;
	readonly accepting: readonly number[];
	readonly transitions: readonly { readonly from: number; readonly to: number }[];
}

/**
 * Commands that have identical shape across FSM (`Command`) and PDA (`PdaCommand`).
 * A test of types (`satisfies`) in `document-view.test.ts` proves that both `Command` and
 * `PdaCommand` accept every `StateCommand`.
 */
export type StateCommand =
	| { type: 'addState'; x: number; y: number; name?: string }
	| { type: 'removeState'; id: number }
	| { type: 'moveState'; id: number; x: number; y: number }
	| { type: 'renameState'; id: number; name: string }
	| { type: 'setStart'; id: number | null }
	| { type: 'setAccepting'; id: number; accepting: boolean }
	| { type: 'setTitle'; title: string };

/**
 * What a specific document kind supplies to the generic interaction core.
 * Exactly four members (per DECISIONS.md and PLAN.md).
 */
export interface EditorKind<D extends StatesDocument, C> {
	/** Creates the undo/redo history for the document. */
	createHistory(initial: D): GenericHistory<D, C>;
	/** Deep equality for document comparison (dirty state tracking). */
	equal(a: D, b: D): boolean;
	/** Textual description of an edge's transitions for screen readers (empty string if none). */
	edgeText(doc: D, from: number, to: number): string;
	/** Commands to remove all transitions between `from` and `to`. */
	removeEdge(doc: D, from: number, to: number): C[];
}

/**
 * Turns a map of state positions into move commands.
 * Returns either a single `moveState` command or a batch of them.
 */
export function moveStatesCommands<C>(
	places: ReadonlyMap<number, Point>
): StateCommand | { type: 'batch'; commands: C[] } {
	const commands: StateCommand[] = [...places].map(([id, p]) => ({
		type: 'moveState',
		id,
		x: p.x,
		y: p.y
	}));
	return commands.length === 1
		? commands[0]!
		: { type: 'batch', commands: commands as unknown as C[] };
}
