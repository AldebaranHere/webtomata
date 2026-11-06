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

import { LIMITS, checkName, checkSymbol, checkTitle, isCoordinate, message } from './document.ts';
import type { Message } from '../engine/types.ts';
import { comparePdaTransitions } from './pda-document.ts';
import type { PdaDocument, PdaTransitionEntry } from './pda-document.ts';
import { applyPdaCommand } from './pda-commands.ts';
import type { PdaCommand } from './pda-commands.ts';

const STACK_SYMBOLS = ['A', 'B', 'X', 'Z', '0', '1', 'α', '😀'];
const MAX_PDA_STRING = 64;

/** The rules that every PDA document must follow. Returns what is broken; an empty list means all is well. */
export function checkPdaDocument(doc: PdaDocument): Message[] {
	const broken: Message[] = [];
	const rule = (name: string, ok: boolean, params: Message['params'] = {}) => {
		if (!ok) broken.push(message('document.broken_rule', { rule: name, ...params }));
	};
	rule('frozen_doc', Object.isFrozen(doc));
	rule('frozen_input_alphabet', Object.isFrozen(doc.inputAlphabet));
	rule('frozen_stack_alphabet', Object.isFrozen(doc.stackAlphabet));
	rule('frozen_states', Object.isFrozen(doc.states));
	rule('frozen_accepting', Object.isFrozen(doc.accepting));
	rule('frozen_transitions', Object.isFrozen(doc.transitions));

	rule('version', doc.schemaVersion === 1);
	rule('kind', doc.kind === 'dpda' || doc.kind === 'ndpda');
	rule('title', checkTitle(doc.title).ok);

	rule('input_alphabet_limit', doc.inputAlphabet.length <= LIMITS.symbols);
	doc.inputAlphabet.forEach((symbol, i) => {
		rule('input_symbol', checkSymbol(symbol).ok, { symbol });
		rule('input_symbol_unique', doc.inputAlphabet.indexOf(symbol) === i, { symbol });
	});

	rule('stack_alphabet_limit', doc.stackAlphabet.length <= LIMITS.symbols);
	doc.stackAlphabet.forEach((symbol, i) => {
		rule('stack_symbol', checkSymbol(symbol).ok, { symbol });
		rule('stack_symbol_unique', doc.stackAlphabet.indexOf(symbol) === i, { symbol });
	});

	rule('states_limit', doc.states.length <= LIMITS.states);
	const names = new Set<string>();
	const ids = new Set<number>();
	let previous = -1;
	for (const s of doc.states) {
		rule('frozen_state', Object.isFrozen(s), { id: s.id });
		rule('state_id', Number.isSafeInteger(s.id) && s.id >= 0 && s.id <= LIMITS.stateId, {
			id: s.id
		});
		rule('states_sorted', s.id > previous, { id: s.id });
		previous = s.id;
		rule('state_name', checkName(s.name).ok, { id: s.id });
		rule('state_name_unique', !names.has(s.name), { id: s.id });
		rule('state_place', isCoordinate(s.x) && isCoordinate(s.y), { id: s.id });
		names.add(s.name);
		ids.add(s.id);
	}
	rule('start', doc.start === null || ids.has(doc.start));
	let last = -1;
	for (const id of doc.accepting) {
		rule('accepting', ids.has(id), { id });
		rule('accepting_sorted', id > last, { id });
		last = id;
	}

	rule('transitions_limit', doc.transitions.length <= LIMITS.transitions);
	const inputSet = new Set(doc.inputAlphabet);
	const stackSet = new Set(doc.stackAlphabet);
	let before: PdaTransitionEntry | undefined;
	for (const t of doc.transitions) {
		rule(
			'frozen_transition',
			Object.isFrozen(t) && Object.isFrozen(t.pop) && Object.isFrozen(t.push),
			{ from: t.from, to: t.to }
		);
		rule('transition_ends', ids.has(t.from) && ids.has(t.to), { from: t.from, to: t.to });
		rule('transition_read', t.read === null || inputSet.has(t.read), { from: t.from, to: t.to });
		rule('transition_pop_len', t.pop.length <= MAX_PDA_STRING, { from: t.from, to: t.to });
		rule('transition_push_len', t.push.length <= MAX_PDA_STRING, { from: t.from, to: t.to });
		for (const sym of t.pop) {
			rule('transition_pop_sym', stackSet.has(sym), { symbol: sym });
		}
		for (const sym of t.push) {
			rule('transition_push_sym', stackSet.has(sym), { symbol: sym });
		}
		if (before !== undefined) {
			rule(
				'transitions_sorted',
				comparePdaTransitions(doc.inputAlphabet, doc.stackAlphabet, before, t) < 0,
				{ from: t.from, to: t.to }
			);
		}
		before = t;
	}
	rule(
		'next_state_id',
		Number.isSafeInteger(doc.nextStateId) &&
			doc.nextStateId > previous &&
			doc.nextStateId <= LIMITS.stateId
	);
	return broken;
}

/**
 * A random PDA command for `doc`. Covers all 15 PdaCommand types, favoring state removal,
 * input/stack symbol removal, ε and multi-symbol pop/push transitions, and batches.
 * About one command in twelve is refused on purpose.
 */
export function randomPdaCommand(rng: Random, doc: PdaDocument, depth = 0): PdaCommand {
	const ids = doc.states.map((s) => s.id);
	const state = () => (ids.length > 0 ? rng.pick(ids) : 0);
	const readOrEpsilon = () =>
		doc.inputAlphabet.length > 0 && !rng.chance(0.25) ? rng.pick(doc.inputAlphabet) : null;
	const stackSeq = () => {
		if (doc.stackAlphabet.length === 0 || rng.chance(0.35)) return [];
		const len = 1 + rng.int(3);
		return Array.from({ length: len }, () => rng.pick(doc.stackAlphabet));
	};
	const place = () => ({ x: rng.int(1000) - 100, y: rng.int(800) });

	if (rng.chance(0.08)) {
		return rng.pick<PdaCommand>([
			{ type: 'removeState', id: 1_000_000 },
			{ type: 'addTransition', from: 1_000_000, read: null, pop: [], push: [], to: 0 },
			{
				type: 'addTransition',
				from: state(),
				read: 'not-in-input',
				pop: [],
				push: [],
				to: state()
			},
			{
				type: 'addTransition',
				from: state(),
				read: null,
				pop: ['not-in-stack'],
				push: [],
				to: state()
			},
			{ type: 'removeInputSymbol', symbol: 'not-in-input' },
			{ type: 'removeStackSymbol', symbol: 'not-in-stack' },
			{ type: 'renameState', id: state(), name: '' },
			{ type: 'moveState', id: state(), x: Number.NaN, y: 0 }
		]);
	}

	const roll = rng.next();
	if (roll < 0.16) return { type: 'addState', ...place() };
	if (roll < 0.24) return { type: 'removeState', id: state() };
	if (roll < 0.34) {
		const spare = SYMBOLS.filter((s) => !doc.inputAlphabet.includes(s));
		return { type: 'addInputSymbol', symbol: spare.length > 0 ? rng.pick(spare) : 'a' };
	}
	if (roll < 0.38 && doc.inputAlphabet.length > 0) {
		return { type: 'removeInputSymbol', symbol: rng.pick(doc.inputAlphabet) };
	}
	if (roll < 0.48) {
		const spare = STACK_SYMBOLS.filter((s) => !doc.stackAlphabet.includes(s));
		return { type: 'addStackSymbol', symbol: spare.length > 0 ? rng.pick(spare) : 'A' };
	}
	if (roll < 0.52 && doc.stackAlphabet.length > 0) {
		return { type: 'removeStackSymbol', symbol: rng.pick(doc.stackAlphabet) };
	}
	if (roll < 0.72) {
		const from = state();
		const to = rng.chance(0.25) ? from : state();
		return {
			type: 'addTransition',
			from,
			read: readOrEpsilon(),
			pop: stackSeq(),
			push: stackSeq(),
			to
		};
	}
	if (roll < 0.78 && doc.transitions.length > 0) {
		const t = rng.pick(doc.transitions);
		return {
			type: 'removeTransition',
			from: t.from,
			read: t.read,
			pop: [...t.pop],
			push: [...t.push],
			to: t.to
		};
	}
	if (roll < 0.83) return { type: 'moveState', id: state(), ...place() };
	if (roll < 0.87) return { type: 'renameState', id: state(), name: `n${rng.int(50)}` };
	if (roll < 0.91) return { type: 'setStart', id: rng.chance(0.15) ? null : state() };
	if (roll < 0.94) return { type: 'setAccepting', id: state(), accepting: rng.chance(0.6) };
	if (roll < 0.96) return { type: 'setKind', kind: rng.chance(0.5) ? 'dpda' : 'ndpda' };
	if (roll < 0.98) {
		return { type: 'setTitle', title: rng.chance(0.3) ? '' : `PDA ${rng.int(10)}` };
	}
	if (depth < 2) {
		const commands: PdaCommand[] = [];
		let working = doc;
		for (let i = 0, n = 1 + rng.int(3); i < n; i++) {
			const inner = randomPdaCommand(rng, working, depth + 1);
			commands.push(inner);
			const result = applyPdaCommand(working, inner);
			if (result.ok) working = result.doc;
		}
		return { type: 'batch', commands };
	}
	return { type: 'addState', ...place() };
}
