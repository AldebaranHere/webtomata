import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands.ts';
import { documentFrom, endsWith01 } from './diagram/samples.ts';
import { checkDocument } from './document.ts';
import type { MachineDocument } from './document.ts';
import { random } from './testing.ts';
import {
	addSymbolCommand,
	clearCell,
	newStateCommand,
	removeSymbolNote,
	setCellTargets,
	tableOf
} from './table.ts';

const run = (doc: MachineDocument, command: ReturnType<typeof clearCell>) => {
	if (command === null) return doc;
	const result = applyCommand(doc, command);
	if (!result.ok) throw new Error(result.error.key);
	return result.doc;
};
const targetsOf = (doc: MachineDocument, from: number, on: string | null) =>
	doc.transitions
		.filter((t) => t.from === from && t.on === on)
		.map((t) => t.to)
		.sort((a, b) => a - b);

const ndfsm = () => ({
	...documentFrom({
		alphabet: ['a', 'b'],
		states: [
			[100, 100, 'q0'],
			[300, 50, 'q1'],
			[300, 150, 'q2']
		],
		start: 0,
		accepting: [1],
		transitions: [
			[0, null, 1],
			[0, null, 2],
			[1, 'a', 1],
			[1, 'a', 2]
		]
	}),
	kind: 'ndfsm' as const
});

describe('the rows and columns of the table', () => {
	const model = tableOf(endsWith01());

	it('has a column for each symbol, in the order of the alphabet, and no ε column for a DFSM', () => {
		expect(model.columns).toEqual(['0', '1']);
		expect(model.kind).toBe('dfsm');
	});

	it('has a row for each state, with its name, and whether it starts and accepts', () => {
		expect(model.rows.map((r) => [r.name, r.start, r.accepting])).toEqual([
			['q0', true, false],
			['q1', false, false],
			['q2', false, true]
		]);
	});

	it('has a cell for each state and symbol, with the targets by id', () => {
		expect(model.rows[0]!.cells.map((c) => c.targets)).toEqual([[1], [0]]);
		expect(model.rows[1]!.cells.map((c) => c.targets)).toEqual([[1], [2]]);
		expect(model.rows[2]!.cells.map((c) => c.on)).toEqual(['0', '1']);
	});

	it('marks the empty cells of a DFSM as missing, and never those of an NDFSM', () => {
		const incomplete = documentFrom({
			alphabet: ['a', 'b'],
			states: [
				[100, 100, 'q0'],
				[300, 100, 'q1']
			],
			start: 0,
			transitions: [[0, 'a', 1]]
		});
		const cells = tableOf(incomplete).rows.flatMap((r) => r.cells);
		expect(cells.filter((c) => c.missing).map((c) => `${c.from}${c.on}`)).toEqual([
			'0b',
			'1a',
			'1b'
		]);
		expect(
			tableOf(ndfsm())
				.rows.flatMap((r) => r.cells)
				.some((c) => c.missing)
		).toBe(false);
	});

	it('has an ε column for an NDFSM, last, and for a DFSM only if it has an ε transition', () => {
		expect(tableOf(ndfsm()).columns).toEqual(['a', 'b', null]);
		const odd = {
			...documentFrom({
				alphabet: ['a'],
				states: [
					[100, 100, 'q0'],
					[300, 100, 'q1']
				],
				start: 0,
				transitions: [[0, null, 1]]
			})
		};
		expect(tableOf(odd).columns).toEqual(['a', null]);
		expect(tableOf(odd).epsilon).toBe(true);
		expect(tableOf(endsWith01()).epsilon).toBe(false);
	});

	it('shows two targets of a DFSM for one symbol, so that the table is true', () => {
		const twice = documentFrom({
			alphabet: ['a'],
			states: [
				[100, 100, 'q0'],
				[300, 100, 'q1'],
				[500, 100, 'q2']
			],
			start: 0,
			transitions: [
				[0, 'a', 1],
				[0, 'a', 2]
			]
		});
		const cell = tableOf(twice).rows[0]!.cells[0]!;
		expect(cell.targets).toEqual([1, 2]);
		expect(cell.missing).toBe(false);
		expect(cell.several).toBe(true);
	});

	it('an NDFSM cell with several targets is normal, and is not "several"', () => {
		expect(tableOf(ndfsm()).rows[1]!.cells[0]!.several).toBe(false);
	});
});

describe('setting the targets of a cell', () => {
	it('a first target is one transition', () => {
		const doc = documentFrom({
			alphabet: ['a'],
			states: [
				[100, 100, 'q0'],
				[300, 100, 'q1']
			],
			start: 0
		});
		const next = run(doc, setCellTargets(doc, 0, 'a', [1]));
		expect(targetsOf(next, 0, 'a')).toEqual([1]);
	});

	it('a new target in the place of the old one removes the old one and adds the new one', () => {
		const doc = endsWith01();
		const next = run(doc, setCellTargets(doc, 0, '0', [2]));
		expect(targetsOf(next, 0, '0')).toEqual([2]);
		expect(targetsOf(next, 0, '1')).toEqual([0]);
	});

	it('is one command, so it is one step of the history', () => {
		const doc = endsWith01();
		const command = setCellTargets(doc, 0, '0', [2])!;
		expect(command.type).toBe('batch');
	});

	it('the same targets are no command', () => {
		expect(setCellTargets(endsWith01(), 0, '0', [1])).toBeNull();
		expect(setCellTargets(ndfsm(), 1, 'a', [2, 1])).toBeNull();
	});

	it('an empty list empties the cell, and a cell that is empty gives no command', () => {
		const doc = ndfsm();
		expect(targetsOf(run(doc, setCellTargets(doc, 1, 'a', [])), 1, 'a')).toEqual([]);
		expect(setCellTargets(doc, 2, 'b', [])).toBeNull();
	});

	it('works for ε', () => {
		const doc = ndfsm();
		const next = run(doc, setCellTargets(doc, 0, null, [2]));
		expect(targetsOf(next, 0, null)).toEqual([2]);
	});

	it('changes only that cell', () => {
		const doc = ndfsm();
		const next = run(doc, setCellTargets(doc, 0, null, [1]));
		expect(targetsOf(next, 1, 'a')).toEqual([1, 2]);
		expect(next.states).toBe(doc.states);
	});

	it('clearCell empties a cell', () => {
		const doc = endsWith01();
		expect(targetsOf(run(doc, clearCell(doc, 1, '1')), 1, '1')).toEqual([]);
		expect(clearCell(documentFrom({ states: [[1, 1]] }), 0, null)).toBeNull();
	});

	it('property: any change of a cell gives exactly those targets, and only that cell changes', () => {
		for (let seed = 1; seed <= 80; seed++) {
			const rng = random(seed);
			const count = 1 + rng.int(5);
			const base = documentFrom({
				alphabet: ['a', 'b'],
				states: Array.from({ length: count }, (_, i) => [100 + 90 * i, 100] as [number, number]),
				start: 0,
				transitions: [
					...new Map(
						Array.from({ length: rng.int(12) }, () => {
							const t: [number, string | null, number] = [
								rng.int(count),
								rng.chance(0.2) ? null : rng.pick(['a', 'b']),
								rng.int(count)
							];
							return [t.join('|'), t] as const;
						})
					).values()
				]
			});
			const from = rng.int(count);
			const on = rng.chance(0.2) ? null : rng.pick(['a', 'b']);
			const wanted = [...new Set(Array.from({ length: rng.int(4) }, () => rng.int(count)))].sort(
				(a, b) => a - b
			);
			const next = run(base, setCellTargets(base, from, on, wanted));
			expect(targetsOf(next, from, on), `seed ${seed}`).toEqual(wanted);
			expect(checkDocument(next), `seed ${seed}`).toEqual([]);
			for (const other of base.states) {
				for (const symbol of [null, 'a', 'b']) {
					if (other.id === from && symbol === on) continue;
					expect(targetsOf(next, other.id, symbol), `seed ${seed}`).toEqual(
						targetsOf(base, other.id, symbol)
					);
				}
			}
		}
	});
});

describe('adding a state and a symbol', () => {
	it('a new state goes to the right of the others, in the same row as the last one', () => {
		const command = newStateCommand(endsWith01());
		expect(command).toEqual({ type: 'addState', x: 730, y: 200 });
	});

	it('the first state of an empty machine has a place too', () => {
		expect(newStateCommand(documentFrom({ states: [] }))).toEqual({
			type: 'addState',
			x: 200,
			y: 200
		});
	});

	it('a new state is a state that the document accepts', () => {
		const doc = endsWith01();
		const next = run(doc, newStateCommand(doc));
		expect(next.states).toHaveLength(4);
		expect(next.states[3]!.name).toBe('q3');
	});

	it('a symbol is a command of the document, which checks it', () => {
		expect(addSymbolCommand('c')).toEqual({ type: 'addSymbol', symbol: 'c' });
		expect(addSymbolCommand('  c  ')).toEqual({ type: 'addSymbol', symbol: 'c' });
	});
});

describe('removing a symbol', () => {
	it('says how many transitions go with it', () => {
		expect(removeSymbolNote(endsWith01(), '0')).toEqual({ symbol: '0', count: 3 });
		expect(removeSymbolNote(endsWith01(), '2')).toEqual({ symbol: '2', count: 0 });
	});

	it('the command takes the transitions with it, as one step', () => {
		const doc = endsWith01();
		const next = run(doc, { type: 'removeSymbol', symbol: '0' });
		expect(next.alphabet).toEqual(['1']);
		expect(next.transitions.every((t) => t.on === '1')).toBe(true);
	});
});
