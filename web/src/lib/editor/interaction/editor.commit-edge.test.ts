// `commitEdge` is the tail that every kind of document shares: it sends the commands of the label
// box as one step, closes the box and says what happened. These tests run it on the FSM editor;
// `pda-editor.test.ts` runs it on a PDA.
import { describe, expect, it } from 'vitest';
import { build } from '../diagram/testing.ts';
import { createEditor } from './editor.ts';

const three = () =>
	build({
		alphabet: ['a', 'b'],
		states: [
			[200, 200, 'q0'],
			[400, 200, 'q1'],
			[600, 200, 'q2']
		],
		start: 0,
		transitions: [
			[0, 'a', 1],
			[0, 'b', 1],
			[1, 'a', 2]
		]
	});

/** An editor with the label box open for the pair 2 → 0, which has no transition. */
function opened() {
	const editor = createEditor(three());
	editor.startLink(2);
	editor.finishLink(0);
	return editor;
}

describe('commitEdge', () => {
	it('does nothing when no label box is open', () => {
		const editor = createEditor(three());
		const before = editor.getState();
		expect(editor.commitEdge([{ type: 'addTransition', from: 2, on: 'a', to: 0 }])).toBeNull();
		expect(editor.getState()).toBe(before);
	});

	it('with no commands closes the box, makes no step, and leaves announcement unchanged', () => {
		const editor = opened();
		const doc = editor.getState().doc;
		const annBefore = editor.getState().announcement;
		expect(editor.commitEdge([])).toBeNull();
		const s = editor.getState();
		expect(s.labeling).toBeNull();
		expect(s.doc).toBe(doc);
		expect(s.canUndo).toBe(false);
		expect(s.announcement).toBe(annBefore);
		if (annBefore) {
			expect(s.announcement?.seq).toBe(annBefore.seq);
		}
	});

	it('sends one command, closes the box, and says what the edge has now', () => {
		const editor = opened();
		const doc = editor.getState().doc;
		expect(editor.commitEdge([{ type: 'addTransition', from: 2, on: 'a', to: 0 }])).toBeNull();
		const s = editor.getState();
		expect(s.labeling).toBeNull();
		expect(s.doc.transitions).toHaveLength(4);
		expect(s.announcement).toMatchObject({
			key: 'editor.edge_changed',
			params: { from: 'q2', to: 'q0', symbols: 'a' }
		});
		editor.undo();
		expect(editor.getState().doc).toBe(doc);
	});

	it('sends several commands as one undo step', () => {
		const editor = opened();
		const doc = editor.getState().doc;
		expect(
			editor.commitEdge([
				{ type: 'addSymbol', symbol: 'c' },
				{ type: 'addTransition', from: 2, on: 'c', to: 0 },
				{ type: 'addTransition', from: 2, on: 'a', to: 0 }
			])
		).toBeNull();
		expect(editor.getState().announcement).toMatchObject({
			key: 'editor.edge_changed',
			params: { symbols: 'a, c' }
		});
		editor.undo();
		expect(editor.getState().doc).toBe(doc);
		expect(editor.getState().canUndo).toBe(false);
	});

	it('a refused command keeps the box open, changes nothing and returns the refusal', () => {
		const editor = opened();
		const doc = editor.getState().doc;
		const refusal = editor.commitEdge([{ type: 'addTransition', from: 2, on: 'z', to: 0 }]);
		expect(refusal).not.toBeNull();
		const s = editor.getState();
		expect(s.labeling).toEqual({ from: 2, to: 0, ask: null });
		expect(s.doc).toBe(doc);
		expect(s.canUndo).toBe(false);
		expect(s.announcement).toMatchObject({ key: refusal!.key, params: refusal!.params });
	});

	it('says that the edge is gone when its last transition is removed', () => {
		const editor = createEditor(three());
		editor.selectEdge(1, 2);
		editor.editEdge();
		expect(editor.commitEdge([{ type: 'removeTransition', from: 1, on: 'a', to: 2 }])).toBeNull();
		const s = editor.getState();
		expect(s.announcement).toMatchObject({
			key: 'editor.edge_removed',
			params: { from: 'q1', to: 'q2' }
		});
		expect(s.doc.transitions).toHaveLength(2);
		expect(s.edge).toBeNull();
		expect(s.focus.id).toBe(1);
	});

	it('says that the edge changed when some of its transitions are left', () => {
		const editor = createEditor(three());
		editor.selectEdge(0, 1);
		editor.editEdge();
		editor.commitEdge([{ type: 'removeTransition', from: 0, on: 'a', to: 1 }]);
		expect(editor.getState().announcement).toMatchObject({
			key: 'editor.edge_changed',
			params: { from: 'q0', to: 'q1', symbols: 'b' }
		});
		// The edge is still selected, so the focus goes back to it.
		expect(editor.getState().focus.edge).toEqual({ from: 0, to: 1 });
	});
});
