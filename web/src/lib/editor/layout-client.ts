// The page's side of the layout worker. The worker (layout.worker.ts) holds the library and starts
// on the first call, so the library is loaded only when "Tata letak otomatis" is used. One call at
// a time: a new call, or `cancel`, ends the one that is waiting. A call that takes too long, or a
// worker that fails, ends the worker (the only way to stop it) and the next call starts a new one.
import type { LayoutGraph, LayoutPosition } from './layout.ts';

/** The layout could not be made (an error in the worker, or no worker in this browser). */
export class LayoutFailed extends Error {
	constructor() {
		super('The layout failed.');
		this.name = 'LayoutFailed';
	}
}
/** It took too long. */
export class LayoutTimeout extends Error {
	constructor(readonly timeoutMs: number) {
		super(`The layout did not finish within ${timeoutMs} ms.`);
		this.name = 'LayoutTimeout';
	}
}
/** The page asked to stop (a new call, or `cancel`). Nothing to show to the user. */
export class LayoutCancelled extends Error {
	constructor() {
		super('The layout was canceled.');
		this.name = 'LayoutCancelled';
	}
}

export type LayoutReply =
	{ id: number; positions: LayoutPosition[] } | { id: number; error: string };

/** What the client needs from a worker, so that a test can use a fake. */
export interface LayoutWorkerLike {
	postMessage(message: unknown): void;
	terminate(): void;
	onmessage: ((event: { data: LayoutReply }) => void) | null;
	onerror: (() => void) | null;
}

export interface LayoutClient {
	run(graph: LayoutGraph): Promise<LayoutPosition[]>;
	/** Ends the call that is waiting, and the worker. */
	cancel(): void;
}

export function createLayoutClient(spawn: () => LayoutWorkerLike, timeoutMs = 5000): LayoutClient {
	let worker: LayoutWorkerLike | undefined;
	let nextId = 1;
	let waiting:
		| {
				id: number;
				resolve: (positions: LayoutPosition[]) => void;
				reject: (error: Error) => void;
				timer: ReturnType<typeof setTimeout>;
		  }
		| undefined;

	/** Ends the worker and the call that waits, with `error`. */
	function stop(error: Error) {
		const old = worker;
		worker = undefined;
		old?.terminate();
		const call = waiting;
		waiting = undefined;
		if (call) {
			clearTimeout(call.timer);
			call.reject(error);
		}
	}

	return {
		run(graph) {
			// One call at a time: a new one ends the old one (and its worker, which may be busy).
			if (waiting) stop(new LayoutCancelled());
			return new Promise((resolve, reject) => {
				try {
					if (!worker) {
						const created = spawn();
						created.onmessage = (event) => {
							// Anything from a worker that is no longer the current one is ignored.
							if (worker !== created || !waiting || event.data.id !== waiting.id) return;
							const call = waiting;
							waiting = undefined;
							clearTimeout(call.timer);
							if ('error' in event.data) call.reject(new LayoutFailed());
							else call.resolve(event.data.positions);
						};
						created.onerror = () => {
							if (worker === created) stop(new LayoutFailed());
						};
						worker = created;
					}
				} catch {
					reject(new LayoutFailed());
					return;
				}
				const id = nextId++;
				const timer = setTimeout(() => stop(new LayoutTimeout(timeoutMs)), timeoutMs);
				waiting = { id, resolve, reject, timer };
				try {
					worker.postMessage({ id, graph });
				} catch {
					stop(new LayoutFailed());
				}
			});
		},
		cancel() {
			stop(new LayoutCancelled());
		}
	};
}

/** The layout of the app. The worker starts on the first call. */
export const layoutClient = createLayoutClient(
	() =>
		new Worker(new URL('./layout.worker.ts', import.meta.url), {
			type: 'module'
		}) as unknown as LayoutWorkerLike
);
