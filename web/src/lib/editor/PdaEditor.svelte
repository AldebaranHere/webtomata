<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { Component } from 'svelte';
	import { engine } from '#lib/engine/client.ts';
	import type { Competition } from '#lib/engine/types.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { BaseAutosave } from '#lib/storage/autosave.ts';
	import { useAutosaveBinding } from './autosave-binding.svelte.ts';
	import { createChecker } from './checker.ts';
	import { flagsOf } from './checks.ts';
	import ChecksList from './ChecksList.svelte';
	import { pdaDiagram } from './diagram/pda-diagram.ts';
	import EditorCanvas, { type LabelSlot } from './EditorCanvas.svelte';
	import EditorFrame from './EditorFrame.svelte';
	import { createPdaEditor } from './interaction/pda-editor.ts';
	import KindSwitch from './KindSwitch.svelte';
	import { pdaCheckItems } from './pda-checks.ts';
	import PdaDeterminismBadge from './PdaDeterminismBadge.svelte';
	import { badgeModel, createDeterminism } from './pda-determinism.ts';
	import { toEnginePda } from './pda-document.ts';
	import type { PdaDocument, PdaKind } from './pda-document.ts';
	import PdaLabelForm from './PdaLabelForm.svelte';
	import PdaLabelPopover from './PdaLabelPopover.svelte';
	import { pdaMenuLabels } from './pda-label.ts';
	import type { PdaRowFocus } from './pda-table-props.ts';
	import type { PdaTableProps } from './pda-table-props.ts';
	import { readTab, saveTab } from './panel-tab.ts';
	import type { PanelTab } from './panel-tab.ts';
	import SidePanel from './SidePanel.svelte';

	// The editor of a pushdown automaton: the tools, the canvas, the title bar and the side panel.
	// Starts from `doc`. Changes are debounced-saved to storage with `autosave`.
	// See docs/agent/PLAN.md (Task T-051 and T-057) and design/screens/pda-editor.md.
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
	let sidePanel = $state<ReturnType<typeof SidePanel>>();

	// Marked rows in the table: row indices with accent bar and aria-current="true".
	// Cleared when the document changes or when another edge or state is selected.
	let marked = $state<ReadonlySet<number>>(new Set());
	let markedEdge: { from: number; to: number } | null = null;
	let lastDoc = untrack(() => editor.getState().doc);

	// "Tunjukkan" of the determinism badge: the pair that is shown, the sentence the badge says to a
	// screen reader, and the row whose first control the table must focus. None of it is in the
	// document or in the history.
	let shown = $state<Competition | null>(null);
	let liveMessage = $state('');
	let rowFocus = $state.raw<PdaRowFocus | null>(null);
	let rowFocusRequest = 0;

	/** The shown pair goes with the marks: T-051's rule clears both together. */
	function forgetShown() {
		shown = null;
		liveMessage = '';
	}

	$effect(() => {
		const stop = editor.subscribe(() => {
			const nextState = editor.getState();
			snapshot = nextState;
			if (nextState.doc !== lastDoc) {
				lastDoc = nextState.doc;
				marked = new Set();
				markedEdge = null;
				forgetShown();
			} else if (marked.size > 0) {
				const differentEdge =
					nextState.edge !== null &&
					markedEdge !== null &&
					(nextState.edge.from !== markedEdge.from || nextState.edge.to !== markedEdge.to);
				if (nextState.selection.length > 0 || differentEdge) {
					marked = new Set();
					markedEdge = null;
					forgetShown();
				}
			}
		});
		return stop;
	});

	// The checks: the engine worker validates the PDA a moment after each change, and
	// the states with checks get flags on the diagram. Requested after the first draw.
	const checker = createChecker<PdaDocument>({
		validate: (d) => engine.validatePda(toEnginePda(d)),
		toItems: pdaCheckItems
	});
	let checks = $state.raw({
		status: checker.status(),
		items: checker.items(),
		problem: checker.problem()
	});
	$effect(() => {
		const read = () =>
			(checks = { status: checker.status(), items: checker.items(), problem: checker.problem() });
		const stop = checker.subscribe(read);
		let last = untrack(() => editor.getState().doc);
		const stopEditor = editor.subscribe(() => {
			const next = editor.getState().doc;
			if (next === last) return;
			last = next;
			checker.schedule(next);
		});
		checker.schedule(last);
		return () => {
			stop();
			stopEditor();
			checker.dispose();
		};
	});
	const flags = $derived(flagsOf(checks.items));

	// The competing pairs: a second query of the engine, a moment after each change, in the same
	// way as the checks. The badge shows nothing while a new answer is on its way.
	const determinism = createDeterminism({
		query: (d) => engine.pdaDeterminism(toEnginePda(d))
	});
	let pairs = $state.raw({ status: determinism.status(), pairs: determinism.pairs() });
	$effect(() => {
		const read = () => (pairs = { status: determinism.status(), pairs: determinism.pairs() });
		const stop = determinism.subscribe(read);
		let last = untrack(() => editor.getState().doc);
		const stopEditor = editor.subscribe(() => {
			const next = editor.getState().doc;
			if (next === last) return;
			last = next;
			determinism.schedule(next);
		});
		determinism.schedule(last);
		return () => {
			stop();
			stopEditor();
			determinism.dispose();
		};
	});
	const badge = $derived(
		pairs.status === 'ready'
			? badgeModel(
					snapshot.doc.kind,
					snapshot.doc.transitions.length,
					pairs.pairs.length
				)
			: null
	);

	/**
	 * "Tunjukkan" on a pair: the first edge is selected and both of its rows are marked, and a second
	 * press on the same pair clears it. The focus goes to the first row of the table when the Tabel
	 * tab is open; in the Definisi tab it stays on the button that was pressed.
	 */
	function showPair(pair: Competition) {
		const first = snapshot.doc.transitions[pair.first];
		if (first === undefined) return;

		if (shown !== null && shown.first === pair.first && shown.second === pair.second) {
			marked = new Set();
			markedEdge = null;
			forgetShown();
			// The editor says "editor.selection_cleared" and drops the selected edge.
			editor.clearSelection();
			return;
		}

		shown = pair;
		marked = new Set([pair.first, pair.second]);
		markedEdge = { from: first.from, to: first.to };
		liveMessage = t('pda_editor.pair_selected', { first: pair.first + 1, second: pair.second + 1 });
		editor.selectEdge(first.from, first.to);
		if (tab === 'table') {
			rowFocus = { index: pair.first, field: 'from', request: ++rowFocusRequest };
		}
	}

	// The panel tabs: Tabel then Definisi.
	const tabs: readonly PanelTab[] = ['table', 'definition'];
	let tab = $state<PanelTab>(untrack(() => readTab(undefined, tabs)));
	function chooseTab(next: PanelTab) {
		tab = next;
		saveTab(next);
	}

	// Kind switch options: DPDA or NDPDA.
	const PDA_KINDS: readonly [PdaKind, PdaKind] = ['dpda', 'ndpda'];

	function chooseKind(kind: PdaKind) {
		editor.apply(
			{ type: 'setKind', kind },
			{ say: { key: 'editor.kind_set', params: { kind: t(`kind.${kind}`) } } }
		);
	}

	// Table and Definition views are loaded on demand when their respective tab opens.
	let Table = $state<Component<PdaTableProps> | null>(null);
	let Definition = $state<Component<{ doc: PdaDocument }> | null>(null);
	$effect(() => {
		if (tab === 'table' && !Table) {
			void import('./PdaTableView.svelte').then((module) => (Table = module.default));
		}
		if (tab === 'definition' && !Definition) {
			void import('./PdaDefinitionView.svelte').then((module) => (Definition = module.default));
		}
	});

	function handleMore(from: number, to: number) {
		editor.selectEdge(from, to);
		chooseTab('table');
		sidePanel?.show();
		const rows: number[] = [];
		markedEdge = { from, to };
		editor.getState().doc.transitions.forEach((t, i) => {
			if (t.from === from && t.to === to) rows.push(i);
		});
		marked = new Set(rows);
		forgetShown();
	}

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

<!-- The head block of the panel: the kind switch, the determinism badge and the checks, written once
     and used by both tabs (T-062). The live region of the badge is always in the page, so that the
     sentence of "Tunjukkan" is announced when the button is pressed. -->
{#snippet head()}
	<KindSwitch kind={snapshot.doc.kind} onchange={chooseKind} kinds={PDA_KINDS} />
	<PdaDeterminismBadge
		kind={snapshot.doc.kind}
		model={badge}
		doc={snapshot.doc}
		pairs={pairs.pairs}
		{shown}
		onshow={showPair}
	/>
	<p class="pda-live sr-only" aria-live="polite">{liveMessage}</p>
	<ChecksList
		status={checks.status}
		items={checks.items}
		problem={checks.problem}
		onretry={() => checker.retry()}
		onselect={(id) => editor.focusState(id, { keepSelection: false })}
	/>
{/snippet}

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
			{flags}
			onmore={handleMore}
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
		{:else}
			<SidePanel bind:this={sidePanel} {tab} {tabs} ontab={chooseTab}>
				{#snippet table()}
					{@render head()}
					{#if Table}
						<Table
							doc={snapshot.doc}
							{marked}
							onapply={(command, note) => editor.apply(command, note)}
							{rowFocus}
						/>
					{/if}
				{/snippet}
				{#snippet definition()}
					{@render head()}
					{#if Definition}
						<Definition doc={snapshot.doc} />
					{/if}
				{/snippet}
			</SidePanel>
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
