// The three first-run PDA example documents (F1, F2, F3 of T-033), built through `applyPdaCommand`
// with hand-chosen state positions and Indonesian titles.
import { applyPdaCommand } from './pda-commands.ts';
import type { PdaCommand } from './pda-commands.ts';
import { createPdaDocument } from './pda-document.ts';
import type { PdaDocument, PdaKind } from './pda-document.ts';

export interface PdaSpec {
	title?: string;
	kind?: PdaKind;
	inputAlphabet?: string[];
	stackAlphabet?: string[];
	/** One entry per state: [x, y] or [x, y, name]. Ids are 0, 1, 2, ... in this order. */
	states: ([number, number] | [number, number, string])[];
	start?: number;
	accepting?: number[];
	/** [from, read (null for ε), pop, push, to] */
	transitions?: [number, string | null, string[], string[], number][];
}

/** Builds a `PdaDocument` from a concise specification. Throws if any command is refused. */
export function pdaDocumentFrom(spec: PdaSpec): PdaDocument {
	const commands: PdaCommand[] = [];
	if (spec.title !== undefined) commands.push({ type: 'setTitle', title: spec.title });
	if (spec.kind !== undefined) commands.push({ type: 'setKind', kind: spec.kind });
	for (const symbol of spec.inputAlphabet ?? []) {
		commands.push({ type: 'addInputSymbol', symbol });
	}
	for (const symbol of spec.stackAlphabet ?? []) {
		commands.push({ type: 'addStackSymbol', symbol });
	}
	for (const [x, y, name] of spec.states) {
		commands.push(
			name === undefined ? { type: 'addState', x, y } : { type: 'addState', x, y, name }
		);
	}
	if (spec.start !== undefined) commands.push({ type: 'setStart', id: spec.start });
	for (const id of spec.accepting ?? []) {
		commands.push({ type: 'setAccepting', id, accepting: true });
	}
	for (const [from, read, pop, push, to] of spec.transitions ?? []) {
		commands.push({ type: 'addTransition', from, read, pop, push, to });
	}
	const result = applyPdaCommand(createPdaDocument(spec.kind ?? 'ndpda'), {
		type: 'batch',
		commands
	});
	if (!result.ok) throw new Error(`pdaDocumentFrom: ${result.error.key}`);
	return result.doc;
}

/** F1: aⁿbⁿ with n ≥ 1 (DPDA). */
export const anbnSample = (title = 'aⁿbⁿ (n ≥ 1)'): PdaDocument =>
	pdaDocumentFrom({
		title,
		kind: 'dpda',
		inputAlphabet: ['a', 'b'],
		stackAlphabet: ['A'],
		states: [
			[180, 200, 'q0'],
			[440, 200, 'q1']
		],
		start: 0,
		accepting: [1],
		transitions: [
			[0, 'a', [], ['A'], 0],
			[0, 'b', ['A'], [], 1],
			[1, 'b', ['A'], [], 1]
		]
	});

/** F2: wcwᴿ with w ∈ {a,b}* (DPDA). */
export const wcwrSample = (title = 'wcwᴿ (palindrom dengan penanda tengah)'): PdaDocument =>
	pdaDocumentFrom({
		title,
		kind: 'dpda',
		inputAlphabet: ['a', 'b', 'c'],
		stackAlphabet: ['A', 'B'],
		states: [
			[180, 200, 'q0'],
			[440, 200, 'q1']
		],
		start: 0,
		accepting: [1],
		transitions: [
			[0, 'a', [], ['A'], 0],
			[0, 'b', [], ['B'], 0],
			[0, 'c', [], [], 1],
			[1, 'a', ['A'], [], 1],
			[1, 'b', ['B'], [], 1]
		]
	});

/** F3: wwᴿ, even palindromes over {a,b} (NDPDA). */
export const wwrSample = (title = 'wwᴿ (palindrom panjang genap)'): PdaDocument =>
	pdaDocumentFrom({
		title,
		kind: 'ndpda',
		inputAlphabet: ['a', 'b'],
		stackAlphabet: ['A', 'B'],
		states: [
			[180, 200, 'q0'],
			[440, 200, 'q1']
		],
		start: 0,
		accepting: [1],
		transitions: [
			[0, null, [], [], 1],
			[0, 'a', [], ['A'], 0],
			[0, 'b', [], ['B'], 0],
			[1, 'a', ['A'], [], 1],
			[1, 'b', ['B'], [], 1]
		]
	});

export const PDA_SAMPLES: readonly PdaDocument[] = Object.freeze([
	anbnSample(),
	wcwrSample(),
	wwrSample()
]);
