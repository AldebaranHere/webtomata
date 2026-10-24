import { describe, expect, it } from 'vitest';
import { build } from '../diagram/testing.ts';
import { inRectangle, nearestInDirection, prune, selectAll, toggle } from './selection.ts';

// Nine states on a grid of 130, ids 0..8 in rows:  0 1 2 / 3 4 5 / 6 7 8
const grid = () =>
	build({
		states: Array.from({ length: 9 }, (_, i) => [
			100 + 130 * (i % 3),
			100 + 130 * Math.floor(i / 3)
		])
	});

describe('toggle', () => {
	it('adds an id that is not selected, and removes one that is, keeping the list sorted', () => {
		expect(toggle([1, 5], 3)).toEqual([1, 3, 5]);
		expect(toggle([1, 3, 5], 3)).toEqual([1, 5]);
		expect(toggle([], 2)).toEqual([2]);
	});
});

describe('selectAll and prune', () => {
	it('selectAll gives every id, in order', () => {
		expect(selectAll(grid())).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
	});

	it('prune drops the ids that are not in the document any more, and keeps the rest in order', () => {
		const doc = build({
			states: [
				[0, 0],
				[100, 0],
				[200, 0]
			]
		});
		expect(prune([0, 2, 7, 9], doc)).toEqual([0, 2]);
		expect(prune([], doc)).toEqual([]);
	});
});

describe('inRectangle', () => {
	it('selects the states whose whole circle is inside', () => {
		const doc = grid();
		// A box around the top row, with room for the circles (radius 32).
		expect(inRectangle(doc, { x: 50, y: 50, width: 350, height: 100 })).toEqual([0, 1, 2]);
	});

	it('does not select a state that is only partly inside', () => {
		const doc = grid();
		expect(inRectangle(doc, { x: 80, y: 80, width: 100, height: 100 })).toEqual([]);
	});

	it('works for a rectangle drawn in any direction (a negative width or height)', () => {
		const doc = grid();
		expect(inRectangle(doc, { x: 400, y: 150, width: -350, height: -100 })).toEqual([0, 1, 2]);
	});
});

describe('nearestInDirection', () => {
	const doc = grid();

	it('finds the neighbor in each direction', () => {
		expect(nearestInDirection(doc, 4, 'left')).toBe(3);
		expect(nearestInDirection(doc, 4, 'right')).toBe(5);
		expect(nearestInDirection(doc, 4, 'up')).toBe(1);
		expect(nearestInDirection(doc, 4, 'down')).toBe(7);
	});

	it('finds nothing at the edge', () => {
		expect(nearestInDirection(doc, 0, 'left')).toBeUndefined();
		expect(nearestInDirection(doc, 0, 'up')).toBeUndefined();
		expect(nearestInDirection(doc, 8, 'right')).toBeUndefined();
	});

	it('prefers the state that is more in line, not only the closest', () => {
		const odd = build({
			states: [
				[100, 100],
				[200, 220], // close, but mostly below
				[330, 100] // farther, but straight to the right
			]
		});
		expect(nearestInDirection(odd, 0, 'right')).toBe(2);
		expect(nearestInDirection(odd, 0, 'down')).toBe(1);
	});

	it('is deterministic when two states are equally near', () => {
		const tie = build({
			states: [
				[200, 200],
				[100, 100],
				[100, 300]
			]
		});
		expect(nearestInDirection(tie, 0, 'left')).toBe(1);
	});

	it('returns nothing for an id that does not exist', () => {
		expect(nearestInDirection(doc, 99, 'left')).toBeUndefined();
	});
});
