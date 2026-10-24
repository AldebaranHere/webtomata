// The state of the editor, with no framework in it: the document with its history, the selection,
// the tool, a drag or a rectangle that is under way, where the focus is, and what to say to a
// screen reader. The components only show this state and call these methods; every rule of
// docs/ux/editor-interactions.md for states lives here, so it can be tested without a browser.
//
// The selection, the tool and a drag are not in the document and not in the history. Every change
// to the document is a command sent through the history, and one user action is one undo step.
import type { MessageKey } from '#lib/i18n/id.ts';
import { id as messages } from '#lib/i18n/id.ts';
import type { Params } from '#lib/i18n/translate.ts';
import type { Command } from '../commands.ts';
import { documentsEqual } from '../document.ts';
import type { MachineDocument } from '../document.ts';
import { createHistory } from '../history.ts';
import type { Message } from '../../engine/types.ts';
import { MARGIN, WORLD, dragPlaces } from './canvas.ts';
import type { Point } from './canvas.ts';
import { freeSpot } from './placement.ts';
import { inRectangle, prune, selectAll, toggle } from './selection.ts';
import type { Selection } from './selection.ts';

export type Tool = 'select' | 'addState' | 'delete';

/** What to say to a screen reader. `seq` changes with every message, so that the same text is said again. */
export interface Announcement {
	key: MessageKey;
	params: Params;
	seq: number;
}

export interface EditorState {
	doc: MachineDocument;
	selection: Selection;
	tool: Tool;
	/** True from the press that starts a drag to its end. */
	dragging: boolean;
	/** The places of the states that are being dragged. The document does not change until the end. */
	preview: ReadonlyMap<number, Point> | null;
	/** The rectangle that is being drawn to select states. */
	marquee: { x: number; y: number; width: number; height: number } | null;
	/** Where the focus is, and a number that grows when the view must move it to `id`. */
	focus: { id: number | null; request: number };
	canUndo: boolean;
	canRedo: boolean;
	/** The document is not the one that the editor was opened with. */
	dirty: boolean;
	announcement: Announcement | null;
}

export interface Editor {
	getState(): EditorState;
	subscribe(listener: () => void): () => void;

	setTool(tool: Tool): void;
	select(ids: readonly number[]): void;
	selectOnly(id: number): void;
	toggle(id: number): void;
	selectAll(): void;
	clearSelection(): void;
	startMarquee(point: Point): void;
	moveMarquee(point: Point): void;
	endMarquee(): void;
	focusState(id: number, options: { keepSelection: boolean }): void;
	noteFocus(id: number | null): void;

	addStateAt(point: Point): void;
	/** A state at the center of the view, or at the nearest free spot if one is there. */
	addStateNear(center: Point): void;
	beginDrag(id: number, pointer: Point): void;
	dragTo(pointer: Point, snap: boolean): void;
	endDrag(): void;
	cancelDrag(): void;
	nudge(dx: number, dy: number): void;
	deleteSelected(): void;
	deleteStates(ids: readonly number[]): void;

	undo(): void;
	redo(): void;
	escape(): void;
	/** Ends a series of keyboard moves, so that the next one is a new undo step. */
	seal(): void;
}

const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));

/** A message of the document as an announcement; one that has no text becomes the general refusal. */
function refusal(error: Message): { key: MessageKey; params: Params } {
	return Object.hasOwn(messages, error.key)
		? { key: error.key as MessageKey, params: error.params as Params }
		: { key: 'editor.refused', params: {} };
}

const sameList = (a: readonly number[], b: readonly number[]) =>
	a.length === b.length && a.every((n, i) => n === b[i]);

function moveStates(places: ReadonlyMap<number, Point>): Command {
	const commands: Command[] = [...places].map(([id, p]) => ({
		type: 'moveState',
		id,
		x: p.x,
		y: p.y
	}));
	return commands.length === 1 ? commands[0]! : { type: 'batch', commands };
}

export function createEditor(initial: MachineDocument): Editor {
	const history = createHistory(initial);
	const listeners = new Set<() => void>();
	let sequence = 0;
	let focusRequest = 0;
	// A drag that is under way: the places at the press, and where the pointer was.
	let drag: { originals: Map<number, Point>; start: Point } | null = null;
	let marqueeStart: Point | null = null;

	let state: EditorState = {
		doc: initial,
		selection: [],
		tool: 'select',
		dragging: false,
		preview: null,
		marquee: null,
		focus: { id: null, request: 0 },
		canUndo: false,
		canRedo: false,
		dirty: false,
		announcement: null
	};

	const say = (key: MessageKey, params: Params = {}): Announcement => ({
		key,
		params,
		seq: ++sequence
	});
	const notify = () => {
		for (const listener of [...listeners]) listener();
	};

	/** Changes that do not touch the document. */
	function set(patch: Partial<EditorState>) {
		state = { ...state, ...patch };
		notify();
	}

	/** Takes the document and the history as they are now, plus other changes, in one notification. */
	function commit(patch: Partial<EditorState> = {}) {
		const doc = history.doc;
		const selection = prune(patch.selection ?? state.selection, doc);
		const focus = patch.focus ?? state.focus;
		state = {
			...state,
			...patch,
			doc,
			selection,
			focus: {
				id: focus.id !== null && doc.states.some((s) => s.id === focus.id) ? focus.id : null,
				request: focus.request
			},
			canUndo: history.canUndo,
			canRedo: history.canRedo,
			dirty: !documentsEqual(initial, doc)
		};
		notify();
	}

	const stateOf = (id: number) => history.doc.states.find((s) => s.id === id);
	const describe = (selection: Selection): Announcement => {
		if (selection.length === 0) return say('editor.selection_cleared');
		if (selection.length === 1)
			return say('editor.selected_one', { name: stateOf(selection[0]!)?.name ?? '' });
		return say('editor.selected_many', { count: selection.length });
	};
	const originalsOf = (ids: readonly number[]) =>
		new Map(
			ids.flatMap((id) => {
				const s = stateOf(id);
				return s ? [[id, { x: s.x, y: s.y }] as [number, Point]] : [];
			})
		);

	function select(ids: readonly number[]) {
		history.seal();
		const next = prune(
			[...new Set(ids)].sort((a, b) => a - b),
			history.doc
		);
		if (sameList(next, state.selection)) return;
		commit({ selection: next, announcement: describe(next) });
	}

	function addStateAt(point: Point) {
		if (drag) return;
		history.seal();
		const x = clamp(Math.round(point.x), MARGIN, WORLD.width - MARGIN);
		const y = clamp(Math.round(point.y), MARGIN, WORLD.height - MARGIN);
		const result = history.execute({ type: 'addState', x, y });
		if (!result.ok) {
			const { key, params } = refusal(result.error);
			commit({ announcement: say(key, params) });
			return;
		}
		const created = history.doc.states[history.doc.states.length - 1]!;
		commit({
			selection: [created.id],
			focus: { id: created.id, request: ++focusRequest },
			announcement: say('editor.state_added', { name: created.name })
		});
	}

	function deleteStates(ids: readonly number[]) {
		if (drag) return;
		const doomed = history.doc.states.filter((s) => ids.includes(s.id));
		if (doomed.length === 0) return;
		history.seal();
		const remaining = history.doc.states.filter((s) => !ids.includes(s.id));
		const cx = doomed.reduce((sum, s) => sum + s.x, 0) / doomed.length;
		const cy = doomed.reduce((sum, s) => sum + s.y, 0) / doomed.length;
		// The state to focus next: the nearest one that is left (the lowest id if two are as near).
		let target: number | null = null;
		let best = Infinity;
		for (const s of remaining) {
			const distance = Math.hypot(s.x - cx, s.y - cy);
			if (distance < best) {
				best = distance;
				target = s.id;
			}
		}
		const commands: Command[] = doomed.map((s) => ({ type: 'removeState', id: s.id }));
		history.execute(commands.length === 1 ? commands[0]! : { type: 'batch', commands });
		commit({
			selection: [],
			focus: { id: target, request: ++focusRequest },
			announcement:
				doomed.length === 1
					? say('editor.deleted_state', { name: doomed[0]!.name })
					: say('editor.deleted_states', { count: doomed.length })
		});
	}

	return {
		getState: () => state,
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},

		setTool(tool) {
			history.seal();
			if (tool !== state.tool) set({ tool });
		},
		select,
		selectOnly: (id) => select([id]),
		toggle: (id) => select(toggle(state.selection, id)),
		selectAll: () => select(selectAll(history.doc)),
		clearSelection: () => select([]),

		startMarquee(point) {
			history.seal();
			marqueeStart = point;
			set({ marquee: { x: point.x, y: point.y, width: 0, height: 0 } });
		},
		moveMarquee(point) {
			if (!marqueeStart) return;
			set({
				marquee: {
					x: marqueeStart.x,
					y: marqueeStart.y,
					width: point.x - marqueeStart.x,
					height: point.y - marqueeStart.y
				}
			});
		},
		endMarquee() {
			if (!marqueeStart || !state.marquee) return;
			const rectangle = state.marquee;
			marqueeStart = null;
			set({ marquee: null });
			select(inRectangle(history.doc, rectangle));
		},

		focusState(id, { keepSelection }) {
			if (!stateOf(id)) return;
			history.seal();
			const focus = { id, request: ++focusRequest };
			if (keepSelection || sameList(state.selection, [id])) {
				set({ focus });
				return;
			}
			commit({ selection: [id], focus, announcement: describe([id]) });
		},
		noteFocus(id) {
			// Only a state that exists can have the focus.
			set({ focus: { id: id !== null && stateOf(id) ? id : null, request: state.focus.request } });
		},

		addStateAt,
		addStateNear: (center) => addStateAt(freeSpot(history.doc, center)),

		beginDrag(id, pointer) {
			if (drag || !stateOf(id)) return;
			history.seal();
			const selection = state.selection.includes(id) ? state.selection : [id];
			drag = { originals: originalsOf(selection), start: pointer };
			commit({ selection, dragging: true });
		},
		dragTo(pointer, snap) {
			if (!drag) return;
			const delta = { x: pointer.x - drag.start.x, y: pointer.y - drag.start.y };
			set({ preview: dragPlaces(drag.originals, delta, snap) });
		},
		endDrag() {
			if (!drag) return;
			const places = state.preview ?? drag.originals;
			drag = null;
			history.execute(moveStates(places));
			commit({ dragging: false, preview: null });
		},
		cancelDrag() {
			if (!drag) return;
			drag = null;
			set({ dragging: false, preview: null });
		},

		nudge(dx, dy) {
			if (drag || state.selection.length === 0) return;
			const originals = originalsOf(state.selection);
			const before = history.doc;
			history.execute(moveStates(dragPlaces(originals, { x: dx, y: dy }, false)), {
				coalesce: 'nudge'
			});
			if (history.doc === before) return;
			const moved = state.selection.length === 1 ? stateOf(state.selection[0]!) : undefined;
			commit({
				announcement: moved
					? say('editor.moved', { name: moved.name, x: moved.x, y: moved.y })
					: say('editor.moved_many', { count: state.selection.length })
			});
		},
		deleteSelected: () => deleteStates(state.selection),
		deleteStates,

		undo() {
			if (drag || !history.canUndo) return;
			history.seal();
			history.undo();
			commit({ announcement: say('editor.undone') });
		},
		redo() {
			if (drag || !history.canRedo) return;
			history.seal();
			history.redo();
			commit({ announcement: say('editor.redone') });
		},
		escape() {
			if (drag) {
				drag = null;
				set({ dragging: false, preview: null });
			} else if (marqueeStart) {
				marqueeStart = null;
				set({ marquee: null });
			} else if (state.selection.length > 0) {
				select([]);
			} else if (state.tool !== 'select') {
				history.seal();
				set({ tool: 'select' });
			}
		},
		seal: () => history.seal()
	};
}
