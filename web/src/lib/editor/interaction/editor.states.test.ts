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
		accepting: [2]
	});

describe('accepting', () => {
	it('toggles the one selected state, as one undo step, and says so', () => {
		const editor = createEditor(three());
		editor.selectOnly(1);
		editor.toggleAccepting();
		expect(editor.getState().doc.accepting).toEqual([1, 2]);
		expect(editor.getState().announcement).toMatchObject({
			key: 'editor.accepting_on',
			params: { name: 'q1' }
		});
		editor.toggleAccepting();
		expect(editor.getState().doc.accepting).toEqual([2]);
		expect(editor.getState().announcement).toMatchObject({ key: 'editor.accepting_off' });
		editor.undo();
		editor.undo();
		expect(editor.getState().doc.accepting).toEqual([2]);
		expect(editor.getState().canUndo).toBe(false);
	});

	it('with several selected: all become accepting, unless all already are', () => {
		const editor = createEditor(three());
		editor.select([0, 2]);
		editor.toggleAccepting();
		expect(editor.getState().doc.accepting).toEqual([0, 2]);
		expect(editor.getState().announcement).toMatchObject({
			key: 'editor.accepting_changed',
			params: { count: 2 }
		});
		editor.toggleAccepting();
		expect(editor.getState().doc.accepting).toEqual([]);
		editor.undo();
		expect(editor.getState().doc.accepting).toEqual([0, 2]);
		editor.undo();
		expect(editor.getState().doc.accepting).toEqual([2]);
	});

	it('does nothing with an empty selection', () => {
		const editor = createEditor(three());
		editor.toggleAccepting();
		expect(editor.getState().canUndo).toBe(false);
	});
});

describe('start', () => {
	it('makes the selected state the start, and clears it when it is the start', () => {
		const editor = createEditor(three());
		editor.selectOnly(1);
		editor.toggleStart();
		expect(editor.getState().doc.start).toBe(1);
		expect(editor.getState().announcement).toMatchObject({
			key: 'editor.start_set',
			params: { name: 'q1' }
		});
		editor.toggleStart();
		expect(editor.getState().doc.start).toBeNull();
		expect(editor.getState().announcement).toMatchObject({ key: 'editor.start_cleared' });
		editor.undo();
		expect(editor.getState().doc.start).toBe(1);
	});

	it('needs exactly one selected state', () => {
		const editor = createEditor(three());
		editor.toggleStart();
		expect(editor.getState().announcement).toMatchObject({ key: 'editor.need_one_state' });
		editor.select([0, 1]);
		editor.toggleStart();
		expect(editor.getState().announcement).toMatchObject({ key: 'editor.need_one_state' });
		expect(editor.getState().doc.start).toBe(0);
		expect(editor.getState().canUndo).toBe(false);
	});
});

describe('rename', () => {
	it('opens for the one selected state, and not for none or several', () => {
		const editor = createEditor(three());
		editor.startRename();
		expect(editor.getState().renaming).toBeNull();
		editor.select([0, 1]);
		editor.startRename();
		expect(editor.getState().renaming).toBeNull();
		editor.selectOnly(1);
		editor.startRename();
		expect(editor.getState().renaming).toBe(1);
	});

	it('a valid name changes the state, closes the field and gives the focus back', () => {
		const editor = createEditor(three());
		editor.selectOnly(1);
		editor.startRename();
		const before = editor.getState().focus.request;
		expect(editor.commitRename('Genap')).toBeNull();
		const s = editor.getState();
		expect(s.doc.states[1]!.name).toBe('Genap');
		expect(s.renaming).toBeNull();
		expect(s.focus).toMatchObject({ id: 1 });
		expect(s.focus.request).toBeGreaterThan(before);
		expect(s.announcement).toMatchObject({ key: 'editor.renamed', params: { name: 'Genap' } });
		editor.undo();
		expect(editor.getState().doc.states[1]!.name).toBe('q1');
	});

	it('the same name closes the field and changes nothing', () => {
		const editor = createEditor(three());
		editor.selectOnly(1);
		editor.startRename();
		expect(editor.commitRename('q1')).toBeNull();
		expect(editor.getState().renaming).toBeNull();
		expect(editor.getState().canUndo).toBe(false);
	});

	it('a refused name keeps the field open, returns the message and announces it', () => {
		const editor = createEditor(three());
		editor.selectOnly(1);
		editor.startRename();
		const duplicate = editor.commitRename('q2');
		expect(duplicate).toMatchObject({ key: 'document.duplicate_name', params: { name: 'q2' } });
		expect(editor.getState().renaming).toBe(1);
		expect(editor.getState().announcement).toMatchObject({ key: 'document.duplicate_name' });
		expect(editor.commitRename('')).toMatchObject({ key: 'document.invalid_name' });
		expect(editor.commitRename(' x')).toMatchObject({ key: 'document.invalid_name' });
		expect(editor.getState().doc.states[1]!.name).toBe('q1');
		expect(editor.getState().canUndo).toBe(false);
	});

	it('Esc and cancel close the field and keep the name', () => {
		const editor = createEditor(three());
		editor.selectOnly(1);
		editor.startRename();
		editor.cancelRename();
		expect(editor.getState().renaming).toBeNull();
		expect(editor.getState().focus).toMatchObject({ id: 1 });
		editor.startRename();
		editor.escape();
		expect(editor.getState().renaming).toBeNull();
		expect(editor.getState().selection).toEqual([1]);
	});

	it('closes when its state is gone (undo of the add)', () => {
		const editor = createEditor(three());
		editor.addStateAt({ x: 300, y: 500 });
		editor.startRename();
		expect(editor.getState().renaming).toBe(3);
		editor.undo();
		expect(editor.getState().renaming).toBeNull();
	});

	it('stops the other editing while the field is open', () => {
		const editor = createEditor(three());
		editor.selectOnly(1);
		editor.startRename();
		editor.deleteSelected();
		editor.toggleAccepting();
		editor.addStateNear({ x: 900, y: 800 });
		expect(editor.getState().doc.states).toHaveLength(3);
		expect(editor.getState().canUndo).toBe(false);
	});
});

describe('the delete toast', () => {
	it('is set by a delete, names what was deleted, and goes with dismiss or undo', () => {
		const editor = createEditor(three());
		expect(editor.getState().toast).toBeNull();
		editor.deleteStates([1]);
		expect(editor.getState().toast).toMatchObject({
			key: 'editor.deleted_state',
			params: { name: 'q1' }
		});
		editor.dismissToast();
		expect(editor.getState().toast).toBeNull();
		editor.undo();
		editor.deleteStates([0, 1]);
		expect(editor.getState().toast).toMatchObject({
			key: 'editor.deleted_states',
			params: { count: 2 }
		});
		editor.undo();
		expect(editor.getState().toast).toBeNull();
		expect(editor.getState().doc.states).toHaveLength(3);
	});

	it('goes when the user does something else to the document', () => {
		const editor = createEditor(three());
		editor.deleteStates([1]);
		editor.addStateAt({ x: 300, y: 500 });
		expect(editor.getState().toast).toBeNull();
	});
});
