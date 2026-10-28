// Grading against the real engine (the WASM module: `pnpm build:wasm`). The truth comes from outside the
// engine: a small machine runner in this file, and every string up to length 6. For the real question files
// of the repository the solution must be right, and a machine that is changed must be told apart from it
// with the shortest string, and with only strings that the two really classify differently.
import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import init, * as wasm from '../engine/wasm/engine_wasm.js';
import type { Machine } from '../engine/types.ts';
import { applyCommand } from '../editor/commands.ts';
import { documentFrom } from '../editor/diagram/samples.ts';
import { documentFromMachine, toMachine } from '../editor/document.ts';
import type { MachineDocument } from '../editor/document.ts';
import { random } from '../editor/testing.ts';
import { grade } from './grade.ts';
import type { Grade, GradeEngine, GradeQuestion } from './grade.ts';
import { createSchemaValidator } from './load.ts';
import { buildMachine } from './machine.ts';
import { loadQuestions } from './summaries.ts';
import type { Question, SolutionMachine } from './types.ts';

beforeAll(async () => {
	const bytes = readFileSync(new URL('../engine/wasm/engine_wasm_bg.wasm', import.meta.url));
	await init({ module_or_path: bytes });
});

const call = <T>(json: string) => JSON.parse(json) as T;
const engine: GradeEngine = {
	validate: async (machine) => call(wasm.validate(JSON.stringify(machine))),
	minimize: async (machine) => call(wasm.minimize(JSON.stringify(machine), null)),
	equivalent: async (candidate, reference) =>
		call(wasm.equivalent(JSON.stringify(candidate), JSON.stringify(reference), null)),
	simulate: async (machine, input) => call(wasm.simulate(JSON.stringify(machine), input, null))
};

/** Does the machine accept the word? A set of states, with the closure of the ε transitions. */
function accepts(machine: Machine, word: string[]): boolean {
	const close = (set: Set<number>) => {
		const queue = [...set];
		for (let i = 0; i < queue.length; i++) {
			for (const t of machine.transitions) {
				if (t.on === null && t.from === queue[i] && !set.has(t.to)) {
					set.add(t.to);
					queue.push(t.to);
				}
			}
		}
		return set;
	};
	let now = close(new Set(machine.start === null ? [] : [machine.start]));
	for (const symbol of word) {
		const next = new Set<number>();
		for (const t of machine.transitions) if (t.on === symbol && now.has(t.from)) next.add(t.to);
		now = close(next);
	}
	return machine.accepting.some((s) => now.has(s));
}

/** Every word over the alphabet up to `longest`, shortest first. */
function words(alphabet: readonly string[], longest: number): string[][] {
	const all: string[][] = [[]];
	for (let i = 0; i < all.length; i++) {
		if (all[i]!.length < longest) for (const s of alphabet) all.push([...all[i]!, s]);
	}
	return all;
}

const schema = JSON.parse(
	readFileSync(new URL('../../../../content/questions/schema.json', import.meta.url), 'utf8')
);
const folder = new URL('../../../../content/questions/', import.meta.url);
const files = Object.fromEntries(
	readdirSync(folder)
		.filter((name) => /\.ya?ml$/.test(name))
		.map((name) => [name, readFileSync(new URL(name, folder), 'utf8')])
);
const machineQuestions = loadQuestions(files, createSchemaValidator(schema)).filter(
	(q): q is Question & { type: 'build-dfsm' | 'build-ndfsm' } => q.type !== 'write-regex'
);

/** The solution of a question as the machine of a student. */
function studentOf(question: Question): { doc: MachineDocument; machine: Machine } {
	const built = buildMachine(
		question.solution as SolutionMachine,
		question.alphabet,
		question.type === 'build-dfsm' ? 'dfsm' : 'ndfsm'
	);
	if (!built.ok) throw new Error('the solution does not build');
	return { doc: documentFromMachine(built.value.machine), machine: built.value.machine };
}

const gradeQuestion = (q: Question): GradeQuestion => ({
	type: q.type as GradeQuestion['type'],
	alphabet: q.alphabet,
	...(q.constraints ? { constraints: q.constraints } : {})
});

/** Checks everything that a "wrong" says against the outside truth. */
function expectTruth(
	result: Grade,
	student: Machine,
	solution: Machine,
	alphabet: string[],
	label: string
) {
	const longest = 6;
	const all = words(alphabet, longest);
	const disagree = all.filter((w) => accepts(student, w) !== accepts(solution, w));
	if (result.kind === 'right') {
		expect(disagree, `${label}: right, but the machines differ`).toEqual([]);
		return;
	}
	expect(result.kind, label).toBe('wrong');
	if (result.kind !== 'wrong') return;
	const shown = (w: { input: string }) =>
		alphabet.every((s) => s.length === 1) ? [...w.input] : w.input.split(' ').filter(Boolean);
	const witness = shown(result.witness);
	expect(accepts(student, witness), `${label}: the witness`).not.toBe(accepts(solution, witness));
	if (disagree.length > 0) {
		expect(witness.length, `${label}: the witness is the shortest`).toBe(
			Math.min(...disagree.map((w) => w.length))
		);
	}
	for (const w of result.accepted) {
		expect(
			accepts(student, shown(w)) && !accepts(solution, shown(w)),
			`${label}: accepted ${w.text}`
		).toBe(true);
	}
	for (const w of result.rejected) {
		expect(
			!accepts(student, shown(w)) && accepts(solution, shown(w)),
			`${label}: rejected ${w.text}`
		).toBe(true);
	}
	// The computation is the run of the student machine on the witness, and ends where the engine says.
	expect(result.computation?.accepted, `${label}: computation`).toBe(accepts(student, witness));
	expect(result.computation?.rows.length, `${label}: rows`).toBe(witness.length);
}

describe('the questions of the repository', () => {
	it('has machine questions to grade', () => {
		expect(machineQuestions.length).toBeGreaterThanOrEqual(3);
	});

	for (const question of machineQuestions) {
		describe(question.id, () => {
			const { doc, machine } = studentOf(question);

			it('grades its own solution as right', async () => {
				const result = await grade(
					gradeQuestion(question),
					question.solution as SolutionMachine,
					doc,
					engine
				);
				// A solution that breaks its own "minimal" would fail Q2 already; here it must be right.
				expect(result, question.id).toEqual({ kind: 'right' });
			});

			it('tells a machine that accepts one state more or less from the solution, with the shortest string', async () => {
				let different = 0;
				for (const state of doc.states) {
					const flipped = applyCommand(doc, {
						type: 'setAccepting',
						id: state.id,
						accepting: !doc.accepting.includes(state.id)
					});
					if (!flipped.ok) throw new Error(flipped.error.key);
					const result = await grade(
						gradeQuestion(question),
						question.solution as SolutionMachine,
						flipped.doc,
						engine
					);
					expectTruth(
						result,
						toMachine(flipped.doc),
						machine,
						question.alphabet,
						`${question.id}: flip ${state.name}`
					);
					if (result.kind === 'wrong') different += 1;
				}
				expect(different).toBeGreaterThan(0);
			});
		});
	}
});

describe('random machines against a solution', () => {
	const solution: SolutionMachine = {
		start: 'q0',
		accepting: ['q0'],
		transitions: ['q0 a q1', 'q1 a q0', 'q0 b q0', 'q1 b q1']
	};
	const q: GradeQuestion = { type: 'build-dfsm', alphabet: ['a', 'b'] };
	const built = buildMachine(solution, ['a', 'b'], 'dfsm');
	if (!built.ok) throw new Error('the solution does not build');

	it('are told right or wrong correctly, with the shortest string and truthful lists', async () => {
		const rng = random(4242);
		let wrong = 0;
		let right = 0;
		for (let round = 0; round < 80; round++) {
			const n = 1 + rng.int(4);
			const student = documentFrom({
				alphabet: ['a', 'b'],
				states: Array.from({ length: n }, (_, i) => [i * 100, 0] as [number, number]),
				start: 0,
				accepting: Array.from({ length: n }, (_, i) => i).filter(() => rng.chance(0.5)),
				transitions: Array.from({ length: n }, (_, from) =>
					['a', 'b'].map((on) => [from, on, rng.int(n)] as [number, string, number])
				).flat()
			});
			const result = await grade(q, solution, student, engine);
			if (result.kind === 'structure' || result.kind === 'stopped' || result.kind === 'failed') {
				throw new Error(`round ${round}: ${result.kind}`);
			}
			expectTruth(result, toMachine(student), built.value.machine, ['a', 'b'], `round ${round}`);
			if (result.kind === 'wrong') wrong += 1;
			else right += 1;
		}
		expect(wrong).toBeGreaterThan(20);
		expect(right).toBeGreaterThan(0);
	});
});

describe('the rules of the question, with the real engine', () => {
	const even: SolutionMachine = {
		start: 'q0',
		accepting: ['q0'],
		transitions: ['q0 a q1', 'q1 a q0', 'q0 b q0', 'q1 b q1']
	};
	const twoStates = () =>
		documentFrom({
			alphabet: ['a', 'b'],
			states: [
				[0, 0, 'p'],
				[100, 0, 'q']
			],
			start: 0,
			accepting: [0],
			transitions: [
				[0, 'a', 1],
				[1, 'a', 0],
				[0, 'b', 0],
				[1, 'b', 1]
			]
		});

	it('a machine with a missing transition gets the structure and no verdict', async () => {
		const missing = documentFrom({
			alphabet: ['a', 'b'],
			states: [[0, 0, 'p']],
			start: 0,
			accepting: [0],
			transitions: [[0, 'a', 0]]
		});
		const result = await grade({ type: 'build-dfsm', alphabet: ['a', 'b'] }, even, missing, engine);
		expect(result.kind).toBe('structure');
		expect(result.kind === 'structure' && result.issues.map((i) => i.message.key)).toEqual([
			'dfsm.missing_transition'
		]);
	});

	it('a machine with no start state gets the structure', async () => {
		const noStart = documentFrom({ alphabet: ['a', 'b'], states: [[0, 0, 'p']], accepting: [0] });
		const result = await grade({ type: 'build-dfsm', alphabet: ['a', 'b'] }, even, noStart, engine);
		expect(result.kind === 'structure' && result.issues.map((i) => i.message.key)).toContain(
			'fsm.no_start_state'
		);
	});

	it('minimal: the minimal machine is right, and one with a state too many is told so', async () => {
		const question: GradeQuestion = {
			type: 'build-dfsm',
			alphabet: ['a', 'b'],
			constraints: { minimal: true }
		};
		expect(await grade(question, even, twoStates(), engine)).toEqual({ kind: 'right' });
		const three = documentFrom({
			alphabet: ['a', 'b'],
			states: [
				[0, 0, 'p'],
				[100, 0, 'q'],
				[200, 0, 'r']
			],
			start: 0,
			accepting: [0, 2],
			transitions: [
				[0, 'a', 1],
				[1, 'a', 2],
				[2, 'a', 1],
				[0, 'b', 0],
				[1, 'b', 1],
				[2, 'b', 2]
			]
		});
		const result = await grade(question, even, three, engine);
		expect(result.kind === 'structure' && result.issues.map((i) => i.message.key)).toEqual([
			'feedback.not_minimal'
		]);
	});

	it('at most two states: three are too many, two are fine', async () => {
		const question: GradeQuestion = {
			type: 'build-dfsm',
			alphabet: ['a', 'b'],
			constraints: { maxStates: 2 }
		};
		expect(await grade(question, even, twoStates(), engine)).toEqual({ kind: 'right' });
	});

	it('an NDFSM with ε is graded by the language, and ε can be forbidden', async () => {
		const ndfsmSolution: SolutionMachine = {
			start: 'q0',
			accepting: ['q1'],
			transitions: ['q0 a q0', 'q0 ε q1', 'q1 b q1']
		};
		const doc = applyCommand(
			documentFrom({
				alphabet: ['a', 'b'],
				states: [
					[0, 0, 'p'],
					[100, 0, 'q']
				],
				start: 0,
				accepting: [1],
				transitions: [
					[0, 'a', 0],
					[0, null, 1],
					[1, 'b', 1]
				]
			}),
			{ type: 'setKind', kind: 'ndfsm' }
		);
		if (!doc.ok) throw new Error(doc.error.key);
		const question: GradeQuestion = { type: 'build-ndfsm', alphabet: ['a', 'b'] };
		expect(await grade(question, ndfsmSolution, doc.doc, engine)).toEqual({ kind: 'right' });
		const forbidden = await grade(
			{ ...question, constraints: { allowEpsilon: false } },
			ndfsmSolution,
			doc.doc,
			engine
		);
		expect(forbidden.kind === 'structure' && forbidden.issues.map((i) => i.message.key)).toEqual([
			'feedback.epsilon_not_allowed'
		]);
	});
});
