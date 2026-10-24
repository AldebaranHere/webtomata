<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { MachineDocument } from '../document.ts';
	import DiagramDrawing from './DiagramDrawing.svelte';
	import { edgeGeometry } from './geometry.ts';

	// A machine, drawn as SVG and read-only (the editor is EditorCanvas.svelte).
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
	<DiagramDrawing {shapes} {arrow} />
</svg>

<style>
	.diagram {
		display: block;
		max-width: 100%;
		height: auto;
	}
</style>
