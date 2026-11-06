import { describe, expect, it } from 'vitest';
import { LIMITS, checkSymbol } from './document.ts';
import {
	MAX_PDA_STRING,
	comparePdaTransitions,
	createPdaDocument,
	freezePdaDocument,
	fromEnginePda,
	parsePdaDocument,
	parsePdaDocumentText,
	pdaDocumentsEqual,
	serializePdaDocument,
	toEnginePda
} from './pda-document.ts';
import type { PdaDocument, PdaTransitionEntry } from './pda-document.ts';
import { applyPdaCommand } from './pda-commands.ts';
import { anbnSample, wcwrSample, wwrSample } from './pda-samples.ts';
import { checkPdaDocument, random, randomPdaCommand } from './testing.ts';

describe('a new PDA document', () => {
	it('is empty, ndpda by default, valid and deeply frozen', () => {
		const doc = createPdaDocument();
		expect(doc).toEqual({
			schemaVersion: 1,
			title: '',
			kind: 'ndpda',
			inputAlphabet: [],
			stackAlphabet: [],
			states: [],
			start: null,
			accepting: [],
			transitions: [],
			nextStateId: 0
		});
		expect(checkPdaDocument(doc)).toEqual([]);
		expect(Object.isFrozen(doc)).toBe(true);
		expect(Object.isFrozen(doc.inputAlphabet)).toBe(true);
		expect(Object.isFrozen(doc.stackAlphabet)).toBe(true);
		expect(Object.isFrozen(doc.states)).toBe(true);
		expect(Object.isFrozen(doc.accepting)).toBe(true);
		expect(Object.isFrozen(doc.transitions)).toBe(true);
	});

	it('can be created as a dpda', () => {
		const doc = createPdaDocument('dpda');
		expect(doc.kind).toBe('dpda');
		expect(checkPdaDocument(doc)).toEqual([]);
	});
});

describe('comparePdaTransitions (the engine order)', () => {
	const t = (
		from: number,
		read: string | null,
		pop: string[],
		push: string[],
		to: number
	): PdaTransitionEntry => ({ from, read, pop, push, to });

	it('orders by from, then read (null first, then by inputAlphabet index), then pop, then push, then to', () => {
		// Deliberately reversed alphabets so symbol index order differs from lexicographical order.
		const input = ['b', 'a'];
		const stack = ['Z', 'A'];

		const items: PdaTransitionEntry[] = [
			t(1, null, [], [], 0),
			t(0, 'a', ['A'], [], 1),
			t(0, 'b', ['Z', 'A'], [], 0),
			t(0, 'b', ['Z'], ['A'], 1),
			t(0, 'b', ['Z'], ['A'], 0),
			t(0, 'b', ['Z'], ['Z'], 0),
			t(0, 'b', ['Z'], [], 0),
			t(0, 'b', ['A'], [], 0),
			t(0, 'b', [], [], 0),
			t(0, null, [], [], 0)
		];

		const sorted = [...items].sort((x, y) => comparePdaTransitions(input, stack, x, y));
		expect(sorted).toEqual([
			t(0, null, [], [], 0),
			t(0, 'b', [], [], 0),
			t(0, 'b', ['Z'], [], 0),
			t(0, 'b', ['Z'], ['Z'], 0),
			t(0, 'b', ['Z'], ['A'], 0),
			t(0, 'b', ['Z'], ['A'], 1),
			t(0, 'b', ['Z', 'A'], [], 0),
			t(0, 'b', ['A'], [], 0),
			t(0, 'a', ['A'], [], 1),
			t(1, null, [], [], 0)
		]);
	});
});

describe('pda-samples F1, F2, F3', () => {
	it('F1 (a^n b^n, n >= 1), F2 (wcw^R) and F3 (ww^R) follow every document rule', () => {
		const f1 = anbnSample();
		const f2 = wcwrSample();
		const f3 = wwrSample();
		expect(checkPdaDocument(f1)).toEqual([]);
		expect(checkPdaDocument(f2)).toEqual([]);
		expect(checkPdaDocument(f3)).toEqual([]);
		expect(f1.kind).toBe('dpda');
		expect(f2.kind).toBe('dpda');
		expect(f3.kind).toBe('ndpda');
		expect(pdaDocumentsEqual(f1, anbnSample())).toBe(true);
		expect(pdaDocumentsEqual(f1, f2)).toBe(false);
	});
});

describe('toEnginePda and fromEnginePda', () => {
	it('converts F3 to an engine Pda and back, repairing names and placing missing states on the grid', () => {
		const f3 = wwrSample();
		const enginePda = toEnginePda(f3);
		expect(enginePda).toEqual({
			schemaVersion: 1,
			kind: 'ndpda',
			inputAlphabet: ['a', 'b'],
			stackAlphabet: ['A', 'B'],
			states: [0, 1],
			start: 0,
			accepting: [1],
			transitions: [
				{ from: 0, read: null, pop: [], push: [], to: 1 },
				{ from: 0, read: 'a', pop: [], push: ['A'], to: 0 },
				{ from: 0, read: 'b', pop: [], push: ['B'], to: 0 },
				{ from: 1, read: 'a', pop: ['A'], push: [], to: 1 },
				{ from: 1, read: 'b', pop: ['B'], push: [], to: 1 }
			]
		});

		const withoutLayout = fromEnginePda(enginePda);
		expect(checkPdaDocument(withoutLayout)).toEqual([]);
		expect(withoutLayout.states).toEqual([
			{ id: 0, name: 'q0', x: 100, y: 100 },
			{ id: 1, name: 'q1', x: 230, y: 100 }
		]);

		// Repairs duplicate or blank names when given a layout.
		const repaired = fromEnginePda(enginePda, [
			{ id: 0, name: 'dup', x: 10, y: 20 },
			{ id: 1, name: 'dup', x: Number.NaN, y: 50 }
		]);
		expect(checkPdaDocument(repaired)).toEqual([]);
		expect(repaired.states[0]).toEqual({ id: 0, name: 'dup', x: 10, y: 20 });
		expect(repaired.states[1]).toEqual({ id: 1, name: 'dup_2', x: 230, y: 100 });
	});
});

describe('AC4: round trip on 500 random valid documents', () => {
	it('round-trips through serializePdaDocument/parsePdaDocument and toEnginePda/fromEnginePda', () => {
		for (let seed = 1; seed <= 500; seed++) {
			const rng = random(seed * 131);
			let doc = createPdaDocument();
			for (let step = 0; step < 25; step++) {
				const res = applyPdaCommand(doc, randomPdaCommand(rng, doc));
				if (res.ok) doc = res.doc;
			}
			expect(checkPdaDocument(doc), `seed ${seed}`).toEqual([]);

			// (a) JSON round trip
			const json = serializePdaDocument(doc);
			const parsed = parsePdaDocument(JSON.parse(json));
			expect(parsed.ok, `seed ${seed} parsePdaDocument`).toBe(true);
			if (parsed.ok) {
				expect(pdaDocumentsEqual(parsed.value, doc), `seed ${seed} equal`).toBe(true);
			}
			const parsedText = parsePdaDocumentText(json);
			expect(parsedText.ok, `seed ${seed} parsePdaDocumentText`).toBe(true);
			if (parsedText.ok) {
				expect(pdaDocumentsEqual(parsedText.value, doc), `seed ${seed} text equal`).toBe(true);
			}

			// (b) Engine Pda round trip
			// fromEnginePda gives title "" and nextStateId = max id + 1, so the comparison normalizes the title and nextStateId of the original (ids are never reused in a live document, the engine does not store the counter).
			const roundTripped = fromEnginePda(toEnginePda(doc), doc.states);
			const normalized: PdaDocument = {
				...doc,
				title: '',
				nextStateId: (doc.states[doc.states.length - 1]?.id ?? -1) + 1
			};
			expect(checkPdaDocument(roundTripped), `seed ${seed} roundTripped valid`).toEqual([]);
			expect(
				pdaDocumentsEqual(roundTripped, normalized),
				`seed ${seed} fromEnginePda(toEnginePda)`
			).toBe(true);
		}
	});
});

describe('F5: limits and untrusted input in parsePdaDocument and parsePdaDocumentText', () => {
	it('refuses ε as a symbol name via checkSymbol', () => {
		const res = checkSymbol('ε');
		expect(res.ok).toBe(false);
		if (!res.ok) {
			expect(res.error.key).toBe('document.invalid_symbol');
		}
	});

	it('refuses a future schemaVersion with pda_document.unsupported_version { version }', () => {
		const raw = { ...JSON.parse(serializePdaDocument(anbnSample())), schemaVersion: 2 };
		const res = parsePdaDocument(raw);
		expect(res).toEqual({
			ok: false,
			error: { key: 'pda_document.unsupported_version', params: { version: 2 } }
		});
	});

	it('refuses a pop or push of 65 symbols with pda_document.string_too_long { limit: 64 }', () => {
		const raw = JSON.parse(serializePdaDocument(anbnSample()));
		raw.transitions[0].pop = Array.from({ length: MAX_PDA_STRING + 1 }, () => 'A');
		expect(parsePdaDocument(raw)).toEqual({
			ok: false,
			error: { key: 'pda_document.string_too_long', params: { limit: 64 } }
		});

		const rawPush = JSON.parse(serializePdaDocument(anbnSample()));
		rawPush.transitions[0].push = Array.from({ length: MAX_PDA_STRING + 1 }, () => 'A');
		expect(parsePdaDocument(rawPush)).toEqual({
			ok: false,
			error: { key: 'pda_document.string_too_long', params: { limit: 64 } }
		});
	});

	it('refuses a transition that names Z when stackAlphabet is ["A"] with pda_document.unknown_symbol { symbol: "Z" }', () => {
		const raw = JSON.parse(serializePdaDocument(anbnSample()));
		raw.transitions[0].push = ['Z'];
		expect(parsePdaDocument(raw)).toEqual({
			ok: false,
			error: { key: 'pda_document.unknown_symbol', params: { symbol: 'Z' } }
		});
	});

	it('refuses a duplicate transition in parsePdaDocument with pda_document.duplicate_transition', () => {
		const raw = JSON.parse(serializePdaDocument(anbnSample()));
		raw.transitions.splice(1, 0, { ...raw.transitions[0] });
		expect(parsePdaDocument(raw)).toEqual({
			ok: false,
			error: { key: 'pda_document.duplicate_transition', params: {} }
		});
	});

	it('refuses 2001 states and 257 symbols in one alphabet', () => {
		const base = JSON.parse(serializePdaDocument(createPdaDocument()));
		const tooManyStates = {
			...base,
			states: Array.from({ length: LIMITS.states + 1 }, (_, i) => ({
				id: i,
				name: `q${i}`,
				x: 0,
				y: 0
			})),
			nextStateId: LIMITS.states + 1
		};
		expect(parsePdaDocument(tooManyStates)).toEqual({
			ok: false,
			error: { key: 'document.limit_exceeded', params: { what: 'states', limit: LIMITS.states } }
		});

		const tooManyInput = {
			...base,
			inputAlphabet: Array.from({ length: LIMITS.symbols + 1 }, (_, i) => `s${i}`)
		};
		expect(parsePdaDocument(tooManyInput)).toEqual({
			ok: false,
			error: { key: 'document.limit_exceeded', params: { what: 'symbols', limit: LIMITS.symbols } }
		});

		const tooManyStack = {
			...base,
			stackAlphabet: Array.from({ length: LIMITS.symbols + 1 }, (_, i) => `S${i}`)
		};
		expect(parsePdaDocument(tooManyStack)).toEqual({
			ok: false,
			error: { key: 'document.limit_exceeded', params: { what: 'symbols', limit: LIMITS.symbols } }
		});
	});

	it('refuses "", "null", "[]", a 2 MiB text, a missing state in a transition, a duplicate symbol in an alphabet, and an extra field without throwing', () => {
		expect(parsePdaDocumentText('').ok).toBe(false);
		expect(parsePdaDocumentText('null').ok).toBe(false);
		expect(parsePdaDocumentText('[]').ok).toBe(false);
		expect(parsePdaDocumentText('{').ok).toBe(false);

		const twoMiB = 'x'.repeat(2 * 1024 * 1024);
		expect(parsePdaDocumentText(twoMiB)).toEqual({
			ok: false,
			error: {
				key: 'document.limit_exceeded',
				params: { what: 'bytes', limit: LIMITS.documentBytes }
			}
		});

		// Missing state in a transition
		const missingState = JSON.parse(serializePdaDocument(anbnSample()));
		missingState.transitions[0].to = 99;
		expect(parsePdaDocument(missingState).ok).toBe(false);

		// Duplicate symbol in inputAlphabet
		const dupInput = JSON.parse(serializePdaDocument(anbnSample()));
		dupInput.inputAlphabet = ['a', 'a'];
		expect(parsePdaDocument(dupInput).ok).toBe(false);

		// Duplicate symbol in stackAlphabet
		const dupStack = JSON.parse(serializePdaDocument(anbnSample()));
		dupStack.stackAlphabet = ['A', 'A'];
		expect(parsePdaDocument(dupStack).ok).toBe(false);

		// Extra field on root, state, or transition
		const extraRoot = { ...JSON.parse(serializePdaDocument(anbnSample())), extra: true };
		expect(parsePdaDocument(extraRoot).ok).toBe(false);

		const extraState = JSON.parse(serializePdaDocument(anbnSample()));
		extraState.states[0].extra = 1;
		expect(parsePdaDocument(extraState).ok).toBe(false);

		const extraTransition = JSON.parse(serializePdaDocument(anbnSample()));
		extraTransition.transitions[0].extra = 1;
		expect(parsePdaDocument(extraTransition).ok).toBe(false);

		// __proto__ in JSON
		const protoText = serializePdaDocument(anbnSample()).replace(
			'"schemaVersion":1',
			'"schemaVersion":1,"__proto__":{}'
		);
		expect(parsePdaDocumentText(protoText).ok).toBe(false);
	});
});

describe('pdaDocumentsEqual', () => {
	function makeBase(): PdaDocument {
		return freezePdaDocument({
			schemaVersion: 1,
			title: 'base',
			kind: 'ndpda',
			inputAlphabet: ['a', 'b'],
			stackAlphabet: ['A', 'B'],
			states: [
				{ id: 0, name: 'q0', x: 100, y: 100 },
				{ id: 1, name: 'q1', x: 200, y: 200 }
			],
			start: 0,
			accepting: [1],
			transitions: [
				{
					from: 0,
					read: 'a',
					pop: ['A'],
					push: ['A', 'B'],
					to: 1
				}
			],
			nextStateId: 2
		});
	}

	it('returns true for two equal but separately built documents', () => {
		const a = makeBase();
		const b = makeBase();
		expect(a).not.toBe(b);
		expect(pdaDocumentsEqual(a, b)).toBe(true);
	});

	it('returns false for every single-field difference', () => {
		const base = makeBase();
		const baseTx = base.transitions[0]!;
		const cases: ReadonlyArray<{ label: string; doc: PdaDocument }> = [
			{ label: 'title', doc: freezePdaDocument({ ...makeBase(), title: 'other' }) },
			{ label: 'kind', doc: freezePdaDocument({ ...makeBase(), kind: 'dpda' }) },
			{
				label: 'one input symbol',
				doc: freezePdaDocument({ ...makeBase(), inputAlphabet: ['a', 'c'] })
			},
			{
				label: 'one stack symbol',
				doc: freezePdaDocument({ ...makeBase(), stackAlphabet: ['A', 'C'] })
			},
			{
				label: 'state name',
				doc: freezePdaDocument({
					...makeBase(),
					states: [
						{ id: 0, name: 's0', x: 100, y: 100 },
						{ id: 1, name: 'q1', x: 200, y: 200 }
					]
				})
			},
			{
				label: 'state x',
				doc: freezePdaDocument({
					...makeBase(),
					states: [
						{ id: 0, name: 'q0', x: 101, y: 100 },
						{ id: 1, name: 'q1', x: 200, y: 200 }
					]
				})
			},
			{
				label: 'state y',
				doc: freezePdaDocument({
					...makeBase(),
					states: [
						{ id: 0, name: 'q0', x: 100, y: 101 },
						{ id: 1, name: 'q1', x: 200, y: 200 }
					]
				})
			},
			{ label: 'start', doc: freezePdaDocument({ ...makeBase(), start: 1 }) },
			{ label: 'one accepting id', doc: freezePdaDocument({ ...makeBase(), accepting: [0] }) },
			{ label: 'nextStateId', doc: freezePdaDocument({ ...makeBase(), nextStateId: 3 }) },
			{
				label: 'transition from',
				doc: freezePdaDocument({
					...makeBase(),
					transitions: [{ ...baseTx, from: 1 }]
				})
			},
			{
				label: 'transition read (null vs symbol)',
				doc: freezePdaDocument({
					...makeBase(),
					transitions: [{ ...baseTx, read: null }]
				})
			},
			{
				label: 'transition to',
				doc: freezePdaDocument({
					...makeBase(),
					transitions: [{ ...baseTx, to: 0 }]
				})
			},
			{
				label: 'transition pop symbol',
				doc: freezePdaDocument({
					...makeBase(),
					transitions: [{ ...baseTx, pop: ['B'] }]
				})
			},
			{
				label: 'transition push symbol',
				doc: freezePdaDocument({
					...makeBase(),
					transitions: [{ ...baseTx, push: ['A', 'A'] }]
				})
			},
			{
				label: 'transition pop length',
				doc: freezePdaDocument({
					...makeBase(),
					transitions: [{ ...baseTx, pop: ['A', 'B'] }]
				})
			},
			{
				label: 'transition push length',
				doc: freezePdaDocument({
					...makeBase(),
					transitions: [{ ...baseTx, push: ['A'] }]
				})
			},
			{
				label: 'swap of two symbols inside push',
				doc: freezePdaDocument({
					...makeBase(),
					transitions: [{ ...baseTx, push: ['B', 'A'] }]
				})
			}
		];

		for (const { label, doc } of cases) {
			expect(pdaDocumentsEqual(base, doc), label).toBe(false);
		}
	});
});
