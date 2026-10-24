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
		transitions: [[0, 'a', 1]]
	});

describe('choosing the ends of a transition', () => {
	it('the source is selected, the editor asks for a target, and the tool does not change', () => {
		const editor = createEditor(three());
		editor.setTool('transition');
		editor.startLink(1);
		const s = editor.getState();
		expect(s.link).toEqual({ from: 1, pointer: null });
		expect(s.selection).toEqual([1]);
		expect(s.tool).toBe('transition');
		expect(s.announcement).toMatchObject({ key: 'editor.hint_pick_target' });
		expect(s.canUndo).toBe(false);
	});

	it('the preview follows the pointer, and only while a source is chosen', () => {
		const editor = createEditor(three());
		editor.moveLink({ x: 5, y: 5 });
		expect(editor.getState().link).toBeNull();
		editor.startLink(0);
		editor.moveLink({ x: 300, y: 250 });
		expect(editor.getState().link).toEqual({ from: 0, pointer: { x: 300, y: 250 } });
	});

	it('a target opens the label box for that edge, and the choice is over', () => {
		const editor = createEditor(three());
		editor.startLink(1);
		editor.finishLink(2);
		const s = editor.getState();
		expect(s.link).toBeNull();
		expect(s.labeling).toEqual({ from: 1, to: 2, ask: null });
		expect(s.canUndo).toBe(false);
	});

	it('the target can be the source: a self-loop', () => {
		const editor = createEditor(three());
		editor.startLink(1);
		editor.finishLink(1);
		expect(editor.getState().labeling).toEqual({ from: 1, to: 1, ask: null });
	});

	it('no target (a release on empty canvas) cancels, and nothing is made', () => {
		const editor = createEditor(three());
		editor.startLink(1);
		editor.finishLink(null);
		expect(editor.getState().link).toBeNull();
		expect(editor.getState().labeling).toBeNull();
		expect(editor.getState().doc.states).toHaveLength(3);
	});

	it('a state that does not exist cannot be a source or a target', () => {
		const editor = createEditor(three());
		editor.startLink(99);
		expect(editor.getState().link).toBeNull();
		editor.startLink(0);
		editor.finishLink(99);
		expect(editor.getState().labeling).toBeNull();
	});

	it('Esc, another tool, undo, a new state and a delete all cancel the choice', () => {
		const cases: Array<(e: ReturnType<typeof createEditor>) => void> = [
			(e) => e.escape(),
			(e) => e.setTool('select'),
			(e) => e.addStateAt({ x: 300, y: 500 }),
			(e) => e.deleteStates([2])
		];
		for (const act of cases) {
			const editor = createEditor(three());
			editor.startLink(0);
			act(editor);
			expect(editor.getState().link).toBeNull();
		}
		const editor = createEditor(three());
		editor.addStateAt({ x: 300, y: 500 });
		editor.startLink(0);
		editor.undo();
		expect(editor.getState().link).toBeNull();
	});

	it('the choice goes when its source is deleted', () => {
		const editor = createEditor(three());
		editor.startLink(2);
		editor.deleteStates([2]);
		expect(editor.getState().link).toBeNull();
	});

	it('the focus moves to a target without taking the selection from the source', () => {
		const editor = createEditor(three());
		editor.startLink(0);
		editor.focusState(2, { keepSelection: false });
		expect(editor.getState().selection).toEqual([0]);
		expect(editor.getState().focus.id).toBe(2);
		editor.linkAtFocus();
		expect(editor.getState().labeling).toEqual({ from: 0, to: 2, ask: null });
	});

	it('the key starts a choice from the one selected state, and does nothing for none or several', () => {
		const editor = createEditor(three());
		editor.linkAtFocus();
		expect(editor.getState().link).toBeNull();
		editor.select([0, 1]);
		editor.linkAtFocus();
		expect(editor.getState().link).toBeNull();
		editor.selectOnly(1);
		editor.linkAtFocus();
		expect(editor.getState().link).toMatchObject({ from: 1 });
	});
});

describe('the symbols of a new edge', () => {
	const open = (from: number, to: number) => {
		const editor = createEditor(three());
		editor.startLink(from);
		editor.finishLink(to);
		return editor;
	};

	it('adds the transition as one undo step, closes the box and says so', () => {
		const editor = open(1, 2);
		expect(editor.commitLabel('b')).toBeNull();
		const s = editor.getState();
		expect(labelOf(s.doc, 1, 2)).toBe('b');
		expect(s.labeling).toBeNull();
		expect(s.focus).toMatchObject({ id: 1 });
		expect(s.announcement).toMatchObject({
			key: 'editor.edge_changed',
			params: { from: 'q1', to: 'q2', symbols: 'b' }
		});
		editor.undo();
		expect(editor.getState().doc.transitions).toHaveLength(1);
		expect(editor.getState().canUndo).toBe(false);
	});

	it('a new symbol goes into the alphabet in the same step', () => {
		const editor = open(2, 2);
		expect(editor.commitLabel('c, eps')).toBeNull();
		expect(editor.getState().doc.alphabet).toEqual(['a', 'b', 'c']);
		expect(labelOf(editor.getState().doc, 2, 2)).toBe('c, ε');
		editor.undo();
		expect(editor.getState().doc.alphabet).toEqual(['a', 'b']);
		expect(editor.getState().canUndo).toBe(false);
	});

	it('an empty text on a new edge cancels: no step, no message about it', () => {
		const editor = open(1, 2);
		expect(editor.commitLabel('  ')).toBeNull();
		expect(editor.getState().labeling).toBeNull();
		expect(editor.getState().canUndo).toBe(false);
	});

	it('a refused symbol keeps the box open, changes nothing and returns the message', () => {
		const editor = open(1, 2);
		const problem = editor.commitLabel('x'.repeat(40), 'whole');
		expect(problem).toMatchObject({ key: 'document.invalid_symbol' });
		expect(editor.getState().labeling).toMatchObject({ from: 1, to: 2 });
		expect(editor.getState().announcement).toMatchObject({ key: 'document.invalid_symbol' });
		expect(editor.getState().canUndo).toBe(false);
		expect(editor.commitLabel('a')).toBeNull();
	});

	it('a long part asks first, and the answer decides', () => {
		const editor = open(1, 2);
		expect(editor.commitLabel('ab')).toEqual({ ask: 'ab' });
		expect(editor.getState().labeling).toEqual({ from: 1, to: 2, ask: 'ab' });
		expect(editor.getState().canUndo).toBe(false);
		expect(editor.commitLabel('ab', 'split')).toBeNull();
		expect(labelOf(editor.getState().doc, 1, 2)).toBe('a, b');

		const whole = open(1, 2);
		expect(whole.commitLabel('ab')).toEqual({ ask: 'ab' });
		expect(whole.commitLabel('ab', 'whole')).toBeNull();
		expect(whole.getState().doc.alphabet).toEqual(['a', 'b', 'ab']);
		expect(labelOf(whole.getState().doc, 1, 2)).toBe('ab');
	});

	it('Esc closes the box first, and then nothing is left to cancel', () => {
		const editor = open(1, 2);
		editor.escape();
		expect(editor.getState().labeling).toBeNull();
		expect(editor.getState().focus).toMatchObject({ id: 1 });
		expect(editor.getState().selection).toEqual([1]);
	});

	it('stops other editing while the box is open, and closes with its states', () => {
		const editor = open(1, 2);
		editor.deleteSelected();
		editor.toggleAccepting();
		editor.addStateNear({ x: 900, y: 800 });
		expect(editor.getState().doc.states).toHaveLength(3);

		const added = createEditor(three());
		added.addStateAt({ x: 300, y: 500 });
		added.startLink(3);
		added.finishLink(3);
		added.undo();
		expect(added.getState().labeling).toBeNull();
	});
});

describe('an edge that exists', () => {
	it('opens its box again, and an empty text removes the edge as one step', () => {
		const editor = createEditor(three());
		editor.startLink(0);
		editor.finishLink(1);
		expect(editor.getState().labeling).toEqual({ from: 0, to: 1, ask: null });
		expect(editor.commitLabel('')).toBeNull();
		expect(labelOf(editor.getState().doc, 0, 1)).toBe('');
		expect(editor.getState().announcement).toMatchObject({
			key: 'editor.edge_removed',
			params: { from: 'q0', to: 'q1' }
		});
		editor.undo();
		expect(labelOf(editor.getState().doc, 0, 1)).toBe('a');
	});

	it('the same text changes nothing', () => {
		const editor = createEditor(three());
		editor.startLink(0);
		editor.finishLink(1);
		expect(editor.commitLabel('a')).toBeNull();
		expect(editor.getState().canUndo).toBe(false);
	});
});
