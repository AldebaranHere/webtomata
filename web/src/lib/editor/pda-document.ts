// The PDA document that the editor works on. It parallels `document.ts` (for the FSM) without
// changing `MachineDocument`: it adds `inputAlphabet`, `stackAlphabet`, `kind: 'dpda' | 'ndpda'`,
// and transitions with `{ from, read, pop, push, to }` where `pop` and `push` list stack symbol
// names with the top of the stack at index 0.
import {
	LIMITS,
	checkName,
	checkSymbol,
	checkTitle,
	isCoordinate,
	message,
	stateEntry
} from './document.ts';
import type { Result, StateEntry } from './document.ts';
import type { JffState, Message, Pda, PdaKind } from '../engine/types.ts';

export type { PdaKind };

export const MAX_PDA_STRING = 64;

export interface PdaTransitionEntry {
	readonly from: number;
	readonly read: string | null;
	readonly pop: readonly string[];
	readonly push: readonly string[];
	readonly to: number;
}

export interface PdaDocument {
	readonly schemaVersion: 1;
	readonly title: string;
	readonly kind: PdaKind;
	readonly inputAlphabet: readonly string[];
	readonly stackAlphabet: readonly string[];
	readonly states: readonly StateEntry[];
	readonly start: number | null;
	readonly accepting: readonly number[];
	readonly transitions: readonly PdaTransitionEntry[];
	readonly nextStateId: number;
}

const refuse = <T = never>(key: string, params: Message['params'] = {}): Result<T> => ({
	ok: false,
	error: message(key, params)
});

export const pdaTransitionEntry = (
	from: number,
	read: string | null,
	pop: readonly string[],
	push: readonly string[],
	to: number
): PdaTransitionEntry =>
	Object.freeze({
		from,
		read,
		pop: Object.freeze([...pop]),
		push: Object.freeze([...push]),
		to
	});

/** Freezes a PDA document and its lists, so a caller cannot change it in place by accident. */
export function freezePdaDocument(doc: PdaDocument): PdaDocument {
	Object.freeze(doc.inputAlphabet);
	Object.freeze(doc.stackAlphabet);
	Object.freeze(doc.states);
	Object.freeze(doc.accepting);
	Object.freeze(doc.transitions);
	return Object.freeze(doc);
}

/** An empty, valid PDA document (`ndpda` by default). */
export function createPdaDocument(kind: PdaKind = 'ndpda'): PdaDocument {
	return freezePdaDocument({
		schemaVersion: 1,
		title: '',
		kind,
		inputAlphabet: [],
		stackAlphabet: [],
		states: [],
		start: null,
		accepting: [],
		transitions: [],
		nextStateId: 0
	});
}

function compareSymbolSlices(
	stackAlphabet: readonly string[],
	a: readonly string[],
	b: readonly string[]
): number {
	const len = Math.min(a.length, b.length);
	for (let i = 0; i < len; i++) {
		const ai = stackAlphabet.indexOf(a[i]!);
		const bi = stackAlphabet.indexOf(b[i]!);
		if (ai !== bi) return ai - bi;
	}
	return a.length - b.length;
}

/**
 * The order of PDA transitions, matching the Rust engine (`PdaTransition` Ord):
 * by `from`, then `read` (`null` first, then by index in `inputAlphabet`), then `pop` and `push`
 * compared element-by-element by index in `stackAlphabet` (shorter prefix first), then `to`.
 */
export function comparePdaTransitions(
	inputAlphabet: readonly string[],
	stackAlphabet: readonly string[],
	a: PdaTransitionEntry,
	b: PdaTransitionEntry
): number {
	if (a.from !== b.from) return a.from - b.from;
	const readIndex = (t: PdaTransitionEntry) =>
		t.read === null ? -1 : inputAlphabet.indexOf(t.read);
	const byRead = readIndex(a) - readIndex(b);
	if (byRead !== 0) return byRead;
	const byPop = compareSymbolSlices(stackAlphabet, a.pop, b.pop);
	if (byPop !== 0) return byPop;
	const byPush = compareSymbolSlices(stackAlphabet, a.push, b.push);
	if (byPush !== 0) return byPush;
	return a.to - b.to;
}

// ---- the engine's PDA ----

/** Converts a `PdaDocument` to the engine's `Pda` wire format (`engine/types.ts`). */
export function toEnginePda(doc: PdaDocument): Pda {
	return {
		schemaVersion: 1,
		kind: doc.kind,
		inputAlphabet: [...doc.inputAlphabet],
		stackAlphabet: [...doc.stackAlphabet],
		states: doc.states.map((s) => s.id),
		start: doc.start,
		accepting: [...doc.accepting],
		transitions: doc.transitions.map((t) => ({
			from: t.from,
			read: t.read,
			pop: [...t.pop],
			push: [...t.push],
			to: t.to
		}))
	};
}

/** Rows of six, 130 px apart: the places for a state that has none. */
const gridPlace = (index: number) => ({
	x: 100 + 130 * (index % 6),
	y: 100 + 130 * Math.floor(index / 6)
});

const clamp = (n: number) => Math.max(-LIMITS.coordinate, Math.min(LIMITS.coordinate, n));

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

function repairNames(entries: { id: number; name: string }[]): string[] {
	const repaired = entries.map(({ id, name }) => {
		let text = String(name ?? '')
			.replace(/\p{Cc}/gu, '')
			.replace(LONE_SURROGATE, '')
			.trim();
		text = Array.from(text).slice(0, LIMITS.nameChars).join('').trim();
		return text === '' ? `q${id}` : text;
	});
	const taken = new Set<string>();
	const firsts = new Set<number>();
	repaired.forEach((name, i) => {
		if (!taken.has(name)) {
			taken.add(name);
			firsts.add(i);
		}
	});
	return repaired.map((name, i) => {
		if (firsts.has(i)) return name;
		for (let n = 2; ; n++) {
			const suffix = `_${n}`;
			const base = Array.from(name)
				.slice(0, LIMITS.nameChars - suffix.length)
				.join('');
			const candidate = base + suffix;
			if (!taken.has(candidate)) {
				taken.add(candidate);
				return candidate;
			}
		}
	});
}

/** Builds a `PdaDocument` from the engine's `Pda` and optional state layout (names and places). */
export function fromEnginePda(pda: Pda, layout: readonly JffState[] = []): PdaDocument {
	const places = new Map(layout.map((s) => [s.id, s]));
	const ids = [...pda.states].sort((a, b) => a - b);
	const names = repairNames(ids.map((id) => ({ id, name: places.get(id)?.name ?? `q${id}` })));
	const states = ids.map((id, index) => {
		const given = places.get(id);
		const place =
			given !== undefined &&
			Number.isFinite(given.x) &&
			Number.isFinite(given.y) &&
			isCoordinate(clamp(given.x)) &&
			isCoordinate(clamp(given.y))
				? { x: clamp(given.x), y: clamp(given.y) }
				: gridPlace(index);
		return stateEntry(id, names[index] ?? `q${id}`, place.x, place.y);
	});
	const inputAlphabet = [...pda.inputAlphabet];
	const stackAlphabet = [...pda.stackAlphabet];
	const transitions = pda.transitions
		.map((t) => pdaTransitionEntry(t.from, t.read, t.pop, t.push, t.to))
		.sort((a, b) => comparePdaTransitions(inputAlphabet, stackAlphabet, a, b));

	return freezePdaDocument({
		schemaVersion: 1,
		title: '',
		kind: pda.kind,
		inputAlphabet,
		stackAlphabet,
		states,
		start: pda.start,
		accepting: [...pda.accepting].sort((a, b) => a - b),
		transitions,
		nextStateId: (ids[ids.length - 1] ?? -1) + 1
	});
}

/** Is it the same PDA document, in content? Parts that are the same object are not compared again. */
export function pdaDocumentsEqual(a: PdaDocument, b: PdaDocument): boolean {
	if (a === b) return true;
	const same = <T>(x: readonly T[], y: readonly T[], equal: (p: T, q: T) => boolean) =>
		x === y ||
		(x.length === y.length && x.every((item, i) => item === y[i] || equal(item, y[i] as T)));
	return (
		a.schemaVersion === b.schemaVersion &&
		a.title === b.title &&
		a.kind === b.kind &&
		a.start === b.start &&
		a.nextStateId === b.nextStateId &&
		same(a.inputAlphabet, b.inputAlphabet, (p, q) => p === q) &&
		same(a.stackAlphabet, b.stackAlphabet, (p, q) => p === q) &&
		same(a.accepting, b.accepting, (p, q) => p === q) &&
		same(
			a.states,
			b.states,
			(p, q) => p.id === q.id && p.name === q.name && p.x === q.x && p.y === q.y
		) &&
		same(
			a.transitions,
			b.transitions,
			(p, q) =>
				p.from === q.from &&
				p.read === q.read &&
				p.to === q.to &&
				same(p.pop, q.pop, (x, y) => x === y) &&
				same(p.push, q.push, (x, y) => x === y)
		)
	);
}

// ---- saving and reading ----

export function serializePdaDocument(doc: PdaDocument): string {
	return JSON.stringify(doc);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, keys: string[]) => {
	const own = Object.keys(value);
	return own.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
};

const PDA_DOCUMENT_KEYS = [
	'schemaVersion',
	'title',
	'kind',
	'inputAlphabet',
	'stackAlphabet',
	'states',
	'start',
	'accepting',
	'transitions',
	'nextStateId'
];

/**
 * Reads a PDA document from a value that came out of JSON. The input is not trusted, so every
 * field and every limit is checked. It never throws.
 */
export function parsePdaDocument(value: unknown): Result<PdaDocument> {
	const invalid = (at: string): Result<PdaDocument> => refuse('document.invalid_file', { at });
	if (!isRecord(value)) return invalid('document');
	if (
		Object.hasOwn(value, 'schemaVersion') &&
		value.schemaVersion !== 1 &&
		typeof value.schemaVersion === 'number'
	) {
		return refuse('pda_document.unsupported_version', { version: value.schemaVersion });
	}
	if (!hasExactKeys(value, PDA_DOCUMENT_KEYS)) return invalid('document');

	const {
		title,
		kind,
		inputAlphabet,
		stackAlphabet,
		states,
		start,
		accepting,
		transitions,
		nextStateId
	} = value;
	if (value.schemaVersion !== 1) return invalid('schemaVersion');
	if (typeof title !== 'string' || !checkTitle(title).ok) return invalid('title');
	if (kind !== 'dpda' && kind !== 'ndpda') return invalid('kind');
	if (!Array.isArray(inputAlphabet)) return invalid('inputAlphabet');
	if (!Array.isArray(stackAlphabet)) return invalid('stackAlphabet');
	if (!Array.isArray(states)) return invalid('states');
	if (!Array.isArray(accepting)) return invalid('accepting');
	if (!Array.isArray(transitions)) return invalid('transitions');
	if (start !== null && !Number.isSafeInteger(start)) return invalid('start');
	if (!Number.isSafeInteger(nextStateId)) return invalid('nextStateId');

	const tooMany = (what: string, limit: number) =>
		refuse('document.limit_exceeded', { what, limit });
	if (states.length > LIMITS.states) return tooMany('states', LIMITS.states);
	if (transitions.length > LIMITS.transitions) return tooMany('transitions', LIMITS.transitions);
	if (inputAlphabet.length > LIMITS.symbols) return tooMany('symbols', LIMITS.symbols);
	if (stackAlphabet.length > LIMITS.symbols) return tooMany('symbols', LIMITS.symbols);

	const inputSymbols: string[] = [];
	const inputSet = new Set<string>();
	for (const s of inputAlphabet) {
		if (typeof s !== 'string' || !checkSymbol(s).ok || inputSet.has(s)) {
			return invalid('inputAlphabet');
		}
		inputSet.add(s);
		inputSymbols.push(s);
	}

	const stackSymbols: string[] = [];
	const stackSet = new Set<string>();
	for (const s of stackAlphabet) {
		if (typeof s !== 'string' || !checkSymbol(s).ok || stackSet.has(s)) {
			return invalid('stackAlphabet');
		}
		stackSet.add(s);
		stackSymbols.push(s);
	}

	const stateEntries: StateEntry[] = [];
	const names = new Set<string>();
	const ids = new Set<number>();
	let previous = -1;
	for (const [i, s] of states.entries()) {
		if (!isRecord(s) || !hasExactKeys(s, ['id', 'name', 'x', 'y'])) return invalid(`states[${i}]`);
		if (
			!Number.isSafeInteger(s.id) ||
			typeof s.name !== 'string' ||
			typeof s.x !== 'number' ||
			typeof s.y !== 'number'
		) {
			return invalid(`states[${i}]`);
		}
		const id = s.id as number;
		if (id < 0 || id > LIMITS.stateId || id <= previous) return invalid(`states[${i}]`);
		if (!checkName(s.name).ok || names.has(s.name)) return invalid(`states[${i}]`);
		if (!isCoordinate(s.x) || !isCoordinate(s.y)) return invalid(`states[${i}]`);
		previous = id;
		names.add(s.name);
		ids.add(id);
		stateEntries.push(stateEntry(id, s.name, s.x, s.y));
	}

	if (start !== null && !ids.has(start as number)) return invalid('start');

	const acceptingIds: number[] = [];
	let lastAccepting = -1;
	for (const id of accepting) {
		if (!Number.isSafeInteger(id) || !ids.has(id as number) || (id as number) <= lastAccepting) {
			return invalid('accepting');
		}
		lastAccepting = id as number;
		acceptingIds.push(id as number);
	}

	const nextId = nextStateId as number;
	if (nextId <= previous || nextId > LIMITS.stateId) return invalid('nextStateId');

	const transitionEntries: PdaTransitionEntry[] = [];
	let before: PdaTransitionEntry | undefined;
	for (const [i, t] of transitions.entries()) {
		if (!isRecord(t) || !hasExactKeys(t, ['from', 'read', 'pop', 'push', 'to'])) {
			return invalid(`transitions[${i}]`);
		}
		if (
			!Number.isSafeInteger(t.from) ||
			!Number.isSafeInteger(t.to) ||
			(t.read !== null && typeof t.read !== 'string') ||
			!Array.isArray(t.pop) ||
			!Array.isArray(t.push)
		) {
			return invalid(`transitions[${i}]`);
		}
		const from = t.from as number;
		const to = t.to as number;
		if (!ids.has(from) || !ids.has(to)) return invalid(`transitions[${i}]`);

		if (!t.pop.every((s): s is string => typeof s === 'string'))
			return invalid(`transitions[${i}]`);
		if (!t.push.every((s): s is string => typeof s === 'string'))
			return invalid(`transitions[${i}]`);

		if (t.pop.length > MAX_PDA_STRING || t.push.length > MAX_PDA_STRING) {
			return refuse('pda_document.string_too_long', { limit: MAX_PDA_STRING });
		}

		const read = t.read as string | null;
		if (read !== null) {
			const check = checkSymbol(read);
			if (!check.ok) return { ok: false, error: check.error };
			if (!inputSet.has(read)) return refuse('pda_document.unknown_symbol', { symbol: read });
		}
		for (const sym of t.pop) {
			const check = checkSymbol(sym);
			if (!check.ok) return { ok: false, error: check.error };
			if (!stackSet.has(sym)) return refuse('pda_document.unknown_symbol', { symbol: sym });
		}
		for (const sym of t.push) {
			const check = checkSymbol(sym);
			if (!check.ok) return { ok: false, error: check.error };
			if (!stackSet.has(sym)) return refuse('pda_document.unknown_symbol', { symbol: sym });
		}

		const entry = pdaTransitionEntry(from, read, t.pop, t.push, to);
		if (before !== undefined) {
			const cmp = comparePdaTransitions(inputSymbols, stackSymbols, before, entry);
			if (cmp === 0) return refuse('pda_document.duplicate_transition');
			if (cmp > 0) return invalid(`transitions[${i}]`);
		}
		before = entry;
		transitionEntries.push(entry);
	}

	const doc = freezePdaDocument({
		schemaVersion: 1,
		title,
		kind,
		inputAlphabet: inputSymbols,
		stackAlphabet: stackSymbols,
		states: stateEntries,
		start: start as number | null,
		accepting: acceptingIds,
		transitions: transitionEntries,
		nextStateId: nextId
	});

	return { ok: true, value: doc };
}

/** Reads a PDA document from text: checks the size in bytes first, then the JSON. It never throws. */
export function parsePdaDocumentText(text: string): Result<PdaDocument> {
	if (typeof text !== 'string') return refuse('document.invalid_file', { at: 'text' });
	const tooBig = () =>
		refuse('document.limit_exceeded', { what: 'bytes', limit: LIMITS.documentBytes });
	if (text.length > LIMITS.documentBytes) return tooBig();
	if (new TextEncoder().encode(text).length > LIMITS.documentBytes) return tooBig();
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return refuse('document.invalid_file', { at: 'json' });
	}
	return parsePdaDocument(value);
}
