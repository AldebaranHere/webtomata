<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { BaseAutosave } from '#lib/storage/autosave.ts';
	import { useAutosaveBinding } from './autosave-binding.svelte.ts';
	import { pdaDiagram } from './diagram/pda-diagram.ts';
	import EditorCanvas, { type LabelSlot } from './EditorCanvas.svelte';
	import EditorFrame from './EditorFrame.svelte';
	import { createPdaEditor } from './interaction/pda-editor.ts';
	import type { PdaDocument } from './pda-document.ts';
	import PdaLabelForm from './PdaLabelForm.svelte';
	import PdaLabelPopover from './PdaLabelPopover.svelte';
	import { pdaMenuLabels } from './pda-label.ts';

	// The editor of a pushdown automaton: the tools, the canvas and the title bar.
	// Starts from `doc`. Changes are debounced-saved to storage with `autosave`.
	// See docs/agent/PLAN.md (Task T-057) and design/screens/pda-editor.md.
	let {
		doc,
		autosave,
		persistent = true
	}: {
		doc: PdaDocument;
		autosave?: BaseAutosave<PdaDocument>;
		persistent?: boolean;
	} = $props();

	const editor = createPdaEditor(untrack(() => doc));
	let ready = $state(false);
	onMount(() => (ready = true));
	let snapshot = $state(editor.getState());
	let canvas: ReturnType<typeof EditorCanvas>;
	$effect(() => editor.subscribe(() => (snapshot = editor.getState())));

	// Shared autosave binding: schedules writes, flushes on visibility/pagehide/unmount,
	// handles beforeunload warning, and computes saveStatus & problem indications.
	const autosaveBinding = useAutosaveBinding({
		editor,
		autosave: () => autosave,
		persistent: () => persistent,
		dirty: () => snapshot.dirty
	});
	const saveStatus = $derived(autosaveBinding.saveStatus);
	const problem = $derived(autosaveBinding.problem);

	// Diagram adapter created once: converts PdaDocument to DiagramInput with '+ n lagi' overflow text.
	const diagramAdapter = (d: PdaDocument) =>
		pdaDiagram(d, (count) => t('pda_editor.edge_more', { count }));

	// On a phone (max-width: 39.99rem), the form is rendered as a bottom sheet in the frame's panel slot.
	// On a laptop/desktop, it is rendered as a popover over the edge through the canvas label slot.
	// The choice is determined when the form opens and kept until it closes.
	// We preserve stable non-null copies of `labeling` and `slot` while the form is open so child components
	// are never passed null props during unmount / reactive flush.
	let formDisplayMode = $state<'popover' | 'sheet' | null>(null);
	let activeLabeling = $state<{ from: number; to: number } | null>(null);
	let lastSlot: LabelSlot | null = null;
	let lastLabelingOpen = false;

	function slotWithFallback(slot: LabelSlot | null): LabelSlot | null {
		if (slot) lastSlot = slot;
		return slot ?? lastSlot;
	}

	$effect(() => {
		const open = snapshot.labeling;
		const isOpen = open !== null;
		if (isOpen && !lastLabelingOpen) {
			const isPhone = window.matchMedia('(max-width: 39.99rem)').matches;
			formDisplayMode = isPhone ? 'sheet' : 'popover';
			activeLabeling = { from: open.from, to: open.to };
		} else if (isOpen) {
			activeLabeling = { from: open.from, to: open.to };
		} else if (!isOpen && lastLabelingOpen) {
			formDisplayMode = null;
			activeLabeling = null;
			lastSlot = null;
		}
		lastLabelingOpen = isOpen;
	});

	const fromStateName = $derived.by(() => {
		const open = activeLabeling ?? snapshot.labeling;
		if (!open) return '';
		return snapshot.doc.states.find((s) => s.id === open.from)?.name ?? `q${open.from}`;
	});
	const toStateName = $derived.by(() => {
		const open = activeLabeling ?? snapshot.labeling;
		if (!open) return '';
		return snapshot.doc.states.find((s) => s.id === open.to)?.name ?? `q${open.to}`;
	});
</script>

<EditorFrame
	{ready}
	tool={snapshot.tool}
	canUndo={snapshot.canUndo}
	canRedo={snapshot.canRedo}
	ontool={(tool) => editor.setTool(tool)}
	onundo={() => editor.undo()}
	onredo={() => editor.redo()}
	title={snapshot.doc.title || t('editor.untitled')}
	stateCount={snapshot.doc.states.length}
	hasAutosave={autosave !== undefined}
	{saveStatus}
	{persistent}
	onfit={() => canvas.zoom('fit')}
	{problem}
	hintLine={snapshot.tool === 'transition' && snapshot.labeling === null
		? t(snapshot.link ? 'editor.hint_pick_target' : 'editor.hint_pick_source')
		: null}
	toast={snapshot.toast}
	ontoastundo={() => editor.undo()}
	ontoastdismiss={() => editor.dismissToast()}
	announcement={snapshot.announcement}
>
	{#snippet stage()}
		<EditorCanvas
			bind:this={canvas}
			{editor}
			state={snapshot}
			diagram={diagramAdapter}
			menuLabels={pdaMenuLabels}
			revealLabeling={formDisplayMode === 'sheet'}
		>
			{#snippet label(slot)}
				{@const currentSlot = slotWithFallback(slot)}
				{#if formDisplayMode === 'popover' && (activeLabeling ?? snapshot.labeling) && currentSlot}
					{@const currentLabeling = (activeLabeling ?? snapshot.labeling)!}
					<PdaLabelPopover
						{editor}
						doc={snapshot.doc}
						labeling={currentLabeling}
						slotData={currentSlot}
					/>
				{/if}
			{/snippet}
		</EditorCanvas>
	{/snippet}
	{#snippet panel()}
		{#if formDisplayMode === 'sheet' && (activeLabeling ?? snapshot.labeling)}
			{@const currentLabeling = (activeLabeling ?? snapshot.labeling)!}
			<aside
				class="pda-sheet"
				aria-label={t('pda_editor.form_title', { from: fromStateName, to: toStateName })}
			>
				<PdaLabelForm {editor} doc={snapshot.doc} labeling={currentLabeling} />
			</aside>
		{/if}
	{/snippet}
</EditorFrame>

<style>
	.pda-sheet {
		display: flex;
		flex-direction: column;
		max-height: 60%;
		overflow-y: auto;
		background: var(--color-surface);
		border-top: 1px solid var(--color-border);
		box-shadow: var(--shadow-modal);
	}
</style>
