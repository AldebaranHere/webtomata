// The tools of the editor: the one list that the rail (the column on a laptop, the bar on a phone)
// and the one-minute tour both read, so that the tour can never show a name, an icon or a key that
// the real button does not have.
import type { MessageKey } from '#lib/i18n/id.ts';
import type { Tool } from './interaction/editor.ts';

export interface ToolEntry {
	tool: Tool;
	label: MessageKey;
	icon: 'select' | 'state' | 'transition' | 'delete';
	/** The key that chooses the tool. */
	keys: string;
}

export const TOOLS: readonly ToolEntry[] = [
	{ tool: 'select', label: 'editor.tool.select', icon: 'select', keys: 'V' },
	{ tool: 'addState', label: 'editor.tool.add_state', icon: 'state', keys: 'S' },
	{ tool: 'transition', label: 'editor.tool.transition', icon: 'transition', keys: 'T' },
	{ tool: 'delete', label: 'editor.tool.delete', icon: 'delete', keys: 'Delete' }
];
