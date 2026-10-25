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
import { LIMIT, dragPlaces } from './canvas.ts';
import type { Point } from './canvas.ts';
import { labelCommands, labelOf, parseLabel, splitNeeded, splitParts } from './label.ts';
import { freeSpot } from './placement.ts';
import { inRectangle, prune, selectAll, toggle } from './selection.ts';
import type { Selection } from './selection.ts';

export type Tool = 'select' | 'addState' | 'transition' | 'delete';

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
	focus: { id: number | null; request: number; edge?: { from: number; to: number } };
	canUndo: boolean;
	canRedo: boolean;
	/** The document is not the one that the editor was opened with. */
	dirty: boolean;
	announcement: Announcement | null;
	/** The state whose name is being edited. */
	renaming: number | null;
	/** A transition that is being made: the source is chosen, the target is not. */
	link: { from: number; pointer: Point | null } | null;
	/** The box for the symbols of the edge from → to. `ask` is a long part that needs an answer. */
	labeling: { from: number; to: number; ask: string | null } | null;
	/** The selected edge (the transitions from → to). One edge, and never together with states. */
	edge: { from: number; to: number } | null;
	/** What the last delete removed, for the message with Urungkan. It goes with the next change. */
	toast: Announcement | null;
}

/** The label box needs an answer: is this long text one symbol or several? */
export interface SplitQuestion {
	ask: string;
}

/** A message of the document, as a key with parameters. */
export interface Refusal {
	key: MessageKey;
	params: Params;
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
	toggleAccepting(): void;
	toggleStart(): void;
	/** Opens the name field for the one selected state. */
	startRename(): void;
	/** Sends a name. Returns null when the field closed, or why the name was refused (it stays open). */
	commitRename(name: string): Refusal | null;
	cancelRename(): void;
	startLink(from: number): void;
	moveLink(pointer: Point): void;
	/** The target of the transition, or null (a release on empty canvas) to cancel. */
	finishLink(to: number | null): void;
	/** The key of the keyboard: starts a transition from the one selected state, or ends it at the focus. */
	linkAtFocus(): void;
	/**
	 * Sends the text of the label box. Returns null when the box closed, why the text was refused
	 * (the box stays open), or a question to answer with `split`.
	 */
	commitLabel(text: string, split?: 'split' | 'whole'): Refusal | SplitQuestion | null;
	cancelLabel(): void;
	selectEdge(from: number, to: number): void;
	/** Opens the label box for the selected edge. */
	editEdge(): void;
	/** Removes all the symbols of an edge, as one step. */
	deleteEdge(from: number, to: number): void;
	/** The menu item "Tambah transisi dari sini": the Transisi tool, with this state as the source. */
	linkFrom(id: number): void;
	dismissToast(): void;
	/** The title of the machine, as one undo step. Returns why the document refused it, or null. */
	setTitle(title: string): Refusal | null;
	/**
	 * Runs any command of the document as one undo step: the way that the table and the definition
	 * view change the machine. `say` is what a screen reader hears, and `toast` also shows it with
	 * Urungkan. Returns why the document refused the command (nothing changes), or null.
	 */
	apply(
		command: Command,
		note?: { say?: { key: MessageKey; params?: Params }; toast?: boolean }
	): Refusal | null;

	undo(): void;
	redo(): void;
	escape(): void;
	/** Ends a series of keyboard moves, so that the next one is a new undo step. */
	seal(): void;
}

const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));

/** A message of the document as an announcement; one that has no text becomes the general refusal. */
function refusal(error: Message): Refusal {
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
		announcement: null,
		renaming: null,
		link: null,
		labeling: null,
		edge: null,
		toast: null
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
		const before = state.doc;
		const selection = prune(patch.selection ?? state.selection, doc);
		const focus = patch.focus ?? state.focus;
		state = {
			...state,
			...patch,
			doc,
			selection,
			focus: {
				id: focus.id !== null && doc.states.some((s) => s.id === focus.id) ? focus.id : null,
				request: focus.request,
				...(focus.edge ? { edge: focus.edge } : {})
			},
			canUndo: history.canUndo,
			canRedo: history.canRedo,
			dirty: !documentsEqual(initial, doc)
		};
		// The name field closes with its state, and the toast goes with the next change of the document.
		const renaming = patch.renaming === undefined ? state.renaming : patch.renaming;
		state.renaming =
			renaming !== null && doc.states.some((s) => s.id === renaming) ? renaming : null;
		if (patch.toast === undefined && doc !== before) state.toast = null;
		// A transition that is half made goes with any change of the document, or with its source.
		const has = (id: number) => doc.states.some((s) => s.id === id);
		if (state.link && (doc !== before || !has(state.link.from))) state.link = null;
		if (state.labeling && !(has(state.labeling.from) && has(state.labeling.to))) {
			state.labeling = null;
		}
		// Selecting states drops the selected edge. An edge goes when its transitions are gone.
		if (patch.selection !== undefined && patch.edge === undefined) state.edge = null;
		const live = (e: { from: number; to: number } | null | undefined) =>
			e != null && doc.transitions.some((t) => t.from === e.from && t.to === e.to);
		if (!live(state.edge)) state.edge = null;
		if (state.focus.edge && !live(state.focus.edge)) {
			state.focus = { id: state.focus.id, request: state.focus.request };
		}
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
		if (sameList(next, state.selection) && state.edge === null) return;
		commit({ selection: next, announcement: describe(next) });
	}

	/** A drag under way, or a box that is open: nothing else edits the document. */
	const busy = () => drag !== null || state.renaming !== null || state.labeling !== null;

	function addStateAt(point: Point) {
		if (busy()) return;
		history.seal();
		const x = clamp(Math.round(point.x), -LIMIT, LIMIT);
		const y = clamp(Math.round(point.y), -LIMIT, LIMIT);
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
		if (busy()) return;
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
		const message =
			doomed.length === 1
				? say('editor.deleted_state', { name: doomed[0]!.name })
				: say('editor.deleted_states', { count: doomed.length });
		commit({
			selection: [],
			focus: { id: target, request: ++focusRequest },
			announcement: message,
			toast: message
		});
	}

	function toggleAccepting() {
		const ids = state.selection;
		if (busy() || ids.length === 0) return;
		history.seal();
		const on = !ids.every((id) => history.doc.accepting.includes(id));
		const commands: Command[] = ids.map((id) => ({ type: 'setAccepting', id, accepting: on }));
		history.execute(commands.length === 1 ? commands[0]! : { type: 'batch', commands });
		commit({
			announcement:
				ids.length === 1
					? say(on ? 'editor.accepting_on' : 'editor.accepting_off', {
							name: stateOf(ids[0]!)?.name ?? ''
						})
					: say('editor.accepting_changed', { count: ids.length })
		});
	}

	function toggleStart() {
		if (busy()) return;
		const [id] = state.selection;
		if (id === undefined || state.selection.length !== 1) {
			set({ announcement: say('editor.need_one_state') });
			return;
		}
		history.seal();
		const clear = history.doc.start === id;
		history.execute({ type: 'setStart', id: clear ? null : id });
		commit({
			announcement: clear
				? say('editor.start_cleared')
				: say('editor.start_set', { name: stateOf(id)?.name ?? '' })
		});
	}

	function closeLabel(patch: Partial<EditorState> = {}) {
		const open = state.labeling;
		// An edge that is selected and still there gets the focus back; otherwise its source does.
		const edge = state.edge;
		const onEdge =
			open !== null &&
			edge !== null &&
			edge.from === open.from &&
			edge.to === open.to &&
			history.doc.transitions.some((t) => t.from === open.from && t.to === open.to);
		commit({
			labeling: null,
			focus: onEdge
				? { id: null, request: ++focusRequest, edge }
				: { id: open?.from ?? null, request: ++focusRequest },
			...patch
		});
	}

	const nameOf = (id: number) => stateOf(id)?.name ?? '';

	function selectEdge(from: number, to: number) {
		const symbols = labelOf(history.doc, from, to);
		if (symbols === '') return;
		if (state.edge?.from === from && state.edge.to === to && state.selection.length === 0) return;
		history.seal();
		commit({
			selection: [],
			edge: { from, to },
			announcement: say('editor.edge_selected', { from: nameOf(from), to: nameOf(to), symbols })
		});
	}

	function deleteEdge(from: number, to: number) {
		if (busy()) return;
		const symbols = history.doc.transitions
			.filter((t) => t.from === from && t.to === to)
			.map((t) => t.on);
		if (symbols.length === 0) return;
		history.seal();
		const commands: Command[] = symbols.map((on) => ({ type: 'removeTransition', from, on, to }));
		history.execute(commands.length === 1 ? commands[0]! : { type: 'batch', commands });
		const message = say('editor.edge_removed', { from: nameOf(from), to: nameOf(to) });
		commit({
			selection: [],
			focus: { id: from, request: ++focusRequest },
			announcement: message,
			toast: message
		});
	}

	function finishLink(to: number | null) {
		const link = state.link;
		if (!link) return;
		if (to === null || !stateOf(to)) {
			set({ link: null });
			return;
		}
		set({ link: null, labeling: { from: link.from, to, ask: null } });
	}

	function startLink(from: number) {
		if (busy() || !stateOf(from)) return;
		history.seal();
		commit({
			link: { from, pointer: null },
			selection: [from],
			announcement: say('editor.hint_pick_target')
		});
	}

	function closeRename(patch: Partial<EditorState> = {}) {
		const id = state.renaming;
		commit({
			renaming: null,
			focus: { id, request: ++focusRequest },
			...patch
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
			if (tool !== state.tool || state.link) {
				set({
					tool,
					link: null,
					...(tool === 'transition' ? { announcement: say('editor.hint_pick_source') } : {})
				});
			}
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
			// While a transition is being made the selection stays on its source.
			if (keepSelection || state.link !== null || sameList(state.selection, [id])) {
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
			if (busy() || state.selection.length === 0) return;
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
		deleteSelected: () =>
			state.edge ? deleteEdge(state.edge.from, state.edge.to) : deleteStates(state.selection),
		selectEdge,
		deleteEdge,
		editEdge() {
			if (busy() || !state.edge) return;
			history.seal();
			set({ labeling: { from: state.edge.from, to: state.edge.to, ask: null } });
		},
		linkFrom(id) {
			if (busy() || !stateOf(id)) return;
			history.seal();
			set({ tool: 'transition', link: null });
			startLink(id);
		},
		deleteStates,
		toggleAccepting,
		toggleStart,

		startRename() {
			if (busy() || state.selection.length !== 1) return;
			history.seal();
			set({ renaming: state.selection[0]! });
		},
		commitRename(name) {
			const id = state.renaming;
			if (id === null) return null;
			const before = history.doc;
			const result = history.execute({ type: 'renameState', id, name });
			if (!result.ok) {
				const problem = refusal(result.error);
				set({ announcement: say(problem.key, problem.params) });
				return problem;
			}
			closeRename(history.doc === before ? {} : { announcement: say('editor.renamed', { name }) });
			return null;
		},
		startLink,
		moveLink(pointer) {
			if (state.link) set({ link: { ...state.link, pointer } });
		},
		finishLink,
		linkAtFocus() {
			if (state.link) {
				if (state.focus.id !== null) finishLink(state.focus.id);
			} else if (state.selection.length === 1) {
				startLink(state.selection[0]!);
			}
		},
		commitLabel(text, split) {
			const open = state.labeling;
			if (!open) return null;
			let parts = parseLabel(text);
			if (split === 'split') {
				parts = splitParts(parts);
			} else if (split === undefined) {
				const long = splitNeeded(history.doc, parts);
				if (long !== null) {
					set({ labeling: { ...open, ask: long } });
					return { ask: long };
				}
			}
			const commands = labelCommands(history.doc, open.from, open.to, parts);
			if (commands.length === 0) {
				closeLabel();
				return null;
			}
			const result = history.execute(
				commands.length === 1 ? commands[0]! : { type: 'batch', commands }
			);
			if (!result.ok) {
				const problem = refusal(result.error);
				set({ labeling: { ...open, ask: null }, announcement: say(problem.key, problem.params) });
				return problem;
			}
			const from = stateOf(open.from)?.name ?? '';
			const to = stateOf(open.to)?.name ?? '';
			closeLabel({
				announcement:
					parts.length === 0
						? say('editor.edge_removed', { from, to })
						: say('editor.edge_changed', {
								from,
								to,
								symbols: labelOf(history.doc, open.from, open.to)
							})
			});
			return null;
		},
		cancelLabel() {
			if (state.labeling) closeLabel();
		},
		cancelRename() {
			if (state.renaming !== null) closeRename();
		},
		setTitle(title) {
			history.seal();
			const before = history.doc;
			const result = history.execute({ type: 'setTitle', title });
			if (!result.ok) return refusal(result.error);
			if (history.doc !== before) commit({ announcement: say('editor.title_set', { title }) });
			return null;
		},
		apply(command, note) {
			history.seal();
			const before = history.doc;
			const result = history.execute(command);
			if (!result.ok) return refusal(result.error);
			if (history.doc !== before) {
				const said = note?.say ? say(note.say.key, note.say.params ?? {}) : undefined;
				commit(
					said ? (note?.toast ? { announcement: said, toast: said } : { announcement: said }) : {}
				);
			}
			return null;
		},
		dismissToast() {
			if (state.toast) set({ toast: null });
		},

		undo() {
			if (drag || !history.canUndo) return;
			history.seal();
			// With a toast on the screen the undo may come from its button, which then goes away.
			const refocus = state.toast !== null;
			history.undo();
			commit({
				announcement: say('editor.undone'),
				...(refocus ? { focus: { id: null, request: ++focusRequest } } : {})
			});
		},
		redo() {
			if (drag || !history.canRedo) return;
			history.seal();
			history.redo();
			commit({ announcement: say('editor.redone') });
		},
		escape() {
			if (state.renaming !== null) {
				closeRename();
			} else if (state.labeling !== null) {
				closeLabel();
			} else if (drag) {
				drag = null;
				set({ dragging: false, preview: null });
			} else if (state.link !== null) {
				set({ link: null });
			} else if (marqueeStart) {
				marqueeStart = null;
				set({ marquee: null });
			} else if (state.selection.length > 0 || state.edge) {
				select([]);
			} else if (state.tool !== 'select') {
				history.seal();
				set({ tool: 'select' });
			}
		},
		seal: () => history.seal()
	};
}
