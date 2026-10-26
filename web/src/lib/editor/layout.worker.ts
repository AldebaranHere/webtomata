// The layout worker: it holds the library, so that the library is loaded only when it is needed,
// and the page is never busy while it works. It answers each graph with the places of the states,
// or with an error (the page then says so calmly).
import { computeLayout } from './layout-dagre.ts';
import type { LayoutReply } from './layout-client.ts';
import type { LayoutGraph } from './layout.ts';

self.onmessage = (event: MessageEvent<{ id: number; graph: LayoutGraph }>) => {
	const { id, graph } = event.data;
	let reply: LayoutReply;
	try {
		reply = { id, positions: computeLayout(graph) };
	} catch {
		reply = { id, error: 'failed' };
	}
	self.postMessage(reply);
};
