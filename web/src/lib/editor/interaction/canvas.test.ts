import { describe, expect, it } from 'vitest';
import { WORLD, clampDelta, dragPlaces, linkLine, snapTo } from './canvas.ts';

const places = (...entries: [number, number, number][]) =>
	new Map(entries.map(([id, x, y]) => [id, { x, y }]));

describe('the world', () => {
	it('is 1600 by 1000 units, until the canvas can pan and zoom (S4d)', () => {
		expect(WORLD).toMatchObject({ width: 1600, height: 1000 });
	});
});

describe('snapTo', () => {
	it('rounds to the nearest line of the grid', () => {
		expect(snapTo(31, 20)).toBe(40);
		expect(snapTo(29, 20)).toBe(20);
		expect(snapTo(30, 20)).toBe(40);
		expect(snapTo(-31, 20)).toBe(-40);
	});
});

describe('clampDelta', () => {
	it('keeps a group inside the world as a whole, so that its shape does not change', () => {
		const originals = places([0, 100, 100], [1, 300, 100]);
		// Far to the left: the left state stops at the margin, and the right one follows.
		const { x } = clampDelta(originals, { x: -1000, y: 0 });
		expect(x).toBe(40 - 100);
		const { y } = clampDelta(originals, { x: 0, y: 5000 });
		expect(y).toBe(WORLD.height - 40 - 100);
	});

	it('does not change a move that stays inside', () => {
		expect(clampDelta(places([0, 100, 100]), { x: 30, y: -20 })).toEqual({ x: 30, y: -20 });
	});
});

describe('dragPlaces', () => {
	it('moves every state by the same amount, in whole numbers', () => {
		const result = dragPlaces(places([0, 100, 100], [1, 200, 150]), { x: 10.4, y: -9.6 }, false);
		expect(result.get(0)).toEqual({ x: 110, y: 90 });
		expect(result.get(1)).toEqual({ x: 210, y: 140 });
	});

	it('snaps each place to a grid of 20 when asked', () => {
		const result = dragPlaces(places([0, 105, 118]), { x: 3, y: 4 }, true);
		expect(result.get(0)).toEqual({ x: 100, y: 120 });
	});

	it('keeps the states inside the world', () => {
		const result = dragPlaces(places([0, 100, 100]), { x: -500, y: -500 }, false);
		expect(result.get(0)).toEqual({ x: 40, y: 40 });
	});

	it('gives the same places for the same input', () => {
		const originals = places([3, 500, 500], [7, 600, 520]);
		expect([...dragPlaces(originals, { x: 12, y: 9 }, true)]).toEqual([
			...dragPlaces(originals, { x: 12, y: 9 }, true)
		]);
	});
});

describe('the preview of a transition', () => {
	const states = [
		{ id: 0, x: 100, y: 100 },
		{ id: 1, x: 400, y: 100 }
	];

	it('starts at the circle of the source and ends at the pointer', () => {
		expect(linkLine(states, 0, { x: 250, y: 100 })).toEqual({
			from: { x: 132, y: 100 },
			to: { x: 250, y: 100 }
		});
	});

	it('snaps to a state under the pointer and ends at its circle', () => {
		expect(linkLine(states, 0, { x: 410, y: 110 })).toEqual({
			from: { x: 132, y: 100 },
			to: { x: 368, y: 100 }
		});
	});

	it('has no arrow over the source (a loop), or for a source that is gone', () => {
		expect(linkLine(states, 0, { x: 110, y: 110 })).toBeNull();
		expect(linkLine(states, 9, { x: 250, y: 100 })).toBeNull();
	});
});
