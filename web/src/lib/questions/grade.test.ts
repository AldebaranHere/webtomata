import { describe, expect, it } from 'vitest';
import { applyCommand } from '../editor/commands.ts';
import { documentFrom } from '../editor/diagram/samples.ts';
import type { MachineDocument } from '../editor/document.ts';
import { message } from '../editor/document.ts';
import type {
	EngineResult,
	EquivalenceReport,
	Issue,
	Machine,
	Minimization,
	SimulationReport
} from '../engine/types.ts';
import { CLOSE_LISTS, CLOSE_WITNESS, grade } from './grade.ts';
import type { GradeEngine, GradeQuestion } from './grade.ts';
import type { SolutionMachine } from './types.ts';

// The solution: strings over {0, 1} that end with 10 (a complete DFSM of three states).
const solution: SolutionMachine = {
	start: 'q0',
	accepting: ['q2'],
	transitions: ['q0 0 q0', 'q0 1 q1', 'q1 1 q1', 'q1 0 q2', 'q2 1 q1', 'q2 0 q0']
};
const question: GradeQuestion = { type: 'build-dfsm', alphabet: ['0', '1'] };

/** A complete DFSM over {0, 1}, with states of the given names, for the student. */
const student = (over: Partial<Parameters<typeof documentFrom>[0]> = {}): MachineDocument =>
	documentFrom({
		alphabet: ['0', '1'],
		states: [
			[0, 0, 'a'],
			[100, 0, 'b'],
			[200, 0, 'c']
		],
		start: 0,
		accepting: [2],
		transitions: [
			[0, '0', 0],
			[0, '1', 1],
			[1, '1', 1],
			[1, '0', 2],
			[2, '1', 1],
			[2, '0', 0]
		],
		...over
	});

/** The same machine, with the kind NDFSM. */
const asNdfsm = (doc: MachineDocument): MachineDocument => {
	const result = applyCommand(doc, { type: 'setKind', kind: 'ndfsm' });
	if (!result.ok) throw new Error(result.error.key);
	return result.doc;
};

/** The grade, which must be a wrong one. */
async function wrongOf(
	report: EngineResult<EquivalenceReport>
): Promise<Extract<Awaited<ReturnType<typeof grade>>, { kind: 'wrong' }>> {
	const result = await grade(question, solution, student(), engineWith({ report }).engine);
	if (result.kind !== 'wrong') throw new Error(`expected a wrong grade, got ${result.kind}`);
	return result;
}

interface Scripted {
	issues?: Issue[];
	minimalStates?: number | 'stopped';
	report?: EngineResult<EquivalenceReport>;
	/** The active states at each step of the run of the shortest wrong string. */
	run?: number[][];
}

/** An engine that answers what the test says, and remembers what it was asked. */
function engineWith(script: Scripted = {}) {
	const calls: string[] = [];
	const engine: GradeEngine = {
		validate: async () => {
			calls.push('validate');
			return { ok: true, value: script.issues ?? [] };
		},
		minimize: async (machine: Machine) => {
			calls.push('minimize');
			if (script.minimalStates === 'stopped') {
				return { ok: true, value: { result: 'stopped', reason: 'max_steps', partialTrace: [] } };
			}
			const n = script.minimalStates ?? machine.states.length;
			return {
				ok: true,
				value: {
					result: 'finished',
					dfsm: { ...machine, states: machine.states.slice(0, n) },
					classes: [],
					trace: []
				} as Minimization
			};
		},
		equivalent: async () => {
			calls.push('equivalent');
			return (
				script.report ?? {
					ok: true,
					value: {
						equivalence: { result: 'equivalent', pairs: 3 },
						witness: null,
						acceptedButShouldReject: [],
						rejectedButShouldAccept: []
					}
				}
			);
		},
		simulate: async (_machine, input) => {
			calls.push(`simulate ${input}`);
			const run = script.run ?? [[0]];
			const value: SimulationReport = {
				input: [...input],
				simulation: {
					result: 'finished',
					accepted: false,
					trace: run.map((states, i) => ({
						position: i,
						symbol: null,
						states,
						message: message('sim.read')
					}))
				}
			};
			return { ok: true, value };
		}
	};
	return { engine, calls };
}

const different = (
	over: Partial<EquivalenceReport> & { listsTruncated?: boolean } = {}
): EngineResult<EquivalenceReport> => ({
	ok: true,
	value: {
		equivalence: {
			result: 'different',
			witness: { string: [], candidateAccepts: false },
			acceptedButShouldReject: [],
			rejectedButShouldAccept: [],
			listsTruncated: over.listsTruncated ?? false,
			trace: []
		},
		witness: ['1', '0'],
		acceptedButShouldReject: [],
		rejectedButShouldAccept: [['1', '0']],
		...over
	}
});

describe('the structure comes first', () => {
	it('stops at a machine with no start state, and does not compare', async () => {
		const { engine, calls } = engineWith({
			issues: [{ severity: 'error', message: message('fsm.no_start_state') }]
		});
		const result = await grade(question, solution, student({ start: undefined }), engine);
		expect(result).toEqual({
			kind: 'structure',
			issues: [{ severity: 'error', message: message('fsm.no_start_state') }]
		});
		expect(calls).not.toContain('equivalent');
	});

	it('passes on the errors of the engine, and leaves out the warnings', async () => {
		const missing = {
			severity: 'error' as const,
			message: message('dfsm.missing_transition', { state: 1, symbol: '0' })
		};
		const unreachable = {
			severity: 'warning' as const,
			message: message('fsm.unreachable_state', { state: 2 })
		};
		const { engine } = engineWith({ issues: [unreachable, missing] });
		const result = await grade(question, solution, student(), engine);
		expect(result).toEqual({ kind: 'structure', issues: [missing] });
	});

	it('does not count a missing transition when the question allows an incomplete DFSM', async () => {
		const missing = {
			severity: 'error' as const,
			message: message('dfsm.missing_transition', { state: 1, symbol: '0' })
		};
		const { engine, calls } = engineWith({ issues: [missing] });
		const result = await grade(
			{ ...question, constraints: { complete: false } },
			solution,
			student(),
			engine
		);
		expect(result.kind).toBe('right');
		expect(calls).toContain('equivalent');
	});

	it('says that a DFSM question needs the kind DFSM', async () => {
		const { engine } = engineWith();
		const result = await grade(question, solution, asNdfsm(student()), engine);
		expect(result).toEqual({
			kind: 'structure',
			issues: [{ severity: 'error', message: message('feedback.need_dfsm') }]
		});
	});

	it('does not mind a DFSM in an NDFSM question: a DFSM is an NDFSM', async () => {
		const { engine } = engineWith();
		const result = await grade({ ...question, type: 'build-ndfsm' }, solution, student(), engine);
		expect(result.kind).toBe('right');
	});

	it('says that there are too many states, with the limit and the number', async () => {
		const { engine, calls } = engineWith();
		const result = await grade(
			{ ...question, constraints: { maxStates: 2 } },
			solution,
			student(),
			engine
		);
		expect(result).toEqual({
			kind: 'structure',
			issues: [
				{ severity: 'error', message: message('feedback.too_many_states', { max: 2, count: 3 }) }
			]
		});
		expect(calls).not.toContain('equivalent');
	});

	it('says that ε-transitions are not allowed, and how many there are', async () => {
		const withEpsilon = asNdfsm(
			student({
				transitions: [
					[0, null, 1],
					[1, null, 2],
					[0, '0', 0]
				]
			})
		);
		const { engine } = engineWith();
		const result = await grade(
			{ type: 'build-ndfsm', alphabet: ['0', '1'], constraints: { allowEpsilon: false } },
			solution,
			withEpsilon,
			engine
		);
		expect(result).toEqual({
			kind: 'structure',
			issues: [
				{ severity: 'error', message: message('feedback.epsilon_not_allowed', { count: 2 }) }
			]
		});
	});

	it('names the symbols that the machine lacks and the ones that the question does not have', async () => {
		const { engine } = engineWith();
		const lacking = await grade(
			question,
			solution,
			student({ alphabet: ['0'], transitions: [[0, '0', 0]] }),
			engine
		);
		expect(lacking).toEqual({
			kind: 'structure',
			issues: [
				{ severity: 'error', message: message('feedback.alphabet_missing', { symbols: '1' }) }
			]
		});
		const extra = await grade(question, solution, student({ alphabet: ['0', '1', '2'] }), engine);
		expect(extra).toEqual({
			kind: 'structure',
			issues: [{ severity: 'error', message: message('feedback.alphabet_extra', { symbols: '2' }) }]
		});
	});

	it('says that a machine is not minimal when the minimal one has fewer states', async () => {
		const { engine } = engineWith({ minimalStates: 2 });
		const result = await grade(
			{ ...question, constraints: { minimal: true } },
			solution,
			student(),
			engine
		);
		expect(result).toEqual({
			kind: 'structure',
			issues: [{ severity: 'error', message: message('feedback.not_minimal') }]
		});
	});

	it('does not ask for the minimal machine when the question does not want one', async () => {
		const { engine, calls } = engineWith();
		await grade(question, solution, student(), engine);
		expect(calls).not.toContain('minimize');
	});

	it('is a stop, not a verdict, when the engine cannot tell whether the machine is minimal', async () => {
		const { engine } = engineWith({ minimalStates: 'stopped' });
		const result = await grade(
			{ ...question, constraints: { minimal: true } },
			solution,
			student(),
			engine
		);
		expect(result).toEqual({ kind: 'stopped', reason: 'max_steps' });
	});

	it('lists every problem of the structure together', async () => {
		const { engine } = engineWith({ minimalStates: 1 });
		const result = await grade(
			{ ...question, constraints: { maxStates: 2, minimal: true } },
			solution,
			asNdfsm(student()),
			engine
		);
		expect(result.kind === 'structure' && result.issues.map((i) => i.message.key)).toEqual([
			'feedback.need_dfsm',
			'feedback.too_many_states'
		]);
	});
});

describe('the verdict', () => {
	it('is right when the machines accept the same strings', async () => {
		const { engine, calls } = engineWith();
		expect(await grade(question, solution, student(), engine)).toEqual({ kind: 'right' });
		expect(calls).toEqual(['validate', 'equivalent']);
	});

	it('is wrong with the shortest string, both lists and the computation of the machine', async () => {
		const { engine, calls } = engineWith({
			report: different({
				acceptedButShouldReject: [['0', '1'], []],
				rejectedButShouldAccept: [
					['1', '0'],
					['0', '1', '1', '0']
				]
			}),
			run: [[0], [1], [0]]
		});
		const result = await grade(question, solution, student(), engine);
		expect(calls).toContain('simulate 10');
		expect(result).toMatchObject({
			kind: 'wrong',
			closeness: 'close',
			witness: { text: '10', input: '10' },
			accepted: [
				{ text: '01', input: '01' },
				{ text: 'ε', input: '' }
			],
			rejected: [
				{ text: '10', input: '10' },
				{ text: '0110', input: '0110' }
			],
			truncated: false,
			computation: {
				rows: [
					{ position: 1, from: ['a'], symbol: '1', to: ['b'] },
					{ position: 2, from: ['b'], symbol: '0', to: ['a'] }
				],
				end: ['a']
			}
		});
	});

	it('is close when the lists are short and the string is short, and far otherwise', async () => {
		const short = different({
			witness: ['1'],
			rejectedButShouldAccept: [['1']]
		});
		expect((await wrongOf(short)).closeness).toBe('close');

		const longWitness = different({
			witness: Array(CLOSE_WITNESS + 1).fill('1'),
			rejectedButShouldAccept: [Array(CLOSE_WITNESS + 1).fill('1')]
		});
		expect((await wrongOf(longWitness)).closeness).toBe('far');

		const manyStrings = different({
			witness: ['1'],
			rejectedButShouldAccept: Array.from({ length: CLOSE_LISTS + 1 }, () => ['1'])
		});
		expect((await wrongOf(manyStrings)).closeness).toBe('far');

		const cut = different({
			witness: ['1'],
			rejectedButShouldAccept: [['1']],
			listsTruncated: true
		});
		expect((await wrongOf(cut)).closeness).toBe('far');
		expect((await wrongOf(cut)).truncated).toBe(true);
	});

	it('writes a string of symbols of several characters with spaces', async () => {
		const many = documentFrom({
			alphabet: ['num', 'plus'],
			states: [[0, 0, 'a']],
			start: 0,
			accepting: [0],
			transitions: [
				[0, 'num', 0],
				[0, 'plus', 0]
			]
		});
		const report = different({
			witness: ['num', 'plus'],
			rejectedButShouldAccept: [['num', 'plus']]
		});
		const { engine, calls } = engineWith({ report });
		const result = await grade(
			{ type: 'build-dfsm', alphabet: ['num', 'plus'] },
			{ start: 'q0', accepting: ['q0'], transitions: ['q0 num q0', 'q0 plus q0'] },
			many,
			engine
		);
		expect(result).toMatchObject({ witness: { text: 'num plus', input: 'num plus' } });
		expect(calls).toContain('simulate num plus');
	});

	it('is a stop when the comparison stops, with the reason', async () => {
		const { engine } = engineWith({
			report: {
				ok: true,
				value: {
					equivalence: { result: 'stopped', reason: 'max_steps' },
					witness: null,
					acceptedButShouldReject: [],
					rejectedButShouldAccept: []
				}
			}
		});
		expect(await grade(question, solution, student(), engine)).toEqual({
			kind: 'stopped',
			reason: 'max_steps'
		});
	});

	it('passes on a call that fails, so that the page can say that the engine did not answer', async () => {
		const { engine } = engineWith();
		engine.equivalent = async () => {
			throw new Error('the worker died');
		};
		await expect(grade(question, solution, student(), engine)).rejects.toThrow('worker died');
	});

	it('is a failure, not a verdict, when the engine refuses the machine or the solution cannot be built', async () => {
		const refusing = engineWith();
		refusing.engine.validate = async () => ({
			ok: false,
			error: message('machine.limit_exceeded', { what: 'states' })
		});
		expect(await grade(question, solution, student(), refusing.engine)).toEqual({
			kind: 'failed',
			error: message('machine.limit_exceeded', { what: 'states' })
		});
		const unusable = { start: 'q0', accepting: ['q9'], states: ['q0'], transitions: [] };
		expect(await grade(question, unusable, student(), engineWith().engine)).toEqual({
			kind: 'failed',
			error: message('feedback.answer_unusable')
		});
	});

	it('is a stop with no computation when the run of the shortest string stops', async () => {
		const { engine } = engineWith({ report: different() });
		engine.simulate = async () => ({
			ok: true,
			value: {
				input: ['1', '0'],
				simulation: { result: 'stopped', reason: 'max_steps', partialTrace: [] }
			}
		});
		const result = await grade(question, solution, student(), engine);
		expect(result).toMatchObject({ kind: 'wrong', computation: null });
	});
});
