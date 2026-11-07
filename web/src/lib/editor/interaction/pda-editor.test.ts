// Unit tests for the PDA editor (T-049): fixtures F1 to F5 on wwrSample().
import { describe, expect, it } from 'vitest';
import { pdaDocumentsEqual } from '../pda-document.ts';
import { wwrSample } from '../pda-samples.ts';
import { createPdaEditor } from './pda-editor.ts';

describe('PDA editor fixtures (T-049)', () => {
	it('F1, edges: selectEdge, deleteEdge, undo, and edge texts', () => {
		const doc = wwrSample();
		const editor = createPdaEditor(doc);

		// selectEdge(0, 1)
		editor.selectEdge(0, 1);
		let s = editor.getState();
		expect(s.edge).toEqual({ from: 0, to: 1 });
		expect(s.selection).toEqual([]);
		expect(s.announcement).toMatchObject({
			key: 'editor.edge_selected',
			params: { from: 'q0', to: 'q1', symbols: 'ε / ε / ε' }
		});

		// selectEdge(0, 0)
		editor.selectEdge(0, 0);
		s = editor.getState();
		expect(s.edge).toEqual({ from: 0, to: 0 });
		expect(s.announcement).toMatchObject({
			key: 'editor.edge_selected',
			params: { from: 'q0', to: 'q0', symbols: 'a / ε / A; b / ε / B' }
		});

		// selectEdge(1, 0) - no such edge
		editor.selectEdge(1, 0);
		s = editor.getState();
		expect(s.edge).toEqual({ from: 0, to: 0 }); // unchanged

		// deleteEdge(0, 0) - removes both transitions of pair (0,0) in one undo step
		editor.deleteEdge(0, 0);
		s = editor.getState();
		expect(s.doc.transitions).toHaveLength(3);
		// Remaining transitions: q0 ε/ε/ε q1, q1 a/A/ε q1, q1 b/B/ε q1
		expect(s.doc.transitions.map((t) => [t.from, t.read, t.to])).toEqual([
			[0, null, 1],
			[1, 'a', 1],
			[1, 'b', 1]
		]);
		expect(s.announcement).toMatchObject({
			key: 'editor.edge_removed',
			params: { from: 'q0', to: 'q0' }
		});
		expect(s.toast).toMatchObject({
			key: 'editor.edge_removed',
			params: { from: 'q0', to: 'q0' }
		});
		expect(s.selection).toEqual([]);
		expect(s.focus.id).toBe(0);

		// Undo gives back exact same document object
		editor.undo();
		expect(editor.getState().doc).toBe(doc);

		// deleteEdge(0, 1) leaves 4 transitions
		const editor2 = createPdaEditor(doc);
		editor2.deleteEdge(0, 1);
		expect(editor2.getState().doc.transitions).toHaveLength(4);
	});

	it('F2, deleting a state: deleteStates([1]), selection, focus, and undo', () => {
		const doc = wwrSample();
		const editor = createPdaEditor(doc);

		editor.deleteStates([1]);
		const s = editor.getState();
		expect(s.doc.states.map((st) => st.name)).toEqual(['q0']);
		expect(s.doc.start).toBe(0);
		expect(s.doc.accepting).toEqual([]);
		// Every transition touching state 1 is removed: 0>1, 1>1 (two transitions)
		expect(s.doc.transitions).toHaveLength(2);
		expect(s.doc.transitions.map((t) => [t.from, t.read, t.to])).toEqual([
			[0, 'a', 0],
			[0, 'b', 0]
		]);
		expect(s.canUndo).toBe(true);

		// Undo restores exact same document object
		editor.undo();
		expect(editor.getState().doc).toBe(doc);

		// Deleting state 1 when edge (1, 1) is selected clears the edge
		const editor2 = createPdaEditor(doc);
		editor2.selectEdge(1, 1);
		expect(editor2.getState().edge).toEqual({ from: 1, to: 1 });
		editor2.deleteStates([1]);
		expect(editor2.getState().edge).toBeNull();
	});

	it('F3, making a transition and committing it: startLink, finishLink, commitEdge', () => {
		const doc = wwrSample();
		const editor = createPdaEditor(doc);

		editor.startLink(0);
		editor.finishLink(1);
		expect(editor.getState().labeling).toEqual({ from: 0, to: 1, ask: null });

		// commitEdge with new transition
		const refusal = editor.commitEdge([
			{
				type: 'addTransition',
				from: 0,
				read: 'a',
				pop: ['A'],
				push: [],
				to: 1
			}
		]);
		expect(refusal).toBeNull();
		let s = editor.getState();
		expect(s.labeling).toBeNull();
		expect(s.canUndo).toBe(true);

		// Exact document order: T0 (0, null, 1), T1 (0, a, 0), new (0, a, 1), T2 (0, b, 0), T3 (1, a, 1), T4 (1, b, 1)
		expect(s.doc.transitions).toHaveLength(6);
		expect(
			s.doc.transitions.map((t) => ({
				from: t.from,
				read: t.read,
				pop: t.pop,
				push: t.push,
				to: t.to
			}))
		).toEqual([
			{ from: 0, read: null, pop: [], push: [], to: 1 },
			{ from: 0, read: 'a', pop: [], push: ['A'], to: 0 },
			{ from: 0, read: 'a', pop: ['A'], push: [], to: 1 },
			{ from: 0, read: 'b', pop: [], push: ['B'], to: 0 },
			{ from: 1, read: 'a', pop: ['A'], push: [], to: 1 },
			{ from: 1, read: 'b', pop: ['B'], push: [], to: 1 }
		]);

		expect(s.announcement).toMatchObject({
			key: 'editor.edge_changed',
			params: { from: 'q0', to: 'q1', symbols: 'ε / ε / ε; a / A / ε' }
		});

		// commitEdge([]) closes box and makes no step
		editor.startLink(0);
		editor.finishLink(1);
		const canUndoBefore = editor.getState().canUndo;
		expect(editor.commitEdge([])).toBeNull();
		expect(editor.getState().labeling).toBeNull();
		expect(editor.getState().canUndo).toBe(canUndoBefore);

		// commitEdge with symbol not in alphabet refuses and leaves box open
		editor.startLink(0);
		editor.finishLink(1);
		const currentDoc = editor.getState().doc;
		const badResult = editor.commitEdge([
			{
				type: 'addTransition',
				from: 0,
				read: 'z',
				pop: [],
				push: [],
				to: 1
			}
		]);
		expect(badResult).toEqual({
			key: 'pda_document.unknown_symbol',
			params: { symbol: 'z' }
		});
		s = editor.getState();
		expect(s.labeling).toEqual({ from: 0, to: 1, ask: null });
		expect(s.doc).toBe(currentDoc);
		expect(s.announcement).toMatchObject({
			key: 'pda_document.unknown_symbol',
			params: { symbol: 'z' }
		});

		// commitEdge removing last transition of a pair announces edge_removed
		editor.cancelLabel();
		editor.selectEdge(0, 1);
		editor.editEdge();
		const removeResult = editor.commitEdge([
			{ type: 'removeTransition', from: 0, read: null, pop: [], push: [], to: 1 },
			{ type: 'removeTransition', from: 0, read: 'a', pop: ['A'], push: [], to: 1 }
		]);
		expect(removeResult).toBeNull();
		expect(editor.getState().announcement).toMatchObject({
			key: 'editor.edge_removed',
			params: { from: 'q0', to: 'q1' }
		});
	});

	it('F4, drag: beginDrag, dragTo, endDrag, cancelDrag, undo', () => {
		const doc = wwrSample();
		const editor = createPdaEditor(doc);
		const p = { x: 180, y: 200 };

		editor.beginDrag(0, p);
		expect(editor.getState().dragging).toBe(true);
		expect(editor.getState().doc).toBe(doc);

		editor.dragTo({ x: p.x + 40, y: p.y + 10 }, false);
		expect(editor.getState().preview?.get(0)).toEqual({ x: 220, y: 210 });
		expect(editor.getState().doc).toBe(doc);

		editor.dragTo({ x: p.x + 40, y: p.y + 10 }, false);
		editor.endDrag();
		let s = editor.getState();
		expect(s.dragging).toBe(false);
		expect(s.preview).toBeNull();
		expect(s.doc.states[0]?.x).toBe(220);
		expect(s.doc.states[0]?.y).toBe(210);
		expect(s.canUndo).toBe(true);

		// Undo gives back exact same document object
		editor.undo();
		expect(editor.getState().doc).toBe(doc);

		// cancelDrag leaves document and history unchanged
		editor.beginDrag(0, p);
		editor.dragTo({ x: p.x + 30, y: p.y + 30 }, false);
		editor.cancelDrag();
		s = editor.getState();
		expect(s.dragging).toBe(false);
		expect(s.preview).toBeNull();
		expect(s.doc).toBe(doc);
	});

	it('F5, shared rules on a PDA', () => {
		const doc = wwrSample();
		const editor = createPdaEditor(doc);

		// addStateAt
		editor.addStateAt({ x: 300, y: 300 });
		expect(editor.getState().doc.states).toHaveLength(3);
		expect(editor.getState().announcement?.key).toBe('editor.state_added');

		// toggleAccepting
		editor.selectOnly(0);
		editor.toggleAccepting();
		expect(editor.getState().doc.accepting).toContain(0);
		editor.toggleAccepting();
		expect(editor.getState().doc.accepting).not.toContain(0);

		// toggleStart
		editor.selectOnly(1);
		editor.toggleStart();
		expect(editor.getState().doc.start).toBe(1);
		editor.toggleStart();
		expect(editor.getState().doc.start).toBeNull();

		// startRename and commitRename
		editor.selectOnly(0);
		editor.startRename();
		expect(editor.getState().renaming).toBe(0);
		expect(editor.commitRename('q_new')).toBeNull();
		expect(editor.getState().doc.states[0]?.name).toBe('q_new');

		// setTitle
		expect(editor.setTitle('New PDA Title')).toBeNull();
		expect(editor.getState().announcement).toMatchObject({
			key: 'editor.title_set',
			params: { title: 'New PDA Title' }
		});

		// selectAll
		editor.selectAll();
		expect(editor.getState().selection).toEqual([0, 1, 2]);

		// nudge and seal
		editor.selectOnly(0);
		const xBefore = editor.getState().doc.states[0]!.x;
		editor.nudge(10, 0);
		expect(editor.getState().doc.states[0]!.x).toBe(xBefore + 10);
		editor.seal();

		// undo and redo
		editor.undo();
		expect(editor.getState().announcement?.key).toBe('editor.undone');
		editor.redo();
		expect(editor.getState().announcement?.key).toBe('editor.redone');

		// escape order: rename, label, drag, link, marquee, selection or edge, tool
		const ed = createPdaEditor(doc);
		ed.setTool('transition');
		ed.selectOnly(0);
		ed.startRename();
		ed.escape(); // closes rename
		expect(ed.getState().renaming).toBeNull();
		expect(ed.getState().selection).toEqual([0]);

		ed.startLink(0);
		ed.finishLink(1);
		ed.escape(); // closes label
		expect(ed.getState().labeling).toBeNull();

		ed.beginDrag(0, { x: 180, y: 200 });
		ed.escape(); // cancels drag
		expect(ed.getState().dragging).toBe(false);

		ed.startLink(0);
		ed.escape(); // cancels link
		expect(ed.getState().link).toBeNull();

		ed.startMarquee({ x: 0, y: 0 });
		ed.escape(); // cancels marquee
		expect(ed.getState().marquee).toBeNull();

		ed.selectOnly(0);
		ed.escape(); // clears selection
		expect(ed.getState().selection).toEqual([]);

		expect(ed.getState().tool).toBe('transition');
		ed.escape(); // resets tool to select
		expect(ed.getState().tool).toBe('select');

		// dirty: true after change, false after undo, false when equal to original via pdaDocumentsEqual
		const dEd = createPdaEditor(doc);
		expect(dEd.getState().dirty).toBe(false);
		dEd.setTitle('Changed Title');
		expect(dEd.getState().dirty).toBe(true);
		dEd.undo();
		expect(dEd.getState().dirty).toBe(false);

		// An edit that changes and changes back to an equal document
		dEd.setTitle('Changed Title');
		expect(dEd.getState().dirty).toBe(true);
		dEd.setTitle(doc.title);
		expect(pdaDocumentsEqual(dEd.getState().doc, doc)).toBe(true);
		expect(dEd.getState().dirty).toBe(false);
	});
});
