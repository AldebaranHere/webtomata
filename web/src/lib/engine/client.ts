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

/** The engine did not answer in time. The worker was ended, because that is the only way to stop it. */
export class EngineTimeout extends Error {
	constructor(readonly timeoutMs: number) {
		super(`The engine did not answer within ${timeoutMs} ms.`);
		this.name = 'EngineTimeout';
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

/**
 * How long a call may take. The budgets bound the steps of the engine, not the time (a big
 * `minimize` takes seconds), so this is the backstop. The worst call that we measured takes about
 * 1.4 s in the browser of a laptop; 10 s leaves room for a cheap phone. Until the worker has
 * answered once, a call may also wait for the WASM file to load, so it gets more time.
 */
export const WEB_TIMEOUTS = { callMs: 10_000, startMs: 30_000 };

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
	message: CallMessage;
	resolve(result: EngineResult<unknown>): void;
	reject(error: unknown): void;
	timer?: ReturnType<typeof setTimeout>;
}

/** A limit that is a positive finite number, or the default. */
const limit = (value: number | undefined, fallback: number) =>
	typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;

/**
 * Makes a client. The worker starts on the first call (so call after the first render).
 *
 * - If the worker fails, the waiting calls fail with `EngineCrashed` and the next call starts a
 *   new one.
 * - A call that gets no answer within its time fails with `EngineTimeout`. The worker is ended
 *   and replaced. The other calls that were waiting are sent again to the new worker, with a new
 *   clock: they did nothing wrong, and a call has no side effect. A call that also hangs times
 *   out by itself, so this ends.
 */
export function createEngine(
	spawn: () => WorkerLike,
	budgets: object = WEB_BUDGETS,
	timeouts: Partial<typeof WEB_TIMEOUTS> = WEB_TIMEOUTS
): Engine {
	const callMs = limit(timeouts.callMs, WEB_TIMEOUTS.callMs);
	const startMs = limit(timeouts.startMs, WEB_TIMEOUTS.startMs);
	let worker: WorkerLike | undefined;
	// Has the current worker answered? Then it has loaded the WASM file, and a call is short.
	let answered = false;
	let nextId = 1;
	const waiting = new Map<number, Waiting>();

	/** Ends the worker and fails every waiting call with `error`. */
	function stop(error: Error): void {
		const old = worker;
		worker = undefined;
		old?.terminate();
		const calls = [...waiting.values()];
		waiting.clear();
		for (const call of calls) {
			clearTimeout(call.timer);
			call.reject(error);
		}
	}

	/** Ends the worker after the call `id` timed out, and sends the other waiting calls again. */
	function timeOut(id: number, ms: number): void {
		const culprit = waiting.get(id);
		if (culprit === undefined) return;
		waiting.delete(id);
		const old = worker;
		worker = undefined;
		old?.terminate();
		culprit.reject(new EngineTimeout(ms));

		const others = [...waiting.entries()];
		if (others.length === 0) return;
		const fresh = start();
		for (const [otherId, other] of others) {
			clearTimeout(other.timer);
			send(fresh, otherId, other);
		}
	}

	/** Sends a call to the worker and starts its clock. */
	function send(target: WorkerLike, id: number, call: Waiting): void {
		const ms = answered ? callMs : startMs;
		call.timer = setTimeout(() => timeOut(id, ms), ms);
		try {
			target.postMessage(call.message);
		} catch (error) {
			// The arguments could not be sent (for example, they cannot be cloned).
			clearTimeout(call.timer);
			waiting.delete(id);
			call.reject(error);
		}
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
			answered = true;
			waiting.delete(reply.id);
			clearTimeout(call.timer);
			call.resolve(reply.result);
		};
		created.onerror = () => current() && stop(new EngineCrashed());
		created.onmessageerror = () => current() && stop(new EngineCrashed());
		worker = created;
		answered = false;
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
			const entry: Waiting = { message: { id, method, args: sent }, resolve, reject };
			waiting.set(id, entry);
			send(worker ?? start(), id, entry);
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
