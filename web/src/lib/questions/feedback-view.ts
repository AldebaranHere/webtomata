// Small pure helpers for the screen of the feedback (Q4b): how many wrong strings are shown as chips, how a
// line of a computation is written, and the button of the hints. No DOM.
import type { MessageKey } from '#lib/i18n/id.ts';
import type { Params } from '#lib/i18n/translate.ts';
import type { Wrong } from '../editor/compare.ts';
import type { Row } from './grade.ts';

/** The most wrong strings that a list shows as chips; the others are counted ("dan n lainnya"). */
export const MAX_CHIPS = 8;

export function visibleChips(list: readonly Wrong[]): { shown: Wrong[]; more: number } {
	return { shown: list.slice(0, MAX_CHIPS), more: Math.max(0, list.length - MAX_CHIPS) };
}

/** A set of states: one name, a list in braces, or ∅. */
const setOf = (names: readonly string[]) =>
	names.length === 0 ? '∅' : names.length === 1 ? names[0]! : `{${names.join(', ')}}`;

/** One line of a computation, as in Simulasi: "q2 –1→ q0". */
export const rowText = (row: Row): string => `${setOf(row.from)} –${row.symbol}→ ${setOf(row.to)}`;

/** The button of the hints: which hint comes next, or null when there is none left. */
export function hintButton(
	shown: number,
	total: number
): { key: MessageKey; params: Params } | null {
	if (shown >= total) return null;
	return { key: 'feedback.hint_button', params: { n: shown + 1, total } };
}
