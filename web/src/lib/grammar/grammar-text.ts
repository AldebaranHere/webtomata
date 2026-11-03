import type { Grammar } from '#lib/engine/types.ts';

/**
 * Turns a Grammar model into canonical text format:
 * - One line per head, start symbol first, then in order of first appearance: A -> X Y | a
 * - One space between every two symbols
 * - Preserves variable names as they are (e.g. S_0, T_a, X1)
 * - Empty body defaults to λ (the symbol used by the Editor legend and matrixRowsToGrammarText)
 */
export function grammarToText(grammar: Grammar, emptySymbol = 'λ'): string {
	const headMap = new Map<string, string[]>();
	const orderedHeads: string[] = [];

	if (grammar.start) {
		orderedHeads.push(grammar.start);
		headMap.set(grammar.start, []);
	}

	for (const rule of grammar.rules) {
		if (!headMap.has(rule.head)) {
			orderedHeads.push(rule.head);
			headMap.set(rule.head, []);
		}
		const alts = headMap.get(rule.head)!;
		if (rule.body.length === 0) {
			alts.push(emptySymbol);
		} else {
			alts.push(rule.body.map((s) => s.value).join(' '));
		}
	}

	return orderedHeads
		.filter((head) => (headMap.get(head) ?? []).length > 0 || head === grammar.start)
		.map((head) => {
			const alts = headMap.get(head) ?? [];
			const rhs = alts.length > 0 ? alts.join(' | ') : emptySymbol;
			return `${head} -> ${rhs}`;
		})
		.join('\n');
}

/**
 * Returns the lowest unused ID of form G<n> (n >= 1), preventing collisions
 * after an item is deleted (e.g. deleting G1 while G2 remains).
 */
export function nextCustomId(existing: Array<{ id: string }>): string {
	const used = new Set(existing.map((item) => item.id));
	let n = 1;
	while (used.has(`G${n}`)) {
		n++;
	}
	return `G${n}`;
}
