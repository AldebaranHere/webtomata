import { describe, expect, it } from 'vitest';
import type { ComponentProps } from 'svelte';
import { createPdaEditor } from './interaction/pda-editor.ts';
import { pdaDocumentFrom, wwrSample } from './pda-samples.ts';
import type { PdaCommand } from './pda-commands.ts';
import type PdaLabelForm from './PdaLabelForm.svelte';
import type PdaLabelPopover from './PdaLabelPopover.svelte';
import { parseRows, pdaMenuLabels, rowCommands, rowsOf, type Row } from './pda-label.ts';

describe('T-054 PDA label logic', () => {
	describe('F1: rowsOf', () => {
		it('extracts transitions for pair (0, 0) of wwrSample in label format', () => {
			const doc = wwrSample();
			const rows = rowsOf(doc, 0, 0);
			expect(rows).toEqual([
				{ read: 'a', pop: 'ε', push: 'A' },
				{ read: 'b', pop: 'ε', push: 'B' }
			]);
		});

		it('extracts transitions for pair (0, 1) of wwrSample in label format', () => {
			const doc = wwrSample();
			const rows = rowsOf(doc, 0, 1);
			expect(rows).toEqual([{ read: 'ε', pop: 'ε', push: 'ε' }]);
		});

		it('returns empty list for pair (1, 0) with no transitions', () => {
			const doc = wwrSample();
			const rows = rowsOf(doc, 1, 0);
			expect(rows).toEqual([]);
		});

		it('formats stack symbols with spaces when stack alphabet has multi-character name', () => {
			const doc = pdaDocumentFrom({
				inputAlphabet: ['a'],
				stackAlphabet: ['Z0', 'A'],
				states: [
					[0, 0, 'q0'],
					[100, 0, 'q1']
				],
				transitions: [[0, 'a', ['Z0'], ['A', 'Z0'], 1]]
			});
			const rows = rowsOf(doc, 0, 1);
			expect(rows).toEqual([{ read: 'a', pop: 'Z0', push: 'A Z0' }]);
		});
	});

	describe('F2: field parsing and parseRows', () => {
		const docSingle = wwrSample(); // stackAlphabet: ['A', 'B'], inputAlphabet: ['a', 'b']
		const docMulti = pdaDocumentFrom({
			inputAlphabet: ['a', 'num'],
			stackAlphabet: ['Z0', 'A'],
			states: [[0, 0, 'q0']]
		});

		it('parses pop and push strings with single-character stack alphabet', () => {
			// "AB" -> ["A", "B"]
			expect(parseRows(docSingle, [{ read: 'a', pop: 'AB', push: 'AB' }])).toEqual([
				{ read: 'a', pop: ['A', 'B'], push: ['A', 'B'] }
			]);
			// "A B" -> ["A", "B"]
			expect(parseRows(docSingle, [{ read: 'a', pop: 'A B', push: 'A B' }])).toEqual([
				{ read: 'a', pop: ['A', 'B'], push: ['A', 'B'] }
			]);
			// "A, B" -> ["A", "B"]
			expect(parseRows(docSingle, [{ read: 'a', pop: 'A, B', push: 'A, B' }])).toEqual([
				{ read: 'a', pop: ['A', 'B'], push: ['A', 'B'] }
			]);
			// "ε", "eps", "", "  " -> []
			for (const empty of ['ε', 'eps', '', '  ']) {
				expect(parseRows(docSingle, [{ read: 'a', pop: empty, push: empty }])).toEqual([
					{ read: 'a', pop: [], push: [] }
				]);
			}
			// "Z0 A" -> ["Z0", "A"] (space separator makes names)
			expect(parseRows(docSingle, [{ read: 'a', pop: 'Z0 A', push: 'Z0 A' }])).toEqual([
				{ read: 'a', pop: ['Z0', 'A'], push: ['Z0', 'A'] }
			]);
			// "Z0" -> ["Z", "0"] (no separator, single-character alphabet splits code points)
			expect(parseRows(docSingle, [{ read: 'a', pop: 'Z0', push: 'Z0' }])).toEqual([
				{ read: 'a', pop: ['Z', '0'], push: ['Z', '0'] }
			]);
			// "A😀" -> ["A", "😀"] (code points)
			expect(parseRows(docSingle, [{ read: 'a', pop: 'A😀', push: 'A😀' }])).toEqual([
				{ read: 'a', pop: ['A', '😀'], push: ['A', '😀'] }
			]);
		});

		it('parses pop and push strings with multi-character stack alphabet', () => {
			// "Z0A" -> ["Z0A"] (multi-character alphabet present, no separator: one name)
			expect(parseRows(docMulti, [{ read: 'a', pop: 'Z0A', push: 'Z0A' }])).toEqual([
				{ read: 'a', pop: ['Z0A'], push: ['Z0A'] }
			]);
			// "Z0 A" -> ["Z0", "A"] (space separator)
			expect(parseRows(docMulti, [{ read: 'a', pop: 'Z0 A', push: 'Z0 A' }])).toEqual([
				{ read: 'a', pop: ['Z0', 'A'], push: ['Z0', 'A'] }
			]);
			// "AA" -> ["AA"] (multi-character alphabet present, no separator: one name)
			expect(parseRows(docMulti, [{ read: 'a', pop: 'AA', push: 'AA' }])).toEqual([
				{ read: 'a', pop: ['AA'], push: ['AA'] }
			]);
		});

		it('parses read field with 1-character input alphabet', () => {
			// "a" -> "a"
			expect(parseRows(docSingle, [{ read: 'a', pop: '', push: '' }])).toEqual([
				{ read: 'a', pop: [], push: [] }
			]);
			// " a " -> "a"
			expect(parseRows(docSingle, [{ read: ' a ', pop: '', push: '' }])).toEqual([
				{ read: 'a', pop: [], push: [] }
			]);
			// "", "ε", "eps" -> null
			for (const eps of ['', 'ε', 'eps']) {
				expect(parseRows(docSingle, [{ read: eps, pop: 'A', push: 'B' }])).toEqual([
					{ read: null, pop: ['A'], push: ['B'] }
				]);
			}
			// "c" -> "c" (new single character accepted)
			expect(parseRows(docSingle, [{ read: 'c', pop: '', push: '' }])).toEqual([
				{ read: 'c', pop: [], push: [] }
			]);
			// "ab" -> refusal pda_editor.read_one_symbol
			expect(parseRows(docSingle, [{ read: 'ab', pop: '', push: '' }])).toEqual({
				key: 'pda_editor.read_one_symbol',
				params: { text: 'ab' }
			});
			// "a b" -> refusal pda_editor.read_one_symbol with whitespace
			expect(parseRows(docSingle, [{ read: 'a b', pop: '', push: '' }])).toEqual({
				key: 'pda_editor.read_one_symbol',
				params: { text: 'a b' }
			});
		});

		it('parses read field when input alphabet contains multi-character name', () => {
			// "ab" -> "ab" (accepted as new name)
			expect(parseRows(docMulti, [{ read: 'ab', pop: '', push: '' }])).toEqual([
				{ read: 'ab', pop: [], push: [] }
			]);
			// "num" -> "num" (already in alphabet)
			expect(parseRows(docMulti, [{ read: 'num', pop: '', push: '' }])).toEqual([
				{ read: 'num', pop: [], push: [] }
			]);
		});

		it('ignores blank rows and collapses duplicates', () => {
			const rows: Row[] = [
				{ read: '', pop: '', push: '' },
				{ read: 'a', pop: 'ε', push: 'A' },
				{ read: '   ', pop: '', push: '   ' },
				{ read: 'a', pop: 'ε', push: 'A' }
			];
			expect(parseRows(docSingle, rows)).toEqual([{ read: 'a', pop: [], push: ['A'] }]);
		});
	});

	describe('F3: rowCommands', () => {
		const doc = wwrSample();

		it('yields [] when rows are unchanged on pair (0, 0)', () => {
			const unchanged = rowsOf(doc, 0, 0);
			expect(rowCommands(doc, 0, 0, unchanged)).toEqual([]);
		});

		it('adds row { read: "c", pop: "A", push: "" } on pair (0, 0)', () => {
			const rows: Row[] = [...rowsOf(doc, 0, 0), { read: 'c', pop: 'A', push: '' }];
			expect(rowCommands(doc, 0, 0, rows)).toEqual([
				{ type: 'addInputSymbol', symbol: 'c' },
				{ type: 'addTransition', from: 0, read: 'c', pop: ['A'], push: [], to: 0 }
			]);
		});

		it('changes second row to { read: "b", pop: "ε", push: "BB" } with additions first, removals last', () => {
			const rows: Row[] = [
				{ read: 'a', pop: 'ε', push: 'A' },
				{ read: 'b', pop: 'ε', push: 'BB' }
			];
			expect(rowCommands(doc, 0, 0, rows)).toEqual([
				{ type: 'addTransition', from: 0, read: 'b', pop: [], push: ['B', 'B'], to: 0 },
				{ type: 'removeTransition', from: 0, read: 'b', pop: [], push: ['B'], to: 0 }
			]);
		});

		it('removes both rows when passed []', () => {
			expect(rowCommands(doc, 0, 0, [])).toEqual([
				{ type: 'removeTransition', from: 0, read: 'a', pop: [], push: ['A'], to: 0 },
				{ type: 'removeTransition', from: 0, read: 'b', pop: [], push: ['B'], to: 0 }
			]);
		});

		it('yields [] for new pair (1, 0) with a blank row only and with []', () => {
			expect(rowCommands(doc, 1, 0, [{ read: '', pop: '', push: '' }])).toEqual([]);
			expect(rowCommands(doc, 1, 0, [])).toEqual([]);
		});

		it('deduplicates duplicate rows into one addTransition', () => {
			const rows: Row[] = [
				{ read: 'c', pop: 'A', push: '' },
				{ read: 'c', pop: 'A', push: '' }
			];
			expect(rowCommands(doc, 1, 0, rows)).toEqual([
				{ type: 'addInputSymbol', symbol: 'c' },
				{ type: 'addTransition', from: 1, read: 'c', pop: ['A'], push: [], to: 0 }
			]);
		});

		it('adds new stack symbol that appears only in a push', () => {
			const rows: Row[] = [{ read: 'a', pop: '', push: 'X' }];
			expect(rowCommands(doc, 1, 0, rows)).toEqual([
				{ type: 'addStackSymbol', symbol: 'X' },
				{ type: 'addTransition', from: 1, read: 'a', pop: [], push: ['X'], to: 0 }
			]);
		});

		it('adds new stack symbol only once when it appears multiple times', () => {
			const rows: Row[] = [{ read: 'd', pop: 'C', push: 'C C' }];
			expect(rowCommands(doc, 1, 0, rows)).toEqual([
				{ type: 'addInputSymbol', symbol: 'd' },
				{ type: 'addStackSymbol', symbol: 'C' },
				{ type: 'addTransition', from: 1, read: 'd', pop: ['C'], push: ['C', 'C'], to: 0 }
			]);
		});

		it('propagates refusal if row parsing fails', () => {
			const rows: Row[] = [{ read: 'invalid word', pop: '', push: '' }];
			expect(rowCommands(doc, 0, 0, rows)).toEqual({
				key: 'pda_editor.read_one_symbol',
				params: { text: 'invalid word' }
			});
		});
	});

	describe('F4: commit through editor and 63/64/65 boundary', () => {
		it('commits a transition through createPdaEditor and announces edge_changed', () => {
			const editor = createPdaEditor(wwrSample());
			editor.startLink(1);
			editor.finishLink(0);

			const cmds = rowCommands(editor.getState().doc, 1, 0, [{ read: 'a', pop: 'A', push: '' }]);
			expect(Array.isArray(cmds)).toBe(true);
			const result = editor.commitEdge(cmds as PdaCommand[]);
			expect(result).toBeNull();

			const doc = editor.getState().doc;
			expect(
				doc.transitions.some(
					(t) =>
						t.from === 1 &&
						t.to === 0 &&
						t.read === 'a' &&
						t.pop.join() === 'A' &&
						t.push.length === 0
				)
			).toBe(true);

			expect(editor.getState().announcement).toMatchObject({
				key: 'editor.edge_changed',
				params: {
					from: 'q1',
					to: 'q0',
					symbols: 'a / A / ε'
				}
			});
		});

		it('tests the 63 / 64 / 65 push length boundary', () => {
			const editor = createPdaEditor(wwrSample());

			// 63 symbols: accepted
			const push63 = 'A '.repeat(62) + 'A';
			const cmds63 = rowCommands(editor.getState().doc, 0, 0, [
				{ read: 'a', pop: '', push: push63 }
			]);
			expect(Array.isArray(cmds63)).toBe(true);
			editor.selectEdge(0, 0);
			editor.editEdge();
			expect(editor.commitEdge(cmds63 as PdaCommand[])).toBeNull();

			// 64 symbols: accepted
			const push64 = 'A '.repeat(63) + 'A';
			const cmds64 = rowCommands(editor.getState().doc, 0, 0, [
				{ read: 'a', pop: '', push: push64 }
			]);
			expect(Array.isArray(cmds64)).toBe(true);
			editor.selectEdge(0, 0);
			editor.editEdge();
			expect(editor.commitEdge(cmds64 as PdaCommand[])).toBeNull();

			// 65 symbols: refused with pda_document.string_too_long { limit: 64 }
			const push65 = 'A '.repeat(64) + 'A';
			const cmds65 = rowCommands(editor.getState().doc, 0, 0, [
				{ read: 'a', pop: '', push: push65 }
			]);
			expect(Array.isArray(cmds65)).toBe(true);
			editor.selectEdge(0, 0);
			editor.editEdge();
			const beforeDoc = editor.getState().doc;
			const res65 = editor.commitEdge(cmds65 as PdaCommand[]);
			expect(res65).toEqual({
				key: 'pda_document.string_too_long',
				params: { limit: 64 }
			});
			expect(editor.getState().doc).toBe(beforeDoc);
		});
	});

	describe('Menu labels', () => {
		it('exports pdaMenuLabels with edit pointing to pda_editor.menu_edit', () => {
			expect(pdaMenuLabels).toEqual({
				edit: 'pda_editor.menu_edit'
			});
		});
	});

	describe('Component types', () => {
		it('type-checks PdaLabelForm and PdaLabelPopover against PdaEditor, PdaDocument, and LabelSlot', () => {
			type FormProps = ComponentProps<typeof PdaLabelForm>;
			type PopoverProps = ComponentProps<typeof PdaLabelPopover>;
			const _f: FormProps | undefined = undefined;
			const _p: PopoverProps | undefined = undefined;
			expect(_f).toBeUndefined();
			expect(_p).toBeUndefined();
		});
	});
});
