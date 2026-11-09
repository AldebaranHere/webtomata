// The competing pairs of the real WASM engine (`pnpm build:wasm`), and the proof that the indices
// of `Competition` are indices into `doc.transitions` (Task T-062, note 3 for the worker). The
// fixtures are the machines G, J, K and F of docs/agent/PLAN.md; U2 to U5 of
// `pda-determinism.test.ts` build the sentences from the same pairs.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import init, * as wasm from '../engine/wasm/engine_wasm.js';
import type { Competition, EngineResult, Pda } from '../engine/types.ts';
import { transitionLabel } from './diagram/pda-diagram.ts';
import { fromEnginePda, toEnginePda } from './pda-document.ts';
import type { PdaDocument } from './pda-document.ts';
import { pdaDocumentFrom } from './pda-samples.ts';
import { competitionReason } from './pda-determinism.ts';

beforeAll(async () => {
	const bytes = readFileSync(new URL('../engine/wasm/engine_wasm_bg.wasm', import.meta.url));
	await init({ module_or_path: bytes });
});

const loadPda = (pda: unknown) => JSON.parse(wasm.loadPda(JSON.stringify(pda))) as EngineResult<Pda>;
const determinism = (pda: unknown) =>
	JSON.parse(wasm.pdaDeterminism(JSON.stringify(pda))) as EngineResult<Competition[]>;

/** The document as the panel holds it, from the engine's own canonical order, and its pairs. */
function loaded(doc: PdaDocument): { doc: PdaDocument; pairs: Competition[] } {
	const answer = loadPda(toEnginePda(doc));
	if (!answer.ok) throw new Error(`loadPda refused the document: ${answer.error.key}`);
	const canonical = fromEnginePda(answer.value);
	const pairs = determinism(toEnginePda(canonical));
	if (!pairs.ok) throw new Error(`pdaDeterminism refused the document: ${pairs.error.key}`);
	return { doc: canonical, pairs: pairs.value };
}

/** Machine G of the plan: Σ {a, b}, Γ {A}, q0 start, q1 accepting. */
const G = (kind: 'dpda' | 'ndpda' = 'dpda') =>
	pdaDocumentFrom({
		kind,
		inputAlphabet: ['a', 'b'],
		stackAlphabet: ['A'],
		states: [
			[100, 100, 'q0'],
			[300, 100, 'q1']
		],
		start: 0,
		accepting: [1],
		transitions: [
			[0, 'a', [], ['A'], 0],
			[0, 'b', ['A'], [], 1],
			[1, 'b', ['A'], [], 1],
			[0, null, [], [], 1]
		]
	});

/** Machine J: an NDPDA on Σ {a}, Γ {A, B}. */
const J = () =>
	pdaDocumentFrom({
		kind: 'ndpda',
		inputAlphabet: ['a'],
		stackAlphabet: ['A', 'B'],
		states: [
			[100, 100, 'q0'],
			[300, 100, 'q1']
		],
		start: 0,
		accepting: [1],
		transitions: [
			[0, 'a', ['A'], [], 0],
			[0, 'a', ['A', 'B'], [], 1]
		]
	});

/** Machine K: a DPDA on Σ {a}, Γ {A, B}, with an ε row and a reading row. */
const K = () =>
	pdaDocumentFrom({
		kind: 'dpda',
		inputAlphabet: ['a'],
		stackAlphabet: ['A', 'B'],
		states: [
			[100, 100, 'q0'],
			[300, 100, 'q1']
		],
		start: 0,
		accepting: [1],
		transitions: [
			[0, 'a', ['A'], [], 0],
			[0, null, ['A', 'B'], [], 1]
		]
	});

/** Machine F: a DPDA with no competing pair. */
const F = () =>
	pdaDocumentFrom({
		kind: 'dpda',
		inputAlphabet: ['a', 'b'],
		stackAlphabet: ['A'],
		states: [
			[100, 100, 'q0'],
			[300, 100, 'q1']
		],
		start: 0,
		accepting: [1],
		transitions: [
			[0, 'a', [], ['A'], 0],
			[0, 'b', ['A'], [], 1],
			[1, 'b', ['A'], [], 1]
		]
	});

describe('WC1: the pairs of the real engine are the fixtures of the plan', () => {
	it('WC1: G gives two pairs, and both kinds give the same ones', () => {
		const dpda = loaded(G());
		expect(dpda.pairs).toEqual([
			{ from: 0, first: 0, second: 1 },
			{ from: 0, first: 0, second: 2 }
		]);
		// The engine's `determinism` does not read the kind: only the badge's tone does.
		expect(loaded(G('ndpda')).pairs).toEqual(dpda.pairs);
	});

	it('WC2: J and K give one pair each, F gives none, and an empty PDA gives none', () => {
		expect(loaded(J()).pairs).toEqual([{ from: 0, first: 0, second: 1 }]);
		expect(loaded(K()).pairs).toEqual([{ from: 0, first: 0, second: 1 }]);
		expect(loaded(F()).pairs).toEqual([]);
		const empty = pdaDocumentFrom({
			kind: 'dpda',
			inputAlphabet: [],
			stackAlphabet: [],
			states: [
				[100, 100, 'q0'],
				[300, 100, 'q1']
			],
			start: 0,
			accepting: [1],
			transitions: []
		});
		expect(loaded(empty).pairs).toEqual([]);
	});
});

describe('WC3: first and second are indices into doc.transitions', () => {
	it('WC3: the two indices name two transitions that leave the state of the pair', () => {
		for (const build of [G, J, K]) {
			const { doc, pairs } = loaded(build());
			expect(pairs.length).toBeGreaterThan(0);
			for (const pair of pairs) {
				const first = doc.transitions[pair.first];
				const second = doc.transitions[pair.second];
				expect(first, `pair ${JSON.stringify(pair)}`).toBeDefined();
				expect(second, `pair ${JSON.stringify(pair)}`).toBeDefined();
				expect(first?.from).toBe(pair.from);
				expect(second?.from).toBe(pair.from);
			}
		}
	});

	it('WC4: the rows the panel marks are the rows the plan numbers', () => {
		// G's rows, in the engine's order: 1 ε/ε/ε, 2 a/ε/A, 3 b/A/ε, 4 q1 b/A/ε.
		const { doc, pairs } = loaded(G());
		expect(doc.transitions.map((t) => transitionLabel(doc, t))).toEqual([
			'ε / ε / ε',
			'a / ε / A',
			'b / A / ε',
			'b / A / ε'
		]);
		expect(pairs.map((pair) => [pair.first + 1, pair.second + 1])).toEqual([
			[1, 2],
			[1, 3]
		]);
	});
});

describe('WC5: the sentences of the real pairs', () => {
	it('WC5: G, J and K give F1, F2 and F3 from the engine’s own pairs', () => {
		const g = loaded(G());
		expect(g.pairs.map((pair) => competitionReason(g.doc, pair))).toEqual([
			{ key: 'pda_editor.compete_epsilon_read', params: { pop1: 'ε', pop2: 'ε' } },
			{ key: 'pda_editor.compete_epsilon_read', params: { pop1: 'ε', pop2: 'A' } }
		]);

		const j = loaded(J());
		expect(competitionReason(j.doc, j.pairs[0]!)).toEqual({
			key: 'pda_editor.compete_same_read',
			params: { read: 'a', pop1: 'A', pop2: 'AB' }
		});

		// K's pops are swapped: the second transition pops A, which is the prefix.
		const k = loaded(K());
		expect(competitionReason(k.doc, k.pairs[0]!)).toEqual({
			key: 'pda_editor.compete_epsilon_read',
			params: { pop1: 'A', pop2: 'AB' }
		});
	});
});
