let worker: Worker | undefined;

/** Starts the engine worker on first use, so call it after the first render. */
export function engineVersion(): Promise<string> {
	worker ??= new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
	const w = worker;
	return new Promise((resolve, reject) => {
		w.onmessage = (e: MessageEvent<string>) => resolve(e.data);
		w.onerror = (e) => reject(new Error(e.message));
		w.postMessage('version');
	});
}
