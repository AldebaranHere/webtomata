// U of T-062: the determinism query of the engine, the reason sentence of a competing pair, and
// the model of the badge (docs/agent/PLAN.md, Task T-062). F1 to F5 are derived by hand in the plan
// and checked here against the real document functions; the pairs themselves come from
// `engine.pdaDeterminism`, proved against the real engine in `pda-determinism.wasm.test.ts`.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Competition, EngineResult } from '../engine/types.ts';
import { badgeModel, competitionReason, createDeterminism } from './pda-determinism.ts';
import type { PdaDocument } from './pda-document.ts';
import { pdaDocumentFrom } from './pda-samples.ts';

/** Machine G of the plan: Σ {a, b}, Γ {A}, q0 start, q1 accepting, four transitions. */
function machineG(kind: 'dpda' | 'ndpda' = 'dpda'): PdaDocument {
	return pdaDocumentFrom({
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
}

/** Machine J of the plan: an NDPDA on Σ {a}, Γ {A, B}. */
function machineJ(): PdaDocument {
	return pdaDocumentFrom({
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
}

/** Machine K of the plan: a DPDA on Σ {a}, Γ {A, B}, the ε-read transition first. */
function machineK(): PdaDocument {
	return pdaDocumentFrom({
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
}

/** Machine F of the plan: a DPDA with no competing pair. */
function machineF(): PdaDocument {
	return pdaDocumentFrom({
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
}

const pair = (from: number, first: number, second: number): Competition => ({ from, first, second });

describe('U1: the transitions are in the order the plan numbers the rows', () => {
	it('U1: G, J and K hold their transitions as the plan writes them', () => {
		// The plan numbers the rows of G 1..4 as ε, a, b, b. If this line changes, F1 is wrong.
		const g = machineG();
		expect(g.transitions.map((t) => [t.from, t.read, [...t.pop], [...t.push], t.to])).toEqual([
			[0, null, [], [], 1],
			[0, 'a', [], ['A'], 0],
			[0, 'b', ['A'], [], 1],
			[1, 'b', ['A'], [], 1]
		]);
		expect(machineJ().transitions.map((t) => [...t.pop])).toEqual([['A'], ['A', 'B']]);
		expect(machineK().transitions.map((t) => [t.read, [...t.pop]])).toEqual([
			[null, ['A', 'B']],
			['a', ['A']]
		]);
	});
});

describe('U2: F1, the reason sentence of the pairs of G', () => {
	it('U2: an ε pair with two empty pops says that the pops are equal', () => {
		expect(competitionReason(machineG(), pair(0, 0, 1))).toEqual({
			key: 'pda_editor.compete_epsilon_read',
			params: { pop1: 'ε', pop2: 'ε' }
		});
	});

	it('U3: an ε pair with an empty pop and a one-symbol pop puts the empty one first', () => {
		expect(competitionReason(machineG(), pair(0, 0, 2))).toEqual({
			key: 'pda_editor.compete_epsilon_read',
			params: { pop1: 'ε', pop2: 'A' }
		});
	});
});

describe('U4: F2, the reason sentence of the pair of J', () => {
	it('U4: the same read symbol gives the read in the sentence, and the prefix pop first', () => {
		expect(competitionReason(machineJ(), pair(0, 0, 1))).toEqual({
			key: 'pda_editor.compete_same_read',
			params: { read: 'a', pop1: 'A', pop2: 'AB' }
		});
	});
});

describe('U5: F3, the pops are swapped when the second one is the prefix', () => {
	it('U5: K gives pop1 A and pop2 AB although its first transition pops AB', () => {
		const k = machineK();
		expect(k.transitions.map((t) => [...t.pop])).toEqual([['A', 'B'], ['A']]);
		expect(competitionReason(k, pair(0, 0, 1))).toEqual({
			key: 'pda_editor.compete_epsilon_read',
			params: { pop1: 'A', pop2: 'AB' }
		});
	});
});

describe('U6: both transitions reading ε is the ε sentence, not the same-read one', () => {
	it('U6: two ε rows, an empty pop and A', () => {
		const doc = pdaDocumentFrom({
			kind: 'ndpda',
			inputAlphabet: ['a'],
			stackAlphabet: ['A'],
			states: [
				[100, 100, 'q0'],
				[300, 100, 'q1']
			],
			start: 0,
			accepting: [1],
			transitions: [
				[0, null, [], [], 1],
				[0, null, ['A'], [], 1]
			]
		});
		expect(competitionReason(doc, pair(0, 0, 1))).toEqual({
			key: 'pda_editor.compete_epsilon_read',
			params: { pop1: 'ε', pop2: 'A' }
		});
	});

	it('U7: a pair whose indices are not in the document has no sentence', () => {
		expect(competitionReason(machineF(), pair(0, 0, 9))).toBeNull();
		expect(competitionReason(machineF(), pair(0, -1, 0))).toBeNull();
	});
});

describe('U8: F5, the model of the badge', () => {
	it('U8: a DPDA with pairs warns, and its phone text is short', () => {
		expect(badgeModel('dpda', 4, 2)).toEqual({
			tone: 'warning',
			key: 'pda_editor.badge_not_dpda',
			params: { count: 2 },
			shortKey: 'pda_editor.badge_not_dpda_short',
			opens: true
		});
	});

	it('U9: an NDPDA with pairs is neutral, and its phone text is short', () => {
		expect(badgeModel('ndpda', 4, 2)).toEqual({
			tone: 'neutral',
			key: 'pda_editor.badge_nondeterministic',
			params: { count: 2 },
			shortKey: 'pda_editor.badge_nondeterministic_short',
			opens: true
		});
	});

	it('U10: no pair is deterministic, and the badge is plain text in both kinds', () => {
		for (const kind of ['dpda', 'ndpda'] as const) {
			expect(badgeModel(kind, 3, 0)).toEqual({
				tone: 'success',
				key: 'pda_editor.badge_deterministic',
				params: {},
				opens: false
			});
		}
	});

	it('U11: no transition gives no badge, whatever the pair count says', () => {
		expect(badgeModel('dpda', 0, 0)).toBeNull();
		expect(badgeModel('ndpda', 0, 0)).toBeNull();
		expect(badgeModel('dpda', 0, 2)).toBeNull();
	});

	it('U12: the pair count of the boundaries is kept: 1 and 2', () => {
		expect(badgeModel('ndpda', 1, 1)?.params).toEqual({ count: 1 });
		expect(badgeModel('ndpda', 2, 2)?.params).toEqual({ count: 2 });
	});
});

// ---- the query ----

const ok = (pairs: Competition[]): EngineResult<Competition[]> => ({ ok: true, value: pairs });
const failed: EngineResult<Competition[]> = { ok: false, error: { key: 'engine.failed', params: {} } };

const G_PAIRS = [pair(0, 0, 1), pair(0, 0, 2)];
const J_PAIRS = [pair(0, 0, 1)];

/** Answers the questions of the query in order, and remembers what it was asked. */
function asked(answers: Array<Promise<EngineResult<Competition[]>> | EngineResult<Competition[]>>) {
	const docs: PdaDocument[] = [];
	const query = (doc: PdaDocument): Promise<EngineResult<Competition[]>> => {
		docs.push(doc);
		return Promise.resolve(answers.shift() ?? ok([]));
	};
	return { docs, query };
}

function deferred(): {
	promise: Promise<EngineResult<Competition[]>>;
	resolve: (answer: EngineResult<Competition[]>) => void;
} {
	let resolve: (answer: EngineResult<Competition[]>) => void = () => undefined;
	const promise = new Promise<EngineResult<Competition[]>>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

/** Lets the promises of an answer settle (each `await` of the query is one microtask turn). */
async function settle(): Promise<void> {
	for (let i = 0; i < 8; i++) await Promise.resolve();
}

describe('U13: the query asks again after each change, once', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('U13: one change is one request, after the debounce and not before', async () => {
		vi.useFakeTimers();
		const { docs, query } = asked([ok(G_PAIRS)]);
		const determinism = createDeterminism({ query });

		determinism.schedule(machineG());
		expect(docs.length).toBe(0);
		expect(determinism.status()).toBe('checking');

		await vi.advanceTimersByTimeAsync(199);
		expect(docs.length).toBe(0);
		await vi.advanceTimersByTimeAsync(1);
		await settle();
		expect(docs.length).toBe(1);
		expect(determinism.status()).toBe('ready');
		expect(determinism.pairs()).toEqual(G_PAIRS);
		determinism.dispose();
	});

	it('U14: a burst of changes is one request, for the last document', async () => {
		vi.useFakeTimers();
		const { docs, query } = asked([ok(J_PAIRS)]);
		const determinism = createDeterminism({ query });
		const last = machineJ();
		for (let i = 0; i < 3; i++) determinism.schedule(machineG());
		for (let i = 0; i < 2; i++) determinism.schedule(last);
		await vi.advanceTimersByTimeAsync(200);
		await settle();
		expect(docs.length).toBe(1);
		expect(docs[0]).toBe(last);
		determinism.dispose();
	});

	it('U15: a new document hides the pairs of the old one before the answer arrives', async () => {
		vi.useFakeTimers();
		const { query } = asked([ok(G_PAIRS), ok([])]);
		const determinism = createDeterminism({ query });
		determinism.schedule(machineG());
		await vi.advanceTimersByTimeAsync(200);
		await settle();
		expect(determinism.pairs()).toEqual(G_PAIRS);

		determinism.schedule(machineF());
		expect(determinism.pairs()).toEqual([]);
		expect(determinism.status()).toBe('checking');
		await vi.advanceTimersByTimeAsync(200);
		await settle();
		expect(determinism.pairs()).toEqual([]);
		expect(determinism.status()).toBe('ready');
		determinism.dispose();
	});
});

describe('U16: an answer for an older document is dropped', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('U16: the answer of G arrives after J was asked about, and it is not shown', async () => {
		vi.useFakeTimers();
		const first = deferred();
		const second = deferred();
		const { docs, query } = asked([first.promise, second.promise]);
		const determinism = createDeterminism({ query });

		determinism.schedule(machineG());
		await vi.advanceTimersByTimeAsync(200);
		expect(docs.length).toBe(1);

		determinism.schedule(machineJ());
		await vi.advanceTimersByTimeAsync(200);
		expect(docs.length).toBe(2);

		// The answer about J comes back first: it is the newest question.
		second.resolve(ok(J_PAIRS));
		await settle();
		expect(determinism.pairs()).toEqual(J_PAIRS);
		expect(determinism.status()).toBe('ready');

		// The answer about G comes back last, and it is old: nothing changes.
		first.resolve(ok(G_PAIRS));
		await settle();
		expect(determinism.pairs()).toEqual(J_PAIRS);
		expect(determinism.status()).toBe('ready');
		determinism.dispose();
	});

	it('U17: an answer that arrives after a newer change, before its debounce, is dropped', async () => {
		vi.useFakeTimers();
		const first = deferred();
		const { query } = asked([first.promise, ok([])]);
		const determinism = createDeterminism({ query });

		determinism.schedule(machineG());
		await vi.advanceTimersByTimeAsync(200);
		// A new change before the answer of G is back.
		determinism.schedule(machineF());
		first.resolve(ok(G_PAIRS));
		await settle();
		expect(determinism.pairs()).toEqual([]);
		expect(determinism.status()).toBe('checking');
		determinism.dispose();
	});
});

describe('U18: a failure and dispose', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('U18: an engine that fails gives failed and no pairs', async () => {
		vi.useFakeTimers();
		const determinism = createDeterminism({ query: () => Promise.resolve(failed) });
		determinism.schedule(machineG());
		await vi.advanceTimersByTimeAsync(200);
		await settle();
		expect(determinism.status()).toBe('failed');
		expect(determinism.pairs()).toEqual([]);
		determinism.dispose();
	});

	it('U19: a query that rejects gives failed and no pairs', async () => {
		vi.useFakeTimers();
		const determinism = createDeterminism({
			query: () => Promise.reject(new Error('the worker is gone'))
		});
		determinism.schedule(machineG());
		await vi.advanceTimersByTimeAsync(200);
		await settle();
		expect(determinism.status()).toBe('failed');
		expect(determinism.pairs()).toEqual([]);
		determinism.dispose();
	});

	it('U20: dispose stops the waiting request and the questions after it', async () => {
		vi.useFakeTimers();
		const pending = deferred();
		const { docs, query } = asked([pending.promise, ok(J_PAIRS)]);
		const determinism = createDeterminism({ query });

		determinism.schedule(machineG());
		determinism.dispose();
		await vi.advanceTimersByTimeAsync(1000);
		expect(docs.length).toBe(0);

		// A document that arrives after dispose asks nothing.
		determinism.schedule(machineJ());
		await vi.advanceTimersByTimeAsync(1000);
		expect(docs.length).toBe(0);
		expect(determinism.pairs()).toEqual([]);
	});

	it('U21: an answer that comes back after dispose changes nothing', async () => {
		vi.useFakeTimers();
		const pending = deferred();
		const determinism = createDeterminism({ query: () => pending.promise });
		determinism.schedule(machineG());
		await vi.advanceTimersByTimeAsync(200);
		expect(determinism.status()).toBe('checking');
		determinism.dispose();
		pending.resolve(ok(G_PAIRS));
		await settle();
		expect(determinism.pairs()).toEqual([]);
		expect(determinism.status()).toBe('checking');
	});
});
