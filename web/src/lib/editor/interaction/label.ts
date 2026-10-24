// The text of an edge: "a, b, ε". What the user types is turned into symbols, and the difference
// from the symbols the edge has is turned into commands (docs/ux/editor-interactions.md, "Edit the
// symbols of an edge"). No DOM, so that every rule can be tested.
import type { Command } from '../commands.ts';
import type { MachineDocument } from '../document.ts';

/** A symbol, or null for ε. */
export type Part = string | null;

const EPSILON_WORDS = new Set(['eps', 'ε']);

/** The characters of a text. An emoji or a combined character counts as one. */
const characters = (text: string) => [...text];

/** Symbols are separated by commas or spaces. Empty parts go, a repeated symbol counts once. */
export function parseLabel(text: string): Part[] {
	const parts: Part[] = [];
	for (const word of text.split(/[\s,]+/)) {
		if (word === '') continue;
		const part = EPSILON_WORDS.has(word) ? null : word;
		if (!parts.includes(part)) parts.push(part);
	}
	return parts;
}

/** The symbols of the edge from → to as text: in the order of the alphabet, ε last (as drawn). */
export function labelOf(doc: MachineDocument, from: number, to: number): string {
	const rank = (on: string | null) => (on === null ? Infinity : doc.alphabet.indexOf(on));
	return doc.transitions
		.filter((t) => t.from === from && t.to === to)
		.map((t) => t.on)
		.sort((a, b) => rank(a) - rank(b))
		.map((on) => on ?? 'ε')
		.join(', ');
}

/**
 * The first part that may have been meant as several symbols: it has more than one character, it
 * is not in the alphabet, and every symbol of the alphabet has one character. Null if none.
 */
export function splitNeeded(doc: MachineDocument, parts: readonly Part[]): string | null {
	if (!doc.alphabet.every((s) => characters(s).length === 1)) return null;
	for (const part of parts) {
		if (part !== null && characters(part).length > 1 && !doc.alphabet.includes(part)) return part;
	}
	return null;
}

/** Every part with several characters becomes one symbol for each character. */
export function splitParts(parts: readonly Part[]): Part[] {
	const out: Part[] = [];
	for (const part of parts) {
		for (const symbol of part === null ? [null] : characters(part)) {
			if (!out.includes(symbol)) out.push(symbol);
		}
	}
	return out;
}

/**
 * The commands that make the edge from → to have exactly `parts` as its symbols: a symbol that is
 * new goes into the alphabet first, then the transitions that are new, then the ones that are gone.
 * They are meant for one `batch`, so the change is one step.
 */
export function labelCommands(
	doc: MachineDocument,
	from: number,
	to: number,
	parts: readonly Part[]
): Command[] {
	const have = doc.transitions.filter((t) => t.from === from && t.to === to).map((t) => t.on);
	const commands: Command[] = [];
	for (const part of parts) {
		if (part !== null && !doc.alphabet.includes(part)) {
			commands.push({ type: 'addSymbol', symbol: part });
		}
	}
	for (const part of parts) {
		if (!have.includes(part)) commands.push({ type: 'addTransition', from, on: part, to });
	}
	for (const on of have) {
		if (!parts.includes(on)) commands.push({ type: 'removeTransition', from, on, to });
	}
	return commands;
}
