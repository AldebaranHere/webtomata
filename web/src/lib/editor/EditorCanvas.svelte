<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { MessageKey } from '#lib/i18n/id.ts';
	import DiagramDrawing from './diagram/DiagramDrawing.svelte';
	import { edgeGeometry } from './diagram/geometry.ts';
	import ContextMenu from './ContextMenu.svelte';
	import type { MachineDocument } from './document.ts';
	import RenameField from './RenameField.svelte';
	import { WORLD } from './interaction/canvas.ts';
	import type { Point } from './interaction/canvas.ts';
	import type { Editor, EditorState } from './interaction/editor.ts';
	import { keyAction } from './interaction/keys.ts';
	import { menuItems } from './interaction/menu.ts';
	import type { MenuItem, MenuTarget } from './interaction/menu.ts';
	import { nearestInDirection } from './interaction/selection.ts';

	// The canvas of the editor: the drawing, and the pointer and keyboard. It turns what the user
	// does into calls of the editor (interaction/editor.ts), where the rules are. The world is
	// 1600 by 1000 units shown at 100%, and the browser scrolls it (S4d adds pan and zoom).
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
	const renamed = $derived(view.doc.states.find((s) => s.id === view.renaming));

	let viewport: HTMLDivElement;
	let svg: SVGSVGElement;

	// ---- coordinates: from the screen to the canvas, with the matrix of the svg ----

	function toCanvas(event: { clientX: number; clientY: number }): Point {
		const matrix = svg.getScreenCTM();
		if (!matrix) return { x: 0, y: 0 };
		const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
		return { x: p.x, y: p.y };
	}

	/** The center of the part of the canvas that is on the screen. */
	const visibleCenter = (): Point => ({
		x: viewport.scrollLeft + viewport.clientWidth / 2,
		y: viewport.scrollTop + viewport.clientHeight / 2
	});

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

	// The preview is updated at most once for each frame, and the last place wins.
	let pending: { point: Point; snap: boolean } | null = null;
	let frame = 0;
	function flush() {
		frame = 0;
		if (pending) editor.dragTo(pending.point, pending.snap);
		pending = null;
	}
	function dragTo(point: Point, snap: boolean) {
		pending = { point, snap };
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

	function openMenu(
		target: MenuTarget,
		screen: { x: number; y: number },
		at: Point,
		touch = false
	) {
		if (target.kind === 'state' && !view.selection.includes(target.id)) {
			editor.selectOnly(target.id);
		}
		menu = { target, x: screen.x, y: screen.y, at, touch };
	}

	function closeMenu() {
		const open = menu;
		menu = null;
		// The focus goes back to what was pressed.
		if (open?.target.kind === 'state') {
			editor.focusState(open.target.id, { keepSelection: true });
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
		const id = stateIdOf(event.target);
		let screen = { x: event.clientX, y: event.clientY };
		if (id !== undefined && screen.x === 0 && screen.y === 0) {
			// From the keyboard (the menu key): at the state.
			const box = (event.target as Element).closest('[data-state]')!.getBoundingClientRect();
			screen = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
		}
		openMenu(
			id === undefined ? { kind: 'canvas' } : { kind: 'state', id },
			screen,
			toCanvas(event)
		);
	}

	function onpointerdown(event: PointerEvent) {
		if (event.button !== 0 || press) return;
		lastInput = 'pointer';
		const id = stateIdOf(event.target);
		const from = toCanvas(event);
		if (id !== undefined) {
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
			// A rectangle with Shift and a mouse; a finger on empty canvas scrolls the page instead.
			const marquee = view.tool === 'select' && event.shiftKey && event.pointerType === 'mouse';
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
		// A finger that stays in place opens the menu.
		if (event.pointerType !== 'mouse') {
			const target: MenuTarget = id === undefined ? { kind: 'canvas' } : { kind: 'state', id };
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
		if (event.pointerType === 'mouse') event.preventDefault();
	}

	function onpointermove(event: PointerEvent) {
		if (!press || event.pointerId !== press.pointerId) return;
		const point = toCanvas(event);
		const far = Math.hypot(point.x - press.from.x, point.y - press.from.y) >= threshold(press.type);
		if (far) clearTimeout(longPress);
		if (press.consumed) return;
		if (press.kind === 'state') {
			if (!press.dragging && far && view.tool !== 'delete') {
				press.dragging = true;
				editor.beginDrag(press.id, press.from);
			}
			if (press.dragging) dragTo(point, event.shiftKey);
		} else if (press.marquee) {
			editor.moveMarquee(point);
		} else if (far) {
			press.moved = true;
		}
	}

	function onpointerup(event: PointerEvent) {
		if (!press || event.pointerId !== press.pointerId) return;
		const done = press;
		press = null;
		clearTimeout(longPress);
		if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
		if (done.consumed) return;
		if (done.kind === 'state') {
			if (done.dragging) {
				flush();
				editor.endDrag();
			} else if (view.tool === 'delete') {
				editor.deleteStates([done.id]);
			} else if (event.shiftKey || event.ctrlKey || event.metaKey) {
				editor.toggle(done.id);
			} else {
				editor.selectOnly(done.id);
			}
		} else if (done.marquee) {
			editor.endMarquee();
		} else if (!done.moved) {
			// A click or a tap on empty canvas.
			if (view.tool === 'addState') editor.addStateAt(toCanvas(event));
			else if (view.tool === 'select') editor.clearSelection();
		}
	}

	function onpointercancel(event: PointerEvent) {
		if (!press || event.pointerId !== press.pointerId) return;
		// The browser took the touch (to scroll the page, for example).
		const done = press;
		press = null;
		pending = null;
		clearTimeout(longPress);
		if (done.kind === 'state' && done.dragging) editor.cancelDrag();
		if (done.kind === 'empty' && done.marquee) editor.escape();
	}

	/**
	 * A double-click on a state in Pilih toggles accepting. On empty canvas it adds a state, in any
	 * tool (the State tool already adds on a click).
	 */
	function ondblclick(event: MouseEvent) {
		// While a pointer is captured the target is the svg: ask for what is at the pointer.
		const id = stateIdOf(document.elementFromPoint(event.clientX, event.clientY));
		if (id !== undefined) {
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
		const action = keyAction(
			{
				key: event.key,
				ctrl: event.ctrlKey,
				meta: event.metaKey,
				shift: event.shiftKey,
				alt: event.altKey
			},
			{ fieldOpen: view.renaming !== null || menu !== null }
		);
		if (!action) return;
		event.preventDefault();
		switch (action.type) {
			case 'tool':
				editor.setTool(action.tool);
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
				// Enter on a button is a press: only a selected state is renamed.
				refused = null;
				editor.startRename();
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
		const { id, request } = view.focus;
		if (request === seenRequest) return;
		seenRequest = request;
		untrack(() => {
			const target =
				id === null
					? viewport
					: (svg.querySelector<SVGElement>(`[data-state="${id}"]`) ?? viewport);
			suppress = true;
			target.focus();
			suppress = false;
		});
	});

	function onfocusin(event: FocusEvent) {
		const id = stateIdOf(event.target);
		if (id === undefined) return;
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
		if (event.target !== viewport && stateIdOf(event.target) === undefined) return;
		const next = event.relatedTarget as Node | null;
		if (next && viewport.contains(next)) return;
		// The focus left the canvas: a series of keyboard moves ends here.
		editor.seal();
		editor.noteFocus(null);
	}

	// Open with the machine in the middle of the screen.
	onMount(() => {
		const { bounds } = shapes;
		viewport.scrollLeft = Math.max(0, bounds.x + bounds.width / 2 - viewport.clientWidth / 2);
		viewport.scrollTop = Math.max(0, bounds.y + bounds.height / 2 - viewport.clientHeight / 2);
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
	{onfocusin}
	{onfocusout}
	{oncontextmenu}
>
	<svg
		class="world"
		bind:this={svg}
		width={WORLD.width}
		height={WORLD.height}
		viewBox="0 0 {WORLD.width} {WORLD.height}"
		role="presentation"
		{onpointerdown}
		{onpointermove}
		{onpointerup}
		{onpointercancel}
		{ondblclick}
	>
		<rect class="ground" width={WORLD.width} height={WORLD.height} />
		<DiagramDrawing {shapes} {arrow} {selected} interactive />
		{#if view.marquee}
			<rect
				class="marquee"
				x={Math.min(view.marquee.x, view.marquee.x + view.marquee.width)}
				y={Math.min(view.marquee.y, view.marquee.y + view.marquee.height)}
				width={Math.abs(view.marquee.width)}
				height={Math.abs(view.marquee.height)}
			/>
		{/if}
	</svg>
	{#if renamed}
		<RenameField
			x={renamed.x}
			y={renamed.y}
			name={renamed.name}
			problem={refused}
			oncommit={(name) => {
				const problem = editor.commitRename(name);
				refused = problem ? t(problem.key as MessageKey, problem.params) : null;
			}}
			oncancel={() => editor.cancelRename()}
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
		overflow: auto;
		background-color: var(--color-ground);
		background-image: radial-gradient(var(--color-canvas-dot) 1px, transparent 1px);
		background-size: 20px 20px;
		/* A finger on empty canvas scrolls; a state keeps its touch for the drag (touch-action: none). */
		touch-action: pan-x pan-y;
	}
	.viewport:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: calc(var(--focus-ring-width) * -1);
	}
	.world {
		display: block;
		user-select: none;
		-webkit-user-select: none;
	}
	.ground {
		fill: transparent;
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
