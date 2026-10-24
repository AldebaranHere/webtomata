import { describe, expect, it } from 'vitest';
import { labelOf } from './label.ts';
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

describe('select an edge', () => {
	it('selects it, empties the selection of states, and says what it is', () => {
		const editor = createEditor(three());
		editor.selectOnly(2);
		editor.selectEdge(0, 1);
		const s = editor.getState();
		expect(s.edge).toEqual({ from: 0, to: 1 });
		expect(s.selection).toEqual([]);
		expect(s.announcement).toMatchObject({
			key: 'editor.edge_selected',
			params: { from: 'q0', to: 'q1', symbols: 'a, b' }
		});
		expect(s.canUndo).toBe(false);
	});

	it('selecting a state or all states, or clearing, drops the edge', () => {
		const editor = createEditor(three());
		editor.selectEdge(0, 1);
		editor.selectOnly(1);
		expect(editor.getState().edge).toBeNull();
		editor.selectEdge(0, 1);
		editor.selectAll();
		expect(editor.getState().edge).toBeNull();
		editor.selectEdge(1, 2);
		editor.clearSelection();
		expect(editor.getState().edge).toBeNull();
		editor.selectEdge(1, 2);
		editor.escape();
		expect(editor.getState().edge).toBeNull();
	});

	it('an edge that does not exist cannot be selected', () => {
		const editor = createEditor(three());
		editor.selectEdge(2, 0);
		expect(editor.getState().edge).toBeNull();
		editor.selectEdge(9, 1);
		expect(editor.getState().edge).toBeNull();
	});

	it('goes when its transitions are gone (undo of the add, or a delete of a state)', () => {
		const editor = createEditor(three());
		editor.selectEdge(1, 2);
		editor.deleteStates([2]);
		expect(editor.getState().edge).toBeNull();

		const added = createEditor(three());
		added.startLink(2);
		added.finishLink(0);
		added.commitLabel('a');
		added.selectEdge(2, 0);
		added.undo();
		expect(added.getState().edge).toBeNull();
	});

	it('a new state, a drag and a link start replace it', () => {
		const editor = createEditor(three());
		editor.selectEdge(0, 1);
		editor.addStateAt({ x: 300, y: 500 });
		expect(editor.getState().edge).toBeNull();
		editor.selectEdge(0, 1);
		editor.startLink(2);
		expect(editor.getState().edge).toBeNull();
	});

	it('the focus can move to a state while an edge is selected, and then the state is selected', () => {
		const editor = createEditor(three());
		editor.selectEdge(0, 1);
		editor.focusState(2, { keepSelection: false });
		expect(editor.getState().edge).toBeNull();
		expect(editor.getState().selection).toEqual([2]);
	});
});

describe('edit the symbols of the selected edge', () => {
	it('opens the box with the edge, and a new text is one undo step', () => {
		const editor = createEditor(three());
		editor.selectEdge(0, 1);
		editor.editEdge();
		expect(editor.getState().labeling).toEqual({ from: 0, to: 1, ask: null });
		expect(editor.commitLabel('b')).toBeNull();
		expect(labelOf(editor.getState().doc, 0, 1)).toBe('b');
		expect(editor.getState().edge).toEqual({ from: 0, to: 1 });
		// The focus goes back to the edge, which is still selected.
		expect(editor.getState().focus).toMatchObject({ id: null, edge: { from: 0, to: 1 } });
		editor.undo();
		expect(labelOf(editor.getState().doc, 0, 1)).toBe('a, b');
		expect(editor.getState().canUndo).toBe(false);
	});

	it('an empty text removes the edge, and the focus goes to its source', () => {
		const editor = createEditor(three());
		editor.selectEdge(1, 2);
		editor.editEdge();
		expect(editor.commitLabel('')).toBeNull();
		expect(labelOf(editor.getState().doc, 1, 2)).toBe('');
		expect(editor.getState().edge).toBeNull();
		expect(editor.getState().focus).toMatchObject({ id: 1 });
	});

	it('does nothing without a selected edge, or while a box is open', () => {
		const editor = createEditor(three());
		editor.editEdge();
		expect(editor.getState().labeling).toBeNull();
		editor.selectEdge(0, 1);
		editor.editEdge();
		editor.editEdge();
		expect(editor.getState().labeling).toEqual({ from: 0, to: 1, ask: null });
	});
});

describe('delete an edge', () => {
	it('Delete on a selected edge removes all its symbols in one step, with a toast', () => {
		const editor = createEditor(three());
		editor.selectEdge(0, 1);
		editor.deleteSelected();
		const s = editor.getState();
		expect(s.doc.transitions).toHaveLength(1);
		expect(s.edge).toBeNull();
		expect(s.focus).toMatchObject({ id: 0 });
		expect(s.announcement).toMatchObject({
			key: 'editor.edge_removed',
			params: { from: 'q0', to: 'q1' }
		});
		expect(s.toast).toMatchObject({ key: 'editor.edge_removed' });
		editor.undo();
		expect(editor.getState().doc.transitions).toHaveLength(3);
		expect(editor.getState().canUndo).toBe(false);
		expect(editor.getState().toast).toBeNull();
	});

	it('deleteEdge removes an edge without selecting it first (the Hapus tool)', () => {
		const editor = createEditor(three());
		editor.deleteEdge(1, 2);
		expect(editor.getState().doc.transitions).toHaveLength(2);
		editor.deleteEdge(1, 2);
		expect(editor.getState().canUndo).toBe(true);
		editor.undo();
		expect(editor.getState().canUndo).toBe(false);
	});

	it('leaves the alphabet, the states and the other edges alone', () => {
		const editor = createEditor(three());
		editor.deleteEdge(0, 1);
		expect(editor.getState().doc.alphabet).toEqual(['a', 'b']);
		expect(editor.getState().doc.states).toHaveLength(3);
		expect(labelOf(editor.getState().doc, 1, 2)).toBe('a');
	});

	it('is stopped while a box is open', () => {
		const editor = createEditor(three());
		editor.startLink(0);
		editor.finishLink(1);
		editor.deleteEdge(1, 2);
		expect(editor.getState().doc.transitions).toHaveLength(3);
	});
});

describe('a transition from a state (the menu)', () => {
	it('switches to Transisi with that state as the source', () => {
		const editor = createEditor(three());
		editor.linkFrom(2);
		const s = editor.getState();
		expect(s.tool).toBe('transition');
		expect(s.link).toMatchObject({ from: 2 });
		expect(s.selection).toEqual([2]);
	});

	it('does nothing for a state that does not exist', () => {
		const editor = createEditor(three());
		editor.linkFrom(9);
		expect(editor.getState().link).toBeNull();
	});
});
