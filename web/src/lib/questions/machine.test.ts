import { describe, expect, it } from 'vitest';
import { buildMachine } from './machine.ts';
import type { SolutionMachine } from './types.ts';

const build = (solution: SolutionMachine, alphabet = ['0', '1'], kind: 'dfsm' | 'ndfsm' = 'dfsm') =>
	buildMachine(solution, alphabet, kind);

const ok = (solution: SolutionMachine, alphabet?: string[], kind?: 'dfsm' | 'ndfsm') => {
	const result = build(solution, alphabet, kind);
	if (!result.ok) throw new Error(JSON.stringify(result.problems));
	return result.value;
};

const problems = (solution: SolutionMachine, alphabet?: string[], kind?: 'dfsm' | 'ndfsm') => {
	const result = build(solution, alphabet, kind);
	if (result.ok) throw new Error('expected problems');
	return result.problems;
};

describe('a machine in the short form', () => {
	it('gives the states numbers in the order of first mention: start, accepting, transitions', () => {
		const { machine, names } = ok({
			start: 'b',
			accepting: ['c'],
			transitions: ['a 0 b', 'b 1 c']
		});
		expect(names).toEqual(['b', 'c', 'a']);
		expect(machine.start).toBe(0);
		expect(machine.accepting).toEqual([1]);
		expect(machine.states).toEqual([0, 1, 2]);
		expect(machine.transitions).toContainEqual({ from: 2, on: '0', to: 0 });
		expect(machine.transitions).toContainEqual({ from: 0, on: '1', to: 1 });
	});

	it('takes the order of the states list when there is one, and keeps a state with no transition', () => {
		const { machine, names } = ok({
			states: ['q0', 'q1', 'q2'],
			start: 'q0',
			accepting: ['q1'],
			transitions: ['q0 0 q1']
		});
		expect(names).toEqual(['q0', 'q1', 'q2']);
		expect(machine.states).toEqual([0, 1, 2]);
	});

	it('has the alphabet of the question, the kind that is asked for and schema version 1', () => {
		const { machine } = ok(
			{ start: 'a', accepting: [], transitions: ['a 0 a'] },
			['0', '1', '2'],
			'ndfsm'
		);
		expect(machine.alphabet).toEqual(['0', '1', '2']);
		expect(machine.kind).toBe('ndfsm');
		expect(machine.schemaVersion).toBe(1);
	});

	it('writes ε as ε or eps, and only in the place of the symbol', () => {
		const { machine } = ok(
			{ start: 'a', accepting: [], transitions: ['a ε b', 'a eps eps', 'eps 0 a'] },
			['0'],
			'ndfsm'
		);
		expect(machine.transitions.filter((t) => t.on === null)).toHaveLength(2);
		// A state may be called eps. It is a state when it is not in the place of the symbol.
		expect(machine.states).toHaveLength(3); // a, b and the state called eps
	});

	it('spreads a list of symbols into one transition each', () => {
		const { machine } = ok(
			{ start: 'a', accepting: [], transitions: ['a 0,1 b', 'b ε,0 a'] },
			['0', '1'],
			'ndfsm'
		);
		expect(machine.transitions).toHaveLength(4);
		expect(
			machine.transitions
				.filter((t) => t.from === 0 && t.to === 1)
				.map((t) => t.on)
				.sort()
		).toEqual(['0', '1']);
	});

	it('allows any amount of space between the three parts', () => {
		const { machine } = ok({ start: 'a', accepting: [], transitions: ['  a \t 0   b  '] });
		expect(machine.transitions).toEqual([{ from: 0, on: '0', to: 1 }]);
	});

	it('is the same for the same input', () => {
		const spec = { start: 'q0', accepting: ['q2'], transitions: ['q0 0 q1', 'q1 1 q2', 'q2 0 q0'] };
		expect(JSON.stringify(ok(spec))).toBe(JSON.stringify(ok(spec)));
	});
});

describe('a machine in the short form that is wrong', () => {
	it('says which transition does not have three parts', () => {
		const found = problems({ start: 'a', accepting: [], transitions: ['a 0 a', 'a b'] });
		expect(found).toEqual([
			{
				path: 'solution.transitions[1]',
				message: 'write "from symbol to", for example "q0 0 q1"; found "a b"'
			}
		]);
		expect(problems({ start: 'a', accepting: [], transitions: ['a 0 b c'] })[0]!.path).toBe(
			'solution.transitions[0]'
		);
	});

	it('says which symbol is not in the alphabet, and which symbols are', () => {
		const [problem] = problems({ start: 'a', accepting: [], transitions: ['a 2 a'] });
		expect(problem).toEqual({
			path: 'solution.transitions[0]',
			message: 'the symbol "2" is not in the alphabet (0, 1)'
		});
	});

	it('refuses an empty part in a list of symbols', () => {
		const [problem] = problems({ start: 'a', accepting: [], transitions: ['a 0,,1 a'] });
		expect(problem!.path).toBe('solution.transitions[0]');
		expect(problem!.message).toContain('empty');
	});

	it('refuses the same transition twice, also through a list', () => {
		const first = problems({ start: 'a', accepting: [], transitions: ['a 0 b', 'a 0 b'] });
		expect(first[0]).toMatchObject({ path: 'solution.transitions[1]' });
		expect(first[0]!.message).toContain('twice');
		const second = problems({ start: 'a', accepting: [], transitions: ['a 0,0 b'] });
		expect(second[0]!.message).toContain('twice');
	});

	it('says which state is not in the list of states, in each field', () => {
		const spec = {
			states: ['q0', 'q1'],
			start: 'q9',
			accepting: ['q1', 'q8'],
			transitions: ['q0 0 q1', 'q0 1 q7']
		};
		const found = problems(spec);
		expect(found.map((p) => p.path).sort()).toEqual([
			'solution.accepting[1]',
			'solution.start',
			'solution.transitions[1]'
		]);
		expect(found[0]!.message).toContain('is not in "states"');
	});

	it('reports every problem, not only the first', () => {
		expect(
			problems({ start: 'a', accepting: [], transitions: ['a 2 a', 'oops', 'a 0,,1 a'] })
		).toHaveLength(3);
	});
});
