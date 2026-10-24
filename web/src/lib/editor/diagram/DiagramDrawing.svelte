<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { INNER_RADIUS, RADIUS } from './geometry.ts';
	import type { DiagramShapes, StateShape } from './geometry.ts';

	// The inside of a diagram: the lines, the circles and the labels. The read-only view and the
	// editor both use it. All the places come from edgeGeometry (geometry.ts).
	//
	// With `interactive`, each state is a button that the keyboard can reach, with a name for screen
	// readers, a ring when it is selected, and a ring when it has the focus. The pointer and key
	// handlers are on the svg that holds this (they find a state by its `data-state`).
	let {
		shapes,
		arrow,
		selected = new Set<number>(),
		interactive = false
	}: {
		shapes: DiagramShapes;
		/** The id of the arrowhead (it must be unique in the page). */
		arrow: string;
		selected?: ReadonlySet<number>;
		interactive?: boolean;
	} = $props();

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
		<path class="line" d={edge.path} marker-end="url(#{arrow})" />
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

<g class="labels">
	{#each shapes.edges as edge (`${edge.from}>${edge.to}`)}
		<text class="label" x={edge.label.center.x} y={edge.label.center.y}>{edge.label.text}</text>
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
	.node[aria-pressed='true'] .state {
		fill: var(--color-accent-tint);
	}
</style>
