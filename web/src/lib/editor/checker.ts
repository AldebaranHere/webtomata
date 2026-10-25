// Checking the machine in the engine after each change, a little later, and never showing an answer
// for an older machine. No DOM and no framework: the editor calls `schedule` with each new document
// and shows `items`, `status` and `problem`. The engine runs in a worker, so this never blocks a tap.
import { engineProblem } from '../engine/problem.ts';
import type { EngineProblem } from '../engine/problem.ts';
import type { EngineResult, Issue } from '../engine/types.ts';
import { checkItems } from './checks.ts';
import type { CheckItem } from './checks.ts';
import type { MachineDocument } from './document.ts';

/** idle: nothing was asked yet. checking: a change is waiting or the engine is working. ready: `items` are for the newest document. failed: the engine did not answer. */
export type CheckStatus = 'idle' | 'checking' | 'ready' | 'failed';

export interface Checker {
	status(): CheckStatus;
	items(): CheckItem[];
	/** What to tell the user when the engine failed (with a way to try again). */
	problem(): EngineProblem | undefined;
	subscribe(listener: () => void): () => void;
	schedule(doc: MachineDocument): void;
	/** Asks again for the newest document (the button of the notice). */
	retry(): void;
	dispose(): void;
}

export function createChecker(options: {
	validate: (doc: MachineDocument) => Promise<EngineResult<Issue[]>>;
	delayMs?: number;
}): Checker {
	const { validate, delayMs = 200 } = options;
	let status: CheckStatus = 'idle';
	let items: CheckItem[] = [];
	let problem: EngineProblem | undefined;
	let newest: MachineDocument | null = null;
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
			const answer = await validate(doc);
			// A newer document was asked about meanwhile: this answer is old.
			if (mine !== sequence || disposed) return;
			if (answer.ok) {
				items = checkItems(answer.value, doc);
				problem = undefined;
				status = 'ready';
			} else {
				items = [];
				problem = engineProblem(new Error(answer.error.key));
				status = 'failed';
			}
		} catch (error) {
			if (mine !== sequence || disposed) return;
			items = [];
			problem = engineProblem(error);
			// A call that the app canceled itself has no problem to show: go back to waiting.
			status = problem ? 'failed' : 'idle';
		}
		emit();
	}

	return {
		status: () => status,
		items: () => items,
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
