// The checks of a question that need the engine: the solution is a valid machine (or a valid
// regular expression), it meets the constraints of the question, and it agrees with the examples.
// The shape of the file is checked before (load.ts). Messages are for the author of the question,
// in English, and name the field. Erasable TypeScript only (tools/check-questions.mjs imports it).
import type { EngineApi } from '../engine/protocol.ts';
import type { Machine, Message } from '../engine/types.ts';
import { buildMachine, epsilonTransitions } from './machine.ts';
import type { Problem, Question, SolutionMachine } from './types.ts';

/** What the checks use of the engine. */
export type CheckEngine = Pick<
	EngineApi,
	'loadMachine' | 'validate' | 'simulate' | 'minimize' | 'regexToFsm'
>;

const SOLUTION = 'solution';

/** A message of the engine as a sentence for the author. `names[id]` is the name of a state. */
export function describeMessage(message: Message, names: string[] = []): string {
	const p = message.params;
	const state = (id: unknown) => names[Number(id)] ?? `#${String(id)}`;
	switch (message.key) {
		case 'dfsm.missing_transition':
			return `the state ${state(p.state)} has no transition on ${String(p.symbol)}`;
		case 'dfsm.duplicate_transition':
			return `the state ${state(p.state)} has more than one transition on ${String(p.symbol)}`;
		case 'dfsm.epsilon_transition':
			return `a DFSM cannot have ε-transitions (from ${state(p.from)} to ${state(p.to)})`;
		case 'fsm.no_start_state':
			return 'the machine has no start state';
		case 'fsm.unreachable_state':
			return `the state ${state(p.state)} cannot be reached from the start state`;
		case 'fsm.too_many_issues':
			return `there are more than ${String(p.limit)} problems; the rest are not listed`;
		case 'input.unknown_symbol':
			return `has a symbol that is not in the alphabet: "${String(p.symbol)}" (position ${String(Number(p.position) + 1)})`;
		case 'regex.unknown_symbol':
			return `the regular expression uses "${String(p.symbol)}" at position ${String(p.position)}, which is not in the alphabet`;
		case 'regex.unexpected':
			return `the regular expression has an unexpected "${String(p.found)}" at position ${String(p.position)}`;
		case 'regex.unexpected_end':
			return `the regular expression ends too early (position ${String(p.position)})`;
		case 'regex.unbalanced_parenthesis':
			return `the regular expression has a parenthesis that does not match, at position ${String(p.position)}`;
		case 'regex.operator_symbol':
			return `the regular expression uses the operator "${String(p.symbol)}" as a symbol`;
		case 'regex.empty':
			return 'the regular expression is empty';
		case 'regex.too_long':
			return `the regular expression is longer than ${String(p.limit)} characters`;
		case 'regex.too_deep':
			return `the regular expression has more than ${String(p.limit)} levels of parentheses`;
		case 'machine.limit_exceeded':
			return `the machine is bigger than the engine allows (${String(p.what ?? 'limit')})`;
		default:
			return `${message.key} ${JSON.stringify(p)}`;
	}
}

interface Loaded {
	machine: Machine;
	names: string[];
}

/** The machine of the solution, as the engine knows it, or the problems that stop us. */
function machineOf(
	question: Question,
	engine: CheckEngine
): { ok: true; value: Loaded } | { ok: false; problems: Problem[] } {
	if (question.type === 'write-regex') {
		const compiled = engine.regexToFsm(String(question.solution), question.alphabet);
		if (!compiled.ok) {
			return {
				ok: false,
				problems: [{ path: SOLUTION, message: describeMessage(compiled.error) }]
			};
		}
		if (compiled.value.result === 'stopped') {
			const message = `the regular expression is too big to check (${compiled.value.reason})`;
			return { ok: false, problems: [{ path: SOLUTION, message }] };
		}
		const machine = compiled.value.fsm;
		return { ok: true, value: { machine, names: machine.states.map((id) => `#${id}`) } };
	}

	const kind = question.type === 'build-dfsm' ? 'dfsm' : 'ndfsm';
	const built = buildMachine(question.solution as SolutionMachine, question.alphabet, kind);
	if (!built.ok) return built;
	const loaded = engine.loadMachine(JSON.stringify(built.value.machine));
	if (!loaded.ok) {
		return {
			ok: false,
			problems: [{ path: SOLUTION, message: describeMessage(loaded.error, built.value.names) }]
		};
	}
	return { ok: true, value: { machine: loaded.value, names: built.value.names } };
}

/** The string of an example as the engine reads it: ε is the empty string. */
const inputOf = (example: string) => (example === 'ε' ? '' : example);
const quoted = (example: string) =>
	example === '' || example === 'ε' ? 'the empty string' : `"${example}"`;

/** All problems of a question that has passed the schema. No problem means the question is sound. */
export function checkQuestion(question: Question, engine: CheckEngine): Problem[] {
	const made = machineOf(question, engine);
	if (!made.ok) return made.problems;
	const { machine, names } = made.value;
	const problems: Problem[] = [];

	const isMachineQuestion = question.type !== 'write-regex';
	let sound = true;
	if (isMachineQuestion) {
		// Structure: what the engine calls an error or a warning is a problem in a solution.
		const issues = engine.validate(machine);
		if (!issues.ok) {
			return [{ path: SOLUTION, message: describeMessage(issues.error, names) }];
		}
		const partialIsFine =
			question.type === 'build-dfsm' && question.constraints?.complete === false;
		for (const issue of issues.value) {
			if (partialIsFine && issue.message.key === 'dfsm.missing_transition') continue;
			problems.push({ path: SOLUTION, message: describeMessage(issue.message, names) });
			sound = false;
		}

		const { maxStates, minimal, allowEpsilon } = question.constraints ?? {};
		if (maxStates !== undefined && machine.states.length > maxStates) {
			problems.push({
				path: SOLUTION,
				message: `the solution has ${machine.states.length} states, but maxStates is ${maxStates}`
			});
		}
		if (allowEpsilon === false) {
			for (const index of epsilonTransitions(question.solution as SolutionMachine)) {
				problems.push({
					path: `${SOLUTION}.transitions[${index}]`,
					message: 'the question does not allow ε-transitions'
				});
			}
		}
		if (minimal === true && sound) {
			const minimized = engine.minimize(machine);
			if (!minimized.ok) {
				problems.push({ path: SOLUTION, message: describeMessage(minimized.error, names) });
			} else if (minimized.value.result === 'stopped') {
				problems.push({
					path: SOLUTION,
					message: `the engine stopped before it could tell whether the solution is minimal (${minimized.value.reason})`
				});
			} else if (minimized.value.dfsm.states.length !== machine.states.length) {
				problems.push({
					path: SOLUTION,
					message: `the solution has ${machine.states.length} states, but the minimal DFSM has ${minimized.value.dfsm.states.length}`
				});
			}
		}
	}

	// The examples run only on a sound machine: a machine with a missing transition would make
	// every example look wrong, and the real problem is listed above.
	if (sound) {
		for (const side of ['accept', 'reject'] as const) {
			question.examples[side].forEach((example, i) => {
				const path = `examples.${side}[${i}]`;
				const run = engine.simulate(machine, inputOf(example));
				if (!run.ok) {
					problems.push({
						path,
						message: `${quoted(example)} ${describeMessage(run.error, names)}`
					});
					return;
				}
				const { simulation } = run.value;
				if (simulation.result === 'stopped') {
					problems.push({
						path,
						message: `${quoted(example)} is too long to check (${simulation.reason})`
					});
					return;
				}
				if (simulation.accepted !== (side === 'accept')) {
					const was = simulation.accepted ? 'accepted' : 'rejected';
					const wants = side === 'accept' ? 'accepted' : 'rejected';
					problems.push({
						path,
						message: `${quoted(example)} is ${was} by the solution, but the question says it must be ${wants}`
					});
				}
			});
		}
	}
	return problems;
}

// ---- the report: what a reviewer needs to compare the solution with the statement ----

/** The strings over the alphabet, shortest first, and in the order of the alphabet. At most `cap`. */
export function stringsInProperOrder(
	alphabet: string[],
	maxLength: number,
	cap: number
): string[][] {
	const found: string[][] = [[]];
	let level: string[][] = [[]];
	for (let length = 1; length <= maxLength && found.length < cap; length++) {
		const next: string[][] = [];
		for (const prefix of level) {
			for (const symbol of alphabet) {
				if (found.length + next.length >= cap) break;
				next.push([...prefix, symbol]);
			}
		}
		found.push(...next);
		level = next;
	}
	return found.slice(0, cap);
}

export interface Accepted {
	/** The accepted strings, shortest first. ε is the empty string. */
	accepted: string[];
	/** How many strings were run through the solution. */
	checked: number;
}

/**
 * The first strings that the solution accepts, so that a reviewer can read them and compare them
 * with the statement. It looks at strings of up to `maxLength` symbols, at most `cap` of them, and
 * stops when it has `limit` accepted strings.
 */
export function acceptedStrings(
	question: Question,
	engine: CheckEngine,
	options: { maxLength: number; cap: number; limit: number }
): Accepted {
	const made = machineOf(question, engine);
	if (!made.ok) return { accepted: [], checked: 0 };
	// The engine reads one character at a time if every symbol is one character, and else words.
	const glue = question.alphabet.every((symbol) => [...symbol].length === 1) ? '' : ' ';
	const accepted: string[] = [];
	let checked = 0;
	for (const symbols of stringsInProperOrder(question.alphabet, options.maxLength, options.cap)) {
		const text = symbols.join(glue);
		checked++;
		const run = engine.simulate(made.value.machine, text);
		if (run.ok && run.value.simulation.result === 'finished' && run.value.simulation.accepted) {
			accepted.push(text === '' ? 'ε' : text);
			if (accepted.length >= options.limit) break;
		}
	}
	return { accepted, checked };
}
