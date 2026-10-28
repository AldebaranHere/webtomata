// The list of questions (Q3), the part that has no DOM in it: what a card needs, how the list is
// sorted, and the three filters (week, type, difficulty) with their form in the address
// (`?minggu=1&jenis=build-dfsm&tingkat=2`). A value that is not known is ignored, so that a link
// that is old or typed by hand shows the whole list and not an error.
import type { QuestionType } from './types.ts';

/** What a card of the list shows. The statement and the solution are not here: they are in the page of the question. */
export interface ListItem {
	id: string;
	title: { id: string; en: string };
	type: QuestionType;
	difficulty: 1 | 2 | 3;
	week: number;
	/** The name of the guide that teaches the pattern. */
	pattern: string;
}

export interface Filters {
	week: number | null;
	type: QuestionType | null;
	difficulty: 1 | 2 | 3 | null;
}

export const NO_FILTERS: Filters = { week: null, type: null, difficulty: null };

export const TYPES: readonly QuestionType[] = ['build-dfsm', 'build-ndfsm', 'write-regex'];
const MAX_WEEK = 14;

/** The earlier week first, then the easier question, then the id: the same order for everyone. */
export function sortItems(items: readonly ListItem[]): ListItem[] {
	return [...items].sort(
		(a, b) =>
			a.week - b.week || a.difficulty - b.difficulty || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
	);
}

/** The questions that match every filter that is set. The order is that of `items`. */
export function applyFilters(items: readonly ListItem[], filters: Filters): ListItem[] {
	return items.filter(
		(item) =>
			(filters.week === null || item.week === filters.week) &&
			(filters.type === null || item.type === filters.type) &&
			(filters.difficulty === null || item.difficulty === filters.difficulty)
	);
}

/** The values that some question has, so that the page offers only filters that can match. */
export function facets(items: readonly ListItem[]): {
	weeks: number[];
	types: QuestionType[];
	difficulties: (1 | 2 | 3)[];
} {
	return {
		weeks: [...new Set(items.map((i) => i.week))].sort((a, b) => a - b),
		types: TYPES.filter((type) => items.some((i) => i.type === type)),
		difficulties: ([1, 2, 3] as const).filter((d) => items.some((i) => i.difficulty === d))
	};
}

/** The place of a question in a list (counted from 1), or null when it is not in it. */
export function positionOf(
	items: readonly ListItem[],
	id: string
): { n: number; total: number } | null {
	const at = items.findIndex((item) => item.id === id);
	return at < 0 ? null : { n: at + 1, total: items.length };
}

export const activeCount = (filters: Filters): number =>
	[filters.week, filters.type, filters.difficulty].filter((v) => v !== null).length;

/** The search part of the address for these filters: nothing for no filter, else `?a=1&b=2`. */
export function filtersToSearch(filters: Filters): string {
	const parts: string[] = [];
	if (filters.week !== null) parts.push(`minggu=${filters.week}`);
	if (filters.type !== null) parts.push(`jenis=${filters.type}`);
	if (filters.difficulty !== null) parts.push(`tingkat=${filters.difficulty}`);
	return parts.length === 0 ? '' : `?${parts.join('&')}`;
}

/** A whole number written with digits only, or null. */
function wholeNumber(text: string | null): number | null {
	return text !== null && /^[0-9]{1,3}$/.test(text) ? Number(text) : null;
}

/** The filters of an address (`location.search`, with or without the question mark). */
export function parseFilters(search: string): Filters {
	const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
	const week = wholeNumber(params.get('minggu'));
	const difficulty = wholeNumber(params.get('tingkat'));
	const type = params.get('jenis');
	return {
		week: week !== null && week >= 1 && week <= MAX_WEEK ? week : null,
		type: TYPES.find((known) => known === type) ?? null,
		difficulty: difficulty === 1 || difficulty === 2 || difficulty === 3 ? difficulty : null
	};
}
