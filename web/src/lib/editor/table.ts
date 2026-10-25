// The transition table of a machine: what the table view shows, and the commands that its edits
// become. No DOM. The table has a row for each state and a column for each symbol (and ε for an
// NDFSM); a cell holds the states that the machine goes to. Every edit is a command of the
// document, so the one history (and undo) covers it, and the diagram and the definition follow.
import type { Command } from './commands.ts';
import type { Kind, MachineDocument } from './document.ts';
import { freeSpot } from './interaction/placement.ts';

export interface TableCell {
	from: number;
	/** The symbol, or null for ε. */
	on: string | null;
	/** The ids of the states, sorted. */
	targets: number[];
	/** A DFSM has no transition here yet (the checks say so too). Never true for an NDFSM or ε. */
	missing: boolean;
	/** A DFSM has more than one target for the symbol: the checks say so, and the table shows both. */
	several: boolean;
}

export interface TableRow {
	id: number;
	name: string;
	start: boolean;
	accepting: boolean;
	cells: TableCell[];
}

export interface TableModel {
	kind: Kind;
	/** The symbols in the order of the alphabet, then ε (null) when there is a column for it. */
	columns: (string | null)[];
	/** Is there an ε column? An NDFSM has one; a DFSM only if it has an ε transition. */
	epsilon: boolean;
	rows: TableRow[];
}

export function tableOf(doc: MachineDocument): TableModel {
	const epsilon = doc.kind === 'ndfsm' || doc.transitions.some((t) => t.on === null);
	const columns: (string | null)[] = [...doc.alphabet, ...(epsilon ? [null] : [])];
	const rows = doc.states.map((state): TableRow => ({
		id: state.id,
		name: state.name,
		start: doc.start === state.id,
		accepting: doc.accepting.includes(state.id),
		cells: columns.map((on): TableCell => {
			const targets = doc.transitions
				.filter((t) => t.from === state.id && t.on === on)
				.map((t) => t.to)
				.sort((a, b) => a - b);
			const deterministic = doc.kind === 'dfsm' && on !== null;
			return {
				from: state.id,
				on,
				targets,
				missing: deterministic && targets.length === 0,
				several: deterministic && targets.length > 1
			};
		})
	}));
	return { kind: doc.kind, columns, epsilon, rows };
}

/**
 * The command that makes the cell hold exactly `targets`: the transitions that should not be there
 * are removed first, then the missing ones are added, in one batch (one step of the history). It is
 * `null` when the cell already holds them.
 */
export function setCellTargets(
	doc: MachineDocument,
	from: number,
	on: string | null,
	targets: readonly number[]
): Command | null {
	const have = new Set(
		doc.transitions.filter((t) => t.from === from && t.on === on).map((t) => t.to)
	);
	const want = new Set(targets);
	const commands: Command[] = [];
	for (const to of [...have].sort((a, b) => a - b)) {
		if (!want.has(to)) commands.push({ type: 'removeTransition', from, on, to });
	}
	for (const to of [...want].sort((a, b) => a - b)) {
		if (!have.has(to)) commands.push({ type: 'addTransition', from, on, to });
	}
	if (commands.length === 0) return null;
	return commands.length === 1 ? commands[0]! : { type: 'batch', commands };
}

/** Empties a cell: `null` when it is empty already. */
export function clearCell(doc: MachineDocument, from: number, on: string | null): Command | null {
	return setCellTargets(doc, from, on, []);
}

/** The distance between a new state and the one that is the furthest to the right. */
const STEP = 130;

/** A new state, to the right of the others and in the row of the last one (or at the free spot nearest to it). */
export function newStateCommand(doc: MachineDocument): Command {
	const last = doc.states.reduce<{ x: number; y: number } | null>(
		(far, s) => (far === null || s.x > far.x ? { x: s.x, y: s.y } : far),
		null
	);
	const spot = last === null ? { x: 200, y: 200 } : freeSpot(doc, { x: last.x + STEP, y: last.y });
	return { type: 'addState', x: spot.x, y: spot.y };
}

/** A new symbol. The ends are trimmed, and the document checks the rest. */
export function addSymbolCommand(symbol: string): Command {
	return { type: 'addSymbol', symbol: symbol.trim() };
}

/** What removing a symbol takes with it: the transitions that use it (for the message with Urungkan). */
export function removeSymbolNote(
	doc: MachineDocument,
	symbol: string
): { symbol: string; count: number } {
	return { symbol, count: doc.transitions.filter((t) => t.on === symbol).length };
}
