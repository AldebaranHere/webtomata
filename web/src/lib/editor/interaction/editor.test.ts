import { describe, expect, it } from 'vitest';
import { build } from '../diagram/testing.ts';
import { createEditor } from './editor.ts';

const three = () =>
	build({
		alphabet: ['a'],
		states: [
			[200, 200, 'q0'],
			[400, 200, 'q1'],
			[600, 200, 'q2']
		],
		start: 0,
		transitions: [
			[0, 'a', 1],
			[1, 'a', 2]
		]
	});

const places = (editor: ReturnType<typeof createEditor>) =>
	editor.getState().doc.states.map((s) => [s.id, s.x, s.y]);

describe('a new editor', () => {
	it('has nothing selected, the Pilih tool, no history and no changes', () => {
		const s = createEditor(three()).getState();
		expect(s).toMatchObject({
			selection: [],
			tool: 'select',
			preview: null,
			marquee: null,
			canUndo: false,
			canRedo: false,
			dirty: false,
			announcement: null
		});
	});

	it('tells its listeners about each change, and stops when they leave', () => {
		const editor = createEditor(three());
		let calls = 0;
		const stop = editor.subscribe(() => calls++);
		editor.select([1]);
		expect(calls).toBeGreaterThan(0);
		const seen = calls;
		stop();
		editor.select([2]);
		expect(calls).toBe(seen);
	});

	it('gives a new state object for each change', () => {
		const editor = createEditor(three());
		const before = editor.getState();
		editor.select([0]);
		expect(editor.getState()).not.toBe(before);
		expect(before.selection).toEqual([]);
	});
});

describe('add a state', () => {
	it('adds it at the point, selects it, asks the view to focus it, and says so', () => {
		const editor = createEditor(three());
		editor.addStateAt({ x: 300, y: 500 });
		const s = editor.getState();
		expect(s.doc.states).toHaveLength(4);
		expect(s.doc.states[3]).toMatchObject({ id: 3, name: 'q3', x: 300, y: 500 });
		expect(s.selection).toEqual([3]);
		expect(s.focus).toMatchObject({ id: 3 });
		expect(s.announcement).toMatchObject({ key: 'editor.state_added', params: { name: 'q3' } });
		expect(s.canUndo).toBe(true);
		expect(s.dirty).toBe(true);
	});

	it('does not change the tool', () => {
		const editor = createEditor(three());
		editor.setTool('addState');
		editor.addStateAt({ x: 300, y: 500 });
		expect(editor.getState().tool).toBe('addState');
	});

	it('keeps the new state inside the world', () => {
		const editor = createEditor(three());
		editor.addStateAt({ x: -50, y: 99999 });
		expect(editor.getState().doc.states[3]).toMatchObject({ x: 40, y: 960 });
	});

	it('asks again for focus each time, so that the view focuses it even if the id repeats', () => {
		const editor = createEditor(three());
		editor.addStateAt({ x: 300, y: 500 });
		const first = editor.getState().focus.request;
		editor.addStateAt({ x: 300, y: 600 });
		expect(editor.getState().focus.request).toBeGreaterThan(first);
	});

	it('addStateNear keeps away from the states that are there', () => {
		const editor = createEditor(three());
		editor.addStateNear({ x: 400, y: 200 });
		const s = editor.getState();
		const added = s.doc.states[3]!;
		for (const other of s.doc.states.slice(0, 3)) {
			expect(Math.hypot(added.x - other.x, added.y - other.y)).toBeGreaterThanOrEqual(72);
		}
	});

	it('says why when the document refuses (the limit of states)', () => {
		const states: [number, number][] = Array.from({ length: 2000 }, (_, i) => [
			40 + (i % 40) * 30,
			40 + Math.floor(i / 40) * 18
		]);
		const editor = createEditor(build({ states }));
		editor.addStateAt({ x: 500, y: 500 });
		const s = editor.getState();
		expect(s.doc.states).toHaveLength(2000);
		expect(s.announcement?.key).toBe('document.limit_exceeded');
		expect(s.canUndo).toBe(false);
	});

	it('is one undo step, and undo and redo go back and forth', () => {
		const editor = createEditor(three());
		editor.addStateAt({ x: 300, y: 500 });
		editor.undo();
		expect(editor.getState().doc.states).toHaveLength(3);
		expect(editor.getState().selection).toEqual([]);
		expect(editor.getState().dirty).toBe(false);
		editor.redo();
		expect(editor.getState().doc.states).toHaveLength(4);
	});
});

describe('selection', () => {
	it('select, toggle, selectAll and clear, in sorted order, saying what happened', () => {
		const editor = createEditor(three());
		editor.select([2, 0]);
		expect(editor.getState().selection).toEqual([0, 2]);
		expect(editor.getState().announcement).toMatchObject({
			key: 'editor.selected_many',
			params: { count: 2 }
		});
		editor.toggle(1);
		expect(editor.getState().selection).toEqual([0, 1, 2]);
		editor.toggle(0);
		expect(editor.getState().selection).toEqual([1, 2]);
		editor.selectAll();
		expect(editor.getState().selection).toEqual([0, 1, 2]);
		editor.selectOnly(1);
		expect(editor.getState().announcement).toMatchObject({
			key: 'editor.selected_one',
			params: { name: 'q1' }
		});
		editor.clearSelection();
		expect(editor.getState().selection).toEqual([]);
		expect(editor.getState().announcement?.key).toBe('editor.selection_cleared');
	});

	it('ignores ids that do not exist, and says nothing when nothing changes', () => {
		const editor = createEditor(three());
		editor.select([0]);
		const seq = editor.getState().announcement!.seq;
		editor.select([0]);
		expect(editor.getState().announcement!.seq).toBe(seq);
		editor.select([0, 99]);
		expect(editor.getState().selection).toEqual([0]);
		editor.clearSelection();
		editor.clearSelection();
		expect(editor.getState().announcement?.key).toBe('editor.selection_cleared');
	});

	it('is not in the history', () => {
		const editor = createEditor(three());
		editor.selectAll();
		expect(editor.getState().canUndo).toBe(false);
	});

	it('the rectangle selects the states inside it, and ends with the selection', () => {
		const editor = createEditor(three());
		editor.startMarquee({ x: 100, y: 100 });
		editor.moveMarquee({ x: 480, y: 300 });
		expect(editor.getState().marquee).toEqual({ x: 100, y: 100, width: 380, height: 200 });
		editor.endMarquee();
		expect(editor.getState().marquee).toBeNull();
		expect(editor.getState().selection).toEqual([0, 1]);
	});
});

describe('move by dragging', () => {
	it('selects the state under the pointer when it is not selected, and moves only it', () => {
		const editor = createEditor(three());
		editor.beginDrag(1, { x: 400, y: 200 });
		expect(editor.getState().selection).toEqual([1]);
		editor.dragTo({ x: 430, y: 260 }, false);
		expect(editor.getState().preview?.get(1)).toEqual({ x: 430, y: 260 });
		expect(editor.getState().doc.states[1]).toMatchObject({ x: 400, y: 200 }); // not changed yet
		editor.endDrag();
		expect(places(editor)[1]).toEqual([1, 430, 260]);
		expect(editor.getState().preview).toBeNull();
	});

	it('moves every selected state when the one under the pointer is selected', () => {
		const editor = createEditor(three());
		editor.select([0, 1]);
		editor.beginDrag(0, { x: 200, y: 200 });
		editor.dragTo({ x: 210, y: 220 }, false);
		editor.endDrag();
		expect(places(editor)).toEqual([
			[0, 210, 220],
			[1, 410, 220],
			[2, 600, 200]
		]);
		expect(editor.getState().selection).toEqual([0, 1]);
	});

	it('is one undo step for the whole drag, and undo puts the states back', () => {
		const editor = createEditor(three());
		editor.select([0, 1]);
		editor.beginDrag(0, { x: 200, y: 200 });
		for (let i = 1; i <= 20; i++) editor.dragTo({ x: 200 + i, y: 200 }, false);
		editor.endDrag();
		editor.undo();
		expect(places(editor)).toEqual([
			[0, 200, 200],
			[1, 400, 200],
			[2, 600, 200]
		]);
		expect(editor.getState().canUndo).toBe(false);
	});

	it('leaves no step when the states end where they began', () => {
		const editor = createEditor(three());
		editor.beginDrag(0, { x: 200, y: 200 });
		editor.dragTo({ x: 250, y: 250 }, false);
		editor.dragTo({ x: 200, y: 200 }, false);
		editor.endDrag();
		expect(editor.getState().canUndo).toBe(false);
		expect(editor.getState().dirty).toBe(false);
	});

	it('Shift snaps to a grid of 20', () => {
		const editor = createEditor(three());
		editor.beginDrag(0, { x: 200, y: 200 });
		editor.dragTo({ x: 213, y: 227 }, true);
		editor.endDrag();
		expect(places(editor)[0]).toEqual([0, 220, 220]);
	});

	it('cancel puts nothing in the history and keeps the document', () => {
		const editor = createEditor(three());
		editor.beginDrag(0, { x: 200, y: 200 });
		editor.dragTo({ x: 300, y: 300 }, false);
		editor.cancelDrag();
		expect(editor.getState().preview).toBeNull();
		expect(places(editor)[0]).toEqual([0, 200, 200]);
		expect(editor.getState().canUndo).toBe(false);
	});

	it('Escape during a drag cancels it, and that is all it does', () => {
		const editor = createEditor(three());
		editor.beginDrag(0, { x: 200, y: 200 });
		editor.dragTo({ x: 300, y: 300 }, false);
		editor.escape();
		expect(editor.getState().preview).toBeNull();
		expect(editor.getState().selection).toEqual([0]);
	});

	it('refuses undo, redo, delete and add while a drag is open', () => {
		const editor = createEditor(three());
		editor.addStateAt({ x: 800, y: 800 });
		editor.undo();
		editor.redo();
		editor.beginDrag(0, { x: 200, y: 200 });
		const before = editor.getState().doc;
		editor.undo();
		editor.deleteSelected();
		editor.addStateAt({ x: 900, y: 900 });
		expect(editor.getState().doc).toBe(before);
		editor.cancelDrag();
	});

	it('keeps the states inside the world', () => {
		const editor = createEditor(three());
		editor.beginDrag(0, { x: 200, y: 200 });
		editor.dragTo({ x: -5000, y: 5000 }, false);
		editor.endDrag();
		expect(places(editor)[0]).toEqual([0, 40, 960]);
	});

	it('does nothing for a state that does not exist', () => {
		const editor = createEditor(three());
		editor.beginDrag(99, { x: 0, y: 0 });
		editor.dragTo({ x: 10, y: 10 }, false);
		editor.endDrag();
		expect(editor.getState().canUndo).toBe(false);
	});
});

describe('move with the keyboard', () => {
	it('moves the selected states, and says so', () => {
		const editor = createEditor(three());
		editor.select([1]);
		editor.nudge(10, 0);
		expect(places(editor)[1]).toEqual([1, 410, 200]);
		expect(editor.getState().announcement).toMatchObject({
			key: 'editor.moved',
			params: { name: 'q1', x: 410, y: 200 }
		});
		editor.select([0, 1]);
		editor.nudge(0, 50);
		expect(editor.getState().announcement).toMatchObject({
			key: 'editor.moved_many',
			params: { count: 2 }
		});
	});

	it('a series of nudges is one undo step', () => {
		const editor = createEditor(three());
		editor.select([1]);
		for (let i = 0; i < 5; i++) editor.nudge(10, 0);
		expect(places(editor)[1]).toEqual([1, 450, 200]);
		editor.undo();
		expect(places(editor)[1]).toEqual([1, 400, 200]);
		expect(editor.getState().canUndo).toBe(false);
	});

	it('the series ends when the selection changes, when another action comes, or on seal()', () => {
		const editor = createEditor(three());
		editor.select([1]);
		editor.nudge(10, 0);
		editor.select([0]);
		editor.nudge(10, 0);
		editor.seal();
		editor.nudge(10, 0);
		editor.undo();
		editor.undo();
		editor.undo();
		expect(editor.getState().canUndo).toBe(false);
		expect(places(editor)).toEqual([
			[0, 200, 200],
			[1, 400, 200],
			[2, 600, 200]
		]);
	});

	it('does nothing, and says nothing, when no state is selected or the state is at the edge', () => {
		const editor = createEditor(three());
		editor.nudge(10, 0);
		expect(editor.getState().announcement).toBeNull();
		editor.select([0]);
		editor.nudge(-5000, 0);
		editor.nudge(-10, 0);
		expect(places(editor)[0]).toEqual([0, 40, 200]);
	});
});

describe('delete', () => {
	it('deletes the selected states with their transitions, in one step, and clears the selection', () => {
		const editor = createEditor(three());
		editor.select([1, 2]);
		editor.deleteSelected();
		const s = editor.getState();
		expect(s.doc.states.map((x) => x.id)).toEqual([0]);
		expect(s.doc.transitions).toEqual([]);
		expect(s.selection).toEqual([]);
		expect(s.announcement).toMatchObject({ key: 'editor.deleted_states', params: { count: 2 } });
		editor.undo();
		expect(editor.getState().doc.states).toHaveLength(3);
		expect(editor.getState().doc.transitions).toHaveLength(2);
		expect(editor.getState().canUndo).toBe(false);
	});

	it('names the state when one is deleted, and asks the view to focus the nearest one left', () => {
		const editor = createEditor(three());
		editor.select([1]);
		editor.deleteSelected();
		const s = editor.getState();
		expect(s.announcement).toMatchObject({ key: 'editor.deleted_state', params: { name: 'q1' } });
		expect(s.focus.id).toBe(0); // q0 and q2 are equally near; the lowest id wins
	});

	it('has no state to focus when the last one is deleted', () => {
		const editor = createEditor(build({ states: [[200, 200]] }));
		editor.selectAll();
		editor.deleteSelected();
		expect(editor.getState().focus.id).toBeNull();
		expect(editor.getState().doc.states).toEqual([]);
	});

	it('deleteStates deletes the ones that exist (the Hapus tool)', () => {
		const editor = createEditor(three());
		editor.deleteStates([2, 99]);
		expect(editor.getState().doc.states.map((x) => x.id)).toEqual([0, 1]);
	});

	it('does nothing when nothing is selected', () => {
		const editor = createEditor(three());
		editor.deleteSelected();
		expect(editor.getState().canUndo).toBe(false);
		expect(editor.getState().announcement).toBeNull();
	});

	it('never uses an id again, also after a delete and an undo', () => {
		const editor = createEditor(three());
		editor.selectOnly(2);
		editor.deleteSelected();
		editor.addStateAt({ x: 700, y: 700 });
		expect(editor.getState().doc.states.at(-1)?.id).toBe(3);
	});
});

describe('undo and redo', () => {
	it('say so, keep the tool, and drop selected ids that are gone', () => {
		const editor = createEditor(three());
		editor.setTool('addState');
		editor.addStateAt({ x: 700, y: 700 });
		editor.undo();
		expect(editor.getState().announcement?.key).toBe('editor.undone');
		expect(editor.getState().tool).toBe('addState');
		expect(editor.getState().selection).toEqual([]);
		editor.redo();
		expect(editor.getState().announcement?.key).toBe('editor.redone');
	});

	it('do nothing, and say nothing, when there is nothing to undo or redo', () => {
		const editor = createEditor(three());
		editor.undo();
		editor.redo();
		expect(editor.getState().announcement).toBeNull();
	});

	it('undoing everything gives back the first document', () => {
		const first = three();
		const editor = createEditor(first);
		editor.addStateAt({ x: 700, y: 700 });
		editor.selectOnly(0);
		editor.nudge(10, 10);
		editor.deleteStates([1]);
		while (editor.getState().canUndo) editor.undo();
		expect(editor.getState().doc).toBe(first);
		expect(editor.getState().dirty).toBe(false);
	});
});

describe('Escape', () => {
	it('clears the selection first, and then goes back to Pilih', () => {
		const editor = createEditor(three());
		editor.setTool('addState');
		editor.select([0]);
		editor.escape();
		expect(editor.getState().selection).toEqual([]);
		expect(editor.getState().tool).toBe('addState');
		editor.escape();
		expect(editor.getState().tool).toBe('select');
	});

	it('cancels a rectangle that is being drawn', () => {
		const editor = createEditor(three());
		editor.startMarquee({ x: 0, y: 0 });
		editor.moveMarquee({ x: 500, y: 500 });
		editor.escape();
		expect(editor.getState().marquee).toBeNull();
		expect(editor.getState().selection).toEqual([]);
	});
});

describe('focus', () => {
	it('focusState moves the focus, and the selection with it unless asked to keep it', () => {
		const editor = createEditor(three());
		editor.select([0]);
		editor.focusState(1, { keepSelection: true });
		expect(editor.getState().selection).toEqual([0]);
		expect(editor.getState().focus.id).toBe(1);
		editor.focusState(2, { keepSelection: false });
		expect(editor.getState().selection).toEqual([2]);
	});

	it('noteFocus records where the browser put the focus, without asking the view to move it', () => {
		const editor = createEditor(three());
		const before = editor.getState().focus.request;
		editor.noteFocus(1);
		expect(editor.getState().focus).toMatchObject({ id: 1, request: before });
	});
});
