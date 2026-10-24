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

describe('the start arrow', () => {
	it('comes from the left, 40 long, with "mulai" at its tail', () => {
		const doc = build({ states: [[200, 200]], start: 0 });
		const start = edgeGeometry(doc).start!;
		expect(start.angle).toBe(180);
		near(start.tail.x, 200 - RADIUS - 40);
		near(start.head.x, 200 - RADIUS);
		near(start.label.box.x + start.label.box.width, start.tail.x - LABEL_GAP);
		expect(start.label.text).toBe('mulai');
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

	it('has bounds that hold every circle, every label and the start arrow', () => {
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
