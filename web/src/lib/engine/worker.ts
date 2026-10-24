// The only module allowed to import the WASM package (see eslint.config.js).
import init, * as wasm from './wasm/engine_wasm.js';
import { createHandlers, run } from './handlers.ts';
import type { CallMessage, ReplyMessage } from './protocol.ts';

const ready = init();
// If loading the WASM file fails, the first call finds out through `await ready` below and reports
// a crash. Marking the failure as handled here keeps the browser from also logging it as an
// uncaught error, which nobody can act on.
ready.catch(() => undefined);
const handlers = createHandlers(wasm);

self.onmessage = async (event: MessageEvent<CallMessage>) => {
	const { id, method, args } = event.data;
	try {
		await ready;
		self.postMessage({ id, result: run(handlers, method, args) } satisfies ReplyMessage);
	} catch {
		// An exception from the engine can be a WASM trap. Its memory may be broken, so this
		// worker does not answer again; the client starts a new one.
		self.postMessage({ id, crashed: true } satisfies ReplyMessage);
		self.close();
	}
};
