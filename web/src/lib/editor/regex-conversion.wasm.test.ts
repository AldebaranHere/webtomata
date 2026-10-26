// FSM → regex against the real engine (the WASM module: `pnpm build:wasm`): the frames must end at
// the expression that the engine returned, and the expression must mean what the machine means.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import init, * as wasm from '../engine/wasm/engine_wasm.js';
import type { Machine } from '../engine/types.ts';
import { documentFrom } from './diagram/samples.ts';
import type { Spec } from './diagram/samples.ts';
import { regexFrameAt, regexNamesOf, runFsmToRegex } from './regex-conversion.ts';
import type { RegexEngine } from './regex-conversion.ts';
import { random } from './testing.ts';

beforeAll(async () => {
	const bytes = readFileSync(new URL('../engine/wasm/engine_wasm_bg.wasm', import.meta.url));
	await init({ module_or_path: bytes });
});

const engine: RegexEngine = {
	fsmToRegex: async (machine, budget) =>
		JSON.parse(wasm.fsmToRegex(JSON.stringify(machine), budget ? JSON.stringify(budget) : null))
};

/** Does the expression mean what the machine means? Both are made into DFSMs and compared. */
function same(regex: string, machine: Machine): boolean {
	const built = JSON.parse(wasm.regexToFsm(regex, JSON.stringify(machine.alphabet), null));
	const dfsm = (m: Machine) =>
		JSON.parse(wasm.determinize(JSON.stringify(m))).value.dfsm as Machine;
	const a = dfsm(built.value.fsm);
	const b = dfsm(machine);
	const answer = JSON.parse(wasm.equivalent(JSON.stringify(a), JSON.stringify(b), null));
	return answer.ok && answer.value.equivalence.result === 'equivalent';
}

const spec = (count: number, transitions: Spec['transitions'], accepting: number[]): Spec => ({
	alphabet: ['a', 'b'],
	states: Array.from({ length: count }, (_, i): [number, number] => [100 * i, 100]),
	start: 0,
	accepting,
	transitions
});

describe('FSM → regex with the real engine', () => {
	it('ends at the expression of the engine, in one label from the start to the end', async () => {
		const doc = documentFrom(
			spec(
				3,
				[
					[0, 'a', 1],
					[1, 'b', 2],
					[2, 'a', 0]
				],
				[2]
			)
		);
		const outcome = await runFsmToRegex(engine, doc);
		if (outcome.kind !== 'finished') throw new Error(outcome.kind);
		const { run } = outcome;
		const names = regexNamesOf(run, 's', 'f');
		const last = regexFrameAt(run, names, run.trace.length - 1);
		expect(last.step.change).toEqual({ kind: 'expression', expression: run.regex });
		expect(last.table).toHaveLength(1);
		expect(last.table[0]!.expression).toBe(run.regex);
		expect(
			same(
				run.regex,
				JSON.parse(
					JSON.stringify({
						schemaVersion: 1,
						kind: 'dfsm',
						alphabet: ['a', 'b'],
						states: [0, 1, 2],
						start: 0,
						accepting: [2],
						transitions: [
							{ from: 0, on: 'a', to: 1 },
							{ from: 1, on: 'b', to: 2 },
							{ from: 2, on: 'a', to: 0 }
						]
					})
				)
			)
		).toBe(true);
	});

	it('removes one state at each rip, and the table shrinks', async () => {
		const doc = documentFrom(
			spec(
				3,
				[
					[0, 'a', 1],
					[1, 'b', 2],
					[2, 'a', 0]
				],
				[2]
			)
		);
		const outcome = await runFsmToRegex(engine, doc);
		if (outcome.kind !== 'finished') throw new Error(outcome.kind);
		const { run } = outcome;
		const names = regexNamesOf(run, 's', 'f');
		const rips = run.trace.flatMap((s, i) => (s.change.kind === 'rip' ? [i] : []));
		expect(rips.length).toBeGreaterThan(0);
		for (const at of rips) {
			const change = run.trace[at]!.change;
			if (change.kind !== 'rip') continue;
			const gone = names.get(change.state)!;
			const frame = regexFrameAt(run, names, at);
			expect(frame.table.some((row) => row.from === gone || row.to === gone)).toBe(false);
			expect(frame.hot.length).toBe(change.updates.length);
		}
	});

	it('gives an expression that means what a random machine means', async () => {
		const rng = random(31);
		for (let round = 0; round < 40; round++) {
			const count = 1 + rng.int(4);
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
			const accepting = [rng.int(count)];
			const doc = { ...documentFrom(spec(count, transitions, accepting)), kind: 'ndfsm' as const };
			const outcome = await runFsmToRegex(engine, doc);
			if (outcome.kind !== 'finished') throw new Error(outcome.kind);
			const machine: Machine = {
				schemaVersion: 1,
				kind: 'ndfsm',
				alphabet: ['a', 'b'],
				states: doc.states.map((s) => s.id),
				start: 0,
				accepting,
				transitions: doc.transitions.map(({ from, on, to }) => ({ from, on, to }))
			};
			expect(same(outcome.run.regex, machine), outcome.run.regex).toBe(true);
			const names = regexNamesOf(outcome.run, 's', 'f');
			const last = regexFrameAt(outcome.run, names, outcome.run.trace.length - 1);
			expect(last.step.change.kind).toBe('expression');
		}
	});

	it('stops with the bigger budget offered, and finishes with it', async () => {
		// A machine whose labels grow: every state goes to every state on both symbols.
		const count = 6;
		const transitions: Spec['transitions'] = [];
		for (let from = 0; from < count; from++) {
			for (let to = 0; to < count; to++) {
				transitions.push([from, 'a', to], [from, 'b', (to + 1) % count]);
			}
		}
		const doc = { ...documentFrom(spec(count, transitions, [count - 1])), kind: 'ndfsm' as const };
		const tight = await runFsmToRegex(
			{ fsmToRegex: (m) => engine.fsmToRegex(m, { maxNodes: 40 }) },
			doc
		);
		expect(tight).toMatchObject({ kind: 'stopped', key: 'convert.stopped_nodes' });
	});
});
