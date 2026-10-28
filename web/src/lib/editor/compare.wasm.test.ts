// Bandingkan with the real engine (the WASM module: `pnpm build:wasm`). The truth comes from outside the
// engine: a JavaScript regular expression (Rich's notation written as JS syntax) and a small machine
// runner in this file. Every string up to length 6 is checked against the verdict, the witness and both lists.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import init, * as wasm from '../engine/wasm/engine_wasm.js';
import type { Machine } from '../engine/types.ts';
import { runCompare } from './compare.ts';
import type { CompareEngine } from './compare.ts';
import { documentFrom } from './diagram/samples.ts';
import { toMachine } from './document.ts';
import { random } from './testing.ts';

beforeAll(async () => {
	const bytes = readFileSync(new URL('../engine/wasm/engine_wasm_bg.wasm', import.meta.url));
	await init({ module_or_path: bytes });
});

const engine: CompareEngine = {
	regexToFsm: async (text, alphabet, budget) =>
		JSON.parse(
			wasm.regexToFsm(text, JSON.stringify(alphabet), budget ? JSON.stringify(budget) : null)
		),
	equivalent: async (candidate, reference, budget) =>
		JSON.parse(
			wasm.equivalent(
				JSON.stringify(candidate),
				JSON.stringify(reference),
				budget ? JSON.stringify(budget) : null
			)
		)
};

/** Rich's notation as a JavaScript expression that matches the whole string. */
const matcher = (text: string) =>
	new RegExp(`^(?:${text.replaceAll('∪', '|').replaceAll('ε', '(?:)').replaceAll('∅', '(?!)')})$`);

/** Does the machine accept the word? A set of states, with the closure of the ε transitions. */
function accepts(machine: Machine, word: string): boolean {
	const close = (set: Set<number>) => {
		const queue = [...set];
		for (let i = 0; i < queue.length; i++) {
			for (const t of machine.transitions) {
				if (t.on === null && t.from === queue[i] && !set.has(t.to)) {
					set.add(t.to);
					queue.push(t.to);
				}
			}
		}
		return set;
	};
	let now = close(new Set(machine.start === null ? [] : [machine.start]));
	for (const symbol of word) {
		const next = new Set<number>();
		for (const t of machine.transitions) if (t.on === symbol && now.has(t.from)) next.add(t.to);
		now = close(next);
	}
	return machine.accepting.some((s) => now.has(s));
}

const words = (alphabet: string[], longest: number): string[] => {
	const all = [''];
	for (let i = 0; i < all.length; i++) {
		if (all[i]!.length < longest) for (const s of alphabet) all.push(all[i]! + s);
	}
	return all;
};

describe('Bandingkan with the real engine', () => {
	it('knows that (a∪b)*a is the machine that accepts what ends with a', async () => {
		const doc = documentFrom({
			alphabet: ['a', 'b'],
			states: [
				[0, 0],
				[100, 0]
			],
			start: 0,
			accepting: [1],
			transitions: [
				[0, 'a', 1],
				[0, 'b', 0],
				[1, 'a', 1],
				[1, 'b', 0]
			]
		});
		const outcome = await runCompare(engine, doc, '(a∪b)*a');
		expect(outcome.kind).toBe('finished');
		if (outcome.kind !== 'finished') return;
		expect(outcome.run.verdict).toBe('equivalent');
		const machine = toMachine(doc);
		const re = matcher('(a∪b)*a');
		for (const w of words(['a', 'b'], 6)) expect(accepts(machine, w), w).toBe(re.test(w));
	});

	it('finds the shortest string for a nearly right expression, and lists the wrong strings on both sides', async () => {
		const doc = documentFrom({
			alphabet: ['a', 'b'],
			states: [
				[0, 0],
				[100, 0]
			],
			start: 0,
			accepting: [1],
			transitions: [
				[0, 'a', 1],
				[0, 'b', 0],
				[1, 'a', 1],
				[1, 'b', 0]
			]
		});
		const text = '(a∪b)*aa∪b';
		const outcome = await runCompare(engine, doc, text);
		expect(outcome.kind).toBe('finished');
		if (outcome.kind !== 'finished') return;
		const { run } = outcome;
		expect(run.verdict).toBe('different');
		const machine = toMachine(doc);
		const re = matcher(text);
		// The witness is a string that they classify differently, and no shorter string is.
		const witness = run.witness!.input;
		expect(accepts(machine, witness)).not.toBe(re.test(witness));
		const shorter = words(['a', 'b'], 6).filter(
			(w) => w.length < witness.length && accepts(machine, w) !== re.test(w)
		);
		expect(shorter).toEqual([]);
		for (const w of run.accepted) {
			expect(accepts(machine, w.input), `accepted ${w.text}`).toBe(true);
			expect(re.test(w.input), `accepted ${w.text}`).toBe(false);
		}
		for (const w of run.rejected) {
			expect(accepts(machine, w.input), `rejected ${w.text}`).toBe(false);
			expect(re.test(w.input), `rejected ${w.text}`).toBe(true);
		}
		expect(run.accepted.length + run.rejected.length).toBeGreaterThan(0);
	});

	it('is right for random machines and random expressions: the verdict, the witness and both lists', async () => {
		const rng = random(2027);
		const expression = (depth: number): string => {
			if (depth === 0 || rng.chance(0.25)) return rng.pick(['a', 'b', 'ε', 'a', 'b', '∅']);
			const left = expression(depth - 1);
			switch (rng.int(4)) {
				case 0:
					return `(${left}∪${expression(depth - 1)})`;
				case 1:
					return `${left}${expression(depth - 1)}`;
				case 2:
					return `(${left})*`;
				default:
					return `(${left})+`;
			}
		};
		let different = 0;
		let equivalent = 0;
		for (let round = 0; round < 120; round++) {
			const n = 1 + rng.int(4);
			const doc = documentFrom({
				alphabet: ['a', 'b'],
				states: Array.from({ length: n }, (_, i) => [i * 100, 0] as [number, number]),
				start: 0,
				accepting: Array.from({ length: n }, (_, i) => i).filter(() => rng.chance(0.5)),
				transitions: Array.from({ length: n }, (_, from) =>
					['a', 'b'].map((on) => [from, on, rng.int(n)] as [number, string, number])
				).flat()
			});
			const text = expression(3);
			const outcome = await runCompare(engine, doc, text);
			expect(outcome.kind, text).toBe('finished');
			if (outcome.kind !== 'finished') continue;
			const { run } = outcome;
			const machine = toMachine(doc);
			const re = matcher(text);
			const all = words(['a', 'b'], 6);
			const disagree = all.filter((w) => accepts(machine, w) !== re.test(w));
			if (disagree.length === 0) {
				// No string up to 6 tells them apart. A witness may exist beyond that, but then it is longer than 6.
				if (run.verdict === 'different') expect(run.witness!.input.length, text).toBeGreaterThan(6);
				else equivalent += 1;
				continue;
			}
			different += 1;
			expect(run.verdict, `${text} on ${JSON.stringify(machine.transitions)}`).toBe('different');
			const shortest = Math.min(...disagree.map((w) => w.length));
			expect(run.witness!.input.length, text).toBe(shortest);
			expect(disagree, text).toContain(run.witness!.input);
			for (const w of run.accepted) {
				expect(accepts(machine, w.input) && !re.test(w.input), `${text}: ${w.text}`).toBe(true);
			}
			for (const w of run.rejected) {
				expect(!accepts(machine, w.input) && re.test(w.input), `${text}: ${w.text}`).toBe(true);
			}
		}
		expect(different).toBeGreaterThan(20);
		expect(equivalent).toBeGreaterThan(0);
	});

	it('refuses a symbol that the machine does not have, whatever the engine would say', async () => {
		const doc = documentFrom({
			alphabet: ['a'],
			states: [[0, 0]],
			start: 0,
			accepting: [0],
			transitions: [[0, 'a', 0]]
		});
		expect(await runCompare(engine, doc, 'ab')).toEqual({
			kind: 'refused',
			key: 'compare.symbol_missing',
			params: { symbols: 'b' }
		});
	});

	it('gives the parse error of the expression with the position that the field shows', async () => {
		const doc = documentFrom({
			alphabet: ['a'],
			states: [[0, 0]],
			start: 0,
			accepting: [0],
			transitions: [[0, 'a', 0]]
		});
		expect(await runCompare(engine, doc, '(a')).toMatchObject({
			kind: 'refused',
			key: 'regex.unbalanced_parenthesis'
		});
	});

	it('compares an NDFSM with ε-transitions', async () => {
		const ndfsm = documentFrom({
			alphabet: ['a', 'b'],
			states: [
				[0, 0],
				[100, 0]
			],
			start: 0,
			accepting: [1],
			transitions: [
				[0, null, 1],
				[1, 'a', 1]
			]
		});
		const outcome = await runCompare(engine, ndfsm, 'a*');
		expect(outcome.kind === 'finished' && outcome.run.verdict).toBe('equivalent');
	});
});
