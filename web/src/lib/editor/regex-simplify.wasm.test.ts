// Sederhanakan against the real engine (the WASM module: `pnpm build:wasm`): the steps end at the
// expression that the engine returned, and the expression means what the typed one means.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import init, * as wasm from '../engine/wasm/engine_wasm.js';
import type { Machine } from '../engine/types.ts';
import { alphabetOf } from './regex-compile.ts';
import { runSimplify, simplifyFrameAt } from './regex-simplify.ts';
import type { SimplifyEngine } from './regex-simplify.ts';
import { random } from './testing.ts';

beforeAll(async () => {
	const bytes = readFileSync(new URL('../engine/wasm/engine_wasm_bg.wasm', import.meta.url));
	await init({ module_or_path: bytes });
});

const engine: SimplifyEngine = {
	simplify: async (text, alphabet, budget) =>
		JSON.parse(
			wasm.simplify(text, JSON.stringify(alphabet), budget ? JSON.stringify(budget) : null)
		)
};

/** Do the two expressions mean the same? Both are made into DFSMs and compared. */
function same(a: string, b: string): boolean {
	const alphabet = JSON.stringify([...new Set([...alphabetOf(a), ...alphabetOf(b)])]);
	const dfsm = (text: string) => {
		const built = JSON.parse(wasm.regexToFsm(text, alphabet, null));
		return JSON.parse(wasm.determinize(JSON.stringify(built.value.fsm))).value.dfsm as Machine;
	};
	const answer = JSON.parse(
		wasm.equivalent(JSON.stringify(dfsm(a)), JSON.stringify(dfsm(b)), null)
	);
	return answer.ok && answer.value.equivalence.result === 'equivalent';
}

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

describe('Sederhanakan with the real engine', () => {
	it('simplifies a*∪aa in one step, and names the rule and the parts', async () => {
		const outcome = await runSimplify(engine, 'a*∪aa');
		if (outcome.kind !== 'finished') throw new Error(outcome.kind);
		expect(outcome.run.regex).toBe('a*');
		const [first] = outcome.run.trace;
		expect(first!.message.key).toBe('simplify.union_subset');
		expect(first!.message.params).toMatchObject({ kept: 'a*', removed: 'aa', after: 'a*' });
		expect(simplifyFrameAt(outcome.run, 0).marked).toEqual({ before: '', part: 'a*', after: '' });
	});

	it('says that an expression is already as simple as it gets', async () => {
		expect(await runSimplify(engine, 'ab*')).toEqual({ kind: 'unchanged' });
	});

	it('keeps the meaning, and ends at the engine expression, for random expressions', async () => {
		const rng = random(17);
		let steps = 0;
		for (let round = 0; round < 60; round++) {
			const text = expression(rng, 4);
			const outcome = await runSimplify(engine, text);
			if (outcome.kind === 'unchanged') continue;
			if (outcome.kind !== 'finished') throw new Error(`${text}: ${outcome.kind}`);
			const { run } = outcome;
			steps += run.trace.length;
			expect(simplifyFrameAt(run, run.trace.length - 1).expression, text).toBe(run.regex);
			expect(same(text, run.regex), `${text} → ${run.regex}`).toBe(true);
		}
		expect(steps).toBeGreaterThan(30);
	});

	it('says where the mistake is, and stops when the checks run out', async () => {
		expect(await runSimplify(engine, 'a∪)')).toMatchObject({
			kind: 'refused',
			key: 'regex.unexpected',
			params: { position: 3 }
		});
		const none: SimplifyEngine = {
			simplify: (text, alphabet) => engine.simplify(text, alphabet, { maxChecks: 0 })
		};
		expect(await runSimplify(none, 'a*∪aa')).toMatchObject({ kind: 'stopped' });
	});
});
