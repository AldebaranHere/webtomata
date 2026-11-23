// Running the test strings of a PDA in the engine, a little after each change, and never showing
// an answer for an older machine. The FSM has the same scheduler in `tester.ts`; this is the PDA's
// copy, because the document and the outcome are its own types (T-038a, decision 4; T-071 unifies
// the schedulers later).
//
// One call asks for all the strings that have no answer yet. A change of the machine forgets every
// answer at once (a badge for an older machine would be wrong), and waits a moment before it asks,
// so that a burst of edits is one call. A new string is asked at once, and only that string.
import { engineProblem } from '../engine/problem.ts';
import type { EngineProblem } from '../engine/problem.ts';
import type { EngineResult, PdaStringOutcome } from '../engine/types.ts';
import { pdaDocumentsEqual } from './pda-document.ts';
import type { PdaDocument } from './pda-document.ts';

/** idle: nothing was asked yet. checking: a change is waiting or the engine is working. ready: every string has its answer. failed: the engine did not answer. */
export type PdaTestStatus = 'idle' | 'checking' | 'ready' | 'failed';

export interface PdaTester {
	status(): PdaTestStatus;
	/** The answer for a string, or `undefined` while it is not known (or the machine changed). */
	outcome(input: string): PdaStringOutcome | undefined;
	problem(): EngineProblem | undefined;
	subscribe(listener: () => void): () => void;
	schedule(doc: PdaDocument, tests: readonly string[]): void;
	/** Asks again (the button of the notice). */
	retry(): void;
	dispose(): void;
}

export function createPdaTester(options: {
	run: (doc: PdaDocument, inputs: string[]) => Promise<EngineResult<PdaStringOutcome[]>>;
	delayMs?: number;
}): PdaTester {
	const { run, delayMs = 300 } = options;
	let status: PdaTestStatus = 'idle';
	let problem: EngineProblem | undefined;
	/** The machine that the answers are for. */
	let forDoc: PdaDocument | null = null;
	let answers = new Map<string, PdaStringOutcome>();
	let newest: { doc: PdaDocument; tests: readonly string[] } | null = null;
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
			const sameMachine = forDoc !== null && pdaDocumentsEqual(forDoc, doc);
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
