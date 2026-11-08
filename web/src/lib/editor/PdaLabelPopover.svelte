<script lang="ts">
	import { tick } from 'svelte';
	import type { PdaCommand } from './pda-commands.ts';
	import type { PdaDocument } from './pda-document.ts';
	import type { EditorCore } from './interaction/editor.ts';
	import type { LabelSlot } from './EditorCanvas.svelte';
	import PdaLabelForm from './PdaLabelForm.svelte';

	let {
		editor,
		doc,
		labeling,
		slotData
	}: {
		editor: EditorCore<PdaDocument, PdaCommand>;
		doc: PdaDocument;
		labeling: { from: number; to: number };
		slotData: LabelSlot;
	} = $props();

	const WIDTH = 320;
	let box: HTMLDivElement;

	let targetX = $derived(Math.max(4, (slotData?.x ?? 0) - WIDTH / 2));
	let targetY = $derived(Math.max(4, (slotData?.y ?? 0) - 44));
	let clampedX = $state<number | null>(null);
	let clampedY = $state<number | null>(null);
	let posX = $derived(clampedX ?? targetX);
	let posY = $derived(clampedY ?? targetY);

	$effect(() => {
		void targetX;
		void targetY;
		void slotData?.x;
		void slotData?.y;

		void tick().then(() => {
			if (!box || !box.parentElement) {
				clampedX = null;
				clampedY = null;
				return;
			}
			const parent = box.parentElement;
			const parentRect = parent.getBoundingClientRect();
			const boxRect = box.getBoundingClientRect();

			if (targetX + boxRect.width > parentRect.width - 4) {
				clampedX = Math.max(4, parentRect.width - boxRect.width - 4);
			} else {
				clampedX = null;
			}

			if (targetY + boxRect.height > parentRect.height - 4) {
				clampedY = Math.max(4, parentRect.height - boxRect.height - 4);
			} else {
				clampedY = null;
			}
		});
	});
</script>

<div class="popover pda-label-popover" bind:this={box} style:left="{posX}px" style:top="{posY}px">
	<PdaLabelForm {editor} {doc} {labeling} />
</div>

<style>
	.popover {
		position: absolute;
		z-index: 10;
		max-width: calc(100% - 8px);
	}
</style>
