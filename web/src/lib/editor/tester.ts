// Running the test strings of a machine in the engine, a little after each change, and never
// showing an answer for an older machine. No DOM and no framework, like query.ts: the editor
// calls `schedule` with the document and the list, and shows `outcome(string)` for each row.
//
// One call asks for all the strings that have no answer yet. A change of the machine forgets every
// answer at once (a badge for an older machine would be wrong), and waits a moment before it asks,
// so that a burst of edits is one call. A new string is asked at once, and only that string.
//
// The FSM and the PDA share this function (T-071). The document and the outcome are the caller's
// types; so is the equality that says whether two documents are the same machine, because the FSM's
// `documentsEqual` reads fields that a PDA does not have and would keep an answer for a machine that
// changed (see `fsmSameDocument`).
import { engineProblem } from '../engine/problem.ts';
import type { EngineProblem } from '../engine/problem.ts';
import type { StringOutcome } from '../engine/protocol.ts';
import type { EngineResult } from '../engine/types.ts';
import { documentsEqual } from './document.ts';
import type { MachineDocument } from './document.ts';

/** idle: nothing was asked yet. checking: a change is waiting or the engine is working. ready: every string has its answer. failed: the engine did not answer. */
export type TestStatus = 'idle' | 'checking' | 'ready' | 'failed';

export interface Tester<D = MachineDocument, O = StringOutcome> {
	status(): TestStatus;
	/** The answer for a string, or `undefined` while it is not known (or the machine changed). */
	outcome(input: string): O | undefined;
	problem(): EngineProblem | undefined;
	subscribe(listener: () => void): () => void;
	schedule(doc: D, tests: readonly string[]): void;
	/** Asks again (the button of the notice). */
	retry(): void;
	dispose(): void;
}

export interface TesterOptions<D, O> {
	run: (doc: D, inputs: string[]) => Promise<EngineResult<O[]>>;
	/**
	 * When two documents are the same machine. Required unless the document is a `MachineDocument`,
	 * whose own equality is the default: another document needs its own, or the FSM's fields are
	 * read and its answers survive a real change.
	 */
	sameDocument?: (a: D, b: D) => boolean;
	delayMs?: number;
}

/**
 * The FSM's tester: the machine's own equality is the default, so its callers pass only `run` (and
 * sometimes `delayMs`).
 */
export function createTester(
	options: TesterOptions<MachineDocument, StringOutcome> & { sameDocument?: undefined }
): Tester<MachineDocument, StringOutcome>;
/**
 * Any other document (the PDA today): the caller must say when two documents are the same machine.
 * A PDA cannot reach the FSM's equality here, by omission or by passing it (it is not a
 * `MachineDocument`), because that equality reads `on` and ignores `pop` and `push` (guard B7).
 */
export function createTester<D, O extends { input: string }>(
	options: TesterOptions<D, O> & { sameDocument: (a: D, b: D) => boolean }
): Tester<D, O>;
export function createTester<D, O extends { input: string }>(
	options: TesterOptions<D, O>
): Tester<D, O> {
	const { run, delayMs = 300 } = options;
	// The FSM's equality, cast once. The overloads above allow a call without `sameDocument` only
	// when the document is a `MachineDocument`, so the cast cannot receive a PDA at run time (B7).
	const sameDocument = options.sameDocument ?? (documentsEqual as (a: D, b: D) => boolean);
	let status: TestStatus = 'idle';
	let problem: EngineProblem | undefined;
	/** The machine that the answers are for. */
	let forDoc: D | null = null;
	let answers = new Map<string, O>();
	let newest: { doc: D; tests: readonly string[] } | null = null;
	let sequence = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let disposed = false;
	const listeners = new Set<() => void>();

	const emit = () => {
		for (const listener of [...listeners]) listener();
	};

	async function ask() {
		const current = newest;
		if (!current || disposed) return;
		const need = current.tests.filter((input) => !answers.has(input));
		if (need.length === 0) {
			status = 'ready';
			emit();
			return;
		}
		const mine = ++sequence;
		try {
			const answer = await run(current.doc, need);
			// Something newer was asked meanwhile: this answer is old.
			if (mine !== sequence || disposed) return;
			if (answer.ok) {
				for (const outcome of answer.value) answers.set(outcome.input, outcome);
				problem = undefined;
				status = 'ready';
			} else {
				problem = engineProblem(new Error(answer.error.key));
				status = 'failed';
			}
		} catch (error) {
			if (mine !== sequence || disposed) return;
			problem = engineProblem(error);
			// A call that the app canceled itself has no problem to show: go back to waiting.
			status = problem ? 'failed' : 'idle';
		}
		emit();
	}

	return {
		status: () => status,
		outcome: (input) => answers.get(input),
		problem: () => problem,
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		schedule(doc, tests) {
			if (disposed) return;
			const sameMachine = forDoc !== null && sameDocument(forDoc, doc);
			if (!sameMachine) answers = new Map();
			forDoc = doc;
			newest = { doc, tests };
			// Older answers are no use any more, also one that is on its way.
			sequence++;
			problem = undefined;
			clearTimeout(timer);
			const need = tests.some((input) => !answers.has(input));
			status = need ? 'checking' : 'ready';
			// A change of the machine waits for the next one; a new string is asked at once.
			if (need) timer = setTimeout(() => void ask(), sameMachine ? 0 : delayMs);
			emit();
		},
		retry() {
			if (disposed || !newest) return;
			problem = undefined;
			status = 'checking';
			clearTimeout(timer);
			emit();
			void ask();
		},
		dispose() {
			disposed = true;
			sequence++;
			clearTimeout(timer);
			listeners.clear();
		}
	};
}
