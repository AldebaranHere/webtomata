import { describe, expect, it } from 'vitest';
import { createPdaDocument } from './pda-document.ts';
import type { PdaDocument } from './pda-document.ts';
import { applyPdaCommand } from './pda-commands.ts';
import { pdaTableOf } from './pda-table.ts';

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
	// Transitions: row 1 (q0, a, ε -> A, q0), row 2 (q0, b, A -> ε, q1), row 3 (q1, b, A -> ε, q1)
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

describe('pdaTableOf', () => {
	it('F1: returns rows in doc.transitions order with Dari, Baca, Pop, Push, Ke', () => {
		const docF = buildMachineF();
		const table = pdaTableOf(docF);

		expect(table.rows).toEqual([
			{
				index: 0,
				from: 0,
				fromName: 'q0',
				read: 'a',
				pop: 'ε',
				push: 'A',
				to: 0,
				toName: 'q0'
			},
			{
				index: 1,
				from: 0,
				fromName: 'q0',
				read: 'b',
				pop: 'A',
				push: 'ε',
				to: 1,
				toName: 'q1'
			},
			{
				index: 2,
				from: 1,
				fromName: 'q1',
				read: 'b',
				pop: 'A',
				push: 'ε',
				to: 1,
				toName: 'q1'
			}
		]);
	});

	it('F1 with Z0: multi-character symbol uses space separator and ε-read comes first for q1', () => {
		let doc = buildMachineF();
		doc = apply(doc, { type: 'addStackSymbol', symbol: 'Z0' });
		doc = apply(doc, {
			type: 'addTransition',
			from: 1,
			read: null,
			pop: ['Z0'],
			push: ['A', 'Z0'],
			to: 1
		});

		const table = pdaTableOf(doc);
		expect(table.rows.length).toBe(4);

		// The new transition on q1 has read ε, so it sorts BEFORE q1's transition on 'b'
		expect(table.rows[2]).toEqual({
			index: 2,
			from: 1,
			fromName: 'q1',
			read: 'ε',
			pop: 'Z0',
			push: 'A Z0',
			to: 1,
			toName: 'q1'
		});
		expect(table.rows[3]).toEqual({
			index: 3,
			from: 1,
			fromName: 'q1',
			read: 'b',
			pop: 'A',
			push: 'ε',
			to: 1,
			toName: 'q1'
		});
	});

	it('returns an empty list of rows for a machine with no transitions', () => {
		const emptyDoc = createPdaDocument('ndpda');
		expect(pdaTableOf(emptyDoc).rows).toEqual([]);
	});
});
