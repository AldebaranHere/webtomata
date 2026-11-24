// U of T-062: the determinism query of the engine, the reason sentence of a competing pair, and
// the model of the badge (docs/agent/PLAN.md, Task T-062). F1 to F5 are derived by hand in the plan
// and checked here against the real document functions; the pairs themselves come from
// `engine.pdaDeterminism`, proved against the real engine in `pda-determinism.wasm.test.ts`.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Competition, EngineResult } from '../engine/types.ts';
import {
	badgeModel,
	competitionReason,
	createDeterminism,
	dashedEdges,
	extraMarkedEdges
} from './pda-determinism.ts';
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

const pair = (from: number, first: number, second: number): Competition => ({
	from,
	first,
	second
});

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
const failed: EngineResult<Competition[]> = {
	ok: false,
	error: { key: 'engine.failed', params: {} }
};

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

	it('U22: the pairs of the old document are gone before the answer of the new one, which then shows its own', async () => {
		vi.useFakeTimers();
		// The second answer is resolved by hand, so the window between the question and the answer is
		// certain and not a matter of timing.
		const second = deferred();
		const { docs, query } = asked([ok(G_PAIRS), second.promise]);
		const determinism = createDeterminism({ query });

		determinism.schedule(machineG());
		await vi.advanceTimersByTimeAsync(200);
		await settle();
		expect(determinism.pairs()).toEqual(G_PAIRS);
		expect(determinism.status()).toBe('ready');

		// A new document, whose answer is not back: no pair is shown at all.
		determinism.schedule(machineJ());
		expect(determinism.pairs()).toEqual([]);
		expect(determinism.status()).toBe('checking');

		// The question about the new document is asked, and its answer is resolved by hand.
		await vi.advanceTimersByTimeAsync(200);
		expect(docs).toHaveLength(2);
		expect(determinism.pairs()).toEqual([]);
		second.resolve(ok(J_PAIRS));
		await settle();
		expect(determinism.pairs()).toEqual(J_PAIRS);
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

// ---- the drawing sets (T-070, F1 and F2) ----

/** A set of keys as a sorted array, so that a failure shows the exact edges. */
const keys = (set: ReadonlySet<string>) => [...set].sort();

describe('U23: F1, the edges of a DPDA that hold a competing transition', () => {
	it('U23: G as a DPDA with a ready answer dashes q0>q1 and q0>q0, and never q1>q1', () => {
		expect(keys(dashedEdges('dpda', 'ready', machineG(), G_PAIRS))).toEqual(['0>0', '0>1']);
	});

	it('U24: an NDPDA and every status but ready draw no dash, although the pairs are the same', () => {
		expect(keys(dashedEdges('ndpda', 'ready', machineG(), G_PAIRS))).toEqual([]);
		for (const status of ['idle', 'checking', 'failed'] as const) {
			expect(keys(dashedEdges('dpda', status, machineG(), G_PAIRS))).toEqual([]);
		}
	});

	it('U25: a DPDA with no pair, or with no pair in the answer, draws no dash', () => {
		expect(keys(dashedEdges('dpda', 'ready', machineF(), []))).toEqual([]);
		expect(keys(dashedEdges('dpda', 'ready', machineG(), []))).toEqual([]);
	});

	it('U26: an index that names no transition is ignored, and the other edge still dashes', () => {
		expect(keys(dashedEdges('dpda', 'ready', machineG(), [pair(0, 0, 9), pair(0, 1, 2)]))).toEqual([
			'0>0',
			'0>1'
		]);
	});
});

describe('U27: F2, the second edge of the shown transitions', () => {
	it('U27: pair 1 of G marks q0>q0, and not the edge that Tunjukkan selected', () => {
		expect(keys(extraMarkedEdges(machineG(), new Set([0, 1]), { from: 0, to: 1 }))).toEqual([
			'0>0'
		]);
	});

	it('U28: a pair on one edge adds nothing, and the "+ n lagi" rows of an edge are the same case', () => {
		// Pair 2 of G: both rows are q0>q1, so the marked edge is the only edge of the rows.
		expect(keys(extraMarkedEdges(machineG(), new Set([0, 2]), { from: 0, to: 1 }))).toEqual([]);
		// "+ n lagi" on q0>q1 marks exactly rows 0 and 2 with the edge itself: the same input, and
		// nothing extra either. (The function cannot tell the two callers apart, by design.)
		expect(keys(extraMarkedEdges(machineG(), new Set([0, 2]), { from: 0, to: 1 }))).toEqual([]);
	});

	it('U29: no mark gives no edge, and an index that names no transition is ignored', () => {
		expect(keys(extraMarkedEdges(machineG(), new Set(), null))).toEqual([]);
		expect(keys(extraMarkedEdges(machineG(), new Set([9, -1]), { from: 0, to: 1 }))).toEqual([]);
	});

	it('U30: without a marked edge every marked row counts; with it, only its own key is subtracted', () => {
		expect(keys(extraMarkedEdges(machineG(), new Set([0, 1]), null))).toEqual(['0>0', '0>1']);
		expect(keys(extraMarkedEdges(machineG(), new Set([0, 1]), { from: 0, to: 0 }))).toEqual([
			'0>1'
		]);
		// A marked row on a third edge is its own key, whatever the marked edge is.
		expect(keys(extraMarkedEdges(machineG(), new Set([3]), { from: 0, to: 1 }))).toEqual(['1>1']);
	});
});
