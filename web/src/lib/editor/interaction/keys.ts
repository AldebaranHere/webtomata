// What a key does in the editor (docs/ux/editor-interactions.md, "Keys"). A table, with no DOM, so
// that every key can be tested. The canvas turns a keyboard event into a `KeyInput`, calls
// `keyAction`, and does what the action says.
import type { Direction } from './selection.ts';

export interface KeyInput {
	key: string;
	ctrl: boolean;
	meta: boolean;
	shift: boolean;
	alt: boolean;
}

export interface KeyContext {
	/** A text field is open (a name, the symbols of an edge): the keys belong to the field. */
	fieldOpen: boolean;
}

export type Action =
	| { type: 'tool'; tool: 'select' | 'addState' }
	| { type: 'newState' }
	| { type: 'delete' }
	| { type: 'selectAll' }
	| { type: 'escape' }
	| { type: 'undo' }
	| { type: 'redo' }
	| { type: 'nudge'; dx: number; dy: number }
	| { type: 'focus'; direction: Direction; keepSelection: boolean }
	| { type: 'toggleSelection' };

const ARROWS: Record<string, Direction> = {
	ArrowLeft: 'left',
	ArrowRight: 'right',
	ArrowUp: 'up',
	ArrowDown: 'down'
};
const STEP = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] } as const;

export function keyAction(input: KeyInput, context: KeyContext): Action | undefined {
	if (context.fieldOpen) return undefined;
	const { key, shift, alt } = input;
	const mod = input.ctrl || input.meta;
	const letter = key.length === 1 ? key.toLowerCase() : key;

	if (mod && !alt) {
		if (letter === 'z') return { type: shift ? 'redo' : 'undo' };
		if (letter === 'y' && input.ctrl) return { type: 'redo' };
		if (letter === 'a') return { type: 'selectAll' };
	}

	const direction = ARROWS[key];
	if (direction !== undefined) {
		if (alt && !mod) {
			const [x, y] = STEP[direction];
			const amount = shift ? 50 : 10;
			return { type: 'nudge', dx: x * amount, dy: y * amount };
		}
		if (mod && !alt && !shift) return { type: 'focus', direction, keepSelection: true };
		if (!mod && !alt && !shift) return { type: 'focus', direction, keepSelection: false };
		return undefined;
	}

	// The keys below are plain: with Ctrl, Cmd or Alt they belong to the browser.
	if (mod || alt) return undefined;
	switch (letter) {
		case 'v':
			return { type: 'tool', tool: 'select' };
		case 's':
			return { type: 'tool', tool: 'addState' };
		case 'n':
			return { type: 'newState' };
		case 'Delete':
		case 'Backspace':
			return { type: 'delete' };
		case 'Escape':
			return { type: 'escape' };
		case ' ':
			return { type: 'toggleSelection' };
		default:
			return undefined;
	}
}
