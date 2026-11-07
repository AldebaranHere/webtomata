// The logic of the PDA label form: how the text of the three fields becomes symbols and strings
// of stack symbols, and how the difference from what the edge has becomes the commands for
// `commitEdge` (docs/agent/PLAN.md, T-054; design/screens/pda-editor.md, section 8).
import type { MessageKey } from '#lib/i18n/id.ts';
import { formatStackSeq, stackSeparator } from './diagram/pda-diagram.ts';
import type { Refusal } from './interaction/editor.ts';
import type { MenuAction } from './interaction/menu.ts';
import type { PdaCommand } from './pda-commands.ts';
import type { PdaDocument } from './pda-document.ts';

export interface Row {
	read: string;
	pop: string;
	push: string;
}

export interface ParsedTransition {
	read: string | null;
	pop: string[];
	push: string[];
}

export const pdaMenuLabels: Partial<Record<MenuAction, MessageKey>> = {
	edit: 'pda_editor.menu_edit'
};

function sameList(a: readonly string[], b: readonly string[]): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

function sameParsed(a: ParsedTransition, b: ParsedTransition): boolean {
	return a.read === b.read && sameList(a.pop, b.pop) && sameList(a.push, b.push);
}

/**
 * Returns the transitions of the pair (from, to) formatted as text rows in `doc.transitions` order.
 * An edge with no transitions returns `[]`.
 */
export function rowsOf(doc: PdaDocument, from: number, to: number): Row[] {
	const sep = stackSeparator(doc.stackAlphabet);
	return doc.transitions
		.filter((t) => t.from === from && t.to === to)
		.map((t) => ({
			read: t.read ?? 'ε',
			pop: formatStackSeq(t.pop, sep),
			push: formatStackSeq(t.push, sep)
		}));
}

type ParseReadResult = { ok: true; read: string | null } | { ok: false; refusal: Refusal };

function parseRead(doc: PdaDocument, text: string): ParseReadResult {
	const trimmed = text.trim();
	if (
		trimmed === '' ||
		trimmed === 'ε' ||
		(trimmed === 'eps' && !doc.inputAlphabet.includes('eps'))
	) {
		return { ok: true, read: null };
	}
	if (/\s/.test(trimmed)) {
		return {
			ok: false,
			refusal: {
				key: 'pda_editor.read_one_symbol',
				params: { text: trimmed }
			}
		};
	}
	const codePoints = [...trimmed];
	const allSingle = doc.inputAlphabet.every((s) => [...s].length === 1);
	if (codePoints.length > 1 && allSingle) {
		return {
			ok: false,
			refusal: {
				key: 'pda_editor.read_one_symbol',
				params: { text: trimmed }
			}
		};
	}
	return { ok: true, read: trimmed };
}

function parseStackSeq(doc: PdaDocument, text: string): string[] {
	const trimmed = text.trim();
	if (
		trimmed === '' ||
		trimmed === 'ε' ||
		(trimmed === 'eps' && !doc.stackAlphabet.includes('eps'))
	) {
		return [];
	}
	const hasCommaSymbol = doc.stackAlphabet.some((s) => s.includes(','));
	if (!hasCommaSymbol && trimmed.includes(',')) {
		return trimmed.split(/[\s,]+/).filter((s) => s.length > 0);
	}
	if (/\s/.test(trimmed)) {
		return trimmed.split(/\s+/).filter((s) => s.length > 0);
	}
	const allSingle = doc.stackAlphabet.every((s) => [...s].length === 1);
	if (allSingle) {
		return [...trimmed];
	}
	return [trimmed];
}

/**
 * Parses form rows into parsed transitions. Blank rows are dropped and duplicate transitions
 * are collapsed in order of first appearance. If a read field is invalid, returns the Refusal.
 */
export function parseRows(doc: PdaDocument, rows: readonly Row[]): ParsedTransition[] | Refusal {
	const parsedList: ParsedTransition[] = [];
	for (const row of rows) {
		const readTrimmed = row.read.trim();
		const popTrimmed = row.pop.trim();
		const pushTrimmed = row.push.trim();
		if (readTrimmed === '' && popTrimmed === '' && pushTrimmed === '') {
			continue;
		}

		const readRes = parseRead(doc, row.read);
		if (!readRes.ok) return readRes.refusal;

		const pop = parseStackSeq(doc, row.pop);
		const push = parseStackSeq(doc, row.push);
		const entry: ParsedTransition = { read: readRes.read, pop, push };

		if (!parsedList.some((p) => sameParsed(p, entry))) {
			parsedList.push(entry);
		}
	}
	return parsedList;
}

/**
 * Derives the commands needed to make the edge from -> to have exactly the transitions of `rows`.
 * New symbols are added first (input then stack, in order of first appearance), followed by new
 * transitions, followed by removed transitions. Returns `[]` if no changes are needed.
 */
export function rowCommands(
	doc: PdaDocument,
	from: number,
	to: number,
	rows: readonly Row[]
): PdaCommand[] | Refusal {
	const parsed = parseRows(doc, rows);
	if ('key' in parsed) return parsed;

	const newInputs: string[] = [];
	const newStacks: string[] = [];

	for (const t of parsed) {
		if (t.read !== null && !doc.inputAlphabet.includes(t.read) && !newInputs.includes(t.read)) {
			newInputs.push(t.read);
		}
		for (const s of t.pop) {
			if (!doc.stackAlphabet.includes(s) && !newStacks.includes(s)) {
				newStacks.push(s);
			}
		}
		for (const s of t.push) {
			if (!doc.stackAlphabet.includes(s) && !newStacks.includes(s)) {
				newStacks.push(s);
			}
		}
	}

	const commands: PdaCommand[] = [];

	for (const s of newInputs) {
		commands.push({ type: 'addInputSymbol', symbol: s });
	}
	for (const s of newStacks) {
		commands.push({ type: 'addStackSymbol', symbol: s });
	}

	const current = doc.transitions.filter((t) => t.from === from && t.to === to);

	for (const wanted of parsed) {
		const exists = current.some(
			(c) => c.read === wanted.read && sameList(c.pop, wanted.pop) && sameList(c.push, wanted.push)
		);
		if (!exists) {
			commands.push({
				type: 'addTransition',
				from,
				read: wanted.read,
				pop: wanted.pop,
				push: wanted.push,
				to
			});
		}
	}

	for (const c of current) {
		const stillWanted = parsed.some(
			(p) => p.read === c.read && sameList(p.pop, c.pop) && sameList(p.push, c.push)
		);
		if (!stillWanted) {
			commands.push({
				type: 'removeTransition',
				from,
				read: c.read,
				pop: c.pop,
				push: c.push,
				to
			});
		}
	}

	return commands;
}
