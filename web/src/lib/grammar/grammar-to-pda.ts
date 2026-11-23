// Pure model for the "Ke PDA" tab in the grammar mode (T-038c): layout of engine-made PDAs,
// step transition formatting via the PDA diagram's own `transitionLabel`, 50-row windowing,
// title clamping against `LIMITS.titleChars`, and the bottom-up ε-rule warning predicate.
import { LIMITS } from '../editor/document.ts';
import { transitionLabel } from '../editor/diagram/pda-diagram.ts';
import { applyPdaCommand } from '../editor/pda-commands.ts';
import { fromEnginePda } from '../editor/pda-document.ts';
import type { PdaDocument } from '../editor/pda-document.ts';
import type {
	CfgToPda,
	Grammar,
	JffState,
	Message,
	PdaTransition,
	StateName
} from '../engine/types.ts';
import type { MessageKey } from '../i18n/id.ts';
import type { Params } from '../i18n/translate.ts';

export type CfgToPdaMethod = 'topdown' | 'bottomup';

export const CFG_PDA_STEP_WINDOW = 50;
export const CFG_PDA_SPACING = 420;
const START_X = 200;
const ROW_Y = 220;

export interface StepTransitionRow {
	readonly index: number;
	readonly fromName: string;
	readonly toName: string;
	readonly label: string;
}

/**
 * Places the engine's states in ascending `id` order on one horizontal row spaced by 420 units
 * (>= 410 units so PDA labels and self-loops remain readable).
 */
export function cfgPdaLayout(states: readonly StateName[]): JffState[] {
	const sorted = [...states].sort((a, b) => a.id - b.id);
	return sorted.map((s, index) => ({
		id: s.id,
		name: s.name,
		x: START_X + index * CFG_PDA_SPACING,
		y: ROW_Y
	}));
}

/**
 * Builds "<name> <suffix>" while clamping `<name>` by Unicode code points so the full title
 * never exceeds `LIMITS.titleChars`.
 */
export function buildConvertedPdaTitle(
	grammarTitle: string,
	suffix: string,
	fallbackName: string
): string {
	const base = grammarTitle.trim() || fallbackName;
	const full = `${base} ${suffix}`;
	if ([...full].length <= LIMITS.titleChars) return full;
	const maxBase = Math.max(0, LIMITS.titleChars - [...suffix].length - 1);
	const clamped = [...base].slice(0, maxBase).join('').trimEnd();
	return clamped ? `${clamped} ${suffix}` : [...suffix].slice(0, LIMITS.titleChars).join('');
}

/**
 * Converts an engine `CfgToPda` result into a valid, frozen `PdaDocument` with state names,
 * non-overlapping coordinates from `cfgPdaLayout`, and the given title.
 */
export function buildConvertedPdaDocument(result: CfgToPda, title: string): PdaDocument {
	const base = fromEnginePda(result.pda, cfgPdaLayout(result.states));
	const renamed = applyPdaCommand(base, { type: 'setTitle', title });
	return renamed.ok ? renamed.doc : base;
}

/** True when the parsed grammar contains at least one ε-production (empty body). */
export function hasEpsilonRule(grammar: Grammar | null): boolean {
	return grammar !== null && grammar.rules.some((rule) => rule.body.length === 0);
}

/** True when the bottom-up ε-rule warning should be shown (Decision 7, B6). */
export function showBottomUpEpsilonNote(method: CfgToPdaMethod, grammar: Grammar | null): boolean {
	return method === 'bottomup' && hasEpsilonRule(grammar);
}

/**
 * Formats one step transition using the PDA diagram's `transitionLabel` (`read / pop / push`)
 * and the state names from `CfgToPda.states`.
 */
export function formatStepTransition(
	doc: PdaDocument,
	states: readonly StateName[],
	transition: PdaTransition,
	index: number
): StepTransitionRow {
	const byId = new Map(states.map((s) => [s.id, s.name]));
	return {
		index,
		fromName: byId.get(transition.from) ?? `q${transition.from}`,
		toName: byId.get(transition.to) ?? `q${transition.to}`,
		label: transitionLabel(doc, transition)
	};
}

/** Keeps at most `limit` trailing rows and reports how many earlier rows were hidden. */
export function windowEarlierRows<T>(
	rows: readonly T[],
	limit = CFG_PDA_STEP_WINDOW
): { shown: readonly T[]; hidden: number } {
	if (rows.length <= limit) {
		return { shown: rows, hidden: 0 };
	}
	const hidden = rows.length - limit;
	return { shown: rows.slice(hidden), hidden };
}

/** Renders an engine refusal as a calm translated sentence, falling back to `detail` or the key. */
export function formatCfgPdaRefusal(
	error: Message,
	translateFn: (key: MessageKey, params?: Params) => string,
	hasKey: (key: string) => boolean
): string {
	if (hasKey(error.key)) {
		return translateFn(error.key as MessageKey, error.params);
	}
	if (error.params?.detail !== undefined) {
		return String(error.params.detail);
	}
	return error.key;
}
