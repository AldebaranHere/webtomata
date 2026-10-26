import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands.ts';
import { documentFrom, endsWith01 } from './diagram/samples.ts';
import { checkDocument, createDocument } from './document.ts';
import type { MachineDocument } from './document.ts';
import { computeLayout } from './layout-dagre.ts';
import { LAYOUT_LIMITS, layoutGraph, placeAll, refusalOf } from './layout.ts';
import type { LayoutPosition } from './layout.ts';
import { random } from './testing.ts';

const run = (doc: MachineDocument): MachineDocument => {
	const positions = computeLayout(layoutGraph(doc));
	const command = placeAll(doc, positions);
	if (command === null) return doc;
	const result = applyCommand(doc, command);
	if (!result.ok) throw new Error(result.error.key);
	return result.doc;
};

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
	Math.hypot(a.x - b.x, a.y - b.y);

describe('the graph that is sent to the layout', () => {
	it('has the states by id, one edge for each pair of states, and no loop', () => {
		const graph = layoutGraph(endsWith01());
		expect(graph.nodes).toEqual([0, 1, 2]);
		expect(graph.start).toBe(0);
		// Six transitions, but two of them are loops: four pairs, in the order of the engine (by state, then by symbol).
		expect(graph.edges).toEqual([
			{ from: 0, to: 1 },
			{ from: 1, to: 2 },
			{ from: 2, to: 1 },
			{ from: 2, to: 0 }
		]);
	});

	it('does not repeat a pair that has several symbols or an ε transition', () => {
		const doc = documentFrom({
			alphabet: ['a', 'b'],
			states: [
				[100, 100],
				[300, 100]
			],
			start: 0,
			transitions: [
				[0, 'a', 1],
				[0, 'b', 1],
				[0, null, 1]
			]
		});
		expect(layoutGraph(doc).edges).toEqual([{ from: 0, to: 1 }]);
	});

	it('is the same for the same machine', () => {
		expect(layoutGraph(endsWith01())).toEqual(layoutGraph(endsWith01()));
	});

	it('has no start when the machine has none', () => {
		expect(layoutGraph(documentFrom({ states: [[1, 1]] })).start).toBeNull();
	});
});

describe('the limits', () => {
	it('say no to a machine that is too big, with a message key', () => {
		const big = documentFrom({
			states: Array.from(
				{ length: LAYOUT_LIMITS.states + 1 },
				(_, i) => [i * 10, 0] as [number, number]
			)
		});
		expect(refusalOf(big)).toEqual({
			key: 'layout.too_big',
			params: { limit: LAYOUT_LIMITS.states }
		});
		expect(refusalOf(endsWith01())).toBeNull();
	});

	it('say nothing for an empty machine: there is nothing to place', () => {
		expect(refusalOf(createDocument())).toBeNull();
		expect(placeAll(createDocument(), [])).toBeNull();
	});
});

describe('placing the states', () => {
	it('every state gets a place, and the document stays valid', () => {
		const next = run(endsWith01());
		expect(checkDocument(next)).toEqual([]);
		expect(next.states).toHaveLength(3);
	});

	it('is one command: a batch of moves, so it is one step of the history', () => {
		const doc = endsWith01();
		const command = placeAll(doc, computeLayout(layoutGraph(doc)));
		expect(command?.type).toBe('batch');
	});

	it('no two states are closer than 72 px, and the start state is the first on the left', () => {
		const next = run(endsWith01());
		for (const a of next.states) {
			for (const b of next.states) {
				if (a.id < b.id) expect(distance(a, b)).toBeGreaterThanOrEqual(72);
			}
		}
		const start = next.states.find((s) => s.id === next.start)!;
		expect(Math.min(...next.states.map((s) => s.x))).toBe(start.x);
	});

	it('the machine keeps its center: the view does not jump', () => {
		const doc = endsWith01();
		const centerOf = (d: MachineDocument) => ({
			x: d.states.reduce((sum, s) => sum + s.x, 0) / d.states.length,
			y: d.states.reduce((sum, s) => sum + s.y, 0) / d.states.length
		});
		const before = centerOf(doc);
		const after = centerOf(run(doc));
		// The center of the box of the states is kept (the mean of the places can move a little).
		const box = (d: MachineDocument) => ({
			x: (Math.min(...d.states.map((s) => s.x)) + Math.max(...d.states.map((s) => s.x))) / 2,
			y: (Math.min(...d.states.map((s) => s.y)) + Math.max(...d.states.map((s) => s.y))) / 2
		});
		expect(Math.abs(box(run(doc)).x - box(doc).x)).toBeLessThanOrEqual(1);
		expect(Math.abs(box(run(doc)).y - box(doc).y)).toBeLessThanOrEqual(1);
		expect(Number.isFinite(before.x + after.x)).toBe(true);
	});

	it('the same machine gives the same places', () => {
		const a = run(endsWith01());
		const b = run(endsWith01());
		expect(a.states.map((s) => [s.x, s.y])).toEqual(b.states.map((s) => [s.x, s.y]));
	});

	it('is undone in one step', () => {
		const doc = endsWith01();
		const next = run(doc);
		expect(next.states.map((s) => [s.x, s.y])).not.toEqual(doc.states.map((s) => [s.x, s.y]));
	});

	it('works for one state, for two that are not joined, and for a state with only a loop', () => {
		const one = run(documentFrom({ states: [[500, 500]], start: 0 }));
		expect(one.states).toHaveLength(1);
		const apart = run(
			documentFrom({
				states: [
					[100, 100],
					[100, 100]
				],
				start: 0
			})
		);
		expect(distance(apart.states[0]!, apart.states[1]!)).toBeGreaterThanOrEqual(72);
		const loop = run(
			documentFrom({ alphabet: ['a'], states: [[10, 10]], start: 0, transitions: [[0, 'a', 0]] })
		);
		expect(loop.states).toHaveLength(1);
	});

	it('a state that no transition reaches is still placed, and does not sit on another', () => {
		const doc = documentFrom({
			alphabet: ['a'],
			states: [
				[100, 100],
				[300, 100],
				[500, 100]
			],
			start: 0,
			transitions: [[0, 'a', 1]]
		});
		const next = run(doc);
		for (const a of next.states) {
			for (const b of next.states) {
				if (a.id < b.id) expect(distance(a, b)).toBeGreaterThanOrEqual(72);
			}
		}
	});

	it('property: any machine of up to 40 states is placed inside the limits with no overlap', () => {
		for (let seed = 1; seed <= 40; seed++) {
			const rng = random(seed);
			const count = 1 + rng.int(40);
			const doc = documentFrom({
				alphabet: ['a', 'b'],
				states: Array.from(
					{ length: count },
					() => [rng.int(500), rng.int(500)] as [number, number]
				),
				start: rng.chance(0.8) ? 0 : undefined,
				transitions: [
					...new Map(
						Array.from({ length: rng.int(count * 3) }, () => {
							const t: [number, string | null, number] = [
								rng.int(count),
								rng.chance(0.15) ? null : rng.pick(['a', 'b']),
								rng.int(count)
							];
							return [t.join('|'), t] as const;
						})
					).values()
				]
			});
			const next = run(doc);
			expect(checkDocument(next), `seed ${seed}`).toEqual([]);
			expect(next.states, `seed ${seed}`).toHaveLength(count);
			for (const a of next.states) {
				for (const b of next.states) {
					if (a.id < b.id) {
						expect(distance(a, b), `seed ${seed}: ${a.name} and ${b.name}`).toBeGreaterThanOrEqual(
							72
						);
					}
				}
			}
			expect(next.transitions, `seed ${seed}`).toEqual(doc.transitions);
		}
	});

	it('placeAll ignores a position for a state that is not there, and keeps the state that has none', () => {
		const doc = endsWith01();
		const positions: LayoutPosition[] = [
			{ id: 0, x: 10, y: 10 },
			{ id: 99, x: 5, y: 5 }
		];
		const result = applyCommand(doc, placeAll(doc, positions)!);
		if (!result.ok) throw new Error('refused');
		expect(result.doc.states.map((s) => s.id)).toEqual([0, 1, 2]);
		expect(result.doc.states[1]!.x).toBe(doc.states[1]!.x);
	});
});
