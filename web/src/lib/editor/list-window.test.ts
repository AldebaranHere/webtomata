// The one window of a long list (T-071): the last `limit` rows and how many are before them. The
// PDA, the conversion panel and the grammar mode all show the same shape, so it is tested here at
// one below, at and one above the limit.
import { describe, expect, it } from 'vitest';
import { windowRows } from './list-window.ts';

const rows = (count: number) => Array.from({ length: count }, (_, i) => i);

describe('the window of a list', () => {
	it('shows an empty list, and one row, in full', () => {
		expect(windowRows([], 50)).toEqual({ shown: [], hidden: 0 });
		expect(windowRows([7], 50)).toEqual({ shown: [7], hidden: 0 });
	});

	it('shows 49 and 50 rows in full (one below and at the limit)', () => {
		expect(windowRows(rows(49), 50)).toEqual({ shown: rows(49), hidden: 0 });
		expect(windowRows(rows(50), 50)).toEqual({ shown: rows(50), hidden: 0 });
	});

	it('hides the first row at 51 (one above the limit) and keeps the order of the last 50', () => {
		const window = windowRows(rows(51), 50);
		expect(window.hidden).toBe(1);
		expect(window.shown).toHaveLength(50);
		expect(window.shown[0]).toBe(1);
		expect(window.shown[window.shown.length - 1]).toBe(50);
	});

	it('counts every row before the window', () => {
		expect(windowRows(rows(120), 50)).toEqual({ shown: rows(120).slice(-50), hidden: 70 });
	});

	it('takes the limit from its caller: 2, 3 and 4 rows at a limit of 3', () => {
		expect(windowRows(['a', 'b'], 3)).toEqual({ shown: ['a', 'b'], hidden: 0 });
		expect(windowRows(['a', 'b', 'c'], 3)).toEqual({ shown: ['a', 'b', 'c'], hidden: 0 });
		expect(windowRows(['a', 'b', 'c', 'd'], 3)).toEqual({ shown: ['b', 'c', 'd'], hidden: 1 });
	});
});
