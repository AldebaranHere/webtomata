<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { INNER_RADIUS, RADIUS } from './geometry.ts';
	import type { DiagramShapes, StateShape } from './geometry.ts';

	// The inside of a diagram: the lines, the circles and the labels. The read-only view and the
	// editor both use it. All the places come from edgeGeometry (geometry.ts).
	//
	// With `interactive`, each state is a button that the keyboard can reach, with a name for screen
	// readers, a ring when it is selected, and a ring when it has the focus. Each edge has a wide
	// invisible line under the circles (so a finger can hit it, and a state always wins), and a button
	// after the circles for the keyboard (states come first in the Tab order, then edges). The pointer
	// and key handlers are on the svg that holds this (they find a state by its `data-state` and an
	// edge by its `data-edge`, "from>to").
	let {
		shapes,
		arrow,
		selected = new Set<number>(),
		selectedEdge = null,
		interactive = false
	}: {
		shapes: DiagramShapes;
		/** The id of the arrowhead (it must be unique in the page). */
		arrow: string;
		selected?: ReadonlySet<number>;
		/** The edge that is selected: all the transitions from → to. */
		selectedEdge?: { from: number; to: number } | null;
		interactive?: boolean;
	} = $props();

	const chosen = (edge: { from: number; to: number }) =>
		selectedEdge !== null && selectedEdge.from === edge.from && selectedEdge.to === edge.to;
	const nameOfId = (id: number) => shapes.states.find((s) => s.id === id)?.name ?? '';

	/** "State q1, start state, accepting state". */
	function nameOf(state: StateShape): string {
		return (
			t('editor.state', { name: state.name }) +
			(shapes.start?.state === state.id ? t('editor.flag_start') : '') +
			(state.accepting ? t('editor.flag_accepting') : '')
		);
	}
</script>

<defs>
	<marker
		id={arrow}
		viewBox="0 0 10 10"
		refX="10"
		refY="5"
		markerWidth="10"
		markerHeight="10"
		markerUnits="userSpaceOnUse"
		orient="auto"
	>
		<path class="arrowhead" d="M0 0L10 5L0 10z" />
	</marker>
</defs>

<g class="lines">
	{#each shapes.edges as edge (`${edge.from}>${edge.to}`)}
		{#if interactive}
			<g class="edge" class:chosen={chosen(edge)} data-edge="{edge.from}>{edge.to}">
				<path class="hit" d={edge.path} />
				<rect
					class="hit-label"
					x={edge.label.box.x}
					y={edge.label.box.y}
					width={edge.label.box.width}
					height={edge.label.box.height}
				/>
				<path class="line" d={edge.path} marker-end="url(#{arrow})" />
			</g>
		{:else}
			<path class="line" d={edge.path} marker-end="url(#{arrow})" />
		{/if}
	{/each}
	{#if shapes.start}
		<path class="line" d={shapes.start.path} marker-end="url(#{arrow})" />
	{/if}
</g>

<g class="states">
	{#each shapes.states as state (state.id)}
		{#if interactive}
			<g
				class="node"
				data-state={state.id}
				role="button"
				tabindex="0"
				aria-label={nameOf(state)}
				aria-pressed={selected.has(state.id)}
			>
				{#if state.text.truncated}<title>{state.name}</title>{/if}
				<circle class="focus-ring" cx={state.x} cy={state.y} r={RADIUS + 9} />
				{#if selected.has(state.id)}
					<circle class="selection" cx={state.x} cy={state.y} r={RADIUS + 5} />
				{/if}
				<circle class="state" cx={state.x} cy={state.y} r={RADIUS} />
				{#if state.accepting}
					<circle class="inner" cx={state.x} cy={state.y} r={INNER_RADIUS} />
				{/if}
				<text class="name" x={state.x} y={state.y} font-size={state.text.fontSize}>
					{state.text.content}
				</text>
			</g>
		{:else}
			<g>
				{#if state.text.truncated}<title>{state.name}</title>{/if}
				<circle class="state" cx={state.x} cy={state.y} r={RADIUS} />
				{#if state.accepting}
					<circle class="inner" cx={state.x} cy={state.y} r={INNER_RADIUS} />
				{/if}
				<text class="name" x={state.x} y={state.y} font-size={state.text.fontSize}>
					{state.text.content}
				</text>
			</g>
		{/if}
	{/each}
</g>

{#if interactive}
	<g class="edge-buttons">
		{#each shapes.edges as edge (`${edge.from}>${edge.to}`)}
			<g
				class="edge-node"
				data-edge="{edge.from}>{edge.to}"
				role="button"
				tabindex="0"
				aria-label={t('editor.edge', {
					from: nameOfId(edge.from),
					to: nameOfId(edge.to),
					symbols: edge.label.text
				})}
				aria-pressed={chosen(edge)}
			>
				<path class="ring" d={edge.path} />
			</g>
		{/each}
	</g>
{/if}

<g class="labels">
	{#each shapes.edges as edge (`${edge.from}>${edge.to}`)}
		<text class="label" class:chosen={chosen(edge)} x={edge.label.center.x} y={edge.label.center.y}>
			{edge.label.text}
		</text>
	{/each}
	{#if shapes.start}
		<text class="start-label" x={shapes.start.label.center.x} y={shapes.start.label.center.y}>
			{shapes.start.label.text}
		</text>
	{/if}
</g>

<style>
	.line {
		fill: none;
		stroke: var(--color-neutral-ink);
		stroke-width: 1.5;
	}
	.arrowhead {
		fill: var(--color-neutral-ink);
	}
	.state {
		fill: var(--color-surface);
		stroke: var(--color-neutral-ink);
		stroke-width: 1.5;
	}
	.inner {
		fill: none;
		stroke: var(--color-neutral-ink);
		stroke-width: 1.5;
	}
	.name,
	.label,
	.start-label {
		text-anchor: middle;
		dominant-baseline: central;
	}
	.name {
		font-family: var(--font-ui);
		font-weight: var(--weight-strong);
		fill: var(--color-ink);
		/* A tap or a click is on the circle, not on the text. */
		pointer-events: none;
	}
	.label {
		font-family: var(--font-mono);
		font-size: var(--text-md);
		fill: var(--color-ink);
		/* A halo in the color of the canvas, so that a line never cuts the text. */
		paint-order: stroke;
		stroke: var(--color-ground);
		stroke-width: 4px;
		stroke-linejoin: round;
		pointer-events: none;
	}
	.start-label {
		font-family: var(--font-ui);
		font-size: var(--text-xs);
		fill: var(--color-muted);
		pointer-events: none;
	}

	/* The editor: a state is something to press, and it keeps the touch for itself (no scroll). */
	.node {
		cursor: pointer;
		touch-action: none;
		outline: none;
	}
	.selection {
		fill: none;
		stroke: var(--color-accent);
		stroke-width: 2;
	}
	.focus-ring {
		fill: none;
		stroke: var(--focus-ring-color);
		stroke-width: var(--focus-ring-width);
		visibility: hidden;
	}
	.node:focus-visible .focus-ring {
		visibility: visible;
	}
	/* The edges of the editor. The invisible lines are what a pointer hits; the circles are above them. */
	.edge {
		cursor: pointer;
	}
	.hit {
		fill: none;
		stroke: transparent;
		stroke-width: 44px;
		/* 44 px on the screen at every zoom. */
		vector-effect: non-scaling-stroke;
		stroke-linecap: round;
		pointer-events: stroke;
	}
	.hit-label {
		fill: transparent;
		pointer-events: all;
	}
	.edge.chosen .line {
		stroke: var(--color-accent);
		stroke-width: 3;
	}
	.label.chosen {
		fill: var(--color-accent-ink);
		font-weight: var(--weight-strong);
	}
	.edge-node {
		outline: none;
		pointer-events: none;
	}
	.ring {
		fill: none;
		stroke: var(--focus-ring-color);
		stroke-width: calc(var(--focus-ring-width) * 2);
		visibility: hidden;
	}
	.edge-node:focus-visible .ring {
		visibility: visible;
	}
	.node[aria-pressed='true'] .state {
		fill: var(--color-accent-tint);
	}
</style>
