// What the table view needs from the editor. In its own file so that the editor can name the type
// of the lazily loaded component without importing the component (which would load it at once).
import type { MessageKey } from '#lib/i18n/id.ts';
import type { Params } from '#lib/i18n/translate.ts';
import type { Command } from './commands.ts';
import type { MachineDocument } from './document.ts';

export interface TableViewProps {
	doc: MachineDocument;
	/** The ids of the states that are selected on the diagram. */
	selection: readonly number[];
	/** Runs a command as one undo step. Returns why the document refused it, or null. */
	onapply: (
		command: Command,
		note?: { say?: { key: MessageKey; params?: Params }; toast?: boolean }
	) => { key: MessageKey; params: Params } | null;
	onselect: (id: number) => void;
}
