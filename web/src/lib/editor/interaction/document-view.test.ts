// A test of types: the shared core is written against `StatesDocument` and `StateCommand`, so both
// kinds of document and both kinds of command must fit them, and the FSM editor must still have
// every member that the components use. `pnpm check` is what fails when one does not; the
// assertions at run time only make sure that the file runs.
import { describe, expect, it } from 'vitest';
import type { Command } from '../commands.ts';
import type { MachineDocument } from '../document.ts';
import { build } from '../diagram/testing.ts';
import type { PdaCommand } from '../pda-commands.ts';
import type { PdaDocument } from '../pda-document.ts';
import { wwrSample } from '../pda-samples.ts';
import type { StateCommand, StatesDocument } from './document-view.ts';
import { createEditor } from './editor.ts';
import type { Editor, EditorState } from './editor.ts';

const everyStateCommand = [
	{ type: 'addState', x: 1, y: 2 },
	{ type: 'addState', x: 1, y: 2, name: 'p' },
	{ type: 'removeState', id: 0 },
	{ type: 'moveState', id: 0, x: 3, y: 4 },
	{ type: 'renameState', id: 0, name: 'p' },
	{ type: 'setStart', id: null },
	{ type: 'setAccepting', id: 0, accepting: true },
	{ type: 'setTitle', title: 'T' }
] as const satisfies readonly StateCommand[];

describe('the types that the shared core relies on', () => {
	it('both documents are a StatesDocument', () => {
		const fsm = build({ alphabet: ['a'], states: [[0, 0, 'q0']] });
		const pda = wwrSample();
		const views: StatesDocument[] = [fsm satisfies MachineDocument, pda satisfies PdaDocument];
		expect(views).toHaveLength(2);
	});

	it('both Command and PdaCommand accept every StateCommand', () => {
		const asFsm: readonly Command[] = everyStateCommand;
		const asPda: readonly PdaCommand[] = everyStateCommand;
		expect(asFsm).toHaveLength(asPda.length);
	});

	it('createEditor still gives an Editor with every member, and EditorState means the FSM one', () => {
		const doc = build({
			alphabet: ['a'],
			states: [
				[0, 0, 'q0'],
				[200, 0, 'q1']
			]
		});
		const editor: Editor = createEditor(doc);
		const state: EditorState = editor.getState();
		const same: MachineDocument = state.doc;
		editor.startLink(0);
		editor.finishLink(1);
		expect(editor.commitLabel('a')).toBeNull();
		expect(same).toBe(doc);
		expect(editor.getState().doc.transitions).toHaveLength(1);
	});
});
