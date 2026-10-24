// Helpers for the tests of the editor: a seeded random generator, and a generator of random
// commands that are valid for a given document most of the time (and refused sometimes, on
// purpose, to test that a refused command changes nothing).
import type { MachineDocument } from './document.ts';
import { applyCommand } from './commands.ts';
import type { Command } from './commands.ts';

/** A small seeded generator (mulberry32). The same seed gives the same numbers. */
export function random(seed: number) {
	let a = seed >>> 0;
	const next = () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	return {
		next,
		int: (below: number) => Math.floor(next() * below),
		pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T,
		chance: (p: number) => next() < p
	};
}

export type Random = ReturnType<typeof random>;

const SYMBOLS = ['a', 'b', 'c', '0', '1', 'num', 'α', '😀'];

/**
 * A random command for `doc`. The weights favor the commands that are hardest to undo: removing
 * the start state, a state with transitions, a symbol that transitions use, self loops, ε-loops
 * and batches. About one command in ten is refused on purpose.
 */
export function randomCommand(rng: Random, doc: MachineDocument, depth = 0): Command {
	const ids = doc.states.map((s) => s.id);
	const state = () => (ids.length > 0 ? rng.pick(ids) : 0);
	const symbolOrEpsilon = () =>
		doc.alphabet.length > 0 && !rng.chance(0.2) ? rng.pick(doc.alphabet) : null;
	const place = () => ({ x: rng.int(1000) - 100, y: rng.int(800) });

	if (rng.chance(0.08)) {
		// A command that is refused (unknown state, unknown symbol, a bad name).
		return rng.pick<Command>([
			{ type: 'removeState', id: 1_000_000 },
			{ type: 'addTransition', from: 1_000_000, on: null, to: 0 },
			{ type: 'removeSymbol', symbol: 'not-in-the-alphabet' },
			{ type: 'renameState', id: state(), name: '' },
			{ type: 'moveState', id: state(), x: Number.NaN, y: 0 }
		]);
	}

	const roll = rng.next();
	if (roll < 0.2) return { type: 'addState', ...place() };
	if (roll < 0.3) return { type: 'removeState', id: state() };
	if (roll < 0.4) {
		const spare = SYMBOLS.filter((s) => !doc.alphabet.includes(s));
		return { type: 'addSymbol', symbol: spare.length > 0 ? rng.pick(spare) : 'a' };
	}
	if (roll < 0.45 && doc.alphabet.length > 0)
		return { type: 'removeSymbol', symbol: rng.pick(doc.alphabet) };
	if (roll < 0.65) {
		const from = state();
		// Self loops are common on purpose.
		const to = rng.chance(0.25) ? from : state();
		return { type: 'addTransition', from, on: symbolOrEpsilon(), to };
	}
	if (roll < 0.72 && doc.transitions.length > 0) {
		const t = rng.pick(doc.transitions);
		return { type: 'removeTransition', from: t.from, on: t.on, to: t.to };
	}
	if (roll < 0.78) return { type: 'moveState', id: state(), ...place() };
	if (roll < 0.82) return { type: 'renameState', id: state(), name: `n${rng.int(50)}` };
	if (roll < 0.87) return { type: 'setStart', id: rng.chance(0.15) ? null : state() };
	if (roll < 0.92) return { type: 'setAccepting', id: state(), accepting: rng.chance(0.6) };
	if (roll < 0.94) return { type: 'setKind', kind: rng.chance(0.5) ? 'dfsm' : 'ndfsm' };
	if (roll < 0.96)
		return { type: 'setTitle', title: rng.chance(0.3) ? '' : `Judul ${rng.int(10)}` };
	if (depth < 2) {
		// Each command is made for the document that the earlier ones leave, so most batches are valid.
		const commands: Command[] = [];
		let working = doc;
		for (let i = 0, n = 1 + rng.int(3); i < n; i++) {
			const inner = randomCommand(rng, working, depth + 1);
			commands.push(inner);
			const result = applyCommand(working, inner);
			if (result.ok) working = result.doc;
		}
		return { type: 'batch', commands };
	}
	return { type: 'addState', ...place() };
}
