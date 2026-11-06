// Random sequences of PDA commands, with the checks that must hold for every one of them.
import { describe, expect, it } from 'vitest';
import {
	createPdaDocument,
	fromEnginePda,
	parsePdaDocumentText,
	pdaDocumentsEqual,
	serializePdaDocument,
	toEnginePda
} from './pda-document.ts';
import type { PdaDocument } from './pda-document.ts';
import { createPdaHistory } from './history.ts';
import { checkPdaDocument, random, randomPdaCommand } from './testing.ts';

const SEQUENCES = 200;
const LENGTH = 40;
const SEED_OFFSET = Number(process.env.PDA_SEED_OFFSET ?? '0') || 0;

describe(`PDA history property tests (seed offset ${SEED_OFFSET})`, () => {
	it('keeps every rule of the PDA document after every step, and a refused command changes nothing', () => {
		for (let i = 1; i <= SEQUENCES; i++) {
			const seed = SEED_OFFSET + i;
			const rng = random(seed);
			const history = createPdaHistory(createPdaDocument());
			const everUsed = new Set<number>();
			for (let step = 0; step < LENGTH; step++) {
				const beforeDoc = history.doc;
				const command = randomPdaCommand(rng, beforeDoc);
				const result = history.execute(command);
				const where = `seed ${seed}, step ${step}, ${JSON.stringify(command)}`;
				if (result.ok) {
					expect(checkPdaDocument(history.doc), where).toEqual([]);
					const before = new Set(beforeDoc.states.map((s) => s.id));
					for (const { id } of history.doc.states) {
						if (!before.has(id)) {
							expect(everUsed.has(id), `${where}: id ${id} used twice`).toBe(false);
						}
						everUsed.add(id);
					}
				} else {
					expect(history.doc, where).toBe(beforeDoc);
					expect(checkPdaDocument(history.doc), where).toEqual([]);
				}
			}
		}
	});

	it('undo all gives the initial document (same object), and redo all gives the last one (same object)', () => {
		for (let i = 1; i <= SEQUENCES; i++) {
			const seed = SEED_OFFSET + i;
			const rng = random(seed);
			const first = createPdaDocument();
			const history = createPdaHistory(first);
			for (let step = 0; step < LENGTH; step++) {
				history.execute(randomPdaCommand(rng, history.doc));
			}
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

	it('a random walk of undo and redo always shows the document recorded for that step, and refused/no-op commands are not steps', () => {
		for (let i = 1; i <= SEQUENCES; i++) {
			const seed = SEED_OFFSET + i;
			const rng = random(seed * 7919);
			const history = createPdaHistory(createPdaDocument());
			const docs: PdaDocument[] = [history.doc];
			let position = 0;
			for (let move = 0; move < LENGTH * 2; move++) {
				const roll = rng.next();
				if (roll < 0.5) {
					const before = history.doc;
					const canRedoBefore = history.canRedo;
					const result = history.execute(randomPdaCommand(rng, history.doc));
					if (history.doc !== before) {
						expect(result.ok, `seed ${seed}, move ${move}`).toBe(true);
						docs.length = position + 1;
						docs.push(history.doc);
						position++;
					} else {
						// Refused or no-op command is not a step and preserves canRedo.
						expect(history.canRedo, `seed ${seed}, move ${move}`).toBe(canRedoBefore);
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

	it('a moveState gesture with one coalesce key is one step, and returning to the start leaves no step', () => {
		const initial = createPdaDocument();
		const history = createPdaHistory(initial);
		history.execute({ type: 'addState', x: 10, y: 20 });
		const afterAdd = history.doc;

		for (let i = 1; i <= 40; i++) {
			history.execute({ type: 'moveState', id: 0, x: 10 + i, y: 20 + i }, { coalesce: 'drag:0' });
		}
		expect(history.doc.states[0]).toMatchObject({ x: 50, y: 60 });
		expect(history.undo()).toBe(true);
		expect(history.doc).toBe(afterAdd);
		expect(history.redo()).toBe(true);
		expect(history.doc.states[0]).toMatchObject({ x: 50, y: 60 });

		// A gesture that ends where it began leaves no step.
		history.seal();
		const beforeRoundTripDrag = history.doc;
		history.execute({ type: 'moveState', id: 0, x: 99, y: 99 }, { coalesce: 'drag:1' });
		history.execute({ type: 'moveState', id: 0, x: 50, y: 60 }, { coalesce: 'drag:1' });
		expect(pdaDocumentsEqual(history.doc, beforeRoundTripDrag)).toBe(true);
		expect(history.undo()).toBe(true);
		expect(history.doc).toBe(afterAdd);

		// A batch whose second command is refused is refused as a whole and adds no step.
		const beforeBatch = history.doc;
		const batchRes = history.execute({
			type: 'batch',
			commands: [
				{ type: 'addState', x: 100, y: 100 },
				{ type: 'removeState', id: 999_999 }
			]
		});
		expect(batchRes.ok).toBe(false);
		expect(history.doc).toBe(beforeBatch);
	});

	it('covers all 15 command types through createPdaHistory and produces non-empty states, alphabets and transitions', () => {
		let withStates = 0;
		let withInput = 0;
		let withStack = 0;
		let withTransitions = 0;
		for (let i = 1; i <= SEQUENCES; i++) {
			const seed = SEED_OFFSET + i;
			const rng = random(seed);
			const history = createPdaHistory(createPdaDocument());
			for (let step = 0; step < LENGTH; step++) {
				history.execute(randomPdaCommand(rng, history.doc));
			}
			const doc = history.doc;
			if (doc.states.length > 0) withStates++;
			if (doc.inputAlphabet.length > 0) withInput++;
			if (doc.stackAlphabet.length > 0) withStack++;
			if (doc.transitions.length > 0) withTransitions++;

			const parsed = parsePdaDocumentText(serializePdaDocument(doc));
			expect(parsed.ok, `seed ${seed}`).toBe(true);
			const roundTripped = fromEnginePda(toEnginePda(doc), doc.states);
			expect(toEnginePda(roundTripped), `seed ${seed}`).toEqual(toEnginePda(doc));
		}
		expect(withStates).toBeGreaterThan(SEQUENCES * 0.85);
		expect(withInput).toBeGreaterThan(SEQUENCES * 0.75);
		expect(withStack).toBeGreaterThan(SEQUENCES * 0.75);
		expect(withTransitions).toBeGreaterThan(SEQUENCES * 0.5);
	});
});
