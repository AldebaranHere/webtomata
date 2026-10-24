// The selection of states: a sorted list of ids, and the small operations on it. The selection is
// not part of the document and not part of the history (docs/ux/editor-interactions.md).
import type { MachineDocument } from '../document.ts';
import { RADIUS } from '../diagram/geometry.ts';
import type { Point } from './canvas.ts';

export type Selection = readonly number[];
export type Direction = 'left' | 'right' | 'up' | 'down';

export const toggle = (selection: Selection, id: number): Selection =>
	selection.includes(id)
		? selection.filter((s) => s !== id)
		: [...selection, id].sort((a, b) => a - b);

export const selectAll = (doc: MachineDocument): Selection => doc.states.map((s) => s.id);

/** The selection without the ids that are no longer in the document (after a delete or an undo). */
export function prune(selection: Selection, doc: MachineDocument): Selection {
	const ids = new Set(doc.states.map((s) => s.id));
	return selection.filter((id) => ids.has(id));
}

/** The states whose whole circle is inside the rectangle. A negative width or height is fine. */
export function inRectangle(
	doc: MachineDocument,
	rect: { x: number; y: number; width: number; height: number }
): Selection {
	const left = Math.min(rect.x, rect.x + rect.width);
	const right = Math.max(rect.x, rect.x + rect.width);
	const top = Math.min(rect.y, rect.y + rect.height);
	const bottom = Math.max(rect.y, rect.y + rect.height);
	return doc.states
		.filter(
			(s) =>
				s.x - RADIUS >= left &&
				s.x + RADIUS <= right &&
				s.y - RADIUS >= top &&
				s.y + RADIUS <= bottom
		)
		.map((s) => s.id);
}

const VECTORS: Record<Direction, Point> = {
	left: { x: -1, y: 0 },
	right: { x: 1, y: 0 },
	up: { x: 0, y: -1 },
	down: { x: 0, y: 1 }
};

/**
 * The state that an arrow key goes to: the nearest one in that direction, among those that are
 * more in the direction than to the side (inside a cone of 45 degrees each way). A tie goes to the
 * lowest id.
 */
export function nearestInDirection(
	doc: MachineDocument,
	fromId: number,
	direction: Direction
): number | undefined {
	const from = doc.states.find((s) => s.id === fromId);
	if (!from) return undefined;
	const way = VECTORS[direction];
	let best: { id: number; distance: number } | undefined;
	for (const s of doc.states) {
		if (s.id === fromId) continue;
		const dx = s.x - from.x;
		const dy = s.y - from.y;
		const along = dx * way.x + dy * way.y;
		const aside = Math.abs(dx * way.y - dy * way.x);
		if (along <= 0 || aside > along) continue;
		// Along the way counts more than to the side, so a state that is in line wins.
		const distance = Math.hypot(along, aside * 2);
		if (
			best === undefined ||
			distance < best.distance ||
			(distance === best.distance && s.id < best.id)
		) {
			best = { id: s.id, distance };
		}
	}
	return best?.id;
}
