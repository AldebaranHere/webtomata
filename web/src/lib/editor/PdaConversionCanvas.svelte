<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { PdaDocument } from './pda-document.ts';
	import { pdaDiagram } from './diagram/pda-diagram.ts';
	import { diagramGeometry, INNER_RADIUS, RADIUS, labelLineY } from './diagram/geometry.ts';

	// The canvas while a conversion is open: the RNF machine, read-only and fitted to the space
	// (no zoom, no tools). It draws the lines itself because the shared `DiagramDrawing` paints
	// only in the editor (its `taken` class exists only when it is interactive); this way the
	// `from>to` group of the step can keep the accent, exactly as the sheet asks (T-038b R3).
	let {
		doc,
		active = new Set<number>(),
		taken = new Set<string>()
	}: {
		doc: PdaDocument;
		active?: ReadonlySet<number>;
		taken?: ReadonlySet<string>;
	} = $props();

	const uid = $props.id();
	const arrow = `${uid}-arrow`;
	const PADDING = 40;

	const shapes = $derived(
		diagramGeometry(
			pdaDiagram(doc, (count) => t('pda_editor.edge_more', { count })),
			{
				startLabel: t('diagram.start')
			}
		)
	);
	const view = $derived({
		x: shapes.bounds.x - PADDING,
		y: shapes.bounds.y - PADDING,
		width: Math.max(shapes.bounds.width + 2 * PADDING, 1),
		height: Math.max(shapes.bounds.height + 2 * PADDING, 1)
	});
</script>

<figure class="conversion-canvas">
	<figcaption>{t('pda_convert.result_caption')}</figcaption>
	<svg
		role="img"
		aria-label={t('pda_convert.canvas', {
			states: doc.states.length,
			transitions: doc.transitions.length
		})}
		viewBox="{view.x} {view.y} {view.width} {view.height}"
		preserveAspectRatio="xMidYMid meet"
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
				<path
					class="line"
					class:taken={taken.has(`${edge.from}>${edge.to}`)}
					d={edge.path}
					marker-end="url(#{arrow})"
				/>
			{/each}
			{#if shapes.start}
				<path class="start" d={shapes.start.path} />
			{/if}
		</g>
		<g class="states">
			{#each shapes.states as state (state.id)}
				<g class:active={active.has(state.id)}>
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
				{#if edge.label.lines.length <= 1}
					<text
						class="label"
						class:taken={taken.has(`${edge.from}>${edge.to}`)}
						x={edge.label.center.x}
						y={edge.label.center.y}
					>
						{edge.label.text}
					</text>
				{:else}
					<text
						class="label"
						class:taken={taken.has(`${edge.from}>${edge.to}`)}
						x={edge.label.center.x}
						y={edge.label.center.y}
					>
						{#each edge.label.lines as line, i (i)}
							<tspan
								x={edge.label.center.x}
								y={labelLineY(edge.label.box, i)}
								class:overflow-line={edge.label.overflow && i === edge.label.lines.length - 1}
								>{line}</tspan
							>
						{/each}
					</text>
				{/if}
			{/each}
			{#if shapes.start}
				<text class="start-label" x={shapes.start.label.center.x} y={shapes.start.label.center.y}>
					{shapes.start.label.text}
				</text>
			{/if}
		</g>
	</svg>
</figure>

<style>
	.conversion-canvas {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
		min-width: 0;
		margin: 0;
		background-color: var(--color-ground);
		background-image: radial-gradient(var(--color-canvas-dot) 1px, transparent 1px);
		background-size: 20px 20px;
	}
	figcaption {
		padding: var(--space-1) var(--space-3);
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	svg {
		display: block;
		flex: 1;
		width: 100%;
		min-height: 0;
	}
	.line {
		fill: none;
		stroke: var(--color-neutral-ink);
		stroke-width: 1.5;
	}
	.line.taken {
		stroke: var(--color-accent);
		stroke-width: 3;
	}
	.start {
		fill: var(--color-surface);
		stroke: var(--color-neutral-ink);
		stroke-width: 1.5;
		stroke-linejoin: round;
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
	.active .state {
		fill: var(--color-accent-tint);
		stroke: var(--color-accent);
		stroke-width: 3.5;
	}
	.active .inner {
		stroke: var(--color-accent);
	}
	.name {
		font-family: var(--font-ui);
		font-weight: var(--weight-strong);
		fill: var(--color-ink);
		text-anchor: middle;
		dominant-baseline: central;
		pointer-events: none;
	}
	.label {
		font-family: var(--font-mono);
		font-size: var(--text-md);
		fill: var(--color-ink);
		text-anchor: middle;
		dominant-baseline: central;
		paint-order: stroke;
		stroke: var(--color-ground);
		stroke-width: 4px;
		stroke-linejoin: round;
		pointer-events: none;
	}
	.label.taken {
		fill: var(--color-accent-ink);
		font-weight: var(--weight-strong);
	}
	.overflow-line {
		fill: var(--color-accent-ink);
		text-decoration: underline;
	}
	.start-label {
		font-family: var(--font-ui);
		font-size: var(--text-xs);
		fill: var(--color-muted);
		text-anchor: middle;
		dominant-baseline: central;
		pointer-events: none;
	}
</style>
