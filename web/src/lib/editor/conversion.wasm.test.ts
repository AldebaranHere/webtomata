// The conversions against the real engine (the WASM module: `pnpm build:wasm`): the frames that the
// page steps through must end at the machine that the engine returned, whatever the machine is.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import init, * as wasm from '../engine/wasm/engine_wasm.js';
import type { Machine } from '../engine/types.ts';
import { documentFrom } from './diagram/samples.ts';
import type { Spec } from './diagram/samples.ts';
import type { MachineDocument } from './document.ts';
import { toMachine } from './document.ts';
import {
	frameAt,
	namesOf,
	refusalOf,
	resultDocument,
	runConversion,
	secondRefusalOf,
	setText
} from './conversion.ts';
import type { ConvertEngine, ConvertOp, ConvertRun } from './conversion.ts';
import { random } from './testing.ts';

beforeAll(async () => {
	const bytes = readFileSync(new URL('../engine/wasm/engine_wasm_bg.wasm', import.meta.url));
	await init({ module_or_path: bytes });
});

const call =
	(name: 'determinize' | 'minimize' | 'addTrapState' | 'complement') => async (machine: Machine) =>
		JSON.parse(wasm[name](JSON.stringify(machine)));
const engine: ConvertEngine = {
	determinize: call('determinize'),
	minimize: call('minimize'),
	addTrapState: call('addTrapState'),
	complement: call('complement'),
	union: async (first, second) =>
		JSON.parse(wasm.union(JSON.stringify(first), JSON.stringify(second)))
};

async function finished(
	doc: MachineDocument,
	op: ConvertOp,
	second?: MachineDocument
): Promise<ConvertRun> {
	const outcome = await runConversion(engine, doc, op, second);
	if (outcome.kind !== 'finished') throw new Error(`${op}: ${outcome.kind}`);
	return outcome.run;
}

/** The same machine, whatever order the lists are in. */
const normal = (m: Machine) => ({
	...m,
	states: [...m.states].sort((a, b) => a - b),
	accepting: [...m.accepting].sort((a, b) => a - b),
	transitions: [...m.transitions].sort(
		(a, b) => a.from - b.from || (a.on ?? '').localeCompare(b.on ?? '') || a.to - b.to
	)
});

const lastFrame = (run: ConvertRun) => frameAt(run, namesOf(run, 'jebakan'), run.trace.length - 1);

/** A document of a type (documentFrom makes a DFSM). */
const of = (spec: Spec, kind: 'dfsm' | 'ndfsm' = 'dfsm'): MachineDocument => ({
	...documentFrom(spec),
	kind
});

// q0 -a-> q0,q1; q1 -ε-> q2; q2 -b-> q2; q2 accepts.
const ndfsm: Spec = {
	title: 'N',
	alphabet: ['a', 'b'],
	states: [
		[100, 100, 'q0'],
		[300, 100, 'q1'],
		[500, 100, 'q2']
	],
	start: 0,
	accepting: [2],
	transitions: [
		[0, 'a', 0],
		[0, 'a', 1],
		[1, null, 2],
		[2, 'b', 2]
	]
};
// A complete DFSM with two states that act alike (q1 and q2).
const redundant: Spec = {
	alphabet: ['a', 'b'],
	states: [
		[100, 100, 'q0'],
		[300, 100, 'q1'],
		[500, 100, 'q2']
	],
	start: 0,
	accepting: [1, 2],
	transitions: [
		[0, 'a', 1],
		[0, 'b', 0],
		[1, 'a', 2],
		[1, 'b', 1],
		[2, 'a', 2],
		[2, 'b', 1]
	]
};
// The same without the transition of q0 on b: it needs a trap state.
const partial: Spec = {
	...redundant,
	transitions: redundant.transitions!.filter(([from, on]) => !(from === 0 && on === 'b'))
};

describe('NDFSM → DFSM', () => {
	it('builds the DFSM one step at a time and ends at the engine machine', async () => {
		const run = await finished(of(ndfsm, 'ndfsm'), 'determinize');
		const first = frameAt(run, namesOf(run, 'jebakan'), 0);
		expect(first.step.change.kind).toBe('closure');
		expect(first.machine).toBeNull();
		expect(first.table?.kind).toBe('closure');
		expect(normal(lastFrame(run).machine!)).toEqual(normal(run.final));
	});

	it('names a state by its set', async () => {
		const run = await finished(of(ndfsm, 'ndfsm'), 'determinize');
		const names = namesOf(run, 'jebakan');
		expect([...names.result.values()]).toContain('{q0, q1, q2}');
		expect(setText([], () => '')).toBe('∅');
	});

	it('names an empty set ∅ and keeps every name different', async () => {
		const run = await finished(of(ndfsm, 'ndfsm'), 'determinize');
		const names = [...namesOf(run, 'jebakan').result.values()];
		expect(names).toContain('∅');
		expect(new Set(names).size).toBe(names.length);
	});

	it('lights the state that a step makes', async () => {
		const run = await finished(of(ndfsm, 'ndfsm'), 'determinize');
		const at = run.trace.findIndex((s) => s.change.kind === 'new_state');
		const frame = frameAt(run, namesOf(run, 'jebakan'), at);
		expect(frame.result).toHaveLength(1);
		expect(frame.source.length).toBeGreaterThan(0);
		expect(frame.table?.kind).toBe('delta');
	});

	it('keeps the frames of a random machine in step with the engine', async () => {
		const rng = random(7);
		for (let round = 0; round < 40; round++) {
			const count = 2 + rng.int(4);
			const transitions: Spec['transitions'] = [];
			const seen = new Set<string>();
			for (let i = 0; i < count * 2; i++) {
				const entry: [number, string | null, number] = [
					rng.int(count),
					rng.chance(0.2) ? null : rng.pick(['a', 'b']),
					rng.int(count)
				];
				if (!seen.has(entry.join())) transitions.push(entry);
				seen.add(entry.join());
			}
			const doc = of(
				{
					alphabet: ['a', 'b'],
					states: Array.from({ length: count }, (_, i): [number, number] => [100 * i, 100]),
					start: 0,
					accepting: [rng.int(count)],
					transitions
				},
				'ndfsm'
			);
			const run = await finished(doc, 'determinize');
			expect(normal(lastFrame(run).machine!)).toEqual(normal(run.final));
		}
	});
});

describe('minimize', () => {
	it('shows the classes, then builds the machine, and ends at the engine machine', async () => {
		const run = await finished(documentFrom(redundant), 'minimize');
		expect(run.final.states).toHaveLength(2);
		const kinds = run.trace.map((s) => s.change.kind);
		const at = kinds.indexOf('classes');
		const frame = frameAt(run, namesOf(run, 'jebakan'), at);
		expect(frame.machine).toBeNull();
		expect(frame.table).toEqual({ kind: 'classes', rows: ['{q1, q2}', '{q0}'], hot: [] });
		expect(normal(lastFrame(run).machine!)).toEqual(normal(run.final));
	});

	it('names a class of one like its member, and a larger class by its members', async () => {
		const run = await finished(documentFrom(redundant), 'minimize');
		expect([...namesOf(run, 'jebakan').result.values()].sort()).toEqual(['q0', '{q1, q2}']);
	});
});

describe('add a trap state', () => {
	it('starts from the whole machine and ends at the engine machine', async () => {
		const doc = documentFrom(partial);
		const run = await finished(doc, 'trap');
		const names = namesOf(run, 'jebakan');
		const first = frameAt(run, names, 0);
		expect(first.machine!.states).toEqual([0, 1, 2, 3]);
		expect(first.machine!.transitions).toHaveLength(doc.transitions.length);
		expect(names.result.get(3)).toBe('jebakan');
		expect(normal(lastFrame(run).machine!)).toEqual(normal(run.final));
	});

	it('picks another name when the first is taken', async () => {
		const doc = documentFrom({
			...partial,
			states: [
				[100, 100, 'jebakan'],
				[300, 100, 'q1'],
				[500, 100, 'q2']
			]
		});
		const run = await finished(doc, 'trap');
		expect(namesOf(run, 'jebakan').result.get(3)).toBe('jebakan_2');
	});

	it('says so when the machine is complete already', async () => {
		const doc = documentFrom({
			alphabet: ['a'],
			states: [[100, 100, 'q0']],
			start: 0,
			transitions: [[0, 'a', 0]]
		});
		const run = await finished(doc, 'trap');
		expect(run.trace).toHaveLength(1);
		expect(run.trace[0]!.change.kind).toBe('already_complete');
		expect(normal(lastFrame(run).machine!)).toEqual(normal(toMachine(doc)));
	});
});

describe('what cannot run', () => {
	it('says why, in the order: empty, no start, wrong type, too big', () => {
		const empty = documentFrom({ states: [] });
		expect(refusalOf(empty, 'determinize')?.key).toBe('convert.reason_empty');
		const noStart = documentFrom({ states: [[0, 0]] });
		expect(refusalOf(noStart, 'minimize')?.key).toBe('convert.reason_no_start');
		const n = of(ndfsm, 'ndfsm');
		const asNdfsm = { ...documentFrom(redundant), kind: 'ndfsm' as const };
		expect(refusalOf(asNdfsm, 'minimize')?.key).toBe('convert.reason_needs_dfsm');
		expect(refusalOf(asNdfsm, 'trap')?.key).toBe('convert.reason_needs_dfsm');
		expect(refusalOf(documentFrom(redundant), 'determinize')?.key).toBe(
			'convert.reason_already_dfsm'
		);
		expect(refusalOf(n, 'determinize')).toBeNull();
		expect(refusalOf(documentFrom(redundant), 'minimize')).toBeNull();
		const big = documentFrom({
			alphabet: ['a'],
			states: Array.from({ length: 501 }, (_, i): [number, number] => [i, 0]),
			start: 0
		});
		expect(refusalOf(big, 'minimize')).toEqual({
			key: 'convert.reason_too_big',
			params: { limit: 500 }
		});
		expect(refusalOf(big, 'trap')).toBeNull();
	});

	it('a machine that the engine calls invalid is refused calmly', async () => {
		// A DFSM with two transitions on one symbol.
		const doc = documentFrom({
			alphabet: ['a'],
			states: [
				[0, 0, 'q0'],
				[100, 0, 'q1']
			],
			start: 0,
			transitions: [
				[0, 'a', 0],
				[0, 'a', 1]
			]
		});
		const outcome = await runConversion(engine, { ...doc, kind: 'dfsm' }, 'trap');
		expect(outcome).toEqual({ kind: 'refused', key: 'convert.invalid_machine', params: {} });
	});

	it('a stop of the engine is told as a stop', async () => {
		const outcome = await runConversion(
			{
				...engine,
				determinize: async () => ({
					ok: true,
					value: { result: 'stopped', reason: 'max_states', partialTrace: [] }
				})
			},
			of(ndfsm, 'ndfsm'),
			'determinize'
		);
		expect(outcome).toEqual({ kind: 'stopped', key: 'convert.stopped_states' });
	});
});

describe('the document of a result', () => {
	it('is the machine of the engine, with names and a title', async () => {
		const run = await finished(of(ndfsm, 'ndfsm'), 'determinize');
		const names = namesOf(run, 'dead');
		const doc = resultDocument(run, names, null, run.final, 'DFSM dari N');
		expect(normal(toMachine(doc))).toEqual(normal(run.final));
		expect(doc.title).toBe('DFSM dari N');
		expect(doc.states.map((s) => s.name)).toEqual(
			run.final.states.map((id) => names.result.get(id))
		);
	});

	it('puts the states where the layout says, and the others on a grid', async () => {
		const run = await finished(of(ndfsm, 'ndfsm'), 'determinize');
		const names = namesOf(run, 'dead');
		const [first] = run.final.states;
		const doc = resultDocument(run, names, [{ id: first!, x: 11, y: 22 }], run.final, '');
		expect(doc.states.find((s) => s.id === first)).toMatchObject({ x: 11, y: 22 });
		expect(doc.states.every((s) => Number.isFinite(s.x) && Number.isFinite(s.y))).toBe(true);
	});

	it('keeps the places of a machine that gets a dead state, and puts the new one below', async () => {
		const source = documentFrom(partial);
		const run = await finished(source, 'trap');
		const names = namesOf(run, 'dead');
		const doc = resultDocument(run, names, null, run.final, '');
		for (const old of source.states) {
			expect(doc.states.find((s) => s.id === old.id)).toMatchObject({ x: old.x, y: old.y });
		}
		const added = doc.states.find((s) => s.name === 'dead')!;
		expect(added.y).toBeGreaterThan(Math.max(...source.states.map((s) => s.y)));
	});

	it('shows a partial machine with the same places as the finished one', async () => {
		const run = await finished(of(ndfsm, 'ndfsm'), 'determinize');
		const names = namesOf(run, 'dead');
		const places = run.final.states.map((id, i) => ({ id, x: 100 * i, y: 50 }));
		const frame = frameAt(
			run,
			names,
			run.trace.findIndex((s) => s.change.kind === 'transition')
		);
		const part = resultDocument(run, names, places, frame.machine!, '');
		for (const state of part.states) {
			expect(state).toMatchObject({ x: places.find((p) => p.id === state.id)!.x, y: 50 });
		}
	});
});

describe('complement', () => {
	it('starts from the whole machine, flips one state at a time and ends at the engine machine', async () => {
		const run = await finished(documentFrom(redundant), 'complement');
		const names = namesOf(run, 'dead');
		expect(run.trace).toHaveLength(3);
		// q0 is not accepting, so it becomes accepting at the first step.
		const first = frameAt(run, names, 0);
		expect(first.step.change.kind).toBe('accepting');
		expect(first.machine!.states).toEqual([0, 1, 2]);
		expect(first.machine!.accepting).toEqual([1, 2, 0]);
		expect(first.source).toEqual(first.result);
		// q1 was accepting, so it stops at the second step.
		const second = frameAt(run, names, 1);
		expect(second.step.change.kind).toBe('not_accepting');
		expect(second.machine!.accepting).not.toContain(1);
		expect(normal(lastFrame(run).machine!)).toEqual(normal(run.final));
		expect(run.final.accepting).toEqual([0]);
	});

	it('marks the accepting states in the table', async () => {
		const run = await finished(documentFrom(redundant), 'complement');
		const table = lastFrame(run).table!;
		if (table.kind !== 'delta') throw new Error('delta');
		expect(table.rows.map((r) => r.accepting)).toEqual([true, false, false]);
	});

	it('keeps the places of the machine', async () => {
		const source = documentFrom(redundant);
		const run = await finished(source, 'complement');
		const doc = resultDocument(run, namesOf(run, 'dead'), null, run.final, '');
		for (const old of source.states) {
			expect(doc.states.find((s) => s.id === old.id)).toMatchObject({ x: old.x, y: old.y });
		}
	});

	it('points to the dead state when the machine is not complete, and refuses an NDFSM', () => {
		expect(refusalOf(documentFrom(partial), 'complement')?.key).toBe('convert.reason_incomplete');
		const asNdfsm = { ...documentFrom(redundant), kind: 'ndfsm' as const };
		expect(refusalOf(asNdfsm, 'complement')?.key).toBe('convert.reason_needs_dfsm');
		expect(refusalOf(documentFrom(redundant), 'complement')).toBeNull();
	});
});

describe('union', () => {
	const other: Spec = {
		alphabet: ['a', 'b'],
		states: [
			[100, 100, 'q0'],
			[300, 100, 'p']
		],
		start: 0,
		accepting: [1],
		transitions: [
			[0, 'b', 1],
			[1, 'a', 0]
		]
	};

	it('copies the machines, adds a start state and two ε-transitions, and ends at the engine machine', async () => {
		const first = documentFrom(redundant);
		const run = await finished(first, 'union', documentFrom(other));
		const names = namesOf(run, 'dead');
		expect(run.trace.map((s) => s.change.kind)).toEqual([
			'copy',
			'copy',
			'start',
			'epsilon',
			'epsilon'
		]);
		const one = frameAt(run, names, 0);
		expect(one.machine!.states).toEqual([0, 1, 2]);
		expect(one.machine!.start).toBeNull();
		expect(one.source).toEqual([0, 1, 2]);
		expect(one.from).toBe(1);
		const two = frameAt(run, names, 1);
		expect(two.machine!.states).toEqual([0, 1, 2, 3, 4]);
		expect(two.from).toBe(2);
		expect(two.machine!.transitions).toHaveLength(first.transitions.length + 2);
		const last = lastFrame(run);
		expect(last.machine!.kind).toBe('ndfsm');
		expect(normal(last.machine!)).toEqual(normal(run.final));
	});

	it('names the states by their machine, and the new start state s', async () => {
		const run = await finished(documentFrom(redundant), 'union', documentFrom(other));
		const names = namesOf(run, 'dead');
		expect([...names.result.values()]).toEqual(['1.q0', '1.q1', '1.q2', '2.q0', '2.p', 's']);
		expect(names.second.get(1)).toBe('p');
	});

	it('opens as a document with those names', async () => {
		const run = await finished(documentFrom(redundant), 'union', documentFrom(other));
		const names = namesOf(run, 'dead');
		const places = run.final.states.map((id, i) => ({ id, x: 90 * i, y: 40 }));
		const doc = resultDocument(run, names, places, run.final, 'U');
		expect(normal(toMachine(doc))).toEqual(normal(run.final));
		expect(doc.states.map((s) => s.name)).toContain('2.p');
	});

	it('keeps the frames in step with the engine for random pairs', async () => {
		const rng = random(11);
		const make = (): MachineDocument => {
			const count = 1 + rng.int(4);
			const seen = new Set<string>();
			const transitions: Spec['transitions'] = [];
			for (let i = 0; i < count * 2; i++) {
				const entry: [number, string | null, number] = [
					rng.int(count),
					rng.chance(0.2) ? null : rng.pick(['a', 'b']),
					rng.int(count)
				];
				if (!seen.has(entry.join())) transitions.push(entry);
				seen.add(entry.join());
			}
			return of(
				{
					alphabet: ['a', 'b'],
					states: Array.from({ length: count }, (_, i): [number, number] => [100 * i, 100]),
					start: 0,
					accepting: [rng.int(count)],
					transitions
				},
				'ndfsm'
			);
		};
		for (let round = 0; round < 40; round++) {
			const run = await finished(make(), 'union', make());
			expect(normal(lastFrame(run).machine!)).toEqual(normal(run.final));
		}
	});

	it('says why a second machine does not fit', () => {
		const first = documentFrom(redundant);
		expect(secondRefusalOf(first, documentFrom(other))).toBeNull();
		expect(
			secondRefusalOf(
				first,
				documentFrom({ ...other, alphabet: ['a', 'c'], transitions: [[1, 'a', 0]] })
			)?.key
		).toBe('convert.reason_alphabet');
		expect(secondRefusalOf(first, documentFrom({ ...other, start: undefined }))?.key).toBe(
			'convert.reason_second_no_start'
		);
	});

	it('the row needs only the first machine to have a start state', () => {
		expect(refusalOf(documentFrom(redundant), 'union')).toBeNull();
		expect(refusalOf(documentFrom({ states: [[0, 0]] }), 'union')?.key).toBe(
			'convert.reason_no_start'
		);
	});

	it('refuses without a second machine, and calmly when the pair does not fit', async () => {
		const none = await runConversion(engine, documentFrom(redundant), 'union');
		expect(none).toEqual({ kind: 'refused', key: 'convert.second_gone', params: {} });
		const bad = await runConversion(
			engine,
			documentFrom(redundant),
			'union',
			documentFrom({ ...other, alphabet: ['a', 'c'], transitions: [[1, 'a', 0]] })
		);
		expect(bad).toMatchObject({ kind: 'refused', key: 'convert.reason_alphabet' });
	});
});
