// The PDA editor kind and factory function.
// `createPdaEditor` wraps `createEditorCore` with `pdaKind`, producing a `PdaEditor`
// interface operating on `PdaDocument` and `PdaCommand`.
import { pdaEdgeText } from '../diagram/pda-diagram.ts';
import { createPdaHistory } from '../pda-history.ts';
import type { PdaCommand } from '../pda-commands.ts';
import { pdaDocumentsEqual } from '../pda-document.ts';
import type { PdaDocument } from '../pda-document.ts';
import type { EditorKind } from './document-view.ts';
import { createEditorCore } from './editor.ts';
import type { EditorCore, EditorState } from './editor.ts';

export type PdaEditor = EditorCore<PdaDocument, PdaCommand>;
export type PdaEditorState = EditorState<PdaDocument>;

export const pdaKind: EditorKind<PdaDocument, PdaCommand> = {
	createHistory: createPdaHistory,
	equal: pdaDocumentsEqual,
	edgeText: (doc, from, to) => pdaEdgeText(doc, from, to),
	removeEdge: (doc, from, to) =>
		doc.transitions
			.filter((t) => t.from === from && t.to === to)
			.map((t) => ({
				type: 'removeTransition',
				from,
				read: t.read,
				pop: t.pop,
				push: t.push,
				to
			}))
};

export function createPdaEditor(initial: PdaDocument): PdaEditor {
	const { setLabelingAsk: _, ...core } = createEditorCore(initial, pdaKind);
	void _;
	return core;
}
