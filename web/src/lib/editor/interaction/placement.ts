// Where a new state goes when it is added with the keyboard (the key N): at the center of the
// visible area, or, if a state is already there, at the nearest free spot on a grid of 80.
import type { MachineDocument } from '../document.ts';
import { MARGIN, WORLD } from './canvas.ts';
import type { Point } from './canvas.ts';

/** A new state is this far (center to center) from every other state, at least. */
const MIN_DISTANCE = 72;
const GRID = 80;
const RINGS = 25;

const inside = (p: Point) =>
	p.x >= MARGIN && p.x <= WORLD.width - MARGIN && p.y >= MARGIN && p.y <= WORLD.height - MARGIN;

export function freeSpot(doc: MachineDocument, wanted: Point): Point {
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
	// The world is full around the spot. Put it there anyway, inside the world.
	return {
		x: Math.min(Math.max(spot.x, MARGIN), WORLD.width - MARGIN),
		y: Math.min(Math.max(spot.y, MARGIN), WORLD.height - MARGIN)
	};
}
