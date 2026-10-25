// A question for the tests: a DFSM for the strings that end with 10, written as a file.
export const BASE = `schemaVersion: 1
id: berakhiran-10
title:
  id: String yang diakhiri 10
  en: Strings that end with 10
statement:
  id: Buat DFSM atas alfabet \`Σ = {0, 1}\` yang menerima string yang diakhiri \`10\`.
type: build-dfsm
alphabet: [0, 1]
difficulty: 1
week: 1
pattern: berakhiran-x
examples:
  accept: [10, 0110]
  reject: ["", 01]
solution:
  start: q0
  accepting: [q2]
  transitions:
    - q0 0 q0
    - q0 1 q1
    - q1 0 q2
    - q1 1 q1
    - q2 0 q0
    - q2 1 q1
`;

import type { Question } from './types.ts';

/** Every field of a DFSM question, so that the schema and the types can be checked against each other. */
export const KITCHEN_SINK_DFSM = {
	schemaVersion: 1,
	id: 'berakhiran-10',
	title: { id: 'String yang diakhiri 10', en: 'Strings that end with 10' },
	statement: {
		id: 'Buat DFSM yang menerima string yang diakhiri `10`.',
		en: 'Build a DFSM that accepts the strings that end with `10`.'
	},
	type: 'build-dfsm',
	alphabet: ['0', '1'],
	constraints: { maxStates: 3, complete: true, minimal: true },
	difficulty: 1,
	week: 1,
	pattern: 'berakhiran-x',
	references: { rich: ['5.2'], sipser: ['1.1'] },
	hints: [
		{
			id: 'State cukup mengingat dua simbol terakhir.',
			en: 'A state only remembers the last two symbols.'
		}
	],
	examples: { accept: ['10', '0110'], reject: ['', '01'] },
	solution: {
		states: ['q0', 'q1', 'q2'],
		start: 'q0',
		accepting: ['q2'],
		transitions: ['q0 0 q0', 'q0 1 q1', 'q1 0 q2', 'q1 1 q1', 'q2 0 q0', 'q2 1 q1']
	}
} satisfies Question;

/** Every field of an NDFSM question that the DFSM one cannot have (allowEpsilon). */
export const KITCHEN_SINK_NDFSM = {
	...KITCHEN_SINK_DFSM,
	id: 'berakhiran-10-ndfsm',
	type: 'build-ndfsm',
	constraints: { maxStates: 4, allowEpsilon: true },
	examples: { accept: ['10', '110'], reject: ['', '1'] },
	solution: { start: 'a', accepting: ['c'], transitions: ['a 0,1 a', 'a 1 b', 'b 0 c'] }
} satisfies Question;
