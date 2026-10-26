// Auto layout, the part that has no library in it (the library is in layout-dagre.ts, which only
// the layout worker imports, so that it is not in the first load of the page). This file turns a
// document into the graph that the layout needs, and the places that come back into one command
// of the document, so that "Tata letak otomatis" is one step of the one history. No DOM.
import type { MessageKey } from '#lib/i18n/id.ts';
import type { Params } from '#lib/i18n/translate.ts';
import type { Command } from './commands.ts';
import { LIMITS } from './document.ts';
import type { MachineDocument } from './document.ts';

/** A machine that is bigger than this is not laid out: it would take too long on a cheap phone. */
export const LAYOUT_LIMITS = { states: 400 } as const;

export interface LayoutGraph {
	/** The ids of the states, in order. */
	nodes: number[];
	/** One edge for each ordered pair of different states that have a transition, in order. */
	edges: { from: number; to: number }[];
	/** The start state, or null: it is put first, on the left. */
	start: number | null;
}

/** The center of a state, as the layout puts it. The origin is not meaningful: `placeAll` moves it. */
export interface LayoutPosition {
	id: number;
	x: number;
	y: number;
}

export function layoutGraph(doc: MachineDocument): LayoutGraph {
	const seen = new Set<string>();
	const edges: LayoutGraph['edges'] = [];
	for (const t of doc.transitions) {
		// A loop does not change where a state goes; a pair with several symbols is one edge.
		if (t.from === t.to) continue;
		const key = `${t.from}>${t.to}`;
		if (seen.has(key)) continue;
		seen.add(key);
		edges.push({ from: t.from, to: t.to });
	}
	return { nodes: doc.states.map((s) => s.id), edges, start: doc.start };
}

/** Why a machine cannot be laid out, as a message key; null when it can (also when it is empty). */
export function refusalOf(doc: MachineDocument): { key: MessageKey; params: Params } | null {
	if (doc.states.length > LAYOUT_LIMITS.states) {
		return { key: 'layout.too_big', params: { limit: LAYOUT_LIMITS.states } };
	}
	return null;
}

const clamp = (n: number) => Math.max(-LIMITS.coordinate, Math.min(LIMITS.coordinate, n));
const boxCenter = (points: readonly { x: number; y: number }[]) => ({
	x: (Math.min(...points.map((p) => p.x)) + Math.max(...points.map((p) => p.x))) / 2,
	y: (Math.min(...points.map((p) => p.y)) + Math.max(...points.map((p) => p.y))) / 2
});

/**
 * The command that puts the states where the layout says, as one batch of moves. The layout is
 * moved so that the center of its box is where the center of the machine's box was, so that the
 * view does not jump. A place for a state that is not there is ignored, and a state that has no
 * place stays where it is. `null` when nothing would move.
 */
export function placeAll(
	doc: MachineDocument,
	positions: readonly LayoutPosition[]
): Command | null {
	const known = new Map(doc.states.map((s) => [s.id, s]));
	const placed = positions.filter((p) => known.has(p.id));
	if (placed.length === 0) return null;
	const from = boxCenter(doc.states);
	const to = boxCenter(placed);
	const moves: Command[] = [];
	for (const p of placed) {
		const state = known.get(p.id)!;
		const x = Math.round(clamp(p.x + (from.x - to.x)));
		const y = Math.round(clamp(p.y + (from.y - to.y)));
		if (x !== state.x || y !== state.y) moves.push({ type: 'moveState', id: p.id, x, y });
	}
	if (moves.length === 0) return null;
	return moves.length === 1 ? moves[0]! : { type: 'batch', commands: moves };
}
