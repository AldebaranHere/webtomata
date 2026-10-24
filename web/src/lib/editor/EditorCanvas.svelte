<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { MessageKey } from '#lib/i18n/id.ts';
	import DiagramDrawing from './diagram/DiagramDrawing.svelte';
	import { edgeGeometry } from './diagram/geometry.ts';
	import ContextMenu from './ContextMenu.svelte';
	import type { MachineDocument } from './document.ts';
	import LabelField from './LabelField.svelte';
	import RenameField from './RenameField.svelte';
	import ZoomControl from './ZoomControl.svelte';
	import { RADIUS } from './diagram/geometry.ts';
	import {
		IDENTITY,
		ZOOM_STEP,
		centerOf,
		fit,
		panBy,
		percent,
		pinch,
		reveal,
		toScreen,
		wheel,
		zoomAt,
		zoomBy
	} from './interaction/camera.ts';
	import type { Camera } from './interaction/camera.ts';
	import { linkLine } from './interaction/canvas.ts';
	import type { Point } from './interaction/canvas.ts';
	import type { Editor, EditorState } from './interaction/editor.ts';
	import { keyAction } from './interaction/keys.ts';
	import { labelOf } from './interaction/label.ts';
	import { menuItems } from './interaction/menu.ts';
	import type { MenuItem, MenuTarget } from './interaction/menu.ts';
	import { nearestInDirection } from './interaction/selection.ts';

	// The canvas of the editor: the drawing, and the pointer and keyboard. It turns what the user
	// does into calls of the editor (interaction/editor.ts), where the rules are. The canvas has no
	// edge: a camera (interaction/camera.ts) says where the world is on the screen and how big. The
	// camera is not part of the document.
	let { editor, state: view }: { editor: Editor; state: EditorState } = $props();

	const uid = $props.id();
	const arrow = `${uid}-arrow`;

	// While a drag is under way, the states are drawn at their preview places.
	const shown = $derived.by((): MachineDocument => {
		const preview = view.preview;
		if (!preview) return view.doc;
		return {
			...view.doc,
			states: view.doc.states.map((s) => {
				const place = preview.get(s.id);
				return place ? { ...s, x: place.x, y: place.y } : s;
			})
		};
	});
	const shapes = $derived(edgeGeometry(shown, { startLabel: t('diagram.start') }));
	const selected = $derived(new Set(view.selection));
	const preview = $derived(
		view.link?.pointer ? linkLine(shown.states, view.link.from, view.link.pointer) : null
	);
	// The label box sits on the label of its edge, or where the edge will be.
	const labelAt = $derived.by(() => {
		const open = view.labeling;
		if (!open) return null;
		const edge = shapes.edges.find((e) => e.from === open.from && e.to === open.to);
		const a = view.doc.states.find((s) => s.id === open.from);
		const b = view.doc.states.find((s) => s.id === open.to);
		if (!a || !b) return null;
		const center = edge
			? edge.label.center
			: open.from === open.to
				? { x: a.x, y: a.y - RADIUS - 60 }
				: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 36 };
		return { ...center, initial: labelOf(view.doc, open.from, open.to) };
	});
	const renamed = $derived(view.doc.states.find((s) => s.id === view.renaming));

	let viewport: HTMLDivElement;
	let svg: SVGSVGElement;
	/** The group that is moved and scaled by the camera. */
	let world: SVGGElement;
	let size = $state({ width: 0, height: 0 });
	// A raw state: a camera is replaced, never changed, and a comparison by reference is wanted.
	let camera = $state.raw<Camera>(IDENTITY);
	/** The camera that "fit" made, while the user has not moved it. Then a new size of the view refits. */
	let fitted: Camera | null = null;
	const screenOf = (p: Point) => toScreen(camera, p);
	// The dots of the background move and scale with the camera (a sparser grid when it is small).
	const dotGap = $derived((camera.scale < 0.5 ? 80 : 20) * camera.scale);
	// Set with the CSSOM, not as a style attribute: the page's security policy blocks that.
	$effect(() => {
		viewport.style.backgroundSize = `${dotGap}px ${dotGap}px`;
		viewport.style.backgroundPosition = `${camera.x}px ${camera.y}px`;
	});

	/** The part of the drawing to show for "fit": the machine, or nothing if it is empty. */
	const machineBounds = () => (view.doc.states.length === 0 ? null : shapes.bounds);
	const viewSize = () => ({ width: viewport.clientWidth, height: viewport.clientHeight });

	// The view gets its final size a moment after the first draw (fonts, the bars): until the user
	// moves the camera, a new size fits the machine again.
	$effect(() => {
		const { width, height } = size;
		if (width <= 0 || height <= 0) return;
		untrack(() => {
			if (fitted !== null && camera === fitted)
				camera = fitted = fit(machineBounds(), { width, height });
		});
	});

	/** The buttons and the keys of the zoom. All of them zoom around the middle of the view. */
	export function zoom(mode: 'in' | 'out' | 'reset' | 'fit') {
		const now = viewSize();
		const middle = { x: now.width / 2, y: now.height / 2 };
		if (mode === 'in') camera = zoomBy(camera, middle, ZOOM_STEP);
		else if (mode === 'out') camera = zoomBy(camera, middle, 1 / ZOOM_STEP);
		else if (mode === 'reset') camera = zoomAt(camera, middle, 1);
		else camera = fitted = fit(machineBounds(), now);
	}

	// ---- coordinates: from the screen to the canvas, with the matrix of the moved group ----

	function toCanvas(event: { clientX: number; clientY: number }): Point {
		const matrix = world.getScreenCTM();
		if (!matrix) return { x: 0, y: 0 };
		const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
		return { x: p.x, y: p.y };
	}

	/** The center of the part of the canvas that is on the screen. */
	const visibleCenter = (): Point => centerOf(camera, viewSize());

	/** The edge (from → to) that an element belongs to. */
	const edgeOf = (target: EventTarget | null): { from: number; to: number } | undefined => {
		const key = (target as Element | null)?.closest?.('[data-edge]')?.getAttribute('data-edge');
		if (!key) return undefined;
		const [from, to] = key.split('>').map(Number);
		return { from: from!, to: to! };
	};
	const edgeNode = (edge: { from: number; to: number }) =>
		svg.querySelector<SVGElement>(`g.edge-node[data-edge="${edge.from}>${edge.to}"]`);
	/** Edges are targets in Pilih and Hapus; in the other tools they are part of the empty canvas. */
	const edgesHit = () => view.tool === 'select' || view.tool === 'delete';

	const stateIdOf = (target: EventTarget | null): number | undefined => {
		const node = (target as Element | null)?.closest?.('[data-state]');
		return node ? Number(node.getAttribute('data-state')) : undefined;
	};

	// ---- the pointer ----

	// How far the pointer must move before a press becomes a drag: 4 for a mouse, 8 for a finger.
	const threshold = (type: string) => (type === 'mouse' ? 4 : 8);

	type Press =
		| {
				kind: 'state';
				id: number;
				pointerId: number;
				type: string;
				from: Point;
				dragging: boolean;
				consumed: boolean;
		  }
		| {
				kind: 'edge';
				edge: { from: number; to: number };
				pointerId: number;
				type: string;
				from: Point;
				marquee: false;
				moved: boolean;
				consumed: boolean;
		  }
		| {
				kind: 'empty';
				pointerId: number;
				type: string;
				from: Point;
				marquee: boolean;
				moved: boolean;
				consumed: boolean;
		  };
	let press: Press | null = null;
	let lastInput: 'pointer' | 'keyboard' = 'pointer';
	/** Where the press began on the screen, and the camera then, when the press pans. */
	let pressClient = { x: 0, y: 0 };
	let panFrom: Camera | null = null;
	let spaceDown = false;

	// ---- two fingers: a pinch ----

	// The fingers that are on the canvas, on the screen. A second finger ends whatever the first one
	// began (a drag, a long-press, an arrow) and starts a pinch: the zoom follows the distance between
	// the fingers, and the point between them stays between them. Until every finger is lifted, no
	// finger starts anything new.
	let fingers: { id: number; x: number; y: number }[] = [];
	const touchAt = (id: number) => fingers.find((f) => f.id === id);
	const touchSet = (id: number, x: number, y: number) => {
		fingers = [...fingers.filter((f) => f.id !== id), { id, x, y }];
	};
	let pinching: { camera: Camera; ids: [number, number]; from: { a: Point; b: Point } } | null =
		null;
	let waitForLift = false;

	/** A point of the screen as a point of the view (the camera works in the view). */
	function inView(p: { x: number; y: number }): Point {
		const box = viewport.getBoundingClientRect();
		return { x: p.x - box.left, y: p.y - box.top };
	}

	/** What the first finger began is dropped: a drag goes back, a long-press does not open. */
	function abortPress() {
		clearTimeout(longPress);
		pending = null;
		const done = press;
		press = null;
		panFrom = null;
		if (!done) return;
		if (svg.hasPointerCapture(done.pointerId)) svg.releasePointerCapture(done.pointerId);
		if (done.kind === 'state' && done.dragging) {
			if (view.tool === 'transition') editor.finishLink(null);
			else editor.cancelDrag();
		}
		if (done.kind === 'empty' && done.marquee) editor.escape();
	}

	/** Returns true when the event belongs to a pinch (or to a finger that must wait). */
	function fingerDown(event: PointerEvent): boolean {
		touchSet(event.pointerId, event.clientX, event.clientY);
		if (fingers.length === 2) {
			abortPress();
			waitForLift = true;
			svg.setPointerCapture(event.pointerId);
			const [a, b] = fingers as [(typeof fingers)[number], (typeof fingers)[number]];
			pinching = { camera, ids: [a.id, b.id], from: { a: inView(a), b: inView(b) } };
			return true;
		}
		return fingers.length > 2 || waitForLift;
	}

	function fingerMove(event: PointerEvent): boolean {
		if (!touchAt(event.pointerId)) return false;
		touchSet(event.pointerId, event.clientX, event.clientY);
		if (!pinching) return waitForLift;
		const [a, b] = pinching.ids;
		const pa = touchAt(a);
		const pb = touchAt(b);
		if (pa && pb) camera = pinch(pinching.camera, pinching.from, { a: inView(pa), b: inView(pb) });
		return true;
	}

	/** A finger is up or was taken away. Returns true if it was part of a pinch or had to wait. */
	function fingerUp(event: PointerEvent): boolean {
		if (!touchAt(event.pointerId)) return false;
		fingers = fingers.filter((f) => f.id !== event.pointerId);
		const was = waitForLift;
		if (pinching && pinching.ids.includes(event.pointerId)) pinching = null;
		if (fingers.length === 0) waitForLift = false;
		return was;
	}

	// The preview is updated at most once for each frame, and the last place wins.
	let pending: { point: Point; snap: boolean; link: boolean } | null = null;
	let frame = 0;
	function flush() {
		frame = 0;
		if (pending) {
			if (pending.link) editor.moveLink(pending.point);
			else editor.dragTo(pending.point, pending.snap);
		}
		pending = null;
	}
	function dragTo(point: Point, snap: boolean, link = false) {
		pending = { point, snap, link };
		if (!frame) frame = requestAnimationFrame(flush);
	}

	// ---- the menu: a right-click, or a long-press with a finger ----

	const LONG_PRESS_MS = 500;
	let menu = $state<{
		target: MenuTarget;
		x: number;
		y: number;
		at: Point;
		touch: boolean;
	} | null>(null);
	let longPress: ReturnType<typeof setTimeout> | undefined;
	let refused = $state<string | null>(null);
	let labelProblem = $state<string | null>(null);
	$effect(() => {
		if (!view.labeling) labelProblem = null;
	});

	function openMenu(
		target: MenuTarget,
		screen: { x: number; y: number },
		at: Point,
		touch = false
	) {
		if (target.kind === 'state' && !view.selection.includes(target.id)) {
			editor.selectOnly(target.id);
		} else if (target.kind === 'edge') {
			editor.selectEdge(target.from, target.to);
		}
		menu = { target, x: screen.x, y: screen.y, at, touch };
	}

	function closeMenu() {
		const open = menu;
		menu = null;
		// The focus goes back to what was pressed.
		if (open?.target.kind === 'state') {
			editor.focusState(open.target.id, { keepSelection: true });
		} else if (open?.target.kind === 'edge') {
			edgeNode(open.target)?.focus({ preventScroll: true });
		} else {
			viewport.focus({ preventScroll: true });
		}
	}

	function pick(item: MenuItem) {
		const open = menu;
		menu = null;
		viewport.focus({ preventScroll: true });
		switch (item.action) {
			case 'rename':
				refused = null;
				editor.startRename();
				break;
			case 'start':
				editor.toggleStart();
				break;
			case 'accepting':
				editor.toggleAccepting();
				break;
			case 'edit':
				editor.editEdge();
				break;
			case 'link':
				if (open?.target.kind === 'state') editor.linkFrom(open.target.id);
				break;
			case 'delete':
				editor.deleteSelected();
				break;
			case 'add':
				if (open) editor.addStateAt(open.at);
				break;
		}
	}

	function oncontextmenu(event: MouseEvent) {
		// The browser's own menu would cover ours.
		event.preventDefault();
		// The zoom control has no menu.
		if ((event.target as Element).closest('.zoom')) return;
		const id = stateIdOf(event.target);
		const edge = id === undefined ? edgeOf(event.target) : undefined;
		let screen = { x: event.clientX, y: event.clientY };
		if ((id !== undefined || edge) && screen.x === 0 && screen.y === 0) {
			// From the keyboard (the menu key): at the state or the edge.
			const box = (event.target as Element)
				.closest('[data-state],[data-edge]')!
				.getBoundingClientRect();
			screen = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
		}
		openMenu(
			id !== undefined
				? { kind: 'state', id }
				: edge
					? { kind: 'edge', ...edge }
					: { kind: 'canvas' },
			screen,
			toCanvas(event)
		);
	}

	/** The state under the pointer. While a pointer is captured the target is the svg, so ask the page. */
	const stateAtPointer = (event: { clientX: number; clientY: number }) =>
		stateIdOf(document.elementFromPoint(event.clientX, event.clientY));
	// Where the pointer was at its last move: the end of a touch does not always carry a place.
	let lastMove = { clientX: 0, clientY: 0 };

	function onpointerdown(event: PointerEvent) {
		// The middle button always pans, wherever it is pressed.
		const middle = event.button === 1;
		if (event.pointerType === 'touch' && fingerDown(event)) return;
		if ((event.button !== 0 && !middle) || press) return;
		lastInput = 'pointer';
		const id = middle ? undefined : stateIdOf(event.target);
		const edge = id === undefined && !middle && edgesHit() ? edgeOf(event.target) : undefined;
		const from = toCanvas(event);
		pressClient = { x: event.clientX, y: event.clientY };
		panFrom = null;
		if (edge) {
			edgeNode(edge)?.focus({ preventScroll: true });
			press = {
				kind: 'edge',
				edge,
				pointerId: event.pointerId,
				type: event.pointerType,
				from,
				marquee: false,
				moved: false,
				consumed: false
			};
		} else if (id !== undefined) {
			// A mouse press does not move the focus by itself (it is prevented below): the keys
			// (A, M, Enter, Delete) must reach the state that was pressed.
			(event.target as Element).closest<SVGElement>('[data-state]')?.focus({ preventScroll: true });
			press = {
				kind: 'state',
				id,
				pointerId: event.pointerId,
				type: event.pointerType,
				from,
				dragging: false,
				consumed: false
			};
		} else {
			// A rectangle with Shift and a mouse. Otherwise a drag on empty canvas pans: with a finger,
			// with the middle button, with Space held, and with a mouse in Pilih.
			const marquee =
				!middle && view.tool === 'select' && event.shiftKey && event.pointerType === 'mouse';
			press = {
				kind: 'empty',
				pointerId: event.pointerId,
				type: event.pointerType,
				from,
				marquee,
				moved: false,
				consumed: false
			};
			if (marquee) editor.startMarquee(from);
			viewport.focus({ preventScroll: true });
		}
		if ((press.kind === 'empty' && !press.marquee) || press.kind === 'edge') {
			const mouseInSelect = event.pointerType === 'mouse' && view.tool === 'select';
			if (middle || spaceDown || event.pointerType !== 'mouse' || mouseInSelect) panFrom = camera;
		}
		// A finger that stays in place opens the menu.
		if (event.pointerType !== 'mouse') {
			const target: MenuTarget =
				id !== undefined
					? { kind: 'state', id }
					: edge
						? { kind: 'edge', ...edge }
						: { kind: 'canvas' };
			const screen = { x: event.clientX, y: event.clientY };
			clearTimeout(longPress);
			longPress = setTimeout(() => {
				if (!press) return;
				press.consumed = true;
				openMenu(target, screen, from, true);
			}, LONG_PRESS_MS);
		}
		// The pointer stays ours until it is released, also outside the canvas.
		svg.setPointerCapture(event.pointerId);
		if (event.pointerType === 'mouse' || middle) event.preventDefault();
	}

	function onpointermove(event: PointerEvent) {
		if (event.pointerType === 'touch' && fingerMove(event)) return;
		// With a source chosen, the preview follows a mouse that is not pressed.
		if (!press && view.link && event.pointerType === 'mouse') dragTo(toCanvas(event), false, true);
		if (!press || event.pointerId !== press.pointerId) return;
		lastMove = { clientX: event.clientX, clientY: event.clientY };
		const point = toCanvas(event);
		// The distance is on the screen, whatever the zoom.
		const far =
			Math.hypot(event.clientX - pressClient.x, event.clientY - pressClient.y) >=
			threshold(press.type);
		if (far) clearTimeout(longPress);
		if (press.consumed) return;
		if (panFrom && (press.kind === 'empty' || press.kind === 'edge')) {
			if (far || press.moved) {
				press.moved = true;
				camera = panBy(panFrom, event.clientX - pressClient.x, event.clientY - pressClient.y);
			}
			return;
		}
		if (press.kind === 'state') {
			const linking = view.tool === 'transition';
			if (!press.dragging && far && view.tool !== 'delete') {
				press.dragging = true;
				// In Transisi a drag from a state is an arrow, never a move.
				if (linking) editor.startLink(press.id);
				else editor.beginDrag(press.id, press.from);
			}
			if (press.dragging) dragTo(point, event.shiftKey, linking);
		} else if (press.marquee) {
			editor.moveMarquee(point);
		} else if (far) {
			press.moved = true;
		}
	}

	function onpointerup(event: PointerEvent) {
		if (event.pointerType === 'touch' && fingerUp(event)) {
			if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
			return;
		}
		if (!press || event.pointerId !== press.pointerId) return;
		const done = press;
		press = null;
		clearTimeout(longPress);
		if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
		if (done.consumed) return;
		if (done.kind === 'state') {
			if (done.dragging) {
				flush();
				// A release on empty canvas cancels the arrow.
				if (view.tool === 'transition') editor.finishLink(stateAtPointer(lastMove) ?? null);
				else editor.endDrag();
			} else if (view.tool === 'transition') {
				// A click: the first one chooses the source, the second one the target.
				if (view.link) editor.finishLink(done.id);
				else editor.startLink(done.id);
			} else if (view.tool === 'delete') {
				editor.deleteStates([done.id]);
			} else if (event.shiftKey || event.ctrlKey || event.metaKey) {
				editor.toggle(done.id);
			} else {
				editor.selectOnly(done.id);
			}
		} else if (done.kind === 'edge') {
			if (done.moved) return;
			if (view.tool === 'delete') editor.deleteEdge(done.edge.from, done.edge.to);
			else editor.selectEdge(done.edge.from, done.edge.to);
		} else if (done.marquee) {
			editor.endMarquee();
		} else if (!done.moved) {
			// A click or a tap on empty canvas.
			if (view.tool === 'addState') editor.addStateAt(toCanvas(event));
			else if (view.tool === 'select') editor.clearSelection();
			else if (view.tool === 'transition') editor.finishLink(null);
		}
	}

	function onpointercancel(event: PointerEvent) {
		if (event.pointerType === 'touch' && fingerUp(event)) return;
		if (!press || event.pointerId !== press.pointerId) return;
		// The browser took the touch (to scroll the page, for example).
		const done = press;
		press = null;
		pending = null;
		clearTimeout(longPress);
		if (done.kind === 'state' && done.dragging) {
			if (view.tool === 'transition') editor.finishLink(null);
			else editor.cancelDrag();
		}
		if (done.kind === 'empty' && done.marquee) editor.escape();
	}

	/**
	 * A double-click on a state in Pilih toggles accepting. On empty canvas it adds a state, in any
	 * tool (the State tool already adds on a click).
	 */
	function ondblclick(event: MouseEvent) {
		// While a pointer is captured the target is the svg: ask for what is at the pointer.
		const under = document.elementFromPoint(event.clientX, event.clientY);
		const id = stateIdOf(under);
		const edge = id === undefined ? edgeOf(under) : undefined;
		if (edge) {
			// A double-click on an edge or its label edits its symbols.
			if (view.tool === 'select') {
				editor.selectEdge(edge.from, edge.to);
				editor.editEdge();
			}
		} else if (id !== undefined) {
			if (view.tool !== 'select') return;
			if (view.selection.length !== 1 || view.selection[0] !== id) editor.selectOnly(id);
			editor.toggleAccepting();
		} else if (view.tool !== 'addState') {
			editor.addStateAt(toCanvas(event));
		}
	}

	// ---- the keyboard ----

	function onkeydown(event: KeyboardEvent) {
		lastInput = 'keyboard';
		if (event.key === ' ') spaceDown = true;
		const action = keyAction(
			{
				key: event.key,
				ctrl: event.ctrlKey,
				meta: event.metaKey,
				shift: event.shiftKey,
				alt: event.altKey
			},
			{ fieldOpen: view.renaming !== null || view.labeling !== null || menu !== null }
		);
		if (!action) return;
		event.preventDefault();
		switch (action.type) {
			case 'tool':
				editor.setTool(action.tool);
				// T with a state selected: that state is the source.
				if (action.tool === 'transition') editor.linkAtFocus();
				break;
			case 'newState':
				editor.addStateNear(visibleCenter());
				break;
			case 'delete':
				editor.deleteSelected();
				break;
			case 'selectAll':
				editor.selectAll();
				break;
			case 'escape':
				editor.escape();
				break;
			case 'undo':
				editor.undo();
				break;
			case 'redo':
				editor.redo();
				break;
			case 'nudge':
				editor.nudge(action.dx, action.dy);
				break;
			case 'toggleAccepting':
				editor.toggleAccepting();
				break;
			case 'toggleStart':
				editor.toggleStart();
				break;
			case 'rename':
				// With Transisi, Enter chooses the source and then the target (it is the key of the mouse click).
				if (view.tool === 'transition') {
					editor.linkAtFocus();
				} else if (view.edge) {
					editor.editEdge();
				} else {
					refused = null;
					editor.startRename();
				}
				break;
			case 'pan':
				camera = panBy(camera, action.dx, action.dy);
				break;
			case 'zoom':
				zoom(action.mode);
				break;
			case 'toggleSelection':
				if (view.focus.id !== null) editor.toggle(view.focus.id);
				break;
			case 'focus': {
				const from = view.focus.id ?? view.selection[0] ?? view.doc.states[0]?.id;
				if (from === undefined) break;
				// With no focus yet, the first arrow goes to the state that the selection or the id order names.
				const next =
					view.focus.id === null && view.doc.states.length > 0
						? from
						: nearestInDirection(view.doc, from, action.direction);
				if (next !== undefined) editor.focusState(next, { keepSelection: action.keepSelection });
				break;
			}
		}
	}

	// ---- the focus ----

	// When the editor asks for the focus (a new state, a state that is left after a delete), the
	// view moves it. `suppress` tells the focus handler that this one was not a Tab.
	let seenRequest = 0;
	let suppress = false;
	$effect(() => {
		const { id, request, edge } = view.focus;
		if (request === seenRequest) return;
		seenRequest = request;
		untrack(() => {
			const target =
				id !== null
					? (svg.querySelector<SVGElement>(`[data-state="${id}"]`) ?? viewport)
					: ((edge ? edgeNode(edge) : null) ?? viewport);
			suppress = true;
			target.focus({ preventScroll: true });
			suppress = false;
			// A state that is off the screen (a new one, or one reached with the arrows) is brought in.
			const place = id === null ? undefined : view.doc.states.find((s) => s.id === id);
			if (place) {
				// The whole circle, and its ring, must be in view.
				const margin = RADIUS * camera.scale + 12;
				camera = reveal(camera, { x: place.x, y: place.y }, viewSize(), margin);
			}
		});
	});

	function onfocusin(event: FocusEvent) {
		const id = stateIdOf(event.target);
		if (id === undefined) {
			// An edge that the focus reaches with Tab is selected (a press selects it by itself).
			const edge = edgeOf(event.target);
			if (edge && !suppress && lastInput === 'keyboard') editor.selectEdge(edge.from, edge.to);
			return;
		}
		if (suppress || lastInput === 'pointer') {
			editor.noteFocus(id);
		} else {
			// The focus came with Tab: the selection follows it (Ctrl+Arrow keeps the selection).
			editor.focusState(id, { keepSelection: false });
		}
	}

	function onfocusout(event: FocusEvent) {
		// The name box and the menu come and go: when one is removed, the focus is not lost, it is
		// moved by the view (see above), and a late "left" must not cancel that move.
		if (
			event.target !== viewport &&
			stateIdOf(event.target) === undefined &&
			edgeOf(event.target) === undefined
		) {
			return;
		}
		const next = event.relatedTarget as Node | null;
		if (next && viewport.contains(next)) return;
		// The focus left the canvas: a series of keyboard moves ends here.
		editor.seal();
		editor.noteFocus(null);
	}

	function onkeyup(event: KeyboardEvent) {
		if (event.key === ' ') spaceDown = false;
	}

	// Open with the whole machine in view; an empty canvas opens at 100% at the origin.
	onMount(() => {
		camera = fitted = fit(machineBounds(), viewSize());

		// The wheel and the trackpad: Ctrl or Cmd zooms around the pointer (a trackpad pinch arrives
		// like this too), and without them the view pans. The page itself never scrolls.
		const onwheel = (event: WheelEvent) => {
			event.preventDefault();
			const box = viewport.getBoundingClientRect();
			camera = wheel(camera, {
				deltaX: event.deltaX,
				deltaY: event.deltaY,
				deltaMode: event.deltaMode,
				ctrlKey: event.ctrlKey || event.metaKey,
				x: event.clientX - box.left,
				y: event.clientY - box.top
			});
		};
		viewport.addEventListener('wheel', onwheel, { passive: false });

		// A finger that touches a state belongs to the editor: no scroll takes it over (that would
		// cancel a drag), and the browser does not send the mouse events that follow a tap. Those
		// arrive after the tap has been handled, land on the state under the finger and take the
		// focus from a box that the tap has just opened. A listener is needed (and not the CSS
		// touch-action alone) because it must be able to cancel, so it cannot be passive.
		const keepTouch = (event: TouchEvent) => event.preventDefault();
		svg.addEventListener('touchstart', keepTouch, { passive: false });
		return () => {
			viewport.removeEventListener('wheel', onwheel);
			svg.removeEventListener('touchstart', keepTouch);
		};
	});
</script>

<!--
	The canvas is a custom widget (role application): it takes the keyboard to handle its own keys
	(the key table in interaction/keys.ts), so it needs a tab stop and key handlers. A screen-reader
	user has the table view (S5) as the alternative. These are the only two warnings that are ignored.
-->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
	class="viewport"
	bind:this={viewport}
	role="application"
	aria-label={t('editor.canvas')}
	tabindex="0"
	{onkeydown}
	{onkeyup}
	{onfocusin}
	{onfocusout}
	{oncontextmenu}
	bind:clientWidth={size.width}
	bind:clientHeight={size.height}
>
	<svg
		class="world"
		bind:this={svg}
		role="presentation"
		{onpointerdown}
		{onpointermove}
		{onpointerup}
		{onpointercancel}
		{ondblclick}
	>
		<g bind:this={world} transform="translate({camera.x} {camera.y}) scale({camera.scale})">
			<DiagramDrawing {shapes} {arrow} {selected} selectedEdge={view.edge} interactive />
			{#if preview}
				<line
					class="preview"
					x1={preview.from.x}
					y1={preview.from.y}
					x2={preview.to.x}
					y2={preview.to.y}
					marker-end="url(#{arrow})"
				/>
			{/if}
			{#if view.marquee}
				<rect
					class="marquee"
					x={Math.min(view.marquee.x, view.marquee.x + view.marquee.width)}
					y={Math.min(view.marquee.y, view.marquee.y + view.marquee.height)}
					width={Math.abs(view.marquee.width)}
					height={Math.abs(view.marquee.height)}
				/>
			{/if}
		</g>
	</svg>
	{#if renamed}
		<RenameField
			x={screenOf(renamed).x}
			y={screenOf(renamed).y}
			name={renamed.name}
			problem={refused}
			oncommit={(name) => {
				const problem = editor.commitRename(name);
				refused = problem ? t(problem.key as MessageKey, problem.params) : null;
			}}
			oncancel={() => editor.cancelRename()}
		/>
	{/if}
	{#if view.labeling && labelAt}
		<LabelField
			x={screenOf(labelAt).x}
			y={screenOf(labelAt).y}
			initial={labelAt.initial}
			problem={labelProblem}
			ask={view.labeling.ask}
			oncommit={(text, split) => {
				const result = editor.commitLabel(text, split);
				labelProblem =
					result && 'key' in result ? t(result.key as MessageKey, result.params) : null;
			}}
			oncancel={() => editor.cancelLabel()}
			onleave={(text) => {
				// Leaving the box sends a text that changed, and cancels in every other case.
				if (text.trim() === labelAt?.initial || editor.commitLabel(text) !== null) {
					editor.cancelLabel();
				}
			}}
		/>
	{/if}
	{#if menu}
		<ContextMenu
			items={menuItems(menu.target, view.doc, view.selection)}
			x={menu.x}
			y={menu.y}
			guarded={menu.touch}
			onpick={pick}
			onclose={closeMenu}
		/>
	{/if}
	<ZoomControl
		percent={percent(camera)}
		onin={() => zoom('in')}
		onout={() => zoom('out')}
		onreset={() => zoom('reset')}
		onfit={() => zoom('fit')}
	/>
	{#if view.doc.states.length === 0}
		<p class="hint">{t('editor.hint_empty')}</p>
	{/if}
</div>

<style>
	.viewport {
		position: relative;
		flex: 1;
		min-height: 0;
		min-width: 0;
		overflow: clip;
		background-color: var(--color-ground);
		background-image: radial-gradient(var(--color-canvas-dot) 1px, transparent 1px);
		background-size: 20px 20px;
		/* The editor pans and zooms by itself: no gesture of the browser takes a touch. */
		touch-action: none;
		overscroll-behavior: none;
	}
	.viewport:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: calc(var(--focus-ring-width) * -1);
	}
	.world {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		touch-action: none;
		display: block;
		user-select: none;
		-webkit-user-select: none;
	}
	.preview {
		stroke: var(--color-accent);
		stroke-width: 2;
		stroke-dasharray: 6 4;
		pointer-events: none;
	}
	.marquee {
		fill: var(--color-accent-tint);
		fill-opacity: 0.5;
		stroke: var(--color-accent);
		stroke-width: 1;
		stroke-dasharray: 4 3;
		pointer-events: none;
	}
	.hint {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0;
		padding: var(--space-4);
		text-align: center;
		color: var(--color-muted);
		pointer-events: none;
	}
</style>
