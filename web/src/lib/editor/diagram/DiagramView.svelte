<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { MachineDocument } from '../document.ts';
	import { INNER_RADIUS, RADIUS, edgeGeometry } from './geometry.ts';

	// A machine, drawn as SVG and read-only. All the places come from edgeGeometry (geometry.ts).
	let { doc }: { doc: MachineDocument } = $props();

	// The arrowhead is shared by all the lines of this diagram.
	const uid = $props.id();
	const arrow = `${uid}-arrow`;
	const PADDING = 24;

	const shapes = $derived(edgeGeometry(doc, { startLabel: t('diagram.start') }));
	const view = $derived({
		x: shapes.bounds.x - PADDING,
		y: shapes.bounds.y - PADDING,
		width: shapes.bounds.width + 2 * PADDING,
		height: shapes.bounds.height + 2 * PADDING
	});
	const description = $derived(
		t('diagram.label', {
			kind: doc.kind === 'dfsm' ? 'DFSM' : 'NDFSM',
			count: doc.states.length
		})
	);
</script>

<svg
	class="diagram"
	role="img"
	aria-label={description}
	viewBox="{view.x} {view.y} {view.width} {view.height}"
	width={view.width}
	height={view.height}
>
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
</svg>

<style>
	.diagram {
		display: block;
		max-width: 100%;
		height: auto;
	}
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
	}
	.start-label {
		font-family: var(--font-ui);
		font-size: var(--text-xs);
		fill: var(--color-muted);
	}
</style>
