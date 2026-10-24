<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import DiagramDrawing from './diagram/DiagramDrawing.svelte';
	import { edgeGeometry } from './diagram/geometry.ts';
	import type { MachineDocument } from './document.ts';
	import { WORLD } from './interaction/canvas.ts';
	import type { Point } from './interaction/canvas.ts';
	import type { Editor, EditorState } from './interaction/editor.ts';
	import { keyAction } from './interaction/keys.ts';
	import { nearestInDirection } from './interaction/selection.ts';

	// The canvas of the editor: the drawing, and the pointer and keyboard. It turns what the user
	// does into calls of the editor (interaction/editor.ts), where the rules are. The world is
	// 1600 by 1000 units shown at 100%, and the browser scrolls it (S4d adds pan and zoom).
	let { editor, state }: { editor: Editor; state: EditorState } = $props();

	const uid = $props.id();
	const arrow = `${uid}-arrow`;

	// While a drag is under way, the states are drawn at their preview places.
	const shown = $derived.by((): MachineDocument => {
		const preview = state.preview;
		if (!preview) return state.doc;
		return {
			...state.doc,
			states: state.doc.states.map((s) => {
				const place = preview.get(s.id);
				return place ? { ...s, x: place.x, y: place.y } : s;
			})
		};
	});
	const shapes = $derived(edgeGeometry(shown, { startLabel: t('diagram.start') }));
	const selected = $derived(new Set(state.selection));

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
		| { kind: 'state'; id: number; pointerId: number; type: string; from: Point; dragging: boolean }
		| {
				kind: 'empty';
				pointerId: number;
				type: string;
				from: Point;
				marquee: boolean;
				moved: boolean;
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

	function onpointerdown(event: PointerEvent) {
		if (event.button !== 0 || press) return;
		lastInput = 'pointer';
		const id = stateIdOf(event.target);
		const from = toCanvas(event);
		if (id !== undefined) {
			press = {
				kind: 'state',
				id,
				pointerId: event.pointerId,
				type: event.pointerType,
				from,
				dragging: false
			};
		} else {
			// A rectangle with Shift and a mouse; a finger on empty canvas scrolls the page instead.
			const marquee = state.tool === 'select' && event.shiftKey && event.pointerType === 'mouse';
			press = {
				kind: 'empty',
				pointerId: event.pointerId,
				type: event.pointerType,
				from,
				marquee,
				moved: false
			};
			if (marquee) editor.startMarquee(from);
			viewport.focus({ preventScroll: true });
		}
		// The pointer stays ours until it is released, also outside the canvas.
		svg.setPointerCapture(event.pointerId);
		if (event.pointerType === 'mouse') event.preventDefault();
	}

	function onpointermove(event: PointerEvent) {
		if (!press || event.pointerId !== press.pointerId) return;
		const point = toCanvas(event);
		const far = Math.hypot(point.x - press.from.x, point.y - press.from.y) >= threshold(press.type);
		if (press.kind === 'state') {
			if (!press.dragging && far && state.tool !== 'delete') {
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
		if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
		if (done.kind === 'state') {
			if (done.dragging) {
				flush();
				editor.endDrag();
			} else if (state.tool === 'delete') {
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
			if (state.tool === 'addState') editor.addStateAt(toCanvas(event));
			else if (state.tool === 'select') editor.clearSelection();
		}
	}

	function onpointercancel(event: PointerEvent) {
		if (!press || event.pointerId !== press.pointerId) return;
		// The browser took the touch (to scroll the page, for example).
		const done = press;
		press = null;
		pending = null;
		if (done.kind === 'state' && done.dragging) editor.cancelDrag();
		if (done.kind === 'empty' && done.marquee) editor.escape();
	}

	/** A double-click on empty canvas adds a state, in any tool (the State tool already adds on a click). */
	function ondblclick(event: MouseEvent) {
		if (stateIdOf(event.target) !== undefined || state.tool === 'addState') return;
		editor.addStateAt(toCanvas(event));
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
			{ fieldOpen: false }
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
			case 'toggleSelection':
				if (state.focus.id !== null) editor.toggle(state.focus.id);
				break;
			case 'focus': {
				const from = state.focus.id ?? state.selection[0] ?? state.doc.states[0]?.id;
				if (from === undefined) break;
				// With no focus yet, the first arrow goes to the state that the selection or the id order names.
				const next =
					state.focus.id === null && state.doc.states.length > 0
						? from
						: nearestInDirection(state.doc, from, action.direction);
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
		const { id, request } = state.focus;
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
		{#if state.marquee}
			<rect
				class="marquee"
				x={Math.min(state.marquee.x, state.marquee.x + state.marquee.width)}
				y={Math.min(state.marquee.y, state.marquee.y + state.marquee.height)}
				width={Math.abs(state.marquee.width)}
				height={Math.abs(state.marquee.height)}
			/>
		{/if}
	</svg>
	{#if state.doc.states.length === 0}
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
