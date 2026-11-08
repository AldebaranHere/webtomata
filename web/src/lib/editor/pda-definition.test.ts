import { describe, expect, it } from 'vitest';
import { createPdaDocument } from './pda-document.ts';
import type { PdaDocument } from './pda-document.ts';
import { applyPdaCommand } from './pda-commands.ts';
import { pdaDefinitionOf, pdaDefinitionText } from './pda-definition.ts';

function apply(doc: PdaDocument, cmd: Parameters<typeof applyPdaCommand>[1]): PdaDocument {
	const res = applyPdaCommand(doc, cmd);
	if (!res.ok) throw new Error(res.error.key);
	return res.doc;
}

function buildMachineF(): PdaDocument {
	let doc = createPdaDocument('dpda');
	doc = apply(doc, { type: 'addInputSymbol', symbol: 'a' });
	doc = apply(doc, { type: 'addInputSymbol', symbol: 'b' });
	doc = apply(doc, { type: 'addStackSymbol', symbol: 'A' });
	doc = apply(doc, { type: 'addState', x: 100, y: 100, name: 'q0' });
	doc = apply(doc, { type: 'addState', x: 300, y: 100, name: 'q1' });
	doc = apply(doc, { type: 'setStart', id: 0 });
	doc = apply(doc, { type: 'setAccepting', id: 1, accepting: true });
	doc = apply(doc, {
		type: 'addTransition',
		from: 0,
		read: 'a',
		pop: [],
		push: ['A'],
		to: 0
	});
	doc = apply(doc, {
		type: 'addTransition',
		from: 0,
		read: 'b',
		pop: ['A'],
		push: [],
		to: 1
	});
	doc = apply(doc, {
		type: 'addTransition',
		from: 1,
		read: 'b',
		pop: ['A'],
		push: [],
		to: 1
	});
	return doc;
}

describe('pdaDefinitionOf and pdaDefinitionText', () => {
	it('F2: produces formal definition tuple and transition lines', () => {
		const docF = buildMachineF();
		const def = pdaDefinitionOf(docF);

		expect(def.heading).toBe('M = (K, Σ, Γ, Δ, s, A)');
		expect(def.states).toBe('{q0, q1}');
		expect(def.inputAlphabet).toBe('{a, b}');
		expect(def.stackAlphabet).toBe('{A}');
		expect(def.start).toBe('q0');
		expect(def.accepting).toBe('{q1}');
		expect(def.transitions).toEqual([
			'((q0, a, ε), (q0, A))',
			'((q0, b, A), (q1, ε))',
			'((q1, b, A), (q1, ε))'
		]);

		expect(pdaDefinitionText(docF)).toBe(
			[
				'M = (K, Σ, Γ, Δ, s, A)',
				'K = {q0, q1}',
				'Σ = {a, b}',
				'Γ = {A}',
				's = q0',
				'A = {q1}',
				'((q0, a, ε), (q0, A))',
				'((q0, b, A), (q1, ε))',
				'((q1, b, A), (q1, ε))'
			].join('\n')
		);
	});

	it('shows s = – and empty sets when state or start is missing', () => {
		const emptyDoc = createPdaDocument('ndpda');
		const def = pdaDefinitionOf(emptyDoc);

		expect(def.states).toBe('{}');
		expect(def.inputAlphabet).toBe('{}');
		expect(def.stackAlphabet).toBe('{}');
		expect(def.start).toBeNull();
		expect(def.accepting).toBe('{}');
		expect(def.transitions).toEqual([]);

		expect(pdaDefinitionText(emptyDoc)).toBe(
			['M = (K, Σ, Γ, Δ, s, A)', 'K = {}', 'Σ = {}', 'Γ = {}', 's = –', 'A = {}'].join('\n')
		);
	});
});
