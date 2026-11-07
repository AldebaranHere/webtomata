import { describe, expect, it } from 'vitest';
import { applyPdaCommand } from './pda-commands.ts';
import type { PdaCommand } from './pda-commands.ts';
import type { PdaDocument } from './pda-document.ts';
import { pdaDocumentFrom, PDA_SAMPLES, wwrSample } from './pda-samples.ts';
import { parseRows, rowCommands, rowsOf, type Row } from './pda-label.ts';

// Deterministic 32-bit PRNG (Mulberry32)
function mulberry32(seed: number) {
	return function () {
		let t = (seed += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function randomChoice<T>(rand: () => number, arr: readonly T[]): T {
	return arr[Math.floor(rand() * arr.length)]!;
}

function randomInt(rand: () => number, min: number, max: number): number {
	return min + Math.floor(rand() * (max - min + 1));
}

function makeRandomPda(rand: () => number, id: number): PdaDocument {
	const numStates = randomInt(rand, 2, 5);
	const multiStack = rand() < 0.4;
	const stackSymbols = multiStack ? ['Z0', 'A', 'B'] : ['A', 'B', 'C'];
	const multiInput = rand() < 0.3;
	const inputSymbols = multiInput ? ['a', 'num'] : ['a', 'b', 'c'];

	const states: [number, number, string][] = [];
	for (let i = 0; i < numStates; i++) {
		states.push([i * 100, i * 80, `q${i}`]);
	}

	const numTransitions = randomInt(rand, 1, 8);
	const transitions: [number, string | null, string[], string[], number][] = [];
	const seen = new Set<string>();

	for (let i = 0; i < numTransitions; i++) {
		const from = randomInt(rand, 0, numStates - 1);
		const to = randomInt(rand, 0, numStates - 1);
		const read = rand() < 0.2 ? null : randomChoice(rand, inputSymbols);
		const popLen = randomInt(rand, 0, 2);
		const pushLen = randomInt(rand, 0, 3);
		const pop: string[] = [];
		for (let p = 0; p < popLen; p++) pop.push(randomChoice(rand, stackSymbols));
		const push: string[] = [];
		for (let p = 0; p < pushLen; p++) push.push(randomChoice(rand, stackSymbols));

		const key = `${from}|${read}|${pop.join()}|${push.join()}|${to}`;
		if (!seen.has(key)) {
			seen.add(key);
			transitions.push([from, read, pop, push, to]);
		}
	}

	return pdaDocumentFrom({
		title: `random-pda-${id}`,
		kind: 'ndpda',
		inputAlphabet: inputSymbols,
		stackAlphabet: stackSymbols,
		states,
		start: 0,
		accepting: [numStates - 1],
		transitions
	});
}

const WEIRD_STRINGS = [
	'',
	'   ',
	'ε',
	'eps',
	'a',
	'ab',
	'a b',
	'A, B',
	'Z0',
	'Z0 A',
	'😀',
	'A😀',
	'foo\nbar',
	'test\twith\ttabs',
	'\x00\x01\x02',
	'A'.repeat(100),
	'Z '.repeat(70),
	'something\uD83D\uDE00weird',
	'lone\uD800surrogate'
];

const TARGET_CASES = process.env.LARGER_RUN ? 10000 : 1000;

describe('F5: PDA label properties', () => {
	it(`Property (a): round trip (${TARGET_CASES} cases)`, () => {
		const rand = mulberry32(12345);
		let pairsChecked = 0;

		for (let i = 0; i < TARGET_CASES * 2; i++) {
			const doc = i < PDA_SAMPLES.length ? PDA_SAMPLES[i]! : makeRandomPda(rand, i);
			const pairs = new Set<string>();
			for (const t of doc.transitions) {
				pairs.add(`${t.from},${t.to}`);
			}

			for (const p of pairs) {
				const [from, to] = p.split(',').map(Number) as [number, number];
				const rows = rowsOf(doc, from, to);
				const parsed = parseRows(doc, rows);
				expect('key' in parsed).toBe(false);

				if (!('key' in parsed)) {
					const actual = doc.transitions
						.filter((t) => t.from === from && t.to === to)
						.map((t) => ({ read: t.read, pop: [...t.pop], push: [...t.push] }));
					expect(parsed).toEqual(actual);
				}

				const cmds = rowCommands(doc, from, to, rows);
				expect(cmds).toEqual([]);
				pairsChecked++;
				if (pairsChecked >= TARGET_CASES) break;
			}
			if (pairsChecked >= TARGET_CASES) break;
		}
		expect(pairsChecked).toBeGreaterThanOrEqual(TARGET_CASES);
	});

	it(`Property (b): never throws on extreme strings (${TARGET_CASES} cases)`, () => {
		const rand = mulberry32(54321);
		const doc = wwrSample();

		for (let i = 0; i < TARGET_CASES; i++) {
			const read = rand() < 0.3 ? randomChoice(rand, WEIRD_STRINGS) : `s${randomInt(rand, 0, 500)}`;
			const pop =
				rand() < 0.3 ? randomChoice(rand, WEIRD_STRINGS) : 'A '.repeat(randomInt(rand, 0, 20));
			const push =
				rand() < 0.3 ? randomChoice(rand, WEIRD_STRINGS) : 'B '.repeat(randomInt(rand, 0, 20));

			const row: Row = { read, pop, push };
			expect(() => parseRows(doc, [row])).not.toThrow();
			expect(() => rowCommands(doc, 0, 0, [row])).not.toThrow();
		}
	});

	it(`Property (c): applying rowCommands is valid or refused, and idempotent (${TARGET_CASES} cases)`, () => {
		const rand = mulberry32(98765);
		let tested = 0;

		for (let i = 0; i < TARGET_CASES * 2; i++) {
			const doc = i < PDA_SAMPLES.length ? PDA_SAMPLES[i]! : makeRandomPda(rand, i);
			const from = randomInt(rand, 0, doc.states.length - 1);
			const to = randomInt(rand, 0, doc.states.length - 1);

			const isMultiStack = doc.stackAlphabet.some((s) => [...s].length > 1);
			const stackPool = isMultiStack ? ['Z0', 'A', 'B'] : ['A', 'B', 'C', 'D'];
			const isMultiInput = doc.inputAlphabet.some((s) => [...s].length > 1);
			const inputPool = isMultiInput ? ['a', 'num'] : ['a', 'b', 'c', 'd'];

			const numRows = randomInt(rand, 0, 4);
			const rows: Row[] = [];
			for (let r = 0; r < numRows; r++) {
				const isBlank = rand() < 0.15;
				if (isBlank) {
					rows.push({ read: '   ', pop: '', push: '' });
				} else {
					const read = rand() < 0.2 ? 'ε' : randomChoice(rand, inputPool);
					const makeSeq = () => {
						if (rand() < 0.3) return '';
						const count = randomInt(rand, 1, 3);
						const chosen: string[] = [];
						for (let c = 0; c < count; c++) chosen.push(randomChoice(rand, stackPool));
						return isMultiStack ? chosen.join(' ') : chosen.join('');
					};
					rows.push({ read, pop: makeSeq(), push: makeSeq() });
				}
			}

			const cmds = rowCommands(doc, from, to, rows);
			if ('key' in cmds) {
				tested++;
				continue;
			}

			if (cmds.length === 0) {
				tested++;
				continue;
			}

			const batch: PdaCommand = { type: 'batch', commands: cmds };
			const result = applyPdaCommand(doc, batch);
			if (result.ok) {
				const newDoc = result.doc;
				// Transitions on (from, to) equal wanted parsed transitions (as a set)
				const parsed = parseRows(doc, rows);
				if (!('key' in parsed)) {
					const actual = newDoc.transitions
						.filter((t) => t.from === from && t.to === to)
						.map((t) => ({ read: t.read, pop: [...t.pop], push: [...t.push] }));
					expect(actual).toHaveLength(parsed.length);
					for (const p of parsed) {
						expect(
							actual.some(
								(a) =>
									a.read === p.read &&
									a.pop.join() === p.pop.join() &&
									a.push.join() === p.push.join()
							)
						).toBe(true);
					}
				}
				// Idempotence: running rowCommands with the same rows on newDoc yields []
				const nextCmds = rowCommands(newDoc, from, to, rows);
				expect(nextCmds).toEqual([]);
			}
			tested++;
			if (tested >= TARGET_CASES) break;
		}
		expect(tested).toBeGreaterThanOrEqual(TARGET_CASES);
	});
});
