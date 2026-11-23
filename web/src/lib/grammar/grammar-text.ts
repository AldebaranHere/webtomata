import type { Grammar, Production } from '#lib/engine/types.ts';

/**
 * Turns a Grammar model into canonical text format:
 * - One line per head, start symbol first, then in order of first appearance: A -> X Y | a
 * - One space between every two symbols
 * - Preserves variable names as they are (e.g. S_0, T_a, X1)
 * - Empty body defaults to ε (the empty word symbol parsed by the engine)
 */
export function grammarToText(grammar: Grammar, emptySymbol = 'ε'): string {
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
		.filter((head) => (headMap.get(head) ?? []).length > 0)
		.map((head) => {
			const alts = headMap.get(head)!;
			return `${head} -> ${alts.join(' | ')}`;
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

/**
 * Formats a production rule for display on chips/steppers:
 * - head → body with one space between each body symbol
 * - Empty body is displayed as λ
 */
export function formatRuleDisplay(rule: Production): string {
	const bodyStr = rule.body.length === 0 ? 'λ' : rule.body.map((s) => s.value).join(' ');
	return `${rule.head} → ${bodyStr}`;
}

/**
 * Computes the title for opening a grammar result as a new custom grammar:
 * "<baseTitle> (CNF)", or "<baseTitle> (CNF <n>)" if that title already exists.
 */
export function computeCnfTitle(
	baseTitle: string,
	existingGrammars: Array<{ title: string }>
): string {
	const firstCandidate = `${baseTitle} (CNF)`;
	const existingTitles = new Set(existingGrammars.map((c) => c.title));
	if (!existingTitles.has(firstCandidate)) {
		return firstCandidate;
	}
	let counter = 2;
	while (existingTitles.has(`${baseTitle} (CNF ${counter})`)) {
		counter++;
	}
	return `${baseTitle} (CNF ${counter})`;
}

export interface CustomGrammarItem {
	id: string;
	title: string;
	grammar: string;
}

export interface GrammarOpenRequest {
	title: string;
	text: string;
	seq: number;
}

function uniqueTitle(baseTitle: string, existingTitles: ReadonlySet<string>): string {
	if (!existingTitles.has(baseTitle)) return baseTitle;
	const parens = /^(.*) \(([^()]+)\)$/.exec(baseTitle);
	let counter = 2;
	while (true) {
		const candidate = parens
			? `${parens[1]} (${parens[2]} ${counter})`
			: `${baseTitle} (${counter})`;
		if (!existingTitles.has(candidate)) return candidate;
		counter++;
	}
}

/**
 * Turns a cross-mode grammar open request into a new custom grammar entry (the T-023 way):
 * picks the next unused custom id, makes the title unique among existing custom grammars,
 * and returns the created item along with the new list without mutating `existing`.
 */
export function receiveGrammarRequest(
	existing: readonly CustomGrammarItem[],
	request: Pick<GrammarOpenRequest, 'title' | 'text'>,
	fallbackTitle: (id: string) => string = (id) => id
): { updated: CustomGrammarItem[]; created: CustomGrammarItem } {
	const id = nextCustomId([...existing]);
	const rawTitle = request.title.trim() || fallbackTitle(id);
	const existingTitles = new Set(existing.map((c) => c.title));
	const title = uniqueTitle(rawTitle, existingTitles);
	const created: CustomGrammarItem = {
		id,
		title,
		grammar: request.text
	};
	return {
		updated: [...existing, created],
		created
	};
}
