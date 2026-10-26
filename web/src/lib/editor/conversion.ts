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
	Intersection,
	Machine,
	MachineTransition,
	Minimization,
	Operation,
	StopReason
} from '../engine/types.ts';
import { documentFromMachine, toMachine } from './document.ts';
import type { MachineDocument } from './document.ts';

export type ConvertOp =
	'determinize' | 'minimize' | 'trap' | 'complement' | 'union' | 'intersection';
export const CONVERT_OPS: readonly ConvertOp[] = [
	'determinize',
	'minimize',
	'trap',
	'complement',
	'union',
	'intersection'
];

/** The operations that take a second machine from the list of saved machines. */
export const TWO_MACHINE_OPS: readonly ConvertOp[] = ['union', 'intersection'];

/** A finished conversion: the machine it started from, the engine's answer and its trace. */
export interface ConvertRun {
	op: ConvertOp;
	source: MachineDocument;
	/** The second machine of a union or an intersection. */
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
	if (op !== 'determinize' && op !== 'union' && op !== 'intersection' && doc.kind === 'ndfsm') {
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

/** Why `second` cannot be the second machine of a union or an intersection with `doc`, or null. */
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
	intersection(first: Machine, second: Machine): Promise<EngineResult<Intersection>>;
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
	if (op === 'union' || op === 'intersection') {
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
						: op === 'intersection'
							? await engine.intersection(machine, toMachine(second!))
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
		const final = 'fsm' in value ? value.fsm : value.dfsm;
		const run: ConvertRun = { op, source: doc, final, trace: value.trace };
		return { kind: 'finished', run: second ? { ...run, second } : run };
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

// ---- the plan: what the player steps through ----

/** Gives the places of the states of a draft machine, or null when it cannot (too big, a failure). */
export type Layout = (draft: MachineDocument) => Promise<Place[] | null>;

/**
 * One part of what the player steps through. A simple operation is one stage (number 0, no key).
 * An intersection is up to seven: each is a determinize, a complement or a union that starts from
 * the machine that the engine says (the marker of the stage carries it), with its own names and
 * places. `offset` and `length` place the steps of the stage in the steps of the whole plan; the
 * markers themselves are not steps of the player.
 */
export interface Stage {
	number: number;
	/** The message key of the stage's name (`intersection.stage.complete_first`); null for a simple operation. */
	key: string | null;
	run: ConvertRun;
	names: Names;
	/** Where the layout put the states of the result; null when the result keeps the places of its source. */
	places: Place[] | null;
	offset: number;
	length: number;
}

export interface Plan {
	op: ConvertOp;
	stages: Stage[];
	/** The number of steps of the player. */
	total: number;
}

/** The result of these operations is a new drawing, so it gets a layout; the others keep the places. */
const NEEDS_LAYOUT: ReadonlySet<ConvertOp> = new Set(['determinize', 'minimize', 'union']);

/** What each stage of an intersection does. */
const STAGE_OPS: Record<number, ConvertOp> = {
	1: 'determinize',
	2: 'complement',
	3: 'determinize',
	4: 'complement',
	5: 'union',
	6: 'determinize',
	7: 'complement'
};

/** The names of the seven stages, in order (the engine's message keys). */
export const INTERSECTION_STAGE_KEYS = [
	'intersection.stage.complete_first',
	'intersection.stage.complement_first',
	'intersection.stage.complete_second',
	'intersection.stage.complement_second',
	'intersection.stage.union',
	'intersection.stage.complete_union',
	'intersection.stage.complement_union'
] as const;

interface Slot {
	names: ReadonlyMap<number, string>;
	places: readonly Place[] | null;
}

const slotOf = (doc: MachineDocument): Slot => ({
	names: new Map(doc.states.map((s) => [s.id, s.name])),
	places: doc.states.map((s) => ({ id: s.id, x: s.x, y: s.y }))
});

/** The document of a machine with the names and places of a slot (a state without a place goes on the grid). */
function documentWith(machine: Machine, slot: Slot): MachineDocument {
	const at = new Map((slot.places ?? []).map((p) => [p.id, p]));
	const states = machine.states.map((id) => ({
		id,
		name: slot.names.get(id) ?? `q${id}`,
		x: at.get(id)?.x ?? NaN,
		y: at.get(id)?.y ?? NaN
	}));
	return documentFromMachine(machine, states);
}

async function layoutOf(
	run: ConvertRun,
	names: Names,
	layout: Layout | undefined
): Promise<Place[] | null> {
	if (!layout || !NEEDS_LAYOUT.has(run.op)) return null;
	return layout(resultDocument(run, names, null, run.final, ''));
}

/**
 * The plan of a finished conversion. `layout` places the states of each result that needs it (it is
 * called once for a simple operation, and up to four times for an intersection). Without it, the
 * states go on the grid of the document.
 */
export async function buildPlan(run: ConvertRun, deadName: string, layout?: Layout): Promise<Plan> {
	if (run.op !== 'intersection') {
		const names = namesOf(run, deadName);
		const places = await layoutOf(run, names, layout);
		const stage: Stage = {
			number: 0,
			key: null,
			run,
			names,
			places,
			offset: 0,
			length: run.trace.length
		};
		return { op: run.op, stages: [stage], total: run.trace.length };
	}

	const markers = run.trace.flatMap((step, at) =>
		step.change.kind === 'stage'
			? [{ at, number: step.change.stage, key: step.message.key, inputs: step.change.inputs }]
			: []
	);
	const marker = (n: number) => markers.find((m) => m.number === n);
	// The machine that a stage makes is the input of the stage that uses it.
	const made = (n: number): Machine => {
		const next: Record<number, [number, number]> = {
			1: [2, 0],
			2: [5, 0],
			3: [4, 0],
			4: [5, 1],
			5: [6, 0],
			6: [7, 0]
		};
		const use = next[n];
		return use ? marker(use[0])!.inputs[use[1]]! : run.final;
	};
	const first = slotOf(run.source);
	const second = slotOf(run.second!);
	const out = new Map<number, Slot>();
	// A stage that was skipped passes its machine on as it is.
	const from: Record<number, () => Slot[]> = {
		1: () => [first],
		2: () => [out.get(1) ?? first],
		3: () => [second],
		4: () => [out.get(3) ?? second],
		5: () => [out.get(2)!, out.get(4)!],
		6: () => [out.get(5)!],
		7: () => [out.get(6) ?? out.get(5)!]
	};

	const stages: Stage[] = [];
	let offset = 0;
	for (const [i, m] of markers.entries()) {
		const [s0, s1] = from[m.number]!();
		const source = documentWith(m.inputs[0]!, s0!);
		const other = m.inputs[1] ? documentWith(m.inputs[1], s1!) : undefined;
		const end = markers[i + 1]?.at ?? run.trace.length;
		const sub: ConvertRun = {
			op: STAGE_OPS[m.number]!,
			source,
			...(other ? { second: other } : {}),
			final: made(m.number),
			trace: run.trace.slice(m.at + 1, end)
		};
		const names = namesOf(sub, deadName);
		const places = await layoutOf(sub, names, layout);
		out.set(m.number, {
			names: names.result,
			places: places ?? source.states.map((s) => ({ id: s.id, x: s.x, y: s.y }))
		});
		stages.push({
			number: m.number,
			key: m.key,
			run: sub,
			names,
			places,
			offset,
			length: sub.trace.length
		});
		offset += sub.trace.length;
	}
	return { op: run.op, stages, total: offset };
}

/** The frame at step `index` of the plan, with the stage it is in and its place in the stage. */
export function planFrame(
	plan: Plan,
	index: number
): { frame: Frame; stage: Stage; stageIndex: number; local: number } {
	const at = Math.min(Math.max(index, 0), plan.total - 1);
	let stageIndex = plan.stages.findIndex((s) => at < s.offset + s.length);
	if (stageIndex < 0) stageIndex = plan.stages.length - 1;
	const stage = plan.stages[stageIndex]!;
	const local = at - stage.offset;
	return { frame: frameAt(stage.run, stage.names, local), stage, stageIndex, local };
}

/** The document of the finished result, with `title`. */
export function planResult(plan: Plan, title: string): MachineDocument {
	const last = plan.stages[plan.stages.length - 1]!;
	return resultDocument(last.run, last.names, last.places, last.run.final, title);
}

/** The seven stages of an intersection as chips, with where each one starts; a skipped one is not present. */
export function chipsOf(
	plan: Plan
): { number: number; key: string; present: boolean; offset: number }[] {
	if (plan.op !== 'intersection') return [];
	return INTERSECTION_STAGE_KEYS.map((key, i) => {
		const stage = plan.stages.find((s) => s.number === i + 1);
		return { number: i + 1, key, present: stage !== undefined, offset: stage?.offset ?? -1 };
	});
}
