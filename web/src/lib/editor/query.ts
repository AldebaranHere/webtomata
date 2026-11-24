// One scheduled query: ask the engine about the newest document a moment after each change, and
// never show an answer for an older document. No DOM and no framework: the caller calls `schedule`
// with each new document and shows `value`, `status` and `problem`. The engine runs in a worker, so
// this never blocks a tap.
//
// The checker (the FSM's and the PDA's) and the PDA's determinism badge use this (T-071). They
// differ in three things, and only in these: what an answer becomes (the checks list, the competing
// pairs), whether the shown value is emptied the moment a new document is scheduled (the badge must
// not show an answer for an older document; the checks list keeps the old items until the new
// answer), and whether a failed call keeps a problem to show (the badge has no notice).
import { engineProblem } from '../engine/problem.ts';
import type { EngineProblem } from '../engine/problem.ts';
import type { EngineResult } from '../engine/types.ts';

/** idle: nothing was asked yet. checking: a change is waiting or the engine is working. ready: `value` is for the newest document. failed: the engine did not answer. */
export type QueryStatus = 'idle' | 'checking' | 'ready' | 'failed';

export interface Query<D, V> {
	status(): QueryStatus;
	/** What the caller shows for the newest answer. */
	value(): V;
	/** What to tell the user when the engine failed (with a way to try again). */
	problem(): EngineProblem | undefined;
	subscribe(listener: () => void): () => void;
	schedule(doc: D): void;
	/** Asks again for the newest document (the button of the notice). */
	retry(): void;
	dispose(): void;
}

export function createQuery<D, R, V>(options: {
	/** Asks the engine about one document. */
	ask: (doc: D) => Promise<EngineResult<R>>;
	/** Turns an answer into the shown value; it gets the document the answer is for. */
	toValue: (answer: R, doc: D) => V;
	/** The value that means "nothing to show"; also used when an answer fails. */
	empty: () => V;
	/** true: the value is emptied at `schedule`, so an old answer cannot show. Default false. */
	emptyAtSchedule?: boolean;
	/** true: a failure keeps a problem, and a cancelled call goes back to idle. Default true. */
	keepsProblem?: boolean;
	delayMs?: number;
}): Query<D, V> {
	const {
		ask,
		toValue,
		empty,
		emptyAtSchedule = false,
		keepsProblem = true,
		delayMs = 200
	} = options;
	let status: QueryStatus = 'idle';
	let value = empty();
	let problem: EngineProblem | undefined;
	let newest: D | null = null;
	let sequence = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let disposed = false;
	const listeners = new Set<() => void>();

	const emit = () => {
		for (const listener of [...listeners]) listener();
	};

	async function run() {
		const doc = newest;
		if (!doc || disposed) return;
		const mine = ++sequence;
		try {
			const answer = await ask(doc);
			// A newer document was asked about meanwhile: this answer is old.
			if (mine !== sequence || disposed) return;
			if (answer.ok) {
				value = toValue(answer.value, doc);
				problem = undefined;
				status = 'ready';
			} else {
				value = empty();
				problem = keepsProblem ? engineProblem(new Error(answer.error.key)) : undefined;
				status = 'failed';
			}
		} catch (error) {
			if (mine !== sequence || disposed) return;
			value = empty();
			problem = keepsProblem ? engineProblem(error) : undefined;
			// A call that the app canceled itself has no problem to show: go back to waiting.
			status = !keepsProblem || problem ? 'failed' : 'idle';
		}
		emit();
	}

	return {
		status: () => status,
		value: () => value,
		problem: () => problem,
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		schedule(doc) {
			if (disposed) return;
			newest = doc;
			// Older answers are no use any more, also one that is on its way.
			sequence++;
			// A badge never shows the answer for an older document: while the new answer is on its
			// way there is no badge, not an old one.
			if (emptyAtSchedule) value = empty();
			status = 'checking';
			clearTimeout(timer);
			timer = setTimeout(() => void run(), delayMs);
			emit();
		},
		retry() {
			if (disposed || !newest) return;
			status = 'checking';
			clearTimeout(timer);
			emit();
			void run();
		},
		dispose() {
			disposed = true;
			clearTimeout(timer);
			listeners.clear();
		}
	};
}
