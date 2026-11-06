// Adapter that turns a `PdaDocument` (T-033) into a neutral `DiagramInput` (T-039) for
// `diagramGeometry`. See `design/screens/pda-editor.md`, section 2.
import type { PdaDocument, PdaTransitionEntry } from '../pda-document.ts';
import type { DiagramEdgeInput, DiagramInput } from './geometry.ts';

const MAX_EDGE_LINES = 3;

function stackSeparator(stackAlphabet: readonly string[]): string {
	return stackAlphabet.every((s) => [...s].length === 1) ? '' : ' ';
}

function formatStackSeq(seq: readonly string[], sep: string): string {
	return seq.length === 0 ? 'ε' : seq.join(sep);
}

/**
 * Formats one PDA transition as `read / pop / push` (`ε` for empty read, pop or push; leftmost
 * symbol is the top of the stack). The stack alphabet of the whole document decides whether stack
 * symbols are joined without spaces (`AB`) or with a single space (`Z0 A`).
 */
export function transitionLabel(doc: PdaDocument, transition: PdaTransitionEntry): string {
	const sep = stackSeparator(doc.stackAlphabet);
	const read = transition.read ?? 'ε';
	const pop = formatStackSeq(transition.pop, sep);
	const push = formatStackSeq(transition.push, sep);
	return `${read} / ${pop} / ${push}`;
}

/**
 * Turns a `PdaDocument` into a `DiagramInput`. Transitions are grouped by `(from, to)` sorted by
 * `from` then `to`, with lines in `doc.transitions` order (the engine's order). An edge with more
 * than three transitions shows the first two and `more(count - 2)` on the third line, while `text`
 * lists all transitions joined by `; ` for screen readers.
 */
export function pdaDiagram(doc: PdaDocument, more: (count: number) => string): DiagramInput {
	const sep = stackSeparator(doc.stackAlphabet);
	const formatOne = (t: PdaTransitionEntry) =>
		`${t.read ?? 'ε'} / ${formatStackSeq(t.pop, sep)} / ${formatStackSeq(t.push, sep)}`;

	const groups = new Map<string, { from: number; to: number; allLines: string[] }>();
	for (const t of doc.transitions) {
		const key = `${t.from}>${t.to}`;
		const label = formatOne(t);
		const group = groups.get(key);
		if (group) group.allLines.push(label);
		else groups.set(key, { from: t.from, to: t.to, allLines: [label] });
	}

	const sortedGroups = [...groups.values()].sort((a, b) => a.from - b.from || a.to - b.to);
	const edges: DiagramEdgeInput[] = sortedGroups.map(({ from, to, allLines }) => {
		const lines =
			allLines.length <= MAX_EDGE_LINES
				? allLines
				: [allLines[0]!, allLines[1]!, more(allLines.length - 2)];
		return {
			from,
			to,
			lines,
			text: allLines.join('; ')
		};
	});

	return {
		states: doc.states,
		start: doc.start,
		accepting: doc.accepting,
		edges
	};
}
