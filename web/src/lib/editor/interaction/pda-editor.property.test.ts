// Random sequences of actions in the PDA editor (T-049 fixture F6).
// Checks the invariants after every step across 300 seeded sequences of up to 60 actions.
import { describe, expect, it } from 'vitest';
import { checkPdaDocument, random } from '../testing.ts';
import type { Random } from '../testing.ts';
import { wwrSample } from '../pda-samples.ts';
import { LIMIT } from './canvas.ts';
import { createPdaEditor } from './pda-editor.ts';
import type { PdaEditor } from './pda-editor.ts';

const SEQUENCES = 300;
const LENGTH = 60;

const point = (rng: Random) => ({ x: rng.int(2200) - 300, y: rng.int(1500) - 250 });
const someId = (rng: Random, editor: PdaEditor) => {
	const ids = editor.getState().doc.states.map((s) => s.id);
	return ids.length === 0 || rng.chance(0.1) ? 99 : rng.pick(ids);
};

function act(rng: Random, editor: PdaEditor) {
	const roll = rng.int(116);
	if (roll < 10) editor.addStateAt(point(rng));
	else if (roll < 14) editor.addStateNear(point(rng));
	else if (roll < 22) editor.select([someId(rng, editor), someId(rng, editor)]);
	else if (roll < 26) editor.toggle(someId(rng, editor));
	else if (roll < 28) editor.selectAll();
	else if (roll < 31) editor.clearSelection();
	else if (roll < 43) {
		// A drag, ended or canceled
		editor.beginDrag(someId(rng, editor), point(rng));
		for (let i = 0, n = rng.int(4); i < n; i++) editor.dragTo(point(rng), rng.chance(0.3));
		if (rng.chance(0.8)) editor.endDrag();
		else editor.cancelDrag();
	} else if (roll < 53) {
		editor.nudge(
			rng.pick([-50, -10, 10, 50]) * (rng.chance(0.5) ? 1 : 0),
			rng.pick([-50, -10, 10, 50])
		);
	} else if (roll < 60) editor.deleteSelected();
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
	} else if (roll < 96) editor.focusState(someId(rng, editor), { keepSelection: rng.chance(0.5) });
	else if (roll < 97) editor.toggleAccepting();
	else if (roll < 98) editor.toggleStart();
	else if (roll < 99) {
		editor.startRename();
		const name = rng.pick(['q0', 'q1', 'x', '', ' y', 'Genap']);
		if (rng.chance(0.7)) editor.commitRename(name);
		if (rng.chance(0.5)) editor.cancelRename();
	} else if (roll < 100) editor.noteFocus(rng.chance(0.2) ? null : someId(rng, editor));
	else if (roll < 104) {
		// A transition: start link, move, finish
		editor.setTool('transition');
		editor.startLink(someId(rng, editor));
		editor.moveLink(point(rng));
		editor.finishLink(rng.chance(0.15) ? null : someId(rng, editor));
	} else if (roll < 107) {
		// commitEdge: valid or refused commands
		const s = editor.getState();
		if (s.labeling) {
			const valid = rng.chance(0.7);
			const read = rng.pick([null, 'a', 'b', valid ? 'a' : 'z']);
			const pop = rng.pick([[], ['A'], ['B'], valid ? ['A'] : ['Z']]);
			const push = rng.pick([[], ['A'], ['B'], valid ? ['A'] : ['Z']]);
			editor.commitEdge([
				{
					type: 'addTransition',
					from: s.labeling.from,
					read,
					pop,
					push,
					to: s.labeling.to
				}
			]);
		} else {
			editor.cancelLabel();
		}
	} else if (roll < 108) editor.cancelLabel();
	else if (roll < 111) editor.selectEdge(someId(rng, editor), someId(rng, editor));
	else if (roll < 112) editor.editEdge();
	else if (roll < 114) editor.deleteEdge(someId(rng, editor), someId(rng, editor));
	else if (roll < 115) editor.linkFrom(someId(rng, editor));
	else editor.deleteSelected();
}

function runPropertySuite(seedOffset: number) {
	for (let seed = 1; seed <= SEQUENCES; seed++) {
		const rng = random(seed + seedOffset);
		const start = wwrSample();
		const editor = createPdaEditor(start);

		for (let step = 0; step < LENGTH; step++) {
			act(rng, editor);
			const s = editor.getState();
			const where = `offset ${seedOffset}, seed ${seed}, step ${step}`;
			const ids = s.doc.states.map((x) => x.id);

			expect(checkPdaDocument(s.doc), where).toEqual([]);
			// The selection is sorted, has no repeat, and names only states that exist.
			expect([...s.selection], where).toEqual([...new Set(s.selection)].sort((a, b) => a - b));
			for (const id of s.selection) expect(ids, `${where}: selected ${id}`).toContain(id);
			if (s.focus.id !== null) expect(ids, `${where}: focus`).toContain(s.focus.id);
			if (s.renaming !== null) expect(ids, `${where}: renaming`).toContain(s.renaming);
			if (s.link) expect(ids, `${where}: link`).toContain(s.link.from);

			// A selected edge has transitions, and is never selected together with states.
			if (s.edge) {
				const edge = s.edge;
				expect(
					s.doc.transitions.some((t) => t.from === edge.from && t.to === edge.to),
					`${where}: edge`
				).toBe(true);
				expect(s.selection, `${where}: edge and states`).toEqual([]);
			}
			if (s.labeling) {
				expect(ids, `${where}: labeling from`).toContain(s.labeling.from);
				expect(ids, `${where}: labeling to`).toContain(s.labeling.to);
			}

			// A half-made transition and an open box never exist together.
			expect(s.link !== null && s.labeling !== null, where).toBe(false);
			// The start state is a state that exists.
			if (s.doc.start !== null) expect(ids, `${where}: start`).toContain(s.doc.start);
			// A drag that is not under way leaves no preview.
			if (!s.dragging) expect(s.preview, where).toBeNull();
			// Every state is inside the limit of the document.
			for (const x of s.doc.states) {
				expect(Math.abs(x.x), where).toBeLessThanOrEqual(LIMIT);
				expect(Math.abs(x.y), where).toBeLessThanOrEqual(LIMIT);
			}
		}

		// At the end, undo until canUndo is false gives back the exact initial document (===)
		editor.cancelDrag();
		while (editor.getState().canUndo) {
			editor.undo();
		}
		expect(editor.getState().doc, `offset ${seedOffset}, seed ${seed}`).toBe(start);
		expect(editor.getState().dirty, `offset ${seedOffset}, seed ${seed}`).toBe(false);
	}
}

describe('F6, random sequences of actions in the PDA editor', () => {
	it('run 1: seed offset 0', () => {
		runPropertySuite(0);
	});

	it('run 2: seed offset 10_000', () => {
		runPropertySuite(10_000);
	});

	it('run 3: seed offset 20_000', () => {
		runPropertySuite(20_000);
	});
});
