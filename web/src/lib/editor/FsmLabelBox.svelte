<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { MessageKey } from '#lib/i18n/id.ts';
	import type { MachineDocument } from './document.ts';
	import LabelField from './LabelField.svelte';
	import type { Editor } from './interaction/editor.ts';
	import { labelOf } from './interaction/label.ts';
	import type { LabelSlot } from './EditorCanvas.svelte';

	let {
		editor,
		doc,
		labeling,
		slotData
	}: {
		editor: Editor;
		doc: MachineDocument;
		labeling: { from: number; to: number; ask: string | null } | null;
		slotData: LabelSlot;
	} = $props();

	let labelProblem = $state<string | null>(null);
	$effect(() => {
		if (!labeling) labelProblem = null;
	});

	const initial = $derived(labelOf(doc, slotData.from, slotData.to));
</script>

<LabelField
	x={slotData.x}
	y={slotData.y}
	{initial}
	problem={labelProblem}
	ask={labeling?.ask ?? null}
	oncommit={(text, split) => {
		const result = editor.commitLabel(text, split);
		labelProblem = result && 'key' in result ? t(result.key as MessageKey, result.params) : null;
	}}
	oncancel={() => editor.cancelLabel()}
	onleave={(text) => {
		// Leaving the box sends a text that changed, and cancels in every other case.
		if (text.trim() === initial || editor.commitLabel(text) !== null) {
			editor.cancelLabel();
		}
	}}
/>
