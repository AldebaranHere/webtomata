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

export type ConvertOp = 'determinize' | 'minimize' | 'trap';
export const CONVERT_OPS: readonly ConvertOp[] = ['determinize', 'minimize', 'trap'];

/** A finished conversion: the machine it started from, the engine's answer and its trace. */
export interface ConvertRun {
	op: ConvertOp;
	source: MachineDocument;
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
	if (op !== 'determinize' && doc.kind === 'ndfsm') return no('convert.reason_needs_dfsm');
	if (op === 'minimize' && doc.states.length > MINIMIZE_MAX_STATES) {
		return no('convert.reason_too_big', { limit: MINIMIZE_MAX_STATES });
	}
	return null;
}

/** The text of a set of states: `{q0, q1}`, and `∅` for the empty set. */
export function setText(ids: readonly number[], name: (id: number) => string): string {
	return ids.length === 0 ? '∅' : `{${ids.map(name).join(', ')}}`;
}

export interface Names {
	source: ReadonlyMap<number, string>;
	result: ReadonlyMap<number, string>;
}

/**
 * The names of the states, in the machine we start from and in the result. A state of a
 * determinized machine is named by its set (`{q0, q1}`); a class of a minimized machine by its
 * members (a class of one is named like its member). A name that would be too long becomes `S<id>`.
 * The state that a trap adds is named `trapName` (or `trapName_2`, ... when that name is taken).
 */
export function namesOf(run: ConvertRun, trapName: string): Names {
	const source = new Map(run.source.states.map((s) => [s.id, s.name]));
	const sourceName = (id: number) => source.get(id) ?? `q${id}`;
	const result = new Map<number, string>();
	if (run.op === 'trap') {
		for (const [id, name] of source) result.set(id, name);
		const taken = new Set(source.values());
		let name = trapName;
		for (let n = 2; taken.has(name); n++) name = `${trapName}_${n}`;
		for (const step of run.trace) {
			if (step.change.kind === 'new_state') result.set(step.change.state, name);
		}
		return { source, result };
	}
	for (const { change } of run.trace) {
		if (change.kind !== 'new_state') continue;
		const alone = run.op === 'minimize' && change.members.length === 1;
		const text = alone ? sourceName(change.members[0]!) : setText(change.members, sourceName);
		result.set(change.state, Array.from(text).length > NAME_CHARS ? `S${change.state}` : text);
	}
	return { source, result };
}

/** The tables under the sentence. */
export type StepTable =
	| { kind: 'closure'; rows: { state: string; closure: string }[]; hot: number }
	| { kind: 'classes'; rows: string[]; hot: number[] }
	| { kind: 'delta'; symbols: string[]; rows: { state: string; cells: string[] }[]; hot: number };

export interface Frame {
	step: ConversionStep;
	/** The result as it is built at this step; null while it has no state yet. */
	machine: Machine | null;
	/** The states of the machine we started from to light up, and the states of the result. */
	source: number[];
	result: number[];
	table: StepTable | null;
}

/** The states of a change, in the source machine and in the result. */
function lit(change: Change): { source: number[]; result: number[] } {
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
			return { source: [], result: [change.state] };
		case 'transition':
			return { source: [], result: [change.from, change.to] };
		default:
			return { source: [], result: [] };
	}
}

/** The frame at `index` (0-based) of the run. */
export function frameAt(run: ConvertRun, names: Names, index: number): Frame {
	const { alphabet } = run.final;
	const trap = run.op === 'trap';
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
				break;
			case 'accepting':
				accepting.push(change.state);
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
			change.kind === 'transition' ? change.from : change.kind === 'new_state' ? change.state : -1;
		table = {
			kind: 'delta',
			symbols: alphabet,
			rows: states.map((id) => ({
				state: resultName(id),
				cells: alphabet.map((symbol) => {
					const to = transitions.find((t) => t.from === id && t.on === symbol)?.to;
					return to === undefined ? '—' : resultName(to);
				})
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
	return { step, machine, ...lit(change), table };
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
}

export type ConvertOutcome =
	| { kind: 'finished'; run: ConvertRun }
	| { kind: 'stopped'; key: MessageKey }
	| { kind: 'refused'; key: MessageKey; params: Params };

/** Runs one conversion: one call to the engine. A call that fails (a crash, a timeout) throws. */
export async function runConversion(
	engine: ConvertEngine,
	doc: MachineDocument,
	op: ConvertOp
): Promise<ConvertOutcome> {
	const refusal = refusalOf(doc, op);
	if (refusal) return { kind: 'refused', ...refusal };
	const machine = toMachine(doc);
	const answer =
		op === 'determinize'
			? await engine.determinize(machine)
			: op === 'minimize'
				? await engine.minimize(machine)
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
	return { kind: 'finished', run: { op, source: doc, final: value.fsm, trace: value.trace } };
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
 * a machine that gets a dead state keeps its places and puts the new state below them; any other
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
	if (run.op === 'trap') {
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
