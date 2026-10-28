// Machines for the tests of the questions, as document files that the page can save as the work of a student
// (the transitions in the order that the engine sorts them). The answer to berakhiran-10 is RIGHT.
export interface Spec {
	kind?: 'dfsm' | 'ndfsm';
	alphabet?: string[];
	states: string[];
	start?: number;
	accepting: number[];
	/** [from, symbol or null, to] */
	transitions: [number, string | null, number][];
}

/** A document file as the page saves it (the transitions in the order that the engine sorts them). */
export function docJson(spec: Spec): string {
	const alphabet = spec.alphabet ?? ['0', '1'];
	const index = (on: string | null) => (on === null ? -1 : alphabet.indexOf(on));
	const transitions = [...spec.transitions]
		.sort((a, b) => a[0] - b[0] || index(a[1]) - index(b[1]) || a[2] - b[2])
		.map(([from, on, to]) => ({ from, on, to }));
	return JSON.stringify({
		schemaVersion: 1,
		title: '',
		kind: spec.kind ?? 'dfsm',
		alphabet,
		states: spec.states.map((name, id) => ({ id, name, x: 100 + 150 * id, y: 120 })),
		start: spec.start ?? 0,
		accepting: spec.accepting,
		transitions,
		nextStateId: spec.states.length
	});
}

// Strings that end with 10, the right answer to berakhiran-10.
export const RIGHT: Spec = {
	states: ['q0', 'q1', 'q2'],
	accepting: [2],
	transitions: [
		[0, '0', 0],
		[0, '1', 1],
		[1, '1', 1],
		[1, '0', 2],
		[2, '1', 1],
		[2, '0', 0]
	]
};
// The same, except that the string "10" itself is rejected: the machines differ on one string.
export const ONE_OFF: Spec = {
	states: ['s', 'b', 'q0', 'q1', 'q2'],
	accepting: [4],
	transitions: [
		[0, '0', 2],
		[0, '1', 1],
		[1, '0', 2],
		[1, '1', 3],
		[2, '0', 2],
		[2, '1', 3],
		[3, '1', 3],
		[3, '0', 4],
		[4, '1', 3],
		[4, '0', 2]
	]
};
// Strings that end with 1: wrong on very many strings.
export const ENDS_WITH_1: Spec = { ...RIGHT, accepting: [1] };
