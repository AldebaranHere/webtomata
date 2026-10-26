<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { MachineDocument } from './document.ts';
	import DiagramDrawing from './diagram/DiagramDrawing.svelte';
	import { edgeGeometry } from './diagram/geometry.ts';

	// The canvas while a conversion is open: the machine of the step, read-only, fitted to the space
	// (no zoom, no tools). The editor stays under it with its camera and its selection. The panel has
	// the same machine as a table and a sentence, so that nothing is told by the picture alone.
	let { doc, active = new Set<number>() }: { doc: MachineDocument; active?: ReadonlySet<number> } =
		$props();

	const uid = $props.id();
	const arrow = `${uid}-arrow`;
	const PADDING = 40;

	const shapes = $derived(edgeGeometry(doc, { startLabel: t('diagram.start') }));
	const view = $derived({
		x: shapes.bounds.x - PADDING,
		y: shapes.bounds.y - PADDING,
		width: Math.max(shapes.bounds.width + 2 * PADDING, 1),
		height: Math.max(shapes.bounds.height + 2 * PADDING, 1)
	});
	const description = $derived(
		t('convert.canvas', {
			description: t('diagram.label', {
				kind: doc.kind === 'dfsm' ? 'DFSM' : 'NDFSM',
				count: doc.states.length
			})
		})
	);
</script>

<div class="conversion-canvas">
	<svg
		role="img"
		aria-label={description}
		viewBox="{view.x} {view.y} {view.width} {view.height}"
		preserveAspectRatio="xMidYMid meet"
	>
		<DiagramDrawing {shapes} {arrow} {active} />
	</svg>
</div>

<style>
	.conversion-canvas {
		flex: 1;
		min-height: 0;
		min-width: 0;
		background-color: var(--color-ground);
		background-image: radial-gradient(var(--color-canvas-dot) 1px, transparent 1px);
		background-size: 20px 20px;
	}
	svg {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
