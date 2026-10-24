// The drawing of a machine, as data: where each circle, edge, label and arrow goes. A pure
// function of the document, so the same document always gives the same drawing, and the rules
// of docs/ux/editor-interactions.md ("Drawing conventions") can be tested without a browser.
//
// Coordinates are those of the document (1 unit is 1 px at 100% zoom, y grows downward). Angles
// are in degrees, as on the screen: 0 is east, 90 is south, -90 (the top) is north, 180 is west.
import type { MachineDocument, StateEntry } from '../document.ts';

export const RADIUS = 32;
export const INNER_RADIUS = 26;
/** The distance between a label and its line, and between a label and the end of the arrow. */
export const LABEL_GAP = 4;

const START_LENGTH = 40;
const LOOP_REACH = 40;
/** The top of a curve of an opposite pair is this far from the straight line. */
const FIRST_PEAK = 24;
/** An edge keeps this far from the circle of any other state. */
const CLEARANCE = 8;
/** From the center of a state with a self-loop: its circle, the loop, a label and some air. */
const LOOP_CLEARANCE = RADIUS + LOOP_REACH + 20 + 2 * LABEL_GAP;
/** Peaks that are tried, in order, for an edge that is in the way of a state. */
const PEAKS = [24, 32, 40, 56, 72, 96, 128, 176, 240];
/** An edge this close to a state (center to line) counts as busy at that angle. */
const NEAR = RADIUS + LOOP_REACH + 18;
/** A state this close (center to center) is busy at that angle: an arrow or a loop would run into it. */
const NEIGHBOR = 150;
const SAMPLES = 24;
/** The start arrow keeps to the left while the left has this many degrees of room. */
const START_FREE_GAP = 90;

const LABEL_HEIGHT = 20;
const LABEL_PADDING = 8;
const MONO_CHAR = 9.6; // JetBrains Mono at --text-md (16 px): 0.6 em
const UI_CHAR = 7; // Plus Jakarta Sans at 12 px, on average
/** The room for the name of a state: inside the inner circle of an accepting state. */
export const NAME_ROOM = 2 * INNER_RADIUS - 10;
const NAME_SIZE = { max: 16, min: 11 };
const EMPTY_BOUNDS = { x: 0, y: 0, width: 400, height: 240 };

export interface Point {
	x: number;
	y: number;
}
export interface Box {
	x: number;
	y: number;
	width: number;
	height: number;
}
export interface LabelShape {
	text: string;
	center: Point;
	box: Box;
}
export interface StateShape {
	id: number;
	name: string;
	x: number;
	y: number;
	accepting: boolean;
	/** What is written in the circle: the name, smaller or cut when it is long. */
	text: { content: string; fontSize: number; truncated: boolean };
}
export interface EdgeShape {
	from: number;
	to: number;
	kind: 'straight' | 'curve' | 'loop';
	/** An SVG path that ends at the tip of the arrow. */
	path: string;
	start: Point;
	end: Point;
	/** The line as points (2 for a straight edge, more for a curve), for checks and bounds. */
	points: Point[];
	label: LabelShape;
	/** For a loop: the angle at which it leaves the state. */
	angle?: number;
}
export interface StartShape {
	state: number;
	angle: number;
	tail: Point;
	head: Point;
	path: string;
	label: LabelShape;
}
export interface DiagramShapes {
	states: StateShape[];
	edges: EdgeShape[];
	start?: StartShape;
	/** A box that holds everything that is drawn. */
	bounds: Box;
}
export interface DiagramOptions {
	/** The label of the start arrow, in the language of the page. */
	startLabel?: string;
}

// ---- small helpers ----

const radians = (degrees: number) => (degrees * Math.PI) / 180;
const direction = (degrees: number): Point => ({
	x: Math.cos(radians(degrees)),
	y: Math.sin(radians(degrees))
});
const angleOf = (from: Point, to: Point) =>
	(Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
const add = (p: Point, q: Point, scale = 1): Point => ({
	x: p.x + q.x * scale,
	y: p.y + q.y * scale
});
const unit = (p: Point, q: Point): Point => {
	const length = Math.hypot(q.x - p.x, q.y - p.y);
	return length === 0 ? { x: 1, y: 0 } : { x: (q.x - p.x) / length, y: (q.y - p.y) / length };
};
const round = (n: number) => Math.round(n * 100) / 100;
const rounded = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });
const normalize = (degrees: number) => ((degrees % 360) + 360) % 360;
/** The distance between two angles, from 0 to 180. */
const between = (a: number, b: number) => {
	const d = normalize(a - b);
	return d > 180 ? 360 - d : d;
};

function distanceToSegment(p: Point, a: Point, b: Point): { distance: number; at: Point } {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const length2 = dx * dx + dy * dy;
	const t =
		length2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2));
	const at = { x: a.x + t * dx, y: a.y + t * dy };
	return { distance: Math.hypot(p.x - at.x, p.y - at.y), at };
}

function nearestOnLine(p: Point, points: Point[]): { distance: number; at: Point } {
	let best = { distance: Infinity, at: points[0]! };
	for (let i = 0; i + 1 < points.length; i++) {
		const found = distanceToSegment(p, points[i]!, points[i + 1]!);
		if (found.distance < best.distance) best = found;
	}
	return best;
}

// ---- labels and names ----

/** The size of a label for a text. A character counts as one, also an emoji or a combined one. */
export function labelBox(text: string, charWidth: number): { width: number; height: number } {
	return { width: [...text].length * charWidth + LABEL_PADDING, height: LABEL_HEIGHT };
}

/** How far a box reaches from its center in the direction `normal` (a unit vector). */
const reach = (normal: Point, size: { width: number; height: number }) =>
	(Math.abs(normal.x) * size.width) / 2 + (Math.abs(normal.y) * size.height) / 2;

/** A label next to `anchor`, on the side of `normal`, with its nearest side LABEL_GAP away. */
function placeLabel(text: string, charWidth: number, anchor: Point, normal: Point): LabelShape {
	const size = labelBox(text, charWidth);
	const center = add(anchor, normal, LABEL_GAP + reach(normal, size));
	return {
		text,
		center: rounded(center),
		box: {
			x: round(center.x - size.width / 2),
			y: round(center.y - size.height / 2),
			width: size.width,
			height: size.height
		}
	};
}

/** The name in a circle: full size if it fits, then smaller, then cut with an ellipsis. */
export function stateText(name: string): StateShape['text'] {
	const chars = [...name];
	const size = Math.min(NAME_SIZE.max, NAME_ROOM / (0.6 * Math.max(1, chars.length)));
	if (size >= NAME_SIZE.min) {
		return { content: name, fontSize: Math.floor(size * 10) / 10, truncated: false };
	}
	const fit = Math.floor(NAME_ROOM / (0.6 * NAME_SIZE.min));
	return {
		content: chars.slice(0, fit - 1).join('') + '…',
		fontSize: NAME_SIZE.min,
		truncated: true
	};
}

// ---- angles ----

const CANDIDATES = Array.from({ length: 24 }, (_, i) => -165 + 15 * i);

/**
 * The angle (a multiple of 15) for a self-loop or the start arrow.
 *
 * - With `free` (degrees), an angle whose gap to every busy angle is at least `free` is free, and
 *   the free angle nearest to `preferred` wins. So the start arrow stays on the left as long as
 *   there are `free` degrees of room there, and does not wander.
 * - Otherwise (no angle is free, or `free` is 0), the angle with the biggest gap wins.
 * - A tie goes to the angle nearest to `preferred`, then to the one clockwise of it.
 */
export function pickAngle(busy: number[], preferred: number, free = 0): number {
	const gapOf = (angle: number) =>
		busy.length === 0 ? 360 : Math.min(...busy.map((b) => between(angle, b)));
	const roomy = free > 0 ? CANDIDATES.filter((c) => gapOf(c) >= free) : [];
	const pool = roomy.length > 0 ? roomy : CANDIDATES;
	let best = preferred;
	let bestKey: [number, number, number] | undefined;
	for (const candidate of pool) {
		// Among the free angles only the distance to the preferred one counts.
		const key: [number, number, number] = [
			roomy.length > 0 ? 0 : -gapOf(candidate),
			between(candidate, preferred),
			normalize(candidate - preferred)
		];
		const better =
			bestKey === undefined ||
			key[0] < bestKey[0] ||
			(key[0] === bestKey[0] &&
				(key[1] < bestKey[1] || (key[1] === bestKey[1] && key[2] < bestKey[2])));
		if (better) {
			best = candidate;
			bestKey = key;
		}
	}
	return best + 0;
}

// ---- a spatial index, so that checking an edge against the states stays cheap ----

const CELL = 128;
const MAX_CELLS = 4096;

function makeIndex(states: readonly StateEntry[]) {
	const cells = new Map<string, StateEntry[]>();
	const cellOf = (n: number) => Math.floor(n / CELL);
	for (const s of states) {
		const key = `${cellOf(s.x)},${cellOf(s.y)}`;
		const list = cells.get(key);
		if (list) list.push(s);
		else cells.set(key, [s]);
	}
	/** The states whose cell touches the box. For a huge box it is all of them. */
	return (minX: number, minY: number, maxX: number, maxY: number): readonly StateEntry[] => {
		const x0 = cellOf(minX);
		const x1 = cellOf(maxX);
		const y0 = cellOf(minY);
		const y1 = cellOf(maxY);
		if ((x1 - x0 + 1) * (y1 - y0 + 1) > MAX_CELLS) return states;
		const found: StateEntry[] = [];
		for (let x = x0; x <= x1; x++) {
			for (let y = y0; y <= y1; y++) found.push(...(cells.get(`${x},${y}`) ?? []));
		}
		return found;
	};
}

function pointsBox(points: Point[], margin: number): [number, number, number, number] {
	const xs = points.map((p) => p.x);
	const ys = points.map((p) => p.y);
	return [
		Math.min(...xs) - margin,
		Math.min(...ys) - margin,
		Math.max(...xs) + margin,
		Math.max(...ys) + margin
	];
}

// ---- the edges ----

interface Group {
	from: number;
	to: number;
	symbols: (string | null)[];
}

/** One group per pair of states, with the symbols in the order of the alphabet and ε last. */
function groupTransitions(doc: MachineDocument): Group[] {
	const groups = new Map<string, Group>();
	for (const t of doc.transitions) {
		const key = `${t.from}>${t.to}`;
		const group = groups.get(key);
		if (group) group.symbols.push(t.on);
		else groups.set(key, { from: t.from, to: t.to, symbols: [t.on] });
	}
	const rank = (symbol: string | null) =>
		symbol === null ? Number.MAX_SAFE_INTEGER : doc.alphabet.indexOf(symbol);
	for (const group of groups.values()) group.symbols.sort((a, b) => rank(a) - rank(b));
	return [...groups.values()].sort((a, b) => a.from - b.from || a.to - b.to);
}

const labelText = (symbols: (string | null)[]) => symbols.map((s) => s ?? 'ε').join(', ');

function path(command: string, ...points: Point[]) {
	return `${command} ${points.map((p) => `${round(p.x)} ${round(p.y)}`).join(' ')}`;
}

/**
 * The control distance `c` of a quadratic curve between the centers of two states that is 24 (or
 * `peak`) from the straight line at its middle, when the curve starts and ends on the rims. The
 * middle of the curve is (c + rim offset) / 2 from the line, and the rim offset depends on `c`,
 * so we search for it.
 */
function controlFor(peak: number, halfDistance: number): number {
	const middle = (c: number) => (c + (RADIUS * c) / Math.hypot(halfDistance, c)) / 2;
	let low = 0;
	let high = peak * 4;
	for (let i = 0; i < 40; i++) {
		const c = (low + high) / 2;
		if (middle(c) < peak) low = c;
		else high = c;
	}
	return (low + high) / 2;
}

interface Curve {
	start: Point;
	end: Point;
	points: Point[];
	control: Point;
}

/** A curve between two states on the `side` (1: right of the way, -1: left) with the given peak. */
function curveBetween(a: Point, b: Point, side: 1 | -1, peak: number): Curve {
	const u = unit(a, b);
	const normal = { x: -u.y * side, y: u.x * side };
	const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
	const control = add(mid, normal, controlFor(peak, Math.hypot(b.x - a.x, b.y - a.y) / 2));
	const start = add(a, unit(a, control), RADIUS);
	const end = add(b, unit(b, control), RADIUS);
	const points: Point[] = [];
	for (let i = 0; i <= SAMPLES; i++) {
		const t = i / SAMPLES;
		const s = 1 - t;
		points.push({
			x: s * s * start.x + 2 * s * t * control.x + t * t * end.x,
			y: s * s * start.y + 2 * s * t * control.y + t * t * end.y
		});
	}
	return { start, end, points, control };
}

/**
 * Does the line keep clear of every candidate state, other than `skip` (the circle plus the
 * clearance)? With a `chord` (the straight line between the two states) and a `margin`, states
 * farther from the chord than the margin are skipped without a look at the line: a curve does not
 * bulge farther than its peak.
 */
function clear(
	points: Point[],
	candidates: readonly StateEntry[],
	skip: number[],
	loopStates: Set<number>,
	chord?: { a: Point; b: Point; margin: number }
): boolean {
	for (const s of candidates) {
		if (skip.includes(s.id)) continue;
		if (chord && distanceToSegment(s, chord.a, chord.b).distance > chord.margin) continue;
		const needed = loopStates.has(s.id) ? LOOP_CLEARANCE : RADIUS + CLEARANCE;
		if (nearestOnLine(s, points).distance < needed - 1e-9) return false;
	}
	return true;
}

/**
 * Draws a document. `options.startLabel` is the text of the start arrow ("mulai").
 * The rules are in docs/ux/editor-interactions.md.
 */
export function edgeGeometry(doc: MachineDocument, options: DiagramOptions = {}): DiagramShapes {
	const startLabel = options.startLabel ?? 'mulai';
	const states = doc.states;
	const byId = new Map(states.map((s) => [s.id, s]));
	const index = makeIndex(states);
	const accepting = new Set(doc.accepting);
	const groups = groupTransitions(doc);
	// A state with a self-loop needs more room, so that an edge does not pass through its loop.
	const loopStates = new Set(groups.filter((g) => g.from === g.to).map((g) => g.from));
	const has = (from: number, to: number) => groups.some((g) => g.from === from && g.to === to);

	const edges: EdgeShape[] = [];
	const busy = new Map<number, number[]>(states.map((s) => [s.id, []]));
	const makeBusy = (id: number, angle: number) => busy.get(id)?.push(angle);

	// 1. Edges between two different states.
	for (const group of groups) {
		if (group.from === group.to) continue;
		const a = byId.get(group.from)!;
		const b = byId.get(group.to)!;
		const text = labelText(group.symbols);
		const paired = has(group.to, group.from);

		let shape: EdgeShape | undefined;
		if (!paired) {
			const u = unit(a, b);
			const start = add(a, u, RADIUS);
			const end = add(b, u, -RADIUS);
			const points = [start, end];
			const [x0, y0, x1, y1] = pointsBox(points, LOOP_CLEARANCE);
			if (clear(points, index(x0, y0, x1, y1), [a.id, b.id], loopStates)) {
				const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
				shape = {
					from: a.id,
					to: b.id,
					kind: 'straight',
					path: `${path('M', start)} ${path('L', end)}`,
					start: rounded(start),
					end: rounded(end),
					points: points.map(rounded),
					label: placeLabel(text, MONO_CHAR, mid, { x: u.y, y: -u.x })
				};
			}
		}
		if (shape === undefined) {
			// A curve: an opposite pair always, and an edge that is in the way of a state. The way there
			// bulges to the right of its direction, so the way back bulges to the other side. An edge that
			// is not in a pair may also take the left side, if that needs a smaller bulge.
			const sides: (1 | -1)[] = paired ? [1] : [1, -1];
			// The states that a curve of any peak could touch, found once for the edge.
			const [wx0, wy0, wx1, wy1] = pointsBox([a, b], PEAKS[PEAKS.length - 1]! + LOOP_CLEARANCE);
			const candidates = index(wx0, wy0, wx1, wy1);
			let chosen: { curve: Curve; side: 1 | -1 } | undefined;
			let chosenPeak = Infinity;
			for (const side of sides) {
				for (const peak of PEAKS) {
					if (peak >= chosenPeak) break;
					const curve = curveBetween(a, b, side, peak);
					const margin = peak + LOOP_CLEARANCE + 1;
					if (clear(curve.points, candidates, [a.id, b.id], loopStates, { a, b, margin })) {
						chosen = { curve, side };
						chosenPeak = peak;
						break;
					}
				}
			}
			// If no bulge clears every state, the first one is used (the user can move a state).
			const picked = chosen ?? { curve: curveBetween(a, b, 1, FIRST_PEAK), side: 1 as const };
			const { curve, side } = picked;
			const apex = curve.points[SAMPLES / 2]!;
			const u = unit(a, b);
			shape = {
				from: a.id,
				to: b.id,
				kind: 'curve',
				path: `${path('M', curve.start)} ${path('Q', curve.control, curve.end)}`,
				start: rounded(curve.start),
				end: rounded(curve.end),
				points: curve.points.map(rounded),
				label: placeLabel(text, MONO_CHAR, apex, { x: -u.y * side, y: u.x * side })
			};
		}
		edges.push(shape);
		makeBusy(a.id, angleOf(a, shape.start));
		makeBusy(b.id, angleOf(b, shape.end));
	}

	// 2. An edge that passes close to a state (not its own) is busy at that angle for the state.
	for (const edge of edges) {
		const [x0, y0, x1, y1] = pointsBox(edge.points, NEAR);
		for (const s of index(x0, y0, x1, y1)) {
			if (s.id === edge.from || s.id === edge.to) continue;
			const { distance, at } = nearestOnLine(s, edge.points);
			if (distance < NEAR) makeBusy(s.id, angleOf(s, at));
		}
	}

	// A state that is close also blocks the way, even if no edge goes to it.
	for (const s of states) {
		for (const other of index(s.x - NEIGHBOR, s.y - NEIGHBOR, s.x + NEIGHBOR, s.y + NEIGHBOR)) {
			if (other.id !== s.id && Math.hypot(other.x - s.x, other.y - s.y) < NEIGHBOR) {
				makeBusy(s.id, angleOf(s, other));
			}
		}
	}

	// 3. The start arrow.
	let start: StartShape | undefined;
	const startState = doc.start === null ? undefined : byId.get(doc.start);
	if (startState) {
		const angle = pickAngle(busy.get(startState.id) ?? [], 180, START_FREE_GAP);
		const along = direction(angle);
		const head = add(startState, along, RADIUS);
		const tail = add(startState, along, RADIUS + START_LENGTH);
		start = {
			state: startState.id,
			angle,
			tail: rounded(tail),
			head: rounded(head),
			path: `${path('M', tail)} ${path('L', head)}`,
			label: placeLabel(startLabel, UI_CHAR, tail, along)
		};
		makeBusy(startState.id, angle);
	}

	// 4. Self-loops, which take the free angle.
	const reachControl =
		(8 * (RADIUS + LOOP_REACH) - 2 * RADIUS * Math.cos(radians(30))) / (6 * Math.cos(radians(20)));
	for (const group of groups) {
		if (group.from !== group.to) continue;
		const s = byId.get(group.from)!;
		const angle = pickAngle(busy.get(s.id) ?? [], -90);
		const p1 = add(s, direction(angle - 30), RADIUS);
		const p2 = add(s, direction(angle + 30), RADIUS);
		const q1 = add(s, direction(angle - 20), reachControl);
		const q2 = add(s, direction(angle + 20), reachControl);
		const points: Point[] = [];
		for (let i = 0; i <= SAMPLES; i++) {
			const t = i / SAMPLES;
			const u = 1 - t;
			const weights = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
			points.push({
				x: weights[0]! * p1.x + weights[1]! * q1.x + weights[2]! * q2.x + weights[3]! * p2.x,
				y: weights[0]! * p1.y + weights[1]! * q1.y + weights[2]! * q2.y + weights[3]! * p2.y
			});
		}
		edges.push({
			from: s.id,
			to: s.id,
			kind: 'loop',
			path: `${path('M', p1)} ${path('C', q1, q2, p2)}`,
			start: rounded(p1),
			end: rounded(p2),
			points: points.map(rounded),
			label: placeLabel(
				labelText(group.symbols),
				MONO_CHAR,
				points[SAMPLES / 2]!,
				direction(angle)
			),
			angle
		});
	}
	edges.sort((a, b) => a.from - b.from || a.to - b.to);

	const stateShapes: StateShape[] = states.map((s) => ({
		id: s.id,
		name: s.name,
		x: s.x,
		y: s.y,
		accepting: accepting.has(s.id),
		text: stateText(s.name)
	}));

	// What is drawn must all be inside the bounds.
	const boxes: Box[] = [
		...stateShapes.map((s) => ({
			x: s.x - RADIUS,
			y: s.y - RADIUS,
			width: 2 * RADIUS,
			height: 2 * RADIUS
		})),
		...edges.flatMap((e) => [
			e.label.box,
			...e.points.map((p) => ({ x: p.x, y: p.y, width: 0, height: 0 }))
		])
	];
	if (start) {
		boxes.push(start.label.box, { x: start.tail.x, y: start.tail.y, width: 0, height: 0 });
	}
	return { states: stateShapes, edges, start, bounds: boundsOf(boxes) };
}

function boundsOf(boxes: Box[]): Box {
	if (boxes.length === 0) return { ...EMPTY_BOUNDS };
	const x0 = Math.min(...boxes.map((b) => b.x));
	const y0 = Math.min(...boxes.map((b) => b.y));
	const x1 = Math.max(...boxes.map((b) => b.x + b.width));
	const y1 = Math.max(...boxes.map((b) => b.y + b.height));
	return { x: round(x0), y: round(y0), width: round(x1 - x0), height: round(y1 - y0) };
}
