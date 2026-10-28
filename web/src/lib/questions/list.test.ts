import { describe, expect, it } from 'vitest';
import {
	NO_FILTERS,
	activeCount,
	applyFilters,
	facets,
	filtersToSearch,
	parseFilters,
	sortItems
} from './list.ts';
import type { ListItem } from './list.ts';

const item = (over: Partial<ListItem> & { id: string }): ListItem => ({
	title: { id: over.id, en: over.id },
	type: 'build-dfsm',
	difficulty: 1,
	week: 1,
	pattern: 'berakhiran-x',
	...over
});

const items: ListItem[] = [
	item({ id: 'c', week: 2, difficulty: 2, type: 'build-ndfsm' }),
	item({ id: 'a', week: 1, difficulty: 1 }),
	item({ id: 'b', week: 1, difficulty: 3, type: 'write-regex' }),
	item({ id: 'd', week: 1, difficulty: 1 })
];

describe('sortItems', () => {
	it('puts the earlier week first, then the easier question, then the id', () => {
		expect(sortItems(items).map((i) => i.id)).toEqual(['a', 'd', 'b', 'c']);
	});

	it('does not change the list that it is given', () => {
		const copy = [...items];
		sortItems(items);
		expect(items).toEqual(copy);
	});
});

describe('applyFilters', () => {
	it('keeps everything when no filter is set', () => {
		expect(applyFilters(items, NO_FILTERS)).toHaveLength(4);
	});

	it('keeps what matches every filter that is set', () => {
		expect(applyFilters(items, { ...NO_FILTERS, week: 1 }).map((i) => i.id)).toEqual([
			'a',
			'b',
			'd'
		]);
		expect(
			applyFilters(items, { week: 1, type: 'build-dfsm', difficulty: 1 }).map((i) => i.id)
		).toEqual(['a', 'd']);
		expect(applyFilters(items, { ...NO_FILTERS, type: 'write-regex' }).map((i) => i.id)).toEqual([
			'b'
		]);
	});

	it('gives nothing when no question matches', () => {
		expect(applyFilters(items, { week: 2, type: 'write-regex', difficulty: null })).toEqual([]);
	});
});

describe('facets', () => {
	it('lists only the values that some question has, in order', () => {
		expect(facets(items)).toEqual({
			weeks: [1, 2],
			types: ['build-dfsm', 'build-ndfsm', 'write-regex'],
			difficulties: [1, 2, 3]
		});
		expect(facets([item({ id: 'x', week: 4, difficulty: 2 })])).toEqual({
			weeks: [4],
			types: ['build-dfsm'],
			difficulties: [2]
		});
		expect(facets([])).toEqual({ weeks: [], types: [], difficulties: [] });
	});
});

describe('the filters in the address', () => {
	it('writes nothing for no filter, and the three names in a fixed order', () => {
		expect(filtersToSearch(NO_FILTERS)).toBe('');
		expect(filtersToSearch({ week: 2, type: 'build-ndfsm', difficulty: 3 })).toBe(
			'?minggu=2&jenis=build-ndfsm&tingkat=3'
		);
		expect(filtersToSearch({ ...NO_FILTERS, difficulty: 2 })).toBe('?tingkat=2');
	});

	it('reads what it wrote', () => {
		for (const filters of [
			NO_FILTERS,
			{ week: 1, type: 'build-dfsm', difficulty: 1 },
			{ week: 14, type: 'write-regex', difficulty: 3 },
			{ week: null, type: 'build-ndfsm', difficulty: null }
		] as const) {
			expect(parseFilters(filtersToSearch(filters))).toEqual(filters);
		}
	});

	it('ignores what it does not know, instead of failing', () => {
		expect(parseFilters('?minggu=0&jenis=banana&tingkat=9')).toEqual(NO_FILTERS);
		expect(parseFilters('?minggu=15&tingkat=0')).toEqual(NO_FILTERS);
		expect(parseFilters('?minggu=1.5&tingkat=1e0')).toEqual(NO_FILTERS);
		expect(parseFilters('?minggu=-1')).toEqual(NO_FILTERS);
		expect(parseFilters('?minggu=&jenis=')).toEqual(NO_FILTERS);
		expect(parseFilters('garbage')).toEqual(NO_FILTERS);
		expect(parseFilters('')).toEqual(NO_FILTERS);
	});

	it('keeps the good filters when another one is bad, and takes the first of a repeated name', () => {
		expect(parseFilters('?minggu=2&jenis=banana&tingkat=3')).toEqual({
			week: 2,
			type: null,
			difficulty: 3
		});
		expect(parseFilters('?minggu=2&minggu=3')).toEqual({ ...NO_FILTERS, week: 2 });
	});

	it('reads a search with or without the question mark', () => {
		expect(parseFilters('minggu=3')).toEqual({ ...NO_FILTERS, week: 3 });
	});
});

describe('activeCount', () => {
	it('counts the filters that are set', () => {
		expect(activeCount(NO_FILTERS)).toBe(0);
		expect(activeCount({ week: 1, type: null, difficulty: 2 })).toBe(2);
		expect(activeCount({ week: 1, type: 'write-regex', difficulty: 2 })).toBe(3);
	});
});
