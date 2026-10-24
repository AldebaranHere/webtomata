// The numbers of the canvas that do not depend on the browser: the size of the world, snapping,
// and where a group of states ends up when it is dragged. Pure functions, tested without a DOM.
import { RADIUS } from '../diagram/geometry.ts';

export interface Point {
	x: number;
	y: number;
}

/**
 * The canvas is a fixed area of 1600 by 1000 units, shown at 100% and scrolled by the browser.
 * Real pan and zoom come with S4d and replace this.
 */
export const WORLD = { width: 1600, height: 1000 } as const;

/** A state keeps its whole circle, and a little more, inside the world. */
export const MARGIN = RADIUS + 8;

export const GRID = 20;

const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));

export const snapTo = (n: number, grid: number): number => Math.round(n / grid) * grid;

/**
 * The most that a group of places may move: the move is cut so that the whole group stays inside
 * the world. The group keeps its shape, which clamping each state alone would not.
 */
export function clampDelta(originals: ReadonlyMap<number, Point>, delta: Point): Point {
	const places = [...originals.values()];
	if (places.length === 0) return delta;
	const xs = places.map((p) => p.x);
	const ys = places.map((p) => p.y);
	return {
		x: clamp(delta.x, MARGIN - Math.min(...xs), WORLD.width - MARGIN - Math.max(...xs)),
		y: clamp(delta.y, MARGIN - Math.min(...ys), WORLD.height - MARGIN - Math.max(...ys))
	};
}

/**
 * Where the states of a drag are, when the pointer has moved by `delta` since the press. Whole
 * numbers; with `snap`, on a grid of 20 (the Shift key); always inside the world.
 */
export function dragPlaces(
	originals: ReadonlyMap<number, Point>,
	delta: Point,
	snap: boolean
): Map<number, Point> {
	const moved = clampDelta(originals, delta);
	const result = new Map<number, Point>();
	for (const [id, place] of originals) {
		let x = Math.round(place.x + moved.x);
		let y = Math.round(place.y + moved.y);
		if (snap) {
			x = clamp(snapTo(x, GRID), MARGIN, WORLD.width - MARGIN);
			y = clamp(snapTo(y, GRID), MARGIN, WORLD.height - MARGIN);
		}
		result.set(id, { x, y });
	}
	return result;
}
