// Checking the machine in the engine after each change, a little later, and never showing an answer
// for an older machine. No DOM and no framework: the editor calls `schedule` with each new document
// and shows `items`, `status` and `problem`. The engine runs in a worker, so this never blocks a tap.
// The query itself (debounce, sequence number, dispose) is `createQuery` in `query.ts`, shared with
// the PDA's determinism badge (T-071).
import type { EngineProblem } from '../engine/problem.ts';
import type { EngineResult, Issue } from '../engine/types.ts';
import { checkItems } from './checks.ts';
import type { CheckItem } from './checks.ts';
import type { MachineDocument } from './document.ts';
import { createQuery } from './query.ts';
import type { QueryStatus } from './query.ts';

/** idle: nothing was asked yet. checking: a change is waiting or the engine is working. ready: `items` are for the newest document. failed: the engine did not answer. */
export type CheckStatus = QueryStatus;

export interface Checker<D = MachineDocument> {
	status(): CheckStatus;
	items(): CheckItem[];
	/** What to tell the user when the engine failed (with a way to try again). */
	problem(): EngineProblem | undefined;
	subscribe(listener: () => void): () => void;
	schedule(doc: D): void;
	/** Asks again for the newest document (the button of the notice). */
	retry(): void;
	dispose(): void;
}

export function createChecker<D = MachineDocument>(options: {
	validate: (doc: D) => Promise<EngineResult<Issue[]>>;
	toItems?: (issues: readonly Issue[], doc: D) => CheckItem[];
	delayMs?: number;
}): Checker<D> {
	const {
		validate,
		toItems = checkItems as unknown as (issues: readonly Issue[], doc: D) => CheckItem[],
		delayMs
	} = options;
	const query = createQuery<D, Issue[], CheckItem[]>({
		ask: validate,
		toValue: toItems,
		empty: () => [],
		delayMs
	});
	// The checks' name for the query's value. The spread keeps the FSM's first load at its old size
	// (T-071: the schedule, the sequence number and dispose moved into query.ts, not out of it).
	return { ...query, items: query.value };
}
