// Where a new state goes: from the keyboard (the key N) at the center of the visible area, from the
// FSM and PDA tables one step to the right of the furthest state, and in both cases at the nearest
// free spot on a grid of 80 when the wanted place is taken.
import { LIMIT } from './canvas.ts';
import type { Point } from './canvas.ts';
import type { StateCommand, StatesDocument } from './document-view.ts';

/** A new state is this far (center to center) from every other state, at least. */
const MIN_DISTANCE = 72;
const GRID = 80;
const RINGS = 25;

const inside = (p: Point) => Math.abs(p.x) <= LIMIT && Math.abs(p.y) <= LIMIT;

export function freeSpot(doc: StatesDocument, wanted: Point): Point {
	const spot = { x: Math.round(wanted.x), y: Math.round(wanted.y) };
	const free = (p: Point) =>
		inside(p) && doc.states.every((s) => Math.hypot(s.x - p.x, s.y - p.y) >= MIN_DISTANCE);
	if (free(spot)) return spot;

	// Ring by ring around the spot, on the grid; in a ring, the nearest first (then by angle, so
	// that the choice is the same every time).
	for (let ring = 1; ring <= RINGS; ring++) {
		const candidates: Point[] = [];
		for (let i = -ring; i <= ring; i++) {
			for (let j = -ring; j <= ring; j++) {
				if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
				candidates.push({ x: spot.x + i * GRID, y: spot.y + j * GRID });
			}
		}
		candidates.sort(
			(a, b) =>
				Math.hypot(a.x - spot.x, a.y - spot.y) - Math.hypot(b.x - spot.x, b.y - spot.y) ||
				Math.atan2(a.y - spot.y, a.x - spot.x) - Math.atan2(b.y - spot.y, b.x - spot.x)
		);
		const found = candidates.find(free);
		if (found) return found;
	}
	// It is full around the spot. Put it there anyway, inside the limit.
	return {
		x: Math.min(Math.max(spot.x, -LIMIT), LIMIT),
		y: Math.min(Math.max(spot.y, -LIMIT), LIMIT)
	};
}

/** The distance between a new state and the one that is the furthest to the right. */
const STEP = 130;

/** A new state, to the right of the others and in the row of the last one (or at the free spot nearest to it). */
export function newStateCommand(doc: StatesDocument): Extract<StateCommand, { type: 'addState' }> {
	const last = doc.states.reduce<{ x: number; y: number } | null>(
		(far, s) => (far === null || s.x > far.x ? { x: s.x, y: s.y } : far),
		null
	);
	const spot = last === null ? { x: 200, y: 200 } : freeSpot(doc, { x: last.x + STEP, y: last.y });
	return { type: 'addState', x: spot.x, y: spot.y };
}
