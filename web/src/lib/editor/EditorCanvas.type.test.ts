import { describe, expect, it } from 'vitest';
import type EditorCanvas from './EditorCanvas.svelte';
import type { EditorCanvasProps } from './EditorCanvas.svelte';
import type { MachineDocument } from './document.ts';
import type { Command } from './commands.ts';
import type { PdaDocument } from './pda-document.ts';
import type { PdaCommand } from './pda-commands.ts';
import type { EditorCore, EditorState } from './interaction/editor.ts';
import type { DiagramInput } from './diagram/geometry.ts';
import type { ComponentProps } from 'svelte';

describe('EditorCanvas generic type test (T-053 F4)', () => {
	it('accepts both FSM and PDA editor types via EditorCanvasProps and ComponentProps', () => {
		// FSM types test
		const fsmProps = {
			editor: {} as EditorCore<MachineDocument, Command>,
			state: {} as EditorState<MachineDocument>,
			diagram: (_doc: MachineDocument): DiagramInput => {
				void _doc;
				return {
					states: [],
					start: null,
					accepting: [],
					edges: []
				};
			},
			onmore: (_from: number, _to: number) => {
				void _from;
				void _to;
			},
			onlayout: () => {}
		} satisfies EditorCanvasProps<MachineDocument, Command>;

		expect(fsmProps).toBeDefined();

		// PDA types test
		const pdaProps = {
			editor: {} as EditorCore<PdaDocument, PdaCommand>,
			state: {} as EditorState<PdaDocument>,
			diagram: (_doc: PdaDocument): DiagramInput => {
				void _doc;
				return {
					states: [],
					start: null,
					accepting: [],
					edges: []
				};
			},
			onmore: (_from: number, _to: number) => {
				void _from;
				void _to;
			}
		} satisfies EditorCanvasProps<PdaDocument, PdaCommand>;

		expect(pdaProps).toBeDefined();

		// Test ComponentProps<typeof EditorCanvas>
		type RawProps = ComponentProps<typeof EditorCanvas>;
		const isDefined: RawProps | undefined = undefined;
		expect(isDefined).toBeUndefined();
	});
});
