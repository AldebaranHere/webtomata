// Regular expression → NDFSM in the Konversi tab, the part that has no DOM in it. The engine builds
// the machine part by part (Rich's `regextofsm`) and sends one step for each part of the
// expression: the new states and transitions of that part. A frame is the machine as built at one
// step, made by replaying the steps up to it.
import type { MessageKey } from '#lib/i18n/id.ts';
import type { Params } from '#lib/i18n/translate.ts';
import type {
	Compiled,
	ConversionStep,
	EngineResult,
	Machine,
	MachineTransition,
	Param,
	RegexBudget
} from '../engine/types.ts';
import { stopKey } from './conversion.ts';
import type { Layout, Place } from './conversion.ts';
import { documentFromMachine } from './document.ts';
import type { MachineDocument } from './document.ts';

/** The characters that are operators of the notation (Rich's: `∪`, `ε`, `∅`). */
const OPERATORS = new Set(['(', ')', '*', '+', '∪', 'ε', '∅']);

/** The longest expression that the page sends (the engine's own limit, in characters). */
export const MAX_REGEX_CHARS = 1_000;

/**
 * The alphabet of an expression: every character that is not an operator or a space is a symbol,
 * each once, in the order of the code points. (A symbol of more than one character is not typed
 * in this field.)
 */
export function alphabetOf(text: string): string[] {
	const found = new Set<string>();
	for (const c of text) if (!OPERATORS.has(c) && !/\s/u.test(c)) found.add(c);
	return [...found].sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!);
}

/** What the page needs from the engine for this conversion. */
export interface CompileEngine {
	regexToFsm(
		text: string,
		alphabet: string[],
		budget?: Partial<RegexBudget>
	): Promise<EngineResult<Compiled>>;
}

/** A finished regex → NDFSM. */
export interface CompileRun {
	text: string;
	alphabet: string[];
	final: Machine;
	trace: readonly ConversionStep[];
	/** Where the layout put the states of the machine (all steps use them); null if it could not. */
	places: Place[] | null;
}

export type CompileOutcome =
	| { kind: 'finished'; run: CompileRun }
	| { kind: 'stopped'; key: MessageKey }
	| { kind: 'refused'; key: MessageKey; params: Params };

/** The keys of the engine's parse errors that have a text of their own for the field. */
const PARSE_KEYS = new Set([
	'regex.unexpected',
	'regex.unbalanced_parenthesis',
	'regex.unexpected_end',
	'regex.too_long',
	'regex.too_deep',
	'regex.empty',
	'regex.unknown_symbol',
	'regex.operator_symbol'
]);

/**
 * What the field says for an error of the engine: a mistake in the expression gets its own sentence, with
 * the position counted from 1 (the engine counts from 0); any other error is the calm "cannot run".
 */
export function engineRefusal(error: { key: string; params: { [key in string]: Param } }): {
	key: MessageKey;
	params: Params;
} {
	const { key, params } = error;
	if (!PARSE_KEYS.has(key)) return { key: 'convert.failed', params: {} };
	const shown: Params = {};
	for (const [name, value] of Object.entries(params)) {
		// An error at the end of the text has the length for its position: it is already "after the last character".
		const from0 = name === 'position' && key !== 'regex.unexpected_end';
		shown[name] = from0 && typeof value === 'number' ? value + 1 : value;
	}
	return { key: key as MessageKey, params: shown };
}

/** Why the text cannot be sent, or null. The engine says the same for the same text; this saves a call. */
export function textRefusal(text: string): { key: MessageKey; params: Params } | null {
	if (text.trim() === '') return { key: 'regex.empty' as MessageKey, params: {} };
	if (Array.from(text).length > MAX_REGEX_CHARS) {
		return { key: 'regex.too_long' as MessageKey, params: { limit: MAX_REGEX_CHARS } };
	}
	return null;
}

/**
 * Builds the machine of `text`: one call to the engine, and one layout of the result. A parse error of
 * the engine comes back as `refused`, with the position counted from 1 (the engine counts from 0). A call
 * that fails (a crash, a timeout) throws.
 */
export async function runRegexToFsm(
	engine: CompileEngine,
	text: string,
	layout?: Layout
): Promise<CompileOutcome> {
	const refusal = textRefusal(text);
	if (refusal) return { kind: 'refused', ...refusal };
	const alphabet = alphabetOf(text);
	const answer = await engine.regexToFsm(text, alphabet);
	if (!answer.ok) {
		return { kind: 'refused', ...engineRefusal(answer.error) };
	}
	const value = answer.value;
	if (value.result === 'stopped') return { kind: 'stopped', key: stopKey(value.reason) };
	const names = new Map(value.fsm.states.map((id) => [id, `q${id}`]));
	const draft = documentWith(value.fsm, names, null);
	const places = layout ? await layout(draft) : null;
	return {
		kind: 'finished',
		run: { text, alphabet, final: value.fsm, trace: value.trace, places }
	};
}

/** The document of a machine of the run, with the names `q0`, `q1`, ... and the places of the run. */
function documentWith(
	machine: Machine,
	names: ReadonlyMap<number, string>,
	places: readonly Place[] | null
): MachineDocument {
	const at = new Map((places ?? []).map((p) => [p.id, p]));
	return documentFromMachine(
		machine,
		machine.states.map((id) => ({
			id,
			name: names.get(id) ?? `q${id}`,
			x: at.get(id) ? Math.round(at.get(id)!.x) : NaN,
			y: at.get(id) ? Math.round(at.get(id)!.y) : NaN
		}))
	);
}

/** The document of the finished machine, with `title`. */
export function compileResult(run: CompileRun, title: string): MachineDocument {
	const names = new Map(run.final.states.map((id) => [id, `q${id}`]));
	return { ...documentWith(run.final, names, run.places), title };
}

export interface CompileFrame {
	step: ConversionStep;
	/** The machine as built so far: the start and the accepting states are those of the part of this step. */
	machine: Machine;
	/** The states that this step made. */
	lit: number[];
	/** The document to draw: the places are those of the final machine, so that nothing moves. */
	doc: MachineDocument;
}

/**
 * The states to light for a part: those it made, and those that got a new transition (a concatenation
 * or a plus makes no state). A part that changes nothing (a plus of `∅`) lights its start state.
 */
function litOf(part: {
	start: number;
	states: readonly number[];
	transitions: readonly { from: number; to: number }[];
}) {
	const ids = new Set([...part.states, ...part.transitions.flatMap((t) => [t.from, t.to])]);
	if (ids.size === 0) ids.add(part.start);
	return [...ids].sort((a, b) => a - b);
}

/** The frame at `index` (0-based) of the run. */
export function compileFrameAt(run: CompileRun, index: number): CompileFrame {
	const last = Math.min(Math.max(index, 0), run.trace.length - 1);
	const states: number[] = [];
	const transitions: MachineTransition[] = [];
	for (let i = 0; i <= last; i++) {
		const { change } = run.trace[i]!;
		if (change.kind !== 'fragment') continue;
		states.push(...change.states);
		for (const t of change.transitions) {
			transitions.push({
				from: t.from,
				on: t.on === null ? null : (run.final.alphabet[t.on] ?? null),
				to: t.to
			});
		}
	}
	const step = run.trace[last]!;
	const part = step.change.kind === 'fragment' ? step.change : null;
	const machine: Machine = {
		schemaVersion: 1,
		kind: 'ndfsm',
		alphabet: run.final.alphabet,
		states: [...states].sort((a, b) => a - b),
		start: part?.start ?? null,
		accepting: part?.accepting ?? [],
		transitions
	};
	const names = new Map(run.final.states.map((id) => [id, `q${id}`]));
	return {
		step,
		machine,
		lit: part ? litOf(part) : [],
		doc: documentWith(machine, names, run.places)
	};
}

/** The names of the states of a step, as one text: `q0, q1`; used in the sentence. */
export const listText = (ids: readonly number[]): string => ids.map((id) => `q${id}`).join(', ');

/**
 * The text after `piece` is put in place of the selection `start`..`end` (positions in UTF-16 units,
 * as the field gives them), and where the caret goes: just after the piece.
 */
export function insertAt(
	text: string,
	start: number,
	end: number,
	piece: string
): { text: string; caret: number } {
	const from = Math.min(Math.max(Math.min(start, end), 0), text.length);
	const to = Math.min(Math.max(Math.max(start, end), 0), text.length);
	return { text: text.slice(0, from) + piece + text.slice(to), caret: from + piece.length };
}
