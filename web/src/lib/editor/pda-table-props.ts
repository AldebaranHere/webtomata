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

/** The five columns of a row of the transitions. */
export type PdaTableField = 'from' | 'read' | 'pop' | 'push' | 'to';

/**
 * A request to move the focus to the first control of a row, from "Tunjukkan" of the determinism
 * badge. `request` grows with each ask, so that the same row can be asked for twice (T-062).
 */
export interface PdaRowFocus {
	/** The index of the row in `doc.transitions`. */
	readonly index: number;
	readonly field?: PdaTableField;
	readonly request: number;
}

export interface PdaTableProps {
	doc: PdaDocument;
	/** The rows (zero-based indices of `doc.transitions`) that the diagram marked with `+ n lagi`. */
	marked: ReadonlySet<number>;
	onapply: PdaTableApply;
	/** The row that the badge asked to focus, or nothing. */
	rowFocus?: PdaRowFocus | null;
}
