import { describe, expect, it } from 'vitest';
import { LIMITS, checkDocument, createDocument } from './document.ts';
import type { MachineDocument } from './document.ts';
import { applyCommand } from './commands.ts';
import type { Command } from './commands.ts';

/** Applies commands one after the other. Fails the test if one of them is refused. */
function build(...commands: Command[]): MachineDocument {
	let doc = createDocument();
	for (const command of commands) {
		const result = applyCommand(doc, command);
		if (!result.ok) throw new Error(`${JSON.stringify(command)}: ${result.error.key}`);
		doc = result.doc;
	}
	return doc;
}

const add = (x: number, y: number, name?: string): Command => ({ type: 'addState', x, y, name });

/** A document with q0, q1, q2, the alphabet a, b, and some transitions. */
function sample(): MachineDocument {
	return build(
		{ type: 'addSymbol', symbol: 'a' },
		{ type: 'addSymbol', symbol: 'b' },
		add(100, 100),
		add(200, 100),
		add(300, 100),
		{ type: 'setStart', id: 0 },
		{ type: 'setAccepting', id: 2, accepting: true },
		{ type: 'addTransition', from: 0, on: 'a', to: 1 },
		{ type: 'addTransition', from: 1, on: 'b', to: 2 },
		{ type: 'addTransition', from: 2, on: 'a', to: 2 },
		{ type: 'addTransition', from: 2, on: null, to: 0 }
	);
}

const refused = (doc: MachineDocument, command: Command) => {
	const result = applyCommand(doc, command);
	expect(result.ok, JSON.stringify(command)).toBe(false);
	return result.ok ? '' : result.error.key;
};

describe('states', () => {
	it('addState gives the next id and the name q<k> with the smallest k that is free', () => {
		const doc = build(add(10, 20), add(30, 40));
		expect(doc.states).toEqual([
			{ id: 0, name: 'q0', x: 10, y: 20 },
			{ id: 1, name: 'q1', x: 30, y: 40 }
		]);
		expect(doc.nextStateId).toBe(2);
		expect(checkDocument(doc)).toEqual([]);
	});

	it('never reuses an id, but does reuse a free name', () => {
		const doc = build(add(0, 0), add(0, 0), add(0, 0), { type: 'removeState', id: 1 }, add(5, 5));
		expect(doc.states.map((s) => [s.id, s.name])).toEqual([
			[0, 'q0'],
			[2, 'q2'],
			[3, 'q1']
		]);
		expect(doc.nextStateId).toBe(4);
	});

	it('does not reuse the id of the state that was removed last, the one with the biggest id', () => {
		const doc = build(add(0, 0), add(0, 0), add(0, 0), { type: 'removeState', id: 2 }, add(5, 5));
		expect(doc.states.map((s) => s.id)).toEqual([0, 1, 3]);
		// Even when every state is removed.
		const empty = build(add(0, 0), { type: 'removeState', id: 0 }, add(0, 0));
		expect(empty.states.map((s) => s.id)).toEqual([1]);
		expect(empty.nextStateId).toBe(2);
	});

	it('addState can name the state', () => {
		const doc = build(add(0, 0, 'mulai'));
		expect(doc.states[0]?.name).toBe('mulai');
	});

	it('refuses a bad or repeated name, a bad place and too many states', () => {
		const doc = build(add(0, 0, 'a'));
		expect(refused(doc, add(0, 0, 'a'))).toBe('document.duplicate_name');
		expect(refused(doc, add(0, 0, ''))).toBe('document.invalid_name');
		expect(refused(doc, add(0, 0, 'x'.repeat(33)))).toBe('document.invalid_name');
		expect(refused(doc, add(Number.NaN, 0))).toBe('document.invalid_position');
		expect(refused(doc, add(0, LIMITS.coordinate + 1))).toBe('document.invalid_position');
		expect(refused(doc, add(Infinity, 0))).toBe('document.invalid_position');
	});

	it('refuses the 2001st state', () => {
		let doc = createDocument();
		for (let i = 0; i < LIMITS.states; i++) {
			const result = applyCommand(doc, add(0, 0, `s${i}`));
			if (!result.ok) throw new Error(result.error.key);
			doc = result.doc;
		}
		expect(refused(doc, add(0, 0, 'one more'))).toBe('document.limit_exceeded');
	});

	it('removeState removes the transitions of the state, and its start and accepting marks', () => {
		const doc = build(
			{ type: 'addSymbol', symbol: 'a' },
			{ type: 'addSymbol', symbol: 'b' },
			add(100, 100),
			add(200, 100),
			add(300, 100),
			{ type: 'setStart', id: 2 },
			{ type: 'setAccepting', id: 2, accepting: true },
			{ type: 'addTransition', from: 0, on: 'a', to: 2 },
			{ type: 'addTransition', from: 2, on: 'b', to: 1 },
			{ type: 'addTransition', from: 0, on: 'b', to: 1 }
		);
		const result = applyCommand(doc, { type: 'removeState', id: 2 });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.doc.start).toBeNull();
		expect(result.doc.accepting).toEqual([]);
		expect(result.doc.transitions).toEqual([{ from: 0, on: 'b', to: 1 }]);
		expect(result.doc.states.map((s) => s.id)).toEqual([0, 1]);
		expect(checkDocument(result.doc)).toEqual([]);
		// The old document is whole.
		expect(doc.transitions.length).toBe(3);
	});

	it('moveState and renameState', () => {
		const doc = build(add(0, 0), add(0, 0));
		const moved = build(add(0, 0), add(0, 0), { type: 'moveState', id: 1, x: 5.5, y: -3 });
		expect(moved.states[1]).toMatchObject({ x: 5.5, y: -3 });
		expect(doc.states[1]).toMatchObject({ x: 0, y: 0 });
		const renamed = build(add(0, 0), add(0, 0), { type: 'renameState', id: 0, name: 'awal' });
		expect(renamed.states[0]?.name).toBe('awal');
		expect(refused(renamed, { type: 'renameState', id: 1, name: 'awal' })).toBe(
			'document.duplicate_name'
		);
		expect(refused(renamed, { type: 'renameState', id: 9, name: 'z' })).toBe(
			'document.unknown_state'
		);
		expect(refused(renamed, { type: 'moveState', id: 9, x: 1, y: 1 })).toBe(
			'document.unknown_state'
		);
		expect(refused(renamed, { type: 'moveState', id: 0, x: Number.NaN, y: 1 })).toBe(
			'document.invalid_position'
		);
	});

	it('a state can be renamed to the name that it has', () => {
		const doc = build(add(0, 0));
		const result = applyCommand(doc, { type: 'renameState', id: 0, name: 'q0' });
		expect(result).toEqual({ ok: true, doc });
	});

	it('setStart and setAccepting', () => {
		const doc = build(add(0, 0), add(0, 0), { type: 'setStart', id: 1 });
		expect(doc.start).toBe(1);
		expect(
			build(add(0, 0), { type: 'setStart', id: 0 }, { type: 'setStart', id: null }).start
		).toBeNull();
		const accepting = build(
			add(0, 0),
			add(0, 0),
			{ type: 'setAccepting', id: 1, accepting: true },
			{ type: 'setAccepting', id: 0, accepting: true }
		);
		expect(accepting.accepting).toEqual([0, 1]);
		const off = build(
			add(0, 0),
			{ type: 'setAccepting', id: 0, accepting: true },
			{ type: 'setAccepting', id: 0, accepting: false }
		);
		expect(off.accepting).toEqual([]);
		expect(refused(doc, { type: 'setStart', id: 7 })).toBe('document.unknown_state');
		expect(refused(doc, { type: 'setAccepting', id: 7, accepting: true })).toBe(
			'document.unknown_state'
		);
	});
});

describe('transitions', () => {
	it('addTransition keeps the list sorted as the engine sorts it', () => {
		const doc = sample();
		expect(doc.transitions).toEqual([
			{ from: 0, on: 'a', to: 1 },
			{ from: 1, on: 'b', to: 2 },
			{ from: 2, on: null, to: 0 },
			{ from: 2, on: 'a', to: 2 }
		]);
	});

	it('refuses a repeated transition, an unknown state and an unknown symbol', () => {
		const doc = sample();
		expect(refused(doc, { type: 'addTransition', from: 0, on: 'a', to: 1 })).toBe(
			'document.duplicate_transition'
		);
		expect(refused(doc, { type: 'addTransition', from: 9, on: 'a', to: 1 })).toBe(
			'document.unknown_state'
		);
		expect(refused(doc, { type: 'addTransition', from: 0, on: 'a', to: 9 })).toBe(
			'document.unknown_state'
		);
		expect(refused(doc, { type: 'addTransition', from: 0, on: 'z', to: 1 })).toBe(
			'document.unknown_symbol'
		);
	});

	it('two transitions on one symbol from one state are allowed (an NDFSM)', () => {
		const doc = build(
			{ type: 'addSymbol', symbol: 'a' },
			add(0, 0),
			add(0, 0),
			{ type: 'addTransition', from: 0, on: 'a', to: 0 },
			{ type: 'addTransition', from: 0, on: 'a', to: 1 }
		);
		expect(doc.transitions.length).toBe(2);
	});

	it('removeTransition', () => {
		const doc = sample();
		const result = applyCommand(doc, { type: 'removeTransition', from: 2, on: null, to: 0 });
		expect(result.ok && result.doc.transitions.length).toBe(3);
		expect(refused(doc, { type: 'removeTransition', from: 0, on: 'b', to: 0 })).toBe(
			'document.unknown_transition'
		);
	});
});

describe('the alphabet', () => {
	it('addSymbol appends, and refuses a bad or repeated symbol', () => {
		const doc = build({ type: 'addSymbol', symbol: 'a' }, { type: 'addSymbol', symbol: 'num' });
		expect(doc.alphabet).toEqual(['a', 'num']);
		expect(refused(doc, { type: 'addSymbol', symbol: 'a' })).toBe('document.duplicate_symbol');
		expect(refused(doc, { type: 'addSymbol', symbol: 'a b' })).toBe('document.invalid_symbol');
		expect(refused(doc, { type: 'addSymbol', symbol: 'ε' })).toBe('document.invalid_symbol');
		expect(refused(doc, { type: 'addSymbol', symbol: '' })).toBe('document.invalid_symbol');
	});

	it('refuses the 257th symbol', () => {
		let doc = createDocument();
		for (let i = 0; i < LIMITS.symbols; i++) {
			const result = applyCommand(doc, { type: 'addSymbol', symbol: `s${i}` });
			if (!result.ok) throw new Error(result.error.key);
			doc = result.doc;
		}
		expect(refused(doc, { type: 'addSymbol', symbol: 'extra' })).toBe('document.limit_exceeded');
	});

	it('removeSymbol removes the transitions on that symbol and keeps the order of the others', () => {
		const doc = sample();
		const result = applyCommand(doc, { type: 'removeSymbol', symbol: 'a' });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.doc.alphabet).toEqual(['b']);
		expect(result.doc.transitions).toEqual([
			{ from: 1, on: 'b', to: 2 },
			{ from: 2, on: null, to: 0 }
		]);
		expect(checkDocument(result.doc)).toEqual([]);
		expect(refused(doc, { type: 'removeSymbol', symbol: 'z' })).toBe('document.unknown_symbol');
	});
});

describe('kind and title', () => {
	it('setKind and setTitle', () => {
		const doc = build({ type: 'setKind', kind: 'ndfsm' }, { type: 'setTitle', title: 'Contoh' });
		expect(doc.kind).toBe('ndfsm');
		expect(doc.title).toBe('Contoh');
		expect(refused(doc, { type: 'setTitle', title: 'x'.repeat(LIMITS.titleChars + 1) })).toBe(
			'document.invalid_title'
		);
		expect(refused(doc, { type: 'setTitle', title: 'a\u0000' })).toBe('document.invalid_title');
		expect(refused(doc, { type: 'setKind', kind: 'pda' as 'dfsm' })).toBe(
			'document.invalid_command'
		);
	});
});

describe('a command that changes nothing', () => {
	it('gives back the very same document', () => {
		const doc = sample();
		const same: Command[] = [
			{ type: 'moveState', id: 0, x: 100, y: 100 },
			{ type: 'renameState', id: 0, name: 'q0' },
			{ type: 'setStart', id: 0 },
			{ type: 'setAccepting', id: 2, accepting: true },
			{ type: 'setAccepting', id: 0, accepting: false },
			{ type: 'setKind', kind: 'dfsm' },
			{ type: 'setTitle', title: '' },
			{ type: 'batch', commands: [] }
		];
		for (const command of same) {
			const result = applyCommand(doc, command);
			expect(result.ok && result.doc === doc, JSON.stringify(command)).toBe(true);
		}
	});
});

describe('batch', () => {
	it('applies the commands in order as one change', () => {
		const result = applyCommand(createDocument(), {
			type: 'batch',
			commands: [add(0, 0), add(10, 10), { type: 'setStart', id: 1 }]
		});
		expect(result.ok && result.doc.states.length).toBe(2);
		expect(result.ok && result.doc.start).toBe(1);
	});

	it('is all or nothing', () => {
		const doc = sample();
		const result = applyCommand(doc, {
			type: 'batch',
			commands: [
				{ type: 'moveState', id: 0, x: 1, y: 1 },
				{ type: 'renameState', id: 1, name: 'awal' },
				{ type: 'addTransition', from: 0, on: 'a', to: 1 } // already there
			]
		});
		expect(result.ok).toBe(false);
		expect(result.ok === false && result.error.key).toBe('document.duplicate_transition');
		expect(doc.states[0]).toMatchObject({ x: 100, y: 100 });
	});

	it('can contain a batch, and sees what the earlier commands made', () => {
		const result = applyCommand(createDocument(), {
			type: 'batch',
			commands: [
				add(0, 0),
				{ type: 'batch', commands: [add(1, 1), { type: 'setAccepting', id: 1, accepting: true }] }
			]
		});
		expect(result.ok && result.doc.accepting).toEqual([1]);
	});

	it('is not too deep', () => {
		let command: Command = { type: 'batch', commands: [] };
		for (let i = 0; i < 100; i++) command = { type: 'batch', commands: [command] };
		expect(refused(createDocument(), command)).toBe('document.limit_exceeded');
	});
});

describe('a command that is not a command', () => {
	it('is refused without a throw, and the document stays the same', () => {
		const doc = sample();
		const bad = [
			null,
			undefined,
			1,
			'x',
			[],
			{},
			{ type: 'explode' },
			{ type: 'moveState' },
			{ type: 'addState', x: '1', y: 2 }
		];
		for (const command of bad) {
			const result = applyCommand(doc, command as unknown as Command);
			expect(result.ok).toBe(false);
			expect(result.ok === false && result.error.key).toBe('document.invalid_command');
		}
	});
});

describe('the result', () => {
	it('is a frozen document, and a refused command leaves the old one untouched', () => {
		const doc = sample();
		const result = applyCommand(doc, { type: 'moveState', id: 0, x: 1, y: 2 });
		expect(result.ok && Object.isFrozen(result.doc)).toBe(true);
		expect(result.ok && Object.isFrozen(result.doc.states)).toBe(true);
		expect(() => {
			(doc.states as unknown as unknown[]).push(1);
		}).toThrow();
	});

	it('shares what did not change', () => {
		const doc = sample();
		const result = applyCommand(doc, { type: 'moveState', id: 0, x: 1, y: 2 });
		expect(result.ok && result.doc.transitions === doc.transitions).toBe(true);
		expect(result.ok && result.doc.states[1] === doc.states[1]).toBe(true);
	});
});
