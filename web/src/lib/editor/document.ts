// The machine document: the one object that the diagram, the table and the formal definition all
// show. It is plain data (it can be saved as JSON and shared), and it is never changed in place:
// a command (commands.ts) makes a new document, and the old one stays whole for undo. Documents
// are frozen, so a view that tries to change one by mistake gets an error at once.
//
// The engine knows states by number only. The document adds what belongs to the user interface:
// the names and the places of the states, and a title. A transition is stored as the engine stores
// it (`from`, `on`, `to`, with `on: null` for ε); the diagram groups transitions with the same
// ends into one edge for display.
//
// The rules for symbols and sizes are the rules of the engine (crates/engine-core/src/fsm.rs), so
// that a document that passes here is accepted by the engine.
import type { Jff, JffState, Machine, Message } from '../engine/types.ts';

export type Kind = 'dfsm' | 'ndfsm';

export interface StateEntry {
	readonly id: number;
	readonly name: string;
	readonly x: number;
	readonly y: number;
}

export interface TransitionEntry {
	readonly from: number;
	/** The symbol, or null for ε. */
	readonly on: string | null;
	readonly to: number;
}

export interface MachineDocument {
	readonly schemaVersion: 1;
	readonly title: string;
	readonly kind: Kind;
	/** In the order that the user wrote it; the order gives the numbers of the symbols. */
	readonly alphabet: readonly string[];
	/** Sorted by id. */
	readonly states: readonly StateEntry[];
	readonly start: number | null;
	/** Sorted. */
	readonly accepting: readonly number[];
	/** Sorted as the engine sorts them: by `from`, then by the number of the symbol (ε first). */
	readonly transitions: readonly TransitionEntry[];
	/** The id of the next state. Ids are never used twice, so a trace can always name a state. */
	readonly nextStateId: number;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: Message };
export type Check = { ok: true } | { ok: false; error: Message };

export const LIMITS = {
	// The limits of the engine.
	states: 2000,
	transitions: 100_000,
	symbols: 256,
	symbolChars: 32,
	// The limits of the document.
	nameChars: 32,
	titleChars: 100,
	coordinate: 1_000_000,
	documentBytes: 1024 * 1024,
	batchCommands: 10_000,
	batchDepth: 8,
	/** The biggest id of the engine (a u32). */
	stateId: 4_294_967_295
} as const;

export const message = (key: string, params: Message['params'] = {}): Message => ({ key, params });
const refuse = (key: string, params: Message['params'] = {}): { ok: false; error: Message } => ({
	ok: false,
	error: message(key, params)
});

// ---- the rules for symbols, names and titles ----

// Unicode White_Space and the control characters are the characters that the engine refuses in a
// symbol (`char::is_whitespace` and `char::is_control` in Rust). `\s` is not the same set.
const WHITE_OR_CONTROL = /[\p{White_Space}\p{Cc}]/u;
const CONTROL = /\p{Cc}/u;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/** The number of characters (code points). A text that is much too long is not counted. */
function characters(text: string, limit: number): number {
	if (text.length > limit * 2) return limit + 1;
	return [...text].length;
}

/** Checks a symbol with the rules of the engine. */
export function checkSymbol(symbol: string): Check {
	const bad = (reason: string) =>
		refuse('document.invalid_symbol', { symbol: symbol.slice(0, 40), reason });
	if (typeof symbol !== 'string' || symbol === '') return bad('empty');
	if (symbol === 'ε') return bad('epsilon');
	if (characters(symbol, LIMITS.symbolChars) > LIMITS.symbolChars) return bad('too_long');
	if (LONE_SURROGATE.test(symbol) || WHITE_OR_CONTROL.test(symbol)) return bad('characters');
	return { ok: true };
}

/** Checks the name of a state: not empty, no space at the ends, 32 characters at most. */
export function checkName(name: string): Check {
	const bad = (reason: string) =>
		refuse('document.invalid_name', { name: String(name).slice(0, 40), reason });
	if (typeof name !== 'string' || name === '') return bad('empty');
	if (name !== name.trim()) return bad('trim');
	if (characters(name, LIMITS.nameChars) > LIMITS.nameChars) return bad('too_long');
	if (LONE_SURROGATE.test(name) || CONTROL.test(name)) return bad('characters');
	return { ok: true };
}

export function checkTitle(title: string): Check {
	const bad = (reason: string) => refuse('document.invalid_title', { reason });
	if (typeof title !== 'string') return bad('type');
	if (characters(title, LIMITS.titleChars) > LIMITS.titleChars) return bad('too_long');
	if (LONE_SURROGATE.test(title) || CONTROL.test(title)) return bad('characters');
	return { ok: true };
}

export const isCoordinate = (n: unknown): n is number =>
	typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= LIMITS.coordinate;

// ---- building documents ----

/** Freezes a document and its lists. The entries are frozen when they are made. */
export function freezeDocument(doc: MachineDocument): MachineDocument {
	Object.freeze(doc.alphabet);
	Object.freeze(doc.states);
	Object.freeze(doc.accepting);
	Object.freeze(doc.transitions);
	return Object.freeze(doc);
}

export const stateEntry = (id: number, name: string, x: number, y: number): StateEntry =>
	Object.freeze({ id, name, x, y });

export const transitionEntry = (from: number, on: string | null, to: number): TransitionEntry =>
	Object.freeze({ from, on, to });

export function createDocument(): MachineDocument {
	return freezeDocument({
		schemaVersion: 1,
		title: '',
		kind: 'dfsm',
		alphabet: [],
		states: [],
		start: null,
		accepting: [],
		transitions: [],
		nextStateId: 0
	});
}

/** The order of the transitions, as the engine sorts them: by `from`, by the symbol number, by `to`. */
export function compareTransitions(
	alphabet: readonly string[],
	a: TransitionEntry,
	b: TransitionEntry
): number {
	if (a.from !== b.from) return a.from - b.from;
	const symbol = (t: TransitionEntry) => (t.on === null ? -1 : alphabet.indexOf(t.on));
	const bySymbol = symbol(a) - symbol(b);
	return bySymbol !== 0 ? bySymbol : a.to - b.to;
}

// ---- the engine's machine ----

/** The machine file of the engine (see `Machine` in engine/types.ts). */
export function toMachine(doc: MachineDocument): Machine {
	return {
		schemaVersion: 1,
		kind: doc.kind,
		alphabet: [...doc.alphabet],
		states: doc.states.map((s) => s.id),
		start: doc.start,
		accepting: [...doc.accepting],
		transitions: doc.transitions.map((t) => ({ from: t.from, on: t.on, to: t.to }))
	};
}

/** Rows of six, 130 px apart: the places for a state that has none. */
const gridPlace = (index: number) => ({
	x: 100 + 130 * (index % 6),
	y: 100 + 130 * Math.floor(index / 6)
});

/** The layout (names and places) of a document, for a JFLAP export. */
export function jffLayout(doc: MachineDocument): JffState[] {
	return doc.states.map(({ id, name, x, y }) => ({ id, name, x, y }));
}

const clamp = (n: number) => Math.max(-LIMITS.coordinate, Math.min(LIMITS.coordinate, n));

/**
 * Repairs the names of the states so that they follow the rules: control characters are removed,
 * the ends are trimmed, the name is cut at 32 characters, a blank name becomes q<id>, and a name
 * that an earlier state already has gets a suffix (q1_2). The first state keeps its name.
 */
function repairNames(entries: { id: number; name: string }[]): {
	names: string[];
	notes: Message[];
} {
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
	const names = repaired.map((name, i) => {
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
	const notes: Message[] = [];
	entries.forEach(({ id, name }, i) => {
		if (names[i] !== name)
			notes.push(message('document.name_changed', { id, from: String(name), to: names[i] ?? '' }));
	});
	return { names, notes };
}

function build(
	machine: Machine,
	layout: readonly JffState[] = []
): { doc: MachineDocument; notes: Message[] } {
	const places = new Map(layout.map((s) => [s.id, s]));
	const ids = [...machine.states].sort((a, b) => a - b);
	const { names, notes } = repairNames(
		ids.map((id) => ({ id, name: places.get(id)?.name ?? `q${id}` }))
	);
	const states = ids.map((id, index) => {
		const given = places.get(id);
		const place =
			given !== undefined &&
			isCoordinate(clamp(given.x)) &&
			isCoordinate(clamp(given.y)) &&
			Number.isFinite(given.x) &&
			Number.isFinite(given.y)
				? { x: clamp(given.x), y: clamp(given.y) }
				: gridPlace(index);
		return stateEntry(id, names[index] ?? `q${id}`, place.x, place.y);
	});
	const alphabet = machine.alphabet;
	const transitions = machine.transitions
		.map((t) => transitionEntry(t.from, t.on, t.to))
		.sort((a, b) => compareTransitions(alphabet, a, b));
	const doc = freezeDocument({
		schemaVersion: 1,
		title: '',
		kind: machine.kind,
		alphabet: [...alphabet],
		states,
		start: machine.start,
		accepting: [...machine.accepting].sort((a, b) => a - b),
		transitions,
		nextStateId: (ids[ids.length - 1] ?? -1) + 1
	});
	return { doc, notes };
}

/** A document from the engine's machine. The layout gives the names and places, if there is one. */
export function documentFromMachine(
	machine: Machine,
	layout: readonly JffState[] = []
): MachineDocument {
	return build(machine, layout).doc;
}

/**
 * A document from an imported JFLAP file. The names and places of the file are kept. A name that
 * breaks the rules is repaired, and a note says so (`document.name_changed`); the notes of the
 * engine are passed on.
 */
export function documentFromJff(jff: Jff): { doc: MachineDocument; notes: Message[] } {
	const { doc, notes } = build(jff.fsm, jff.states);
	return { doc, notes: [...notes, ...jff.notes] };
}

// ---- the rules of a document ----

/** The rules that every document must follow. Returns what is broken; an empty list means all is well. */
export function checkDocument(doc: MachineDocument): Message[] {
	const broken: Message[] = [];
	const rule = (name: string, ok: boolean, params: Message['params'] = {}) => {
		if (!ok) broken.push(message('document.broken_rule', { rule: name, ...params }));
	};
	rule('version', doc.schemaVersion === 1);
	rule('kind', doc.kind === 'dfsm' || doc.kind === 'ndfsm');
	rule('title', checkTitle(doc.title).ok);

	rule('alphabet_limit', doc.alphabet.length <= LIMITS.symbols);
	doc.alphabet.forEach((symbol, i) => {
		rule('symbol', checkSymbol(symbol).ok, { symbol });
		rule('symbol_unique', doc.alphabet.indexOf(symbol) === i, { symbol });
	});

	rule('states_limit', doc.states.length <= LIMITS.states);
	const names = new Set<string>();
	const ids = new Set<number>();
	let previous = -1;
	for (const s of doc.states) {
		rule('state_id', Number.isSafeInteger(s.id) && s.id >= 0 && s.id <= LIMITS.stateId, {
			id: s.id
		});
		rule('states_sorted', s.id > previous, { id: s.id });
		previous = s.id;
		rule('state_name', checkName(s.name).ok, { id: s.id });
		rule('state_name_unique', !names.has(s.name), { id: s.id });
		rule('state_place', isCoordinate(s.x) && isCoordinate(s.y), { id: s.id });
		names.add(s.name);
		ids.add(s.id);
	}
	rule('start', doc.start === null || ids.has(doc.start));
	let last = -1;
	for (const id of doc.accepting) {
		rule('accepting', ids.has(id), { id });
		rule('accepting_sorted', id > last, { id });
		last = id;
	}

	rule('transitions_limit', doc.transitions.length <= LIMITS.transitions);
	const symbols = new Set(doc.alphabet);
	let before: TransitionEntry | undefined;
	for (const t of doc.transitions) {
		rule('transition_ends', ids.has(t.from) && ids.has(t.to), { from: t.from, to: t.to });
		rule('transition_symbol', t.on === null || symbols.has(t.on), { from: t.from, to: t.to });
		if (before !== undefined) {
			rule('transitions_sorted', compareTransitions(doc.alphabet, before, t) < 0, {
				from: t.from,
				to: t.to
			});
		}
		before = t;
	}
	rule(
		'next_state_id',
		Number.isSafeInteger(doc.nextStateId) &&
			doc.nextStateId > previous &&
			doc.nextStateId <= LIMITS.stateId
	);
	return broken;
}

/** Is it the same document, in content? Parts that are the same object are not compared again. */
export function documentsEqual(a: MachineDocument, b: MachineDocument): boolean {
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
		same(a.alphabet, b.alphabet, (p, q) => p === q) &&
		same(a.accepting, b.accepting, (p, q) => p === q) &&
		same(
			a.states,
			b.states,
			(p, q) => p.id === q.id && p.name === q.name && p.x === q.x && p.y === q.y
		) &&
		same(
			a.transitions,
			b.transitions,
			(p, q) => p.from === q.from && p.on === q.on && p.to === q.to
		)
	);
}

// ---- saving and reading ----

export function serializeDocument(doc: MachineDocument): string {
	return JSON.stringify(doc);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/** True if the object has exactly these keys. A key such as `__proto__` counts as a key. */
const hasExactKeys = (value: Record<string, unknown>, keys: string[]) => {
	const own = Object.keys(value);
	return own.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
};

const DOCUMENT_KEYS = [
	'schemaVersion',
	'title',
	'kind',
	'alphabet',
	'states',
	'start',
	'accepting',
	'transitions',
	'nextStateId'
];

/**
 * Reads a document from a value that came out of JSON. The input is not trusted, so every field
 * is checked, and the result follows every rule of `checkDocument`. It never throws.
 */
export function parseDocument(value: unknown): Result<MachineDocument> {
	const invalid = (at: string): Result<MachineDocument> => refuse('document.invalid_file', { at });
	if (!isRecord(value)) return invalid('document');
	if (
		Object.hasOwn(value, 'schemaVersion') &&
		value.schemaVersion !== 1 &&
		typeof value.schemaVersion === 'number'
	) {
		return refuse('document.unsupported_version', { found: value.schemaVersion });
	}
	if (!hasExactKeys(value, DOCUMENT_KEYS)) return invalid('document');

	const { title, kind, alphabet, states, start, accepting, transitions, nextStateId } = value;
	if (value.schemaVersion !== 1) return invalid('schemaVersion');
	if (typeof title !== 'string') return invalid('title');
	if (kind !== 'dfsm' && kind !== 'ndfsm') return invalid('kind');
	if (!Array.isArray(alphabet)) return invalid('alphabet');
	if (!Array.isArray(states)) return invalid('states');
	if (!Array.isArray(accepting)) return invalid('accepting');
	if (!Array.isArray(transitions)) return invalid('transitions');
	if (start !== null && !Number.isSafeInteger(start)) return invalid('start');
	if (!Number.isSafeInteger(nextStateId)) return invalid('nextStateId');

	const tooMany = (what: string, limit: number) =>
		refuse('document.limit_exceeded', { what, limit });
	if (states.length > LIMITS.states) return tooMany('states', LIMITS.states);
	if (transitions.length > LIMITS.transitions) return tooMany('transitions', LIMITS.transitions);
	if (alphabet.length > LIMITS.symbols) return tooMany('symbols', LIMITS.symbols);

	if (!alphabet.every((s) => typeof s === 'string')) return invalid('alphabet');
	if (!accepting.every((id) => Number.isSafeInteger(id))) return invalid('accepting');

	const stateEntries: StateEntry[] = [];
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
		stateEntries.push(stateEntry(s.id as number, s.name, s.x, s.y));
	}
	const transitionEntries: TransitionEntry[] = [];
	for (const [i, t] of transitions.entries()) {
		if (!isRecord(t) || !hasExactKeys(t, ['from', 'on', 'to'])) return invalid(`transitions[${i}]`);
		if (
			!Number.isSafeInteger(t.from) ||
			!Number.isSafeInteger(t.to) ||
			(t.on !== null && typeof t.on !== 'string')
		) {
			return invalid(`transitions[${i}]`);
		}
		transitionEntries.push(
			transitionEntry(t.from as number, t.on as string | null, t.to as number)
		);
	}

	const doc = freezeDocument({
		schemaVersion: 1,
		title,
		kind,
		alphabet: [...(alphabet as string[])],
		states: stateEntries,
		start: start as number | null,
		accepting: [...(accepting as number[])],
		transitions: transitionEntries,
		nextStateId: nextStateId as number
	});
	const broken = checkDocument(doc);
	if (broken.length > 0) return invalid(String(broken[0]?.params.rule ?? 'document'));
	return { ok: true, value: doc };
}

/** Reads a document from text: checks the size in bytes first, then the JSON. It never throws. */
export function parseDocumentText(text: string): Result<MachineDocument> {
	if (typeof text !== 'string') return refuse('document.invalid_file', { at: 'text' });
	const tooBig = () =>
		refuse('document.limit_exceeded', { what: 'bytes', limit: LIMITS.documentBytes });
	// A text is at least as many bytes as it has UTF-16 units, so the quick check cannot be wrong.
	if (text.length > LIMITS.documentBytes) return tooBig();
	if (new TextEncoder().encode(text).length > LIMITS.documentBytes) return tooBig();
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return refuse('document.invalid_file', { at: 'json' });
	}
	return parseDocument(value);
}
