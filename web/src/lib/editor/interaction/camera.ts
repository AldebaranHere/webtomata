// The view of the canvas: where the world is on the screen and how big. A camera is
// `screen = world × scale + (x, y)`. Pure functions with no DOM, tested on their own
// (docs/ux/editor-interactions.md, "Pan and zoom"). The camera is not part of the document and not
// part of the history.
import type { Point } from './canvas.ts';

export interface Camera {
	x: number;
	y: number;
	scale: number;
}

/** 25% to 400%. */
export const MIN_SCALE = 0.25;
export const MAX_SCALE = 4;
/** The buttons and keys + and − change the zoom by this factor. */
export const ZOOM_STEP = 1.25;

export const IDENTITY: Camera = { x: 0, y: 0, scale: 1 };

const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));

export const toScreen = (c: Camera, p: Point): Point => ({
	x: p.x * c.scale + c.x,
	y: p.y * c.scale + c.y
});

export const toWorld = (c: Camera, p: Point): Point => ({
	x: (p.x - c.x) / c.scale,
	y: (p.y - c.y) / c.scale
});

/** The zoom as a whole percent, for the label of the control. */
export const percent = (c: Camera): number => Math.round(c.scale * 100);

/** Sets the zoom, so that the world point under `at` (a point of the screen) stays where it is. */
export function zoomAt(c: Camera, at: Point, scale: number): Camera {
	const next = clamp(scale, MIN_SCALE, MAX_SCALE);
	if (next === c.scale) return c;
	const world = toWorld(c, at);
	return { scale: next, x: at.x - world.x * next, y: at.y - world.y * next };
}

export const zoomBy = (c: Camera, at: Point, factor: number): Camera =>
	zoomAt(c, at, c.scale * factor);

export const panBy = (c: Camera, dx: number, dy: number): Camera => ({
	...c,
	x: c.x + dx,
	y: c.y + dy
});

interface Box {
	x: number;
	y: number;
	width: number;
	height: number;
}
interface Size {
	width: number;
	height: number;
}

/**
 * The camera that shows the whole machine, centered, with `padding` around it. It does not
 * enlarge beyond 100%, and does not go below 25%. An empty machine is shown at 100% at the origin.
 */
export function fit(bounds: Box | null, size: Size, padding = 48): Camera {
	if (bounds === null || size.width <= 0 || size.height <= 0) return IDENTITY;
	const room = {
		width: Math.max(1, size.width - 2 * padding),
		height: Math.max(1, size.height - 2 * padding)
	};
	const scale = clamp(
		Math.min(1, room.width / Math.max(1, bounds.width), room.height / Math.max(1, bounds.height)),
		MIN_SCALE,
		MAX_SCALE
	);
	const middle = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
	return { scale, x: size.width / 2 - middle.x * scale, y: size.height / 2 - middle.y * scale };
}

/** The world point under the middle of the view. */
export const centerOf = (c: Camera, size: Size): Point =>
	toWorld(c, { x: size.width / 2, y: size.height / 2 });

/** The camera moved by the least that puts the world point at least `margin` inside the view. */
export function reveal(c: Camera, world: Point, size: Size, margin = 64): Camera {
	const at = toScreen(c, world);
	const dx =
		at.x < margin ? margin - at.x : at.x > size.width - margin ? size.width - margin - at.x : 0;
	const dy =
		at.y < margin ? margin - at.y : at.y > size.height - margin ? size.height - margin - at.y : 0;
	return dx === 0 && dy === 0 ? c : panBy(c, dx, dy);
}

/** The parts of a wheel event that the camera needs. `x` and `y` are the pointer on the screen. */
export interface WheelInput {
	deltaX: number;
	deltaY: number;
	/** 0 pixels, 1 lines, 2 pages. */
	deltaMode: number;
	ctrlKey: boolean;
	x: number;
	y: number;
}

/**
 * A wheel or trackpad event. With Ctrl (a trackpad pinch also arrives like this) it zooms around
 * the pointer; otherwise it pans, opposite to the scroll. One turn of a mouse wheel zooms by a
 * modest step.
 */
export function wheel(c: Camera, e: WheelInput): Camera {
	const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
	if (e.ctrlKey) {
		const amount = clamp(e.deltaY * unit, -30, 30);
		return zoomBy(c, { x: e.x, y: e.y }, Math.exp(-amount * 0.01));
	}
	return panBy(c, -e.deltaX * unit, -e.deltaY * unit);
}

interface Fingers {
	a: Point;
	b: Point;
}

/**
 * Two fingers: the zoom follows the distance between them, and the point of the world that was
 * between them at the start stays between them as they move (so the fingers also pan). `start` is the
 * camera when the second finger touched; `from` and `to` are the fingers then and now.
 */
export function pinch(start: Camera, from: Fingers, to: Fingers): Camera {
	const before = Math.hypot(from.b.x - from.a.x, from.b.y - from.a.y);
	const now = Math.hypot(to.b.x - to.a.x, to.b.y - to.a.y);
	const scale = clamp(
		before > 0 ? start.scale * (now / before) : start.scale,
		MIN_SCALE,
		MAX_SCALE
	);
	const middleBefore = { x: (from.a.x + from.b.x) / 2, y: (from.a.y + from.b.y) / 2 };
	const middleNow = { x: (to.a.x + to.b.x) / 2, y: (to.a.y + to.b.y) / 2 };
	const world = toWorld(start, middleBefore);
	return { scale, x: middleNow.x - world.x * scale, y: middleNow.y - world.y * scale };
}
