import { describe, expect, it } from 'vitest';
import { LIMITS } from './document.ts';
import { MAX_PDA_STRING, createPdaDocument, pdaDocumentsEqual } from './pda-document.ts';
import type { PdaDocument } from './pda-document.ts';
import { applyPdaCommand } from './pda-commands.ts';
import type { PdaCommand } from './pda-commands.ts';
import { wwrSample } from './pda-samples.ts';
import { checkPdaDocument } from './testing.ts';

function build(...commands: PdaCommand[]): PdaDocument {
	let doc = createPdaDocument();
	for (const command of commands) {
		const result = applyPdaCommand(doc, command);
		if (!result.ok) throw new Error(`${JSON.stringify(command)}: ${result.error.key}`);
		doc = result.doc;
	}
	return doc;
}

const add = (x: number, y: number, name?: string): PdaCommand => ({
	type: 'addState',
	x,
	y,
	name
});

const refused = (doc: PdaDocument, command: PdaCommand) => {
	const result = applyPdaCommand(doc, command);
	expect(result.ok, JSON.stringify(command)).toBe(false);
	return result.ok ? undefined : result.error;
};

function samplePda(): PdaDocument {
	return build(
		{ type: 'addInputSymbol', symbol: 'a' },
		{ type: 'addInputSymbol', symbol: 'b' },
		{ type: 'addStackSymbol', symbol: 'A' },
		{ type: 'addStackSymbol', symbol: 'B' },
		add(100, 100),
		add(250, 100),
		add(400, 100),
		{ type: 'setStart', id: 0 },
		{ type: 'setAccepting', id: 2, accepting: true },
		{ type: 'addTransition', from: 0, read: 'a', pop: [], push: ['A'], to: 1 },
		{ type: 'addTransition', from: 1, read: 'b', pop: ['A'], push: ['B'], to: 2 },
		{ type: 'addTransition', from: 2, read: null, pop: ['B'], push: [], to: 0 }
	);
}

describe('PDA states', () => {
	it('addState assigns ascending ids and free q<k> names without reusing removed ids', () => {
		const doc = build(add(10, 20), add(30, 40), { type: 'removeState', id: 1 }, add(50, 60));
		expect(doc.states).toEqual([
			{ id: 0, name: 'q0', x: 10, y: 20 },
			{ id: 2, name: 'q1', x: 50, y: 60 }
		]);
		expect(doc.nextStateId).toBe(3);
		expect(checkPdaDocument(doc)).toEqual([]);
	});

	it('removeState removes all transitions that touch it and clears start and accepting', () => {
		const doc = samplePda();
		const result = applyPdaCommand(doc, { type: 'removeState', id: 2 });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.doc.start).toBe(0);
		expect(result.doc.accepting).toEqual([]);
		expect(result.doc.transitions).toEqual([{ from: 0, read: 'a', pop: [], push: ['A'], to: 1 }]);
		expect(checkPdaDocument(result.doc)).toEqual([]);

		// Removing the start state clears start.
		const withoutStart = applyPdaCommand(result.doc, { type: 'removeState', id: 0 });
		expect(withoutStart.ok).toBe(true);
		if (!withoutStart.ok) return;
		expect(withoutStart.doc.start).toBeNull();
		expect(withoutStart.doc.transitions).toEqual([]);
		expect(checkPdaDocument(withoutStart.doc)).toEqual([]);
	});

	it('refuses the 2001st state', () => {
		let doc = createPdaDocument();
		for (let i = 0; i < LIMITS.states; i++) {
			const res = applyPdaCommand(doc, add(0, 0, `s${i}`));
			if (!res.ok) throw new Error(res.error.key);
			doc = res.doc;
		}
		expect(refused(doc, add(0, 0, 'extra'))).toEqual({
			key: 'document.limit_exceeded',
			params: { what: 'states', limit: LIMITS.states }
		});
	});
});

describe('PDA alphabets and cascade removal', () => {
	it('addInputSymbol and addStackSymbol append in user order and refuse ε, duplicates, and the 257th symbol', () => {
		const doc = build(
			{ type: 'addInputSymbol', symbol: 'b' },
			{ type: 'addInputSymbol', symbol: 'a' },
			{ type: 'addStackSymbol', symbol: 'Z' },
			{ type: 'addStackSymbol', symbol: 'A' }
		);
		expect(doc.inputAlphabet).toEqual(['b', 'a']);
		expect(doc.stackAlphabet).toEqual(['Z', 'A']);
		expect(refused(doc, { type: 'addInputSymbol', symbol: 'b' })?.key).toBe(
			'document.duplicate_symbol'
		);
		expect(refused(doc, { type: 'addStackSymbol', symbol: 'Z' })?.key).toBe(
			'document.duplicate_symbol'
		);
		expect(refused(doc, { type: 'addInputSymbol', symbol: 'ε' })?.key).toBe(
			'document.invalid_symbol'
		);
		expect(refused(doc, { type: 'addStackSymbol', symbol: 'ε' })?.key).toBe(
			'document.invalid_symbol'
		);

		let fullInput = createPdaDocument();
		for (let i = 0; i < LIMITS.symbols; i++) {
			const res = applyPdaCommand(fullInput, { type: 'addInputSymbol', symbol: `i${i}` });
			if (!res.ok) throw new Error(res.error.key);
			fullInput = res.doc;
		}
		expect(refused(fullInput, { type: 'addInputSymbol', symbol: 'overflow' })).toEqual({
			key: 'document.limit_exceeded',
			params: { what: 'symbols', limit: LIMITS.symbols }
		});

		let fullStack = createPdaDocument();
		for (let i = 0; i < LIMITS.symbols; i++) {
			const res = applyPdaCommand(fullStack, { type: 'addStackSymbol', symbol: `S${i}` });
			if (!res.ok) throw new Error(res.error.key);
			fullStack = res.doc;
		}
		expect(refused(fullStack, { type: 'addStackSymbol', symbol: 'OVERFLOW' })).toEqual({
			key: 'document.limit_exceeded',
			params: { what: 'symbols', limit: LIMITS.symbols }
		});
	});

	it('removeInputSymbol removes transitions that read it and leaves ε transitions and stackAlphabet intact', () => {
		const doc = samplePda();
		const res = applyPdaCommand(doc, { type: 'removeInputSymbol', symbol: 'a' });
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.doc.inputAlphabet).toEqual(['b']);
		expect(res.doc.stackAlphabet).toEqual(['A', 'B']);
		expect(res.doc.transitions).toEqual([
			{ from: 1, read: 'b', pop: ['A'], push: ['B'], to: 2 },
			{ from: 2, read: null, pop: ['B'], push: [], to: 0 }
		]);
		expect(checkPdaDocument(res.doc)).toEqual([]);
	});

	it('removeStackSymbol removes transitions that pop or push it and leaves other transitions intact', () => {
		const doc = samplePda();
		const res = applyPdaCommand(doc, { type: 'removeStackSymbol', symbol: 'B' });
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.doc.stackAlphabet).toEqual(['A']);
		expect(res.doc.transitions).toEqual([{ from: 0, read: 'a', pop: [], push: ['A'], to: 1 }]);
		expect(checkPdaDocument(res.doc)).toEqual([]);
	});
});

describe('PDA transitions, F4 (engine order) and F5 (refusals)', () => {
	it('F4: F3 transitions added in a scrambled order produce a document equal to F3', () => {
		const f3 = wwrSample();
		const scrambled = build(
			{ type: 'setTitle', title: f3.title },
			{ type: 'setKind', kind: f3.kind },
			{ type: 'addInputSymbol', symbol: 'a' },
			{ type: 'addInputSymbol', symbol: 'b' },
			{ type: 'addStackSymbol', symbol: 'A' },
			{ type: 'addStackSymbol', symbol: 'B' },
			{ type: 'addState', x: f3.states[0]!.x, y: f3.states[0]!.y, name: f3.states[0]!.name },
			{ type: 'addState', x: f3.states[1]!.x, y: f3.states[1]!.y, name: f3.states[1]!.name },
			{ type: 'setStart', id: 0 },
			{ type: 'setAccepting', id: 1, accepting: true },
			// Added in reverse / scrambled order compared to the engine's canonical order:
			{ type: 'addTransition', from: 1, read: 'b', pop: ['B'], push: [], to: 1 },
			{ type: 'addTransition', from: 0, read: 'b', pop: [], push: ['B'], to: 0 },
			{ type: 'addTransition', from: 1, read: 'a', pop: ['A'], push: [], to: 1 },
			{ type: 'addTransition', from: 0, read: 'a', pop: [], push: ['A'], to: 0 },
			{ type: 'addTransition', from: 0, read: null, pop: [], push: [], to: 1 }
		);
		expect(pdaDocumentsEqual(scrambled, f3)).toBe(true);
		expect(checkPdaDocument(scrambled)).toEqual([]);
	});

	it('F5: refuses pop or push longer than 64 symbols, unknown symbol, duplicate transition, and ε as a symbol', () => {
		const doc = build(
			{ type: 'addInputSymbol', symbol: 'a' },
			{ type: 'addStackSymbol', symbol: 'A' },
			add(0, 0),
			add(100, 0),
			{ type: 'addTransition', from: 0, read: 'a', pop: [], push: ['A'], to: 1 }
		);

		const long65 = Array.from({ length: MAX_PDA_STRING + 1 }, () => 'A');
		expect(
			refused(doc, { type: 'addTransition', from: 0, read: 'a', pop: long65, push: [], to: 1 })
		).toEqual({
			key: 'pda_document.string_too_long',
			params: { limit: 64 }
		});
		expect(
			refused(doc, { type: 'addTransition', from: 0, read: 'a', pop: [], push: long65, to: 1 })
		).toEqual({
			key: 'pda_document.string_too_long',
			params: { limit: 64 }
		});

		// Unknown stack symbol Z when stackAlphabet is ["A"]
		expect(
			refused(doc, { type: 'addTransition', from: 0, read: 'a', pop: [], push: ['Z'], to: 1 })
		).toEqual({
			key: 'pda_document.unknown_symbol',
			params: { symbol: 'Z' }
		});

		// Unknown input symbol z when inputAlphabet is ["a"]
		expect(
			refused(doc, { type: 'addTransition', from: 0, read: 'z', pop: [], push: ['A'], to: 1 })
		).toEqual({
			key: 'pda_document.unknown_symbol',
			params: { symbol: 'z' }
		});

		// Duplicate transition
		expect(
			refused(doc, { type: 'addTransition', from: 0, read: 'a', pop: [], push: ['A'], to: 1 })
		).toEqual({
			key: 'pda_document.duplicate_transition',
			params: {}
		});

		// ε as a symbol name in read or pop/push
		expect(
			refused(doc, { type: 'addTransition', from: 0, read: 'ε', pop: [], push: [], to: 1 })?.key
		).toBe('document.invalid_symbol');
	});

	it('removeTransition removes an existing transition and refuses an unknown one', () => {
		const doc = samplePda();
		const res = applyPdaCommand(doc, {
			type: 'removeTransition',
			from: 2,
			read: null,
			pop: ['B'],
			push: [],
			to: 0
		});
		expect(res.ok && res.doc.transitions.length).toBe(2);
		expect(
			refused(doc, {
				type: 'removeTransition',
				from: 0,
				read: null,
				pop: [],
				push: [],
				to: 0
			})?.key
		).toBe('document.unknown_transition');
	});
});

describe('no-op commands and batch atomicity', () => {
	it('returns the exact same document reference when a command changes nothing', () => {
		const doc = samplePda();
		const noOps: PdaCommand[] = [
			{ type: 'moveState', id: 0, x: 100, y: 100 },
			{ type: 'renameState', id: 0, name: 'q0' },
			{ type: 'setStart', id: 0 },
			{ type: 'setAccepting', id: 2, accepting: true },
			{ type: 'setAccepting', id: 0, accepting: false },
			{ type: 'setKind', kind: 'ndpda' },
			{ type: 'setTitle', title: '' },
			{ type: 'batch', commands: [] }
		];
		for (const cmd of noOps) {
			const res = applyPdaCommand(doc, cmd);
			expect(res.ok && res.doc === doc, JSON.stringify(cmd)).toBe(true);
		}
	});

	it('batch is atomic: if one inner command is refused, the whole batch is refused and nothing changes', () => {
		const doc = samplePda();
		const res = applyPdaCommand(doc, {
			type: 'batch',
			commands: [
				add(500, 500),
				{ type: 'addTransition', from: 0, read: 'a', pop: [], push: ['UNKNOWN'], to: 1 }
			]
		});
		expect(res.ok).toBe(false);
		if (!res.ok) {
			expect(res.error).toEqual({
				key: 'pda_document.unknown_symbol',
				params: { symbol: 'UNKNOWN' }
			});
		}
		expect(doc.states.length).toBe(3);
	});

	it('refuses nested batches deeper than LIMITS.batchDepth (8) leaving the document unchanged, and accepts 10,000 commands while refusing 10,001', () => {
		const doc = samplePda();
		const before = doc;

		// Depth 8 (depths 0..7) is accepted
		let atLimit: PdaCommand = { type: 'setKind', kind: 'dpda' };
		for (let i = 0; i < LIMITS.batchDepth; i++) {
			atLimit = { type: 'batch', commands: [atLimit] };
		}
		const okDepth = applyPdaCommand(doc, atLimit);
		expect(okDepth.ok && okDepth.doc.kind).toBe('dpda');

		// Deeper than LIMITS.batchDepth (8) is refused with document.limit_exceeded and leaves the document unchanged
		const tooDeep: PdaCommand = {
			type: 'batch',
			commands: [add(500, 500), atLimit]
		};
		const refusedDepth = applyPdaCommand(doc, tooDeep);
		expect(refusedDepth).toEqual({
			ok: false,
			error: {
				key: 'document.limit_exceeded',
				params: { what: 'batch', limit: LIMITS.batchDepth }
			}
		});
		expect(pdaDocumentsEqual(doc, before)).toBe(true);
		expect(doc.states.length).toBe(3);

		// Exactly 10,000 (LIMITS.batchCommands) commands is accepted
		const tenThousand: PdaCommand = {
			type: 'batch',
			commands: Array.from({ length: LIMITS.batchCommands }, (_, i) => ({
				type: 'moveState' as const,
				id: 0,
				x: i + 1,
				y: 0
			}))
		};
		const okCount = applyPdaCommand(doc, tenThousand);
		expect(okCount.ok).toBe(true);
		if (okCount.ok) {
			expect(okCount.doc.states[0]?.x).toBe(LIMITS.batchCommands);
		}

		// 10,001 commands is refused with document.limit_exceeded and leaves the document unchanged
		const tenThousandOne: PdaCommand = {
			type: 'batch',
			commands: Array.from({ length: LIMITS.batchCommands + 1 }, (_, i) => ({
				type: 'moveState' as const,
				id: 0,
				x: i + 1,
				y: 0
			}))
		};
		const refusedCount = applyPdaCommand(doc, tenThousandOne);
		expect(refusedCount).toEqual({
			ok: false,
			error: {
				key: 'document.limit_exceeded',
				params: { what: 'batch', limit: LIMITS.batchDepth }
			}
		});
		expect(doc.states[0]?.x).toBe(100);
	});
});
