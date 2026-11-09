// Undo and redo for a PDA document. The generic engine is in `history.ts`, which the FSM editor core
// imports in the first load; the PDA twin lives here so that the first load never pulls
// `pda-document.ts` or `pda-commands.ts` (T-068).
import type { GenericHistory } from './history.ts';
import { createGenericHistory } from './history.ts';
import { applyPdaCommand } from './pda-commands.ts';
import type { PdaApplyResult, PdaCommand } from './pda-commands.ts';
import { pdaDocumentsEqual } from './pda-document.ts';
import type { PdaDocument } from './pda-document.ts';

export type PdaHistory = GenericHistory<PdaDocument, PdaCommand>;

export function createPdaHistory(
	initial: PdaDocument,
	options: { limit?: number } = {}
): PdaHistory {
	return createGenericHistory<PdaDocument, PdaCommand>(initial, {
		apply: applyPdaCommand as (doc: PdaDocument, command: PdaCommand) => PdaApplyResult,
		equal: pdaDocumentsEqual,
		limit: options.limit
	});
}
