// The conversions of the "Konversi" tab that have a regular expression in them, the part that has no
// DOM in it. FSM → regex is state elimination: the engine returns the expression and a trace, and
// this turns the trace into frames. A frame is the table of labels at one step (a label is the
// expression of the path from one state to another), made by replaying the trace up to that step.
import type { MessageKey } from '#lib/i18n/id.ts';
import type { Params } from '#lib/i18n/translate.ts';
import type {
	ConversionStep,
	EngineResult,
	FsmToRegexBudget,
	Machine,
	RegexOutcome
} from '../engine/types.ts';
import { stopKey } from './conversion.ts';
import type { Refusal } from './conversion.ts';
import { toMachine } from './document.ts';
import type { MachineDocument } from './document.ts';

/** The operations of the list that make a regular expression or take one. */
export type RegexOp = 'fsm_to_regex';
export const REGEX_OPS: readonly RegexOp[] = ['fsm_to_regex'];

/** The most parts of a label that the page lets the engine build, and what "Naikkan batas" allows. */
export const RAISED_NODES = 2_000;

/** What the regex conversions need from the engine (the client of engine/client.ts has it). */
export interface RegexEngine {
	fsmToRegex(
		machine: Machine,
		budget?: Partial<FsmToRegexBudget>
	): Promise<EngineResult<RegexOutcome>>;
}

/** Why an operation cannot run on this machine, or null. */
export function regexRefusalOf(doc: MachineDocument): Refusal | null {
	if (doc.states.length === 0) return { key: 'convert.reason_empty', params: {} };
	if (doc.start === null) return { key: 'convert.reason_no_start', params: {} };
	return null;
}

/** A finished FSM → regex: the machine, the expression and the steps. */
export interface RegexRun {
	op: RegexOp;
	source: MachineDocument;
	regex: string;
	trace: readonly ConversionStep[];
}

export type RegexOutcomeOf =
	| { kind: 'finished'; run: RegexRun }
	/** `raise`: a bigger budget may finish it (the page offers it once). */
	| { kind: 'stopped'; key: MessageKey; raise: boolean }
	| { kind: 'refused'; key: MessageKey; params: Params };

/**
 * Runs FSM → regex: one call to the engine. `raised` allows labels of up to `RAISED_NODES` parts.
 * A call that fails (a crash, a timeout) throws.
 */
export async function runFsmToRegex(
	engine: RegexEngine,
	doc: MachineDocument,
	raised = false
): Promise<RegexOutcomeOf> {
	const refusal = regexRefusalOf(doc);
	if (refusal) return { kind: 'refused', ...refusal };
	const answer = await engine.fsmToRegex(toMachine(doc), raised ? { maxNodes: RAISED_NODES } : {});
	if (!answer.ok) {
		const key = answer.error.key.endsWith('.invalid_machine')
			? 'convert.invalid_machine'
			: 'convert.failed';
		return { kind: 'refused', key, params: {} };
	}
	const value = answer.value;
	if (value.result === 'stopped') {
		const nodes = value.reason === 'max_nodes';
		return {
			kind: 'stopped',
			key: nodes ? 'convert.stopped_nodes' : stopKey(value.reason),
			raise: nodes && !raised
		};
	}
	return {
		kind: 'finished',
		run: { op: 'fsm_to_regex', source: doc, regex: value.regex, trace: value.trace }
	};
}

/**
 * The names of the states: those of the machine, and the two that the algorithm may add (a new
 * start state and a new accepting state, `start` and `accept` here; a name that is taken gets `_2`...).
 */
export function regexNamesOf(
	run: RegexRun,
	start: string,
	accept: string
): ReadonlyMap<number, string> {
	const names = new Map(run.source.states.map((s) => [s.id, s.name]));
	const taken = new Set(names.values());
	const free = (name: string) => {
		let found = name;
		for (let n = 2; taken.has(found); n++) found = `${name}_${n}`;
		taken.add(found);
		return found;
	};
	for (const { change } of run.trace) {
		if (change.kind === 'start' && !names.has(change.state)) names.set(change.state, free(start));
		if (change.kind === 'accepting' && !names.has(change.state)) {
			names.set(change.state, free(accept));
		}
	}
	return names;
}

/** One row of the table: the label of the path from one state to another. */
export interface LabelRow {
	from: string;
	to: string;
	expression: string;
}

export interface RegexFrame {
	step: ConversionStep;
	/** The labels at this step, by state number; empty before the table is made. */
	table: LabelRow[];
	/** The rows that this step changed. */
	hot: number[];
	/** The states of the machine to light up. */
	lit: number[];
}

/** The frame at `index` (0-based) of the run. */
export function regexFrameAt(
	run: RegexRun,
	names: ReadonlyMap<number, string>,
	index: number
): RegexFrame {
	const last = Math.min(Math.max(index, 0), run.trace.length - 1);
	const labels = new Map<string, { from: number; to: number; expression: string }>();
	const put = (l: { from: number; to: number; expression: string }) =>
		labels.set(`${l.from}>${l.to}`, l);
	let changed = new Set<string>();
	for (let i = 0; i <= last; i++) {
		const { change } = run.trace[i]!;
		changed = new Set();
		if (change.kind === 'labels') {
			labels.clear();
			change.labels.forEach(put);
		} else if (change.kind === 'rip') {
			for (const key of [...labels.keys()]) {
				const l = labels.get(key)!;
				if (l.from === change.state || l.to === change.state) labels.delete(key);
			}
			for (const l of change.updates) {
				put(l);
				changed.add(`${l.from}>${l.to}`);
			}
		}
	}
	const name = (id: number) => names.get(id) ?? `q${id}`;
	const sorted = [...labels.values()].sort((a, b) => a.from - b.from || a.to - b.to);
	const step = run.trace[last]!;
	const { change } = step;
	const known = new Set(run.source.states.map((s) => s.id));
	const lit =
		change.kind === 'rip' || change.kind === 'remove_unreachable'
			? known.has(change.state)
				? [change.state]
				: []
			: [];
	return {
		step,
		table: sorted.map((l) => ({ from: name(l.from), to: name(l.to), expression: l.expression })),
		hot: sorted.flatMap((l, i) => (changed.has(`${l.from}>${l.to}`) ? [i] : [])),
		lit
	};
}
