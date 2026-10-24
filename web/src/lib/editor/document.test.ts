import { describe, expect, it } from 'vitest';
import {
	LIMITS,
	checkDocument,
	checkName,
	checkSymbol,
	createDocument,
	documentFromJff,
	documentFromMachine,
	jffLayout,
	parseDocument,
	parseDocumentText,
	serializeDocument,
	toMachine
} from './document.ts';
import type { MachineDocument } from './document.ts';
import type { Jff, Machine } from '../engine/types.ts';

/** A complete DFSM for "an even number of a's", with names and places, written by hand. */
function evenA(): MachineDocument {
	return {
		schemaVersion: 1,
		title: 'Genap a',
		kind: 'dfsm',
		alphabet: ['a', 'b'],
		states: [
			{ id: 0, name: 'q0', x: 100, y: 100 },
			{ id: 2, name: 'q2', x: 300, y: 100.5 }
		],
		start: 0,
		accepting: [0],
		transitions: [
			{ from: 0, on: 'a', to: 2 },
			{ from: 0, on: 'b', to: 0 },
			{ from: 2, on: 'a', to: 0 },
			{ from: 2, on: 'b', to: 2 }
		],
		nextStateId: 3
	};
}

describe('the rules for symbols (the same as the engine)', () => {
	it('accepts symbols of the alphabet', () => {
		for (const ok of ['a', '0', 'num', 'x1', 'é', 'ñ', 'α', '漢', '😀', 'a😀b', '​']) {
			expect(checkSymbol(ok), ok).toEqual({ ok: true });
		}
	});

	it('refuses an empty symbol, ε, white space and control characters', () => {
		const bad = [
			'',
			'ε',
			' ',
			'a b',
			'\t',
			'\n',
			'\u0000',
			'\u0085',
			' ',
			' ',
			' ',
			' ',
			' ',
			' ',
			'　',
			'\u007F'
		];
		for (const symbol of bad) {
			const result = checkSymbol(symbol);
			expect(result.ok, JSON.stringify(symbol)).toBe(false);
		}
	});

	it('counts characters as code points, with a limit of 32', () => {
		expect(checkSymbol('a'.repeat(32)).ok).toBe(true);
		expect(checkSymbol('a'.repeat(33)).ok).toBe(false);
		// 32 emoji are 64 UTF-16 units but 32 characters.
		expect(checkSymbol('😀'.repeat(32)).ok).toBe(true);
		expect(checkSymbol('😀'.repeat(33)).ok).toBe(false);
	});

	it('refuses a lone surrogate', () => {
		expect(checkSymbol('\uD800').ok).toBe(false);
		expect(checkSymbol('a\uDC00').ok).toBe(false);
	});

	it('says why', () => {
		const empty = checkSymbol('');
		expect(empty.ok ? undefined : empty.error.key).toBe('document.invalid_symbol');
		const spaced = checkSymbol('a b');
		expect(spaced.ok ? undefined : spaced.error.params.reason).toBe('characters');
		const long = checkSymbol('x'.repeat(33));
		expect(long.ok ? undefined : long.error.params.reason).toBe('too_long');
		const epsilon = checkSymbol('ε');
		expect(epsilon.ok ? undefined : epsilon.error.params.reason).toBe('epsilon');
	});
});

describe('the rules for state names', () => {
	it('accepts names, with spaces inside', () => {
		for (const ok of ['q0', 'mulai', 'q 1', 'α', '😀', 'x'.repeat(32)]) {
			expect(checkName(ok), ok).toEqual({ ok: true });
		}
	});

	it('refuses an empty name, a name with spaces at the ends, a long name and control characters', () => {
		for (const bad of ['', ' q', 'q ', '\tq', 'x'.repeat(33), 'a\u0000b', 'a\nb']) {
			expect(checkName(bad).ok, JSON.stringify(bad)).toBe(false);
		}
	});
});

describe('a new document', () => {
	it('is empty, valid and frozen', () => {
		const doc = createDocument();
		expect(doc).toEqual({
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
		expect(checkDocument(doc)).toEqual([]);
		expect(Object.isFrozen(doc)).toBe(true);
		expect(Object.isFrozen(doc.states)).toBe(true);
	});
});

describe('toMachine and documentFromMachine', () => {
	it('gives the machine file of the engine, with ε as null', () => {
		const doc: MachineDocument = {
			...evenA(),
			kind: 'ndfsm',
			transitions: [
				{ from: 0, on: null, to: 2 },
				{ from: 0, on: 'a', to: 2 },
				{ from: 0, on: 'b', to: 0 },
				{ from: 2, on: 'a', to: 0 },
				{ from: 2, on: 'b', to: 2 }
			]
		};
		expect(toMachine(doc)).toEqual({
			schemaVersion: 1,
			kind: 'ndfsm',
			alphabet: ['a', 'b'],
			states: [0, 2],
			start: 0,
			accepting: [0],
			transitions: [
				{ from: 0, on: null, to: 2 },
				{ from: 0, on: 'a', to: 2 },
				{ from: 0, on: 'b', to: 0 },
				{ from: 2, on: 'a', to: 0 },
				{ from: 2, on: 'b', to: 2 }
			]
		});
		expect(checkDocument(doc)).toEqual([]);
	});

	it('keeps the order of the transitions by the number of the symbol, as the engine sorts them', () => {
		// The alphabet is b, a, so b is symbol 0 and its transition comes first.
		const doc: MachineDocument = {
			...evenA(),
			alphabet: ['b', 'a'],
			transitions: [
				{ from: 0, on: 'b', to: 0 },
				{ from: 0, on: 'a', to: 2 },
				{ from: 2, on: 'b', to: 2 },
				{ from: 2, on: 'a', to: 0 }
			]
		};
		expect(checkDocument(doc)).toEqual([]);
		const symbols = toMachine(doc)
			.transitions.filter((t) => t.from === 0)
			.map((t) => t.on);
		expect(symbols).toEqual(['b', 'a']);
		// The same transitions in the order of a, b break the rule.
		expect(checkDocument({ ...doc, transitions: evenA().transitions })).not.toEqual([]);
	});

	it('reads a machine without a layout: names q<id> and a grid of places', () => {
		const machine: Machine = toMachine(evenA());
		const doc = documentFromMachine(machine);
		expect(doc.states.map((s) => s.name)).toEqual(['q0', 'q2']);
		expect(doc.states[0]).toMatchObject({ x: 100, y: 100 });
		expect(doc.states[1]).toMatchObject({ x: 230, y: 100 });
		expect(doc.nextStateId).toBe(3);
		expect(checkDocument(doc)).toEqual([]);
		expect(toMachine(doc)).toEqual(machine);
	});

	it('puts the states on rows of six', () => {
		const states = Array.from({ length: 8 }, (_, i) => i);
		const machine: Machine = {
			schemaVersion: 1,
			kind: 'dfsm',
			alphabet: [],
			states,
			start: null,
			accepting: [],
			transitions: []
		};
		const doc = documentFromMachine(machine);
		expect(doc.states[5]).toMatchObject({ x: 750, y: 100 });
		expect(doc.states[6]).toMatchObject({ x: 100, y: 230 });
	});

	it('takes names and places from a layout', () => {
		const doc = documentFromMachine(toMachine(evenA()), [{ id: 2, name: 'akhir', x: 5, y: 6 }]);
		expect(doc.states[0]).toMatchObject({ id: 0, name: 'q0' });
		expect(doc.states[1]).toEqual({ id: 2, name: 'akhir', x: 5, y: 6 });
	});
});

describe('documentFromJff', () => {
	const jff = (states: { id: number; name: string; x: number; y: number }[]): Jff => ({
		fsm: {
			schemaVersion: 1,
			kind: 'dfsm',
			alphabet: ['a'],
			states: states.map((s) => s.id),
			start: states[0]?.id ?? null,
			accepting: [],
			transitions: []
		},
		states,
		notes: []
	});

	it('keeps the names and the places of the file', () => {
		const { doc, notes } = documentFromJff(
			jff([
				{ id: 0, name: 'mulai', x: 85, y: 117 },
				{ id: 1, name: 'akhir', x: 523, y: 367 }
			])
		);
		expect(doc.states).toEqual([
			{ id: 0, name: 'mulai', x: 85, y: 117 },
			{ id: 1, name: 'akhir', x: 523, y: 367 }
		]);
		expect(notes).toEqual([]);
	});

	it('repairs blank, repeated, long and odd names, and says so', () => {
		const long = 'x'.repeat(40);
		const { doc, notes } = documentFromJff(
			jff([
				{ id: 0, name: 'q1', x: 0, y: 0 },
				{ id: 1, name: 'q1', x: 0, y: 0 },
				{ id: 2, name: '', x: 0, y: 0 },
				{ id: 3, name: '  ', x: 0, y: 0 },
				{ id: 4, name: long, x: 0, y: 0 },
				{ id: 5, name: ' a\u0000b ', x: 0, y: 0 },
				{ id: 6, name: 'q1', x: 0, y: 0 }
			])
		);
		expect(checkDocument(doc)).toEqual([]);
		const names = doc.states.map((s) => s.name);
		expect(new Set(names).size).toBe(names.length);
		expect(names[0]).toBe('q1'); // the first one keeps its name
		expect(names[1]).toBe('q1_2');
		expect(names[6]).toBe('q1_3');
		expect(names[4]).toBe('x'.repeat(32));
		expect(names[5]).toBe('ab');
		// A blank name becomes q<id>.
		expect(names[2]).toBe('q2');
		expect(names[3]).toBe('q3');
		const changed = notes.filter((n) => n.key === 'document.name_changed');
		expect(changed.length).toBe(6);
		expect(changed[0]?.params).toMatchObject({ id: 1, from: 'q1', to: 'q1_2' });
	});

	it('does not run into a name that a later state already has', () => {
		const { doc } = documentFromJff(
			jff([
				{ id: 0, name: 'q1', x: 0, y: 0 },
				{ id: 1, name: 'q1', x: 0, y: 0 },
				{ id: 2, name: 'q1_2', x: 0, y: 0 }
			])
		);
		expect(checkDocument(doc)).toEqual([]);
		expect(new Set(doc.states.map((s) => s.name)).size).toBe(3);
	});

	it('uses a grid for a place that is missing or not a number, and keeps the notes of the engine', () => {
		const input = jff([
			{ id: 0, name: 'a', x: Number.NaN, y: 0 },
			{ id: 1, name: 'b', x: 1e12, y: -1e12 }
		]);
		input.notes = [{ key: 'jff.label_expanded', params: { label: 'ab' } }];
		const { doc, notes } = documentFromJff(input);
		expect(checkDocument(doc)).toEqual([]);
		expect(doc.states[0]).toMatchObject({ x: 100, y: 100 });
		expect(doc.states[1]?.x).toBeLessThanOrEqual(LIMITS.coordinate);
		expect(notes[0]?.key).toBe('jff.label_expanded');
	});

	it('gives the layout back for an export', () => {
		expect(jffLayout(evenA())).toEqual([
			{ id: 0, name: 'q0', x: 100, y: 100 },
			{ id: 2, name: 'q2', x: 300, y: 100.5 }
		]);
	});
});

describe('serializing', () => {
	it('round trips', () => {
		const doc = evenA();
		const again = parseDocument(JSON.parse(serializeDocument(doc)));
		expect(again).toEqual({ ok: true, value: doc });
		const text = parseDocumentText(serializeDocument(doc));
		expect(text).toEqual({ ok: true, value: doc });
	});

	it('gives a frozen document', () => {
		const result = parseDocumentText(serializeDocument(evenA()));
		expect(result.ok && Object.isFrozen(result.value)).toBe(true);
		expect(result.ok && Object.isFrozen(result.value.states[0])).toBe(true);
	});

	const wrong = (change: (d: Record<string, unknown>) => void) => {
		const d = JSON.parse(serializeDocument(evenA())) as Record<string, unknown>;
		change(d);
		return parseDocument(d);
	};
	const key = (r: ReturnType<typeof parseDocument>) => (r.ok ? 'ok' : r.error.key);

	it('refuses a file that is not a document', () => {
		for (const bad of [null, undefined, 1, 'x', [], true]) {
			expect(key(parseDocument(bad)), String(bad)).toBe('document.invalid_file');
		}
	});

	it('refuses another version, a missing field and an extra field', () => {
		expect(key(wrong((d) => (d.schemaVersion = 2)))).toBe('document.unsupported_version');
		expect(key(wrong((d) => delete d.states))).toBe('document.invalid_file');
		expect(key(wrong((d) => (d.extra = 1)))).toBe('document.invalid_file');
		expect(key(wrong((d) => ((d.states as Record<string, unknown>[])[0]!.extra = 1)))).toBe(
			'document.invalid_file'
		);
	});

	it('refuses values of the wrong type', () => {
		expect(key(wrong((d) => (d.title = 5)))).toBe('document.invalid_file');
		expect(key(wrong((d) => (d.kind = 'pda')))).toBe('document.invalid_file');
		expect(key(wrong((d) => (d.alphabet = 'ab')))).toBe('document.invalid_file');
		expect(key(wrong((d) => (d.start = '0')))).toBe('document.invalid_file');
		expect(key(wrong((d) => (d.nextStateId = 1.5)))).toBe('document.invalid_file');
		expect(key(wrong((d) => ((d.states as Record<string, unknown>[])[0]!.x = Number.NaN)))).toBe(
			'document.invalid_file'
		);
	});

	it('refuses a document that breaks a rule', () => {
		// Two states with one id, one name, or a start state that does not exist.
		expect(key(wrong((d) => ((d.states as Record<string, unknown>[])[1]!.id = 0)))).toBe(
			'document.invalid_file'
		);
		expect(key(wrong((d) => ((d.states as Record<string, unknown>[])[1]!.name = 'q0')))).toBe(
			'document.invalid_file'
		);
		expect(key(wrong((d) => (d.start = 7)))).toBe('document.invalid_file');
		expect(key(wrong((d) => (d.accepting = [0, 9])))).toBe('document.invalid_file');
		// A transition to a state or on a symbol that does not exist.
		expect(key(wrong((d) => (d.transitions = [{ from: 0, on: 'a', to: 99 }])))).toBe(
			'document.invalid_file'
		);
		expect(key(wrong((d) => (d.transitions = [{ from: 0, on: 'z', to: 2 }])))).toBe(
			'document.invalid_file'
		);
		// A counter that would give an id that is in use.
		expect(key(wrong((d) => (d.nextStateId = 2)))).toBe('document.invalid_file');
		// A symbol that the engine would refuse.
		expect(key(wrong((d) => (d.alphabet = ['a', 'b c'])))).toBe('document.invalid_file');
	});

	it('refuses too many states', () => {
		const result = wrong((d) => {
			d.states = Array.from({ length: LIMITS.states + 1 }, (_, i) => ({
				id: i,
				name: `s${i}`,
				x: 0,
				y: 0
			}));
			d.nextStateId = LIMITS.states + 1;
			d.start = null;
			d.accepting = [];
			d.transitions = [];
		});
		expect(!result.ok && result.error.key).toBe('document.limit_exceeded');
	});

	it('refuses text that is too long before it reads it', () => {
		const text = ' '.repeat(LIMITS.documentBytes + 1) + serializeDocument(evenA());
		const result = parseDocumentText(text);
		expect(!result.ok && result.error.key).toBe('document.limit_exceeded');
	});

	it('counts bytes, not characters, for the limit', () => {
		// 60% of the limit in characters, but each é is 2 bytes: 120% of the limit in bytes.
		const text = 'é'.repeat(Math.floor(LIMITS.documentBytes * 0.6));
		expect(text.length).toBeLessThan(LIMITS.documentBytes);
		const result = parseDocumentText(text);
		expect(!result.ok && result.error.key).toBe('document.limit_exceeded');
	});

	it('refuses text that is not JSON', () => {
		for (const bad of ['', '{', 'null', '[]', '{"a":', 'undefined']) {
			const result = parseDocumentText(bad);
			expect(!result.ok && result.error.key, bad).toBe('document.invalid_file');
		}
	});

	it('is not fooled by __proto__ or by deep nesting', () => {
		const proto = serializeDocument(evenA()).replace(
			'"schemaVersion":1',
			'"schemaVersion":1,"__proto__":{"polluted":true}'
		);
		expect(parseDocumentText(proto).ok).toBe(false);
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();

		const deep = '['.repeat(100_000) + ']'.repeat(100_000);
		expect(parseDocumentText(deep).ok).toBe(false);
	});

	it('never throws, whatever the text', () => {
		let seed = 1;
		const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff);
		const pieces = [
			'{',
			'}',
			'[',
			']',
			'"',
			',',
			':',
			'null',
			'true',
			'1',
			'"states"',
			'"a"',
			'\\',
			'\u0000'
		];
		for (let i = 0; i < 500; i++) {
			let text = '';
			for (let j = 0, n = next() % 30; j < n; j++) text += pieces[next() % pieces.length];
			expect(() => parseDocumentText(text), text).not.toThrow();
		}
	});
});

describe('checkDocument', () => {
	const problems = (change: (d: Record<string, unknown>) => void) => {
		const d = structuredClone(evenA()) as unknown as Record<string, unknown>;
		change(d);
		return checkDocument(d as unknown as MachineDocument);
	};

	it('finds nothing in a good document', () => {
		expect(checkDocument(evenA())).toEqual([]);
	});

	it('finds each broken rule', () => {
		expect(problems((d) => (d.states = [...(d.states as object[])].reverse()))).not.toEqual([]);
		expect(problems((d) => (d.accepting = [2, 0]))).not.toEqual([]);
		expect(problems((d) => (d.nextStateId = 0))).not.toEqual([]);
		expect(
			problems((d) => (d.transitions = (d.transitions as object[]).slice().reverse()))
		).not.toEqual([]);
		expect(
			problems(
				(d) =>
					(d.transitions = [
						{ from: 0, on: 'a', to: 2 },
						{ from: 0, on: 'a', to: 2 }
					])
			)
		).not.toEqual([]);
		expect(problems((d) => (d.alphabet = ['a', 'a']))).not.toEqual([]);
		expect(problems((d) => ((d.states as { x: number }[])[0]!.x = Infinity))).not.toEqual([]);
	});
});
