import { describe, expect, it } from 'vitest';
import { build } from '../diagram/testing.ts';
import { createEditor } from './editor.ts';

const two = () =>
	build({
		alphabet: ['a', 'b'],
		states: [
			[200, 200, 'q0'],
			[400, 200, 'q1']
		],
		start: 0,
		transitions: [
			[0, 'a', 1],
			[1, 'b', 0]
		]
	});

const list = (editor: ReturnType<typeof createEditor>) =>
	editor.getState().doc.transitions.map((t) => `${t.from}${t.on}${t.to}`);

// `apply` is how the table and the definition view change the machine: any command of the
// document, as one step of the one history, with the words that say what happened.
describe('apply', () => {
	it('runs a command as one undo step, and says what happened', () => {
		const editor = createEditor(two());
		const refused = editor.apply(
			{ type: 'setKind', kind: 'ndfsm' },
			{ say: { key: 'editor.kind_set', params: { kind: 'NDFSM' } } }
		);
		expect(refused).toBeNull();
		expect(editor.getState().doc.kind).toBe('ndfsm');
		expect(editor.getState().announcement).toMatchObject({
			key: 'editor.kind_set',
			params: { kind: 'NDFSM' }
		});
		expect(editor.getState().canUndo).toBe(true);
		editor.undo();
		expect(editor.getState().doc.kind).toBe('dfsm');
		expect(editor.getState().canUndo).toBe(false);
	});

	it('a batch is still one step', () => {
		const editor = createEditor(two());
		editor.apply({
			type: 'batch',
			commands: [
				{ type: 'removeTransition', from: 0, on: 'a', to: 1 },
				{ type: 'addTransition', from: 0, on: 'b', to: 1 }
			]
		});
		expect(list(editor)).toEqual(['0b1', '1b0']);
		editor.undo();
		expect(list(editor)).toEqual(['0a1', '1b0']);
		expect(editor.getState().canUndo).toBe(false);
	});

	it('a command that the document refuses changes nothing, and says why', () => {
		const editor = createEditor(two());
		const before = editor.getState().doc;
		const refused = editor.apply({ type: 'removeSymbol', symbol: 'zzz' });
		expect(refused).not.toBeNull();
		expect(editor.getState().doc).toBe(before);
		expect(editor.getState().canUndo).toBe(false);
	});

	it('a command that changes nothing is not a step of the history', () => {
		const editor = createEditor(two());
		editor.apply({ type: 'setKind', kind: 'dfsm' });
		expect(editor.getState().canUndo).toBe(false);
	});

	it('can leave a message with Urungkan (a toast), which goes with the next change', () => {
		const editor = createEditor(two());
		editor.apply(
			{ type: 'removeSymbol', symbol: 'a' },
			{ say: { key: 'editor.deleted_state', params: { name: 'a' } }, toast: true }
		);
		expect(editor.getState().toast).toMatchObject({ key: 'editor.deleted_state' });
		editor.apply({ type: 'setTitle', title: 'T' });
		expect(editor.getState().toast).toBeNull();
	});

	it('keeps the selection of the states that are still there', () => {
		const editor = createEditor(two());
		editor.select([0, 1]);
		editor.apply({ type: 'removeState', id: 1 });
		expect(editor.getState().selection).toEqual([0]);
	});

	it('seals the history first: a move that follows a keyboard move is a step of its own', () => {
		const editor = createEditor(two());
		editor.selectOnly(0);
		editor.nudge(10, 0);
		editor.apply({ type: 'moveState', id: 0, x: 300, y: 200 });
		expect(editor.getState().doc.states[0]!.x).toBe(300);
		editor.undo();
		// Only the command of apply is undone: the keyboard move is a step before it.
		expect(editor.getState().doc.states[0]!.x).toBe(210);
		expect(editor.getState().canUndo).toBe(true);
	});
});
