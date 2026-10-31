// What the main thread and the engine worker agree on. No code from the WASM package here.
import type {
	Compiled,
	Conversion,
	ConversionBudget,
	EngineResult,
	EquivalenceBudget,
	EquivalenceReport,
	FsmToRegexBudget,
	Intersection,
	Xor,
	Issue,
	Jff,
	JffState,
	Machine,
	Minimization,
	MinimizeBudget,
	Nondeterminism,
	Operation,
	RegexBudget,
	RegexOutcome,
	SimplifyBudget,
	SimulateBudget,
	SimulationReport,
	EnumerateReport,
	Grammar,
	CnfTransformationTrace,
	CykResult,
	StopReason,
	ViaMachineBudget
} from './types.ts';

import type { Message } from './types.ts';

/**
 * The engine, as the app sees it. Each method is one call to the WASM engine and answers with
 * `{ ok: true, value }` or `{ ok: false, error }` (a message key with parameters). A budget
 * can be partial: a missing field keeps the default. See `docs/ARCHITECTURE.md`.
 */
/** What happened to one string of `simulateMany`. */
export type StringOutcome =
	| { input: string; result: 'accepted' | 'rejected' }
	| { input: string; result: 'stopped'; reason: StopReason }
	/** The string cannot be run (a symbol that is not in the alphabet) or the machine cannot (no start state). */
	| { input: string; result: 'refused'; error: Message };

export interface EngineApi {
	version(): EngineResult<string>;
	/** Reads a saved or shared machine (JSON text) and checks it. */
	loadMachine(json: string): EngineResult<Machine>;
	validate(machine: Machine): EngineResult<Issue[]>;
	nondeterministicStates(machine: Machine): EngineResult<Nondeterminism[]>;
	addTrapState(machine: Machine): EngineResult<Operation>;
	simulate(
		machine: Machine,
		input: string,
		budget?: Partial<SimulateBudget>
	): EngineResult<SimulationReport>;
	/**
	 * Runs many strings on one machine, in one call: the verdict of each, in the order given. The
	 * budget is for each string.
	 */
	simulateMany(
		machine: Machine,
		inputs: string[],
		budget?: Partial<SimulateBudget>
	): EngineResult<StringOutcome[]>;
	determinize(machine: Machine, budget?: Partial<ConversionBudget>): EngineResult<Conversion>;
	minimize(machine: Machine, budget?: Partial<MinimizeBudget>): EngineResult<Minimization>;
	equivalent(
		candidate: Machine,
		reference: Machine,
		budget?: Partial<EquivalenceBudget>
	): EngineResult<EquivalenceReport>;
	regexToFsm(
		text: string,
		alphabet: string[],
		budget?: Partial<RegexBudget>
	): EngineResult<Compiled>;
	fsmToRegex(machine: Machine, budget?: Partial<FsmToRegexBudget>): EngineResult<RegexOutcome>;
	simplify(
		text: string,
		alphabet: string[],
		budget?: Partial<SimplifyBudget>
	): EngineResult<RegexOutcome>;
	simplifyViaMachine(
		text: string,
		alphabet: string[],
		budget?: Partial<ViaMachineBudget>
	): EngineResult<RegexOutcome>;
	complement(machine: Machine): EngineResult<Operation>;
	union(first: Machine, second: Machine): EngineResult<Operation>;
	intersection(
		first: Machine,
		second: Machine,
		budget?: Partial<ConversionBudget>
	): EngineResult<Intersection>;
	xor(first: Machine, second: Machine, budget?: Partial<ConversionBudget>): EngineResult<Xor>;
	importJff(xml: string): EngineResult<Jff>;
	exportJff(machine: Machine, layout: JffState[]): EngineResult<string>;
	enumerateLanguage(
		expr: string,
		minLength?: number,
		maxCount?: number,
		env?: Record<string, string>
	): EngineResult<EnumerateReport>;
	parseGrammar(grammar: string): EngineResult<Grammar>;
	transformToCnf(grammar: string): EngineResult<CnfTransformationTrace>;
	cykParse(grammar: string, inputWord: string): EngineResult<CykResult>;
}

export type EngineMethod = keyof EngineApi;

/** Every method, for the code that builds the client. The check below keeps the list whole. */
export const METHODS = [
	'version',
	'loadMachine',
	'validate',
	'nondeterministicStates',
	'addTrapState',
	'simulate',
	'simulateMany',
	'determinize',
	'minimize',
	'equivalent',
	'regexToFsm',
	'fsmToRegex',
	'simplify',
	'simplifyViaMachine',
	'complement',
	'union',
	'intersection',
	'xor',
	'importJff',
	'exportJff',
	'enumerateLanguage',
	'parseGrammar',
	'transformToCnf',
	'cykParse'
] as const satisfies readonly EngineMethod[];

/** A method that is missing from `METHODS` makes this a type error. */
export const _allMethodsListed: Exclude<EngineMethod, (typeof METHODS)[number]> extends never
	? true
	: never = true;

/** From the main thread to the worker. */
export interface CallMessage {
	id: number;
	method: string;
	args: unknown[];
}

/**
 * From the worker to the main thread. `crashed` means that the engine threw: the worker is
 * not used again, because a WASM trap can leave its memory in a broken state.
 */
export type ReplyMessage =
	{ id: number; result: EngineResult<unknown> } | { id: number; crashed: true };
