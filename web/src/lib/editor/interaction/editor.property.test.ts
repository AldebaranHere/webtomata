// Random sequences of everything a user can do, with the rules that must hold after every step.
// The seeds are fixed, so a failure can be repeated: the message names the seed and the step.
import { describe, expect, it } from 'vitest';
import { checkDocument, documentsEqual } from '../document.ts';
import { build } from '../diagram/testing.ts';
import { random } from '../testing.ts';
import type { Random } from '../testing.ts';
import { MARGIN, WORLD } from './canvas.ts';
import { createEditor } from './editor.ts';
import type { Editor } from './editor.ts';

const SEQUENCES = 200;
const LENGTH = 40;

const first = () =>
	build({
		alphabet: ['a', 'b'],
		states: [
			[200, 200, 'q0'],
			[400, 200, 'q1'],
			[600, 200, 'q2'],
			[400, 400, 'q3']
		],
		start: 0,
		accepting: [3],
		transitions: [
			[0, 'a', 1],
			[1, 'b', 2],
			[2, 'a', 2],
			[3, 'b', 0]
		]
	});

const point = (rng: Random) => ({ x: rng.int(2200) - 300, y: rng.int(1500) - 250 });
const someId = (rng: Random, editor: Editor) => {
	const ids = editor.getState().doc.states.map((s) => s.id);
	// Sometimes an id that does not exist, on purpose.
	return ids.length === 0 || rng.chance(0.1) ? 99 : rng.pick(ids);
};

/** One random action. */
function act(rng: Random, editor: Editor) {
	const roll = rng.int(100);
	if (roll < 10) editor.addStateAt(point(rng));
	else if (roll < 14) editor.addStateNear(point(rng));
	else if (roll < 22) editor.select([someId(rng, editor), someId(rng, editor)]);
	else if (roll < 26) editor.toggle(someId(rng, editor));
	else if (roll < 28) editor.selectAll();
	else if (roll < 31) editor.clearSelection();
	else if (roll < 43) {
		// A drag, ended or canceled.
		editor.beginDrag(someId(rng, editor), point(rng));
		for (let i = 0, n = rng.int(4); i < n; i++) editor.dragTo(point(rng), rng.chance(0.3));
		if (rng.chance(0.8)) editor.endDrag();
		else editor.cancelDrag();
	} else if (roll < 53)
		editor.nudge(
			rng.pick([-50, -10, 10, 50]) * (rng.chance(0.5) ? 1 : 0),
			rng.pick([-50, -10, 10, 50])
		);
	else if (roll < 60) editor.deleteSelected();
	else if (roll < 64) editor.deleteStates([someId(rng, editor), someId(rng, editor)]);
	else if (roll < 74) editor.undo();
	else if (roll < 82) editor.redo();
	else if (roll < 85) editor.escape();
	else if (roll < 88) editor.setTool(rng.pick(['select', 'addState', 'delete'] as const));
	else if (roll < 90) editor.seal();
	else if (roll < 94) {
		editor.startMarquee(point(rng));
		editor.moveMarquee(point(rng));
		if (rng.chance(0.7)) editor.endMarquee();
		else editor.escape();
	} else if (roll < 97) editor.focusState(someId(rng, editor), { keepSelection: rng.chance(0.5) });
	else editor.noteFocus(rng.chance(0.2) ? null : someId(rng, editor));
}

describe('random sequences of actions in the editor', () => {
	it('keep every rule after every step', () => {
		for (let seed = 1; seed <= SEQUENCES; seed++) {
			const rng = random(seed);
			const editor = createEditor(first());
			for (let step = 0; step < LENGTH; step++) {
				act(rng, editor);
				const s = editor.getState();
				const where = `seed ${seed}, step ${step}`;
				const ids = s.doc.states.map((x) => x.id);

				expect(checkDocument(s.doc), where).toEqual([]);
				// The selection is sorted, has no repeat, and names only states that exist.
				expect([...s.selection], where).toEqual([...new Set(s.selection)].sort((a, b) => a - b));
				for (const id of s.selection) expect(ids, `${where}: selected ${id}`).toContain(id);
				if (s.focus.id !== null) expect(ids, `${where}: focus`).toContain(s.focus.id);
				// A drag that is not under way leaves no preview.
				if (!s.dragging) expect(s.preview, where).toBeNull();
				// Every state is inside the world.
				for (const x of s.doc.states) {
					expect(x.x, where).toBeGreaterThanOrEqual(MARGIN);
					expect(x.x, where).toBeLessThanOrEqual(WORLD.width - MARGIN);
					expect(x.y, where).toBeGreaterThanOrEqual(MARGIN);
					expect(x.y, where).toBeLessThanOrEqual(WORLD.height - MARGIN);
				}
			}
		}
	});

	it('can always be undone to the first document, and redone to the last', () => {
		for (let seed = 1; seed <= SEQUENCES; seed++) {
			const rng = random(seed * 7919);
			const start = first();
			const editor = createEditor(start);
			for (let step = 0; step < LENGTH; step++) act(rng, editor);
			editor.cancelDrag();
			const last = editor.getState().doc;

			let undone = 0;
			while (editor.getState().canUndo) {
				editor.undo();
				undone++;
			}
			expect(editor.getState().doc, `seed ${seed}`).toBe(start);
			expect(editor.getState().dirty, `seed ${seed}`).toBe(false);
			for (let i = 0; i < undone; i++) editor.redo();
			expect(documentsEqual(editor.getState().doc, last), `seed ${seed}`).toBe(true);
		}
	});

	it('are the same every time (the seeds are fixed)', () => {
		const run = () => {
			const rng = random(42);
			const editor = createEditor(first());
			for (let i = 0; i < LENGTH; i++) act(rng, editor);
			return JSON.stringify(editor.getState().doc);
		};
		expect(run()).toBe(run());
	});

	it('do change things: states are added, moved and deleted in most sequences', () => {
		let changed = 0;
		for (let seed = 1; seed <= SEQUENCES; seed++) {
			const rng = random(seed);
			const editor = createEditor(first());
			for (let i = 0; i < LENGTH; i++) act(rng, editor);
			if (editor.getState().dirty) changed++;
		}
		expect(changed).toBeGreaterThan(SEQUENCES * 0.8);
	});
});
