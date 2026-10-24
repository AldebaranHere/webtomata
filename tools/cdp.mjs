// A very small Chrome DevTools Protocol client over the WebSocket of Node. It is enough for the
// smoke test: send a command and wait for its answer, and listen to events.

/** Connects to the `webSocketDebuggerUrl` of a page. Returns `{ send, on, close }`. */
export async function connect(url) {
	const socket = new WebSocket(url);
	await new Promise((resolve, reject) => {
		socket.addEventListener('open', resolve, { once: true });
		socket.addEventListener('error', () => reject(new Error(`cannot connect to ${url}`)), {
			once: true
		});
	});

	let nextId = 1;
	const waiting = new Map();
	const handlers = new Map();

	socket.addEventListener('message', (event) => {
		const message = JSON.parse(event.data);
		if (message.id !== undefined) {
			const call = waiting.get(message.id);
			waiting.delete(message.id);
			if (message.error) call?.reject(new Error(`${call.method}: ${message.error.message}`));
			else call?.resolve(message.result);
		} else {
			for (const handler of handlers.get(message.method) ?? []) handler(message.params);
		}
	});

	return {
		send(method, params = {}) {
			const id = nextId++;
			return new Promise((resolve, reject) => {
				waiting.set(id, { method, resolve, reject });
				socket.send(JSON.stringify({ id, method, params }));
			});
		},
		on(method, handler) {
			handlers.set(method, [...(handlers.get(method) ?? []), handler]);
		},
		close: () => socket.close()
	};
}
