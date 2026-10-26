// The conversions of the "Konversi" tab, the part that has no DOM in it. The engine returns the
// finished machine and a trace of steps; this turns the trace into frames that the page steps
// through: the machine as it is built at each step, which states to light up, and the table of that
// step. A frame is made by replaying the trace up to its step (a trace has at most 20,000 steps and
// a replay is cheap), so that no frame is kept in memory.
import type { MessageKey } from '#lib/i18n/id.ts';
import type { Params } from '#lib/i18n/translate.ts';
import type {
	Change,
	Conversion,
	ConversionStep,
	EngineResult,
	Machine,
	MachineTransition,
	Minimization,
	Operation,
	StopReason
} from '../engine/types.ts';
import { documentFromMachine, toMachine } from './document.ts';
import type { MachineDocument } from './document.ts';

export type ConvertOp = 'determinize' | 'minimize' | 'trap' | 'complement' | 'union';
export const CONVERT_OPS: readonly ConvertOp[] = [
	'determinize',
	'minimize',
	'trap',
	'complement',
	'union'
];

/** A finished conversion: the machine it started from, the engine's answer and its trace. */
export interface ConvertRun {
	op: ConvertOp;
	source: MachineDocument;
	/** The second machine of a union. */
	second?: MachineDocument;
	final: Machine;
	trace: readonly ConversionStep[];
}

/** `minimize` does not run on a machine bigger than this (the engine's own budget would stop it late). */
export const MINIMIZE_MAX_STATES = 500;

/** The longest name of a state (the rule of the document). A longer set gets a short name. */
const NAME_CHARS = 32;

export interface Refusal {
	key: MessageKey;
	params: Params;
}

/** Why an operation cannot run on this machine, or null. The reasons are shown, not hidden. */
export function refusalOf(doc: MachineDocument, op: ConvertOp): Refusal | null {
	const no = (key: MessageKey, params: Params = {}): Refusal => ({ key, params });
	if (doc.states.length === 0) return no('convert.reason_empty');
	if (doc.start === null) return no('convert.reason_no_start');
	if (op === 'determinize' && doc.kind === 'dfsm') return no('convert.reason_already_dfsm');
	if (op !== 'determinize' && op !== 'union' && doc.kind === 'ndfsm') {
		return no('convert.reason_needs_dfsm');
	}
	if (op === 'minimize' && doc.states.length > MINIMIZE_MAX_STATES) {
		return no('convert.reason_too_big', { limit: MINIMIZE_MAX_STATES });
	}
	if (op === 'complement' && !isComplete(doc)) return no('convert.reason_incomplete');
	return null;
}

/** Does every state have exactly one transition on every symbol, and none on ε? */
function isComplete(doc: MachineDocument): boolean {
	const pairs = new Set(doc.transitions.map((t) => `${t.from}\u0000${t.on}`));
	return (
		doc.transitions.every((t) => t.on !== null) &&
		pairs.size === doc.transitions.length &&
		pairs.size === doc.states.length * doc.alphabet.length
	);
}

/** Why `second` cannot be the second machine of a union with `doc`, or null. */
export function secondRefusalOf(doc: MachineDocument, second: MachineDocument): Refusal | null {
	if (second.start === null) return { key: 'convert.reason_second_no_start', params: {} };
	const same =
		doc.alphabet.length === second.alphabet.length &&
		doc.alphabet.every((symbol) => second.alphabet.includes(symbol));
	return same ? null : { key: 'convert.reason_alphabet', params: {} };
}

/** The text of a set of states: `{q0, q1}`, and `∅` for the empty set. */
export function setText(ids: readonly number[], name: (id: number) => string): string {
	return ids.length === 0 ? '∅' : `{${ids.map(name).join(', ')}}`;
}

export interface Names {
	source: ReadonlyMap<number, string>;
	result: ReadonlyMap<number, string>;
	/** The names of the second machine of a union. */
	second: ReadonlyMap<number, string>;
}

/**
 * The names of the states, in the machine we start from and in the result. A state of a
 * determinized machine is named by its set (`{q0, q1}`); a class of a minimized machine by its
 * members (a class of one is named like its member). A name that would be too long becomes `S<id>`.
 * The state that a trap adds is named `trapName` (or `trapName_2`, ... when that name is taken).
 */
export function namesOf(run: ConvertRun, trapName: string): Names {
	const source = new Map(run.source.states.map((s) => [s.id, s.name]));
	const second = new Map((run.second?.states ?? []).map((s) => [s.id, s.name]));
	const sourceName = (id: number) => source.get(id) ?? `q${id}`;
	const result = new Map<number, string>();
	if (run.op === 'trap' || run.op === 'complement') {
		for (const [id, name] of source) result.set(id, name);
		const taken = new Set(source.values());
		let name = trapName;
		for (let n = 2; taken.has(name); n++) name = `${trapName}_${n}`;
		for (const step of run.trace) {
			if (step.change.kind === 'new_state') result.set(step.change.state, name);
		}
		return { source, result, second };
	}
	if (run.op === 'union') {
		// A state is named by its machine: 1.q0, 2.q0. A name that would be too long is 1.q<id>.
		for (const { change } of run.trace) {
			if (change.kind === 'copy') {
				const names = change.machine === 1 ? source : second;
				change.from.forEach((id, i) => {
					const text = `${change.machine}.${names.get(id) ?? `q${id}`}`;
					result.set(
						change.to[i]!,
						Array.from(text).length > NAME_CHARS ? `${change.machine}.q${id}` : text
					);
				});
			} else if (change.kind === 'start') {
				result.set(change.state, 's');
			}
		}
		return { source, result, second };
	}
	for (const { change } of run.trace) {
		if (change.kind !== 'new_state') continue;
		const alone = run.op === 'minimize' && change.members.length === 1;
		const text = alone ? sourceName(change.members[0]!) : setText(change.members, sourceName);
		result.set(change.state, Array.from(text).length > NAME_CHARS ? `S${change.state}` : text);
	}
	return { source, result, second };
}

/** The tables under the sentence. */
export type StepTable =
	| { kind: 'closure'; rows: { state: string; closure: string }[]; hot: number }
	| { kind: 'classes'; rows: string[]; hot: number[] }
	| {
			kind: 'delta';
			symbols: string[];
			rows: { state: string; cells: string[]; accepting: boolean }[];
			hot: number;
	  };

export interface Frame {
	step: ConversionStep;
	/** The result as it is built at this step; null while it has no state yet. */
	machine: Machine | null;
	/** The states of the machine we started from to light up, and the states of the result. */
	source: number[];
	result: number[];
	/** Which machine the lit states belong to: 2 is the second machine of a union. */
	from: 1 | 2;
	table: StepTable | null;
}

/** The states of a change, in the source machine and in the result. */
function lit(change: Change, op: ConvertOp): { source: number[]; result: number[]; from: 1 | 2 } {
	const from = change.kind === 'copy' && change.machine === 2 ? 2 : 1;
	// A complement keeps the states: the same ones are lit in both machines.
	if (op === 'complement' && (change.kind === 'accepting' || change.kind === 'not_accepting')) {
		return { source: [change.state], result: [change.state], from };
	}
	return { ...litStates(change), from };
}

function litStates(change: Change): { source: number[]; result: number[] } {
	switch (change.kind) {
		case 'closure':
			return { source: [change.state, ...change.closure], result: [] };
		case 'remove_unreachable':
			return { source: [change.state], result: [] };
		case 'examine':
		case 'no_split':
			return { source: change.class, result: [] };
		case 'split':
			return { source: [...change.kept, ...change.new], result: [] };
		case 'new_state':
			return { source: change.members, result: [change.state] };
		case 'start':
		case 'accepting':
		case 'not_accepting':
			return { source: [], result: [change.state] };
		case 'copy':
			return { source: change.from, result: change.to };
		case 'epsilon':
			return { source: [], result: [change.from, change.to] };
		case 'transition':
			return { source: [], result: [change.from, change.to] };
		default:
			return { source: [], result: [] };
	}
}

/** The frame at `index` (0-based) of the run. */
export function frameAt(run: ConvertRun, names: Names, index: number): Frame {
	const { alphabet } = run.final;
	// A dead state and a complement start from the whole machine; the others build from nothing.
	const trap = run.op === 'trap' || run.op === 'complement';
	const states: number[] = trap ? run.source.states.map((s) => s.id) : [];
	let start: number | null = trap ? run.source.start : null;
	const accepting: number[] = trap ? [...run.source.accepting] : [];
	const transitions: MachineTransition[] = trap
		? run.source.transitions.map(({ from, on, to }) => ({ from, on, to }))
		: [];
	const closures: { state: number; closure: number[] }[] = [];
	let classes: readonly (readonly number[])[] | null = null;

	const last = Math.min(Math.max(index, 0), run.trace.length - 1);
	for (let i = 0; i <= last; i++) {
		const { change } = run.trace[i]!;
		switch (change.kind) {
			case 'new_state':
				states.push(change.state);
				break;
			case 'start':
				start = change.state;
				// The new start state of a union is a state of the result that no copy made.
				if (!states.includes(change.state)) states.push(change.state);
				break;
			case 'accepting':
				accepting.push(change.state);
				break;
			case 'not_accepting':
				accepting.splice(accepting.indexOf(change.state), 1);
				break;
			case 'copy': {
				const doc = change.machine === 1 ? run.source : run.second;
				const at = new Map(change.from.map((id, i) => [id, change.to[i]!]));
				states.push(...change.to);
				accepting.push(...change.accepting);
				for (const t of doc?.transitions ?? []) {
					transitions.push({ from: at.get(t.from) ?? t.from, on: t.on, to: at.get(t.to) ?? t.to });
				}
				break;
			}
			case 'epsilon':
				transitions.push({ from: change.from, on: null, to: change.to });
				break;
			case 'transition':
				transitions.push({ from: change.from, on: alphabet[change.symbol] ?? null, to: change.to });
				break;
			case 'closure':
				closures.push({ state: change.state, closure: change.closure });
				break;
			case 'classes':
			case 'split':
				classes = change.classes;
				break;
			default:
		}
	}

	const step = run.trace[last]!;
	const { change } = step;
	const machine: Machine | null =
		states.length === 0
			? null
			: { schemaVersion: 1, kind: run.final.kind, alphabet, states, start, accepting, transitions };
	const sourceName = (id: number) => names.source.get(id) ?? `q${id}`;
	const resultName = (id: number) => names.result.get(id) ?? `q${id}`;

	let table: StepTable | null = null;
	if (machine) {
		const hotState =
			change.kind === 'transition' || change.kind === 'epsilon'
				? change.from
				: change.kind === 'new_state' ||
					  change.kind === 'accepting' ||
					  change.kind === 'not_accepting' ||
					  change.kind === 'start'
					? change.state
					: -1;
		table = {
			kind: 'delta',
			symbols: alphabet,
			rows: states.map((id) => ({
				state: resultName(id),
				cells: alphabet.map((symbol) => {
					const to = transitions.filter((t) => t.from === id && t.on === symbol).map((t) => t.to);
					return to.length === 0 ? '—' : to.map(resultName).join(', ');
				}),
				accepting: accepting.includes(id)
			})),
			hot: states.indexOf(hotState)
		};
	} else if (classes) {
		const shown = classes;
		const examined =
			change.kind === 'examine' ? change.class : change.kind === 'split' ? change.class : [];
		table = {
			kind: 'classes',
			rows: shown.map((members) => setText(members, sourceName)),
			hot: shown.flatMap((members, i) => (examined.some((id) => members.includes(id)) ? [i] : []))
		};
	} else if (closures.length > 0) {
		table = {
			kind: 'closure',
			rows: closures.map(({ state, closure }) => ({
				state: sourceName(state),
				closure: setText(closure, sourceName)
			})),
			hot: closures.length - 1
		};
	}
	return { step, machine, ...lit(change, run.op), table };
}

/** The words for why an engine call stopped. */
export function stopKey(reason: StopReason): MessageKey {
	return reason === 'max_states' ? 'convert.stopped_states' : 'convert.stopped_steps';
}

/** What the conversions need from the engine (the client of engine/client.ts has it). */
export interface ConvertEngine {
	determinize(machine: Machine): Promise<EngineResult<Conversion>>;
	minimize(machine: Machine): Promise<EngineResult<Minimization>>;
	addTrapState(machine: Machine): Promise<EngineResult<Operation>>;
	complement(machine: Machine): Promise<EngineResult<Operation>>;
	union(first: Machine, second: Machine): Promise<EngineResult<Operation>>;
}

export type ConvertOutcome =
	| { kind: 'finished'; run: ConvertRun }
	| { kind: 'stopped'; key: MessageKey }
	| { kind: 'refused'; key: MessageKey; params: Params };

/** Runs one conversion: one call to the engine. A call that fails (a crash, a timeout) throws. */
export async function runConversion(
	engine: ConvertEngine,
	doc: MachineDocument,
	op: ConvertOp,
	second?: MachineDocument
): Promise<ConvertOutcome> {
	const refusal = refusalOf(doc, op);
	if (refusal) return { kind: 'refused', ...refusal };
	if (op === 'union') {
		if (!second) return { kind: 'refused', key: 'convert.second_gone', params: {} };
		const unfit = secondRefusalOf(doc, second);
		if (unfit) return { kind: 'refused', ...unfit };
	}
	const machine = toMachine(doc);
	const answer =
		op === 'determinize'
			? await engine.determinize(machine)
			: op === 'minimize'
				? await engine.minimize(machine)
				: op === 'complement'
					? await engine.complement(machine)
					: op === 'union'
						? await engine.union(machine, toMachine(second!))
						: await engine.addTrapState(machine);
	if (!answer.ok) {
		const key = answer.error.key.endsWith('.invalid_machine')
			? 'convert.invalid_machine'
			: 'convert.failed';
		return { kind: 'refused', key, params: {} };
	}
	const value = answer.value;
	if ('result' in value) {
		if (value.result === 'stopped') return { kind: 'stopped', key: stopKey(value.reason) };
		const final = value.dfsm;
		return { kind: 'finished', run: { op, source: doc, final, trace: value.trace } };
	}
	const run: ConvertRun = { op, source: doc, final: value.fsm, trace: value.trace };
	return { kind: 'finished', run: second ? { ...run, second } : run };
}

/** Where the layout (or the source machine) puts a state. */
export interface Place {
	id: number;
	x: number;
	y: number;
}

/** How far below the machine a dead state is put. */
const DEAD_DROP = 130;

/**
 * The document of a result, or of a part of it (`machine` is the machine as built at some step).
 * The places are the same at every step, so that nothing moves while the machine grows:
 * a machine that gets a dead state (or a complement) keeps its places and puts the new state below them; any other
 * result is put where `layout` says (a state that has no place goes on the grid of the document).
 */
export function resultDocument(
	run: ConvertRun,
	names: Names,
	layout: readonly Place[] | null,
	machine: Machine,
	title: string
): MachineDocument {
	const places = new Map<number, { x: number; y: number }>();
	if (run.op === 'trap' || run.op === 'complement') {
		const old = run.source.states;
		for (const s of old) places.set(s.id, { x: s.x, y: s.y });
		const added = machine.states.find((id) => !places.has(id));
		if (added !== undefined) {
			const x = old.reduce((sum, s) => sum + s.x, 0) / Math.max(old.length, 1);
			const y = Math.max(...old.map((s) => s.y), 0) + DEAD_DROP;
			places.set(added, { x: Math.round(x), y });
		}
	} else {
		for (const p of layout ?? []) places.set(p.id, { x: Math.round(p.x), y: Math.round(p.y) });
	}
	const states = machine.states.map((id) => ({
		id,
		name: names.result.get(id) ?? `q${id}`,
		x: places.get(id)?.x ?? NaN,
		y: places.get(id)?.y ?? NaN
	}));
	return { ...documentFromMachine(machine, states), title };
}
