// The pure part of the editable PDA table: what an edit of a row becomes, the counts that the
// toast shows, where a new state goes, and the names that the Alfabet field refuses before it
// sends anything (docs/agent/PLAN.md, Task T-061). No DOM, no editor.
//
// A row is parsed by `parseRows` of the label form (the only parser of a transition's text) and
// sent as ONE batch, so one Urungkan takes the row and the alphabet back together.
import { freeSpot } from './interaction/placement.ts';
import type { Refusal } from './interaction/editor.ts';
import type { PdaCommand } from './pda-commands.ts';
import type { PdaDocument, PdaTransitionEntry } from './pda-document.ts';
import { EPSILON_WORDS, parseRows } from './pda-label.ts';
import type { ParsedTransition } from './pda-label.ts';

/** The five controls of a row as the student left them; an empty `read` means ε. */
export interface RowFields {
	from: number | null;
	to: number | null;
	read: string;
	pop: string;
	push: string;
}

export type SymbolKind = 'input' | 'stack';

const refuse = (key: Refusal['key'], params: Refusal['params'] = {}): Refusal => ({ key, params });

const sameList = (a: readonly string[], b: readonly string[]): boolean =>
	a.length === b.length && a.every((symbol, i) => symbol === b[i]);

/** The row as the label form's parser wants it. */
const textRow = (fields: RowFields) => ({
	read: fields.read,
	pop: fields.pop,
	push: fields.push
});

/** How many transitions a symbol is in: its `read`, or its `pop` and `push` (the toast of F5). */
export function symbolUseCount(doc: PdaDocument, symbol: string, kind: SymbolKind): number {
	return doc.transitions.filter((t) =>
		kind === 'input' ? t.read === symbol : t.pop.includes(symbol) || t.push.includes(symbol)
	).length;
}

/** How many transitions a state is in, from or to: what `removeState` takes with it. */
export function stateUseCount(doc: PdaDocument, id: number): number {
	return doc.transitions.filter((t) => t.from === id || t.to === id).length;
}

/** The distance between a new state and the one that is the furthest to the right. */
const STEP = 130;

/**
 * A new state, to the right of the others and in the row of the last one, at the nearest free spot.
 * The FSM's `newStateCommand` says the same thing but is typed for `MachineDocument`, and no FSM
 * file changes in this task.
 */
export function addStateCommand(doc: PdaDocument): PdaCommand {
	const last = doc.states.reduce<{ x: number; y: number } | null>(
		(far, state) => (far === null || state.x > far.x ? { x: state.x, y: state.y } : far),
		null
	);
	const spot = last === null ? { x: 200, y: 200 } : freeSpot(doc, { x: last.x + STEP, y: last.y });
	return { type: 'addState', x: spot.x, y: spot.y };
}

/** The commands that add the symbols of a row that the document does not have yet. */
function newSymbolCommands(doc: PdaDocument, wanted: ParsedTransition): PdaCommand[] {
	const commands: PdaCommand[] = [];
	if (wanted.read !== null && !doc.inputAlphabet.includes(wanted.read)) {
		commands.push({ type: 'addInputSymbol', symbol: wanted.read });
	}
	const seen = new Set<string>();
	for (const symbol of [...wanted.pop, ...wanted.push]) {
		if (doc.stackAlphabet.includes(symbol) || seen.has(symbol)) continue;
		seen.add(symbol);
		commands.push({ type: 'addStackSymbol', symbol });
	}
	return commands;
}

/** The index of the row that already holds this transition (zero-based), or null. */
function duplicateRow(
	doc: PdaDocument,
	from: number,
	to: number,
	wanted: ParsedTransition,
	except: number | null
): number | null {
	const found = doc.transitions.findIndex(
		(t, i) =>
			i !== except &&
			t.from === from &&
			t.to === to &&
			t.read === wanted.read &&
			sameList(t.pop, wanted.pop) &&
			sameList(t.push, wanted.push)
	);
	return found < 0 ? null : found;
}

function removeCommand(row: PdaTransitionEntry): PdaCommand {
	return {
		type: 'removeTransition',
		from: row.from,
		read: row.read,
		pop: row.pop,
		push: row.push,
		to: row.to
	};
}

/**
 * The command of an edited row, `null` when the edit changes nothing, or the refusal of a row that
 * would be the same as another one (which would otherwise merge and disappear).
 */
export function editRowCommand(
	doc: PdaDocument,
	index: number,
	fields: RowFields
): PdaCommand | Refusal | null {
	const old = doc.transitions[index];
	if (old === undefined || fields.from === null || fields.to === null) return null;

	const parsed = parseRows(doc, [textRow(fields)]);
	if (!Array.isArray(parsed)) return parsed;
	const wanted = parsed[0];
	if (wanted === undefined) return null;

	const same =
		old.from === fields.from &&
		old.to === fields.to &&
		old.read === wanted.read &&
		sameList(old.pop, wanted.pop) &&
		sameList(old.push, wanted.push);
	if (same) return null;

	const duplicate = duplicateRow(doc, fields.from, fields.to, wanted, index);
	if (duplicate !== null) return refuse('pda_editor.row_duplicate', { n: duplicate + 1 });

	return {
		type: 'batch',
		commands: [
			...newSymbolCommands(doc, wanted),
			removeCommand(old),
			{
				type: 'addTransition',
				from: fields.from,
				read: wanted.read,
				pop: wanted.pop,
				push: wanted.push,
				to: fields.to
			}
		]
	};
}

/**
 * The command that sends the draft row: `null` while its Dari or its Ke is not chosen or the row
 * is blank. With a new stack symbol it is one batch (the symbol first), as an edit of a row is;
 * with nothing new it is the plain `addTransition` of the draft (F6 of the plan).
 */
export function draftCommand(doc: PdaDocument, fields: RowFields): PdaCommand | Refusal | null {
	if (fields.from === null || fields.to === null) return null;

	const parsed = parseRows(doc, [textRow(fields)]);
	if (!Array.isArray(parsed)) return parsed;
	const wanted = parsed[0];
	if (wanted === undefined) return null;

	const duplicate = duplicateRow(doc, fields.from, fields.to, wanted, null);
	if (duplicate !== null) return refuse('pda_editor.row_duplicate', { n: duplicate + 1 });

	const added: PdaCommand = {
		type: 'addTransition',
		from: fields.from,
		read: wanted.read,
		pop: wanted.pop,
		push: wanted.push,
		to: fields.to
	};
	const symbols = newSymbolCommands(doc, wanted);
	return symbols.length === 0 ? added : { type: 'batch', commands: [...symbols, added] };
}

/**
 * Why the Alfabet field refuses a name before it sends a command, or null. `eps` and ε are the
 * words that mean ε in a transition field, so neither can be a symbol's name; a name with a space
 * or a comma could not be typed in Pop or Push. The document checks the rest (empty, too long).
 */
export function symbolNameRefusal(text: string): Refusal | null {
	const name = text.trim();
	if (EPSILON_WORDS.includes(name) || /\s/.test(name) || name.includes(',')) {
		return refuse('pda_editor.symbol_reserved');
	}
	return null;
}
