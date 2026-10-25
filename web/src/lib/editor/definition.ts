// The formal definition of a machine, in the notation of the course textbook (Rich, see
// docs/notation.md): M = (K, Σ, δ, s, A) for a DFSM and M = (K, Σ, Δ, s, A) for an NDFSM. No DOM:
// the view shows these strings as text (never as markup), and the button "Salin" copies
// `definitionText`. The names of the states are the names that the user sees.
import type { MachineDocument } from './document.ts';

export interface Definition {
	kind: 'dfsm' | 'ndfsm';
	/** M = (K, Σ, δ, s, A) */
	heading: string;
	/** {q0, q1} */
	states: string;
	alphabet: string;
	/** The name of the start state, or null when there is none yet. */
	start: string | null;
	accepting: string;
	/** One line for each transition, in the order of the engine (by state, then by symbol). */
	transitions: string[];
}

const set = (items: readonly string[]) => `{${items.join(', ')}}`;

export function definitionOf(doc: MachineDocument): Definition {
	const name = (id: number) => doc.states.find((s) => s.id === id)?.name ?? `q${id}`;
	const symbol = (on: string | null) => on ?? 'ε';
	const ndfsm = doc.kind === 'ndfsm';
	return {
		kind: doc.kind,
		heading: ndfsm ? 'M = (K, Σ, Δ, s, A)' : 'M = (K, Σ, δ, s, A)',
		states: set(doc.states.map((s) => s.name)),
		alphabet: set(doc.alphabet),
		start: doc.start === null ? null : name(doc.start),
		accepting: set(doc.accepting.map(name)),
		transitions: doc.transitions.map((t) =>
			ndfsm
				? `(${name(t.from)}, ${symbol(t.on)}, ${name(t.to)}) ∈ Δ`
				: `δ(${name(t.from)}, ${symbol(t.on)}) = ${name(t.to)}`
		)
	};
}

/** The definition as plain text, for the button that copies it. */
export function definitionText(doc: MachineDocument): string {
	const def = definitionOf(doc);
	return [
		def.heading,
		`K = ${def.states}`,
		`Σ = ${def.alphabet}`,
		`s = ${def.start ?? '—'}`,
		`A = ${def.accepting}`,
		...def.transitions
	].join('\n');
}
