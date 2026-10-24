// Turns a machine in the short form (see SolutionMachine in types.ts) into a machine of the
// engine, with the names of the states, so that a problem can name a state by its name.
//
//   transitions:
//     - q0 0 q1        from, symbol, to
//     - q1 0,1 q2      a list of symbols is one transition for each
//     - q2 ε q0        ε is ε or eps (in the place of the symbol only)
//
// The states get their numbers in the order of `states` if it is there, and else in the order in
// which they are first mentioned: the start state, the accepting states, then the transitions.
import type { Machine } from '../engine/types.ts';
import type { Problem, SolutionMachine } from './types.ts';

export interface BuiltMachine {
	machine: Machine;
	/** The name of each state; `names[id]` is the name of the state with that number. */
	names: string[];
}

export type BuildResult = { ok: true; value: BuiltMachine } | { ok: false; problems: Problem[] };

const EPSILON = new Set(['ε', 'eps']);

export function buildMachine(
	solution: SolutionMachine,
	alphabet: string[],
	kind: 'dfsm' | 'ndfsm'
): BuildResult {
	const problems: Problem[] = [];
	const declared = solution.states !== undefined;
	const names: string[] = [];
	const idOf = new Map<string, number>();

	const add = (name: string) => {
		if (!idOf.has(name)) {
			idOf.set(name, names.length);
			names.push(name);
		}
	};
	for (const name of solution.states ?? []) add(name);

	/** The number of a state. With a list of states, a name that is not in it is a problem. */
	const stateId = (name: string, path: string): number | undefined => {
		if (!idOf.has(name)) {
			if (declared) {
				problems.push({ path, message: `the state "${name}" is not in "states"` });
				return undefined;
			}
			add(name);
		}
		return idOf.get(name);
	};

	const start = stateId(solution.start, 'solution.start');
	const accepting = solution.accepting
		.map((name, i) => stateId(name, `solution.accepting[${i}]`))
		.filter((id): id is number => id !== undefined);

	const symbols = new Set(alphabet);
	const seen = new Set<string>();
	const transitions: Machine['transitions'] = [];
	solution.transitions.forEach((text, i) => {
		const path = `solution.transitions[${i}]`;
		const parts = text.trim().split(/\s+/);
		if (parts.length !== 3) {
			problems.push({
				path,
				message: `write "from symbol to", for example "q0 0 q1"; found "${text.trim()}"`
			});
			return;
		}
		const [fromName, list, toName] = parts as [string, string, string];
		const from = stateId(fromName, path);
		const to = stateId(toName, path);
		const each = list.split(',');
		if (each.some((s) => s === '')) {
			problems.push({ path, message: `the list of symbols "${list}" has an empty part` });
			return;
		}
		for (const symbol of each) {
			const on = EPSILON.has(symbol) ? null : symbol;
			if (on !== null && !symbols.has(on)) {
				problems.push({
					path,
					message: `the symbol "${symbol}" is not in the alphabet (${alphabet.join(', ')})`
				});
				continue;
			}
			if (from === undefined || to === undefined) continue;
			const key = `${from}\u0000${on}\u0000${to}`;
			if (seen.has(key)) {
				problems.push({
					path,
					message: `the transition "${fromName} ${symbol} ${toName}" is written twice`
				});
				continue;
			}
			seen.add(key);
			transitions.push({ from, on, to });
		}
	});

	if (problems.length > 0 || start === undefined) return { ok: false, problems };
	return {
		ok: true,
		value: {
			machine: {
				schemaVersion: 1,
				kind,
				alphabet: [...alphabet],
				states: names.map((_, id) => id),
				start,
				accepting: [...new Set(accepting)].sort((a, b) => a - b),
				transitions
			},
			names
		}
	};
}

/** The numbers of the transitions (in `solution.transitions`) that have an ε in them. */
export function epsilonTransitions(solution: SolutionMachine): number[] {
	const found: number[] = [];
	solution.transitions.forEach((text, i) => {
		const parts = text.trim().split(/\s+/);
		if (parts.length === 3 && parts[1]!.split(',').some((s) => EPSILON.has(s))) found.push(i);
	});
	return found;
}
