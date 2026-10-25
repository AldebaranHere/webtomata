// A short way to describe a machine, and the sample that the Sandbox shows until the editor exists
// (X1 will replace it with the examples of the first-run screen).
import { applyCommand } from '../commands.ts';
import type { Command } from '../commands.ts';
import { createDocument } from '../document.ts';
import type { MachineDocument } from '../document.ts';

export interface Spec {
	title?: string;
	alphabet?: string[];
	/** One entry per state: [x, y] or [x, y, name]. Ids are 0, 1, 2, ... in this order. */
	states: ([number, number] | [number, number, string])[];
	start?: number;
	accepting?: number[];
	/** [from, symbol or null for ε, to] */
	transitions?: [number, string | null, number][];
}

/** Makes a document from a short description. A command that is refused throws. */
export function documentFrom(spec: Spec): MachineDocument {
	const commands: Command[] = [];
	if (spec.title !== undefined) commands.push({ type: 'setTitle', title: spec.title });
	for (const symbol of spec.alphabet ?? []) commands.push({ type: 'addSymbol', symbol });
	for (const [x, y, name] of spec.states) {
		commands.push(
			name === undefined ? { type: 'addState', x, y } : { type: 'addState', x, y, name }
		);
	}
	if (spec.start !== undefined) commands.push({ type: 'setStart', id: spec.start });
	for (const id of spec.accepting ?? [])
		commands.push({ type: 'setAccepting', id, accepting: true });
	for (const [from, on, to] of spec.transitions ?? []) {
		commands.push({ type: 'addTransition', from, on, to });
	}
	const result = applyCommand(createDocument(), { type: 'batch', commands });
	if (!result.ok) throw new Error(`documentFrom: ${result.error.key}`);
	return result.doc;
}

/** "Berakhiran 01" of the wireframes: strings that end with 01. q2 goes back to q0 past q1. */
export const endsWith01 = (title = 'Berakhiran 01') =>
	documentFrom({
		title,
		alphabet: ['0', '1'],
		states: [
			[160, 200, 'q0'],
			[380, 200, 'q1'],
			[600, 200, 'q2']
		],
		start: 0,
		accepting: [2],
		transitions: [
			[0, '1', 0],
			[0, '0', 1],
			[1, '0', 1],
			[1, '1', 2],
			[2, '0', 1],
			[2, '1', 0]
		]
	});
