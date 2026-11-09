// Random sequences of commands, with the checks that must hold for every one of them. The seeds are
// fixed, so a failure can be repeated: the message names the seed and the step.
import { describe, expect, it } from 'vitest';
import {
	checkDocument,
	createDocument,
	documentFromMachine,
	parseDocumentText,
	serializeDocument,
	toMachine
} from './document.ts';
import type { MachineDocument } from './document.ts';
import { applyCommand } from './commands.ts';
import { createHistory } from './history.ts';
import { random, randomCommand, scalingRatio } from './testing.ts';

const SEQUENCES = 200;
const LENGTH = 30;

describe('random sequences of commands', () => {
	it('keep every rule of the document after every step, and a refused command changes nothing', () => {
		for (let seed = 1; seed <= SEQUENCES; seed++) {
			const rng = random(seed);
			let doc = createDocument();
			// Every id that a state ever had. A new state never gets one of them again.
			const everUsed = new Set<number>();
			for (let step = 0; step < LENGTH; step++) {
				const command = randomCommand(rng, doc);
				const result = applyCommand(doc, command);
				const where = `seed ${seed}, step ${step}, ${JSON.stringify(command)}`;
				if (result.ok) {
					expect(checkDocument(result.doc), where).toEqual([]);
					const before = new Set(doc.states.map((s) => s.id));
					for (const { id } of result.doc.states) {
						if (!before.has(id))
							expect(everUsed.has(id), `${where}: id ${id} used twice`).toBe(false);
						everUsed.add(id);
					}
					doc = result.doc;
				} else {
					// The document is the same object, because nothing was applied.
					expect(checkDocument(doc), where).toEqual([]);
				}
			}
		}
	});

	it('undo all gives the first document, and redo all gives the last one', () => {
		for (let seed = 1; seed <= SEQUENCES; seed++) {
			const rng = random(seed);
			const first = createDocument();
			const history = createHistory(first);
			for (let step = 0; step < LENGTH; step++) history.execute(randomCommand(rng, history.doc));
			const last = history.doc;

			let undone = 0;
			while (history.undo()) undone++;
			expect(history.doc, `seed ${seed}`).toBe(first);
			let redone = 0;
			while (history.redo()) redone++;
			expect(redone, `seed ${seed}`).toBe(undone);
			expect(history.doc, `seed ${seed}`).toBe(last);
		}
	});

	it('a random walk of undo and redo always shows the document that was recorded for that step', () => {
		for (let seed = 1; seed <= SEQUENCES; seed++) {
			const rng = random(seed * 7919);
			const history = createHistory(createDocument());
			// docs[k] is the document after k steps, for the steps that are on the path.
			const docs: MachineDocument[] = [history.doc];
			let position = 0;
			for (let move = 0; move < LENGTH * 2; move++) {
				const roll = rng.next();
				if (roll < 0.5) {
					const before = history.doc;
					history.execute(randomCommand(rng, history.doc));
					if (history.doc !== before) {
						docs.length = position + 1; // a new edit forgets the redo path
						docs.push(history.doc);
						position++;
					}
				} else if (roll < 0.8) {
					if (history.undo()) position--;
				} else if (history.redo()) {
					position++;
				}
				expect(history.doc, `seed ${seed}, move ${move}`).toBe(docs[position]);
				expect(history.canUndo, `seed ${seed}, move ${move}`).toBe(position > 0);
				expect(history.canRedo, `seed ${seed}, move ${move}`).toBe(position < docs.length - 1);
			}
		}
	});

	it('survive being saved and read back, and become a machine and back', () => {
		for (let seed = 1; seed <= SEQUENCES; seed++) {
			const rng = random(seed * 31);
			const history = createHistory(createDocument());
			for (let step = 0; step < LENGTH; step++) history.execute(randomCommand(rng, history.doc));
			const doc = history.doc;

			const parsed = parseDocumentText(serializeDocument(doc));
			expect(parsed.ok, `seed ${seed}`).toBe(true);
			expect(parsed.ok && parsed.value, `seed ${seed}`).toEqual(doc);

			// toMachine and back keeps what the engine knows. Names and places go through the layout.
			const layout = doc.states.map(({ id, name, x, y }) => ({ id, name, x, y }));
			const again = documentFromMachine(toMachine(doc), layout);
			expect(toMachine(again), `seed ${seed}`).toEqual(toMachine(doc));
			expect(again.states, `seed ${seed}`).toEqual(doc.states);
		}
	});

	it('are the same every time (the seeds are fixed)', () => {
		const run = () => {
			const rng = random(42);
			let doc = createDocument();
			for (let i = 0; i < LENGTH; i++) {
				const result = applyCommand(doc, randomCommand(rng, doc));
				if (result.ok) doc = result.doc;
			}
			return serializeDocument(doc);
		};
		expect(run()).toBe(run());
	});

	it('are not all empty: the generator makes states, transitions and symbols', () => {
		let withTransitions = 0;
		let withSymbols = 0;
		let withStates = 0;
		for (let seed = 1; seed <= SEQUENCES; seed++) {
			const rng = random(seed);
			let doc = createDocument();
			for (let step = 0; step < LENGTH; step++) {
				const result = applyCommand(doc, randomCommand(rng, doc));
				if (result.ok) doc = result.doc;
			}
			if (doc.transitions.length > 0) withTransitions++;
			if (doc.alphabet.length > 0) withSymbols++;
			if (doc.states.length > 0) withStates++;
		}
		expect(withStates).toBeGreaterThan(SEQUENCES * 0.9);
		expect(withSymbols).toBeGreaterThan(SEQUENCES * 0.8);
		expect(withTransitions).toBeGreaterThan(SEQUENCES * 0.5);
	});
});

describe('speed', () => {
	it('moves states with near-linear scaling in document size', () => {
		function makeDoc(n: number) {
			const doc = createDocument();
			const commands = Array.from({ length: n }, (_, i) => ({
				type: 'addState' as const,
				x: i,
				y: i,
				name: `s${i}`
			}));
			const built = applyCommand(doc, { type: 'batch', commands });
			if (!built.ok) throw new Error(built.error.key);
			return built.doc;
		}

		const smallDoc = makeDoc(500);
		const largeDoc = makeDoc(2000);

		function runMoves(initialDoc: MachineDocument, n: number, moves: number) {
			const history = createHistory(initialDoc);
			const targetId = Math.floor(n / 2);
			for (let i = 0; i < moves; i++) {
				history.execute({ type: 'moveState', id: targetId, x: i, y: i }, { coalesce: 'drag' });
			}
			return history.doc;
		}

		let finalDoc: MachineDocument | undefined;
		// smallRepeats = 3 brings small sample CPU time to ~12 ms (one run of 200 moves is ~4 ms).
		const ratio = scalingRatio(
			() => {
				runMoves(smallDoc, 500, 200);
			},
			() => {
				finalDoc = runMoves(largeDoc, 2000, 200);
			},
			{ smallRepeats: 3, largeRepeats: 1, samples: 5 }
		);
		expect(finalDoc?.states.length).toBe(2000);
		// Linear move cost in state count is ~4 (quiet median 4.00, max 4.93; loaded median 3.82, max 5.16).
		// Bound 10 provides ~2x headroom over loaded max while failing a quadratic move (theory ~16, measured 15.5).
		expect(ratio).toBeLessThan(10);
	}, 15_000);
});
