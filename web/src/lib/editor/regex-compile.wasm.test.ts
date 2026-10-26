// Regex → NDFSM against the real engine (the WASM module: `pnpm build:wasm`): the frames end at the
// machine of the engine, whatever the expression is, and the errors of the parser come back with
// the position that the field shows.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import init, * as wasm from '../engine/wasm/engine_wasm.js';
import type { Machine } from '../engine/types.ts';
import { compileFrameAt, runRegexToFsm } from './regex-compile.ts';
import type { CompileEngine } from './regex-compile.ts';
import { random } from './testing.ts';

beforeAll(async () => {
	const bytes = readFileSync(new URL('../engine/wasm/engine_wasm_bg.wasm', import.meta.url));
	await init({ module_or_path: bytes });
});

const engine: CompileEngine = {
	regexToFsm: async (text, alphabet, budget) =>
		JSON.parse(
			wasm.regexToFsm(text, JSON.stringify(alphabet), budget ? JSON.stringify(budget) : null)
		)
};

const normal = (m: Machine) => ({
	...m,
	states: [...m.states].sort((a, b) => a - b),
	accepting: [...m.accepting].sort((a, b) => a - b),
	transitions: [...m.transitions].sort(
		(a, b) => a.from - b.from || (a.on ?? '').localeCompare(b.on ?? '') || a.to - b.to
	)
});

/** A random expression with these parts, always well formed. */
function expression(rng: ReturnType<typeof random>, depth: number): string {
	if (depth === 0 || rng.chance(0.25)) return rng.pick(['a', 'b', 'ε', 'a', 'b', '∅']);
	const left = expression(rng, depth - 1);
	switch (rng.int(4)) {
		case 0:
			return `(${left}∪${expression(rng, depth - 1)})`;
		case 1:
			return `${left}${expression(rng, depth - 1)}`;
		case 2:
			return `(${left})*`;
		default:
			return `(${left})+`;
	}
}

describe('regex → NDFSM with the real engine', () => {
	it('builds (a∪b)*abb part by part and ends at the machine of the engine', async () => {
		const outcome = await runRegexToFsm(engine, '(a∪b)*abb');
		if (outcome.kind !== 'finished') throw new Error(outcome.kind);
		const { run } = outcome;
		expect(run.alphabet).toEqual(['a', 'b']);
		expect(run.final.kind).toBe('ndfsm');
		const kinds = new Set(run.trace.map((s) => s.message.key));
		expect([...kinds].sort()).toEqual([
			'regex.concat',
			'regex.star',
			'regex.symbol',
			'regex.union'
		]);
		expect(normal(compileFrameAt(run, run.trace.length - 1).machine)).toEqual(normal(run.final));
	});

	it('has a machine for an expression without symbols', async () => {
		for (const text of ['ε', '∅', 'ε∪∅']) {
			const outcome = await runRegexToFsm(engine, text);
			if (outcome.kind !== 'finished') throw new Error(`${text}: ${outcome.kind}`);
			expect(outcome.run.alphabet).toEqual([]);
			expect(normal(compileFrameAt(outcome.run, 99).machine)).toEqual(normal(outcome.run.final));
		}
	});

	it('keeps the frames of random expressions in step with the engine', async () => {
		const rng = random(5);
		for (let round = 0; round < 60; round++) {
			const text = expression(rng, 4);
			const outcome = await runRegexToFsm(engine, text);
			if (outcome.kind !== 'finished') throw new Error(`${text}: ${outcome.kind}`);
			const { run } = outcome;
			expect(normal(compileFrameAt(run, run.trace.length - 1).machine), text).toEqual(
				normal(run.final)
			);
			// Every step makes states, or joins states that are already there.
			run.trace.forEach((_, i) =>
				expect(compileFrameAt(run, i).lit.length, text).toBeGreaterThan(0)
			);
		}
	});

	it('says where the mistake is, counting from 1', async () => {
		expect(await runRegexToFsm(engine, '(a∪b')).toMatchObject({
			kind: 'refused',
			key: 'regex.unbalanced_parenthesis',
			params: { position: 1 }
		});
		expect(await runRegexToFsm(engine, 'a∪')).toMatchObject({
			key: 'regex.unexpected_end',
			params: { position: 2 }
		});
		expect(await runRegexToFsm(engine, 'ab)')).toMatchObject({
			key: 'regex.unbalanced_parenthesis',
			params: { position: 3 }
		});
		expect(await runRegexToFsm(engine, '*a')).toMatchObject({ key: 'regex.unexpected' });
	});

	it('stops when the machine is too big for the budget', async () => {
		const tight: CompileEngine = {
			regexToFsm: (text, alphabet) => engine.regexToFsm(text, alphabet, { maxStates: 3 })
		};
		expect(await runRegexToFsm(tight, '(a∪b)*abb')).toMatchObject({
			kind: 'stopped',
			key: 'convert.stopped_states'
		});
	});
});
