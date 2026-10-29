// The example machines of "Coba contoh": plain data in content/examples/<id>.json, put into the
// bundle when the site is built. A student opens one in a click; anyone can add one with a pull
// request. An example is a pattern, never a solution to homework. `parseExample` checks a file with
// words that an author can use, and a test reads every file that we ship.
import { applyCommand } from '../editor/commands.ts';
import type { Command } from '../editor/commands.ts';
import { createDocument } from '../editor/document.ts';
import type { Kind, MachineDocument } from '../editor/document.ts';
import { TEST_LIMITS, readTests } from '../editor/test-list.ts';

type Locale = 'id' | 'en';

export interface Words {
	id: string;
	en: string;
}

export interface Example {
	schemaVersion: 1;
	/** The name of the file, without `.json`: lowercase letters, digits and single hyphens. */
	id: string;
	/** Where it is in the list (1 is the first). */
	order: number;
	title: Words;
	description: Words;
	kind: Kind;
	alphabet: string[];
	states: { name: string; x: number; y: number }[];
	start: string;
	accepting: string[];
	/** The states are named; `on` is null for ε. */
	transitions: { from: string; on: string | null; to: string }[];
	/** Strings that the machine accepts and rejects: they become its test strings when it is opened. */
	accept: string[];
	reject: string[];
}

export type ParseResult = { ok: true; value: Example } | { ok: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);
const hasOnly = (value: Record<string, unknown>, keys: string[]) =>
	Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const text = (value: unknown): value is string => typeof value === 'string' && value !== '';
const strings = (value: unknown): value is string[] =>
	Array.isArray(value) && value.every((item) => typeof item === 'string');

const KEYS = [
	'schemaVersion',
	'id',
	'order',
	'title',
	'description',
	'kind',
	'alphabet',
	'states',
	'start',
	'accepting',
	'transitions',
	'accept',
	'reject'
];

function words(value: unknown): value is Words {
	return isRecord(value) && hasOnly(value, ['id', 'en']) && text(value.id) && text(value.en);
}

/** The document of an example, with the given title; it fails with the key of the refused command. */
function buildDocument(
	example: Example,
	title: string
): { ok: true; doc: MachineDocument } | { ok: false; error: string } {
	const index = new Map(example.states.map((s, i) => [s.name, i]));
	const commands: Command[] = [{ type: 'setTitle', title }];
	if (example.kind === 'ndfsm') commands.push({ type: 'setKind', kind: 'ndfsm' });
	for (const symbol of example.alphabet) commands.push({ type: 'addSymbol', symbol });
	for (const { name, x, y } of example.states) commands.push({ type: 'addState', x, y, name });
	commands.push({ type: 'setStart', id: index.get(example.start) ?? -1 });
	for (const name of example.accepting) {
		commands.push({ type: 'setAccepting', id: index.get(name) ?? -1, accepting: true });
	}
	for (const t of example.transitions) {
		commands.push({
			type: 'addTransition',
			from: index.get(t.from) ?? -1,
			on: t.on,
			to: index.get(t.to) ?? -1
		});
	}
	const result = applyCommand(createDocument(), { type: 'batch', commands });
	return result.ok ? { ok: true, doc: result.doc } : { ok: false, error: result.error.key };
}

/** Reads the content of an example file. It never throws. */
export function parseExample(value: unknown): ParseResult {
	const bad = (path: string, what: string): ParseResult => ({
		ok: false,
		error: `${path}: ${what}`
	});
	if (!isRecord(value)) return bad('(file)', 'must be an object');
	if (!hasOnly(value, KEYS))
		return bad('(file)', `must have exactly these fields: ${KEYS.join(', ')}`);
	if (value.schemaVersion !== 1) return bad('schemaVersion', 'must be 1');
	if (typeof value.id !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value.id)) {
		return bad('id', 'must be lowercase letters, digits and single hyphens');
	}
	if (!Number.isInteger(value.order)) return bad('order', 'must be a whole number');
	if (!words(value.title)) return bad('title', 'needs text in id and en');
	if (!words(value.description)) return bad('description', 'needs text in id and en');
	if (value.kind !== 'dfsm' && value.kind !== 'ndfsm') return bad('kind', 'must be dfsm or ndfsm');
	if (!strings(value.alphabet) || value.alphabet.length === 0)
		return bad('alphabet', 'must be a list of symbols');
	if (!Array.isArray(value.states) || value.states.length === 0)
		return bad('states', 'must be a list with at least one state');
	const names = new Set<string>();
	for (const [i, s] of value.states.entries()) {
		if (
			!isRecord(s) ||
			!hasOnly(s, ['name', 'x', 'y']) ||
			!text(s.name) ||
			typeof s.x !== 'number' ||
			typeof s.y !== 'number'
		) {
			return bad(`states[${i}]`, 'must be { name, x, y }');
		}
		names.add(s.name);
	}
	if (names.size !== value.states.length) return bad('states', 'the names must differ');
	if (typeof value.start !== 'string' || !names.has(value.start))
		return bad('start', 'must name a state');
	if (!strings(value.accepting) || !value.accepting.every((n) => names.has(n))) {
		return bad('accepting', 'must be a list of names of states');
	}
	if (!Array.isArray(value.transitions)) return bad('transitions', 'must be a list');
	for (const [i, t] of value.transitions.entries()) {
		if (
			!isRecord(t) ||
			!hasOnly(t, ['from', 'on', 'to']) ||
			typeof t.from !== 'string' ||
			typeof t.to !== 'string' ||
			!names.has(t.from) ||
			!names.has(t.to) ||
			(t.on !== null && (typeof t.on !== 'string' || !value.alphabet.includes(t.on)))
		) {
			return bad(
				`transitions[${i}]`,
				'must be { from, on, to }: the states must exist, and on is a symbol of the alphabet or null'
			);
		}
	}
	if (!strings(value.accept) || value.accept.length === 0)
		return bad('accept', 'needs at least one string');
	if (!strings(value.reject) || value.reject.length === 0)
		return bad('reject', 'needs at least one string');

	const example = value as unknown as Example;
	const built = buildDocument(example, example.title.id);
	if (!built.ok) return bad('(machine)', `the machine is refused: ${built.error}`);
	return { ok: true, value: example };
}

/** The machine of an example in the language, its titles in both, and its test strings. */
export function buildExample(
	example: Example,
	locale: Locale
): { doc: MachineDocument; titles: Words; tests: string[] } {
	const built = buildDocument(example, example.title[locale]);
	if (!built.ok) throw new Error(`example ${example.id}: ${built.error}`);
	// The accepted and the rejected strings in turn, the accepted one first.
	const mixed: string[] = [];
	for (let i = 0; i < Math.max(example.accept.length, example.reject.length); i++) {
		if (i < example.accept.length) mixed.push(example.accept[i]!);
		if (i < example.reject.length) mixed.push(example.reject[i]!);
	}
	return {
		doc: built.doc,
		titles: example.title,
		tests: readTests(mixed).slice(0, TEST_LIMITS.count)
	};
}

const files = import.meta.glob('../../../../content/examples/*.json', {
	eager: true,
	import: 'default'
}) as Record<string, unknown>;

/** The example id in `?example=<id>`, or null when the query has no example parameter. */
export function exampleParam(search: string): string | null {
	const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
	return params.get('example');
}

/** The examples that ship with the site, in order. A bad file stops the build (a test reads them). */
export const EXAMPLES: readonly Example[] = Object.entries(files)
	.map(([path, content]) => {
		const result = parseExample(content);
		if (!result.ok) throw new Error(`content/examples/${path.split('/').pop()}: ${result.error}`);
		const name = path
			.split('/')
			.pop()!
			.replace(/\.json$/, '');
		if (result.value.id !== name)
			throw new Error(`content/examples/${name}.json: id must be ${name}`);
		return result.value;
	})
	.sort((a, b) => a.order - b.order);
