import { describe, expect, it } from 'vitest';
import { keyAction } from './keys.ts';
import type { KeyInput } from './keys.ts';

const key = (k: string, mods: Partial<KeyInput> = {}): KeyInput => ({
	key: k,
	ctrl: false,
	meta: false,
	shift: false,
	alt: false,
	...mods
});

const ctx = { fieldOpen: false };

describe('the tools', () => {
	it('V is Pilih and S is Tambah state, in either case', () => {
		expect(keyAction(key('v'), ctx)).toEqual({ type: 'tool', tool: 'select' });
		expect(keyAction(key('V', { shift: true }), ctx)).toEqual({ type: 'tool', tool: 'select' });
		expect(keyAction(key('s'), ctx)).toEqual({ type: 'tool', tool: 'addState' });
	});

	it('T is the Transisi tool', () => {
		expect(keyAction(key('t'), ctx)).toEqual({ type: 'tool', tool: 'transition' });
		expect(keyAction(key('t', { ctrl: true }), ctx)).toBeUndefined();
		expect(keyAction(key('t'), { fieldOpen: true })).toBeUndefined();
	});

	it('N adds a state at the center of the view', () => {
		expect(keyAction(key('n'), ctx)).toEqual({ type: 'newState' });
	});
});

describe('delete, select all and escape', () => {
	it('Delete and Backspace delete the selection', () => {
		expect(keyAction(key('Delete'), ctx)).toEqual({ type: 'delete' });
		expect(keyAction(key('Backspace'), ctx)).toEqual({ type: 'delete' });
	});

	it('Ctrl+A and Cmd+A select all', () => {
		expect(keyAction(key('a', { ctrl: true }), ctx)).toEqual({ type: 'selectAll' });
		expect(keyAction(key('a', { meta: true }), ctx)).toEqual({ type: 'selectAll' });
	});

	it('Escape is the escape action', () => {
		expect(keyAction(key('Escape'), ctx)).toEqual({ type: 'escape' });
	});
});

describe('accepting, start and rename', () => {
	it('A toggles accepting and M makes the start, in either case', () => {
		expect(keyAction(key('a'), ctx)).toEqual({ type: 'toggleAccepting' });
		expect(keyAction(key('A', { shift: true }), ctx)).toEqual({ type: 'toggleAccepting' });
		expect(keyAction(key('m'), ctx)).toEqual({ type: 'toggleStart' });
	});

	it('Enter and F2 rename', () => {
		expect(keyAction(key('Enter'), ctx)).toEqual({ type: 'rename' });
		expect(keyAction(key('F2'), ctx)).toEqual({ type: 'rename' });
	});

	it('with Ctrl, Cmd or Alt they are not ours, and Ctrl+A is still select all', () => {
		expect(keyAction(key('a', { ctrl: true }), ctx)).toEqual({ type: 'selectAll' });
		expect(keyAction(key('m', { ctrl: true }), ctx)).toBeUndefined();
		expect(keyAction(key('Enter', { alt: true }), ctx)).toBeUndefined();
	});

	it('none of them works while a field is open', () => {
		const open = { fieldOpen: true };
		for (const k of ['a', 'm', 'Enter', 'F2']) expect(keyAction(key(k), open)).toBeUndefined();
	});
});

describe('pan and zoom', () => {
	it('Shift+Arrow pans the view by 100: the content moves the other way', () => {
		expect(keyAction(key('ArrowRight', { shift: true }), ctx)).toEqual({
			type: 'pan',
			dx: -100,
			dy: 0
		});
		expect(keyAction(key('ArrowLeft', { shift: true }), ctx)).toEqual({
			type: 'pan',
			dx: 100,
			dy: 0
		});
		expect(keyAction(key('ArrowDown', { shift: true }), ctx)).toEqual({
			type: 'pan',
			dx: 0,
			dy: -100
		});
		expect(keyAction(key('ArrowUp', { shift: true }), ctx)).toEqual({
			type: 'pan',
			dx: 0,
			dy: 100
		});
	});

	it('+ and = zoom in, - and _ zoom out, 0 is 100%, 1 fits the machine', () => {
		expect(keyAction(key('+', { shift: true }), ctx)).toEqual({ type: 'zoom', mode: 'in' });
		expect(keyAction(key('='), ctx)).toEqual({ type: 'zoom', mode: 'in' });
		expect(keyAction(key('-'), ctx)).toEqual({ type: 'zoom', mode: 'out' });
		expect(keyAction(key('_', { shift: true }), ctx)).toEqual({ type: 'zoom', mode: 'out' });
		expect(keyAction(key('0'), ctx)).toEqual({ type: 'zoom', mode: 'reset' });
		expect(keyAction(key('1'), ctx)).toEqual({ type: 'zoom', mode: 'fit' });
	});

	it('with Ctrl, Cmd or Alt the zoom keys belong to the browser', () => {
		expect(keyAction(key('+', { ctrl: true }), ctx)).toBeUndefined();
		expect(keyAction(key('0', { meta: true }), ctx)).toBeUndefined();
		expect(keyAction(key('-', { alt: true }), ctx)).toBeUndefined();
	});

	it('none of them works while a field is open', () => {
		for (const k of ['+', '-', '0', '1'])
			expect(keyAction(key(k), { fieldOpen: true }), k).toBeUndefined();
		expect(keyAction(key('ArrowLeft', { shift: true }), { fieldOpen: true })).toBeUndefined();
	});
});

describe('undo and redo', () => {
	it('Ctrl or Cmd+Z undoes; Ctrl+Y and Ctrl or Cmd+Shift+Z redo', () => {
		expect(keyAction(key('z', { ctrl: true }), ctx)).toEqual({ type: 'undo' });
		expect(keyAction(key('z', { meta: true }), ctx)).toEqual({ type: 'undo' });
		expect(keyAction(key('y', { ctrl: true }), ctx)).toEqual({ type: 'redo' });
		expect(keyAction(key('Z', { ctrl: true, shift: true }), ctx)).toEqual({ type: 'redo' });
		expect(keyAction(key('z', { meta: true, shift: true }), ctx)).toEqual({ type: 'redo' });
	});
});

describe('the arrows', () => {
	it('an arrow moves the focus and the selection to the nearest state', () => {
		expect(keyAction(key('ArrowLeft'), ctx)).toEqual({
			type: 'focus',
			direction: 'left',
			keepSelection: false
		});
		expect(keyAction(key('ArrowDown'), ctx)).toEqual({
			type: 'focus',
			direction: 'down',
			keepSelection: false
		});
	});

	it('Ctrl+Arrow moves only the focus, so that Space can build a selection', () => {
		expect(keyAction(key('ArrowUp', { ctrl: true }), ctx)).toEqual({
			type: 'focus',
			direction: 'up',
			keepSelection: true
		});
	});

	it('Alt+Arrow moves the selected states by 10, and Alt+Shift+Arrow by 50', () => {
		expect(keyAction(key('ArrowRight', { alt: true }), ctx)).toEqual({
			type: 'nudge',
			dx: 10,
			dy: 0
		});
		expect(keyAction(key('ArrowUp', { alt: true }), ctx)).toEqual({
			type: 'nudge',
			dx: 0,
			dy: -10
		});
		expect(keyAction(key('ArrowDown', { alt: true, shift: true }), ctx)).toEqual({
			type: 'nudge',
			dx: 0,
			dy: 50
		});
		expect(keyAction(key('ArrowLeft', { alt: true, shift: true }), ctx)).toEqual({
			type: 'nudge',
			dx: -50,
			dy: 0
		});
	});
});

describe('Space', () => {
	it('toggles the focused state in the selection', () => {
		expect(keyAction(key(' '), ctx)).toEqual({ type: 'toggleSelection' });
	});
});

describe('keys that must not be taken', () => {
	it('does nothing while a text field is open, so that typing a symbol never changes the tool', () => {
		const open = { fieldOpen: true };
		for (const k of ['v', 's', 'n', 'Delete', 'Backspace', 'ArrowLeft', ' ', 'Escape']) {
			expect(keyAction(key(k), open), k).toBeUndefined();
		}
		expect(keyAction(key('z', { ctrl: true }), open)).toBeUndefined();
		expect(keyAction(key('a', { ctrl: true }), open)).toBeUndefined();
	});

	it('does not take a letter with Ctrl, Cmd or Alt (those are the shortcuts of the browser)', () => {
		expect(keyAction(key('s', { ctrl: true }), ctx)).toBeUndefined();
		expect(keyAction(key('n', { meta: true }), ctx)).toBeUndefined();
		expect(keyAction(key('v', { alt: true }), ctx)).toBeUndefined();
	});

	it('ignores every other key', () => {
		for (const k of ['q', 'Tab', '2', 'Shift']) {
			expect(keyAction(key(k), ctx), k).toBeUndefined();
		}
	});
});
