// The formal definition of a pushdown automaton, in the notation of the course textbook (Rich,
// Slide12): M = (K, Σ, Γ, Δ, s, A). No DOM: pure functions for the view and text representation.
import { formatStackSeq, stackSeparator } from './diagram/pda-diagram.ts';
import type { PdaDocument } from './pda-document.ts';

export interface PdaDefinition {
	readonly heading: string;
	readonly states: string;
	readonly inputAlphabet: string;
	readonly stackAlphabet: string;
	readonly start: string | null;
	readonly accepting: string;
	readonly transitions: readonly string[];
}

const setOf = (items: readonly string[]) => `{${items.join(', ')}}`;

export function pdaDefinitionOf(doc: PdaDocument): PdaDefinition {
	const sep = stackSeparator(doc.stackAlphabet);
	const nameOf = (id: number) => doc.states.find((s) => s.id === id)?.name ?? `q${id}`;

	const transitions = doc.transitions.map((t) => {
		const read = t.read ?? 'ε';
		const pop = formatStackSeq(t.pop, sep);
		const push = formatStackSeq(t.push, sep);
		return `((${nameOf(t.from)}, ${read}, ${pop}), (${nameOf(t.to)}, ${push}))`;
	});

	return {
		heading: 'M = (K, Σ, Γ, Δ, s, A)',
		states: setOf(doc.states.map((s) => s.name)),
		inputAlphabet: setOf(doc.inputAlphabet),
		stackAlphabet: setOf(doc.stackAlphabet),
		start: doc.start === null ? null : nameOf(doc.start),
		accepting: setOf(doc.accepting.map(nameOf)),
		transitions
	};
}

export function pdaDefinitionText(doc: PdaDocument): string {
	const def = pdaDefinitionOf(doc);
	return [
		def.heading,
		`K = ${def.states}`,
		`Σ = ${def.inputAlphabet}`,
		`Γ = ${def.stackAlphabet}`,
		`s = ${def.start ?? '–'}`,
		`A = ${def.accepting}`,
		...def.transitions
	].join('\n');
}
