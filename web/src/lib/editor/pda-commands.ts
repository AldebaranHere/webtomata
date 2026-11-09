// The commands that change a PDA document. A command is plain data, so it can be logged, sent and
// replayed. `applyPdaCommand` is a pure function: it makes a new document and leaves the old one
// whole (used by `createPdaHistory` in `pda-history.ts`). A command that is not valid is refused with
// a message, the document stays as it was, and nothing is thrown.
//
// A command that would change nothing gives back the same document object, so that the history
// does not make a step for it.
import {
	LIMITS,
	checkName,
	checkSymbol,
	checkTitle,
	isCoordinate,
	message,
	stateEntry
} from './document.ts';
import type { Check, StateEntry } from './document.ts';
import {
	MAX_PDA_STRING,
	comparePdaTransitions,
	freezePdaDocument,
	pdaTransitionEntry
} from './pda-document.ts';
import type { PdaDocument, PdaKind, PdaTransitionEntry } from './pda-document.ts';
import type { Message } from '../engine/types.ts';

export type PdaCommand =
	| { type: 'addState'; x: number; y: number; name?: string }
	| { type: 'removeState'; id: number }
	| { type: 'moveState'; id: number; x: number; y: number }
	| { type: 'renameState'; id: number; name: string }
	| { type: 'setStart'; id: number | null }
	| { type: 'setAccepting'; id: number; accepting: boolean }
	| {
			type: 'addTransition';
			from: number;
			read: string | null;
			pop: readonly string[];
			push: readonly string[];
			to: number;
	  }
	| {
			type: 'removeTransition';
			from: number;
			read: string | null;
			pop: readonly string[];
			push: readonly string[];
			to: number;
	  }
	| { type: 'addInputSymbol'; symbol: string }
	| { type: 'removeInputSymbol'; symbol: string }
	| { type: 'addStackSymbol'; symbol: string }
	| { type: 'removeStackSymbol'; symbol: string }
	| { type: 'setKind'; kind: PdaKind }
	| { type: 'setTitle'; title: string }
	| { type: 'batch'; commands: PdaCommand[] };

export type PdaApplyResult = { ok: true; doc: PdaDocument } | { ok: false; error: Message };

const fail = (key: string, params: Message['params'] = {}): PdaApplyResult => ({
	ok: false,
	error: message(key, params)
});
const done = (doc: PdaDocument): PdaApplyResult => ({ ok: true, doc });
const failed = (check: Check): PdaApplyResult | undefined =>
	check.ok ? undefined : { ok: false, error: check.error };

const isId = (value: unknown): value is number =>
	typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isSymbolOrEpsilon = (value: unknown): value is string | null =>
	value === null || typeof value === 'string';
const isSymbolArray = (value: unknown): value is readonly string[] =>
	Array.isArray(value) && value.every((s) => typeof s === 'string');
const isNumber = (value: unknown): value is number => typeof value === 'number';

/** Is it a PDA command that has the right fields? The check is at run time, because input is not trusted. */
function wellFormed(command: unknown): command is PdaCommand {
	if (typeof command !== 'object' || command === null) return false;
	const c = command as Record<string, unknown>;
	switch (c.type) {
		case 'addState':
			return isNumber(c.x) && isNumber(c.y) && (c.name === undefined || typeof c.name === 'string');
		case 'removeState':
			return isId(c.id);
		case 'moveState':
			return isId(c.id) && isNumber(c.x) && isNumber(c.y);
		case 'renameState':
			return isId(c.id) && typeof c.name === 'string';
		case 'setStart':
			return c.id === null || isId(c.id);
		case 'setAccepting':
			return isId(c.id) && typeof c.accepting === 'boolean';
		case 'addTransition':
		case 'removeTransition':
			return (
				isId(c.from) &&
				isId(c.to) &&
				isSymbolOrEpsilon(c.read) &&
				isSymbolArray(c.pop) &&
				isSymbolArray(c.push)
			);
		case 'addInputSymbol':
		case 'removeInputSymbol':
		case 'addStackSymbol':
		case 'removeStackSymbol':
			return typeof c.symbol === 'string';
		case 'setKind':
			return c.kind === 'dpda' || c.kind === 'ndpda';
		case 'setTitle':
			return typeof c.title === 'string';
		case 'batch':
			return Array.isArray(c.commands);
		default:
			return false;
	}
}

const withDocument = (doc: PdaDocument, change: Partial<PdaDocument>): PdaDocument =>
	freezePdaDocument({ ...doc, ...change });

const findState = (doc: PdaDocument, id: number): StateEntry | undefined =>
	doc.states.find((s) => s.id === id);

function sameList(a: readonly string[], b: readonly string[]): boolean {
	return a.length === b.length && a.every((s, i) => s === b[i]);
}

function sameTransition(
	a: PdaTransitionEntry,
	from: number,
	read: string | null,
	pop: readonly string[],
	push: readonly string[],
	to: number
): boolean {
	return (
		a.from === from &&
		a.read === read &&
		a.to === to &&
		sameList(a.pop, pop) &&
		sameList(a.push, push)
	);
}

/** The smallest name q<k> that no state has. */
function freeName(doc: PdaDocument): string {
	const used = new Set(doc.states.map((s) => s.name));
	let k = 0;
	while (used.has(`q${k}`)) k++;
	return `q${k}`;
}

function apply(doc: PdaDocument, command: PdaCommand, depth: number): PdaApplyResult {
	switch (command.type) {
		case 'addState': {
			if (!isCoordinate(command.x) || !isCoordinate(command.y)) {
				return fail('document.invalid_position', { x: command.x, y: command.y });
			}
			if (doc.states.length >= LIMITS.states) {
				return fail('document.limit_exceeded', { what: 'states', limit: LIMITS.states });
			}
			if (doc.nextStateId > LIMITS.stateId) {
				return fail('document.limit_exceeded', { what: 'state_id', limit: LIMITS.stateId });
			}
			let name: string;
			if (command.name === undefined) {
				name = freeName(doc);
			} else {
				const bad = failed(checkName(command.name));
				if (bad) return bad;
				if (doc.states.some((s) => s.name === command.name)) {
					return fail('document.duplicate_name', { name: command.name });
				}
				name = command.name;
			}
			const entry = stateEntry(doc.nextStateId, name, command.x, command.y);
			return done(
				withDocument(doc, { states: [...doc.states, entry], nextStateId: doc.nextStateId + 1 })
			);
		}

		case 'removeState': {
			if (!findState(doc, command.id)) return fail('document.unknown_state', { state: command.id });
			const transitions = doc.transitions.filter(
				(t) => t.from !== command.id && t.to !== command.id
			);
			return done(
				withDocument(doc, {
					states: doc.states.filter((s) => s.id !== command.id),
					start: doc.start === command.id ? null : doc.start,
					accepting: doc.accepting.filter((id) => id !== command.id),
					transitions: transitions.length === doc.transitions.length ? doc.transitions : transitions
				})
			);
		}

		case 'moveState': {
			const state = findState(doc, command.id);
			if (!state) return fail('document.unknown_state', { state: command.id });
			if (!isCoordinate(command.x) || !isCoordinate(command.y)) {
				return fail('document.invalid_position', { x: command.x, y: command.y });
			}
			if (state.x === command.x && state.y === command.y) return done(doc);
			const moved = stateEntry(state.id, state.name, command.x, command.y);
			return done(withDocument(doc, { states: doc.states.map((s) => (s === state ? moved : s)) }));
		}

		case 'renameState': {
			const state = findState(doc, command.id);
			if (!state) return fail('document.unknown_state', { state: command.id });
			if (state.name === command.name) return done(doc);
			const bad = failed(checkName(command.name));
			if (bad) return bad;
			if (doc.states.some((s) => s.name === command.name)) {
				return fail('document.duplicate_name', { name: command.name });
			}
			const renamed = stateEntry(state.id, command.name, state.x, state.y);
			return done(
				withDocument(doc, { states: doc.states.map((s) => (s === state ? renamed : s)) })
			);
		}

		case 'setStart': {
			if (command.id !== null && !findState(doc, command.id)) {
				return fail('document.unknown_state', { state: command.id });
			}
			return doc.start === command.id ? done(doc) : done(withDocument(doc, { start: command.id }));
		}

		case 'setAccepting': {
			if (!findState(doc, command.id)) return fail('document.unknown_state', { state: command.id });
			const has = doc.accepting.includes(command.id);
			if (has === command.accepting) return done(doc);
			const accepting = command.accepting
				? [...doc.accepting, command.id].sort((a, b) => a - b)
				: doc.accepting.filter((id) => id !== command.id);
			return done(withDocument(doc, { accepting }));
		}

		case 'addTransition': {
			for (const id of [command.from, command.to]) {
				if (!findState(doc, id)) return fail('document.unknown_state', { state: id });
			}
			if (command.pop.length > MAX_PDA_STRING || command.push.length > MAX_PDA_STRING) {
				return fail('pda_document.string_too_long', { limit: MAX_PDA_STRING });
			}
			if (command.read !== null) {
				const bad = failed(checkSymbol(command.read));
				if (bad) return bad;
				if (!doc.inputAlphabet.includes(command.read)) {
					return fail('pda_document.unknown_symbol', { symbol: command.read });
				}
			}
			for (const sym of command.pop) {
				const bad = failed(checkSymbol(sym));
				if (bad) return bad;
				if (!doc.stackAlphabet.includes(sym)) {
					return fail('pda_document.unknown_symbol', { symbol: sym });
				}
			}
			for (const sym of command.push) {
				const bad = failed(checkSymbol(sym));
				if (bad) return bad;
				if (!doc.stackAlphabet.includes(sym)) {
					return fail('pda_document.unknown_symbol', { symbol: sym });
				}
			}
			if (
				doc.transitions.some((t) =>
					sameTransition(t, command.from, command.read, command.pop, command.push, command.to)
				)
			) {
				return fail('pda_document.duplicate_transition');
			}
			if (doc.transitions.length >= LIMITS.transitions) {
				return fail('document.limit_exceeded', {
					what: 'transitions',
					limit: LIMITS.transitions
				});
			}
			const entry = pdaTransitionEntry(
				command.from,
				command.read,
				command.pop,
				command.push,
				command.to
			);
			let low = 0;
			let high = doc.transitions.length;
			while (low < high) {
				const middle = (low + high) >> 1;
				const at = doc.transitions[middle];
				if (at && comparePdaTransitions(doc.inputAlphabet, doc.stackAlphabet, at, entry) < 0) {
					low = middle + 1;
				} else {
					high = middle;
				}
			}
			const transitions = [...doc.transitions.slice(0, low), entry, ...doc.transitions.slice(low)];
			return done(withDocument(doc, { transitions }));
		}

		case 'removeTransition': {
			const index = doc.transitions.findIndex((t) =>
				sameTransition(t, command.from, command.read, command.pop, command.push, command.to)
			);
			if (index < 0) {
				return fail('document.unknown_transition', {
					from: command.from,
					symbol: command.read ?? 'ε',
					to: command.to
				});
			}
			return done(
				withDocument(doc, { transitions: doc.transitions.filter((_, i) => i !== index) })
			);
		}

		case 'addInputSymbol': {
			const bad = failed(checkSymbol(command.symbol));
			if (bad) return bad;
			if (doc.inputAlphabet.includes(command.symbol)) {
				return fail('document.duplicate_symbol', { symbol: command.symbol });
			}
			if (doc.inputAlphabet.length >= LIMITS.symbols) {
				return fail('document.limit_exceeded', { what: 'symbols', limit: LIMITS.symbols });
			}
			return done(withDocument(doc, { inputAlphabet: [...doc.inputAlphabet, command.symbol] }));
		}

		case 'removeInputSymbol': {
			if (!doc.inputAlphabet.includes(command.symbol)) {
				return fail('pda_document.unknown_symbol', { symbol: command.symbol });
			}
			const transitions = doc.transitions.filter((t) => t.read !== command.symbol);
			return done(
				withDocument(doc, {
					inputAlphabet: doc.inputAlphabet.filter((s) => s !== command.symbol),
					transitions: transitions.length === doc.transitions.length ? doc.transitions : transitions
				})
			);
		}

		case 'addStackSymbol': {
			const bad = failed(checkSymbol(command.symbol));
			if (bad) return bad;
			if (doc.stackAlphabet.includes(command.symbol)) {
				return fail('document.duplicate_symbol', { symbol: command.symbol });
			}
			if (doc.stackAlphabet.length >= LIMITS.symbols) {
				return fail('document.limit_exceeded', { what: 'symbols', limit: LIMITS.symbols });
			}
			return done(withDocument(doc, { stackAlphabet: [...doc.stackAlphabet, command.symbol] }));
		}

		case 'removeStackSymbol': {
			if (!doc.stackAlphabet.includes(command.symbol)) {
				return fail('pda_document.unknown_symbol', { symbol: command.symbol });
			}
			const transitions = doc.transitions.filter(
				(t) => !t.pop.includes(command.symbol) && !t.push.includes(command.symbol)
			);
			return done(
				withDocument(doc, {
					stackAlphabet: doc.stackAlphabet.filter((s) => s !== command.symbol),
					transitions: transitions.length === doc.transitions.length ? doc.transitions : transitions
				})
			);
		}

		case 'setKind':
			return doc.kind === command.kind
				? done(doc)
				: done(withDocument(doc, { kind: command.kind }));

		case 'setTitle': {
			const bad = failed(checkTitle(command.title));
			if (bad) return bad;
			return doc.title === command.title
				? done(doc)
				: done(withDocument(doc, { title: command.title }));
		}

		case 'batch': {
			if (depth >= LIMITS.batchDepth || command.commands.length > LIMITS.batchCommands) {
				return fail('document.limit_exceeded', { what: 'batch', limit: LIMITS.batchDepth });
			}
			let working = doc;
			for (const inner of command.commands) {
				if (!wellFormed(inner)) {
					return fail('document.invalid_command', { type: typeName(inner) });
				}
				const result = apply(working, inner, depth + 1);
				if (!result.ok) return result;
				working = result.doc;
			}
			return done(working);
		}
	}
}

function typeName(command: unknown): string {
	const type = (command as { type?: unknown } | null)?.type;
	return typeof type === 'string' ? type.slice(0, 40) : 'unknown';
}

/**
 * Applies one command to a PDA document. A batch is applied as a whole: if one of its commands is
 * refused, the whole batch is refused and the document stays as it was.
 */
export function applyPdaCommand(doc: PdaDocument, command: PdaCommand): PdaApplyResult {
	if (!wellFormed(command)) return fail('document.invalid_command', { type: typeName(command) });
	return apply(doc, command, 0);
}
