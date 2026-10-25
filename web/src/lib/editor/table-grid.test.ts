import { describe, expect, it } from 'vitest';
import { clampPos, moveInGrid } from './table-grid.ts';

// A grid of 4 rows (the first is the header) and 5 columns.
const move = (row: number, col: number, key: string, ctrl = false) =>
	moveInGrid({ row, col }, key, 4, 5, ctrl);

describe('moving in the grid of the table', () => {
	it('the arrows move one cell and stop at the edge', () => {
		expect(move(1, 1, 'ArrowRight')).toEqual({ row: 1, col: 2 });
		expect(move(1, 1, 'ArrowLeft')).toEqual({ row: 1, col: 0 });
		expect(move(1, 1, 'ArrowDown')).toEqual({ row: 2, col: 1 });
		expect(move(1, 1, 'ArrowUp')).toEqual({ row: 0, col: 1 });
		expect(move(0, 0, 'ArrowUp')).toEqual({ row: 0, col: 0 });
		expect(move(0, 0, 'ArrowLeft')).toEqual({ row: 0, col: 0 });
		expect(move(3, 4, 'ArrowDown')).toEqual({ row: 3, col: 4 });
		expect(move(3, 4, 'ArrowRight')).toEqual({ row: 3, col: 4 });
	});

	it('Home and End go to the ends of the row; with Ctrl, to the first and the last cell', () => {
		expect(move(2, 3, 'Home')).toEqual({ row: 2, col: 0 });
		expect(move(2, 1, 'End')).toEqual({ row: 2, col: 4 });
		expect(move(2, 3, 'Home', true)).toEqual({ row: 0, col: 0 });
		expect(move(2, 1, 'End', true)).toEqual({ row: 3, col: 4 });
	});

	it('any other key is not a move', () => {
		expect(move(1, 1, 'Enter')).toBeNull();
		expect(move(1, 1, 'a')).toBeNull();
		expect(move(1, 1, 'Tab')).toBeNull();
	});

	it('a place that is gone (a row or a column was removed) is brought back into the grid', () => {
		expect(clampPos({ row: 9, col: 9 }, 4, 5)).toEqual({ row: 3, col: 4 });
		expect(clampPos({ row: 1, col: 2 }, 4, 5)).toEqual({ row: 1, col: 2 });
		expect(clampPos({ row: 1, col: 2 }, 0, 0)).toEqual({ row: 0, col: 0 });
	});
});
