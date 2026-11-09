// What the PDA table view needs from the editor. In its own file so that the editor can name the
// type of the lazily loaded component without importing the component, as `table-props.ts` does
// for the FSM (docs/agent/PLAN.md, Task T-061).
import type { MessageKey } from '#lib/i18n/id.ts';
import type { Params } from '#lib/i18n/translate.ts';
import type { Refusal } from './interaction/editor.ts';
import type { PdaCommand } from './pda-commands.ts';
import type { PdaDocument } from './pda-document.ts';

/** Runs a command as one undo step. Returns why the document refused it, or null. */
export type PdaTableApply = (
	command: PdaCommand,
	note?: { say?: { key: MessageKey; params?: Params }; toast?: boolean }
) => Refusal | null;

export interface PdaTableProps {
	doc: PdaDocument;
	/** The rows (zero-based indices of `doc.transitions`) that the diagram marked with `+ n lagi`. */
	marked: ReadonlySet<number>;
	onapply: PdaTableApply;
}
