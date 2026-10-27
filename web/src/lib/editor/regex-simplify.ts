// Sederhanakan (simplify a regular expression) in the Konversi tab, the part that has no DOM in it.
// The engine rewrites the expression with the identities of Rich's section 6.4, one identity at a time,
// and each step holds the whole expression after the rewrite and a message with the part before and after.
import type { MessageKey } from '#lib/i18n/id.ts';
import type { Params } from '#lib/i18n/translate.ts';
import type {
	ConversionStep,
	EngineResult,
	RegexOutcome,
	SimplifyBudget,
	ViaMachineBudget
} from '../engine/types.ts';
import { stopKey } from './conversion.ts';
import { alphabetOf, engineRefusal, textRefusal } from './regex-compile.ts';

/** What the page needs from the engine for this conversion. */
export interface SimplifyEngine {
	simplify(
		text: string,
		alphabet: string[],
		budget?: Partial<SimplifyBudget>
	): Promise<EngineResult<RegexOutcome>>;
	/** The same, but through the minimal machine; the shorter result wins. */
	simplifyViaMachine(
		text: string,
		alphabet: string[],
		budget?: Partial<ViaMachineBudget>
	): Promise<EngineResult<RegexOutcome>>;
}

/** `plain`: the identities alone. `machine`: also through the minimal machine. */
export type SimplifyRoute = 'plain' | 'machine';

/** A finished simplification with at least one step. */
export interface SimplifyRun {
	/** The expression as the student typed it. */
	text: string;
	/** The expression at the end. */
	regex: string;
	route: SimplifyRoute;
	trace: readonly ConversionStep[];
}

export type SimplifyOutcome =
	| { kind: 'finished'; run: SimplifyRun }
	/** No identity applies: the expression is as simple as the rules can make it. */
	| { kind: 'unchanged' }
	| { kind: 'stopped'; key: MessageKey }
	| { kind: 'refused'; key: MessageKey; params: Params };

/**
 * Simplifies `text`: one call to the engine. A call that fails (a crash, a timeout) throws. The route
 * through the machine always has a step (it says which way was taken), so it is never `unchanged`.
 */
export async function runSimplify(
	engine: SimplifyEngine,
	text: string,
	route: SimplifyRoute = 'plain'
): Promise<SimplifyOutcome> {
	const refusal = textRefusal(text);
	if (refusal) return { kind: 'refused', ...refusal };
	const alphabet = alphabetOf(text);
	const answer =
		route === 'machine'
			? await engine.simplifyViaMachine(text, alphabet)
			: await engine.simplify(text, alphabet);
	if (!answer.ok) return { kind: 'refused', ...engineRefusal(answer.error) };
	const value = answer.value;
	if (value.result === 'stopped') return { kind: 'stopped', key: stopKey(value.reason) };
	if (value.trace.length === 0) return { kind: 'unchanged' };
	return { kind: 'finished', run: { text, regex: value.regex, route, trace: value.trace } };
}

/** An expression cut in three at the part that a step changed, to mark it. */
export interface Marked {
	before: string;
	part: string;
	after: string;
}

/**
 * The first place of `part` in `whole`, as three pieces. The part is written by the engine and the whole
 * too, so it is there, but a part inside a longer one may have other brackets; then it is not found and
 * the whole is shown without a mark (the sentence of the step has the part).
 */
export function markPart(whole: string, part: string): Marked | null {
	const at = part === '' ? -1 : whole.indexOf(part);
	if (at < 0) return null;
	return { before: whole.slice(0, at), part, after: whole.slice(at + part.length) };
}

export interface SimplifyFrame {
	step: ConversionStep;
	/** The whole expression after this step. */
	expression: string;
	/** The part that the step wrote, marked in the expression; null if it is not found. */
	marked: Marked | null;
}

/** The frame at `index` (0-based) of the run. */
export function simplifyFrameAt(run: SimplifyRun, index: number): SimplifyFrame {
	const step = run.trace[Math.min(Math.max(index, 0), run.trace.length - 1)]!;
	const expression = step.change.kind === 'expression' ? step.change.expression : run.regex;
	const after = step.message.params.after;
	return {
		step,
		expression,
		marked: typeof after === 'string' ? markPart(expression, after) : null
	};
}
