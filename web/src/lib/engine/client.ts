// The typed client for the engine worker. The UI imports this and nothing else from the engine.
import { METHODS } from './protocol.ts';
import type { CallMessage, EngineApi, EngineMethod, ReplyMessage } from './protocol.ts';
import type { EngineResult } from './types.ts';

/** The engine stopped while a call was waiting (an exception, a WASM trap, a worker error). */
export class EngineCrashed extends Error {
	constructor() {
		super('The engine crashed.');
		this.name = 'EngineCrashed';
	}
}

/** The call was canceled with `engine.cancel()`. */
export class EngineCancelled extends Error {
	constructor() {
		super('The call was canceled.');
		this.name = 'EngineCancelled';
	}
}

/** What the client needs from a worker, so that a test can use a fake. */
export interface WorkerLike {
	postMessage(message: CallMessage): void;
	terminate(): void;
	onmessage: ((event: MessageEvent<ReplyMessage>) => void) | null;
	onerror: ((event: ErrorEvent) => void) | null;
	onmessageerror: ((event: MessageEvent) => void) | null;
}

export type AsyncEngine = {
	[K in EngineMethod]: (...args: Parameters<EngineApi[K]>) => Promise<ReturnType<EngineApi[K]>>;
};

export type Engine = AsyncEngine & {
	/** Stops the running call and any waiting ones. They fail with `EngineCancelled`. */
	cancel(): void;
};

/**
 * Budgets for the web app, smaller than the engine defaults so that a cheap phone does not
 * work for a long time. A call can pass its own budget; its fields win.
 */
export const WEB_BUDGETS = {
	simulate: { maxSteps: 10_000 },
	determinize: { maxStates: 500 },
	minimize: { maxSteps: 20_000 },
	equivalent: { maxPairs: 20_000 },
	regexToFsm: { maxStates: 500 },
	fsmToRegex: { maxNodes: 500 },
	simplify: { maxChecks: 500, maxSteps: 5_000 },
	intersection: { maxStates: 500 }
} as const;

/** Where the budget is in the arguments of each method that has one. */
const BUDGET_ARGUMENT: Partial<Record<EngineMethod, number>> = {
	simulate: 2,
	determinize: 1,
	minimize: 1,
	equivalent: 2,
	regexToFsm: 2,
	fsmToRegex: 1,
	simplify: 2,
	intersection: 2
};

interface Waiting {
	resolve(result: EngineResult<unknown>): void;
	reject(error: unknown): void;
}

/**
 * Makes a client. The worker starts on the first call (so call after the first render). If the
 * worker fails, the waiting calls fail with `EngineCrashed` and the next call starts a new one.
 */
export function createEngine(spawn: () => WorkerLike, budgets: object = WEB_BUDGETS): Engine {
	let worker: WorkerLike | undefined;
	let nextId = 1;
	const waiting = new Map<number, Waiting>();

	/** Ends the worker and fails every waiting call with `error`. */
	function stop(error: Error): void {
		const old = worker;
		worker = undefined;
		old?.terminate();
		const calls = [...waiting.values()];
		waiting.clear();
		for (const call of calls) call.reject(error);
	}

	function start(): WorkerLike {
		const created = spawn();
		// Anything from a worker that is no longer the current one is ignored.
		const current = () => worker === created;
		created.onmessage = (event) => {
			if (!current()) return;
			const reply = event.data;
			if ('crashed' in reply) return stop(new EngineCrashed());
			const call = waiting.get(reply.id);
			if (call === undefined) return;
			waiting.delete(reply.id);
			call.resolve(reply.result);
		};
		created.onerror = () => current() && stop(new EngineCrashed());
		created.onmessageerror = () => current() && stop(new EngineCrashed());
		worker = created;
		return created;
	}

	function call(method: EngineMethod, args: unknown[]): Promise<EngineResult<unknown>> {
		const budgetAt = BUDGET_ARGUMENT[method];
		const sent = [...args];
		if (budgetAt !== undefined) {
			const defaults = (budgets as Record<string, object>)[method] ?? {};
			sent[budgetAt] = { ...defaults, ...(args[budgetAt] as object | undefined) };
		}
		return new Promise((resolve, reject) => {
			const id = nextId++;
			waiting.set(id, { resolve, reject });
			try {
				(worker ?? start()).postMessage({ id, method, args: sent });
			} catch (error) {
				// The arguments could not be sent (for example, they cannot be cloned).
				waiting.delete(id);
				reject(error);
			}
		});
	}

	const api = Object.fromEntries(
		METHODS.map((method) => [method, (...args: unknown[]) => call(method, args)])
	);
	return { ...api, cancel: () => stop(new EngineCancelled()) } as Engine;
}

/** The engine of the app. The worker starts on the first call. */
export const engine = createEngine(
	() => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
);

/** The engine version, for checking that the worker loaded the module. */
export async function engineVersion(): Promise<string> {
	const answer = await engine.version();
	if (!answer.ok) throw new Error(answer.error.key);
	return answer.value;
}
