import { describe, expect, it } from 'vitest';
import { build } from '../diagram/testing.ts';
import { LIMIT } from './canvas.ts';
import { freeSpot } from './placement.ts';

describe('freeSpot', () => {
	it('is the spot itself when no state is within 72', () => {
		const doc = build({ states: [[400, 400]] });
		expect(freeSpot(doc, { x: 600, y: 400 })).toEqual({ x: 600, y: 400 });
		expect(freeSpot(doc, { x: 472, y: 400 })).toEqual({ x: 472, y: 400 });
	});

	it('is the spot of an empty document, in whole numbers', () => {
		expect(freeSpot(build({ states: [] }), { x: 100.4, y: 200.6 })).toEqual({ x: 100, y: 201 });
	});

	it('moves to the nearest free spot on a grid of 80 when a state is within 72', () => {
		const doc = build({ states: [[400, 400]] });
		const spot = freeSpot(doc, { x: 410, y: 400 });
		expect(Math.hypot(spot.x - 400, spot.y - 400)).toBeGreaterThanOrEqual(72);
		// On the grid of 80 around the spot, and the nearest such place.
		expect(Math.abs(spot.x - 410) % 80).toBe(0);
		expect(Math.abs(spot.y - 400) % 80).toBe(0);
		expect(Math.hypot(spot.x - 410, spot.y - 400)).toBeLessThanOrEqual(80);
	});

	it('goes on outward when the nearest places are taken (a spiral)', () => {
		const states: [number, number][] = [];
		for (let dx = -80; dx <= 80; dx += 80)
			for (let dy = -80; dy <= 80; dy += 80) states.push([500 + dx, 500 + dy]);
		const doc = build({ states });
		const spot = freeSpot(doc, { x: 500, y: 500 });
		for (const s of doc.states)
			expect(Math.hypot(spot.x - s.x, spot.y - s.y)).toBeGreaterThanOrEqual(72);
	});

	it('stays inside the limit of the document', () => {
		const doc = build({ states: [[LIMIT - 40, LIMIT - 40]] });
		const spot = freeSpot(doc, { x: LIMIT - 40, y: LIMIT - 40 });
		expect(spot.x).toBeLessThanOrEqual(LIMIT);
		expect(spot.y).toBeLessThanOrEqual(LIMIT);
	});

	it('can be far from the origin and from the old area of 1600 by 1000', () => {
		const doc = build({ states: [[100, 100]] });
		expect(freeSpot(doc, { x: -3000, y: 4500 })).toEqual({ x: -3000, y: 4500 });
	});

	it('is the same for the same input', () => {
		const doc = build({
			states: [
				[300, 300],
				[380, 300]
			]
		});
		expect(freeSpot(doc, { x: 330, y: 300 })).toEqual(freeSpot(doc, { x: 330, y: 300 }));
	});
});
