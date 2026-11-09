// U and R of T-061: the pure part of the editable PDA table, and the texts that the table's
// refusals need (docs/agent/PLAN.md, Task T-061). The fixtures F1 to F6 are derived by hand in the
// plan and checked here against the real commands.
import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en.ts';
import { id } from '../i18n/id.ts';
import type { MessageKey } from '../i18n/id.ts';
import { pdaEn, pdaId } from '../i18n/pda-messages.ts';
import type { Refusal } from './interaction/editor.ts';
import { applyPdaCommand } from './pda-commands.ts';
import type { PdaCommand } from './pda-commands.ts';
import { comparePdaTransitions } from './pda-document.ts';
import type { PdaDocument } from './pda-document.ts';
import { pdaDocumentFrom } from './pda-samples.ts';
import {
	addStateCommand,
	draftCommand,
	editRowCommand,
	stateUseCount,
	symbolNameRefusal,
	symbolUseCount
} from './pda-table-edit.ts';
import type { RowFields } from './pda-table-edit.ts';

/** Machine F of the plan: Σ {a, b}, Γ {A}, q0 start, q1 accepting, three transitions. */
function machineF(): PdaDocument {
	return pdaDocumentFrom({
		kind: 'dpda',
		inputAlphabet: ['a', 'b'],
		stackAlphabet: ['A'],
		states: [
			[100, 100, 'q0'],
			[300, 100, 'q1']
		],
		start: 0,
		accepting: [1],
		transitions: [
			[0, 'a', [], ['A'], 0],
			[0, 'b', ['A'], [], 1],
			[1, 'b', ['A'], [], 1]
		]
	});
}

/** Machine H: F plus (q1, a, ε → A, q1). */
function machineH(): PdaDocument {
	return pdaDocumentFrom({
		kind: 'dpda',
		inputAlphabet: ['a', 'b'],
		stackAlphabet: ['A'],
		states: [
			[100, 100, 'q0'],
			[300, 100, 'q1']
		],
		start: 0,
		accepting: [1],
		transitions: [
			[0, 'a', [], ['A'], 0],
			[0, 'b', ['A'], [], 1],
			[1, 'a', [], ['A'], 1],
			[1, 'b', ['A'], [], 1]
		]
	});
}

const fields = (change: Partial<RowFields> = {}): RowFields => ({
	from: 0,
	to: 0,
	read: 'ε',
	pop: 'ε',
	push: 'ε',
	...change
});

function asCommand(value: PdaCommand | Refusal | null): PdaCommand {
	if (value === null || 'key' in value) {
		throw new Error(`expected a command, got ${JSON.stringify(value)}`);
	}
	return value;
}

function asRefusal(value: PdaCommand | Refusal | null): Refusal {
	if (value === null || 'type' in value) {
		throw new Error(`expected a refusal, got ${JSON.stringify(value)}`);
	}
	return value;
}

function applied(doc: PdaDocument, command: PdaCommand): PdaDocument {
	const result = applyPdaCommand(doc, command);
	if (!result.ok) throw new Error(`the document refused: ${result.error.key}`);
	return result.doc;
}

const rowText = (doc: PdaDocument) =>
	doc.transitions.map((t) => `${t.from}|${t.read ?? 'ε'}|[${t.pop}]|[${t.push}]|${t.to}`);

describe('U: the commands of the editable table', () => {
	it('F1: Push A -> AA on row 1 is one batch of remove and add, with no new symbol', () => {
		const doc = machineF();
		const command = asCommand(editRowCommand(doc, 0, fields({ read: 'a', push: 'AA' })));

		expect(command).toEqual({
			type: 'batch',
			commands: [
				{ type: 'removeTransition', from: 0, read: 'a', pop: [], push: ['A'], to: 0 },
				{ type: 'addTransition', from: 0, read: 'a', pop: [], push: ['A', 'A'], to: 0 }
			]
		});

		const after = applied(doc, command);
		expect(after.stackAlphabet).toEqual(['A']);
		expect(after.transitions).toHaveLength(3);
		expect(rowText(after)).toEqual(['0|a|[]|[A,A]|0', '0|b|[A]|[]|1', '1|b|[A]|[]|1']);
	});

	it('F2: a row that would equal row 2 is refused with its number, and nothing changes', () => {
		const doc = machineF();
		const refusal = asRefusal(
			editRowCommand(doc, 0, fields({ from: 0, to: 1, read: 'b', pop: 'A' }))
		);

		expect(refusal).toEqual({ key: 'pda_editor.row_duplicate', params: { n: 2 } });
		// The document is untouched: the module returned no command at all.
		expect(rowText(doc)).toEqual(['0|a|[]|[A]|0', '0|b|[A]|[]|1', '1|b|[A]|[]|1']);
	});

	it('F3: Push AB on row 3 is addStackSymbol(B), remove, then add — one batch', () => {
		const doc = machineF();
		const command = asCommand(
			editRowCommand(doc, 2, fields({ from: 1, to: 1, read: 'b', pop: 'A', push: 'AB' }))
		);

		expect(command).toEqual({
			type: 'batch',
			commands: [
				{ type: 'addStackSymbol', symbol: 'B' },
				{ type: 'removeTransition', from: 1, read: 'b', pop: ['A'], push: [], to: 1 },
				{ type: 'addTransition', from: 1, read: 'b', pop: ['A'], push: ['A', 'B'], to: 1 }
			]
		});

		const after = applied(doc, command);
		expect(after.stackAlphabet).toEqual(['A', 'B']);
		expect(rowText(after)[2]).toBe('1|b|[A]|[A,B]|1');
	});

	it('F4: the edited row moves to row 2 of H, in the engine order', () => {
		const doc = machineH();
		const command = asCommand(
			editRowCommand(doc, 0, fields({ from: 1, to: 0, read: 'a', push: 'A' }))
		);
		const after = applied(doc, command);

		expect(rowText(after)).toEqual([
			'0|b|[A]|[]|1',
			'1|a|[]|[A]|0',
			'1|a|[]|[A]|1',
			'1|b|[A]|[]|1'
		]);
		// The document keeps the engine's order, so the table needs no sort of its own.
		const sorted = [...after.transitions].sort((a, b) =>
			comparePdaTransitions(after.inputAlphabet, after.stackAlphabet, a, b)
		);
		expect(after.transitions).toEqual(sorted);
	});

	it('F5: the counts of the toast, and what removing a state really takes', () => {
		const doc = machineF();

		expect(symbolUseCount(doc, 'b', 'input')).toBe(2);
		expect(symbolUseCount(doc, 'A', 'stack')).toBe(3);
		expect(symbolUseCount(doc, 'a', 'stack')).toBe(0);
		expect(stateUseCount(doc, 0)).toBe(2);
		expect(stateUseCount(doc, 1)).toBe(2);

		const noQ0 = applied(doc, { type: 'removeState', id: 0 });
		expect(doc.transitions.length - noQ0.transitions.length).toBe(stateUseCount(doc, 0));
		expect(noQ0.start).toBe(null);

		const noB = applied(doc, { type: 'removeInputSymbol', symbol: 'b' });
		expect(doc.transitions.length - noB.transitions.length).toBe(2);

		const noA = applied(doc, { type: 'removeStackSymbol', symbol: 'A' });
		expect(doc.transitions.length - noA.transitions.length).toBe(3);
	});

	it('F6: a complete draft is one addTransition, and it lands at row 1', () => {
		const doc = machineF();
		const command = asCommand(
			draftCommand(doc, fields({ from: 0, to: 1, read: 'ε', pop: '', push: '' }))
		);

		expect(command).toEqual({
			type: 'addTransition',
			from: 0,
			read: null,
			pop: [],
			push: [],
			to: 1
		});

		const after = applied(doc, command);
		expect(rowText(after)[0]).toBe('0|ε|[]|[]|1');
		expect(after.transitions).toHaveLength(4);
	});

	it('a row that changes nothing gives null', () => {
		const doc = machineF();
		expect(editRowCommand(doc, 0, fields({ read: 'a', push: 'A' }))).toBe(null);
		expect(editRowCommand(doc, 2, fields({ from: 1, to: 1, read: 'b', pop: 'A' }))).toBe(null);
		// ε and an empty field mean the same thing, so this is not a change either.
		expect(editRowCommand(doc, 1, fields({ to: 1, read: 'b', pop: 'A', push: '' }))).toBe(null);
	});

	it('an index that is not in the table gives null, not a crash', () => {
		const doc = machineF();
		expect(editRowCommand(doc, 3, fields({ read: 'a', push: 'A' }))).toBe(null);
		expect(editRowCommand(doc, -1, fields({ read: 'a', push: 'A' }))).toBe(null);
	});

	it('a draft with one of the two states, or with neither, sends nothing', () => {
		const doc = machineF();
		expect(draftCommand(doc, fields({ from: 0, to: null }))).toBe(null);
		expect(draftCommand(doc, fields({ from: null, to: 1 }))).toBe(null);
		expect(draftCommand(doc, fields({ from: null, to: null }))).toBe(null);
	});

	it('a draft with a new stack symbol sends the batch with addStackSymbol first', () => {
		const doc = machineF();
		const command = asCommand(
			draftCommand(doc, fields({ from: 0, to: 1, read: 'ε', pop: '', push: 'B' }))
		);

		expect(command).toEqual({
			type: 'batch',
			commands: [
				{ type: 'addStackSymbol', symbol: 'B' },
				{ type: 'addTransition', from: 0, read: null, pop: [], push: ['B'], to: 1 }
			]
		});
		expect(applied(doc, command).stackAlphabet).toEqual(['A', 'B']);
	});

	it('a draft that would be a row already in the table is refused, not added twice', () => {
		const doc = machineF();
		const refusal = asRefusal(draftCommand(doc, fields({ from: 0, to: 0, read: 'a', push: 'A' })));
		expect(refusal).toEqual({ key: 'pda_editor.row_duplicate', params: { n: 1 } });
	});

	it('a new state never lands on another one, and the empty document starts at 200, 200', () => {
		expect(addStateCommand(pdaDocumentFrom({ states: [] }))).toEqual({
			type: 'addState',
			x: 200,
			y: 200
		});

		const doc = machineF();
		const command = addStateCommand(doc);
		expect(command.type).toBe('addState');
		const after = applied(doc, command);
		expect(after.states).toHaveLength(3);
		const added = after.states[after.states.length - 1]!;
		for (const state of doc.states) {
			expect(Math.hypot(state.x - added.x, state.y - added.y)).toBeGreaterThanOrEqual(72);
		}
	});

	it('a name that the label form would read as ε, or that cannot be typed, is refused', () => {
		for (const name of ['eps', 'ε', 'a b', 'a,b', ' eps ', 'a\tb']) {
			expect(asRefusal(symbolNameRefusal(name)), `name ${JSON.stringify(name)}`).toEqual({
				key: 'pda_editor.symbol_reserved',
				params: {}
			});
		}
		for (const name of ['c', 'eps2', 'EPS', 'A2', '']) {
			expect(symbolNameRefusal(name), `name ${JSON.stringify(name)}`).toBe(null);
		}
	});
});

const parameters = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();

/** The text of a key in one dictionary, or undefined when that dictionary does not have it. */
function textOf(dictionary: object, key: MessageKey): string | undefined {
	// One cast: the dictionaries are read by a key of the union of both, which a literal object type
	// cannot check. `Object.hasOwn` is not needed because an absent key gives undefined.
	const value = (dictionary as Record<string, string | undefined>)[key];
	return typeof value === 'string' ? value : undefined;
}

// Every key that a refusal or an announcement of the three blocks can put on the screen.
const TABLE_KEYS: readonly MessageKey[] = [
	// refusals of the document and of the table
	'document.invalid_symbol',
	'document.duplicate_symbol',
	'document.invalid_name',
	'document.duplicate_name',
	'document.limit_exceeded',
	'pda_document.string_too_long',
	'pda_document.unknown_symbol',
	'pda_editor.row_duplicate',
	'pda_editor.symbol_reserved',
	// labels and sentences of the three blocks
	'pda_editor.alphabet_input',
	'pda_editor.alphabet_stack',
	'pda_editor.add_transition',
	'pda_editor.state_delete',
	'pda_editor.field_label',
	'pda_editor.row_delete',
	'pda_editor.col_from',
	'pda_editor.col_read',
	'pda_editor.col_pop',
	'pda_editor.col_push',
	'pda_editor.col_to',
	'pda_editor.table_title',
	'pda_editor.table_empty',
	'table.state',
	'table.start',
	'table.accepting',
	'table.start_toggle',
	'table.accepting_toggle',
	'table.rename',
	'table.add_state',
	'table.symbol_field',
	'table.symbol_add',
	'table.remove_symbol',
	// announcements and the toasts with Urungkan
	'table.state_added',
	'table.symbol_added',
	'table.symbol_removed',
	'pda_editor.state_removed',
	'pda_editor.row_added',
	'pda_editor.row_changed',
	'pda_editor.row_removed',
	'editor.start_set',
	'editor.accepting_on',
	'editor.accepting_off',
	'editor.renamed'
];

describe('R: every text that the table can show exists in both languages', () => {
	it('R1: each key has an Indonesian and an English text, in the shared dictionary or the PDA one', () => {
		for (const key of TABLE_KEYS) {
			const indonesian = textOf(id, key) ?? textOf(pdaId, key);
			const english = textOf(en, key) ?? textOf(pdaEn, key);
			expect(indonesian, `id: ${key}`).toBeDefined();
			expect(english, `en: ${key}`).toBeDefined();
			expect(indonesian!.trim(), `id: ${key}`).not.toBe('');
			expect(english!.trim(), `en: ${key}`).not.toBe('');
		}
	});

	it('R2: both languages take the same parameters, so one call fills both', () => {
		for (const key of TABLE_KEYS) {
			const indonesian = textOf(id, key) ?? textOf(pdaId, key);
			const english = textOf(en, key) ?? textOf(pdaEn, key);
			expect(parameters(english!), `en: ${key}`).toEqual(parameters(indonesian!));
		}
	});

	it('R3: the new keys of this task are in the PDA module only', () => {
		for (const key of [
			'pda_editor.alphabet_input',
			'pda_editor.alphabet_stack',
			'pda_editor.add_transition',
			'pda_editor.state_delete',
			'pda_editor.state_removed',
			'pda_editor.row_duplicate',
			'pda_editor.row_added',
			'pda_editor.row_changed',
			'pda_editor.row_removed',
			'pda_editor.symbol_reserved',
			'document.duplicate_symbol'
		] as const) {
			expect(Object.hasOwn(pdaId, key), `pdaId: ${key}`).toBe(true);
			expect(Object.hasOwn(pdaEn, key), `pdaEn: ${key}`).toBe(true);
			expect(Object.hasOwn(id, key), `id: ${key}`).toBe(false);
			expect(Object.hasOwn(en, key), `en: ${key}`).toBe(false);
		}
	});
});
