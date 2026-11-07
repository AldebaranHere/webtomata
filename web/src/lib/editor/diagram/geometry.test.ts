import { describe, expect, it } from 'vitest';
import { random } from '../testing.ts';
import {
	NAME_ROOM,
	LABEL_GAP,
	RADIUS,
	edgeGeometry,
	labelBox,
	pickAngle,
	stateText
} from './geometry.ts';
import type { Box, DiagramShapes, Point } from './geometry.ts';
import { build, endsWith01 } from './testing.ts';

const near = (actual: number, expected: number, digits = 1) =>
	expect(actual).toBeCloseTo(expected, digits);

const edgeOf = (shapes: DiagramShapes, from: number, to: number) => {
	const edge = shapes.edges.find((e) => e.from === from && e.to === to);
	if (!edge) throw new Error(`no edge ${from} -> ${to}`);
	return edge;
};

function distanceToSegment(p: Point, a: Point, b: Point): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const length2 = dx * dx + dy * dy;
	const t =
		length2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2));
	return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distanceToPolyline(p: Point, points: Point[]): number {
	let best = Infinity;
	for (let i = 0; i + 1 < points.length; i++) {
		best = Math.min(best, distanceToSegment(p, points[i]!, points[i + 1]!));
	}
	return best;
}

const overlap = (a: Box, b: Box) =>
	a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Does the circle of a state (radius RADIUS) touch the box? */
function circleTouches(center: Point, box: Box): boolean {
	const nx = Math.max(box.x, Math.min(center.x, box.x + box.width));
	const ny = Math.max(box.y, Math.min(center.y, box.y + box.height));
	return Math.hypot(center.x - nx, center.y - ny) < RADIUS;
}

describe('labels', () => {
	it('list the symbols in the order of the alphabet, with ε last', () => {
		const doc = build({
			alphabet: ['b', 'a'],
			states: [
				[100, 100],
				[300, 100]
			],
			transitions: [
				[0, null, 1],
				[0, 'a', 1],
				[0, 'b', 1]
			]
		});
		expect(edgeOf(edgeGeometry(doc), 0, 1).label.text).toBe('b, a, ε');
	});

	it('merge the transitions between the same two states into one edge', () => {
		const doc = build({
			alphabet: ['a', 'b'],
			states: [
				[100, 100],
				[300, 100]
			],
			transitions: [
				[0, 'a', 1],
				[0, 'b', 1]
			]
		});
		expect(edgeGeometry(doc).edges).toHaveLength(1);
	});

	it('have a box that grows with the text, counting characters and not code units', () => {
		expect(labelBox('a', 9.6).width).toBeLessThan(labelBox('a, b, c', 9.6).width);
		expect(labelBox('😀', 9.6).width).toBe(labelBox('a', 9.6).width);
	});
});

describe('a straight edge', () => {
	const doc = build({
		alphabet: ['a'],
		states: [
			[100, 100],
			[300, 100]
		],
		transitions: [[0, 'a', 1]]
	});
	const edge = edgeOf(edgeGeometry(doc), 0, 1);

	it('goes from rim to rim', () => {
		expect(edge.kind).toBe('straight');
		near(edge.start.x, 100 + RADIUS);
		near(edge.start.y, 100);
		near(edge.end.x, 300 - RADIUS);
		near(edge.end.y, 100);
	});

	it('has its label above the line (left of the direction of travel), 4 px away', () => {
		near(edge.label.center.x, 200);
		near(edge.label.box.y + edge.label.box.height, 100 - LABEL_GAP);
	});

	it('puts the label on the left of a downward edge, whose left is east', () => {
		const down = build({
			alphabet: ['a'],
			states: [
				[100, 100],
				[100, 300]
			],
			transitions: [[0, 'a', 1]]
		});
		const label = edgeOf(edgeGeometry(down), 0, 1).label;
		near(label.box.x, 100 + LABEL_GAP);
	});
});

describe('opposite edges', () => {
	const doc = build({
		alphabet: ['a', 'b'],
		states: [
			[100, 100],
			[300, 100]
		],
		transitions: [
			[0, 'a', 1],
			[1, 'b', 0]
		]
	});
	const shapes = edgeGeometry(doc);
	const forth = edgeOf(shapes, 0, 1);
	const back = edgeOf(shapes, 1, 0);

	it('are both curves', () => {
		expect(forth.kind).toBe('curve');
		expect(back.kind).toBe('curve');
	});

	it('bulge to opposite sides, by the same distance, with the labels outside', () => {
		// The way there bulges to the right of its direction (down on the screen), the way back up.
		expect(forth.label.center.y).toBeGreaterThan(100);
		expect(back.label.center.y).toBeLessThan(100);
		near(forth.label.center.y - 100, 100 - back.label.center.y);
		// The top of each curve is 24 from the straight line.
		const apex = (e: typeof forth) => e.points[Math.floor(e.points.length / 2)]!;
		near(Math.abs(apex(forth).y - 100), 24);
		near(Math.abs(apex(back).y - 100), 24);
	});

	it('leave and arrive on the rims of the circles', () => {
		for (const edge of [forth, back]) {
			const from = edge.from === 0 ? { x: 100, y: 100 } : { x: 300, y: 100 };
			const to = edge.to === 0 ? { x: 100, y: 100 } : { x: 300, y: 100 };
			near(Math.hypot(edge.start.x - from.x, edge.start.y - from.y), RADIUS);
			near(Math.hypot(edge.end.x - to.x, edge.end.y - to.y), RADIUS);
		}
	});
});

describe('pickAngle (self-loops and the start arrow)', () => {
	it('takes the preferred angle when nothing is busy', () => {
		expect(pickAngle([], -90)).toBe(-90);
		expect(pickAngle([], 180)).toBe(180);
	});

	it('takes the angle with the biggest gap to the busy ones', () => {
		expect(pickAngle([-90], -90)).toBe(90);
		expect(pickAngle([0], 180)).toBe(180);
		expect(pickAngle([180], 180)).toBe(0);
	});

	it('breaks a tie by the distance to the preferred angle, then clockwise', () => {
		// 0 and 180 are equally free and equally far from the top; clockwise from the top is 0.
		expect(pickAngle([-90, 90], -90)).toBe(0);
	});

	it('keeps the preferred angle while it has enough room, when asked for a free gap', () => {
		// An edge arrives at 145 degrees from the left side: there is still 90 or more.
		expect(pickAngle([0, -35], 180, 90)).toBe(180);
		// With less room than that, the angle with the biggest gap wins, as without a free gap.
		expect(pickAngle([0, -35, 90], 180, 120)).toBe(pickAngle([0, -35, 90], 180));
		// An edge from the left: the angle nearest to the left that has 90 of room is the top.
		expect(pickAngle([180], 180, 90)).toBe(-90);
	});

	it('is the same for the same input, whatever the order of the busy angles', () => {
		expect(pickAngle([10, 200, -80], -90)).toBe(pickAngle([-80, 10, 200], -90));
	});
});

describe('a self-loop', () => {
	it('is on top by default, reaches 40 above the rim, and has its label above', () => {
		const doc = build({ alphabet: ['a'], states: [[200, 200]], transitions: [[0, 'a', 0]] });
		const edge = edgeOf(edgeGeometry(doc), 0, 0);
		expect(edge.kind).toBe('loop');
		expect(edge.angle).toBe(-90);
		const top = Math.min(...edge.points.map((p) => p.y));
		near(top, 200 - RADIUS - 40, 0);
		near(edge.label.box.y + edge.label.box.height, top - LABEL_GAP, 0);
		near(edge.label.center.x, 200, 0);
	});

	it('turns away from a busy top', () => {
		// A neighbor straight above, with an edge to it: the loop goes to the free side.
		const doc = build({
			alphabet: ['a'],
			states: [
				[200, 200],
				[200, 20]
			],
			transitions: [
				[0, 'a', 0],
				[0, 'a', 1]
			]
		});
		expect(edgeOf(edgeGeometry(doc), 0, 0).angle).toBe(90);
	});

	it('keeps away from the start arrow too', () => {
		const doc = build({
			alphabet: ['a'],
			states: [
				[200, 200],
				[200, 20]
			],
			start: 0,
			transitions: [
				[0, 'a', 0],
				[0, 'a', 1]
			]
		});
		const shapes = edgeGeometry(doc);
		const loop = edgeOf(shapes, 0, 0).angle!;
		const start = shapes.start!.angle;
		const circular = Math.abs(((loop - start + 540) % 360) - 180);
		expect(circular).toBeGreaterThanOrEqual(60);
	});
});

function triangleVertices(path: string): [Point, Point, Point] {
	const match = /^M ([\d.-]+) ([\d.-]+) L ([\d.-]+) ([\d.-]+) L ([\d.-]+) ([\d.-]+) Z$/.exec(path);
	if (!match) throw new Error(`invalid triangle path: ${path}`);
	return [
		{ x: parseFloat(match[1]!), y: parseFloat(match[2]!) },
		{ x: parseFloat(match[3]!), y: parseFloat(match[4]!) },
		{ x: parseFloat(match[5]!), y: parseFloat(match[6]!) }
	];
}

/** Minimum distance between a segment [a, b] and an axis-aligned box. */
function distanceSegmentToBox(a: Point, b: Point, box: Box): number {
	const corners: Point[] = [
		{ x: box.x, y: box.y },
		{ x: box.x + box.width, y: box.y },
		{ x: box.x + box.width, y: box.y + box.height },
		{ x: box.x, y: box.y + box.height }
	];
	const boxEdges: [Point, Point][] = [
		[corners[0]!, corners[1]!],
		[corners[1]!, corners[2]!],
		[corners[2]!, corners[3]!],
		[corners[3]!, corners[0]!]
	];
	const min = Math.min(
		...corners.map((c) => distanceToSegment(c, a, b)),
		...boxEdges.flatMap(([p, q]) => [distanceToSegment(a, p, q), distanceToSegment(b, p, q)])
	);
	return min;
}

describe('the start marker triangle', () => {
	it('AC1: tip on rim at 180°, base 28 further out, 36 wide, perpendicular to axis', () => {
		const doc = build({ states: [[200, 200]], start: 0 });
		const start = edgeGeometry(doc).start!;
		expect(start.angle).toBe(180);
		expect(start.head).toEqual({ x: 168, y: 200 });
		expect(start.tail).toEqual({ x: 140, y: 200 });
		expect(start.path).toMatch(/^M 168 200 L 140 (182|218) L 140 (218|182) Z$/);
		expect(start.label.text).toBe('mulai');
		near(start.label.box.x + start.label.box.width, start.tail.x - LABEL_GAP);
		near(start.label.center.y, 200);
	});

	it('AC2: loops over the 24 candidate angles', () => {
		const center = { x: 500, y: 500 };
		const candidates = Array.from({ length: 24 }, (_, i) => -165 + 15 * i);

		for (const targetAngle of candidates) {
			// Place neighbor states at the other 23 angles to force pickAngle to select targetAngle.
			const neighborStates: [number, number][] = candidates
				.filter((a) => a !== targetAngle)
				.map((a) => {
					const rad = (a * Math.PI) / 180;
					return [
						Math.round(center.x + 100 * Math.cos(rad)),
						Math.round(center.y + 100 * Math.sin(rad))
					];
				});

			const doc = build({
				states: [[center.x, center.y], ...neighborStates],
				start: 0
			});

			const start = edgeGeometry(doc).start!;
			expect(start.angle).toBe(targetAngle);

			const [tip, c1, c2] = triangleVertices(start.path);

			// 1. Tip on rim: distance from center is RADIUS (32)
			near(Math.hypot(tip.x - center.x, tip.y - center.y), RADIUS, 1);
			near(start.head.x, tip.x, 1);
			near(start.head.y, tip.y, 1);

			// 2. Base center at RADIUS + 28 (60)
			near(Math.hypot(start.tail.x - center.x, start.tail.y - center.y), RADIUS + 28, 1);
			near((c1.x + c2.x) / 2, start.tail.x, 1);
			near((c1.y + c2.y) / 2, start.tail.y, 1);

			// 3. Base width is 36, corners symmetric about axis
			near(Math.hypot(c1.x - c2.x, c1.y - c2.y), 36, 1);
			near(Math.hypot(c1.x - tip.x, c1.y - tip.y), Math.hypot(c2.x - tip.x, c2.y - tip.y), 1);

			// 4. Label box touches neither triangle (grown by 2) nor state circle
			expect(circleTouches(center, start.label.box)).toBe(false);

			const triangleEdges: [Point, Point][] = [
				[tip, c1],
				[c1, c2],
				[c2, tip]
			];
			for (const [p, q] of triangleEdges) {
				expect(distanceSegmentToBox(p, q, start.label.box)).toBeGreaterThan(2);
			}
		}
	});

	it('moves to the nearest side that has room when an edge arrives from the left', () => {
		const doc = build({
			alphabet: ['a'],
			states: [
				[100, 200],
				[300, 200]
			],
			start: 1,
			transitions: [[0, 'a', 1]]
		});
		// 90 degrees from the arriving edge, as near to the left as possible: the top.
		expect(edgeGeometry(doc).start!.angle).toBe(-90);
	});

	it('is absent when there is no start state', () => {
		expect(edgeGeometry(build({ states: [[100, 100]] })).start).toBeUndefined();
	});
});

describe('an edge in the way of a state', () => {
	const line = (extra: [number, string | null, number][] = []) =>
		build({
			alphabet: ['a'],
			states: [
				[0, 0],
				[200, 0],
				[400, 0]
			],
			transitions: [[0, 'a', 2], ...extra]
		});

	it('curves until it clears the state by at least 8 px beyond the circle', () => {
		const edge = edgeOf(edgeGeometry(line()), 0, 2);
		expect(edge.kind).toBe('curve');
		expect(distanceToPolyline({ x: 200, y: 0 }, edge.points)).toBeGreaterThanOrEqual(RADIUS + 8);
	});

	it('does not curve an edge that does not pass a state', () => {
		const shapes = edgeGeometry(line([[0, 'a', 1]]));
		expect(edgeOf(shapes, 0, 1).kind).toBe('straight');
	});

	it('curves both ways of an opposite pair around the state, on opposite sides', () => {
		const shapes = edgeGeometry(line([[2, 'a', 0]]));
		const forth = edgeOf(shapes, 0, 2);
		const back = edgeOf(shapes, 2, 0);
		for (const edge of [forth, back]) {
			expect(distanceToPolyline({ x: 200, y: 0 }, edge.points)).toBeGreaterThanOrEqual(RADIUS + 8);
		}
		const side = (e: typeof forth) => Math.sign(e.points[Math.floor(e.points.length / 2)]!.y);
		expect(side(forth)).toBe(-side(back));
	});

	it('keeps room for the loop of a state that it passes, on both sides (100 from its center)', () => {
		const doc = build({
			alphabet: ['a'],
			states: [
				[0, 0],
				[200, 0],
				[400, 0]
			],
			transitions: [
				[0, 'a', 2],
				[2, 'a', 0],
				[1, 'a', 1]
			]
		});
		const shapes = edgeGeometry(doc);
		for (const edge of [edgeOf(shapes, 0, 2), edgeOf(shapes, 2, 0)]) {
			expect(distanceToPolyline({ x: 200, y: 0 }, edge.points)).toBeGreaterThanOrEqual(100);
		}
		// The loop is on top again, because neither arc is in its way.
		expect(edgeOf(shapes, 1, 1).angle).toBe(-90);
	});

	it('is passed by a self-loop, which takes the free side', () => {
		// The long edge arcs over q1 (it bulges down for a way to the right); q1 has a loop.
		const doc = build({
			alphabet: ['a'],
			states: [
				[0, 0],
				[200, 0],
				[400, 0]
			],
			transitions: [
				[0, 'a', 2],
				[1, 'a', 1]
			]
		});
		const shapes = edgeGeometry(doc);
		const arc = edgeOf(shapes, 0, 2);
		const loop = edgeOf(shapes, 1, 1);
		const arcDown = arc.points[Math.floor(arc.points.length / 2)]!.y > 0;
		// The loop is on the other side of the arc, and far from it.
		expect(loop.angle).toBe(arcDown ? -90 : 90);
		for (const p of loop.points) {
			expect(distanceToPolyline(p, arc.points)).toBeGreaterThan(8);
		}
	});
});

describe('the names of states', () => {
	it('keep the full size when they are short', () => {
		expect(stateText('q0')).toEqual({ content: 'q0', fontSize: 16, truncated: false });
	});

	it('shrink when they are longer, and are cut with an ellipsis when they still do not fit', () => {
		expect(stateText('abcde').fontSize).toBeLessThan(16);
		const long = stateText('x'.repeat(32));
		expect(long.fontSize).toBe(11);
		expect(long.truncated).toBe(true);
		expect(long.content.endsWith('…')).toBe(true);
		expect(long.content.length).toBeLessThan(10);
	});

	it('fit inside the inner circle of an accepting state', () => {
		for (const name of ['q0', 'abcd', 'abcdef']) {
			const { content, fontSize } = stateText(name);
			expect([...content].length * fontSize * 0.6).toBeLessThanOrEqual(NAME_ROOM + 1e-9);
		}
	});

	it('are in the shapes with the id and the full name', () => {
		const doc = build({ states: [[100, 100, 'x'.repeat(32)]] });
		const [shape] = edgeGeometry(doc).states;
		expect(shape!.name).toBe('x'.repeat(32));
		expect(shape!.text.truncated).toBe(true);
	});
});

describe('the whole drawing', () => {
	it('marks accepting states', () => {
		const shapes = edgeGeometry(endsWith01());
		expect(shapes.states.map((s) => s.accepting)).toEqual([false, false, true]);
	});

	it('has bounds that hold every circle, every label and the start marker triangle', () => {
		const shapes = edgeGeometry(endsWith01());
		const { bounds } = shapes;
		const inside = (box: Box) =>
			box.x >= bounds.x - 1e-6 &&
			box.y >= bounds.y - 1e-6 &&
			box.x + box.width <= bounds.x + bounds.width + 1e-6 &&
			box.y + box.height <= bounds.y + bounds.height + 1e-6;
		for (const s of shapes.states) {
			expect(
				inside({ x: s.x - RADIUS, y: s.y - RADIUS, width: 2 * RADIUS, height: 2 * RADIUS })
			).toBe(true);
		}
		for (const e of shapes.edges) expect(inside(e.label.box)).toBe(true);
		expect(inside(shapes.start!.label.box)).toBe(true);
		for (const v of triangleVertices(shapes.start!.path)) {
			expect(inside({ x: v.x, y: v.y, width: 0, height: 0 })).toBe(true);
		}
		for (const e of shapes.edges)
			for (const p of e.points) expect(inside({ x: p.x, y: p.y, width: 0, height: 0 })).toBe(true);
	});

	it('has a default size for an empty document', () => {
		expect(edgeGeometry(build({ states: [] })).bounds).toEqual({
			x: 0,
			y: 0,
			width: 400,
			height: 240
		});
	});

	it('is the same whatever the order in which the transitions were added', () => {
		const transitions: [number, string | null, number][] = [
			[0, 'a', 1],
			[1, 'a', 0],
			[1, 'b', 1],
			[0, 'b', 2],
			[2, 'a', 2]
		];
		const make = (list: typeof transitions) =>
			build({
				alphabet: ['a', 'b'],
				states: [
					[100, 100],
					[300, 100],
					[200, 260]
				],
				start: 0,
				transitions: list
			});
		const first = JSON.stringify(edgeGeometry(make(transitions)));
		const second = JSON.stringify(edgeGeometry(make([...transitions].reverse())));
		expect(second).toBe(first);
	});

	it('draws the wireframe machine with no edge through a state and the loops clear of the arc', () => {
		const shapes = edgeGeometry(endsWith01());
		const q1 = { x: 380, y: 200 };
		for (const e of shapes.edges) {
			if (e.from === 1 || e.to === 1) continue;
			expect(distanceToPolyline(q1, e.points)).toBeGreaterThanOrEqual(RADIUS + 8);
		}
	});

	it('draws 200 states and 421 edges between neighbors quickly (9 ms measured)', () => {
		const states: [number, number][] = [];
		for (let i = 0; i < 200; i++) states.push([(i % 20) * 120, Math.floor(i / 20) * 120]);
		const rng = random(7);
		const transitions: [number, string | null, number][] = [];
		for (let i = 0; i < 200; i++) {
			if (i % 20 !== 19) transitions.push([i, 'a', i + 1]);
			if (i + 20 < 200) transitions.push([i, 'a', i + 20]);
			if (i % 20 !== 19 && rng.chance(0.3)) transitions.push([i + 1, 'a', i]);
		}
		const doc = build({ alphabet: ['a'], states, start: 0, transitions });
		const started = performance.now();
		const shapes = edgeGeometry(doc);
		const took = performance.now() - started;
		expect(shapes.edges.length).toBe(transitions.length);
		expect(took).toBeLessThan(100);
	});

	it('draws the worst case, 600 random edges across 200 states, in well under a second (96 ms measured)', () => {
		// Long edges across a dense grid can never clear every state. Each one tries every bulge.
		const states: [number, number][] = [];
		for (let i = 0; i < 200; i++) states.push([(i % 20) * 120, Math.floor(i / 20) * 120]);
		const rng = random(7);
		const seen = new Set<string>();
		const transitions: [number, string | null, number][] = [];
		while (transitions.length < 600) {
			const from = rng.int(200);
			const to = rng.int(200);
			if (seen.has(`${from}>${to}`)) continue;
			seen.add(`${from}>${to}`);
			transitions.push([from, 'a', to]);
		}
		const doc = build({ alphabet: ['a'], states, start: 0, transitions });
		const started = performance.now();
		const shapes = edgeGeometry(doc);
		const took = performance.now() - started;
		expect(shapes.edges.length).toBe(600);
		// A generous bound, to catch an accident (every edge checked against every state).
		expect(took).toBeLessThan(1000);
	});
});

describe('no two labels overlap, and no label covers a state (random machines on a grid)', () => {
	// States on a grid of 130, edges only between neighbors (up, down, left, right) so that no edge
	// passes a state, loops and opposite pairs included. Longer edges that pass a state are covered
	// by the tests above. At most two symbols on an edge: a label is not wrapped, and one that is
	// wider than the 66 px between two circles (three symbols are 75 px) cannot fit; the user moves
	// a state (docs/ux/editor-interactions.md).
	it('holds for 300 random machines', () => {
		for (let seed = 1; seed <= 300; seed++) {
			const rng = random(seed);
			const cells: [number, number][] = [];
			for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) cells.push([x, y]);
			const count = 2 + rng.int(5);
			const chosen: [number, number][] = [];
			while (chosen.length < count) {
				const cell = rng.pick(cells);
				if (!chosen.includes(cell)) chosen.push(cell);
			}
			const alphabet = ['a', 'b', 'c'].slice(0, 1 + rng.int(3));
			const transitions: [number, string | null, number][] = [];
			for (let k = 0; k < 4 + rng.int(8); k++) {
				const from = rng.int(count);
				const to = rng.chance(0.2)
					? from
					: chosen.findIndex(
							(c) =>
								Math.abs(c[0] - chosen[from]![0]) + Math.abs(c[1] - chosen[from]![1]) === 1 &&
								rng.chance(0.7)
						);
				if (to < 0) continue;
				transitions.push([from, rng.chance(0.15) ? null : rng.pick(alphabet), to]);
			}
			const unique = [...new Map(transitions.map((t) => [t.join('|'), t])).values()].filter(
				(t, i, all) => all.slice(0, i).filter((u) => u[0] === t[0] && u[2] === t[2]).length < 2
			);
			const doc = build({
				alphabet,
				states: chosen.map(([x, y]) => [100 + 130 * x, 100 + 130 * y]),
				start: rng.chance(0.8) ? rng.int(count) : undefined,
				accepting: rng.chance(0.5) ? [rng.int(count)] : [],
				transitions: unique
			});
			const shapes = edgeGeometry(doc);
			const labels = [...shapes.edges.map((e) => e.label.box)];
			if (shapes.start) labels.push(shapes.start.label.box);
			const where = `seed ${seed}`;
			for (let i = 0; i < labels.length; i++) {
				for (let j = i + 1; j < labels.length; j++) {
					expect(overlap(labels[i]!, labels[j]!), `${where}: labels ${i} and ${j}`).toBe(false);
				}
				for (const s of shapes.states) {
					expect(
						circleTouches({ x: s.x, y: s.y }, labels[i]!),
						`${where}: label ${i} on a state`
					).toBe(false);
				}
			}
		}
	});
});

import { createHash } from 'node:crypto';
import fsmBaseline from './__fixtures__/fsm-shapes.json' with { type: 'json' };
import { LINE_PITCH, diagramGeometry, fsmDiagram, labelLineY, overflowTarget } from './geometry.ts';
import type { DiagramInput, LabelShape } from './geometry.ts';

function stripLines(shapes: DiagramShapes): unknown {
	const stripLabel = (label: LabelShape) => ({
		text: label.text,
		center: label.center,
		box: label.box
	});
	return {
		states: shapes.states,
		edges: shapes.edges.map((e) => ({
			...e,
			label: stripLabel(e.label)
		})),
		...(shapes.start !== undefined
			? {
					start: {
						...shapes.start,
						label: stripLabel(shapes.start.label)
					}
				}
			: {}),
		bounds: shapes.bounds
	};
}

describe('multi-line labels and DiagramInput (T-039)', () => {
	it('F1: straight edge with three lines has box 94.4 × 56 at (102.8, -60) and line centers -50, -32, -14', () => {
		expect(LINE_PITCH).toBe(18);
		const input: DiagramInput = {
			states: [
				{ id: 0, name: 'q0', x: 0, y: 0 },
				{ id: 1, name: 'q1', x: 300, y: 0 }
			],
			start: null,
			accepting: [],
			edges: [
				{
					from: 0,
					to: 1,
					lines: ['ε / ε / ε', 'a / ε / A', 'b / ε / B']
				}
			]
		};
		const shapes = diagramGeometry(input);
		const edge = edgeOf(shapes, 0, 1);
		expect(edge.kind).toBe('straight');
		expect(edge.label.lines).toEqual(['ε / ε / ε', 'a / ε / A', 'b / ε / B']);
		expect(edge.label.text).toBe('ε / ε / ε; a / ε / A; b / ε / B');
		expect(edge.label.center).toEqual({ x: 150, y: -32 });
		expect(edge.label.box.x).toBeCloseTo(102.8, 10);
		expect(edge.label.box.y).toBe(-60);
		expect(edge.label.box.width).toBeCloseTo(94.4, 10);
		expect(edge.label.box.height).toBe(56);
		expect(edge.label.box.y + edge.label.box.height).toBe(-4);
		const lineCenters = [0, 1, 2].map((i) => edge.label.box.y + 10 + LINE_PITCH * i);
		expect(lineCenters).toEqual([-50, -32, -14]);
	});

	it('F2: loop with three lines at (200, 300) grows upward with bottom 4 px above loop apex (228)', () => {
		// Confirm from the existing one-line loop test at (200, 300): apex y is 300 - 32 - 40 = 228.
		const oneLineLoop = edgeOf(
			edgeGeometry(build({ alphabet: ['a'], states: [[200, 300]], transitions: [[0, 'a', 0]] })),
			0,
			0
		);
		const apexY = Math.min(...oneLineLoop.points.map((p) => p.y));
		expect(apexY).toBe(228);

		const input: DiagramInput = {
			states: [{ id: 0, name: 'q0', x: 200, y: 300 }],
			start: null,
			accepting: [],
			edges: [
				{
					from: 0,
					to: 0,
					lines: ['ε / ε / ε', 'a / ε / A', 'b / ε / B']
				}
			]
		};
		const shapes = diagramGeometry(input);
		const loop = edgeOf(shapes, 0, 0);
		expect(loop.kind).toBe('loop');
		expect(loop.angle).toBe(-90);
		expect(loop.label.box.x).toBeCloseTo(152.8, 10);
		expect(loop.label.box.y).toBe(168);
		expect(loop.label.box.width).toBeCloseTo(94.4, 10);
		expect(loop.label.box.height).toBe(56);
		expect(loop.label.box.y + loop.label.box.height).toBe(apexY - LABEL_GAP);
		expect(loop.label.center).toEqual({ x: 200, y: 196 });
		const lineCenters = [0, 1, 2].map((i) => loop.label.box.y + 10 + LINE_PITCH * i);
		expect(lineCenters).toEqual([178, 196, 214]);
	});

	it('F7: edgeGeometry for endsWith01 and 300 random FSMs matches the recorded baseline apart from lines', () => {
		expect(typeof fsmDiagram).toBe('function');

		const sampleShapes = edgeGeometry(endsWith01());
		for (const e of sampleShapes.edges) {
			expect(e.label.lines).toEqual([e.label.text]);
		}
		expect(sampleShapes.start?.label.lines).toEqual([sampleShapes.start?.label.text]);
		expect(stripLines(sampleShapes)).toEqual(fsmBaseline.samples.endsWith01);

		for (let seed = 1; seed <= 300; seed++) {
			const rng = random(seed);
			const cells: [number, number][] = [];
			for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) cells.push([x, y]);
			const count = 2 + rng.int(5);
			const chosen: [number, number][] = [];
			while (chosen.length < count) {
				const cell = rng.pick(cells);
				if (!chosen.includes(cell)) chosen.push(cell);
			}
			const alphabet = ['a', 'b', 'c'].slice(0, 1 + rng.int(3));
			const transitions: [number, string | null, number][] = [];
			for (let k = 0; k < 4 + rng.int(8); k++) {
				const from = rng.int(count);
				const to = rng.chance(0.2)
					? from
					: chosen.findIndex(
							(c) =>
								Math.abs(c[0] - chosen[from]![0]) + Math.abs(c[1] - chosen[from]![1]) === 1 &&
								rng.chance(0.7)
						);
				if (to < 0) continue;
				transitions.push([from, rng.chance(0.15) ? null : rng.pick(alphabet), to]);
			}
			const unique = [...new Map(transitions.map((t) => [t.join('|'), t])).values()].filter(
				(t, i, all) => all.slice(0, i).filter((u) => u[0] === t[0] && u[2] === t[2]).length < 2
			);
			const doc = build({
				alphabet,
				states: chosen.map(([x, y]) => [100 + 130 * x, 100 + 130 * y]),
				start: rng.chance(0.8) ? rng.int(count) : undefined,
				accepting: rng.chance(0.5) ? [rng.int(count)] : [],
				transitions: unique
			});
			const shapes = edgeGeometry(doc);
			for (const e of shapes.edges) {
				expect(e.label.lines).toEqual([e.label.text]);
			}
			if (shapes.start) {
				expect(shapes.start.label.lines).toEqual([shapes.start.label.text]);
			}
			const strippedJson = JSON.stringify(stripLines(shapes));
			const hash = createHash('sha256').update(strippedJson).digest('hex');
			expect(hash, `seed ${seed}`).toBe(fsmBaseline.randomHashes[seed - 1]);
		}
	});

	it('AC6: labelLineY pure helper gives the exact y positions for one-, two- and three-line labels', () => {
		expect(typeof labelLineY).toBe('function');

		// 1. One-line FSM edge: lines has 1 element equal to text, and y at index 0 equals center.y
		const fsmShapes = edgeGeometry(
			build({
				alphabet: ['a', 'b'],
				states: [
					[0, 0],
					[300, 0]
				],
				transitions: [
					[0, 'a', 1],
					[0, 'b', 1]
				]
			})
		);
		const fsmEdge = edgeOf(fsmShapes, 0, 1);
		expect(fsmEdge.label.lines).toEqual(['a, b']);
		expect(fsmEdge.label.text).toBe('a, b');
		expect(labelLineY(fsmEdge.label.box, 0)).toBe(fsmEdge.label.center.y);

		// 2. One-line PDA edge
		const oneLinePdaShapes = diagramGeometry({
			states: [
				{ id: 0, name: 'q0', x: 0, y: 0 },
				{ id: 1, name: 'q1', x: 300, y: 0 }
			],
			start: null,
			accepting: [],
			edges: [{ from: 0, to: 1, lines: ['a / ε / A'] }]
		});
		const oneLinePdaEdge = edgeOf(oneLinePdaShapes, 0, 1);
		expect(oneLinePdaEdge.label.lines).toEqual(['a / ε / A']);
		expect(labelLineY(oneLinePdaEdge.label.box, 0)).toBe(oneLinePdaEdge.label.center.y);

		// 3. Three-line PDA edge (F1): y values are -50, -32, -14
		const threeLineShapes = diagramGeometry({
			states: [
				{ id: 0, name: 'q0', x: 0, y: 0 },
				{ id: 1, name: 'q1', x: 300, y: 0 }
			],
			start: null,
			accepting: [],
			edges: [
				{
					from: 0,
					to: 1,
					lines: ['ε / ε / ε', 'a / ε / A', 'b / ε / B'],
					text: 'ε / ε / ε; a / ε / A; b / ε / B; c / ε / C'
				}
			]
		});
		const threeLineEdge = edgeOf(threeLineShapes, 0, 1);
		expect(threeLineEdge.label.lines.map((_, i) => labelLineY(threeLineEdge.label.box, i))).toEqual(
			[-50, -32, -14]
		);
		expect(threeLineEdge.label.text).toBe('ε / ε / ε; a / ε / A; b / ε / B; c / ε / C');
	});

	describe('overflowTarget and overflow (T-053)', () => {
		it('F1: calculates overflow target 44px high centered on the last line', () => {
			// 3-line box from T-039 F1
			const threeLineLabel: LabelShape = {
				text: 'ε / ε / ε; a / ε / A; + 2 lagi',
				lines: ['ε / ε / ε', 'a / ε / A', '+ 2 lagi'],
				center: { x: 150, y: -32 },
				box: { x: 102.8, y: -60, width: 94.4, height: 56 },
				overflow: true
			};
			expect(labelLineY(threeLineLabel.box, 2)).toBe(-14);
			expect(overflowTarget(threeLineLabel)).toEqual({
				x: 102.8,
				y: -36,
				width: 94.4,
				height: 44
			});

			// 2-line box with overflow
			const twoLineLabel: LabelShape = {
				text: 'line 1; + 1 lagi',
				lines: ['line 1', '+ 1 lagi'],
				center: { x: 150, y: 19 },
				box: { x: 100, y: 0, width: 90, height: 38 },
				overflow: true
			};
			expect(labelLineY(twoLineLabel.box, 1)).toBe(28);
			expect(overflowTarget(twoLineLabel)).toEqual({
				x: 100,
				y: 6,
				width: 90,
				height: 44
			});

			// Label without overflow returns null
			const noOverflowLabel: LabelShape = {
				text: 'line 1; line 2',
				lines: ['line 1', 'line 2'],
				center: { x: 150, y: 19 },
				box: { x: 100, y: 0, width: 90, height: 38 }
			};
			expect(overflowTarget(noOverflowLabel)).toBeNull();

			// Narrow label (width < 44)
			const narrowLabel: LabelShape = {
				text: '+',
				lines: ['+'],
				center: { x: 10, y: 10 },
				box: { x: 5, y: 0, width: 17.6, height: 20 },
				overflow: true
			};
			expect(labelLineY(narrowLabel.box, 0)).toBe(10);
			expect(overflowTarget(narrowLabel)).toEqual({
				x: 5,
				y: -12,
				width: 17.6,
				height: 44
			});

			// Narrow FSM label has no overflow, so it is null
			const fsmNarrow: LabelShape = {
				text: 'a',
				lines: ['a'],
				center: { x: 10, y: 10 },
				box: { x: 5, y: 0, width: 17.6, height: 20 }
			};
			expect(overflowTarget(fsmNarrow)).toBeNull();
		});

		it('F1/F3: diagramGeometry propagates overflow to LabelShape, omitted for FSM', () => {
			const input: DiagramInput = {
				states: [
					{ id: 0, name: 'q0', x: 0, y: 0 },
					{ id: 1, name: 'q1', x: 300, y: 0 }
				],
				start: null,
				accepting: [],
				edges: [
					{
						from: 0,
						to: 1,
						lines: ['a', 'b', '+ 2 lagi'],
						overflow: true
					}
				]
			};
			const shapes = diagramGeometry(input);
			const edge = edgeOf(shapes, 0, 1);
			expect(edge.label.overflow).toBe(true);

			// FSM document through edgeGeometry has no overflow key on any label
			const fsmShapes = edgeGeometry(endsWith01());
			for (const e of fsmShapes.edges) {
				expect('overflow' in e.label).toBe(false);
			}
		});
	});
});
