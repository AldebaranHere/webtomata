// The numbers of the canvas that do not depend on the browser: the limit, snapping, and where a
// group of states ends up when it is dragged. Pure functions, tested without a DOM.
import { RADIUS } from '../diagram/geometry.ts';
import { LIMITS } from '../document.ts';

export interface Point {
	x: number;
	y: number;
}

/** The canvas has no edge. A state may be anywhere within this distance of the origin (the limit of the document). */
export const LIMIT = LIMITS.coordinate;

export const GRID = 20;

const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));

export const snapTo = (n: number, grid: number): number => Math.round(n / grid) * grid;

/**
 * The most that a group of places may move: the move is cut so that the whole group stays inside
 * the limit. The group keeps its shape, which clamping each state alone would not.
 */
export function clampDelta(originals: ReadonlyMap<number, Point>, delta: Point): Point {
	const places = [...originals.values()];
	if (places.length === 0) return delta;
	const xs = places.map((p) => p.x);
	const ys = places.map((p) => p.y);
	return {
		x: clamp(delta.x, -LIMIT - Math.min(...xs), LIMIT - Math.max(...xs)),
		y: clamp(delta.y, -LIMIT - Math.min(...ys), LIMIT - Math.max(...ys))
	};
}

/**
 * Where the states of a drag are, when the pointer has moved by `delta` since the press. Whole
 * numbers; with `snap`, on a grid of 20 (the Shift key); always inside the limit.
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
			x = clamp(snapTo(x, GRID), -LIMIT, LIMIT);
			y = clamp(snapTo(y, GRID), -LIMIT, LIMIT);
		}
		result.set(id, { x, y });
	}
	return result;
}

/**
 * The arrow that previews a transition: from the circle of the source toward the pointer. Over
 * another state it snaps to that state, and ends at its circle. Over the source itself (a loop)
 * there is no arrow. `states` are the places of the states.
 */
export function linkLine(
	states: readonly { id: number; x: number; y: number }[],
	from: number,
	pointer: Point
): { from: Point; to: Point } | null {
	const source = states.find((s) => s.id === from);
	if (!source) return null;
	const over = states.find(
		(s) => s.id !== from && Math.hypot(s.x - pointer.x, s.y - pointer.y) <= RADIUS + 8
	);
	const goal = over ?? pointer;
	const distance = Math.hypot(goal.x - source.x, goal.y - source.y);
	if (distance <= RADIUS + 4) return null;
	const ux = (goal.x - source.x) / distance;
	const uy = (goal.y - source.y) / distance;
	const start = { x: source.x + ux * RADIUS, y: source.y + uy * RADIUS };
	const end = over
		? { x: over.x - ux * RADIUS, y: over.y - uy * RADIUS }
		: { x: goal.x, y: goal.y };
	return { from: start, to: end };
}
