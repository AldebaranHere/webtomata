// B7 (T-071): the tester's equality is the caller's. The FSM's `documentsEqual` compares `on` and
// ignores `pop` and `push`, so two different PDAs would look equal and the old rows would be kept.
// The types refuse a PDA that does not pass its own equality, and these tests prove that the
// equality really is used.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EngineResult, PdaStringOutcome } from '../engine/types.ts';
import { documentsEqual } from './document.ts';
import { pdaDocumentsEqual } from './pda-document.ts';
import type { PdaDocument } from './pda-document.ts';
import { pdaDocumentFrom } from './pda-samples.ts';
import { createTester } from './tester.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Two PDAs that differ only in the pop (or the push) of the loop transition. */
const machine = (pop: string[], push: string[]): PdaDocument =>
	pdaDocumentFrom({
		title: 'the same machine',
		kind: 'dpda',
		inputAlphabet: ['a'],
		stackAlphabet: ['A'],
		states: [
			[100, 100, 'q0'],
			[300, 100, 'q1']
		],
		start: 0,
		accepting: [1],
		transitions: [
			[0, 'a', pop, push, 0],
			[0, null, ['A'], [], 1]
		]
	});

/** A fake engine: every string is accepted. */
function fake() {
	const run = vi.fn(
		async (_doc: PdaDocument, inputs: string[]): Promise<EngineResult<PdaStringOutcome[]>> => ({
			ok: true,
			value: inputs.map((input) => ({ result: 'accepted' as const, input, peak: 1 }))
		})
	);
	return { run };
}

describe('B7: the tester treats two different PDAs as different machines', () => {
	it('a pop that differs is a different machine, so the old rows are not kept', async () => {
		const { run } = fake();
		const tester = createTester({ run, sameDocument: pdaDocumentsEqual, delayMs: 300 });

		tester.schedule(machine(['A'], ['A']), ['a']);
		await vi.advanceTimersByTimeAsync(300);
		expect(tester.outcome('a')).toEqual({ result: 'accepted', input: 'a', peak: 1 });

		tester.schedule(machine([], ['A']), ['a']);
		expect(tester.outcome('a')).toBeUndefined();
		expect(tester.status()).toBe('checking');
		await vi.advanceTimersByTimeAsync(300);
		expect(run).toHaveBeenCalledTimes(2);
		expect(tester.outcome('a')).toEqual({ result: 'accepted', input: 'a', peak: 1 });
	});

	it('a push that differs is a different machine, so the old rows are not kept', async () => {
		const { run } = fake();
		const tester = createTester({ run, sameDocument: pdaDocumentsEqual, delayMs: 300 });

		tester.schedule(machine(['A'], ['A']), ['a']);
		await vi.advanceTimersByTimeAsync(300);
		expect(tester.outcome('a')).toEqual({ result: 'accepted', input: 'a', peak: 1 });

		tester.schedule(machine(['A'], ['A', 'A']), ['a']);
		expect(tester.outcome('a')).toBeUndefined();
		await vi.advanceTimersByTimeAsync(300);
		expect(run).toHaveBeenCalledTimes(2);
	});
});

describe('B7: a PDA cannot reach the FSM equality through the types', () => {
	it('a PDA document that omits sameDocument does not compile', () => {
		const { run } = fake();
		// @ts-expect-error — a `PdaDocument` must pass its own equality; the FSM's keeps old rows.
		const build = () => createTester({ run });
		expect(build).toBeDefined();
	});

	it('the FSM equality cannot be passed for a PDA document', () => {
		const { run } = fake();
		// @ts-expect-error — `documentsEqual` takes a `MachineDocument`, and a PDA is not one.
		const build = () => createTester({ run, sameDocument: documentsEqual });
		expect(build).toBeDefined();
	});
});
