// The layout itself, with the library dagre (MIT, a layered layout). Only the layout worker imports
// this file, so the library is in its own file and is loaded when "Tata letak otomatis" is used,
// never in the first load of the page. A test reads the build and fails if it is in the first load.
import dagre from '@dagrejs/dagre';
import { RADIUS } from './diagram/geometry.ts';
import type { LayoutGraph, LayoutPosition } from './layout.ts';

/** A state is a circle; the layout keeps this much room around each one. */
const NODE = 2 * RADIUS;
/** The room between two states in the same column, and between columns (edges and labels go there). */
const NODE_SEPARATION = 70;
const RANK_SEPARATION = 120;
/** A virtual state before the start state, so that the start state is in the first column. */
const SOURCE = 'start';

/**
 * Places the states left to right, as the textbook draws them. The same graph gives the same places.
 * The places are the centers of the circles; the origin is not meaningful.
 */
export function computeLayout(graph: LayoutGraph): LayoutPosition[] {
	const g = new dagre.graphlib.Graph();
	g.setGraph({
		rankdir: 'LR',
		nodesep: NODE_SEPARATION,
		ranksep: RANK_SEPARATION,
		marginx: 0,
		marginy: 0
	});
	g.setDefaultEdgeLabel(() => ({}));
	for (const id of graph.nodes) g.setNode(String(id), { width: NODE, height: NODE });
	for (const edge of graph.edges) g.setEdge(String(edge.from), String(edge.to));
	if (graph.start !== null && graph.nodes.includes(graph.start)) {
		g.setNode(SOURCE, { width: 1, height: 1 });
		g.setEdge(SOURCE, String(graph.start));
	}
	dagre.layout(g);
	return graph.nodes.map((id) => {
		const node = g.node(String(id));
		return { id, x: node.x, y: node.y };
	});
}
