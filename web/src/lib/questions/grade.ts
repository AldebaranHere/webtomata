// Grading the machine of a student against the solution of a question (Q4a), the part that has no DOM
// in it. The result is data: what is wrong and where, never a sentence (the texts are in
// feedback-text.ts and the message files), and never the fix. The order is that of the feedback panel
// and of docs/ux/feedback-copy.md: the structure comes first, and only a machine with a sound
// structure gets a verdict; then the verdict, the two lists of strings that the machine gets wrong, and
// the computation of the shortest one. The engine does the work (one call for each question that it
// answers); a call that fails (the worker died) throws, and the page says that the engine did not answer.
import type {
	EngineResult,
	EquivalenceBudget,
	EquivalenceReport,
	Issue,
	Machine,
	Message,
	Minimization,
	SimulateBudget,
	SimulationReport,
	StopReason
} from '../engine/types.ts';
import { wrongString } from '../editor/compare.ts';
import type { Wrong } from '../editor/compare.ts';
import { message, toMachine } from '../editor/document.ts';
import type { MachineDocument } from '../editor/document.ts';
import { buildMachine } from './machine.ts';
import type { Constraints, SolutionMachine } from './types.ts';

/** The question as grading needs it. `write-regex` questions are graded with their own answer box. */
export interface GradeQuestion {
	type: 'build-dfsm' | 'build-ndfsm';
	alphabet: readonly string[];
	constraints?: Constraints;
}

/** What grading needs from the engine (the client of engine/client.ts has it). */
export interface GradeEngine {
	validate(machine: Machine): Promise<EngineResult<Issue[]>>;
	minimize(machine: Machine): Promise<EngineResult<Minimization>>;
	equivalent(
		candidate: Machine,
		reference: Machine,
		budget?: Partial<EquivalenceBudget>
	): Promise<EngineResult<EquivalenceReport>>;
	simulate(
		machine: Machine,
		input: string,
		budget?: Partial<SimulateBudget>
	): Promise<EngineResult<SimulationReport>>;
}

/** "Dekat" (close) is for a few wrong strings that are short: the shortest has at most this many symbols... */
export const CLOSE_WITNESS = 4;
/** ...and the two lists have at most this many strings together, and were not cut. */
export const CLOSE_LISTS = 5;

/** One line of a computation: the states before, the symbol read, and the states after. */
export interface Row {
	/** How many symbols have been read after this line (counted from 1). */
	position: number;
	from: string[];
	symbol: string;
	to: string[];
}

/** The run of the machine of the student on the shortest wrong string. */
export interface Computation {
	rows: Row[];
	/** The names of the states where the run ends. */
	end: string[];
	/** The machine accepts the string (so the solution rejects it), or rejects it (so the solution accepts it). */
	accepted: boolean;
}

export type Grade =
	/** The machine breaks a rule of the question or of its kind; there is no verdict yet. */
	| { kind: 'structure'; issues: Issue[] }
	/** The engine stopped (a budget) before it could tell. */
	| { kind: 'stopped'; reason: StopReason }
	/** The engine refused a machine, or the answer file is not usable. */
	| { kind: 'failed'; error: Message }
	| { kind: 'right' }
	| {
			kind: 'wrong';
			closeness: 'close' | 'far';
			/** The shortest string that the machine and the solution tell apart. */
			witness: Wrong;
			/** The machine accepts, the solution does not. Shortest first. */
			accepted: Wrong[];
			/** The machine rejects, the solution accepts. Shortest first. */
			rejected: Wrong[];
			/** The engine cut the lists: they are not every string that differs. */
			truncated: boolean;
			/** Null when the run of the shortest string was stopped by its budget. */
			computation: Computation | null;
	  };

const error = (key: string, params: Message['params'] = {}): Issue => ({
	severity: 'error',
	message: message(key, params)
});

/** The symbols of `a` that `b` does not have, joined for a sentence. */
const missingFrom = (a: readonly string[], b: readonly string[]) =>
	a.filter((symbol) => !b.includes(symbol));

/**
 * Grades `doc` against `solution` (the machine of the answer file of the question). A machine with a
 * problem in its structure gets the list of the problems and no verdict; the engine is not asked to
 * compare it.
 */
export async function grade(
	question: GradeQuestion,
	solution: SolutionMachine,
	doc: MachineDocument,
	engine: GradeEngine
): Promise<Grade> {
	const machine = toMachine(doc);
	const issues: Issue[] = [];

	// The structure that the engine knows: errors only (a warning, such as a state that cannot be reached,
	// is not a reason to hold back a verdict). A DFSM that is allowed to be incomplete may miss transitions.
	const checked = await engine.validate(machine);
	if (!checked.ok) return { kind: 'failed', error: checked.error };
	for (const issue of checked.value) {
		if (issue.severity !== 'error') continue;
		if (
			issue.message.key === 'dfsm.missing_transition' &&
			question.constraints?.complete === false
		) {
			continue;
		}
		issues.push(issue);
	}

	// What the question asks.
	if (question.type === 'build-dfsm' && doc.kind !== 'dfsm')
		issues.push(error('feedback.need_dfsm'));
	const lacking = missingFrom(question.alphabet, doc.alphabet);
	const extra = missingFrom(doc.alphabet, question.alphabet);
	if (lacking.length > 0)
		issues.push(error('feedback.alphabet_missing', { symbols: lacking.join(', ') }));
	if (extra.length > 0)
		issues.push(error('feedback.alphabet_extra', { symbols: extra.join(', ') }));
	const { maxStates, minimal, allowEpsilon } = question.constraints ?? {};
	if (maxStates !== undefined && doc.states.length > maxStates) {
		issues.push(error('feedback.too_many_states', { max: maxStates, count: doc.states.length }));
	}
	if (allowEpsilon === false) {
		const count = doc.transitions.filter((t) => t.on === null).length;
		if (count > 0) issues.push(error('feedback.epsilon_not_allowed', { count }));
	}
	// A machine that is already wrong in its structure is not asked whether it is minimal.
	if (minimal === true && issues.length === 0) {
		const minimized = await engine.minimize(machine);
		if (!minimized.ok) return { kind: 'failed', error: minimized.error };
		if (minimized.value.result === 'stopped')
			return { kind: 'stopped', reason: minimized.value.reason };
		if (minimized.value.dfsm.states.length < machine.states.length) {
			issues.push(error('feedback.not_minimal'));
		}
	}
	if (issues.length > 0) return { kind: 'structure', issues };

	// The language.
	const built = buildMachine(
		solution,
		[...question.alphabet],
		question.type === 'build-dfsm' ? 'dfsm' : 'ndfsm'
	);
	if (!built.ok) return { kind: 'failed', error: message('feedback.answer_unusable') };
	const answer = await engine.equivalent(machine, built.value.machine);
	if (!answer.ok) return { kind: 'failed', error: answer.error };
	const { equivalence, witness, acceptedButShouldReject, rejectedButShouldAccept } = answer.value;
	if (equivalence.result === 'stopped') return { kind: 'stopped', reason: equivalence.reason };
	if (equivalence.result === 'equivalent') return { kind: 'right' };

	const write = (names: string[]) => wrongString(machine.alphabet, names);
	const shortest = write(witness ?? []);
	const accepted = acceptedButShouldReject.map(write);
	const rejected = rejectedButShouldAccept.map(write);
	const truncated = equivalence.listsTruncated;
	const close =
		!truncated &&
		(witness ?? []).length <= CLOSE_WITNESS &&
		accepted.length + rejected.length <= CLOSE_LISTS;
	return {
		kind: 'wrong',
		closeness: close ? 'close' : 'far',
		witness: shortest,
		accepted,
		rejected,
		truncated,
		computation: await computationOf(engine, doc, machine, shortest.input, witness ?? [])
	};
}

/** The run of the machine on the string, in lines with the names of the states; null if the run stopped. */
async function computationOf(
	engine: GradeEngine,
	doc: MachineDocument,
	machine: Machine,
	input: string,
	symbols: string[]
): Promise<Computation | null> {
	const run = await engine.simulate(machine, input);
	if (!run.ok || run.value.simulation.result === 'stopped') return null;
	const { trace, accepted } = run.value.simulation;
	const names = new Map(doc.states.map((s) => [s.id, s.name]));
	const named = (ids: readonly number[]) => ids.map((id) => names.get(id) ?? `#${id}`);
	const rows: Row[] = [];
	for (let i = 1; i < trace.length; i++) {
		rows.push({
			position: i,
			from: named(trace[i - 1]!.states),
			symbol: symbols[i - 1] ?? '',
			to: named(trace[i]!.states)
		});
	}
	return { rows, end: named(trace[trace.length - 1]?.states ?? []), accepted };
}
