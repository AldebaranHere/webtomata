// The commands that change a document. A command is plain data, so it can be logged, sent and
// replayed. `applyCommand` is a pure function: it makes a new document and leaves the old one
// whole (that is what undo uses, see history.ts). A command that is not valid is refused with a
// message, the document stays as it was, and nothing is thrown.
//
// A command that would change nothing gives back the same document object, so that the history
// does not make a step for it.
import {
	LIMITS,
	checkName,
	checkSymbol,
	checkTitle,
	compareTransitions,
	freezeDocument,
	isCoordinate,
	message,
	stateEntry,
	transitionEntry
} from './document.ts';
import type { Check, Kind, MachineDocument, StateEntry, TransitionEntry } from './document.ts';
import type { Message } from '../engine/types.ts';

export type Command =
	| { type: 'addState'; x: number; y: number; name?: string }
	| { type: 'removeState'; id: number }
	| { type: 'moveState'; id: number; x: number; y: number }
	| { type: 'renameState'; id: number; name: string }
	| { type: 'setStart'; id: number | null }
	| { type: 'setAccepting'; id: number; accepting: boolean }
	| { type: 'addTransition'; from: number; on: string | null; to: number }
	| { type: 'removeTransition'; from: number; on: string | null; to: number }
	| { type: 'addSymbol'; symbol: string }
	| { type: 'removeSymbol'; symbol: string }
	| { type: 'setKind'; kind: Kind }
	| { type: 'setTitle'; title: string }
	| { type: 'batch'; commands: Command[] };

export type ApplyResult = { ok: true; doc: MachineDocument } | { ok: false; error: Message };

const fail = (key: string, params: Message['params'] = {}): ApplyResult => ({
	ok: false,
	error: message(key, params)
});
const done = (doc: MachineDocument): ApplyResult => ({ ok: true, doc });
const failed = (check: Check): ApplyResult | undefined =>
	check.ok ? undefined : { ok: false, error: check.error };

const isId = (value: unknown): value is number =>
	typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isSymbolOrEpsilon = (value: unknown): value is string | null =>
	value === null || typeof value === 'string';
const isNumber = (value: unknown): value is number => typeof value === 'number';

/** Is it a command that has the right fields? The check is at run time, because input is not trusted. */
function wellFormed(command: unknown): command is Command {
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
			return isId(c.from) && isId(c.to) && isSymbolOrEpsilon(c.on);
		case 'addSymbol':
		case 'removeSymbol':
			return typeof c.symbol === 'string';
		case 'setKind':
			return c.kind === 'dfsm' || c.kind === 'ndfsm';
		case 'setTitle':
			return typeof c.title === 'string';
		case 'batch':
			return Array.isArray(c.commands);
		default:
			return false;
	}
}

const withDocument = (doc: MachineDocument, change: Partial<MachineDocument>): MachineDocument =>
	freezeDocument({ ...doc, ...change });

const findState = (doc: MachineDocument, id: number): StateEntry | undefined =>
	doc.states.find((s) => s.id === id);

function sameTransition(a: TransitionEntry, from: number, on: string | null, to: number): boolean {
	return a.from === from && a.on === on && a.to === to;
}

/** The smallest name q<k> that no state has. */
function freeName(doc: MachineDocument): string {
	const used = new Set(doc.states.map((s) => s.name));
	let k = 0;
	while (used.has(`q${k}`)) k++;
	return `q${k}`;
}

function apply(doc: MachineDocument, command: Command, depth: number): ApplyResult {
	switch (command.type) {
		case 'addState': {
			if (!isCoordinate(command.x) || !isCoordinate(command.y)) {
				return fail('document.invalid_position', { x: command.x, y: command.y });
			}
			if (doc.states.length >= LIMITS.states)
				return fail('document.limit_exceeded', { what: 'states', limit: LIMITS.states });
			if (doc.nextStateId > LIMITS.stateId)
				return fail('document.limit_exceeded', { what: 'state_id', limit: LIMITS.stateId });
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
			// The new id is the biggest, so the list stays sorted.
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
			if (command.on !== null && !doc.alphabet.includes(command.on)) {
				return fail('document.unknown_symbol', { symbol: command.on });
			}
			if (doc.transitions.some((t) => sameTransition(t, command.from, command.on, command.to))) {
				return fail('document.duplicate_transition', {
					from: command.from,
					symbol: command.on ?? 'ε',
					to: command.to
				});
			}
			if (doc.transitions.length >= LIMITS.transitions) {
				return fail('document.limit_exceeded', { what: 'transitions', limit: LIMITS.transitions });
			}
			const entry = transitionEntry(command.from, command.on, command.to);
			// Insert at the place that keeps the list sorted (binary search).
			let low = 0;
			let high = doc.transitions.length;
			while (low < high) {
				const middle = (low + high) >> 1;
				const at = doc.transitions[middle];
				if (at && compareTransitions(doc.alphabet, at, entry) < 0) low = middle + 1;
				else high = middle;
			}
			const transitions = [...doc.transitions.slice(0, low), entry, ...doc.transitions.slice(low)];
			return done(withDocument(doc, { transitions }));
		}

		case 'removeTransition': {
			const index = doc.transitions.findIndex((t) =>
				sameTransition(t, command.from, command.on, command.to)
			);
			if (index < 0) {
				return fail('document.unknown_transition', {
					from: command.from,
					symbol: command.on ?? 'ε',
					to: command.to
				});
			}
			return done(
				withDocument(doc, { transitions: doc.transitions.filter((_, i) => i !== index) })
			);
		}

		case 'addSymbol': {
			const bad = failed(checkSymbol(command.symbol));
			if (bad) return bad;
			if (doc.alphabet.includes(command.symbol))
				return fail('document.duplicate_symbol', { symbol: command.symbol });
			if (doc.alphabet.length >= LIMITS.symbols)
				return fail('document.limit_exceeded', { what: 'symbols', limit: LIMITS.symbols });
			return done(withDocument(doc, { alphabet: [...doc.alphabet, command.symbol] }));
		}

		case 'removeSymbol': {
			if (!doc.alphabet.includes(command.symbol))
				return fail('document.unknown_symbol', { symbol: command.symbol });
			const transitions = doc.transitions.filter((t) => t.on !== command.symbol);
			return done(
				withDocument(doc, {
					alphabet: doc.alphabet.filter((s) => s !== command.symbol),
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
				if (!wellFormed(inner)) return fail('document.invalid_command', { type: typeName(inner) });
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
 * Applies one command to a document. A batch is applied as a whole: if one of its commands is
 * refused, the whole batch is refused and the document stays as it was.
 */
export function applyCommand(doc: MachineDocument, command: Command): ApplyResult {
	if (!wellFormed(command)) return fail('document.invalid_command', { type: typeName(command) });
	return apply(doc, command, 0);
}
