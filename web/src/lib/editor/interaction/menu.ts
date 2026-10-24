// What the context menu offers (docs/ux/editor-interactions.md, "Phone dock and menu"), with no DOM,
// so that it can be tested. The menu acts on the selection; the view selects the pressed state
// before it asks for the items.
import type { MachineDocument } from '../document.ts';
import type { Selection } from './selection.ts';

export type MenuTarget = { kind: 'state'; id: number } | { kind: 'canvas' };

export type MenuAction = 'rename' | 'start' | 'accepting' | 'delete' | 'add';

export interface MenuItem {
	action: MenuAction;
	/** For a switch (start, accepting): whether it is on. */
	checked?: boolean;
}

export function menuItems(
	target: MenuTarget,
	doc: MachineDocument,
	selection: Selection
): MenuItem[] {
	if (target.kind === 'canvas') return [{ action: 'add' }];
	const items: MenuItem[] = [];
	if (selection.length === 1) {
		items.push({ action: 'rename' }, { action: 'start', checked: doc.start === selection[0] });
	}
	const accepting = selection.length > 0 && selection.every((id) => doc.accepting.includes(id));
	items.push({ action: 'accepting', checked: accepting }, { action: 'delete' });
	return items;
}
