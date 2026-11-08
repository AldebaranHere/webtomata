// Read-only model of the PDA transition table. Transitions are in `doc.transitions` order
// (the engine's canonical sort order). Reuses `formatStackSeq` and `stackSeparator` from `pda-diagram.ts`.
import { formatStackSeq, stackSeparator } from './diagram/pda-diagram.ts';
import type { PdaDocument } from './pda-document.ts';

export interface PdaTableRow {
	readonly index: number;
	readonly from: number;
	readonly fromName: string;
	readonly read: string;
	readonly pop: string;
	readonly push: string;
	readonly to: number;
	readonly toName: string;
}

export interface PdaTableModel {
	readonly rows: readonly PdaTableRow[];
}

export function pdaTableOf(doc: PdaDocument): PdaTableModel {
	const sep = stackSeparator(doc.stackAlphabet);
	const nameOf = (id: number) => doc.states.find((s) => s.id === id)?.name ?? `q${id}`;

	const rows: PdaTableRow[] = doc.transitions.map((t, index) => ({
		index,
		from: t.from,
		fromName: nameOf(t.from),
		read: t.read ?? 'ε',
		pop: formatStackSeq(t.pop, sep),
		push: formatStackSeq(t.push, sep),
		to: t.to,
		toName: nameOf(t.to)
	}));

	return { rows };
}
