import type { Grammar, Production } from '#lib/engine/types.ts';

export interface MathSymbolItem {
	kind: 'terminal' | 'nonTerminal' | 'epsilon';
	text: string;
}

export interface MathRuleRow {
	head: string;
	alternatives: MathSymbolItem[][];
}

export function grammarToMathRows(grammar: Grammar): MathRuleRow[] {
	const headMap = new Map<string, MathSymbolItem[][]>();
	const orderedHeads: string[] = [];

	// Keep start symbol first
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
		const rowSymbols: MathSymbolItem[] = [];

		if (rule.body.length === 0) {
			rowSymbols.push({ kind: 'epsilon', text: 'λ' });
		} else {
			for (const sym of rule.body) {
				if (sym.type === 'terminal') {
					rowSymbols.push({ kind: 'terminal', text: sym.value });
				} else {
					rowSymbols.push({ kind: 'nonTerminal', text: sym.value });
				}
			}
		}
		alts.push(rowSymbols);
	}

	return orderedHeads.map((head) => ({
		head,
		alternatives: headMap.get(head) ?? []
	}));
}

export function productionToMathSymbols(rule: Production): {
	head: string;
	symbols: MathSymbolItem[];
} {
	const symbols: MathSymbolItem[] = [];
	if (rule.body.length === 0) {
		symbols.push({ kind: 'epsilon', text: 'λ' });
	} else {
		for (const sym of rule.body) {
			if (sym.type === 'terminal') {
				symbols.push({ kind: 'terminal', text: sym.value });
			} else {
				symbols.push({ kind: 'nonTerminal', text: sym.value });
			}
		}
	}
	return { head: rule.head, symbols };
}
