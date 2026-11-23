// Adapter that turns a `PdaDocument` (T-033) into a neutral `DiagramInput` (T-039) for
// `diagramGeometry`. See `design/screens/pda-editor.md`, section 2.
import type { PdaDocument, PdaTransitionEntry } from '../pda-document.ts';
import type { DiagramEdgeInput, DiagramInput } from './geometry.ts';

const MAX_EDGE_LINES = 3;

export function stackSeparator(stackAlphabet: readonly string[]): string {
	return stackAlphabet.every((s) => [...s].length === 1) ? '' : ' ';
}

export function formatStackSeq(seq: readonly string[], sep: string): string {
	return seq.length === 0 ? 'ε' : seq.join(sep);
}

function formatTransition(t: PdaTransitionEntry, sep: string): string {
	return `${t.read ?? 'ε'} / ${formatStackSeq(t.pop, sep)} / ${formatStackSeq(t.push, sep)}`;
}

/**
 * Formats one PDA transition as `read / pop / push` (`ε` for empty read, pop or push; leftmost
 * symbol is the top of the stack). The stack alphabet of the whole document decides whether stack
 * symbols are joined without spaces (`AB`) or with a single space (`Z0 A`).
 */
export function transitionLabel(doc: PdaDocument, transition: PdaTransitionEntry): string {
	return formatTransition(transition, stackSeparator(doc.stackAlphabet));
}

/**
 * Text of all transitions between `from` and `to` in `doc.transitions` order, joined by `; `.
 * Used by `pdaDiagram` for screen reader edge descriptions and by the PDA editor kind.
 */
export function pdaEdgeText(doc: PdaDocument, from: number, to: number): string {
	const sep = stackSeparator(doc.stackAlphabet);
	return doc.transitions
		.filter((t) => t.from === from && t.to === to)
		.map((t) => formatTransition(t, sep))
		.join('; ');
}

/**
 * Turns a `PdaDocument` into a `DiagramInput`. Transitions are grouped by `(from, to)` sorted by
 * `from` then `to`, with lines in `doc.transitions` order (the engine's order). An edge with more
 * than three transitions shows the first two and `more(count - 2)` on the third line, while `text`
 * lists all transitions joined by `; ` for screen readers.
 */
export function pdaDiagram(doc: PdaDocument, more: (count: number) => string): DiagramInput {
	const sep = stackSeparator(doc.stackAlphabet);

	const groups = new Map<string, { from: number; to: number; allLines: string[] }>();
	for (const t of doc.transitions) {
		const key = `${t.from}>${t.to}`;
		const label = formatTransition(t, sep);
		const group = groups.get(key);
		if (group) group.allLines.push(label);
		else groups.set(key, { from: t.from, to: t.to, allLines: [label] });
	}

	const sortedGroups = [...groups.values()].sort((a, b) => a.from - b.from || a.to - b.to);
	const edges: DiagramEdgeInput[] = sortedGroups.map(({ from, to, allLines }) => {
		const overflow = allLines.length > MAX_EDGE_LINES;
		const lines = !overflow ? allLines : [allLines[0]!, allLines[1]!, more(allLines.length - 2)];
		return {
			from,
			to,
			lines,
			text: pdaEdgeText(doc, from, to),
			...(overflow ? { overflow: true } : {})
		};
	});

	return {
		states: doc.states,
		start: doc.start,
		accepting: doc.accepting,
		edges
	};
}

/**
 * Maps used transition indices (in `doc.transitions`) to the display line indices of each
 * `from>to` edge label. In a group with at most `MAX_EDGE_LINES` transitions, position `p`
 * (in `doc.transitions` order) is line `p`. In a group with more than `MAX_EDGE_LINES`,
 * positions 0 and 1 are lines 0 and 1, and any position >= 2 maps to line 2 ("+ n lagi").
 * Out-of-range indices are ignored; keys are exactly the groups with a used transition.
 */
export function pdaTakenLines(doc: PdaDocument, used: readonly number[]): Map<string, Set<number>> {
	const result = new Map<string, Set<number>>();
	if (used.length === 0) return result;

	const wanted = new Set<number>();
	for (const idx of used) {
		if (Number.isInteger(idx) && idx >= 0 && idx < doc.transitions.length) {
			wanted.add(idx);
		}
	}
	if (wanted.size === 0) return result;

	const groupPos = new Map<string, number>();
	for (let i = 0; i < doc.transitions.length; i++) {
		const t = doc.transitions[i]!;
		const key = `${t.from}>${t.to}`;
		const pos = groupPos.get(key) ?? 0;
		groupPos.set(key, pos + 1);
		if (!wanted.has(i)) continue;
		const line = Math.min(pos, MAX_EDGE_LINES - 1);
		let lines = result.get(key);
		if (!lines) {
			lines = new Set<number>();
			result.set(key, lines);
		}
		lines.add(line);
	}
	return result;
}
